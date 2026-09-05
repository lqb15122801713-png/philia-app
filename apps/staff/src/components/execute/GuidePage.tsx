import type { LucideIcon } from 'lucide-react'

export interface GuidePageProps {
  icon: LucideIcon
  title: string
  description?: string
  actionText?: string
  onAction?: () => void
}

/** 异常态引导页（未核销 / 已完成 / 已取消 / 无权限 / 寄养单）：大图标 + 说明 + 主按钮 */
export default function GuidePage({ icon: Icon, title, description, actionText, onAction }: GuidePageProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken">
        <Icon className="h-9 w-9 text-ink-secondary" strokeWidth={1.5} />
      </div>
      <div className="mt-6 text-title-lg text-ink">{title}</div>
      {description && <div className="mt-2 text-body-lg text-ink-secondary">{description}</div>}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-8 h-14 w-full max-w-xs rounded-full bg-brand-primary text-body-lg font-semibold text-white shadow-card active:scale-92 duration-120"
        >
          {actionText}
        </button>
      )}
    </div>
  )
}
