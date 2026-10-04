/**
 * 退款单 /cashier/refunds（批次 R12 退款专项 Phase 3 · 商家端退款列表页）
 *
 * 纲：退款 ≠ 反结账——退款=经营行为计退款单列，原单已收不涂改，
 * 当日净额=已收−退款（V2 现金段净额 / V7 跨日计入发生日 biz_date，不回填封箱历史）。
 *
 * 权限（矩阵 V1.2 修订页 + server 硬闸门）：
 * - clerk：墨轨无入口 + ClerkRouteGuard 路由引导页 + 本页 canManage 闸门（双保险）；
 * - 店长（本店）：查询 / 实退登记（executed→settled，settleActual+备注）；
 * - 店主：全域 + 驳回 draft（rejectDraft+备注必填）+ 导出 CSV（仅老板留痕）。
 * - 店长：本店 + 驳回 draft（矩阵 V1.3 · 修复包 PR-1 驳回权放开）。
 *
 * 结构：
 * - pendingActual 超 24h 待办：顶部黄色提醒条（笔数 + 单号/金额简报）；
 * - 客户退款申请待办（批次 C5 审批缝）：refundRequest.listPending + 批准/驳回行操作
 *   （批准=二次确认弹层复述 → approve 直通 R12 内核；驳回=原因必填弹层 → reject；
 *   SLA 超期=赭红签；反悔窗内标记弃件——listPending 不透出 freeRegretHours，报备）；
 * - 状态过滤 chips（全部/草稿/待实退登记/实退完成/已驳回）；
 * - refund.list 表格：退款单号/原单号/类型/金额/原因/发起/审批/实退标记/时间，
 *   行点击 → RefundDetailDialog（六联动快照详情）；
 * - SSE：refund.executed/settled/rejected/monthExported → invalidate 列表+待办。
 */

import { EventType, Skeleton, usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CashierModal, SheetBtn } from '@/components/cashier/dialogs'
import {
  REFUND_LIST_KEY,
  REFUND_METHOD_LABEL,
  REFUND_PENDING_KEY,
  REFUND_REQUEST_PENDING_KEY,
  REFUND_STATUS_CHIP,
  REFUND_TYPE_LABEL,
  storeTodayStr,
  type RefundListRow,
  type RefundRequestPendingRow,
  type RefundType,
} from '@/components/cashier/refund'
import RefundDetailDialog from '@/components/cashier/RefundDetailDialog'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import MainScaffold, { QuietButton } from '@/components/MainScaffold'
import RoleGuidePage from '@/components/RoleGuidePage'
import { cc } from '@/copy/cashier'
import { fmtDateTime, errMsg, fenToYuan } from '@/components/mall-admin/format'
import { useMerchantRole } from '@/lib/roles'

type StatusFilter = 'all' | 'draft' | 'executed' | 'settled' | 'rejected'

const STATUS_CHIPS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'executed', label: '待实退登记' },
  { key: 'settled', label: '实退完成' },
  { key: 'rejected', label: '已驳回' },
]

/** 实退标记签（list 行 actualSettled 口径 + draft/rejected 状态签） */
function settleChip(r: RefundListRow): { cls: string; label: string } {
  if (r.status === 'settled') return { cls: 'u3-st live', label: '已实退' }
  return REFUND_STATUS_CHIP[r.status] ?? { cls: 'u3-st wait', label: r.status }
}

export default function CashierRefundsPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()
  const role = useMerchantRole()

  const [status, setStatus] = useState<StatusFilter>('all')
  const [detailRow, setDetailRow] = useState<RefundListRow | null>(null)
  const [settleTarget, setSettleTarget] = useState<RefundListRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<RefundListRow | null>(null)
  const [approveReqTarget, setApproveReqTarget] = useState<RefundRequestPendingRow | null>(null)
  const [rejectReqTarget, setRejectReqTarget] = useState<RefundRequestPendingRow | null>(null)
  const [exportMonth, setExportMonth] = useState(() => storeTodayStr().slice(0, 7))
  const [exporting, setExporting] = useState(false)

  const canManage = role.canManage

  /* ---------------- 查询 ---------------- */
  const listQ = useQuery({
    queryKey: [...REFUND_LIST_KEY, { status }],
    queryFn: () => trpc.refund.list.query({ status: status === 'all' ? undefined : status }),
    enabled: canManage,
  })
  // 超 24h 未登记实退待办（冻结版 §三：店长待办提醒数据源）
  const pendingQ = useQuery({
    queryKey: REFUND_PENDING_KEY,
    queryFn: () => trpc.refund.pendingActual.query(),
    enabled: canManage,
  })
  // 客户退款申请待办（批次 C5：本店 submitted 申请升序，先到先审）
  const requestQ = useQuery({
    queryKey: REFUND_REQUEST_PENDING_KEY,
    queryFn: () => trpc.refundRequest.listPending.query(),
    enabled: canManage,
  })

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: REFUND_LIST_KEY })
    void queryClient.invalidateQueries({ queryKey: REFUND_PENDING_KEY })
    void queryClient.invalidateQueries({ queryKey: REFUND_REQUEST_PENDING_KEY })
    // 退款落账/实退影响流水标记与日结/财务口径，同源一并失效
    void queryClient.invalidateQueries({ queryKey: ['cashier'] })
    void queryClient.invalidateQueries({ queryKey: ['store', 'todayTenderStats'] })
    void queryClient.invalidateQueries({ queryKey: ['store', 'financeStats'] })
    void queryClient.invalidateQueries({ queryKey: ['refund', 'dayStats'] })
  }, [queryClient])

  // SSE：退款事件 → 列表/待办对齐；重连全量兜底
  useEffect(
    () =>
      events.onEvent((envelope) => {
        switch (envelope.type) {
          case EventType.RefundExecuted:
          case EventType.RefundSettled:
          case EventType.RefundRejected:
          // 批次 C5：客户退款申请批准（refundRequest.approved，server 已发；
          // shared EventType 常量同步属跨包改动，本批范围=apps/merchant 暂以字面值对齐，已报备）
          case 'refundRequest.approved':
            invalidate()
            break
          default:
            break
        }
      }),
    [events, invalidate],
  )
  useEffect(() => events.onReconnect(invalidate), [events, invalidate])

  /* ---------------- 动作 ---------------- */
  const settleM = useMutation({
    mutationFn: (input: { refundId: string; note: string }) => trpc.refund.settleActual.mutate(input),
    onSuccess: (r) => {
      toast.success(
        r.idempotent
          ? `${r.refund.refundNo} 此前已登记实退`
          : `实退完成已登记 ${r.refund.refundNo}（¥${fenToYuan(r.refund.amountFen)}，留痕可查）`,
      )
      setSettleTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const rejectM = useMutation({
    mutationFn: (input: { refundId: string; note: string }) => trpc.refund.rejectDraft.mutate(input),
    onSuccess: (r) => {
      toast.success(`已驳回 ${r.refund.refundNo}（驳回留痕，原因见备注）`)
      setRejectTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  /* ---- 客户退款申请审批（批次 C5；FORBIDDEN 等内核闸错误原样透出） ---- */
  const approveReqM = useMutation({
    mutationFn: (input: { requestId: string }) => trpc.refundRequest.approve.mutate(input),
    onSuccess: (r) => {
      if (r.idempotent) {
        toast.success(`${r.request.requestNo} 此前已批准（幂等重入不重复执行）`)
      } else if (r.draft) {
        toast(`超审批阈值——已生成退款草稿单 ${r.refundNo}，须店主在收银台办理`)
      } else if (r.refundNo) {
        toast.success(`已批准 ${r.request.requestNo} · 退款单 ${r.refundNo} 已生成（按 R12 既有链路原路退回）`)
      } else {
        toast.success(`已批准 ${r.request.requestNo}（商城售后 · 线下原路退回）`)
      }
      setApproveReqTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const rejectReqM = useMutation({
    mutationFn: (input: { requestId: string; reason: string }) => trpc.refundRequest.reject.mutate(input),
    onSuccess: (r) => {
      toast.success(
        r.idempotent
          ? `${r.request.requestNo} 此前已驳回（幂等重入）`
          : `已驳回 ${r.request.requestNo}（驳回留痕，客户可见原因）`,
      )
      setRejectReqTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  /** 导出 CSV（仅店主）：query 端点直调 + Blob 浏览器下载（同日结导出工艺） */
  const doExport = async () => {
    setExporting(true)
    try {
      const r = await trpc.refund.exportCsv.query({ month: exportMonth })
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

  /* ---------------- 闸门 ---------------- */
  if (!canManage) {
    // clerk 直达双保险（路由层 ClerkRouteGuard 已拦截，本闸兜底非 403 白屏）
    return (
      <RoleGuidePage
        title={cc('cashier.refundsGuideTitle')}
        hint={cc('cashier.refundsGuideHint')}
      />
    )
  }

  const rows = listQ.data ?? []
  const pendings = pendingQ.data ?? []
  const requests = requestQ.data ?? []

  return (
    <MainScaffold
      testid="cashier-refunds-page"
      title={cc('cashier.refundsTitle')}
      sub={cc('cashier.refundsSub')}
      actions={
        <span className="flex items-center gap-2">
          {/* W-08 wtop+G2 发起：现状入口=收银流水单详情（不新造发起链路） */}
          <Link
            to="/cashier/records"
            data-testid="refunds-create-link"
            title={cc('cashier.refundsCreateHint')}
            className="u1-ring rounded-control bg-card px-4 py-3.5 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            {cc('cashier.refundsCreateLink')}
          </Link>
          {role.isOwner ? (
            <>
              <input
                type="month"
                data-testid="refunds-export-month"
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                className="u1-ring rounded-control bg-card px-3 py-2 font-number text-caption tabular-nums text-ink focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
              />
              <QuietButton testid="refunds-export-btn" disabled={exporting} onClick={() => void doExport()}>
                {exporting ? '导出中…' : '导出 CSV'}
              </QuietButton>
            </>
          ) : null}
        </span>
      }
    >
      {/* 超 24h 待办黄色提醒条（冻结版 §三：实退待办进店长提醒） */}
      {pendings.length > 0 ? (
        <div
          className="mb-3.5 rounded-[14px] bg-brand-primary-light px-[17px] py-3 text-caption text-ink"
          data-testid="refunds-pending-bar"
        >
          <b><span className="font-number tabular-nums">{pendings.length}</span> {cc('cashier.refundsPendingBold')}</b>
          <span className="ml-2 font-number tabular-nums text-[rgba(59,46,36,.62)]">
            {pendings
              .slice(0, 3)
              .map((p) => `${p.refundNo} ¥${fenToYuan(p.amountFen)}`)
              .join(' · ')}
            {pendings.length > 3 ? ` 等 ${pendings.length} 笔` : ''}
            {cc('cashier.refundsPendingTail')}
          </span>
        </div>
      ) : null}

      {/* 客户退款申请待办（批次 C5 审批缝：无待办不渲染区块；批准/驳回双钮 h≥44） */}
      {requests.length > 0 ? (
        <div className="u3-panel mb-3.5" data-testid="refund-requests-block">
          <div className="u3-panel-head">
            <h3>{cc('cashier.refundRequestTitle')}</h3>
            <span className="aside">
              <span className="font-number tabular-nums">{requests.length}</span> 笔
            </span>
          </div>
          {requests.map((r) => (
            <div
              key={r.id}
              data-testid={`refund-request-row-${r.requestNo}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-number text-caption font-semibold tabular-nums">{r.requestNo}</span>
                  <span className="u3-st wait">
                    {r.type === 'return_refund'
                      ? cc('cashier.refundRequestTypeReturnRefund')
                      : cc('cashier.refundRequestTypeRefundOnly')}
                  </span>
                  {r.slaOverdue ? (
                    <span className="u3-st red">{cc('cashier.refundRequestSlaOverdue')}</span>
                  ) : null}
                </div>
                <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.62)]">
                  {r.customerNickname ?? '—'}
                  {' · 原单 '}
                  <span className="font-number tabular-nums">{r.billNo}</span>
                  {' · '}
                  {r.reasonLabel}
                </div>
                {r.description ? (
                  <div className="mt-0.5 max-w-[420px] truncate text-caption-xs text-[rgba(59,46,36,.42)]" title={r.description}>
                    {r.description}
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="u1-num font-bold text-danger-deep">−¥{fenToYuan(r.amountFen)}</div>
                <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {fmtDateTime(r.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SheetBtn
                  variant="primary"
                  className="min-h-[44px]"
                  data-testid={`refund-request-approve-${r.requestNo}`}
                  onClick={() => setApproveReqTarget(r)}
                >
                  {cc('cashier.refundRequestApproveCta')}
                </SheetBtn>
                <SheetBtn
                  variant="danger-outline"
                  className="min-h-[44px]"
                  data-testid={`refund-request-reject-${r.requestNo}`}
                  onClick={() => setRejectReqTarget(r)}
                >
                  {cc('cashier.refundRequestRejectCta')}
                </SheetBtn>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* 状态过滤 chips */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            data-testid={`refunds-st-${c.key}`}
            className={`u3-chipf ${status === c.key ? 'on' : ''}`}
            onClick={() => setStatus(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="u3-panel">
        {listQ.isPending ? (
          /* 加载中骨架块（animate-pulse，禁转圈）：shared Skeleton 组合 */
          <div className="space-y-2 px-[17px] py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : listQ.isError ? (
          <div className="px-[17px] py-10 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">退款单加载失败：{errMsg(listQ.error)}</p>
            <div className="mt-4">
              <QuietButton testid="refunds-retry" onClick={() => void listQ.refetch()}>
                重新加载
              </QuietButton>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-[17px] py-10 text-center text-body-sm text-[rgba(59,46,36,.62)]">
            {cc('cashier.refundsEmpty')}
          </p>
        ) : (
          /* 390 降级：横滑容器（u3-noscrollx），表本体保底宽 */
          <div className="u3-noscrollx overflow-x-auto">
            <table className="u3-tbl min-w-[960px]">
              <thead>
                <tr>
                  <th>退款单号</th>
                  <th>原单号</th>
                  <th>类型</th>
                  <th className="!text-right">金额</th>
                  <th>原因</th>
                  <th>发起</th>
                  <th>审批</th>
                  <th>实退标记</th>
                  <th>时间</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const chip = settleChip(r)
                  return (
                    <tr
                      key={r.id}
                      className="rowlink"
                      data-testid={`refunds-row-${r.refundNo}`}
                      onClick={() => setDetailRow(r)}
                    >
                      <td className="font-number font-semibold tabular-nums">{r.refundNo}</td>
                      <td className="font-number tabular-nums text-[rgba(59,46,36,.62)]">{r.billNo}</td>
                      <td>{REFUND_TYPE_LABEL[r.type as RefundType] ?? r.type}</td>
                      <td className="u1-num text-right font-bold text-danger-deep">
                        −¥{fenToYuan(r.amountFen)}
                      </td>
                      <td className="max-w-[180px] truncate text-[rgba(59,46,36,.62)]" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="text-[rgba(59,46,36,.62)]">{r.operatorName ?? '—'}</td>
                      <td className="text-[rgba(59,46,36,.62)]">{r.approverName ?? '—'}</td>
                      <td>
                        <span className={chip.cls}>{chip.label}</span>
                        {r.refundMethod ? (
                          <span className="block text-caption-xs text-[rgba(59,46,36,.42)]">
                            {REFUND_METHOD_LABEL[r.refundMethod] ?? r.refundMethod}
                          </span>
                        ) : null}
                        {/* W-08：executed 行「不可撤销」明面注（纠错=再开正单） */}
                        {r.status === 'executed' ? (
                          <span className="block text-caption-xs text-[rgba(59,46,36,.42)]">
                            {cc('cashier.refundExecutedNote')}
                          </span>
                        ) : null}
                      </td>
                      <td className="u1-num">{fmtDateTime(r.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex items-center gap-2.5">
                          {/* 实退登记：executed 行（店长本店可办；备注必填） */}
                          {r.status === 'executed' ? (
                            <button
                              type="button"
                              data-testid={`refunds-settle-${r.refundNo}`}
                              title="实退登记（线下原路退回后登记；备注必填留痕）"
                              onClick={() => setSettleTarget(r)}
                              className="text-caption-xs font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.92]"
                            >
                              实退登记
                            </button>
                          ) : null}
                          {/* 驳回：draft 行（店长本店+店主全域——矩阵 V1.3 驳回权放开店长；
                              备注必填；OP-01③ 店员无入口） */}
                          {r.status === 'draft' && role.canManage ? (
                            <button
                              type="button"
                              data-testid={`refunds-reject-${r.refundNo}`}
                              title="驳回退款申请（店长本店/店主全域；驳回留痕可查）"
                              onClick={() => setRejectTarget(r)}
                              className="text-caption-xs font-bold text-danger transition-transform duration-120 ease-philia-spring active:scale-[0.92]"
                            >
                              驳回
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

      {/* W-08 驳回权口径卡（wtip：draft gold 审批位 / executed 不可撤销 / 涉储值只读须店主） */}
      <div className="u3-panel mt-3.5" data-testid="refund-policy-card">
        <div className="u3-panel-head">
          <h3>{cc('cashier.refundPolicyTitle')}</h3>
        </div>
        <ul className="space-y-1.5 px-[17px] pb-4 text-caption-xs leading-relaxed text-[rgba(59,46,36,.62)]">
          <li>· {cc('cashier.refundPolicyReject')}</li>
          <li>· {cc('cashier.refundSvNotice')}</li>
          <li>· {cc('cashier.refundExecuteNote')}</li>
        </ul>
      </div>

      {/* 详情（六联动快照） */}
      <RefundDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />

      {/* 实退登记弹层（备注必填） */}
      <RefundNoteDialog
        row={settleTarget}
        mode="settle"
        pending={settleM.isPending}
        onConfirm={(note) => {
          if (!settleTarget) return
          settleM.mutate({ refundId: settleTarget.id, note })
        }}
        onClose={() => setSettleTarget(null)}
      />
      {/* 驳回弹层（店主/店长本店，备注必填） */}
      <RefundNoteDialog
        row={rejectTarget}
        mode="reject"
        pending={rejectM.isPending}
        onConfirm={(note) => {
          if (!rejectTarget) return
          rejectM.mutate({ refundId: rejectTarget.id, note })
        }}
        onClose={() => setRejectTarget(null)}
      />

      {/* 客户退款申请：批准二次确认（金额/原单/类型复述 + R15 明面句） */}
      <CashierModal
        open={approveReqTarget !== null}
        onClose={() => setApproveReqTarget(null)}
        title={cc('cashier.refundRequestApproveConfirmTitle')}
        testid="refund-request-approve-dialog"
        footer={
          <>
            <SheetBtn className="min-h-[44px]" onClick={() => setApproveReqTarget(null)}>
              取消
            </SheetBtn>
            <SheetBtn
              variant="primary"
              className="min-h-[44px]"
              data-testid="refund-request-approve-confirm"
              disabled={approveReqM.isPending}
              onClick={() => {
                if (!approveReqTarget) return
                approveReqM.mutate({ requestId: approveReqTarget.id })
              }}
            >
              {approveReqM.isPending ? '提交中…' : cc('cashier.refundRequestApproveCta')}
            </SheetBtn>
          </>
        }
      >
        {approveReqTarget ? (
          <>
            <div className="rounded-[14px] bg-[#FAF8F2] px-3.5 py-3">
              <div className="font-number text-caption font-semibold tabular-nums">
                {approveReqTarget.requestNo}
              </div>
              <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.62)]">
                原单 <span className="font-number tabular-nums">{approveReqTarget.billNo}</span>
                {' · '}
                {approveReqTarget.type === 'return_refund'
                  ? cc('cashier.refundRequestTypeReturnRefund')
                  : cc('cashier.refundRequestTypeRefundOnly')}
                {' · '}
                {approveReqTarget.reasonLabel}
                {' · '}
                <b className="font-number tabular-nums text-danger-deep">
                  −¥{fenToYuan(approveReqTarget.amountFen)}
                </b>
              </div>
            </div>
            <p className="mt-3 text-caption-xs leading-relaxed text-[rgba(59,46,36,.42)]">
              {cc('cashier.refundRequestApproveConfirmBody')}
            </p>
          </>
        ) : null}
      </CashierModal>

      {/* 客户退款申请：驳回（原因必填，照既有 rejectDraft 交互同款） */}
      <RefundRequestRejectDialog
        row={rejectReqTarget}
        pending={rejectReqM.isPending}
        onConfirm={(reason) => {
          if (!rejectReqTarget) return
          rejectReqM.mutate({ requestId: rejectReqTarget.id, reason })
        }}
        onClose={() => setRejectReqTarget(null)}
      />
    </MainScaffold>
  )
}

/* ------------------------------------------------------------------ */
/* 实退登记 / 驳回 备注弹层（备注必填留痕）                                  */
/* ------------------------------------------------------------------ */

function RefundNoteDialog({
  row,
  mode,
  pending,
  onConfirm,
  onClose,
}: {
  row: RefundListRow | null
  /** settle=实退登记（executed→settled）；reject=店主驳回（draft→rejected） */
  mode: 'settle' | 'reject'
  pending: boolean
  onConfirm: (note: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [lastId, setLastId] = useState<string | null>(null)
  if (row && row.id !== lastId) {
    setLastId(row.id)
    setNote('')
  }
  if (!row && lastId !== null) setLastId(null)
  if (!row) return null

  const isSettle = mode === 'settle'
  const valid = note.trim().length > 0

  return (
    <CashierModal
      open={row !== null}
      onClose={onClose}
      title={isSettle ? '实退登记' : '驳回退款申请'}
      testid={isSettle ? 'refund-settle-dialog' : 'refund-reject-dialog'}
      footer={
        <>
          <SheetBtn className="min-h-[44px]" onClick={onClose}>
            取消
          </SheetBtn>
          <SheetBtn
            variant={isSettle ? 'primary' : 'danger-outline'}
            className="min-h-[44px]"
            data-testid={isSettle ? 'refund-settle-confirm' : 'refund-reject-confirm'}
            disabled={!valid || pending}
            onClick={() => onConfirm(note.trim())}
          >
            {pending ? '提交中…' : isSettle ? '登记实退完成' : '确认驳回'}
          </SheetBtn>
        </>
      }
    >
      <div className="rounded-[14px] bg-[#FAF8F2] px-3.5 py-3">
        <div className="font-number text-caption font-semibold tabular-nums">{row.refundNo}</div>
        <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.62)]">
          原单 <span className="font-number tabular-nums">{row.billNo}</span>
          {' · '}
          {REFUND_TYPE_LABEL[row.type as RefundType] ?? row.type}
          {' · '}
          <b className="font-number tabular-nums text-danger-deep">−¥{fenToYuan(row.amountFen)}</b>
        </div>
      </div>
      <textarea
        className="mt-3 min-h-[76px] w-full resize-none rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
        data-testid={isSettle ? 'refund-settle-note' : 'refund-reject-note'}
        placeholder={isSettle ? '实退备注（必填，如：已微信原路退回）' : '驳回原因（必填，留痕）'}
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="mt-1.5 text-caption-xs leading-relaxed text-[rgba(59,46,36,.42)]">
        {isSettle
          ? cc('cashier.refundSettleNote')
          : cc('cashier.refundRejectNote')}
      </p>
      {!valid ? (
        <p className="mt-2 text-caption-xs font-semibold text-danger-deep">
          {isSettle ? '实退登记须填备注' : '驳回须填原因'}
        </p>
      ) : null}
    </CashierModal>
  )
}

/* ------------------------------------------------------------------ */
/* 客户退款申请 · 驳回弹层（原因必填留痕，照上方 RefundNoteDialog reject 同款） */
/* ------------------------------------------------------------------ */

function RefundRequestRejectDialog({
  row,
  pending,
  onConfirm,
  onClose,
}: {
  row: RefundRequestPendingRow | null
  pending: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [lastId, setLastId] = useState<string | null>(null)
  if (row && row.id !== lastId) {
    setLastId(row.id)
    setReason('')
  }
  if (!row && lastId !== null) setLastId(null)
  if (!row) return null

  const valid = reason.trim().length > 0

  return (
    <CashierModal
      open={row !== null}
      onClose={onClose}
      title={cc('cashier.refundRequestRejectTitle')}
      testid="refund-request-reject-dialog"
      footer={
        <>
          <SheetBtn className="min-h-[44px]" onClick={onClose}>
            取消
          </SheetBtn>
          <SheetBtn
            variant="danger-outline"
            className="min-h-[44px]"
            data-testid="refund-request-reject-confirm"
            disabled={!valid || pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? '提交中…' : '确认驳回'}
          </SheetBtn>
        </>
      }
    >
      <div className="rounded-[14px] bg-[#FAF8F2] px-3.5 py-3">
        <div className="font-number text-caption font-semibold tabular-nums">{row.requestNo}</div>
        <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.62)]">
          原单 <span className="font-number tabular-nums">{row.billNo}</span>
          {' · '}
          {row.type === 'return_refund'
            ? cc('cashier.refundRequestTypeReturnRefund')
            : cc('cashier.refundRequestTypeRefundOnly')}
          {' · '}
          <b className="font-number tabular-nums text-danger-deep">−¥{fenToYuan(row.amountFen)}</b>
        </div>
      </div>
      <textarea
        className="mt-3 min-h-[76px] w-full resize-none rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
        data-testid="refund-request-reject-reason"
        placeholder="驳回原因（必填，留痕；客户侧申请单可见）"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <p className="mt-1.5 text-caption-xs leading-relaxed text-[rgba(59,46,36,.42)]">
        {cc('cashier.refundRequestRejectNote')}
      </p>
      {!valid ? (
        <p className="mt-2 text-caption-xs font-semibold text-danger-deep">驳回须填原因</p>
      ) : null}
    </CashierModal>
  )
}
