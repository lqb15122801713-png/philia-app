import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
const dbFile = fileURLToPath(new URL('../data/philia.db', import.meta.url));
const client = createClient({ url: 'file:' + dbFile.replaceAll('\\', '/') });
// B1 等价测试单：9/11 18:00 旺财 核销码 6PVCZ5（走查数据同构；本地 DB 无则造）
const now = Math.floor(Date.now() / 1000);
await client.execute({
  sql: `INSERT INTO appointments (id, code, customer_id, store_id, staff_id, pet_id, service_id, type,
        scheduled_start, scheduled_end, status, price_fen, payment_mode, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, ?, ?, 'grooming', ?, ?, 'confirmed', 8800, 'pay_at_store', 'B8 核销测试单', ?, ?)
        ON CONFLICT(id) DO NOTHING`,
  args: [
    '01B8TESTCHECKIN000000000001', '6PVCZ5',
    '01M20EDD8DKJ5DR9FZY7A01Y04', '01M20EDD8FQ5K9X22WACHWSXN4',
    '01M20EDD8GXKWWCB3BGNA8V87Z', '01M20EDD8GHGYFMHF2ZKE4T9D1',
    1789092000, 1789095600, now, now,
  ],
});
const check = await client.execute("SELECT id, code, status, type FROM appointments WHERE code='6PVCZ5'");
console.log('checkin test appt:', JSON.stringify(check.rows));
