/**
 * PD-44 U5 员工脸点验夹具（本地 dev 库专用；不入生产、不走预约提交流程）：
 * 直写 libsql 种子库，为 阿强（groomer）/小美（frontdesk）造今日 S-01/S-02/S-12/S-10 演示单：
 *   - in_service 洗护单（六步：done×2 + active×1 + locked×3）→ S-01 Workcard 六步 now / S-02 半展·全展
 *   - confirmed 造型单（今日稍后）→ S-02 待接薄行「开始执行」pill / 前台待核销
 *   - completed 昨日单 + 今日已完成单 → S-02 薄行 / S-12 切日回看
 *   - confirmed 明日单 → S-02 明日注
 *   - confirmed 寄养单（今日入住）→ S-10 寄养打卡入口/登记脸
 * 幂等：code 前缀 U5D% 先清后插。运行：cd server && npx tsx scripts/u5-demo-appointments.ts
 */
import { eq, like } from 'drizzle-orm';
import { db, schema } from '../src/db/index.js';

const HOUR = 3_600_000;
const MIN = 60_000;

async function main() {
  /* ---- 幂等清理（U5D% 前缀单连带 steps/stays 先删） ---- */
  const olds = await db.select().from(schema.appointments).where(like(schema.appointments.code, 'U5D%'));
  for (const a of olds) {
    await db.delete(schema.appointmentSteps).where(eq(schema.appointmentSteps.appointmentId, a.id));
    await db.delete(schema.boardingStays).where(eq(schema.boardingStays.appointmentId, a.id));
    await db.delete(schema.appointments).where(eq(schema.appointments.id, a.id));
  }

  const store = (await db.select().from(schema.stores).limit(1))[0];
  const customer = (await db.select().from(schema.users).where(eq(schema.users.kimiId, 'seed_kimi_customer')))[0];
  const pet = (await db.select().from(schema.pets).limit(1))[0];
  const aqiang = (await db.select().from(schema.staff).where(eq(schema.staff.name, '阿强')))[0];
  const services = await db.select().from(schema.services);
  if (!store || !customer || !pet || !aqiang) throw new Error('种子基础数据缺失（store/customer/pet/阿强）——请先 db:seed');
  const svc = (name: string) => {
    const hit = services.find((s) => s.name === name);
    if (!hit) throw new Error(`服务项缺失：${name}`);
    return hit;
  };

  const now = Date.now();
  const base = {
    customerId: customer.id,
    storeId: store.id,
    petId: pet.id,
    staffId: aqiang.id,
    assignSource: 'auto' as const,
    paymentMode: 'pay_at_store' as const,
    note: '【U5 点验夹具】',
  };
  const ins = async (v: typeof base & Record<string, unknown>) =>
    (await db.insert(schema.appointments).values(v as typeof schema.appointments.$inferInsert).returning())[0]!;

  /* 1) 今日服务中单（六步：消毒✓ 预检✓ 洗护中） */
  const inService = await ins({
    ...base,
    code: 'U5D001',
    serviceId: svc('猫咪精致洗护').id,
    type: 'grooming',
    scheduledStart: new Date(now - 40 * MIN),
    scheduledEnd: new Date(now + 50 * MIN),
    status: 'in_service',
    priceFen: 16800,
    checkedInAt: new Date(now - 38 * MIN),
  });
  const stepRows = [
    { stepKey: 'disinfection', stepOrder: 1, requiredPhotos: 1, status: 'done', startedAt: new Date(now - 36 * MIN), doneAt: new Date(now - 33 * MIN) },
    { stepKey: 'precheck', stepOrder: 2, requiredPhotos: 2, status: 'done', startedAt: new Date(now - 33 * MIN), doneAt: new Date(now - 26 * MIN) },
    { stepKey: 'grooming', stepOrder: 3, requiredPhotos: 3, status: 'active', startedAt: new Date(now - 26 * MIN) },
    { stepKey: 'detail', stepOrder: 4, requiredPhotos: 2, status: 'locked' },
    { stepKey: 'before_after', stepOrder: 5, requiredPhotos: 2, status: 'locked' },
    { stepKey: 'confirm', stepOrder: 6, requiredPhotos: 0, status: 'locked' },
  ] as const;
  for (const s of stepRows) {
    await db.insert(schema.appointmentSteps).values({ appointmentId: inService.id, ...s });
  }

  /* 2) 今日待接单（S-02 薄行「开始执行」pill / 前台待核销） */
  await ins({
    ...base,
    code: 'U5D002',
    serviceId: svc('造型修剪').id,
    type: 'grooming',
    scheduledStart: new Date(now + 2 * HOUR),
    scheduledEnd: new Date(now + 3 * HOUR),
    status: 'confirmed',
    priceFen: 19800,
  });

  /* 3) 今日已完成单（S-02 薄行 done） */
  await ins({
    ...base,
    code: 'U5D003',
    serviceId: svc('基础洗护（小型犬）').id,
    type: 'grooming',
    scheduledStart: new Date(now - 4 * HOUR),
    scheduledEnd: new Date(now - 3 * HOUR),
    status: 'completed',
    priceFen: 8800,
    checkedInAt: new Date(now - 4 * HOUR + 5 * MIN),
    completedAt: new Date(now - 3 * HOUR),
  });

  /* 4) 昨日已完成单（S-12 切日回看） */
  await ins({
    ...base,
    code: 'U5D004',
    serviceId: svc('深层清洁 SPA').id,
    type: 'grooming',
    scheduledStart: new Date(now - 24 * HOUR - 3 * HOUR),
    scheduledEnd: new Date(now - 24 * HOUR - 2 * HOUR),
    status: 'completed',
    priceFen: 25800,
    checkedInAt: new Date(now - 24 * HOUR - 3 * HOUR + 4 * MIN),
    completedAt: new Date(now - 24 * HOUR - 2 * HOUR),
    rating: 5,
  });

  /* 5) 明日待接单（S-02 明日注） */
  await ins({
    ...base,
    code: 'U5D005',
    serviceId: svc('快速洗+吹干').id,
    type: 'grooming',
    scheduledStart: new Date(now + 24 * HOUR + 2 * HOUR),
    scheduledEnd: new Date(now + 24 * HOUR + 2 * HOUR + 45 * MIN),
    status: 'confirmed',
    priceFen: 6800,
  });

  /* 6) 今日寄养待入住单（S-10 寄养打卡入口；未建 stay=入住登记态） */
  await ins({
    ...base,
    code: 'U5D006',
    serviceId: svc('标准间寄养（犬）').id,
    type: 'boarding',
    scheduledStart: new Date(now + 1 * HOUR),
    scheduledEnd: new Date(now + 26 * HOUR),
    status: 'confirmed',
    priceFen: 19900,
  });

  /* 7) 本店未指派待承接单（前台待核销分组证据：staffId=null 才进前台队列） */
  await ins({
    ...base,
    staffId: null,
    assignSource: null,
    code: 'U5D007',
    serviceId: svc('基础洗护（中型犬）').id,
    type: 'grooming',
    scheduledStart: new Date(now + 3 * HOUR),
    scheduledEnd: new Date(now + 4 * HOUR + 30 * MIN),
    status: 'confirmed',
    priceFen: 12800,
  });

  /* 7) S-11 店长审批视界：小美（frontdesk）补 merchant_manager 角色（幂等） */
  const xiaomei = (await db.select().from(schema.users).where(eq(schema.users.kimiId, 'seed_kimi_staff1')))[0];
  if (!xiaomei) throw new Error('种子用户缺失：小美');
  const hasManager = await db
    .select()
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, xiaomei.id));
  if (!hasManager.some((r) => r.role === 'merchant_manager')) {
    await db.insert(schema.userRoles).values({ userId: xiaomei.id, role: 'merchant_manager' });
  }

  console.log(JSON.stringify({ ok: true, inServiceId: inService.id, cleaned: olds.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
