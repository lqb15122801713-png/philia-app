/**
 * PD-79 evidence 夹具：对本窗 worktree 的 dev 库（server/data/philia.db）经 router 真实链路造
 * 三张 in_service grooming 预约（create→checkin）：
 *   A=撤核销正例（敏慧·owner 经 UI/端点撤）；
 *   B=撤单正例（同上）；
 *   C=涉钱 mock（in_service + paidAt 落值——双入口应隐/端点 400；paidAt 为夹具标记，测后随夹具自清）。
 * 输出 appointmentIds JSON（供截图/api-check/自清）。
 * 运行：node node_modules/tsx/dist/cli.mjs src/db/pd79EvidenceFixture.ts
 * 自清：node node_modules/tsx/dist/cli.mjs src/db/pd79EvidenceFixture.ts --clean <idA,idB,idC>
 * 纪律：零触碰 01M5EQVF（PD-66 历史夹具，留待上线后经正规入口撤）。
 */
process.env.BOOKING_CODE_SECRET = process.env.BOOKING_CODE_SECRET ?? 'pd79-evidence-secret';

const { db, schema, client } = await import('../../src/db');
const { and, eq, inArray } = await import('drizzle-orm');
const { appointmentRouter } = await import('../../src/routers/appointment');
type Context = import('../../src/trpc').Context;

/* ---------- 自清模式：删本窗夹具（含六步行/事件留痕外的业务行；event_outbox 留痕保留即审计） ---------- */
if (process.argv.includes('--clean')) {
  const idsArg = process.argv[process.argv.indexOf('--clean') + 1] ?? '';
  const ids = idsArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error('--clean 需跟逗号分隔 appointmentId 列表');
  for (const id of ids) {
    const appt = await db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).get();
    if (!appt) { console.log(`already gone ${id}`); continue; }
    if (!appt.note?.startsWith('PD-79')) throw new Error(`拒绝清理非本窗夹具单：${id}`);
    const stepIds = (
      await db.select({ id: schema.appointmentSteps.id }).from(schema.appointmentSteps).where(eq(schema.appointmentSteps.appointmentId, id))
    ).map((s) => s.id);
    if (stepIds.length > 0) {
      await db.delete(schema.stepPhotos).where(inArray(schema.stepPhotos.stepId, stepIds));
      await db.delete(schema.appointmentSteps).where(eq(schema.appointmentSteps.appointmentId, id));
    }
    await db.delete(schema.appointments).where(eq(schema.appointments.id, id));
    console.log(`cleaned ${id}`);
  }
  // 夹具美容师（本窗专用，固定 id）随夹具自清：notifications（核销通知）→ staff → roles → users
  await db.delete(schema.notifications).where(eq(schema.notifications.userId, 'pd79-fixture-groomer-user'));
  await db.delete(schema.staff).where(eq(schema.staff.id, 'pd79-fixture-groomer'));
  await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, 'pd79-fixture-groomer-user'));
  await db.delete(schema.users).where(eq(schema.users.id, 'pd79-fixture-groomer-user'));
  console.log('cleaned pd79-fixture-groomer');
  client.close();
  process.exit(0);
}

/* ---------- 造夹具 ---------- */
const store = await db.select().from(schema.stores).limit(1).get();
const ownerUser = await db
  .select()
  .from(schema.userRoles)
  .where(eq(schema.userRoles.role, 'merchant_owner'))
  .limit(1)
  .get();
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
  .where(and(eq(schema.services.storeId, store!.id), eq(schema.services.type, 'grooming')))
  .limit(1)
  .get();
if (!store || !ownerUser || !customerUser || !frontdesk || !pet || !service) {
  throw new Error('种子数据不全', { cause: { store, ownerUser, customerUser, frontdesk, pet, service } });
}

const ctxCustomer: Context = { db, user: { id: customerUser.userId, nickname: null, roles: ['customer'] } };
const ctxStaff: Context = {
  db,
  user: { id: frontdesk.userId, nickname: null, roles: ['staff'], staffId: frontdesk.id, storeId: store.id },
};
const c1 = appointmentRouter.createCaller(ctxCustomer);
const desk = appointmentRouter.createCaller(ctxStaff);

/* PD-79 夹具美容师（本店专属，全天排班 00:00-23:59）：时长引擎 ~150min 单 + 种子美容师
   18:00 收工，错时三段仍可能撞排班——专用 groomer 保证自动派单恒有人可派；自清随夹具删 */
const FIX_USER = 'pd79-fixture-groomer-user';
const FIX_STAFF = 'pd79-fixture-groomer';
const FULL_WEEK = {
  mon: [{ start: '00:00', end: '23:59' }],
  tue: [{ start: '00:00', end: '23:59' }],
  wed: [{ start: '00:00', end: '23:59' }],
  thu: [{ start: '00:00', end: '23:59' }],
  fri: [{ start: '00:00', end: '23:59' }],
  sat: [{ start: '00:00', end: '23:59' }],
  sun: [{ start: '00:00', end: '23:59' }],
};
await db.insert(schema.users).values({ id: FIX_USER, kimiId: FIX_USER, nickname: 'PD79夹具美容师' }).onConflictDoNothing();
await db.insert(schema.userRoles).values({ userId: FIX_USER, role: 'staff' }).onConflictDoNothing();
await db
  .insert(schema.staff)
  .values({ id: FIX_STAFF, storeId: store.id, userId: FIX_USER, name: 'PD79夹具美容师', role: 'groomer', skills: ['wash', 'groom'], schedule: FULL_WEEK, status: 'active' })
  .onConflictDoNothing();

const mk = async (note: string, hour: number) => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(hour, 0, 0, 0);
  await db
    .insert(schema.storeSlots)
    .values({ storeId: store.id, slotStart: start, capacity: 2, bookedCount: 0 })
    .onConflictDoNothing();
  const a = await c1.create({
    storeId: store.id,
    petId: pet.id,
    serviceId: service.id,
    type: 'grooming',
    scheduledStart: start,
    paymentMode: 'pay_at_store',
    note,
  });
  const ck = await desk.checkin({ code: a.code });
  return { id: a.id, code: a.code, status: ck.appointment.status };
};

const voidTarget = await mk('PD-79 撤核销正例夹具A', 10);
const cancelTarget = await mk('PD-79 撤单正例夹具B', 13);
const moneyMock = await mk('PD-79 涉钱 mock 夹具C（paidAt 标记，自清随单）', 16);
// 涉钱 mock：paidAt 落值（等价已收银态；本批不动收银台，单字段足够触发涉钱闸与 UI 隐入口）
await db
  .update(schema.appointments)
  .set({ paidAt: new Date(), paidFen: 8800 })
  .where(eq(schema.appointments.id, moneyMock.id));

console.log(
  JSON.stringify({
    storeId: store.id,
    ownerId: ownerUser.userId,
    frontdeskUserId: frontdesk.userId,
    voidTarget,
    cancelTarget,
    moneyMock,
  }),
);
client.close();

export {};
