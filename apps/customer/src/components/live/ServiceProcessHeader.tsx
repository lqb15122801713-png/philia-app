import type { ServiceProcessModel } from './serviceProcessModel'

interface ServiceProcessHeaderProps {
  petName: string
  serviceName: string
  meta: string
  model: ServiceProcessModel
  nowLabel: string | null
}

export default function ServiceProcessHeader({
  petName,
  serviceName,
  meta,
  model,
  nowLabel,
}: ServiceProcessHeaderProps) {
  const statusLabel = model.viewState === 'completed' ? '已完成' : model.viewState === 'not-started' ? '未开始' : '服务进行中'

  return (
    <section
      data-testid="service-process-header"
      data-view-state={model.viewState}
      className="rounded-card bg-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded-tag px-2 py-1 text-caption font-medium ${
            model.viewState === 'in-progress' ? 'bg-brand-primary-light text-ink' : 'bg-sunken text-ink-secondary'
          }`}
        >
          {statusLabel}
        </span>
        <span className="font-number text-caption text-ink">节点 {model.nodeCount}/6</span>
      </div>
      <h2 className="mt-2 text-title font-semibold">{petName} · {serviceName}</h2>
      <p className="mt-1 text-caption text-ink-secondary">{meta}</p>
      {nowLabel ? (
        <span
          data-cream="now"
          className="mt-2 inline-flex rounded-tag bg-brand-primary px-2.5 py-1 text-caption font-semibold text-ink"
        >
          {nowLabel}
        </span>
      ) : null}
    </section>
  )
}
