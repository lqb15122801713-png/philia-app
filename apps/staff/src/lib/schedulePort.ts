/**
 * 排班域 · 类型锚点与日期助手（员工端骨架整建批 片 2 · 员工端）
 *
 * server 端 server/src/routers/schedule.ts 已落地，本文件类型一律从 AppRouter
 * 推导（构建期擦除，零运行时开销）；日期/分钟助手供周视图与表单共用。
 * 口径锚 schema（0028 排班域八表）：startMin/endMin=当日起算分钟数；
 * weekday 1=周一…0=周日；assignment.published=已发布布尔透出。
 */

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type WeekView = RouterOutputs['schedule']['weekView'];
export type WeekStaff = WeekView['staff'][number];
export type ShiftAssignment = WeekView['assignments'][number];
export type AvailabilityRow = RouterOutputs['schedule']['myAvailability']['availability'][number];
export type LeaveRow = RouterOutputs['schedule']['myLeaves']['leaves'][number];
export type CompOffBalance = RouterOutputs['schedule']['compOffBalance'];
export type CompOffEntry = CompOffBalance['logs'][number];

/* ------------------------------------------------------------------ */
/* 时间/日期助手（startMin 分钟 ↔ HH:MM；周一起算）                        */
/* ------------------------------------------------------------------ */

export const pad = (n: number): string => String(n).padStart(2, '0');
export const minToHm = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const hmToMin = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
/** 本地 YYYY-MM-DD */
export const dateStr = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 所在周周一（本地） */
export const mondayOf = (d: Date): Date => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
/** 周一~日 7 天日期串（weekStart=周一 YYYY-MM-DD） */
export function weekDates(weekStart: string): string[] {
  const base = new Date(`${weekStart}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => dateStr(addDays(base, i)));
}
