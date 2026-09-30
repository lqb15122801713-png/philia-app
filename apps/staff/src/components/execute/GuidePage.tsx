import type { LucideIcon } from 'lucide-react'

export interface GuidePageProps {
  icon: LucideIcon
  title: string
  description?: string
  actionText?: string
  onAction?: () => void
}

/** 异常态引导页（未核销 / 已完成 / 已取消 / 无权限 / 寄养单）：大图标 + 说明 + 出口按钮
 *  换皮批片 5 P3-3（34 号档 §4.11 空态件=深棕钮）：出口钮淡金→深棕墨底淡金字
 *  （bg-ink + text-brand-primary，ExecutePage「服务中」chip 同族件口径）；本组件仅服务
 *  引导/异常态（返回任务台/回到任务台/重试/前往入住登记），无主行动场景引用 */
export default function GuidePage({ icon: Icon, title, description, actionText, onAction }: GuidePageProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken">
        <Icon className="h-9 w-9 text-ink-secondary" strokeWidth={1.5} />
      </div>
      <div className="mt-6 text-title-lg text-ink">{title}</div>
      {description && <div className="mt-2 text-body-sm text-ink-secondary">{description}</div>}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-8 h-14 min-h-[56px] w-full max-w-xs rounded-control bg-ink text-body-sm font-semibold text-brand-primary transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          {actionText}
        </button>
      )}
    </div>
  )
}
