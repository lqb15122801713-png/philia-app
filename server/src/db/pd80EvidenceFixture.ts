/**
 * PD-80 evidence 夹具：对本窗 worktree 的 dev 库（server/data/philia.db）经 router 真实链路造
 * 一张 in_boarding 寄养预约（create→checkin），供员工端「寄养收写」走测正例：
 *   收=入住登记（checkinStay）；写=每日打卡（dailyLog）。
 * 输出 appointmentId JSON（供截图/自清）。
 * 运行：node node_modules/tsx/dist/cli.mjs src/db/pd80EvidenceFixture.ts
 * 自清：node node_modules/tsx/dist/cli.mjs src/db/pd80EvidenceFixture.ts --clean <id>
 * 纪律：零触碰 01M5EQVF（历史禁碰夹具）。
 */
process.env.BOOKING_CODE_SECRET = process.env.BOOKING_CODE_SECRET ?? 'pd80-evidence-secret';

const { db, schema, client } = await import('../../src/db');
const { and, eq, inArray } = await import('drizzle-orm');
const { appointmentRouter } = await import('../../src/routers/appointment');
type Context = import('../../src/trpc').Context;

/* ---------- 自清模式：删本窗夹具（boarding_stays/daily_logs 子表先行；event_outbox 留痕保留即审计） ---------- */
if (process.argv.includes('--clean')) {
  const idsArg = process.argv[process.argv.indexOf('--clean') + 1] ?? '';
  const ids = idsArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error('--clean 需跟逗号分隔 appointmentId 列表');
  for (const id of ids) {
    const appt = await db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).get();
    if (!appt) { console.log(`already gone ${id}`); continue; }
    if (!appt.note?.startsWith('PD-80')) throw new Error(`拒绝清理非本窗夹具单：${id}`);
    const stays = await db
      .select({ id: schema.boardingStays.id })
      .from(schema.boardingStays)
      .where(eq(schema.boardingStays.appointmentId, id));
    for (const s of stays) {
      await db.delete(schema.boardingDailyLogs).where(eq(schema.boardingDailyLogs.stayId, s.id));
    }
    await db.delete(schema.boardingStays).where(eq(schema.boardingStays.appointmentId, id));
    /* 占晚回吐：boarding_slots 无 appointment 链（按 店×服务×晚 容量计数），按预约期逐晚 bookedCount-1 */
    const apptRow = appt;
    const { boardingNightDates } = await import('../routers/appointment');
    for (const night of boardingNightDates(apptRow.scheduledStart, apptRow.scheduledEnd)) {
      const slot = await db
        .select({ id: schema.boardingSlots.id, bookedCount: schema.boardingSlots.bookedCount })
        .from(schema.boardingSlots)
        .where(
          and(
            eq(schema.boardingSlots.storeId, apptRow.storeId),
            eq(schema.boardingSlots.serviceId, apptRow.serviceId),
            eq(schema.boardingSlots.nightDate, night),
          ),
        )
        .get();
      if (slot && slot.bookedCount > 0) {
        await db
          .update(schema.boardingSlots)
          .set({ bookedCount: slot.bookedCount - 1 })
          .where(eq(schema.boardingSlots.id, slot.id));
      }
    }
    await db.delete(schema.appointments).where(eq(schema.appointments.id, id));
    console.log(`cleaned ${id}`);
  }
  client.close();
  process.exit(0);
}

/* ---------- 造夹具 ---------- */
const store = await db.select().from(schema.stores).limit(1).get();
const customerUser = await db
  .select()
  .from(schema.userRoles)
  .where(eq(schema.userRoles.role, 'customer'))
  .limit(1)
  .get();
const frontdesk = await db
  .select()
  .from(schema.staff)
  .where(and(eq(schema.staff.storeId, store!.id), eq(schema.staff.role, 'frontdesk')))
  .limit(1)
  .get();
const pet = await db.select().from(schema.pets).limit(1).get();
const service = await db
  .select()
  .from(schema.services)
  .where(and(eq(schema.services.storeId, store!.id), eq(schema.services.type, 'boarding')))
  .limit(1)
  .get();
if (!store || !customerUser || !frontdesk || !pet || !service) {
  throw new Error('种子数据不全', { cause: { store, customerUser, frontdesk, pet, service } });
}

const ctxCustomer: Context = { db, user: { id: customerUser.userId, nickname: null, roles: ['customer'] } };
const ctxStaff: Context = {
  db,
  user: { id: frontdesk.userId, nickname: null, roles: ['staff'], staffId: frontdesk.id, storeId: store.id },
};
const c1 = appointmentRouter.createCaller(ctxCustomer);
const desk = appointmentRouter.createCaller(ctxStaff);

/* 寄养单：明日 15:00 入住 → +3 日 12:00 退房（两晚），到店付（create 限 ≥1h 后时段） */
const start = new Date();
start.setDate(start.getDate() + 1);
start.setHours(15, 0, 0, 0);
const end = new Date();
end.setDate(end.getDate() + 3);
end.setHours(12, 0, 0, 0);

const a = await c1.create({
  storeId: store.id,
  petId: pet.id,
  serviceId: service.id,
  type: 'boarding',
  scheduledStart: start,
  scheduledEnd: end,
  paymentMode: 'pay_at_store',
  medicalAuth: { agreed: true },
  note: 'PD-80 寄养收写夹具（走测后自清）',
});
const ck = await desk.checkin({ code: a.code });

console.log(JSON.stringify({ storeId: store.id, boarding: { id: a.id, code: a.code, status: ck.appointment.status } }));
client.close();

export {};
