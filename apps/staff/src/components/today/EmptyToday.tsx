/**
 * 今日无单空态（T3.1 · 员工端）
 * 渐变圆形插画位（品牌渐变是允许用于空状态插画的极个别品牌时刻，见 docs/DESIGN.md §2.3）。
 */

export default function EmptyToday() {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span
        aria-hidden
        className="flex h-24 w-24 items-center justify-center rounded-full bg-philia-gradient text-5xl shadow-philia"
      >
        🐶
      </span>
      <p className="mt-5 text-title">今日暂无排单</p>
      <p className="mt-2 text-body-lg text-ink-secondary">
        好好休息一下，或留意商家派单提醒；
        <br />
        客户到店也可以直接点上方「扫码核销」。
      </p>
    </div>
  );
}
