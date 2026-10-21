/**
 * PD-66 evidence 夹具：对 dev 库（server/data/philia.db）经 router 真实链路造
 * in_service grooming 预约（create→checkin），输出 appointmentId 供截图/api-check。
 * 运行：node node_modules/tsx/dist/cli.mjs src/db/pd66EvidenceFixture.ts
 */
process.env.BOOKING_CODE_SECRET = process.env.BOOKING_CODE_SECRET ?? 'pd66-evidence-secret';

const { db, schema, client } = await import('../../src/db');
const { and, eq } = await import('drizzle-orm');
const { appointmentRouter } = await import('../../src/routers/appointment');
type Context = import('../../src/trpc').Context;

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

const start = new Date();
start.setDate(start.getDate() + 1);
start.setHours(10, 0, 0, 0);
await db
  .insert(schema.storeSlots)
  .values({ storeId: store.id, slotStart: start, capacity: 2, bookedCount: 0 })
  .onConflictDoNothing();

const ctxCustomer: Context = { db, user: { id: customerUser.userId, nickname: null, roles: ['customer'] } };
const ctxStaff: Context = {
  db,
  user: { id: frontdesk.userId, nickname: null, roles: ['staff'], staffId: frontdesk.id, storeId: store.id },
};
const c1 = appointmentRouter.createCaller(ctxCustomer);
const bStaff = appointmentRouter.createCaller(ctxStaff);

const appt = await c1.create({
  storeId: store.id,
  petId: pet.id,
  serviceId: service.id,
  type: 'grooming',
  scheduledStart: start,
  paymentMode: 'pay_at_store',
  note: 'PD-66 撤核销入口证据夹具',
});
const ck = await bStaff.checkin({ code: appt.code });
console.log(JSON.stringify({ appointmentId: appt.id, code: appt.code, status: ck.appointment.status, storeId: store.id, ownerId: ownerUser.userId }));
client.close();
