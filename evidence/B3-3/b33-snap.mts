// B3-3 查库快照：拒单前后状态/槽位/次卡/事件四项
// 用法：tsx scripts/b33-snap.mts <label> [appointmentId]
import { db, schema, client } from '../src/db';
import { and, desc, eq } from 'drizzle-orm';

const [label, apptId] = process.argv.slice(2);
const CUSTOMER = '01M1XYKBJER5W7SXT254ACXDTB';
const STORE = '01M1XYKBJFPDAKXQM3EVAMG5N2';

console.log(`\n===== 快照 [${label}] ${new Date().toISOString()} =====`);
if (apptId) {
  const a = await db.select().from(schema.appointments).where(eq(schema.appointments.id, apptId)).get();
  console.log('appointment:', JSON.stringify(a ? {
    id: a.id, status: a.status, type: a.type, paymentMode: a.paymentMode,
    cancelReason: a.cancelReason, cancelSource: a.cancelSource,
    scheduledStart: a.scheduledStart, scheduledEnd: a.scheduledEnd, updatedAt: a.updatedAt,
  } : null, null, 1));
}
const pass = await db.select().from(schema.memberPasses)
  .where(and(eq(schema.memberPasses.userId, CUSTOMER), eq(schema.memberPasses.storeId, STORE))).get();
console.log('member_pass:', JSON.stringify(pass ? { id: pass.id, totalTimes: pass.totalTimes, remainTimes: pass.remainTimes, status: pass.status } : null));
const logs = await db.select().from(schema.passDeductLogs)
  .orderBy(desc(schema.passDeductLogs.createdAt));
console.log('pass_deduct_log（全部）:', JSON.stringify(logs.map(l => ({ passId: l.passId === pass?.id ? 'mp*' : l.passId, appointmentId: l.appointmentId, delta: l.delta })), null, 1));
const slots = await db.select().from(schema.storeSlots).where(eq(schema.storeSlots.storeId, STORE));
console.log('store_slots:', JSON.stringify(slots.map(s => ({ slotStart: s.slotStart, capacity: s.capacity, bookedCount: s.bookedCount })), null, 1));
const bslots = await db.select().from(schema.boardingSlots).where(eq(schema.boardingSlots.storeId, STORE));
console.log('boarding_slots:', JSON.stringify(bslots.map(s => ({ serviceId: s.serviceId.slice(-4), nightDate: s.nightDate, capacity: s.capacity, bookedCount: s.bookedCount })), null, 1));
const evts = await db.select().from(schema.eventOutbox).where(eq(schema.eventOutbox.eventType, 'appointment.rejected'));
console.log('outbox appointment.rejected:', JSON.stringify(evts.map(e => ({ channel: e.channel, payload: e.payload })), null, 1));
client.close();
