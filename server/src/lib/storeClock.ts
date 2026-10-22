/**
 * 门店规范时区（B8-B4）：openHours / 员工排班 / 寄养晚界 / 拍照时间窗服务日的
 * 墙钟统一按 Asia/Shanghai（固定 +8，中国无夏令时）。此前一律用「服务器本地时区」
 * 解释墙钟：VPS 容器为 UTC 时槽位栅格整体偏移 8h，客户端（手机 CST）
 * 本地栅格与服务端可约集错位——上午/下午大面积灰死、点击无响应，仅错位
 * 后碰巧对齐的 17:00-19:30 可点（走查「预约时段首次点击无响应需点两次」
 * 根因；走查单落在 18:00 正因此）。改为固定 +8 后与客户端栅格同帧；
 * +1h 缓冲 / 容量 / 时长连续 / 幂等 等槽位规则不变（仅矫正墙钟参照系）。
 *
 * PD-77：自 routers/appointment.ts 抽出为中立模块——serviceStep 复用同帧
 * 店历日判定，避免 routers 间循环依赖（appointment 依赖 serviceStep）。
 * appointment.ts 原路径再导出，既有 import 不变。
 */
const STORE_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** instant → 门店规范时区（+8）墙钟部件（位移后用 UTC getter 读取） */
export function storeWallclock(d: Date): { y: number; m: number; day: number; dow: number; minutes: number } {
  const s = new Date(d.getTime() + STORE_TZ_OFFSET_MS);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    dow: s.getUTCDay(),
    minutes: s.getUTCHours() * 60 + s.getUTCMinutes(),
  };
}

/** 门店规范时区某日 00:00 的 epoch（槽位栅格合成基准；两时刻同窗 ⇔ dayStart 相等） */
export function storeDayStartMs(y: number, m1: number, day: number): number {
  return Date.UTC(y, m1 - 1, day) - STORE_TZ_OFFSET_MS;
}
