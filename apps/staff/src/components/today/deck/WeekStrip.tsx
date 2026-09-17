/**
 * U2 任务 B · 周横条（6 日 chip · 仅当前周不可翻页）
 *
 * 试样口径：本周一~周六 6 枚 chip（周X 小字 11/400 墨 40% + 日号 14/700 Montserrat），
 * 当前日=墨底反白；chip 纸面 + 细线 ring + 圆角 14（控件档）。纯展示，翻页进历史。
 */

import { useMemo } from 'react';

const WEEK_CHARS = ['一', '二', '三', '四', '五', '六'] as const; // 周一~周六（试样 6 枚口径）

export default function WeekStrip({ today }: { today: Date }) {
  const days = useMemo(() => {
    // 本周一 00:00
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    return WEEK_CHARS.map((w, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      return { w, date: d, isToday: d.toDateString() === today.toDateString() };
    });
  }, [today]);

  return (
    <div className="mt-3 flex gap-2" data-testid="week-strip" aria-label="本周">
      {days.map(({ w, date, isToday }) => (
        <div
          key={w}
          aria-current={isToday ? 'date' : undefined}
          className={`flex-1 rounded-control px-0 py-2 text-center ${
            isToday ? 'bg-ink text-canvas' : 'u1-ring bg-card'
          }`}
        >
          <div className={`text-caption-xs ${isToday ? 'text-[rgba(246,241,227,.5)]' : 'text-[rgba(74,59,46,.42)]'}`}>
            {w}
          </div>
          <div className="u1-num mt-0.5 text-body-sm font-bold">{date.getDate()}</div>
        </div>
      ))}
    </div>
  );
}
