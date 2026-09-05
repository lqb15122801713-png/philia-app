/**
 * 日历视图（T4.2）：月历，周一开头；日格显示预约数（+ 待确认 / 取消申请状态点），
 * 今天品牌色高亮，点日格进当日列表（由父级切列表视图 + 自定义范围=当日）。
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, localDayKey, type ListForStoreItem } from './appt-utils';

const WEEK_HEAD = ['一', '二', '三', '四', '五', '六', '日'] as const;

export interface DayStat {
  total: number;
  pending: number;
  cancelRequested: number;
}

/** 按月分组统计（key = 本地日期 yyyy-MM-dd） */
export function buildDayStats(items: ListForStoreItem[]): Map<string, DayStat> {
  const map = new Map<string, DayStat>();
  for (const it of items) {
    const key = localDayKey(it.scheduledStart);
    const s = map.get(key) ?? { total: 0, pending: 0, cancelRequested: 0 };
    s.total += 1;
    if (it.status === 'pending') s.pending += 1;
    if (it.status === 'cancel_requested') s.cancelRequested += 1;
    map.set(key, s);
  }
  return map;
}

export function CalendarView({
  month,
  stats,
  onMonthChange,
  onPickDay,
}: {
  /** 月份游标（取 year/month） */
  month: Date;
  stats: Map<string, DayStat>;
  onMonthChange: (next: Date) => void;
  onPickDay: (day: Date) => void;
}) {
  const year = month.getFullYear();
  const mon = month.getMonth();
  const first = new Date(year, mon, 1);
  const offset = (first.getDay() + 6) % 7; // 周一开头
  const gridStart = addDays(first, -offset);
  const todayKey = localDayKey(new Date());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));

  return (
    <div className="rounded-card bg-card p-3 shadow-card">
      {/* 月份切换 */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, mon - 1, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-sunken"
          aria-label="上一月"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <p className="font-number text-title">
          {year}年{mon + 1}月
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, mon + 1, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-sunken"
          aria-label="下一月"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* 星期头 */}
      <div className="grid grid-cols-7 gap-1">
        {WEEK_HEAD.map((w) => (
          <div key={w} className="py-1 text-center text-caption text-ink-secondary">
            {w}
          </div>
        ))}
      </div>

      {/* 日格 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const key = localDayKey(d);
          const s = stats.get(key);
          const inMonth = d.getMonth() === mon;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(d)}
              className={`flex min-h-[64px] flex-col items-center rounded-tag border px-1 py-1.5 transition-colors hover:bg-sunken ${
                isToday ? 'border-brand-primary bg-brand-primary-light/50' : 'border-line-divider'
              } ${inMonth ? '' : 'opacity-40'}`}
            >
              <span
                className={`font-number text-body ${
                  isToday ? 'font-semibold text-brand-primary' : 'text-ink'
                }`}
              >
                {d.getDate()}
              </span>
              {s ? (
                <>
                  <span className="mt-0.5 rounded-full bg-brand-primary-light px-1.5 font-number text-caption text-brand-primary">
                    {s.total}单
                  </span>
                  {/* 状态点：待确认=品牌色 / 取消申请=陶红 */}
                  <span className="mt-1 flex h-1.5 items-center gap-1">
                    {s.pending > 0 ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" aria-hidden />
                    ) : null}
                    {s.cancelRequested > 0 ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
                    ) : null}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-center text-caption text-ink-placeholder">
        点击日格查看当日预约列表
      </p>
    </div>
  );
}
