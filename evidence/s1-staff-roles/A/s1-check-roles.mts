import { client } from '../src/db';

const staff = await client.execute("SELECT name, role, status FROM staff ORDER BY created_at");
console.log('[staff 表]');
for (const r of staff.rows) console.log(`  ${r.name}  role=${r.role}  status=${r.status}`);
const invites = await client.execute("SELECT code, staff_name, role FROM staff_invites ORDER BY created_at");
console.log(`[staff_invites 表] 共 ${invites.rows.length} 行`);
for (const r of invites.rows) console.log(`  ${r.code}  ${r.staff_name}  role=${r.role}`);
const cols = await client.execute("PRAGMA table_info(staff)");
console.log('[staff 列]', cols.rows.map((c) => `${c.name}:${c.type}${c.notnull ? ' NOTNULL' : ''} dflt=${c.dflt_value}`).join(' | '));
client.close();
