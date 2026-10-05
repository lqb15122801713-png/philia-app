/**
 * 已选条件摘要胶囊（T2.2）：预约流程第 2/3/4 屏顶部展示已选条件，
 * 点击胶囊回跳对应屏修改（洗护 ≤4 屏硬指标的导航支撑）。
 */

export interface SummaryChip {
  /** 胶囊前缀小标签，如「服务」 */
  label: string;
  /** 已选值，如「精致洗护·60分钟」 */
  value: string;
  /** 点击回跳到第几屏 */
  onClick: () => void;
}

export default function SummaryChips({ chips }: { chips: SummaryChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onClick}
          className="flex items-center gap-1.5 rounded-full bg-brand-primary-light px-3 py-1.5 text-caption text-brand-primary-pressed transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <span className="text-ink-secondary">{c.label}</span>
          <span className="max-w-[9em] truncate font-medium">{c.value}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="修改">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
