/** 预约行快照（只读）：无参=客户单总数+最近5行关键字段；带 aid=该行全字段 JSON */
import { db, schema } from '../src/db/index.js';
import { desc, eq } from 'drizzle-orm';

const aid = process.argv[2];

if (aid) {
  const row = await db.select().from(schema.appointments).where(eq(schema.appointments.id, aid)).get();
  console.log(JSON.stringify(row, null, 2));
} else {
  const all = await db
    .select({
      id: schema.appointments.id,
      code: schema.appointments.code,
      customerId: schema.appointments.customerId,
      storeId: schema.appointments.storeId,
      petId: schema.appointments.petId,
      serviceId: schema.appointments.serviceId,
      type: schema.appointments.type,
      status: schema.appointments.status,
      scheduledStart: schema.appointments.scheduledStart,
      scheduledEnd: schema.appointments.scheduledEnd,
      paymentMode: schema.appointments.paymentMode,
      priceFen: schema.appointments.priceFen,
      note: schema.appointments.note,
      createdAt: schema.appointments.createdAt,
    })
    .from(schema.appointments)
    .orderBy(desc(schema.appointments.createdAt));
  const customers = await db.select().from(schema.users).all();
  const cust = customers.find((u) => u.nickname === '示例客户');
  const mine = all.filter((a) => a.customerId === cust?.id);
  console.log(JSON.stringify({ total: mine.length, recent: mine.slice(0, 5) }, null, 2));
}
process.exit(0);
