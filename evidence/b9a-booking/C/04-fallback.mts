/**
 * 任务 C 验收③：回退路径实证（宠物缺品种/体重 → 回退服务默认 durationMin，下单不阻断）。
 *
 * 步骤：为种子客户临时建档一只「缺品种+缺体重」的宠物（直接插库，验收后删除）
 *   → getWithServices(petId=该宠物) 的 serviceDurations 断言 source='default'
 *   → appointment.create 建单成功（不阻断），scheduledEnd-scheduledStart = 服务默认 120min
 *   → 占用槽数 = ceil(120/30) = 4 槽 → 取消还原 → 删除临时宠物。
 */
import { createRequire } from 'node:module';

const BASE = 'http://127.0.0.1:7200';
const require = createRequire('D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/src/db/index.ts');
const { createClient } = require('@libsql/client') as typeof import('@libsql/client');
const client = createClient({ url: 'file:D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/data/philia.db' });

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra)?.slice(0, 500)); }
};
function trpcUrl(path: string, input?: unknown): string {
  return `${BASE}/trpc/${path}?batch=1${input === undefined ? '' : `&input=${encodeURIComponent(JSON.stringify({ '0': { json: input } }))}`}`;
}
async function trpcGet<T>(path: string, cookie: string, input?: unknown): Promise<T> {
  const res = await fetch(trpcUrl(path, input), { headers: { cookie } });
  const body = (await res.json()) as any;
  if (body?.[0]?.error) throw new Error(`${path} → ${JSON.stringify(body[0].error).slice(0, 300)}`);
  return body[0].result.data.json as T;
}
async function trpcPost<T>(path: string, cookie: string, input: unknown, dateFields: string[] = []): Promise<T> {
  const meta = dateFields.length ? { meta: { values: Object.fromEntries(dateFields.map((f) => [f, ['Date']])) } } : {};
  const res = await fetch(`${BASE}/trpc/${path}?batch=1`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ '0': { json: input, ...meta } }),
  });
  const body = (await res.json()) as any;
  if (body?.[0]?.error) throw new Error(`${path} → ${JSON.stringify(body[0].error).slice(0, 300)}`);
  return body[0].result.data.json as T;
}

const seedRes = await fetch(`${BASE}/api/auth/dev-seed-users`);
const seedUsers = (await seedRes.json()) as { users: { id: string; roles: string[] }[] };
const customer = seedUsers.users.find((u) => u.roles.includes('customer'))!;
const loginRes = await fetch(`${BASE}/api/auth/dev-login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: customer.id }),
});
const cookie = loginRes.headers.getSetCookie().find((s) => s.startsWith('philia_session='))!.split(';')[0]!;

/* 临时宠物：缺 breed + 缺 weightKg */
const tempPetId = `pet_c_fallback_${Date.now().toString(36)}`;
await client.execute({
  sql: `INSERT INTO pets (id, owner_id, name, species, breed, weight_kg, neutered, created_at, updated_at)
        VALUES (?, ?, '未完善档案汪', 'dog', NULL, NULL, 0, strftime('%s','now'), strftime('%s','now'))`,
  args: [tempPetId, customer.id],
});
console.log(`[临时宠物] ${tempPetId}（species=dog, breed=NULL, weight_kg=NULL）`);

const nearby = await trpcGet<{ stores: { id: string }[] }>('store.listNearby', cookie, {});
const storeId = nearby.stores[0]!.id;
const cat0 = await trpcGet<{ services: { id: string; name: string; type: string; durationMin: number | null }[] }>(
  'store.getWithServices', cookie, { storeId });
const service = cat0.services.find((s) => s.name === '造型修剪')!; // durationMin=120

try {
  const g = await trpcGet<{
    slots: { slotStart: string }[];
    serviceDurations: Record<string, { durationMin: number | null; slotsNeeded: number | null; source: string; fallbackReason?: string }> | null;
  }>('store.getWithServices', cookie, { storeId, serviceId: service.id, petId: tempPetId });
  const d = g.serviceDurations![service.id]!;
  console.log(`[回退] serviceDurations: ${JSON.stringify(d)}`);
  check('1. 缺品种/体重 → source=default 且回退 durationMin=120 / 4 槽（附回退原因）',
    d.source === 'default' && d.durationMin === 120 && d.slotsNeeded === 4 && !!d.fallbackReason, d);

  const start = g.slots.map((s) => new Date(s.slotStart).getTime()).filter((ms) => ms > Date.now() + 24 * 3600 * 1000).sort((a, b) => a - b)[0]!;
  const appt = await trpcPost<{ id: string; scheduledStart: string; scheduledEnd: string }>(
    'appointment.create', cookie,
    { storeId, petId: tempPetId, serviceId: service.id, type: 'grooming', scheduledStart: new Date(start).toISOString(), paymentMode: 'pay_at_store', note: '任务C回退实证' },
    ['scheduledStart']);
  const durMin = (new Date(appt.scheduledEnd).getTime() - new Date(appt.scheduledStart).getTime()) / 60000;
  check(`2. 回退路径建单成功（不阻断下单），时长 = 服务默认 120min（实际 ${durMin}min）`, durMin === 120, { durMin });

  const occ = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM store_slots WHERE store_id = ? AND slot_start >= ? AND slot_start < ? AND booked_count > 0`,
    args: [storeId, Math.floor(start / 1000), Math.floor((start + 120 * 60000) / 1000)],
  });
  check('3. 回退单占用槽数 = 4（与 default slotsNeeded 一致）', Number(occ.rows[0]!.c) === 4, occ.rows[0]);

  await trpcPost('appointment.cancel', cookie, { appointmentId: appt.id, reason: '任务C回退实证收尾' });
  console.log('  ✓ 4. 收尾：回退单已取消（槽位对称释放）');
} finally {
  // 取消单仍 FK 引用宠物：先删本次验收单（无次卡流水/无步骤数据），再删临时宠物
  await client.execute({ sql: `DELETE FROM appointments WHERE pet_id = ? AND note = '任务C回退实证'`, args: [tempPetId] });
  await client.execute({ sql: `DELETE FROM pets WHERE id = ?`, args: [tempPetId] });
  console.log('  ✓ 5. 验收单与临时宠物已删除');
}

client.close();
console.log(failures === 0 ? '\n回退路径实证全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
