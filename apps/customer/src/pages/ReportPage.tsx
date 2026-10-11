/**
 * ReportPage · /philia/reports/:appointmentId 美容报告（补缺大批片 4）
 *
 * - 数据：serviceLoop.reportFor（首读幂等置 deliveredAt；无报告=server 404 明文透出）；
 * - 报告卡=体征五项表（label+值+三态 pill：正常=卡其浅底不设绿 / 注意=淡金 /
 *   异常=赭红）+ 异常提示卡（有 abnormalText 才显）+ 下次建议（有才显）
 *   + 「美容报告 30 分钟内送达」承诺行 + 生成/送达时刻 mono 留痕行；
 * - 体征 label 按 vital.key 走 copy 键（server 快照 label 兜底）；值缺省=「本次未记录」
 *   （server 留痕口径同词），不画假读数。
 *
 * 画布化（产品-1010 画布全屏批片 3 末片 · 工艺照 MePage/MallPage）：四块入册
 * （report.header/vitals/advice/promise），块序/显隐=useCanvasLayout('report')
 * （published→注册表默认序尾补，空=REPORT_DEFAULT_ORDER 兜底）；文案键挂 CK 锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记；带参屏预览特例：
 * canvasPreview=1 且路由参数==='preview' 时用报告列表既有查询 myReports 首条
 * appointmentId 顶替（零新增查询）。草案无 error 块——加载/失败态
 * 并入 report.header 块（页头裸段置顶惯例照 MePage：header 恒置顶，余块裹在报告卡内）。
 * 块内逻辑/查询零改动，data-testid 原值全保留。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { CanvasLayoutLoader, CK, friendlyError, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

/* 体征五项 key → copy 键 / 四态 → copy 键 + pill 样式（反馈件不设绿：正常=卡其浅底；
   补缺修复小批 UX 销项：unrecorded=未记录中性签（弱色无对勾），缺项不再挂「正常」） */
const VITAL_LABEL_KEY: Record<string, ServiceLoopCopyKey> = {
  weight: 'report.vitalWeight',
  skin: 'report.vitalSkin',
  ear: 'report.vitalEar',
  coat: 'report.vitalCoat',
  nail: 'report.vitalNail',
}
const VITAL_STATUS: Record<string, { key: ServiceLoopCopyKey; pill: string }> = {
  normal: { key: 'report.statusNormal', pill: 'bg-brand-secondary-light text-ink' },
  attention: { key: 'report.statusAttention', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  abnormal: { key: 'report.statusAbnormal', pill: 'bg-danger-light text-danger-deep' },
  unrecorded: { key: 'report.statusUnrecorded', pill: 'bg-sunken text-ink-placeholder' },
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const REPORT_DEFAULT_ORDER = ['report.header', 'report.vitals', 'report.advice', 'report.promise'] as const

export default function ReportPage() {
  const { appointmentId = '' } = useParams()
  const { trpc } = usePhiliaClient()

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 带参屏预览特例：?canvasPreview=1 且 :appointmentId==='preview'（预览 URL=/philia/reports/preview）
     时用报告列表既有查询 myReports 首条 appointmentId 顶替路由参数（零新增查询） */
  const previewFallback = isCanvasPreview && appointmentId === 'preview'
  const myReportsQ = useQuery({
    queryKey: ['serviceLoop', 'myReports'],
    queryFn: () => trpc.serviceLoop.myReports.query(),
    enabled: previewFallback,
  })
  const effAppointmentId = previewFallback ? (myReportsQ.data?.[0]?.appointmentId ?? '') : appointmentId

  const reportQ = useQuery({
    queryKey: ['serviceLoop', 'reportFor', effAppointmentId],
    queryFn: () => trpc.serviceLoop.reportFor.query({ appointmentId: effAppointmentId }),
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
  const reportStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'report')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : REPORT_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('report', reportStoreId, registryBlocks)

  const report = reportQ.data?.report ?? null

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. report.header：U1-A 统一返回条（←圆钮+标题），直访兜底回预约详情；
          草案无 error 块——加载/失败态并入本块（ErrorState message 为 string 入参无 CK 锚） */
    'report.header': () => (
      <>
        <PageHeader title={<CK k="report.title">{sl('report.title')}</CK>} fallback={`/appointments/${appointmentId}`} className="pt-6" />
        <div className="mt-4">
          {reportQ.isPending ? <LoadingBlock lines={3} /> : null}
          {reportQ.isError ? (
            <ErrorState
              message={friendlyError(reportQ.error, sl('report.loadFail'))}
              onRetry={() => void reportQ.refetch()}
            />
          ) : null}
        </div>
      </>
    ),

    /* 2. report.vitals：体征五项表（label+值+四态 pill；label/状态键动态 CK 锚） */
    'report.vitals': () => {
      if (!report) return null
      return (
        <>
          <h2 className="text-title"><CK k="report.vitalsTitle">{sl('report.vitalsTitle')}</CK></h2>
          <ul className="mt-2 divide-y divide-line-divider" data-testid="report-vitals">
            {report.vitals.map((v) => {
              const meta = VITAL_STATUS[v.status] ?? VITAL_STATUS.normal!
              const labelKey = VITAL_LABEL_KEY[v.key]
              return (
                <li key={v.key} className="flex items-center gap-2 py-2.5 text-body-sm">
                  <span className="w-10 shrink-0 text-ink-secondary">
                    {labelKey ? <CK k={labelKey}>{sl(labelKey)}</CK> : v.label}
                  </span>
                  <span className="u1-num min-w-0 flex-1 text-ink">
                    {v.value || <CK k="report.notRecorded">{sl('report.notRecorded')}</CK>}
                  </span>
                  <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
                    <CK k={meta.key}>{sl(meta.key)}</CK>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )
    },

    /* 3. report.advice：异常提示卡（有 abnormalText 才显）+ 下次护理建议（有才显） */
    'report.advice': () => {
      if (!report) return null
      return (
        <>
          {report.abnormalText ? (
            <p
              className="mt-3 rounded-control bg-danger-light px-3.5 py-2.5 text-caption text-danger-deep"
              data-testid="report-abnormal"
            >
              <span className="font-semibold"><CK k="report.abnormalTitle">{sl('report.abnormalTitle')}</CK>：</span>
              {report.abnormalText}
            </p>
          ) : null}
          {report.nextAdvice ? (
            <div className="mt-3 rounded-control bg-sunken px-3.5 py-2.5">
              <p className="text-caption font-semibold text-ink"><CK k="report.nextAdviceTitle">{sl('report.nextAdviceTitle')}</CK></p>
              <p className="mt-1 text-caption text-ink-secondary">{report.nextAdvice}</p>
            </div>
          ) : null}
        </>
      )
    },

    /* 4. report.promise：承诺行 + 生成/送达时刻 mono 留痕 */
    'report.promise': () => {
      if (!report) return null
      return (
        <>
          <p className="mt-4 text-center text-caption-xs text-ink-placeholder" data-testid="report-promise">
            <CK k="report.promiseLine">{sl('report.promiseLine')}</CK>
          </p>
          <p className="u1-num mt-1 text-center text-caption-xs text-ink-placeholder">
            <CK k="report.traceLine">
              {sl('report.traceLine', {
                generatedAt: fmtDateTime(report.generatedAt),
                deliveredAt: fmtDateTime(report.deliveredAt),
              })}
            </CK>
          </p>
        </>
      )
    },
  }

  return (
    <CanvasLayoutLoader pageKey="report" storeId={reportStoreId}>
      <div className="px-4 pb-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-3 text-center text-caption-xs text-ink-secondary" data-testid="report-canvas-preview-note">
            <CK k="mc.canvasExampleNote">{mc('mc.canvasExampleNote')}</CK>
          </p>
        ) : null}
        {/* 页头裸段置顶惯例照 MePage：header 恒置顶不参与拖序；余块裹在报告卡内
            （报告卡=单卡容器，vitals/advice/promise 为其内分块，包层 section 无样式不改落位） */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'report.header' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        {report ? (
          <section className="mt-4 rounded-card bg-card p-4 shadow-card" data-testid="report-card">
            {layout.map((b) =>
              b.visible && b.blockKey !== 'report.header' ? (
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
