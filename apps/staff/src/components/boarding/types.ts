/**
 * 员工端寄养打卡页共享类型（P3 T3.4）
 *
 * 与服务端 boarding router（stayForStaff / checkinStay / dailyLog）返回结构同构，
 * 组件 props 显式声明，避免组件与页面耦合 tRPC 推断类型。
 * 服务端 schema 见 server/src/db/schema.ts boarding_stays / boarding_daily_logs。
 */

/** 随身物品清单项（zod belongingItem：name 必填，photoUrl/note 可选） */
export interface BelongingItem {
  name: string;
  photoUrl?: string;
  note?: string;
}

/** 寄养住宿单（boarding_stays 行，组件用到的子集） */
export interface BoardingStayRow {
  id: string;
  appointmentId: string;
  roomNo: string | null;
  checkinWeightKg: number | null;
  /** JSON 列；schema 静态类型不含 photoUrl，但 zod 入参允许且会落库 */
  belongings: BelongingItem[] | null;
  checkoutAt: Date | null;
  createdAt?: Date;
}

/** 一餐记录（zod mealItem：time + food 必填，amount/finished 可选） */
export interface MealItem {
  time: string;
  food: string;
  amount?: string;
  finished?: boolean;
}

/** 每日打卡（boarding_daily_logs 行，组件用到的子集） */
export interface BoardingLogRow {
  id: string;
  stayId: string;
  staffId: string;
  /** ISO 日期 'YYYY-MM-DD' */
  logDate: string;
  meals: MealItem[] | null;
  walks: number;
  note: string | null;
  photos: string[] | null;
}

/** '2026-09-04' → '9月4日 周五'（无效输入原样返回） */
export function fmtLogDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${week}`;
}
