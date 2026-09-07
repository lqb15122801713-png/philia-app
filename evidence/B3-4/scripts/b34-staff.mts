import { db, schema } from '../src/db';
const rows = await db.select().from(schema.staff);
for (const r of rows) console.log(r.id, r.name, JSON.stringify(r.skills), r.status, r.storeId);
process.exit(0);
