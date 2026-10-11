/**
 * TicketListPage · /support 我的工单（补缺大批片 4 · 小棉花）
 *
 * - 数据：serviceLoop.ticketListMine（本人工单，创建倒序，上限 50）；
 * - 行=状态 pill（已提交/已回复/已关闭/已升级店长介入）+ 类型 + 描述截断 + 时刻 mono + 工单号；
 * - 空态三句话（出口=写一封给小棉花 /support/new）。
 *
 * 画布化（产品-1010 画布全屏批片 3 末片 · 工艺照 MePage/MallPage）：四块入册
 * （ticketList.header/list/empty/error），块序/显隐=useCanvasLayout('ticketList')
 * （published→注册表默认序尾补，空=TICKET_LIST_DEFAULT_ORDER 兜底）；文案键挂 CK 锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。块内逻辑/查询零改动，
 * data-testid 原值全保留；EmptyState title/ErrorState message 为 string 入参挂不上 CK
 * （组件内无 CK 锚，键如实入块 copyKeys）。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
import { sl } from '@/copy/serviceloop'

/** 状态 pill（提交=淡金 / 已回复=卡其浅底 / 已关闭=沉底 / 已升级=赭红浅底；反馈件不设绿） */
const STATUS_META: Record<string, { key: 'ticket.statusSubmitted' | 'ticket.statusReplied' | 'ticket.statusClosed' | 'ticket.statusEscalated'; pill: string }> = {
  submitted: { key: 'ticket.statusSubmitted', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  replied: { key: 'ticket.statusReplied', pill: 'bg-brand-secondary-light text-ink' },
  closed: { key: 'ticket.statusClosed', pill: 'bg-sunken text-ink-placeholder' },
  escalated: { key: 'ticket.statusEscalated', pill: 'bg-danger-light text-danger-deep' },
}

const TYPE_LABEL: Record<string, 'ticket.typeSuggest' | 'ticket.typeComplaint' | 'ticket.typePraise' | 'ticket.typeOther'> = {
  suggest: 'ticket.typeSuggest',
  complaint: 'ticket.typeComplaint',
  praise: 'ticket.typePraise',
  other: 'ticket.typeOther',
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const TICKET_LIST_DEFAULT_ORDER = ['ticketList.header', 'ticketList.list', 'ticketList.empty', 'ticketList.error'] as const

export default function TicketListPage() {
  const { trpc } = usePhiliaClient()
  const ticketsQ = useQuery({
    queryKey: ['serviceLoop', 'ticketListMine'],
    queryFn: () => trpc.serviceLoop.ticketListMine.query(),
  })

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
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
  const ticketListStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'ticketList')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : TICKET_LIST_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('ticketList', ticketListStoreId, registryBlocks)

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. ticketList.header：U1-A 统一返回条（←圆钮+标题），固定返回「我的」页 */
    'ticketList.header': () => (
      <PageHeader title={<CK k="ticket.listTitle">{sl('ticket.listTitle')}</CK>} fallback="/me" className="pt-6" />
    ),

    /* 2. ticketList.list：加载占位 + 工单行列表（状态 pill/类型键动态 CK 锚） */
    'ticketList.list': () => (
      <>
        {ticketsQ.isPending ? (
          <div className="mt-4">
            <LoadingBlock lines={3} />
          </div>
        ) : null}
        {ticketsQ.data && ticketsQ.data.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3" data-testid="ticket-list">
            {ticketsQ.data.map((t) => {
              const meta = STATUS_META[t.status] ?? STATUS_META.submitted!
              return (
                <li key={t.id}>
                  <Link
                    to={`/support/${t.id}`}
                    data-testid={`ticket-item-${t.id}`}
                    className="u1-card block px-4 py-3.5 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-body-sm font-semibold"><CK k={TYPE_LABEL[t.type] ?? 'ticket.typeOther'}>{sl(TYPE_LABEL[t.type] ?? 'ticket.typeOther')}</CK></span>
                      <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
                        <CK k={meta.key}>{sl(meta.key)}</CK>
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-caption text-ink-secondary">{t.description}</span>
                    <span className="u1-num mt-1.5 block text-caption-xs text-ink-placeholder">
                      {t.ticketNo} · {fmtDateTime(t.createdAt)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : null}
      </>
    ),

    /* 3. ticketList.empty：空态三句话（出口=写工单；EmptyState title 为 string 入参无 CK 锚） */
    'ticketList.empty': () =>
      ticketsQ.data && ticketsQ.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={sl('ticket.emptyTitle')}
            desc={<CK k="ticket.emptyBody">{sl('ticket.emptyBody')}</CK>}
            action={
              /* §4.11 空态出口钮=深棕墨底淡字 */
              <Link
                to="/support/new"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="ticket.emptyCta">{sl('ticket.emptyCta')}</CK>
              </Link>
            }
          />
        </div>
      ) : null,

    /* 4. ticketList.error：失败态（ErrorState message 为 string 入参无 CK 锚） */
    'ticketList.error': () =>
      ticketsQ.isError ? (
        <div className="mt-4">
          <ErrorState message={sl('ticket.loadFail')} onRetry={() => void ticketsQ.refetch()} />
        </div>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="ticketList" storeId={ticketListStoreId}>
      <div className="px-4 pb-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-3 text-center text-caption-xs text-ink-secondary" data-testid="tickets-canvas-preview-note">
            <CK k="mc.canvasExampleNote">{mc('mc.canvasExampleNote')}</CK>
          </p>
        ) : null}
        {/* 块流：四块按有效布局渲染（隐藏块整段不渲染）；默认序下块内 JSX 与改造前逐字一致
            （pending/空态/失败态互斥，分块后落位不变） */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
      </div>
    </CanvasLayoutLoader>
  )
}
