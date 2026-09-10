import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
const dbFile = fileURLToPath(new URL('../data/philia.db', import.meta.url));
const client = createClient({ url: 'file:' + dbFile.replaceAll('\\', '/') });
const staff = await client.execute('SELECT id, user_id, store_id, name FROM staff');
console.log('staff:', JSON.stringify(staff.rows, null, 1));
const appts = await client.execute("SELECT id, status, type, store_id, staff_id, code, datetime(scheduled_start,'unixepoch','localtime') AS st FROM appointments ORDER BY created_at DESC LIMIT 8");
console.log('appointments:', JSON.stringify(appts.rows, null, 1));
