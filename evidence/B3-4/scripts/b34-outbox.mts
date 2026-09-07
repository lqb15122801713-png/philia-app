import { and, eq } from 'drizzle-orm';
import { db, schema } from '../src/db';
const aid = process.argv[2]!;
const rows = await db.select().from(schema.eventOutbox).where(eq(schema.eventOutbox.eventType, 'appointment.rescheduled'));
for (const r of rows) {
  const p = r.payload as Record<string, unknown>;
  if (p?.appointmentId === aid) console.log(JSON.stringify({ id: r.id, channel: r.channel, eventType: r.eventType, payload: p, createdAt: r.createdAt?.toISOString() }));
}
process.exit(0);
