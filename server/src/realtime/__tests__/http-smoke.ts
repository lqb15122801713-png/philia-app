/**
 * T1.4 SSE 端点 HTTP 级冒烟（npx tsx src/realtime/__tests__/http-smoke.ts）
 *
 * 起真实 @hono/node-server（随机端口），验证 src/routes/events.ts 的 GET /api/events：
 * - 未注入会话 → 401；client_id 未登记 → 403；watch 无归属 → 403
 * - 正常连接：Content-Type: text/event-stream，实时事件按 SSE 帧（id/event/data）到达
 * - watch=appt 后 appointment 频道事件可达
 * - 断开后 hub 退订且 push_subscriptions.disconnected_at 回写
 *
 * 会话中间件（T1.2）未接入前，测试用中间件直接注入 sessionUser。
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-sse-http-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'http-smoke.db').replaceAll('\\', '/')}`;

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(
  cond: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return true;
    await sleep(15);
  }
  return cond();
}

let server: { close(): void } | undefined;
try {
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { serve } = await import('@hono/node-server');
  const { Hono } = await import('hono');
  const { db, schema, client } = await import('../../db');
  const { eq } = await import('drizzle-orm');
  const { EventType } = await import('../events');
  type EventEnvelope = import('../events').EventEnvelope;
  const bus = await import('../bus');
  const hub = await import('../hub');
  const { eventsRoute } = await import('../../routes/events');
  type SessionUserLike = import('../../routes/events').SessionUserLike;

  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url)),
  });

  /* ---------- 种子 ---------- */
  const CUSTOMER = 'u-http-cust';
  const OWNER = 'u-http-owner';
  const STORE = 'store-http';
  const APPT = 'appt-http';
  await db.insert(schema.users).values([
    { id: CUSTOMER, kimiId: 'k-http-cust', nickname: 'HTTP 客户' },
    { id: OWNER, kimiId: 'k-http-owner', nickname: 'HTTP 店主' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: CUSTOMER, role: 'customer' },
    { userId: OWNER, role: 'merchant_owner' },
  ]);
  await db.insert(schema.stores).values({ id: STORE, ownerId: OWNER, name: 'HTTP 测试店' });
  await db
    .insert(schema.pets)
    .values({ id: 'pet-http', ownerId: CUSTOMER, name: '咪咪', species: 'cat' });
  await db.insert(schema.services).values({
    id: 'svc-http',
    storeId: STORE,
    type: 'grooming',
    name: '洗护',
    priceFen: 9900,
  });
  const start = new Date(Date.now() + 3600_000);
  await db.insert(schema.appointments).values({
    id: APPT,
    code: '112233',
    customerId: CUSTOMER,
    storeId: STORE,
    petId: 'pet-http',
    serviceId: 'svc-http',
    type: 'grooming',
    scheduledStart: start,
    scheduledEnd: new Date(start.getTime() + 3600_000),
    priceFen: 9900,
  });

  const sessionUser: SessionUserLike = {
    id: CUSTOMER,
    nickname: 'HTTP 客户',
    roles: ['customer'],
  };

  // 测试用会话中间件：?anon=1 时不注入（模拟未登录）
  const app = new Hono<{ Variables: { sessionUser?: SessionUserLike | null } }>();
  app.use('/api/*', async (c, next) => {
    if (c.req.query('anon') !== '1') c.set('sessionUser', sessionUser);
    await next();
  });
  app.route('/api/events', eventsRoute);

  const srv = serve({ fetch: app.fetch, port: 0 });
  server = srv;
  await new Promise((r) => setImmediate(r));
  const address = srv.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  check('HTTP 服务已启动（随机端口）', port > 0, address);
  const base = `http://127.0.0.1:${port}/api/events`;

  /* ---------- 负例 ---------- */
  const r401 = await fetch(`${base}?anon=1&client_id=cli-http`);
  check('未登录 → 401', r401.status === 401, r401.status);

  const r403a = await fetch(`${base}?client_id=cli-unknown`);
  check('client_id 未登记 → 403', r403a.status === 403, r403a.status);

  // 登记 client_id（走 push router，顺带再验一遍登记链路）
  const { pushRouter } = await import('../../routers/push');
  const caller = pushRouter.createCaller({ db, user: sessionUser });
  await caller.subscribe({ clientId: 'cli-http', appType: 'customer' });

  const r403b = await fetch(`${base}?client_id=cli-http&watch=appt-not-mine`);
  check('watch 无归属预约 → 403', r403b.status === 403, r403b.status);

  /* ---------- 正例：SSE 连接 + 实时事件 + watch ---------- */
  const controller = new AbortController();
  const res = await fetch(`${base}?client_id=cli-http&watch=${APPT}`, {
    signal: controller.signal,
  });
  check('SSE 连接建立 200', res.status === 200, res.status);
  check(
    'Content-Type 为 text/event-stream',
    (res.headers.get('content-type') ?? '').includes('text/event-stream'),
    res.headers.get('content-type'),
  );
  check('连接已挂入 Hub（user + appointment 频道）', hub.connectionCount() === 1, hub.connectionCount());

  // 连接后分别向 user 频道与 appointment 频道发事件
  const received: string[] = [];
  const readTask = (async () => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received.push(decoder.decode(value, { stream: true }));
      }
    } catch {
      /* 客户端主动 abort */
    }
  })();

  await sleep(100); // 等连接注册稳定
  const idUser = await bus.emitEvent(db, `user:${CUSTOMER}`, EventType.AppointmentConfirmed, {
    appointmentId: APPT,
    petName: '咪咪',
  });
  const idAppt = await bus.emitEvent(db, `appointment:${APPT}`, EventType.StepUpdated, {
    appointmentId: APPT,
    stepKey: 'grooming',
    status: 'done',
    petName: '咪咪',
  });
  bus.broadcastNow(idUser);
  bus.broadcastNow(idAppt);

  const gotBoth = await waitFor(
    () => received.join('').includes(idUser) && received.join('').includes(idAppt),
  );
  const frames = received.join('');
  check('SSE 帧到达：user 频道 + watch 的 appointment 频道事件', gotBoth, frames.slice(0, 400));
  check(
    '帧格式含 id:/event:/data: 且信封字段齐全',
    frames.includes(`id: ${idUser}`) &&
      frames.includes(`event: ${EventType.AppointmentConfirmed}`) &&
      frames.includes('"channel":"appointment:appt-http"') &&
      frames.includes('"ts":'),
    frames.slice(0, 400),
  );

  /* ---------- 断线续传（HTTP 级）：Last-Event-ID 补发 ---------- */
  // 先离线制造一条漏发事件
  controller.abort();
  await readTask;
  await waitFor(() => hub.connectionCount() === 0);
  const idMissed = await bus.emitEvent(db, `user:${CUSTOMER}`, EventType.AppointmentCancelled, {
    appointmentId: APPT,
    petName: '咪咪',
  });
  bus.broadcastNow(idMissed);
  await sleep(50);

  // 带 Last-Event-ID=idAppt 重连：应补发 idMissed
  const controller2 = new AbortController();
  const res2 = await fetch(`${base}?client_id=cli-http`, {
    headers: { 'Last-Event-ID': idAppt },
    signal: controller2.signal,
  });
  check('重连 200', res2.status === 200, res2.status);
  const replayed: string[] = [];
  const readTask2 = (async () => {
    const reader = res2.body!.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        replayed.push(decoder.decode(value, { stream: true }));
      }
    } catch {
      /* abort */
    }
  })();
  const gotReplay = await waitFor(() => replayed.join('').includes(idMissed));
  check(
    'Last-Event-ID 续传：漏发事件按序补发（且不重复补发已收到的）',
    gotReplay && !replayed.join('').includes(`id:${idUser}`),
    replayed.join('').slice(0, 300),
  );

  /* ---------- 断开回写 ---------- */
  controller2.abort();
  await readTask2;
  await waitFor(() => hub.connectionCount() === 0);
  check('两次断开后 Hub 无残留连接', hub.connectionCount() === 0);
  const subWritten = await waitFor(async () => {
    const row = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.clientId, 'cli-http'))
      .get();
    return row?.disconnectedAt instanceof Date;
  });
  const subRow = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.clientId, 'cli-http'))
    .get();
  check('断开后 disconnected_at 与 last_event_id 回写', subWritten && !!subRow?.lastEventId, {
    disconnectedAt: subRow?.disconnectedAt,
    lastEventId: subRow?.lastEventId,
  });

  client.close();
} catch (err) {
  failures++;
  console.error('\n[http-smoke] 未捕获异常：', err);
} finally {
  try {
    server?.close();
  } catch {
    /* ignore */
  }
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch (e) {
    console.warn(`[http-smoke] 临时目录清理失败（不影响验证结果）: ${tmpDir}`, e);
  }
}

console.log(failures === 0 ? '\nHTTP 级冒烟全部通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
