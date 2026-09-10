import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
const dbFile = fileURLToPath(new URL('../data/philia.db', import.meta.url));
const client = createClient({ url: 'file:' + dbFile.replaceAll('\\', '/') });
const r = await client.execute('SELECT id, name, open_hours FROM stores');
for (const row of r.rows) console.log(row.name, row.open_hours);
const cols = await client.execute('PRAGMA table_info(stores)');
console.log(cols.rows.map((c) => c.name).join(','));
