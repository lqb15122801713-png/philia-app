/**
 * 数据库冒烟验证脚本（node scripts/verify-db.mjs）
 * 校验：18 张表齐全、关键 UNIQUE/INDEX 约束存在、种子行数符合预期。
 */
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';

const dbFile = fileURLToPath(new URL('../data/philia.db', import.meta.url));
const client = createClient({ url: `file:${dbFile.replaceAll('\\', '/')}` });

const EXPECTED = [
  'users', 'user_roles', 'stores', 'staff', 'staff_invites',
  'pets', 'services',
  'appointments', 'store_slots', 'appointment_steps', 'step_photos',
  'boarding_stays', 'boarding_daily_logs',
  'products', 'orders',
  'push_subscriptions', 'event_outbox', 'notifications',
];

// 1) 18 张表齐全
const tbls = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_\\_drizzle%' ESCAPE '\\' ORDER BY name",
);
const names = tbls.rows.map((r) => r.name);
const missing = EXPECTED.filter((t) => !names.includes(t));
console.log(`[1] 表数量=${names.length}（期望 18） 缺失=${missing.length ? missing.join(',') : '无'}`);
if (names.length !== 18 || missing.length) process.exitCode = 1;

// 2) 关键约束（UNIQUE / INDEX）在 sqlite_master / pragma 中可见
const CHECKS = [
  ['user_roles', 'user_id,role', true],
  ['store_slots', 'store_id,slot_start', true],
  ['appointment_steps', 'appointment_id,step_key', true],
  ['appointment_steps', 'appointment_id,status', false],
  ['boarding_daily_logs', 'stay_id,log_date', true],
  ['boarding_stays', 'appointment_id', true],
  ['step_photos', 'step_id', false],
  ['event_outbox', 'channel,id', false],
  ['users', 'kimi_id', true],
  ['staff', 'user_id', true],
  ['appointments', 'code', true],
  ['orders', 'order_no', true],
  ['staff_invites', 'code', true],
];
console.log('[2] 约束检查：');
for (const [table, colsExpected, uniqueExpected] of CHECKS) {
  const il = await client.execute(`PRAGMA index_list(${table})`);
  let found = false;
  for (const idx of il.rows) {
    const cols = await client.execute(`PRAGMA index_info(${idx.name})`);
    const colsActual = cols.rows.map((c) => c.name).join(',');
    if (colsActual === colsExpected && Number(idx.unique) === Number(uniqueExpected)) {
      console.log(`  OK   ${table}(${colsExpected}) ${uniqueExpected ? 'UNIQUE' : 'INDEX'} -> ${idx.name}`);
      found = true;
      break;
    }
  }
  if (!found) {
    console.log(`  MISS ${table}(${colsExpected}) ${uniqueExpected ? 'UNIQUE' : 'INDEX'}`);
    process.exitCode = 1;
  }
}

// 3) 种子行数
console.log('[3] 种子行数：');
const COUNT_CHECKS = [
  ['stores', 1, 'eq'],
  ['staff', 3, 'eq'],
  ['services', 10, 'eq'],
  ['products', 10, 'eq'],
  ['store_slots', 100, 'gt'],
  ['users', 5, 'eq'],
  ['pets', 2, 'eq'],
];
for (const [table, expect, mode] of COUNT_CHECKS) {
  const r = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
  const c = Number(r.rows[0].c);
  const ok = mode === 'eq' ? c === expect : c > expect;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${table}=${c}（期望 ${mode === 'eq' ? '=' : '>'}${expect}）`);
  if (!ok) process.exitCode = 1;
}

// 4) 迁移记录
const mig = await client.execute('SELECT hash, created_at FROM __drizzle_migrations');
console.log(`[4] 已应用迁移=${mig.rows.length} 条`);

client.close();
console.log(process.exitCode ? '\n验证未通过 ✗' : '\n全部验证通过 ✓');
