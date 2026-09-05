/**
 * 商城管理轻量 UI 基件（T5.2 · components/mall-admin）
 *
 * 与 staff-admin/ui.tsx 同宗：按 DESIGN.md 品牌 token（preset 类名）自绘
 * 按钮 / 弹层 / 开关 / 徽章 / 状态占位，零跨代理依赖。
 * toast 直接用全局 sonner（App.tsx 已挂 <Toaster richColors>），本目录不再自绘。
 *
 * 用色纪律（DESIGN.md §7 商家端）：品牌色只给关键操作与状态；无呼吸光环；
 * 仅 hover / 状态过渡（150–200ms ease-out）；表格辅助文字可用 13px。
 */

import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/* ------------------------------------------------------------------ */
/* 按钮                                                                */
/* ------------------------------------------------------------------ */

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'subtle'
type BtnSize = 'sm' | 'md'

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50'
const btnVariant: Record<BtnVariant, string> = {
  primary: 'bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-pressed',
  ghost: 'border border-line-strong bg-card text-ink hover:bg-sunken',
  danger: 'bg-danger text-white hover:bg-danger-deep',
  subtle: 'text-brand-primary hover:bg-brand-primary-light',
}
const btnSize: Record<BtnSize, string> = {
  sm: 'px-3 py-1.5 text-caption',
  md: 'px-4 py-2 text-body',
}

export function Btn({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      type="button"
      className={`${btnBase} ${btnVariant[variant]} ${btnSize[size]} ${className}`}
      {...rest}
    />
  )
}

/* ------------------------------------------------------------------ */
/* 表单                                                                */
/* ------------------------------------------------------------------ */

export const inputCls =
  'w-full rounded-input border border-line bg-card px-3 py-2 text-body text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none'

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption text-ink-secondary">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-caption text-ink-placeholder">{hint}</span> : null}
    </label>
  )
}

/** 开关（上下架等状态切换；optimistic 场景配 disabled 防抖） */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${
        checked ? 'bg-brand-primary' : 'bg-line-strong'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow-card transition-transform duration-150 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* 徽章                                                                */
/* ------------------------------------------------------------------ */

type BadgeTone = 'brand' | 'success' | 'danger' | 'muted' | 'warning'
const badgeTone: Record<BadgeTone, string> = {
  brand: 'bg-brand-primary-light text-brand-primary-pressed',
  success: 'bg-success-light text-success-deep',
  danger: 'bg-danger-light text-danger-deep',
  muted: 'bg-sunken text-ink-secondary',
  warning: 'bg-brand-secondary-light text-ink',
}

export function Badge({ tone = 'muted', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-tag px-2 py-0.5 text-caption ${badgeTone[tone]}`}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* 弹层（居中 Modal，平板/手机通用）                                     */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  widthClass?: string
}) {
  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[85vh] w-full ${widthClass} flex-col overflow-hidden rounded-card bg-card shadow-elevated`}
      >
        <div className="flex items-center justify-between border-b border-line-divider px-5 py-4">
          <h3 className="text-title font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1 text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line-divider px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */
/* 状态占位                                                            */
/* ------------------------------------------------------------------ */

export function Loading({ text = '加载中…' }: { text?: string }) {
  return <div className="py-12 text-center text-body text-ink-placeholder">{text}</div>
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-card bg-card py-12 text-center shadow-card">
      <div className="text-body text-ink-secondary">{title}</div>
      {hint ? <div className="mt-1 text-caption text-ink-placeholder">{hint}</div> : null}
    </div>
  )
}

/** 金额等宽数字（DESIGN.md：价格用 tabular-nums 纵向对齐） */
export const numStyle = { fontVariantNumeric: 'tabular-nums' } as const
