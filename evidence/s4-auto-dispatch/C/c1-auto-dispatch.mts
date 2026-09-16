/**
 * 批次 S4 · 任务 C 证据脚本：自动派单与客户指定
 * 场景：双 groomer（先入职 g1 / 后入职 g2）
 *  C-1 未指定 → 负荷最轻者得单（负荷并列按 createdAt 先入职），写 staff_id + assigned 双频道
 *  C-2 负荷口径：预约当日已完成+在单数最少（当日均衡，次日另计）
 *  C-3 指定 staffId 有空 → 成功；无空 → CONFLICT「该美容师此时段已约满，请换时间或换美容师」
 *  C-4 未指定且无可空 → CONFLICT「该时段已约满，请换个时间」+ 占槽整体回滚
 *  C-5 并发双击：仅剩 1 个可空时两并发 create → 恰 1 成功 1 CONFLICT，不产生双占
 * 运行：node philia-app/server/node_modules/tsx/dist/cli.mjs evidence/s4-auto-dispatch/C/c1-auto-dispatch.mts
 * 隔离：独立临时库（PHILIA_DB_URL → %TMP%），不触碰 server/data/philia.db。
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-s4c-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 's4c.db').replaceAll('\\', '/')}`;

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`, cond ? '' : JSON.stringify(extra));
  if (!cond) failures++;
};

const { migrate } = await import('drizzle-orm/libsql/migrator');
const { db, schema, client } = await import('../../../philia-app/server/src/db/index.ts');
const { and, eq, ne } = await import('drizzle-orm');
const { appointmentRouter } = await import('../../../philia-app/server/src/routers/appointment.ts');
type Context = import('../../../philia-app/server/src/trpc.ts').Context;

await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../../philia-app/server/drizzle', import.meta.url)) });

/* ---- 夹具 ---- */
await db.insert(schema.users).values([
  { id: 'u-c', kimiId: 'k-c', nickname: '客户' },
  { id: 'u-c2', kimiId: 'k-c2', nickname: '客户二' },
  { id: 'u-g1', kimiId: 'k-g1', nickname: '美容师甲' },
  { id: 'u-g2', kimiId: 'k-g2', nickname: '美容师乙' },
]);
await db.insert(schema.userRoles).values([
  { userId: 'u-c', role: 'customer' },
  { userId: 'u-c2', role: 'customer' },
  { userId: 'u-g1', role: 'staff' },
  { userId: 'u-g2', role: 'staff' },
]);
const OPEN = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: '09:00', close: '20:00' }]),
);
const SCHED = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ start: '09:00', end: '20:00' }]]),
);
await db.insert(schema.stores).values({ id: 's-1', ownerId: 'u-g1', name: 'S4C 店', openHours: OPEN, status: 'active' });
// g1 先入职（createdAt 先）
await db.insert(schema.staff).values([
  { id: 'st-g1', storeId: 's-1', userId: 'u-g1', name: '美容师甲', role: 'groomer', skills: ['wash'], schedule: SCHED, status: 'active' },
  { id: 'st-g2', storeId: 's-1', userId: 'u-g2', name: '美容师乙', role: 'groomer', skills: ['wash'], schedule: SCHED, status: 'active' },
]);
await db.insert(schema.pets).values([
  { id: 'p-1', ownerId: 'u-c', name: '豆豆', species: 'dog' },
  { id: 'p-2', ownerId: 'u-c2', name: '花花', species: 'cat' },
]);
await db.insert(schema.services).values({
  id: 'sv-g', storeId: 's-1', type: 'grooming', name: '基础洗护', durationMin: 60, priceFen: 8800,
});

const at = (dayOffset: number, h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, 0, 0, 0);
  return d;
};
const c1 = appointmentRouter.createCaller({ db, user: { id: 'u-c', nickname: '客户', roles: ['customer'] } } as Context);
const c2 = appointmentRouter.createCaller({ db, user: { id: 'u-c2', nickname: '客户二', roles: ['customer'] } } as Context);
const mk = (petId: string) => ({
  storeId: 's-1', petId, serviceId: 'sv-g', type: 'grooming' as const, paymentMode: 'pay_at_store' as const,
});
const assignedEvts = async (aid: string) =>
  (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'appointment.assigned' && (r.payload as Record<string, unknown>)?.appointmentId === aid,
  );

/* ---- C-1：未指定 → 负荷并列（0/0）按 createdAt 先入职 → st-g1；staff_id + assigned 双频道 ---- */
const a1 = await c1.create({ ...mk('p-1'), scheduledStart: at(1, 10) });
check('C-1a 未指定 → 自动派单先入职者（staff_id=st-g1，assignSource=auto）', a1.staffId === 'st-g1' && a1.assignSource === 'auto', { staffId: a1.staffId });
const ev1 = await assignedEvts(a1.id);
check(
  'C-1b assigned 事件双频道（staff:st-g1 + user:u-c，payload.by=auto）',
  ev1.length === 2 && ev1.some((r) => r.channel === 'staff:st-g1') && ev1.some((r) => r.channel === 'user:u-c') &&
    ev1.every((r) => (r.payload as Record<string, unknown>)?.by === 'auto'),
  ev1.map((r) => [r.channel, r.payload]),
);

/* ---- C-2：负荷口径（预约当日已完成+在单数最少） → 同时段下一单派 st-g2 ---- */
const a2 = await c1.create({ ...mk('p-1'), scheduledStart: at(1, 11) });
check('C-2 负荷最轻（st-g1 当日已有 1 在单）→ 派 st-g2', a2.staffId === 'st-g2', a2.staffId);
const a3 = await c1.create({ ...mk('p-1'), scheduledStart: at(1, 12) });
check('C-2b 负荷再并列（1/1）→ 先入职 st-g1', a3.staffId === 'st-g1', a3.staffId);

/* ---- C-3：指定 staffId——有空成功；无空 CONFLICT 原文案 ---- */
const a4 = await c1.create({ ...mk('p-1'), scheduledStart: at(1, 10), staffId: 'st-g2' });
check('C-3a 指定 st-g2（10:00 有空）→ 成功写入', a4.staffId === 'st-g2' && a4.assignSource === 'auto', a4.staffId);
const c3b = await c1.create({ ...mk('p-1'), scheduledStart: at(1, 10), staffId: 'st-g1' }).then(
  () => null,
  (e) => e as { code?: string; message?: string },
);
check(
  'C-3b 指定 st-g1（10:00 已占）→ CONFLICT「该美容师此时段已约满，请换时间或换美容师」',
  c3b?.code === 'CONFLICT' && c3b?.message === '该美容师此时段已约满，请换时间或换美容师',
  c3b,
);

/* ---- C-4：未指定且无可空 → CONFLICT 原文案 + 占槽整体回滚 ---- */
const slotBefore = await db
  .select()
  .from(schema.storeSlots)
  .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, at(1, 10))))
  .get();
const c4 = await c1.create({ ...mk('p-1'), scheduledStart: at(1, 10) }).then(
  () => null,
  (e) => e as { code?: string; message?: string },
);
check(
  'C-4a 未指定且无可空（st-g1/st-g2 10:00 均占）→ CONFLICT「该时段已约满，请换个时间」',
  c4?.code === 'CONFLICT' && c4?.message === '该时段已约满，请换个时间',
  c4,
);
const slotAfter = await db
  .select()
  .from(schema.storeSlots)
  .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, at(1, 10))))
  .get();
check(
  'C-4b 派单与占槽同一事务：失败整体回滚（booked_count 2→仍 2，无部分占用）',
  slotBefore?.bookedCount === 2 && slotAfter?.bookedCount === 2,
  { before: slotBefore?.bookedCount, after: slotAfter?.bookedCount },
);

/* ---- C-5：并发双击不产生双占（D+2 10:00 仅 st-g2 可空） ---- */
await db.insert(schema.appointments).values({
  code: 'S4CW01', customerId: 'u-c', storeId: 's-1', staffId: 'st-g1', petId: 'p-1', serviceId: 'sv-g',
  type: 'grooming', scheduledStart: at(2, 10), scheduledEnd: at(2, 11),
  status: 'confirmed', priceFen: 8800, paymentMode: 'pay_at_store',
});
const [r1, r2] = await Promise.allSettled([
  c1.create({ ...mk('p-1'), scheduledStart: at(2, 10) }),
  c2.create({ ...mk('p-2'), scheduledStart: at(2, 10) }),
]);
const won = [r1, r2].filter((r) => r.status === 'fulfilled').length;
const conflicts = [r1, r2].filter(
  (r) => r.status === 'rejected' && (r.reason as { code?: string })?.code === 'CONFLICT',
).length;
const g2Rows = await db
  .select()
  .from(schema.appointments)
  .where(
    and(
      eq(schema.appointments.storeId, 's-1'),
      eq(schema.appointments.staffId, 'st-g2'),
      eq(schema.appointments.scheduledStart, at(2, 10)),
      ne(schema.appointments.status, 'cancelled'),
    ),
  );
const slotW = await db
  .select()
  .from(schema.storeSlots)
  .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, at(2, 10))))
  .get();
check(
  'C-5 并发双击：恰 1 成功 1 CONFLICT；st-g2 同时段仅 1 单、占槽仅 1（不产生双占）',
  won === 1 && conflicts === 1 && g2Rows.length === 1 && slotW?.bookedCount === 1,
  { won, conflicts, g2: g2Rows.length, booked: slotW?.bookedCount },
);

client.close();
console.log(failures === 0 ? '\n任务 C 证据全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
