import { useEffect } from 'react'
import { CelebrationPop } from '@philia/shared'

/**
 * 第 6 步 confirm 成功庆祝页：勾勾回弹 + "服务完成"，2s 后自动跳走。
 * 换皮批片 5：圆勾原子件换共享 CelebrationPop（bg-ink 墨圆 + 淡金✓，顺带销绿）；
 * 壳（全页式 / 文案 / 组件内 2s 自跳 /today 契约）不动。
 */
export default function CelebrationOverlay({ petName, onDone }: { petName?: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2000)
    return () => window.clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-modal flex flex-col items-center justify-center bg-canvas px-8">
      <CelebrationPop size={112} />
      <div className="u1-serif mt-8 text-title-lg text-ink">服务完成</div>
      <div className="mt-2 text-body-sm text-ink-secondary">
        {petName ? `${petName} 的服务照片与记录已同步给家长和商家` : '服务照片与记录已同步'}
      </div>
      <div className="mt-10 text-caption text-ink-placeholder">即将返回今日任务…</div>
    </div>
  )
}
