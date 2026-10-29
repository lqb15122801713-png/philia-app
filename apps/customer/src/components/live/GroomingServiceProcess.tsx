import { format, isToday, isYesterday } from 'date-fns'
import { Check, ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PhotoWallPhoto } from '@philia/shared'
import ClientTabBar from './ClientTabBar'
import ServiceProcessHeader from './ServiceProcessHeader'
import ServiceProcessTimeline from './ServiceProcessTimeline'
import { buildServiceProcessModel, type ServiceProcessModel, type ServiceProcessStep } from './serviceProcessModel'
import type { ServiceProcessPreviewAppointment, ServiceProcessPreviewState } from './serviceProcessPreview'
import { customerPetName } from '@/lib/customerPresentation'

export interface ServiceProcessLayoutBlock {
  blockKey: string
  visible: boolean
}

const DEFAULT_LAYOUT: ServiceProcessLayoutBlock[] = [
  { blockKey: 'apptLive.header', visible: true },
  { blockKey: 'apptLive.incident', visible: true },
  { blockKey: 'apptLive.stepper', visible: true },
  { blockKey: 'apptLive.boardingStay', visible: true },
  { blockKey: 'apptLive.review', visible: true },
  { blockKey: 'apptLive.contact', visible: true },
]

interface GroomingServiceProcessProps {
  appointment: ServiceProcessPreviewAppointment
  petName: string
  serviceName: string
  storeName: string
  steps: ServiceProcessStep[]
  stepsLoading: boolean
  stepsError?: boolean
  onRetrySteps?: () => void
  previewState?: ServiceProcessPreviewState
  layout?: ServiceProcessLayoutBlock[]
  isPreview?: boolean
  fallbackPath: string
  previewNote?: ReactNode
  incident?: ReactNode
  review?: ReactNode
  contact?: ReactNode
  onOpenPhotos: (photos: PhotoWallPhoto[], index: number) => void
}

function ProcessBackButton({ fallbackPath }: { fallbackPath: string }) {
  const navigate = useNavigate()
  const onBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (index > 0) navigate(-1)
    else navigate(fallbackPath)
  }
  return (
    <button
      type="button"
      aria-label="返回预约详情"
      data-testid="page-back"
      onClick={onBack}
      className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full text-ink"
    >
      <ChevronLeft className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
    </button>
  )
}

function dayTime(value: Date) {
  if (isToday(value)) return `今天 ${format(value, 'HH:mm')}`
  if (isYesterday(value)) return `昨天 ${format(value, 'HH:mm')}`
  return format(value, 'M月d日 HH:mm')
}

function photosComplete(node: ServiceProcessModel['nodes'][number]) {
  return node.photos.length > 0 && node.photos.length >= node.requiredPhotos
}

function summaryMeta(
  appointment: ServiceProcessPreviewAppointment,
  storeName: string,
  model: ServiceProcessModel,
  previewState?: ServiceProcessPreviewState,
) {
  if (model.viewState === 'not-started') return `${dayTime(appointment.scheduledStart)} · ${storeName}`
  if (model.viewState === 'completed') return `${storeName} · ${dayTime(appointment.completedAt ?? appointment.scheduledEnd)} 结束`
  if (previewState === 'expanded') return `${storeName} · 展开查看交付照`
  const currentNode = model.nodes.find((node) => node.key === model.currentNodeKey)
  if (previewState === 'step-empty') {
    return `${storeName} · ${currentNode && !photosComplete(currentNode) ? '造型步照片待齐' : '展开查看交付照'}`
  }
  return `${storeName} · 预计 ${format(appointment.scheduledEnd, 'HH:mm')} 完成`
}

function nowLabel(model: ServiceProcessModel, previewState?: ServiceProcessPreviewState) {
  if (model.viewState === 'completed') return null
  if (model.viewState === 'not-started') return '此刻 已下单 · 候场'
  if (model.currentNodeKey === 'wash') return `此刻 洗护中 · ${previewState === 'expanded' ? '过程照已出' : '吹干定型'}`
  if (model.currentNodeKey === 'styling') {
    const node = model.nodes.find((item) => item.key === 'styling')
    return `此刻 美容造型 · ${node && photosComplete(node) ? '过程照已出' : '图未齐'}`
  }
  if (model.currentNodeKey === 'pickup') return '此刻 待接回 · 交付检查'
  return null
}

export default function GroomingServiceProcess({
  appointment,
  petName,
  serviceName,
  storeName,
  steps,
  stepsLoading,
  stepsError = false,
  onRetrySteps,
  previewState,
  layout = DEFAULT_LAYOUT,
  isPreview = false,
  fallbackPath,
  previewNote,
  incident,
  review,
  contact,
  onOpenPhotos,
}: GroomingServiceProcessProps) {
  const model = buildServiceProcessModel({ appointment, steps })
  const completed = model.viewState === 'completed'
  const notStarted = model.viewState === 'not-started'
  const initialExpandedKey = previewState === 'expanded' ? 'wash' : previewState === 'step-empty' ? 'styling' : undefined
  const displayPetName = customerPetName(petName)
  const sections: Record<string, ReactNode> = {
    'apptLive.header': (
      <>
        <header className="relative mb-3 flex h-10 items-center justify-center">
          <ProcessBackButton fallbackPath={fallbackPath} />
          <h1 className="text-body font-semibold">{displayPetName} · 洗护过程</h1>
        </header>
        <ServiceProcessHeader
          petName={displayPetName}
          serviceName={serviceName}
          meta={summaryMeta(appointment, storeName, model, previewState)}
          model={model}
          nowLabel={nowLabel(model, previewState)}
        />
        {notStarted ? (
          <section className="mt-3 rounded-card bg-sunken px-4 py-3">
            {/* PD-75（HP-CLIENT-06）：去规格溯源口吻「入口来自…」，只留人话 */}
            <h2 className="text-body font-semibold">到店后会自动推进</h2>
          </section>
        ) : null}
        {completed ? (
          <p className="mt-2 flex items-center gap-2 rounded-tag bg-sunken px-4 py-2.5 text-body font-medium">
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            洗护完成，感谢信任
          </p>
        ) : null}
      </>
    ),
    'apptLive.incident': incident ?? null,
    'apptLive.stepper': (
      <div className="mt-2">
        {stepsError ? (
          <div role="alert" className="rounded-card bg-card p-6 text-center shadow-card">
            <p className="text-body font-semibold">服务进度暂时没有同步</p>
            <p className="mt-1 text-caption text-ink-secondary">请检查网络后重试</p>
            <button
              type="button"
              onClick={onRetrySteps}
              className="mt-3 min-h-10 rounded-input bg-brand-cta px-5 text-body font-semibold text-brand-cta-on"
            >
              重新加载
            </button>
          </div>
        ) : stepsLoading ? (
          <div className="rounded-card bg-card p-6 text-center shadow-card">
            <p className="text-caption text-ink-secondary">正在接入服务进度…</p>
          </div>
        ) : (
          <ServiceProcessTimeline
            key={`${model.viewState}-${model.currentNodeKey ?? 'none'}`}
            model={model}
            initialExpandedKey={initialExpandedKey}
            previewState={previewState === 'expanded' || previewState === 'step-empty' ? previewState : undefined}
            onOpenPhotos={onOpenPhotos}
          />
        )}
      </div>
    ),
    'apptLive.boardingStay': null,
    'apptLive.review': (
      <>
        {completed ? (
          <section className="mt-2 rounded-card bg-card p-3 shadow-card">
            <h2 className="text-title font-semibold">美容报告</h2>
            <p className="mt-1 text-caption text-ink-secondary">摘要与前后对比可在此查看（摄影待换）</p>
            <Link
              to={`/philia/reports/${appointment.id}`}
              className="mt-2 flex min-h-11 items-center justify-center rounded-input bg-brand-cta px-4 text-body font-semibold text-brand-cta-on"
            >
              查看美容报告
            </Link>
          </section>
        ) : null}
        {!isPreview ? review : null}
      </>
    ),
    'apptLive.contact': !isPreview ? contact : null,
  }

  return (
    <div data-testid="grooming-service-process" className="px-4 pb-28 pt-4">
      {previewNote}
      {layout.map((block) => block.visible ? (
        <section data-block-key={block.blockKey} key={block.blockKey}>
          {sections[block.blockKey] ?? null}
        </section>
      ) : null)}
      <ClientTabBar />
    </div>
  )
}
