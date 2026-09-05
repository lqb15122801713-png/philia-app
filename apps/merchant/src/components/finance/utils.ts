/**
 * 财务页工具（T4.4 · coder-finance）
 *
 * - 周期：日 / 周（周一起）/ 月，区间统一 [from, to) 左闭右开，本地时区口径
 *   （与服务端 financeStats 的按日分组键同为本地日期，天然对齐）。
 * - 金额：分 → 元，一律 2 位小数 + 千分位；展示侧统一 font-number tabular-nums。
 * - 类型：直接从 AppRouter 推导（inferRouterOutputs），与服务端返回结构同源。
 */

import type { AppRouter } from '@philia/shared';
import type { inferRouterOutputs } from '@trpc/server';

export type FinanceStats = inferRouterOutputs<AppRouter>['store']['financeStats'];
export type FinanceByDay = FinanceStats['byDay'][number];
export type FinanceStaffRow = FinanceStats['byStaff'][number];
export type PendingPaymentItem = FinanceStats['pendingPayments'][number];

export type PeriodMode = 'day' | 'week' | 'month';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 本地日 0 点 */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 周起点（周一 0 点；周日起算偏移 (getDay()+6)%7） */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const offset = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

/** 月起点（1 日 0 点） */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 当前周期区间 [from, to)，左闭右开 */
export function periodRange(mode: PeriodMode, anchor: Date): { from: Date; to: Date } {
  if (mode === 'day') {
    const from = startOfDay(anchor);
    return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1) };
  }
  if (mode === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7) };
  }
  const from = startOfMonth(anchor);
  return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) };
}

/** 前后翻页：按周期单位平移锚点（周=7 天，月=日历月） */
export function shiftAnchor(mode: PeriodMode, anchor: Date, dir: -1 | 1): Date {
  if (mode === 'day') {
    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dir, anchor.getHours(), anchor.getMinutes());
  }
  if (mode === 'week') {
    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dir * 7, anchor.getHours(), anchor.getMinutes());
  }
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, Math.min(anchor.getDate(), 28), anchor.getHours(), anchor.getMinutes());
}

/** 周期标题：日=2026年9月5日 周六；周=2026年9月1日 – 9月7日；月=2026年9月 */
export function periodLabel(mode: PeriodMode, from: Date, to: Date): string {
  if (mode === 'day') {
    return `${from.getFullYear()}年${from.getMonth() + 1}月${from.getDate()}日 ${WEEKDAYS[from.getDay()]}`;
  }
  if (mode === 'week') {
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1); // 右开区间回退一天用于展示
    return `${from.getFullYear()}年${from.getMonth() + 1}月${from.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
  }
  return `${from.getFullYear()}年${from.getMonth() + 1}月`;
}

/** 分 → 元字符串（千分位 + 2 位小数），对账友好 */
export function formatYuan(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** HH:mm */
export function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** M月D日 */
export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** M月D日 HH:mm */
export function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** 百分比（0-1 → 整数百分比；null → —） */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}
