import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
const dbFile = fileURLToPath(new URL('../data/philia.db', import.meta.url));
const client = createClient({ url: 'file:' + dbFile.replaceAll('\\', '/') });
const schema = await client.execute("SELECT sql FROM sqlite_master WHERE name='appointments'");
console.log(schema.rows[0].sql);
const one = await client.execute("SELECT * FROM appointments WHERE id='01M254A5YEHJX4H0D9CPWWYZTT'");
console.log(JSON.stringify(one.rows[0], null, 1));
