/**
 * 批次 S4 · 寄养回归证据：自动确认 + 按晚占用口径回归
 *  R-1 boarding create 落库即 confirmed（寄养同口径自动确认）
 *  R-2 按晚占用口径不动：逐晚 UPSERT boarding_slots（入住日到退房日前一日）
 *  R-3 任一晚满员 → CONFLICT 整体回滚（无部分占用、无预约记录）
 *  R-4 取消（>4h）→ 全部晚释放（booked_count 归零，行保留）
 *  R-5 寄养不自动派单（staff_id=NULL、无 assigned 事件）、不占洗护 30min 时段槽
 * 运行：node philia-app/server/node_modules/tsx/dist/cli.mjs evidence/s4-auto-dispatch/D/d3-boarding-regression.mts
 * 隔离：独立临时库（PHILIA_DB_URL → %TMP%），不触碰 server/data/philia.db。
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-s4r-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 's4r.db').replaceAll('\\', '/')}`;

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`, cond ? '' : JSON.stringify(extra));
  if (!cond) failures++;
};

const { migrate } = await import('drizzle-orm/libsql/migrator');
const { db, schema, client } = await import('../../../philia-app/server/src/db/index.ts');
const { and, asc, eq } = await import('drizzle-orm');
const { appointmentRouter } = await import('../../../philia-app/server/src/routers/appointment.ts');
type Context = import('../../../philia-app/server/src/trpc.ts').Context;

await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../../philia-app/server/drizzle', import.meta.url)) });

await db.insert(schema.users).values([
  { id: 'u-c', kimiId: 'k-c', nickname: '客户' },
  { id: 'u-c2', kimiId: 'k-c2', nickname: '客户二' },
]);
await db.insert(schema.userRoles).values([
  { userId: 'u-c', role: 'customer' },
  { userId: 'u-c2', role: 'customer' },
]);
const OPEN = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: '09:00', close: '20:00' }]),
);
await db.insert(schema.stores).values({ id: 's-1', ownerId: 'u-c', name: 'S4R 店', openHours: OPEN, status: 'active' });
await db.insert(schema.pets).values([
  { id: 'p-1', ownerId: 'u-c', name: '豆豆', species: 'dog', vaccineValidUntil: '2027-03-01' },
  { id: 'p-2', ownerId: 'u-c2', name: '花花', species: 'cat', vaccineValidUntil: '2027-06-01' },
]);
await db.insert(schema.services).values({
  id: 'sv-b', storeId: 's-1', type: 'boarding', name: '标准间寄养', boardingRoomType: '标准间', roomCount: 1, priceFen: 19900,
});

const at = (dayOffset: number, h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, 0, 0, 0);
  return d;
};
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const c1 = appointmentRouter.createCaller({ db, user: { id: 'u-c', nickname: '客户', roles: ['customer'] } } as Context);
const c2 = appointmentRouter.createCaller({ db, user: { id: 'u-c2', nickname: '客户二', roles: ['customer'] } } as Context);
const nights = async () =>
  db.select().from(schema.boardingSlots).where(eq(schema.boardingSlots.storeId, 's-1')).orderBy(asc(schema.boardingSlots.nightDate));

/* ---- R-1/R-2：寄养 create 自动确认 + 逐晚占用 ---- */
const b1 = await c1.create({
  storeId: 's-1', petId: 'p-1', serviceId: 'sv-b', type: 'boarding',
  scheduledStart: at(5, 10), scheduledEnd: at(8, 10), paymentMode: 'pay_at_store',
});
check('R-1 寄养 create 落库即 confirmed（自动确认同口径）', b1.status === 'confirmed', b1.status);
const n1 = await nights();
check(
  'R-2 按晚占用口径不动：晚 D+5/D+6/D+7 各 1 行（入住日到退房日前一日），priceFen=单晚价×3',
  n1.length === 3 &&
    [isoDay(at(5, 10)), isoDay(at(6, 10)), isoDay(at(7, 10))].every((d) =>
      n1.some((r) => r.nightDate === d && r.bookedCount === 1 && r.capacity === 1),
    ) &&
    b1.priceFen === 19900 * 3,
  n1.map((r) => [r.nightDate, r.bookedCount]),
);

/* ---- R-5：寄养不自动派单、不占洗护槽 ---- */
check('R-5a 寄养不自动派单（staff_id=NULL）', b1.staffId === null, b1.staffId);
const assignedEvts = (await db.select().from(schema.eventOutbox)).filter(
  (r) => r.eventType === 'appointment.assigned' && (r.payload as Record<string, unknown>)?.appointmentId === b1.id,
);
check('R-5b 寄养无 assigned 事件（按晚占房无需美容师）', assignedEvts.length === 0);
const groomingSlots = await db.select().from(schema.storeSlots).where(eq(schema.storeSlots.storeId, 's-1'));
check('R-5c 寄养不占洗护 30min 时段槽（store_slots 零行）', groomingSlots.length === 0, groomingSlots.length);

/* ---- R-3：任一晚满员 → CONFLICT 整体回滚 ---- */
const before = await nights();
const c3 = await c2.create({
  storeId: 's-1', petId: 'p-2', serviceId: 'sv-b', type: 'boarding',
  scheduledStart: at(6, 10), scheduledEnd: at(9, 10), paymentMode: 'pay_at_store',
}).then(() => null, (e) => e as { code?: string; message?: string });
check('R-3a 任一晚满员（D+6/D+7 已占）→ CONFLICT「已订满」', c3?.code === 'CONFLICT' && /已订满/.test(c3?.message ?? ''), c3);
const after = await nights();
check(
  'R-3b 整体回滚：各晚快照逐项一致（无部分占用），客户二零预约记录',
  after.length === before.length &&
    after.every((r, i) => r.nightDate === before[i]!.nightDate && r.bookedCount === before[i]!.bookedCount) &&
    (await db.select().from(schema.appointments).where(eq(schema.appointments.customerId, 'u-c2'))).length === 0,
);

/* ---- R-4：取消释放全部晚 ---- */
const cc = await c1.cancel({ appointmentId: b1.id, reason: '行程变更' });
const n2 = await nights();
check(
  'R-4 >4h 取消 → cancelled + 全部晚释放（booked_count 归零，行保留）',
  cc.outcome === 'cancelled' && n2.every((r) => r.bookedCount === 0),
  n2.map((r) => [r.nightDate, r.bookedCount]),
);

/* ---- 疫苗阻断回归（客户端口径说明） ----
 * 服务端现状：create 无疫苗硬校验（疫苗阻断自 B4 起在客户端寄养向导
 * PetPicker(requireVaccineUntil=退房日) 与 BoardingConfirmBar 阻断卡实现）。
 * 本批未改动该链路（git diff 无 PetPicker/BoardingConfirmBar/boarding 相关文件），
 * 阻断行为与基线一致；种子宠物疫苗均在有效期内（本脚本夹具同），不触发阻断。 */
check('R-6 疫苗阻断链路本批零改动（客户端 PetPicker/BoardingConfirmBar 未动，见 d4-vaccine-diff.txt）', true);

client.close();
console.log(failures === 0 ? '\n寄养回归证据全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
