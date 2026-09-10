import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
const dbFile = fileURLToPath(new URL('../data/philia.db', import.meta.url));
const client = createClient({ url: 'file:' + dbFile.replaceAll('\\', '/') });
// 复位 B1 测试单为 confirmed（可重复核销验证）
await client.execute("UPDATE appointments SET status='confirmed', checked_in_at=NULL, staff_id=NULL WHERE id='01B8TESTCHECKIN000000000001'");
await client.execute("DELETE FROM appointment_steps WHERE appointment_id='01B8TESTCHECKIN000000000001'");
const r = await client.execute("SELECT id, code, status, checked_in_at FROM appointments WHERE id='01B8TESTCHECKIN000000000001'");
console.log('reset:', JSON.stringify(r.rows));
