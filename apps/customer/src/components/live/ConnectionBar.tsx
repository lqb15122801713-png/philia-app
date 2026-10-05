/**
 * 断线提示细条（开发方案 §7.4）：SSE 断开超 5s 时置顶显示「连接中…」。
 * 细条形态克制，不遮挡内容；恢复连接后自动消失。
 */

export default function ConnectionBar({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-toast flex justify-center">
      <p className="w-full max-w-lg animate-pulse bg-brand-secondary-light px-4 py-1 text-center text-caption text-ink">
        连接中…正在为你对齐最新进度
      </p>
    </div>
  )
}
