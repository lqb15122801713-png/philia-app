/**
 * 客户端页面公共小组件与格式化工具（T2.1）
 *
 * - Loading/Error/Empty 三态组件：空态插画沿用 /brand/empty-appointments-800.png 风格
 * - formatFen：分 → 元显示（去尾零，配合 font-number 等宽数字）
 * - haversineKm：两点球面距离（km），门店卡距离显示用
 * - todayIso / daysUntil：疫苗有效期临期/过期判断
 */

import { AlertCircle, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

/** 区块外壳：标题 + 可选右侧动作 + 内容 */
export function SectionShell({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** 加载骨架：暖色沉底卡片脉冲 */
export function LoadingBlock({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-card bg-card p-4 shadow-card ${className}`} aria-label="加载中">
      <div className="flex animate-pulse flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded-tag bg-sunken"
            style={{ width: `${88 - i * 18}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/** 错误态：陶红提示 + 重试按钮 */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-card px-4 py-8 text-center shadow-card">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-light">
        <AlertCircle className="h-5 w-5 text-danger-deep" strokeWidth={1.5} />
      </span>
      <p className="text-body text-ink-secondary">{message ?? '加载失败，请稍后重试'}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2 text-caption text-white transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
          重新加载
        </button>
      ) : null}
    </div>
  )
}

/** 空态：品牌插画 + 文案 + 可选动作 */
export function EmptyState({
  title,
  desc,
  action,
  image = '/brand/empty-appointments-800.png',
}: {
  title: string
  desc?: string
  action?: ReactNode
  image?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card bg-card px-4 py-8 text-center shadow-card">
      <img src={image} alt="" className="h-28 w-28 rounded-card object-cover" />
      <p className="text-body font-semibold">{title}</p>
      {desc ? <p className="text-caption text-ink-secondary">{desc}</p> : null}
      {action}
    </div>
  )
}

/** 分 → 元显示字符串（去尾零：1200 → "12"，1250 → "12.5"） */
export function formatFen(fen: number): string {
  const yuan = fen / 100
  return yuan % 1 === 0 ? String(yuan) : yuan.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/** 数字等宽样式（价格/日期用，搭配 font-number 类） */
export const tabularNums: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' }

/** 两点球面距离（km，保留 1 位小数）；任一缺坐标返回 null */
export function haversineKm(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined,
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** 今天（本地）ISO 'YYYY-MM-DD' */
export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 距离某 ISO 日期的天数（负数 = 已过期） */
export function daysUntil(iso: string): number {
  const today = todayIso()
  const ms = new Date(`${iso}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()
  return Math.round(ms / 86_400_000)
}

/** Date/ISO → 'YYYY年M月D日' */
export function formatDateCn(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
