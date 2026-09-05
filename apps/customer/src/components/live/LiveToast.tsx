/**
 * live 页轻提示（新打卡 / 评价结果等）：顶部居中胶囊，自动消失（页面层计时）。
 */

export default function LiveToast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-10 z-toast flex justify-center px-4">
      <p className="rounded-full bg-[rgba(61,50,41,0.85)] px-4 py-2 text-caption text-white shadow-elevated">
        {message}
      </p>
    </div>
  )
}
