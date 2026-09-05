/**
 * 寄养演示数据（T3.5 联调用，真实种子库，server 需在 7200 运行）：
 * 客户下寄养单 → 商家确认+派单 → 员工扫码核销（in_boarding+自动建 stay）→ 入住登记 → 今日打卡
 * 输出：{ appointmentId }
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
  const hit = res.headers.getSetCookie().find((s) => s.startsWith('philia_session='));
  if (!hit) throw new Error('未拿到会话 cookie');
  return hit.split(';')[0]!;
}
async function upload(cookie: string, color: number, relDir: string): Promise<string> {
  const img = new Jimp({ width: 1200, height: 900, color });
  const buf = await img.getBuffer('image/jpeg');
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'photo.jpg');
  fd.append('relDir', relDir);
  const up = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie }, body: fd });
  if (!up.ok) throw new Error(`upload 失败: ${up.status}`);
  return (await up.json()).url as string;
}

const users = await db.select().from(schema.users).all();
const roles = await db.select().from(schema.userRoles).all();
const roleOf = (r: string) => users.find((u) => roles.some((ur) => ur.userId === u.id && ur.role === r))!;
const customer = roleOf('customer');
const owner = roleOf('merchant_owner');
const staffRec = await db.select().from(schema.staff).all()
  .then((rows) => rows.find((s) => JSON.stringify(s.skills).includes('boarding')));
if (!staffRec) throw new Error('无 boarding 技能员工');
const staffUser = users.find((u) => u.id === staffRec.userId)!;

// 幂等：清掉上一次脚本残留的 pending 寄养演示单
const prev = await db.select().from(schema.appointments).all()
  .then((rows) => rows.filter((a) => a.note === '寄养演示单（T3.5 联调）' && a.status === 'pending'));
for (const a of prev) await db.delete(schema.appointments).where(eq(schema.appointments.id, a.id));

const customerCookie = await login(customer.id);
const ownerCookie = await login(owner.id);
const staffCookie = await login(staffUser.id);

const { stores } = await trpcQuery<any>('store.listNearby', customerCookie, {});
const store = stores[0];
const detail = await trpcQuery<any>('store.getWithServices', customerCookie, { storeId: store.id });
const service = detail.services.find((s: any) => s.type === 'boarding');
const pets = await trpcQuery<any>('pet.list', customerCookie);
const pet = (pets.pets ?? pets)[1] ?? (pets.pets ?? pets)[0]; // 用猫咪咪咪

const start = new Date(detail.slots[0].slotStart);
const end = new Date(start.getTime() + 2 * 24 * 3600 * 1000);

const appt = await trpcMutate<any>('appointment.create', customerCookie, {
  storeId: store.id, petId: pet.id, serviceId: service.id, type: 'boarding',
  scheduledStart: start, scheduledEnd: end, paymentMode: 'pay_at_store', note: '寄养演示单（T3.5 联调）',
});
const aid = appt.id ?? appt.appointment?.id;

await trpcMutate('appointment.confirm', ownerCookie, { appointmentId: aid });
await trpcMutate('appointment.assign', ownerCookie, { appointmentId: aid, staffId: staffRec!.id });
const codeRes = await trpcQuery<any>('appointment.getCode', customerCookie, { appointmentId: aid });
await trpcMutate('appointment.checkin', staffCookie, { qr: codeRes.raw });

const toyPhoto = await upload(staffCookie, 0xfff2c9a4, `boarding/${aid}/belongings`);
await trpcMutate('boarding.checkinStay', staffCookie, {
  appointmentId: aid,
  checkinWeightKg: 4.2,
  roomNo: 'A-102',
  belongings: [
    { name: '猫抓板', photoUrl: toyPhoto },
    { name: '常备粮半袋' },
  ],
});

const stayRes = await trpcQuery<any>('boarding.stayForStaff', staffCookie, { appointmentId: aid });
const today = new Date().toISOString().slice(0, 10);
const dailyPhoto = await upload(staffCookie, 0xffd98e5f, `boarding/${aid}/daily/${today}`);
await trpcMutate('boarding.dailyLog', staffCookie, {
  stayId: stayRes.stay.id,
  logDate: today,
  meals: [
    { time: '09:00', food: '干粮 40g', finished: true },
    { time: '12:30', food: '罐头半罐', finished: false },
  ],
  walks: 1,
  note: '精神状态不错，中午晒了太阳，食量正常。',
  photos: [dailyPhoto],
});

console.log(JSON.stringify({ appointmentId: aid }));
process.exit(0);
