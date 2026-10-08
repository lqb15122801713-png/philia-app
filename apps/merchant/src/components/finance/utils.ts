/**
 * 财务页工具（U3 批次 · 任务 L）
 *
 * - 期间：chips 三档（今天 / 近 7 天 / 本月），区间统一 [from, to) 左闭右开；
 *   day/7d 档=本地日 0 点，**month 档=门店规范时区 +8 月起止**（D-28：与 refund 域
 *   storeTodayStr 同基准，跨月边界不再双源错位）。
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

/** chips 三档区间 [from, to)：今天 / 近 7 天（含今天，滚动 7 日）/ 本月（日历月）。
 *  D-28 修复（B 窗实测移交，钱域边缘口径一致性）：月档=门店规范时区（+8）月起止
 *  （与 refund 域 storeTodayStr 同基准；原 startOfMonth 本机时区，跨月边界双源错位）；
 *  day/7d 档沿用本地日 0 点（当日口径与本机一致，无跨源对照面） */
export function chipRange(mode: ChipMode, now: Date): { from: Date; to: Date } {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (mode === 'day') return { from: today, to: tomorrow };
  if (mode === '7d') {
    return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), to: tomorrow };
  }
  /* 门店墙钟月：storeTodayStr 同工艺（UTC+8 位移后读 UTC 部件），起=本月 1 日 00:00(+8)，止=次月 1 日 00:00(+8) */
  const ym = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 7);
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  const fromMs = Date.parse(`${ym}-01T00:00:00+08:00`);
  const toMs = Date.parse(`${m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`}-01T00:00:00+08:00`);
  return { from: new Date(fromMs), to: new Date(toMs) };
}

/** 分 → 元字符串（千分位保留；U4 任务 F：试样整数元口径——整数去 .00，带零头才两位小数） */
export function formatYuan(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
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
