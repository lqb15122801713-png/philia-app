/**
 * 时间槽选择器（T2.2 · 洗护第 3 屏）：
 * - 顶部日分组条（今天 / 明天 / M月D日 周x），未来 7 天；
 * - 选中日后展示 30min 槽格：可约槽（getWithServices 返回，已按服务时长过滤连续槽）
 *   高亮可选；其余（已约满 / 无库存 / 已过 / 时长覆盖不到）灰显禁用；
 * - 门店当日休息（openHours 该日为 null）显示休息提示。
 */

import { useEffect, useMemo, useState } from 'react';
import type { SlotItem, StoreWithHours } from './types';
import { dayLabel, fmtHM } from './format';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const hmToMin = (hm: string) => {
  const [h = 0, m = 0] = hm.split(':').map(Number);
  return h * 60 + m;
};

interface DayColumn {
  date: Date; // 当日 00:00
  /** 当日全部 30min 栅格（按营业时间生成，含灰显） */
  grid: Date[];
  closed: boolean;
}

export default function SlotPicker({
  store,
  slots,
  selected,
  onSelect,
  loading,
}: {
  store: StoreWithHours;
  /** 可约槽（booked<capacity 且服务时长连续覆盖，服务端已过滤） */
  slots: SlotItem[];
  selected: Date | null;
  onSelect: (d: Date) => void;
  loading?: boolean;
}) {
  const now = Date.now();
  // 可约槽起始时刻集合（ms epoch）
  const availableSet = useMemo(() => new Set(slots.map((s) => s.slotStart.getTime())), [slots]);

  // 未来 7 天：按营业时间生成 30min 栅格；今天已过的栅格剔除
  const days = useMemo<DayColumn[]>(() => {
    const out: DayColumn[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const hours = store.openHours?.[DAY_KEYS[date.getDay()]!];
      if (!hours) {
        out.push({ date, grid: [], closed: true });
        continue;
      }
      const grid: Date[] = [];
      for (let min = hmToMin(hours.open); min < hmToMin(hours.close); min += 30) {
        const t = new Date(date.getTime() + min * 60_000);
        if (t.getTime() > now) grid.push(t);
      }
      out.push({ date, grid, closed: false });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // 默认选中第一个有可约槽的日子
  const [dayIdx, setDayIdx] = useState(0);
  useEffect(() => {
    const first = days.findIndex((d) => d.grid.some((t) => availableSet.has(t.getTime())));
    setDayIdx(first >= 0 ? first : 0);
  }, [days, availableSet]);

  const day = days[dayIdx];

  return (
    <div>
      {/* 日分组条 */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d, i) => {
          const hasAny = d.grid.some((t) => availableSet.has(t.getTime()));
          return (
            <button
              key={d.date.getTime()}
              type="button"
              onClick={() => setDayIdx(i)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-caption transition ${
                i === dayIdx
                  ? 'bg-brand-primary font-semibold text-white'
                  : d.closed || !hasAny
                    ? 'bg-sunken text-ink-placeholder'
                    : 'bg-card text-ink shadow-card'
              }`}
            >
              {dayLabel(d.date)}
              {d.closed ? ' · 休' : ''}
            </button>
          );
        })}
      </div>

      {/* 30min 槽格 */}
      <div className="mt-3">
        {loading ? (
          <p className="py-6 text-center text-caption text-ink-secondary">正在加载可约时段…</p>
        ) : !day || day.closed ? (
          <p className="rounded-card bg-sunken px-4 py-6 text-center text-caption text-ink-secondary">
            门店当日休息，换个日期看看
          </p>
        ) : day.grid.length === 0 ? (
          <p className="rounded-card bg-sunken px-4 py-6 text-center text-caption text-ink-secondary">
            今日营业时段已过，看看明天吧
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {day.grid.map((t) => {
              const ok = availableSet.has(t.getTime());
              const active = selected?.getTime() === t.getTime();
              return (
                <button
                  key={t.getTime()}
                  type="button"
                  disabled={!ok}
                  onClick={() => onSelect(t)}
                  className={`rounded-input py-2.5 text-center font-number text-body transition ${
                    active
                      ? 'bg-brand-primary font-semibold text-white shadow-card'
                      : ok
                        ? 'bg-card text-ink shadow-card active:scale-95'
                        : 'cursor-not-allowed bg-sunken text-ink-placeholder line-through'
                  }`}
                >
                  {fmtHM(t)}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-caption text-ink-placeholder">灰色为已约满或不可约时段</p>
      </div>
    </div>
  );
}
