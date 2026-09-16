/**
 * PageHeader · 详情级页面统一返回条（批次 U1 任务 A）。
 *
 * 形态锁定：←圆钮（36px 白底 + 细线 ring + 近零影，24px 内 ChevronLeft 线图标墨色）
 * + 标题（text-title-lg）+ 可选右侧 slot（状态 pill / 安静文字链）。
 * 深度策略：u1-ring（1px 暖墨细线 ring rgba(74,59,46,.09) + 近零软影），无旧投影。
 *
 * 用法：
 *   <PageHeader title="预约详情" />                       默认 navigate(-1)
 *   <PageHeader title="宠物档案" to="/philia" />          固定返回目标
 *   <PageHeader title="预约洗护" right={<Link …/>} />     右侧 slot
 * 只需圆钮（如 PDP 主图浮动钮）：<BackButton className="absolute left-4 top-4" />
 */

import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function BackButton({
  to,
  ariaLabel = '返回',
  className = '',
}: {
  /** 固定返回目标；缺省 navigate(-1) */
  to?: string
  ariaLabel?: string
  className?: string
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className={`u1-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card transition-transform duration-120 ease-philia-spring active:scale-92 ${className}`}
    >
      <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={1.5} />
    </button>
  )
}

export default function PageHeader({
  title,
  to,
  right,
  className = '',
}: {
  title: ReactNode
  to?: string
  right?: ReactNode
  className?: string
}) {
  return (
    <header className={`flex items-center gap-3 ${className}`}>
      <BackButton to={to} />
      <h1 className="text-title-lg">{title}</h1>
      {right ? <span className="ml-auto flex items-center gap-2">{right}</span> : null}
    </header>
  )
}
