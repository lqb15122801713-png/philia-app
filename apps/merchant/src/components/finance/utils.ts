/**
 * 财务页工具（U3 批次 · 任务 L）
 *
 * - 期间：chips 三档（今天 / 近 7 天 / 本月），区间统一 [from, to) 左闭右开，
 *   本地时区口径（与服务端 financeStats 的按日分组键同为本地日期，天然对齐）。
 *   U3 起日/周/月翻页（PeriodSwitcher）退役，不再支持历史区间翻看。
 * - 金额：分 → 元，一律 2 位小数 + 千分位；展示侧统一 font-number tabular-nums。
 * - 类型：直接从 AppRouter 推导（inferRouterOutputs），与服务端返回结构同源。
 */

import type { AppRouter } from '@philia/shared';
import type { inferRouterOutputs } from '@trpc/server';

export type FinanceStats = inferRouterOutputs<AppRouter>['store']['financeStats'];
export type PendingPaymentItem = FinanceStats['pendingPayments'][number];

/** 期间档：今天 / 近 7 天 / 本月 */
export type ChipMode = 'day' | '7d' | 'month';

/** 本地日 0 点 */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 月起点（1 日 0 点） */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** chips 三档区间 [from, to)：今天 / 近 7 天（含今天，滚动 7 日）/ 本月（日历月） */
export function chipRange(mode: ChipMode, now: Date): { from: Date; to: Date } {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (mode === 'day') return { from: today, to: tomorrow };
  if (mode === '7d') {
    return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), to: tomorrow };
  }
  const from = startOfMonth(now);
  return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) };
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
