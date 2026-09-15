import { client } from '../src/db';
const r = await client.execute(`SELECT id, status, staff_id FROM appointments WHERE id = '01M256D240E19GWNG2QMFV3Q8V'`);
console.log('在卷预约行数:', r.rows.length, r.rows[0] ? JSON.stringify(r.rows[0]) : '(不存在)');
const c = await client.execute('SELECT COUNT(*) AS c FROM appointments');
console.log('appointments 总行数:', c.rows[0].c);
client.close();
