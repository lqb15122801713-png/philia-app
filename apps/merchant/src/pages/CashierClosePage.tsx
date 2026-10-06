/**
 * 日结 / 交接班 /cashier/close（批次 M1-补2 C · R3 + 补丁① · 自装页，UI 不评审）
 *
 * 角色：owner|manager（clerk 无入口——墨轨隐藏 + 直达路由由 App.tsx
 * ClerkRouteGuard 给引导页「日结由店长/店主处理」）。
 * 反结账（拆箱）/导出 CSV/储值台账导入 仅 owner（裁定④ + 矩阵总规则③）；
 * 调整备注 owner|manager（只增不改）。
 *
 * 数据：
 * - currentShift（班次骨架无金额）/ todayTenderStats（R1 同源出口，账面预览）/
 *   listDayCloses（日结单+冲正关联单双向可查）；
 * - 动作：closeShift（交接班）/ dayClose（冻结）/ reverseDayClose（拆箱 · owner）/
 *   adjustDayClose（备注）/ exportDayCloseCsv（Blob 下载 · owner）；
 * - R12：当日退款单列面板（RefundDayPanel · refund.dayStats）——笔数+金额+
 *   支付段退款分列+现金段净额（V2：现金已收−现金退款，前端做差；历史封箱不回填只读）；
 * - SSE：cashier.shift 系 / dayClose 系 / billSettled / billReversed /
 *   refund.executed / refund.settled / refund.rejected → 全量对齐；
 * - R5b：页面底部 owner-only 储值台账导入卡（ImportLedgerPanel，只交付不执行，
 *   演示台账试导可标记清除）。
 */

import { EventType, usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CURRENT_SHIFT_KEY,
  DAY_CLOSES_KEY,
  TODAY_TENDER_KEY,
  type DayCloseRow,
} from '@/components/cashier/model'
import {
  CloseReasonDialog,
  CashMovePanel,
  DayCloseDetailDialog,
  DayCloseForm,
  DayCloseList,
  RefundDayPanel,
  ShiftCard,
  TenderSplitPanel,
} from '@/components/cashier/DayClosePanels'
import ImportLedgerPanel from '@/components/cashier/ImportLedgerPanel'
import { REFUND_DAY_STATS_KEY, storeTodayStr } from '@/components/cashier/refund'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import { STATS_QUERY_KEY } from '@/components/dashboard/utils'
import MainScaffold from '@/components/MainScaffold'
import { cc } from '@/copy/cashier'
import { errMsg, yuanToFen } from '@/components/mall-admin/format'
import type { StaffRow } from '@/components/staff-admin/types'
import { useMerchantRole } from '@/lib/roles'

const FINANCE_ROOT = ['store', 'financeStats'] as const

export default function CashierClosePage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()
  const role = useMerchantRole()

  /* ---------------- 查询 ---------------- */
  const shiftQ = useQuery({
    queryKey: CURRENT_SHIFT_KEY,
    queryFn: () => trpc.cashier.currentShift.query(),
  })
  const tenderQ = useQuery({
    queryKey: TODAY_TENDER_KEY,
    queryFn: () => trpc.store.todayTenderStats.query(),
  })
  const closesQ = useQuery({
    queryKey: DAY_CLOSES_KEY,
    queryFn: () => trpc.cashier.listDayCloses.query({ limit: 50 }),
  })
  // R12：当日退款单列（refund.dayStats，biz_date=执行日口径；只出退款侧分列，不改既有日结函数）
  const refundDayQ = useQuery({
    queryKey: [...REFUND_DAY_STATS_KEY, storeTodayStr()],
    queryFn: () => trpc.refund.dayStats.query({ date: storeTodayStr() }),
  })
  // 片 3 B6-3：交接班「接棒人」下拉候选（在职员工；toUserId=users.id）
  const staffQ = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
  })

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_KEY })
    void queryClient.invalidateQueries({ queryKey: DAY_CLOSES_KEY })
    void queryClient.invalidateQueries({ queryKey: TODAY_TENDER_KEY })
    void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: FINANCE_ROOT })
    void queryClient.invalidateQueries({ queryKey: REFUND_DAY_STATS_KEY })
  }, [queryClient])

  // SSE：班次/日结/收银/R12 退款事件 → 全量对齐；重连兜底
  useEffect(
    () =>
      events.onEvent((envelope) => {
        switch (envelope.type) {
          case EventType.CashierShiftOpened:
          case EventType.CashierShiftClosed:
          case EventType.CashierDayClosed:
          case EventType.CashierDayCloseReversed:
          case EventType.CashierBillSettled:
          case EventType.CashierBillReversed:
          case EventType.RefundExecuted:
          case EventType.RefundSettled:
          case EventType.RefundRejected:
            invalidateAll()
            break
          default:
            break
        }
      }),
    [events, invalidateAll],
  )
  useEffect(() => events.onReconnect(invalidateAll), [events, invalidateAll])

  /* ---------------- 弹层/表单状态 ---------------- */
  const [detailRow, setDetailRow] = useState<DayCloseRow | null>(null)
  const [reasonTarget, setReasonTarget] = useState<{ row: DayCloseRow; mode: 'reverse' | 'adjust' } | null>(null)
  const [overrideShiftId, setOverrideShiftId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [confirmCloseShift, setConfirmCloseShift] = useState(false)
  /* 片 3 B6-3：交接班四节表单（在洗清单=server 自动快照只读注记，三区注记+接棒人手填） */
  const [hvKeys, setHvKeys] = useState('')
  const [hvCash, setHvCash] = useState('')
  const [hvComplaints, setHvComplaints] = useState('')
  const [hvToUserId, setHvToUserId] = useState('')
  /* 片 3：备用金点交（元输入→分提交，默认 ¥500 端口留口） */
  const [hvFloat, setHvFloat] = useState('500')
  /* 片 3：盲交开关 + 日结提交错误原文（400 差异说明聚焦保留输入）+ 成功清零信号 */
  const [blind, setBlind] = useState(false)
  const [dayCloseError, setDayCloseError] = useState<string | null>(null)
  const [dayCloseClear, setDayCloseClear] = useState(0)

  const openCloseShift = () => {
    setHvKeys('')
    setHvCash('')
    setHvComplaints('')
    setHvToUserId('')
    setHvFloat('500')
    setConfirmCloseShift(true)
  }

  const submitCloseShift = () => {
    const floatFen = yuanToFen(hvFloat)
    const handover = {
      ...(hvKeys.trim() ? { keysNote: hvKeys.trim() } : {}),
      ...(hvCash.trim() ? { cashNote: hvCash.trim() } : {}),
      ...(hvComplaints.trim() ? { complaintsNote: hvComplaints.trim() } : {}),
      ...(hvToUserId ? { toUserId: hvToUserId } : {}),
      /* 备用金点交：合法金额才带（非法输入静默不带=未点交，server 可空口径） */
      ...(floatFen !== null && floatFen >= 0 ? { floatFen } : {}),
    }
    closeShiftM.mutate(Object.keys(handover).length > 0 ? handover : undefined)
  }

  /* ?reclose=<shiftId> 深链（列表「重新日结」同页内直填，预留外部跳转） */
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const sid = searchParams.get('reclose')
    if (sid) {
      setOverrideShiftId(sid)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  /* ---------------- 动作 ---------------- */
  /* 片 3 B6-3+交接班族：closeShift 入参加可选 handover（钥匙/现金/客诉注记+接棒人+
     备用金点交 floatFen；server 类型已落地，直连不再经 taskCollabPort 桥） */
  const closeShiftM = useMutation({
    mutationFn: (handover?: {
      keysNote?: string
      cashNote?: string
      complaintsNote?: string
      toUserId?: string
      floatFen?: number
    }) => trpc.cashier.closeShift.mutate(handover ? { handover } : undefined),
    onSuccess: () => {
      setConfirmCloseShift(false)
      toast.success('已交接班（闭班）—— 下一笔收银将自动开新班；账目冻结请走日结')
      invalidateAll()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  /* 片 3：dayClose 入参扩 actualWechatFen/actualAlipayFen/diffNote（实点非现金对账+
     长短款差异说明）；400 含「须填差异说明」→ 错误原文下传表单聚焦（输入保留），
     成功才递增清零信号 */
  const dayCloseM = useMutation({
    mutationFn: (input: {
      actualCashFen: number
      actualWechatFen?: number
      actualAlipayFen?: number
      diffNote?: string
      note?: string
    }) =>
      trpc.cashier.dayClose.mutate({
        ...(overrideShiftId ? { shiftId: overrideShiftId } : {}),
        actualCashFen: input.actualCashFen,
        ...(input.actualWechatFen !== undefined ? { actualWechatFen: input.actualWechatFen } : {}),
        ...(input.actualAlipayFen !== undefined ? { actualAlipayFen: input.actualAlipayFen } : {}),
        ...(input.diffNote ? { diffNote: input.diffNote } : {}),
        ...(input.note ? { note: input.note } : {}),
      }),
    onSuccess: (r) => {
      setDayCloseError(null)
      setDayCloseClear((n) => n + 1)
      const c = r.close
      toast.success(
        `日结单已冻结（${c.bizDate}）：账面 ¥${((c.bookCashFen ?? 0) / 100).toFixed(2)} · 实点 ¥${((c.actualCashFen ?? 0) / 100).toFixed(2)} · 差异 ${(c.diffFen ?? 0) === 0 ? '¥0' : `${(c.diffFen ?? 0) > 0 ? '+' : '−'}¥${(Math.abs(c.diffFen ?? 0) / 100).toFixed(2)}`}`,
      )
      setOverrideShiftId(null)
      invalidateAll()
    },
    onError: (e) => {
      const msg = errMsg(e)
      setDayCloseError(msg)
      toast.error(msg)
    },
  })

  const reverseM = useMutation({
    mutationFn: (input: { closeId: string; reason: string }) => trpc.cashier.reverseDayClose.mutate(input),
    onSuccess: (r) => {
      toast.success(
        r.idempotent
          ? '该日结单此前已拆箱冲正'
          : `已拆箱冲正（冲正单 ${r.reversal?.id.slice(-6) ?? '—'} 已关联）—— 可对同班次重新日结`,
      )
      setReasonTarget(null)
      invalidateAll()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const adjustM = useMutation({
    mutationFn: (input: { closeId: string; note: string }) => trpc.cashier.adjustDayClose.mutate(input),
    onSuccess: () => {
      toast.success('调整备注已追加（只增不改，留痕可查）')
      setReasonTarget(null)
      invalidateAll()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  /** 导出 CSV（仅 owner）：query 端点直调 + Blob 浏览器下载 */
  const doExport = async (row: DayCloseRow) => {
    setExportingId(row.id)
    try {
      const r = await trpc.cashier.exportDayCloseCsv.query({ closeId: row.id })
      const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = r.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`已导出 ${r.filename}`)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setExportingId(null)
    }
  }

  const tender = tenderQ.data && !tenderQ.data.restricted ? tenderQ.data : undefined

  return (
    <MainScaffold
      testid="cashier-close-page"
      title={cc('cashier.closeTitle')}
      sub={cc('cashier.closeSub')}
    >
      <div className="flex flex-col gap-3.5">
        {/* 当前班次卡 + 交接班 */}
        <ShiftCard
          shift={shiftQ.data?.shift}
          todayCashierCount={tender?.counts.cashierPaidCount ?? null}
          closing={closeShiftM.isPending}
          onCloseShift={openCloseShift}
        />

        {/* W-07 序位①：M5 四分列（现金/微信/支付宝/储值 · R1 同源出口前置） */}
        <TenderSplitPanel tender={tender} />

        {/* 日结表单（账面 vs 实点 · 差异红字 · 分列；片 3：盲交/实点非现金/差异说明） */}
        <DayCloseForm
          tender={tender}
          shift={shiftQ.data?.shift}
          overrideShiftId={overrideShiftId}
          submitting={dayCloseM.isPending}
          submitError={dayCloseError}
          clearSignal={dayCloseClear}
          blind={blind}
          onBlindChange={setBlind}
          onSubmit={(input) => dayCloseM.mutate(input)}
          onCancelOverride={() => setOverrideShiftId(null)}
        />

        {/* 片 3 交接班族：现金收支录入（paid in/out）+ 本班流水 */}
        <CashMovePanel shift={shiftQ.data?.shift} />

        {/* R12：当日退款单列 + 现金段净额（V2：现金已收−现金退款，前端做差；
            历史日结封箱不回填只读） */}
        <RefundDayPanel
          stats={refundDayQ.data}
          loading={refundDayQ.isPending}
          cashReceivedFen={tender?.tender.cashFen ?? null}
        />

        {/* 日结单列表（双向可查） */}
        <DayCloseList
          rows={closesQ.data}
          loading={closesQ.isPending}
          isOwner={role.isOwner}
          exportingId={exportingId}
          onDetail={setDetailRow}
          onReverse={(row) => setReasonTarget({ row, mode: 'reverse' })}
          onAdjust={(row) => setReasonTarget({ row, mode: 'adjust' })}
          onExport={(row) => void doExport(row)}
          onReclose={(row) => {
            setOverrideShiftId(row.shiftId)
            toast(`已对班次 ${row.shiftId.slice(-6)} 进入重新日结（表单预填）`, { icon: 'ℹ️' })
          }}
        />

        {/* R5b 储值台账导入（仅店主） */}
        {role.isOwner ? <ImportLedgerPanel storeId={role.storeId} /> : null}
      </div>

      {/* 交接班确认（片 3 B6-3：四节结构化——在洗清单只读注记（server 自动快照）+
          钥匙/现金/客诉注记 + 接棒人下拉（可选）） */}
      {confirmCloseShift ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          data-testid="close-shift-confirm"
        >
          <div className="absolute inset-0 bg-[rgba(59,46,36,.28)]" onClick={() => setConfirmCloseShift(false)} aria-hidden />
          <div className="relative flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[20px] bg-[#FFFDF6] shadow-[0_8px_40px_rgba(59,46,36,.18)]">
            <div className="px-5 pt-5">
              <h3 className="text-title font-semibold">{cc('cashier.closeShiftConfirmTitle')}</h3>
              <p className="mt-2 text-caption leading-relaxed text-[rgba(59,46,36,.62)]">
                {cc('cashier.closeShiftConfirmBody')}
              </p>
            </div>
            <div className="overflow-y-auto px-5 py-3">
              <p className="mb-2 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">{cc('cashier.handoverTitle')}</p>

              {/* 在洗清单：只读快照透出（server 闭班时自动快照，本端不采） */}
              <div className="rounded-[10px] bg-[#FAF8F2] px-3 py-2">
                <span className="text-caption-xs font-semibold text-ink">{cc('cashier.handoverWashingLabel')}</span>
                <p className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">{cc('cashier.handoverWashingNote')}</p>
              </div>

              {([
                [cc('cashier.handoverKeysLabel'), cc('cashier.handoverKeysPh'), hvKeys, setHvKeys, 'handover-keys'],
                [cc('cashier.handoverCashLabel'), cc('cashier.handoverCashPh'), hvCash, setHvCash, 'handover-cash'],
                [cc('cashier.handoverComplaintsLabel'), cc('cashier.handoverComplaintsPh'), hvComplaints, setHvComplaints, 'handover-complaints'],
              ] as const).map(([label, ph, val, setVal, tid]) => (
                <label key={tid} className="mt-2.5 block">
                  <span className="mb-1 block text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">{label}</span>
                  <input
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder={ph}
                    maxLength={200}
                    data-testid={tid}
                    className="w-full rounded-[10px] bg-[#FFFDF6] px-3 py-2 text-caption text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
                  />
                </label>
              ))}

              <label className="mt-2.5 block">
                <span className="mb-1 block text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">
                  {cc('cashier.floatLabel')}
                  <span className="ml-1.5 font-normal text-[rgba(59,46,36,.42)]">{cc('cashier.floatNote')}</span>
                </span>
                <input
                  value={hvFloat}
                  onChange={(e) => setHvFloat(e.target.value)}
                  inputMode="decimal"
                  placeholder="500"
                  data-testid="handover-float"
                  className="w-full rounded-[10px] bg-[#FFFDF6] px-3 py-2 font-number text-caption font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
                />
              </label>

              <label className="mt-2.5 block">
                <span className="mb-1 block text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">{cc('cashier.handoverToLabel')}</span>
                <select
                  value={hvToUserId}
                  onChange={(e) => setHvToUserId(e.target.value)}
                  data-testid="handover-to-user"
                  className="w-full rounded-[10px] bg-[#FFFDF6] px-3 py-2 text-caption text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
                >
                  <option value="">{cc('cashier.handoverToPh')}</option>
                  {(((staffQ.data?.staff ?? []) as StaffRow[]).filter((s) => s.status === 'active')).map((s) => (
                    <option key={s.id} value={s.userId}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCloseShift(false)}
                className="rounded-full bg-[#FFFDF6] px-4 py-2.5 text-caption text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)]"
              >
                取消
              </button>
              <button
                type="button"
                data-testid="close-shift-confirm-ok"
                disabled={closeShiftM.isPending}
                onClick={submitCloseShift}
                className="rounded-full bg-brand-primary px-4 py-2.5 text-caption font-bold text-ink shadow-hairline disabled:opacity-50"
              >
                {closeShiftM.isPending ? '交接中…' : '确认交接班'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 详情 / 原因弹层 */}
      <DayCloseDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
      <CloseReasonDialog
        target={reasonTarget?.row ?? null}
        mode={reasonTarget?.mode ?? 'reverse'}
        pending={reverseM.isPending || adjustM.isPending}
        onConfirm={(text) => {
          if (!reasonTarget) return
          if (reasonTarget.mode === 'reverse') {
            reverseM.mutate({ closeId: reasonTarget.row.id, reason: text })
          } else {
            adjustM.mutate({ closeId: reasonTarget.row.id, note: text })
          }
        }}
        onClose={() => setReasonTarget(null)}
      />
    </MainScaffold>
  )
}
