import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
const dbFile = fileURLToPath(new URL('../data/philia.db', import.meta.url));
const client = createClient({ url: 'file:' + dbFile.replaceAll('\\', '/') });
const r = await client.execute("SELECT p.id, p.name, p.price_fen, p.stock, p.status, p.store_id, s.name AS store_name FROM products p JOIN stores s ON s.id=p.store_id LIMIT 10");
console.log(JSON.stringify(r.rows, null, 1));
