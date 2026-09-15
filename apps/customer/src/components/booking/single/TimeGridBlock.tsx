/**
 * B4-1 单屏 · 时段栅格区块：
 * 选中日的 30min 栅格按 上午/下午/晚上 分组展示；可约槽高亮可选，
 * 满槽/已过/「当前+1h 缓冲」内一律灰显禁用（批次 3 统一口径：可约集由
 * getWithServices 服务端过滤供给，集合外全部禁用，前后端同拦）。
 */

import type { SlotItem } from '../types';
import { fmtHM } from '../format';
import { availableSetOf, DAY_PART_LABEL, DAY_PART_ORDER, dayPartOf, type DayGrid, type DayPart } from './slotGrid';

export default function TimeGridBlock({
  day,
  slots,
  selected,
  onSelect,
  loading,
}: {
  /** 选中日栅格（含灰显格）；null = 未选日 */
  day: DayGrid | null;
  slots: SlotItem[];
  selected: Date | null;
  onSelect: (t: Date) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <p className="py-6 text-center text-caption text-ink-secondary" data-testid="gs-time-loading">
        正在加载可约时段…
      </p>
    );
  }
  if (!day) return null;
  if (day.closed) {
    return (
      <p className="py-6 text-center text-caption text-ink-secondary" data-testid="gs-time-closed">
        门店当日休息，换个日期看看
      </p>
    );
  }
  if (day.grid.length === 0) {
    return (
      <p className="py-6 text-center text-caption text-ink-secondary" data-testid="gs-time-passed">
        今日营业时段已过，看看明天吧
      </p>
    );
  }

  const available = availableSetOf(slots);
  const groups = new Map<DayPart, Date[]>();
  for (const t of day.grid) {
    const part = dayPartOf(t);
    if (!groups.has(part)) groups.set(part, []);
    groups.get(part)!.push(t);
  }

  return (
    <div className="space-y-3" data-testid="gs-time-grid">
      {DAY_PART_ORDER.filter((p) => groups.has(p)).map((part) => (
        <div key={part} data-testid={`gs-time-group-${part}`}>
          <p className="text-caption font-medium text-ink-secondary">{DAY_PART_LABEL[part]}</p>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {groups.get(part)!.map((t) => {
              const ok = available.has(t.getTime());
              const active = selected?.getTime() === t.getTime();
              return (
                <button
                  key={t.getTime()}
                  type="button"
                  disabled={!ok}
                  onClick={() => onSelect(t)}
                  data-testid={`gs-slot-${fmtHM(t)}`}
                  data-available={ok ? 'true' : 'false'}
                  data-slot-start={t.getTime()}
                  className={`rounded-card border py-2.5 text-center font-number text-body transition ${
                    active
                      ? 'border-[1.5px] border-ink font-semibold text-ink'
                      : ok
                        ? 'border-line text-ink active:scale-95'
                        : 'cursor-not-allowed border-transparent text-ink-placeholder line-through'
                  }`}
                >
                  {fmtHM(t)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-caption text-ink-placeholder">灰色为已约满或 1 小时内的临近时段</p>
    </div>
  );
}
