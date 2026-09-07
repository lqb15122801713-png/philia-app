/**
 * B3-5 验收夹具（针对种子库，用后需清理——runCleanup 在证据采集完成后由 tmp-b35-clean.mts 执行）：
 * 1. orderE（命令行 argv[2] 传入 id）：scheduledStart/End 拨到 now+2h/+3h，造 ≤4h 取消审核场景；
 * 2. 新建 in_service 洗护单 G：六步 1-5 done、第 6 步 confirm active（A-P2-13 文案截图用）。
 * 运行：./node_modules/.bin/tsx tmp-b35-fixtures.mts <orderE_id>
 */
import { db, schema, client } from './src/db';
import { eq } from 'drizzle-orm';

const orderE = process.argv[2];
if (!orderE) throw new Error('usage: tsx tmp-b35-fixtures.mts <orderE_id>');

/* ---- 1. orderE 拨到 2 小时后（≤4h 取消 → 转 cancel_requested） ---- */
const now = Date.now();
await db
  .update(schema.appointments)
  .set({
    scheduledStart: new Date(now + 2 * 3600_000),
    scheduledEnd: new Date(now + 3 * 3600_000),
    updatedAt: new Date(),
  })
  .where(eq(schema.appointments.id, orderE));
console.log('orderE bumped to', new Date(now + 2 * 3600_000).toLocaleString('zh-CN', { hour12: false }));

/* ---- 2. A-P2-13 live 页夹具：in_service + 六步前五步 done、confirm active ---- */
const store = await db.select().from(schema.stores).get();
const customer = await db.select().from(schema.users).where(eq(schema.users.nickname, '示例客户')).get();
const staffUser = await db.select().from(schema.users).where(eq(schema.users.nickname, '小美')).get();
const staffRow = await db.select().from(schema.staff).where(eq(schema.staff.userId, staffUser!.id)).get();
const pet = await db.select().from(schema.pets).where(eq(schema.pets.ownerId, customer!.id)).get();
const svc = await db
  .select()
  .from(schema.services)
  .where(eq(schema.services.storeId, store!.id))
  .then((rows) => rows.find((r) => r.type === 'grooming'));
const start = new Date(now - 90 * 60_000);
const [appt] = await db
  .insert(schema.appointments)
  .values({
    code: 'B35LIV',
    customerId: customer!.id,
    storeId: store!.id,
    staffId: staffRow!.id,
    petId: pet!.id,
    serviceId: svc!.id,
    type: 'grooming',
    scheduledStart: start,
    scheduledEnd: new Date(start.getTime() + 3600_000),
    status: 'in_service',
    priceFen: svc!.priceFen,
    paymentMode: 'pay_at_store',
    checkedInAt: new Date(now - 60 * 60_000),
    note: 'A-P2-13 文案验收夹具（用完即清）',
  })
  .returning();
const STEPS: Array<[string, number, number]> = [
  ['disinfection', 1, 1],
  ['precheck', 2, 2],
  ['grooming', 3, 3],
  ['detail', 4, 2],
  ['before_after', 5, 2],
  ['confirm', 6, 0],
];
for (const [key, order, req] of STEPS) {
  await db.insert(schema.appointmentSteps).values({
    appointmentId: appt!.id,
    stepKey: key,
    stepOrder: order,
    status: order < 6 ? 'done' : 'active',
    requiredPhotos: req,
    startedAt: new Date(now - (70 - order * 10) * 60_000),
    ...(order < 6 ? { doneAt: new Date(now - (65 - order * 10) * 60_000) } : {}),
  });
}
console.log('live fixture appointment id =', appt!.id);
client.close();
