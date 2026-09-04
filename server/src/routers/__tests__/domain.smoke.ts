/**
 * T1.3c 冒烟脚本：pet / store / boarding 三个领域 router
 *
 * 运行：npx tsx src/routers/__tests__/domain.smoke.ts
 *
 * 覆盖：
 * 1. pet upsert/list/get 归属校验（他人宠物 FORBIDDEN；有关联预约的 staff 可读）
 * 2. store listNearby 只回 active 门店；getWithServices 返回服务与可约槽且满槽不出现、
 *    按服务 duration 过滤连续占用
 * 3. upsertService 越店写 → FORBIDDEN
 * 4. inviteStaff 生成 24h 码；同人复用不重复建行；staffList 聚合返回
 * 5. boarding：in_boarding 夹具 → checkinStay（幂等更新）→ dailyLog 同日两次为 UPSERT
 *    （一行）→ outbox 有 boarding.daily_update → checkout 幂等且 appointment completed；
 *    stayBoard 超期标记正确
 *
 * 所有夹具均为脚本自建（不动种子数据），finally 里按子表→父表清场，跑完种子原样。
 */

import assert from 'node:assert/strict';
import { and, eq, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { client, db, schema } from '../../db';
import type { Context, SessionUser } from '../../trpc';
import { petRouter } from '../pet';
import { storeRouter } from '../store';
import { boardingRouter } from '../boarding';

/* ---------- 测试数据清理登记 ---------- */
const created = {
  userIds: [] as string[],
  storeIds: [] as string[],
  staffIds: [] as string[],
  petIds: [] as string[],
  appointmentIds: [] as string[],
  stayIds: [] as string[],
  outboxChannels: [] as string[],
};

async function runCleanup() {
  if (created.stayIds.length) {
    await db
      .delete(schema.boardingDailyLogs)
      .where(inArray(schema.boardingDailyLogs.stayId, created.stayIds));
    await db
      .delete(schema.boardingStays)
      .where(inArray(schema.boardingStays.id, created.stayIds));
  }
  if (created.appointmentIds.length) {
    await db
      .delete(schema.appointments)
      .where(inArray(schema.appointments.id, created.appointmentIds));
  }
  if (created.storeIds.length) {
    await db.delete(schema.storeSlots).where(inArray(schema.storeSlots.storeId, created.storeIds));
    await db.delete(schema.services).where(inArray(schema.services.storeId, created.storeIds));
    await db
      .delete(schema.staffInvites)
      .where(inArray(schema.staffInvites.storeId, created.storeIds));
  }
  if (created.petIds.length) {
    await db.delete(schema.pets).where(inArray(schema.pets.id, created.petIds));
  }
  if (created.staffIds.length) {
    await db.delete(schema.staff).where(inArray(schema.staff.id, created.staffIds));
  }
  if (created.storeIds.length) {
    await db.delete(schema.stores).where(inArray(schema.stores.id, created.storeIds));
  }
  if (created.userIds.length) {
    await db
      .delete(schema.notifications)
      .where(inArray(schema.notifications.userId, created.userIds));
    await db.delete(schema.userRoles).where(inArray(schema.userRoles.userId, created.userIds));
  }
  if (created.outboxChannels.length) {
    await db
      .delete(schema.eventOutbox)
      .where(inArray(schema.eventOutbox.channel, created.outboxChannels));
  }
  if (created.userIds.length) {
    await db.delete(schema.users).where(inArray(schema.users.id, created.userIds));
  }
}

/* ---------- 小工具 ---------- */
async function makeUser(nickname: string, roles: string[]): Promise<string> {
  const [u] = await db
    .insert(schema.users)
    .values({ kimiId: `smoke_dom_${ulid().toLowerCase()}`, nickname })
    .returning();
  created.userIds.push(u.id);
  for (const role of roles) {
    await db.insert(schema.userRoles).values({ userId: u.id, role });
  }
  return u.id;
}

function ctxOf(user: SessionUser): Context {
  return { db, user };
}

const errCode = (err: unknown) => (err as { code?: string }).code;

async function makeAppointment(fields: {
  customerId: string;
  storeId: string;
  staffId?: string | null;
  petId: string;
  serviceId: string;
  type: 'grooming' | 'boarding';
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  priceFen?: number;
  rating?: number | null;
}): Promise<string> {
  const [a] = await db
    .insert(schema.appointments)
    .values({
      code: `SMK${ulid()}`,
      customerId: fields.customerId,
      storeId: fields.storeId,
      staffId: fields.staffId ?? null,
      petId: fields.petId,
      serviceId: fields.serviceId,
      type: fields.type,
      status: fields.status,
      scheduledStart: fields.scheduledStart,
      scheduledEnd: fields.scheduledEnd,
      priceFen: fields.priceFen ?? 100,
      rating: fields.rating ?? null,
    })
    .returning();
  created.appointmentIds.push(a.id);
  return a.id;
}

async function main() {
  /* ---------- 夹具：用户 / 门店 / 员工 ---------- */
  const customerA = await makeUser('烟雾客户A', ['customer']);
  const customerB = await makeUser('烟雾客户B', ['customer']);
  const merchant1 = await makeUser('烟雾商家1', ['merchant_owner']);
  const merchant2 = await makeUser('烟雾商家2', ['merchant_owner']);
  const staffUser = await makeUser('烟雾员工', ['staff']);

  const [storeA] = await db
    .insert(schema.stores)
    .values({ ownerId: merchant1, name: '烟雾门店A', lat: 30.27, lng: 120.15, status: 'active' })
    .returning();
  const [storeB] = await db
    .insert(schema.stores)
    .values({ ownerId: merchant2, name: '烟雾门店B', lat: 30.3, lng: 120.2, status: 'active' })
    .returning();
  const [storeClosed] = await db
    .insert(schema.stores)
    .values({ ownerId: merchant1, name: '烟雾已关门店', lat: 30.28, lng: 120.16, status: 'closed' })
    .returning();
  created.storeIds.push(storeA.id, storeB.id, storeClosed.id);

  const [staffRow] = await db
    .insert(schema.staff)
    .values({ storeId: storeA.id, userId: staffUser, name: '烟雾员工', skills: ['boarding'] })
    .returning();
  created.staffIds.push(staffRow.id);

  const ctxA = ctxOf({ id: customerA, nickname: '烟雾客户A', roles: ['customer'] });
  const ctxB = ctxOf({ id: customerB, nickname: '烟雾客户B', roles: ['customer'] });
  const ctxM1 = ctxOf({ id: merchant1, nickname: '烟雾商家1', roles: ['merchant_owner'], storeId: storeA.id });
  const ctxM2 = ctxOf({ id: merchant2, nickname: '烟雾商家2', roles: ['merchant_owner'], storeId: storeB.id });
  const ctxStaff = ctxOf({ id: staffUser, nickname: '烟雾员工', roles: ['staff'], staffId: staffRow.id, storeId: storeA.id });

  const petA = petRouter.createCaller(ctxA);
  const petB = petRouter.createCaller(ctxB);
  const petStaff = petRouter.createCaller(ctxStaff);
  const storeAnon = storeRouter.createCaller(ctxA); // listNearby/getWithServices 只需登录
  const storeM1 = storeRouter.createCaller(ctxM1);
  const storeM2 = storeRouter.createCaller(ctxM2);
  const boardingStaff = boardingRouter.createCaller(ctxStaff);
  const boardingM1 = boardingRouter.createCaller(ctxM1);

  /* ===== 1. pet upsert/list/get 归属校验 ===== */
  const up1 = await petA.upsert({
    name: '烟狗',
    species: 'dog',
    breed: '柯基',
    weightKg: 9.8,
    vaccineValidUntil: '2027-01-01',
  });
  assert.equal(up1.created, true);
  created.petIds.push(up1.pet.id);

  const up2 = await petA.upsert({ id: up1.pet.id, name: '烟狗', species: 'dog', weightKg: 10.2 });
  assert.equal(up2.created, false);
  assert.equal(up2.pet.weightKg, 10.2);

  // 他人编辑 → FORBIDDEN
  await assert.rejects(
    petB.upsert({ id: up1.pet.id, name: '篡改', species: 'cat' }),
    (e) => errCode(e) === 'FORBIDDEN',
  );
  // zod 校验：非法物种被拒
  await assert.rejects(petA.upsert({ name: 'x', species: 'dragon' as never }));

  const listA = await petA.list();
  assert.equal(listA.length, 1);
  assert.equal(listA[0]!.id, up1.pet.id);

  // 他人 get → FORBIDDEN；无关联预约的 staff → FORBIDDEN
  assert.equal((await petA.get({ id: up1.pet.id })).pet.id, up1.pet.id);
  await assert.rejects(petB.get({ id: up1.pet.id }), (e) => errCode(e) === 'FORBIDDEN');
  await assert.rejects(petStaff.get({ id: up1.pet.id }), (e) => errCode(e) === 'FORBIDDEN');

  // 造一条「该宠物 × 该员工」的关联预约后，staff 可读
  const svcGroom = (
    await storeM1.upsertService({ type: 'grooming', name: '烟雾洗护', durationMin: 60, priceFen: 9900 })
  ).service;
  const now = Date.now();
  await makeAppointment({
    customerId: customerA,
    storeId: storeA.id,
    staffId: staffRow.id,
    petId: up1.pet.id,
    serviceId: svcGroom.id,
    type: 'grooming',
    status: 'confirmed',
    scheduledStart: new Date(now + 3600e3),
    scheduledEnd: new Date(now + 7200e3),
  });
  assert.equal((await petStaff.get({ id: up1.pet.id })).pet.name, '烟狗');
  console.log('✅ 1. pet upsert/list/get：归属校验正确（他人 FORBIDDEN；关联预约 staff 可读；zod 拦截非法物种）');

  /* ===== 2. store listNearby / getWithServices ===== */
  const nearby = await storeAnon.listNearby();
  const nearbyIds = nearby.stores.map((s) => s.id);
  assert.ok(nearbyIds.includes(storeA.id) && nearbyIds.includes(storeB.id));
  assert.ok(!nearbyIds.includes(storeClosed.id), 'closed 门店不应出现在 listNearby');

  const nearbyGeo = await storeAnon.listNearby({ lat: 30.299, lng: 120.199 });
  assert.equal(nearbyGeo.stores[0]!.id, storeB.id, 'geo 粗排最近的门店 B 应排第一');
  assert.ok(!nearbyGeo.stores.some((s) => s.id === storeClosed.id));

  // 时间槽：明天 10:00 起 5 个连续槽，11:00 满槽
  const base = new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(10, 0, 0, 0);
  const slotAt = (i: number, booked: number) => ({
    storeId: storeA.id,
    slotStart: new Date(base.getTime() + i * 30 * 60e3),
    capacity: 2,
    bookedCount: booked,
  });
  await db.insert(schema.storeSlots).values([
    slotAt(0, 0), // 10:00 可约
    slotAt(1, 0), // 10:30 可约
    slotAt(2, 2), // 11:00 满
    slotAt(3, 0), // 11:30 可约
    slotAt(4, 0), // 12:00 可约
  ]);

  const gws = await storeAnon.getWithServices({ storeId: storeA.id });
  assert.equal(gws.store.id, storeA.id);
  assert.ok(gws.services.some((s) => s.id === svcGroom.id), '应返回 active 服务项');
  const slotStarts = gws.slots.map((s) => s.slotStart.getTime());
  assert.ok(!slotStarts.includes(base.getTime() + 2 * 30 * 60e3), '满槽不应出现');
  assert.deepEqual(
    slotStarts,
    [0, 1, 3, 4].map((i) => base.getTime() + i * 30 * 60e3),
    '无服务过滤时应返回 4 个有余量槽（升序）',
  );

  // 按服务 duration=60min 过滤：需要 2 个连续有余量槽 → 只剩 10:00 与 11:30 两个起始槽
  const gws60 = await storeAnon.getWithServices({ storeId: storeA.id, serviceId: svcGroom.id });
  assert.deepEqual(
    gws60.slots.map((s) => s.slotStart.getTime()),
    [base.getTime(), base.getTime() + 3 * 30 * 60e3],
    '60min 服务只剩 10:00 / 11:30 两个可约起始槽',
  );
  console.log('✅ 2. store listNearby 仅 active + geo 粗排；getWithServices 满槽剔除、按 duration 过滤连续占用');

  /* ===== 3. upsertService 越店写 → FORBIDDEN ===== */
  const svcB = (
    await storeM2.upsertService({ type: 'grooming', name: 'B店洗护', durationMin: 45, priceFen: 5000 })
  ).service;
  await assert.rejects(
    storeM1.upsertService({ id: svcB.id, type: 'grooming', name: '越店篡改', priceFen: 1 }),
    (e) => errCode(e) === 'FORBIDDEN',
  );
  const svcBAfter = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, svcB.id))
    .then((r) => r[0]);
  assert.equal(svcBAfter.name, 'B店洗护', '越店写不应生效');

  const svcBoard = (
    await storeM1.upsertService({ type: 'boarding', name: '烟雾标准间寄养', priceFen: 19900, boardingRoomType: '标准间' })
  ).service;
  assert.equal(svcBoard.storeId, storeA.id);
  console.log('✅ 3. upsertService 越店写 FORBIDDEN 且未生效；本店新增（含寄养房型）正常');

  /* ===== 4. inviteStaff / staffList / setSchedule ===== */
  const inv1 = await storeM1.inviteStaff({ staffName: '小张' });
  assert.match(inv1.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/, '邀请码应为 8 位去混淆字符');
  assert.equal(inv1.reused, false);
  const ttlMs = inv1.expiresAt!.getTime() - Date.now();
  assert.ok(ttlMs > 23 * 3600e3 && ttlMs <= 24 * 3600e3 + 60e3, '邀请码应 24h 有效');

  const inv2 = await storeM1.inviteStaff({ staffName: '小张' });
  assert.equal(inv2.reused, true);
  assert.equal(inv2.code, inv1.code, '同店同名未用未过期应复用同一码');
  const inviteRows = await db
    .select()
    .from(schema.staffInvites)
    .where(eq(schema.staffInvites.storeId, storeA.id));
  assert.equal(inviteRows.length, 1, '复用不应重复建行');

  // staffList 绩效聚合：2 完成（评分 5 / 3）+ 1 进行中
  await makeAppointment({
    customerId: customerA, storeId: storeA.id, staffId: staffRow.id, petId: up1.pet.id,
    serviceId: svcGroom.id, type: 'grooming', status: 'completed',
    scheduledStart: new Date(now - 7200e3), scheduledEnd: new Date(now - 3600e3), rating: 5,
  });
  await makeAppointment({
    customerId: customerA, storeId: storeA.id, staffId: staffRow.id, petId: up1.pet.id,
    serviceId: svcGroom.id, type: 'grooming', status: 'completed',
    scheduledStart: new Date(now - 2 * 7200e3), scheduledEnd: new Date(now - 2 * 3600e3), rating: 3,
  });
  await makeAppointment({
    customerId: customerA, storeId: storeA.id, staffId: staffRow.id, petId: up1.pet.id,
    serviceId: svcGroom.id, type: 'grooming', status: 'in_service',
    scheduledStart: new Date(now - 3600e3), scheduledEnd: new Date(now + 3600e3),
  });
  const sl = await storeM1.staffList();
  const staffStat = sl.staff.find((s) => s.id === staffRow.id);
  assert.ok(staffStat);
  assert.deepEqual(
    { cc: staffStat.stats.completedCount, rc: staffStat.stats.ratedCount, good: staffStat.stats.goodRate },
    { cc: 2, rc: 2, good: 0.5 },
    '绩效聚合：完成 2 单、好评率 1/2',
  );

  await storeM1.setSchedule({ staffId: staffRow.id, schedule: { mon: [{ start: '09:00', end: '18:00' }], sun: null } });
  const staffAfter = await db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.id, staffRow.id))
    .then((r) => r[0]);
  assert.equal(staffAfter.schedule?.mon?.[0]?.start, '09:00');
  await assert.rejects(
    storeM2.setSchedule({ staffId: staffRow.id, schedule: {} }),
    (e) => errCode(e) === 'FORBIDDEN',
  );
  console.log('✅ 4. inviteStaff 24h 码 + 同名复用不建行；staffList 绩效聚合正确；setSchedule 越店 FORBIDDEN');

  /* ===== 5. boarding 全流程 ===== */
  const petBRow = (
    await petB.upsert({ name: '烟猫', species: 'cat', weightKg: 4.4, vaccineValidUntil: '2027-06-01' })
  ).pet;
  created.petIds.push(petBRow.id);

  const apptBoard1 = await makeAppointment({
    customerId: customerB, storeId: storeA.id, staffId: staffRow.id, petId: petBRow.id,
    serviceId: svcBoard.id, type: 'boarding', status: 'in_boarding',
    scheduledStart: new Date(now - 2 * 86400e3), scheduledEnd: new Date(now + 2 * 86400e3), priceFen: 19900,
  });
  created.outboxChannels.push(`user:${customerB}`, `store:${storeA.id}`, `appointment:${apptBoard1}`);

  // checkinStay：入住登记 + 幂等更新
  const ci1 = await boardingStaff.checkinStay({
    appointmentId: apptBoard1,
    checkinWeightKg: 4.4,
    belongings: [{ name: '猫粮', photoUrl: '/img/bag.png' }, { name: '玩具' }],
    roomNo: 'B01',
  });
  assert.equal(ci1.created, true);
  created.stayIds.push(ci1.stay.id);
  const ci2 = await boardingStaff.checkinStay({
    appointmentId: apptBoard1,
    checkinWeightKg: 4.5,
    belongings: [{ name: '猫粮' }],
    roomNo: 'B02',
  });
  assert.equal(ci2.created, false);
  assert.equal(ci2.stay.id, ci1.stay.id, '重复登记应更新同一行');
  assert.equal(ci2.stay.roomNo, 'B02');
  assert.equal(ci2.stay.checkinWeightKg, 4.5);
  const stayCount = await db
    .select()
    .from(schema.boardingStays)
    .where(eq(schema.boardingStays.appointmentId, apptBoard1));
  assert.equal(stayCount.length, 1, '幂等：仍只有一条住宿记录');

  // dailyLog：同日两次 → UPSERT 一行；outbox 有 boarding.daily_update
  const today = new Date().toISOString().slice(0, 10);
  const dl1 = await boardingStaff.dailyLog({
    stayId: ci1.stay.id,
    logDate: today,
    meals: [{ time: '09:00', food: '猫粮 50g', finished: true }],
    walks: 1,
    photos: ['/img/d1.png', '/img/d2.png'],
  });
  const dl2 = await boardingStaff.dailyLog({ stayId: ci1.stay.id, logDate: today, walks: 3, note: '下午补遛' });
  assert.equal(dl2.log.id, dl1.log.id, '同日两次打卡应为同一行（UPSERT）');
  assert.equal(dl2.log.walks, 3);
  const logRows = await db
    .select()
    .from(schema.boardingDailyLogs)
    .where(and(eq(schema.boardingDailyLogs.stayId, ci1.stay.id), eq(schema.boardingDailyLogs.logDate, today)));
  assert.equal(logRows.length, 1, '(stay_id, log_date) 唯一，仅一行');

  const dailyEvents = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.eventType, 'boarding.daily_update'));
  const dailyChannels = new Set(dailyEvents.map((e) => e.channel));
  assert.ok(dailyEvents.length >= 2, 'outbox 应有 boarding.daily_update');
  assert.ok(dailyChannels.has(`user:${customerB}`), '应推送客户端 user 频道');
  assert.ok(dailyChannels.has(`store:${storeA.id}`), '应推送商家端 store 频道');
  // 照片 >6 张被拒
  await assert.rejects(
    boardingStaff.dailyLog({
      stayId: ci1.stay.id,
      logDate: today,
      walks: 0,
      photos: ['1', '2', '3', '4', '5', '6', '7'],
    }),
  );

  // stayBoard：在店看板含最近打卡日期，未超期
  const boardBefore = await boardingM1.stayBoard();
  const item1 = boardBefore.board.find((b) => b.appointment.id === apptBoard1);
  assert.ok(item1, '看板应包含在住寄养单');
  assert.equal(item1.lastLogDate, today);
  assert.equal(item1.overdue, false);
  assert.equal(item1.pet.name, '烟猫');
  assert.equal(item1.customer.id, customerB);

  // checkout：退房核销 → stay.checkout_at + 预约 completed + boarding.completed 事件；幂等
  const co1 = await boardingStaff.checkout({ appointmentId: apptBoard1 });
  assert.equal(co1.alreadyCompleted, false);
  assert.ok(co1.stay.checkoutAt, 'checkout_at 应写入');
  assert.equal(co1.appointment.status, 'completed');
  assert.ok(co1.appointment.completedAt, 'completed_at 应写入');
  const completedEvents = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.eventType, 'boarding.completed'));
  assert.equal(completedEvents.length, 1);
  assert.equal(completedEvents[0]!.channel, `appointment:${apptBoard1}`);

  const co2 = await boardingStaff.checkout({ appointmentId: apptBoard1 });
  assert.equal(co2.alreadyCompleted, true, '重复退房应幂等返回');
  assert.equal(co2.stay.checkoutAt!.getTime(), co1.stay.checkoutAt!.getTime(), 'checkout_at 不应被改写');
  const completedEvents2 = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.eventType, 'boarding.completed'));
  assert.equal(completedEvents2.length, 1, '幂等：不重复发事件');

  // 超期夹具：scheduled_end 已过、未退房 → stayBoard overdue=true；已退房的 apptBoard1 不再上板
  const apptBoard2 = await makeAppointment({
    customerId: customerB, storeId: storeA.id, staffId: staffRow.id, petId: petBRow.id,
    serviceId: svcBoard.id, type: 'boarding', status: 'in_boarding',
    scheduledStart: new Date(now - 4 * 86400e3), scheduledEnd: new Date(now - 86400e3), priceFen: 19900,
  });
  const ciOver = await boardingStaff.checkinStay({
    appointmentId: apptBoard2, checkinWeightKg: 4.3, belongings: [], roomNo: 'B03',
  });
  created.stayIds.push(ciOver.stay.id);

  const boardAfter = await boardingM1.stayBoard();
  assert.ok(!boardAfter.board.some((b) => b.appointment.id === apptBoard1), '已退房不应再出现在看板');
  const itemOver = boardAfter.board.find((b) => b.appointment.id === apptBoard2);
  assert.ok(itemOver, '超期未退房单应仍在看板');
  assert.equal(itemOver.overdue, true, 'scheduled_end 已过且未退房 → 超期标记 true');
  assert.equal(itemOver.lastLogDate, null, '未打卡时最近打卡日期为 null');
  console.log('✅ 5. boarding：checkinStay 幂等 / dailyLog UPSERT+事件 / checkout 幂等+completed / stayBoard 超期标记正确');

  console.log('\n[domain.smoke] 全部 5 项通过 🎉');
}

try {
  await main();
} finally {
  await runCleanup();
  client.close();
}
