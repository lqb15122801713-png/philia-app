/**
 * CertListPage · /philia/certs 安心证书列表（补缺大批片 4）
 *
 * - 数据：serviceLoop.myCertificates（本人证书，生成时间倒序，上限 50）；
 * - 行=缩略图（payload.afterUrl）+ 宠物名/服务/门店 + 完成时刻 mono；
 *   点击进 /philia/certs/:appointmentId 详情卡；
 * - R10：证书=server confirmStep 末步真生成（无前后对比照不落行），本页只读真数据，
 *   无数据=空态三句话（出口=服务相册 /philia/moments），不画假证书。
 *
 * 画布化（产品-1010 画布全屏批片 3 末片 · 工艺照 MePage/MallPage）：四块入册
 * （certList.header/list/empty/error），块序/显隐=useCanvasLayout('certList')
 * （published→注册表默认序尾补，空=CERT_LIST_DEFAULT_ORDER 兜底）；文案键挂
 * CK(data-copy-key) 点选反查锚；预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。
 * 块内逻辑/查询零改动，data-testid 原值全保留；EmptyState title/ErrorState message
 * 为 string 入参挂不上 CK（组件内无 CK 锚，键如实入块 copyKeys）。
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
import { customerPetName } from '@/lib/customerPresentation'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const CERT_LIST_DEFAULT_ORDER = ['certList.header', 'certList.list', 'certList.empty', 'certList.error'] as const

export default function CertListPage() {
  const { trpc } = usePhiliaClient()
  const certsQ = useQuery({
    queryKey: ['serviceLoop', 'myCertificates'],
    queryFn: () => trpc.serviceLoop.myCertificates.query(),
  })

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（同 MePage/MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，照解析供 useCanvasLayout/Loader） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const certListStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'certList')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : CERT_LIST_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('certList', certListStoreId, registryBlocks)

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. certList.header：U1-A 统一返回条（←圆钮+标题），固定返回 philia 页 */
    'certList.header': () => (
      <PageHeader title={<CK k="cert.listTitle">{sl('cert.listTitle')}</CK>} fallback="/philia" className="pt-6" />
    ),

    /* 2. certList.list：加载占位 + 证书行列表（缩略图 alt 走 album.photoAlt 键，alt 属性位无 CK 锚） */
    'certList.list': () => (
      <>
        {certsQ.isPending ? (
          <div className="mt-4">
            <LoadingBlock lines={3} />
          </div>
        ) : null}
        {certsQ.data && certsQ.data.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3" data-testid="cert-list">
            {certsQ.data.map((cert) => (
              <li key={cert.id}>
                <Link
                  to={`/philia/certs/${cert.appointmentId}`}
                  data-testid={`cert-item-${cert.appointmentId}`}
                  className="u1-ring flex items-center gap-3 rounded-card bg-card p-3 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                >
                  <img
                    src={cert.payload.afterUrl}
                    alt={sl('album.photoAlt', { pet: customerPetName(cert.payload.petName) })}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-control object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold">
                      {customerPetName(cert.payload.petName)} · {cert.payload.serviceName}
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-ink-secondary">
                      {cert.payload.storeName}
                    </span>
                    <span className="u1-num mt-0.5 block text-caption-xs text-ink-placeholder">
                      {fmtDateTime(new Date(cert.payload.completedAt))}
                    </span>
                  </span>
                  <span className="shrink-0 text-caption text-ink-placeholder">›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </>
    ),

    /* 3. certList.empty：空态三句话（出口=服务相册；EmptyState title 为 string 入参无 CK 锚） */
    'certList.empty': () =>
      certsQ.data && certsQ.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={sl('cert.emptyTitle')}
            desc={<CK k="cert.emptyBody">{sl('cert.emptyBody')}</CK>}
            action={
              /* §4.11 空态出口钮=深棕墨底淡字 */
              <Link
                to="/philia/moments"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="cert.emptyCta">{sl('cert.emptyCta')}</CK>
              </Link>
            }
          />
        </div>
      ) : null,

    /* 4. certList.error：失败态（ErrorState message 为 string 入参无 CK 锚） */
    'certList.error': () =>
      certsQ.isError ? (
        <div className="mt-4">
          <ErrorState message={sl('cert.loadFail')} onRetry={() => void certsQ.refetch()} />
        </div>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="certList" storeId={certListStoreId}>
      <div className="px-4 pb-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-3 text-center text-caption-xs text-ink-secondary" data-testid="certs-canvas-preview-note">
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
