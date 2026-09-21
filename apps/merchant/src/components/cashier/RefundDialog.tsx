/**
 * R12 退款专项 · 退款弹层（Phase 3 · 收银流水 settled 单「退款」入口）
 *
 * 流程（冻结版 §三/§五）：
 *   选类型（全额/按行/按金额/寄养剩余晚/次卡退卡——按原单内容过滤可用类型：
 *   寄养单显寄养剩余晚、含次卡段显退卡）→ 按类型收集参数（按行勾行 / 按金额输入 /
 *   寄养晚数分段明示 / 退卡 refundMethod 二选一必选）→ 原因必填 →
 *   refund.preview 渲染六联动预览清单（退什么钱按段分摊明细+占比 / 补什么货 /
 *   回什么余额次数 / 提成冲减预估 / 回馈金扣回列位「随 R11 会员批生效」）→
 *   重确认 D 套（变更摘要 + 键入「确认退款」）→ refund.execute → toast + invalidate。
 *
 * 口径：
 * - 参数任一变更即作废旧预览（preview 与 execute 同参，幂等键含 type+reason+金额）；
 * - server 错误原文透出（超阈值「该单累计退款已达店长上限，须店主」/涉储值
 *   「储值退款须店主」/终态拒「原单已冲正/已撤，不可退款」等）；
 * - 部分退三行明示：已退累计 / 可退余额 / 本次分摊明细（V3 支付段占比同比例分摊）；
 * - 权限闸在 server（merchantManagerProcedure 起 + V1 累计校验 + 涉储值店主唯一通道），
 *   本层只做入口过滤与预告提示，不做权限判定。
 */

import { usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { errMsg, fenToYuan, yuanToFen } from '@/components/mall-admin/format'
import { CashierModal, SheetBtn } from './dialogs'
import { PAY_METHOD_LABEL } from './model'
import {
  REFUND_TYPE_LABEL,
  REFUND_METHOD_LABEL,
  SEG_CHANNEL_LABEL,
  type RefundExecuteInput,
  type RefundPlanView,
  type RefundType,
} from './refund'

/** 危险操作 D 套：须键入的确认口令（同 RulesConfigPage 既有工艺） */
const CONFIRM_PHRASE = '确认退款'

const TYPE_ORDER: RefundType[] = ['full', 'partial_items', 'partial_amount', 'boarding_nights', 'pass_cancel']

const typeTabCls = (on: boolean) =>
  `min-h-[44px] rounded-full px-3.5 py-2 text-caption transition-transform duration-120 ease-philia-spring active:scale-[0.97] ${
    on ? 'bg-[#4A3B2E] font-semibold text-[#F6F1E3]' : 'bg-[#F6F1E3] text-[rgba(74,59,46,.6)]'
  }`

const paramInputCls =
  'w-full rounded-[14px] bg-[#FFFDF6] px-3 py-2 font-number text-body-sm font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] placeholder:font-sans placeholder:font-normal placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)]'

/** 占比 bp → 展示串（6000 → 60%） */
const bpText = (bp: number): string => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 1)}%`

export default function RefundDialog({
  billNo,
  isOwner,
  onClose,
  onExecuted,
}: {
  billNo: string | null
  /** 仅店主：pass_cancel 退卡等涉储值通道的预告提示（真闸门在 server） */
  isOwner: boolean
  onClose: () => void
  /** 执行成功后的列表/日结/财务失效（父层持有） */
  onExecuted: () => void
}) {
  const { trpc } = usePhiliaClient()

  /* ---------------- 表单状态（换单即重置，lastNo 模式同既有弹层） ---------------- */
  const [type, setType] = useState<RefundType>('full')
  const [itemIds, setItemIds] = useState<ReadonlySet<string>>(new Set())
  const [amountInput, setAmountInput] = useState('')
  const [nightsInput, setNightsInput] = useState('')
  const [passId, setPassId] = useState('')
  const [passPaidInput, setPassPaidInput] = useState('')
  const [passPaidTimesInput, setPassPaidTimesInput] = useState('')
  const [passGiftInput, setPassGiftInput] = useState('')
  const [refundMethod, setRefundMethod] = useState<'offline_original' | 'to_stored_value' | null>(null)
  const [reason, setReason] = useState('')
  const [plan, setPlan] = useState<RefundPlanView | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const [lastNo, setLastNo] = useState<string | null>(null)
  if (billNo !== lastNo) {
    setLastNo(billNo)
    setType('full')
    setItemIds(new Set())
    setAmountInput('')
    setNightsInput('')
    setPassId('')
    setPassPaidInput('')
    setPassPaidTimesInput('')
    setPassGiftInput('')
    setRefundMethod(null)
    setReason('')
    setPlan(null)
    setConfirmOpen(false)
    setConfirmText('')
  }

  /** 参数/原因任一变更 → 作废旧预览与重确认（preview 与 execute 必须同参） */
  const touch = () => {
    setPlan(null)
    setConfirmOpen(false)
    setConfirmText('')
  }

  /* ---------------- 数据 ---------------- */
  const detailQ = useQuery({
    queryKey: ['cashier', 'getBill', billNo, 'refund-dialog'],
    queryFn: () => trpc.cashier.getBill.query({ billNo: billNo! }),
    enabled: billNo !== null,
  })
  const d = detailQ.data
  const bill = d?.bill
  const items = d?.items ?? []
  const payments = d?.payments ?? []
  const apptItemIds = items.filter((it) => it.kind === 'appointment').map((it) => it.refId)

  // 寄养类型过滤：预约行逐条取 type（预约行少，Promise.all 一次取齐）
  const apptTypesQ = useQuery({
    queryKey: ['refund', 'apptTypes', billNo, apptItemIds.join(',')],
    enabled: billNo !== null && apptItemIds.length > 0,
    queryFn: async () => {
      const out: Record<string, string> = {}
      await Promise.all(
        apptItemIds.map(async (id) => {
          const r = await trpc.appointment.get.query({ appointmentId: id })
          out[id] = r.appointment.type
        }),
      )
      return out
    },
  })
  const hasBoarding = apptItemIds.some((id) => apptTypesQ.data?.[id] === 'boarding')
  const hasPassSeg = payments.some((p) => p.method === 'pass')
  /** 涉储值判定（预告提示口径，与 server hasStoredValueInvolvement 同义：储值/次卡段或退卡类型） */
  const hasStoredValueInvolvement =
    type === 'pass_cancel' || payments.some((p) => p.method === 'stored_value' || p.method === 'pass')

  // 次卡退卡：本店次卡清单过滤到该单客户（pass.listForStore，owner|manager）
  const passQ = useQuery({
    queryKey: ['pass', 'listForStore', 'refund-dialog'],
    queryFn: () => trpc.pass.listForStore.query(),
    enabled: billNo !== null && type === 'pass_cancel' && bill?.customerId != null,
  })
  const passOptions = (passQ.data ?? []).filter((p) => p.userId === bill?.customerId && p.status === 'active')

  /** 可用类型（按原单内容过滤；全额/按金额恒可用，可退余额由 server preview 校验） */
  const availTypes = TYPE_ORDER.filter((t) => {
    if (t === 'partial_items') return items.length > 0
    if (t === 'boarding_nights') return hasBoarding
    if (t === 'pass_cancel') return hasPassSeg && bill?.customerId != null
    return true
  })

  /* ---------------- 入参组装（preview 与 execute 同参；reason 必填前置到预览闸） ---------------- */
  const amountFen = yuanToFen(amountInput)
  const nights = Number(nightsInput)
  const passPaidFen = yuanToFen(passPaidInput)
  const passPaidTimes = Number(passPaidTimesInput)
  const passGiftTimes = Number(passGiftInput)

  const buildInput = (): RefundExecuteInput | null => {
    if (!billNo) return null
    const base = { billNo, type, reason: reason.trim() }
    if (type === 'partial_items') {
      return itemIds.size > 0 ? { ...base, itemIds: [...itemIds] } : null
    }
    if (type === 'partial_amount') {
      return amountFen !== null && amountFen > 0 ? { ...base, amountFen } : null
    }
    if (type === 'boarding_nights') {
      return Number.isInteger(nights) && nights >= 1 ? { ...base, nights } : null
    }
    if (type === 'pass_cancel') {
      const ok =
        passId !== '' &&
        passPaidFen !== null &&
        Number.isInteger(passPaidTimes) &&
        passPaidTimes >= 1 &&
        Number.isInteger(passGiftTimes) &&
        passGiftTimes >= 0 &&
        refundMethod !== null
      return ok
        ? { ...base, passId, passPaidFen: passPaidFen!, passPaidTimes, passGiftTimes, refundMethod: refundMethod! }
        : null
    }
    return base // full
  }

  /* ---------------- 动作 ---------------- */
  const previewM = useMutation({
    mutationFn: (inp: RefundExecuteInput) => trpc.refund.preview.mutate(inp),
    onSuccess: (r) => setPlan(r.plan),
    // server 错误原文透出（终态拒/超阈值/涉储值/余额不足/已服务预约禁退等）
    onError: (e) => {
      setPlan(null)
      toast.error(errMsg(e))
    },
  })

  const executeM = useMutation({
    mutationFn: (inp: RefundExecuteInput) => trpc.refund.execute.mutate(inp),
    onSuccess: (r) => {
      toast.success(
        r.idempotent
          ? `${r.refund.refundNo} 同参重复提交——返回现状，未重复落账（幂等）`
          : `已退款 ¥${fenToYuan(r.refund.amountFen)} —— 退款单 ${r.refund.refundNo} 已落账（六联动同事务生效）`,
      )
      setConfirmOpen(false)
      onExecuted()
      onClose()
    },
    onError: (e) => {
      toast.error(errMsg(e))
      setConfirmOpen(false)
    },
  })

  const input = buildInput()
  const reasonValid = reason.trim().length > 0
  const canPreview = input !== null && reasonValid && !previewM.isPending

  const toggleItem = (id: string) => {
    const next = new Set(itemIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setItemIds(next)
    touch()
  }

  const eff = (it: { unitPriceFen: number; adjustedPriceFen: number | null }) =>
    it.adjustedPriceFen ?? it.unitPriceFen

  return (
    <>
      <CashierModal
        open={billNo !== null}
        onClose={onClose}
        title="退款"
        testid="refund-dialog"
        footer={
          <>
            <SheetBtn className="min-h-[44px]" onClick={onClose}>
              取消
            </SheetBtn>
            <SheetBtn
              variant="primary"
              className="min-h-[44px]"
              data-testid="refund-preview-btn"
              disabled={!canPreview}
              title={!reasonValid ? '退款必须填写原因' : undefined}
              onClick={() => {
                if (!input) return
                previewM.mutate(input)
              }}
            >
              {previewM.isPending ? '预览中…' : '生成六联动预览'}
            </SheetBtn>
            <SheetBtn
              variant="danger-outline"
              className="min-h-[44px]"
              data-testid="refund-confirm-open"
              disabled={plan === null || executeM.isPending}
              title={plan === null ? '请先生成六联动预览' : undefined}
              onClick={() => setConfirmOpen(true)}
            >
              确认退款
            </SheetBtn>
          </>
        }
      >
        {billNo === null ? null : detailQ.isPending ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
            ))}
          </div>
        ) : detailQ.isError || !d || !bill ? (
          <p className="py-6 text-center text-caption text-[rgba(74,59,46,.62)]">
            原单加载失败{detailQ.isError ? `：${errMsg(detailQ.error)}` : ''}
          </p>
        ) : (
          <div>
            {/* 原单卡 */}
            <div className="rounded-[14px] bg-[#F6F1E3] px-3.5 py-3">
              <div className="font-number text-caption font-semibold tabular-nums">{bill.billNo}</div>
              <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
                {d.buyerName}
                {' · 实收 '}
                <span className="font-number tabular-nums">¥{fenToYuan(bill.paidFen)}</span>
                {' · '}
                {payments.map((p) => PAY_METHOD_LABEL[p.method] ?? p.method).join('、') || '—'}
              </div>
            </div>

            {/* 涉储值预告（店长；真闸门在 server，错误原文透出） */}
            {!isOwner && hasStoredValueInvolvement ? (
              <p className="mt-2 rounded-[10px] bg-[#F1E8D4] px-3 py-2 text-caption-xs font-semibold text-[rgba(74,59,46,.75)]">
                本单涉储值/次卡：退款须店主办理（负债科目不设阈值，server 同口径拦截）
              </p>
            ) : null}

            {/* ① 选类型（按原单内容过滤） */}
            <div className="mt-3 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">退款类型</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="tablist">
              {availTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={type === t}
                  data-testid={`refund-type-${t}`}
                  className={typeTabCls(type === t)}
                  onClick={() => {
                    setType(t)
                    touch()
                  }}
                >
                  {REFUND_TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            {/* ② 按类型收集参数 */}
            {type === 'partial_items' ? (
              <div className="mt-3">
                <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">勾选退款行</div>
                <div className="mt-1.5 rounded-[14px] bg-[#F6F1E3] px-3.5 py-1">
                  {items.map((it) => (
                    <label
                      key={it.id}
                      data-testid={`refund-item-${it.id}`}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2.5 border-b border-dashed border-[rgba(74,59,46,.09)] py-2 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        className="h-[18px] w-[18px] accent-[#4A3B2E]"
                        checked={itemIds.has(it.id)}
                        onChange={() => toggleItem(it.id)}
                      />
                      <span className="min-w-0 flex-1 text-caption font-semibold">
                        {it.nameSnapshot}
                        <span className="ml-1.5 font-normal text-[rgba(74,59,46,.42)]">
                          {it.kind === 'appointment' ? '预约行' : it.kind === 'service' ? '服务' : '商品'} · ×{it.qty}
                          {it.paidByPass ? ' · 扣次行' : ''}
                        </span>
                      </span>
                      <span className="font-number text-caption font-semibold tabular-nums">
                        ¥{fenToYuan(eff(it) * it.qty)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {type === 'partial_amount' ? (
              <div className="mt-3">
                <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">退款金额（元）</div>
                <input
                  className={`${paramInputCls} mt-1.5`}
                  data-testid="refund-amount-input"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value)
                    touch()
                  }}
                />
                <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                  按支付段占比同比例分摊回补（V3）；按金额退不回库存只退钱（口径写死）
                </p>
              </div>
            ) : null}

            {type === 'boarding_nights' ? (
              <div className="mt-3">
                <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">退晚数</div>
                <input
                  className={`${paramInputCls} mt-1.5`}
                  data-testid="refund-nights-input"
                  inputMode="numeric"
                  placeholder="剩余晚数内的整数"
                  value={nightsInput}
                  onChange={(e) => {
                    setNightsInput(e.target.value)
                    touch()
                  }}
                />
                <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                  已发生晚一分不退；已住/剩余晚数与晚单价以六联动预览为准（分段明示）
                </p>
              </div>
            ) : null}

            {type === 'pass_cancel' ? (
              <div className="mt-3 space-y-2.5">
                <div>
                  <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">退卡次卡（该单客户名下 active 卡）</div>
                  {passQ.isPending ? (
                    <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">次卡加载中…</p>
                  ) : passOptions.length === 0 ? (
                    <p className="mt-1.5 text-caption-xs font-semibold text-danger-deep">
                      该客户名下无可退的 active 次卡
                    </p>
                  ) : (
                    <select
                      className={`${paramInputCls} mt-1.5 min-h-[44px]`}
                      data-testid="refund-pass-select"
                      value={passId}
                      onChange={(e) => {
                        setPassId(e.target.value)
                        touch()
                      }}
                    >
                      <option value="">请选择次卡</option>
                      {passOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.customerNickname ?? '会员'} · 剩余 {p.remainTimes}/{p.totalTimes} 次 · 卡号尾 {p.id.slice(-6)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {/* 次卡无金额台账：实付/付费次数/赠次由店主录入随快照留痕（server 报备偏差 1） */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">实付（元）</div>
                    <input
                      className={`${paramInputCls} mt-1`}
                      data-testid="refund-pass-paid"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={passPaidInput}
                      onChange={(e) => {
                        setPassPaidInput(e.target.value)
                        touch()
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">付费总次数</div>
                    <input
                      className={`${paramInputCls} mt-1`}
                      data-testid="refund-pass-times"
                      inputMode="numeric"
                      placeholder="如 10"
                      value={passPaidTimesInput}
                      onChange={(e) => {
                        setPassPaidTimesInput(e.target.value)
                        touch()
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">赠次</div>
                    <input
                      className={`${paramInputCls} mt-1`}
                      data-testid="refund-pass-gift"
                      inputMode="numeric"
                      placeholder="如 2"
                      value={passGiftInput}
                      onChange={(e) => {
                        setPassGiftInput(e.target.value)
                        touch()
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">实退方式（必选）</div>
                  <div className="mt-1.5 flex gap-1.5">
                    {(['offline_original', 'to_stored_value'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        data-testid={`refund-method-${m}`}
                        className={typeTabCls(refundMethod === m)}
                        onClick={() => {
                          setRefundMethod(m)
                          touch()
                        }}
                      >
                        {REFUND_METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-caption-xs leading-relaxed text-[rgba(74,59,46,.42)]">
                  折算=剩余付费次数×（实付÷付费总次数），赠次不计价（随退作废）；退卡后卡作废留痕
                </p>
              </div>
            ) : null}

            {/* ③ 原因必填 */}
            <div className="mt-3">
              <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">退款原因（必填，留痕）</div>
              <textarea
                className="mt-1.5 min-h-[64px] w-full resize-none rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)]"
                data-testid="refund-reason"
                placeholder="退款原因（必填，留痕在退款单）"
                maxLength={200}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  touch()
                }}
              />
            </div>

            {/* ④ 六联动预览清单 */}
            {plan !== null ? (
              <div className="mt-3 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3" data-testid="refund-preview-panel">
                <div className="flex items-baseline justify-between">
                  <span className="text-caption font-semibold">六联动预览 · {REFUND_TYPE_LABEL[plan.type as RefundType] ?? plan.type}</span>
                  <b className="font-number text-title font-bold tabular-nums text-danger-deep">
                    −¥{fenToYuan(plan.refundFen)}
                  </b>
                </div>

                {/* 部分退三行明示（V3）：已退累计 / 可退余额 / 本次分摊明细 */}
                {plan.type !== 'full' && plan.type !== 'pass_cancel' ? (
                  <div className="mt-2 rounded-[10px] bg-[#FFFDF6] px-3 py-2 text-caption-xs text-[rgba(74,59,46,.62)]">
                    <div className="flex justify-between py-0.5">
                      <span>已退累计</span>
                      <b className="font-number tabular-nums text-ink">¥{fenToYuan(plan.refundedSoFarFen)}</b>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span>可退余额（本次前）</span>
                      <b className="font-number tabular-nums text-ink">¥{fenToYuan(plan.refundableFen)}</b>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span>本次退款</span>
                      <b className="font-number tabular-nums text-danger-deep">−¥{fenToYuan(plan.refundFen)}</b>
                    </div>
                  </div>
                ) : null}

                {/* ① 退什么钱：支付段分摊明细（占比明示，6:4 类） */}
                <PreviewBlock title="退什么钱 · 支付段分摊回补">
                  {plan.anchorOnly ? (
                    <p className="text-caption-xs text-[rgba(74,59,46,.62)]">
                      次卡退卡为锚点单口径：金额与原单支付段无关，按下方折算明细落地
                    </p>
                  ) : plan.segments.length === 0 ? (
                    <p className="text-caption-xs text-[rgba(74,59,46,.62)]">无支付段回补</p>
                  ) : (
                    plan.segments.map((s) => (
                      <div key={s.paymentId} className="flex items-center justify-between py-0.5 text-caption-xs">
                        <span className="text-[rgba(74,59,46,.62)]">
                          {PAY_METHOD_LABEL[s.method] ?? s.method}
                          <span className="ml-1.5 font-number tabular-nums">占比 {bpText(s.ratioBp)}</span>
                          <span className="ml-1.5">{SEG_CHANNEL_LABEL[s.channel] ?? s.channel}</span>
                        </span>
                        <b className="font-number tabular-nums text-ink">¥{fenToYuan(s.amountFen)}</b>
                      </div>
                    ))
                  )}
                </PreviewBlock>

                {/* ② 补什么货 */}
                <PreviewBlock title="补什么货 · 库存回补">
                  {plan.stockRestock.length === 0 ? (
                    <p className="text-caption-xs text-[rgba(74,59,46,.62)]">
                      {plan.type === 'partial_amount' ? '按金额退不回库存只退钱（口径写死）' : '无商品行回补'}
                    </p>
                  ) : (
                    plan.stockRestock.map((s) => (
                      <div key={s.productId} className="flex justify-between py-0.5 text-caption-xs">
                        <span className="text-[rgba(74,59,46,.62)]">{s.name}</span>
                        <b className="font-number tabular-nums text-ink">+{s.qty}</b>
                      </div>
                    ))
                  )}
                </PreviewBlock>

                {/* ③ 回什么余额/次数 */}
                <PreviewBlock title="回什么 · 储值/次卡回补">
                  {plan.storedValueRestoreFen === 0 && plan.passTimesRestore === 0 ? (
                    <p className="text-caption-xs text-[rgba(74,59,46,.62)]">无储值余额/次卡次数回补</p>
                  ) : (
                    <>
                      {plan.storedValueRestoreFen > 0 ? (
                        <div className="flex justify-between py-0.5 text-caption-xs">
                          <span className="text-[rgba(74,59,46,.62)]">储值余额回补（前后余额留痕）</span>
                          <b className="font-number tabular-nums text-ink">+¥{fenToYuan(plan.storedValueRestoreFen)}</b>
                        </div>
                      ) : null}
                      {plan.passTimesRestore > 0 ? (
                        <div className="flex justify-between py-0.5 text-caption-xs">
                          <span className="text-[rgba(74,59,46,.62)]">次卡次数回补</span>
                          <b className="font-number tabular-nums text-ink">+{plan.passTimesRestore} 次</b>
                        </div>
                      ) : null}
                    </>
                  )}
                </PreviewBlock>

                {/* ④ 预约行回待收款（仅未核销未服务；已服务禁退由 server 明文拒） */}
                {plan.appointmentReverts.length > 0 ? (
                  <PreviewBlock title="预约行 · 回待收款口径">
                    {plan.appointmentReverts.map((a) => (
                      <div key={a.appointmentId} className="py-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                        {a.name}（已收款清零回待收款）
                      </div>
                    ))}
                  </PreviewBlock>
                ) : null}

                {/* 寄养分段明示（V4）：已住 N 晚不退 / 剩余 M 晚可退 ¥X */}
                {plan.boarding ? (
                  <PreviewBlock title="寄养剩余晚 · 分段明示">
                    <p className="text-caption-xs text-[rgba(74,59,46,.62)]">
                      总 {plan.boarding.totalNights} 晚 · 已住{' '}
                      <b className="text-ink">{plan.boarding.occurredNights} 晚不退</b> · 剩余{' '}
                      <b className="text-ink">
                        {plan.boarding.remainingNights} 晚可退 ¥
                        {fenToYuan(plan.boarding.remainingNights * plan.boarding.perNightFen)}
                      </b>
                    </p>
                    <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                      晚单价 ¥{fenToYuan(plan.boarding.perNightFen)} × 本次退 {plan.boarding.nights} 晚 ={' '}
                      <b className="font-number tabular-nums text-danger-deep">
                        ¥{fenToYuan(plan.boarding.perNightFen * plan.boarding.nights)}
                      </b>
                    </p>
                  </PreviewBlock>
                ) : null}

                {/* 次卡退卡折算明细（V8） */}
                {plan.passCancel ? (
                  <PreviewBlock title="次卡退卡 · 折算明细">
                    <p className="text-caption-xs text-[rgba(74,59,46,.62)]">
                      实付 ¥{fenToYuan(plan.passCancel.paidFen)} ÷ 付费 {plan.passCancel.paidTimes} 次 × 剩余付费{' '}
                      {plan.passCancel.remainingPaidTimes} 次 ={' '}
                      <b className="font-number tabular-nums text-danger-deep">¥{fenToYuan(plan.refundFen)}</b>
                    </p>
                    <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                      当前剩余 {plan.passCancel.remainTimesBefore} 次 · 赠次{' '}
                      <b className="text-ink">{plan.passCancel.giftVoided} 次随退作废（不计价）</b> · 退卡后卡作废留痕
                    </p>
                  </PreviewBlock>
                ) : null}

                {/* ⑤ 提成冲减（预估） */}
                <PreviewBlock title="提成冲减（预估）">
                  <div className="flex justify-between py-0.5 text-caption-xs">
                    <span className="text-[rgba(74,59,46,.62)]">{plan.commissionNote}</span>
                    <b className="font-number tabular-nums text-ink">
                      −¥{fenToYuan(plan.estimatedCommissionClawbackFen)}
                    </b>
                  </div>
                </PreviewBlock>

                {/* ⑥ 回馈金扣回列位（冻结，R11 回归） */}
                <PreviewBlock title="回馈金扣回列位">
                  <div className="flex justify-between py-0.5 text-caption-xs">
                    <span className="text-[rgba(74,59,46,.62)]">{plan.rebateNote}</span>
                    <b className="font-number tabular-nums text-ink">¥{fenToYuan(plan.rebateClawbackFen)}</b>
                  </div>
                </PreviewBlock>

                <p className="mt-2 text-caption-xs leading-relaxed text-[rgba(74,59,46,.42)]">
                  店长累计上限 ¥{fenToYuan(plan.thresholdFen)}（按原单累计校验，超阈值/涉储值须店主）·
                  执行=同事务六联动落账，不可撤销（纠错=再开正单）
                </p>
              </div>
            ) : null}
          </div>
        )}
      </CashierModal>

      {/* ⑤ 重确认 D 套（变更摘要 + 键入口令） */}
      <CashierModal
        open={confirmOpen && plan !== null}
        onClose={() => {
          if (!executeM.isPending) setConfirmOpen(false)
        }}
        title="退款重确认"
        testid="refund-confirm-dialog"
        footer={
          <>
            <SheetBtn className="min-h-[44px]" disabled={executeM.isPending} onClick={() => setConfirmOpen(false)}>
              再想想
            </SheetBtn>
            <SheetBtn
              variant="danger-outline"
              className="min-h-[44px]"
              data-testid="refund-confirm-submit"
              disabled={executeM.isPending || confirmText.trim() !== CONFIRM_PHRASE || input === null}
              onClick={() => {
                if (!input) return
                executeM.mutate(input)
              }}
            >
              {executeM.isPending ? '退款落账中…' : '确认退款并落账'}
            </SheetBtn>
          </>
        }
      >
        {plan === null ? null : (
          <div>
            <p className="rounded-[10px] bg-danger-light px-3 py-2 text-caption-xs font-semibold text-danger-deep">
              危险操作：确认即同事务六联动落账（退款单/支付段回补/库存回补/储值次卡回补/财务口径/回馈金列位），
              executed 后不可撤销，纠错=再开正单。
            </p>
            {/* 变更摘要 */}
            <div className="mt-3 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3 text-caption-xs text-[rgba(74,59,46,.62)]">
              <div className="flex justify-between py-0.5">
                <span>原单</span>
                <b className="font-number tabular-nums text-ink">{plan.billNo}</b>
              </div>
              <div className="flex justify-between py-0.5">
                <span>类型</span>
                <b className="text-ink">{REFUND_TYPE_LABEL[plan.type as RefundType] ?? plan.type}</b>
              </div>
              <div className="flex justify-between py-0.5">
                <span>退款金额</span>
                <b className="font-number tabular-nums text-danger-deep">−¥{fenToYuan(plan.refundFen)}</b>
              </div>
              <div className="flex justify-between py-0.5">
                <span>实退方式</span>
                <b className="text-ink">
                  {plan.type === 'pass_cancel'
                    ? REFUND_METHOD_LABEL[refundMethod ?? ''] ?? '—'
                    : '线下原路（内测期口径，实退标记待登记）'}
                </b>
              </div>
              {plan.segments.length > 0 ? (
                <div className="flex justify-between py-0.5">
                  <span>支付段回补</span>
                  <b className="font-number tabular-nums text-ink">
                    {plan.segments
                      .map((s) => `${PAY_METHOD_LABEL[s.method] ?? s.method} ¥${fenToYuan(s.amountFen)}`)
                      .join(' · ')}
                  </b>
                </div>
              ) : null}
              <div className="flex justify-between py-0.5">
                <span>原因</span>
                <b className="ml-4 flex-1 text-right text-ink">{reason.trim()}</b>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">
                请输入「{CONFIRM_PHRASE}」以继续（防误触：口令与按钮双重确认）
              </div>
              <input
                className={`${paramInputCls} mt-1.5`}
                data-testid="refund-confirm-input"
                placeholder={CONFIRM_PHRASE}
                value={confirmText}
                disabled={executeM.isPending}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
          </div>
        )}
      </CashierModal>
    </>
  )
}

/** 预览分块（标题 + 内容） */
function PreviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5 border-t border-dashed border-[rgba(74,59,46,.12)] pt-2">
      <div className="mb-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">{title}</div>
      {children}
    </div>
  )
}
