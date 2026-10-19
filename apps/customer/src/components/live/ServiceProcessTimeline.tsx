import { format, isToday, isYesterday } from 'date-fns'
import { ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import type { PhotoWallPhoto } from '@philia/shared'
import type {
  ServiceProcessModel,
  ServiceProcessNode,
  ServiceProcessNodeKey,
} from './serviceProcessModel'

interface ServiceProcessTimelineProps {
  model: ServiceProcessModel
  initialExpandedKey?: ServiceProcessNodeKey
  previewState?: 'expanded' | 'step-empty'
  onOpenPhotos: (photos: PhotoWallPhoto[], index: number) => void
}

function nodeTime(node: ServiceProcessNode) {
  if (node.status === 'active' && node.key !== 'ordered') return '进行中'
  if (!node.time) return null
  if (isToday(node.time)) return `今天 ${format(node.time, 'HH:mm')}`
  if (isYesterday(node.time)) return `昨天 ${format(node.time, 'HH:mm')}`
  return format(node.time, 'M月d日 HH:mm')
}

function NodeMark({ node }: { node: ServiceProcessNode }) {
  if (node.status === 'done') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-cta text-brand-cta-on" aria-hidden="true">
        <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>
    )
  }
  if (node.status === 'active') {
    return (
      <span data-cream="now" className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary" aria-hidden="true">
        <span className="h-3 w-3 rounded-full bg-brand-cta" />
      </span>
    )
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line-divider bg-card" aria-hidden="true">
      <span className="h-1 w-1 rounded-full bg-line-divider" />
    </span>
  )
}

function activeDetail(node: ServiceProcessNode, currentInternalStepKey: string | null, expanded: boolean) {
  if (node.key === 'wash') {
    if (currentInternalStepKey !== 'grooming') return '门店正在完成洗护准备，可查看过程照'
    return expanded ? '本步说明：完成洗澡后进入吹干，毛发分区定型。' : '美容师正在吹干定型，可查看过程照'
  }
  if (node.key === 'styling') {
    const complete = node.photos.length > 0 && node.photos.length >= node.requiredPhotos
    return complete ? '精修剪裁与造型，可查看过程照' : '已进入美容造型，交付照还在补拍。'
  }
  if (node.key === 'pickup') return '交付检查进行中，前后对比照会在这里更新'
  return null
}

function Placeholder({ label, expanded }: { label: string; expanded: boolean }) {
  return (
    <span className={`flex ${expanded ? 'aspect-square' : 'h-[100px]'} flex-col items-center justify-center rounded-input bg-sunken px-1 text-center text-caption text-ink-secondary`}>
      <span>{label}</span>
      <span className="mt-1 text-caption text-ink-placeholder">待换</span>
    </span>
  )
}

function BeforeAfterGrid({
  photos,
  onOpenPhotos,
}: {
  photos: PhotoWallPhoto[]
  onOpenPhotos: (photos: PhotoWallPhoto[], index: number) => void
}) {
  const taggedBefore = photos.findIndex((photo) => photo.tag === 'before')
  const taggedAfter = photos.findIndex((photo) => photo.tag === 'after')
  const beforeIndex = taggedBefore >= 0 ? taggedBefore : taggedAfter === -1 ? 0 : -1
  const afterIndex = taggedAfter >= 0 ? taggedAfter : taggedBefore === -1 && photos.length > 1 ? 1 : -1
  const before = beforeIndex >= 0 ? photos[beforeIndex] : undefined
  const after = afterIndex >= 0 ? photos[afterIndex] : undefined
  if (!before && !after) return null
  const slots = [
    { photo: before, label: '服务前', index: beforeIndex },
    { photo: after, label: '服务后', index: afterIndex },
  ]
  return (
    <div data-testid="service-process-before-after" className="relative mt-3">
      <div className="grid grid-cols-2 gap-2">
        {slots.map(({ photo, label, index }) => photo ? (
          <button
            key={label}
            type="button"
            onClick={() => onOpenPhotos(photos, index)}
            className="relative block aspect-[4/3] w-full overflow-hidden rounded-input bg-sunken"
            aria-label={label}
          >
            <img src={photo.thumbUrl ?? photo.url} alt={label} loading="lazy" className="h-full w-full object-cover" />
            <span className={`absolute left-1.5 top-1.5 rounded-tag px-1.5 py-0.5 text-caption ${label === '服务前' ? 'bg-brand-secondary-light text-ink' : 'bg-brand-cta text-brand-cta-on'}`}>
              {label}
            </span>
          </button>
        ) : (
          <span key={label} className="flex aspect-[4/3] flex-col items-center justify-center rounded-input bg-sunken text-caption text-ink-secondary">
            <span>{label}</span>
            <span className="mt-1 text-caption text-ink-placeholder">待换</span>
          </span>
        ))}
      </div>
      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-card" aria-hidden="true">
        <ArrowRight className="h-3.5 w-3.5 text-brand-cta" strokeWidth={1.5} />
      </span>
    </div>
  )
}

function PhotoGrid({
  node,
  expanded,
  onOpenPhotos,
}: {
  node: ServiceProcessNode
  expanded: boolean
  onOpenPhotos: (photos: PhotoWallPhoto[], index: number) => void
}) {
  const placeholderLabels = expanded
    ? node.key === 'wash'
      ? ['吹干 ①', '吹干 ②', '细节']
      : node.key === 'styling'
        ? ['造型 ①', '造型 ②', '细节']
        : ['过程照', '待补', '细节']
    : ['过程照', '可展开']
  const visiblePhotoCount = Math.min(expanded ? 3 : 2, node.photos.length)
  const totalSlots = expanded ? Math.max(node.requiredPhotos, node.photos.length) : 2
  const visibleSlots = expanded ? Math.min(3, totalSlots) : 2
  const placeholderCount = Math.max(0, visibleSlots - visiblePhotoCount)
  const overflowCount = expanded ? Math.max(0, totalSlots - 3) : 0
  const cells = [
    ...node.photos.slice(0, visiblePhotoCount).map((photo) => ({ photo, label: '' })),
    ...Array.from({ length: placeholderCount }, (_, index) => ({
      photo: null,
      label: placeholderLabels[visiblePhotoCount + index] ?? '细节',
    })),
  ]

  return (
    <div
      data-testid="service-process-photo-grid"
      className={`mt-3 grid gap-2 ${expanded ? 'grid-cols-3' : 'grid-cols-2'}`}
    >
      {cells.map((cell, index) => (
        <span key={cell.photo?.id ?? `${node.key}-placeholder-${index}`} className="relative block">
          {cell.photo ? (
            <button
              type="button"
              onClick={() => onOpenPhotos(node.photos, index)}
              className={`${expanded ? 'aspect-square' : 'h-[100px]'} w-full overflow-hidden rounded-input bg-sunken`}
              aria-label={`查看过程照 ${index + 1}`}
            >
              <img
                src={cell.photo.thumbUrl ?? cell.photo.url}
                alt={`过程照 ${index + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <Placeholder label={cell.label} expanded={expanded} />
          )}
          {overflowCount > 0 && index === cells.length - 1 ? (
            <span data-testid="service-process-photo-overflow" className="absolute bottom-1 right-1 rounded-tag bg-ink/45 px-1.5 py-0.5 text-caption text-white">
              +{overflowCount}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  )
}

export default function ServiceProcessTimeline({
  model,
  initialExpandedKey,
  previewState,
  onOpenPhotos,
}: ServiceProcessTimelineProps) {
  const [expandedKey, setExpandedKey] = useState<ServiceProcessNodeKey | null>(
    initialExpandedKey ?? (model.currentNodeKey === 'styling' || model.currentNodeKey === 'pickup' ? model.currentNodeKey : null),
  )

  return (
    <section data-testid="service-process-timeline" data-canvas-interactive className="rounded-card bg-card p-4 shadow-card">
      <h2 className="border-b border-line-divider pb-2 text-caption text-ink-secondary">
        服务进度 · {model.viewState === 'completed' ? '六节点全完成' : '六节点'}
      </h2>
      <ol role="list" className="mt-1">
        {model.nodes.map((node, index) => {
          const isLast = index === model.nodes.length - 1
          const expanded = expandedKey === node.key
          const active = model.viewState === 'in-progress' && node.status === 'active'
          const expandable = active || node.photos.length > 0
          const time = nodeTime(node)
          const detail = active ? activeDetail(node, model.currentInternalStepKey, expanded) : null
          const showPhotos = expanded || (active && (node.key === 'wash' || node.photos.length > 0))
          const showEmpty = active && expanded && node.photos.length === 0 && previewState !== 'expanded'
          const row = (
            <>
              <span className={`text-body font-semibold ${node.status === 'locked' ? 'text-ink-placeholder' : 'text-ink'}`}>
                {node.name}
              </span>
              {time ? <span className="shrink-0 font-number text-caption text-ink-secondary">{time}</span> : null}
            </>
          )

          return (
            <li
              key={node.key}
              data-step-key={node.key}
              data-step-status={node.status}
              className="relative flex gap-3"
            >
              <div className="flex w-6 shrink-0 flex-col items-center">
                <NodeMark node={node} />
                {!isLast ? (
                  <span className={`min-h-4 w-0.5 flex-1 ${node.status === 'done' ? 'bg-brand-cta' : 'bg-line-divider'}`} aria-hidden="true" />
                ) : null}
              </div>
              <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-2.5'}`}>
                {expandable ? (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`service-process-panel-${node.key}`}
                    onClick={() => setExpandedKey(expanded ? null : node.key)}
                    className="flex min-h-6 w-full items-start justify-between gap-3 text-left"
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex min-h-6 items-start justify-between gap-3">{row}</div>
                )}
                <p className={`mt-0.5 text-caption ${node.status === 'locked' ? 'text-ink-placeholder' : 'text-ink-secondary'}`}>
                  {node.description}
                </p>
                <div id={`service-process-panel-${node.key}`}>
                  {detail ? <p className="mt-2 text-caption text-ink">{detail}</p> : null}
                  {showPhotos && !showEmpty ? (
                    node.key === 'pickup' && expanded ? (
                      <BeforeAfterGrid photos={node.photos} onOpenPhotos={onOpenPhotos} />
                    ) : (
                      <PhotoGrid node={node} expanded={expanded} onOpenPhotos={onOpenPhotos} />
                    )
                  ) : null}
                  {showEmpty ? (
                    <div data-testid="service-process-empty" className="mt-2 rounded-input bg-sunken px-4 py-4 text-center">
                      <p className="text-body font-semibold">本步照片尚未齐</p>
                      <p className="mt-1 text-caption text-ink-secondary">洗护师补拍后会在这里出现</p>
                      <button
                        type="button"
                        onClick={() => setExpandedKey(null)}
                        className="mt-2 min-h-9 rounded-full border border-line-divider bg-card px-4 text-caption text-ink-secondary"
                      >
                        稍后再看
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
