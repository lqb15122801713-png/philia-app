/** B3-2 证据用一次性脚本：dump store_slots 占用与寄养预约（不入库，用完即删） */
import { db, schema } from '../src/db';
import { and, asc, eq, gt, ne } from 'drizzle-orm';

const storeId = process.argv[2];
if (!storeId) throw new Error('usage: tsx scripts/b3-2-slots.mts <storeId>');

const slots = await db
  .select()
  .from(schema.storeSlots)
  .where(and(eq(schema.storeSlots.storeId, storeId), gt(schema.storeSlots.bookedCount, 0)))
  .orderBy(asc(schema.storeSlots.slotStart));
console.log('== store_slots (booked_count>0) ==');
for (const s of slots) {
  console.log(`  slot_start=${s.slotStart.toISOString()} capacity=${s.capacity} booked_count=${s.bookedCount}`);
}
if (slots.length === 0) console.log('  (无占用行)');

const bslots = await db
  .select()
  .from(schema.boardingSlots)
  .where(eq(schema.boardingSlots.storeId, storeId))
  .orderBy(asc(schema.boardingSlots.nightDate));
console.log('== boarding_slots (全部行) ==');
for (const s of bslots) {
  console.log(`  night_date=${s.nightDate} service=${s.serviceId} capacity=${s.capacity} booked_count=${s.bookedCount}`);
}
if (bslots.length === 0) console.log('  (无行)');

const appts = await db
  .select({
    id: schema.appointments.id,
    type: schema.appointments.type,
    status: schema.appointments.status,
    scheduledStart: schema.appointments.scheduledStart,
    scheduledEnd: schema.appointments.scheduledEnd,
    serviceId: schema.appointments.serviceId,
  })
  .from(schema.appointments)
  .where(and(eq(schema.appointments.storeId, storeId), ne(schema.appointments.status, 'cancelled')))
  .orderBy(asc(schema.appointments.scheduledStart));
console.log('== appointments (非 cancelled) ==');
for (const a of appts) {
  console.log(`  id=${a.id} type=${a.type} status=${a.status} start=${a.scheduledStart.toISOString()} end=${a.scheduledEnd.toISOString()} svc=${a.serviceId}`);
}
process.exit(0);
