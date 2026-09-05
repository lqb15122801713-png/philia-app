/**
 * 服务完成庆祝微动效（开发方案 §8.4 + DESIGN §5「克制」）：
 * appointment.completed 事件到达时弹出一次——苔绿圆内白勾放大回弹一次（600ms
 * philia-spring 缓动，动画只跑一次），约 2.6s 后由页面层关闭。
 */

import { Check } from 'lucide-react'

export default function CelebrationOverlay({
  visible,
  petName,
}: {
  visible: boolean
  petName?: string | null
}) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-[rgba(61,50,41,0.35)] px-8">
      {/* 一次性 pop：0.4 → 1.12 → 1，ease 用品牌 philia-spring */}
      <style>{`@keyframes live-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}`}</style>
      <div className="flex w-full max-w-xs flex-col items-center rounded-card bg-card px-6 py-8 shadow-elevated">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full bg-success"
          style={{ animation: 'live-pop .6s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <Check className="h-8 w-8 text-white" strokeWidth={2} />
        </span>
        <p className="mt-4 text-title">服务完成</p>
        <p className="mt-1 text-center text-caption text-ink-secondary">
          {petName ?? '宝贝'}已经美美的啦，记得给个好评哦
        </p>
      </div>
    </div>
  )
}
