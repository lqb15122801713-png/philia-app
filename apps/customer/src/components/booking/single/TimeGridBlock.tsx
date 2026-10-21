import type { SlotItem } from '../types';
import { fmtHM } from '../format';
import { availableSetOf, freshNow, isSlotSelectable, LEAD_BUFFER_MS, type DayGrid } from './slotGrid';

export default function TimeGridBlock({
  day,
  slots,
  selected,
  onSelect,
  loading,
}: {
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
  // PD-64（M-1）：按数据落定时刻再卡 +1h 前置量——可约集滞留时 <1h 槽同样不可选；
  // 临近格（withinLead）灰显但保留时刻明文，不标「已满」（不可约≠约满，409 文案与可约态一致）
  const nowMs = freshNow();
  const nextTime = Math.min(...day.grid.filter((t) => isSlotSelectable(t, available, nowMs)).map((t) => t.getTime()));

  return (
    <div className="scroll-mb-40" data-testid="gs-time-grid">
      <div className="grid grid-cols-4 gap-x-3 gap-y-3">
        {day.grid.map((t) => {
          const time = t.getTime();
          const ok = isSlotSelectable(t, available, nowMs);
          const withinLead = !ok && time < nowMs + LEAD_BUFFER_MS;
          const active = selected?.getTime() === time;
          const next = ok && time === nextTime;
          return (
            <button
              key={time}
              type="button"
              disabled={!ok}
              onClick={() => onSelect(t)}
              data-testid={`gs-slot-${fmtHM(t)}`}
              data-available={ok ? 'true' : 'false'}
              data-slot-start={time}
              data-next={next ? 'true' : 'false'}
              aria-label={ok ? fmtHM(t) : withinLead ? `${fmtHM(t)} 临近不可约` : `${fmtHM(t)} 已满`}
              className={`flex h-11 items-center justify-center rounded-[14px] border px-1 text-body-sm font-medium transition ${
                active
                  ? 'border-transparent bg-brand-cta text-brand-cta-on'
                  : ok
                    ? next
                      ? 'border-brand-secondary bg-card text-ink'
                      : 'border-line-ring bg-card text-ink active:scale-95'
                    : 'cursor-not-allowed border-transparent bg-transparent text-caption text-ink-placeholder opacity-70'
              }`}
            >
              {ok || withinLead ? fmtHM(t) : '已满'}
            </button>
          );
        })}
      </div>
      <p className="mt-4 flex items-center gap-2 text-caption text-ink-secondary" data-testid="u2-time-legend">
        <span aria-hidden="true">{selected ? '●' : '○'}</span>
        <span>{selected ? '已选时段' : '下一可约提示'}</span>
        <span className="text-ink-placeholder">灰 = 已满或 1 小时内临近</span>
      </p>
    </div>
  );
}
