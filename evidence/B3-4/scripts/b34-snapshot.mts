/**
 * B3-4 证据用一次性快照脚本（不入库）：
 * 用法：npx tsx scripts/b34-snapshot.mts <appointmentId> [serviceId]
 * 输出：预约行关键字段 + 该房型 boarding_slots 全部晚（booked/capacity）
 */
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

const [aid, serviceId] = process.argv.slice(2);
if (!aid) throw new Error('usage: tsx scripts/b34-snapshot.mts <appointmentId> [serviceId]');

const appt = await db.select().from(schema.appointments).where(eq(schema.appointments.id, aid)).get();
console.log('== appointment ==');
console.log(
  JSON.stringify(
    appt && {
      id: appt.id,
      type: appt.type,
      status: appt.status,
      staffId: appt.staffId,
      scheduledStart: appt.scheduledStart?.toISOString(),
      scheduledEnd: appt.scheduledEnd?.toISOString(),
      priceFen: appt.priceFen,
      paymentMode: appt.paymentMode,
      updatedAt: appt.updatedAt?.toISOString(),
    },
    null,
    2,
  ),
);

const sid = serviceId ?? appt?.serviceId;
if (sid) {
  const nights = await db
    .select()
    .from(schema.boardingSlots)
    .where(and(eq(schema.boardingSlots.storeId, appt!.storeId), eq(schema.boardingSlots.serviceId, sid)))
    .orderBy(asc(schema.boardingSlots.nightDate));
  console.log('== boarding_slots (service', sid, ') ==');
  for (const r of nights) {
    console.log(`${r.nightDate}  booked=${r.bookedCount}/${r.capacity}`);
  }
  if (nights.length === 0) console.log('(无槽位行)');
}

// 次卡零触碰佐证：该单不应有任何 pass_deduct_log
const logs = await db.select().from(schema.passDeductLogs).where(eq(schema.passDeductLogs.appointmentId, aid));
console.log('== pass_deduct_log (该单) ==', logs.length === 0 ? '0 条（未触碰卡表）' : JSON.stringify(logs));

process.exit(0);
