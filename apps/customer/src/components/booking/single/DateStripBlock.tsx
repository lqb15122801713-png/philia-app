/**
 * B4-1 单屏 · 日期横条区块：
 * - 横条未来 7 天（今天/明天/M月D日 周x + 日期数），约满日/休息日置灰（仍可点入查看栅格，
 *   与批次 3 SlotPicker 日分组条同交互）；
 * - 「展开整月日历 ▸」二级渐进披露：手写整月日历（无新增依赖），覆盖 7 天窗口涉及的
 *   1~2 个月；窗口外日期灰置「未开放」（可约槽数据源 getWithServices 仅供未来 7 天，
 *   接口不动），窗口内与横条同选中态联动。
 */

import { useMemo, useState } from 'react';
import { dayLabel } from '../format';
import { isSameDay, type DayGrid } from './slotGrid';

const WEEK_HEADER = ['日', '一', '二', '三', '四', '五', '六'] as const;

export default function DateStripBlock({
  days,
  selectedDay,
  onPickDay,
}: {
  days: DayGrid[];
  /** 当前选中日（当日 00:00），null = 未选 */
  selectedDay: Date | null;
  onPickDay: (d: Date) => void;
}) {
  const [calOpen, setCalOpen] = useState(false);

  // 7 天窗口涉及的月份（跨月时两个）
  const months = useMemo(() => {
    const first = days[0]?.date;
    const last = days[days.length - 1]?.date;
    if (!first || !last) return [];
    const out: { y: number; m: number }[] = [{ y: first.getFullYear(), m: first.getMonth() }];
    if (last.getFullYear() !== first.getFullYear() || last.getMonth() !== first.getMonth()) {
      out.push({ y: last.getFullYear(), m: last.getMonth() });
    }
    return out;
  }, [days]);

  const dayStateOf = (d: Date) => days.find((g) => isSameDay(g.date, d)) ?? null;

  return (
    <div data-testid="gs-date-strip">
      {/* 7 天横条 */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => {
          const active = selectedDay !== null && isSameDay(d.date, selectedDay);
          const greyed = d.closed || !d.hasAvailable;
          return (
            <button
              key={d.date.getTime()}
              type="button"
              onClick={() => onPickDay(d.date)}
              data-testid={`gs-day-${d.date.getFullYear()}-${d.date.getMonth() + 1}-${d.date.getDate()}`}
              data-active={active ? 'true' : 'false'}
              data-greyed={greyed ? 'true' : 'false'}
              className={`flex w-16 shrink-0 flex-col items-center rounded-card px-2 py-2.5 transition active:scale-95 ${
                active ? 'bg-brand-primary text-white shadow-card' : greyed ? 'bg-sunken text-ink-placeholder' : 'bg-card text-ink shadow-card'
              }`}
            >
              <span className={`text-caption ${active ? 'text-white/90' : ''}`}>{dayLabel(d.date)}</span>
              <span className="mt-0.5 font-number text-body font-semibold">{d.date.getDate()}</span>
              <span className={`mt-0.5 h-4 text-[10px] leading-4 ${active ? 'text-white/80' : 'text-ink-placeholder'}`}>
                {d.closed ? '休息' : !d.hasAvailable ? '约满' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* 二级：整月日历 */}
      <button
        type="button"
        onClick={() => setCalOpen((v) => !v)}
        data-testid="gs-calendar-toggle"
        className="mt-2 text-caption font-medium text-brand-primary"
      >
        {calOpen ? '收起日历 ▾' : '展开整月日历 ▸'}
      </button>

      {calOpen ? (
        <div className="mt-2 space-y-3" data-testid="gs-month-calendar">
          {months.map(({ y, m }) => {
            const firstOfMonth = new Date(y, m, 1);
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const leading = firstOfMonth.getDay();
            const cells: (Date | null)[] = [
              ...Array.from({ length: leading }, () => null),
              ...Array.from({ length: daysInMonth }, (_, i) => new Date(y, m, i + 1)),
            ];
            return (
              <div key={`${y}-${m}`} className="rounded-card bg-card p-3 shadow-card">
                <p className="text-center text-body font-semibold">
                  {y} 年 {m + 1} 月
                </p>
                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-caption text-ink-placeholder">
                  {WEEK_HEADER.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {cells.map((d, i) => {
                    if (!d) return <span key={`blank-${i}`} />;
                    const state = dayStateOf(d);
                    const inWindow = state !== null;
                    const active = selectedDay !== null && isSameDay(d, selectedDay);
                    const greyed = inWindow && (state.closed || !state.hasAvailable);
                    return (
                      <button
                        key={d.getTime()}
                        type="button"
                        disabled={!inWindow}
                        onClick={() => onPickDay(d)}
                        data-testid={`gs-cal-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`}
                        data-in-window={inWindow ? 'true' : 'false'}
                        className={`flex h-9 items-center justify-center rounded-full font-number text-body transition ${
                          active
                            ? 'bg-brand-primary font-semibold text-white'
                            : !inWindow
                              ? 'cursor-not-allowed text-ink-placeholder/50'
                              : greyed
                                ? 'text-ink-placeholder line-through'
                                : 'text-ink active:scale-95'
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-caption text-ink-placeholder">可约期为未来 7 天，更多日期敬请期待</p>
        </div>
      ) : null}
    </div>
  );
}
