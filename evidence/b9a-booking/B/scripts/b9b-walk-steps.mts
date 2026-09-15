/**
 * B9a 任务 B 验收辅助：把指定 in_service 洗护单沿正常状态机走完六步（或只走指定步）。
 * 全程走员工端正式接口（POST /api/upload → serviceStep.addPhotos → serviceStep.confirmStep），
 * 不直改 DB。用法：
 *   node node_modules/tsx/dist/cli.mjs scripts/b9b-walk-steps.mts <aid> [onlyStepKey] [--confirm]
 * - 不带 onlyStepKey：从当前 active 步连续走完到 completed；
 * - 带 onlyStepKey：只对该步 addPhotos（不 confirm），用于服务中面板照片缩略实证；
 * - 带 onlyStepKey + --confirm：addPhotos 后 confirmStep 该步（触发 step_updated 事件）。
 */
import superjson from 'superjson';
import { Jimp } from 'jimp';
import { db, schema } from '../src/db/index.js';
import { eq } from 'drizzle-orm';

const BASE = 'http://localhost:7200';
const argv = process.argv.slice(2);
const [aid, onlyStep] = argv;
const doConfirm = argv.includes('--confirm');
if (!aid) throw new Error('用法: b9b-walk-steps.mts <aid> [onlyStepKey]');

const STEP_PLAN: Array<{ key: string; photos: Array<{ color: number; tag?: 'before' | 'after' }> }> = [
  { key: 'disinfection', photos: [{ color: 0x9db38aff }] },
  { key: 'precheck', photos: [{ color: 0x8fb0c9ff }, { color: 0xc4a484ff }] },
  { key: 'grooming', photos: [{ color: 0xa5c8b1ff }, { color: 0xe0b183ff }, { color: 0xb7a7d1ff }] },
  { key: 'detail', photos: [{ color: 0xc9a05fff }, { color: 0xb3955fff }] },
  {
    key: 'before_after',
    photos: [
      { color: 0x8a8a7aff, tag: 'before' },
      { color: 0xd9c48eff, tag: 'after' },
    ],
  },
  { key: 'confirm', photos: [] },
];

async function trpc<T>(path: string, cookie: string, input?: unknown, method: 'query' | 'mutate' = 'mutate'): Promise<T> {
  const url =
    method === 'query'
      ? `${BASE}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(superjson.serialize(input ?? null)))}`
      : `${BASE}/trpc/${path}`;
  const res = await fetch(url, {
    method: method === 'query' ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', cookie },
    ...(method === 'mutate' ? { body: JSON.stringify(superjson.serialize(input ?? null)) } : {}),
  });
  const envelope: any = await res.json();
  if (envelope?.error) {
    const err = envelope.error?.json ?? envelope.error;
    throw new Error(`tRPC ${path} ${res.status} ${err?.data?.code}: ${err?.message}`);
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

async function upload(cookie: string, color: number): Promise<{ url: string; thumbUrl: string }> {
  const img = new Jimp({ width: 1200, height: 900, color });
  const buf = await img.getBuffer('image/jpeg');
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'photo.jpg');
  fd.append('relDir', `appointment/${aid}`);
  const up = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie }, body: fd });
  if (!up.ok) throw new Error(`upload HTTP ${up.status}`);
  return (await up.json()) as { url: string; thumbUrl: string };
}

/* ---- 找员工用户（种子 staff 角色第一个；其 staff 记录属该店） ---- */
const appt = await db.select().from(schema.appointments).where(eq(schema.appointments.id, aid)).get();
if (!appt) throw new Error(`预约不存在: ${aid}`);
const staffRows = await db.select().from(schema.staff).where(eq(schema.staff.storeId, appt.storeId)).all();
if (staffRows.length === 0) throw new Error('该店无员工');
const staffRec = staffRows[0]!;
const cookie = await login(staffRec.userId);
console.log(`员工登录: ${staffRec.name} (${staffRec.userId})，处理预约 ${aid}（当前 ${appt.status}）`);

async function activeStepKey(): Promise<string | null> {
  const steps = await trpc<any[]>('serviceStep.list', cookie, { appointmentId: aid }, 'query');
  const active = steps.find((s) => s.status === 'active');
  return active?.stepKey ?? null;
}

if (onlyStep) {
  /* ---- 仅对指定步上传照片（不 confirm）——服务中面板缩略图实证 ---- */
  const plan = STEP_PLAN.find((p) => p.key === onlyStep);
  if (!plan) throw new Error(`未知步骤 ${onlyStep}`);
  const active = await activeStepKey();
  if (active !== onlyStep) throw new Error(`当前 active 步为 ${active}，非 ${onlyStep}`);
  const photos = [];
  for (const p of plan.photos) {
    const up = await upload(cookie, p.color);
    photos.push({ url: up.url, thumbUrl: up.thumbUrl, tag: p.tag ?? 'normal' });
  }
  await trpc('serviceStep.addPhotos', cookie, { appointmentId: aid, stepKey: onlyStep, photos });
  console.log(`已上传 ${photos.length} 张照片到 ${onlyStep}`);
  if (doConfirm) {
    await trpc('serviceStep.confirmStep', cookie, { appointmentId: aid, stepKey: onlyStep });
    console.log(`${onlyStep}: confirmed（step_updated 事件已触发）`);
  }
  process.exit(0);
}

/* ---- 从当前 active 步续走到 completed ---- */
const firstActive = await activeStepKey();
if (firstActive === null) {
  console.log('已无 active 步（预约应已完成）');
  process.exit(0);
}
const startIdx = STEP_PLAN.findIndex((p) => p.key === firstActive);
if (startIdx < 0) throw new Error(`当前 active 步 ${firstActive} 不在六步计划内`);
for (const plan of STEP_PLAN.slice(startIdx)) {
  const active = await activeStepKey();
  if (active === null) {
    console.log('已无 active 步（预约应已完成）');
    break;
  }
  if (active !== plan.key) throw new Error(`步骤顺序异常：期望 active=${plan.key}，实际 ${active}`);
  if (plan.photos.length > 0) {
    const photos = [];
    for (const p of plan.photos) {
      const up = await upload(cookie, p.color);
      photos.push({ url: up.url, thumbUrl: up.thumbUrl, tag: p.tag ?? 'normal' });
    }
    await trpc('serviceStep.addPhotos', cookie, { appointmentId: aid, stepKey: plan.key, photos });
    console.log(`${plan.key}: 上传 ${photos.length} 张照片`);
  }
  await trpc('serviceStep.confirmStep', cookie, { appointmentId: aid, stepKey: plan.key });
  console.log(`${plan.key}: confirmed`);
}
const after = await db.select().from(schema.appointments).where(eq(schema.appointments.id, aid)).get();
console.log(`完成：${aid} 状态 = ${after?.status}`);
process.exit(0);
