/**
 * CertDetailPage · /philia/certs/:appointmentId 安心证书详情卡（补缺大批片 4）
 *
 * - 数据：serviceLoop.certificateFor（首读幂等置 deliveredAt；无证书=server 404 明文
 *   「该服务未生成证书（无前后对比照）」，错误态原文透出 + 返回出口）；
 * - 卡面=PHILIA 卡：宠物名 serif + 服务 + 门店 + 完成时刻 + 六步摘要行（步名+张数）
 *   + before/after 对比图并排（PhotoWall before_after 模式）+ 全屏查看器；
 * - 留痕行 mono：「生成于 {generatedAt} · 送达 {deliveredAt}」（R10 真数据）。
 *
 * 画布化（产品-1010 画布全屏批片 3 末片 · 工艺照 MePage/MallPage）：三块入册
 * （certDetail.header/card/error），块序/显隐=useCanvasLayout('certDetail')
 * （published→注册表默认序尾补，空=CERT_DETAIL_DEFAULT_ORDER 兜底）；文案键挂 CK 锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记；带参屏预览特例：
 * canvasPreview=1 且路由参数==='preview' 时用列表既有查询 myCertificates 首条
 * appointmentId 顶替（零新增查询）；查不到=候裁清零批件 6 屏内合成示例证书顶替
 * （预览专属，零真数据零写库）。全屏 PhotoViewer=弹层件不入块流，照改造前位置挂载。
 * 块内逻辑/查询零改动，data-testid 原值全保留。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CanvasLayoutLoader, CK, PhotoViewer, PhotoWall, friendlyError, useCanvasLayout, usePhiliaClient, type PhotoWallPhoto } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
import { sl } from '@/copy/serviceloop'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const CERT_DETAIL_DEFAULT_ORDER = ['certDetail.header', 'certDetail.card', 'certDetail.error'] as const

type CertData = NonNullable<
  Awaited<ReturnType<ReturnType<typeof usePhiliaClient>['trpc']['serviceLoop']['certificateFor']['query']>>['certificate']
>

/* 候裁清零批 件 6（预览兜底示例·客户端合成件）：canvasPreview=1 且 'preview' 顶替查不到
   真证书时，用屏内合成示例证书渲染块流（假名「示例单·画布预览」系，时刻=固定示例值；
   对比图=本地品牌占位图，零真数据零写库，水印注记页首已有）。真用户页零改动 */
function exampleCertOf(): CertData {
  const generatedAt = new Date('2026-10-01T15:30:00')
  return {
    id: 'canvas-example-cert',
    appointmentId: 'canvas-example-appt',
    userId: 'canvas-example-customer',
    payload: {
      petName: '示例宠物·画布预览',
      serviceName: '示例洗护·画布预览',
      storeName: '示例门店·画布预览',
      completedAt: '2026-10-01T15:30:00',
      stepsSummary: [
        { stepKey: 'disinfection', label: '消毒', photoCount: 1 },
        { stepKey: 'precheck', label: '预检', photoCount: 1 },
        { stepKey: 'grooming', label: '洗护', photoCount: 2 },
        { stepKey: 'detail', label: '精修', photoCount: 1 },
        { stepKey: 'before_after', label: '前后对比', photoCount: 2 },
        { stepKey: 'confirm', label: '确认', photoCount: 0 },
      ],
      beforeUrl: '/brand/empty-appointments-800.png',
      afterUrl: '/brand/empty-appointments-800.png',
    },
    generatedAt,
    deliveredAt: generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  } as CertData
}

export default function CertDetailPage() {
  const { appointmentId = '' } = useParams()
  const { trpc } = usePhiliaClient()
  const [viewing, setViewing] = useState<PhotoWallPhoto | null>(null)

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 带参屏预览特例：?canvasPreview=1 且 :appointmentId==='preview'（预览 URL=/philia/certs/preview）
     时用本屏列表既有查询 myCertificates 首条顶替路由参数（零新增查询）；
     查不到=件 6 合成示例证书顶替（certQ 不拉取），不再落空态 */
  const previewFallback = isCanvasPreview && appointmentId === 'preview'
  const certsQ = useQuery({
    queryKey: ['serviceLoop', 'myCertificates'],
    queryFn: () => trpc.serviceLoop.myCertificates.query(),
    enabled: previewFallback,
  })
  const effAppointmentId = previewFallback ? (certsQ.data?.[0]?.appointmentId ?? '') : appointmentId
  /* 件 6：预览顶替未命中（列表查询已完成但首条为空）→ 合成示例证书（零真数据零写库） */
  const previewMiss = previewFallback && !certsQ.isPending && effAppointmentId === ''

  const certQ = useQuery({
    queryKey: ['serviceLoop', 'certificateFor', effAppointmentId],
    queryFn: () => trpc.serviceLoop.certificateFor.query({ appointmentId: effAppointmentId }),
    enabled: effAppointmentId.length > 0,
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
  const certDetailStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'certDetail')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : CERT_DETAIL_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('certDetail', certDetailStoreId, registryBlocks)

  const cert = (previewMiss ? exampleCertOf() : certQ.data?.certificate) ?? null
  const compare: PhotoWallPhoto[] = cert
    ? [
        { id: `${cert.appointmentId}-before`, url: cert.payload.beforeUrl },
        { id: `${cert.appointmentId}-after`, url: cert.payload.afterUrl },
      ]
    : []

  /* 块渲染器（块内逻辑零改动——三块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. certDetail.header：U1-A 统一返回条（←圆钮+标题），固定返回证书列表 */
    'certDetail.header': () => (
      <PageHeader title={<CK k="cert.cardTitle">{sl('cert.cardTitle')}</CK>} fallback="/philia/certs" className="pt-6" />
    ),

    /* 2. certDetail.card：加载占位 + PHILIA 证书卡（卡面头/对比图/六步摘要/留痕行逐字搬；
          件 6：previewMiss 合成示例态不挂加载占位——certQ 未启用恒 pending，直接渲染示例卡） */
    'certDetail.card': () => (
      <>
        {certQ.isPending && !previewMiss ? (
          <div className="mt-4">
            <LoadingBlock lines={3} />
          </div>
        ) : null}
        {cert ? (
          <section className="u1-ring mt-4 rounded-panel bg-card p-5" data-testid="cert-card">
            {/* PHILIA 卡面头：品牌 mono + 宠物名 serif */}
            <p className="u1-num text-center text-caption-xs tracking-[0.3em] text-ink-placeholder">
              <CK k="cert.brandMark">{sl('cert.brandMark')}</CK>
            </p>
            <h2 className="u1-serif mt-2 text-center text-title-lg font-black">{cert.payload.petName}</h2>
            <p className="mt-1 text-center text-caption text-ink-secondary">
              {cert.payload.serviceName} · {cert.payload.storeName}
            </p>
            <p className="u1-num mt-1 text-center text-caption-xs text-ink-placeholder">
              {fmtDateTime(new Date(cert.payload.completedAt))}
            </p>

            {/* before/after 对比图并排（点击进全屏查看器） */}
            <div className="mt-4">
              <PhotoWall photos={compare} stepKey="before_after" onPhotoClick={(p) => setViewing(p)} />
            </div>

            {/* 六步摘要行（步名 + 张数，真数据快照） */}
            <ul className="mt-4 divide-y divide-line-divider border-t border-line-divider">
              {cert.payload.stepsSummary.map((s) => (
                <li key={s.stepKey} className="flex items-center justify-between py-2 text-caption">
                  <span className="text-ink-secondary">{s.label}</span>
                  <span className="u1-num text-ink-placeholder">
                    <CK k="cert.stepPhotos">{sl('cert.stepPhotos', { count: s.photoCount })}</CK>
                  </span>
                </li>
              ))}
            </ul>

            {/* 留痕行（mono）：生成/送达时刻 */}
            <p className="u1-num mt-4 text-center text-caption-xs text-ink-placeholder" data-testid="cert-trace">
              <CK k="cert.traceLine">
                {sl('cert.traceLine', {
                  generatedAt: fmtDateTime(cert.generatedAt),
                  deliveredAt: fmtDateTime(cert.deliveredAt),
                })}
              </CK>
            </p>
          </section>
        ) : null}
      </>
    ),

    /* 3. certDetail.error：失败态（server 404 明文透出 + 返回出口；ErrorState message
          为 string 入参无 CK 锚，backList 出口钮挂 CK） */
    'certDetail.error': () =>
      certQ.isError ? (
        <div className="mt-4">
          <ErrorState
            message={friendlyError(certQ.error, sl('cert.loadFail'))}
            onRetry={() => void certQ.refetch()}
            action={
              <Link
                to="/philia/certs"
                className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="cert.backList">{sl('cert.backList')}</CK>
              </Link>
            }
          />
        </div>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="certDetail" storeId={certDetailStoreId}>
      <div className="px-4 pb-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-3 text-center text-caption-xs text-ink-secondary" data-testid="cert-canvas-preview-note">
            <CK k="mc.canvasExampleNote">{mc('mc.canvasExampleNote')}</CK>
          </p>
        ) : null}
        {/* 块流：三块按有效布局渲染（隐藏块整段不渲染）；默认序下块内 JSX 与改造前逐字一致 */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
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
