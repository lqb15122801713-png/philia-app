/**
 * P6/T6.1 验收实测 §11 C5：三端同时在线观察同一预约的 SSE 同步延迟
 *
 * 流程：独立临时库（migrate+seed）→ 起真实 server（7200）→
 * 客户 + 商家 两条 SSE 连接（push.subscribe + GET /api/events?watch=aid）→
 * 员工依次完成第 1/2/3 步（上传照片 + confirmStep）→
 * 测量「操作完成（confirmStep 响应返回）→ 两端各自收到 step_updated」的延迟，
 * 每端 3 次取最大，断言 ≤ 3000ms（§11.6 同步要求 ≤3s）。
 *
 * 运行（server 目录下）：node node_modules/tsx/dist/cli.mjs scripts/acceptance-c5.mts
 * 结束自动杀 server 子进程并清理临时库；退出码 0=通过。
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import superjson from 'superjson';
import { Jimp } from 'jimp';

const BASE = 'http://localhost:7200';
const tmpDir = mkdtempSync(join(tmpdir(), 'philia-c5-'));
const dbUrl = `file:${join(tmpDir, 'c5.db').replaceAll('\\', '/')}`;
process.env.PHILIA_DB_URL = dbUrl;
const childEnv = { ...process.env, PHILIA_DB_URL: dbUrl, PORT: '7200' };

let server: ChildProcess | undefined;
let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function runNode(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('node', ['node_modules/tsx/dist/cli.mjs', script], {
      env: childEnv,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit=${code}`))));
  });
}

/* ---------- tRPC / 登录辅助（同 demo-live.ts） ---------- */
async function trpcQuery<T>(path: string, cookie: string, input?: unknown): Promise<T> {
  const url =
    input === undefined
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

/* ---------- SSE 监听 ---------- */
interface SseEvent {
  type: string;
  data: string;
  at: number;
}
function openSse(cookie: string, clientId: string, aid: string, sink: SseEvent[]): AbortController {
  const controller = new AbortController();
  void (async () => {
    const res = await fetch(`${BASE}/api/events?client_id=${clientId}&watch=${aid}`, {
      headers: { cookie },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      console.error(`  ✗ SSE 连接失败 ${clientId}: ${res.status}`);
      failures++;
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split('\n\n');
        buf = frames.pop() ?? '';
        for (const frame of frames) {
          const type = frame.match(/^event: (.+)$/m)?.[1]?.trim();
          const data = frame.match(/^data: (.+)$/m)?.[1]?.trim();
          if (type && data) sink.push({ type, data, at: performance.now() });
        }
      }
    } catch {
      /* abort */
    }
  })();
  return controller;
}
async function waitEvent(
  sink: SseEvent[],
  type: string,
  stepKey: string,
  timeoutMs = 10_000,
): Promise<SseEvent | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = sink.find((e) => e.type === type && e.data.includes(`"stepKey":"${stepKey}"`));
    if (hit) return hit;
    await sleep(10);
  }
  return undefined;
}

try {
  /* ---------- 1. 临时库 + 起 server ---------- */
  // 前置：7200 必须空闲，否则健康检查会误连到旧实例（踩过坑：旧 server 残留导致 403）
  try {
    await fetch(`${BASE}/api/health`);
    throw new Error('7200 端口已被占用（存在残留 server），请先杀掉再跑本脚本');
  } catch (e: any) {
    if (e?.message?.includes('已被占用')) throw e;
    /* 连不上 = 端口空闲，符合预期 */
  }

  console.log('[c5] 临时库 migrate + seed …');
  await runNode('src/db/migrate.ts');
  await runNode('src/db/seed.ts');

  server = spawn('node', ['node_modules/tsx/dist/cli.mjs', 'src/index.ts'], {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr?.on('data', (d) => console.error('[server]', String(d).trim()));
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      up = r.ok;
    } catch {
      await sleep(200);
    }
  }
  check('server 已在 7200 就绪', up);

  /* ---------- 2. 造单：下单→确认→派单→扫码核销 ---------- */
  const { db, schema, client } = await import('../src/db/index.js');
  const { eq } = await import('drizzle-orm');
  const users = await db.select().from(schema.users).all();
  const roles = await db.select().from(schema.userRoles).all();
  const roleOf = (r: string) =>
    users.find((u) => roles.some((ur) => ur.userId === u.id && ur.role === r))!;
  const customer = roleOf('customer');
  const owner = roleOf('merchant_owner');
  const staffUser = users.find(
    (u) => u.id === roles.find((r) => r.role === 'staff')!.userId,
  )!;
  const staffRec = await db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.userId, staffUser.id))
    .get();

  const customerCookie = await login(customer.id);
  const ownerCookie = await login(owner.id);
  const staffCookie = await login(staffUser.id);

  const { stores } = await trpcQuery<any>('store.listNearby', customerCookie, {});
  const detail = await trpcQuery<any>('store.getWithServices', customerCookie, {
    storeId: stores[0].id,
  });
  const service = detail.services.find((s: any) => s.type === 'grooming');
  // 选 10:00-16:00 整点槽：任意星期都落在种子排班（工作日 09-18 / 周末 10-19）内
  const slot = detail.slots.find((s: any) => {
    const d = new Date(s.slotStart ?? s);
    return d.getHours() >= 10 && d.getHours() <= 16 && d.getMinutes() === 0;
  });
  if (!slot) throw new Error('无可约槽位');
  const slotStr = (slot as any).slotStart ?? slot;
  const pets = await trpcQuery<any>('pet.list', customerCookie);
  const pet = (pets.pets ?? pets)[0];
  const appt = await trpcMutate<any>('appointment.create', customerCookie, {
    storeId: stores[0].id,
    petId: pet.id,
    serviceId: service.id,
    type: 'grooming',
    scheduledStart: new Date(slotStr),
    paymentMode: 'pay_at_store',
    note: 'C5 验收实测单',
  });
  const aid: string = appt.id ?? appt.appointment?.id;
  await trpcMutate('appointment.confirm', ownerCookie, { appointmentId: aid });
  await trpcMutate('appointment.assign', ownerCookie, {
    appointmentId: aid,
    staffId: staffRec!.id,
  });
  const codeRes = await trpcQuery<any>('appointment.getCode', customerCookie, {
    appointmentId: aid,
  });
  await trpcMutate('appointment.checkin', staffCookie, { qr: codeRes.raw });
  console.log(`[c5] 预约 ${aid} 已核销，进入六步流`);

  /* ---------- 3. 客户 + 商家 SSE（watch=aid） ---------- */
  await trpcMutate('push.subscribe', customerCookie, {
    clientId: 'c5-customer',
    appType: 'customer',
  });
  await trpcMutate('push.subscribe', ownerCookie, {
    clientId: 'c5-merchant',
    appType: 'merchant',
  });
  const custEvents: SseEvent[] = [];
  const merchEvents: SseEvent[] = [];
  const ab1 = openSse(customerCookie, 'c5-customer', aid, custEvents);
  const ab2 = openSse(ownerCookie, 'c5-merchant', aid, merchEvents);
  await sleep(500); // 等两条连接注册稳定

  /* ---------- 4. 员工执行 3 步，逐次测延迟 ---------- */
  const steps = [
    { key: 'disinfection', n: 1 },
    { key: 'precheck', n: 2 },
    { key: 'grooming', n: 3 },
  ];
  const rows: { step: string; custMs: number; merchMs: number; rttMs: number }[] = [];
  for (const step of steps) {
    const photos = [];
    for (let i = 0; i < step.n; i++) {
      const img = new Jimp({ width: 320, height: 240, color: 0xff9c6bff });
      const buf = await img.getBuffer('image/jpeg');
      const fd = new FormData();
      fd.append('file', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'p.jpg');
      fd.append('relDir', `appointment/${aid}/${step.key}`);
      const up = await fetch(`${BASE}/api/upload`, {
        method: 'POST',
        headers: { cookie: staffCookie },
        body: fd,
      });
      if (!up.ok) throw new Error(`upload 失败: ${up.status}`);
      photos.push(await up.json());
    }
    await trpcMutate('serviceStep.addPhotos', staffCookie, {
      appointmentId: aid,
      stepKey: step.key,
      photos: photos.map((p: any) => ({ url: p.url, thumbUrl: p.thumbUrl })),
    });

    const t0 = performance.now();
    await trpcMutate('serviceStep.confirmStep', staffCookie, {
      appointmentId: aid,
      stepKey: step.key,
    });
    const tResp = performance.now(); // 操作完成时刻（服务端已提交）
    const [ce, me] = await Promise.all([
      waitEvent(custEvents, 'step_updated', step.key),
      waitEvent(merchEvents, 'step_updated', step.key),
    ]);
    if (!ce || !me) {
      check(`${step.key} 两端均收到 step_updated`, false, { ce: !!ce, me: !!me });
      continue;
    }
    // 事件先到、响应后返的情况按 0ms 计（同步不劣于操作完成）
    const custMs = Math.max(0, Math.round(ce.at - tResp));
    const merchMs = Math.max(0, Math.round(me.at - tResp));
    rows.push({ step: step.key, custMs, merchMs, rttMs: Math.round(tResp - t0) });
    console.log(
      `  · ${step.key}: 客户端 +${custMs}ms / 商家端 +${merchMs}ms（confirmStep RTT ${Math.round(tResp - t0)}ms）`,
    );
  }
  ab1.abort();
  ab2.abort();

  /* ---------- 5. 断言 ≤3s（各端取 3 次最大值） ---------- */
  const maxCust = Math.max(...rows.map((r) => r.custMs));
  const maxMerch = Math.max(...rows.map((r) => r.merchMs));
  console.log(
    `[c5] 延迟汇总（自操作完成计）：客户端 max=${maxCust}ms ${rows.map((r) => r.custMs).join('/')}；商家端 max=${maxMerch}ms ${rows.map((r) => r.merchMs).join('/')}`,
  );
  check('C5：客户端 3 次最大延迟 ≤ 3000ms', rows.length === 3 && maxCust <= 3000, maxCust);
  check('C5：商家端 3 次最大延迟 ≤ 3000ms', rows.length === 3 && maxMerch <= 3000, maxMerch);

  client.close();
} catch (err) {
  failures++;
  console.error('\n[c5] 未捕获异常：', err);
} finally {
  if (server?.pid) {
    if (process.platform === 'win32') {
      // Windows 下 tsx 会派生孙进程，必须整棵树杀掉（taskkill /T）
      spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      await sleep(800);
    } else {
      server.kill();
      await Promise.race([
        new Promise((r) => server!.once('exit', r)),
        sleep(3000).then(() => server!.kill('SIGKILL')),
      ]);
    }
  }
  // 确认端口无残留
  let portFree = false;
  for (let i = 0; i < 20 && !portFree; i++) {
    try {
      await fetch(`${BASE}/api/health`);
      await sleep(250);
    } catch {
      portFree = true;
    }
  }
  check('验收结束：7200 端口无残留监听', portFree);
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch (e) {
    console.warn(`[c5] 临时目录清理失败（不影响结果，可手工删）: ${tmpDir}`);
  }
}

console.log(failures === 0 ? '\nC5 验收实测通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
