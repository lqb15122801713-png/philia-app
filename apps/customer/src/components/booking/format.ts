/**
 * 预约域展示辅助（T2.2）：金额 / 时间 / 状态胶囊 / 收款方式 文案与样式。
 */

/** 分 → 元 展示（整数元不带小数） */
export function fenToYuan(fen: number): string {
  const yuan = fen / 100;
  return `¥${Number.isInteger(yuan) ? yuan : yuan.toFixed(2)}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** HH:MM */
export const fmtHM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** M月D日 */
export const fmtMD = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'] as const;
export const weekCN = (d: Date) => `周${WEEK_CN[d.getDay()]}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** 日分组标签：今天 / 明天 / M月D日 周x */
export function dayLabel(d: Date): string {
  const now = new Date();
  if (isSameDay(d, now)) return '今天';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (isSameDay(d, tomorrow)) return '明天';
  return `${fmtMD(d)} ${weekCN(d)}`;
}

/** 预约时间展示：M月D日 周x HH:MM */
export const fmtDateTime = (d: Date) => `${fmtMD(d)} ${weekCN(d)} ${fmtHM(d)}`;

/** 预约区间展示（寄养）：M月D日 → M月D日 */
export const fmtRange = (a: Date, b: Date) => `${fmtMD(a)} ${weekCN(a)} → ${fmtMD(b)} ${weekCN(b)}`;

/** 两个日历日的整天数差（寄养晚数） */
export function nightsBetween(checkin: Date, checkout: Date): number {
  const a = new Date(checkin.getFullYear(), checkin.getMonth(), checkin.getDate()).getTime();
  const b = new Date(checkout.getFullYear(), checkout.getMonth(), checkout.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** ISO 纯日期（YYYY-MM-DD）→ 本地 Date（当天 00:00） */
export function isoToDate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 本地 Date → YYYY-MM-DD（<input type="date"> 用） */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/* ------------------------------------------------------------------ */
/* 状态 / 收款方式 文案                                                  */
/* ------------------------------------------------------------------ */

export const APPT_STATUS_META: Record<string, { label: string; pill: string }> = {
  pending: { label: '待确认', pill: 'bg-brand-secondary-light text-ink' },
  confirmed: { label: '已确认', pill: 'bg-success-light text-success-deep' },
  in_service: { label: '服务中', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  in_boarding: { label: '寄养中', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  completed: { label: '已完成', pill: 'bg-success-light text-success-deep' },
  cancel_requested: { label: '取消审核中', pill: 'bg-danger-light text-danger-deep' },
  cancelled: { label: '已取消', pill: 'bg-sunken text-ink-placeholder' },
};

export const statusLabel = (s: string) => APPT_STATUS_META[s]?.label ?? s;

export const PAYMENT_MODE_META: Record<string, { label: string; hint: string }> = {
  pay_at_store: { label: '到店付', hint: '服务完成后到店支付' },
  pass_deduct: { label: '次卡扣次', hint: '服务完成时自动扣次' },
};

export const paymentModeLabel = (m: string | null) =>
  (m && PAYMENT_MODE_META[m]?.label) || '到店付';

export const APPT_TYPE_LABEL: Record<string, string> = {
  grooming: '洗护美容',
  boarding: '寄养',
};

/** 员工技能标签 → 中文 */
export const SKILL_LABEL: Record<string, string> = {
  wash: '洗护',
  groom: '美容',
  boarding: '寄养',
};
