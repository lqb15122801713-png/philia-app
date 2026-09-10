import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
const dbFile = fileURLToPath(new URL('../data/philia.db', import.meta.url));
const client = createClient({ url: `file:${dbFile.replaceAll('\\', '/')}` });

const now = Math.floor(Date.now() / 1000);
const id = '01B8TESTORDER0000000000001';
const orderNo = 'MO-B8-0001';
const items = JSON.stringify([
  { product_id: '01M20EDD8GG8B9DM30FRF0A7T8', name: '全价成犬粮 2kg', quantity: 1, price_fen: 12900, image: null },
]);
const address = JSON.stringify({ receiver: '走查员', phone: '13800000000', detail: '示例市示例区示例路 1 号' });

await client.execute({
  sql: `INSERT INTO orders (id, order_no, customer_id, store_id, items, total_fen, address, status, tracking_no, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
        ON CONFLICT(id) DO NOTHING`,
  args: [id, orderNo, '01M20EDD8DKJ5DR9FZY7A01Y04', '01M20EDD8FQ5K9X22WACHWSXN4', items, 12900, address, now, now],
});
const check = await client.execute("SELECT id, order_no, total_fen, status FROM orders WHERE id = '" + id + "'");
console.log('inserted:', JSON.stringify(check.rows));
