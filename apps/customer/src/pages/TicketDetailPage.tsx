/**
 * TicketDetailPage · /support/:id 工单详情（补缺大批片 4 · 小棉花）
 *
 * - 数据：serviceLoop.ticketGet（本人校验，他人 403 明文透出）；
 * - 件：状态 pill + 类型 + 工单号/时刻 mono + 描述 + 附图照片墙（PhotoWall +
 *   全屏 PhotoViewer）+ 回复区（replied 态显示 replyText + repliedAt mono）
 *   + 处理进度时间线（timelineJson 只增不改留痕）；
 * - 店长介入（体验批片 4 C5 · ticketEscalate）：submitted/replied 显示
 *   「申请店长介入」确认层（补充说明选填）→ escalated 态透出徽章+升级说明+
 *   升级时刻，时间线 action=escalated 渲染「申请店长介入」。
 *
 * 画布化（产品-1010 画布全屏批片 3 末片 · 工艺照 MePage/MallPage）：五块入册
 * （ticketDetail.header/main/reply/escalate/timeline），块序/显隐=
 * useCanvasLayout('ticketDetail')（published→注册表默认序尾补，空=
 * TICKET_DETAIL_DEFAULT_ORDER 兜底）；文案键挂 CK 锚（textarea placeholder 等
 * 属性位挂不上，键如实入块 copyKeys）；预览=CanvasLayoutLoader+?canvasPreview=1
 * 水印注记；带参屏预览特例：canvasPreview=1 且路由参数==='preview'（预览
 * URL=/support/preview）时用列表既有查询 ticketListMine 首条 id 顶替（零新增查询）。
 * 草案无 error 块——加载/失败态并入 header 块（页头裸段置顶惯例照 MePage）。
 * 全屏 PhotoViewer=弹层件不入块流，照改造前位置挂载。块内逻辑/查询/状态机零改动，
 * data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CanvasLayoutLoader, CK, PhotoViewer, PhotoWall, friendlyError, useCanvasLayout, usePhiliaClient, useToast, type PhotoWallPhoto } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

const STATUS_META: Record<string, { key: ServiceLoopCopyKey; pill: string }> = {
  submitted: { key: 'ticket.statusSubmitted', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  replied: { key: 'ticket.statusReplied', pill: 'bg-brand-secondary-light text-ink' },
  closed: { key: 'ticket.statusClosed', pill: 'bg-sunken text-ink-placeholder' },
  escalated: { key: 'ticket.statusEscalated', pill: 'bg-danger-light text-danger-deep' },
}

const TYPE_LABEL: Record<string, ServiceLoopCopyKey> = {
  suggest: 'ticket.typeSuggest',
  complaint: 'ticket.typeComplaint',
  praise: 'ticket.typePraise',
  other: 'ticket.typeOther',
}

const TIMELINE_LABEL: Record<string, ServiceLoopCopyKey> = {
  submitted: 'ticket.timelineSubmitted',
  replied: 'ticket.timelineReplied',
  closed: 'ticket.timelineClosed',
  escalated: 'ticket.timelineEscalated',
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const TICKET_DETAIL_DEFAULT_ORDER = ['ticketDetail.header', 'ticketDetail.main', 'ticketDetail.reply', 'ticketDetail.escalate', 'ticketDetail.timeline'] as const

export default function TicketDetailPage() {
  const { id = '' } = useParams()
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 3200 })
  const [viewing, setViewing] = useState<PhotoWallPhoto | null>(null)
  // 店长介入（体验批片 4 C5）：确认层开合 + 补充说明（选填）
  const [escalating, setEscalating] = useState(false)
  const [escalateNote, setEscalateNote] = useState('')

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 带参屏预览特例：?canvasPreview=1 且 :id==='preview'（预览 URL=/support/preview）
     时用本屏列表既有查询 ticketListMine 首条 id 顶替路由参数（零新增查询） */
  const previewFallback = isCanvasPreview && id === 'preview'
  const ticketsQ = useQuery({
    queryKey: ['serviceLoop', 'ticketListMine'],
    queryFn: () => trpc.serviceLoop.ticketListMine.query(),
    enabled: previewFallback,
  })
  const effId = previewFallback ? (ticketsQ.data?.[0]?.id ?? '') : id

  const ticketQ = useQuery({
    queryKey: ['serviceLoop', 'ticketGet', effId],
    queryFn: () => trpc.serviceLoop.ticketGet.query({ ticketId: effId }),
    enabled: effId.length > 0,
  })

  /* 画布布局店锚（同 MePage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，照解析供 useCanvasLayout/Loader） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const ticketDetailStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'ticketDetail')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : TICKET_DETAIL_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('ticketDetail', ticketDetailStoreId, registryBlocks)

  const escalateM = useMutation({
    mutationFn: () =>
      trpc.serviceLoop.ticketEscalate.mutate({
        ticketId: effId,
        ...(escalateNote.trim() ? { note: escalateNote.trim() } : {}),
      }),
    onSuccess: () => {
      setEscalating(false)
      setEscalateNote('')
      void queryClient.invalidateQueries({ queryKey: ['serviceLoop', 'ticketGet', effId] })
      void queryClient.invalidateQueries({ queryKey: ['serviceLoop', 'ticketListMine'] })
      showToast(sl('ticket.escalateDone'), 'info')
    },
    onError: (err) => showToast(friendlyError(err, sl('ticket.escalateFail')), 'error'),
  })

  const ticket = ticketQ.data?.ticket ?? null
  const meta = ticket ? (STATUS_META[ticket.status] ?? STATUS_META.submitted!) : null
  const wallPhotos: PhotoWallPhoto[] = (ticket?.photoUrls ?? []).map((url) => ({ id: url, url }))

  /* 块渲染器（块内逻辑零改动——五块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. ticketDetail.header：U1-A 统一返回条（←圆钮+标题），固定返回工单列表；
          草案无 error 块——加载/失败态并入本块（ErrorState message 为 string 入参无 CK 锚，
          backList 出口钮挂 CK） */
    'ticketDetail.header': () => (
      <>
        <PageHeader title={<CK k="ticket.detailTitle">{sl('ticket.detailTitle')}</CK>} fallback="/support" className="pt-6" />
        <div className="mt-4">
          {ticketQ.isPending ? <LoadingBlock lines={3} /> : null}
          {ticketQ.isError ? (
            <ErrorState
              message={friendlyError(ticketQ.error, sl('ticket.loadFail'))}
              onRetry={() => void ticketQ.refetch()}
              action={
                <Link
                  to="/support"
                  className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  <CK k="ticket.backList">{sl('ticket.backList')}</CK>
                </Link>
              }
            />
          ) : null}
        </div>
      </>
    ),

    /* 2. ticketDetail.main：主体卡（状态 + 类型 + 描述 + 附图照片墙 + 单号/时刻 mono） */
    'ticketDetail.main': () => {
      if (!ticket || !meta) return null
      return (
        <section className="u1-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body-sm font-semibold"><CK k={TYPE_LABEL[ticket.type] ?? 'ticket.typeOther'}>{sl(TYPE_LABEL[ticket.type] ?? 'ticket.typeOther')}</CK></p>
            <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
              <CK k={meta.key}>{sl(meta.key)}</CK>
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-body-sm text-ink">{ticket.description}</p>
          {wallPhotos.length > 0 ? (
            <div className="mt-3">
              <PhotoWall photos={wallPhotos} onPhotoClick={(p) => setViewing(p)} />
            </div>
          ) : null}
          <p className="u1-num mt-3 text-caption-xs text-ink-placeholder">
            {ticket.ticketNo} · {fmtDateTime(ticket.createdAt)}
          </p>
        </section>
      )
    },

    /* 3. ticketDetail.reply：回复区（replied 态显示：店员回复 + repliedAt mono） */
    'ticketDetail.reply': () => {
      if (!ticket) return null
      return ticket.status === 'replied' && ticket.replyText ? (
        <section className="rounded-card bg-brand-secondary-light p-4" data-testid="ticket-reply">
          <p className="text-body-sm font-semibold"><CK k="ticket.replyTitle">{sl('ticket.replyTitle')}</CK></p>
          <p className="mt-2 whitespace-pre-wrap text-body-sm text-ink">{ticket.replyText}</p>
          {ticket.repliedAt ? (
            <p className="u1-num mt-2 text-caption-xs text-ink-placeholder">
              {fmtDateTime(ticket.repliedAt)}
            </p>
          ) : null}
        </section>
      ) : null
    },

    /* 4. ticketDetail.escalate：店长介入区（escalated 态透出徽章+升级说明+时刻；
          submitted/replied 在途件显示申请入口/确认层；两态互斥同区） */
    'ticketDetail.escalate': () => {
      if (!ticket) return null
      return (
        <>
          {/* 店长介入（体验批片 4 C5）：escalated 态透出徽章+升级说明+时刻 */}
          {ticket.status === 'escalated' ? (
            <section className="u1-card p-4" data-testid="ticket-escalated">
              <span className="rounded-chip bg-danger-light px-[7px] py-0.5 text-caption-xs font-semibold text-danger-deep">
                <CK k="ticket.escalatedBadge">{sl('ticket.escalatedBadge')}</CK>
              </span>
              {ticket.escalateNote ? (
                <div className="mt-2">
                  <p className="text-caption-xs text-ink-placeholder"><CK k="ticket.escalateNoteTitle">{sl('ticket.escalateNoteTitle')}</CK></p>
                  <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink">{ticket.escalateNote}</p>
                </div>
              ) : null}
              {ticket.escalatedAt ? (
                <p className="u1-num mt-2 text-caption-xs text-ink-placeholder">
                  <CK k="ticket.escalatedAtLine">{sl('ticket.escalatedAtLine', { time: fmtDateTime(ticket.escalatedAt) })}</CK>
                </p>
              ) : null}
            </section>
          ) : null}

          {/* 申请店长介入：submitted/replied 在途件可升级（已升级幂等，已关闭服务端硬拒） */}
          {ticket.status === 'submitted' || ticket.status === 'replied' ? (
            escalating ? (
              <section className="u1-card p-4" data-testid="ticket-escalate-panel">
                <p className="text-body-sm font-semibold"><CK k="ticket.escalateTitle">{sl('ticket.escalateTitle')}</CK></p>
                <p className="mt-1 text-caption text-ink-secondary"><CK k="ticket.escalateDesc">{sl('ticket.escalateDesc')}</CK></p>
                <p className="mt-3 text-caption text-ink-secondary"><CK k="ticket.escalateNoteLabel">{sl('ticket.escalateNoteLabel')}</CK></p>
                <textarea
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={sl('ticket.escalateNotePlaceholder')}
                  className="mt-1.5 w-full rounded-input border border-line bg-card px-3.5 py-2.5 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEscalating(false)}
                    className="h-11 flex-1 rounded-full bg-sunken text-body font-medium text-ink"
                  >
                    <CK k="ticket.escalateCancel">{sl('ticket.escalateCancel')}</CK>
                  </button>
                  <button
                    type="button"
                    disabled={escalateM.isPending}
                    onClick={() => escalateM.mutate()}
                    className="h-11 flex-1 rounded-full bg-brand-primary text-body font-medium text-ink disabled:opacity-60"
                  >
                    {escalateM.isPending ? <CK k="ticket.submitting">{sl('ticket.submitting')}</CK> : <CK k="ticket.escalateSubmit">{sl('ticket.escalateSubmit')}</CK>}
                  </button>
                </div>
              </section>
            ) : (
              <button
                type="button"
                data-testid="ticket-escalate-btn"
                onClick={() => setEscalating(true)}
                className="u1-card flex h-11 w-full items-center justify-center text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                <CK k="ticket.escalateCta">{sl('ticket.escalateCta')}</CK>
              </button>
            )
          ) : null}
        </>
      )
    },

    /* 5. ticketDetail.timeline：处理进度时间线（timelineJson 只增不改；action 标签键动态 CK 锚） */
    'ticketDetail.timeline': () => {
      if (!ticket) return null
      return (
        <section className="u1-card p-4" data-testid="ticket-timeline">
          <p className="text-body-sm font-semibold"><CK k="ticket.timelineTitle">{sl('ticket.timelineTitle')}</CK></p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {ticket.timelineJson.map((item, i) => (
              <li key={`${item.action}-${i}`} className="flex items-baseline justify-between gap-2 text-caption">
                <span className="text-ink"><CK k={TIMELINE_LABEL[item.action] ?? 'ticket.timelineSubmitted'}>{sl(TIMELINE_LABEL[item.action] ?? 'ticket.timelineSubmitted')}</CK></span>
                <span className="u1-num shrink-0 text-ink-placeholder">{fmtDateTime(new Date(item.at))}</span>
              </li>
            ))}
          </ul>
        </section>
      )
    },
  }

  return (
    <CanvasLayoutLoader pageKey="ticketDetail" storeId={ticketDetailStoreId}>
      <div className="px-4 pb-6">
        {toastEl}
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-3 text-center text-caption-xs text-ink-secondary" data-testid="ticket-canvas-preview-note">
            <CK k="mc.canvasExampleNote">{mc('mc.canvasExampleNote')}</CK>
          </p>
        ) : null}
        {/* 页头裸段置顶惯例照 MePage：header 恒置顶；余块裹在原详情 flex 容器内
            （包层 section 为 flex 子项吃 gap-3，间距与改造前一致） */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'ticketDetail.header' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        {ticket && meta ? (
          <div className="mt-4 flex flex-col gap-3" data-testid="ticket-detail">
            {layout.map((b) =>
              b.visible && b.blockKey !== 'ticketDetail.header' ? (
                <section data-block-key={b.blockKey} key={b.blockKey}>
                  {renderers[b.blockKey]?.() ?? null}
                </section>
              ) : null,
            )}
          </div>
        ) : null}

        {/* 全屏照片查看器=弹层件，不入块流，照改造前位置挂载 */}
        {viewing ? (
          <PhotoViewer
            photos={[viewing]}
            index={0}
            onClose={() => setViewing(null)}
            onNavigate={() => {}}
            keyboard={false}
          />
        ) : null}
      </div>
    </CanvasLayoutLoader>
  )
}
