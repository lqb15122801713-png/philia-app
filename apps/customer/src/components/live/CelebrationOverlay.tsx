/**
 * 服务完成庆祝微动效（开发方案 §8.4 + DESIGN §5「克制」）：
 * appointment.completed 事件到达时弹出一次——深棕圆内淡金勾放大回弹一次，
 * 约 2.6s 后由页面层关闭。
 * 反馈件色纪律（45 号档 P1-1②）：成功不设绿——深棕墨圆底 + 淡金 ✓。
 *
 * 换皮批片 5：圆勾原子件归并 @philia/shared CelebrationPop（bg-success 残留
 * 顺带归色为 bg-ink + brand-primary 勾，pop 动画内联于原子件）；壳层
 * （遮罩 / 白卡 / 文案 / 页面层计时）保持原样。
 */

import { CelebrationPop } from '@philia/shared'

export default function CelebrationOverlay({
  visible,
  petName,
}: {
  visible: boolean
  petName?: string | null
}) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/35 px-8">
      <div className="flex w-full max-w-xs flex-col items-center rounded-card bg-card px-6 py-8 shadow-elevated">
        <CelebrationPop size={64} />
        <p className="mt-4 text-title">服务完成</p>
        <p className="mt-1 text-center text-caption text-ink-secondary">
          {petName ?? '宝贝'}已经美美的啦，记得给个好评哦
        </p>
      </div>
    </div>
  )
}
