/**
 * 台账专页 /ledger（片 3 · 四区竖排 u3-panel 工艺照 OpsPage/DayClosePanels）
 * ①挂账台账（creditList 状态滤签 + 行内结清/核销弹层，核销仅 owner）
 * ②押金台账（deposit.listStore + storeSummary 在押合计）
 * ③预付台账（appointment.prepaidListForStore 状态滤签）
 * ④授权台账（agreement.listForStore + 周会导出=exportCsv→Blob，仅 owner）
 * 口径：全部留痕不碰真钱，记录不可删。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { CashierModal, SheetBtn } from '@/components/cashier/dialogs'
import {
  AGREEMENT_LIST_KEY,
  CREDIT_LIST_KEY,
  DEPOSIT_LEDGER_KEY,
  fenToYuan,
  PREPAID_LIST_KEY,
  type AgreementListRow,
  type CreditListRow,
  type DepositListRow,
  type PrepaidListRow,
} from '@/components/cashier/model'
import MainScaffold from '@/components/MainScaffold'
import { errMsg, fmtDateTime, yuanToFen } from '@/components/mall-admin/format'
import { cc } from '@/copy/cashier'
import { useMerchantRole } from '@/lib/roles'

const tabCls = (on: boolean) =>
  `rounded-full px-3.5 py-[7px] text-caption transition-colors ${
    on ? 'bg-[#3B2E24] font-semibold text-[#FAF8F2]' : 'text-[rgba(59,46,36,.6)]'
  }`

function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  testid,
}: {
  tabs: Array<{ key: T; label: string }>
  value: T
  onChange: (t: T) => void
  testid: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-[17px] pb-3" role="tablist" data-testid={testid}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          data-testid={`${testid}-${t.key}`}
          onClick={() => onChange(t.key)}
          className={tabCls(value === t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ① 挂账台账                                                            */
/* ------------------------------------------------------------------ */

type CreditStatus = 'open' | 'partial' | 'settled' | 'written_off'

const CREDIT_CHIP: Record<string, { cls: string; label: string }> = {
  open: { cls: 'u3-st wait', label: '在挂' },
  partial: { cls: 'u3-st wait', label: '部分结清' },
  settled: { cls: 'u3-st live', label: '已结清' },
  written_off: { cls: 'u3-st done', label: '已核销' },
}

function CreditLedgerPanel({ isOwner }: { isOwner: boolean }) {
  const { trpc, queryClient } = usePhiliaClient()
  const [status, setStatus] = useState<CreditStatus | 'all'>('all')
  const listQ = useQuery({
    queryKey: [...CREDIT_LIST_KEY, status],
    queryFn: () => trpc.cashier.creditList.query(status === 'all' ? undefined : { status }),
  })
  const [settleTarget, setSettleTarget] = useState<CreditListRow | null>(null)
  const [writeoffTarget, setWriteoffTarget] = useState<CreditListRow | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [settleNote, setSettleNote] = useState('')
  const [writeoffReason, setWriteoffReason] = useState('')

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: CREDIT_LIST_KEY })

  const settleM = useMutation({
    mutationFn: (input: { ledgerId: string; amountFen: number; note?: string }) =>
      trpc.cashier.creditSettle.mutate(input),
    onSuccess: (r) => {
      toast.success(r.idempotent ? '该挂账此前已结清' : '结清已登记（台账留痕，不碰真钱）')
      setSettleTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e)),
  })
  const writeoffM = useMutation({
    mutationFn: (input: { ledgerId: string; reason: string }) => trpc.cashier.creditWriteoff.mutate(input),
    onSuccess: (r) => {
      toast.success(r.idempotent ? '该挂账此前已核销' : '已核销（原因留痕；台账行永存不删）')
      setWriteoffTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const settleFen = settleTarget ? yuanToFen(settleAmount) : null
  const settleRemaining = settleTarget ? settleTarget.amountFen - settleTarget.settledFen : 0
  const settleValid =
    settleFen !== null && settleFen >= 1 && settleFen <= settleRemaining

  return (
    <div className="u3-panel" data-testid="ledger-credit-panel">
      <div className="u3-panel-head">
        <h3>挂账台账</h3>
        <span className="aside">{cc('cashier.creditNote')}</span>
      </div>
      <FilterTabs
        testid="ledger-credit-tab"
        value={status}
        onChange={setStatus}
        tabs={[
          { key: 'all', label: '全部' },
          { key: 'open', label: '在挂' },
          { key: 'partial', label: '部分结清' },
          { key: 'settled', label: '已结清' },
          { key: 'written_off', label: '已核销' },
        ]}
      />
      {listQ.isPending ? (
        <div className="space-y-2 px-[17px] pb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : (listQ.data ?? []).length === 0 ? (
        <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-body-sm text-[rgba(59,46,36,.62)]">
          {cc('cashier.ledgerEmpty')}
        </p>
      ) : (
        <div className="u3-noscrollx overflow-x-auto">
          <table className="u3-tbl min-w-[820px]">
            <thead>
              <tr>
                <th>单号</th>
                <th>客户</th>
                <th className="!text-right">挂账额</th>
                <th className="!text-right">已结清</th>
                <th className="!text-right">在挂余额</th>
                <th>状态</th>
                <th>挂账时刻</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {(listQ.data ?? []).map((r) => {
                const remaining = r.amountFen - r.settledFen
                const chip = CREDIT_CHIP[r.status] ?? { cls: 'u3-st wait', label: r.status }
                const actionable = r.status === 'open' || r.status === 'partial'
                return (
                  <tr key={r.id} data-testid={`ledger-credit-row-${r.id}`}>
                    <td className="u1-num font-semibold">{r.billNo}</td>
                    <td className="text-[rgba(59,46,36,.62)]">
                      {r.customerName ?? '散客'}
                      {r.note ? <span className="block text-caption-xs">{r.note}</span> : null}
                    </td>
                    <td className="u1-num text-right">¥{fenToYuan(r.amountFen)}</td>
                    <td className="u1-num text-right">¥{fenToYuan(r.settledFen)}</td>
                    <td className="u1-num text-right font-bold">¥{fenToYuan(remaining)}</td>
                    <td>
                      <span className={chip.cls}>{chip.label}</span>
                      {r.status === 'written_off' && r.writeoffReason ? (
                        <span className="block text-caption-xs text-[rgba(59,46,36,.42)]">{r.writeoffReason}</span>
                      ) : null}
                    </td>
                    <td className="u1-num">{fmtDateTime(r.createdAt)}</td>
                    <td>
                      <span className="inline-flex items-center gap-2.5">
                        {actionable ? (
                          <button
                            type="button"
                            data-testid={`ledger-credit-settle-${r.id}`}
                            onClick={() => {
                              setSettleTarget(r)
                              setSettleAmount(String(remaining / 100))
                              setSettleNote('')
                            }}
                            className="text-caption-xs font-bold text-ink transition-transform duration-120 active:scale-[0.92]"
                          >
                            结清
                          </button>
                        ) : null}
                        {/* 核销仅 owner（server merchantOwnerProcedure 同口径硬闸） */}
                        {isOwner && actionable ? (
                          <button
                            type="button"
                            data-testid={`ledger-credit-writeoff-${r.id}`}
                            onClick={() => {
                              setWriteoffTarget(r)
                              setWriteoffReason('')
                            }}
                            className="text-caption-xs font-bold text-danger transition-transform duration-120 active:scale-[0.92]"
                          >
                            核销
                          </button>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 结清弹层（金额+注记；≤在挂余额） */}
      <CashierModal
        open={settleTarget !== null}
        onClose={() => setSettleTarget(null)}
        title={cc('cashier.creditSettleTitle')}
        testid="ledger-credit-settle-dialog"
        footer={
          <>
            <SheetBtn onClick={() => setSettleTarget(null)}>取消</SheetBtn>
            <SheetBtn
              variant="primary"
              data-testid="ledger-credit-settle-confirm"
              disabled={!settleValid || settleM.isPending}
              onClick={() => {
                if (!settleTarget || settleFen === null) return
                settleM.mutate({
                  ledgerId: settleTarget.id,
                  amountFen: settleFen,
                  ...(settleNote.trim() ? { note: settleNote.trim() } : {}),
                })
              }}
            >
              {settleM.isPending ? '登记中…' : '确认结清'}
            </SheetBtn>
          </>
        }
      >
        {settleTarget ? (
          <div>
            <div className="rounded-[14px] bg-[#FAF8F2] px-3.5 py-3 text-caption-xs text-[rgba(59,46,36,.62)]">
              单号 <b className="font-number tabular-nums text-ink">{settleTarget.billNo}</b>
              {' · '}在挂余额 <b className="font-number tabular-nums text-ink">¥{fenToYuan(settleRemaining)}</b>
              <p className="mt-1">{cc('cashier.creditSettleNote')}</p>
            </div>
            <input
              data-testid="ledger-credit-settle-amount"
              inputMode="decimal"
              placeholder="结清金额 ¥"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              className="mt-3 w-full rounded-[14px] bg-[#FFFDF6] px-3 py-2 font-number text-body-sm font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
            />
            <input
              data-testid="ledger-credit-settle-note"
              maxLength={200}
              placeholder="注记（选填，如：现金收讫）"
              value={settleNote}
              onChange={(e) => setSettleNote(e.target.value)}
              className="mt-2 w-full rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
            />
            {settleFen !== null && settleFen > settleRemaining ? (
              <p className="mt-2 text-caption-xs font-semibold text-danger-deep">
                结清金额超在挂余额（¥{fenToYuan(settleRemaining)}）
              </p>
            ) : null}
          </div>
        ) : null}
      </CashierModal>

      {/* 核销弹层（仅 owner；原因必填留痕） */}
      <CashierModal
        open={writeoffTarget !== null}
        onClose={() => setWriteoffTarget(null)}
        title={cc('cashier.creditWriteoffTitle')}
        testid="ledger-credit-writeoff-dialog"
        footer={
          <>
            <SheetBtn onClick={() => setWriteoffTarget(null)}>取消</SheetBtn>
            <SheetBtn
              variant="danger-outline"
              data-testid="ledger-credit-writeoff-confirm"
              disabled={writeoffReason.trim().length === 0 || writeoffM.isPending}
              onClick={() => {
                if (!writeoffTarget) return
                writeoffM.mutate({ ledgerId: writeoffTarget.id, reason: writeoffReason.trim() })
              }}
            >
              {writeoffM.isPending ? '核销中…' : '确认核销'}
            </SheetBtn>
          </>
        }
      >
        {writeoffTarget ? (
          <div>
            <div className="rounded-[14px] bg-[#FAF8F2] px-3.5 py-3 text-caption-xs text-[rgba(59,46,36,.62)]">
              单号 <b className="font-number tabular-nums text-ink">{writeoffTarget.billNo}</b>
              {' · '}在挂余额{' '}
              <b className="font-number tabular-nums text-ink">
                ¥{fenToYuan(writeoffTarget.amountFen - writeoffTarget.settledFen)}
              </b>
              <p className="mt-1">{cc('cashier.creditWriteoffNote')}</p>
            </div>
            <textarea
              data-testid="ledger-credit-writeoff-reason"
              maxLength={200}
              placeholder="核销原因（必填，留痕）"
              value={writeoffReason}
              onChange={(e) => setWriteoffReason(e.target.value)}
              className="mt-3 min-h-[76px] w-full resize-none rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
            />
            {writeoffReason.trim().length === 0 ? (
              <p className="mt-2 text-caption-xs font-semibold text-danger-deep">核销原因必填</p>
            ) : null}
          </div>
        ) : null}
      </CashierModal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ② 押金台账                                                            */
/* ------------------------------------------------------------------ */

const DEPOSIT_KIND_LABEL: Record<string, string> = {
  kennel: '寄养押金',
  goods: '物品押金',
  other: '其他',
}
const DEPOSIT_CHIP: Record<string, { cls: string; label: string }> = {
  held: { cls: 'u3-st wait', label: '在押' },
  refunding: { cls: 'u3-st wait', label: '退还中' },
  refunded: { cls: 'u3-st done', label: '已退还' },
}

function DepositLedgerPanel() {
  const { trpc } = usePhiliaClient()
  const summaryQ = useQuery({
    queryKey: [...DEPOSIT_LEDGER_KEY, 'storeSummary'],
    queryFn: () => trpc.deposit.storeSummary.query(),
  })
  const listQ = useQuery({
    queryKey: [...DEPOSIT_LEDGER_KEY, 'listStore'],
    queryFn: () => trpc.deposit.listStore.query(),
  })
  const s = summaryQ.data

  return (
    <div className="u3-panel" data-testid="ledger-deposit-panel">
      <div className="u3-panel-head">
        <h3>押金台账</h3>
        <span className="aside">{cc('cashier.depositSummaryAside')}</span>
      </div>
      <div className="u3-kv sm:grid-cols-3">
        <div className="cell">
          <div className="cap">在押合计</div>
          <div className="v" data-testid="ledger-deposit-custody">
            {s ? `¥${fenToYuan(s.inCustodyFen)}` : '…'}
          </div>
        </div>
        <div className="cell">
          <div className="cap">在押（held）</div>
          <div className="v font-number tabular-nums">
            {s ? `¥${fenToYuan(s.heldFen)} · ${s.heldCount} 笔` : '…'}
          </div>
        </div>
        <div className="cell">
          <div className="cap">退还中（refunding）</div>
          <div className="v font-number tabular-nums">
            {s ? `¥${fenToYuan(s.refundingFen)} · ${s.refundingCount} 笔` : '…'}
          </div>
        </div>
      </div>
      {listQ.isPending ? (
        <div className="space-y-2 px-[17px] pb-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : (listQ.data?.items ?? []).length === 0 ? (
        <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-body-sm text-[rgba(59,46,36,.62)]">
          {cc('cashier.ledgerEmpty')}
        </p>
      ) : (
        <div className="u3-noscrollx overflow-x-auto">
          <table className="u3-tbl min-w-[720px]">
            <thead>
              <tr>
                <th>类型</th>
                <th className="!text-right">金额</th>
                <th>状态</th>
                <th>收取时刻</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {(listQ.data?.items ?? []).map((r: DepositListRow) => {
                const chip = DEPOSIT_CHIP[r.status] ?? { cls: 'u3-st wait', label: r.status }
                return (
                  <tr key={r.id} data-testid={`ledger-deposit-row-${r.id}`}>
                    <td>{DEPOSIT_KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="u1-num text-right font-semibold">¥{fenToYuan(r.amountFen)}</td>
                    <td>
                      <span className={chip.cls}>{chip.label}</span>
                    </td>
                    <td className="u1-num">{r.heldAt ? fmtDateTime(r.heldAt) : fmtDateTime(r.createdAt)}</td>
                    <td className="text-[rgba(59,46,36,.62)]">{r.note ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ③ 预付台账                                                            */
/* ------------------------------------------------------------------ */

type PrepaidStatus = 'prepaid_pending' | 'prepaid_registered' | 'checked_deducted' | 'refunded'

const PREPAID_CHIP: Record<string, { cls: string; label: string }> = {
  prepaid_pending: { cls: 'u3-st wait', label: '登记中' },
  prepaid_registered: { cls: 'u3-st live', label: '已登记已收' },
  checked_deducted: { cls: 'u3-st done', label: '已核销抵扣' },
  refunded: { cls: 'u3-st done', label: '已退还' },
}

function PrepaidLedgerPanel() {
  const { trpc } = usePhiliaClient()
  const [status, setStatus] = useState<PrepaidStatus | 'all'>('all')
  const listQ = useQuery({
    queryKey: [...PREPAID_LIST_KEY, status],
    queryFn: () => trpc.appointment.prepaidListForStore.query(status === 'all' ? undefined : { status }),
  })

  return (
    <div className="u3-panel" data-testid="ledger-prepaid-panel">
      <div className="u3-panel-head">
        <h3>预付台账</h3>
        <span className="aside">预约即预付 · 留痕不碰真钱</span>
      </div>
      <FilterTabs
        testid="ledger-prepaid-tab"
        value={status}
        onChange={setStatus}
        tabs={[
          { key: 'all', label: '全部' },
          { key: 'prepaid_pending', label: '登记中' },
          { key: 'prepaid_registered', label: '已登记已收' },
          { key: 'checked_deducted', label: '已核销抵扣' },
          { key: 'refunded', label: '已退还' },
        ]}
      />
      {listQ.isPending ? (
        <div className="space-y-2 px-[17px] pb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : (listQ.data ?? []).length === 0 ? (
        <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-body-sm text-[rgba(59,46,36,.62)]">
          {cc('cashier.ledgerEmpty')}
        </p>
      ) : (
        <div className="u3-noscrollx overflow-x-auto">
          <table className="u3-tbl min-w-[820px]">
            <thead>
              <tr>
                <th>客户</th>
                <th>手机号</th>
                <th className="!text-right">预付额</th>
                <th>状态</th>
                <th>预约</th>
                <th>登记时刻</th>
              </tr>
            </thead>
            <tbody>
              {(listQ.data ?? []).map((r: PrepaidListRow) => {
                const chip = PREPAID_CHIP[r.status] ?? { cls: 'u3-st wait', label: r.status }
                return (
                  <tr key={r.id} data-testid={`ledger-prepaid-row-${r.id}`}>
                    <td className="font-semibold">{r.customerName ?? '—'}</td>
                    <td className="u1-num text-[rgba(59,46,36,.62)]">{r.customerPhoneMasked ?? '—'}</td>
                    <td className="u1-num text-right font-semibold">¥{fenToYuan(r.amountFen)}</td>
                    <td>
                      <span className={chip.cls}>{chip.label}</span>
                    </td>
                    <td className="u1-num text-[rgba(59,46,36,.62)]">
                      {fmtDateTime(r.appointment.scheduledStart)} · {r.appointment.type}
                    </td>
                    <td className="u1-num">{fmtDateTime(r.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ④ 授权台账（+ 周会导出，仅 owner）                                       */
/* ------------------------------------------------------------------ */

function AgreementLedgerPanel({ isOwner }: { isOwner: boolean }) {
  const { trpc } = usePhiliaClient()
  const listQ = useQuery({
    queryKey: AGREEMENT_LIST_KEY,
    queryFn: () => trpc.agreement.listForStore.query(),
  })
  const [exporting, setExporting] = useState(false)

  /** 周会导出（仅 owner）：query 端点直调 + Blob 浏览器下载（照退款/日结导出工艺） */
  const doExport = async () => {
    setExporting(true)
    try {
      const r = await trpc.agreement.exportCsv.query()
      const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = r.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`已导出 ${r.filename}（${r.rows} 行，导出留痕）`)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="u3-panel" data-testid="ledger-agreement-panel">
      <div className="u3-panel-head">
        <h3>授权台账</h3>
        <span className="aside">{cc('cashier.agreementAside')}</span>
        {isOwner ? (
          <button
            type="button"
            data-testid="ledger-agreement-export"
            disabled={exporting}
            onClick={() => void doExport()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#FFFDF6] px-4 py-2 text-caption font-semibold text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
          >
            <Download size={13} strokeWidth={1.8} aria-hidden />
            {exporting ? '导出中…' : cc('cashier.agreementExport')}
          </button>
        ) : null}
      </div>
      {listQ.isPending ? (
        <div className="space-y-2 px-[17px] pb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : (listQ.data?.items ?? []).length === 0 ? (
        <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-body-sm text-[rgba(59,46,36,.62)]">
          {cc('cashier.ledgerEmpty')}
        </p>
      ) : (
        <div className="u3-noscrollx overflow-x-auto">
          <table className="u3-tbl min-w-[720px]">
            <thead>
              <tr>
                <th>签署人</th>
                <th>手机号</th>
                <th>协议类型</th>
                <th>版本</th>
                <th>签署时刻</th>
              </tr>
            </thead>
            <tbody>
              {(listQ.data?.items ?? []).map((r: AgreementListRow) => (
                <tr key={r.id} data-testid={`ledger-agreement-row-${r.id}`}>
                  <td className="font-semibold">{r.nickname ?? r.userId}</td>
                  <td className="u1-num text-[rgba(59,46,36,.62)]">{r.phoneMasked ?? '—'}</td>
                  <td>{r.agreementLabel}</td>
                  <td className="u1-num text-[rgba(59,46,36,.62)]">{r.version}</td>
                  <td className="u1-num">{fmtDateTime(r.checkedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ⑤ 通道对账（产品-1010 片 3 · C 股；owner-only server 硬闸 payChannel.reconcile） */
/* ------------------------------------------------------------------ */

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']

type ReconItem = Awaited<ReturnType<Trpc['payChannel']['reconcile']['query']>>['items'][number]

/** issue → 中文（对账差异类，码内写死=系统语非端口文案） */
const RECON_ISSUE_LABEL: Record<string, string> = {
  missing_channel: '通道无此单',
  amount_mismatch: '金额不等',
  refund_unbalanced: '退款不等',
}

function PayChannelReconPanel() {
  const { trpc } = usePhiliaClient()
  const reconQ = useQuery({
    queryKey: ['payChannel', 'reconcile'],
    queryFn: () => trpc.payChannel.reconcile.query(),
    retry: 1,
  })
  const data = reconQ.data

  return (
    <div className="u3-panel" data-testid="ledger-paychannel-recon-panel">
      <div className="u3-panel-head">
        <h3>通道对账</h3>
        <span className="aside">通道账单 vs 业务账逐笔对（mock 期=通道账本=本地账本同表，真通道换源不换表）</span>
      </div>
      <div className="u3-kv sm:grid-cols-3">
        <div className="cell">
          <div className="cap">对账笔数</div>
          <div className="v font-number tabular-nums" data-testid="recon-total">{data ? `${data.totals.checked} 笔` : '…'}</div>
        </div>
        <div className="cell">
          <div className="cap">差异笔数</div>
          <div className="v font-number tabular-nums" data-testid="recon-mismatch">{data ? `${data.totals.mismatched} 笔` : '…'}</div>
        </div>
        <div className="cell">
          <div className="cap">口径</div>
          <div className="v text-body-sm">平=issue 空；差=逐笔列下表</div>
        </div>
      </div>
      {reconQ.isPending ? (
        <div className="space-y-2 px-[17px] pb-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : reconQ.isError ? (
        <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-body-sm text-[rgba(59,46,36,.62)]">
          读取失败（仅店主可看对账）：{errMsg(reconQ.error)}
        </p>
      ) : (data?.items ?? []).length === 0 ? (
        <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-body-sm text-[rgba(59,46,36,.62)]">
          暂无线上支付单
        </p>
      ) : (
        <div className="u3-noscrollx overflow-x-auto">
          <table className="u3-tbl min-w-[860px]">
            <thead>
              <tr>
                <th>单据</th>
                <th>域</th>
                <th className="!text-right">业务额</th>
                <th>业务态</th>
                <th>通道态</th>
                <th className="!text-right">通道额</th>
                <th className="!text-right">通道退</th>
                <th className="!text-right">业务退</th>
                <th>对账</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((r: ReconItem) => (
                <tr key={`${r.source}-${r.refNo}`} data-testid={`recon-row-${r.refNo}`}>
                  <td className="u1-num">{r.refNo}</td>
                  <td>{r.bizDomain}</td>
                  <td className="u1-num text-right font-semibold">¥{fenToYuan(r.bizAmountFen)}</td>
                  <td>{r.bizStatus}</td>
                  <td>{r.channelStatus ?? '—'}</td>
                  <td className="u1-num text-right">{r.channelTotalFen === null ? '—' : `¥${fenToYuan(r.channelTotalFen)}`}</td>
                  <td className="u1-num text-right">¥{fenToYuan(r.channelRefundedFen)}</td>
                  <td className="u1-num text-right">¥{fenToYuan(r.bizRefundedFen)}</td>
                  <td>
                    {r.issue === null ? (
                      <span className="u3-st done">平</span>
                    ) : (
                      <span className="u3-st wait">{RECON_ISSUE_LABEL[r.issue] ?? r.issue}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function LedgerPage() {
  const role = useMerchantRole()
  return (
    <MainScaffold testid="ledger-page" title={cc('cashier.ledgerTitle')} sub={cc('cashier.ledgerSub')}>
      <div className="flex flex-col gap-3.5">
        <CreditLedgerPanel isOwner={role.isOwner} />
        <DepositLedgerPanel />
        <PrepaidLedgerPanel />
        <AgreementLedgerPanel isOwner={role.isOwner} />
        {/* 产品-1010 片 3：通道对账区（owner-only server 硬闸；非店主不挂口） */}
        {role.isOwner ? <PayChannelReconPanel /> : null}
      </div>
    </MainScaffold>
  )
}
