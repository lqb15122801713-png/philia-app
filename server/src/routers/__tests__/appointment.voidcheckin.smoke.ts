/**
 * PD-66（NO-VOID-ENTRY-ON-MERCHANT-UI）冒烟：appointment.voidCheckin 撤核销
 * （PD-79 追加入参：reason 必填——本文件全部调用已补占位原因；reason 必填闸与
 * 涉钱闸的本窗断言见 appointment.pd79.smoke.ts）
 *
 * 运行：node node_modules/tsx/dist/cli.mjs src/routers/__tests__/appointment.voidcheckin.smoke.ts
 *
 * 独立成文说明：基线 appointment.smoke.ts 自「片 2 医疗授权闸」后陈旧失修（boarding 段夹具
 * 未随闸更新，本窗开工时 3 处基线断言已红），PD-66 测试独立成文件以免被无关段阻塞；
 * 隔离策略与夹具风格对齐 appointment.smoke.ts（独立临时库跑真迁移，结束自清）。
 *
 * 覆盖（令包验收三点）：
 * 1. 入口：构造 in_service 夹具（create→checkin 全链路），商家 owner/manager 有入口
 *    （server 侧对应物=权限矩阵：customer/clerk/他店 FORBIDDEN，UI 侧可见性见
 *    apps/merchant/src/pages/appointmentDetail.utils.test.ts）；
 * 2. 执行后状态离开 in_service → confirmed（可再核销约定态）：checkedInAt 清空、
 *    六步初始化行删除、原指派保留、槽位不动（预约仍占槽）、预付台账回翻 prepaid_registered、
 *    appointment.checkinVoided 双频道落账；
 * 3. 状态闸与幂等：confirmed 未核销单幂等返回、cancelled 单 BAD_REQUEST、重复撤核销幂等零副作用；
 *    撤回后可再核销（六步重新初始化，uq_appointment_steps_appt_key 已腾开）。
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 必须先于任何 '../db' 相关模块加载：指向独立临时库 + 固定预约码密钥
const tmpDir = mkdtempSync(join(tmpdir(), 'philia-pd66-smoke-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'smoke.db').replaceAll('\\', '/')}`;
process.env.BOOKING_CODE_SECRET = 'pd66-void-checkin-smoke-secret';

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

  /* ---------- 夹具数据（对齐 appointment.smoke.ts 最小集） ---------- */
  await db.insert(schema.users).values([
    { id: 'u-c1', kimiId: 'k-c1', nickname: '客户一号', phone: '13800001111' },
    { id: 'u-m', kimiId: 'k-m', nickname: '店主' },
    { id: 'u-mg', kimiId: 'k-mg', nickname: '店长' },
    { id: 'u-b', kimiId: 'k-b', nickname: '员工B' },
    { id: 'u-e', kimiId: 'k-e', nickname: '员工E' },
    { id: 'u-x', kimiId: 'k-x', nickname: '他店店主' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: 'u-c1', role: 'customer' },
    { userId: 'u-m', role: 'merchant_owner' },
    { userId: 'u-mg', role: 'merchant_manager' },
    { userId: 'u-b', role: 'staff' },
    { userId: 'u-e', role: 'staff' },
    { userId: 'u-x', role: 'merchant_owner' },
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
    { id: 's-1', ownerId: 'u-m', name: 'PD66 一号店', openHours: OPEN_ALL, status: 'active' },
    { id: 's-9', ownerId: 'u-x', name: 'PD66 他店', openHours: OPEN_ALL, status: 'active' },
  ]);
  await db.insert(schema.staff).values([
    // 批次 S1 口径：核销收口 frontdesk；groomer 供自动派单
    { id: 'st-b', storeId: 's-1', userId: 'u-b', name: '员工B', role: 'frontdesk', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-e', storeId: 's-1', userId: 'u-e', name: '员工E', role: 'groomer', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
  ]);
  await db.insert(schema.pets).values([{ id: 'p-1', ownerId: 'u-c1', name: '豆豆', species: 'dog' }]);
  await db.insert(schema.services).values([
    { id: 'sv-g1', storeId: 's-1', type: 'grooming', name: '基础洗护', durationMin: 60, priceFen: 8800 },
  ]);
  const T1 = at(1, 10);
  await db.insert(schema.storeSlots).values([{ storeId: 's-1', slotStart: T1, capacity: 2, bookedCount: 0 }]);

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
  const bStaff = appointmentRouter.createCaller(ctxStaff('u-b', 'st-b', 's-1'));

  /* ---------- 事件总账工具 ---------- */
  const countOutbox = async (channel: string, eventType: string): Promise<number> =>
    (
      await db
        .select()
        .from(schema.eventOutbox)
        .where(and(eq(schema.eventOutbox.channel, channel), eq(schema.eventOutbox.eventType, eventType)))
    ).length;
  const totalOutbox = async (): Promise<number> => (await db.select().from(schema.eventOutbox)).length;
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

  /* ==================== 1. 构造 in_service 夹具（create→checkin 全链路） ==================== */
  console.log('\n[1] 构造 in_service 夹具：create → checkin → in_service + 六步 + 占槽');
  const appt1 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: T1,
    paymentMode: 'pay_at_store',
    note: 'PD-66 夹具',
  });
  const ck1 = await bStaff.checkin({ code: appt1.code });
  check(
    '夹具就绪：核销后 in_service + checkedInAt 落值 + 六步初始化 6 行 + 槽位 booked=1',
    ck1.appointment.status === 'in_service' &&
      (await apptOf(appt1.id))?.checkedInAt !== null &&
      (await stepsOf(appt1.id)).length === 6 &&
      (await slotOf())?.bookedCount === 1,
  );

  /* ==================== 2. 权限矩阵（入口钉店主/有权角色） ==================== */
  console.log('\n[2] 权限矩阵：customer / clerk / 他店店主 FORBIDDEN；owner / manager 放行');
  check(
    '客户撤核销 → FORBIDDEN',
    await rejects(c1.voidCheckin({ appointmentId: appt1.id, reason: 'PD-66 冒烟留痕占位' }), 'FORBIDDEN'),
  );
  check(
    'clerk 撤核销 → FORBIDDEN（owner|manager 闸）',
    await rejects(clerk1.voidCheckin({ appointmentId: appt1.id, reason: 'PD-66 冒烟留痕占位' }), 'FORBIDDEN'),
  );
  check(
    '他店店主撤核销 → FORBIDDEN「非本店预约」',
    await rejects(x1.voidCheckin({ appointmentId: appt1.id, reason: 'PD-66 冒烟留痕占位' }), 'FORBIDDEN', /本店/),
  );

  /* ==================== 3. 状态闸：confirmed 幂等 / cancelled 400 ==================== */
  console.log('\n[3] 状态闸：confirmed 未核销单幂等；cancelled 单 BAD_REQUEST');
  const appt2 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: at(1, 14),
    paymentMode: 'pay_at_store',
  });
  const voidOnConfirmed = await m1.voidCheckin({ appointmentId: appt2.id, reason: 'PD-66 冒烟留痕占位' });
  check(
    'confirmed 无核销记录单 → 幂等返回（idempotent=true，状态不变）',
    voidOnConfirmed.idempotent === true && voidOnConfirmed.appointment.status === 'confirmed',
  );
  const cancelledRow = await db
    .insert(schema.appointments)
    .values({
      code: 'PD66C1',
      customerId: 'u-c1',
      storeId: 's-1',
      petId: 'p-1',
      serviceId: 'sv-g1',
      type: 'grooming',
      scheduledStart: at(2, 10),
      scheduledEnd: at(2, 11),
      status: 'cancelled',
      priceFen: 8800,
      paymentMode: 'pay_at_store',
    })
    .returning()
    .then((r) => r[0]!);
  check(
    'cancelled 单撤核销 → BAD_REQUEST「不可撤核销」',
    await rejects(m1.voidCheckin({ appointmentId: cancelledRow.id, reason: 'PD-66 冒烟留痕占位' }), 'BAD_REQUEST', /不可撤核销/),
  );

  /* ==================== 4. 主路径：撤核销 → 离开 in_service 回 confirmed ==================== */
  console.log('\n[4] 主路径：in_service 夹具撤核销 → confirmed（可再核销约定态）');
  // 挂一条 checked_deducted 预付台账（核销联动后的状态），验证逆联动回翻
  await db.insert(schema.prepaidRecords).values({
    appointmentId: appt1.id,
    customerId: 'u-c1',
    storeId: 's-1',
    amountFen: 8800,
    status: 'checked_deducted',
    operatorId: 'u-m',
  });
  const eventsBefore = await totalOutbox();
  const vd1 = await m1.voidCheckin({ appointmentId: appt1.id, reason: 'PD-66 冒烟留痕占位' });
  const after = await apptOf(appt1.id);
  check(
    '执行后状态离开 in_service → confirmed + checkedInAt 清空 + 原指派保留',
    vd1.idempotent === false &&
      after?.status === 'confirmed' &&
      after.checkedInAt === null &&
      after.staffId === ck1.appointment.staffId,
    { status: after?.status, checkedInAt: after?.checkedInAt, staffId: after?.staffId },
  );
  check('六步初始化行随撤回删除（腾唯一索引供再核销）', (await stepsOf(appt1.id)).length === 0);
  check(
    '预付台账逆联动回翻 checked_deducted → prepaid_registered',
    (
      await db
        .select()
        .from(schema.prepaidRecords)
        .where(eq(schema.prepaidRecords.appointmentId, appt1.id))
        .get()
    )?.status === 'prepaid_registered',
  );
  check('撤核销不释放槽位（预约仍有效，booked 仍 1）', (await slotOf())?.bookedCount === 1);
  check(
    'appointment.checkinVoided 双频道落账（appointment + store）',
    (await countOutbox(`appointment:${appt1.id}`, 'appointment.checkinVoided')) === 1 &&
      (await countOutbox('store:s-1', 'appointment.checkinVoided')) === 1,
  );

  /* ==================== 5. 幂等 + manager 亦可用 + 再核销闭环 ==================== */
  console.log('\n[5] 幂等 / manager 权限 / 再核销闭环');
  const vd2 = await m1.voidCheckin({ appointmentId: appt1.id, reason: 'PD-66 冒烟留痕占位' });
  check(
    '重复撤核销幂等（idempotent=true 且事件总数不增）',
    vd2.idempotent === true && (await totalOutbox()) === eventsBefore + 2,
  );
  // manager 走完整链路：再核销 → manager 撤核销
  const re = await bStaff.checkin({ code: appt1.code });
  check(
    '撤回后可再核销 → in_service + 六步重新初始化 6 行（可再核销约定态成立）',
    re.appointment.status === 'in_service' && (await stepsOf(appt1.id)).length === 6,
  );
  const vd3 = await mg1.voidCheckin({ appointmentId: appt1.id, reason: 'PD-66 冒烟留痕占位' });
  check(
    'manager（有权角色）撤核销放行 → confirmed',
    vd3.idempotent === false && (await apptOf(appt1.id))?.status === 'confirmed',
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

console.log(failures === 0 ? '\nPD-66 voidCheckin 冒烟全部通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
