/**
 * LogoutConfirmDialog · 退出登录确认弹层（功能保留件 · 自 MePage 移用，逻辑零改动）
 *
 * 补缺大批片 2：MePage「设置」钮改导航 /me/settings，退出登录收进设置页，
 * 本弹层随之一并迁移为账户域公共件。片 2 弹层核查：可点遮罩既有，滚动锁既有；
 * 居中确认件非底部弹层，§4.5 抓握手柄不适用（登记口径同原 MePage 注记）。
 */

import { useEffect } from 'react'

export default function LogoutConfirmDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  /* 滚动锁：弹层挂载期间锁底层 body（调用方条件挂载） */
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
      aria-label="退出登录确认"
    >
      <div
        className="w-full max-w-sm rounded-panel bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-title">退出登录？</p>
        <p className="mt-2 text-body-sm text-ink-secondary">退出后需要重新登录才能继续使用菲丽亚。</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-full border border-line py-2.5 text-body-sm text-ink-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-testid="me-logout-confirm"
            className="flex-1 rounded-full bg-danger py-2.5 text-body-sm text-destructive-foreground transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            {pending ? '正在退出…' : '退出登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
