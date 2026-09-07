import { db, schema, client } from '../src/db';
import { eq, and } from 'drizzle-orm';
const pendings = await db.select({ id: schema.appointments.id, status: schema.appointments.status, storeId: schema.appointments.storeId, type: schema.appointments.type, start: schema.appointments.scheduledStart }).from(schema.appointments).where(eq(schema.appointments.status, 'pending'));
console.log('pending 单:', JSON.stringify(pendings, null, 1));
const stores = await db.select({ id: schema.stores.id, name: schema.stores.name, ownerId: schema.stores.ownerId }).from(schema.stores);
console.log('stores:', JSON.stringify(stores));
client.close();
