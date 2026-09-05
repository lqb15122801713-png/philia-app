/**
 * 员工端格式化与小工具（T3.1 · components/today 共享，HistoryPage/MePage 复用）
 */

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** 今日时间轴列表项（appointment.listTodayForStaff 返回行） */
export type TodayItem = RouterOutputs['appointment']['listTodayForStaff'][number];
/** 历史列表项（appointment.listForStaff 返回行） */
export type HistoryItem = RouterOutputs['appointment']['listForStaff'][number];
/** 站内通知项（push.listNotifications 返回行） */
export type NotificationItem = RouterOutputs['push']['listNotifications']['items'][number];

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** HH:mm（24 小时制） */
export const hhmm = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** MM-dd */
export const mmdd = (d: Date): string => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 周X */
export const weekdayLabel = (d: Date): string => WEEK_LABELS[d.getDay()]!;

/** 今日头部日期：M月d日 周X */
export const todayLabel = (d: Date): string =>
  `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayLabel(d)}`;

/** 本月 1 日 00:00（HistoryPage 默认 from） */
export function monthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 分 → ¥ 元（两位小数，数字字族配合 tabular-nums） */
export const fenToYuan = (fen: number): string => `¥${(fen / 100).toFixed(2)}`;

/** 排班周模板有序键（周一在前）与中文标签 */
export const SCHEDULE_DAYS: Array<{ key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; label: string }> = [
  { key: 'mon', label: '周一' },
  { key: 'tue', label: '周二' },
  { key: 'wed', label: '周三' },
  { key: 'thu', label: '周四' },
  { key: 'fri', label: '周五' },
  { key: 'sat', label: '周六' },
  { key: 'sun', label: '周日' },
];

/** Date.getDay()（sun=0）→ 排班键 */
export const dayKeyOf = (d: Date): (typeof SCHEDULE_DAYS)[number]['key'] =>
  (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[d.getDay()]!;
