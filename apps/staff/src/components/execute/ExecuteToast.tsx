/**
 * 轻量 toast（员工端执行页自用，不依赖全局 Toaster 装配）。
 * 固定于底部主按钮上方，3.2s 自动消失。
 */
export default function ExecuteToast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-toast flex justify-center px-6">
      <div className="max-w-full rounded-full bg-ink px-5 py-3 text-body-lg text-white shadow-elevated">
        {message}
      </div>
    </div>
  )
}
