/**
 * PD-79（服务中撤单／撤核销入口）冒烟：appointment.merchantCancel + voidCheckin 增强
 *
 * 运行：node node_modules/tsx/dist/cli.mjs src/routers/__tests__/appointment.pd79.smoke.ts
 *
 * 独立成文说明：对齐 PD-66 冒烟隔离策略（独立临时库跑真迁移，结束自清，种子库零触碰）。
 *
 * 覆盖（令包口径）：
 * 1. 入口权限：merchantCancel / voidCheckin 钉 merchantManagerProcedure——
 *    customer / clerk / 员工（staff 角色，潘婧反证 server 侧）/ 他店店主 FORBIDDEN；
 * 2. 必填原因：merchantCancel / voidCheckin 缺 reason 或空串 → BAD_REQUEST（zod 闸）；
 * 3. 涉钱 mock 闸：in_service 且 paidAt 落值 → 双端点 400「涉钱…另闸」；
 *    in_service 且 cashier_bill_items 存在本单预约行 → 400「收银台…另闸」；
 * 4. 撤核销留痕：payload 带 by/reason/beforeStatus/afterStatus（事件即轨迹，时间=outbox created_at）；
 * 5. 撤单主路径：in_service → cancelled + cancelSource='merchant' + cancelReason 落库 +
 *    槽位释放 + 六步进度行保留（历史留痕，无再核销索引压力）+ appointment.cancelled 双频道
 *    （user+store）payload 含 by/reason/beforeStatus/afterStatus/cancelSource；重复撤单 400；
 * 6. 联动回冲：pass_deduct 单撤单同事务回补次卡（remain 4→5）+ 预付台账 checked_deducted→refunded；
 *    提成/XP/回馈金对「已核销未收银」单均未发生（读侧计提口径），无需回冲——本文件以
 *    涉钱闸 + 台账回翻断言守住边界。
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 必须先于任何 '../db' 相关模块加载：指向独立临时库 + 固定预约码密钥
const tmpDir = mkdtempSync(join(tmpdir(), 'philia-pd79-smoke-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'smoke.db').replaceAll('\\', '/')}`;
process.env.BOOKING_CODE_SECRET = 'pd79-in-service-void-entry-smoke-secret';

/* ------------------------------ 小工具 ------------------------------ */

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}

/** 断言 Promise 以指定 TRPCError code 拒绝（可选消息正则） */
async function rejects(p: Promise<unknown>, code: string, msgRe?: RegExp): Promise<boolean> {
  try {
    await p;
    return false;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return err.code === code && (!msgRe || msgRe.test(err.message ?? ''));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 相对今天 dayOffset 天、本地 h:m 的时间（秒/毫秒清零） */
const at = (dayOffset: number, h: number, m = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};

/* ------------------------------ 主流程 ------------------------------ */

try {
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { db, schema, client } = await import('../../db');
  const { and, eq } = await import('drizzle-orm');
  type Context = import('../../trpc').Context;
  const { appointmentRouter } = await import('../appointment');

  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });

  /* ---------- 夹具数据（对齐 appointment.voidcheckin.smoke.ts 最小集 + 次卡） ---------- */
  await db.insert(schema.users).values([
    { id: 'u-c1', kimiId: 'k-c1', nickname: '客户一号', phone: '13800001111' },
    { id: 'u-m', kimiId: 'k-m', nickname: '敏慧' }, // 评测人设：商家正例
    { id: 'u-mg', kimiId: 'k-mg', nickname: '店长' },
    { id: 'u-b', kimiId: 'k-b', nickname: '潘婧' }, // 评测人设：员工反证
    { id: 'u-x', kimiId: 'k-x', nickname: '他店店主' },
    // 自动派单池：同槽多夹具需多名 groomer（每单独占一名美容师时段）
    { id: 'u-g1', kimiId: 'k-g1', nickname: '美容师一' },
    { id: 'u-g2', kimiId: 'k-g2', nickname: '美容师二' },
    { id: 'u-g3', kimiId: 'k-g3', nickname: '美容师三' },
    { id: 'u-g4', kimiId: 'k-g4', nickname: '美容师四' },
    { id: 'u-g5', kimiId: 'k-g5', nickname: '美容师五' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: 'u-c1', role: 'customer' },
    { userId: 'u-m', role: 'merchant_owner' },
    { userId: 'u-mg', role: 'merchant_manager' },
    { userId: 'u-b', role: 'staff' },
    { userId: 'u-x', role: 'merchant_owner' },
    { userId: 'u-g1', role: 'staff' },
    { userId: 'u-g2', role: 'staff' },
    { userId: 'u-g3', role: 'staff' },
    { userId: 'u-g4', role: 'staff' },
    { userId: 'u-g5', role: 'staff' },
  ]);
  const OPEN_ALL = {
    mon: { open: '09:00', close: '20:00' },
    tue: { open: '09:00', close: '20:00' },
    wed: { open: '09:00', close: '20:00' },
    thu: { open: '09:00', close: '20:00' },
    fri: { open: '09:00', close: '20:00' },
    sat: { open: '09:00', close: '20:00' },
    sun: { open: '09:00', close: '20:00' },
  };
  const SCHED_FULL = {
    mon: [{ start: '00:00', end: '23:59' }],
    tue: [{ start: '00:00', end: '23:59' }],
    wed: [{ start: '00:00', end: '23:59' }],
    thu: [{ start: '00:00', end: '23:59' }],
    fri: [{ start: '00:00', end: '23:59' }],
    sat: [{ start: '00:00', end: '23:59' }],
    sun: [{ start: '00:00', end: '23:59' }],
  };
  await db.insert(schema.stores).values([
    { id: 's-1', ownerId: 'u-m', name: 'PD79 一号店', openHours: OPEN_ALL, status: 'active' },
    { id: 's-9', ownerId: 'u-x', name: 'PD79 他店', openHours: OPEN_ALL, status: 'active' },
  ]);
  await db.insert(schema.staff).values([
    { id: 'st-b', storeId: 's-1', userId: 'u-b', name: '潘婧', role: 'frontdesk', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-g1', storeId: 's-1', userId: 'u-g1', name: '美容师一', role: 'groomer', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-g2', storeId: 's-1', userId: 'u-g2', name: '美容师二', role: 'groomer', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-g3', storeId: 's-1', userId: 'u-g3', name: '美容师三', role: 'groomer', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-g4', storeId: 's-1', userId: 'u-g4', name: '美容师四', role: 'groomer', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-g5', storeId: 's-1', userId: 'u-g5', name: '美容师五', role: 'groomer', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
  ]);
  await db.insert(schema.pets).values([{ id: 'p-1', ownerId: 'u-c1', name: '豆豆', species: 'dog' }]);
  await db.insert(schema.services).values([
    { id: 'sv-g1', storeId: 's-1', type: 'grooming', name: '基础洗护', durationMin: 60, priceFen: 8800 },
  ]);
  const T1 = at(1, 10);
  await db.insert(schema.storeSlots).values([{ storeId: 's-1', slotStart: T1, capacity: 8, bookedCount: 0 }]);
  // 次卡：pass_deduct 回冲联动夹具（5 次）
  await db.insert(schema.memberPasses).values({
    id: 'mp-c1',
    userId: 'u-c1',
    storeId: 's-1',
    totalTimes: 5,
    remainTimes: 5,
    status: 'active',
  });

  /* ---------- Context 直注 ---------- */
  const ctxCustomer = (id: string): Context => ({ db, user: { id, nickname: null, roles: ['customer'] } });
  const ctxStaff = (id: string, staffId: string, storeId: string): Context => ({
    db,
    user: { id, nickname: null, roles: ['staff'], staffId, storeId },
  });
  const ctxMerchant = (
    id: string,
    storeId: string,
    roles: NonNullable<Context['user']>['roles'] = ['merchant_owner'],
  ): Context => ({
    db,
    user: { id, nickname: null, roles, storeId },
  });
  const c1 = appointmentRouter.createCaller(ctxCustomer('u-c1'));
  const m1 = appointmentRouter.createCaller(ctxMerchant('u-m', 's-1'));
  const mg1 = appointmentRouter.createCaller(ctxMerchant('u-mg', 's-1', ['merchant_manager']));
  const x1 = appointmentRouter.createCaller(ctxMerchant('u-x', 's-9'));
  const clerk1 = appointmentRouter.createCaller(ctxMerchant('u-mg', 's-1', ['merchant_clerk']));
  const pjStaff = appointmentRouter.createCaller(ctxStaff('u-b', 'st-b', 's-1')); // 潘婧（员工）

  /* ---------- 总账工具 ---------- */
  const outboxRows = async (channel: string, eventType: string) =>
    db
      .select()
      .from(schema.eventOutbox)
      .where(and(eq(schema.eventOutbox.channel, channel), eq(schema.eventOutbox.eventType, eventType)));
  const apptOf = async (id: string) =>
    db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).get();
  const stepsOf = async (id: string) =>
    db.select().from(schema.appointmentSteps).where(eq(schema.appointmentSteps.appointmentId, id));
  const slotOf = async () =>
    db
      .select()
      .from(schema.storeSlots)
      .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, T1)))
      .get();
  const remainOf = async () =>
    (await db.select().from(schema.memberPasses).where(eq(schema.memberPasses.id, 'mp-c1')).get())?.remainTimes;

  const createAndCheckin = async (paymentMode: 'pay_at_store' | 'pass_deduct', note: string) => {
    const a = await c1.create({
      storeId: 's-1',
      petId: 'p-1',
      serviceId: 'sv-g1',
      type: 'grooming',
      scheduledStart: T1,
      paymentMode,
      note,
    });
    const ck = await pjStaff.checkin({ code: a.code });
    return ck.appointment;
  };

  /* ==================== 0. 夹具：create→checkin 全链路 in_service ==================== */
  console.log('\n[0] 夹具：create → 潘婧（前台）核销 → in_service + 占槽');
  const appt1 = await createAndCheckin('pay_at_store', 'PD-79 夹具1');
  check(
    '夹具就绪：in_service + checkedInAt 落值 + 槽位 booked=1',
    appt1.status === 'in_service' && (await slotOf())?.bookedCount === 1,
  );

  /* ==================== 1. 权限矩阵（入口钉 owner|manager） ==================== */
  console.log('\n[1] 权限矩阵：customer / clerk / 员工（潘婧）/ 他店 FORBIDDEN');
  check(
    '客户撤单 → FORBIDDEN',
    await rejects(c1.merchantCancel({ appointmentId: appt1.id, reason: '越权测试' }), 'FORBIDDEN'),
  );
  check(
    'clerk 撤单 → FORBIDDEN（owner|manager 闸）',
    await rejects(clerk1.merchantCancel({ appointmentId: appt1.id, reason: '越权测试' }), 'FORBIDDEN'),
  );
  check(
    '员工（潘婧 staff 角色）撤单 → FORBIDDEN（员工端无此权限·server 兜底）',
    await rejects(pjStaff.merchantCancel({ appointmentId: appt1.id, reason: '越权测试' }), 'FORBIDDEN'),
  );
  check(
    '员工（潘婧）撤核销 → FORBIDDEN',
    await rejects(pjStaff.voidCheckin({ appointmentId: appt1.id, reason: '越权测试' }), 'FORBIDDEN'),
  );
  check(
    '他店店主撤单 → FORBIDDEN「非本店预约」',
    await rejects(x1.merchantCancel({ appointmentId: appt1.id, reason: '越权测试' }), 'FORBIDDEN', /本店/),
  );

  /* ==================== 2. 必填原因闸（zod：缺参/空串均 BAD_REQUEST） ==================== */
  console.log('\n[2] 必填原因：缺 reason / 空串 → BAD_REQUEST');
  check(
    'merchantCancel 缺 reason → BAD_REQUEST',
    await rejects(
      // @ts-expect-error 故意缺参验证 zod 闸
      m1.merchantCancel({ appointmentId: appt1.id }),
      'BAD_REQUEST',
    ),
  );
  check(
    'merchantCancel 空串 reason → BAD_REQUEST',
    await rejects(m1.merchantCancel({ appointmentId: appt1.id, reason: '   ' }), 'BAD_REQUEST'),
  );
  check(
    'voidCheckin 缺 reason → BAD_REQUEST（PD-79 追加必填）',
    await rejects(
      // @ts-expect-error 故意缺参验证 zod 闸
      m1.voidCheckin({ appointmentId: appt1.id }),
      'BAD_REQUEST',
    ),
  );

  /* ==================== 3. 涉钱 mock 闸（本令不放开） ==================== */
  console.log('\n[3] 涉钱闸：paidAt 落值 / 已入收银台 → 双端点 400 另闸');
  const apptPaid = await createAndCheckin('pay_at_store', 'PD-79 涉钱夹具-paidAt');
  await db
    .update(schema.appointments)
    .set({ paidAt: new Date(), paidFen: 8800 })
    .where(eq(schema.appointments.id, apptPaid.id));
  check(
    '已收银（paidAt）撤单 → BAD_REQUEST「涉钱…另闸」',
    await rejects(m1.merchantCancel({ appointmentId: apptPaid.id, reason: '涉钱测试' }), 'BAD_REQUEST', /涉钱/),
  );
  check(
    '已收银（paidAt）撤核销 → BAD_REQUEST「涉钱…另闸」',
    await rejects(m1.voidCheckin({ appointmentId: apptPaid.id, reason: '涉钱测试' }), 'BAD_REQUEST', /涉钱/),
  );
  const apptBilled = await createAndCheckin('pay_at_store', 'PD-79 涉钱夹具-billItem');
  await db.insert(schema.cashierBills).values({
    billNo: 'PD79BILL1',
    storeId: 's-1',
    customerId: 'u-c1',
    createdBy: 'u-m',
    operatorId: 'u-m',
  });
  const billRow = await db
    .select()
    .from(schema.cashierBills)
    .where(eq(schema.cashierBills.billNo, 'PD79BILL1'))
    .get();
  await db.insert(schema.cashierBillItems).values({
    billId: billRow!.id,
    kind: 'appointment',
    refId: apptBilled.id,
    nameSnapshot: '基础洗护',
    unitPriceFen: 8800,
  });
  check(
    '已入收银台（cashier_bill_items 预约行）撤单 → BAD_REQUEST「收银台…另闸」',
    await rejects(m1.merchantCancel({ appointmentId: apptBilled.id, reason: '涉钱测试' }), 'BAD_REQUEST', /收银台/),
  );
  check(
    '已入收银台撤核销 → BAD_REQUEST「收银台…另闸」',
    await rejects(m1.voidCheckin({ appointmentId: apptBilled.id, reason: '涉钱测试' }), 'BAD_REQUEST', /收银台/),
  );

  /* ==================== 4. 撤核销（reason 必填留痕版） ==================== */
  console.log('\n[4] 撤核销：reason 落事件 payload（by/reason/前后状态全留痕）');
  const vd = await m1.voidCheckin({ appointmentId: appt1.id, reason: '误核销，客户未到店' });
  const afterVoid = await apptOf(appt1.id);
  check(
    '撤核销 → confirmed + checkedInAt 清空 + 六步行删除',
    vd.idempotent === false && afterVoid?.status === 'confirmed' && afterVoid.checkedInAt === null &&
      (await stepsOf(appt1.id)).length === 0,
  );
  const voidEvents = await outboxRows(`appointment:${appt1.id}`, 'appointment.checkinVoided');
  const voidPayload = voidEvents[0]?.payload as Record<string, unknown> | null;
  check(
    'checkinVoided payload 留痕齐（by=操作人 u-m / reason 原文 / beforeStatus=in_service / afterStatus=confirmed）',
    voidEvents.length === 1 &&
      voidPayload?.by === 'u-m' &&
      voidPayload?.reason === '误核销，客户未到店' &&
      voidPayload?.beforeStatus === 'in_service' &&
      voidPayload?.afterStatus === 'confirmed',
    voidPayload ?? undefined,
  );

  /* ==================== 5. 撤单主路径（manager 亦放行） ==================== */
  console.log('\n[5] 撤单：in_service → cancelled（cancelSource=merchant）+ 槽位释放 + 六步保留 + 双频道留痕');
  const appt3 = await createAndCheckin('pay_at_store', 'PD-79 夹具3');
  check(
    '撤单前槽位 booked=4（appt1 撤核销仍占槽 + 涉钱×2 + appt3）',
    (await slotOf())?.bookedCount === 4,
  );
  const mc = await mg1.merchantCancel({ appointmentId: appt3.id, reason: '客户爽约，门店主动撤单' });
  const afterCancel = await apptOf(appt3.id);
  check(
    '撤单 → cancelled + cancelSource=merchant + cancelReason 落库',
    mc.idempotent === false &&
      afterCancel?.status === 'cancelled' &&
      afterCancel.cancelSource === 'merchant' &&
      afterCancel.cancelReason === '客户爽约，门店主动撤单',
    { status: afterCancel?.status, cancelSource: afterCancel?.cancelSource },
  );
  check('撤单释放槽位（booked 4→3）', (await slotOf())?.bookedCount === 3);
  check('撤单保留六步进度行（历史留痕，不物理删）', (await stepsOf(appt3.id)).length === 6);
  const cancelUser = await outboxRows('user:u-c1', 'appointment.cancelled');
  const cancelStore = await outboxRows('store:s-1', 'appointment.cancelled');
  const cancelPayload = cancelStore.find((e) => (e.payload as Record<string, unknown>)?.appointmentId === appt3.id)
    ?.payload as Record<string, unknown> | undefined;
  check(
    'appointment.cancelled 双频道落账 + payload 留痕齐（by=店长 u-mg / reason / 前后状态 / cancelSource）',
    cancelUser.some((e) => (e.payload as Record<string, unknown>)?.appointmentId === appt3.id) &&
      cancelPayload?.by === 'u-mg' &&
      cancelPayload?.reason === '客户爽约，门店主动撤单' &&
      cancelPayload?.beforeStatus === 'in_service' &&
      cancelPayload?.afterStatus === 'cancelled' &&
      cancelPayload?.cancelSource === 'merchant',
    cancelPayload,
  );
  check(
    '重复撤单 → BAD_REQUEST「不可撤单」（已 cancelled 零副作用）',
    await rejects(mg1.merchantCancel({ appointmentId: appt3.id, reason: '重复测试' }), 'BAD_REQUEST', /不可撤单/),
  );

  /* ==================== 6. 联动回冲：次卡回补 + 预付台账翻 refunded ==================== */
  console.log('\n[6] 联动回冲：pass_deduct 撤单 → 次卡回补 4→5 + 预付台账 refunded');
  const appt4 = await createAndCheckin('pass_deduct', 'PD-79 夹具4-次卡');
  check('pass_deduct 建单扣次（remain 5→4）', (await remainOf()) === 4, await remainOf());
  await db.insert(schema.prepaidRecords).values({
    appointmentId: appt4.id,
    customerId: 'u-c1',
    storeId: 's-1',
    amountFen: 8800,
    status: 'checked_deducted',
    operatorId: 'u-m',
  });
  await m1.merchantCancel({ appointmentId: appt4.id, reason: '回冲联动验证' });
  check('撤单同事务回补次卡（remain 4→5，与 reject 同积木 refundPassIfDeducted）', (await remainOf()) === 5);
  check(
    '预付台账逆联动 checked_deducted → refunded（flipPrepaidOnCancel，幂等）',
    (
      await db
        .select()
        .from(schema.prepaidRecords)
        .where(eq(schema.prepaidRecords.appointmentId, appt4.id))
        .get()
    )?.status === 'refunded',
  );

  await sleep(150); // 让 fire-and-forget 的 broadcastNow 读完落库行，避免关闭后噪音
  client.close();
  await sleep(400); // Windows 下 libsql 文件句柄释放略滞后，给删除留出余量
} catch (err) {
  failures++;
  console.error('\n[smoke] 未捕获异常：', err);
} finally {
  // 删除临时库目录（种子库从未被触碰，天然保持原样）
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch (e) {
    console.warn(`[smoke] 临时目录清理失败（不影响验证结果，系统临时目录会自行回收）: ${tmpDir}`, e);
  }
}

console.log(failures === 0 ? '\nPD-79 merchantCancel/voidCheckin 冒烟全部通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
