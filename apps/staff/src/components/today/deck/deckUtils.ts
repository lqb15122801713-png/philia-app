/**
 * 员工端任务台共享时间工具（deck 时间轴台退役后存量的活件）。
 * PD-44 U5：AXIS_*／todayAxisRange／axisHours／assignColumns／firstGap 随死码摘除；
 * STEP_NAME 自死件 ServiceCard 迁入（ExecutePage/ExecuteStepper 活引用）。
 */

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Date → 当日分钟数（本地墙钟） */
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

export const fmtMin = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

/** 步名口径=冻结表六名（CJ-0919-01，与 shared SERVICE_STEPS 一致） */
export const STEP_NAME: Record<string, string> = {
  disinfection: '消毒工具确认',
  precheck: '预检',
  grooming: '洗护',
  detail: '精修',
  before_after: '交付检查',
  confirm: '完成确认',
};
