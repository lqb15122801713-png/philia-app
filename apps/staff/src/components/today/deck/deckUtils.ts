/**
 * U2 任务 B · 任务台共享件（时间轴台 B′ 骨架）—— 时间与布局工具
 *
 * 口径（规格书 §2 + 试样 v1）：
 * - 日轴 09:00–打烊（打烊=store.openHours 当日 close，缺省 20:00；开门缺省 09:00）；
 * - 小时行高 52px；单块圆角 12（控件档 14 内缩先例，仅轴内）；
 * - 页边距全域 22px（px-[22px]，规格书 §0/§13 硬闸门 + 试样全屏 22；U4-E 起对齐，
 *   旧注释「22 作废」无冻结决策凭据，作废）；轴内左侧 46px 为时刻列内缩（组件工艺）。
 */

export const AXIS_HOUR_PX = 52;
/** 时刻列内缩（试样 .b-axis padding-left:46px） */
export const AXIS_GUTTER_PX = 46;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Date → 当日分钟数（本地墙钟） */
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** 'HH:MM' → 当日分钟数 */
export const parseHHMM = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export const fmtMin = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

export type OpenHoursDay = { open: string; close: string } | null | undefined;

/** 从 openHours JSON 取当日开/打烊分钟；缺省 09:00–20:00 */
export function todayAxisRange(openHours: Record<string, OpenHoursDay> | null | undefined, now: Date): {
  startMin: number;
  endMin: number;
} {
  const key = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[now.getDay()]!;
  const today = openHours?.[key];
  const open = today?.open ? parseHHMM(today.open) : null;
  const close = today?.close ? parseHHMM(today.close) : null;
  return { startMin: open ?? 9 * 60, endMin: close ?? 20 * 60 };
}

/** 轴小时刻度（含打烊末行） */
export function axisHours(startMin: number, endMin: number): number[] {
  const hours: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hours.push(m);
  return hours;
}

/** 区间重叠分派列（同刻并行块对半分列，试样 frontdesk 双服务中口径）；
 *  返回每块的 col/cols（cols=该重叠组并列数） */
export function assignColumns<T extends { startMin: number; endMin: number }>(blocks: T[]): Map<number, { col: number; cols: number }> {
  const result = new Map<number, { col: number; cols: number }>();
  const sorted = blocks.map((b, i) => ({ ...b, __i: i })).sort((a, b) => a.startMin - b.startMin);
  // 扫描重叠组
  let group: typeof sorted = [];
  let groupEnd = -1;
  const flush = () => {
    if (group.length === 0) return;
    const cols = group.length;
    group.forEach((b, idx) => result.set(b.__i, { col: idx, cols }));
    group = [];
  };
  for (const b of sorted) {
    if (group.length > 0 && b.startMin >= groupEnd) flush();
    group.push(b);
    groupEnd = Math.max(groupEnd, b.endMin);
  }
  flush();
  return result;
}

/** 当前空档推算（纯展示）：从 now 起首个 ≥30min 空档；无则 null（不渲染该段） */
export function firstGap(intervals: Array<{ startMin: number; endMin: number }>, nowMin: number, closeMin: number): { from: number; to: number } | null {
  const sorted = [...intervals].sort((a, b) => a.startMin - b.startMin);
  let cursor = nowMin;
  for (const iv of sorted) {
    if (iv.endMin <= cursor) continue;
    if (iv.startMin - cursor >= 30) return { from: cursor, to: iv.startMin };
    cursor = Math.max(cursor, iv.endMin);
  }
  if (closeMin - cursor >= 30) return { from: cursor, to: closeMin };
  return null;
}
