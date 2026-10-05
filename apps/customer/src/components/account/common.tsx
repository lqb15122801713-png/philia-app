/**
 * 账户安全域公共小件（补缺大批片 2）：脱敏/时刻格式化/轻量 toast/开关/二次确认弹层。
 * 色值一律走 token（tailwind preset 品牌色），文案一律经 copy/account.ts 取值。
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'

/** 手机号前端脱敏展示：138****0000（仅展示层脱敏，服务端真值不落本层文案） */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '——'
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Date/ISO → 'YYYY-MM-DD HH:mm'（mono 时刻行） */
export function fmtDateTime(input: Date | string | null | undefined): string {
  if (!input) return '——'
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return '——'
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 轻量 toast（R9 操作反馈；同原 MePage 自带件口径） */
export function useAccountToast(durationMs = 3200) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null)
  const showToast = useCallback((text: string) => setMsg({ id: Date.now(), text }), [])
  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => setMsg(null), durationMs)
    return () => window.clearTimeout(t)
  }, [msg, durationMs])
  const toastEl = msg ? (
    <div
      key={msg.id}
      role="alert"
      className="fixed left-1/2 top-5 z-toast max-w-[86vw] -translate-x-1/2 rounded-full bg-success-deep px-4 py-2.5 text-body-sm text-brand-primary shadow-elevated"
    >
      {msg.text}
    </div>
  ) : null
  return { toastEl, showToast }
}

/** 60s 重发倒计时（换绑流收码用）：start(60) 起跳，归零自动停 */
export function useCountdown() {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    if (sec <= 0) return
    const t = window.setTimeout(() => setSec((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [sec])
  return { sec, start: setSec } as const
}

/** 开关（隐私页权限项；role=switch，开=深棕墨底 / 关=发丝线灰底，色走 token） */
export function Switch({
  on,
  onToggle,
  disabled,
  testId,
  ariaLabel,
}: {
  on: boolean
  onToggle: () => void
  disabled?: boolean
  testId?: string
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      data-testid={testId}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-[26px] w-[46px] flex-none rounded-full transition-colors duration-120 disabled:opacity-60 ${
        on ? 'bg-ink' : 'bg-line-strong'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-card shadow-card transition-all duration-120 ${
          on ? 'left-[23px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

/** 居中二次确认弹层（注销流复述影响用；结构照 LogoutConfirmDialog 件，遮罩可点+滚动锁） */
export function ConfirmDialog({
  title,
  body,
  okText,
  cancelText,
  pending,
  onCancel,
  onConfirm,
  okTestId,
  danger = true,
}: {
  title: string
  body: ReactNode
  okText: string
  cancelText: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
  okTestId?: string
  danger?: boolean
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-ink/40 px-8"
      onClick={onCancel}
      role="dialog"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-panel bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-title">{title}</p>
        <div className="mt-2 text-body-sm leading-[1.8] text-ink-secondary">{body}</div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-full border border-line py-2.5 text-body-sm text-ink-secondary"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-testid={okTestId}
            className={`flex-1 rounded-full py-2.5 text-body-sm transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60 ${
              danger ? 'bg-danger text-destructive-foreground' : 'bg-ink text-canvas'
            }`}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  )
}
