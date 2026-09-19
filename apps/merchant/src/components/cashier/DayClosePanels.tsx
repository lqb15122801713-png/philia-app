/**
 * 日结/交接班页面板组（批次 M1-补2 C · /cashier/close · u3 工艺件拼装，UI 不评审）
 *
 * 契约（server cashier.ts R3 系列）：
 * - 当前班次卡：cashier.currentShift（骨架无金额，clerk 可调——本页 clerk 无入口，
 *   路由层引导）；「交接班」=closeShift（owner|manager，闭班不冻结账目，下一笔
 *   收银写懒建新班）；
 * - 日结表单：账面现金预览=store.todayTenderStats 同源（R1 出口，今日现金支付段 Σ；
 *   冻结值以当班口径为准——server computeShiftTender，单班场景两者一致）vs
 *   实点现金手输，差异=实点−账面（非零红字）；微信/支付宝/次卡等值/储值分列
 *   （参考列：次卡/储值不计入已收——裁定①）；提交=cashier.dayClose 冻结；
 * - 拆箱重结：reversed 日结单的班次可「重新日结」（dayClose 指定 shiftId，
 *   服务端 frozen 守卫放行）；
 * - 日结单列表=listDayCloses（close/reversal 双向可查：reversal 行关联原单，
 *   原单 reversed 挂 reversalId）；详情=字段行 + 冲正前后值快照 + 调整记录；
 * - 反结账（拆箱）=reverseDayClose（仅 owner · 强制原因弹层）；
 *   导出 CSV=exportDayCloseCsv（仅 owner · Blob 浏览器下载）；
 *   调整备注=adjustDayClose（owner|manager · 只增不改）。
 */

import { useState } from 'react'
import { BookCheck, Download, LogOut, PencilLine, RotateCcw } from 'lucide-react'
import {
  type DayCloseRow,
  type ShiftInfo,
  type TodayTenderStats,
} from './model'
import { fenToYuan, yuanToFen, fmtDateTime } from '@/components/mall-admin/format'
import { CashierModal, SheetBtn } from './dialogs'

/** 日结单金额列 null 防御（schema 可空列；展示口径 null=0） */
const fz = (v: number | null): number => v ?? 0
/* 当前班次卡 + 交接班                                                     */
/* ------------------------------------------------------------------ */

export function ShiftCard({
  shift,
  todayCashierCount,
  closing,
  onCloseShift,
}: {
  shift: ShiftInfo | null | undefined
  /** 今日收银单数（todayTenderStats.counts.cashierPaidCount，全日口径标注） */
  todayCashierCount: number | null
  closing: boolean
  onCloseShift: () => void
}) {
  return (
    <div className="u3-panel" data-testid="close-shift-card">
      <div className="u3-panel-head">
        <h3>当前班次</h3>
        <span className="aside">交接班不冻结账目 · 日结才冻结</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-[17px] pb-4">
        {shift === undefined ? (
          <span className="text-caption text-[rgba(74,59,46,.42)]">加载中…</span>
        ) : shift === null ? (
          <span className="text-caption text-[rgba(74,59,46,.62)]" data-testid="close-shift-none">
            当前无开班班次 —— 首笔收银将自动开班（懒建）
          </span>
        ) : (
          <>
            <span className="u3-st live">开班中</span>
            <span className="text-caption text-[rgba(74,59,46,.62)]">
              开班 <b className="font-number tabular-nums text-ink">{fmtDateTime(shift.openedAt)}</b>
            </span>
            <span className="text-caption-xs text-[rgba(74,59,46,.42)]">
              今日收银单数（全日口径）：
              <b className="font-number tabular-nums text-ink">{todayCashierCount ?? '…'}</b>
              {' '}· 冻结口径以日结单为准
            </span>
            <button
              type="button"
              data-testid="close-shift-btn"
              disabled={closing}
              onClick={onCloseShift}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#FFFDF6] px-4 py-2 text-caption font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
            >
              <LogOut size={13} strokeWidth={1.8} aria-hidden />
              {closing ? '交接中…' : '交接班（闭班）'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 日结表单（账面 vs 实点 · 差异红字 · 分列）                                  */
/* ------------------------------------------------------------------ */

export function DayCloseForm({
  tender,
  shift,
  overrideShiftId,
  submitting,
  onSubmit,
  onCancelOverride,
}: {
  /** R1 同源出口（restricted=false；本页 owner|manager 恒可见金额） */
  tender: Extract<TodayTenderStats, { restricted: false }> | undefined
  shift: ShiftInfo | null | undefined
  /** 拆箱重结模式：指定班次 id（原日结单已 reversed） */
  overrideShiftId: string | null
  submitting: boolean
  onSubmit: (actualCashFen: number, note: string | undefined) => void
  onCancelOverride: () => void
}) {
  const [actualInput, setActualInput] = useState('')
  const [note, setNote] = useState('')
  const book = tender?.tender.cashFen ?? null
  const actualFen = yuanToFen(actualInput)
  const diff = book !== null && actualFen !== null ? actualFen - book : null
  const canSubmit =
    !submitting && actualFen !== null && (shift != null || overrideShiftId !== null)

  return (
    <div className="u3-panel" data-testid="dayclose-form">
      <div className="u3-panel-head">
        <h3>{overrideShiftId ? '重新日结（拆箱后同班次）' : '日结（冻结当班账目）'}</h3>
        <span className="aside">账面=同源今日现金支付段 Σ · 冻结以当班口径为准</span>
      </div>
      <div className="px-[17px] pb-4">
        {overrideShiftId ? (
          <p className="mb-2.5 flex items-center gap-2 rounded-[10px] bg-[#F1E8D4] px-3 py-2 text-caption-xs text-[rgba(74,59,46,.62)]">
            对拆箱班次 <b className="font-number tabular-nums">{overrideShiftId.slice(-6)}</b> 重新日结
            <button type="button" className="ml-auto font-semibold text-ink" onClick={onCancelOverride}>
              取消
            </button>
          </p>
        ) : null}

        <div className="u3-kv !px-0">
          <div className="cell">
            <div className="cap">账面现金（同源）</div>
            <div className="v" data-testid="dayclose-book">
              {book !== null ? `¥${fenToYuan(book)}` : '…'}
            </div>
          </div>
          <div className="cell">
            <div className="cap">实点现金（手输）</div>
            <div className="mt-1">
              <input
                data-testid="dayclose-actual-input"
                inputMode="decimal"
                placeholder="0.00"
                value={actualInput}
                onChange={(e) => setActualInput(e.target.value)}
                className="w-full rounded-[8px] bg-[#FFFDF6] px-2.5 py-1.5 font-number text-[17px] font-bold tabular-nums text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)]"
              />
            </div>
          </div>
        </div>

        {/* 差异（非零红字） */}
        <div className="mt-2 flex items-baseline justify-between rounded-[10px] bg-[#F6F1E3] px-3 py-2">
          <span className="text-caption text-[rgba(74,59,46,.62)]">差异（实点 − 账面）</span>
          <b
            className={`font-number text-[17px] font-bold tabular-nums ${diff !== null && diff !== 0 ? 'text-danger-deep' : 'text-ink'}`}
            data-testid="dayclose-diff"
          >
            {diff === null ? '—' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}¥${fenToYuan(Math.abs(diff))}`}
          </b>
        </div>

        {/* 微信/支付宝/次卡等值/储值分列（参考列口径小字——裁定①） */}
        <p className="mt-2 text-caption-xs leading-relaxed text-[rgba(74,59,46,.42)]" data-testid="dayclose-split">
          微信 <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{tender ? fenToYuan(tender.tender.wechatFen) : '…'}</b>
          {' · 支付宝 '}
          <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{tender ? fenToYuan(tender.tender.alipayFen) : '…'}</b>
          {' ｜ 参考（不计入已收）：次卡等值 '}
          <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{tender ? fenToYuan(tender.tender.passFen) : '…'}</b>
          {' · 储值消费 '}
          <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{tender ? fenToYuan(tender.tender.storedValueFen) : '…'}</b>
        </p>

        <input
          data-testid="dayclose-note"
          placeholder="备注（选填，随日结单冻结留痕）"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2.5 w-full rounded-[10px] bg-[#FFFDF6] px-3 py-2 text-caption text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)]"
        />
        <button
          type="button"
          data-testid="dayclose-submit"
          disabled={!canSubmit}
          onClick={() => {
            if (actualFen === null) return
            onSubmit(actualFen, note.trim() || undefined)
            setActualInput('')
            setNote('')
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-brand-primary py-3 text-body-sm font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <BookCheck size={15} strokeWidth={2} aria-hidden />
          {submitting ? '冻结中…' : overrideShiftId ? '重新日结并冻结' : '日结并冻结当班账目'}
        </button>
        {shift == null && overrideShiftId === null ? (
          <p className="mt-1.5 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
            当前无开班班次，无可日结的当班账目
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 日结单列表                                                              */
/* ------------------------------------------------------------------ */

export function DayCloseList({
  rows,
  loading,
  isOwner,
  onDetail,
  onReverse,
  onAdjust,
  onExport,
  onReclose,
  exportingId,
}: {
  rows: DayCloseRow[] | undefined
  loading: boolean
  isOwner: boolean
  onDetail: (row: DayCloseRow) => void
  /** 反结账（拆箱）——仅 owner */
  onReverse: (row: DayCloseRow) => void
  /** 调整备注（owner|manager · 只增不改） */
  onAdjust: (row: DayCloseRow) => void
  /** 导出 CSV——仅 owner */
  onExport: (row: DayCloseRow) => void
  /** 拆箱后对同班次重新日结 */
  onReclose: (row: DayCloseRow) => void
  exportingId: string | null
}) {
  return (
    <div className="u3-panel" data-testid="dayclose-list">
      <div className="u3-panel-head">
        <h3>日结留痕</h3>
        <span className="aside">冲正单与原单双向可查 · 原单永存不涂改</span>
      </div>
      {loading ? (
        <div className="space-y-2 px-[17px] pb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
          ))}
        </div>
      ) : (rows ?? []).length === 0 ? (
        <p className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-10 text-center text-body-sm text-[rgba(74,59,46,.62)]">
          暂无日结单 —— 上方表单完成首次日结
        </p>
      ) : (
        <div className="u3-noscrollx overflow-x-auto">
          <table className="u3-tbl min-w-[860px]">
            <thead>
              <tr>
                <th>营业日</th>
                <th>类型</th>
                <th className="!text-right">账面现金</th>
                <th className="!text-right">实点现金</th>
                <th className="!text-right">差异</th>
                <th>笔数</th>
                <th>状态</th>
                <th>确认人</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const isReversalRow = r.kind === 'reversal'
                const reversed = r.status === 'reversed'
                return (
                  <tr
                    key={r.id}
                    className="rowlink"
                    data-testid={`dayclose-row-${r.id}`}
                    onClick={() => onDetail(r)}
                  >
                    <td className="u1-num font-semibold">{r.bizDate}</td>
                    <td className="text-[rgba(74,59,46,.62)]">
                      {isReversalRow ? (
                        <>
                          冲正单
                          <span className="block text-caption-xs font-number tabular-nums">
                            关联原单 {r.refCloseId?.slice(-6) ?? '—'}
                          </span>
                        </>
                      ) : (
                        <>
                          日结
                          <span className="block text-caption-xs font-number tabular-nums">
                            班次 {r.shiftId.slice(-6)}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="u1-num text-right">¥{fenToYuan(fz(r.bookCashFen))}</td>
                    <td className="u1-num text-right">¥{fenToYuan(fz(r.actualCashFen))}</td>
                    {/* 差异红字（修订单 R3②） */}
                    <td className={`u1-num text-right font-bold ${fz(r.diffFen) !== 0 ? 'text-danger-deep' : ''}`}>
                      {fz(r.diffFen) === 0 ? '¥0' : `${fz(r.diffFen) > 0 ? '+' : '−'}¥${fenToYuan(Math.abs(fz(r.diffFen)))}`}
                    </td>
                    <td className="u1-num">{fz(r.paidCount)}</td>
                    <td>
                      {isReversalRow ? (
                        <span className="u3-st done">冲正单</span>
                      ) : reversed ? (
                        <span className="u3-st done">已冲正</span>
                      ) : (
                        <span className="u3-st live">冻结生效</span>
                      )}
                    </td>
                    <td className="text-[rgba(74,59,46,.62)]">{r.createdByName ?? '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-2.5">
                        {/* 拆箱重结：reversed 的原单（close）可对同班次重新日结 */}
                        {!isReversalRow && reversed ? (
                          <button
                            type="button"
                            data-testid={`dayclose-reclose-${r.id}`}
                            title="对该班次重新日结"
                            onClick={() => onReclose(r)}
                            className="inline-flex items-center gap-1 text-caption-xs font-bold text-ink transition-transform duration-120 active:scale-[0.92]"
                          >
                            <RotateCcw size={12} strokeWidth={2} aria-hidden />
                            重新日结
                          </button>
                        ) : null}
                        {!isReversalRow ? (
                          <button
                            type="button"
                            data-testid={`dayclose-adjust-${r.id}`}
                            title="调整备注（只增不改，留痕）"
                            onClick={() => onAdjust(r)}
                            className="inline-flex items-center gap-1 text-caption-xs font-bold text-ink transition-transform duration-120 active:scale-[0.92]"
                          >
                            <PencilLine size={12} strokeWidth={2} aria-hidden />
                            调整备注
                          </button>
                        ) : null}
                        {/* 导出 CSV / 反结账：仅 owner（矩阵总规则③ + 裁定④） */}
                        {isOwner && !isReversalRow ? (
                          <button
                            type="button"
                            data-testid={`dayclose-export-${r.id}`}
                            disabled={exportingId === r.id}
                            title="导出 CSV（仅店主）"
                            onClick={() => onExport(r)}
                            className="inline-flex items-center gap-1 text-caption-xs font-bold text-ink transition-transform duration-120 active:scale-[0.92] disabled:opacity-50"
                          >
                            <Download size={12} strokeWidth={2} aria-hidden />
                            {exportingId === r.id ? '导出中…' : '导出'}
                          </button>
                        ) : null}
                        {isOwner && !isReversalRow && !reversed ? (
                          <button
                            type="button"
                            data-testid={`dayclose-reverse-${r.id}`}
                            title="反结账（拆箱，仅店主 · 强制原因）"
                            onClick={() => onReverse(r)}
                            className="inline-flex items-center gap-1 text-caption-xs font-bold text-danger transition-transform duration-120 active:scale-[0.92]"
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
  )
}

/* ------------------------------------------------------------------ */
/* 日结单详情弹层（前后值快照 + 调整记录）                                      */
/* ------------------------------------------------------------------ */

interface CloseSnapshot {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  operatorId?: string
  at?: string
  reason?: string
}

export function DayCloseDetailDialog({
  row,
  onClose,
}: {
  row: DayCloseRow | null
  onClose: () => void
}) {
  if (!row) return null
  const isReversalRow = row.kind === 'reversal'
  const snapshot: CloseSnapshot | null = row.snapshotJson
    ? (JSON.parse(row.snapshotJson) as CloseSnapshot)
    : null
  const adjustments: Array<{ at: string; by: string; note: string }> = row.adjustmentsJson
    ? (JSON.parse(row.adjustmentsJson) as Array<{ at: string; by: string; note: string }>)
    : []

  return (
    <CashierModal
      open={row !== null}
      onClose={onClose}
      title={isReversalRow ? '冲正单详情' : '日结单详情'}
      testid="dayclose-detail"
      footer={<SheetBtn onClick={onClose}>关闭</SheetBtn>}
    >
      <div>
        <div className="u3-field"><span className="lb">日结单号</span><span className="vl font-number tabular-nums">{row.id}</span></div>
        <div className="u3-field"><span className="lb">营业日</span><span className="vl font-number tabular-nums">{row.bizDate}</span></div>
        <div className="u3-field"><span className="lb">班次</span><span className="vl font-number tabular-nums">{row.shiftId}</span></div>
        {isReversalRow ? (
          <div className="u3-field"><span className="lb">关联原单</span><span className="vl font-number tabular-nums">{row.refCloseId ?? '—'}</span></div>
        ) : row.reversalId ? (
          <div className="u3-field"><span className="lb">冲正单</span><span className="vl font-number tabular-nums">{row.reversalId}</span></div>
        ) : null}
        <div className="u3-field"><span className="lb">状态</span><span className="vl">
          {isReversalRow ? <span className="u3-st done">冲正单</span> : row.status === 'reversed' ? <span className="u3-st done">已冲正</span> : <span className="u3-st live">冻结生效</span>}
        </span></div>
        <div className="u3-field"><span className="lb">账面现金</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.bookCashFen))}</span></div>
        <div className="u3-field"><span className="lb">实点现金</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.actualCashFen))}</span></div>
        <div className="u3-field"><span className="lb">差异</span><span className={`vl font-number tabular-nums ${fz(row.diffFen) !== 0 ? 'font-bold text-danger-deep' : ''}`}>
          {fz(row.diffFen) === 0 ? '¥0' : `${fz(row.diffFen) > 0 ? '+' : '−'}¥${fenToYuan(Math.abs(fz(row.diffFen)))}`}
        </span></div>
        <div className="u3-field"><span className="lb">微信</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.wechatFen))}</span></div>
        <div className="u3-field"><span className="lb">支付宝</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.alipayFen))}</span></div>
        <div className="u3-field"><span className="lb">次卡等值（参考）</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.passFen))}</span></div>
        <div className="u3-field"><span className="lb">储值消费（参考）</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.storedValueFen))}</span></div>
        <div className="u3-field"><span className="lb">收银单数 / 合并笔数</span><span className="vl font-number tabular-nums">{fz(row.cashierPaidCount)} / {fz(row.paidCount)}</span></div>
        <div className="u3-field"><span className="lb">确认人</span><span className="vl">{row.createdByName ?? row.createdBy}</span></div>
        <div className="u3-field"><span className="lb">确认时间</span><span className="vl font-number tabular-nums">{fmtDateTime(row.createdAt)}</span></div>
        {row.reason ? (
          <div className="u3-field"><span className="lb">{isReversalRow ? '冲正原因' : '备注'}</span><span className="vl">{row.reason}</span></div>
        ) : null}
        {row.reversedAt ? (
          <div className="u3-field"><span className="lb">反结账时间</span><span className="vl font-number tabular-nums">{fmtDateTime(row.reversedAt)}</span></div>
        ) : null}

        {/* 冲正前后值快照（裁定④：含操作人/时间/原因/前后值） */}
        {snapshot ? (
          <div className="mt-3">
            <div className="mb-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">前后值快照</div>
            <div className="rounded-[10px] bg-[#F6F1E3] px-3 py-2 font-number text-caption-xs tabular-nums text-[rgba(74,59,46,.62)]">
              <div>冲正前状态：{(snapshot.before?.status as string) ?? '—'} · 账面 ¥{fenToYuan(fz((snapshot.before?.bookCashFen as number | null) ?? null))} · 实点 ¥{fenToYuan(fz((snapshot.before?.actualCashFen as number | null) ?? null))}</div>
              <div className="mt-1">冲正后：{(snapshot.after?.note as string) ?? (snapshot.after?.status as string) ?? '—'}</div>
              <div className="mt-1">操作人 {snapshot.operatorId ?? '—'} · {snapshot.at ? fmtDateTime(new Date(snapshot.at)) : '—'}</div>
            </div>
          </div>
        ) : null}

        {/* 调整记录（adjustDayClose 只增不改） */}
        {adjustments.length > 0 ? (
          <div className="mt-3">
            <div className="mb-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">调整记录（{adjustments.length}）</div>
            {adjustments.map((a, i) => (
              <div key={i} className="rounded-[10px] bg-[#F6F1E3] px-3 py-2 text-caption-xs text-[rgba(74,59,46,.62)] [&+&]:mt-1.5">
                <span className="font-number tabular-nums">{fmtDateTime(new Date(a.at))}</span> · {a.note}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </CashierModal>
  )
}

/* ------------------------------------------------------------------ */
/* 原因弹层（反结账强制原因 / 调整备注）                                       */
/* ------------------------------------------------------------------ */

export function CloseReasonDialog({
  target,
  mode,
  pending,
  onConfirm,
  onClose,
}: {
  target: DayCloseRow | null
  /** reverse=反结账（强制原因）；adjust=调整备注（必填，只增不改） */
  mode: 'reverse' | 'adjust'
  pending: boolean
  onConfirm: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [lastId, setLastId] = useState<string | null>(null)
  if (target && target.id !== lastId) {
    setLastId(target.id)
    setText('')
  }
  if (!target && lastId !== null) setLastId(null)
  if (!target) return null

  const valid = text.trim().length > 0
  const isReverse = mode === 'reverse'

  return (
    <CashierModal
      open={target !== null}
      onClose={onClose}
      title={isReverse ? '反结账（拆箱）' : '调整备注'}
      testid={isReverse ? 'dayclose-reverse-dialog' : 'dayclose-adjust-dialog'}
      footer={
        <>
          <SheetBtn onClick={onClose}>取消</SheetBtn>
          <SheetBtn
            variant={isReverse ? 'danger-outline' : 'primary'}
            data-testid="dayclose-reason-confirm"
            disabled={!valid || pending}
            onClick={() => onConfirm(text.trim())}
          >
            {pending ? '提交中…' : isReverse ? '确认拆箱冲正' : '追加备注'}
          </SheetBtn>
        </>
      }
    >
      <div className="rounded-[14px] bg-[#F6F1E3] px-3.5 py-3">
        <div className="font-number text-caption font-semibold tabular-nums">
          {target.bizDate} · 班次 {target.shiftId.slice(-6)}
        </div>
        <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
          账面 ¥{fenToYuan(fz(target.bookCashFen))} · 实点 ¥{fenToYuan(fz(target.actualCashFen))} · 差异{' '}
          {fz(target.diffFen) === 0 ? '¥0' : `${fz(target.diffFen) > 0 ? '+' : '−'}¥${fenToYuan(Math.abs(fz(target.diffFen)))}`}
        </div>
      </div>
      <textarea
        className="mt-3 min-h-[76px] w-full resize-none rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)]"
        data-testid="dayclose-reason-input"
        placeholder={isReverse ? '冲正原因（必填，留痕）' : '调整备注（必填；只增不改，原冻结数字不涂改）'}
        maxLength={200}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="mt-1.5 text-caption-xs leading-relaxed text-[rgba(74,59,46,.42)]">
        {isReverse
          ? '拆箱将生成冲正关联单（含前后值快照/操作人/时间/原因），原日结单永存不涂改（置「已冲正」）；之后可对同班次重新日结。'
          : '备注追加进调整记录留痕，原冻结数字不涂改。'}
      </p>
      {!valid ? (
        <p className="mt-2 text-caption-xs font-semibold text-danger-deep">
          {isReverse ? '反结账必须填写原因' : '调整备注不能为空'}
        </p>
      ) : null}
    </CashierModal>
  )
}
