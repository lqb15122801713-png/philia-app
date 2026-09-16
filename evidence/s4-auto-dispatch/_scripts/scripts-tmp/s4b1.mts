/**
 * 批次 S4 · 任务 B 证据脚本：可用性引擎——时段容量 = 当班有空 groomer 数（动态）
 * 场景：2 名 groomer 全周排班 → 目标时段容量=2；造 1 条冲突单 → 容量=1；再造第 2 条 → 不可约
 * 运行：node philia-app/server/node_modules/tsx/dist/cli.mjs evidence/s4-auto-dispatch/B/b1-availability.mts
 * 隔离：独立临时库（PHILIA_DB_URL → %TMP%），不触碰 server/data/philia.db。
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-s4b-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 's4b.db').replaceAll('\\', '/')}`;

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`, cond ? '' : JSON.stringify(extra));
  if (!cond) failures++;
};

const { migrate } = await import('drizzle-orm/libsql/migrator');
const { db, schema, client } = await import('../src/db/index.ts');
const { storeRouter } = await import('../src/routers/store.ts');
type Context = import('../src/trpc.ts').Context;

await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../../philia-app/server/drizzle', import.meta.url)) });

/* ---- 夹具：门店 + 2 groomer（全周排班）+ 1 frontdesk + 1 停职 groomer ---- */
await db.insert(schema.users).values([{ id: 'u-c', kimiId: 'k-c', nickname: '客户' }]);
await db.insert(schema.userRoles).values({ userId: 'u-c', role: 'customer' });
const OPEN = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: '09:00', close: '20:00' }]),
);
const SCHED = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ start: '09:00', end: '20:00' }]]),
);
await db.insert(schema.stores).values({ id: 's-1', ownerId: 'u-c', name: 'S4B 店', openHours: OPEN, status: 'active' });
await db.insert(schema.users).values([
  { id: 'u-g1', kimiId: 'k-g1', nickname: '美容师一' },
  { id: 'u-g2', kimiId: 'k-g2', nickname: '美容师二' },
  { id: 'u-f', kimiId: 'k-f', nickname: '前台' },
  { id: 'u-g3', kimiId: 'k-g3', nickname: '停职美容师' },
]);
await db.insert(schema.staff).values([
  { id: 'st-g1', storeId: 's-1', userId: 'u-g1', name: '美容师一', role: 'groomer', skills: ['wash'], schedule: SCHED, status: 'active' },
  { id: 'st-g2', storeId: 's-1', userId: 'u-g2', name: '美容师二', role: 'groomer', skills: ['wash'], schedule: SCHED, status: 'active' },
  // frontdesk 不计入 groomer 容量；停职 groomer 不计入容量（空闲 = role groomer + active）
  { id: 'st-f', storeId: 's-1', userId: 'u-f', name: '前台', role: 'frontdesk', skills: ['wash'], schedule: SCHED, status: 'active' },
  { id: 'st-g3', storeId: 's-1', userId: 'u-g3', name: '停职美容师', role: 'groomer', skills: ['wash'], schedule: SCHED, status: 'suspended' },
]);
await db.insert(schema.pets).values({ id: 'p-1', ownerId: 'u-c', name: '豆豆', species: 'dog' });
await db.insert(schema.services).values({
  id: 'sv-g', storeId: 's-1', type: 'grooming', name: '基础洗护', durationMin: 60, priceFen: 8800,
});

const caller = storeRouter.createCaller({ db, user: { id: 'u-c', nickname: '客户', roles: ['customer'] } } as Context);

/** 目标槽：明天 10:00（60min 服务 → 区间 10:00-11:00） */
const T = new Date();
T.setDate(T.getDate() + 1);
T.setHours(10, 0, 0, 0);
const insertConflict = async (staffId: string, code: string) => {
  await db.insert(schema.appointments).values({
    code, customerId: 'u-c', storeId: 's-1', staffId, petId: 'p-1', serviceId: 'sv-g',
    type: 'grooming', scheduledStart: T, scheduledEnd: new Date(T.getTime() + 3600_000),
    status: 'confirmed', priceFen: 8800, paymentMode: 'pay_at_store',
  });
};
const capOf = async (t: Date): Promise<number | null> => {
  const r = await caller.getWithServices({ storeId: 's-1', serviceId: 'sv-g' });
  const hit = r.slots.find((s) => s.slotStart.getTime() === t.getTime());
  return hit ? hit.capacity : null;
};

/* ---- B-1：2 groomer 排班覆盖 → 该时段容量=2（frontdesk/停职不计入） ---- */
const cap0 = await capOf(T);
check('B-1 2 名 groomer 排班覆盖 → 时段容量=2（动态=空闲 groomer 数）', cap0 === 2, cap0);

/* ---- B-2：造 1 条冲突单（g1 同时段 confirmed）→ 容量=1 ---- */
await insertConflict('st-g1', 'S4B001');
const cap1 = await capOf(T);
check('B-2 g1 冲突单落库 → 同时段容量降为 1（查询时计算，无缓存表）', cap1 === 1, cap1);

/* ---- B-3：第 2 条冲突单（g2）→ 容量耗尽不显示为可约 ---- */
await insertConflict('st-g2', 'S4B002');
const cap2 = await capOf(T);
check('B-3 g1+g2 均冲突 → 容量=0 不显示为可约（栅格剔除）', cap2 === null, cap2);

/* ---- B-4：相邻时段不受影响（10:30 区间 10:30-11:30 与 10:00-11:00 重叠 → 同样满；
   12:00 区间 12:00-13:00 无重叠 → 容量回到 2） ---- */
const T12 = new Date(T);
T12.setHours(12, 0, 0, 0);
const cap12 = await capOf(T12);
check('B-4 无重叠时段（12:00）容量仍为 2（区间重叠才算冲突）', cap12 === 2, cap12);

/* ---- B-5：store_slots 降级实证——插一行「满槽」占用记录，不影响可约判定 ---- */
await db.insert(schema.storeSlots).values({
  storeId: 's-1', slotStart: T12, capacity: 1, bookedCount: 1,
});
const cap12b = await capOf(T12);
check('B-5 store_slots 满槽行不再参与判定（12:00 容量仍=2），降级为占用记录', cap12b === 2, cap12b);

/* ---- B-6：cancelled 预约不算冲突（释放后容量恢复） ---- */
await db.insert(schema.appointments).values({
  code: 'S4B003', customerId: 'u-c', storeId: 's-1', staffId: 'st-g1', petId: 'p-1', serviceId: 'sv-g',
  type: 'grooming', scheduledStart: T12, scheduledEnd: new Date(T12.getTime() + 3600_000),
  status: 'cancelled', priceFen: 8800, paymentMode: 'pay_at_store',
});
const cap12c = await capOf(T12);
check('B-6 cancelled 预约不构成冲突（仅 g 无占用即空闲）', cap12c === 2, cap12c);

client.close();
console.log(failures === 0 ? '\n任务 B 证据全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
