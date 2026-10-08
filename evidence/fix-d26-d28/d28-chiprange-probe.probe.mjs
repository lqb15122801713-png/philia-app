/* D-28 机读断言：chipRange 月档=门店墙钟（+8）月起止，与 refund 域 storeTodayStr 同基准
 * 用法（仓根）：npx tsx <本件> → 全过 exit 0 */
import { chipRange } from './apps/merchant/src/components/finance/utils.ts';

const fmt = (d: Date) => d.toISOString();
/* 月份同基准判定：from 的门店墙钟（+8）月份须=storeTodayStr 月份（跨月边界同帧） */
const storeMonthOf = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 7);
const cases = [
  // 月中常态：2026-10-08 → 10 月（from=10-01 00:00+8 = UTC 09-30T16:00）
  { name: '月中常态 10-08 → [10-01,11-01)+8', now: new Date('2026-10-08T16:00:00Z'), wantFrom: '2026-09-30T16:00:00.000Z', wantTo: '2026-10-31T16:00:00.000Z' },
  // 跨月边界（原双源错位实证位）：UTC 10-31 16:30 = 门店墙钟 11-01 00:30 → 月档须=11 月
  { name: '跨月边界 10-31T16:30Z（门店已是 11-01 凌晨）→ [11-01,12-01)+8', now: new Date('2026-10-31T16:30:00Z'), wantFrom: '2026-10-31T16:00:00.000Z', wantTo: '2026-11-30T16:00:00.000Z' },
];
let fail = 0;
const rows = cases.map((c) => {
  const r = chipRange('month', c.now);
  const ok = fmt(r.from) === c.wantFrom && fmt(r.to) === c.wantTo && storeMonthOf(r.from) === storeMonthOf(c.now);
  if (!ok) fail++;
  return { name: c.name, ok, got: [fmt(r.from), fmt(r.to)], want: [c.wantFrom, c.wantTo] };
});
console.log(JSON.stringify({ allOk: fail === 0, rows }, null, 2));
process.exit(fail === 0 ? 0 : 1);
