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
 * 3. checkin 全流程：S1-R1 到店登记口径——未指派 B（frontdesk）核销成功不认领（staff_id 留 NULL）；
 *    已指派 A 的单被 B 核销成功且原指派保留（豁免归属）；非同店拒绝；groomer 拒绝；
 *    重复扫码幂等返回；连续失败 5 次后第 6 次 TOO_MANY_REQUESTS
 * 4. grooming checkin 后六步初始化（step1 active、2-6 locked、required_photos 1/2/3/2/2/0）；
 *    boarding checkin 建 boarding_stays 且无 steps
 * 5. assign 技能/排班/时间冲突检测；cancel 4h 边界两分支 + reviewCancel 批准/拒绝；
 *    服务中锁定；markPaid 幂等；review 落库
 * 5b. B2-7 次卡：无卡 pass_deduct 拒绝；B2-7R（产品裁定A）寄养+次卡硬拒绝且
 *    余额/流水零副作用；grooming+次卡建单扣 1 次、取消回补 +1
 * 5c. B3-2（A-P1-11 红标）寄养容量按晚占用：逐晚 UPSERT boarding_slots；
 *    任一晚满员 CONFLICT 且整体回滚（失败单无部分占用/无预约记录）；room_count=2
 *    房型同晚两单成功、第三单拦截且 booked 不超限；取消释放全部晚；0 晚区间拒绝
 * 5d. B3-3（P1-1）商家拒单 reject：仅 pending 可拒（confirmed/in_service 拒绝且零副作用）；
 *    reason 必填 1~100 字；客户/非本店 FORBIDDEN；同事务置 cancelled + 释放槽位
 *    （寄养全晚释放）+ cancelReason/cancelSource=merchant_reject 落库 + rejected 双频道
 *    事件（payload 含 reason）；门禁 3：pass_deduct 单拒单同事务回补 +1、重复拒单幂等
 * 5e. B3-4 寄养改期：boarding 必传 scheduledEnd（缺省/不晚于入住日均 BAD_REQUEST）；
 *    改期事务内释放全部旧晚 + 逐晚占用全部新晚 + status 回退 pending + staffId 置空 +
 *    rescheduled 双频道（appointment+store，by=customer）；满员晚 CONFLICT 整体回滚
 *    （预约行与各晚快照逐项一致）；<4h（入住日首晚计）/in_boarding 拒绝；不触碰卡表；
 *    B2-6 洗护改期回归
 * 5f. B3-5 P2 打包：W-2 今天可约口径——+1h 缓冲内时段 BAD_REQUEST（缓冲检查先于
 *    营业时间），≥+1h 的营业时段建单成功（运行时在营业时间内则命中「今天晚些时候」）；
 *    W-14 取消原因——>4h 直消/≤4h 申请均落 cancelReason+cancelSource=customer，
 *    原因选填（缺省 null）、超 100 字 BAD_REQUEST，reviewCancel 批准保留客户原因；
 *    W-4 客户标识——listForStore 行带 customerName/customerPhoneTail、
 *    appointment.get 带 customer{nickname, phoneTail}
 * 5g. 批次 S4（任务 A）：create 落库即 confirmed（grooming/boarding 同口径）+ confirmed
 *    事件随 create 发 user+store 双频道；confirm 幂等（confirmed 单连调成功零副作用，
 *    历史 pending 单仍可 confirm → confirmed + 事件）；reject 仍仅 pending 可拒
 *    （夹具经 flipToPending 模拟历史/改期回退 pending 单）
 * 6. listMine 分组 / get 归属 / listForStore 过滤 / listTodayForStaff 今日时间轴
 * 7. 事件总账：每个关键动作后 event_outbox 有对应事件且 channel 正确
 * 8. 批次 S4（任务 C · 独立门店 s-3 双 groomer）：自动派单负荷最轻（预约当日已完成+
 *    在单数最少）+ 并列先入职（交替序列 a/b/a/b）；assignSource=auto + assigned 双频道
 *    payload.by=auto；客户指定——有空成功、无空 CONFLICT 原文案、他店/非 groomer/停职
 *    BAD_REQUEST、boarding 指定拒绝；无可空 CONFLICT 原文案 + 占槽整体回滚；
 *    并发双击恰 1 成功 1 CONFLICT 不产生双占
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

/** 本地日界 ISO 日期 'YYYY-MM-DD'（与 boardingNightDates 口径一致） */
const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ------------------------------ 主流程 ------------------------------ */

try {
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { db, schema, client } = await import('../../db');
  const { and, asc, eq, ne } = await import('drizzle-orm');
  type Context = import('../../trpc').Context;
  const { appointmentRouter, verifyCode, signCode, resetCheckinRateLimitForTest } = await import(
    '../appointment'
  );

  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });

  /* ---------- 夹具数据 ---------- */
  // 用户：u-c1/u-c2 客户，u-m 店主，u-a/u-b/u-d 本店员工，u-c 他店员工
  await db.insert(schema.users).values([
    // B3-5（W-4）：u-c1 带手机号，供 listForStore/get 的手机尾号断言（尾号 1111）
    { id: 'u-c1', kimiId: 'k-c1', nickname: '客户一号', phone: '13800001111' },
    { id: 'u-c2', kimiId: 'k-c2', nickname: '客户二号' },
    { id: 'u-m', kimiId: 'k-m', nickname: '店主' },
    { id: 'u-a', kimiId: 'k-a', nickname: '员工A' },
    { id: 'u-b', kimiId: 'k-b', nickname: '员工B' },
    { id: 'u-c', kimiId: 'k-c', nickname: '他店员工' },
    { id: 'u-d', kimiId: 'k-d', nickname: '员工D' },
    { id: 'u-e', kimiId: 'k-e', nickname: '员工E' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: 'u-c1', role: 'customer' },
    { userId: 'u-c2', role: 'customer' },
    { userId: 'u-m', role: 'merchant_owner' },
    { userId: 'u-a', role: 'staff' },
    { userId: 'u-b', role: 'staff' },
    { userId: 'u-c', role: 'staff' },
    { userId: 'u-d', role: 'staff' },
    { userId: 'u-e', role: 'staff' },
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
    // 批次 S1：核销收口前台——执行核销的 A/B/C 夹具为 frontdesk；D 为 groomer（角色拒绝断言用）
    { id: 'st-a', storeId: 's-1', userId: 'u-a', name: '员工A', role: 'frontdesk', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-b', storeId: 's-1', userId: 'u-b', name: '员工B', role: 'frontdesk', skills: ['wash', 'boarding'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-c', storeId: 's-2', userId: 'u-c', name: '他店员工', role: 'frontdesk', skills: ['wash', 'groom', 'boarding'], schedule: SCHED_FULL, status: 'active' },
    { id: 'st-d', storeId: 's-1', userId: 'u-d', name: '员工D', role: 'groomer', skills: ['boarding'], schedule: {}, status: 'active' }, // 无排班
    // 批次 S4（任务 C）：s-1 唯一可派 groomer（全覆盖排班）——既有 grooming 建单自动派单落 st-e；
    // 负荷/并列/指定/并发等专项断言见末节 [8]（独立门店 s-3 双 groomer 夹具，不扰动本店事件总账）
    { id: 'st-e', storeId: 's-1', userId: 'u-e', name: '员工E', role: 'groomer', skills: ['wash', 'groom'], schedule: SCHED_FULL, status: 'active' },
  ]);
  await db.insert(schema.pets).values([
    { id: 'p-1', ownerId: 'u-c1', name: '豆豆', species: 'dog' },
    { id: 'p-2', ownerId: 'u-c2', name: '花花', species: 'cat' },
  ]);
  await db.insert(schema.services).values([
    { id: 'sv-g1', storeId: 's-1', type: 'grooming', name: '基础洗护', durationMin: 60, priceFen: 8800 },
    { id: 'sv-b1', storeId: 's-1', type: 'boarding', name: '标准间寄养', boardingRoomType: '标准间', priceFen: 19900 },
    // B3-2：多间房房型（room_count=2），验证容量>1 的同晚多单与第三单满房拦截
    { id: 'sv-b2', storeId: 's-1', type: 'boarding', name: '豪华间寄养', boardingRoomType: '豪华间', roomCount: 2, priceFen: 29900 },
  ]);

  // 时间槽：T1 capacity=1（打满测超卖）、T2 capacity=2、T3 不建行（测 UPSERT 默认容量）
  const T1 = at(1, 10);
  const T2 = at(1, 11);
  const T3 = at(1, 14);
  await db.insert(schema.storeSlots).values([
    { storeId: 's-1', slotStart: T1, capacity: 1, bookedCount: 0 },
    { storeId: 's-1', slotStart: T2, capacity: 2, bookedCount: 0 },
  ]);

  // B2-7：pass_deduct 建单须先有次卡——给 u-c1 在 s-1 置 5 次卡（u-c2 无卡，用于拒绝用例）
  await db.insert(schema.memberPasses).values({
    id: 'mp-c1',
    userId: 'u-c1',
    storeId: 's-1',
    totalTimes: 5,
    remainTimes: 5,
    status: 'active',
  });
  const remainOf = async () =>
    (await db.select().from(schema.memberPasses).where(eq(schema.memberPasses.id, 'mp-c1')).get())?.remainTimes;

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

  /**
   * 批次 S4 适配：create 落库即 confirmed，而 reject 仍仅 pending 可拒。
   * 拒单链路（B3-3）服务的对象变为「历史 pending 单 / 客户改期回退 pending 单」，
   * 故拒单夹具在 create（占槽/扣次/事件真实发生）后直改回 pending 模拟该两类单。
   */
  const flipToPending = async (appointmentId: string) =>
    db
      .update(schema.appointments)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(schema.appointments.id, appointmentId));

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
    'create 成功：批次 S4 落库即 confirmed + 6 位去混淆人工码 + payment_mode 快照 + 价格快照',
    appt1.status === 'confirmed' &&
      /^[2-9A-HJKMNP-Z]{6}$/.test(appt1.code) &&
      appt1.paymentMode === 'pay_at_store' &&
      appt1.priceFen === 8800,
    appt1,
  );
  // S4（任务 A）：confirmed 事件随 create 即发（user+store 双频道，by='auto'）
  check(
    'S4：appointment.confirmed 随 create 落 user+store 双频道',
    (await countOutbox('user:u-c1', 'appointment.confirmed')) === 1 &&
      (await countOutbox('store:s-1', 'appointment.confirmed')) === 1,
  );
  const slotT1 = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, T1)))
    .get();
  check('事务占槽：booked_count 0→1', slotT1?.bookedCount === 1, slotT1);
  // S4（任务 C）：s-1 唯一可派 groomer 为 st-e——appt1 自动派单落 st-e（assignSource=auto）
  check(
    'S4：未指定 staffId → 自动派单唯一空闲 groomer（staff_id=st-e，assignSource=auto）',
    appt1.staffId === 'st-e' && appt1.assignSource === 'auto',
    { staffId: appt1.staffId, assignSource: appt1.assignSource },
  );
  check(
    'appointment.created → store 频道落 outbox',
    (await countOutbox('store:s-1', 'appointment.created')) === 1,
  );
  check(
    'S4：自动派单 assigned 事件（staff+user 双频道，payload.by=auto）',
    (await countOutbox('staff:st-e', 'appointment.assigned')) === 1 &&
      (await countOutbox('user:u-c1', 'appointment.assigned')) === 1,
  );
  check(
    'S4：唯一 groomer（st-e）同时段已占 → 第二单 CONFLICT「该时段已约满」（B/C 同根双保险，不超卖）',
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
      /该时段已约满，请换个时间/,
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
  // B2-7：无卡客户 pass_deduct → 明确报错（不扣次、不占槽、不发事件）
  check(
    'pass_deduct 无可用次卡 → BAD_REQUEST「暂无可用次卡」',
    await rejects(
      c2.create({
        storeId: 's-1',
        petId: 'p-2',
        serviceId: 'sv-g1',
        type: 'grooming',
        scheduledStart: T2,
        paymentMode: 'pass_deduct',
      }),
      'BAD_REQUEST',
      /暂无可用次卡/,
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
  // S4（任务 A）：appt1 create 时已落 confirmed——confirm 幂等成功且零副作用（无新事件、updatedAt 不变）
  const outboxBeforeConfirm = await totalOutbox();
  const conf1 = await m1.confirm({ appointmentId: appt1.id });
  const conf1b = await m1.confirm({ appointmentId: appt1.id });
  check(
    'S4：confirm 幂等——confirmed 单连调两次均成功（状态不变）',
    conf1.status === 'confirmed' && conf1b.status === 'confirmed',
  );
  check(
    'S4：confirm 幂等零副作用（无新增 outbox 事件）',
    (await totalOutbox()) === outboxBeforeConfirm,
  );
  check(
    'appointment.confirmed → user 频道（仍 1 条：create 所发，confirm 幂等不增发）',
    (await countOutbox('user:u-c1', 'appointment.confirmed')) === 1,
  );
  // S4 兼容：历史 pending 单仍可 confirm → confirmed 且发事件（防旧链路断裂）
  const legacyPending = await insertDirectAppt({
    code: 'SMKL01',
    status: 'pending',
    start: at(30, 10),
  });
  const confLegacy = await m1.confirm({ appointmentId: legacyPending.id });
  check(
    'S4 兼容：历史 pending 单 confirm → confirmed + confirmed 事件（user 频道累计 2 条）',
    confLegacy.status === 'confirmed' &&
      (await countOutbox('user:u-c1', 'appointment.confirmed')) === 2,
    confLegacy.status,
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
  console.log('\n[3] checkin：到店登记（S1-R1 豁免归属/不认领）/ 幂等 / 防爆破限流');
  // 3.1 appt1（S4 已自动派单 st-e）：员工 B（frontdesk）扫二维码核销成功；
  // S1-R1 豁免归属：原指派保留（staff_id 仍 st-e，不认领）
  const ck1 = await bStaff.checkin({ qr: codeRes.raw });
  check(
    'S1-R1：自动派单单（st-e）被 B 扫码核销 → in_service 且原指派保留（staff_id 仍 st-e，claimed=false）',
    ck1.appointment.status === 'in_service' &&
      ck1.appointment.staffId === 'st-e' &&
      ck1.claimed === false &&
      ck1.idempotent === false,
    ck1.appointment,
  );
  check('grooming 核销 → nextRoute=/execute/:id', ck1.nextRoute === `/execute/${appt1.id}`);
  // S1-R1 断言②：真正的未指派单（直插 staffId=null）核销仍不认领、不补发 assigned
  const unassignedAppt = await insertDirectAppt({
    code: 'SMKUU2', // 人工码字符集（去混淆）：不含 0/1
    status: 'confirmed',
    start: at(20, 10),
  });
  const codeUnassigned = await c1.getCode({ appointmentId: unassignedAppt.id });
  const assignedOfUnassigned = async () =>
    (await db.select().from(schema.eventOutbox)).filter(
      (r) =>
        r.eventType === 'appointment.assigned' &&
        (r.payload as Record<string, unknown>)?.appointmentId === unassignedAppt.id,
    ).length;
  const assignedBeforeCk = await assignedOfUnassigned();
  const ckU = await bStaff.checkin({ code: codeUnassigned.code });
  check(
    'S1-R1 断言②：未指派单 B 核销成功 → staff_id 仍 NULL（不认领，claimed=false）',
    ckU.appointment.status === 'in_service' && ckU.appointment.staffId === null && ckU.claimed === false,
    ckU.appointment,
  );
  check(
    'S1-R1 断言②：未指派核销不补发 appointment.assigned（该单 assigned 事件前后均 0 条）',
    assignedBeforeCk === 0 && (await assignedOfUnassigned()) === 0,
    { assignedBeforeCk, after: await assignedOfUnassigned() },
  );
  check(
    'appointment.checkedin → appointment 频道',
    (await countOutbox(`appointment:${appt1.id}`, 'appointment.checkedin')) === 1,
  );

  // 3.2 已指派 A 的单被 B（frontdesk）核销 → S1-R1：豁免归属核销成功，原指派保留
  // （S4：appt2 下单自动派单 st-e，商家 assign 改派 st-a——改派不回归，见末节 [8] 与批次 D）
  const appt2 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: T2,
    paymentMode: 'pay_at_store',
  });
  await m1.confirm({ appointmentId: appt2.id }); // S4：幂等（create 已 confirmed）
  await m1.assign({ appointmentId: appt2.id, staffId: 'st-a' }); // 商家改派 st-a
  const ck2 = await bStaff.checkin({ code: appt2.code });
  check(
    'S1-R1：已指派 A 的单被 B 核销成功 → in_service 且 staff_id 仍为 st-a（原指派保留）',
    ck2.appointment.status === 'in_service' &&
      ck2.appointment.staffId === 'st-a' &&
      ck2.claimed === false,
    ck2.appointment,
  );
  // 3.3 非同店员工核销 → 拒绝（同店校验保留）
  check(
    '非同店员工核销 → FORBIDDEN',
    await rejects(cStaff.checkin({ code: appt2.code }), 'FORBIDDEN', /本店/),
  );
  // 3.3b 批次 S1（任务 B）：美容师（groomer）核销 → FORBIDDEN「核销需前台账号操作」
  // （角色判定先于归属/幂等/限流，且不计入防爆破失败次数）
  const dStaff = appointmentRouter.createCaller(ctxStaff('u-d', 'st-d', 's-1'));
  check(
    '批次 S1：groomer 核销 → FORBIDDEN「核销需前台账号操作」',
    await rejects(dStaff.checkin({ code: appt2.code }), 'FORBIDDEN', /核销需前台账号操作/),
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
    paymentMode: 'pay_at_store',
  });
  check(
    'boarding create：type/end/payment_mode 快照正确',
    appt3.type === 'boarding' &&
      appt3.scheduledEnd.getTime() === at(2, 14).getTime() &&
      appt3.paymentMode === 'pay_at_store',
  );

  // B2-7R-4（产品裁定A）：寄养 + pass_deduct → 硬拒绝（次卡仅洗护可用）；
  // 拒绝路径零副作用——remainTimes 不变、无新增 pass_deduct_log 行（连槽位都不占）
  const passLogsBefore = (await db.select().from(schema.passDeductLogs)).length;
  check(
    'boarding + pass_deduct → BAD_REQUEST「寄养订单暂不支持次卡支付」',
    await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-b1',
        type: 'boarding',
        scheduledStart: at(2, 16),
        scheduledEnd: at(3, 16),
        paymentMode: 'pass_deduct',
      }),
      'BAD_REQUEST',
      /寄养订单暂不支持次卡支付/,
    ),
  );
  check('寄养拒绝后 remainTimes 不变（仍 5）', (await remainOf()) === 5, await remainOf());
  check(
    '寄养拒绝后无新增 pass_deduct_log 行',
    (await db.select().from(schema.passDeductLogs)).length === passLogsBefore,
  );

  // B2-7R-4 回归：grooming + pass_deduct 仍 200，同事务扣 1 次（remain 5→4）+ -1 流水
  const apptPass = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: at(2, 17),
    paymentMode: 'pass_deduct',
  });
  check(
    'grooming + pass_deduct 建单仍成功（200；S4 落库即 confirmed）',
    apptPass.status === 'confirmed' && apptPass.paymentMode === 'pass_deduct',
  );
  check('pass_deduct 建单同事务扣次（remain 5→4）', (await remainOf()) === 4, await remainOf());
  const apptPassLogs = await db
    .select()
    .from(schema.passDeductLogs)
    .where(eq(schema.passDeductLogs.appointmentId, apptPass.id));
  check('扣次流水 delta=-1 挂在该单上', apptPassLogs.length === 1 && apptPassLogs[0]?.delta === -1, apptPassLogs);
  const slotT3 = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, T3)))
    .get();
  check(
    'B3-2：boarding 不再占用洗护 30min 时段槽（T3 无 store_slots 行）',
    slotT3 === undefined,
    slotT3,
  );
  // B3-2：appt3（boarding，T3=明天 14:00 → 后天 14:00）按「晚」占 boarding_slots 1 行
  const appt3Nights = await db
    .select()
    .from(schema.boardingSlots)
    .where(and(eq(schema.boardingSlots.storeId, 's-1'), eq(schema.boardingSlots.serviceId, 'sv-b1')));
  check(
    'B3-2：boarding create 按晚占用（入住日晚 1 行；room_count 空 → 默认容量 1，booked=1）',
    appt3Nights.length === 1 &&
      appt3Nights[0]?.nightDate === isoDay(T3) &&
      appt3Nights[0]?.capacity === 1 &&
      appt3Nights[0]?.bookedCount === 1,
    appt3Nights,
  );
  await m1.confirm({ appointmentId: appt3.id });
  const ck3 = await aStaff.checkin({ code: appt3.code });
  check(
    'boarding 人工码核销 → in_boarding + 不认领（staff_id 仍 NULL）+ nextRoute=/boarding/:id/checkin',
    ck3.appointment.status === 'in_boarding' &&
      ck3.appointment.staffId === null &&
      ck3.claimed === false &&
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
  check(
    'assign 成功（B 持 wash 技能、同时段无冲突；S4 任务 D：来源标记覆盖为 merchant）',
    asg4.staffId === 'st-b' && asg4.assignSource === 'merchant',
    { staffId: asg4.staffId, assignSource: asg4.assignSource },
  );
  // assign：无排班
  // B3-2：boarding 按晚占用后，appt5 须避开 appt3 已占晚（sv-b1 默认容量 1），
  // 取 D+3 15:00 → D+4 15:00（晚 D+3 空闲）
  const appt5 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-b1',
    type: 'boarding',
    scheduledStart: at(3, 15),
    scheduledEnd: at(4, 15),
    paymentMode: 'pay_at_store',
  });
  check(
    'assign 无排班（D 的 schedule 为空）→ BAD_REQUEST',
    await rejects(m1.assign({ appointmentId: appt5.id, staffId: 'st-d' }), 'BAD_REQUEST', /排班/),
  );

  // cancel >4h：直接取消 + 释放槽位（B3-2：boarding 释放住宿区间全部晚——晚 D+3 booked 1→0）
  const cc5 = await c1.cancel({ appointmentId: appt5.id });
  check(
    '>4h 取消 → cancelled',
    cc5.outcome === 'cancelled' && cc5.appointment.status === 'cancelled',
    cc5.appointment.status,
  );
  const appt5Night = await db
    .select()
    .from(schema.boardingSlots)
    .where(
      and(
        eq(schema.boardingSlots.storeId, 's-1'),
        eq(schema.boardingSlots.serviceId, 'sv-b1'),
        eq(schema.boardingSlots.nightDate, isoDay(at(3, 15))),
      ),
    )
    .get();
  check('B3-2：寄养取消后各晚释放（晚 D+3 booked_count 1→0）', appt5Night?.bookedCount === 0, appt5Night);
  check(
    'appointment.cancelled → store 频道',
    (await countOutbox('store:s-1', 'appointment.cancelled')) === 1,
  );

  // B2-7：pass_deduct 单取消回补（>4h 直消路径）——建单扣 4→3，取消同事务回补 3→4
  // （用全新时段 at(1,16) 走 UPSERT 默认容量，避免挤占 T1/T2/T3 既有断言口径）
  const appt5b = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: at(1, 16),
    paymentMode: 'pass_deduct',
  });
  check('pass_deduct 建单扣次（remain 4→3）', (await remainOf()) === 3, await remainOf());
  const cc5b = await c1.cancel({ appointmentId: appt5b.id });
  check('pass_deduct 单 >4h 取消 → cancelled', cc5b.outcome === 'cancelled');
  check('取消同事务回补（remain 3→4）', (await remainOf()) === 4, await remainOf());
  const appt5bLogs = await db
    .select()
    .from(schema.passDeductLogs)
    .where(eq(schema.passDeductLogs.appointmentId, appt5b.id));
  check(
    '该单流水两条：-1 扣次 + +1 回补',
    appt5bLogs.length === 2 && appt5bLogs.some((l) => l.delta === -1) && appt5bLogs.some((l) => l.delta === 1),
    appt5bLogs.map((l) => l.delta),
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
    '拒绝事件 appointment.confirmed → user 频道（累计 9 条：create 自动确认×7 + 历史 pending confirm×1 + 拒绝×1）',
    (await countOutbox('user:u-c1', 'appointment.confirmed')) === 9,
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

  /* ==================== 5c. B3-2 寄养容量按「晚」占用（A-P1-11 红标） ==================== */
  console.log('\n[5c] B3-2：寄养逐晚占用 / 满晚 CONFLICT 整体回滚 / 取消全晚释放 / 多间容量');
  const nightRows = async (serviceId: string) =>
    db
      .select()
      .from(schema.boardingSlots)
      .where(and(eq(schema.boardingSlots.storeId, 's-1'), eq(schema.boardingSlots.serviceId, serviceId)))
      .orderBy(asc(schema.boardingSlots.nightDate));

  // ① 两晚区间逐晚占用：D+5 入住 D+7 退房 → 晚 D+5 / D+6 各占 1 格
  const b31 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-b1',
    type: 'boarding',
    scheduledStart: at(5, 10),
    scheduledEnd: at(7, 10),
    paymentMode: 'pay_at_store',
  });
  check('两晚寄养建单成功（priceFen = 单晚价 × 2 晚）', b31.priceFen === 19900 * 2, b31.priceFen);
  const b31Nights = await nightRows('sv-b1');
  check(
    '逐晚占用：晚 D+5 / D+6 各 1 行（booked=1，capacity=1）',
    [isoDay(at(5, 10)), isoDay(at(6, 10))].every((d) =>
      b31Nights.some((r) => r.nightDate === d && r.bookedCount === 1 && r.capacity === 1),
    ),
    b31Nights,
  );

  // ② 任一晚满员 → 整体 CONFLICT 回滚：D+6 入住 D+8 退房（晚 D+6 已被 b31 占满）；
  //    失败单不得在晚 D+7 产生任何部分占用，各晚 booked 与建单前逐行一致（回滚实证）
  const beforeFailed = await nightRows('sv-b1');
  check(
    '任一晚满员 → 第二单 CONFLICT「已订满」',
    await rejects(
      c2.create({
        storeId: 's-1',
        petId: 'p-2',
        serviceId: 'sv-b1',
        type: 'boarding',
        scheduledStart: at(6, 10),
        scheduledEnd: at(8, 10),
        paymentMode: 'pay_at_store',
      }),
      'CONFLICT',
      /已订满/,
    ),
  );
  const rollbackNights = await nightRows('sv-b1');
  check(
    '回滚实证：失败单不产生部分占用（各晚快照与建单前逐行一致，晚 D+7 无槽位行）',
    rollbackNights.length === beforeFailed.length &&
      !rollbackNights.some((r) => r.nightDate === isoDay(at(7, 10))) &&
      rollbackNights.every((r, i) => {
        const b = beforeFailed[i];
        return b?.nightDate === r.nightDate && b.bookedCount === r.bookedCount && b.capacity === r.capacity;
      }),
    { before: beforeFailed.map((r) => [r.nightDate, r.bookedCount]), after: rollbackNights.map((r) => [r.nightDate, r.bookedCount]) },
  );
  check(
    '回滚实证：失败单不产生预约记录（u-c2 名下仍 0 单）',
    (await db.select().from(schema.appointments).where(eq(schema.appointments.customerId, 'u-c2'))).length === 0,
  );

  // ③ 多间房房型（sv-b2 room_count=2）：同晚两单成功、第三单 CONFLICT 且 booked 不超限
  await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-b2',
    type: 'boarding',
    scheduledStart: at(5, 10),
    scheduledEnd: at(6, 10),
    paymentMode: 'pay_at_store',
  });
  await c2.create({
    storeId: 's-1',
    petId: 'p-2',
    serviceId: 'sv-b2',
    type: 'boarding',
    scheduledStart: at(5, 10),
    scheduledEnd: at(6, 10),
    paymentMode: 'pay_at_store',
  });
  const b2Nights = await nightRows('sv-b2');
  check(
    'room_count=2 房型：同晚两单均成功（capacity=2，booked=2）',
    b2Nights.length === 1 &&
      b2Nights[0]?.nightDate === isoDay(at(5, 10)) &&
      b2Nights[0]?.capacity === 2 &&
      b2Nights[0]?.bookedCount === 2,
    b2Nights,
  );
  check(
    '同晚第三单 CONFLICT 且 booked_count 不超限（仍 2）',
    (await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-b2',
        type: 'boarding',
        scheduledStart: at(5, 10),
        scheduledEnd: at(6, 10),
        paymentMode: 'pay_at_store',
      }),
      'CONFLICT',
    )) && (await nightRows('sv-b2'))[0]?.bookedCount === 2,
  );

  // ④ 取消释放全部晚：b31（晚 D+5 / D+6 两晚）>4h 直消 → 两晚 booked 归零（行保留）
  const ccB31 = await c1.cancel({ appointmentId: b31.id });
  check('寄养 >4h 取消 → cancelled', ccB31.outcome === 'cancelled');
  const afterCancelNights = await nightRows('sv-b1');
  check(
    '取消释放全部晚（晚 D+5 / D+6 booked_count 1→0）',
    [isoDay(at(5, 10)), isoDay(at(6, 10))].every((d) =>
      afterCancelNights.some((r) => r.nightDate === d && r.bookedCount === 0),
    ),
    afterCancelNights,
  );

  // ⑤ assertBookableTime 全住宿区间校验：住退同一日（0 晚）→ BAD_REQUEST
  check(
    '寄养 0 晚（住退同一日）→ BAD_REQUEST「退房日期且晚于入住日期」',
    await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-b1',
        type: 'boarding',
        scheduledStart: at(8, 10),
        scheduledEnd: at(8, 18),
        paymentMode: 'pay_at_store',
      }),
      'BAD_REQUEST',
      /退房日期/,
    ),
  );

  /* ==================== 5d. B3-3 商家拒单（reject · P1-1，含次卡回补联动门禁） ==================== */
  console.log('\n[5d] B3-3：reject 状态门禁 / 槽位释放 / 次卡回补幂等 / 双频道事件 / 入参与归属校验');
  const m2 = appointmentRouter.createCaller(ctxMerchant('u-m', 's-2'));

  // ① 状态门禁：confirmed（appt7）/ in_service（appt1）不可拒——明确报错且零副作用
  const appt7Before = await db.select().from(schema.appointments).where(eq(schema.appointments.id, appt7.id)).get();
  const outboxBeforeNonPending = await totalOutbox();
  check(
    'confirmed 单拒单 → BAD_REQUEST「仅待确认（pending）可婉拒」',
    await rejects(m1.reject({ appointmentId: appt7.id, reason: '时段冲突' }), 'BAD_REQUEST', /仅待确认/),
  );
  check(
    'in_service 单拒单 → BAD_REQUEST',
    await rejects(m1.reject({ appointmentId: appt1.id, reason: '时段冲突' }), 'BAD_REQUEST', /仅待确认/),
  );
  const appt7After = await db.select().from(schema.appointments).where(eq(schema.appointments.id, appt7.id)).get();
  check(
    // B3-5（W-14）兼容：appt7 此前走过客户取消申请被拒，cancelSource='customer' 留痕属预期；
    // 本断言口径改为「拒单尝试前后逐项一致」（零副作用），不再要求 cancelReason/Source 为 null
    '非 pending 拒单零副作用：appt7 仍 confirmed、cancelReason/cancelSource 与尝试前一致、无新增 outbox',
    appt7After?.status === 'confirmed' &&
      appt7After?.cancelReason === appt7Before?.cancelReason &&
      appt7After?.cancelSource === appt7Before?.cancelSource &&
      appt7Before?.updatedAt?.getTime() === appt7After?.updatedAt?.getTime() &&
      (await totalOutbox()) === outboxBeforeNonPending,
    { status: appt7After?.status, cancelSource: appt7After?.cancelSource },
  );

  // ② 入参/归属校验：reason 必填 1~100 字；客户角色/非本店不可拒
  check(
    'reason 为空 → BAD_REQUEST（zod 必填）',
    await rejects(m1.reject({ appointmentId: appt7.id, reason: '   ' }), 'BAD_REQUEST'),
  );
  check(
    'reason 超 100 字 → BAD_REQUEST',
    await rejects(m1.reject({ appointmentId: appt7.id, reason: '拒'.repeat(101) }), 'BAD_REQUEST'),
  );
  check(
    '客户角色调 reject → FORBIDDEN（merchantProcedure）',
    await rejects(c1.reject({ appointmentId: appt7.id, reason: '想拒' }), 'FORBIDDEN'),
  );
  check(
    '非本店商家调 reject → FORBIDDEN',
    await rejects(m2.reject({ appointmentId: appt7.id, reason: '想拒' }), 'FORBIDDEN', /本店/),
  );

  // ③ grooming（pay_at_store）拒单：置 cancelled + 时段槽释放 + 原因/来源落库 + 双频道事件
  const apptR1 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: at(2, 10),
    paymentMode: 'pay_at_store',
  });
  await flipToPending(apptR1.id); // S4：create 即 confirmed，改回 pending 模拟改期回退单（reject 仅 pending 可拒）
  const slotR1Before = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, at(2, 10))))
    .get();
  check('拒单前置：洗护时段槽已占（booked_count=1）', slotR1Before?.bookedCount === 1, slotR1Before);
  const rj1 = await m1.reject({ appointmentId: apptR1.id, reason: '该时段已约满，麻烦改约其他时间' });
  check(
    '拒单 → cancelled + cancelReason/cancelSource=merchant_reject 落库',
    rj1.status === 'cancelled' &&
      rj1.cancelReason === '该时段已约满，麻烦改约其他时间' &&
      rj1.cancelSource === 'merchant_reject',
    { status: rj1.status, cancelReason: rj1.cancelReason, cancelSource: rj1.cancelSource },
  );
  const slotR1After = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, at(2, 10))))
    .get();
  check('拒单同事务释放洗护时段槽（booked_count 1→0）', slotR1After?.bookedCount === 0, slotR1After);
  check(
    'appointment.rejected → user + store 双频道各 1 条，payload 含 reason',
    (await countOutbox('user:u-c1', 'appointment.rejected')) === 1 &&
      (await countOutbox('store:s-1', 'appointment.rejected')) === 1,
  );
  const rj1Evt = await db
    .select()
    .from(schema.eventOutbox)
    .where(and(eq(schema.eventOutbox.channel, 'user:u-c1'), eq(schema.eventOutbox.eventType, 'appointment.rejected')))
    .get();
  check(
    'rejected payload 含 appointmentId/petName/reason',
    rj1Evt?.payload?.appointmentId === apptR1.id &&
      rj1Evt?.payload?.petName === '豆豆' &&
      rj1Evt?.payload?.reason === '该时段已约满，麻烦改约其他时间',
    rj1Evt?.payload,
  );

  // ④ boarding 拒单：B3-2 全晚释放（两晚区间各占 1 → 拒单后各晚归零）
  const apptR2 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-b1',
    type: 'boarding',
    scheduledStart: at(8, 10),
    scheduledEnd: at(10, 10),
    paymentMode: 'pay_at_store',
  });
  await flipToPending(apptR2.id); // S4：create 即 confirmed，改回 pending 模拟历史/改期回退单
  const r2NightsBefore = await nightRows('sv-b1');
  check(
    '寄养拒单前置：晚 D+8 / D+9 各占 1',
    [isoDay(at(8, 10)), isoDay(at(9, 10))].every((d) =>
      r2NightsBefore.some((r) => r.nightDate === d && r.bookedCount === 1),
    ),
    r2NightsBefore,
  );
  const rj2 = await m1.reject({ appointmentId: apptR2.id, reason: '寄养位已满' });
  check('寄养拒单 → cancelled（来源 merchant_reject）', rj2.status === 'cancelled' && rj2.cancelSource === 'merchant_reject');
  const r2NightsAfter = await nightRows('sv-b1');
  check(
    '寄养拒单同事务全晚释放（晚 D+8 / D+9 booked_count 1→0）',
    [isoDay(at(8, 10)), isoDay(at(9, 10))].every((d) =>
      r2NightsAfter.some((r) => r.nightDate === d && r.bookedCount === 0),
    ),
    r2NightsAfter,
  );

  // ⑤ 门禁 3 · 次卡回补联动：pass_deduct 建单扣 4→3 → 拒单同事务回补 3→4（+1 流水）；
  //    再拒一次（已 cancelled）→ BAD_REQUEST 且 remainTimes 不变、+1 流水不重复（幂等）
  const apptR3 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: at(2, 15),
    paymentMode: 'pass_deduct',
  });
  await flipToPending(apptR3.id); // S4：create 即 confirmed，改回 pending 模拟历史/改期回退单（扣次流水已真实发生）
  check('pass_deduct 建单扣次（remain 4→3）', (await remainOf()) === 3, await remainOf());
  await m1.reject({ appointmentId: apptR3.id, reason: '门店临时休业' });
  check('门禁3：拒单同事务回补次卡（remain 3→4）', (await remainOf()) === 4, await remainOf());
  const r3Logs = await db
    .select()
    .from(schema.passDeductLogs)
    .where(eq(schema.passDeductLogs.appointmentId, apptR3.id));
  check(
    '门禁3：该单流水两条（-1 扣次 + +1 拒单回补）',
    r3Logs.length === 2 && r3Logs.some((l) => l.delta === -1) && r3Logs.some((l) => l.delta === 1),
    r3Logs.map((l) => l.delta),
  );
  check(
    '幂等：已取消单再拒 → BAD_REQUEST（仅待确认可婉拒）',
    await rejects(m1.reject({ appointmentId: apptR3.id, reason: '重复拒单' }), 'BAD_REQUEST', /仅待确认/),
  );
  const r3LogsAfter = await db
    .select()
    .from(schema.passDeductLogs)
    .where(eq(schema.passDeductLogs.appointmentId, apptR3.id));
  check(
    '幂等：重复拒单不重复回补（remain 仍 4，+1 流水仍 1 条）',
    (await remainOf()) === 4 && r3LogsAfter.length === 2,
    { remain: await remainOf(), deltas: r3LogsAfter.map((l) => l.delta) },
  );

  /* ==================== 5e. B3-4 寄养改期（reschedule 扩展至 boarding） ==================== */
  console.log('\n[5e] B3-4：寄养改期——必传 scheduledEnd / 全晚释放+逐晚占用 / 回退 pending / 双频道事件 / 满晚回滚 / 边界');
  // ① happy path：b41 两晚（D+11 入住 D+13 退房）→ 商家确认 + 派单 st-b → 客户改期 D+13→D+15
  const b41 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-b1',
    type: 'boarding',
    scheduledStart: at(11, 10),
    scheduledEnd: at(13, 10),
    paymentMode: 'pay_at_store',
  });
  await m1.confirm({ appointmentId: b41.id });
  await m1.assign({ appointmentId: b41.id, staffId: 'st-b' }); // st-b 持 boarding 技能
  // 寄养必传 scheduledEnd：缺省 / 不晚于入住日均 BAD_REQUEST（拒绝静默 24h 缺省压晚）
  check(
    'B3-4：寄养改期缺 scheduledEnd → BAD_REQUEST「退房日期」',
    await rejects(c1.reschedule({ appointmentId: b41.id, scheduledStart: at(13, 10) }), 'BAD_REQUEST', /退房日期/),
  );
  check(
    'B3-4：寄养改期 scheduledEnd 不晚于入住日 → BAD_REQUEST「退房日期」',
    await rejects(
      c1.reschedule({ appointmentId: b41.id, scheduledStart: at(13, 10), scheduledEnd: at(13, 18) }),
      'BAD_REQUEST',
      /退房日期/,
    ),
  );
  const rs41 = await c1.reschedule({ appointmentId: b41.id, scheduledStart: at(13, 10), scheduledEnd: at(15, 10) });
  check(
    'B3-4：寄养改期 → status 回退 pending + staffId 置空 + 新区间落库',
    rs41.status === 'pending' &&
      rs41.staffId === null &&
      rs41.scheduledStart.getTime() === at(13, 10).getTime() &&
      rs41.scheduledEnd.getTime() === at(15, 10).getTime(),
    { status: rs41.status, staffId: rs41.staffId },
  );
  const b41Nights = await nightRows('sv-b1');
  check(
    'B3-4：旧晚 D+11/D+12 全部释放（booked 1→0），新晚 D+13/D+14 逐晚占用（0→1）',
    [isoDay(at(11, 10)), isoDay(at(12, 10))].every((d) =>
      b41Nights.some((r) => r.nightDate === d && r.bookedCount === 0),
    ) &&
      [isoDay(at(13, 10)), isoDay(at(14, 10))].every((d) =>
        b41Nights.some((r) => r.nightDate === d && r.bookedCount === 1 && r.capacity === 1),
      ),
    b41Nights.map((r) => [r.nightDate, r.bookedCount]),
  );
  check(
    'B3-4：rescheduled 双频道（appointment:{aid} + store:s-1，by=customer，payload 含新区间）',
    (await countOutbox(`appointment:${b41.id}`, 'appointment.rescheduled')) === 1 &&
      (await countOutbox('store:s-1', 'appointment.rescheduled')) === 1,
  );
  const rs41Evt = await db
    .select()
    .from(schema.eventOutbox)
    .where(and(eq(schema.eventOutbox.channel, 'store:s-1'), eq(schema.eventOutbox.eventType, 'appointment.rescheduled')))
    .get();
  check(
    'B3-4：rescheduled payload 含 appointmentId/scheduledStart/scheduledEnd/by=customer',
    rs41Evt?.payload?.appointmentId === b41.id &&
      rs41Evt?.payload?.scheduledStart === at(13, 10).toISOString() &&
      rs41Evt?.payload?.scheduledEnd === at(15, 10).toISOString() &&
      rs41Evt?.payload?.by === 'customer',
    rs41Evt?.payload,
  );
  // 寄养本无次卡路径（B2-7R）：改期后卡表零触碰（该单无流水）
  check(
    'B3-4：寄养改期不触碰卡表（该单 pass_deduct_log 0 条）',
    (await db.select().from(schema.passDeductLogs).where(eq(schema.passDeductLogs.appointmentId, b41.id))).length === 0,
  );

  // ② 满员晚拒绝回滚实证：b42（c2）占满 D+16/D+17（sv-b1 capacity=1）；
  //    b41 改期到 D+16→D+18 → CONFLICT；旧晚/新晚/status/staffId 与改期前逐项一致
  const b42 = await c2.create({
    storeId: 's-1',
    petId: 'p-2',
    serviceId: 'sv-b1',
    type: 'boarding',
    scheduledStart: at(16, 10),
    scheduledEnd: at(18, 10),
    paymentMode: 'pay_at_store',
  });
  const b41RowBefore = await db.select().from(schema.appointments).where(eq(schema.appointments.id, b41.id)).get();
  const nightsBeforeConflict = await nightRows('sv-b1');
  check(
    'B3-4：满员晚前置——b42 已占满 D+16/D+17（capacity=1，booked=1；S4 落库即 confirmed）',
    b42.status === 'confirmed' &&
      [isoDay(at(16, 10)), isoDay(at(17, 10))].every((d) =>
        nightsBeforeConflict.some((r) => r.nightDate === d && r.bookedCount === 1 && r.capacity === 1),
      ),
    nightsBeforeConflict.map((r) => [r.nightDate, r.bookedCount]),
  );
  check(
    'B3-4：新区间含满员晚 → CONFLICT「已订满」',
    await rejects(
      c1.reschedule({ appointmentId: b41.id, scheduledStart: at(16, 10), scheduledEnd: at(18, 10) }),
      'CONFLICT',
      /已订满/,
    ),
  );
  const b41RowAfter = await db.select().from(schema.appointments).where(eq(schema.appointments.id, b41.id)).get();
  const nightsAfterConflict = await nightRows('sv-b1');
  check(
    'B3-4 回滚实证：预约行逐项一致（pending/staffId=null/区间 D+13→D+15 不变）',
    b41RowAfter?.status === b41RowBefore?.status &&
      b41RowAfter?.staffId === null &&
      b41RowAfter?.scheduledStart.getTime() === b41RowBefore?.scheduledStart.getTime() &&
      b41RowAfter?.scheduledEnd.getTime() === b41RowBefore?.scheduledEnd.getTime(),
    { before: b41RowBefore?.scheduledStart, after: b41RowAfter?.scheduledStart },
  );
  check(
    'B3-4 回滚实证：各晚快照与改期前逐行一致（旧晚未释放、满员晚未超占）',
    nightsAfterConflict.length === nightsBeforeConflict.length &&
      nightsAfterConflict.every((r, i) => {
        const b = nightsBeforeConflict[i];
        return b?.nightDate === r.nightDate && b.bookedCount === r.bookedCount && b.capacity === r.capacity;
      }),
    {
      before: nightsBeforeConflict.map((r) => [r.nightDate, r.bookedCount]),
      after: nightsAfterConflict.map((r) => [r.nightDate, r.bookedCount]),
    },
  );

  // ③ 边界：<4h（以入住日首晚 scheduledStart 计）/ 进行中（in_boarding）不可自助改期
  const b43 = await insertDirectAppt({
    code: 'SMKB43',
    status: 'confirmed',
    type: 'boarding',
    start: new Date(Date.now() + 2 * 3600_000),
  });
  check(
    'B3-4：距入住日首晚不足 4 小时 → BAD_REQUEST「不足 4 小时」',
    await rejects(
      c1.reschedule({ appointmentId: b43.id, scheduledStart: at(20, 10), scheduledEnd: at(21, 10) }),
      'BAD_REQUEST',
      /不足 4 小时/,
    ),
  );
  const b44 = await insertDirectAppt({ code: 'SMKB44', status: 'in_boarding', type: 'boarding', start: at(5, 10) });
  check(
    'B3-4：in_boarding 进行中改期 → BAD_REQUEST「不可改期」',
    await rejects(
      c1.reschedule({ appointmentId: b44.id, scheduledStart: at(20, 10), scheduledEnd: at(21, 10) }),
      'BAD_REQUEST',
      /不可改期/,
    ),
  );

  // ④ B2-6 回归：洗护改期不受影响（时段槽释放/占用 + 回退 pending + 事件）
  const g41 = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: at(4, 9),
    paymentMode: 'pay_at_store',
  });
  await m1.confirm({ appointmentId: g41.id });
  const rsG41 = await c1.reschedule({ appointmentId: g41.id, scheduledStart: at(4, 10) });
  check(
    'B3-4 回归：洗护改期 → pending + 新时段落库（end 按服务时长补齐）',
    rsG41.status === 'pending' &&
      rsG41.scheduledStart.getTime() === at(4, 10).getTime() &&
      rsG41.scheduledEnd.getTime() === at(4, 11).getTime(),
    { status: rsG41.status, end: rsG41.scheduledEnd },
  );
  const g41OldSlot = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, at(4, 9))))
    .get();
  const g41NewSlot = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-1'), eq(schema.storeSlots.slotStart, at(4, 10))))
    .get();
  check(
    'B3-4 回归：洗护旧时段槽释放（1→0）+ 新时段槽占用（0→1）',
    g41OldSlot?.bookedCount === 0 && g41NewSlot?.bookedCount === 1,
    { old: g41OldSlot?.bookedCount, new: g41NewSlot?.bookedCount },
  );

  /* ==================== 5f. B3-5 P2 打包：W-2 今天可约 / W-14 取消原因 ==================== */
  console.log('\n[5f] B3-5：W-2 +1h 缓冲前后端同拦 / W-14 取消原因落库（含 ≤4h 审核链）');
  /** 向上对齐 30min 粒度（秒/毫秒清零） */
  const alignedCeil = (d: Date): Date => {
    const t = new Date(d.getTime());
    t.setSeconds(0, 0);
    const rem = t.getMinutes() % 30;
    if (rem !== 0) t.setMinutes(t.getMinutes() + (30 - rem));
    return t;
  };
  // W-2：+1h 缓冲内的对齐时段 → BAD_REQUEST「1 小时」（缓冲检查先于营业时间，与旧
  // 「必须晚于当前时间」/「营业时间」文案可区分；now+15m 起对齐保证严格落在缓冲内）
  const nearSlot = alignedCeil(new Date(Date.now() + 15 * 60_000));
  check(
    'W-2：当前时间 +1h 内的时段 → BAD_REQUEST「1 小时」（过期/临近同拦）',
    await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-g1',
        type: 'grooming',
        scheduledStart: nearSlot,
        paymentMode: 'pay_at_store',
      }),
      'BAD_REQUEST',
      /1 小时/,
    ),
    nearSlot,
  );
  // W-2：≥now+1h 的最近营业时段可约（OPEN_ALL 09:00-20:00，60min 服务须打烊前完成）；
  // 运行时刻在营业日内则该时段就是「今天晚些时候」
  let laterSlot: Date | null = null;
  for (
    let t = alignedCeil(new Date(Date.now() + 60 * 60_000));
    t.getTime() < Date.now() + 48 * 3600_000;
    t = new Date(t.getTime() + 30 * 60_000)
  ) {
    const mins = t.getHours() * 60 + t.getMinutes();
    if (mins >= 9 * 60 && mins + 60 <= 20 * 60) {
      laterSlot = t;
      break;
    }
  }
  check('W-2：48h 内总能找到 ≥now+1h 且在营业时间的对齐时段', laterSlot !== null);
  const w2Appt = laterSlot
    ? await c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-g1',
        type: 'grooming',
        scheduledStart: laterSlot,
        paymentMode: 'pay_at_store',
      })
    : null;
  check(
    `W-2：≥now+1h 时段建单成功（命中${
      laterSlot && laterSlot.getDate() === new Date().getDate() ? '今天晚些时候' : '下一营业日'
    } ${laterSlot?.toLocaleString('zh-CN', { hour12: false }) ?? '-'}；S4 落库即 confirmed）`,
    !!w2Appt && w2Appt.status === 'confirmed',
  );

  // W-14：>4h 直消带原因 → cancelled + cancelReason + cancelSource='customer'
  const w14a = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: at(2, 16),
    paymentMode: 'pay_at_store',
  });
  const cc14a = await c1.cancel({ appointmentId: w14a.id, reason: '行程有变：临时要出差' });
  check(
    'W-14：>4h 直消带原因 → cancelled + cancelReason/cancelSource=customer 落库',
    cc14a.outcome === 'cancelled' &&
      cc14a.appointment.cancelReason === '行程有变：临时要出差' &&
      cc14a.appointment.cancelSource === 'customer',
    { reason: cc14a.appointment.cancelReason, source: cc14a.appointment.cancelSource },
  );
  // W-14：原因选填——不传原因仍可取消（reason=null，source 仍为客户侧口径）
  const w14b = await c1.create({
    storeId: 's-1',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    scheduledStart: at(2, 18),
    paymentMode: 'pay_at_store',
  });
  const cc14b = await c1.cancel({ appointmentId: w14b.id });
  check(
    'W-14：原因选填（不传 → cancelReason=null、cancelSource=customer）',
    cc14b.outcome === 'cancelled' &&
      cc14b.appointment.cancelReason === null &&
      cc14b.appointment.cancelSource === 'customer',
    { reason: cc14b.appointment.cancelReason, source: cc14b.appointment.cancelSource },
  );
  // W-14：≤4h 取消申请带原因 → cancel_requested 落库；reviewCancel 批准保留客户原因/来源
  const w14c = await insertDirectAppt({
    code: 'SMKC14',
    status: 'confirmed',
    start: new Date(Date.now() + 2 * 3600_000),
  });
  const cc14c = await c1.cancel({ appointmentId: w14c.id, reason: '时间不合适' });
  check(
    'W-14：≤4h 取消申请带原因 → cancel_requested + 原因落库',
    cc14c.outcome === 'cancel_requested' &&
      cc14c.appointment.cancelReason === '时间不合适' &&
      cc14c.appointment.cancelSource === 'customer',
  );
  const rc14c = await m1.reviewCancel({ appointmentId: w14c.id, approve: true });
  check(
    'W-14：商家批准取消后保留客户原因/来源（cancelled + customer，审核动作由事件 by 承载）',
    rc14c.appointment.status === 'cancelled' &&
      rc14c.appointment.cancelReason === '时间不合适' &&
      rc14c.appointment.cancelSource === 'customer',
    { status: rc14c.appointment.status, source: rc14c.appointment.cancelSource },
  );
  // W-14：reason 入参上限 100 字（与客户端合成口径一致）
  check(
    'W-14：reason 超 100 字 → BAD_REQUEST',
    await rejects(c1.cancel({ appointmentId: appt7.id, reason: '长'.repeat(101) }), 'BAD_REQUEST'),
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
    'listForStore：日期范围过滤（明天 ≥5 单全部在范围内）',
    storeList.length >= 5 && storeList.every((a) => a.scheduledStart >= dayFrom && a.scheduledStart <= dayTo),
    storeList.length,
  );
  // B3-5（W-4）：商家列表携客户标识——昵称 + 手机号后 4 位（仅本店订单出参）
  const w4Row = storeList.find((a) => a.id === appt1.id);
  check(
    'W-4：listForStore 行带 customerName/customerPhoneTail（昵称「客户一号」+ 尾号 1111）',
    !!w4Row && w4Row.customerName === '客户一号' && w4Row.customerPhoneTail === '1111',
    w4Row && { name: w4Row.customerName, tail: w4Row.customerPhoneTail },
  );
  const w4Get = await m1.get({ appointmentId: appt1.id });
  check(
    'W-4：appointment.get 带 customer{nickname, phoneTail}',
    w4Get.customer.nickname === '客户一号' && w4Get.customer.phoneTail === '1111',
    w4Get.customer,
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
    'appointment.created → store 频道共 19 条（原 7 次成功 create + B3-2 三节 b31 与 sv-b2 两单 + B3-3 拒单三单 + B3-4 改期三节 b41/b42/g41 + B3-5 5f 三单 w2Appt/w14a/w14b；CONFLICT/拒绝单不产生事件）',
    (await countOutbox('store:s-1', 'appointment.created')) === 19,
  );
  check(
    'appointment.rejected → 双频道各 3 条（B3-3：洗护/寄养/次卡三单）',
    (await countOutbox('user:u-c1', 'appointment.rejected')) === 3 &&
      (await countOutbox('store:s-1', 'appointment.rejected')) === 3,
  );
  check(
    'appointment.assigned 计数正确（S4：st-e 自动派单×11（u-c1 全部 grooming 建单）；st-a 改派 appt2=1；st-b 派单 appt4+b41=2；user:u-c1 = 11 自动 + 3 商家 = 14）',
    (await countOutbox('staff:st-e', 'appointment.assigned')) === 11 &&
      (await countOutbox('staff:st-a', 'appointment.assigned')) === 1 &&
      (await countOutbox('staff:st-b', 'appointment.assigned')) === 2 &&
      (await countOutbox('user:u-c1', 'appointment.assigned')) === 14,
  );
  check(
    'appointment.checkedin 共 3 条（appt1/appt2/appt3 各 1，幂等重扫无新增）',
    (await countOutbox(`appointment:${appt1.id}`, 'appointment.checkedin')) === 1 &&
      (await countOutbox(`appointment:${appt2.id}`, 'appointment.checkedin')) === 1 &&
      (await countOutbox(`appointment:${appt3.id}`, 'appointment.checkedin')) === 1,
  );
  check(
    'appointment.cancel_requested → store 频道共 3 条（appt6/appt7 + B3-5 W-14 的 w14c）',
    (await countOutbox('store:s-1', 'appointment.cancel_requested')) === 3,
  );

  /* ==================== 8. 批次 S4（任务 C）：自动派单与客户指定 ====================
   * 独立门店 s-3（双 groomer，不扰动 s-1 事件总账）：
   * 负荷最轻 / 并列先入职 / 指定成功与无空 / 校验错误 / 无可空 CONFLICT / 并发双击无双占 */
  console.log('\n[8] S4 任务 C：自动派单（负荷/并列）/ 客户指定 / 校验 / 并发');
  await db.insert(schema.users).values([
    { id: 'u-g1', kimiId: 'k-g1', nickname: '美容师甲' },
    { id: 'u-g2', kimiId: 'k-g2', nickname: '美容师乙' },
    { id: 'u-f3', kimiId: 'k-f3', nickname: '前台三' },
    { id: 'u-gs', kimiId: 'k-gs', nickname: '停职美容师' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: 'u-g1', role: 'staff' },
    { userId: 'u-g2', role: 'staff' },
    { userId: 'u-f3', role: 'staff' },
    { userId: 'u-gs', role: 'staff' },
  ]);
  await db.insert(schema.stores).values([
    { id: 's-3', ownerId: 'u-m', name: '冒烟三号店', openHours: OPEN_ALL, status: 'active' },
  ]);
  await db.insert(schema.staff).values([
    // sg-a 先入职（createdAt 先，并列时应优先）
    { id: 'sg-a', storeId: 's-3', userId: 'u-g1', name: '美容师甲', role: 'groomer', skills: ['wash'], schedule: SCHED_FULL, status: 'active' },
    { id: 'sg-b', storeId: 's-3', userId: 'u-g2', name: '美容师乙', role: 'groomer', skills: ['wash'], schedule: SCHED_FULL, status: 'active' },
    { id: 'sf-3', storeId: 's-3', userId: 'u-f3', name: '前台三', role: 'frontdesk', skills: ['wash'], schedule: SCHED_FULL, status: 'active' },
    { id: 'sg-s', storeId: 's-3', userId: 'u-gs', name: '停职美容师', role: 'groomer', skills: ['wash'], schedule: SCHED_FULL, status: 'suspended' },
  ]);
  await db.insert(schema.services).values([
    { id: 'svg-3', storeId: 's-3', type: 'grooming', name: 'S4 洗护', durationMin: 60, priceFen: 8800 },
    { id: 'svb-3', storeId: 's-3', type: 'boarding', name: 'S4 寄养', boardingRoomType: '标准间', priceFen: 19900 },
  ]);
  const s3Create = (scheduledStart: Date, staffId?: string, scheduledEnd?: Date) =>
    c1.create({
      storeId: 's-3',
      petId: 'p-1',
      serviceId: 'svg-3',
      type: 'grooming',
      scheduledStart,
      ...(scheduledEnd ? { scheduledEnd } : {}),
      paymentMode: 'pay_at_store',
      ...(staffId ? { staffId } : {}),
    });

  // ① 负荷最轻 + 并列先入职：同日连续 4 单 → sg-a / sg-b / sg-a / sg-b 交替
  const d1 = await s3Create(at(2, 15));
  const d2 = await s3Create(at(2, 16));
  const d3 = await s3Create(at(2, 17));
  const d4 = await s3Create(at(2, 18));
  check(
    'S4：负荷最轻派单——同日 4 单交替 sg-a/sg-b/sg-a/sg-b（0/0 并列→先入职 sg-a；随后负荷均衡）',
    d1.staffId === 'sg-a' && d2.staffId === 'sg-b' && d3.staffId === 'sg-a' && d4.staffId === 'sg-b',
    [d1.staffId, d2.staffId, d3.staffId, d4.staffId],
  );
  check(
    'S4：自动派单写 assignSource=auto + assigned 事件双频道（staff+user，payload.by=auto）',
    d1.assignSource === 'auto' &&
      (await countOutbox('staff:sg-a', 'appointment.assigned')) === 2 &&
      (await countOutbox('staff:sg-b', 'appointment.assigned')) === 2,
    d1.assignSource,
  );
  const d1Evt = (await db.select().from(schema.eventOutbox)).find(
    (r) =>
      r.eventType === 'appointment.assigned' &&
      (r.payload as Record<string, unknown>)?.appointmentId === d1.id,
  );
  check(
    'S4：assigned payload 含 staffId/staffName/by=auto',
    d1Evt?.payload?.staffId === 'sg-a' && d1Evt?.payload?.staffName === '美容师甲' && d1Evt?.payload?.by === 'auto',
    d1Evt?.payload,
  );

  // ② 客户指定：有空 → 成功写入；无空 → CONFLICT 原文案
  const d5 = await s3Create(at(2, 15), 'sg-b');
  check('S4：指定 sg-b（此时段有空）→ 成功写入 staff_id', d5.staffId === 'sg-b', d5.staffId);
  const slot15Before = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-3'), eq(schema.storeSlots.slotStart, at(2, 15))))
    .get();
  check(
    'S4：指定无空（sg-a 15:00 已占）→ CONFLICT「该美容师此时段已约满，请换时间或换美容师」',
    await rejects(s3Create(at(2, 15), 'sg-a'), 'CONFLICT', /^该美容师此时段已约满，请换时间或换美容师$/),
  );

  // ③ 无可空 groomer → CONFLICT 原文案（sg-a/sg-b 15:00 均已占；整体回滚不占槽）
  check(
    'S4：未指定且无可空 → CONFLICT「该时段已约满，请换个时间」',
    await rejects(s3Create(at(2, 15)), 'CONFLICT', /^该时段已约满，请换个时间$/),
  );
  const slot15After = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-3'), eq(schema.storeSlots.slotStart, at(2, 15))))
    .get();
  check(
    'S4：派单失败整体回滚——占槽不产生部分占用（15:00 booked_count 仍 2，失败单无预约记录）',
    slot15Before?.bookedCount === 2 && slot15After?.bookedCount === 2,
    { before: slot15Before?.bookedCount, after: slot15After?.bookedCount },
  );

  // ④ 指定校验：他店 / 非 groomer / 停职 / boarding 指定
  check(
    'S4：指定他店员工（st-c 属 s-2）→ BAD_REQUEST',
    await rejects(s3Create(at(3, 10), 'st-c'), 'BAD_REQUEST', /本店/),
  );
  check(
    'S4：指定前台（sf-3 非 groomer）→ BAD_REQUEST',
    await rejects(s3Create(at(3, 10), 'sf-3'), 'BAD_REQUEST', /美容师/),
  );
  check(
    'S4：指定停职 groomer（sg-s）→ BAD_REQUEST',
    await rejects(s3Create(at(3, 10), 'sg-s'), 'BAD_REQUEST', /停职/),
  );
  check(
    'S4：boarding 传 staffId → BAD_REQUEST（寄养按晚占房无需美容师）',
    await rejects(
      c1.create({
        storeId: 's-3',
        petId: 'p-1',
        serviceId: 'svb-3',
        type: 'boarding',
        scheduledStart: at(5, 10),
        scheduledEnd: at(6, 10),
        paymentMode: 'pay_at_store',
        staffId: 'sg-a',
      }),
      'BAD_REQUEST',
      /寄养/,
    ),
  );

  // ⑤ 并发双击不产生双占：D+3 10:00 仅 sg-b 可空（sg-a 直插冲突单占住），
  //    双客户并发 create → 恰 1 成功 1 CONFLICT，sg-b 该时段仅 1 单、占槽仅 +1
  await db.insert(schema.appointments).values({
    code: 'SMKS4W',
    customerId: 'u-c1',
    storeId: 's-3',
    staffId: 'sg-a',
    petId: 'p-1',
    serviceId: 'svg-3',
    type: 'grooming',
    scheduledStart: at(3, 10),
    scheduledEnd: at(3, 11),
    status: 'confirmed',
    priceFen: 8800,
    paymentMode: 'pay_at_store',
  });
  const [r1, r2] = await Promise.allSettled([
    s3Create(at(3, 10)),
    c2.create({
      storeId: 's-3',
      petId: 'p-2',
      serviceId: 'svg-3',
      type: 'grooming',
      scheduledStart: at(3, 10),
      paymentMode: 'pay_at_store',
    }),
  ]);
  const won = [r1, r2].filter((r) => r.status === 'fulfilled').length;
  const conflicted = [r1, r2].filter(
    (r) => r.status === 'rejected' && (r.reason as { code?: string })?.code === 'CONFLICT',
  ).length;
  if (conflicted !== 1) {
    console.log(
      '  [debug] 并发双击拒绝原因：',
      [r1, r2].map((r) =>
        r.status === 'rejected'
          ? { code: (r.reason as { code?: string })?.code, message: String((r.reason as Error)?.message).slice(0, 200) }
          : 'fulfilled',
      ),
    );
  }
  const sgBAtW = await db
    .select()
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.storeId, 's-3'),
        eq(schema.appointments.staffId, 'sg-b'),
        eq(schema.appointments.scheduledStart, at(3, 10)),
        ne(schema.appointments.status, 'cancelled'),
      ),
    );
  const slotW = await db
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, 's-3'), eq(schema.storeSlots.slotStart, at(3, 10))))
    .get();
  check(
    'S4：并发双击不产生双占——恰 1 单成功 1 单 CONFLICT，sg-b 同时段仅 1 单、占槽仅 1',
    won === 1 && conflicted === 1 && sgBAtW.length === 1 && slotW?.bookedCount === 1,
    { won, conflicted, sgBAtW: sgBAtW.length, booked: slotW?.bookedCount },
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
