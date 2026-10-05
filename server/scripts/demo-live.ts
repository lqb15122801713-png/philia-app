/**
 * 演示数据脚本（T2.4 集成验证用，针对真实种子库 philia.db，需 server 已在 7200 运行）：
 * 客户下单 → 商家确认+派单 → 客户取码 → 员工扫码核销 → 第 1-3 步拍照确认 → 停在第 4 步 active
 * 运行：node node_modules/tsx/dist/cli.mjs scripts/demo-live.ts
 * 输出：appointmentId / customerUserId（供 CDP 截图脚本使用）
 */
import superjson from 'superjson';
import { Jimp } from 'jimp';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db/index.js';

const BASE = 'http://localhost:7200';

async function trpcQuery<T>(path: string, cookie: string, input?: unknown): Promise<T> {
  const url = input === undefined
    ? `${BASE}/trpc/${path}`
    : `${BASE}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(superjson.serialize(input)))}`;
  const res = await fetch(url, { headers: { cookie } });
  return unwrap<T>(res, await res.json());
}
async function trpcMutate<T>(path: string, cookie: string, input?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/trpc/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(superjson.serialize(input ?? null)),
  });
  return unwrap<T>(res, await res.json());
}
function unwrap<T>(res: Response, envelope: any): T {
  if (envelope?.error) {
    const err = envelope.error?.json ?? envelope.error;
    throw new Error(`tRPC ${res.status} ${err?.data?.code}: ${err?.message}`);
  }
  return superjson.deserialize(envelope?.result?.data) as T;
}
async function login(userId: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`dev-login ${userId} 失败: ${res.status}`);
  const hit = res.headers.getSetCookie().find((s) => s.startsWith('philia_session='));
  if (!hit) throw new Error('未拿到会话 cookie');
  return hit.split(';')[0]!;
}
async function makePhoto(color: number): Promise<Buffer> {
  const img = new Jimp({ width: 1200, height: 900, color });
  return img.getBuffer('image/jpeg');
}

const users = await db.select().from(schema.users).all();
const roles = await db.select().from(schema.userRoles).all();
const roleOf = (r: string) => users.find((u) => roles.some((ur) => ur.userId === u.id && ur.role === r))!;
const customer = roleOf('customer');
const owner = roleOf('merchant_owner');
const staffRole = roles.find((r) => r.role === 'staff')!;
const staffUser = users.find((u) => u.id === staffRole.userId)!;
const staffRec = await db.select().from(schema.staff).where(eq(schema.staff.userId, staffUser.id)).get();

const customerCookie = await login(customer.id);
const ownerCookie = await login(owner.id);
const staffCookie = await login(staffUser.id);

const { stores } = await trpcQuery<any>('store.listNearby', customerCookie, {});
const store = stores[0];
const detail = await trpcQuery<any>('store.getWithServices', customerCookie, { storeId: store.id });
const service = detail.services.find((s: any) => s.type === 'grooming');
const slotStr = detail.slots[0]?.slotStart ?? detail.slots[0];
const scheduledStart = new Date(slotStr);

const pets = await trpcQuery<any>('pet.list', customerCookie);
const pet = (pets.pets ?? pets)[0];

const appt = await trpcMutate<any>('appointment.create', customerCookie, {
  storeId: store.id, petId: pet.id, serviceId: service.id, type: 'grooming',
  scheduledStart, paymentMode: 'pay_at_store', note: '演示单（T2.4 集成验证）',
});
const aid = appt.id ?? appt.appointment?.id;

await trpcMutate('appointment.confirm', ownerCookie, { appointmentId: aid });
await trpcMutate('appointment.assign', ownerCookie, { appointmentId: aid, staffId: staffRec!.id });

const codeRes = await trpcQuery<any>('appointment.getCode', customerCookie, { appointmentId: aid });
await trpcMutate('appointment.checkin', staffCookie, { qr: codeRes.raw });

// 前 3 步拍照确认（min: 1/2/3 张）
const plan = [
  { key: 'disinfection', n: 1, color: 0xffd9a0ff },
  { key: 'precheck', n: 2, color: 0xffb27fff },
  { key: 'grooming', n: 3, color: 0xff9c6bff },
];
for (const step of plan) {
  const photos = [];
  for (let i = 0; i < step.n; i++) {
    const buf = await makePhoto(step.color + i * 0x00030300 > 0xffffffff ? step.color : step.color + i * 0x00030300);
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'photo.jpg');
    fd.append('relDir', `appointment/${aid}/${step.key}`);
    const up = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie: staffCookie }, body: fd });
    if (!up.ok) throw new Error(`upload 失败: ${up.status} ${await up.text()}`);
    photos.push(await up.json());
  }
  await trpcMutate('serviceStep.addPhotos', staffCookie, {
    appointmentId: aid, stepKey: step.key,
    photos: photos.map((p: any) => ({ url: p.url, thumbUrl: p.thumbUrl })),
  });
  await trpcMutate('serviceStep.confirmStep', staffCookie, { appointmentId: aid, stepKey: step.key });
}

console.log(JSON.stringify({ appointmentId: aid, customerUserId: customer.id, staffUserId: staffUser.id }));
process.exit(0);
