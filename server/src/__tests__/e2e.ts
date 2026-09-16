/**
 * T1.6 全链路验收（端到端，真实 HTTP + SSE）
 *
 * 运行：node node_modules/tsx/dist/cli.mjs src/__tests__/e2e.ts
 *
 * 隔离策略：全程使用独立临时库（PHILIA_DB_URL 指向 OS 临时目录），先迁移再种子，
 * 种子库 data/philia.db 保持原样（验收前后比对 size+mtime 佐证）；验收结束杀 server、
 * 删临时库与本次上传的图片目录。
 *
 * 链路：
 *   1. POST /api/auth/dev-login 三角色各登一次（客户 / 商家 owner / 员工），拿 cookie
 *   2. 客户：store.listNearby → store.getWithServices（服务 + 可约槽位）→ appointment.create
 *      （create 前已完成 push.subscribe；create 后立刻以 watch=<aid> 建立 SSE 流后台读）
 *   3. 商家：appointment.confirm（批次 S4：create 已落 confirmed，confirm 幂等成功零副作用）
 *      → S4 任务 C：create 自动派单（负荷并列→先入职阿强）→ 商家 assign 改派丽丽（不回归）
 *   4. 客户：appointment.getCode → 员工（groomer 阿强）核销被拒（批次 S1 双角色断言）
 *      → 员工（frontdesk）：appointment.checkin（二维码原文；S1-R1 断言①原指派丽丽保留）
 *      → 未指派单前台核销（S1-R1 断言② staff_id 仍 NULL + 无 assigned 事件）
 *   5. 美容师（丽丽，改派后的被指派人）：POST /api/upload（jimp 现造 JPEG）→ serviceStep.addPhotos 登记
 *      → 逐步 confirmStep 走完六步（张数按 min：1/2/3/2/2/0，before_after 需 before+after 各 1）
 *   6. 校验预约 completed；商家 markPaid；客户 review
 *   7. SSE 断言：客户流依次收到 appointment.confirmed / assigned（自动派单）/ assigned（改派）/
 *      checkedin / step_updated×6 / completed（允许心跳注释帧，按 id 去重）；event_outbox 事件齐全
 *   8. 权限负例：客户 cookie 调 store.upsertService（merchantProcedure）→ 403；
 *      未登录调 appointment.create → 401
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import superjson from 'superjson';

/* ------------------------------------------------------------------ */
/* 环境：临时库 + 端口                                                    */
/* ------------------------------------------------------------------ */

const SERVER_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSX_CLI = join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SEED_DB_FILE = join(SERVER_ROOT, 'data', 'philia.db');
const UPLOAD_APPT_ROOT = join(SERVER_ROOT, 'uploads', 'appointment');

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-e2e-'));
const DB_URL = `file:${join(tmpDir, 'e2e.db').replaceAll('\\', '/')}`;
const CLIENT_ERROR_LOG = join(tmpDir, 'client-error.log');
const PORT = 7200;
const BASE = `http://127.0.0.1:${PORT}`;

process.env.PHILIA_DB_URL = DB_URL; // 须先于任何 ../db import 生效

/* ------------------------------------------------------------------ */
/* 断言工具                                                              */
/* ------------------------------------------------------------------ */

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra)?.slice(0, 600));
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean | Promise<boolean>, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return true;
    await sleep(50);
  }
  return cond();
}

/** 子进程执行（迁移/种子），失败时带出全部输出 */
function runProc(args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(process.execPath, args, { cwd: SERVER_ROOT, env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', rejectP);
    child.on('exit', (code) => {
      if (code === 0) resolveP(out);
      else rejectP(new Error(`子进程退出码 ${code}\n${out}`));
    });
  });
}

/* ------------------------------------------------------------------ */
/* HTTP / tRPC-over-HTTP 客户端（superjson 与服务端 transformer 对齐）      */
/* ------------------------------------------------------------------ */

class TrpcHttpError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface TrpcCallOpts {
  cookie?: string;
  input?: unknown;
}

async function trpcQuery<T>(path: string, opts: TrpcCallOpts = {}): Promise<T> {
  const url =
    opts.input === undefined
      ? `${BASE}/trpc/${path}`
      : `${BASE}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(superjson.serialize(opts.input)))}`;
  const res = await fetch(url, { headers: opts.cookie ? { cookie: opts.cookie } : {} });
  return unwrap<T>(res, await res.json());
}

async function trpcMutate<T>(path: string, opts: TrpcCallOpts = {}): Promise<T> {
  const res = await fetch(`${BASE}/trpc/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: JSON.stringify(superjson.serialize(opts.input ?? null)),
  });
  return unwrap<T>(res, await res.json());
}

function unwrap<T>(res: Response, envelope: any): T {
  if (envelope?.error) {
    // tRPC 配 transformer 后错误体可能被 superjson 包裹为 error.json；兼容两种形态
    const err = envelope.error?.json ?? envelope.error;
    const code = err?.data?.code ?? 'UNKNOWN';
    throw new TrpcHttpError(res.status, code, err?.message ?? 'tRPC error');
  }
  return superjson.deserialize(envelope?.result?.data) as T;
}

/** 解析 dev-login 的 Set-Cookie，提取 philia_session=<value> */
function sessionCookieOf(res: Response): string {
  const setCookies = res.headers.getSetCookie();
  const hit = setCookies.find((s) => s.startsWith('philia_session='));
  if (!hit) throw new Error(`未拿到会话 cookie: ${JSON.stringify(setCookies)}`);
  return hit.split(';')[0]!;
}

/* ------------------------------------------------------------------ */
/* SSE 后台读流                                                           */
/* ------------------------------------------------------------------ */

interface SseFrame {
  id: string;
  event: string;
  data: string;
}

/** 后台读取 SSE 流，事件帧推入 sink（心跳注释帧自动忽略）；返回停止函数 */
function startSseReader(res: Response, sink: SseFrame[]): { stopped: Promise<void> } {
  const stopped = (async () => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (raw.startsWith(':') || raw.trim() === '') continue; // 心跳注释帧 / 空帧
          const frame: SseFrame = { id: '', event: '', data: '' };
          for (const line of raw.split('\n')) {
            if (line.startsWith('id:')) frame.id = line.slice(3).trim();
            else if (line.startsWith('event:')) frame.event = line.slice(6).trim();
            else if (line.startsWith('data:')) frame.data += (frame.data ? '\n' : '') + line.slice(5).trim();
          }
          sink.push(frame);
        }
      }
    } catch {
      /* 客户端主动 abort */
    }
  })();
  return { stopped };
}

/* ------------------------------------------------------------------ */
/* 主流程                                                                */
/* ------------------------------------------------------------------ */

let server: ChildProcess | undefined;
let serverLog = '';
let createdAid = ''; // main() 内赋值，cleanup 精准删除本次上传目录
const seedStatBefore = existsSync(SEED_DB_FILE) ? statSync(SEED_DB_FILE) : null;

async function main(): Promise<void> {
  /* ---------- 0. 前置：端口须空闲；临时库迁移 + 种子 ---------- */
  const portBusy = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(800) })
    .then(() => true)
    .catch(() => false);
  if (portBusy) throw new Error(`端口 ${PORT} 已被占用，请先释放再跑验收`);

  console.log('[e2e] 临时库迁移 + 种子…');
  await runProc([TSX_CLI, 'src/db/migrate.ts'], { PHILIA_DB_URL: DB_URL });
  await runProc([TSX_CLI, 'src/db/seed.ts'], { PHILIA_DB_URL: DB_URL });
  check('临时库迁移 + 种子完成', true);

  // e2e 进程自身的只读连接（查种子用户 ID / event_outbox 断言）
  const { db, schema, client } = await import('../db');
  const { eq } = await import('drizzle-orm');

  const seedUsers = await db.select().from(schema.users);
  const byKimi = (kimiId: string) => seedUsers.find((u) => u.kimiId === kimiId);
  const customerUser = byKimi('seed_kimi_customer');
  const ownerUser = byKimi('seed_kimi_owner');
  const staffUser = byKimi('seed_kimi_staff1'); // 小美：批次 S1 起为 frontdesk（核销执行人）
  const groomerUser = byKimi('seed_kimi_staff2'); // 阿强：groomer（核销应被拒）
  check('种子用户齐全（customer/owner/staff1/staff2）', !!(customerUser && ownerUser && staffUser && groomerUser));
  if (!customerUser || !ownerUser || !staffUser || !groomerUser) throw new Error('种子用户缺失');

  /* ---------- 1. 启动 server 子进程（7200） ---------- */
  server = spawn(process.execPath, [TSX_CLI, 'src/index.ts'], {
    cwd: SERVER_ROOT,
    env: { ...process.env, PHILIA_DB_URL: DB_URL, PHILIA_CLIENT_ERROR_LOG: CLIENT_ERROR_LOG, PORT: String(PORT) },
  });
  server.stdout?.on('data', (d) => (serverLog += d));
  server.stderr?.on('data', (d) => (serverLog += d));

  const healthy = await waitFor(async () => {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(800) });
      const j = (await r.json()) as { ok?: boolean; ts?: number };
      return r.ok && j.ok === true && typeof j.ts === 'number';
    } catch {
      return false;
    }
  }, 30_000);
  check('server 启动且 GET /api/health 返回 {ok:true, ts}', healthy, serverLog.slice(-400));
  if (!healthy) throw new Error('server 未就绪');

  /* ---------- 2. 三角色 dev-login ---------- */
  async function devLogin(userId: string): Promise<string> {
    const res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const body = (await res.json()) as { ok?: boolean; user?: { roles?: string[] } };
    if (!res.ok || !body.ok) throw new Error(`dev-login 失败: ${res.status} ${JSON.stringify(body)}`);
    return sessionCookieOf(res);
  }
  const customerCookie = await devLogin(customerUser!.id);
  const ownerCookie = await devLogin(ownerUser!.id);
  const staffCookie = await devLogin(staffUser!.id);
  const groomerCookie = await devLogin(groomerUser!.id);
  check('三角色 dev-login 均签发会话 cookie', !!(customerCookie && ownerCookie && staffCookie && groomerCookie));

  const me = await trpcQuery<{ roles: string[]; store: { id: string } | null }>('auth.me', {
    cookie: ownerCookie,
  });
  check('auth.me（商家）角色与门店绑定正确', me.roles.includes('merchant_owner') && !!me.store, me);
  const storeId = me.store!.id;

  /* ---------- 3. create 前：客户 push.subscribe（SSE 前置登记） ---------- */
  const CLIENT_ID = 'e2e-customer-1';
  const sub = await trpcMutate<{ subscriptionId: string }>('push.subscribe', {
    cookie: customerCookie,
    input: { clientId: CLIENT_ID, appType: 'customer' },
  });
  check('push.subscribe 登记成功（create 前完成）', !!sub.subscriptionId, sub);

  /* ---------- 4. 客户：找店 → 服务与槽位 → 下单 ---------- */
  const pets = await trpcQuery<Array<{ id: string; name: string }>>('pet.list', {
    cookie: customerCookie,
  });
  const petId = pets[0]?.id;
  check('pet.list 返回客户宠物', !!petId, pets);
  if (!petId) throw new Error('无宠物');

  const nearby = await trpcQuery<{ stores: Array<{ id: string; name: string }> }>('store.listNearby', {
    cookie: customerCookie,
    input: { lat: 30.27, lng: 120.15 },
  });
  const store = nearby.stores.find((s) => s.id === storeId) ?? nearby.stores[0];
  check('store.listNearby 返回种子门店', !!store, nearby.stores.length);
  if (!store) throw new Error('无门店');

  const cat1 = await trpcQuery<{
    services: Array<{ id: string; name: string; type: string; durationMin: number | null }>;
    slots: unknown[];
  }>('store.getWithServices', { cookie: customerCookie, input: { storeId: store.id } });
  const service = cat1.services.find((s) => s.type === 'grooming' && (s.durationMin ?? 999) <= 90);
  check('getWithServices 返回 grooming 服务项', !!service, cat1.services.length);
  if (!service) throw new Error('无 grooming 服务');

  const cat2 = await trpcQuery<{ slots: Array<{ slotStart: Date; bookedCount: number; capacity: number }> }>(
    'store.getWithServices',
    { cookie: customerCookie, input: { storeId: store.id, serviceId: service.id } },
  );
  // 选 10:00-16:00 之间的槽：任意星期都落在种子排班（工作日 09-18 / 周末 10-19）与营业时间内
  // B8-B4：时段墙钟按门店规范时区（固定 +8，与服务端 storeWallclock 同帧）读取，
  // 否则 UTC 宿主下会错选到门店晚间槽、排班校验正确拒绝
  const slot = cat2.slots.find((s) => {
    const shifted = new Date(s.slotStart.getTime() + 8 * 3600 * 1000);
    const h = shifted.getUTCHours();
    return h >= 10 && h <= 16 && shifted.getUTCMinutes() === 0;
  });
  check('getWithServices 返回可约槽位（10:00-16:00 整点）', !!slot, cat2.slots.length);
  if (!slot) throw new Error('无可约槽位');

  const appt = await trpcMutate<{ id: string; status: string; code: string; staffId: string | null; assignSource: string | null }>('appointment.create', {
    cookie: customerCookie,
    input: {
      storeId: store.id,
      petId,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: slot.slotStart,
      paymentMode: 'pay_at_store',
      note: 'e2e 验收单',
    },
  });
  // 批次 S4（任务 A）：免商家确认——create 落库即 confirmed（原断言 pending 已退役）
  check('appointment.create 成功（S4：落库即 confirmed）', appt.status === 'confirmed' && !!appt.id, appt);
  const aid = appt.id;
  createdAid = aid;

  /* ---------- 5. 建立客户 SSE 流（watch=aid，后台读） ----------
   * S4 适配：confirmed 事件随 create 即发（早于 SSE 建连），以 last_event_id=0
   * 触发服务端 replayMissed 补发，事件序列断言口径不变 */
  const sseController = new AbortController();
  const sseRes = await fetch(`${BASE}/api/events?client_id=${CLIENT_ID}&watch=${aid}&last_event_id=0`, {
    headers: { cookie: customerCookie },
    signal: sseController.signal,
  });
  check('GET /api/events 建立 SSE（200 + text/event-stream）',
    sseRes.status === 200 && (sseRes.headers.get('content-type') ?? '').includes('text/event-stream'),
    sseRes.status);
  const frames: SseFrame[] = [];
  startSseReader(sseRes, frames);
  await sleep(300); // 等连接注册进 Hub

  /* ---------- 6. 商家：确认（S4 幂等）→ 派单 ----------
   * S4（任务 C）：create 已自动派单（负荷 0/0 并列 → 先入职的阿强，assignSource=auto）；
   * 商家 assign 改派丽丽（改派不回归）——后续步骤由被指派人丽丽执行，
   * 验证前台（小美）核销豁免归属 + 原指派（丽丽）保留（S1-R1 断言①） */
  const staffList = await trpcQuery<{ staff: Array<{ id: string; name: string; role: string; skills: string[] | null }> }>(
    'store.staffList',
    { cookie: ownerCookie },
  );
  const staffRow = staffList.staff.find((s) => s.name === '阿强' && s.role === 'groomer');
  const staffRow2 = staffList.staff.find((s) => s.name === '丽丽' && s.role === 'groomer');
  check('store.staffList 找到承接美容师（阿强/丽丽=groomer）', !!staffRow && !!staffRow2, staffList.staff.map((s) => s.name));
  if (!staffRow || !staffRow2) throw new Error('无美容师');

  // S4（任务 C）：未指定 staffId → 自动派单负荷最轻（0/0 并列按 createdAt 先入职 → 阿强）
  check(
    'S4：create 自动派单（staff_id=阿强，assignSource=auto）',
    appt.staffId === staffRow.id && appt.assignSource === 'auto',
    { staffId: appt.staffId, expect: staffRow.id },
  );

  // 批次 S4（任务 A）：create 已落 confirmed——confirm 对该单 = 幂等成功（零副作用），
  // 连调两次均返回 confirmed 且不重复发事件（防旧链路重复调用断裂）
  const confirmed = await trpcMutate<{ status: string; updatedAt: Date }>('appointment.confirm', {
    cookie: ownerCookie,
    input: { appointmentId: aid },
  });
  const confirmed2 = await trpcMutate<{ status: string; updatedAt: Date }>('appointment.confirm', {
    cookie: ownerCookie,
    input: { appointmentId: aid },
  });
  check(
    'appointment.confirm 幂等：confirmed 单连调两次均成功且 updatedAt 不变（零副作用）',
    confirmed.status === 'confirmed' &&
      confirmed2.status === 'confirmed' &&
      new Date(confirmed.updatedAt).getTime() === new Date(confirmed2.updatedAt).getTime(),
    { s1: confirmed.status, s2: confirmed2.status },
  );

  // S4（任务 D）：商家保留改派——assign 改派丽丽（不回归）
  const assigned = await trpcMutate<{ status: string; staffId: string | null }>('appointment.assign', {
    cookie: ownerCookie,
    input: { appointmentId: aid, staffId: staffRow2.id },
  });
  check('appointment.assign 改派成功（阿强 → 丽丽）', assigned.staffId === staffRow2.id, assigned);
  const liliCookie = await devLogin(byKimi('seed_kimi_staff3')!.id); // 丽丽：改派后的被指派人

  /* ---------- 7. 客户出码 → 员工扫码核销 ---------- */
  const codeRes = await trpcQuery<{ raw: string; code: string }>('appointment.getCode', {
    cookie: customerCookie,
    input: { appointmentId: aid },
  });
  check('appointment.getCode 返回二维码原文与人工码', !!codeRes.raw && /^\{.*\}$/.test(codeRes.raw), codeRes.code);

  /* ---------- 7a. 批次 S1（任务 B）双角色权限断言：groomer 核销被拒 ---------- */
  const groomerQr = await trpcMutate('appointment.checkin', {
    cookie: groomerCookie,
    input: { qr: codeRes.raw },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：groomer 扫码核销 → 403 FORBIDDEN「核销需前台账号操作」',
    groomerQr instanceof TrpcHttpError &&
      groomerQr.httpStatus === 403 &&
      groomerQr.code === 'FORBIDDEN' &&
      groomerQr.message.includes('核销需前台账号操作'),
    groomerQr && { status: groomerQr.httpStatus, code: groomerQr.code, message: groomerQr.message },
  );
  const groomerCode = await trpcMutate('appointment.checkin', {
    cookie: groomerCookie,
    input: { code: codeRes.code },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：groomer 人工码核销 → 403 FORBIDDEN「核销需前台账号操作」',
    groomerCode instanceof TrpcHttpError &&
      groomerCode.httpStatus === 403 &&
      groomerCode.code === 'FORBIDDEN' &&
      groomerCode.message.includes('核销需前台账号操作'),
    groomerCode && { status: groomerCode.httpStatus, code: groomerCode.code, message: groomerCode.message },
  );
  // boarding.checkinStay 同口径：groomer → FORBIDDEN（角色判定先于预约查询， dummy id 也被拒）
  const groomerStay = await trpcMutate('boarding.checkinStay', {
    cookie: groomerCookie,
    input: { appointmentId: 'appt-not-exist', checkinWeightKg: 4.2, belongings: [] },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：groomer 入住登记（checkinStay）→ 403 FORBIDDEN「核销需前台账号操作」',
    groomerStay instanceof TrpcHttpError &&
      groomerStay.httpStatus === 403 &&
      groomerStay.code === 'FORBIDDEN' &&
      groomerStay.message.includes('核销需前台账号操作'),
    groomerStay && { status: groomerStay.httpStatus, code: groomerStay.code, message: groomerStay.message },
  );
  // 前台过角色校验：同一 dummy id 不再吃 FORBIDDEN（落后续预约查询报错）
  const frontdeskStay = await trpcMutate('boarding.checkinStay', {
    cookie: staffCookie,
    input: { appointmentId: 'appt-not-exist', checkinWeightKg: 4.2, belongings: [] },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：frontdesk 入住登记越过角色校验（dummy id 报非 FORBIDDEN 业务错）',
    frontdeskStay instanceof TrpcHttpError && frontdeskStay.code !== 'FORBIDDEN',
    frontdeskStay && { status: frontdeskStay.httpStatus, code: frontdeskStay.code, message: frontdeskStay.message },
  );

  /* ---------- 7b. 前台扫码核销（全链路）+ S1-R1 断言①：豁免归属、原指派保留 ---------- */
  const checkin = await trpcMutate<{
    appointment: { status: string; staffId: string | null };
    steps: Array<{ stepKey: string; status: string }>;
    nextRoute: string;
    idempotent: boolean;
    claimed: boolean;
  }>('appointment.checkin', { cookie: staffCookie, input: { qr: codeRes.raw } });
  check(
    'appointment.checkin（frontdesk 二维码原文）→ in_service + 六步初始化',
    checkin.appointment.status === 'in_service' && checkin.steps.length === 6 &&
      checkin.steps[0]!.status === 'active' && checkin.steps.slice(1).every((s) => s.status === 'locked'),
    checkin,
  );
  check(
    'S1-R1 断言①：已改派给丽丽的单被小美（frontdesk）核销成功 → staff_id 仍为丽丽（原指派保留，claimed=false）',
    checkin.appointment.staffId === staffRow2.id && checkin.claimed === false,
    { staffId: checkin.appointment.staffId, expect: staffRow2.id, claimed: checkin.claimed },
  );

  /* ---------- 8. 美容师（丽丽，改派后的被指派人）：上传 → 登记照片 → 逐步确认 ---------- */
  const { Jimp } = await import('jimp');
  async function uploadOne(stepKey: string): Promise<{ url: string; thumbUrl: string }> {
    const img = new Jimp({ width: 320, height: 240, color: 0x66aaffff });
    const buf = await img.getBuffer('image/jpeg');
    const fd = new FormData();
    fd.append('file', new File([buf], `e2e-${stepKey}.jpg`, { type: 'image/jpeg' }));
    fd.append('relDir', `appointment/${aid}/${stepKey}`);
    const res = await fetch(`${BASE}/api/upload`, {
      method: 'POST',
      headers: { cookie: liliCookie }, // S4：改派后由丽丽执行
      body: fd,
    });
    const body = (await res.json()) as { url?: string; thumbUrl?: string; message?: string };
    if (!res.ok || !body.url) throw new Error(`上传失败(${stepKey}): ${res.status} ${JSON.stringify(body)}`);
    return { url: body.url, thumbUrl: body.thumbUrl ?? body.url };
  }

  const stepPlan: Array<{ key: string; count: number; tags?: Array<'before' | 'after'> }> = [
    { key: 'disinfection', count: 1 },
    { key: 'precheck', count: 2 },
    { key: 'grooming', count: 3 },
    { key: 'detail', count: 2 },
    { key: 'before_after', count: 2, tags: ['before', 'after'] },
    { key: 'confirm', count: 0 },
  ];

  let firstUploadUrl = '';
  for (const plan of stepPlan) {
    if (plan.count > 0) {
      const up = await uploadOne(plan.key);
      if (!firstUploadUrl) firstUploadUrl = up.url;
      const added = await trpcMutate<{ added: number; totalValid: number }>('serviceStep.addPhotos', {
        cookie: liliCookie, // S4：改派后由丽丽执行
        input: {
          appointmentId: aid,
          stepKey: plan.key,
          photos: Array.from({ length: plan.count }, (_, i) => ({
            url: up.url,
            thumbUrl: up.thumbUrl,
            tag: plan.tags?.[i] ?? 'normal',
          })),
        },
      });
      check(`serviceStep.addPhotos(${plan.key} ×${plan.count})`, added.totalValid === plan.count, added);
    }
    const done = await trpcMutate<{ nextStepKey: string | null; appointmentCompleted: boolean }>(
      'serviceStep.confirmStep',
      { cookie: liliCookie, input: { appointmentId: aid, stepKey: plan.key } }, // S4：改派后由丽丽执行
    );
    check(
      `serviceStep.confirmStep(${plan.key})`,
      done.appointmentCompleted === (plan.key === 'confirm'),
      done,
    );
  }

  // 顺带验证签名图片可访问（imagesRoute 全链路；阿强上传，前台小美读取验证跨角色签名访问）
  const imgRes = await fetch(`${BASE}${firstUploadUrl}`, { headers: { cookie: staffCookie } });
  check('GET /api/img/* 签名 URL 可访问（200 image/jpeg）',
    imgRes.status === 200 && (imgRes.headers.get('content-type') ?? '').includes('image/jpeg'),
    imgRes.status);
  await imgRes.arrayBuffer().catch(() => undefined);

  /* ---------- 9. 完成 → 收款 → 评价 ---------- */
  const detail = await trpcQuery<{ appointment: { status: string; completedAt: Date | null } }>(
    'appointment.get',
    { cookie: customerCookie, input: { appointmentId: aid } },
  );
  check('预约已 completed（含 completed_at）',
    detail.appointment.status === 'completed' && detail.appointment.completedAt instanceof Date,
    detail.appointment.status);

  const paid = await trpcMutate<{ appointment: { paidAt: Date | null; paidFen: number | null } }>(
    'appointment.markPaid',
    { cookie: ownerCookie, input: { appointmentId: aid } },
  );
  check('appointment.markPaid 收款登记', paid.appointment.paidAt instanceof Date, paid);

  const reviewed = await trpcMutate<{ rating: number | null }>('appointment.review', {
    cookie: customerCookie,
    input: { appointmentId: aid, rating: 5, review: 'e2e 验收好评' },
  });
  check('appointment.review 评价成功', reviewed.rating === 5, reviewed);

  /* ---------- 10. SSE 事件序列断言 ---------- */
  const gotCompleted = await waitFor(
    () => frames.some((f) => f.event === 'appointment.completed'),
    10_000,
  );
  sseController.abort();

  /* ---------- 10b. S1-R1 断言②：未指派单前台核销 → staff_id 仍 NULL + 无 assigned 事件 ----------
   * 置于 SSE abort 之后：第二单（aid2）与主单同客户，其 confirmed/checkedin 会经
   * user 频道进入 SSE 帧，若放在第 10 节前会污染序列断言（首轮实测多拉一条 confirmed）。 */
  const slot2 = cat2.slots.find((s) => {
    if (s.slotStart.getTime() === slot.slotStart.getTime()) return false;
    const shifted = new Date(s.slotStart.getTime() + 8 * 3600 * 1000);
    const h = shifted.getUTCHours();
    return h >= 10 && h <= 16 && shifted.getUTCMinutes() === 0;
  });
  check('找到第二个可约槽（未指派单用）', !!slot2);
  if (!slot2) throw new Error('无第二槽位');
  const appt2 = await trpcMutate<{ id: string; status: string; code: string }>('appointment.create', {
    cookie: customerCookie,
    input: {
      storeId: store.id,
      petId,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: slot2.slotStart,
      paymentMode: 'pay_at_store',
      note: 'e2e S1-R1 未指派核销单',
    },
  });
  const aid2 = appt2.id;
  await trpcMutate('appointment.confirm', { cookie: ownerCookie, input: { appointmentId: aid2 } });
  // S4（任务 C）：aid2 下单已被自动派单——断言②需要「真未指派单」，此处直清 staff_id/
  // assign_source 模拟（其自动派单 assigned 事件已发，下方按「核销不新增」口径断言）
  await db
    .update(schema.appointments)
    .set({ staffId: null, assignSource: null, updatedAt: new Date() })
    .where(eq(schema.appointments.id, aid2));
  const codeRes2 = await trpcQuery<{ raw: string; code: string }>('appointment.getCode', {
    cookie: customerCookie,
    input: { appointmentId: aid2 },
  });
  const assignedBefore = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'appointment.assigned' && (r.payload as Record<string, unknown>)?.appointmentId === aid2,
  ).length;
  const checkin2 = await trpcMutate<{
    appointment: { status: string; staffId: string | null };
    idempotent: boolean;
    claimed: boolean;
  }>('appointment.checkin', { cookie: staffCookie, input: { code: codeRes2.code } });
  const assignedAfter = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'appointment.assigned' && (r.payload as Record<string, unknown>)?.appointmentId === aid2,
  ).length;
  check(
    'S1-R1 断言②：未指派单前台核销成功 → staff_id 仍为 NULL（不认领，claimed=false）',
    checkin2.appointment.status === 'in_service' && checkin2.appointment.staffId === null && checkin2.claimed === false,
    { staffId: checkin2.appointment.staffId, claimed: checkin2.claimed },
  );
  check(
    'S1-R1 断言②：未指派单核销后 outbox 无新增 appointment.assigned 事件（核销前后计数一致）',
    assignedAfter === assignedBefore,
    { assignedBefore, assignedAfter },
  );
  const deduped = [...new Map(frames.filter((f) => f.id).map((f) => [f.id, f])).values()];
  const typeSeq = deduped.map((f) => f.event);
  const expectedSeq = [
    'appointment.confirmed',
    // S4：create 自动派单（阿强）+ 商家改派（丽丽）各一条 assigned
    'appointment.assigned',
    'appointment.assigned',
    'appointment.checkedin',
    ...Array(6).fill('step_updated'),
    'appointment.completed',
  ];
  console.log('  [SSE] 实际收到事件序列:', JSON.stringify(typeSeq));
  console.log('  [SSE] 期望事件序列:    ', JSON.stringify(expectedSeq));
  check(
    'SSE 流依次收到 confirmed/assigned/checkedin/step_updated×6/completed（按 id 去重）',
    gotCompleted && JSON.stringify(typeSeq) === JSON.stringify(expectedSeq),
    typeSeq,
  );
  const stepPayloadOk = deduped
    .filter((f) => f.event === 'step_updated')
    .every((f) => {
      try {
        const d = JSON.parse(f.data) as { data?: { appointmentId?: string } };
        return d.data?.appointmentId === aid;
      } catch {
        return false;
      }
    });
  check('step_updated 载荷均指向本预约', stepPayloadOk);

  /* ---------- 11. event_outbox 事件齐全 ---------- */
  const outboxRows = (await db.select().from(schema.eventOutbox)).filter(
    (r) => (r.payload as Record<string, unknown> | null)?.appointmentId === aid,
  );
  const byType = new Map<string, string[]>();
  for (const r of outboxRows) {
    byType.set(r.eventType, [...(byType.get(r.eventType) ?? []), r.channel]);
  }
  const outboxExpect: Array<[string, number]> = [
    ['appointment.created', 1],
    // S4（任务 A）：confirmed 随 create 发 user+store 双频道；商家 confirm 幂等不再增发
    ['appointment.confirmed', 2],
    // S4（任务 C/D）：create 自动派单（staff+user）+ 商家改派（staff+user）各 2 条
    ['appointment.assigned', 4],
    // B2-8：checkedin / completed 为 appointment + store 双频道各 1 条（本断言 P1 时代后未同步，见批次 7.1 前置项复核）
    ['appointment.checkedin', 2],
    ['step_updated', 6],
    ['appointment.completed', 2],
    ['appointment.paid', 1],
    ['appointment.reviewed', 2], // store + staff 双频道
  ];
  const outboxOk = outboxExpect.every(([t, n]) => (byType.get(t) ?? []).length === n);
  check(
    `event_outbox 事件齐全（共 ${outboxRows.length} 条 / 期望 20 条）`,
    outboxOk && outboxRows.length === 20,
    Object.fromEntries([...byType].map(([k, v]) => [k, v.length])),
  );
  const assignedChannels = (byType.get('appointment.assigned') ?? []).sort();
  check(
    'assigned 双频道（staff + user）',
    assignedChannels.some((ch) => ch.startsWith('staff:')) &&
      assignedChannels.some((ch) => ch === `user:${customerUser!.id}`),
    assignedChannels,
  );

  /* ---------- 12. 权限负例 ---------- */
  const forbidden = await trpcMutate('store.upsertService', {
    cookie: customerCookie,
    input: { type: 'grooming', name: '越权服务', priceFen: 100 },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '客户调 merchantProcedure（store.upsertService）→ 403 FORBIDDEN',
    forbidden instanceof TrpcHttpError && forbidden.httpStatus === 403 && forbidden.code === 'FORBIDDEN',
    forbidden && { status: forbidden.httpStatus, code: forbidden.code },
  );

  const anon = await trpcMutate('appointment.create', {
    input: {
      storeId: store.id,
      petId,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: slot.slotStart,
      paymentMode: 'pay_at_store',
    },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '未登录调 appointment.create → 401 UNAUTHORIZED',
    anon instanceof TrpcHttpError && anon.httpStatus === 401 && anon.code === 'UNAUTHORIZED',
    anon && { status: anon.httpStatus, code: anon.code },
  );

  /* ---------- 12b. 批次 S1（任务 D）：store.updateStaff 权限收口 + 角色/状态联动 ---------- */
  // 第二商家夹具（他店 owner）：直插 users/user_roles/stores
  const [owner2] = await db
    .insert(schema.users)
    .values({ kimiId: 'seed_e2e_owner2', nickname: 'e2e 他店店主', phone: '13900000999' })
    .returning();
  await db.insert(schema.userRoles).values({ userId: owner2.id, role: 'merchant_owner' });
  await db.insert(schema.stores).values({ ownerId: owner2.id, name: 'e2e 他店', status: 'active' });
  const owner2Cookie = await devLogin(owner2.id);

  const staffRowsNow = await trpcQuery<{ staff: Array<{ id: string; name: string; role: string; status: string }> }>(
    'store.staffList',
    { cookie: ownerCookie },
  );
  const aqiang = staffRowsNow.staff.find((s) => s.name === '阿强');
  check('store.staffList 行带 role/status 字段（阿强=groomer/active）',
    !!aqiang && aqiang.role === 'groomer' && aqiang.status === 'active', aqiang);
  if (!aqiang) throw new Error('阿强缺失');

  const crossStore = await trpcMutate('store.updateStaff', {
    cookie: owner2Cookie,
    input: { staffId: aqiang.id, role: 'frontdesk' },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：越店 updateStaff（他店 owner 改本店员工）→ 403 FORBIDDEN',
    crossStore instanceof TrpcHttpError && crossStore.httpStatus === 403 && crossStore.code === 'FORBIDDEN',
    crossStore && { status: crossStore.httpStatus, code: crossStore.code },
  );

  const nonMerchant = await trpcMutate('store.updateStaff', {
    cookie: customerCookie,
    input: { staffId: aqiang.id, role: 'frontdesk' },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：非商家（customer）updateStaff → 403 FORBIDDEN',
    nonMerchant instanceof TrpcHttpError && nonMerchant.httpStatus === 403 && nonMerchant.code === 'FORBIDDEN',
    nonMerchant && { status: nonMerchant.httpStatus, code: nonMerchant.code },
  );

  const emptyInput = await trpcMutate('store.updateStaff', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：role/status 均缺省 → 400 BAD_REQUEST（至少传一项）',
    emptyInput instanceof TrpcHttpError && emptyInput.httpStatus === 400 && emptyInput.code === 'BAD_REQUEST',
    emptyInput && { status: emptyInput.httpStatus, code: emptyInput.code },
  );

  // 正向：改角色 → staffList 反映 → 员工端 auth.me 下次拉取生效（联动）
  const toFrontdesk = await trpcMutate<{ staff: { role: string; status: string } }>('store.updateStaff', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, role: 'frontdesk' },
  });
  check('批次 S1：本店 owner 改阿强 role→frontdesk 成功', toFrontdesk.staff.role === 'frontdesk', toFrontdesk.staff);
  const groomerMe = await trpcQuery<{ staff: { role: string; status: string } | null }>('auth.me', {
    cookie: groomerCookie,
  });
  check(
    '批次 S1：员工端下次拉取（auth.me）即见新角色 frontdesk（联动生效）',
    groomerMe.staff?.role === 'frontdesk',
    groomerMe.staff,
  );

  // 改回 groomer 并停用 → staffList 反映（留 groomer 身份供后续断言一致性）
  const backToGroomer = await trpcMutate<{ staff: { role: string; status: string } }>('store.updateStaff', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, role: 'groomer', status: 'suspended' },
  });
  check(
    '批次 S1：改回 groomer + 停用（role/status 同传）成功',
    backToGroomer.staff.role === 'groomer' && backToGroomer.staff.status === 'suspended',
    backToGroomer.staff,
  );
  const listAfter = await trpcQuery<{ staff: Array<{ id: string; name: string; role: string; status: string }> }>(
    'store.staffList',
    { cookie: ownerCookie },
  );
  const aqiangAfter = listAfter.staff.find((s) => s.id === aqiang.id);
  check(
    '批次 S1：staffList 刷新一致（阿强=groomer/suspended）',
    aqiangAfter?.role === 'groomer' && aqiangAfter?.status === 'suspended',
    aqiangAfter,
  );

  /* ---------- 13. 客户端错误上报（批次 9a 任务 E · POST /api/client-error） ---------- */
  const postClientError = (body: unknown, ip: string, raw = false) =>
    fetch(`${BASE}/api/client-error`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: raw ? String(body) : JSON.stringify(body),
    });
  const validReport = {
    app: 'customer',
    route: '/appointments?crash=1',
    message: 'B9A-E e2e 注入错误',
    stackFirstFrame: 'AppointmentsPage (http://localhost:7100/src/pages/AppointmentsPage.tsx:98:11)',
    componentStackFirstFrame: 'AppointmentsPage',
    time: new Date().toISOString(),
    ua: 'philia-e2e/1.0',
  };
  const ceOk = await postClientError(validReport, '10.9.0.1');
  const ceOkBody = (await ceOk.json()) as { ok?: boolean };
  check('client-error 合法上报 → 200 {ok:true}（免登录）', ceOk.status === 200 && ceOkBody.ok === true, ceOk.status);

  const ceBadApp = await postClientError({ ...validReport, app: 'hacker' }, '10.9.0.2');
  check('client-error 非法 app → 400', ceBadApp.status === 400, ceBadApp.status);
  const ceMissing = await postClientError({ app: 'staff' }, '10.9.0.3');
  check('client-error 缺 route/message → 400', ceMissing.status === 400, ceMissing.status);
  const ceNotJson = await postClientError('not-json{{{', '10.9.0.4', true);
  check('client-error 非 JSON body → 400', ceNotJson.status === 400, ceNotJson.status);

  // 限流：同一 IP 固定窗口 20 次/分，第 21 次起 429
  let first429 = -1;
  for (let i = 1; i <= 24; i++) {
    const r = await postClientError(validReport, '10.9.9.9');
    if (r.status === 429) { first429 = i; break; }
  }
  check('client-error 限流：同 IP 第 21 次起 → 429', first429 > 0 && first429 <= 22, first429);

  const ceLogRaw = existsSync(CLIENT_ERROR_LOG) ? readFileSync(CLIENT_ERROR_LOG, 'utf8') : '';
  const ceLines = ceLogRaw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
  check(
    'client-error JSONL 落盘：合法条目在日志（app/route/message/UA/首帧齐全）',
    ceLines.some(
      (l) =>
        l.app === 'customer' &&
        l.route === '/appointments?crash=1' &&
        l.message === 'B9A-E e2e 注入错误' &&
        typeof l.componentStackFirstFrame === 'string' &&
        l.ua === 'philia-e2e/1.0',
    ),
    ceLines.slice(0, 2),
  );
  check(
    'client-error 落盘：非法 app 条目不入日志',
    !ceLines.some((l) => l.app === 'hacker'),
  );

  client.close();
}

/* ------------------------------------------------------------------ */
/* 收尾：杀 server / 验端口释放 / 清临时库与上传图片 / 验种子库原样            */
/* ------------------------------------------------------------------ */

async function cleanup(): Promise<void> {
  if (server && !server.killed) {
    server.kill();
    await new Promise<void>((r) => {
      server!.once('exit', () => r());
      setTimeout(r, 5000); // 兜底
    });
  }
  const portFree = await waitFor(async () => {
    try {
      await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(500) });
      return false;
    } catch {
      return true;
    }
  }, 10_000);
  check('验收结束：7200 端口无残留监听', portFree);

  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch (e) {
    console.warn(`[e2e] 临时库目录清理失败（Windows libsql 句柄滞后，可手工删）: ${tmpDir}`, e);
  }
  try {
    // 仅删除本次验收上传的图片目录 uploads/appointment/<aid>，不动其他目录
    if (createdAid && existsSync(join(UPLOAD_APPT_ROOT, createdAid))) {
      rmSync(join(UPLOAD_APPT_ROOT, createdAid), { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    }
  } catch (e) {
    console.warn('[e2e] 验收图片清理失败:', e);
  }

  if (seedStatBefore) {
    const after = statSync(SEED_DB_FILE);
    check(
      '种子库 data/philia.db 原样（size/mtime 未变）',
      after.size === seedStatBefore.size && after.mtimeMs === seedStatBefore.mtimeMs,
      { before: seedStatBefore.size, after: after.size },
    );
  }
}

const watchdog = setTimeout(() => {
  console.error('\n[e2e] 超时（240s），强制退出');
  server?.kill();
  process.exit(1);
}, 240_000);

try {
  await main();
} catch (err) {
  failures++;
  console.error('\n[e2e] 未捕获异常：', err);
  if (serverLog) console.error('[e2e] server 日志尾部:\n', serverLog.slice(-2000));
} finally {
  await cleanup();
  clearTimeout(watchdog);
}

console.log(failures === 0 ? '\n全链路验收全部通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
