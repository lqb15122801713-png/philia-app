/**
 * 批次 S1 临时夹具（不入库）：重建「走查在卷测试预约」01M256D240E19GWNG2QMFV3Q8V。
 * 背景：任务 A 重跑 seed 清空业务表，smoke-routes 的固定 APPT_ID 随之消失，
 * 导致员工端 /execute/:id 路由冒烟失锚。本脚本按 smoke 口径重建：
 * in_service + 指派小美 + 六步初始化（step1 active，2-6 locked，required_photos 1/2/3/2/2/0）。
 * 幂等：先删后插。
 */
import { client } from '../src/db';

const APPT_ID = '01M256D240E19GWNG2QMFV3Q8V';

const store = (await client.execute(`SELECT id FROM stores LIMIT 1`)).rows[0];
const customer = (await client.execute(`SELECT id FROM users WHERE kimi_id = 'seed_kimi_customer'`)).rows[0];
const pet = (await client.execute(`SELECT id FROM pets WHERE name = '旺财'`)).rows[0];
const svc = (await client.execute(`SELECT id, price_fen FROM services WHERE type = 'grooming' ORDER BY created_at LIMIT 1`)).rows[0];
const xiaomei = (await client.execute(`SELECT id FROM staff WHERE name = '小美'`)).rows[0];
if (!store || !customer || !pet || !svc || !xiaomei) throw new Error('种子数据缺失');

await client.execute(`DELETE FROM appointment_steps WHERE appointment_id = '${APPT_ID}'`);
await client.execute(`DELETE FROM appointments WHERE id = '${APPT_ID}'`);

const nowSec = Math.floor(Date.now() / 1000);
const startSec = nowSec - 1800;
await client.execute({
  sql: `INSERT INTO appointments (id, code, customer_id, store_id, staff_id, pet_id, service_id, type,
        scheduled_start, scheduled_end, status, price_fen, payment_mode, checked_in_at)
        VALUES (?, 'SMK6P8', ?, ?, ?, ?, ?, 'grooming', ?, ?, 'in_service', ?, 'pay_at_store', ?)`,
  args: [APPT_ID, customer.id, store.id, xiaomei.id, pet.id, svc.id, startSec, startSec + 3600, svc.price_fen, nowSec],
});

const steps = [
  ['disinfection', 1, 1],
  ['precheck', 2, 2],
  ['grooming', 3, 3],
  ['detail', 4, 2],
  ['before_after', 5, 2],
  ['confirm', 6, 0],
] as const;
for (const [key, order, req] of steps) {
  await client.execute({
    sql: `INSERT INTO appointment_steps (id, appointment_id, step_key, step_order, status, required_photos, started_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `stpsmk${order}${APPT_ID.slice(-6)}`,
      APPT_ID,
      key,
      order,
      order === 1 ? 'active' : 'locked',
      req,
      order === 1 ? nowSec : null,
    ],
  });
}
console.log(`走查在卷预约已重建：${APPT_ID}（in_service，指派小美，六步初始化）`);
client.close();
