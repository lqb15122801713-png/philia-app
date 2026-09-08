/**
 * B4-1 单屏时段栅格合成助手：
 * 由 store.getWithServices 的 openHours + 可约槽（服务端已按批次 3 统一口径过滤：
 * 满槽/已过/「当前+1h 缓冲」剔除）合成前台栅格。与旧向导 SlotPicker 同口径，
 * 抽成独立模块供日期横条（约满日置灰）与时段栅格（上午/下午/晚上分组）共用。
 * （SlotPicker 本体保留给旧向导 /booking/grooming/wizard，不改。）
 */

import type { SlotItem, StoreWithHours } from '../types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const hmToMin = (hm: string) => {
  const [h = 0, m = 0] = hm.split(':').map(Number);
  return h * 60 + m;
};

export interface DayGrid {
  /** 当日 00:00 */
  date: Date;
  /** 当日全部 30min 栅格（按营业时间生成，含灰显；已剔除完全过期格） */
  grid: Date[];
  /** 门店当日休息（openHours 该日为 null） */
  closed: boolean;
  /** 当日是否有可约槽（无 = 约满/临近，日期横条置灰） */
  hasAvailable: boolean;
}

/** 未来 7 天栅格（与批次 3 SlotPicker 同生成口径） */
export function buildWeekGrid(store: StoreWithHours, slots: SlotItem[], now = Date.now()): DayGrid[] {
  const available = new Set(slots.map((s) => s.slotStart.getTime()));
  const out: DayGrid[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const hours = store.openHours?.[DAY_KEYS[date.getDay()]!];
    if (!hours) {
      out.push({ date, grid: [], closed: true, hasAvailable: false });
      continue;
    }
    const grid: Date[] = [];
    for (let min = hmToMin(hours.open); min < hmToMin(hours.close); min += 30) {
      const t = new Date(date.getTime() + min * 60_000);
      if (t.getTime() + 30 * 60_000 > now) grid.push(t);
    }
    out.push({ date, grid, closed: false, hasAvailable: grid.some((t) => available.has(t.getTime())) });
  }
  return out;
}

/** 可约槽起始时刻集合（ms epoch） */
export const availableSetOf = (slots: SlotItem[]) => new Set(slots.map((s) => s.slotStart.getTime()));

export type DayPart = 'morning' | 'afternoon' | 'evening';

export const DAY_PART_LABEL: Record<DayPart, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

/** 时段分组：上午 <12:00 / 下午 12:00–16:59 / 晚上 ≥17:00（与设计方案 mock 的 17:30→晚上 一致） */
export function dayPartOf(t: Date): DayPart {
  const h = t.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export const DAY_PART_ORDER: DayPart[] = ['morning', 'afternoon', 'evening'];

/** 同日历日判定 */
export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
