/**
 * 续跑演示单（T3.5）：把 01M1QTNJVBCZDBRXRCZKKAV5VM 的第 4-6 步走完 → completed
 * 用法：node node_modules/tsx/dist/cli.mjs scripts/demo-finish.ts <appointmentId> <staffUserId>
 */
import superjson from 'superjson';
import { Jimp } from 'jimp';

const BASE = 'http://localhost:7200';
const [aid, staffUserId] = process.argv.slice(2);
if (!aid || !staffUserId) throw new Error('用法: demo-finish.ts <aid> <staffUserId>');

async function trpcMutate<T>(path: string, cookie: string, input?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/trpc/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(superjson.serialize(input ?? null)),
  });
  const envelope: any = await res.json();
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
  return hit!.split(';')[0]!;
}
async function upload(cookie: string, color: number, relDir: string): Promise<{ url: string; thumbUrl: string }> {
  const img = new Jimp({ width: 1200, height: 900, color });
  const buf = await img.getBuffer('image/jpeg');
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'photo.jpg');
  fd.append('relDir', relDir);
  const up = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie }, body: fd });
  if (!up.ok) throw new Error(`upload ${up.status}`);
  return up.json() as any;
}

const cookie = await login(staffUserId);
const steps: Array<{ key: string; photos: Array<{ color: number; tag?: string }> }> = [
  { key: 'detail', photos: [{ color: 0xffc98a5f }, { color: 0xffb3795f }] },
  { key: 'before_after', photos: [{ color: 0xff8a7a6b, tag: 'before' }, { color: 0xffd98e5f, tag: 'after' }] },
  { key: 'confirm', photos: [] },
];
for (const step of steps) {
  if (step.photos.length) {
    const photos = [];
    for (const p of step.photos) {
      const up = await upload(cookie, p.color, `appointment/${aid}/${step.key}`);
      photos.push({ url: up.url, thumbUrl: up.thumbUrl, ...(p.tag ? { tag: p.tag } : {}) });
    }
    await trpcMutate('serviceStep.addPhotos', cookie, { appointmentId: aid, stepKey: step.key, photos });
  }
  await trpcMutate('serviceStep.confirmStep', cookie, { appointmentId: aid, stepKey: step.key });
  console.log('done:', step.key);
}
console.log('completed');
process.exit(0);
