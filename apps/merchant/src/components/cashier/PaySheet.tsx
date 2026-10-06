/**
 * 屏二 · 支付面板（批次 M1 · 主屏内右下展开层，不跳路由；390 全屏化）
 *
 * - 应收 Montserrat 32 墨大数字 + 副行（含次卡扣次 N 项 −¥X 已抵 / 储值 −¥X）；
 * - 支付胶囊七分列（M1-补2 R5 + R11a + 片 3）：现金 / 微信 / 支付宝 / 次卡扣次 /
 *   储值 / 回馈金 / 挂账——未选白底 ring、选中柠檬底墨字、禁用灰 + 原因行紧跟；
 *   片 3 挂账段（credit）=台账留痕不碰真钱（至多一段；server 落 credit_ledgers，
 *   computeDayTender 跳过不计已收；结清/核销走 /ledger 台账专页）；聚合扫码/外设
 *   留口注记行置灰明面（通道资质候/PWA 上限）；
 *   储值胶囊仅「会员有储值余额」时出现（余额小字；不足禁用+原因行；可混搭——
 *   储值金额手输，现金类自动承担剩余）；**全域无充值入口（新售冻结回归保护）**；
 *   R11a 回馈金胶囊仅会员出现：仅商品行可用（红线 2，无商品行置灰明示；server
 *   settle 硬拒兜底），≤min(商品行合计,应收,余额) 前置拦截，余额不足可混搭；
 *   余额=membership.forUser 正式通道真值（R11a 补丁，rebate.balanceFen 已到账
 *   可用；查询中不阻塞，server 扣减兜底），不计已收（参考列同储值口径）；
 * - 次卡胶囊 = 行级扣次的整单开关：点选=全部洗护服务行标记扣次（金额自动
 *   派生 = Σ扣次行有效价，不可手填——服务端同口径强校验）；再点=取消；
 * - 选中胶囊展开金额输入（可组合支付）；现金带「实收」自动算找零
 *   （Montserrat 20）；Σ现金类 + 储值 = 展示应收 才放行「确认结账」柠檬钮；
 *   QA40-D13（急修三件 PD-03）：手输任一段即触发再平衡（改动段固定、末位选中段
 *   兜底差额）+差额提示行实时明示（还差/超出 ¥X）+「应收」标签归一（唯一真值=顶部
 *   dueFen 大数字，明细行分段额改称「现金承担」）+现金手输同步刷实收；
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
import { useNavigate } from 'react-router-dom'
import { Check, CheckCircle2, Printer, ScanLine, WifiOff } from 'lucide-react'
import { usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { fenToYuan, yuanToFen } from '@/components/mall-admin/format'
import { WFolio, WRedline } from '@/components/skeleton'
import { cc } from '@/copy/cashier'
import { MEMBER_FOR_USER_KEY } from './membership'
import {
  finalizePayments,
  productTotalFen,
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
        ? 'bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(59,46,36,.09)]'
        : 'cursor-not-allowed bg-[rgba(59,46,36,.05)] text-[rgba(59,46,36,.3)]'
  }`

const payInputCls =
  'w-[110px] rounded-[6px] bg-[#FFFDF6] px-2.5 py-[7px] text-right font-number text-caption font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(59,46,36,.09)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.25)]'

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
  /** 结账成功快照（非空即成功态，3s 自动关；roundingFen=单上抹零真值，>0 透出） */
  settledInfo: { billNo: string; paidFen: number; roundingFen?: number } | null
  onTogglePassAll: (on: boolean) => void
  onConfirm: (payments: SettleInput['payments']) => void
  onClose: () => void
}) {
  const { trpc } = usePhiliaClient()
  const navigate = useNavigate()
  /* ---- 现金类胶囊选中与金额输入 + 储值段 + 回馈金段 + 挂账段（打开时重置） ---- */
  const [selected, setSelected] = useState<MoneyMethod[]>([])
  const [inputs, setInputs] = useState<Record<MoneyMethod, string>>({ cash: '', wechat: '', alipay: '' })
  const [cashReceived, setCashReceived] = useState('')
  const [svOn, setSvOn] = useState(false)
  const [svInput, setSvInput] = useState('')
  const [rbOn, setRbOn] = useState(false)
  const [rbInput, setRbInput] = useState('')
  const [crOn, setCrOn] = useState(false)
  const [crInput, setCrInput] = useState('')
  const [wasOpen, setWasOpen] = useState(false)

  const svBalance = member?.storedValueBalanceFen ?? 0
  const passCoveredFen = amounts.passCoveredFen
  const dueFen = amounts.dueFen
  /** R11a：当单商品行合计（回馈金段上限，红线 2——服务/寄养行禁用回馈金） */
  const prodFen = productTotalFen(lines)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelected(['cash'])
      const s = String(dueFen / 100)
      setInputs({ cash: s, wechat: '', alipay: '' })
      setCashReceived(s)
      setSvOn(false)
      setSvInput('')
      setRbOn(false)
      setRbInput('')
      setCrOn(false)
      setCrInput('')
    }
  }

  const groomCount = lines.filter((l) => l.kind === 'service' && l.serviceType === 'grooming').length
  const passUsable =
    pass != null && pass.status === 'active' && pass.remainTimes > 0 &&
    (pass.expiresAt === null || pass.expiresAt.getTime() > Date.now())

  /** 次卡胶囊不可用原因（null = 可用） */
  const passBlockReason = useMemo((): string | null => {
    if (passCoveredFen > 0) return null // 已选态可点击取消
    if (!member) return cc('cashier.payPassNoMember')
    if (pass === undefined) return null // 加载中短暂可点无妨
    if (pass === null || !passUsable) return cc('cashier.payPassNoCard')
    if (groomCount === 0) return cc('cashier.payPassNoGroom')
    if (pass.remainTimes < groomCount)
      return cc('cashier.payPassShort', { remain: pass.remainTimes, need: groomCount })
    return null
  }, [member, pass, passUsable, groomCount, passCoveredFen])

  /* ---- 储值段（R5）：金额手输，≤ min(余额, 应收)；现金类承担剩余 ---- */
  const svFen = svOn ? yuanToFen(svInput) : null
  const svApplied = svOn ? (svFen ?? 0) : 0
  const svOver = svOn && (svFen === null || svFen < 1 || svFen > Math.min(svBalance, dueFen))

  /* ---- 回馈金段（R11a 第六段）：金额手输，≤ min(商品行合计, 应收, 余额真值)；余额不足可混搭 ----
   * R11a 补丁：余额改走 membership.forUser 正式通道真值（ rebate.balanceFen 已到账可用）；
   * 查询中（null）不阻塞，段上限先按 min(商品行合计,应收)——server deductRebate 硬拒兜底。 */
  const rbForUserQ = useQuery({
    queryKey: MEMBER_FOR_USER_KEY(member?.id ?? ''),
    queryFn: () => trpc.membership.forUser.query({ userId: member!.id }),
    enabled: open && member !== null,
  })
  const rbBalance = rbForUserQ.data?.rebate.balanceFen ?? null
  const rbFen = rbOn ? yuanToFen(rbInput) : null
  const rbApplied = rbOn ? (rbFen ?? 0) : 0
  const rbCap = Math.min(prodFen, dueFen, rbBalance ?? Number.MAX_SAFE_INTEGER)
  const rbOver = rbOn && (rbFen === null || rbFen < 1 || rbFen > rbCap)
  /** 回馈金胶囊不可用原因（null = 可用；散客不出现该胶囊） */
  const rbBlockReason = useMemo((): string | null => {
    if (!member) return null // 散客无回馈金账户——不出现
    if (prodFen <= 0) return cc('cashier.payRebateNoProduct')
    if (dueFen <= 0) return cc('cashier.payRebateZeroDue')
    if (rbBalance !== null && rbBalance <= 0) return cc('cashier.payRebateZeroBalance')
    return null
  }, [member, prodFen, dueFen, rbBalance])

  /* ---- 挂账段（片 3 第七段 credit）：台账留痕不碰真钱，至多一段；
     金额手输 ≤ 应收−储值−回馈金（server 落 credit_ledgers，computeDayTender 跳过不计已收） ---- */
  const crFen = crOn ? yuanToFen(crInput) : null
  const crApplied = crOn ? (crFen ?? 0) : 0
  const crCap = Math.max(0, dueFen - svApplied - rbApplied)
  const crOver = crOn && (crFen === null || crFen < 1 || crFen > crCap)

  /** 储值/回馈金/挂账开启后现金类须承担的剩余额 */
  const moneyNeedFen = Math.max(0, dueFen - svApplied - rbApplied - crApplied)

  /** 储值胶囊不可用原因（null = 可用；仅在有余额时出现，故仅负担保口径） */
  const svBlockReason = useMemo((): string | null => {
    if (!member || svBalance <= 0) return null // 不出现（无原因行）
    if (dueFen <= 0) return cc('cashier.paySvZeroDue')
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

  /* QA40-D13 修法②④：现金类手输 onChange 触发再平衡——改动段固定，其余选中段
     末位兜底差额（改动段从 others 剔除）；现金段手输同步刷 cashReceived（实收/找零不滞后） */
  const onMoneyAmount = (m: MoneyMethod, v: string) => {
    const base = { ...inputs, [m]: v }
    if (m === 'cash') setCashReceived(v)
    const editedFen = yuanToFen(v) ?? 0
    const others = selected.filter((x) => x !== m)
    if (others.length === 0) {
      setInputs(base)
      return
    }
    setInputs(rebalance(others, base, moneyNeedFen - editedFen))
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
    setInputs(rebalance(selected, inputs, dueFen - nextSv - rbApplied - crApplied))
  }

  const onSvAmount = (v: string) => {
    setSvInput(v)
    const fen = yuanToFen(v)
    if (fen !== null) setInputs(rebalance(selected, inputs, dueFen - fen - rbApplied - crApplied))
  }

  /* R11a 回馈金段：默认全额 min(商品行合计, 应收)，现金类自动退到剩余（可混搭） */
  const toggleRb = () => {
    if (rbBlockReason !== null) return
    const next = !rbOn
    setRbOn(next)
    const nextRb = next ? rbCap : 0
    setRbInput(next ? String(nextRb / 100) : '')
    setInputs(rebalance(selected, inputs, dueFen - svApplied - nextRb - crApplied))
  }

  const onRbAmount = (v: string) => {
    setRbInput(v)
    const fen = yuanToFen(v)
    if (fen !== null) setInputs(rebalance(selected, inputs, dueFen - svApplied - fen - crApplied))
  }

  /* 片 3 挂账段：默认挂剩余全额（应收−储值−回馈金），现金类退到 0（可混搭——
     手输部分挂账、现金类承担其余；至多一段=单输入行天然保证） */
  const toggleCr = () => {
    const next = !crOn
    setCrOn(next)
    const nextCr = next ? Math.max(0, dueFen - svApplied - rbApplied) : 0
    setCrInput(next ? String(nextCr / 100) : '')
    setInputs(rebalance(selected, inputs, dueFen - svApplied - rbApplied - nextCr))
  }

  const onCrAmount = (v: string) => {
    setCrInput(v)
    const fen = yuanToFen(v)
    if (fen !== null) setInputs(rebalance(selected, inputs, dueFen - svApplied - rbApplied - fen))
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
    // 次卡开合改变应收：储值/回馈金/挂账段封顶追随（已开则收回到新应收内），现金类再平衡
    const nextSv = svOn ? Math.min(svBalance, Math.max(0, nextDue)) : 0
    const nextRb = rbOn ? Math.min(prodFen, Math.max(0, nextDue - nextSv)) : 0
    const nextCr = crOn ? Math.max(0, nextDue - nextSv - nextRb) : 0
    if (svOn) setSvInput(String(nextSv / 100))
    if (rbOn) setRbInput(String(nextRb / 100))
    if (crOn) setCrInput(String(nextCr / 100))
    setInputs(rebalance(selected, inputs, Math.max(0, nextDue - nextSv - nextRb - nextCr)))
    onTogglePassAll(next)
  }

  /* ---- 校验：Σ现金类 = 应收 − 储值 − 回馈金；储值 ≤ min(余额,应收)；回馈金 ≤ min(商品行合计,应收)；现金实收 ≥ 现金承担 ---- */
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
  const moneyBalanced = sumMoney === moneyNeedFen && !invalidInput && !svOver && !rbOver && !crOver
  const canConfirm =
    !settling &&
    !cashShort &&
    (moneyBalanced || zeroDuePassOnly) &&
    (dueFen > 0 || passCoveredFen > 0) &&
    (!svOn || (svFen !== null && svFen >= 1 && !svOver)) &&
    (!rbOn || (rbFen !== null && rbFen >= 1 && !rbOver)) &&
    (!crOn || (crFen !== null && crFen >= 1 && !crOver))

  /* ---- 成功态 3s 自动回主屏 ---- */
  useEffect(() => {
    if (!settledInfo) return
    const t = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(t)
  }, [settledInfo, onClose])

  if (!open) return null

  const submit = () => {
    const payments = finalizePayments(amounts, zeroDuePassOnly ? [] : segs, svApplied, rbApplied, crApplied)
    if (!payments) return
    onConfirm(payments)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[rgba(59,46,36,.28)] sm:items-end sm:px-4 sm:pb-6"
      data-testid="cashier-pay-overlay"
    >
      <div className="flex w-full flex-col overflow-y-auto bg-[#FFFDF6] p-6 shadow-[0_8px_40px_rgba(59,46,36,.18)] sm:w-[520px] sm:rounded-[20px]">
        {settledInfo ? (
          /* ---- 成功态：薄荷对勾 + 已收款 + 3s 自动回 ---- */
          <div className="flex flex-col items-center py-8" data-testid="cashier-pay-success">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2E2318]">
              <CheckCircle2 size={28} strokeWidth={1.8} className="text-[#F2DFA6]" aria-hidden />
            </span>
            <div className="mt-4 whitespace-nowrap font-number text-detail-lg font-bold tabular-nums">
              已收款 ¥{fenToYuan(settledInfo.paidFen)}
            </div>
            {/* 片 3：单上抹零透出（真值以 server 单为准，>0 才显示） */}
            {(settledInfo.roundingFen ?? 0) > 0 ? (
              <div className="mt-1 font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.62)]" data-testid="cashier-pay-rounding">
                {cc('cashier.roundingLabel')} −¥{fenToYuan(settledInfo.roundingFen!)}
              </div>
            ) : null}
            <div className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]">
              单号 <span className="font-number tabular-nums">{settledInfo.billNo}</span> · {cc('cashier.paySuccessBack')}
            </div>
            <div className="mt-6 flex items-center gap-2">
              {/* 片 3：成交即打小票（ReceiptPage /cashier/receipt/:billNo） */}
              <button
                type="button"
                data-testid="cashier-pay-print"
                onClick={() => navigate(`/cashier/receipt/${settledInfo.billNo}`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFDF6] px-5 py-2.5 text-caption font-semibold text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                <Printer size={14} strokeWidth={1.8} aria-hidden />
                {cc('cashier.receiptPrint')}
              </button>
              <button
                type="button"
                data-testid="cashier-pay-next"
                onClick={onClose}
                className="rounded-full bg-brand-primary px-6 py-2.5 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                {cc('cashier.payNextCta')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* R4：离线提示行（确认=暂存待补传，非「结账中…」空转） */}
            {offline ? (
              <div
                className="mb-3 flex items-center gap-1.5 rounded-[10px] bg-[#F2DFA6] px-3 py-2 text-caption-xs font-semibold text-[#3B2E24]"
                data-testid="cashier-pay-offline"
              >
                <WifiOff size={13} strokeWidth={2} aria-hidden />
                {cc('cashier.payOfflineBar')}
              </div>
            ) : null}
            <div className="mb-1.5 flex items-center justify-between">
              <b className="text-body-sm">结账</b>
              <span className="text-caption-xs text-[rgba(59,46,36,.42)]">
                单号 <span className="font-number tabular-nums">{billNo ?? '结账后生成'}</span>
              </span>
            </div>
            <div className="whitespace-nowrap py-1.5 text-center font-number text-detail-lg font-bold tabular-nums" data-testid="cashier-pay-due">
              ¥{fenToYuan(dueFen)}
            </div>
            <div className="mb-3.5 text-center font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.42)]">
              应收
              {passCoveredFen > 0
                ? ` · 含次卡扣次 ${lines.filter((l) => l.paidByPass).length} 项（−¥${fenToYuan(passCoveredFen)} 已抵）`
                : ''}
            </div>

            {/* W-06 M7 folio 金额件（UX-02 §四）：应收构成行式明面——次卡/储值/回馈金单列不混，
                现金类承担合计=唯一待收真值（与顶部大数字同源 dueFen 派生） */}
            <div className="wsk mb-3.5">
              <WFolio
                testId="cashier-pay-folio"
                rows={[
                  { key: 'due', label: '应收', value: `¥${fenToYuan(dueFen)}` },
                  ...(passCoveredFen > 0
                    ? [{ key: 'pass', label: '次卡扣次已抵（不计入已收）', value: `−¥${fenToYuan(passCoveredFen)}`, tone: 'mut' as const }]
                    : []),
                  ...(svApplied > 0
                    ? [{ key: 'sv', label: '储值支付（不计入已收）', value: `−¥${fenToYuan(svApplied)}`, tone: 'mut' as const }]
                    : []),
                  ...(rbApplied > 0
                    ? [{ key: 'rb', label: '回馈金抵扣（仅商品·不计入已收）', value: `−¥${fenToYuan(rbApplied)}`, tone: 'mut' as const }]
                    : []),
                  ...(amounts.roundingFen > 0
                    ? [{ key: 'rounding', label: `${cc('cashier.roundingLabel')}（端口规则·server 实算）`, value: `−¥${fenToYuan(amounts.roundingFen)}`, tone: 'mut' as const }]
                    : []),
                  ...(crApplied > 0
                    ? [{ key: 'credit', label: '挂账（台账留痕·不计入已收）', value: `−¥${fenToYuan(crApplied)}`, tone: 'mut' as const }]
                    : []),
                  { key: 'money', label: '现金类合计承担', value: `¥${fenToYuan(moneyNeedFen)}`, tone: 'total' as const },
                ]}
              />
            </div>

            {/* 支付胶囊七分列（储值仅会员有储值余额时出现；回馈金仅会员出现——R11a；
                片 3 增挂账段：全员可用，台账留痕不碰真钱） */}
            <div
              className={`grid gap-2 ${
                member && svBalance > 0 ? 'grid-cols-7' : member ? 'grid-cols-6' : 'grid-cols-5'
              }`}
            >
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
                      selected.includes(m.key) ? 'text-[rgba(59,46,36,.55)]' : 'text-[rgba(59,46,36,.42)]'
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
                  className={`mt-0.5 block font-number tabular-nums text-caption-xs font-normal ${
                    passOn ? 'text-[rgba(59,46,36,.55)]' : 'text-[rgba(59,46,36,.42)]'
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
                      svOn ? 'text-[rgba(59,46,36,.55)]' : 'text-[rgba(59,46,36,.42)]'
                    }`}
                  >
                    余 ¥{fenToYuan(svBalance)}
                  </small>
                </button>
              ) : null}
              {/* R11a 回馈金胶囊（第六段）：会员即出现；无商品行置灰明示（红线 2 UI 前置，
                  server settle 硬拒兜底）；余额=forUser 真值小字（查询中显「仅抵商品」） */}
              {member ? (
                <button
                  type="button"
                  data-testid="cashier-pay-m-rebate"
                  disabled={rbBlockReason !== null}
                  title={rbBlockReason ?? '回馈金抵扣（仅商品行可用；余额=已到账真值）'}
                  onClick={toggleRb}
                  className={capsuleCls(rbOn ? 'on' : rbBlockReason ? 'disabled' : 'off')}
                >
                  回馈金
                  <small
                    className={`mt-0.5 block font-number tabular-nums text-caption-xs font-normal ${
                      rbOn ? 'text-[rgba(59,46,36,.55)]' : 'text-[rgba(59,46,36,.42)]'
                    }`}
                  >
                    {rbOn ? `抵 ¥${fenToYuan(rbApplied)}` : rbBalance !== null ? `余 ¥${fenToYuan(rbBalance)}` : '仅抵商品'}
                  </small>
                </button>
              ) : null}
              {/* 片 3 挂账胶囊（第七段 credit）：台账留痕不碰真钱；至多一段（单输入行天然保证） */}
              <button
                type="button"
                data-testid="cashier-pay-m-credit"
                disabled={dueFen <= 0}
                title={cc('cashier.creditNote')}
                onClick={toggleCr}
                className={capsuleCls(crOn ? 'on' : dueFen <= 0 ? 'disabled' : 'off')}
              >
                挂账
                <small
                  className={`mt-0.5 block font-number tabular-nums text-caption-xs font-normal ${
                    crOn ? 'text-[rgba(59,46,36,.55)]' : 'text-[rgba(59,46,36,.42)]'
                  }`}
                >
                  {crOn ? `挂 ¥${fenToYuan(crApplied)}` : '台账留痕'}
                </small>
              </button>
            </div>
            {/* 片 3 留口注记行（置灰明面：聚合扫码=通道资质候；外设=PWA 上限） */}
            <div className="mt-2 flex flex-col gap-1" data-testid="cashier-pay-placeholder-notes">
              <p className="flex items-center gap-1.5 text-caption-xs text-[rgba(59,46,36,.3)]">
                <ScanLine size={12} strokeWidth={1.8} aria-hidden />
                {cc('cashier.scanPayNote')}
              </p>
              <p className="flex items-center gap-1.5 text-caption-xs text-[rgba(59,46,36,.3)]">
                <Printer size={12} strokeWidth={1.8} aria-hidden />
                {cc('cashier.peripheralNote')}
              </p>
            </div>
            {passBlockReason ? (
              <p className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="cashier-pass-block">
                {passBlockReason}
              </p>
            ) : null}
            {svBlockReason ? (
              <p className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="cashier-sv-block">
                {svBlockReason}
              </p>
            ) : null}
            {rbBlockReason ? (
              <p className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="cashier-rebate-block">
                {rbBlockReason}
              </p>
            ) : null}

            {/* 选中胶囊金额输入（组合支付：现金类 + 储值段 + 回馈金段 + 挂账段） */}
            {selected.length > 0 || svOn || rbOn || crOn ? (
              <div className="mt-3.5 rounded-[14px] bg-[#FAF8F2] px-3.5 py-3" data-testid="cashier-pay-detail">
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
                        onChange={(e) => onMoneyAmount(m, e.target.value)}
                      />
                    </div>
                  )
                })}
                {svOn ? (
                  <div className="flex items-center justify-between py-1 text-caption">
                    <span>
                      储值支付
                      <small className="ml-1 font-number tabular-nums text-caption-xs text-[rgba(59,46,36,.42)]">
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
                {/* R11a 回馈金段输入行（余额不足可混搭；上限=min(商品行合计, 应收, 已到账余额真值)） */}
                {rbOn ? (
                  <div className="flex items-center justify-between py-1 text-caption">
                    <span>
                      回馈金抵扣
                      <small className="ml-1 font-number tabular-nums text-caption-xs text-[rgba(59,46,36,.42)]">
                        {rbBalance !== null ? `余额 ¥${fenToYuan(rbBalance)} · ` : ''}上限 ¥{fenToYuan(rbCap)}
                      </small>
                    </span>
                    <input
                      className={payInputCls}
                      data-testid="cashier-pay-amt-rebate"
                      inputMode="decimal"
                      placeholder="0"
                      value={rbInput}
                      onChange={(e) => onRbAmount(e.target.value)}
                    />
                  </div>
                ) : null}
                {rbOn && rbOver ? (
                  <p className="py-1 text-caption-xs font-semibold text-danger-deep" data-testid="cashier-rebate-over">
                    {cc('cashier.payRebateCap', {
                      prod: fenToYuan(prodFen),
                      due: fenToYuan(dueFen),
                      bal: rbBalance !== null ? `, 余额 ¥${fenToYuan(rbBalance)}` : '',
                    })}
                  </p>
                ) : null}
                {rbOn ? (
                  <p className="py-1 text-caption-xs text-[rgba(59,46,36,.42)]">
                    {cc('cashier.payRebateNote')}
                  </p>
                ) : null}
                {/* 片 3 挂账段输入行（台账留痕不碰真钱；金额 ≤ 应收−储值−回馈金，可混搭） */}
                {crOn ? (
                  <div className="flex items-center justify-between py-1 text-caption">
                    <span>
                      挂账
                      <small className="ml-1 font-number tabular-nums text-caption-xs text-[rgba(59,46,36,.42)]">
                        上限 ¥{fenToYuan(crCap)}
                      </small>
                    </span>
                    <input
                      className={payInputCls}
                      data-testid="cashier-pay-amt-credit"
                      inputMode="decimal"
                      placeholder="0"
                      value={crInput}
                      onChange={(e) => onCrAmount(e.target.value)}
                    />
                  </div>
                ) : null}
                {crOn && crOver ? (
                  <p className="py-1 text-caption-xs font-semibold text-danger-deep" data-testid="cashier-credit-over">
                    挂账金额须 ≤ ¥{fenToYuan(crCap)}（应收−储值−回馈金），可混搭现金/扫码补足
                  </p>
                ) : null}
                {crOn ? (
                  <p className="py-1 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="cashier-credit-note">
                    {cc('cashier.creditNote')}
                  </p>
                ) : null}
                {selected.includes('cash') && cashApplied > 0 ? (
                  <div className="flex items-center justify-between py-1 text-caption">
                    {/* QA40-D13 修法①：该位历史上把现金承担额误标「应收」（老板 9-24 亲测
                        「应收被回写 168→160」即此）——应收唯一真值=顶部大数字 dueFen，
                        任何位置不许把分段金额叫「应收」 */}
                    <span className="font-number tabular-nums text-[rgba(59,46,36,.42)]">
                      实收 ¥{cashReceivedFen !== null ? fenToYuan(cashReceivedFen) : '…'} − 现金承担 ¥
                      {fenToYuan(cashApplied)}
                    </span>
                    {cashShort ? (
                      <span className="font-number text-caption font-bold tabular-nums text-danger-deep">实收不足</span>
                    ) : cashReceivedFen !== null && cashReceivedFen > cashApplied ? (
                      <span className="font-number text-price font-bold tabular-nums" data-testid="cashier-pay-change">
                        找零 ¥{fenToYuan(cashReceivedFen - cashApplied)}
                      </span>
                    ) : (
                      <span className="text-caption-xs text-[rgba(59,46,36,.42)]">无找零</span>
                    )}
                  </div>
                ) : null}
                {selected.includes('cash') && cashApplied > 0 ? (
                  <div className="flex items-center justify-between py-1 text-caption">
                    <span className="text-[rgba(59,46,36,.42)]">现金实收</span>
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
                {/* QA40-D13 修法③：差额提示行实时明示——Σ≠应收时「还差/超出 ¥X」
                    单独成行（确认钮锁死原因可见），不再藏在口径小字里 */}
                {!moneyBalanced && !zeroDuePassOnly ? (
                  <div
                    className="mt-1 rounded-[8px] bg-danger-light px-2.5 py-1.5 text-caption-xs font-semibold text-danger-deep"
                    data-testid="cashier-pay-gap"
                  >
                    {sumMoney > moneyNeedFen
                      ? cc('cashier.payGapOver', { amt: fenToYuan(sumMoney - moneyNeedFen) })
                      : cc('cashier.payGapUnder', { amt: fenToYuan(moneyNeedFen - sumMoney) })}
                  </div>
                ) : null}
                <div className="py-1 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {cc('cashier.payComboRule')}
                </div>
                {/* 副行口径（裁定①+R11a）：已收=现金类；次卡/储值/回馈金单列不计入已收 */}
                <div className="border-t border-dashed border-[rgba(59,46,36,.12)] py-1 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {cc('cashier.payTenderNote')}
                </div>
              </div>
            ) : passCoveredFen > 0 ? (
              <div className="mt-3.5 rounded-[14px] bg-[#FAF8F2] px-3.5 py-3 text-caption-xs text-[rgba(59,46,36,.62)]">
                {cc('cashier.payPassOnly')}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
              <button
                type="button"
                data-testid="cashier-pay-back"
                onClick={onClose}
                className="rounded-[14px] bg-[#FFFDF6] py-3 text-body-sm font-semibold text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
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

        {/* W-06 红线明面带（UX-02 §四：钉在收款面板下，常显不折叠）——
            无充值/年费≠储值/四分列/扣次非现金 四句走 console 键（wsk.redline1-4） */}
        <div className="wsk mt-4">
          <WRedline testId="cashier-pay-redline" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
