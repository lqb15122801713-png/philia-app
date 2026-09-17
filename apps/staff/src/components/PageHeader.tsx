/**
 * U2 任务 A · 详情级统一返回条（‹ + 标题 + 右侧摘要）
 *
 * 语言与客户端 PageHeader 同族（apps/customer/src/components/PageHeader.tsx）：
 * 36px 白底圆钮 + u1-ring 细线、ChevronLeft 墨色；标题 text-title(17)/700；
 * 右侧摘要 ml-auto caption 档墨色 40%。执行/打卡等详情页一律用它，无 dock。
 */

import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

export function BackButton({ to, label = '返回' }: { to?: string; label?: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label={label}
      data-testid="page-back"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="u1-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card transition-transform duration-120 ease-philia-spring active:scale-92"
    >
      <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={1.8} />
    </button>
  )
}

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
    <header className="flex h-12 items-center gap-2.5 px-4">
      <BackButton to={backTo} />
      <h1 className="text-title font-bold">{title}</h1>
      {aside ? <div className="ml-auto text-caption-xs text-[rgba(74,59,46,.42)]">{aside}</div> : null}
    </header>
  )
}
