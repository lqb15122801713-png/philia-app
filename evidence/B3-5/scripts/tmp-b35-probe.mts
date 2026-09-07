/** B3-5 复现/验收临时探针（不入库，用后删除）：查库快照 */
import { db, schema, client } from './src/db';
import { asc } from 'drizzle-orm';

const slots = await db
  .select()
  .from(schema.storeSlots)
  .orderBy(asc(schema.storeSlots.slotStart));
const fmt = (d: Date) => d.toLocaleString('zh-CN', { hour12: false });
console.log('now =', fmt(new Date()));
console.log('store_slots count =', slots.length);
if (slots.length) {
  console.log('slot range:', fmt(slots[0]!.slotStart), '→', fmt(slots.at(-1)!.slotStart));
  const todaySlots = slots.filter((s) => {
    const d = s.slotStart;
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  });
  console.log('today slot rows =', todaySlots.length);
}
const appts = await db.select().from(schema.appointments);
console.log('appointments count =', appts.length);
for (const a of appts) {
  console.log(
    `  ${a.id} ${a.type} ${a.status} start=${fmt(a.scheduledStart)} staff=${a.staffId ?? '-'} cancelReason=${a.cancelReason ?? '-'} source=${a.cancelSource ?? '-'}`,
  );
}
const stays = await db.select().from(schema.boardingStays);
console.log('boarding_stays count =', stays.length);
for (const s of stays) console.log(`  stay ${s.id} appt=${s.appointmentId} checkoutAt=${s.checkoutAt ? fmt(s.checkoutAt) : '-'}`);
const users = await db.select().from(schema.users);
for (const u of users) console.log(`  user ${u.id} nick=${u.nickname ?? '-'} phone=${u.phone ?? '-'}`);
const staffs = await db.select().from(schema.staff);
for (const s of staffs) console.log(`  staff ${s.id} name=${s.name} user=${s.userId} store=${s.storeId} status=${s.status}`);
client.close();
