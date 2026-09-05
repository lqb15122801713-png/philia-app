import { useEffect } from 'react'
import { Check } from 'lucide-react'

/**
 * 第 6 步 confirm 成功庆祝页：勾勾回弹 + "服务完成"，2s 后自动跳走。
 */
export default function CelebrationOverlay({ petName, onDone }: { petName?: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2000)
    return () => window.clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-modal flex flex-col items-center justify-center bg-canvas px-8">
      <style>{`
        @keyframes celebrate-pop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        className="flex h-28 w-28 items-center justify-center rounded-full bg-success shadow-elevated"
        style={{ animation: 'celebrate-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
      >
        <Check className="h-14 w-14 text-white" strokeWidth={2.5} />
      </div>
      <div className="mt-8 text-title-lg text-ink">服务完成</div>
      <div className="mt-2 text-body-lg text-ink-secondary">
        {petName ? `${petName} 的服务照片与记录已同步给家长和商家` : '服务照片与记录已同步'}
      </div>
      <div className="mt-10 text-body text-ink-placeholder">即将返回今日任务…</div>
    </div>
  )
}
