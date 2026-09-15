/**
 * 任务 C 存量数据回填（一次性，本地种子库 server/data/philia.db）。
 *
 * 背景：任务 C 前 grooming 建单只占「开始时刻」1 个 30min 槽（旧口径），但
 * releaseAppointmentSlots 已改为释放 [scheduledStart, scheduledEnd) 覆盖的全部连续槽
 * （与 occupyGroomingSlots 对称）。存量 pending/confirmed 洗护单若按新口径取消/改期，
 * 会多释放未占用的槽 —— 故按各单 (start, end) 覆盖区间补齐 (start+30min …) 槽的占用，
 * 使占用与释放口径对称。
 *
 * 幂等保护：脚本以「同店同 slot_start 既有 booked_count 是否已含本单占用」不可判，
 * 故本脚本只允许执行一次——执行前打印将改动的行并要求环境变量 CONFIRM=1 才写入。
 * 本证据批次已执行一次（输出见 00-backfill-active-grooming.log），请勿重跑。
 */
import { createClient } from '@libsql/client';

const DB = 'file:D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/data/philia.db';
const SLOT_MS = 30 * 60 * 1000;
const client = createClient({ url: DB });

const active = await client.execute(
  `SELECT id, store_id, scheduled_start, scheduled_end, status FROM appointments
   WHERE type = 'grooming' AND status IN ('pending','confirmed')`,
);

interface PlanRow { slotStartMs: number; apptId: string }
const plan: PlanRow[] = [];
for (const a of active.rows as unknown as { id: string; store_id: string; scheduled_start: number; scheduled_end: number }[]) {
  const startMs = a.scheduled_start * 1000;
  const endMs = a.scheduled_end * 1000;
  // 旧口径已占 start 槽 → 补 (start, end) 内其余槽
  for (let t = startMs + SLOT_MS; t < endMs; t += SLOT_MS) {
    plan.push({ slotStartMs: t, apptId: a.id });
  }
}
console.log(`[回填计划] 存量 pending/confirmed 洗护单 ${active.rows.length} 条，需补占槽位 ${plan.length} 个：`);
for (const p of plan) console.log(`  appt=${p.apptId} slot=${new Date(p.slotStartMs).toISOString()}`);

if (process.env.CONFIRM !== '1') {
  console.log('\n未写入（CONFIRM=1 才执行写入）');
  process.exit(0);
}

const storeId = (active.rows[0] as unknown as { store_id: string }).store_id;
for (const p of plan) {
  const sec = Math.floor(p.slotStartMs / 1000);
  const row = await client.execute({
    sql: `SELECT id, booked_count, capacity FROM store_slots WHERE store_id = ? AND slot_start = ?`,
    args: [storeId, sec],
  });
  if (row.rows.length > 0) {
    const r = row.rows[0] as unknown as { id: string; booked_count: number; capacity: number };
    await client.execute({
      sql: `UPDATE store_slots SET booked_count = booked_count + 1, updated_at = strftime('%s','now') WHERE id = ?`,
      args: [r.id],
    });
    if (r.booked_count + 1 > r.capacity) {
      console.warn(`  ⚠ 超容量占用 slot=${new Date(p.slotStartMs).toISOString()} ${r.booked_count + 1}/${r.capacity}（存量单口径差异，如实记录）`);
    } else {
      console.log(`  ✓ 占用 slot=${new Date(p.slotStartMs).toISOString()} → ${r.booked_count + 1}/${r.capacity}`);
    }
  } else {
    const id = `bf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    await client.execute({
      sql: `INSERT INTO store_slots (id, store_id, slot_start, capacity, booked_count, created_at, updated_at)
            VALUES (?, ?, ?, 2, 1, strftime('%s','now'), strftime('%s','now'))`,
      args: [id, storeId, sec],
    });
    console.log(`  ✓ 新建并占用 slot=${new Date(p.slotStartMs).toISOString()} → 1/2`);
  }
}
console.log('[回填完成]');
client.close();
