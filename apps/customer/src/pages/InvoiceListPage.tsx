/**
 * InvoiceListPage · /invoices 我的发票申请（补缺大批片 4）
 *
 * - 数据：serviceLoop.invoiceListMine（本人申请，创建倒序，上限 50）；
 * - 行=状态 pill（申请中/已开具）+ 申请单号 mono + 来源单号/类型 + 金额 mono + 时刻；
 * - 空态三句话（出口=我的预约 /appointments）。
 *
 * 画布化（产品-1010 画布全屏批片 3 末片 · 工艺照 MePage/MallPage）：三块入册
 * （inv.head/list/empty），块序/显隐=useCanvasLayout('invoices')
 * （published→注册表默认序尾补，空=INVOICES_DEFAULT_ORDER 兜底）；文案键挂 CK 锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。草案无 error 块——加载/失败态
 * 并入 inv.head 块（ErrorState message 为 string 入参无 CK 锚）。块内逻辑/查询零改动，
 * data-testid 原值全保留。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fenToYuan, fmtDateTime } from '@/components/booking/format'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

/** 状态 pill（申请中=淡金 / 已开具=卡其浅底；反馈件不设绿） */
const STATUS_META: Record<string, { key: ServiceLoopCopyKey; pill: string }> = {
  submitted: { key: 'inv.statusSubmitted', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  issued: { key: 'inv.statusIssued', pill: 'bg-brand-secondary-light text-ink' },
}

const KIND_LABEL: Record<string, ServiceLoopCopyKey> = {
  appointment: 'inv.kindAppointment',
  order: 'inv.kindOrder',
  cashier: 'inv.kindCashier',
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const INVOICES_DEFAULT_ORDER = ['inv.head', 'inv.list', 'inv.empty'] as const

export default function InvoiceListPage() {
  const { trpc } = usePhiliaClient()
  const invoicesQ = useQuery({
    queryKey: ['serviceLoop', 'invoiceListMine'],
    queryFn: () => trpc.serviceLoop.invoiceListMine.query(),
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
  const invoicesStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'invoices')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : INVOICES_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('invoices', invoicesStoreId, registryBlocks)

  /* 块渲染器（块内逻辑零改动——三块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. inv.head：U1-A 统一返回条（←圆钮+标题），固定返回「我的」页；
          草案无 error 块——加载/失败态并入本块 */
    'inv.head': () => (
      <>
        <PageHeader title={<CK k="inv.listTitle">{sl('inv.listTitle')}</CK>} fallback="/me" className="pt-6" />
        <div className="mt-4">
          {invoicesQ.isPending ? <LoadingBlock lines={3} /> : null}
          {invoicesQ.isError ? (
            <ErrorState message={sl('inv.loadFail')} onRetry={() => void invoicesQ.refetch()} />
          ) : null}
        </div>
      </>
    ),

    /* 2. inv.list：发票申请行列表（状态 pill/类型键动态 CK 锚；单号/金额/时刻读数据不抽键） */
    'inv.list': () =>
      invoicesQ.data && invoicesQ.data.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3" data-testid="invoice-list">
          {invoicesQ.data.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.submitted!
            return (
              <li key={r.id}>
                <Link
                  to={`/invoices/${r.id}`}
                  data-testid={`invoice-item-${r.id}`}
                  className="u1-card block px-4 py-3.5 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold"><CK k={KIND_LABEL[r.orderKind] ?? 'inv.kindOrder'}>{sl(KIND_LABEL[r.orderKind] ?? 'inv.kindOrder')}</CK></span>
                    <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
                      <CK k={meta.key}>{sl(meta.key)}</CK>
                    </span>
                  </span>
                  <span className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="u1-num text-caption text-ink-secondary">{r.billNo}</span>
                    <span className="u1-num text-body-sm font-bold text-ink">{fenToYuan(r.amountFen)}</span>
                  </span>
                  <span className="u1-num mt-1.5 block text-caption-xs text-ink-placeholder">
                    {r.invoiceNo} · {fmtDateTime(r.createdAt)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null,

    /* 3. inv.empty：空态三句话（出口=我的预约；EmptyState title 为 string 入参无 CK 锚） */
    'inv.empty': () =>
      invoicesQ.data && invoicesQ.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={sl('inv.emptyTitle')}
            desc={<CK k="inv.emptyBody">{sl('inv.emptyBody')}</CK>}
            action={
              /* §4.11 空态出口钮=深棕墨底淡字 */
              <Link
                to="/appointments"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="inv.emptyCta">{sl('inv.emptyCta')}</CK>
              </Link>
            }
          />
        </div>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="invoices" storeId={invoicesStoreId}>
      <div className="px-4 pb-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-3 text-center text-caption-xs text-ink-secondary" data-testid="invoices-canvas-preview-note">
            <CK k="mc.canvasExampleNote">{mc('mc.canvasExampleNote')}</CK>
          </p>
        ) : null}
        {/* 块流：三块按有效布局渲染（隐藏块整段不渲染）；默认序下块内 JSX 与改造前逐字一致
            （pending/失败态并入 head 块，空态独立块，互斥落位不变） */}
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
