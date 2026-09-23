/**
 * R11a 会员前置批 · 收银台售卡/续费面板（Phase 3A · 27 号任务书 §四.1/§四.5/§四.6）
 *
 * - 售卡四档对照卡（微光免费开档 / 萤火 ¥199 / 烛光 ¥299 / 暖阳 ¥599；价格/回馈金/
 *   服务折扣/多宠规则全部读 membership.plans 透出，配置端口改值即生效）；
 * - 多宠数输入：>included_pets 预览附加费 +¥59/只（读档参数），max_pets 封顶提示；
 * - 内测期到店付收款段（现金/微信/支付宝，Σ段=档价+附加费，server 硬校验同口径）；
 *   微光档 0 元单直接成交（paySegments 为空）；
 * - 新客旁路：手机号建档+售卡一气呵成（sell 的 phone 建档参数：仅建档不开档，
 *   购卡成交才开档——任务书 §四.6）；
 * - 续费模式：会员已识别且 frozen/临期（≤30 天，本端会话缓存判定）时默认续费；
 *   续费金额由 server 按既有档位+宠物数实算——**读路径缺口报备**：无商家侧查询
 *   端点，先经 renew 空段探测解析错误原文「须等于续费金额（X 元）」取得应收，
 *   再收段提交（微光档探测即成交=免费续期）；
 * - 成交=开通确认 toast + onSold 回写（父层缓存会员状态 + 流水/已收失效刷新）；
 *   server 错误一律原文透出（已是会员/多宠封顶/支付合计不符等）。
 *
 * 权限：sell/renew 为 merchantProcedure——clerk 可售卡收款（三级权限不动）。
 */

import { usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CreditCard, Minus, Plus, RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errMsg, fenToYuan, yuanToFen } from '@/components/mall-admin/format'
import { CashierModal, SheetBtn } from './dialogs'
import {
  MEMBER_FOR_USER_KEY,
  MEMBER_PLANS_KEY,
  MEMBERSHIP_STATUS_LABEL,
  planShortLabel,
  rebatePercentLabel,
  serviceDiscountLabel,
  type MemberPlan,
  type MembershipRow,
} from './membership'
import type { CashierMember } from './model'

type PaySegMethod = 'cash' | 'wechat' | 'alipay'
const SEG_LABEL: Record<PaySegMethod, string> = { cash: '现金', wechat: '微信', alipay: '支付宝' }

const segInputCls =
  'w-[104px] rounded-[6px] bg-[#FFFDF6] px-2.5 py-[7px] text-right font-number text-caption font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.25)]'

/** 续费金额探测：解析 server 原文「须等于续费金额（X 元）」（读路径缺口报备口径） */
const RENEW_QUOTE_RE = /续费金额（([\d.]+) 元/

export default function MembershipPanel({
  open,
  member,
  membership,
  prefillPhone,
  preselectPlanKey,
  defaultMode,
  onSold,
  onClose,
}: {
  open: boolean
  /** 已识别会员（null=新客旁路：手机号建档+售卡一气呵成） */
  member: CashierMember | null
  /** 本端会话缓存的会员状态（售卡/续费成交回写；无 server 读路径的骨架批口径） */
  membership: MembershipRow | null
  /** 检索未命中的手机号带入（新客建档） */
  prefillPhone?: string
  /** 立省钩子快捷入口预选档位（萤火） */
  preselectPlanKey?: string | null
  /** frozen/临期默认续费 */
  defaultMode?: 'sell' | 'renew'
  /** 成交回写（售卡/续费同口） */
  onSold: (m: MembershipRow) => void
  onClose: () => void
}) {
  const { trpc, queryClient } = usePhiliaClient()

  /* ---------------- 状态（打开即重置，wasOpen 模式同既有弹层） ---------------- */
  const [mode, setMode] = useState<'sell' | 'renew'>('sell')
  const [planKey, setPlanKey] = useState<string>('plan_yinghuo')
  const [petCount, setPetCount] = useState(1)
  const [phone, setPhone] = useState('')
  const [segInputs, setSegInputs] = useState<Record<PaySegMethod, string>>({ cash: '', wechat: '', alipay: '' })
  const [quoteFen, setQuoteFen] = useState<number | null>(null)
  const [sellErrorHint, setSellErrorHint] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMode(defaultMode === 'renew' && member ? 'renew' : 'sell')
      setPlanKey(preselectPlanKey ?? 'plan_yinghuo')
      setPetCount(1)
      setPhone(prefillPhone ?? '')
      setSegInputs({ cash: '', wechat: '', alipay: '' })
      setQuoteFen(null)
      setSellErrorHint(null)
    }
  }

  /* ---------------- 档位目录（public，clerk 可读） ---------------- */
  const plansQ = useQuery({
    queryKey: MEMBER_PLANS_KEY,
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 300_000,
  })
  const plans = plansQ.data?.plans ?? []
  const plan: MemberPlan | undefined = plans.find((p) => p.planKey === planKey)

  /* ---------------- 售卡金额（镜像 server membershipChargeFen：档价+多宠附加） ---------------- */
  const extraCount = plan ? Math.max(0, petCount - plan.includedPets) : 0
  const extraFen = plan ? extraCount * plan.extraPetFen : 0
  const sellAmountFen = plan ? plan.priceFen + extraFen : 0
  const isFree = plan?.free === true || sellAmountFen === 0

  /** 目标应收（售卡=档价+附加；续费=server 探测实算 quoteFen） */
  const targetFen = mode === 'sell' ? sellAmountFen : (quoteFen ?? 0)

  const segFen = (m: PaySegMethod) => yuanToFen(segInputs[m]) ?? 0
  const segSum = segFen('cash') + segFen('wechat') + segFen('alipay')
  const segBalanced = targetFen > 0 && segSum === targetFen
  const segInvalid = (['cash', 'wechat', 'alipay'] as const).some(
    (m) => segInputs[m].trim() !== '' && yuanToFen(segInputs[m]) === null,
  )

  /** 现金段自动承担剩余（微信/支付宝手输后回填） */
  const onSegInput = (m: PaySegMethod, v: string) => {
    const next = { ...segInputs, [m]: v }
    if (m !== 'cash' && targetFen > 0) {
      const others = (yuanToFen(next.wechat) ?? 0) + (yuanToFen(next.alipay) ?? 0)
      const remain = targetFen - others
      next.cash = remain > 0 ? String(remain / 100) : ''
    }
    setSegInputs(next)
  }

  /* ---------------- 客户解析（售卡：已识别会员 userId 或手机号建档旁路） ---------------- */
  const phoneValid = /^1\d{10}$/.test(phone.trim())
  const sellCustomerOk = member !== null || phoneValid

  /* ---------------- 动作 ---------------- */
  /** 成交后失效 forUser 正式通道缓存（会员识别条/回馈金段余额即时见真值） */
  const invalidateForUser = (userId: string) =>
    void queryClient.invalidateQueries({ queryKey: MEMBER_FOR_USER_KEY(userId) })

  const sellM = useMutation({
    mutationFn: () =>
      trpc.membership.sell.mutate({
        ...(member ? { userId: member.id } : { phone: phone.trim() }),
        planKey,
        petCount,
        paySegments: isFree
          ? []
          : (['cash', 'wechat', 'alipay'] as const)
              .map((m) => ({ method: m, amountFen: segFen(m) }))
              .filter((s) => s.amountFen > 0),
      }),
    onSuccess: (r) => {
      toast.success(
        `已开通「${planShortLabel(r.membership.planKey)}」会员 · 售卡单 ${r.billNo}（¥${fenToYuan(r.amountFen)}，有效期 365 天）`,
      )
      invalidateForUser(r.membership.userId)
      onSold(r.membership)
      onClose()
    },
    onError: (e) => {
      const msg = errMsg(e)
      toast.error(msg) // server 错误原文透出（已是会员/多宠封顶/支付合计不符等）
      setSellErrorHint(msg.includes('续费') ? msg : null)
    },
  })

  /** 续费探测（读路径缺口报备：空段提交取 server 实算金额；微光档探测即免费续期成交） */
  const quoteM = useMutation({
    mutationFn: () => trpc.membership.renew.mutate({ userId: member!.id, paySegments: [] }),
    onSuccess: (r) => {
      toast.success(`已免费续期「${planShortLabel(r.membership.planKey)}」（0 元档，有效期顺延 365 天）`)
      invalidateForUser(r.membership.userId)
      onSold(r.membership)
      onClose()
    },
    onError: (e) => {
      const msg = errMsg(e)
      const hit = RENEW_QUOTE_RE.exec(msg)
      if (hit) {
        const fen = Math.round(parseFloat(hit[1]!) * 100)
        setQuoteFen(fen)
        setSegInputs({ cash: String(fen / 100), wechat: '', alipay: '' })
      } else {
        toast.error(msg) // 「该客户无会员档案」等原文透出
      }
    },
  })

  const renewM = useMutation({
    mutationFn: () =>
      trpc.membership.renew.mutate({
        userId: member!.id,
        paySegments: (['cash', 'wechat', 'alipay'] as const)
          .map((m) => ({ method: m, amountFen: segFen(m) }))
          .filter((s) => s.amountFen > 0),
      }),
    onSuccess: (r) => {
      toast.success(
        `已续费「${planShortLabel(r.membership.planKey)}」· 续费单 ${r.billNo}（¥${fenToYuan(r.amountFen)}，到期顺延+回馈金解冻）`,
      )
      invalidateForUser(r.membership.userId)
      onSold(r.membership)
      onClose()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const busy = sellM.isPending || quoteM.isPending || renewM.isPending
  const canSell =
    !busy && plan != null && sellCustomerOk && (isFree || (segBalanced && !segInvalid))
  const canRenewSubmit = !busy && member !== null && quoteFen !== null && segBalanced && !segInvalid

  return (
    <CashierModal
      open={open}
      onClose={onClose}
      title="会员卡 · 售卡 / 续费"
      testid="membership-panel"
      footer={
        <>
          <SheetBtn className="min-h-[44px]" onClick={onClose}>
            取消
          </SheetBtn>
          {mode === 'sell' ? (
            <SheetBtn
              variant="primary"
              className="min-h-[44px]"
              data-testid="membership-sell-submit"
              disabled={!canSell}
              onClick={() => sellM.mutate()}
            >
              {sellM.isPending
                ? '开通中…'
                : isFree
                  ? '免费开档（0 元成交）'
                  : `收款并开通 ¥${fenToYuan(sellAmountFen)}`}
            </SheetBtn>
          ) : quoteFen === null ? (
            <SheetBtn
              variant="primary"
              className="min-h-[44px]"
              data-testid="membership-renew-quote"
              disabled={busy || member === null}
              onClick={() => quoteM.mutate()}
            >
              {quoteM.isPending ? '计算中…' : '计算续费金额（server 实算）'}
            </SheetBtn>
          ) : (
            <SheetBtn
              variant="primary"
              className="min-h-[44px]"
              data-testid="membership-renew-submit"
              disabled={!canRenewSubmit}
              onClick={() => renewM.mutate()}
            >
              {renewM.isPending ? '续费中…' : `收款并续费 ¥${fenToYuan(quoteFen)}`}
            </SheetBtn>
          )}
        </>
      }
    >
      {/* 模式页签（续费须先识别会员） */}
      <div className="flex gap-1.5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'sell'}
          data-testid="membership-mode-sell"
          className={`min-h-[44px] rounded-full px-4 py-2 text-caption ${mode === 'sell' ? 'bg-[#4A3B2E] font-semibold text-[#F6F1E3]' : 'text-[rgba(74,59,46,.6)]'}`}
          onClick={() => setMode('sell')}
        >
          售卡
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'renew'}
          data-testid="membership-mode-renew"
          disabled={member === null}
          title={member === null ? '续费须先检索识别会员' : undefined}
          className={`min-h-[44px] rounded-full px-4 py-2 text-caption disabled:opacity-40 ${mode === 'renew' ? 'bg-[#4A3B2E] font-semibold text-[#F6F1E3]' : 'text-[rgba(74,59,46,.6)]'}`}
          onClick={() => setMode('renew')}
        >
          续费
        </button>
      </div>

      {/* 客户块 */}
      <div className="mt-3 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3">
        {member ? (
          <div className="text-caption">
            <b>{member.nickname ?? '会员'}</b>
            <span className="ml-2 font-number text-caption-xs tabular-nums text-[rgba(74,59,46,.42)]">
              {member.phoneMasked ?? ''}
            </span>
            {membership ? (
              <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]" data-testid="membership-current">
                当前档「{planShortLabel(membership.planKey)}」· {MEMBERSHIP_STATUS_LABEL[membership.status] ?? membership.status} · 含宠物{' '}
                {membership.petCount} 只 · 到期 {membership.expiresAt.getMonth() + 1}月{membership.expiresAt.getDate()}日
              </div>
            ) : (
              <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                会员状态以提交时 server 实算为准（内测期读路径缺口，错误原文透出）
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">新客手机号（建档+售卡一气呵成）</div>
            <input
              className="mt-1.5 w-full rounded-[10px] bg-[#FFFDF6] px-3 py-2.5 font-number text-body-sm font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] placeholder:font-sans placeholder:font-normal placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)]"
              data-testid="membership-phone"
              inputMode="tel"
              maxLength={11}
              placeholder="11 位手机号（仅建档不开档，购卡成交才开档）"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </>
        )}
      </div>

      {mode === 'sell' ? (
        <>
          {/* 四档对照卡（价格/回馈/折扣/多宠明面——plans 透出真值） */}
          <div className="mt-3 grid grid-cols-2 gap-2" data-testid="membership-plans">
            {plansQ.isPending ? (
              <p className="col-span-2 py-4 text-center text-caption-xs text-[rgba(74,59,46,.42)]">档位加载中…</p>
            ) : plans.length === 0 ? (
              <p className="col-span-2 py-4 text-center text-caption-xs text-danger-deep">
                档位配置缺失——请在规则配置端口检查会员档（member_plans 域）
              </p>
            ) : (
              plans.map((p) => {
                const on = p.planKey === planKey
                const disc = serviceDiscountLabel(p.serviceDiscountBp)
                return (
                  <button
                    key={p.planKey}
                    type="button"
                    data-testid={`membership-plan-${p.planKey}`}
                    onClick={() => setPlanKey(p.planKey)}
                    className={`min-h-[44px] rounded-[14px] px-3 py-2.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.98] ${
                      on ? 'bg-brand-primary text-ink shadow-hairline' : 'bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)]'
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <b className="text-caption">{planShortLabel(p.planKey)}</b>
                      <b className="font-number text-caption tabular-nums">
                        {p.free || p.priceFen === 0 ? '免费' : `¥${fenToYuan(p.priceFen)}/年`}
                      </b>
                    </div>
                    <div className={`mt-1 text-caption-xs ${on ? 'text-[rgba(74,59,46,.62)]' : 'text-[rgba(74,59,46,.42)]'}`}>
                      {p.rebateBp > 0 ? `商品回馈 ${rebatePercentLabel(p.rebateBp)}` : '无回馈金'}
                      {disc ? ` · 服务 ${disc}` : ' · 服务无折扣'}
                    </div>
                    <div className={`mt-0.5 text-caption-xs ${on ? 'text-[rgba(74,59,46,.62)]' : 'text-[rgba(74,59,46,.42)]'}`}>
                      含 {p.includedPets} 只宠物 · 超出 +¥{fenToYuan(p.extraPetFen)}/只 · {p.maxPets} 只封顶
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* 多宠数 */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">含宠物只数</span>
            <span className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="减一只"
                data-testid="membership-pet-minus"
                disabled={petCount <= 1}
                onClick={() => setPetCount((n) => Math.max(1, n - 1))}
                className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
              >
                <Minus size={14} strokeWidth={2} aria-hidden />
              </button>
              <b className="min-w-[20px] text-center font-number text-body-sm tabular-nums" data-testid="membership-pet-count">
                {petCount}
              </b>
              <button
                type="button"
                aria-label="加一只"
                data-testid="membership-pet-plus"
                disabled={plan != null && petCount >= plan.maxPets}
                onClick={() => setPetCount((n) => Math.min(plan?.maxPets ?? 10, n + 1))}
                className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
              >
                <Plus size={14} strokeWidth={2} aria-hidden />
              </button>
            </span>
          </div>
          {extraCount > 0 ? (
            <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]" data-testid="membership-extra-fee">
              多宠附加：第 {plan!.includedPets + 1} 只起 +¥{fenToYuan(plan!.extraPetFen)}/年/只 × {extraCount} 只 = +¥
              {fenToYuan(extraFen)}
            </p>
          ) : null}
          {plan != null && petCount >= plan.maxPets ? (
            <p className="mt-1 text-caption-xs font-semibold text-danger-deep">多宠封顶 {plan.maxPets} 只</p>
          ) : null}

          {/* 应付合计 */}
          <div className="mt-2.5 flex items-baseline justify-between rounded-[10px] bg-[#F6F1E3] px-3 py-2">
            <span className="text-caption text-[rgba(74,59,46,.62)]">
              应付{extraFen > 0 ? `（档价 ¥${fenToYuan(plan?.priceFen ?? 0)} + 附加 ¥${fenToYuan(extraFen)}）` : ''}
            </span>
            <b className="font-number text-title font-bold tabular-nums" data-testid="membership-amount">
              {isFree ? '¥0（免费开档）' : `¥${fenToYuan(sellAmountFen)}`}
            </b>
          </div>
          {sellErrorHint ? (
            <button
              type="button"
              data-testid="membership-switch-renew"
              onClick={() => {
                setSellErrorHint(null)
                if (member) setMode('renew')
              }}
              className="mt-2 min-h-[44px] w-full rounded-[10px] bg-[#F1E8D4] px-3 py-2 text-caption-xs font-semibold text-ink"
            >
              该客户已是会员 —— 点这里切换到「续费」
            </button>
          ) : null}
        </>
      ) : (
        /* 续费模式 */
        <>
          <div className="mt-3 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3 text-caption-xs leading-relaxed text-[rgba(74,59,46,.62)]">
            <p className="flex items-center gap-1.5">
              <RefreshCcw size={13} strokeWidth={1.8} aria-hidden />
              续费=当前档位顺延 365 天（到期冻结自今日顺延）+ 回馈金解冻；档位不变（变更请退会后重售）。
            </p>
            <p className="mt-1">
              续费金额=当前档价+既有宠物只数附加费，由 server 实算——先点「计算续费金额」取得应收再收款。
            </p>
          </div>
          {quoteFen !== null ? (
            <div className="mt-2.5 flex items-baseline justify-between rounded-[10px] bg-[#F6F1E3] px-3 py-2">
              <span className="text-caption text-[rgba(74,59,46,.62)]">续费应收（server 实算）</span>
              <b className="font-number text-title font-bold tabular-nums" data-testid="membership-renew-quote-amount">
                ¥{fenToYuan(quoteFen)}
              </b>
            </div>
          ) : null}
        </>
      )}

      {/* 到店付收款段（微光/未探测不渲染） */}
      {((mode === 'sell' && !isFree && plan != null) || (mode === 'renew' && quoteFen !== null)) ? (
        <div className="mt-3 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3" data-testid="membership-pay-segs">
          <div className="mb-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">
            到店付收款段（内测期现金/微信/支付宝登记，Σ须等于应收）
          </div>
          {(['cash', 'wechat', 'alipay'] as const).map((m) => (
            <div key={m} className="flex min-h-[44px] items-center justify-between py-1 text-caption">
              <span>{SEG_LABEL[m]}</span>
              <input
                className={segInputCls}
                data-testid={`membership-seg-${m}`}
                inputMode="decimal"
                placeholder="0"
                value={segInputs[m]}
                onChange={(e) => onSegInput(m, e.target.value)}
              />
            </div>
          ))}
          <p className="py-1 text-caption-xs text-[rgba(74,59,46,.42)]">
            Σ支付 = 应收 才放行
            {targetFen > 0 && segSum !== targetFen ? (
              <span className="ml-1 text-danger-deep">
                （当前差 ¥{fenToYuan(Math.abs(targetFen - segSum))}{segSum > targetFen ? ' 超出' : ' 不足'}）
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-caption-xs leading-relaxed text-[rgba(74,59,46,.42)]">
        <CreditCard size={12} strokeWidth={1.8} className="mr-1 inline" aria-hidden />
        会员费=权益服务费（年费 ≠ 储值，不计储值账户/不进储值看板）；有效期 365 天自开通日；
        到期不自动续费（到期=冻结，续费解冻，退会清零回馈金）。
      </p>
    </CashierModal>
  )
}
