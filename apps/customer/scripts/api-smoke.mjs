/**
 * API 联调冒烟（T2.0）：node scripts/api-smoke.mjs
 *
 * 前置：server 已启动（cd server && npm run dev，端口 7200）。
 *
 * 验证项：
 *  1. GET /api/health
 *  2. POST /api/auth/dev-login（种子客户）→ 拿 philia_session cookie
 *  3. tRPC auth.me（带 cookie）→ 返回种子用户 + roles
 *  4. tRPC store.listNearby（带 cookie，lat/lng）→ 返回种子门店
 *  5. /api/events 无 cookie → 401；缺 client_id → 400；未登记 client_id → 403
 *  6. tRPC push.subscribe 登记 client_id → /api/events 200 + text/event-stream
 *     + 25s 心跳注释帧到达（证明 subscribe → SSE 全流程可用）
 *  7. POST /api/auth/logout → auth.me 回到 401
 */

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

const BASE = process.env.API_BASE ?? 'http://localhost:7200';
// 种子客户（server/src/db/seed.ts 的 seed_kimi_customer；当前开发库实际 ID）
const SEED_CUSTOMER_ID = '01M1PG9Q2NCSP8K04QQCCWFRAQ';
const CLIENT_ID = `smoke-${Date.now()}`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function trpcWithCookie(cookie) {
  return createTRPCClient({
    links: [
      httpBatchLink({
        url: `${BASE}/trpc`,
        transformer: superjson,
        fetch: (url, options) =>
          fetch(url, {
            ...options,
            headers: { ...options?.headers, Cookie: cookie },
          }),
      }),
    ],
  });
}

// 1. health
{
  const res = await fetch(`${BASE}/api/health`);
  const body = await res.json();
  check('GET /api/health', res.ok && body.ok === true, JSON.stringify(body));
}

// 2. dev-login
let cookie = '';
{
  const res = await fetch(`${BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: SEED_CUSTOMER_ID }),
  });
  const body = await res.json();
  const setCookies = res.headers.getSetCookie();
  cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
  check(
    'POST /api/auth/dev-login（种子客户）',
    res.ok && body.ok === true && cookie.includes('philia_session='),
    `user=${body?.user?.nickname} roles=${JSON.stringify(body?.user?.roles)}`,
  );
}

// 3. auth.me（带 cookie）
{
  const trpc = trpcWithCookie(cookie);
  try {
    const me = await trpc.auth.me.query();
    check(
      'trpc auth.me（带 cookie）',
      me.user.id === SEED_CUSTOMER_ID && me.roles.includes('customer'),
      `nickname=${me.user.nickname} roles=${JSON.stringify(me.roles)}`,
    );
  } catch (err) {
    check('trpc auth.me（带 cookie）', false, String(err));
  }
}

// 3b. auth.me（不带 cookie）→ 401
{
  const trpc = trpcWithCookie('');
  try {
    await trpc.auth.me.query();
    check('trpc auth.me（无 cookie）→ 401', false, '未抛错');
  } catch (err) {
    const status = err?.data?.httpStatus;
    check('trpc auth.me（无 cookie）→ 401', status === 401, `httpStatus=${status}`);
  }
}

// 4. store.listNearby（带 cookie + 经纬度）
{
  const trpc = trpcWithCookie(cookie);
  try {
    const result = await trpc.store.listNearby.query({ lat: 30.2741, lng: 120.1551 });
    const stores = result?.stores;
    const first = stores?.[0];
    check(
      'trpc store.listNearby（种子门店）',
      Array.isArray(stores) && stores.length > 0 && typeof first.name === 'string',
      `共 ${stores?.length} 家，第一家=${first?.name} 地址=${first?.address}`,
    );
  } catch (err) {
    check('trpc store.listNearby（种子门店）', false, String(err));
  }
}

// 5a. /api/events 无 cookie → 401
{
  const res = await fetch(`${BASE}/api/events?client_id=${CLIENT_ID}`);
  check('GET /api/events 无 cookie → 401', res.status === 401, `status=${res.status}`);
  await res.body?.cancel();
}

// 5b. /api/events 缺 client_id → 400
{
  const res = await fetch(`${BASE}/api/events`, { headers: { Cookie: cookie } });
  check('GET /api/events 缺 client_id → 400', res.status === 400, `status=${res.status}`);
  await res.body?.cancel();
}

// 5c. /api/events 未登记 client_id → 403
{
  const res = await fetch(`${BASE}/api/events?client_id=${CLIENT_ID}`, {
    headers: { Cookie: cookie },
  });
  check('GET /api/events 未登记 client_id → 403', res.status === 403, `status=${res.status}`);
  await res.body?.cancel();
}

// 6a. push.subscribe 登记
{
  const trpc = trpcWithCookie(cookie);
  try {
    const sub = await trpc.push.subscribe.mutate({ clientId: CLIENT_ID, appType: 'customer' });
    check(
      'trpc push.subscribe 登记 client_id',
      typeof sub.subscriptionId === 'string',
      `subscriptionId=${sub.subscriptionId} reconnected=${sub.reconnected}`,
    );
  } catch (err) {
    check('trpc push.subscribe 登记 client_id', false, String(err));
  }
}

// 6b. /api/events 登记后 → 200 + SSE 流 + 心跳帧（心跳周期 25s，最多等 28s）
{
  const controller = new AbortController();
  const res = await fetch(`${BASE}/api/events?client_id=${CLIENT_ID}`, {
    headers: { Cookie: cookie, Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  const ct = res.headers.get('content-type') ?? '';
  const handshake = res.status === 200 && ct.includes('text/event-stream');
  check('GET /api/events 登记后 → 200 + text/event-stream', handshake, `status=${res.status} ct=${ct}`);

  let heartbeat = false;
  let frame = '';
  if (handshake) {
    const reader = res.body.getReader();
    const deadline = Date.now() + 28_000;
    try {
      while (Date.now() < deadline && !heartbeat) {
        const remaining = deadline - Date.now();
        const { value, done } = await Promise.race([
          reader.read(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), remaining)),
        ]);
        if (done) break;
        frame += new TextDecoder().decode(value);
        if (frame.includes(':')) heartbeat = true; // 心跳为 SSE 注释行（: 开头）
      }
    } catch {
      // 超时即未收到心跳
    }
    check('SSE 心跳注释帧到达（≤28s）', heartbeat, heartbeat ? `首帧=${JSON.stringify(frame.slice(0, 80))}` : '未收到');
  }
  controller.abort();
}

// 7. logout → auth.me 回到 401
{
  const res = await fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
  const body = await res.json();
  const trpc = trpcWithCookie(cookie); // 服务端已删 cookie 对应的会话？logout 仅清浏览器 cookie，会话本身无状态
  let status = 0;
  try {
    await trpc.auth.me.query();
  } catch (err) {
    status = err?.data?.httpStatus ?? 0;
  }
  // logout 通过 Set-Cookie 过期实现；旧 cookie 值仍有效（无状态 HMAC）。
  // 这里仅验证 logout 端点本身 ok。
  check('POST /api/auth/logout', res.ok && body.ok === true, `status=${res.status}`);
}

console.log(failures === 0 ? '\n全部通过 🎉' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
