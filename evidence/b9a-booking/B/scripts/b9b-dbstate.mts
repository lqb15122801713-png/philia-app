/** 查当前库 appointment / steps / photos 现状（只读） */
import { db, schema } from '../src/db/index.js';
import { desc } from 'drizzle-orm';

const appts = await db.select().from(schema.appointments).orderBy(desc(schema.appointments.createdAt)).limit(10);
console.log('== appointments (最近10) ==');
for (const a of appts) {
  console.log(`${a.id} | ${a.type} | ${a.status} | pet=${a.petId} | svc=${a.serviceId} | start=${a.scheduledStart.toISOString()} | pay=${a.paymentMode} | ${a.priceFen}fen`);
}
const steps = await db.select().from(schema.appointmentSteps).limit(12);
console.log(`\n== appointment_steps (${steps.length} 样本) ==`);
for (const s of steps) console.log(`${s.appointmentId} | ${s.stepKey} | order=${s.stepOrder} | ${s.status}`);
const photos = await db.select().from(schema.stepPhotos).limit(10);
console.log(`\n== step_photos (${photos.length} 样本) ==`);
for (const p of photos) console.log(`${p.id} | step=${p.stepId} | url=${p.url} | thumb=${p.thumbUrl} | invalid=${p.invalidatedAt?.toISOString() ?? 'null'}`);
const slots = await db.select().from(schema.storeSlots).limit(3);
console.log(`\n== store_slots 样本 ==`);
for (const s of slots) console.log(`${s.storeId} | ${s.slotStart.toISOString()} | cap=${s.capacity} booked=${s.bookedCount}`);
const passes = await db.select().from(schema.memberPasses).limit(5);
console.log(`\n== member_passes (${passes.length}) ==`);
for (const p of passes) console.log(`${p.id} | user=${p.userId} | store=${p.storeId} | remain=${p.remainTimes} | status=${p.status} | exp=${p.expiresAt?.toISOString() ?? 'null'}`);
process.exit(0);
