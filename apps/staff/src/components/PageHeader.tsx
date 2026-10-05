/**
 * U2 任务 A · 详情级统一返回条（‹ + 标题 + 右侧摘要）
 *
 * 换皮批片 5「同型归并」：实现转发 @philia/shared PageHeader/BackButton，
 * staff 侧保留原 props 契约（backTo / aside）与原壳样式——
 * h-12 + gap-2.5 + px-4 容器、serif 页题（u1-serif → font-display token 等价）、
 * aside=ml-auto caption 档墨色 42% 摘要。
 * 返回行为：backTo→navigate(backTo)，缺省 navigate(-1)；不传 fallback，
 * 共享件 idx===0 兜底不启用，与原 staff 行为一致。
 */

import { BackButton, PageHeader as SharedPageHeader } from '@philia/shared'
import type { ReactNode } from 'react'

export { BackButton }

export default function PageHeader({
  title,
  aside,
  backTo,
}: {
  title: ReactNode
  /** 右侧摘要（如「宠物·服务」「第 N 晚·共 M 晚」） */
  aside?: ReactNode
  /** 固定返回落点；缺省 navigate(-1) */
  backTo?: string
}) {
  return (
    <SharedPageHeader
      title={title}
      to={backTo}
      serif
      className="h-12 !gap-2.5 px-4"
      right={
        aside ? (
          <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{aside}</span>
        ) : undefined
      }
    />
  )
}
