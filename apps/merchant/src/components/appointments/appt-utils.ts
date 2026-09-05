/**
 * 预约管理共享工具（T4.2）：状态元信息 / 金额与时间格式化 / 日期范围与本地日期键。
 * 视觉类名全部来自 @philia/config tailwind-preset（docs/DESIGN.md token 同名）。
 */

import type { PhiliaClient } from '@philia/shared';

type Trpc = PhiliaClient['trpc'];

/** listForStore 行（预约 + petName/serviceName/staffName） */
export type ListForStoreItem = Awaited<
  ReturnType<Trpc['appointment']['listForStore']['query']>
>[number];

/** appointment.get 返回体 */
export type AppointmentGetResult = Awaited<ReturnType<Trpc['appointment']['get']['query']>>;

/** store.staffList 行（员工 + skills/schedule/stats） */
export type StaffListItem = Awaited<
  ReturnType<Trpc['store']['staffList']['query']>
>['staff'][number];

/** getWithServices 可约槽位行 */
export type SlotItem = Awaited<
  ReturnType<Trpc['store']['getWithServices']['query']>
>['slots'][number];

/** serviceStep.list 行（步骤 + 未失效照片） */
export type StepListItem = Awaited<
  ReturnType<Trpc['serviceStep']['list']['query']>
>[number];

/** boarding.stayBoard 行 */
export type StayBoardEntry = Awaited<
  ReturnType<Trpc['boarding']['stayBoard']['query']>
>['board'][number];

/* ------------------------------------------------------------------ */
/* 状态元信息                                                          */
/* ------------------------------------------------------------------ */

export type ApptStatus =
  | 'pending'
  | 'confirmed'
  | 'in_service'
  | 'in_boarding'
  | 'cancel_requested'
  | 'completed'
  | 'cancelled';

export const STATUS_ORDER: ApptStatus[] = [
  'pending',
  'confirmed',
  'in_service',
  'in_boarding',
  'cancel_requested',
  'completed',
  'cancelled',
];

export const STATUS_LABEL: Record<ApptStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  in_service: '服务中',
  in_boarding: '寄养中',
  cancel_requested: '取消申请',
  completed: '已完成',
  cancelled: '已取消',
};

/** 状态徽章类名（商家端：状态色克制，品牌色只给关键操作/待办） */
export const STATUS_BADGE: Record<ApptStatus, string> = {
  pending: 'bg-brand-primary-light text-brand-primary',
  confirmed: 'bg-success-light text-success-deep',
  in_service: 'bg-brand-secondary-light text-ink',
  in_boarding: 'bg-brand-secondary-light text-ink',
  cancel_requested: 'bg-danger-light text-danger-deep',
  completed: 'bg-success-light text-success-deep',
  cancelled: 'bg-sunken text-ink-placeholder',
};

export const statusLabel = (s: string): string => STATUS_LABEL[s as ApptStatus] ?? s;
export const statusBadge = (s: string): string =>
  STATUS_BADGE[s as ApptStatus] ?? 'bg-sunken text-ink-secondary';

/* ------------------------------------------------------------------ */
/* 技能匹配（与服务端 TYPE_ACCEPT_SKILLS 同口径）                        */
/* ------------------------------------------------------------------ */

export const TYPE_ACCEPT_SKILLS: Record<'grooming' | 'boarding', string[]> = {
  grooming: ['wash', 'groom'],
  boarding: ['boarding'],
};

export const SKILL_LABEL: Record<string, string> = {
  wash: '洗护',
  groom: '美容',
  boarding: '寄养',
};

export const skillLabel = (s: string): string => SKILL_LABEL[s] ?? s;

export const staffMatchesType = (skills: string[] | null | undefined, type: string): boolean => {
  const accept = TYPE_ACCEPT_SKILLS[type as 'grooming' | 'boarding'] ?? [];
  const owned = skills ?? [];
  return accept.some((s) => owned.includes(s));
};

/* ------------------------------------------------------------------ */
/* 格式化                                                              */
/* ------------------------------------------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, '0');
const WEEK_CHARS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** HH:mm */
export const fmtTime = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** M月D日 */
export const fmtDate = (d: Date): string => `${d.getMonth() + 1}月${d.getDate()}日`;

/** M月D日 周x */
export const fmtDateWeek = (d: Date): string => `${fmtDate(d)} 周${WEEK_CHARS[d.getDay()]}`;

/** M月D日 HH:mm */
export const fmtDateTime = (d: Date): string => `${fmtDate(d)} ${fmtTime(d)}`;

/** 金额分 → ¥元（数字字族由外层 font-number 保证） */
export const fenToYuan = (fen: number): string => `¥${(fen / 100).toFixed(2)}`;

/** 收款方式快照 → 中文 */
export const paymentModeLabel = (mode: string | null): string =>
  mode === 'pass_deduct' ? '次卡抵扣' : mode === 'pay_at_store' ? '到店付' : '未选择';

/** 本地日期键 yyyy-MM-dd（日历分组 / 日格对齐用，勿用 toISOString 防时区漂移） */
export const localDayKey = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const dayKeyOf = (d: Date): DayKey => DAY_KEYS[d.getDay()]!;

/** 当日 00:00 */
export const dayStart = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** 周一为一周起点 */
export const weekStart = (d: Date): Date => {
  const s = dayStart(d);
  const offset = (s.getDay() + 6) % 7;
  return addDays(s, -offset);
};

/* ------------------------------------------------------------------ */
/* 日期范围筛选                                                        */
/* ------------------------------------------------------------------ */

export type RangeKey = 'today' | 'tomorrow' | 'week' | 'custom';

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: '今天',
  tomorrow: '明天',
  week: '本周',
  custom: '自定义',
};

/**
 * 范围 → [from, to]（服务端 from=gte / to=lte，故 to 取结束日 23:59:59.999）。
 * custom 传入 'yyyy-MM-dd' 起止。
 */
export function rangeToDates(
  key: RangeKey,
  customFrom?: string,
  customTo?: string,
): { from: Date; to: Date } {
  const now = new Date();
  if (key === 'today') {
    const s = dayStart(now);
    return { from: s, to: new Date(addDays(s, 1).getTime() - 1) };
  }
  if (key === 'tomorrow') {
    const s = addDays(dayStart(now), 1);
    return { from: s, to: new Date(addDays(s, 1).getTime() - 1) };
  }
  if (key === 'week') {
    const s = weekStart(now);
    return { from: s, to: new Date(addDays(s, 7).getTime() - 1) };
  }
  const from = customFrom ? new Date(`${customFrom}T00:00:00`) : dayStart(now);
  const toBase = customTo ? new Date(`${customTo}T00:00:00`) : from;
  return { from, to: new Date(addDays(toBase, 1).getTime() - 1) };
}
