/**
 * T1.3a 冒烟脚本：appointment router（预约生命周期，服务端强校验）
 *
 * 运行：npx tsx src/routers/__tests__/appointment.smoke.ts
 *
 * 隔离策略：使用独立临时库（PHILIA_DB_URL → %TMP% 临时目录，启动时跑迁移 + 自建夹具），
 * 全程不触碰 server/data/philia.db 种子库；结束后删除临时目录 —— 种子数据天然保持原样。
 *
 * 覆盖：
 * 1. create 占槽成功；同槽 capacity 打满后第二单 CONFLICT（不超卖）；归属/type/营业时间/过去时间校验
 * 2. getCode 签名验证通过；篡改 aid/exp 被拒；tw-1 窗口接受、tw-2 拒绝；过期 exp 拒绝
 * 3. checkin 全流程：未指派 B 核销成功并自动认领；已指派 A 的单被 B 核销拒绝；非同店拒绝；
 *    重复扫码幂等返回；连续失败 5 次后第 6 次 TOO_MANY_REQUESTS
 * 4. grooming checkin 后六步初始化（step1 active、2-6 locked、required_photos 1/2/3/2/2/0）；
 *    boarding checkin 建 boarding_stays 且无 steps
 * 5. assign 技能/排班/时间冲突检测；cancel 4h 边界两分支 + reviewCancel 批准/拒绝；
 *    服务中锁定；markPaid 幂等；review 落库
 * 6. listMine 分组 / get 归属 / listForStore 过滤 / listTodayForStaff 今日时间轴
 * 7. 事件总账：每个关键动作后 event_outbox 有对应事件且 channel 正确
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 必须先于任何 '../db' 相关模块加载：指向独立临时库 + 固定预约码密钥（便于自算签名）
const tmpDir = mkdtempSync(join(tmpdir(), 'philia-appt-smoke-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'smoke.db').replaceAll('\\', '/')}`;
process.env.BOOKING_CODE_SECRET = 'smoke-booking-code-secret';

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
  const { and, asc, eq } = await import('drizzle-orm');
  type Context = import('../../trpc').Context;
  const { appointmentRouter, verifyCode, signCode, resetCheckinRateLimitForTest } = await import(
    '../appointment'
  );

  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });

  /* ---------- 夹具数据 ---------- */
  // 用户：u-c1/u-c2 客户，u-m 店主，u-a/u-b/u-d 本店员工，u-c 他店员工
  await db.insert(schema.users).values([
    { id: 'u-c1', kimiId: 'k-c1', nickname: '客户一号' },
    { id: 'u-c2', kimiId: 'k-c2', nickname: '客户二号' },
    { id: 'u-m', kimiId: 'k-m', nickname: '店主' },
    { id: 'u-a', kimiId: 'k-a', nickname: '员工A' },
    { id: 'u-b', kimiId: 'k-b', nickname: '员工B' },
    { id: 'u-c', kimiId: 'k-c', nickname: '他店员工' },
    { id: 'u-d', kimiId: 'k-d', nickname: '员工D' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: 'u-c1', role: 'customer' },
    { userId: 'u-c2', role: 'customer' },
    { userId: 'u-m', role: 'merchant_owner' },
    { userId: 'u-a', role: 'staff' },
    { userId: 'u-b', role: 'staff' },
    { userId: 'u-c', role: 'staff' },
    { userId: 'u-d', role: 'staff' },
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
    { id: 's-1', ownerId: 'u-m', name: '冒烟一号店', openHours: OPEN_ALL, status: 'active' },
    { id: 's-2', ownerId: 'u-m', name: '冒烟二号店', openHours: OPEN_ALL, status: 'active' },
  ]);
  await db.insert(schema.staff).values([
    { id: 'st-a', storeId: 's-1', userId: 'u-a', name: '员工A', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-b', storeId: 's-1', userId: 'u-b', name: '员工B', skills: ['wash', 'boarding'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-c', storeId: 's-2', userId: 'u-c', name: '他店员工', skills: ['wash', 'groom', 'boarding'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-d', storeId: 's-1', userId: 'u-d', name: '员工D', skills: ['boarding'], schedule: {}, status: 'active' }, // 无排班
  ]);
  await db.insert(schema.pets).values([
    { id: 'p-1', ownerId: 'u-c1', name: '豆豆', species: 'dog' },
    { id: 'p-2', ownerId: 'u-c2', name: '花花', species: 'cat' },
  ]);
  await db.insert(schema.services).values([
    { id: 'sv-g1', storeId: 's-1', type: 'grooming', name: '基础洗护', durationMin: 60, priceFen: 8800 },
    { id: 'sv-b1', storeId: 's-1', type: 'boarding', name: '标准间寄养', boardingRoomType: '标准间', priceFen: 19900 },
  ]);

  // 时间槽：T1 capacity=1（打满测超卖）、T2 capacity=2、T3 不建行（测 UPSERT 默认容量）
  const T1 = at(1, 10);
  const T2 = at(1, 11);
  const T3 = at(1, 14);
  await db.insert(schema.storeSlots).values([
    { storeId: 's-1', slotStart: T1, capacity: 1, bookedCount: 0 },
    { storeId: 's-1', slotStart: T2, capacity: 2, bookedCount: 0 },
  ]);

  /* ---------- Context 直注（参考 auth smoke 做法） ---------- */
  const ctxCustomer = (id: string): Context => ({ db, user: { id, nickname: null, roles: ['customer'] } });
  const ctxStaff = (id: string, staffId: string, storeId: string): Context => ({
    db,
    user: { id, nickname: null, roles: ['staff'], staffId, storeId },
  });
  const ctxMerchant = (id: string, storeId: string): Context => ({
    db,
    user: { id, nickname: null, roles: ['merchant_owner'], storeId },
  });
  const c1 = appointmentRouter.createCaller(ctxCustomer('u-c1'));
  const c2 = appointmentRouter.createCaller(ctxCustomer('u-c2'));
  const m1 = appointmentRouter.createCaller(ctxMerchant('u-m', 's-1'));
  const aStaff = appointmentRouter.createCaller(ctxStaff('u-a', 'st-a', 's-1'));
  const bStaff = appointmentRouter.createCaller(ctxStaff('u-b', 'st-b', 's-1'));
  const cStaff = appointmentRouter.createCaller(ctxStaff('u-c', 'st-c', 's-2'));

  /* ---------- 事件总账工具 ---------- */
  const countOutbox = async (channel: string, eventType: string): Promise<number> =>
    (
      await db
        .select()
        .from(schema.eventOutbox)
        .where(and(eq(schema.eventOutbox.channel, channel), eq(schema.eventOutbox.eventType, eventType)))
    ).length;
  const totalOutbox = async (): Promise<number> =>
    (await db.select().from(schema.eventOutbox)).length;

  /** 直插预约行（绕过 create 校验，用于构造 ≤4h / 今天等特殊场景） */
  const insertDirectAppt = async (opts: {
    code: string;
    status: string;
    start: Date;
    staffId?: string | null;
    type?: 'grooming' | 'boarding';
  }) =>
    db
      .insert(schema.appointments)
      .values({
        code: opts.code,
        customerId: 'u-c1',
        storeId: 's-1',
        staffId: opts.staffId ?? null,
        petId: 'p-1',
        serviceId: opts.type === 'boarding' ? 'sv-b1' : 'sv-g1',
        type: opts.type ?? 'grooming',
        scheduledStart: opts.start,
        scheduledEnd: new Date(opts.start.getTime() + 3600_000),
        status: opts.status,
        priceFen: 8800,
        paymentMode: 'pay_at_store',
      })
      .returning()
      .then((r) => r[0]!);

  /* ==================== 1. create 占槽与防超卖 ==================== */
  console.log('\n[1] create：占槽 / 防超卖 / 各类校验');
  const appt1 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: T1,
    paymentMode: 'pay_at_store',
    note: '冒烟单1',
  });
  check(
    'create 成功：pending + 6 位去混淆人工码 + payment_mode 快照 + 价格快照',
    appt1.status === 'pending' &&
      /^[2-9A-HJKMNP-Z]{6}$/.test(appt1.code) &&
      appt1.paymentMode === 'pay_at_store' &&
      appt1.priceFen === 8800,
    appt1,
  );
  const slotT1 = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, T1)))
    .get();
  check('事务占槽：booked_count 0→1', slotT1?.bookedCount === 1, slotT1);
  check(
    'appointment.created → store 频道落 outbox',
    (await countOutbox('store:s-1', 'appointment.created')) === 1,
  );
  check(
    '同槽 capacity=1 打满 → 第二单 CONFLICT（不超卖）',
    await rejects(
      c2.create({
        storeId: 's-1',
        petId: 'p-2',
        serviceId: 'sv-g1',
        type: 'grooming',
        scheduledStart: T1,
        paymentMode: 'pay_at_store',
      }),
      'CONFLICT',
    ),
  );
  check(
    '宠物非本人 → FORBIDDEN',
    await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-2',
        serviceId: 'sv-g1',
        type: 'grooming',
        scheduledStart: T2,
        paymentMode: 'pay_at_store',
      }),
      'FORBIDDEN',
    ),
  );
  check(
    'type 与服务项不一致 → BAD_REQUEST',
    await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-g1',
        type: 'boarding',
        scheduledStart: T2,
        paymentMode: 'pay_at_store',
      }),
      'BAD_REQUEST',
    ),
  );
  check(
    '非营业时间（23:00）→ BAD_REQUEST',
    await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-g1',
        type: 'grooming',
        scheduledStart: at(1, 23, 0),
        paymentMode: 'pay_at_store',
      }),
      'BAD_REQUEST',
      /营业时间/,
    ),
  );
  check(
    '过去时间 → BAD_REQUEST',
    await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-g1',
        type: 'grooming',
        scheduledStart: at(-1, 10),
        paymentMode: 'pay_at_store',
      }),
      'BAD_REQUEST',
    ),
  );

  /* ==================== 2. getCode / verifyCode ==================== */
  console.log('\n[2] getCode 签名与 verifyCode 窗口/过期规则');
  const conf1 = await m1.confirm({ appointmentId: appt1.id });
  check('confirm：pending → confirmed', conf1.status === 'confirmed');
  check(
    'appointment.confirmed → user 频道',
    (await countOutbox('user:u-c1', 'appointment.confirmed')) === 1,
  );

  const codeRes = await c1.getCode({ appointmentId: appt1.id });
  const nowSec = Math.floor(Date.now() / 1000);
  const curWin = Math.floor(nowSec / 300);
  check(
    'payload 结构 {v:2, aid, tw, exp, sig} 正确',
    codeRes.payload.v === 2 &&
      codeRes.payload.aid === appt1.id &&
      (codeRes.payload.tw === curWin || codeRes.payload.tw === curWin - 1) &&
      /^[0-9a-f]{64}$/.test(codeRes.payload.sig),
    codeRes.payload,
  );
  check(
    'exp = scheduled_start + 4h',
    codeRes.payload.exp === Math.floor(T1.getTime() / 1000) + 4 * 3600,
    codeRes.payload.exp,
  );
  check('verifyCode：原样 payload 验签通过', verifyCode(codeRes.payload, nowSec));
  check(
    'verifyCode：篡改 aid → 拒绝',
    !verifyCode({ ...codeRes.payload, aid: 'appt_tampered' }, nowSec),
  );
  check(
    'verifyCode：篡改 exp → 拒绝',
    !verifyCode({ ...codeRes.payload, exp: codeRes.payload.exp + 300 }, nowSec),
  );
  check(
    'verifyCode：tw-1 上一窗口接受',
    verifyCode(
      { ...codeRes.payload, tw: curWin - 1, sig: signCode(appt1.id, curWin - 1, codeRes.payload.exp) },
      nowSec,
    ),
  );
  check(
    'verifyCode：tw-2 窗口拒绝',
    !verifyCode(
      { ...codeRes.payload, tw: curWin - 2, sig: signCode(appt1.id, curWin - 2, codeRes.payload.exp) },
      nowSec,
    ),
  );
  const expiredExp = nowSec - 10;
  check(
    'verifyCode：过期 exp 拒绝（即便签名自洽）',
    !verifyCode({ v: 2, aid: appt1.id, tw: curWin, exp: expiredExp, sig: signCode(appt1.id, curWin, expiredExp) }, nowSec),
  );

  /* ==================== 3. checkin 全流程 ==================== */
  console.log('\n[3] checkin：认领 / 归属 / 幂等 / 防爆破限流');
  // 3.1 未指派单：员工 B 扫二维码核销成功并自动认领
  const ck1 = await bStaff.checkin({ qr: codeRes.raw });
  check(
    '未指派单：B 扫码核销成功 → in_service 且自动认领（staff_id=st-b）',
    ck1.appointment.status === 'in_service' &&
      ck1.appointment.staffId === 'st-b' &&
      ck1.claimed === true &&
      ck1.idempotent === false,
    ck1.appointment,
  );
  check('grooming 核销 → nextRoute=/execute/:id', ck1.nextRoute === `/execute/${appt1.id}`);
  check(
    '认领补发 appointment.assigned → staff + user 频道',
    (await countOutbox('staff:st-b', 'appointment.assigned')) === 1 &&
      (await countOutbox('user:u-c1', 'appointment.assigned')) === 1,
  );
  check(
    'appointment.checkedin → appointment 频道',
    (await countOutbox(`appointment:${appt1.id}`, 'appointment.checkedin')) === 1,
  );

  // 3.2 已指派 A 的单被 B 核销 → 拒绝
  const appt2 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: T2,
    paymentMode: 'pay_at_store',
  });
  await m1.confirm({ appointmentId: appt2.id });
  await m1.assign({ appointmentId: appt2.id, staffId: 'st-a' });
  check(
    '已指派 A 的单被 B 核销 → FORBIDDEN',
    await rejects(bStaff.checkin({ code: appt2.code }), 'FORBIDDEN', /指派/),
  );
  // 3.3 非同店员工核销 → 拒绝
  check(
    '非同店员工核销 → FORBIDDEN',
    await rejects(cStaff.checkin({ code: appt2.code }), 'FORBIDDEN', /本店/),
  );
  // 3.4 重复扫码 → 幂等返回当前进度，不产生重复记录/事件
  const totalBeforeIdem = await totalOutbox();
  const ck1b = await bStaff.checkin({ qr: codeRes.raw });
  check(
    '重复扫码幂等：返回当前进度（in_service + 6 步）',
    ck1b.idempotent === true && ck1b.appointment.status === 'in_service' && ck1b.steps.length === 6,
    ck1b.steps.length,
  );
  check('幂等不产生新事件 / 新记录', (await totalOutbox()) === totalBeforeIdem);

  // 3.5 防爆破限流：连续失败 5 次 → 第 6 次 429（即便持有效码）
  resetCheckinRateLimitForTest();
  let allNotFound = true;
  for (let i = 0; i < 5; i++) {
    allNotFound = (await rejects(bStaff.checkin({ code: 'ZZZZZZ' }), 'NOT_FOUND')) && allNotFound;
  }
  check('连续 5 次核销失败均按 NOT_FOUND 正常报错', allNotFound);
  check(
    '第 6 次（即便持有效码）→ TOO_MANY_REQUESTS（锁 10 分钟）',
    await rejects(bStaff.checkin({ code: appt2.code }), 'TOO_MANY_REQUESTS'),
  );
  resetCheckinRateLimitForTest();

  /* ==================== 4. type 分支：六步 / 寄养 ==================== */
  console.log('\n[4] type 分支：grooming 六步初始化 / boarding 住宿单');
  const steps1 = await db
    .select()
    .from(schema.appointmentSteps)
    .where(eq(schema.appointmentSteps.appointmentId, appt1.id))
    .orderBy(asc(schema.appointmentSteps.stepOrder));
  check('grooming 核销后初始化 6 条 appointment_steps', steps1.length === 6, steps1.map((s) => s.stepKey));
  check(
    'step1 disinfection=active，step2-6=locked',
    steps1[0]?.stepKey === 'disinfection' &&
      steps1[0]?.status === 'active' &&
      steps1.slice(1).every((s) => s.status === 'locked'),
    steps1.map((s) => [s.stepKey, s.status]),
  );
  check(
    'required_photos 快照 1/2/3/2/2/0 且 step_order=1..6',
    steps1.map((s) => s.requiredPhotos).join(',') === '1,2,3,2,2,0' &&
      steps1.every((s, i) => s.stepOrder === i + 1),
    steps1.map((s) => [s.stepOrder, s.requiredPhotos]),
  );

  const appt3 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-b1',
    type: 'boarding',
    scheduledStart: T3,
    scheduledEnd: at(2, 14),
    paymentMode: 'pass_deduct',
  });
  check(
    'boarding create：type/end/payment_mode 快照正确',
    appt3.type === 'boarding' &&
      appt3.scheduledEnd.getTime() === at(2, 14).getTime() &&
      appt3.paymentMode === 'pass_deduct',
  );
  const slotT3 = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, T3)))
    .get();
  check(
    '无槽位行时事务内 UPSERT 创建（默认容量 2，booked=1）',
    slotT3?.capacity === 2 && slotT3?.bookedCount === 1,
    slotT3,
  );
  await m1.confirm({ appointmentId: appt3.id });
  const ck3 = await aStaff.checkin({ code: appt3.code });
  check(
    'boarding 人工码核销 → in_boarding + 认领 + nextRoute=/boarding/:id/checkin',
    ck3.appointment.status === 'in_boarding' &&
      ck3.appointment.staffId === 'st-a' &&
      ck3.claimed === true &&
      ck3.nextRoute === `/boarding/${appt3.id}/checkin`,
    ck3.appointment,
  );
  const stay3 = await db
    .select()
    .from(schema.boardingStays)
    .where(eq(schema.boardingStays.appointmentId, appt3.id))
    .get();
  check('boarding_stays 已建（room_no 空，待入住登记）', !!stay3 && stay3.roomNo === null, stay3);
  const steps3 = await db
    .select()
    .from(schema.appointmentSteps)
    .where(eq(schema.appointmentSteps.appointmentId, appt3.id));
  check('boarding 不初始化六步', steps3.length === 0);
  check(
    'appointment.checkedin → appointment 频道（boarding）',
    (await countOutbox(`appointment:${appt3.id}`, 'appointment.checkedin')) === 1,
  );

  /* ==================== 5. assign / cancel / markPaid / review ==================== */
  console.log('\n[5] assign 技能·排班·冲突 / cancel 4h 两分支 / markPaid 幂等 / review');
  // assign：技能不匹配 / 时间冲突 / 成功
  const appt4 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: T2,
    paymentMode: 'pay_at_store',
  });
  check(
    'assign 技能不匹配（grooming 单派给仅 boarding 技能的 D）→ BAD_REQUEST',
    await rejects(m1.assign({ appointmentId: appt4.id, staffId: 'st-d' }), 'BAD_REQUEST', /技能/),
  );
  check(
    'assign 时间冲突（A 同时段已有 confirmed 单）→ CONFLICT',
    await rejects(m1.assign({ appointmentId: appt4.id, staffId: 'st-a' }), 'CONFLICT'),
  );
  check(
    'assign 非同店员工 → BAD_REQUEST',
    await rejects(m1.assign({ appointmentId: appt4.id, staffId: 'st-c' }), 'BAD_REQUEST'),
  );
  const asg4 = await m1.assign({ appointmentId: appt4.id, staffId: 'st-b' });
  check('assign 成功（B 持 wash 技能、同时段无冲突）', asg4.staffId === 'st-b');
  // assign：无排班
  const appt5 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-b1',
    type: 'boarding',
    scheduledStart: T3,
    scheduledEnd: at(2, 15),
    paymentMode: 'pay_at_store',
  });
  check(
    'assign 无排班（D 的 schedule 为空）→ BAD_REQUEST',
    await rejects(m1.assign({ appointmentId: appt5.id, staffId: 'st-d' }), 'BAD_REQUEST', /排班/),
  );

  // cancel >4h：直接取消 + 回减槽位（T3 槽位 2→1）
  const cc5 = await c1.cancel({ appointmentId: appt5.id });
  check(
    '>4h 取消 → cancelled',
    cc5.outcome === 'cancelled' && cc5.appointment.status === 'cancelled',
    cc5.appointment.status,
  );
  const slotT3After = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, T3)))
    .get();
  check('取消后槽位回减（booked_count 2→1）', slotT3After?.bookedCount === 1, slotT3After);
  check(
    'appointment.cancelled → store 频道',
    (await countOutbox('store:s-1', 'appointment.cancelled')) === 1,
  );

  // cancel ≤4h：转 cancel_requested → reviewCancel 批准 / 拒绝
  const appt6 = await insertDirectAppt({
    code: 'SMKA06',
    status: 'confirmed',
    start: new Date(Date.now() + 2 * 3600_000),
  });
  const cc6 = await c1.cancel({ appointmentId: appt6.id });
  check(
    '≤4h 取消 → cancel_requested',
    cc6.outcome === 'cancel_requested' && cc6.appointment.status === 'cancel_requested',
  );
  check(
    'appointment.cancel_requested → store 频道',
    (await countOutbox('store:s-1', 'appointment.cancel_requested')) === 1,
  );
  const rc6 = await m1.reviewCancel({ appointmentId: appt6.id, approve: true });
  check(
    'reviewCancel 批准 → cancelled',
    rc6.approved === true && rc6.appointment.status === 'cancelled',
  );
  check(
    '批准事件 appointment.cancelled → user 频道',
    (await countOutbox('user:u-c1', 'appointment.cancelled')) === 1,
  );
  const appt7 = await insertDirectAppt({
    code: 'SMKA07',
    status: 'confirmed',
    start: new Date(Date.now() + 2 * 3600_000),
  });
  await c1.cancel({ appointmentId: appt7.id });
  const rc7 = await m1.reviewCancel({ appointmentId: appt7.id, approve: false });
  check('reviewCancel 拒绝 → 回 confirmed', rc7.appointment.status === 'confirmed');
  check(
    '拒绝事件 appointment.confirmed → user 频道（累计 4 条：confirm×3 + 拒绝×1）',
    (await countOutbox('user:u-c1', 'appointment.confirmed')) === 4,
  );
  check(
    '服务中锁定：in_service 取消 → BAD_REQUEST',
    await rejects(c1.cancel({ appointmentId: appt1.id }), 'BAD_REQUEST', /进行中/),
  );

  // markPaid（六步流完成属 T1.3b，此处直接置 completed 模拟）
  await db
    .update(schema.appointments)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.appointments.id, appt2.id));
  check(
    '未 completed 不可收款 → BAD_REQUEST',
    await rejects(m1.markPaid({ appointmentId: appt7.id }), 'BAD_REQUEST'),
  );
  const mp1 = await m1.markPaid({ appointmentId: appt2.id });
  check(
    'markPaid 写 paid_at / paid_fen（缺省=订单金额）',
    mp1.idempotent === false && !!mp1.appointment.paidAt && mp1.appointment.paidFen === appt2.priceFen,
    mp1.appointment,
  );
  const mp2 = await m1.markPaid({ appointmentId: appt2.id, paidFen: 1 });
  check(
    'markPaid 幂等：已 paid 返回现状（不改写 paid_fen/paid_at）',
    mp2.idempotent === true &&
      mp2.appointment.paidFen === appt2.priceFen &&
      mp2.appointment.paidAt?.getTime() === mp1.appointment.paidAt?.getTime(),
  );
  check('appointment.paid → store 频道（仅 1 次）', (await countOutbox('store:s-1', 'appointment.paid')) === 1);

  // review
  const rv = await c1.review({ appointmentId: appt2.id, rating: 5, review: '洗得很干净' });
  check('review 落库 rating/review', rv.rating === 5 && rv.review === '洗得很干净', rv);
  check(
    'appointment.reviewed → store + staff 频道',
    (await countOutbox('store:s-1', 'appointment.reviewed')) === 1 &&
      (await countOutbox('staff:st-a', 'appointment.reviewed')) === 1,
  );
  check(
    '非本人评价 → FORBIDDEN',
    await rejects(c2.review({ appointmentId: appt2.id, rating: 1 }), 'FORBIDDEN'),
  );
  check(
    '重复评价 → BAD_REQUEST',
    await rejects(c1.review({ appointmentId: appt2.id, rating: 4 }), 'BAD_REQUEST'),
  );
  check(
    '未 completed 评价 → BAD_REQUEST',
    await rejects(c1.review({ appointmentId: appt7.id, rating: 5 }), 'BAD_REQUEST'),
  );

  /* ==================== 6. 列表与详情 ==================== */
  console.log('\n[6] listMine 分组 / get 归属 / listForStore 过滤 / listTodayForStaff');
  const mine = await c1.listMine();
  check('listMine：in_service 含 appt1', mine.groups.in_service.some((a) => a.id === appt1.id));
  check('listMine：in_boarding 含 appt3', mine.groups.in_boarding.some((a) => a.id === appt3.id));
  check(
    'listMine：cancelled 含 appt5/appt6，completed 含 appt2，confirmed 含 appt7',
    [appt5.id, appt6.id].every((id) => mine.groups.cancelled.some((a) => a.id === id)) &&
      mine.groups.completed.some((a) => a.id === appt2.id) &&
      mine.groups.confirmed.some((a) => a.id === appt7.id),
  );
  check(
    'listMine：带关联名称（petName/serviceName/storeName）',
    mine.groups.in_service[0]?.petName === '豆豆' &&
      mine.groups.in_service[0]?.serviceName === '基础洗护' &&
      mine.groups.in_service[0]?.storeName === '冒烟一号店',
    mine.groups.in_service[0],
  );

  check('get：本人可查（含六步进度）', (await c1.get({ appointmentId: appt1.id })).steps.length === 6);
  check('get：他人客户 → FORBIDDEN', await rejects(c2.get({ appointmentId: appt1.id }), 'FORBIDDEN'));
  check(
    'get：被指员工可查',
    (await aStaff.get({ appointmentId: appt2.id })).appointment.id === appt2.id,
  );
  check(
    'get：本店未指派员工查已指派单 → FORBIDDEN',
    await rejects(bStaff.get({ appointmentId: appt2.id }), 'FORBIDDEN'),
  );
  check('get：本店商家可查', (await m1.get({ appointmentId: appt1.id })).appointment.id === appt1.id);
  check('get：不存在 → NOT_FOUND', await rejects(c1.get({ appointmentId: 'appt_nope' }), 'NOT_FOUND'));

  const dayFrom = at(1, 0, 0);
  const dayTo = at(1, 23, 59);
  const storeList = await m1.listForStore({ from: dayFrom, to: dayTo });
  check(
    'listForStore：日期范围过滤（明天 5 单全部在范围内）',
    storeList.length >= 5 && storeList.every((a) => a.scheduledStart >= dayFrom && a.scheduledStart <= dayTo),
    storeList.length,
  );
  const confirmedOnly = await m1.listForStore({ status: 'confirmed' });
  check(
    'listForStore：状态过滤（含 confirmed 的 appt7，不含 in_service 的 appt1）',
    confirmedOnly.every((a) => a.status === 'confirmed') &&
      confirmedOnly.some((a) => a.id === appt7.id) &&
      !confirmedOnly.some((a) => a.id === appt1.id),
  );

  const appt8 = await insertDirectAppt({ code: 'SMKA08', status: 'confirmed', staffId: 'st-a', start: at(0, 9) });
  const appt9 = await insertDirectAppt({ code: 'SMKA09', status: 'confirmed', staffId: 'st-a', start: at(0, 10) });
  const appt10 = await insertDirectAppt({ code: 'SMKA10', status: 'confirmed', staffId: null, start: at(0, 11) });
  const appt11 = await insertDirectAppt({ code: 'SMKA11', status: 'cancelled', staffId: 'st-a', start: at(0, 12) });
  const todayA = await aStaff.listTodayForStaff();
  const todayAIds = todayA.map((a) => a.id);
  check(
    'listTodayForStaff：本人单按 scheduled_start 升序 + 含未指派待承接单',
    todayAIds.indexOf(appt8.id) > -1 &&
      todayAIds.indexOf(appt8.id) < todayAIds.indexOf(appt9.id) &&
      todayAIds.indexOf(appt9.id) < todayAIds.indexOf(appt10.id),
    todayAIds,
  );
  check('listTodayForStaff：已取消单不进时间轴', !todayAIds.includes(appt11.id));
  const todayB = await bStaff.listTodayForStaff();
  const todayBIds = todayB.map((a) => a.id);
  check(
    'listTodayForStaff：他人（B）只见未指派单，不见 A 的单',
    todayBIds.includes(appt10.id) && !todayBIds.includes(appt8.id) && !todayBIds.includes(appt9.id),
    todayBIds,
  );

  /* ==================== 7. 事件总账 ==================== */
  console.log('\n[7] 事件总账（event_outbox 按频道+类型核对）');
  check(
    'appointment.created → store 频道共 5 条（5 次成功 create）',
    (await countOutbox('store:s-1', 'appointment.created')) === 5,
  );
  check(
    'appointment.assigned 计数正确（st-a：派单 appt2 + 认领 appt3；st-b：认领 appt1 + 派单 appt4；user:u-c1 共 4 条）',
    (await countOutbox('staff:st-a', 'appointment.assigned')) === 2 &&
      (await countOutbox('staff:st-b', 'appointment.assigned')) === 2 &&
      (await countOutbox('user:u-c1', 'appointment.assigned')) === 4,
  );
  check(
    'appointment.checkedin 仅 2 条（appt1/appt3 各 1，幂等重扫无新增）',
    (await countOutbox(`appointment:${appt1.id}`, 'appointment.checkedin')) === 1 &&
      (await countOutbox(`appointment:${appt3.id}`, 'appointment.checkedin')) === 1,
  );
  check(
    'appointment.cancel_requested → store 频道共 2 条（appt6/appt7）',
    (await countOutbox('store:s-1', 'appointment.cancel_requested')) === 2,
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

console.log(failures === 0 ? '\n全部冒烟验证通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
