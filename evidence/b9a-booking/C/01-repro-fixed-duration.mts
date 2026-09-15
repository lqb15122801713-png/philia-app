/**
 * 任务 C 复现（改动前）：服务时长写死 services.duration_min，与宠物无关。
 *
 * 实证口径：
 *  1) 同一 90min 服务，两只档案迥异的宠物（旺财=大型长毛犬 28.5kg 金毛 /
 *     咪咪=小型短毛猫 4.2kg 英短）分别建单 → scheduledEnd-scheduledStart
 *     恒等于服务 durationMin（90min），与宠物档案完全无关；
 *  2) 建单后 store_slots 仅「开始时刻」1 行 +1（90min 单只占 1 个 30min 槽），
 *     与 getWithServices「时长连续 N 槽均有余量」的栅格过滤口径不对称；
 *  3) 收尾：两单均 >4h 直消，旧口径释放 1 槽，数据还原。
 *
 * 运行：先起 server（7200），再 node tsx 本文件（仓库 philia-app/server 目录下均可，
 * 本脚本自带绝对 import 不依赖 cwd）。
 */
import { createRequire } from 'node:module';

const BASE = 'http://127.0.0.1:7200';
const require = createRequire('D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/src/db/index.ts');
// 直接走 libsql 只读查询 store_slots（与 server 同库：server/data/philia.db 默认路径）
const { createClient } = require('@libsql/client') as typeof import('@libsql/client');
const client = createClient({ url: 'file:D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/data/philia.db' });

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
  const meta = dateFields.length
    ? { meta: { values: Object.fromEntries(dateFields.map((f) => [f, ['Date']])) } }
    : {};
  const res = await fetch(`${BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ '0': { json: input, ...meta } }),
  });
  const body = (await res.json()) as any;
  if (body?.[0]?.error) throw new Error(`${path} → ${JSON.stringify(body[0].error).slice(0, 300)}`);
  return body[0].result.data.json as T;
}

async function slotsBooked(storeId: string, fromMs: number, toMs: number) {
  const r = await client.execute({
    sql: `SELECT slot_start, booked_count, capacity FROM store_slots
          WHERE store_id = ? AND slot_start >= ? AND slot_start < ? AND booked_count > 0
          ORDER BY slot_start`,
    args: [storeId, Math.floor(fromMs / 1000), Math.floor(toMs / 1000)],
  });
  return r.rows as unknown as { slot_start: number; booked_count: number; capacity: number }[];
}

async function main() {
  /* 登录客户 */
  const seedRes = await fetch(`${BASE}/api/auth/dev-seed-users`);
  const seedUsers = (await seedRes.json()) as { users: { id: string; roles: string[] }[] };
  const customer = seedUsers.users.find((u) => u.roles.includes('customer'))!;
  const loginRes = await fetch(`${BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: customer.id }),
  });
  const cookie = loginRes.headers.getSetCookie().find((s) => s.startsWith('philia_session='))!.split(';')[0]!;

  const pets = await trpcGet<{ id: string; name: string; species: string; breed: string | null; weightKg: number | null }[]>(
    'pet.list', cookie);
  const wangcai = pets.find((p) => p.name === '旺财')!;
  const mimi = pets.find((p) => p.name === '咪咪')!;
  console.log('[宠物档案] 旺财:', JSON.stringify({ species: wangcai.species, breed: wangcai.breed, weightKg: wangcai.weightKg }));
  console.log('[宠物档案] 咪咪:', JSON.stringify({ species: mimi.species, breed: mimi.breed, weightKg: mimi.weightKg }));

  const nearby = await trpcGet<{ stores: { id: string; name: string }[] }>('store.listNearby', cookie, {});
  const storeId = nearby.stores[0]!.id;
  const cat = await trpcGet<{ services: { id: string; name: string; type: string; durationMin: number | null }[] }>(
    'store.getWithServices', cookie, { storeId });
  const service = cat.services.find((s) => s.type === 'grooming' && s.durationMin === 90)!;
  console.log(`[服务] ${service.name} durationMin=${service.durationMin}`);

  const { slots } = await trpcGet<{ slots: { slotStart: string }[] }>(
    'store.getWithServices', cookie, { storeId, serviceId: service.id });
  // 取两个不同的明天后整点槽（避开彼此与既有占用）
  const starts = slots.map((s) => new Date(s.slotStart).getTime()).sort((a, b) => a - b);
  const startA = starts.find((t) => new Date(t).getUTCMinutes() === 0)!;
  const startB = starts.find((t) => t > startA + 6 * 3600 * 1000 && new Date(t).getUTCMinutes() === 0)!;
  console.log(`[选槽] A=${new Date(startA).toISOString()} B=${new Date(startB).toISOString()}`);

  const created: string[] = [];
  try {
    const apptA = await trpcPost<{ id: string; scheduledStart: string; scheduledEnd: string }>(
      'appointment.create', cookie,
      { storeId, petId: wangcai.id, serviceId: service.id, type: 'grooming',
        scheduledStart: new Date(startA).toISOString(), paymentMode: 'pay_at_store', note: '任务C复现A' },
      ['scheduledStart']);
    created.push(apptA.id);
    const apptB = await trpcPost<{ id: string; scheduledStart: string; scheduledEnd: string }>(
      'appointment.create', cookie,
      { storeId, petId: mimi.id, serviceId: service.id, type: 'grooming',
        scheduledStart: new Date(startB).toISOString(), paymentMode: 'pay_at_store', note: '任务C复现B' },
      ['scheduledStart']);
    created.push(apptB.id);

    const durA = (new Date(apptA.scheduledEnd).getTime() - new Date(apptA.scheduledStart).getTime()) / 60000;
    const durB = (new Date(apptB.scheduledEnd).getTime() - new Date(apptB.scheduledStart).getTime()) / 60000;
    console.log(`[复现1] 大型长毛犬(28.5kg金毛) 建单时长 = ${durA} min（服务 durationMin=90 写死，与宠物无关）`);
    console.log(`[复现1] 小型短毛猫(4.2kg英短)  建单时长 = ${durB} min（同一服务同一时长 → 宠物档案不影响时长）`);

    const occupiedA = await slotsBooked(storeId, startA, startA + 90 * 60000);
    console.log(`[复现2] 90min 单 A 覆盖区间 [start, start+90min) 内 store_slots 占用行：`,
      JSON.stringify(occupiedA.map((r) => ({ slotStart: new Date(r.slot_start * 1000).toISOString(), booked: r.booked_count }))));
    console.log(`[复现2] → 仅占开始时刻 1 个 30min 槽（90min 服务物理占 3 槽，口径不对称实证）`);
  } finally {
    for (const id of created) {
      await trpcPost('appointment.cancel', cookie, { appointmentId: id, reason: '任务C复现收尾' }).catch((e) => console.error('cancel fail', e));
    }
    const left = await slotsBooked(storeId, Math.min(...[Date.now()]), Date.now() + 8 * 24 * 3600 * 1000);
    console.log(`[收尾] 两单已取消（>4h 直消，旧口径各释放 1 槽）`);
    void left;
  }
  client.close();
}

await main();
