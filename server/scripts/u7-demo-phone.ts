/**
 * PD46 U7 商家手机 phone-v57 点验夹具（本地 dev 库专用；不入生产、不走任何提交/支付流程）：
 * 直写 libsql 种子库，为 15 屏结构证据造数据：
 *   - 今日预约（in_service 六步 done2/active1/locked3 + confirmed 待接 + completed 已收/待收）
 *     → W-01 驾驶舱今日列表 / W-02 台账 / W-04 监控卡列 / W-13 月度台账（已收·待收两态）
 *   - 商城订单 ×2（paid / shipped）→ W-09 订单表
 *   - 次卡 ×2（两名用户；+2 扣次流水）→ W-11 持卡列表＋双归属注＋扣次流水
 *   - 收银单 settled ×1 + 退款单 executed ×1（挂原单，DRAFT→EXECUTED 口径）
 *     → W-08 退款表 / W-13 退款汇总
 * 幂等：单号前缀 U7D% 先清后插。运行：cd server && npx tsx scripts/u7-demo-phone.ts
 */
import { eq, like } from 'drizzle-orm';
import { db, schema } from '../src/db/index.js';

const HOUR = 3_600_000;
const MIN = 60_000;

async function main() {
  /* ---- 幂等清理 ---- */
  const oldAppts = await db.select().from(schema.appointments).where(like(schema.appointments.code, 'U7D%'));
  for (const a of oldAppts) {
    await db.delete(schema.appointmentSteps).where(eq(schema.appointmentSteps.appointmentId, a.id));
    await db.delete(schema.appointments).where(eq(schema.appointments.id, a.id));
  }
  await db.delete(schema.orders).where(like(schema.orders.orderNo, 'U7D%'));
  const oldBills = await db.select().from(schema.cashierBills).where(like(schema.cashierBills.billNo, 'U7D%'));
  for (const b of oldBills) {
    const refs = await db.select().from(schema.refundBills).where(eq(schema.refundBills.billId, b.id));
    for (const r of refs) {
      await db.delete(schema.refundBillItems).where(eq(schema.refundBillItems.refundId, r.id));
      await db.delete(schema.refundBills).where(eq(schema.refundBills.id, r.id));
    }
    await db.delete(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, b.id));
    await db.delete(schema.cashierBills).where(eq(schema.cashierBills.id, b.id));
  }
  await db.delete(schema.refundBills).where(like(schema.refundBills.refundNo, 'U7D%'));
  const oldPasses = await db.select().from(schema.memberPasses).all();
  for (const p of oldPasses) {
    await db.delete(schema.passDeductLogs).where(eq(schema.passDeductLogs.passId, p.id));
    await db.delete(schema.memberPasses).where(eq(schema.memberPasses.id, p.id));
  }

  const store = (await db.select().from(schema.stores).limit(1))[0];
  const owner = (await db.select().from(schema.users).where(eq(schema.users.kimiId, 'seed_kimi_owner')))[0];
  const customer = (await db.select().from(schema.users).where(eq(schema.users.kimiId, 'seed_kimi_customer')))[0];
  const pet = (await db.select().from(schema.pets).limit(1))[0];
  const aqiang = (await db.select().from(schema.staff).where(eq(schema.staff.name, '阿强')))[0];
  const services = await db.select().from(schema.services);
  const product = (await db.select().from(schema.products).limit(1))[0];
  if (!store || !owner || !customer || !pet || !aqiang || !product) {
    throw new Error('种子基础数据缺失（store/owner/customer/pet/阿强/product）——请先 db:seed');
  }
  const svc = (name: string) => {
    const hit = services.find((s) => s.name === name);
    if (!hit) throw new Error(`服务项缺失：${name}`);
    return hit;
  };

  const now = Date.now();
  const today = new Date();
  const bizDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  /* ---- 1) 今日预约（in_service 六步 / confirmed / completed 已收 / completed 待收） ---- */
  const base = {
    customerId: customer.id,
    storeId: store.id,
    petId: pet.id,
    staffId: aqiang.id,
    assignSource: 'auto' as const,
    paymentMode: 'pay_at_store' as const,
    note: '【U7 点验夹具】',
  };
  const ins = async (v: typeof base & Record<string, unknown>) =>
    (await db.insert(schema.appointments).values(v as typeof schema.appointments.$inferInsert).returning())[0]!;

  const inService = await ins({
    ...base,
    code: 'U7D001',
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

  await ins({
    ...base,
    code: 'U7D002',
    serviceId: svc('造型修剪').id,
    type: 'grooming',
    scheduledStart: new Date(now + 2 * HOUR),
    scheduledEnd: new Date(now + 3 * HOUR),
    status: 'confirmed',
    priceFen: 12800,
  });
  await ins({
    ...base,
    code: 'U7D003',
    serviceId: svc('猫咪精致洗护').id,
    type: 'grooming',
    scheduledStart: new Date(now - 4 * HOUR),
    scheduledEnd: new Date(now - 3 * HOUR),
    status: 'completed',
    priceFen: 16800,
    paidAt: new Date(now - 3 * HOUR),
  });
  await ins({
    ...base,
    code: 'U7D004',
    serviceId: svc('造型修剪').id,
    type: 'grooming',
    scheduledStart: new Date(now - 6 * HOUR),
    scheduledEnd: new Date(now - 5 * HOUR),
    status: 'completed',
    priceFen: 12800,
  });

  /* ---- 2) 商城订单 ×2 ---- */
  const address = { receiver: '示例客户', phone: '13800000000', province: '浙江省', city: '杭州市', detail: '西湖区文三路 100 号' };
  await db.insert(schema.orders).values({
    orderNo: 'U7D-ORD-001',
    customerId: customer.id,
    storeId: store.id,
    items: [{ product_id: product.id, name: product.name, quantity: 1, price_fen: product.priceFen }],
    totalFen: product.priceFen,
    address,
    status: 'paid',
    deliveryMethod: 'express',
  });
  await db.insert(schema.orders).values({
    orderNo: 'U7D-ORD-002',
    customerId: customer.id,
    storeId: store.id,
    items: [{ product_id: product.id, name: product.name, quantity: 2, price_fen: product.priceFen }],
    totalFen: product.priceFen * 2,
    address,
    status: 'shipped',
    trackingNo: 'SF0000000001',
    deliveryMethod: 'express',
    shippedAt: new Date(now - 5 * HOUR),
  });

  /* ---- 3) 次卡 ×2（两用户）＋ 扣次流水 ---- */
  const staffUser = (await db.select().from(schema.users).where(eq(schema.users.nickname, '阿强')))[0];
  const passHolders = [customer, staffUser].filter(Boolean);
  let seq = 0;
  for (const holder of passHolders) {
    seq += 1;
    const pass = (await db
      .insert(schema.memberPasses)
      .values({
        userId: holder!.id,
        storeId: store.id,
        totalTimes: 10,
        remainTimes: seq === 1 ? 6 : 3,
        status: 'active',
        expiresAt: new Date(now + 90 * 24 * HOUR),
      })
      .returning())[0]!;
    await db.insert(schema.passDeductLogs).values({
      passId: pass.id,
      appointmentId: null,
      delta: -1,
      note: '【U7 点验夹具】洗护扣次',
    });
    await db.insert(schema.passDeductLogs).values({
      passId: pass.id,
      appointmentId: null,
      delta: 10,
      note: '【U7 点验夹具】开卡充次',
    });
  }

  /* ---- 4) 收银单 settled ×1 ＋ 退款单 executed ×1（DRAFT→EXECUTED 口径） ---- */
  const bill = (await db
    .insert(schema.cashierBills)
    .values({
      billNo: 'U7D-HD-001',
      storeId: store.id,
      status: 'settled',
      customerId: customer.id,
      discountType: 'none',
      discountValue: 0,
      subtotalFen: 29600,
      discountFen: 0,
      payableFen: 29600,
      paidFen: 29600,
      note: '【U7 点验夹具】',
      createdBy: owner.id,
      operatorId: owner.id,
      settledAt: new Date(now - 2 * HOUR),
      refundStatus: 'refunded',
    })
    .returning())[0]!;
  const refund = (await db
    .insert(schema.refundBills)
    .values({
      storeId: store.id,
      refundNo: 'U7D-RB-001',
      bizDate,
      billId: bill.id,
      type: 'full',
      amountFen: 29600,
      reason: '【U7 点验夹具】客户临时改期全额退',
      status: 'executed',
      refundMethod: 'offline_original',
      settledAt: new Date(now - 1 * HOUR),
      settleNote: '线下原路已退',
      operatorId: owner.id,
      approverId: owner.id,
    })
    .returning())[0]!;
  await db.update(schema.cashierBills).set({ refundBillNo: refund.refundNo }).where(eq(schema.cashierBills.id, bill.id));

  console.log('[u7-demo-phone] 夹具落库：预约4（in_service1/confirmed1/completed2） 订单2 次卡2 收银单1 退款单1');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
