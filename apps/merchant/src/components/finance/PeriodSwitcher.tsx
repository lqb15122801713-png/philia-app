/**
 * 周期切换器（T4.4）：日 / 周 / 月 分段切换 + 前后翻页箭头 + 周期标题。
 * 日=今日、周=本周（周一起）、月=本月；翻页按周期单位平移。
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PeriodMode } from './utils';
import { periodLabel } from './utils';

const MODES: Array<{ key: PeriodMode; label: string }> = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
];

export default function PeriodSwitcher({
  mode,
  onModeChange,
  onShift,
  from,
  to,
}: {
  mode: PeriodMode;
  onModeChange: (mode: PeriodMode) => void;
  onShift: (dir: -1 | 1) => void;
  from: Date;
  to: Date;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 日/周/月 分段控件 */}
      <div className="flex rounded-full bg-sunken p-1" role="tablist" aria-label="统计周期">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            onClick={() => onModeChange(m.key)}
            className={`h-9 min-w-[52px] rounded-full px-4 text-body transition-colors duration-150 ${
              mode === m.key
                ? 'bg-card font-semibold text-brand-primary shadow-card'
                : 'text-ink-secondary'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 前后翻页 + 周期标题 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="上一周期"
          onClick={() => onShift(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink-secondary shadow-card transition active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <span className="min-w-[180px] text-center text-body font-semibold text-ink">
          {periodLabel(mode, from, to)}
        </span>
        <button
          type="button"
          aria-label="下一周期"
          onClick={() => onShift(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink-secondary shadow-card transition active:scale-95"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
