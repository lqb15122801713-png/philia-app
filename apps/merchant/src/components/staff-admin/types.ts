/**
 * staff-admin 共享类型（T4.3 · coder-staff-admin）
 *
 * 镜像服务端 drizzle 行结构（server/src/db/schema.ts）与 tRPC 响应形状，
 * 供 StaffPage / BoardingPage / SettingsPage 及其组件 props 使用。
 * 字段为服务端行的子集（结构化类型兼容）；Date 字段经 superjson 反序列化为 Date。
 */

/** 周日 → 周一 key（与服务端 scheduleInput / openHoursInput 一致） */
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DAY_LABEL: Record<DayKey, string> = {
  mon: '周一',
  tue: '周二',
  wed: '周三',
  thu: '周四',
  fri: '周五',
  sat: '周六',
  sun: '周日',
};
export const DAY_SHORT: Record<DayKey, string> = {
  mon: '一',
  tue: '二',
  wed: '三',
  thu: '四',
  fri: '五',
  sat: '六',
  sun: '日',
};

/** 员工技能标签 key → 中文（schema: ["wash","groom","boarding"]） */
export const SKILL_LABEL: Record<string, string> = {
  wash: '洗护',
  groom: '美容',
  boarding: '寄养',
};

/** 时段（HH:MM） */
export interface TimeRange {
  start: string;
  end: string;
}

/** 员工周排班模板：{ mon: [{start,end}] | null, ... }，空数组/null 表示当日休息 */
export type StaffScheduleLike = Partial<Record<DayKey, TimeRange[] | null>>;

/** 门店营业时间：{ mon: {open,close} | null, ... } */
export type OpenHoursLike = Partial<Record<DayKey, { open: string; close: string } | null>>;

/** store.staffList 行（staff + 聚合绩效） */
export interface StaffRow {
  id: string;
  storeId: string;
  userId: string;
  name: string;
  skills: string[] | null;
  schedule: StaffScheduleLike | null;
  status: string; // active | suspended
  createdAt: Date;
  updatedAt: Date;
  stats: {
    completedCount: number;
    ratedCount: number;
    /** 好评率（评分≥4 占比）；无评分为 null */
    goodRate: number | null;
    avgRating: number | null;
  };
}

/** services 行 */
export interface ServiceRow {
  id: string;
  storeId: string;
  type: string; // grooming | boarding
  name: string;
  durationMin: number | null;
  priceFen: number;
  boardingRoomType: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** boarding_stays 行 */
export interface StayRow {
  id: string;
  appointmentId: string;
  roomNo: string | null;
  checkinWeightKg: number | null;
  belongings: Array<{ name: string; note?: string; photoUrl?: string }> | null;
  checkoutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** boarding.stayBoard 行（stay + appointment + pet + customer + 派生字段） */
export interface StayBoardRow {
  stay: StayRow;
  appointment: {
    id: string;
    code: string;
    customerId: string;
    storeId: string;
    staffId: string | null;
    petId: string;
    serviceId: string;
    type: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    status: string;
    priceFen: number;
    paymentMode: string | null; // pay_at_store | pass_deduct
    paidAt: Date | null;
    paidFen: number | null;
    note: string | null;
  };
  pet: {
    id: string;
    name: string;
    species: string; // dog | cat | other
    breed: string | null;
    avatarUrl: string | null;
    weightKg: number | null;
  };
  customer: {
    id: string;
    nickname: string | null;
    phone: string | null;
  };
  /** 最近一次打卡日期（YYYY-MM-DD），无打卡为 null */
  lastLogDate: string | null;
  /** 超期：预约结束时间已过且未退房 */
  overdue: boolean;
}

/** store.inviteStaff 响应 */
export interface InviteResult {
  code: string;
  expiresAt: Date;
  reused: boolean;
  notice: string;
}

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  pay_at_store: '到店付',
  pass_deduct: '次卡抵扣',
};

export const SPECIES_LABEL: Record<string, string> = {
  dog: '狗狗',
  cat: '猫咪',
  other: '其他',
};
