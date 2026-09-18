/**
 * B4-1 单屏 · 日期横条区块：
 * - 横条未来 7 天（今天/明天/M月D日 周x + 日期数），约满日/休息日置灰（仍可点入查看栅格，
 *   与批次 3 SlotPicker 日分组条同交互）；
 * - 「展开整月日历 ▸」二级渐进披露：手写整月日历（无新增依赖），覆盖 7 天窗口涉及的
 *   1~2 个月；窗口外日期灰置「未开放」（可约槽数据源 getWithServices 仅供未来 7 天，
 *   接口不动），窗口内与横条同选中态联动。
 */

import { useMemo, useState } from 'react';
import { weekCN } from '../format';
import { isSameDay, type DayGrid } from './slotGrid';

const WEEK_HEADER = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** U4-D1：横条 chip 短标签（试样 .d-w 口径：今天/明天/周x——56 宽 chip 内单行不折行） */
const stripLabel = (d: Date) => {
  const now = new Date();
  if (isSameDay(d, now)) return '今天';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (isSameDay(d, tomorrow)) return '明天';
  return weekCN(d);
};

export default function DateStripBlock({
  days,
  selectedDay,
  onPickDay,
  remainByDay,
}: {
  days: DayGrid[];
  /** 当前选中日（当日 00:00），null = 未选 */
  selectedDay: Date | null;
  onPickDay: (d: Date) => void;
  /** U1-D 余量透出：逐日可约槽数（key=yyyy-m-d）；缺省/约满/休息不显示余量 */
  remainByDay?: Map<string, number>;
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
      {/* 7 天横条（U4-D1 试样 .date 工艺：56 宽 chip 白底细线 ring；选中=柠檬底——
          任务书 D-补1 口径，覆盖试样墨底；约满/休息=43% 透明度，约满附红字） */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              className={`flex w-14 shrink-0 flex-col items-center rounded-control px-1 pb-2 pt-2.5 transition active:scale-95 ${
                active ? 'bg-brand-primary' : 'u1-ring bg-card'
              } ${greyed && !active ? 'opacity-[.43]' : ''}`}
            >
              <span className={`text-caption-xs ${active ? 'text-ink/60' : 'text-ink-secondary'}`}>{stripLabel(d.date)}</span>
              <span className="u1-num mt-0.5 text-title">{d.date.getDate()}</span>
              <span
                className={`u1-num mt-0.5 h-4 text-caption-xs leading-4 ${
                  active
                    ? 'text-ink/70'
                    : !d.closed && !d.hasAvailable
                      ? 'text-danger'
                      : 'text-ink-secondary'
                }`}
              >
                {d.closed ? '休息' : !d.hasAvailable ? '约满' : (() => {
                  const remain = remainByDay?.get(`${d.date.getFullYear()}-${d.date.getMonth() + 1}-${d.date.getDate()}`);
                  return remain ? `余 ${remain}` : '';
                })()}
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
        className="mt-2 text-caption font-medium text-ink"
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
              <div key={`${y}-${m}`} className="rounded-card border border-[rgba(74,59,46,.09)] p-3">
                <p className="text-center text-body-sm font-semibold">
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
                        className={`flex h-9 items-center justify-center rounded-full font-number text-body-sm transition ${
                          active
                            ? 'border-[1.5px] border-ink font-semibold text-ink'
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
