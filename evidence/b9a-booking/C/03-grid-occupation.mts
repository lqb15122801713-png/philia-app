/**
 * 任务 C 验收②：栅格占用随时长变化实证（live，server 7200 + 本地种子库）。
 *
 * 同一服务（造型修剪·美容类，durationMin=120）两只宠物：
 *   旺财 = 大型长毛犬（金毛 28.5kg）→ 引擎 90×2.0×1.25 = 225 → 240min / 8 槽
 *   咪咪 = 小型短毛猫（英短 4.2kg）→ 引擎 120×1.0×1.0 = 120min / 4 槽
 *
 * 实证 A（getWithServices 可约槽差异）：
 *   - serviceDurations 联动输出两宠物不同引擎时长；
 *   - 时长连续过滤差异：打烊前（20:00 关店）旺财最晚可约开始时刻早于咪咪
 *     （8 连续槽 vs 4 连续槽），同店同服务同日可约开始时刻集合不同。
 * 实证 B（建单后 store_slots 占用差异）：
 *   - 旺财建单 → 连续 8 槽各 +1；咪咪建单 → 连续 4 槽各 +1；
 *   - 取消后（>4h 直消）全部对称释放还原。
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
  if (input === undefined) return `${BASE}/trpc/${path}?batch=1`;
  return `${BASE}/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify({ '0': { json: input } }))}`;
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
const wall = (ms: number) => new Date(ms + 8 * 3600 * 1000).toISOString().slice(11, 16); // +8 墙钟 HH:MM
const dayOf = (ms: number) => new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);

async function slotsBooked(storeId: string, fromMs: number, toMs: number) {
  const r = await client.execute({
    sql: `SELECT slot_start, booked_count, capacity FROM store_slots
          WHERE store_id = ? AND slot_start >= ? AND slot_start < ? ORDER BY slot_start`,
    args: [storeId, Math.floor(fromMs / 1000), Math.floor(toMs / 1000)],
  });
  return r.rows as unknown as { slot_start: number; booked_count: number; capacity: number }[];
}

/* 登录 */
const seedRes = await fetch(`${BASE}/api/auth/dev-seed-users`);
const seedUsers = (await seedRes.json()) as { users: { id: string; roles: string[] }[] };
const customer = seedUsers.users.find((u) => u.roles.includes('customer'))!;
const loginRes = await fetch(`${BASE}/api/auth/dev-login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: customer.id }),
});
const cookie = loginRes.headers.getSetCookie().find((s) => s.startsWith('philia_session='))!.split(';')[0]!;

const pets = await trpcGet<{ id: string; name: string }[]>('pet.list', cookie);
const wangcai = pets.find((p) => p.name === '旺财')!;
const mimi = pets.find((p) => p.name === '咪咪')!;
const nearby = await trpcGet<{ stores: { id: string }[] }>('store.listNearby', cookie, {});
const storeId = nearby.stores[0]!.id;
const cat0 = await trpcGet<{ services: { id: string; name: string; type: string; durationMin: number | null }[] }>(
  'store.getWithServices', cookie, { storeId });
const service = cat0.services.find((s) => s.name === '造型修剪')!;
console.log(`[服务] ${service.name}（durationMin=${service.durationMin}，美容类）`);

/* ---------- 实证 A：可约槽差异 ---------- */
type Gws = {
  slots: { slotStart: string }[];
  serviceDurations: Record<string, { durationMin: number | null; slotsNeeded: number | null; source: string; rawMin?: number }> | null;
};
const forWang = await trpcGet<Gws>('store.getWithServices', cookie, { storeId, serviceId: service.id, petId: wangcai.id });
const forMimi = await trpcGet<Gws>('store.getWithServices', cookie, { storeId, serviceId: service.id, petId: mimi.id });
const forNone = await trpcGet<Gws>('store.getWithServices', cookie, { storeId, serviceId: service.id });

const dW = forWang.serviceDurations![service.id]!;
const dM = forMimi.serviceDurations![service.id]!;
console.log(`[A] 旺财 serviceDurations: ${JSON.stringify(dW)}`);
console.log(`[A] 咪咪 serviceDurations: ${JSON.stringify(dM)}`);
check('A1. 旺财引擎时长 240min/8 槽（raw 225）', dW.source === 'engine' && dW.durationMin === 240 && dW.slotsNeeded === 8 && dW.rawMin === 225, dW);
check('A2. 咪咪引擎时长 120min/4 槽（raw 120）', dM.source === 'engine' && dM.durationMin === 120 && dM.slotsNeeded === 4 && dM.rawMin === 120, dM);
check('A3. 不传 petId → serviceDurations 为 null（行为不变）', forNone.serviceDurations === null);

// 逐日统计最晚可约开始时刻（+8 墙钟）
function latestStartPerDay(g: Gws): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of g.slots) {
    const ms = new Date(s.slotStart).getTime();
    const d = dayOf(ms);
    const hm = wall(ms);
    if (!out[d] || hm > out[d]!) out[d] = hm;
  }
  return out;
}
const latestW = latestStartPerDay(forWang);
const latestM = latestStartPerDay(forMimi);
console.log('[A] 逐日最晚可约开始时刻（+8 墙钟）：');
for (const d of Object.keys(latestM).sort()) {
  console.log(`    ${d}  旺财=${latestW[d] ?? '无可约'}  咪咪=${latestM[d] ?? '无可约'}`);
}
const diffDays = Object.keys(latestM).filter((d) => latestW[d] !== latestM[d]);
check('A4. 可约槽差异：打烊前最晚可约开始时刻 旺财(8 连续槽) 早于 咪咪(4 连续槽)',
  diffDays.length > 0 && diffDays.every((d) => (latestW[d] ?? '00:00') < latestM[d]!), { latestW, latestM });

/* ---------- 实证 B：建单占用差异 ---------- */
// 各选一个明天之后、互不重叠的整点槽
const pickStart = (g: Gws, afterMs: number) => {
  const t = g.slots.map((s) => new Date(s.slotStart).getTime()).filter((ms) => ms > afterMs && wall(ms).endsWith(':00')).sort((a, b) => a - b)[0];
  if (!t) throw new Error('无可用整点槽');
  return t;
};
const startW = pickStart(forWang, Date.now() + 24 * 3600 * 1000);
const startM = pickStart(forMimi, startW + 8 * 3600 * 1000); // 错开 8h 不重叠
console.log(`[B] 旺财建单开始 ${new Date(startW).toISOString()}（+8 ${wall(startW)}）；咪咪建单开始 ${new Date(startM).toISOString()}（+8 ${wall(startM)}）`);

const apptW = await trpcPost<{ id: string; scheduledStart: string; scheduledEnd: string }>(
  'appointment.create', cookie,
  { storeId, petId: wangcai.id, serviceId: service.id, type: 'grooming', scheduledStart: new Date(startW).toISOString(), paymentMode: 'pay_at_store', note: '任务C栅格实证·旺财' },
  ['scheduledStart']);
const apptM = await trpcPost<{ id: string; scheduledStart: string; scheduledEnd: string }>(
  'appointment.create', cookie,
  { storeId, petId: mimi.id, serviceId: service.id, type: 'grooming', scheduledStart: new Date(startM).toISOString(), paymentMode: 'pay_at_store', note: '任务C栅格实证·咪咪' },
  ['scheduledStart']);

const durW = (new Date(apptW.scheduledEnd).getTime() - new Date(apptW.scheduledStart).getTime()) / 60000;
const durM = (new Date(apptM.scheduledEnd).getTime() - new Date(apptM.scheduledStart).getTime()) / 60000;
check(`B1. 旺财建单 scheduledEnd-scheduledStart = 240min（引擎输出，覆盖服务默认 120min）`, durW === 240, { durW });
check(`B2. 咪咪建单 scheduledEnd-scheduledStart = 120min（引擎输出）`, durM === 120, { durM });

const occW = await slotsBooked(storeId, startW, startW + 240 * 60000);
const occM = await slotsBooked(storeId, startM, startM + 120 * 60000);
console.log(`[B] 旺财覆盖区间 store_slots：${occW.map((r) => `${wall(r.slot_start * 1000)}=${r.booked_count}`).join(' ')}`);
console.log(`[B] 咪咪覆盖区间 store_slots：${occM.map((r) => `${wall(r.slot_start * 1000)}=${r.booked_count}`).join(' ')}`);
check('B3. 旺财建单 → 连续 8 个 30min 槽全部有占用', occW.length === 8 && occW.every((r) => r.booked_count >= 1), occW.length);
check('B4. 咪咪建单 → 连续 4 个 30min 槽全部有占用', occM.length === 4 && occM.every((r) => r.booked_count >= 1), occM.length);

/* ---------- 取消还原（对称释放） ---------- */
await trpcPost('appointment.cancel', cookie, { appointmentId: apptW.id, reason: '任务C验收收尾' });
await trpcPost('appointment.cancel', cookie, { appointmentId: apptM.id, reason: '任务C验收收尾' });
const afterW = await slotsBooked(storeId, startW, startW + 240 * 60000);
const afterM = await slotsBooked(storeId, startM, startM + 120 * 60000);
check('B5. 旺财单取消后 8 槽对称释放（各 -1）', afterW.every((r, i) => r.booked_count === occW[i]!.booked_count - 1), afterW.map((r) => r.booked_count));
check('B6. 咪咪单取消后 4 槽对称释放（各 -1）', afterM.every((r, i) => r.booked_count === occM[i]!.booked_count - 1), afterM.map((r) => r.booked_count));

client.close();
console.log(failures === 0 ? '\n栅格占用实证全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
