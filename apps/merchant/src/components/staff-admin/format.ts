/**
 * staff-admin 格式化助手（T4.3）
 *
 * 契约约定（MERCHANT-CONTRACTS · 通用约定）：
 * - 金额分→元；时间 HH:mm；日期 M月D日 周x；全部中文。
 */

import { DAY_KEYS, DAY_SHORT, type DayKey, type StaffScheduleLike } from './types';

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

/** 金额：分 → ¥元（两位小数，等宽数字由调用方加 tabular-nums） */
export function fmtMoney(fen: number | null | undefined): string {
  if (fen === null || fen === undefined) return '—';
  return `¥${(fen / 100).toFixed(2)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 时间：HH:mm */
export function fmtTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 日期：M月D日 周x */
export function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_CN[d.getDay()]}`;
}

/** 日期时间：M月D日 周x HH:mm */
export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

/** ISO 日期（YYYY-MM-DD）→ M月D日（原始串非法时原样返回） */
export function fmtIsoDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[2])}月${Number(m[3])}日`;
}

/** 好评率：0~1 → 百分比；null → — */
export function fmtRate(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return '—';
  return `${Math.round(ratio * 100)}%`;
}

/** 平均分：保留 1 位；null → — */
export function fmtAvg(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(1);
}

/**
 * 排班摘要（员工表格一列内展示）：
 * - 无排班 → 「未排班」；
 * - 所有工作日仅一段且时段相同 → 「周一·三·五 09:00–18:00」；
 * - 否则 → 「N 天有排班」。
 */
export function scheduleSummary(schedule: StaffScheduleLike | null | undefined): string {
  if (!schedule) return '未排班';
  const working: DayKey[] = DAY_KEYS.filter((k) => (schedule[k]?.length ?? 0) > 0);
  if (working.length === 0) return '未排班';
  const firstRanges = working.map((k) => schedule[k]![0]);
  const uniform =
    working.every((k) => schedule[k]!.length === 1) &&
    firstRanges.every((r) => r.start === firstRanges[0].start && r.end === firstRanges[0].end);
  if (uniform) {
    const days = working.map((k) => `周${DAY_SHORT[k]}`).join('·');
    return `${days} ${firstRanges[0].start}–${firstRanges[0].end}`;
  }
  return `${working.length} 天有排班`;
}

/** 截取错误信息（tRPC 错误 message 原文 toast） */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
