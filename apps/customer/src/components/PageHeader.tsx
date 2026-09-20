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
 *
 * W1-D3 直访兜底：SPA 栈内无上一页时（react-router 写入的 history.state.idx===0，
 * 直访/刷新到栈底），兜底导航到 to 指定目标（未传 to 兜底 /home）；
 * 栈内有历史时维持原行为（to=固定目标 / 缺省 navigate(-1)）——10 处在用页零回归。
 * 与浏览器/系统后退手势不冲突：只兜 SPA 内无栈场景，有栈仍走 navigate(-1)。
 */

import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function BackButton({
  to,
  ariaLabel = '返回',
  className = '',
}: {
  /** 固定返回目标；缺省 navigate(-1)。同时作为直访兜底落点（未传时兜底 /home） */
  to?: string
  ariaLabel?: string
  className?: string
}) {
  const navigate = useNavigate()
  const onBack = () => {
    // W1-D3：react-router 在 history.state 写入 idx——idx>0 说明 SPA 栈内有上一页
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) {
      if (to) navigate(to)
      else navigate(-1)
    } else {
      navigate(to ?? '/home')
    }
  }
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onBack}
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
