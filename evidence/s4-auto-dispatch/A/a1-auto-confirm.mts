/**
 * 批次 S4 · 任务 A 证据脚本：免商家确认（create 即 confirmed / confirm 幂等 / confirmed 双频道事件）
 * 运行：node philia-app/server/node_modules/tsx/dist/cli.mjs evidence/s4-auto-dispatch/A/a1-auto-confirm.mts
 * 隔离：独立临时库（PHILIA_DB_URL → %TMP%），不触碰 server/data/philia.db。
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-s4a-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 's4a.db').replaceAll('\\', '/')}`;

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`, cond ? '' : JSON.stringify(extra));
  if (!cond) failures++;
};

const { migrate } = await import('drizzle-orm/libsql/migrator');
const { db, schema, client } = await import('../../../philia-app/server/src/db/index.ts');
const { eq } = await import('drizzle-orm');
const { appointmentRouter } = await import('../../../philia-app/server/src/routers/appointment.ts');
type Context = import('../../../philia-app/server/src/trpc.ts').Context;

await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../../philia-app/server/drizzle', import.meta.url)) });

/* ---- 夹具 ---- */
await db.insert(schema.users).values([
  { id: 'u-c', kimiId: 'k-c', nickname: '客户' },
  { id: 'u-m', kimiId: 'k-m', nickname: '店主' },
]);
await db.insert(schema.userRoles).values([
  { userId: 'u-c', role: 'customer' },
  { userId: 'u-m', role: 'merchant_owner' },
]);
const OPEN = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: '09:00', close: '20:00' }]),
);
await db.insert(schema.stores).values({ id: 's-1', ownerId: 'u-m', name: 'S4A 店', openHours: OPEN, status: 'active' });
await db.insert(schema.pets).values({ id: 'p-1', ownerId: 'u-c', name: '豆豆', species: 'dog' });
await db.insert(schema.services).values([
  { id: 'sv-g', storeId: 's-1', type: 'grooming', name: '基础洗护', durationMin: 60, priceFen: 8800 },
  { id: 'sv-b', storeId: 's-1', type: 'boarding', name: '标准间寄养', boardingRoomType: '标准间', priceFen: 19900 },
]);

const at = (dayOffset: number, h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, 0, 0, 0);
  return d;
};
const c1 = appointmentRouter.createCaller({ db, user: { id: 'u-c', nickname: '客户', roles: ['customer'] } } as Context);
const m1 = appointmentRouter.createCaller({ db, user: { id: 'u-m', nickname: '店主', roles: ['merchant_owner'], storeId: 's-1' } } as Context);
const outboxOf = (eventType: string) =>
  db.select().from(schema.eventOutbox).where(eq(schema.eventOutbox.eventType, eventType));

/* ---- A-1：create 落库即 confirmed（grooming 与 boarding 同口径） ---- */
const g = await c1.create({
  storeId: 's-1', petId: 'p-1', serviceId: 'sv-g', type: 'grooming',
  scheduledStart: at(1, 10), paymentMode: 'pay_at_store',
});
check('A-1a grooming create 落库即 confirmed（不再经 pending）', g.status === 'confirmed', g.status);
const b = await c1.create({
  storeId: 's-1', petId: 'p-1', serviceId: 'sv-b', type: 'boarding',
  scheduledStart: at(3, 10), scheduledEnd: at(5, 10), paymentMode: 'pay_at_store',
});
check('A-1b boarding create 落库即 confirmed（寄养同口径自动确认）', b.status === 'confirmed', b.status);

/* ---- A-2：confirmed 事件随 create 发 user+store 双频道 ---- */
const confirmedEvents = (await outboxOf('appointment.confirmed')).filter(
  (r) => (r.payload as Record<string, unknown>)?.appointmentId === g.id,
);
const channels = confirmedEvents.map((r) => r.channel).sort();
check(
  'A-2 grooming create 事务内发 appointment.confirmed（user+store 双频道）',
  channels.length === 2 && channels.includes('user:u-c') && channels.includes('store:s-1'),
  channels,
);
check(
  'A-2b confirmed payload.by=auto（自动确认标识）',
  confirmedEvents.every((r) => (r.payload as Record<string, unknown>)?.by === 'auto'),
  confirmedEvents.map((r) => r.payload),
);
const createdStore = (await outboxOf('appointment.created')).filter((r) => r.channel === 'store:s-1');
check('A-2c 既有 appointment.created（store 频道）保留', createdStore.length >= 2, createdStore.length);

/* ---- A-3：confirm 幂等（对 confirmed 单 = 幂等成功，零副作用） ---- */
const beforeCount = (await db.select().from(schema.eventOutbox)).length;
const rowBefore = await db.select().from(schema.appointments).where(eq(schema.appointments.id, g.id)).get();
const cfm1 = await m1.confirm({ appointmentId: g.id });
const cfm2 = await m1.confirm({ appointmentId: g.id });
const rowAfter = await db.select().from(schema.appointments).where(eq(schema.appointments.id, g.id)).get();
check(
  'A-3a confirm 幂等：confirmed 单连调两次均返回 confirmed',
  cfm1.status === 'confirmed' && cfm2.status === 'confirmed',
);
check(
  'A-3b confirm 幂等零副作用：无新增 outbox 事件、updatedAt 不被改写',
  (await db.select().from(schema.eventOutbox)).length === beforeCount &&
    rowBefore?.updatedAt?.getTime() === rowAfter?.updatedAt?.getTime(),
);

/* ---- A-4：历史 pending 单兼容——confirm 仍生效且发事件 ---- */
const [legacy] = await db
  .insert(schema.appointments)
  .values({
    code: 'S4AL01', customerId: 'u-c', storeId: 's-1', petId: 'p-1', serviceId: 'sv-g',
    type: 'grooming', scheduledStart: at(10, 10), scheduledEnd: at(10, 11),
    status: 'pending', priceFen: 8800, paymentMode: 'pay_at_store',
  })
  .returning();
const cfmLegacy = await m1.confirm({ appointmentId: legacy!.id });
const legacyEvt = (await outboxOf('appointment.confirmed')).filter(
  (r) => (r.payload as Record<string, unknown>)?.appointmentId === legacy!.id,
);
check(
  'A-4 历史 pending 单 confirm → confirmed + confirmed 事件（不迁移、旧链路不断裂）',
  cfmLegacy.status === 'confirmed' && legacyEvt.length === 1 && legacyEvt[0]!.channel === 'user:u-c',
  { status: cfmLegacy.status, events: legacyEvt.length },
);

/* ---- A-5：dashboardStats 口径——新单待确认恒 0，历史 pending 仍计数 ---- */
// 另插一条不做 confirm 的历史 pending 单：todo.pending 应只计它（新 create 的单永远不进 pending）
await db.insert(schema.appointments).values({
  code: 'S4AL02', customerId: 'u-c', storeId: 's-1', petId: 'p-1', serviceId: 'sv-g',
  type: 'grooming', scheduledStart: at(11, 10), scheduledEnd: at(11, 11),
  status: 'pending', priceFen: 8800, paymentMode: 'pay_at_store',
});
const { storeRouter } = await import('../../../philia-app/server/src/routers/store.ts');
const m1Store = storeRouter.createCaller({ db, user: { id: 'u-m', nickname: '店主', roles: ['merchant_owner'], storeId: 's-1' } } as Context);
const stats = await m1Store.dashboardStats();
check(
  'A-5 dashboardStats：新单待确认恒 0 口径——todo.pending 仅计历史 pending（=1，即上面直插的历史单）',
  stats.todo.pending === 1,
  stats.todo,
);
console.log('[A-5] todo =', JSON.stringify(stats.todo), 'byStatus =', JSON.stringify(stats.byStatus));

client.close();
console.log(failures === 0 ? '\n任务 A 证据全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
