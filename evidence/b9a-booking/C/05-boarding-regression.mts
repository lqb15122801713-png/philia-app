/**
 * 任务 C 回归：寄养按晚计费/占晚口径不动（boardingNightDates 行为对照不变）。
 *
 * 1) 纯函数对照：boardingNightDates 对固定用例的输出逐值断言（入住日到退房日前一日，
 *    本地 +8 日界）——与任务 C 前口径一致（本任务未触碰该函数与寄养链路）；
 * 2) live：寄养建单 3 晚 → boarding_slots 逐晚 +1 且 store_slots（洗护槽）零触碰；
 *    取消 → 逐晚 -1 还原。scheduledEnd 仍由客户端必传（引擎不介入寄养）。
 */
import { createRequire } from 'node:module';

const BASE = 'http://127.0.0.1:7200';
const require = createRequire('D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/src/db/index.ts');
const { createClient } = require('@libsql/client') as typeof import('@libsql/client');
const client = createClient({ url: 'file:D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/data/philia.db' });
// ESM 动态导入（appointment.ts 链上 db/index.ts 含顶层 await，不能 createRequire）
const { boardingNightDates } = await import('file:///D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/src/routers/appointment.ts');

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

/* 1) boardingNightDates 纯函数对照（+8 日界； epoch 手算：2026-09-14 10:00 +8 = 02:00Z） */
const z = (s: string) => new Date(s);
{
  const nights = boardingNightDates(z('2026-09-14T02:00:00Z'), z('2026-09-17T02:00:00Z'));
  check("1. 9/14 10:00(+8) → 9/17 10:00(+8) = ['2026-09-14','2026-09-15','2026-09-16']（3 晚）",
    JSON.stringify(nights) === JSON.stringify(['2026-09-14', '2026-09-15', '2026-09-16']), nights);
}
{
  const nights = boardingNightDates(z('2026-09-14T02:00:00Z'), z('2026-09-15T02:00:00Z'));
  check("2. 1 晚区间 = ['2026-09-14']", JSON.stringify(nights) === JSON.stringify(['2026-09-14']), nights);
}
{
  const nights = boardingNightDates(z('2026-12-31T02:00:00Z'), z('2027-01-02T02:00:00Z')); // 12/31 10:00+8 → 1/2 10:00+8
  check('3. 跨年区间逐晚连续（12/31→1/1 两晚）', JSON.stringify(nights) === JSON.stringify(['2026-12-31', '2027-01-01']), nights);
}

/* 2) live 寄养建单/取消 */
const seedRes = await fetch(`${BASE}/api/auth/dev-seed-users`);
const seedUsers = (await seedRes.json()) as { users: { id: string; roles: string[] }[] };
const customer = seedUsers.users.find((u) => u.roles.includes('customer'))!;
const loginRes = await fetch(`${BASE}/api/auth/dev-login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: customer.id }),
});
const cookie = loginRes.headers.getSetCookie().find((s) => s.startsWith('philia_session='))!.split(';')[0]!;

const pets = await trpcGet<{ id: string; name: string }[]>('pet.list', cookie);
const wangcai = pets.find((p) => p.name === '旺财')!;
const nearby = await trpcGet<{ stores: { id: string }[] }>('store.listNearby', cookie, {});
const storeId = nearby.stores[0]!.id;
const cat0 = await trpcGet<{ services: { id: string; name: string; type: string; roomCount: number | null }[] }>(
  'store.getWithServices', cookie, { storeId });
const room = cat0.services.find((s) => s.type === 'boarding')!;
console.log(`[寄养房型] ${room.name} roomCount=${room.roomCount}`);

// 入住 = 后天 10:00(+8)，退房 = +3 天 10:00(+8)（3 晚）
const inMs = Date.now() + 3 * 24 * 3600 * 1000;
const inD = new Date(inMs + 8 * 3600 * 1000);
const start = Date.UTC(inD.getUTCFullYear(), inD.getUTCMonth(), inD.getUTCDate(), 2, 0, 0) - 0; // 10:00+8 = 02:00Z
const end = start + 3 * 24 * 3600 * 1000;
const nights = boardingNightDates(new Date(start), new Date(end));
console.log(`[区间] ${new Date(start).toISOString()} → ${new Date(end).toISOString()}，晚=${JSON.stringify(nights)}`);

const storeSlotsBefore = await client.execute({
  sql: `SELECT COALESCE(SUM(booked_count),0) AS s FROM store_slots WHERE store_id = ? AND slot_start >= ? AND slot_start < ?`,
  args: [storeId, Math.floor(start / 1000), Math.floor(end / 1000)],
});
const boardingBefore = await client.execute({
  sql: `SELECT night_date, booked_count FROM boarding_slots WHERE store_id = ? AND service_id = ? AND night_date IN (${nights.map(() => '?').join(',')})`,
  args: [storeId, room.id, ...nights],
});

const appt = await trpcPost<{ id: string; scheduledStart: string; scheduledEnd: string; priceFen: number }>(
  'appointment.create', cookie,
  { storeId, petId: wangcai.id, serviceId: room.id, type: 'boarding',
    scheduledStart: new Date(start).toISOString(), scheduledEnd: new Date(end).toISOString(),
    paymentMode: 'pay_at_store', note: '任务C寄养回归' },
  ['scheduledStart', 'scheduledEnd']);
check('4. 寄养建单成功（scheduledEnd 客户端必传口径不变）', !!appt.id, appt);
check('5. 寄养金额 = 单晚价 × 3 晚（按晚计费不动）', appt.priceFen === 19900 * 3, appt.priceFen);

const boardingAfter = await client.execute({
  sql: `SELECT night_date, booked_count FROM boarding_slots WHERE store_id = ? AND service_id = ? AND night_date IN (${nights.map(() => '?').join(',')})`,
  args: [storeId, room.id, ...nights],
});
console.log(`[boarding_slots] 前=${JSON.stringify(boardingBefore.rows)} 后=${JSON.stringify(boardingAfter.rows)}`);
check('6. boarding_slots 逐晚 +1（3 晚全占）', nights.every((n) => {
  const b = boardingBefore.rows.find((r) => r.night_date === n) as { booked_count: number } | undefined;
  const a = boardingAfter.rows.find((r) => r.night_date === n) as { booked_count: number } | undefined;
  return (a?.booked_count ?? 0) === (b?.booked_count ?? 0) + 1;
}), boardingAfter.rows);

const storeSlotsAfter = await client.execute({
  sql: `SELECT COALESCE(SUM(booked_count),0) AS s FROM store_slots WHERE store_id = ? AND slot_start >= ? AND slot_start < ?`,
  args: [storeId, Math.floor(start / 1000), Math.floor(end / 1000)],
});
check('7. store_slots（洗护槽）零触碰（寄养不占 30min 时段槽口径不变）',
  Number(storeSlotsAfter.rows[0]!.s) === Number(storeSlotsBefore.rows[0]!.s),
  { before: storeSlotsBefore.rows[0], after: storeSlotsAfter.rows[0] });

await trpcPost('appointment.cancel', cookie, { appointmentId: appt.id, reason: '任务C寄养回归收尾' });
const boardingReleased = await client.execute({
  sql: `SELECT night_date, booked_count FROM boarding_slots WHERE store_id = ? AND service_id = ? AND night_date IN (${nights.map(() => '?').join(',')})`,
  args: [storeId, room.id, ...nights],
});
check('8. 取消后逐晚 -1 还原（按晚释放口径不变）', nights.every((n) => {
  const b = boardingBefore.rows.find((r) => r.night_date === n) as { booked_count: number } | undefined;
  const a = boardingReleased.rows.find((r) => r.night_date === n) as { booked_count: number } | undefined;
  return (a?.booked_count ?? 0) === (b?.booked_count ?? 0);
}), boardingReleased.rows);

client.close();
console.log(failures === 0 ? '\n寄养按晚口径回归全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
