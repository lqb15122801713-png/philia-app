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
 * - SSE：cashier.shift 系 / dayClose 系 / billSettled / billReversed → 全量对齐；
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
  DayCloseDetailDialog,
  DayCloseForm,
  DayCloseList,
  ShiftCard,
} from '@/components/cashier/DayClosePanels'
import ImportLedgerPanel from '@/components/cashier/ImportLedgerPanel'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import { STATS_QUERY_KEY } from '@/components/dashboard/utils'
import MainScaffold from '@/components/MainScaffold'
import { errMsg } from '@/components/mall-admin/format'
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

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_KEY })
    void queryClient.invalidateQueries({ queryKey: DAY_CLOSES_KEY })
    void queryClient.invalidateQueries({ queryKey: TODAY_TENDER_KEY })
    void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: FINANCE_ROOT })
  }, [queryClient])

  // SSE：班次/日结/收银事件 → 全量对齐；重连兜底
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
  const closeShiftM = useMutation({
    mutationFn: () => trpc.cashier.closeShift.mutate(),
    onSuccess: () => {
      setConfirmCloseShift(false)
      toast.success('已交接班（闭班）—— 下一笔收银将自动开新班；账目冻结请走日结')
      invalidateAll()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const dayCloseM = useMutation({
    mutationFn: (input: { actualCashFen: number; note?: string }) =>
      trpc.cashier.dayClose.mutate({
        ...(overrideShiftId ? { shiftId: overrideShiftId } : {}),
        actualCashFen: input.actualCashFen,
        note: input.note,
      }),
    onSuccess: (r) => {
      const c = r.close
      toast.success(
        `日结单已冻结（${c.bizDate}）：账面 ¥${((c.bookCashFen ?? 0) / 100).toFixed(2)} · 实点 ¥${((c.actualCashFen ?? 0) / 100).toFixed(2)} · 差异 ${(c.diffFen ?? 0) === 0 ? '¥0' : `${(c.diffFen ?? 0) > 0 ? '+' : '−'}¥${(Math.abs(c.diffFen ?? 0) / 100).toFixed(2)}`}`,
      )
      setOverrideShiftId(null)
      invalidateAll()
    },
    onError: (e) => toast.error(errMsg(e)),
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
      title="日结 / 交接班"
      sub="交接班=闭班不冻结 · 日结=冻结当班账目 · 反结账（拆箱）仅店主"
    >
      <div className="flex flex-col gap-3.5">
        {/* 当前班次卡 + 交接班 */}
        <ShiftCard
          shift={shiftQ.data?.shift}
          todayCashierCount={tender?.counts.cashierPaidCount ?? null}
          closing={closeShiftM.isPending}
          onCloseShift={() => setConfirmCloseShift(true)}
        />

        {/* 日结表单（账面 vs 实点 · 差异红字 · 分列） */}
        <DayCloseForm
          tender={tender}
          shift={shiftQ.data?.shift}
          overrideShiftId={overrideShiftId}
          submitting={dayCloseM.isPending}
          onSubmit={(actualCashFen, note) => dayCloseM.mutate({ actualCashFen, note })}
          onCancelOverride={() => setOverrideShiftId(null)}
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

      {/* 交接班确认 */}
      {confirmCloseShift ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          data-testid="close-shift-confirm"
        >
          <div className="absolute inset-0 bg-[rgba(74,59,46,.28)]" onClick={() => setConfirmCloseShift(false)} aria-hidden />
          <div className="relative w-full max-w-[380px] rounded-[20px] bg-[#FFFDF6] p-5 shadow-[0_8px_40px_rgba(74,59,46,.18)]">
            <h3 className="text-title font-semibold">交接班确认</h3>
            <p className="mt-2 text-caption leading-relaxed text-[rgba(74,59,46,.62)]">
              交接班=关闭当前班次（不冻结账目）；下一笔收银将自动开新班。
              如需冻结当班账目，请用「日结」。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCloseShift(false)}
                className="rounded-full bg-[#FFFDF6] px-4 py-2.5 text-caption text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)]"
              >
                取消
              </button>
              <button
                type="button"
                data-testid="close-shift-confirm-ok"
                disabled={closeShiftM.isPending}
                onClick={() => closeShiftM.mutate()}
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
