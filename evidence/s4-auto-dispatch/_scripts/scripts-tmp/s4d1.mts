/**
 * 批次 S4 · 任务 D 证据脚本（服务端口径）：派单来源标记轨迹 + Dashboard 待办口径
 *  D-1 create 自动派单 → assignSource='auto'；assign 改派 → 覆盖为 'merchant'（不回归）
 *  D-2 assigned 事件即轨迹：by='auto'（下单）→ by='merchant'（改派），无审计表
 *  D-3 listForStore 行透出 assignSource（列表/详情来源标记的数据源）
 *  D-4 dashboardStats：待确认仅计历史 pending；待派单仅 grooming 口径（自动派单后恒 0）
 * 运行：node philia-app/server/node_modules/tsx/dist/cli.mjs evidence/s4-auto-dispatch/D/d1-source-trace.mts
 * 隔离：独立临时库（PHILIA_DB_URL → %TMP%），不触碰 server/data/philia.db。
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-s4d-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 's4d.db').replaceAll('\\', '/')}`;

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`, cond ? '' : JSON.stringify(extra));
  if (!cond) failures++;
};

const { migrate } = await import('drizzle-orm/libsql/migrator');
const { db, schema, client } = await import('../src/db/index.ts');
const { eq } = await import('drizzle-orm');
const { appointmentRouter } = await import('../src/routers/appointment.ts');
const { storeRouter } = await import('../src/routers/store.ts');
type Context = import('../src/trpc.ts').Context;

await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../../philia-app/server/drizzle', import.meta.url)) });

/* ---- 夹具 ---- */
await db.insert(schema.users).values([
  { id: 'u-c', kimiId: 'k-c', nickname: '客户' },
  { id: 'u-m', kimiId: 'k-m', nickname: '店主' },
  { id: 'u-g1', kimiId: 'k-g1', nickname: '美容师甲' },
  { id: 'u-g2', kimiId: 'k-g2', nickname: '美容师乙' },
]);
await db.insert(schema.userRoles).values([
  { userId: 'u-c', role: 'customer' },
  { userId: 'u-m', role: 'merchant_owner' },
  { userId: 'u-g1', role: 'staff' },
  { userId: 'u-g2', role: 'staff' },
]);
const OPEN = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: '09:00', close: '20:00' }]),
);
const SCHED = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ start: '09:00', end: '20:00' }]]),
);
await db.insert(schema.stores).values({ id: 's-1', ownerId: 'u-m', name: 'S4D 店', openHours: OPEN, status: 'active' });
await db.insert(schema.staff).values([
  { id: 'st-g1', storeId: 's-1', userId: 'u-g1', name: '美容师甲', role: 'groomer', skills: ['wash'], schedule: SCHED, status: 'active' },
  { id: 'st-g2', storeId: 's-1', userId: 'u-g2', name: '美容师乙', role: 'groomer', skills: ['wash'], schedule: SCHED, status: 'active' },
]);
await db.insert(schema.pets).values({ id: 'p-1', ownerId: 'u-c', name: '豆豆', species: 'dog' });
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
const m1 = appointmentRouter.createCaller({ db, user: { id: 'u-m', nickname: '店主', roles: ['merchant_owner'], storeId: 's-1' } } as Context);
const m1Store = storeRouter.createCaller({ db, user: { id: 'u-m', nickname: '店主', roles: ['merchant_owner'], storeId: 's-1' } } as Context);

/* ---- D-1：auto → merchant 覆盖 ---- */
const a1 = await c1.create({
  storeId: 's-1', petId: 'p-1', serviceId: 'sv-g', type: 'grooming',
  scheduledStart: at(1, 10), paymentMode: 'pay_at_store',
});
check('D-1a 下单自动派单：assignSource=auto（staff_id=st-g1）', a1.assignSource === 'auto' && a1.staffId === 'st-g1', { s: a1.assignSource });
const re = await m1.assign({ appointmentId: a1.id, staffId: 'st-g2' });
check('D-1b 商家 assign 改派不回归：改派 st-g2 成功，assignSource 覆盖为 merchant', re.staffId === 'st-g2' && re.assignSource === 'merchant', { staffId: re.staffId, s: re.assignSource });

/* ---- D-2：assigned 事件即轨迹（by: auto → merchant） ---- */
const evts = (await db.select().from(schema.eventOutbox)).filter(
  (r) => r.eventType === 'appointment.assigned' && (r.payload as Record<string, unknown>)?.appointmentId === a1.id,
);
const bySeq = evts.map((r) => `${r.channel}:${(r.payload as Record<string, unknown>)?.by}`);
check(
  'D-2 assigned 事件轨迹：下单 by=auto（staff+user）→ 改派 by=merchant（staff+user），无审计表',
  evts.length === 4 &&
    evts.filter((r) => (r.payload as Record<string, unknown>)?.by === 'auto').length === 2 &&
    evts.filter((r) => (r.payload as Record<string, unknown>)?.by === 'merchant').length === 2 &&
    evts.some((r) => r.channel === 'staff:st-g2' && (r.payload as Record<string, unknown>)?.by === 'merchant'),
  bySeq,
);

/* ---- D-3：listForStore 透出 assignSource（列表/详情来源标记数据源） ---- */
const list = await m1.listForStore();
const row = list.find((r) => r.id === a1.id);
check('D-3 listForStore 行带 assignSource=merchant（商家端列表/详情来源标记直显）', row?.assignSource === 'merchant', row && { s: row.assignSource });

/* ---- D-4：dashboardStats 待办口径 ---- */
// 历史 pending（直插）+ boarding confirmed 未指派（直插）各一：
// todo.pending=1（历史单仍计数）；todo.unassigned=0（grooming 自动派单恒 0；boarding 不计派单待办）
await db.insert(schema.services).values({
  id: 'sv-b', storeId: 's-1', type: 'boarding', name: '标准间寄养', boardingRoomType: '标准间', priceFen: 19900,
});
await db.insert(schema.appointments).values([
  {
    code: 'S4DL01', customerId: 'u-c', storeId: 's-1', petId: 'p-1', serviceId: 'sv-g',
    type: 'grooming', scheduledStart: at(2, 10), scheduledEnd: at(2, 11),
    status: 'pending', priceFen: 8800, paymentMode: 'pay_at_store',
  },
  {
    code: 'S4DL02', customerId: 'u-c', storeId: 's-1', petId: 'p-1', serviceId: 'sv-b',
    type: 'boarding', scheduledStart: at(3, 10), scheduledEnd: at(4, 10),
    status: 'confirmed', priceFen: 19900, paymentMode: 'pay_at_store',
  },
]);
const stats = await m1Store.dashboardStats();
check(
  'D-4 dashboardStats：待确认仅计历史 pending（=1）；待派单 grooming 口径恒 0（boarding 未指派不计）',
  stats.todo.pending === 1 && stats.todo.unassigned === 0,
  stats.todo,
);

client.close();
console.log(failures === 0 ? '\n任务 D（服务端口径）证据全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
