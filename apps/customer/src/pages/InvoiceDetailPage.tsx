/**
 * InvoiceDetailPage · /invoices/:id 发票申请详情（补缺大批片 4）
 *
 * - 数据：serviceLoop.invoiceGet（本人校验，他人 403 明文透出）；
 * - 件=表单回显（申请单号/来源单号/类型/金额 mono/抬头类型/抬头/税号/送达方式/邮箱）
 *   + 状态 pill（申请中/已开具）+ 申请时刻 mono；issued 态回显实际发票号
 *   issuedInvoiceNo + issuedAt mono（商家 register 登记真值）。
 *
 * 画布化（产品-1010 画布全屏批片 3 末片 · 工艺照 MePage/MallPage）：三块入册
 * （inv.detailhead/detail/issued），块序/显隐=useCanvasLayout('invoiceDetail')
 * （published→注册表默认序尾补，空=INVOICE_DETAIL_DEFAULT_ORDER 兜底）；文案键挂
 * CK 锚；预览=CanvasLayoutLoader+?canvasPreview=1 水印注记；带参屏预览特例：
 * canvasPreview=1 且路由参数==='preview'（预览 URL=/invoices/preview）时用列表
 * 既有查询 invoiceListMine 首条 id 顶替（零新增查询）。草案无 error 块——加载/失败态
 * 并入 inv.detailhead 块（页头裸段置顶惯例照 MePage：detailhead 恒置顶，detail/issued
 * 裹在回显卡内）。申请时刻 mono 行（inv.appliedAt）原位于已开具盒之后，随 issued 块尾
 * 保持改造前相对序。块内逻辑/查询零改动，data-testid 原值全保留。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CanvasLayoutLoader, CK, friendlyError, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fenToYuan, fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

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
const INVOICE_DETAIL_DEFAULT_ORDER = ['inv.detailhead', 'inv.detail', 'inv.issued'] as const

export default function InvoiceDetailPage() {
  const { id = '' } = useParams()
  const { trpc } = usePhiliaClient()

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 带参屏预览特例：?canvasPreview=1 且 :id==='preview'（预览 URL=/invoices/preview）
     时用本屏列表既有查询 invoiceListMine 首条 id 顶替路由参数（零新增查询） */
  const previewFallback = isCanvasPreview && id === 'preview'
  const invoicesQ = useQuery({
    queryKey: ['serviceLoop', 'invoiceListMine'],
    queryFn: () => trpc.serviceLoop.invoiceListMine.query(),
    enabled: previewFallback,
  })
  const effId = previewFallback ? (invoicesQ.data?.[0]?.id ?? '') : id

  const invoiceQ = useQuery({
    queryKey: ['serviceLoop', 'invoiceGet', effId],
    queryFn: () => trpc.serviceLoop.invoiceGet.query({ requestId: effId }),
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
  const invoiceDetailStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'invoiceDetail')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : INVOICE_DETAIL_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('invoiceDetail', invoiceDetailStoreId, registryBlocks)

  const req = invoiceQ.data?.request ?? null
  const meta = req ? (STATUS_META[req.status] ?? STATUS_META.submitted!) : null

  /* 块渲染器（块内逻辑零改动——三块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. inv.detailhead：U1-A 统一返回条（←圆钮+标题），固定返回发票列表；
          草案无 error 块——加载/失败态并入本块（ErrorState message 为 string 入参无 CK 锚，
          backList 出口钮挂 CK） */
    'inv.detailhead': () => (
      <>
        <PageHeader title={<CK k="inv.detailTitle">{sl('inv.detailTitle')}</CK>} fallback="/invoices" className="pt-6" />
        <div className="mt-4">
          {invoiceQ.isPending ? <LoadingBlock lines={3} /> : null}
          {invoiceQ.isError ? (
            <ErrorState
              message={friendlyError(invoiceQ.error, sl('inv.loadFail'))}
              onRetry={() => void invoiceQ.refetch()}
              action={
                <Link
                  to="/invoices"
                  className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  <CK k="inv.backList">{sl('inv.backList')}</CK>
                </Link>
              }
            />
          ) : null}
        </div>
      </>
    ),

    /* 2. inv.detail：申请信息回显（类型+状态 pill 头行 + 表单回显 dl；单号/金额/税号/
          邮箱等读数据不抽键） */
    'inv.detail': () => {
      if (!req || !meta) return null
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-body-sm font-semibold"><CK k={KIND_LABEL[req.orderKind] ?? 'inv.kindOrder'}>{sl(KIND_LABEL[req.orderKind] ?? 'inv.kindOrder')}</CK></p>
            <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
              <CK k={meta.key}>{sl(meta.key)}</CK>
            </span>
          </div>

          {/* 表单回显 */}
          <dl className="mt-3 space-y-1.5 border-t border-line-divider pt-3 text-body-sm">
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="inv.billNo">{sl('inv.billNo')}</CK></dt>
              <dd className="font-number">{req.billNo}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="inv.amountLabel">{sl('inv.amountLabel')}</CK></dt>
              <dd className="font-number font-semibold text-ink">{fenToYuan(req.amountFen)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="inv.titleTypeLabel">{sl('inv.titleTypeLabel')}</CK></dt>
              <dd>{req.titleType === 'business' ? <CK k="inv.titleBusiness">{sl('inv.titleBusiness')}</CK> : <CK k="inv.titlePersonal">{sl('inv.titlePersonal')}</CK>}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink-secondary"><CK k="inv.titleLabel">{sl('inv.titleLabel')}</CK></dt>
              <dd className="text-right">{req.title}</dd>
            </div>
            {req.titleType === 'business' && req.taxNo ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary"><CK k="inv.taxNoLabel">{sl('inv.taxNoLabel')}</CK></dt>
                <dd className="font-number">{req.taxNo}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="inv.deliveryLabel">{sl('inv.deliveryLabel')}</CK></dt>
              <dd>{req.delivery === 'email' ? <CK k="inv.deliveryEmail">{sl('inv.deliveryEmail')}</CK> : <CK k="inv.deliveryPickup">{sl('inv.deliveryPickup')}</CK>}</dd>
            </div>
            {req.delivery === 'email' && req.email ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary"><CK k="inv.emailLabel">{sl('inv.emailLabel')}</CK></dt>
                <dd className="font-number">{req.email}</dd>
              </div>
            ) : null}
          </dl>
        </>
      )
    },

    /* 3. inv.issued：已开具回显区（实际发票号 + 开具时刻 mono，issued 态才显）
          + 申请单号/申请时刻 mono 行（原位于已开具盒之后，随本块尾保持相对序） */
    'inv.issued': () => {
      if (!req) return null
      return (
        <>
          {req.status === 'issued' && req.issuedInvoiceNo ? (
            <div className="mt-3 rounded-control bg-brand-secondary-light px-3.5 py-2.5" data-testid="invoice-issued-no">
              <p className="text-caption text-ink-secondary"><CK k="inv.issuedNoLabel">{sl('inv.issuedNoLabel')}</CK></p>
              <p className="u1-num mt-0.5 text-body-sm font-semibold text-ink">{req.issuedInvoiceNo}</p>
              {req.issuedAt ? (
                <p className="u1-num mt-1 text-caption-xs text-ink-placeholder">
                  <CK k="inv.issuedAtLine">{sl('inv.issuedAtLine', { time: fmtDateTime(req.issuedAt) })}</CK>
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="u1-num mt-3 text-caption-xs text-ink-placeholder">
            {req.invoiceNo} · <CK k="inv.appliedAt">{sl('inv.appliedAt', { time: fmtDateTime(req.createdAt) })}</CK>
          </p>
        </>
      )
    },
  }

  return (
    <CanvasLayoutLoader pageKey="invoiceDetail" storeId={invoiceDetailStoreId}>
      <div className="px-4 pb-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-3 text-center text-caption-xs text-ink-secondary" data-testid="invoice-canvas-preview-note">
            <CK k="mc.canvasExampleNote">{mc('mc.canvasExampleNote')}</CK>
          </p>
        ) : null}
        {/* 页头裸段置顶惯例照 MePage：detailhead 恒置顶不参与拖序；detail/issued 裹在
            回显卡内（单卡容器分块，包层 section 无样式不改落位） */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'inv.detailhead' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        {req && meta ? (
          <section className="u1-card mt-4 p-4" data-testid="invoice-detail">
            {layout.map((b) =>
              b.visible && b.blockKey !== 'inv.detailhead' ? (
                <section data-block-key={b.blockKey} key={b.blockKey}>
                  {renderers[b.blockKey]?.() ?? null}
                </section>
              ) : null,
            )}
          </section>
        ) : null}
      </div>
    </CanvasLayoutLoader>
  )
}
