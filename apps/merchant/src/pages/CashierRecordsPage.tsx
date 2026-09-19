/**
 * 收银流水 /cashier/records（批次 M1 · 屏三；M1-补2 D/R6 改造）
 *
 * - 全宽表 u3-tbl：单号 Montserrat | 时间 | 买家（会员名/散客）| 内容摘要 |
 *   金额右对齐 | 支付方式签（R6-1 五分列全显，组合支付「现金+微信」）|
 *   状态签（已收薄荷 / 已撤单灰 / 挂单·开单中浅木 / 冲正单灰 / 已冲正灰）| 详情 ›；
 * - 顶部 chips：全部/已收/已撤单 + 今日/近7天/近30天 + 买家搜索框（300ms 防抖，
 *   走 listBills buyer 参数——服务端模糊昵称/手机号，「散客」匹配无会员单）；
 * - M1-补2 D（反结账双件之一）：
 *   - settled 且未被冲正的行，owner 行末见「反结账」钮（manager/clerk 无入口）→
 *     强制原因弹层（关联原单号自动带出）；成功后原单灰签「已冲正」+ 冲正单
 *     （status=reversal，金额镜像负值）入流水、不计已收提示 + toast 真实口径；
 *   - 详情内 owner|manager 见「退款」入口（置反结账旁）→ 明文拦截弹层
 *     「退款功能随专项批开通」（补丁② 纯前端零接口零写入）；clerk 无该入口；
 *   - open/held 详情内撤单入口三级全开（补丁①1，边界=仅未支付单）；
 * - SSE：cashier.billHeld/billSettled/billVoided/billReversed → invalidate 流水 +
 *   重连全量对齐；
 * - 390 降级：表格横滑（u3-noscrollx + min-w）；三态齐全（骨架/错误重试/空态）。
 * - 路由层：clerk 直达本页由 App.tsx ClerkRouteGuard 给引导页（矩阵总规则②）。
 */

import { EventType, usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import BillDetailDialog from '@/components/cashier/BillDetailDialog'
import { RefundBlockDialog, ReverseDialog, VoidDialog } from '@/components/cashier/dialogs'
import {
  BILL_STATUS_CHIP,
  CASHIER_ROOT_KEY,
  fenToYuan,
  PAY_METHOD_LABEL,
  RECORDS_KEY,
  TODAY_TENDER_KEY,
  type BillListRow,
} from '@/components/cashier/model'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import { STATS_QUERY_KEY } from '@/components/dashboard/utils'
import MainScaffold, { QuietButton, SearchInput } from '@/components/MainScaffold'
import { formatDateTime, formatTime } from '@/components/finance/utils'
import { errMsg } from '@/components/mall-admin/format'
import { useMerchantRole } from '@/lib/roles'

type StatusFilter = 'all' | 'settled' | 'voided'
type RangeFilter = 'today' | 'd7' | 'd30'

const STATUS_CHIPS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'settled', label: '已收' },
  { key: 'voided', label: '已撤单' },
]
const RANGE_CHIPS: Array<{ key: RangeFilter; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'd7', label: '近 7 天' },
  { key: 'd30', label: '近 30 天' },
]

export default function CashierRecordsPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()
  const role = useMerchantRole()

  const [status, setStatus] = useState<StatusFilter>('all')
  const [range, setRange] = useState<RangeFilter>('today')
  const [buyer, setBuyer] = useState('')
  const [buyerKw, setBuyerKw] = useState('')

  // 买家搜索 300ms 防抖（沿用现有口径）
  useEffect(() => {
    const t = window.setTimeout(() => setBuyerKw(buyer.trim()), 300)
    return () => window.clearTimeout(t)
  }, [buyer])

  const listQ = useQuery({
    queryKey: [...RECORDS_KEY, { status, range, buyer: buyerKw }],
    queryFn: () =>
      trpc.cashier.listBills.query({
        status: status === 'all' ? undefined : status,
        range,
        buyer: buyerKw || undefined,
      }),
  })

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: CASHIER_ROOT_KEY })
    // M1-补2 R1：冲正影响已收口径，同源出口一并失效
    void queryClient.invalidateQueries({ queryKey: TODAY_TENDER_KEY })
    void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: ['store', 'financeStats'] })
  }, [queryClient])

  // SSE：收银事件 → 流水刷新；断线重连全量对齐
  useEffect(
    () =>
      events.onEvent((envelope) => {
        switch (envelope.type) {
          case EventType.CashierBillHeld:
          case EventType.CashierBillSettled:
          case EventType.CashierBillVoided:
          case EventType.CashierBillReversed:
            invalidate()
            break
          default:
            break
        }
      }),
    [events, invalidate],
  )
  useEffect(() => events.onReconnect(invalidate), [events, invalidate])

  const [detailNo, setDetailNo] = useState<string | null>(null)
  const [voidTarget, setVoidTarget] = useState<{
    billNo: string
    buyerName?: string
    payableFen?: number
    status?: string
  } | null>(null)
  const [reverseTarget, setReverseTarget] = useState<{
    billNo: string
    buyerName?: string
    payableFen?: number
  } | null>(null)
  const [refundBlockNo, setRefundBlockNo] = useState<string | null>(null)

  const voidM = useMutation({
    mutationFn: (input: { billNo: string; reason?: string }) => trpc.cashier.voidBill.mutate(input),
    onSuccess: (r) => {
      toast.success(`已撤单 ${r.bill.billNo}（留痕可查）`)
      setVoidTarget(null)
      setDetailNo(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  // M1-补2 D：反结账单（仅店主；强制原因；toast 真实口径）
  const reverseM = useMutation({
    mutationFn: (input: { billNo: string; reason: string }) => trpc.cashier.reverseBill.mutate(input),
    onSuccess: (r) => {
      toast.success(
        r.idempotent
          ? `${r.bill.billNo} 此前已冲正（冲正单 ${r.reversalBillNo ?? '—'}）`
          : `已反结账 ${r.bill.billNo} —— 冲正单 ${r.reversalBillNo ?? '—'} 已入流水（不计已收）`,
      )
      setReverseTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const rows = useMemo(() => listQ.data ?? [], [listQ.data])

  return (
    <MainScaffold
      testid="cashier-records-page"
      title="收银流水"
      sub={`挂单 / 结账 / 撤单 / 冲正全留痕 · 共 ${listQ.data?.length ?? '…'} 单`}
      actions={
        <SearchInput placeholder="搜索买家（昵称/手机号/散客）…" value={buyer} onChange={setBuyer} testid="cashier-records-search" />
      }
    >
      {/* 筛选 chips：状态 + 期间 */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            data-testid={`cashier-records-st-${c.key}`}
            className={`u3-chipf ${status === c.key ? 'on' : ''}`}
            onClick={() => setStatus(c.key)}
          >
            {c.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[rgba(74,59,46,.12)]" aria-hidden />
        {RANGE_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            data-testid={`cashier-records-range-${c.key}`}
            className={`u3-chipf ${range === c.key ? 'on' : ''}`}
            onClick={() => setRange(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="u3-panel">
        {listQ.isPending ? (
          <div className="space-y-2 px-[17px] py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
            ))}
          </div>
        ) : listQ.isError ? (
          <div className="px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(74,59,46,.62)]">流水加载失败：{errMsg(listQ.error)}</p>
            <div className="mt-4">
              <QuietButton testid="cashier-records-retry" onClick={() => void listQ.refetch()}>
                重新加载
              </QuietButton>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-[17px] py-12 text-center text-body-sm text-[rgba(74,59,46,.62)]">
            当前筛选无流水——收银台结账后单据会出现在这里
          </p>
        ) : (
          /* 390 降级：横滑容器（u3-noscrollx），表本体保底宽 */
          <div className="u3-noscrollx overflow-x-auto">
            <table className="u3-tbl min-w-[820px]">
              <thead>
                <tr>
                  <th>单号</th>
                  <th>时间</th>
                  <th>买家</th>
                  <th>内容摘要</th>
                  <th className="!text-right">金额</th>
                  <th>支付方式</th>
                  <th>状态</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {rows.map((b: BillListRow) => {
                  const reversed = b.reversedAt != null
                  const st =
                    b.status === 'settled' && reversed
                      ? { cls: 'u3-st done', label: '已冲正' }
                      : (BILL_STATUS_CHIP[b.status] ?? { cls: 'u3-st wait', label: b.status })
                  const isReversal = b.status === 'reversal'
                  // D：反结账入口=settled 且未被冲正 + 仅店主（行末小钮；详情内同口径）
                  const reversible = b.status === 'settled' && !reversed && role.isOwner
                  return (
                    <tr
                      key={b.id}
                      className="rowlink"
                      data-testid={`cashier-records-row-${b.billNo}`}
                      onClick={() => setDetailNo(b.billNo)}
                    >
                      <td className="font-number font-semibold tabular-nums">
                        {b.billNo}
                        {isReversal && b.reversalOfBillNo ? (
                          <span className="block text-caption-xs font-normal text-[rgba(74,59,46,.42)]">
                            冲正 {b.reversalOfBillNo}
                          </span>
                        ) : null}
                      </td>
                      <td className="u1-num">{range === 'today' ? formatTime(b.createdAt) : formatDateTime(b.createdAt)}</td>
                      <td>{b.buyerName}</td>
                      <td className="max-w-[220px] truncate text-[rgba(74,59,46,.62)]">{b.summary}</td>
                      <td className={`u1-num text-right font-bold ${isReversal ? 'text-danger-deep' : ''}`}>
                        {isReversal ? '−' : ''}¥{fenToYuan(Math.abs(b.payableFen))}
                      </td>
                      <td className="text-[rgba(74,59,46,.62)]">
                        {/* R6-1：支付方式标签全显（组合支付「现金+微信」等全部方式） */}
                        {b.methods.length > 0
                          ? b.methods.map((m) => PAY_METHOD_LABEL[m] ?? m).join('、')
                          : '—'}
                      </td>
                      <td>
                        <span className={st.cls}>{st.label}</span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2.5">
                          {reversible ? (
                            <button
                              type="button"
                              data-testid={`cashier-records-reverse-${b.billNo}`}
                              title="反结账（仅店主 · 强制原因留痕）"
                              onClick={(e) => {
                                e.stopPropagation()
                                setReverseTarget({ billNo: b.billNo, buyerName: b.buyerName, payableFen: b.payableFen })
                              }}
                              className="text-caption-xs font-bold text-danger transition-transform duration-120 ease-philia-spring active:scale-[0.92]"
                            >
                              反结账
                            </button>
                          ) : null}
                          <span className="text-caption-xs font-bold text-ink">详情 ›</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BillDetailDialog
        billNo={detailNo}
        isOwner={role.isOwner}
        canManage={role.canManage}
        onVoid={(b) => setVoidTarget(b)}
        onReverse={(b) => {
          setDetailNo(null)
          setReverseTarget(b)
        }}
        onRefund={(no) => setRefundBlockNo(no)}
        onClose={() => setDetailNo(null)}
      />
      <VoidDialog
        bill={voidTarget}
        pending={voidM.isPending}
        onConfirm={(reason) => {
          if (!voidTarget) return
          voidM.mutate({ billNo: voidTarget.billNo, reason })
        }}
        onClose={() => setVoidTarget(null)}
      />
      <ReverseDialog
        bill={reverseTarget}
        pending={reverseM.isPending}
        onConfirm={(reason) => {
          if (!reverseTarget) return
          reverseM.mutate({ billNo: reverseTarget.billNo, reason })
        }}
        onClose={() => setReverseTarget(null)}
      />
      {/* 补丁②：退款明文拦截（纯前端提示，零接口调用零写入） */}
      <RefundBlockDialog billNo={refundBlockNo} onClose={() => setRefundBlockNo(null)} />
    </MainScaffold>
  )
}
