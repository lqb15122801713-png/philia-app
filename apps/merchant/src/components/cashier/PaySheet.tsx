/**
 * 屏二 · 支付面板（批次 M1 · 主屏内右下展开层，不跳路由；390 全屏化）
 *
 * - 应收 Montserrat 32 墨大数字 + 副行（含次卡扣次 N 项 −¥X 已抵 / 储值 −¥X）；
 * - 支付胶囊五分列（M1-补2 R5）：现金 / 微信 / 支付宝 / 次卡扣次 / 储值——
 *   未选白底 ring、选中柠檬底墨字、禁用灰 + 原因行紧跟；
 *   储值胶囊仅「会员有储值余额」时出现（余额小字；不足禁用+原因行；可混搭——
 *   储值金额手输，现金类自动承担剩余）；**全域无充值入口（新售冻结回归保护）**；
 * - 次卡胶囊 = 行级扣次的整单开关：点选=全部洗护服务行标记扣次（金额自动
 *   派生 = Σ扣次行有效价，不可手填——服务端同口径强校验）；再点=取消；
 * - 选中胶囊展开金额输入（可组合支付）；现金带「实收」自动算找零
 *   （Montserrat 20）；Σ现金类 + 储值 = 展示应收 才放行「确认结账」柠檬钮；
 * - 副行口径（裁定①）：已收=现金类（现金/微信/支付宝）；次卡扣次/储值消费
 *   单列「不计入已收」；
 * - R4 断网不静默：离线态确认钮=「暂存，待补传」（本地暂存，恢复自动补传），
 *   面板顶部出离线提示行；
 * - 结账成功 = 薄荷对勾 +「已收款 ¥X」+ 3s 自动回主屏空购物车（不跳页）；
 * - 常客纯服务 ≤3 步（修订单③）：拉入 → 结账 → 确认，本面板内无任何
 *   中间页/额外确认弹层。
 */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCircle2, WifiOff } from 'lucide-react'
import { fenToYuan, yuanToFen } from '@/components/mall-admin/format'
import {
  finalizePayments,
  type CartAmounts,
  type CartLine,
  type CashierMember,
  type PassListRow,
  type SettleInput,
} from './model'

type MoneyMethod = 'cash' | 'wechat' | 'alipay'

const MONEY_METHODS: Array<{ key: MoneyMethod; label: string; hint: string }> = [
  { key: 'cash', label: '现金', hint: '带找零' },
  { key: 'wechat', label: '微信', hint: '仅登记' },
  { key: 'alipay', label: '支付宝', hint: '仅登记' },
]

const capsuleCls = (state: 'on' | 'off' | 'disabled') =>
  `rounded-[14px] px-1.5 py-3 text-center text-caption font-semibold transition-[box-shadow,background-color] duration-150 ${
    state === 'on'
      ? 'bg-brand-primary text-ink'
      : state === 'off'
        ? 'bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)]'
        : 'cursor-not-allowed bg-[rgba(74,59,46,.05)] text-[rgba(74,59,46,.3)]'
  }`

const payInputCls =
  'w-[110px] rounded-[6px] bg-[#FFFDF6] px-2.5 py-[7px] text-right font-number text-caption font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.25)]'

export default function PaySheet({
  open,
  billNo,
  amounts,
  lines,
  member,
  pass,
  offline = false,
  settling,
  settledInfo,
  onTogglePassAll,
  onConfirm,
  onClose,
}: {
  open: boolean
  billNo: string | null
  amounts: CartAmounts
  lines: CartLine[]
  member: CashierMember | null
  /** 会员本店次卡行（null = 无卡；undefined = 加载中） */
  pass: PassListRow | null | undefined
  /** R4：离线态（确认=本地暂存待补传） */
  offline?: boolean
  settling: boolean
  /** 结账成功快照（非空即成功态，3s 自动关） */
  settledInfo: { billNo: string; paidFen: number } | null
  onTogglePassAll: (on: boolean) => void
  onConfirm: (payments: SettleInput['payments']) => void
  onClose: () => void
}) {
  /* ---- 现金类胶囊选中与金额输入 + 储值段（打开时重置） ---- */
  const [selected, setSelected] = useState<MoneyMethod[]>([])
  const [inputs, setInputs] = useState<Record<MoneyMethod, string>>({ cash: '', wechat: '', alipay: '' })
  const [cashReceived, setCashReceived] = useState('')
  const [svOn, setSvOn] = useState(false)
  const [svInput, setSvInput] = useState('')
  const [wasOpen, setWasOpen] = useState(false)

  const svBalance = member?.storedValueBalanceFen ?? 0
  const passCoveredFen = amounts.passCoveredFen
  const dueFen = amounts.dueFen

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelected(['cash'])
      const s = String(dueFen / 100)
      setInputs({ cash: s, wechat: '', alipay: '' })
      setCashReceived(s)
      setSvOn(false)
      setSvInput('')
    }
  }

  const groomCount = lines.filter((l) => l.kind === 'service' && l.serviceType === 'grooming').length
  const passUsable =
    pass != null && pass.status === 'active' && pass.remainTimes > 0 &&
    (pass.expiresAt === null || pass.expiresAt.getTime() > Date.now())

  /** 次卡胶囊不可用原因（null = 可用） */
  const passBlockReason = useMemo((): string | null => {
    if (passCoveredFen > 0) return null // 已选态可点击取消
    if (!member) return '次卡扣次：散客不可用——先检索会员'
    if (pass === undefined) return null // 加载中短暂可点无妨
    if (pass === null || !passUsable) return '该会员无可用次卡'
    if (groomCount === 0) return '车内无洗护服务行（次卡仅洗护可用）'
    if (pass.remainTimes < groomCount) return `次卡余额不足：剩 ${pass.remainTimes} 次 · 需 ${groomCount} 次`
    return null
  }, [member, pass, passUsable, groomCount, passCoveredFen])

  /* ---- 储值段（R5）：金额手输，≤ min(余额, 应收)；现金类承担剩余 ---- */
  const svFen = svOn ? yuanToFen(svInput) : null
  const svApplied = svOn ? (svFen ?? 0) : 0
  const svOver = svOn && (svFen === null || svFen < 1 || svFen > Math.min(svBalance, dueFen))
  /** 储值开启后现金类须承担的剩余额 */
  const moneyNeedFen = Math.max(0, dueFen - svApplied)

  /** 储值胶囊不可用原因（null = 可用；仅在有余额时出现，故仅负担保口径） */
  const svBlockReason = useMemo((): string | null => {
    if (!member || svBalance <= 0) return null // 不出现（无原因行）
    if (dueFen <= 0) return '应收已为 0（次卡已全额抵扣）——无需储值段'
    return null
  }, [member, svBalance, dueFen])

  /** 金额再平衡：末位选中现金胶囊兜底差额（Σ现金类 = moneyNeed 的默认填法） */
  const rebalance = (next: MoneyMethod[], base: Record<MoneyMethod, string>, needFen: number) => {
    const out = { ...base }
    const others = next.slice(0, -1)
    const othersSum = others.reduce((s, m) => s + (yuanToFen(out[m]) ?? 0), 0)
    const last = next[next.length - 1]
    if (last) {
      const remain = needFen - othersSum
      out[last] = remain > 0 ? String(remain / 100) : ''
      if (last === 'cash') setCashReceived(out[last])
    }
    return out
  }

  const toggleMethod = (m: MoneyMethod) => {
    const next = selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m]
    const cleared = { ...inputs, [m]: '' }
    setSelected(next)
    setInputs(rebalance(next, cleared, moneyNeedFen))
  }

  const toggleSv = () => {
    if (svBlockReason !== null) return
    const next = !svOn
    setSvOn(next)
    // 开启：默认全额 min(余额, 应收)，现金类自动退到剩余；关闭：现金类回补全额
    const nextSv = next ? Math.min(svBalance, dueFen) : 0
    setSvInput(next ? String(nextSv / 100) : '')
    setInputs(rebalance(selected, inputs, dueFen - nextSv))
  }

  const onSvAmount = (v: string) => {
    setSvInput(v)
    const fen = yuanToFen(v)
    if (fen !== null) setInputs(rebalance(selected, inputs, dueFen - fen))
  }

  /* 次卡开合：应收变化只能在面板打开期由本动作触发（遮罩下车不可改），
     故事件内就地重排末位金额——不做 render 期追随（同轮双 setInputs 会旧闭包覆盖） */
  const passOn = passCoveredFen > 0
  const togglePass = () => {
    if (passBlockReason !== null) return
    const next = !passOn
    const groomEff = lines
      .filter((l) => l.kind === 'service' && l.serviceType === 'grooming')
      .reduce((s, l) => s + (l.adjustedPriceFen ?? l.unitPriceFen) * l.qty, 0)
    const nextDue = next ? dueFen + passCoveredFen - groomEff : dueFen + passCoveredFen
    // 次卡开合改变应收：储值段封顶追随（已开则收回到新应收内），现金类再平衡
    const nextSv = svOn ? Math.min(svBalance, Math.max(0, nextDue)) : 0
    if (svOn) setSvInput(String(nextSv / 100))
    setInputs(rebalance(selected, inputs, Math.max(0, nextDue - nextSv)))
    onTogglePassAll(next)
  }

  /* ---- 校验：Σ现金类 = 应收 − 储值；储值 ≤ min(余额,应收)；现金实收 ≥ 现金承担 ---- */
  const segs = selected
    .map((m) => ({ method: m, amountFen: yuanToFen(inputs[m]) }))
    .filter((s): s is { method: MoneyMethod; amountFen: number } => s.amountFen !== null && s.amountFen >= 1)
  /** 选中但输入非法（非空却解析不出）→ 拦截 */
  const invalidInput = selected.some((m) => inputs[m].trim() !== '' && yuanToFen(inputs[m]) === null)
  const sumMoney = segs.reduce((s, p) => s + p.amountFen, 0)
  const cashApplied = yuanToFen(inputs.cash) ?? 0
  const cashReceivedFen = yuanToFen(cashReceived)
  const cashShort = selected.includes('cash') && cashApplied > 0 && (cashReceivedFen === null || cashReceivedFen < cashApplied)
  const zeroDuePassOnly = dueFen === 0 && passCoveredFen > 0 // 全额次卡
  const moneyBalanced = sumMoney === moneyNeedFen && !invalidInput && !svOver
  const canConfirm =
    !settling &&
    !cashShort &&
    (moneyBalanced || zeroDuePassOnly) &&
    (dueFen > 0 || passCoveredFen > 0) &&
    (!svOn || (svFen !== null && svFen >= 1 && !svOver))

  /* ---- 成功态 3s 自动回主屏 ---- */
  useEffect(() => {
    if (!settledInfo) return
    const t = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(t)
  }, [settledInfo, onClose])

  if (!open) return null

  const submit = () => {
    const payments = finalizePayments(amounts, zeroDuePassOnly ? [] : segs, svApplied)
    if (!payments) return
    onConfirm(payments)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[rgba(74,59,46,.28)] sm:items-end sm:px-4 sm:pb-6"
      data-testid="cashier-pay-overlay"
    >
      <div className="flex w-full flex-col overflow-y-auto bg-[#FFFDF6] p-6 shadow-[0_8px_40px_rgba(74,59,46,.18)] sm:w-[520px] sm:rounded-[20px]">
        {settledInfo ? (
          /* ---- 成功态：薄荷对勾 + 已收款 + 3s 自动回 ---- */
          <div className="flex flex-col items-center py-10" data-testid="cashier-pay-success">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7FD8BE]">
              <CheckCircle2 size={28} strokeWidth={1.8} className="text-[#1E4D3D]" aria-hidden />
            </span>
            <div className="mt-4 font-number text-detail-lg font-bold tabular-nums">
              已收款 ¥{fenToYuan(settledInfo.paidFen)}
            </div>
            <div className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">
              单号 {settledInfo.billNo} · 3 秒后自动返回
            </div>
            <button
              type="button"
              data-testid="cashier-pay-next"
              onClick={onClose}
              className="mt-6 rounded-full bg-brand-primary px-6 py-2.5 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
            >
              再开一单
            </button>
          </div>
        ) : (
          <>
            {/* R4：离线提示行（确认=暂存待补传，非「结账中…」空转） */}
            {offline ? (
              <div
                className="mb-3 flex items-center gap-1.5 rounded-[10px] bg-[#FDC830] px-3 py-2 text-caption-xs font-semibold text-[#4A3B2E]"
                data-testid="cashier-pay-offline"
              >
                <WifiOff size={13} strokeWidth={2} aria-hidden />
                离线中 —— 确认后本地暂存，恢复网络自动补传
              </div>
            ) : null}
            <div className="mb-1.5 flex items-center justify-between">
              <b className="text-body-sm">结账</b>
              <span className="text-caption-xs text-[rgba(74,59,46,.42)]">
                单号 {billNo ?? '结账后生成'}
              </span>
            </div>
            <div className="py-1.5 text-center font-number text-detail-lg font-bold tabular-nums" data-testid="cashier-pay-due">
              ¥{fenToYuan(dueFen)}
            </div>
            <div className="mb-3.5 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
              应收
              {passCoveredFen > 0
                ? ` · 含次卡扣次 ${lines.filter((l) => l.paidByPass).length} 项（−¥${fenToYuan(passCoveredFen)} 已抵）`
                : ''}
            </div>

            {/* 支付胶囊五分列（储值仅会员有余额时出现） */}
            <div className={`grid gap-2 ${member && svBalance > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {MONEY_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  data-testid={`cashier-pay-m-${m.key}`}
                  onClick={() => toggleMethod(m.key)}
                  className={capsuleCls(selected.includes(m.key) ? 'on' : 'off')}
                >
                  {m.label}
                  <small
                    className={`mt-0.5 block text-caption-xs font-normal ${
                      selected.includes(m.key) ? 'text-[rgba(74,59,46,.55)]' : 'text-[rgba(74,59,46,.42)]'
                    }`}
                  >
                    {selected.includes(m.key) ? '已选' : m.hint}
                  </small>
                </button>
              ))}
              <button
                type="button"
                data-testid="cashier-pay-m-pass"
                disabled={passBlockReason !== null}
                onClick={togglePass}
                className={capsuleCls(passOn ? 'on' : passBlockReason ? 'disabled' : 'off')}
              >
                次卡扣次
                <small
                  className={`mt-0.5 block text-caption-xs font-normal ${
                    passOn ? 'text-[rgba(74,59,46,.55)]' : 'text-[rgba(74,59,46,.42)]'
                  }`}
                >
                  {passOn
                    ? `抵 ¥${fenToYuan(passCoveredFen)}`
                    : member && pass
                      ? `余 ${pass.remainTimes} 次`
                      : '会员可用'}
                </small>
              </button>
              {/* R5 储值胶囊：会员有储值余额时出现；不足/超应收由输入行校验拦截（余额小字随行） */}
              {member && svBalance > 0 ? (
                <button
                  type="button"
                  data-testid="cashier-pay-m-sv"
                  disabled={svBlockReason !== null}
                  onClick={toggleSv}
                  className={capsuleCls(svOn ? 'on' : svBlockReason ? 'disabled' : 'off')}
                >
                  储值
                  <small
                    className={`mt-0.5 block font-number tabular-nums text-caption-xs font-normal ${
                      svOn ? 'text-[rgba(74,59,46,.55)]' : 'text-[rgba(74,59,46,.42)]'
                    }`}
                  >
                    余 ¥{fenToYuan(svBalance)}
                  </small>
                </button>
              ) : null}
            </div>
            {passBlockReason ? (
              <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]" data-testid="cashier-pass-block">
                {passBlockReason}
              </p>
            ) : null}
            {svBlockReason ? (
              <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]" data-testid="cashier-sv-block">
                {svBlockReason}
              </p>
            ) : null}

            {/* 选中胶囊金额输入（组合支付：现金类 + 储值段） */}
            {selected.length > 0 || svOn ? (
              <div className="mt-3.5 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3" data-testid="cashier-pay-detail">
                {selected.map((m) => {
                  const label = MONEY_METHODS.find((x) => x.key === m)!.label
                  return (
                    <div key={m} className="flex items-center justify-between py-1 text-caption">
                      <span>{label}支付</span>
                      <input
                        className={payInputCls}
                        data-testid={`cashier-pay-amt-${m}`}
                        inputMode="decimal"
                        placeholder="0"
                        value={inputs[m]}
                        onChange={(e) => setInputs({ ...inputs, [m]: e.target.value })}
                      />
                    </div>
                  )
                })}
                {svOn ? (
                  <div className="flex items-center justify-between py-1 text-caption">
                    <span>
                      储值支付
                      <small className="ml-1 font-number tabular-nums text-caption-xs text-[rgba(74,59,46,.42)]">
                        余 ¥{fenToYuan(svBalance)}
                      </small>
                    </span>
                    <input
                      className={payInputCls}
                      data-testid="cashier-pay-amt-sv"
                      inputMode="decimal"
                      placeholder="0"
                      value={svInput}
                      onChange={(e) => onSvAmount(e.target.value)}
                    />
                  </div>
                ) : null}
                {svOn && svOver ? (
                  <p className="py-1 text-caption-xs font-semibold text-danger-deep" data-testid="cashier-sv-over">
                    储值金额须 ≤ min(余额 ¥{fenToYuan(svBalance)}, 应收 ¥{fenToYuan(dueFen)})，可混搭现金/扫码补足
                  </p>
                ) : null}
                {selected.includes('cash') && cashApplied > 0 ? (
                  <div className="flex items-center justify-between py-1 text-caption">
                    <span className="text-[rgba(74,59,46,.42)]">
                      实收 ¥{cashReceivedFen !== null ? fenToYuan(cashReceivedFen) : '…'} − 应收 ¥
                      {fenToYuan(Math.min(cashApplied, moneyNeedFen))}
                    </span>
                    {cashShort ? (
                      <span className="font-number text-caption font-bold tabular-nums text-danger-deep">实收不足</span>
                    ) : cashReceivedFen !== null && cashReceivedFen > cashApplied ? (
                      <span className="font-number text-price font-bold tabular-nums" data-testid="cashier-pay-change">
                        找零 ¥{fenToYuan(cashReceivedFen - cashApplied)}
                      </span>
                    ) : (
                      <span className="text-caption-xs text-[rgba(74,59,46,.42)]">无找零</span>
                    )}
                  </div>
                ) : null}
                {selected.includes('cash') && cashApplied > 0 ? (
                  <div className="flex items-center justify-between py-1 text-caption">
                    <span className="text-[rgba(74,59,46,.42)]">现金实收</span>
                    <input
                      className={payInputCls}
                      data-testid="cashier-pay-received"
                      inputMode="decimal"
                      placeholder="实收金额"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                  </div>
                ) : null}
                <div className="py-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                  可组合支付：Σ支付 = 应收 才放行确认
                  {!moneyBalanced && !zeroDuePassOnly ? (
                    <span className="ml-1 text-danger-deep">
                      （当前差 ¥{fenToYuan(Math.abs(moneyNeedFen - sumMoney))}
                      {sumMoney > moneyNeedFen ? ' 超出' : ' 不足'}）
                    </span>
                  ) : null}
                </div>
                {/* 副行口径（裁定①）：已收=现金类；次卡/储值单列不计入已收 */}
                <div className="border-t border-dashed border-[rgba(74,59,46,.12)] py-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                  已收口径=现金/微信/支付宝；次卡扣次 / 储值消费单列，不计入今日已收
                </div>
              </div>
            ) : passCoveredFen > 0 ? (
              <div className="mt-3.5 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3 text-caption-xs text-[rgba(74,59,46,.62)]">
                全额次卡扣次——无需现金/扫码段（次卡单列，不计入已收）
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
              <button
                type="button"
                data-testid="cashier-pay-back"
                onClick={onClose}
                className="rounded-[14px] bg-[#FFFDF6] py-3 text-body-sm font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                返回改单
              </button>
              <button
                type="button"
                data-testid="cashier-pay-confirm"
                disabled={!canConfirm}
                onClick={submit}
                className="inline-flex items-center justify-center gap-1.5 rounded-[14px] bg-brand-primary py-3 text-body-sm font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {offline ? (
                  <>
                    <WifiOff size={15} strokeWidth={2} aria-hidden />
                    暂存，待补传
                  </>
                ) : (
                  <>
                    <Check size={15} strokeWidth={2} aria-hidden />
                    {settling ? '结账中…' : '确认结账'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
