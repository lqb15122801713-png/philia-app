/**
 * B4-1 单屏 · 时段栅格区块：
 * 选中日的 30min 栅格按 上午/下午/晚上 分组展示；可约槽高亮可选，
 * 满槽/已过/「当前+1h 缓冲」内一律灰显禁用（批次 3 统一口径：可约集由
 * getWithServices 服务端过滤供给，集合外全部禁用，前后端同拦）。
 *
 * 换皮批片 2（定稿 B-01 / §4.4 slots 工艺卡）：3 列 gap 9；片=白卡圆角 14，
 * mono 13/700 时刻 + 9 状态行；选中=淡黄底 #F2DFA6（本屏点睛位）；禁用=0.4 整片
 * 半透明（定稿 .slot.dis 口径，覆盖旧「墨 25% 字」）；组头=mono 9 卡其（sh-group gh）。
 * 状态行口径：可约集内=「可约」，集外=「已满」（含已过/临近缓冲，底部注记保留说明）。
 */

import type { SlotItem } from '../types';
import { fmtHM } from '../format';
import { mc } from '@/components/member/copy';
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
          {/* 组头 gh：mono 9 卡其（定稿 sh-group 口径） */}
          <p className="font-number text-[9px] tracking-[.14em] text-brand-secondary">{DAY_PART_LABEL[part]}</p>
          <div className="mt-2 grid grid-cols-3 gap-[9px]">
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
                  className={`rounded-control border px-1 py-[11px] text-center transition ${
                    active
                      ? 'border-transparent bg-brand-primary text-ink'
                      : ok
                        ? 'border-line bg-card text-ink active:scale-95'
                        : 'cursor-not-allowed border-line bg-card opacity-40'
                  }`}
                >
                  <span className="block font-number text-[13px] font-bold leading-4">{fmtHM(t)}</span>
                  <span
                    className={`mt-[3px] block text-[9px] leading-3 ${
                      active ? 'text-ink' : 'text-ink-secondary'
                    }`}
                  >
                    {ok ? mc('bk.slotOpen') : mc('bk.slotFull')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-caption text-ink-placeholder">浅色为已约满或 1 小时内的临近时段</p>
    </div>
  );
}
