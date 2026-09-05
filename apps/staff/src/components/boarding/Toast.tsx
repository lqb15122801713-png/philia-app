/**
 * 轻量 toast：顶部居中胶囊（员工端单手操作，不挡底部主按钮）。
 * 页面层持有 message 状态与计时器，本组件只负责渲染。
 */
export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-toast w-full max-w-lg -translate-x-1/2 px-4">
      <p className="rounded-full bg-ink px-4 py-2.5 text-center text-body text-white shadow-elevated">
        {message}
      </p>
    </div>
  );
}
