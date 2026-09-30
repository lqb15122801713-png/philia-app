/**
 * live 页轻提示（新打卡 / 评价结果等）：顶部居中胶囊，自动消失（页面层计时）。
 *
 * 换皮批片 5 登记：LIVE 域特例，不入 @philia/shared useToast 归并——
 * ① 视觉工艺不同（top-10 / bg-ink/85 text-white / text-caption，shared 固定
 *   top-4|bottom-28 + bg-ink text-brand-primary + text-body-sm，无 className 出口）；
 * ② 计时在页面层（AppointmentLivePage 自持 3200ms 定时器，非 hook 内计时）。
 * 保持原样，视觉差异报备。
 */

export default function LiveToast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-10 z-toast flex justify-center px-4">
      <p className="rounded-full bg-ink/85 px-4 py-2 text-caption text-white shadow-elevated">
        {message}
      </p>
    </div>
  )
}
