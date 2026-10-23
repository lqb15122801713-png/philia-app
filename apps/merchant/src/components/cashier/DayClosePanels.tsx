/**
 * 日结/交接班页面板组（批次 M1-补2 C · /cashier/close · u3 工艺件拼装，UI 不评审）
 *
 * 契约（server cashier.ts R3 系列）：
 * - 当前班次卡：cashier.currentShift（骨架无金额，clerk 可调——本页 clerk 无入口，
 *   路由层引导）；「交接班」=closeShift（owner|manager，闭班不冻结账目，下一笔
 *   收银写懒建新班）；
 * - 日结表单：账面现金预览=store.todayTenderStats 同源（R1 出口，今日现金支付段 Σ，
 *   全日口径）vs 实点现金手输，差异=实点−账面（非零红字）；微信/支付宝/次卡等值/储值
 *   分列（参考列：次卡/储值不计入已收——裁定①）；提交=cashier.dayClose 冻结——
 *   **M1-补2 条件②：冻结=全日口径（server computeDayTender，与预览同源同值，
 *   一日一结）**，班次拆分展示保留（server snapshot.shiftBreakdown / 列表班次列）；
 * - 拆箱重结：reversed 日结单同日可「重新日结」（dayClose 兼容 shiftId 入参作追溯，
 *   服务端按 bizDate frozen 守卫放行）；
 * - 日结单列表=listDayCloses（close/reversal 双向可查：reversal 行关联原单，
 *   原单 reversed 挂 reversalId）；详情=字段行 + 冲正前后值快照 + 调整记录；
 * - 反结账（拆箱）=reverseDayClose（仅 owner · 强制原因弹层）；
 *   导出 CSV=exportDayCloseCsv（仅 owner · Blob 浏览器下载）；
 *   打印日结单=详情弹层「打印」钮（PD-84 放宽 owner|manager；window.print
 *   + @media print 内联隔离，屏外全隐仅日结单可见——照 ReceiptPage 先例）；
 *   调整备注=adjustDayClose（owner|manager · 只增不改）。
 * - PD-84 R18-01：日结提交必经独立确认 modal（DayCloseConfirmDialog，遮罩+
 *   确认/取消成对，Esc/取消=中止零提交，禁页内直闸、禁假 CLEARED）；
 *   PD-85 收口：modal 改页面树内联渲染（不走 portal 挂 body——根内扫描检测
 *   不可见 portal 会假阴性判页内闸），DOM 结构/工艺/行为不变；
 *   PD-86 收口：外层满屏层由 <div> 升原生 <dialog>（showModal() 顶层模态——
 *   浏览器真 dialog：top layer 渲染、背景 inert、Esc 原生 cancel、焦点圈禁；
 *   DOM 仍落 #root 内，`dialog[open]` 与 [role=dialog] 双域可检），挂载口径/
 *   遮罩/成对钮/三撤行为不变；
 * - PD-87：实点现金默认同步账面——账面预览就绪后 actualInput 未手输（null）
 *   时跟随账面现金元字符串（0→字面 '0'，非 0→fenToYuanInput），诚实
 *   「实点＝账面」日默认 canSubmit=true 可直点开闸；手输/清空后不冲；
 *   盲交遮罩期不透账面（不同步）。dialog 壳（PD-86 原生 dialog）不动；
 * PD-89：开闸就绪闸落在页面层（账面预览未就绪不挂本表单、骨架占位）——本组件契约
 *   不变：book=null 时实点空、canSubmit=false、钮 disabled 点击无副作用；就绪后首绘
 *   即 actualInput=null→实点默认同步账面→无 FILL 直点必出确认 dialog；abort 仅
 *   setPendingDayClose(null)，tender 缓存不回退，同页再点必重开；Esc 双路（原生
 *   cancel＋window keydown 兜底）与遮罩／取消主交互一行未动；
 */

import { useEffect, useRef, useState } from 'react'
import { Skeleton, useMe, usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { cc } from '@/copy/cashier'
import { BookCheck, Download, LogOut, PencilLine, RotateCcw, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  CASH_MOVE_LIST_KEY,
  DAY_CLOSE_PREVIEW_KEY,
  HANDOVER_OF_KEY,
  shiftCrossDays,
  type CashMoveRow,
  type DayCloseRow,
  type ShiftInfo,
  type TodayTenderStats,
} from './model'
import type { RefundDayStats } from './refund'
import { errMsg, fenToYuan, fenToYuanInput, yuanToFen, fmtDateTime } from '@/components/mall-admin/format'
import { AmortizationDayLine } from '../member/amortization'
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
  dayFrozen,
}: {
  shift: ShiftInfo | null | undefined
  /** 今日收银单数（todayTenderStats.counts.cashierPaidCount，全日口径标注） */
  todayCashierCount: number | null
  closing: boolean
  onCloseShift: () => void
  /** D-35（走查P2修复批）：今日已日结冻结=班次区明示徽（真冻结态=listDayCloses 当日 frozen 行驱动；
      与开班中并存=冻结后新开单进次日班次的 D-29 已裁口径，本件只补明示不动状态机） */
  dayFrozen: boolean
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const crossDays = shift ? shiftCrossDays(shift.openedAt, now) : 0

  return (
    <div className="u3-panel" data-testid="close-shift-card">
      <div className="u3-panel-head">
        <h3>当前班次</h3>
        <span className="aside">交接班不冻结账目 · 日结才冻结</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-[17px] pb-4">
        {shift === undefined ? (
          <span className="text-caption text-ink-placeholder">加载中…</span>
        ) : shift === null ? (
          <span className="text-caption text-ink-secondary" data-testid="close-shift-none">
            {cc('cashier.shiftEmpty')}
          </span>
        ) : (
          <>
            <span className="u3-st live">开班中</span>
            {/* D-35：已日结冻结=班次区明示徽（与「开班中」并存不互斥——班次开着、当日账已冻） */}
            {dayFrozen ? (
              <span className="u3-st" data-testid="close-shift-day-frozen">
                {cc('cashier.shiftFrozenBadge')}
              </span>
            ) : null}
            {crossDays > 0 ? (
              <span
                role="alert"
                data-testid="close-shift-cross-day"
                className="inline-flex items-center rounded-[8px] bg-danger-light px-2.5 py-1 text-caption-xs font-semibold text-danger-deep"
              >
                已跨 {crossDays} 日未交班 · 请店长确认，系统不自动日切
              </span>
            ) : null}
            <span className="text-caption text-ink-secondary">
              开班 <b className="font-number tabular-nums text-ink">{fmtDateTime(shift.openedAt)}</b>
            </span>
            {/* 片 3：开班备用金透出（端口默认额留口，NULL=未配置） */}
            {shift.openingFloatFen != null ? (
              <span className="text-caption-xs text-ink-placeholder" data-testid="close-shift-float">
                开班备用金 <b className="font-number tabular-nums text-ink">¥{fenToYuan(shift.openingFloatFen)}</b>
              </span>
            ) : null}
            <span className="text-caption-xs text-ink-placeholder">
              今日收银单数（全日口径）：
              <b className="font-number tabular-nums text-ink">{todayCashierCount ?? '…'}</b>
              {' '}· 冻结口径以日结单为准
            </span>
            <button
              type="button"
              data-testid="close-shift-btn"
              disabled={closing}
              onClick={onCloseShift}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-caption font-semibold text-ink shadow-[0_0_0_1px_rgba(44,40,34,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
            >
              <LogOut size={13} strokeWidth={1.8} aria-hidden />
              {closing ? '交接中…' : crossDays > 0 ? '店长确认交接班' : '交接班（闭班）'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* W-07 序位①：今日账面四分列（现金/微信/支付宝/储值 · todayTenderStats 同源）  */
/* ------------------------------------------------------------------ */

export function TenderSplitPanel({
  tender,
}: {
  /** R1 同源出口（restricted=false；本页 owner|manager 恒可见金额） */
  tender: Extract<TodayTenderStats, { restricted: false }> | undefined
}) {
  return (
    <div className="u3-panel" data-testid="tender-split-panel">
      <div className="u3-panel-head">
        <h3>{cc('cashier.tenderSplitTitle')}</h3>
        <span className="aside">{cc('cashier.tenderSplitAside')}</span>
      </div>
      <div className="u3-kv sm:grid-cols-4">
        <div className="cell">
          <div className="cap">现金</div>
          <div className="v" data-testid="tender-split-cash">
            {tender ? `¥${fenToYuan(tender.tender.cashFen)}` : '…'}
          </div>
        </div>
        <div className="cell">
          <div className="cap">微信</div>
          <div className="v" data-testid="tender-split-wechat">
            {tender ? `¥${fenToYuan(tender.tender.wechatFen)}` : '…'}
          </div>
        </div>
        <div className="cell">
          <div className="cap">支付宝</div>
          <div className="v" data-testid="tender-split-alipay">
            {tender ? `¥${fenToYuan(tender.tender.alipayFen)}` : '…'}
          </div>
        </div>
        <div className="cell">
          <div className="cap">储值（参考）</div>
          <div className="v text-ink-secondary" data-testid="tender-split-sv">
            {tender ? `¥${fenToYuan(tender.tender.storedValueFen)}` : '…'}
          </div>
        </div>
      </div>
      {/* 次卡等值参考行（原 DayCloseForm 分列行迁此——裁定①口径小字不动） */}
      <p className="px-[17px] pb-4 text-caption-xs leading-relaxed text-ink-placeholder" data-testid="dayclose-split">
        {cc('cashier.tenderSplitRef')}{' '}
        <b className="font-number tabular-nums text-ink-secondary">¥{tender ? fenToYuan(tender.tender.passFen) : '…'}</b>
        {' ｜ 参考列（次卡/储值）永不计入已收'}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 日结表单（账面 vs 实点 · 差异红字 · 分列）                                  */
/* ------------------------------------------------------------------ */

/** 日结提交入参（DayCloseForm → 页面；PD-84：先入独立确认 modal，确认才真提交） */
export interface DayCloseSubmitInput {
  actualCashFen: number
  actualWechatFen?: number
  actualAlipayFen?: number
  diffNote?: string
  note?: string
}

export function DayCloseForm({
  tender,
  shift,
  overrideShiftId,
  submitting,
  submitError,
  clearSignal,
  blind,
  onBlindChange,
  onSubmit,
  onCancelOverride,
}: {
  /** R1 同源出口（restricted=false；本页 owner|manager 恒可见金额） */
  tender: Extract<TodayTenderStats, { restricted: false }> | undefined
  shift: ShiftInfo | null | undefined
  /** 拆箱重结模式：指定班次 id（原日结单已 reversed） */
  overrideShiftId: string | null
  submitting: boolean
  /** 最近一次提交错误原文（400 含「须填差异说明」时聚焦差异说明输入，输入保留） */
  submitError: string | null
  /** 提交成功信号（递增即清空表单输入） */
  clearSignal: number
  /** 片 3 盲交开关：开=dayClosePreview({blind:true}) 不透账面，实点先行，差异提交后揭晓 */
  blind: boolean
  onBlindChange: (on: boolean) => void
  /** PD-84 R18-01：点击「日结」不直接提交——上抛入参由页面开独立确认 modal */
  onSubmit: (input: DayCloseSubmitInput) => void
  onCancelOverride: () => void
}) {
  const { trpc } = usePhiliaClient()
  /* PD-87：null=未手输——实点跟随账面默认（账面就绪后默认同步）；手输/清空后为串，同步不再冲 */
  const [actualInput, setActualInput] = useState<string | null>(null)
  const [actualWechatInput, setActualWechatInput] = useState('')
  const [actualAlipayInput, setActualAlipayInput] = useState('')
  const [diffNote, setDiffNote] = useState('')
  const [note, setNote] = useState('')
  const diffNoteRef = useRef<HTMLInputElement>(null)
  const book = tender?.tender.cashFen ?? null
  /* PD-87：实点默认同步账面现金（诚实「实点＝账面」日默认 canSubmit=true；placeholder「0.00」
     不再伪装已填）——未手输时输入框直显账面元串（账面 0→字面 '0'，非 0→fenToYuanInput）；
     盲交遮罩期不透账面（显示空，实点先行手输）；手输/清空/成功清零后保持用户值不被冲 */
  const actualShown = actualInput ?? (blind || book === null ? '' : book === 0 ? '0' : fenToYuanInput(book))
  const actualFen = yuanToFen(actualShown)
  const actualWechatFen = yuanToFen(actualWechatInput)
  const actualAlipayFen = yuanToFen(actualAlipayInput)
  const diff = !blind && book !== null && actualFen !== null ? actualFen - book : null
  const canSubmit = !submitting && actualFen !== null // 条件②：全日口径，不依赖当班
  /** server 400 原文含「须填差异说明」→ 聚焦差异说明输入（输入保留） */
  const diffNoteRequired = submitError !== null && submitError.includes('须填差异说明')

  /* 盲交：server blind 口径真接线（stats=null 不透账面；本查询即遮罩凭据） */
  useQuery({
    queryKey: [...DAY_CLOSE_PREVIEW_KEY, 'blind'],
    queryFn: () => trpc.cashier.dayClosePreview.query({ blind: true }),
    enabled: blind,
  })

  /* 提交成功（clearSignal 递增）才清空输入；失败（含 400 差异说明）全量保留 */
  useEffect(() => {
    if (clearSignal === 0) return
    setActualInput('')
    setActualWechatInput('')
    setActualAlipayInput('')
    setDiffNote('')
    setNote('')
  }, [clearSignal])

  useEffect(() => {
    if (diffNoteRequired) diffNoteRef.current?.focus()
  }, [diffNoteRequired])

  return (
    <div className="u3-panel" data-testid="dayclose-form">
      <div className="u3-panel-head">
        <h3>{overrideShiftId ? '重新日结（拆箱后同日）' : '日结（冻结全日账目）'}</h3>
        <span className="aside">账面=今日收款同源预览 · 冻结与预览同值 · 一日一结</span>
        {/* 片 3 盲交开关（实点先行，账面遮罩） */}
        <button
          type="button"
          role="switch"
          aria-checked={blind}
          data-testid="dayclose-blind-toggle"
          onClick={() => onBlindChange(!blind)}
          className={`ml-auto rounded-full px-3 py-1 text-caption-xs font-semibold transition-colors ${
            blind ? 'bg-ink text-brand-cta-on' : 'bg-card text-ink-secondary shadow-[0_0_0_1px_rgba(44,40,34,.12)]'
          }`}
        >
          {cc('cashier.blindClose')}
          {blind ? ' · 开' : ' · 关'}
        </button>
      </div>
      <div className="px-[17px] pb-4">
        {overrideShiftId ? (
          <p className="mb-2.5 flex items-center gap-2 rounded-[10px] bg-sunken px-3 py-2 text-caption-xs text-ink-secondary">
            拆箱后重新日结（全日口径；追溯班次 <b className="font-number tabular-nums">{overrideShiftId.slice(-6)}</b>）
            <button type="button" className="ml-auto font-semibold text-ink" onClick={onCancelOverride}>
              取消
            </button>
          </p>
        ) : null}
        {blind ? (
          <p className="mb-2.5 rounded-[10px] bg-sunken px-3 py-2 text-caption-xs text-ink-secondary" data-testid="dayclose-blind-note">
            {cc('cashier.blindCloseNote')}
          </p>
        ) : null}

        <div className="u3-kv !px-0">
          <div className="cell">
            <div className="cap">账面现金（同源）</div>
            <div className="v" data-testid="dayclose-book">
              {blind ? '已遮罩' : book !== null ? `¥${fenToYuan(book)}` : '…'}
            </div>
          </div>
          <div className="cell">
            <div className="cap">实点现金（手输）</div>
            <div className="mt-1">
              <input
                data-testid="dayclose-actual-input"
                inputMode="decimal"
                placeholder="0.00"
                value={actualShown}
                onChange={(e) => setActualInput(e.target.value)}
                className="w-full rounded-[8px] bg-card px-2.5 py-1.5 font-number text-[17px] font-bold tabular-nums text-ink shadow-[0_0_0_1px_rgba(44,40,34,.12)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(44,40,34,.3)]"
              />
            </div>
          </div>
        </div>

        {/* 片 3：实点非现金两输入（与账面微信/支付宝分列对账；随 dayClose 提交） */}
        <div className="u3-kv !px-0 mt-2 sm:grid-cols-2">
          <div className="cell">
            <div className="cap">实点微信（手输，选填）</div>
            <div className="mt-1">
              <input
                data-testid="dayclose-actual-wechat-input"
                inputMode="decimal"
                placeholder="未点"
                value={actualWechatInput}
                onChange={(e) => setActualWechatInput(e.target.value)}
                className="w-full rounded-[8px] bg-card px-2.5 py-1.5 font-number text-caption font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(44,40,34,.12)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(44,40,34,.3)]"
              />
            </div>
          </div>
          <div className="cell">
            <div className="cap">实点支付宝（手输，选填）</div>
            <div className="mt-1">
              <input
                data-testid="dayclose-actual-alipay-input"
                inputMode="decimal"
                placeholder="未点"
                value={actualAlipayInput}
                onChange={(e) => setActualAlipayInput(e.target.value)}
                className="w-full rounded-[8px] bg-card px-2.5 py-1.5 font-number text-caption font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(44,40,34,.12)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(44,40,34,.3)]"
              />
            </div>
          </div>
        </div>

        {/* 差异（非零红字；盲交=提交后揭晓） */}
        <div className="mt-2 flex items-baseline justify-between rounded-[10px] bg-canvas px-3 py-2">
          <span className="text-caption text-ink-secondary">差异（实点 − 账面）</span>
          <b
            className={`font-number text-[17px] font-bold tabular-nums ${diff !== null && diff !== 0 ? 'text-danger-deep' : 'text-ink'}`}
            data-testid="dayclose-diff"
          >
            {blind ? '提交后揭晓' : diff === null ? '—' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}¥${fenToYuan(Math.abs(diff))}`}
          </b>
        </div>

        {/* 片 3：差异说明（|实点−账面| 超阈值 server 400 必填；失败聚焦保留输入） */}
        <input
          ref={diffNoteRef}
          data-testid="dayclose-diff-note"
          placeholder={cc('cashier.diffNotePh')}
          maxLength={200}
          value={diffNote}
          onChange={(e) => setDiffNote(e.target.value)}
          className={`mt-2.5 w-full rounded-[10px] bg-card px-3 py-2 text-caption text-ink placeholder:text-[rgba(44,40,34,.3)] focus:outline-none ${
            diffNoteRequired
              ? 'shadow-[0_0_0_1.5px_#B4502E] focus:shadow-[0_0_0_1.5px_#B4502E]'
              : 'shadow-[0_0_0_1px_rgba(44,40,34,.12)] focus:shadow-[0_0_0_1px_rgba(44,40,34,.3)]'
          }`}
        />
        {diffNoteRequired ? (
          <p className="mt-1.5 text-caption-xs font-semibold text-danger-deep" data-testid="dayclose-diff-note-required">
            {cc('cashier.diffNoteRequired')}
          </p>
        ) : null}

        {/* QA40-D1（PD-03 件 2）：年费分摊双口径参考行——参考口径，不入任何合计 */}
        <AmortizationDayLine />

        <input
          data-testid="dayclose-note"
          placeholder="备注（选填，随日结单冻结留痕）"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2.5 w-full rounded-[10px] bg-card px-3 py-2 text-caption text-ink shadow-[0_0_0_1px_rgba(44,40,34,.12)] placeholder:text-[rgba(44,40,34,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(44,40,34,.3)]"
        />
        <button
          type="button"
          data-testid="dayclose-submit"
          disabled={!canSubmit}
          onClick={() => {
            if (actualFen === null) return
            onSubmit({
              actualCashFen: actualFen,
              ...(actualWechatFen !== null ? { actualWechatFen } : {}),
              ...(actualAlipayFen !== null ? { actualAlipayFen } : {}),
              ...(diffNote.trim() ? { diffNote: diffNote.trim() } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            })
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-brand-primary py-3 text-body-sm font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <BookCheck size={15} strokeWidth={2} aria-hidden />
          {submitting ? '冻结中…' : overrideShiftId ? '重新日结并冻结' : '日结并冻结全日账目'}
        </button>
        {shift == null && overrideShiftId === null ? (
          <p className="mt-1.5 text-center text-caption-xs text-ink-placeholder">
            {cc('cashier.dayCloseFullNote')}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* PD-84 R18-01：日结独立确认 modal（遮罩＋确认/取消成对；Esc/遮罩/取消=中止零提交）  */
/* PD-85 R18-01 收口：改页面树内联渲染（不走 portal），检测零盲区，行为不变     */
/* PD-86 R18-01 真收口：满屏层升原生 <dialog> showModal 顶层模态——真独立 dialog  */
/* ------------------------------------------------------------------ */

/**
 * 点「日结并冻结」先出本弹层（居中卡 + 墨 28% 遮罩 + Esc 关，同工 CashierModal）：
 * - 摘要透出 账面/实点/差异（盲交=账面遮罩、差异提交后揭晓，与表单同口径）；
 * - 「取消」/Esc/点遮罩=中止，不触 dayClose；「确认日结并冻结」才真提交冻结；
 * - 禁假 CLEARED：成功 toast 仍只由 dayClose 真返回驱动（页面既有逻辑不动）。
 *
 * PD-85 R18-01 收口：modal 改**页面树内联渲染**（不走 createPortal 挂 body）——
 * PD-84 复测按应用根内扫描时 portal 内容不可见（dialogCount=0／overlayInfo=[]／
 * hasCancel=false 假阴性，被判页内闸）。
 *
 * PD-86 R18-01 真收口：外层满屏层由 <div> 升**原生 <dialog> 元素**（showModal()
 * 顶层模态）——浏览器平台真 dialog：top layer 渲染（免疫祖先叠放/溢出裁剪）、
 * 背景 inert（非模态区不可点不可焦）、Esc 走原生 cancel 事件、关后焦点自动归还。
 * DOM 结构/挂载口径（#root 内联、非 portal 直连 body）/遮罩/成对钮/testid 全保
 * PD-85 不变：`dialog[open]` 与 [role=dialog]（document 与 #root 两域）均可检，
 * dialogCount≥1；Esc 另保 window keydown 兜底（合成事件路）；点遮罩=遮罩 div
 * onClick（可信/合成两路均可）。禁页内闸假弹——满屏遮罩顶层模态，非表单流内联件。
 */
export function DayCloseConfirmDialog({
  input,
  book,
  blind,
  overrideShiftId,
  pending,
  onConfirm,
  onClose,
}: {
  /** 待确认提交入参（null=不开） */
  input: DayCloseSubmitInput | null
  /** 账面现金（分，todayTenderStats 同源；null=未加载/遮罩） */
  book: number | null
  blind: boolean
  overrideShiftId: string | null
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const layerRef = useRef<HTMLDialogElement | null>(null)

  /* PD-86：原生 <dialog> showModal() 顶层模态——input 就绪且层已挂载时开；
     关=React 状态归 null 直接卸载（onCancel preventDefault 后同走此路，无双开缝） */
  useEffect(() => {
    const el = layerRef.current
    if (!input || !el || el.open) return
    try {
      el.showModal()
    } catch {
      /* 已开/瞬时未挂载防御（正常路径不可达） */
    }
  }, [input])

  /* Esc=中止双路：原生 cancel 事件（可信键路，onCancel preventDefault 改走 React
     状态关）＋ window keydown 兜底（合成事件路）；hooks 序先于 null 早退 */
  useEffect(() => {
    if (!input) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [input, onClose])

  if (!input) return null
  const diff = !blind && book !== null ? input.actualCashFen - book : null
  return (
    <dialog
      ref={layerRef}
      data-testid="dayclose-confirm-layer"
      aria-label={cc('cashier.dayCloseConfirmTitle')}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClose={() => onClose()}
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center overflow-visible border-0 bg-transparent p-4 backdrop:bg-transparent"
    >
      <div
        className="absolute inset-0 bg-[rgba(44,40,34,.28)]"
        onClick={onClose}
        aria-hidden
        data-testid="dayclose-confirm-overlay"
      />
      <div
        role="dialog"
        aria-modal="true"
        data-testid="dayclose-confirm-dialog"
        className="relative flex max-h-[85vh] w-full max-w-[420px] flex-col overflow-hidden rounded-[20px] bg-card shadow-[0_8px_40px_rgba(44,40,34,.18)]"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="text-title font-semibold">{cc('cashier.dayCloseConfirmTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1 text-ink-placeholder transition-colors hover:bg-[rgba(44,40,34,.06)]"
          >
            <X size={18} strokeWidth={1.6} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-2">
          <p className="text-caption leading-relaxed text-ink-secondary">
            {cc('cashier.dayCloseConfirmBody')}
          </p>
          <div className="mt-3 rounded-[14px] bg-canvas px-3.5 py-3 font-number text-caption tabular-nums">
            <div className="flex items-center justify-between">
              <span className="font-sans text-ink-secondary">账面现金（同源）</span>
              <b data-testid="dayclose-confirm-book">
                {blind ? '已遮罩（盲交）' : book !== null ? `¥${fenToYuan(book)}` : '…'}
              </b>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="font-sans text-ink-secondary">实点现金</span>
              <b data-testid="dayclose-confirm-actual">¥{fenToYuan(input.actualCashFen)}</b>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="font-sans text-ink-secondary">差异（实点 − 账面）</span>
              <b
                className={diff !== null && diff !== 0 ? 'text-danger-deep' : ''}
                data-testid="dayclose-confirm-diff"
              >
                {blind
                  ? '提交后揭晓'
                  : diff === null
                    ? '—'
                    : diff === 0
                      ? '¥0'
                      : `${diff > 0 ? '+' : '−'}¥${fenToYuan(Math.abs(diff))}`}
              </b>
            </div>
            {input.actualWechatFen !== undefined || input.actualAlipayFen !== undefined ? (
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-sans text-ink-secondary">实点非现金</span>
                <b>
                  微信 ¥{fenToYuan(input.actualWechatFen ?? 0)} · 支付宝 ¥
                  {fenToYuan(input.actualAlipayFen ?? 0)}
                </b>
              </div>
            ) : null}
            {overrideShiftId ? (
              <div className="mt-2 font-sans text-caption-xs text-ink-placeholder">
                拆箱后重新日结（全日口径）· 追溯班次 {overrideShiftId.slice(-6)}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-2">
          <SheetBtn data-testid="dayclose-confirm-cancel" onClick={onClose}>
            取消
          </SheetBtn>
          <SheetBtn
            variant="primary"
            data-testid="dayclose-confirm-ok"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? '冻结中…' : cc('cashier.dayCloseConfirmOk')}
          </SheetBtn>
        </div>
      </div>
    </dialog>
  )
}

/* ------------------------------------------------------------------ */
/* R12 当日退款单列（refund.dayStats · V2 现金段净额 / V7 发生日口径）         */
/* ------------------------------------------------------------------ */

/**
 * 日结页「退款单列」面板（R12 冻结版 §五）：
 * - 当日退款笔数+金额（refund.dayStats，biz_date=执行日聚合，executed|settled 口径）；
 * - 支付段退款分列（现金/微信/支付宝/次卡/储值）；
 * - 现金段净额=现金已收−现金退款（V2 口径：现金已收由 cashier 既有统计
 *   todayTenderStats.tender.cashFen 出，退款段由 dayStats.segments.cashFen 出，
 *   前端做差——server 不改既有日结函数，只出退款侧分列）；
 * - 历史日结封箱不回填（V7）：本面板只出当日，历史日结单只读不补列。
 */
export function RefundDayPanel({
  stats,
  loading,
  cashReceivedFen,
}: {
  stats: RefundDayStats | undefined
  loading: boolean
  /** 现金已收（分，todayTenderStats.tender.cashFen；null=未加载） */
  cashReceivedFen: number | null
}) {
  const cashNet =
    stats && cashReceivedFen !== null ? cashReceivedFen - stats.segments.cashFen : null
  return (
    <div className="u3-panel" data-testid="refund-day-panel">
      <div className="u3-panel-head">
        <h3>当日退款（退款单列）</h3>
        <span className="aside">{cc('cashier.refundDayAside')}</span>
      </div>
      <div className="px-[17px] pb-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : !stats ? (
          <p className="py-2 text-caption text-ink-secondary">退款统计暂不可用</p>
        ) : (
          <>
            <div className="u3-kv !px-0">
              <div className="cell">
                <div className="cap">退款笔数</div>
                <div className="v u1-num" data-testid="refund-day-count">
                  {stats.count}
                </div>
              </div>
              <div className="cell">
                <div className="cap">退款金额（单列）</div>
                <div
                  className={`v font-number tabular-nums ${stats.totalFen > 0 ? 'text-danger-deep' : ''}`}
                  data-testid="refund-day-total"
                >
                  {stats.totalFen > 0 ? `−¥${fenToYuan(stats.totalFen)}` : '¥0'}
                </div>
              </div>
              <div className="cell">
                <div className="cap">现金段净额（现金已收−现金退款）</div>
                <div className="v font-number tabular-nums" data-testid="refund-day-cash-net">
                  {cashNet !== null ? `¥${fenToYuan(cashNet)}` : '…'}
                </div>
              </div>
            </div>
            {/* 支付段退款分列（V2 同法分列；次卡/储值回补不计现金口径） */}
            <p className="mt-2 text-caption-xs leading-relaxed text-ink-placeholder" data-testid="refund-day-split">
              退款分列：现金{' '}
              <b className="font-number tabular-nums text-ink-secondary">¥{fenToYuan(stats.segments.cashFen)}</b>
              {' · 微信 '}
              <b className="font-number tabular-nums text-ink-secondary">¥{fenToYuan(stats.segments.wechatFen)}</b>
              {' · 支付宝 '}
              <b className="font-number tabular-nums text-ink-secondary">¥{fenToYuan(stats.segments.alipayFen)}</b>
              {' ｜ 非现金回补：次卡次数折抵 '}
              <b className="font-number tabular-nums text-ink-secondary">¥{fenToYuan(stats.segments.passFen)}</b>
              {' · 储值余额回补 '}
              <b className="font-number tabular-nums text-ink-secondary">¥{fenToYuan(stats.segments.storedValueFen)}</b>
            </p>
            <p className="mt-1.5 text-caption-xs text-ink-placeholder">
              {cc('cashier.refundCrossDayNote')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 片 3 交接班族：现金收支 paid in/out（台账留痕不碰真钱）                    */
/* ------------------------------------------------------------------ */

/**
 * 现金收支录入（cashMoveRecord）+ 本班流水（cashMoveList{shiftId}）：
 * 钱箱零钱存入/取出一笔一留；日结账面现金=流水现金+Σin−Σout（快照透出调整额）。
 */
export function CashMovePanel({ shift }: { shift: ShiftInfo | null | undefined }) {
  const { trpc, queryClient } = usePhiliaClient()
  const [kind, setKind] = useState<'paid_in' | 'paid_out'>('paid_in')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const listQ = useQuery({
    queryKey: [...CASH_MOVE_LIST_KEY, shift?.id ?? 'none'],
    queryFn: () => trpc.cashier.cashMoveList.query(shift ? { shiftId: shift.id } : undefined),
  })
  const recordM = useMutation({
    mutationFn: (input: { kind: 'paid_in' | 'paid_out'; amountFen: number; reason: string }) =>
      trpc.cashier.cashMoveRecord.mutate(input),
    onSuccess: () => {
      toast.success('现金收支已登记（台账留痕，不碰真钱）')
      setAmount('')
      setReason('')
      void queryClient.invalidateQueries({ queryKey: CASH_MOVE_LIST_KEY })
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const amountFen = yuanToFen(amount)
  const valid = amountFen !== null && amountFen >= 1 && reason.trim().length > 0

  return (
    <div className="u3-panel" data-testid="cash-move-panel">
      <div className="u3-panel-head">
        <h3>{cc('cashier.cashMoveTitle')}</h3>
        <span className="aside">{cc('cashier.cashMoveAside')}</span>
      </div>
      <div className="px-[17px] pb-4">
        {shift === null ? (
          <p className="mb-2 rounded-[10px] bg-sunken px-3 py-2 text-caption-xs text-ink-secondary">
            {cc('cashier.cashMoveNoShift')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5" role="tablist">
            {(
              [
                ['paid_in', '存入'],
                ['paid_out', '取出'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                data-testid={`cash-move-kind-${k}`}
                onClick={() => setKind(k)}
                className={`rounded-full px-3.5 py-[7px] text-caption transition-colors ${
                  kind === k ? 'bg-ink font-semibold text-brand-cta-on' : 'text-[rgba(44,40,34,.6)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            data-testid="cash-move-amount"
            inputMode="decimal"
            placeholder="金额 ¥"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-[110px] rounded-[8px] bg-card px-2.5 py-[7px] text-right font-number text-caption font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(44,40,34,.12)] placeholder:text-[rgba(44,40,34,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(44,40,34,.3)]"
          />
          <input
            data-testid="cash-move-reason"
            maxLength={200}
            placeholder="事由（必填）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-w-0 flex-1 rounded-[8px] bg-card px-2.5 py-[7px] text-caption text-ink shadow-[0_0_0_1px_rgba(44,40,34,.12)] placeholder:text-[rgba(44,40,34,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(44,40,34,.3)]"
          />
          <button
            type="button"
            data-testid="cash-move-submit"
            disabled={!valid || recordM.isPending}
            onClick={() => {
              if (amountFen === null) return
              recordM.mutate({ kind, amountFen, reason: reason.trim() })
            }}
            /* PD45 U6：cream 预算收敛——本屏「此刻要做」=日结并冻结唯一 cream；现金登记降深棕 CTA */
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-cta px-4 py-2 text-caption font-bold text-brand-cta-on shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
          >
            <Wallet size={13} strokeWidth={1.8} aria-hidden />
            {recordM.isPending ? '登记中…' : '登记'}
          </button>
        </div>

        {/* 本班流水（cashMoveList；存入 + / 取出 − 红绿口径照差异红字） */}
        <div className="mt-3">
          {listQ.isPending ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : (listQ.data ?? []).length === 0 ? (
            <p className="py-2 text-caption-xs text-ink-placeholder" data-testid="cash-move-empty">
              {cc('cashier.cashMoveEmpty')}
            </p>
          ) : (
            (listQ.data ?? []).map((m: CashMoveRow) => (
              <div
                key={m.id}
                data-testid={`cash-move-row-${m.id}`}
                className="flex items-center gap-2 border-b border-dashed border-[rgba(44,40,34,.09)] py-1.5 text-caption-xs last:border-b-0"
              >
                <span className={`font-semibold ${m.kind === 'paid_out' ? 'text-danger-deep' : 'text-ink'}`}>
                  {m.kind === 'paid_in' ? '存入' : '取出'}
                </span>
                <b className="font-number tabular-nums text-ink">
                  {m.kind === 'paid_in' ? '+' : '−'}¥{fenToYuan(m.amountFen)}
                </b>
                <span className="min-w-0 flex-1 truncate text-ink-secondary">{m.reason}</span>
                <span className="font-number tabular-nums text-ink-placeholder">
                  {fmtDateTime(m.createdAt)} · {m.operatorName ?? '—'}
                </span>
              </div>
            ))
          )}
        </div>
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
        <span className="aside">{cc('cashier.dayCloseListAside')}</span>
      </div>
      {loading ? (
        <div className="space-y-2 px-[17px] pb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : (rows ?? []).length === 0 ? (
        <p className="border-t border-[rgba(44,40,34,.06)] px-[17px] py-8 text-center text-body-sm text-ink-secondary">
          {cc('cashier.dayCloseEmpty')}
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
                    <td className="text-ink-secondary">
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
                        /* PD45 U6 · C6：日结「已冻结」明示标签分列（原「冻结生效」同义明示化） */
                        <span className="u3-st live">{cc('cashier.closeStatusFrozen')}</span>
                      )}
                    </td>
                    <td className="text-ink-secondary">{r.createdByName ?? '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-2.5">
                        {/* 拆箱重结：reversed 的原单（close）可对同班次重新日结 */}
                        {!isReversalRow && reversed ? (
                          <button
                            type="button"
                            data-testid={`dayclose-reclose-${r.id}`}
                            title="拆箱后同日重新日结（全日口径）"
                            onClick={() => onReclose(r)}
                            className="inline-flex items-center gap-1 text-caption-xs font-bold text-ink transition-transform duration-120 active:scale-[0.92] max-xl:min-h-[36px]"
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
                            className="inline-flex items-center gap-1 text-caption-xs font-bold text-ink transition-transform duration-120 active:scale-[0.92] max-xl:min-h-[36px]"
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
                            className="inline-flex items-center gap-1 text-caption-xs font-bold text-ink transition-transform duration-120 active:scale-[0.92] max-xl:min-h-[36px] disabled:opacity-50"
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
                            className="inline-flex items-center gap-1 text-caption-xs font-bold text-danger transition-transform duration-120 active:scale-[0.92] max-xl:min-h-[36px]"
                          >
                            反结账
                          </button>
                        ) : null}
                        <span className="inline-flex items-center text-caption-xs font-bold text-ink max-xl:min-h-[36px]">详情 ›</span>
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
/* 交接班日志（片 3 B6-3 · 只读四节：在洗清单/钥匙/现金/客诉 + 交接人）        */
/* ------------------------------------------------------------------ */

/** 在洗清单快照行防御渲染：常见字段优先（server 快照={appointmentId,label}），兜底 JSON 串 */
function washingLine(row: Record<string, unknown>): string {
  const parts = ['label', 'code', 'petName', 'pet', 'service', 'serviceName', 'name']
    .map((k) => row[k])
    .filter((v) => typeof v === 'string' && v.length > 0) as string[]
  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(row)
}

export function HandoverBlock({ shiftId }: { shiftId: string }) {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const handoverQ = useQuery({
    queryKey: ['cashier', HANDOVER_OF_KEY, shiftId],
    queryFn: () => trpc.cashier.handoverOf.query({ shiftId }),
  })
  /* 交/接/确认人显名：staffList userId→name（与页面顶部接棒人下拉同源同缓存） */
  const staffQ = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
  })
  const nameOf = (userId: string | null | undefined): string | null => {
    if (!userId) return null
    const hit = (staffQ.data?.staff ?? []).find((s) => s.userId === userId)
    return hit?.name ?? userId.slice(-6)
  }
  const h = handoverQ.data?.handover ?? null

  /* 片 3：接班人确认（双方签字口径）——未确认且 toUserId=本人或未指定时出现；
     未指定接棒人时 server 硬校验「当班开岗人」兜底（越权 403 原文透出） */
  const confirmM = useMutation({
    mutationFn: () => trpc.cashier.confirmHandover.mutate({ shiftId }),
    onSuccess: (r) => {
      toast.success(r.idempotent ? '此前已确认接班' : '已确认接班（双方签字口径留痕）')
      void queryClient.invalidateQueries({ queryKey: ['cashier', HANDOVER_OF_KEY, shiftId] })
    },
    onError: (e) => toast.error(errMsg(e)),
  })
  const canConfirm =
    h != null && h.confirmedAt == null && (h.toUserId == null || h.toUserId === user?.id)

  return (
    <div className="mt-3" data-testid={`handover-log-${shiftId}`}>
      <div className="mb-1 text-caption-xs font-semibold text-ink-placeholder">{cc('cashier.handoverLogTitle')}</div>
      {handoverQ.isPending ? (
        <Skeleton className="h-12" />
      ) : handoverQ.isError ? (
        <p className="text-caption-xs text-ink-placeholder">{cc('cashier.handoverLogLoadFail')}</p>
      ) : !h ? (
        <p className="text-caption-xs text-ink-placeholder">{cc('cashier.handoverLogEmpty')}</p>
      ) : (
        <div className="rounded-[10px] bg-canvas px-3 py-2 text-caption-xs text-ink-secondary">
          <div className="mb-1 font-semibold text-ink">
            {cc('cashier.handoverLogFromTo', {
              from: nameOf(h.fromUserId) ?? '—',
              to: nameOf(h.toUserId) ?? cc('cashier.handoverLogNoTo'),
            })}
            <span className="u1-num ml-2 font-normal">{fmtDateTime(h.createdAt)}</span>
          </div>
          <div className="u3-field"><span className="lb">{cc('cashier.handoverWashingLabel')}</span><span className="vl">
            {h.washingJson && h.washingJson.length > 0
              ? h.washingJson.map((w, i) => <span key={i} className="block">{washingLine(w as unknown as Record<string, unknown>)}</span>)
              : '—'}
          </span></div>
          <div className="u3-field"><span className="lb">{cc('cashier.handoverKeysLabel')}</span><span className="vl">{h.keysNote ?? '—'}</span></div>
          <div className="u3-field"><span className="lb">{cc('cashier.handoverCashLabel')}</span><span className="vl">{h.cashNote ?? '—'}</span></div>
          <div className="u3-field"><span className="lb">{cc('cashier.handoverComplaintsLabel')}</span><span className="vl">{h.complaintsNote ?? '—'}</span></div>
          {/* 片 3：备用金点交透出（交班 floatFen；NULL=未点交） */}
          <div className="u3-field"><span className="lb">{cc('cashier.floatLabel')}</span><span className="vl font-number tabular-nums">
            {h.floatFen != null ? `¥${fenToYuan(h.floatFen)}` : '—'}
          </span></div>
          {/* 片 3：接班人确认（已确认=确认人/时刻；未确认且本人可接=确认钮） */}
          {h.confirmedAt ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-caption-xs" data-testid={`handover-confirmed-${shiftId}`}>
              <span className="u3-st live">{cc('cashier.handoverConfirmedNote')}</span>
              <span className="text-ink-secondary">
                {nameOf(h.confirmedBy) ?? '—'} · <span className="font-number tabular-nums">{fmtDateTime(h.confirmedAt)}</span>
              </span>
            </div>
          ) : canConfirm ? (
            <button
              type="button"
              data-testid={`handover-confirm-${shiftId}`}
              disabled={confirmM.isPending}
              onClick={() => confirmM.mutate()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2 text-caption-xs font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
            >
              {confirmM.isPending ? '确认中…' : cc('cashier.handoverConfirmCta')}
            </button>
          ) : null}
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
  /** 片 3：现金收支调整额（分；账面现金=流水现金+本额） */
  cashAdjustFen?: number
  /** 片 3：现金收支明细快照（paid_in/out + 事由） */
  cashMovements?: Array<{ kind: string; amountFen: number; reason: string }>
  /** 片 3：折扣/抹零单列（当日 settled 单聚合；免单本体=闸门骨架候注记） */
  discountStats?: { discountedBills: number; discountFen: number; roundingFen: number; freebieNote?: string }
}

export function DayCloseDetailDialog({
  row,
  canPrint,
  onClose,
}: {
  row: DayCloseRow | null
  /** PD-84：打印日结单入口放宽 owner|manager（管理层同本页闸；导出 CSV 仍仅 owner——总规则③不动） */
  canPrint: boolean
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
      footer={
        <>
          {/* PD-84：日结单打印入口（PRINT_ENTRY_MISSING 补缺 · 放宽 owner|manager；
              window.print() + @media print 内联隔离，屏外全隐仅日结单可见——
              工艺照 ReceiptPage 小票先例；导出 CSV 仍仅 owner 不动） */}
          {canPrint ? (
            <SheetBtn data-testid="dayclose-print" onClick={() => window.print()}>
              {cc('cashier.dayClosePrint')}
            </SheetBtn>
          ) : null}
          <SheetBtn onClick={onClose}>关闭</SheetBtn>
        </>
      }
    >
      {/* 打印隔离锚（@media print 仅本块可见；屏上样式不变） */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #dayclose-print-sheet, #dayclose-print-sheet * { visibility: visible; }
          #dayclose-print-sheet {
            position: absolute; left: 0; top: 0; width: 100%;
            max-height: none; overflow: visible;
          }
        }
      `}</style>
      <div id="dayclose-print-sheet">
        <div className="u3-field"><span className="lb">日结单号</span><span className="vl font-number tabular-nums">{row.id}</span></div>
        <div className="u3-field"><span className="lb">营业日</span><span className="vl font-number tabular-nums">{row.bizDate}</span></div>
        <div className="u3-field"><span className="lb">班次</span><span className="vl font-number tabular-nums">{row.shiftId}</span></div>
        {isReversalRow ? (
          <div className="u3-field"><span className="lb">关联原单</span><span className="vl font-number tabular-nums">{row.refCloseId ?? '—'}</span></div>
        ) : row.reversalId ? (
          <div className="u3-field"><span className="lb">冲正单</span><span className="vl font-number tabular-nums">{row.reversalId}</span></div>
        ) : null}
        <div className="u3-field"><span className="lb">状态</span><span className="vl">
          {isReversalRow ? <span className="u3-st done">冲正单</span> : row.status === 'reversed' ? <span className="u3-st done">已冲正</span> : <span className="u3-st live">{cc('cashier.closeStatusFrozen')}</span>}
        </span></div>
        <div className="u3-field"><span className="lb">账面现金</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.bookCashFen))}</span></div>
        <div className="u3-field"><span className="lb">实点现金</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.actualCashFen))}</span></div>
        <div className="u3-field"><span className="lb">差异</span><span className={`vl font-number tabular-nums ${fz(row.diffFen) !== 0 ? 'font-bold text-danger-deep' : ''}`}>
          {fz(row.diffFen) === 0 ? '¥0' : `${fz(row.diffFen) > 0 ? '+' : '−'}¥${fenToYuan(Math.abs(fz(row.diffFen)))}`}
        </span></div>
        <div className="u3-field"><span className="lb">微信</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.wechatFen))}</span></div>
        <div className="u3-field"><span className="lb">支付宝</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.alipayFen))}</span></div>
        {/* 片 3：实点非现金透出（NULL=未点） */}
        {row.actualWechatFen != null ? (
          <div className="u3-field"><span className="lb">实点微信</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.actualWechatFen))}</span></div>
        ) : null}
        {row.actualAlipayFen != null ? (
          <div className="u3-field"><span className="lb">实点支付宝</span><span className="vl font-number tabular-nums">¥{fenToYuan(fz(row.actualAlipayFen))}</span></div>
        ) : null}
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
            <div className="mb-1 text-caption-xs font-semibold text-ink-placeholder">前后值快照</div>
            <div className="rounded-[10px] bg-canvas px-3 py-2 font-number text-caption-xs tabular-nums text-ink-secondary">
              <div>冲正前状态：{(snapshot.before?.status as string) ?? '—'} · 账面 ¥{fenToYuan(fz((snapshot.before?.bookCashFen as number | null) ?? null))} · 实点 ¥{fenToYuan(fz((snapshot.before?.actualCashFen as number | null) ?? null))}</div>
              <div className="mt-1">冲正后：{(snapshot.after?.note as string) ?? (snapshot.after?.status as string) ?? '—'}</div>
              <div className="mt-1">操作人 {snapshot.operatorId ?? '—'} · {snapshot.at ? fmtDateTime(new Date(snapshot.at)) : '—'}</div>
            </div>
          </div>
        ) : null}

        {/* 片 3：现金收支调整额 + 明细（账面现金=流水现金+调整额，快照透出） */}
        {snapshot && (snapshot.cashAdjustFen ?? 0) !== 0 ? (
          <div className="mt-3">
            <div className="mb-1 text-caption-xs font-semibold text-ink-placeholder">
              {cc('cashier.cashAdjustLabel')}
            </div>
            <div className="rounded-[10px] bg-canvas px-3 py-2 text-caption-xs text-ink-secondary">
              <b className="font-number tabular-nums text-ink" data-testid="dayclose-cash-adjust">
                {snapshot.cashAdjustFen! > 0 ? '+' : '−'}¥{fenToYuan(Math.abs(snapshot.cashAdjustFen!))}
              </b>
              {(snapshot.cashMovements ?? []).map((m, i) => (
                <div key={i} className="mt-1 font-number tabular-nums">
                  {m.kind === 'paid_in' ? '存入 +' : '取出 −'}¥{fenToYuan(m.amountFen)} · {m.reason}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 片 3：折扣/抹零单列（当日 settled 单聚合快照） */}
        {snapshot?.discountStats ? (
          <div className="mt-3">
            <div className="mb-1 text-caption-xs font-semibold text-ink-placeholder">
              {cc('cashier.discountStatsTitle')}
            </div>
            <div className="rounded-[10px] bg-canvas px-3 py-2 font-number text-caption-xs tabular-nums text-ink-secondary" data-testid="dayclose-discount-stats">
              折扣单 <b className="text-ink">{snapshot.discountStats.discountedBills}</b> 张
              {' · 折扣额 '}<b className="text-ink">¥{fenToYuan(snapshot.discountStats.discountFen)}</b>
              {' · 抹零额 '}<b className="text-ink">¥{fenToYuan(snapshot.discountStats.roundingFen)}</b>
              {snapshot.discountStats.freebieNote ? (
                <div className="mt-1 font-sans text-ink-placeholder">{snapshot.discountStats.freebieNote}</div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* 调整记录（adjustDayClose 只增不改） */}
        {adjustments.length > 0 ? (
          <div className="mt-3">
            <div className="mb-1 text-caption-xs font-semibold text-ink-placeholder">调整记录（{adjustments.length}）</div>
            {adjustments.map((a, i) => (
              <div key={i} className="rounded-[10px] bg-canvas px-3 py-2 text-caption-xs text-ink-secondary [&+&]:mt-1.5">
                <span className="font-number tabular-nums">{fmtDateTime(new Date(a.at))}</span> · {a.note}
              </div>
            ))}
          </div>
        ) : null}

        {/* 片 3 B6-3：交接班日志只读四节（handoverOf；该班次无留痕时空态注记） */}
        <HandoverBlock shiftId={row.shiftId} />
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
      <div className="rounded-[14px] bg-canvas px-3.5 py-3">
        <div className="font-number text-caption font-semibold tabular-nums">
          {target.bizDate} · 班次 {target.shiftId.slice(-6)}
        </div>
        <div className="mt-1 font-number text-caption-xs tabular-nums text-ink-secondary">
          账面 ¥{fenToYuan(fz(target.bookCashFen))} · 实点 ¥{fenToYuan(fz(target.actualCashFen))} · 差异{' '}
          {fz(target.diffFen) === 0 ? '¥0' : `${fz(target.diffFen) > 0 ? '+' : '−'}¥${fenToYuan(Math.abs(fz(target.diffFen)))}`}
        </div>
      </div>
      <textarea
        className="mt-3 min-h-[76px] w-full resize-none rounded-[14px] bg-card px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(44,40,34,.12)] placeholder:text-[rgba(44,40,34,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(44,40,34,.3)]"
        data-testid="dayclose-reason-input"
        placeholder={isReverse ? '冲正原因（必填，留痕）' : '调整备注（必填；只增不改，原冻结数字不涂改）'}
        maxLength={200}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="mt-1.5 text-caption-xs leading-relaxed text-ink-placeholder">
        {isReverse
          ? cc('cashier.reverseCloseNote')
          : cc('cashier.adjustNote')}
      </p>
      {!valid ? (
        <p className="mt-2 text-caption-xs font-semibold text-danger-deep">
          {isReverse ? '反结账必须填写原因' : '调整备注不能为空'}
        </p>
      ) : null}
    </CashierModal>
  )
}
