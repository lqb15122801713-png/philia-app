import type { LucideIcon } from 'lucide-react'
import { SkBtnInk } from '../skeleton'
import '../../styles/skeleton.css'

export interface GuidePageProps {
  icon: LucideIcon
  title: string
  description?: string
  actionText?: string
  onAction?: () => void
}

/** 异常态引导页（未核销 / 已完成 / 已取消 / 无权限 / 寄养单）：大图标 + 说明 + 出口按钮
 *  PD-44 U5：进 sk 语言（.sk 画布底 + SkBtnInk 深棕主钮，非 cream——本组件仅服务
 *  引导/异常态（返回任务台/重试/前往入住登记），无「此刻要做」主行动场景） */
export default function GuidePage({ icon: Icon, title, description, actionText, onAction }: GuidePageProps) {
  return (
    <div className="sk flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken">
        <Icon className="h-9 w-9 text-ink-secondary" strokeWidth={1.5} />
      </div>
      <div className="mt-6 text-title-lg text-ink">{title}</div>
      {description && <div className="mt-2 max-w-xs text-body-sm text-ink-secondary">{description}</div>}
      {actionText && onAction && (
        <div className="mt-8 w-full max-w-xs">
          <SkBtnInk onClick={onAction}>{actionText}</SkBtnInk>
        </div>
      )}
    </div>
  )
}
