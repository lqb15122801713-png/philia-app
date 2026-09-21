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
 *
 * 批次 staff-2（R7~R10）增补段（设计稿 §五 e2e 增补清单 / 任务书 §七验收）：
 *   14. 前置夹具：阿强复职 / 门店围栏坐标显式置位 / clerk+manager（越权负例）+
 *       附加员工×3（榜尾不可达夹具）+ 榜单 XP 基底直插（learning 通道不占日上限）
 *   15. R7 打卡两击：in/out + 幂等重打；围栏外 BAD_REQUEST 零写入
 *   16. R7 补卡流：申请→店长审批通过（makeup=1 落行）→myApprovals 可见；
 *      跨月拒；当月第 4 次拒（≤3/月）
 *   17. R8 盘点：assignCount→recordItems（confirm 前零库存写入）→confirmCount
 *      入账（stock_movements sourceType=count 前后值）→驳回→重录→确认
 *   18. R9-C 接待人域：核销改挂留痕前后值 / 账单默认=开单人 / 含预约行取预约接待人 /
 *      无接待人硬排除 / storePools 两池分列
 *   19. R9 扣减 50% 硬闸门：评级 A → 超限 FORBIDDEN / 限额内成功 / 只扣绩效不扣提成
 *   20. R9/R10 仅本人：mySummary 200 + strict 越权 4xx；myEvents 仅本人；
 *      storePools staff/clerk 403
 *   21. R10 评价：差评 −8 + anonymous=1 + review.flagged 到店频道 + myReviews 仅本人；
 *      好评 +6（主单）；一单一评幂等拒绝
 *   22. R10 考试 XP 不受日上限：日上限填满后 recordExamPass 仍计分；同级当月重复拒
 *   23. R9-F 配置端口：owner 改参版本化留痕 / 新参只管新单 / clerk+manager 403 /
 *      未知键 BAD_REQUEST / 拉新置灰拒写
 *   24. R9 提成回溯（七步复核 Bug②）：商品/服务率改值前后单各按当时率逐行精确 /
 *      perf_base_rate 不回溯；G0 学徒仅洗护计 5%、造型单不计（裁定③）
 *   25. R10 榜尾不可达：榜尾视角≤5 行且第 4 名不可达；前排视角仅前三
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
const createdAidExtras: string[] = []; // staff-2 段补充上传的预约（aid2 六步走完），cleanup 一并删除
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
    // S4：传 petId——栅格可约判定与 create 同按 9a 引擎时长口径（引擎时长更长时
    // 整段区间须落在 groomer 排班内，否则该槽本就不可约，避免选到「服务默认时长
    // 可约但引擎时长超排班」的伪可约槽）
    { cookie: customerCookie, input: { storeId: store.id, serviceId: service.id, petId } },
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

  // S4（任务 D）：商家保留改派——assign 改派丽丽（不回归），来源标记覆盖为 merchant
  const assigned = await trpcMutate<{ status: string; staffId: string | null; assignSource: string | null }>('appointment.assign', {
    cookie: ownerCookie,
    input: { appointmentId: aid, staffId: staffRow2.id },
  });
  check(
    'appointment.assign 改派成功（阿强 → 丽丽），assignSource 覆盖为 merchant',
    assigned.staffId === staffRow2.id && assigned.assignSource === 'merchant',
    { staffId: assigned.staffId, assignSource: assigned.assignSource },
  );
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
    // staff-2 R10：review 同事务增发 staff 频道 review.submitted（payload 含 appointmentId，计入本断言）
    ['review.submitted', 1],
  ];
  const outboxOk = outboxExpect.every(([t, n]) => (byType.get(t) ?? []).length === n);
  check(
    `event_outbox 事件齐全（共 ${outboxRows.length} 条 / 期望 21 条）`,
    outboxOk && outboxRows.length === 21,
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

  /* ==================================================================
   * 批次 staff-2（R7~R10）验收段（设计稿 §五清单 / 任务书 §七）
   * ================================================================== */
  const { and, inArray } = await import('drizzle-orm');

  /* ---------- 14. 前置夹具 ----------
   * - 12b 收尾将阿强置 groomer/suspended；本批验收需其在岗（staffProcedure 每请求在职校验）→ 复职；
   * - 围栏圆心显式置位（种子本带坐标，按任务书 §二.2 口径显式落定保证判定确定）；
   * - clerk/manager 越权负例账号（仅 users+user_roles，无 staff 行——merchantOwnerProcedure
   *   角色闸先于归属，FORBIDDEN 同口径；不污染本店 staff 域）；
   * - 附加员工×3（榜尾不可达夹具：本店 6 名员工，榜尾视角验证第 4 名不出参）；
   * - 榜单 XP 基底直插 xp_events（channel='learning' 不占日上限，不干扰第 22 节日上限断言）；
   *   分值拉开 ≥90 间距，吸收运行期噪声（好评 +6 / 差评 −8 / 完成补偿 +2 / 考勤 ±5）。 */
  const reactivate = await trpcMutate<{ staff: { role: string; status: string } }>('store.updateStaff', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, status: 'active' },
  });
  check('staff-2 前置：阿强复职（role 留 groomer / status active）',
    reactivate.staff.status === 'active' && reactivate.staff.role === 'groomer', reactivate.staff);

  await db
    .update(schema.stores)
    .set({ lat: 30.2741, lng: 120.1551 })
    .where(eq(schema.stores.id, storeId));

  const xiaomeiStaff = staffList.staff.find((s) => s.name === '小美');
  if (!xiaomeiStaff) throw new Error('小美 staff 行缺失');
  const liliUser = byKimi('seed_kimi_staff3')!;

  const fixtureUsers = await db
    .insert(schema.users)
    .values([
      { kimiId: 'seed_e2e_clerk', nickname: 'e2e 店员 clerk', phone: '13900001001' },
      { kimiId: 'seed_e2e_manager', nickname: 'e2e 店长 manager', phone: '13900001002' },
      { kimiId: 'seed_e2e_extra1', nickname: 'e2e 附加甲', phone: '13900001011' },
      { kimiId: 'seed_e2e_extra2', nickname: 'e2e 附加乙', phone: '13900001012' },
      { kimiId: 'seed_e2e_extra3', nickname: 'e2e 附加丙', phone: '13900001013' },
    ])
    .returning();
  const [clerkFix, managerFix, extraU1, extraU2, extraU3] = fixtureUsers as [
    (typeof fixtureUsers)[number],
    (typeof fixtureUsers)[number],
    (typeof fixtureUsers)[number],
    (typeof fixtureUsers)[number],
    (typeof fixtureUsers)[number],
  ];
  await db.insert(schema.userRoles).values([
    { userId: clerkFix.id, role: 'merchant_clerk' },
    { userId: managerFix.id, role: 'merchant_manager' },
    { userId: extraU1.id, role: 'staff' },
    { userId: extraU2.id, role: 'staff' },
    { userId: extraU3.id, role: 'staff' },
  ]);
  const extraStaffRows = await db
    .insert(schema.staff)
    .values([
      { storeId, userId: extraU1.id, name: '附加甲', role: 'groomer', status: 'active' },
      { storeId, userId: extraU2.id, name: '附加乙', role: 'groomer', status: 'active' },
      { storeId, userId: extraU3.id, name: '附加丙', role: 'groomer', status: 'active' },
    ])
    .returning();
  const [extraS1, extraS2, extraS3] = extraStaffRows as [
    (typeof extraStaffRows)[number],
    (typeof extraStaffRows)[number],
    (typeof extraStaffRows)[number],
  ];
  const clerkCookie = await devLogin(clerkFix.id);
  const managerCookie = await devLogin(managerFix.id);
  const extra2Cookie = await devLogin(extraU2.id);
  const extra3Cookie = await devLogin(extraU3.id);
  check('staff-2 前置：clerk/manager/附加员工夹具就绪（dev-login 均签发）',
    !!(clerkCookie && managerCookie && extra2Cookie && extra3Cookie));

  // 榜单基底：learning 通道直插（不占日上限）；分值间距 ≥90 吸收运行期噪声
  await db.insert(schema.xpEvents).values(
    [
      { staffId: extraS1.id, userId: extraU1.id, points: 1000 },
      { staffId: extraS2.id, userId: extraU2.id, points: 900 },
      { staffId: xiaomeiStaff.id, userId: staffUser!.id, points: 800 },
      { staffId: aqiang.id, userId: groomerUser!.id, points: 700 },
      { staffId: staffRow2.id, userId: liliUser.id, points: 600 },
      { staffId: extraS3.id, userId: extraU3.id, points: 10 },
    ].map((r) => ({
      storeId,
      staffId: r.staffId,
      userId: r.userId,
      source: 'cover',
      sourceId: 'e2e-leaderboard-seed',
      points: r.points,
      channel: 'learning',
      ruleVersion: 1,
      dropped: false,
    })),
  );

  // 本地日期口径（与 attendance.ts localDateStr 同帧：服务器本地时区）
  const pad2l = (n: number) => String(n).padStart(2, '0');
  const now0 = new Date();
  const todayStr = `${now0.getFullYear()}-${pad2l(now0.getMonth() + 1)}-${pad2l(now0.getDate())}`;
  const currentMonth = todayStr.slice(0, 7);
  const prevMonthD = new Date(now0.getFullYear(), now0.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthD.getFullYear()}-${pad2l(prevMonthD.getMonth() + 1)}`;
  const currentQuarter = `${now0.getFullYear()}-Q${Math.floor(now0.getMonth() / 3) + 1}`;

  /** 负例统一收集：tRPC 错误 → TrpcHttpError，成功 → null */
  const asErr = (p: Promise<unknown>) => p.then(() => null, (e) => e as TrpcHttpError);

  /* ---------- 15. R7 打卡两击 + 围栏（清单①） ---------- */
  console.log('\n[staff-2] 15. R7 考勤：打卡两击 / 围栏拦截');
  interface MarkRes { record: { id: string; kind: string; distanceM: number }; duplicated: boolean }
  const markIn = await trpcMutate<MarkRes>('attendance.mark', {
    cookie: staffCookie,
    input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-xiaomei' },
  });
  const markInDup = await trpcMutate<MarkRes>('attendance.mark', {
    cookie: staffCookie,
    input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-xiaomei' },
  });
  check('R7① 上班打卡成功（围栏内 distanceM=0）', markIn.record.kind === 'in' && markIn.record.distanceM === 0, markIn.record);
  check('R7① 上班重复打卡幂等（返回同一条记录，不重复落行）',
    markInDup.duplicated === true && markInDup.record.id === markIn.record.id,
    { dup: markInDup.duplicated, id: markInDup.record.id, expect: markIn.record.id });
  const markOut = await trpcMutate<MarkRes>('attendance.mark', {
    cookie: staffCookie,
    input: { kind: 'out', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-xiaomei' },
  });
  const markOutDup = await trpcMutate<MarkRes>('attendance.mark', {
    cookie: staffCookie,
    input: { kind: 'out', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-xiaomei' },
  });
  check('R7① 下班打卡 + 重打幂等', markOut.record.kind === 'out' && markOutDup.duplicated === true && markOutDup.record.id === markOut.record.id, markOut.record);
  const xmToday = await db
    .select()
    .from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.staffId, xiaomeiStaff.id), eq(schema.attendanceRecords.date, todayStr)));
  check('R7① 当日 attendance_records 恰 2 行（in+out，两击封顶）', xmToday.length === 2, xmToday.map((r) => r.kind));

  const farMark = await asErr(trpcMutate('attendance.mark', {
    cookie: groomerCookie,
    input: { kind: 'in', lat: 31.2304, lng: 121.4737, deviceId: 'e2e-dev-far' }, // 上海，距店 ~165km
  }));
  check('R7② 围栏外打卡 → 400 BAD_REQUEST「不在门店范围，无法打卡」',
    farMark instanceof TrpcHttpError && farMark.httpStatus === 400 && farMark.code === 'BAD_REQUEST' && farMark.message.includes('不在门店范围'),
    farMark && { status: farMark.httpStatus, code: farMark.code, message: farMark.message });
  const aqToday = await db
    .select()
    .from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.staffId, aqiang.id), eq(schema.attendanceRecords.date, todayStr)));
  check('R7② 围栏外拦截零写入（阿强当日 0 行，不写异常记录）', aqToday.length === 0, aqToday.length);

  /* ---------- 16. R7 补卡流（清单②：申请→审批→可见 / 限当月 / ≤3 次每月） ---------- */
  console.log('\n[staff-2] 16. R7 补卡双流');
  const makeupReq = await trpcMutate<{ id: string; status: string }>('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: todayStr, kind: 'in', requestedTs: new Date(`${todayStr}T09:00:00`), reason: '早会忘打卡' },
  });
  check('R7③ 补卡申请建档（pending，限当月日期）', makeupReq.status === 'pending', makeupReq);
  const approve = await trpcMutate<{ status: string; recordId: string | null }>('attendance.resolveApproval', {
    cookie: ownerCookie,
    input: { approvalId: makeupReq.id, approve: true, note: '同意补卡' },
  });
  check('R7③ 店长审批通过（approved + 回链 record_id）', approve.status === 'approved' && !!approve.recordId, approve);
  const makeupRow = await db
    .select()
    .from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.staffId, staffRow2.id), eq(schema.attendanceRecords.date, todayStr), eq(schema.attendanceRecords.kind, 'in')))
    .get();
  check('R7③ 补卡通过落 makeup=1 记录（status=normal，补卡视同正常）',
    makeupRow?.makeup === true && makeupRow.status === 'normal' && makeupRow.id === approve.recordId,
    makeupRow && { makeup: makeupRow.makeup, status: makeupRow.status });
  const myAppr = await trpcQuery<Array<{ id: string; status: string; type: string }>>('attendance.myApprovals', { cookie: liliCookie });
  check('R7③ 员工端 myApprovals 可见审批结果（approved）',
    myAppr.some((a) => a.id === makeupReq.id && a.type === 'makeup' && a.status === 'approved'), myAppr.length);

  const pastMonth = await asErr(trpcMutate('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: `${prevMonthStr}-01`, kind: 'in', requestedTs: new Date(`${prevMonthStr}-01T09:00:00`), reason: '跨月补卡验证' },
  }));
  check('R7④ 补卡限当月（上月日期 → BAD_REQUEST「补卡限当月」）',
    pastMonth instanceof TrpcHttpError && pastMonth.code === 'BAD_REQUEST' && pastMonth.message.includes('补卡限当月'),
    pastMonth && { code: pastMonth.code, message: pastMonth.message });

  // 月限 3 次：approved×1 + 再申 pending×2 → 第 4 次硬拒
  await trpcMutate('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: todayStr, kind: 'out', requestedTs: new Date(`${todayStr}T18:00:00`), reason: '忘打下班卡' },
  });
  await trpcMutate('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: todayStr, kind: 'in', requestedTs: new Date(`${todayStr}T09:20:00`), reason: '补充说明占第 3 次' },
  });
  const fourth = await asErr(trpcMutate('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: todayStr, kind: 'out', requestedTs: new Date(`${todayStr}T18:20:00`), reason: '第 4 次应被拒' },
  }));
  check('R7⑤ 当月第 4 次补卡 → BAD_REQUEST（每人 ≤3 次/月）',
    fourth instanceof TrpcHttpError && fourth.code === 'BAD_REQUEST' && fourth.message.includes('补卡次数已用完'),
    fourth && { code: fourth.code, message: fourth.message });

  /* ---------- 17. R8 盘点：店长确认才入账（清单③） ---------- */
  console.log('\n[staff-2] 17. R8 盘点状态机（confirm 前零库存写入 / 驳回重盘）');
  interface CountTaskItem { id: string; productId: string; systemStock: number; actualStock: number | null; productName: string | null }
  const count1 = await trpcMutate<{ id: string; status: string; itemCount: number }>('inventory.assignCount', {
    cookie: ownerCookie,
    input: { type: 'weekly' },
  });
  check('R8① 周盘建单（draft + 全量账面快照行）', count1.status === 'draft' && count1.itemCount > 0, count1);
  const tasks1 = await trpcQuery<Array<{ id: string; status: string; items: CountTaskItem[] }>>('inventory.myCountTasks', { cookie: staffCookie });
  const task1 = tasks1.find((t) => t.id === count1.id);
  check('R8① 员工端待办可见盘点单（行项齐全）', !!task1 && task1.items.length === count1.itemCount, task1?.items.length);
  if (!task1) throw new Error('盘点单未见于员工待办');
  const targetIdx = task1.items.findIndex((it) => it.systemStock >= 5);
  const target = task1.items[targetIdx]!;
  const stockAtAssign = (await db.select().from(schema.products).where(eq(schema.products.id, target.productId)).get())!.stock;
  const rec1 = await trpcMutate<{ id: string; status: string }>('inventory.recordItems', {
    cookie: staffCookie,
    input: {
      countId: count1.id,
      items: task1.items.map((it, i) => ({ itemId: it.id, actualStock: i === targetIdx ? it.systemStock - 3 : it.systemStock })),
    },
  });
  const stockAfterRecord = (await db.select().from(schema.products).where(eq(schema.products.id, target.productId)).get())!.stock;
  check('R8② 实盘录入 → counted；confirm 前零库存写入（products.stock 不变）',
    rec1.status === 'counted' && stockAfterRecord === stockAtAssign && target.systemStock === stockAtAssign,
    { status: rec1.status, stockAtAssign, stockAfterRecord });
  const confirm1 = await trpcMutate<{ count: { status: string }; diffs: number }>('inventory.confirmCount', {
    cookie: ownerCookie,
    input: { countId: count1.id },
  });
  const stockAfterConfirm = (await db.select().from(schema.products).where(eq(schema.products.id, target.productId)).get())!.stock;
  const mv1 = await db
    .select()
    .from(schema.stockMovements)
    .where(and(eq(schema.stockMovements.sourceType, 'count'), eq(schema.stockMovements.sourceId, count1.id)));
  check('R8③ 店长确认才入账（posted，diffs=1）', confirm1.count.status === 'posted' && confirm1.diffs === 1, confirm1);
  check('R8③ 入账落流水 sourceType=count（盘亏 delta=-3，before/after 正确）+ products.stock 更新',
    mv1.length === 1 &&
      mv1[0]!.delta === -3 && mv1[0]!.beforeStock === stockAtAssign && mv1[0]!.afterStock === stockAtAssign - 3 &&
      mv1[0]!.operatorId === ownerUser!.id && stockAfterConfirm === stockAtAssign - 3,
    { movements: mv1.length, stockAfterConfirm });

  // 驳回 → 退回重盘 → 重录 → 确认（无差异零流水）
  const count2 = await trpcMutate<{ id: string; status: string }>('inventory.assignCount', { cookie: ownerCookie, input: { type: 'weekly' } });
  const task2 = (await trpcQuery<Array<{ id: string; items: CountTaskItem[] }>>('inventory.myCountTasks', { cookie: staffCookie })).find((t) => t.id === count2.id);
  if (!task2) throw new Error('盘点单#2 未见于员工待办');
  await trpcMutate('inventory.recordItems', {
    cookie: staffCookie,
    input: { countId: count2.id, items: task2.items.map((it) => ({ itemId: it.id, actualStock: it.systemStock })) },
  });
  const rej = await trpcMutate<{ status: string; rejectNote: string }>('inventory.rejectCount', {
    cookie: ownerCookie,
    input: { countId: count2.id, note: '抽盘复核，退回重盘' },
  });
  check('R8④ 驳回 → rejected（退回重盘，note 回显）', rej.status === 'rejected' && rej.rejectNote === '抽盘复核，退回重盘', rej);
  const rec2 = await trpcMutate<{ status: string }>('inventory.recordItems', {
    cookie: staffCookie,
    input: { countId: count2.id, items: task2.items.map((it) => ({ itemId: it.id, actualStock: it.systemStock })) },
  });
  const confirm2 = await trpcMutate<{ count: { status: string }; diffs: number }>('inventory.confirmCount', {
    cookie: ownerCookie,
    input: { countId: count2.id },
  });
  const mv2 = await db
    .select()
    .from(schema.stockMovements)
    .where(and(eq(schema.stockMovements.sourceType, 'count'), eq(schema.stockMovements.sourceId, count2.id)));
  check('R8④ 退回单重录 → counted → 确认 posted；无差异零流水',
    rec2.status === 'counted' && confirm2.count.status === 'posted' && confirm2.diffs === 0 && mv2.length === 0,
    { rec: rec2.status, post: confirm2.count.status, diffs: confirm2.diffs, mv: mv2.length });

  /* ---------- 18. R9-C 接待人域（清单⑨） ---------- */
  console.log('\n[staff-2] 18. R9-C 接待人域（核销改挂 / 默认开单人 / 无接待人硬排除 / 两池分列）');
  const slotPool = cat2.slots.filter((s) => {
    const t = s.slotStart.getTime();
    if (t === slot.slotStart.getTime() || t === slot2.slotStart.getTime()) return false;
    const shifted = new Date(t + 8 * 3600 * 1000);
    const h = shifted.getUTCHours();
    return h >= 10 && h <= 16 && shifted.getUTCMinutes() === 0;
  });
  const slot3 = slotPool[0];
  const slot4 = slotPool[1];
  check('staff-2 前置：第三/第四可约槽（接待人域用单）', !!slot3 && !!slot4, slotPool.length);
  if (!slot3 || !slot4) throw new Error('可约槽不足');

  const mkAppt = async (slotX: typeof slot, note: string) =>
    trpcMutate<{ id: string; status: string }>('appointment.create', {
      cookie: customerCookie,
      input: { storeId: store.id, petId, serviceId: service.id, type: 'grooming', scheduledStart: slotX.slotStart, paymentMode: 'pay_at_store', note },
    });
  const appt3 = await mkAppt(slot3, 'e2e 接待人域 appt3');
  await trpcMutate('appointment.confirm', { cookie: ownerCookie, input: { appointmentId: appt3.id } });
  // 核销改挂：前台小美核销并把接待人改挂为本人（实际接待人=小美，用户 ID 口径）
  const code3 = await trpcQuery<{ code: string }>('appointment.getCode', { cookie: customerCookie, input: { appointmentId: appt3.id } });
  const checkin3 = await trpcMutate<{ appointment: { staffId: string | null }; receptionistId: string | null }>('appointment.checkin', {
    cookie: staffCookie,
    input: { code: code3.code, receptionistId: staffUser!.id },
  });
  check('R9-C① 核销改挂接待人（响应透出 receptionistId=小美）', checkin3.receptionistId === staffUser!.id, checkin3.receptionistId);
  const rlog = await db.select().from(schema.receptionLogs).where(eq(schema.receptionLogs.appointmentId, appt3.id));
  check('R9-C① reception_logs 挂预约留痕前后值（NULL → 小美，操作人=小美）',
    rlog.length === 1 && rlog[0]!.oldReceptionistId === null && rlog[0]!.newReceptionistId === staffUser!.id && rlog[0]!.changedBy === staffUser!.id,
    rlog.map((r) => ({ old: r.oldReceptionistId, next: r.newReceptionistId, by: r.changedBy })));
  const appt3StaffId = checkin3.appointment.staffId; // S4 自动派单归属（groomer 池基数用）

  const appt4 = await mkAppt(slot4, 'e2e 接待人域 appt4');
  await trpcMutate('appointment.confirm', { cookie: ownerCookie, input: { appointmentId: appt4.id } });
  const assign4 = await trpcMutate<{ staffId: string | null }>('appointment.assign', {
    cookie: ownerCookie,
    input: { appointmentId: appt4.id, staffId: aqiang.id },
  });
  check('staff-2 前置：appt4 指派阿强（扣减闸门基数来源单）', assign4.staffId === aqiang.id, assign4);
  // 补管：六步流已在主链路与 aid2（第 21 节）实证；此处直接把两单置 completed 供收银拉单
  await db
    .update(schema.appointments)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(inArray(schema.appointments.id, [appt3.id, appt4.id]));

  // 收银三单：C=散客服务单（默认接待人=开单人 owner）/ A=appt3 预约行（接待人=预约改挂小美）/ B=appt4 预约行
  const settleBill = async (items: Array<{ kind: string; refId: string }>, note: string) => {
    const held = await trpcMutate<{ bill: { id: string; billNo: string; payableFen: number } }>('cashier.hold', {
      cookie: ownerCookie,
      input: { items, discountType: 'none', discountValue: 0, note },
    });
    const settled = await trpcMutate<{ bill: { id: string; status: string } }>('cashier.settle', {
      cookie: ownerCookie,
      input: { items, billNo: held.bill.billNo, discountType: 'none', discountValue: 0, note, payments: [{ method: 'cash', amountFen: held.bill.payableFen }] },
    });
    return { billId: held.bill.id, billNo: held.bill.billNo, payableFen: held.bill.payableFen, status: settled.bill.status };
  };
  const billC = await settleBill([{ kind: 'service', refId: service.id }], 'e2e 接待人域 billC（散客服务单）');
  const billA = await settleBill([{ kind: 'appointment', refId: appt3.id }], 'e2e 接待人域 billA（appt3 改挂单）');
  const billB = await settleBill([{ kind: 'appointment', refId: appt4.id }], 'e2e 接待人域 billB（appt4 阿强单）');
  check('R9-C② 三单结账 settled（接待人域夹具）', billC.status === 'settled' && billA.status === 'settled' && billB.status === 'settled',
    { c: billC.status, a: billA.status, b: billB.status });

  const billRows = await db.select().from(schema.cashierBills).where(inArray(schema.cashierBills.id, [billC.billId, billA.billId, billB.billId]));
  const billById = new Map(billRows.map((b) => [b.id, b]));
  check('R9-C② 账单接待人默认=开单人（billC → owner）', billById.get(billC.billId)?.receptionistId === ownerUser!.id, billById.get(billC.billId)?.receptionistId);
  check('R9-C② 含预约行账单接待人=预约接待人（billA → 小美，核销改挂落点）', billById.get(billA.billId)?.receptionistId === staffUser!.id, billById.get(billA.billId)?.receptionistId);
  // 构造无接待人单：billB receptionist 置 NULL（任务书口径：宁漏计不乱挂）
  await db.update(schema.cashierBills).set({ receptionistId: null, updatedAt: new Date() }).where(eq(schema.cashierBills.id, billB.billId));
  const billBAfter = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, billB.billId)).get();
  check('R9-C③ 构造 billB 无接待人单（receptionist_id=NULL）', billBAfter?.receptionistId === null, billBAfter?.receptionistId);

  const itemOf = async (billId: string) =>
    (await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, billId)))[0]!;
  const priceA = (await itemOf(billA.billId)).unitPriceFen;
  const priceB = (await itemOf(billB.billId)).unitPriceFen;
  const priceC = (await itemOf(billC.billId)).unitPriceFen;

  interface PerfPoolT { baseFen: number; rateBp: number; amountFen: number }
  interface SummaryPayload {
    payload: {
      staffId: string;
      commissionTotalFen: number;
      performance: { grade: string; coeffBp: number | null; groomerPool: PerfPoolT; frontdeskPool: PerfPoolT };
      deductions: Array<{ id: string; amountFen: number; reason: string; createdBy: string }>;
    };
  }
  const fdSummary = await trpcQuery<SummaryPayload>('commission.mySummary', { cookie: staffCookie, input: {} });
  check('R9-C③ 前台绩效池仅计本人接待归属（=billA 门市价，billB 无接待人硬排除）',
    fdSummary.payload.performance.frontdeskPool.baseFen === priceA,
    { actual: fdSummary.payload.performance.frontdeskPool.baseFen, priceA });

  const pools = await trpcQuery<{
    pools: Array<{ pool: string; label: string; baseFen: number; rateBp: number; amountFen: number }>;
    unattributedFen: number;
  }>('commission.storePools', { cookie: ownerCookie, input: { quarter: currentQuarter } });
  const gPool = pools.pools.find((p) => p.pool === 'groomer');
  const fPool = pools.pools.find((p) => p.pool === 'frontdesk');
  check('R9-C④ storePools 同源双计两池分列（美容师绩效池/前台绩效池两行不合并）',
    pools.pools.length === 2 && !!gPool && !!fPool && gPool.pool !== fPool.pool,
    pools.pools.map((p) => p.pool));
  check('R9-C④ 池基数正确（groomer=两预约行操作归属 / frontdesk=改挂单+散客服务单接待归属）',
    gPool?.baseFen === (appt3StaffId ? priceA : 0) + priceB && fPool?.baseFen === priceA + priceC,
    { g: gPool?.baseFen, f: fPool?.baseFen, priceA, priceB, priceC });
  check('R9-C⑤ 无接待人洗美营收硬排除透出（unattributedFen=billB）', pools.unattributedFen === priceB, pools.unattributedFen);

  /* ---------- 19. R9 扣减 50% 硬闸门（清单⑤） ---------- */
  console.log('\n[staff-2] 19. R9 绩效扣减：50% 上限 FORBIDDEN');
  const grade = await trpcMutate<{ grade: { grade: string }; changed: boolean }>('commission.gradePerformance', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, quarter: currentQuarter, grade: 'A', note: 'e2e 季度评级' },
  });
  check('R9⑥ 季度评级录入（阿强 当季 A 档，系数 1.0）', grade.grade.grade === 'A', grade);

  const sumAq1 = await trpcQuery<SummaryPayload>('commission.mySummary', { cookie: groomerCookie, input: {} });
  check('R9⑦ 提成 mySummary 仅本人（阿强 200，staffId=本人）', sumAq1.payload.staffId === aqiang.id, sumAq1.payload.staffId);
  const groomerPoolAmt = sumAq1.payload.performance.groomerPool.amountFen;
  // appt3 自动派单归属随负荷动态（本轮实测=阿强）：groomer 池基数=billB +（appt3 归阿强时 billA）
  const expectedAqGroomerBase = priceB + (appt3StaffId === aqiang.id ? priceA : 0);
  check('R9⑦ 阿强美容师绩效池基数>0（预约行操作归属=settled 账单口径）且 A 档系数 1.0',
    sumAq1.payload.performance.groomerPool.baseFen === expectedAqGroomerBase && sumAq1.payload.performance.coeffBp === 10000,
    { actual: sumAq1.payload.performance.groomerPool.baseFen, expected: expectedAqGroomerBase, appt3归阿强: appt3StaffId === aqiang.id });
  // 与 server 同口径算上限：月绩效估计=池金额×系数/3，cap=估计×50%
  const monthlyEst = Math.round((groomerPoolAmt * 10000) / 10000 / 3);
  const capFen = Math.floor((monthlyEst * 5000) / 10000);
  const overDed = await asErr(trpcMutate('commission.createDeduction', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, month: currentMonth, amountFen: capFen + 1, reason: '超限验证（应被拒）' },
  }));
  check('R9⑧ 扣减超当月绩效 50% → 403 FORBIDDEN「已达当月扣减上限」',
    overDed instanceof TrpcHttpError && overDed.httpStatus === 403 && overDed.code === 'FORBIDDEN' && overDed.message.includes('已达当月扣减上限'),
    overDed && { status: overDed.httpStatus, message: overDed.message, capFen });
  const smallDed = Math.min(50, capFen);
  const ded = await trpcMutate<{ deduction: { id: string; amountFen: number }; monthUsedFen: number; monthCapFen: number }>('commission.createDeduction', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, month: currentMonth, amountFen: smallDed, reason: '仪容不整扣减' },
  });
  check('R9⑧ 限额内扣减成功（monthUsed/monthCap 透出，cap 与口径一致）',
    ded.monthUsedFen === smallDed && ded.monthCapFen === capFen, ded);
  const sumAq2 = await trpcQuery<SummaryPayload>('commission.mySummary', { cookie: groomerCookie, input: {} });
  check('R9⑧ 扣减列示于 mySummary.deductions（含原因/录单人）',
    sumAq2.payload.deductions.some((d) => d.amountFen === smallDed && d.reason === '仪容不整扣减' && d.createdBy === ownerUser!.id),
    sumAq2.payload.deductions);
  check('R9⑧ 扣减只扣绩效不扣提成（commissionTotalFen 不变）',
    sumAq2.payload.commissionTotalFen === sumAq1.payload.commissionTotalFen,
    { before: sumAq1.payload.commissionTotalFen, after: sumAq2.payload.commissionTotalFen });

  /* ---------- 20. R9/R10 仅本人硬过滤（清单④） ---------- */
  console.log('\n[staff-2] 20. 仅本人：越权传参 4xx / myEvents 仅本人 / storePools 403');
  const crossRead = await asErr(trpcQuery('commission.mySummary', {
    cookie: groomerCookie,
    input: { month: currentMonth, staffId: staffRow2.id }, // 越权传参：strict 硬拒（查不到非遮蔽）
  }));
  check('R9⑨ mySummary 越权传 staffId → 4xx（strict BAD_REQUEST）',
    crossRead instanceof TrpcHttpError && crossRead.httpStatus === 400 && crossRead.code === 'BAD_REQUEST',
    crossRead && { status: crossRead.httpStatus, code: crossRead.code });

  const aidReviewRow = await db.select().from(schema.reviews).where(eq(schema.reviews.appointmentId, aid)).get();
  check('R10⑩ 主单好评已落 reviews 行（rating=5 非匿名，R10 最小评价域）',
    aidReviewRow?.rating === 5 && aidReviewRow.anonymous === false && aidReviewRow.staffId === staffRow2.id, aidReviewRow);
  interface XpEventItem { id: string; source: string; sourceId: string; points: number; channel: string; ruleVersion: number; dropped: boolean }
  const evLili = await trpcQuery<{ items: XpEventItem[] }>('xp.myEvents', { cookie: liliCookie });
  const evAq = await trpcQuery<{ items: XpEventItem[] }>('xp.myEvents', { cookie: groomerCookie });
  check('R10⑪ myEvents 仅本人（丽丽流内含本人 +6 好评事件）',
    !!aidReviewRow && evLili.items.some((e) => e.source === 'review' && e.sourceId === aidReviewRow.id && e.points === 6),
    evLili.items.map((e) => `${e.source}:${e.points}`));
  check('R10⑪ myEvents 仅本人（阿强流内无丽丽事件，无入参可越权）',
    !!aidReviewRow && !evAq.items.some((e) => e.sourceId === aidReviewRow.id),
    evAq.items.length);

  const poolsAsStaff = await asErr(trpcQuery('commission.storePools', { cookie: staffCookie, input: { quarter: currentQuarter } }));
  const poolsAsClerk = await asErr(trpcQuery('commission.storePools', { cookie: clerkCookie, input: { quarter: currentQuarter } }));
  check('R9⑩ storePools 仅店主（staff → 403 FORBIDDEN）',
    poolsAsStaff instanceof TrpcHttpError && poolsAsStaff.httpStatus === 403 && poolsAsStaff.code === 'FORBIDDEN',
    poolsAsStaff && { status: poolsAsStaff.httpStatus, code: poolsAsStaff.code });
  check('R9⑩ storePools 仅店主（clerk → 403 FORBIDDEN，附证）',
    poolsAsClerk instanceof TrpcHttpError && poolsAsClerk.httpStatus === 403 && poolsAsClerk.code === 'FORBIDDEN',
    poolsAsClerk && { status: poolsAsClerk.httpStatus, code: poolsAsClerk.code });

  /* ---------- 21. R10 评价域（清单⑧：差评 −8 / 匿名 / flagged 到店频道 / 一单一评） ---------- */
  console.log('\n[staff-2] 21. R10 评价：差评扣分 + 匿名 + 店长频道提示 + 幂等');
  // aid2（S1-R1② 未指派核销单，在 in_service）：指派阿强后由其走完六步 → completed
  await db.update(schema.appointments).set({ staffId: aqiang.id, updatedAt: new Date() }).where(eq(schema.appointments.id, aid2));
  createdAidExtras.push(aid2);
  async function uploadFor(aidX: string, stepKey: string, cookie: string): Promise<{ url: string; thumbUrl: string }> {
    const img = new Jimp({ width: 320, height: 240, color: 0x66aaffff });
    const buf = await img.getBuffer('image/jpeg');
    const fd = new FormData();
    fd.append('file', new File([buf], `e2e-${aidX}-${stepKey}.jpg`, { type: 'image/jpeg' }));
    fd.append('relDir', `appointment/${aidX}/${stepKey}`);
    const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie }, body: fd });
    const body = (await res.json()) as { url?: string; thumbUrl?: string; message?: string };
    if (!res.ok || !body.url) throw new Error(`上传失败(${aidX}/${stepKey}): ${res.status} ${JSON.stringify(body)}`);
    return { url: body.url, thumbUrl: body.thumbUrl ?? body.url };
  }
  for (const plan of stepPlan) {
    if (plan.count > 0) {
      const up = await uploadFor(aid2, plan.key, groomerCookie);
      await trpcMutate('serviceStep.addPhotos', {
        cookie: groomerCookie,
        input: {
          appointmentId: aid2,
          stepKey: plan.key,
          photos: Array.from({ length: plan.count }, (_, i) => ({ url: up.url, thumbUrl: up.thumbUrl, tag: plan.tags?.[i] ?? 'normal' })),
        },
      });
    }
    const done = await trpcMutate<{ appointmentCompleted: boolean }>('serviceStep.confirmStep', {
      cookie: groomerCookie,
      input: { appointmentId: aid2, stepKey: plan.key },
    });
    check(`R10⑫ aid2 六步推进（${plan.key}）`, done.appointmentCompleted === (plan.key === 'confirm'), done);
  }

  const rev2 = await trpcMutate<{ rating: number | null }>('appointment.review', {
    cookie: customerCookie,
    input: { appointmentId: aid2, rating: 2, review: '有待改进', anonymous: true },
  });
  check('R10⑬ 差评提交成功（rating=2 anonymous=true，≤30s 链路内完成）', rev2.rating === 2, rev2);
  const reviewRow2 = await db.select().from(schema.reviews).where(eq(schema.reviews.appointmentId, aid2)).get();
  check('R10⑬ reviews 行落库（anonymous=1，归属阿强）',
    reviewRow2?.anonymous === true && reviewRow2.rating === 2 && reviewRow2.staffId === aqiang.id, reviewRow2);
  const penaltyRow = reviewRow2
    ? await db
        .select()
        .from(schema.xpEvents)
        .where(and(eq(schema.xpEvents.staffId, aqiang.id), eq(schema.xpEvents.source, 'penalty'), eq(schema.xpEvents.sourceId, reviewRow2.id)))
        .get()
    : undefined;
  check('R10⑬ 差评 XP −8（扣分不扣款，penalty 不占日上限）',
    penaltyRow?.points === -8 && penaltyRow.dropped === false, penaltyRow && { points: penaltyRow.points, dropped: penaltyRow.dropped });
  const flaggedRows = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'review.flagged' && r.channel === `store:${storeId}` && (r.payload as Record<string, unknown> | null)?.appointmentId === aid2,
  );
  check('R10⑬ 差评提示 review.flagged 到达 store 频道（店长视图数据源，event_outbox 实证）', flaggedRows.length === 1, flaggedRows.map((r) => r.channel));
  interface MyReviewItem { id: string; appointmentId: string; rating: number; anonymous: boolean }
  const myRevAq = await trpcQuery<{ items: MyReviewItem[] }>('xp.myReviews', { cookie: groomerCookie });
  const myRevLili = await trpcQuery<{ items: MyReviewItem[] }>('xp.myReviews', { cookie: liliCookie });
  check('R10⑬ 员工端 myReviews 仅本人且匿名标记透出（阿强见 aid2 差评 anonymous=1）',
    myRevAq.items.some((r) => r.appointmentId === aid2 && r.anonymous === true && r.rating === 2), myRevAq.items.length);
  check('R10⑬ myReviews 仅本人（丽丽不见阿强差评，见本人 aid 好评）',
    !myRevLili.items.some((r) => r.appointmentId === aid2) && myRevLili.items.some((r) => r.appointmentId === aid), myRevLili.items.length);

  const goodXp = aidReviewRow
    ? await db
        .select()
        .from(schema.xpEvents)
        .where(and(eq(schema.xpEvents.staffId, staffRow2.id), eq(schema.xpEvents.source, 'review'), eq(schema.xpEvents.sourceId, aidReviewRow.id)))
        .get()
    : undefined;
  check('R10⑭ 5 星好评 +6（主单 aid，匿名同权口径的对照组）', goodXp?.points === 6 && goodXp.dropped === false, goodXp && { points: goodXp.points });

  const again1 = await asErr(trpcMutate('appointment.review', { cookie: customerCookie, input: { appointmentId: aid, rating: 4 } }));
  const again2 = await asErr(trpcMutate('appointment.review', { cookie: customerCookie, input: { appointmentId: aid2, rating: 5 } }));
  check('R10⑮ 一单一评（重复评价幂等拒绝 BAD_REQUEST「该预约已评价」×2）',
    again1 instanceof TrpcHttpError && again1.code === 'BAD_REQUEST' && again1.message.includes('已评价') &&
      again2 instanceof TrpcHttpError && again2.code === 'BAD_REQUEST' && again2.message.includes('已评价'),
    [again1?.message, again2?.message]);

  /* ---------- 22. R10 考试 XP 不受日上限（清单⑦） ---------- */
  console.log('\n[staff-2] 22. R10 学习通道：日上限填满后考试 XP 仍计分');
  interface AwardRes { awarded: number; dropped: boolean; skipped: boolean; ruleVersion: number }
  let lastCover: AwardRes | null = null;
  for (let i = 1; i <= 4; i++) {
    lastCover = await trpcMutate<AwardRes>('xp.assignCover', {
      cookie: ownerCookie,
      input: { staffId: extraS2.id, note: `e2e 补位 ${i}/4` },
    });
  }
  check('R10⑯ 补位 ×4 填满日上限（+15×4=60，均未丢弃）', lastCover!.awarded === 15 && lastCover!.dropped === false, lastCover);
  const cover5 = await trpcMutate<AwardRes>('xp.assignCover', {
    cookie: ownerCookie,
    input: { staffId: extraS2.id, note: 'e2e 补位第 5 次（应超限丢弃）' },
  });
  check('R10⑯ 第 5 次补位超限丢弃留痕（dropped=1 / awarded=0，不报错）', cover5.dropped === true && cover5.awarded === 0, cover5);
  interface XpSummary { totalXp: number; today: { earned: number; cap: number } }
  const sumE2a = await trpcQuery<XpSummary>('xp.mySummary', { cookie: extra2Cookie });
  check('R10⑯ 今日进度封顶明示（earned=60 cap=60）', sumE2a.today.earned === 60 && sumE2a.today.cap === 60, sumE2a.today);
  const exam = await trpcMutate<AwardRes>('xp.recordExamPass', { cookie: extra2Cookie, input: { level: 'P0' } });
  check('R10⑰ 考试 XP 不受日上限（P0 +30 learning 通道照常计入）', exam.awarded === 30 && exam.dropped === false, exam);
  const sumE2b = await trpcQuery<XpSummary>('xp.mySummary', { cookie: extra2Cookie });
  check('R10⑰ 考试计入累计但不占日额（totalXp=900+60+30=990，today 仍 60/60）',
    sumE2b.totalXp === 990 && sumE2b.today.earned === 60, { totalXp: sumE2b.totalXp, today: sumE2b.today });
  const examDup = await asErr(trpcMutate('xp.recordExamPass', { cookie: extra2Cookie, input: { level: 'P0' } }));
  check('R10⑰ 同级当月重复考试 → BAD_REQUEST（每级每月限 1 次）',
    examDup instanceof TrpcHttpError && examDup.code === 'BAD_REQUEST' && examDup.message.includes('每级每月限 1 次'),
    examDup && { code: examDup.code, message: examDup.message });

  /* ---------- 23. R9-F 配置端口（清单⑩） ---------- */
  console.log('\n[staff-2] 23. R9-F 配置端口：版本化留痕 / 新参只管新单 / clerk+manager 403 / 未知键 / 拉新置灰');
  interface CfgRuleRow { version: number; ruleKey: string; valueJson: Record<string, unknown>; active: boolean }
  const cfg1 = await trpcQuery<{ currentVersion: number; rules: CfgRuleRow[] }>('config.list', { cookie: ownerCookie, input: { domain: 'xp' } });
  const capRowV1 = cfg1.rules.find((r) => r.ruleKey === 'xp_daily_cap' && r.active);
  check('R9-F① 配置读取（当前 version=1，xp_daily_cap=60 生效中）',
    cfg1.currentVersion === 1 && capRowV1?.valueJson.cap === 60, { v: cfg1.currentVersion, cap: capRowV1?.valueJson });

  const save = await trpcMutate<{ version: number; keys: string[] }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'xp', changes: [{ ruleKey: 'xp_daily_cap', valueJson: { cap: 50 } }] },
  });
  check('R9-F② owner 保存即生效（version=2）', save.version === 2 && save.keys.includes('xp_daily_cap'), save);

  const vers = await trpcQuery<{ versions: Array<{ version: number; changedBy: string; changerNickname: string | null; changesJson: Array<{ rule_key: string; before: unknown; after: unknown }> }> }>(
    'config.versions',
    { cookie: ownerCookie, input: { domain: 'xp' } },
  );
  const v2row = vers.versions.find((v) => v.version === 2);
  const v2change = v2row?.changesJson.find((c) => c.rule_key === 'xp_daily_cap');
  check('R9-F② 版本留痕（每 key 前后值 + 变更人）',
    !!v2row && v2row.changedBy === ownerUser!.id &&
      (v2change?.before as Record<string, unknown>)?.cap === 60 && (v2change?.after as Record<string, unknown>)?.cap === 50,
    v2change);
  const cfg2 = await trpcQuery<{ rules: CfgRuleRow[] }>('config.list', { cookie: ownerCookie, input: { domain: 'xp' } });
  const capRows = cfg2.rules.filter((r) => r.ruleKey === 'xp_daily_cap');
  check('R9-F② 旧行失效新行生效（v1 active=0 / v2 active=1 cap=50）',
    capRows.some((r) => r.active && r.version === 2 && r.valueJson.cap === 50) && capRows.some((r) => !r.active && r.version === 1 && r.valueJson.cap === 60),
    capRows.map((r) => ({ v: r.version, active: r.active, cap: r.valueJson.cap })));

  // 新参只影响新单：extra3（今日已计 0）按新上限 50 发放——+15×3=45 通过，第 4 次 45+15>50 丢弃
  for (let i = 1; i <= 3; i++) {
    await trpcMutate<AwardRes>('xp.assignCover', { cookie: ownerCookie, input: { staffId: extraS3.id, note: `e2e 新参补位 ${i}/3` } });
  }
  const coverE3Over = await trpcMutate<AwardRes>('xp.assignCover', { cookie: ownerCookie, input: { staffId: extraS3.id, note: 'e2e 新参第 4 次（应按 50 丢弃）' } });
  const sumE3 = await trpcQuery<XpSummary>('xp.mySummary', { cookie: extra3Cookie });
  check('R9-F③ 新参只管新单：cap=50 后第 4 次补位丢弃（today 45/50）',
    coverE3Over.dropped === true && coverE3Over.awarded === 0 && sumE3.today.earned === 45 && sumE3.today.cap === 50,
    { dropped: coverE3Over.dropped, today: sumE3.today });
  const evE3 = await trpcQuery<{ items: XpEventItem[] }>('xp.myEvents', { cookie: extra3Cookie });
  const droppedE3 = evE3.items.find((e) => e.dropped);
  check('R9-F③ 新事件按新规则版本落库（dropped 行 rule_version=2）', droppedE3?.ruleVersion === 2, droppedE3);
  const evE2b = await trpcQuery<{ items: XpEventItem[] }>('xp.myEvents', { cookie: extra2Cookie, input: { limit: 50 } });
  const sumE2c = await trpcQuery<XpSummary>('xp.mySummary', { cookie: extra2Cookie });
  check('R9-F③ 旧事件保持 rule_version=1 且仍计入（新参不回溯：totalXp 仍 990）',
    evE2b.items.length > 0 && evE2b.items.every((e) => e.ruleVersion === 1) && sumE2c.totalXp === 990,
    { n: evE2b.items.length, totalXp: sumE2c.totalXp });

  // clerk + manager 403（配置端口仅 owner，procedure 硬拒）
  for (const [label, cookie] of [['clerk', clerkCookie], ['manager', managerCookie]] as const) {
    const rList = await asErr(trpcQuery('config.list', { cookie, input: { domain: 'xp' } }));
    const rSave = await asErr(trpcMutate('config.save', { cookie, input: { domain: 'xp', changes: [{ ruleKey: 'xp_daily_cap', valueJson: { cap: 60 } }] } }));
    const rVers = await asErr(trpcQuery('config.versions', { cookie, input: { domain: 'xp' } }));
    check(`R9-F④ 配置端口 ${label} 403（list/save/versions 全拒，仅 owner）`,
      [rList, rSave, rVers].every((r) => r instanceof TrpcHttpError && r.httpStatus === 403 && r.code === 'FORBIDDEN'),
      [rList, rSave, rVers].map((r) => r && `${r.httpStatus}:${r.code}`));
  }

  const unknownKey = await asErr(trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'xp', changes: [{ ruleKey: 'xp_no_such_key', valueJson: { cap: 1 } }] },
  }));
  check('R9-F⑤ 未知规则键 → 400 BAD_REQUEST「未知规则键」（配置页只改既有参数）',
    unknownKey instanceof TrpcHttpError && unknownKey.code === 'BAD_REQUEST' && unknownKey.message.includes('未知规则键'),
    unknownKey && { code: unknownKey.code, message: unknownKey.message });

  const rulesView = await trpcQuery<{ sources: Array<{ key: string; disabled?: boolean; disabledNote?: string }> }>('xp.rulesView', { cookie: staffCookie });
  const referralSrc = rulesView.sources.find((s) => s.key === 'xp_referral');
  check('R10⑱ 拉新置灰拒写（rulesView 标注 disabled +「随会员游戏化批开通」；xp 路由无 referral 写入口，awardXp 对 referral 源码级硬拒）',
    referralSrc?.disabled === true && referralSrc.disabledNote === '随会员游戏化批开通', referralSrc);

  /* ---------- 24. R9 提成规则回溯（七步复核 Bug②）+ G0 洗护判别（裁定③） ----------
   * 回溯写死：改率前已结账单按旧率、改率后新单按新率（源单 settled_at × effective_from 时序解析）。
   * 夹具顺序：商品单 P1 → 商品率 5%→6% → 商品单 P2；服务率 20%→25% → appt5；
   * perf_base_rate 5%→10% → appt6；G0 学徒洗护/造型对照。 */
  console.log('\n[staff-2] 24. R9 提成回溯（Bug②）：旧单旧率/新单新率 + G0 仅洗护计 5%（裁定③）');
  interface CommLineT { billId: string; itemId: string; refId: string; name: string; baseFen: number; rateBp: number; amountFen: number }
  interface CommSummaryT {
    payload: {
      staffId: string;
      commissionTotalFen: number;
      serviceLines: CommLineT[];
      productLines: CommLineT[];
      performance: { grade: string; coeffBp: number | null; payableFen: number; groomerPool: PerfPoolT; frontdeskPool: PerfPoolT };
    };
  }

  // ① 商品率 5%→6%：billP1（改率前）/ billP2（改率后），归属=小美（商品提成按开单人 operator 归属，夹具置 operator=小美）
  // （时间列精度=秒：改率/结账之间 sleep 1.1s 跨秒界，同秒边界取旧版的保守口径见 commission.ts resolveFromHistory 注释）
  const prod = (await db.select().from(schema.products).where(and(eq(schema.products.storeId, storeId), eq(schema.products.status, 'on')))).find((p) => p.stock > 0);
  if (!prod) throw new Error('无在售商品夹具');
  const prodPrice = prod.priceFen;
  const billP1 = await settleBill([{ kind: 'product', refId: prod.id }], 'e2e 回溯 billP1（商品·改率前）');
  await db.update(schema.cashierBills).set({ operatorId: staffUser!.id, updatedAt: new Date() }).where(eq(schema.cashierBills.id, billP1.billId));
  await sleep(1100); // 跨秒界：billP1 settled_at 严格早于改率 effective_from
  const saveProdRate = await trpcMutate<{ version: number; keys: string[] }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'commission', changes: [{ ruleKey: 'commission_product_rate', valueJson: { rate_bp: 600 } }] },
  });
  check('R9回溯① 前置：商品率 5%→6% 保存即生效（commission version=2）', saveProdRate.version === 2, saveProdRate);
  await sleep(1100); // 跨秒界：billP2 settled_at 严格晚于改率
  const billP2 = await settleBill([{ kind: 'product', refId: prod.id }], 'e2e 回溯 billP2（商品·改率后）');
  await db.update(schema.cashierBills).set({ operatorId: staffUser!.id, updatedAt: new Date() }).where(eq(schema.cashierBills.id, billP2.billId));
  const sumXm = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: staffCookie, input: {} });
  const lineP1 = sumXm.payload.productLines.find((l) => l.billId === billP1.billId);
  const lineP2 = sumXm.payload.productLines.find((l) => l.billId === billP2.billId);
  check('R9回溯① 商品改率前单仍按旧率 5%（rateBp=500，金额=门市实收×5% 逐行精确）',
    lineP1?.rateBp === 500 && lineP1.amountFen === Math.round((prodPrice * 500) / 10000),
    { lineP1, prodPrice });
  check('R9回溯① 商品改率后单按新率 6%（rateBp=600，金额=×6% 逐行精确）',
    lineP2?.rateBp === 600 && lineP2.amountFen === Math.round((prodPrice * 600) / 10000),
    { lineP2, prodPrice });

  // ② 服务率 20%→25%：appt4（阿强，§18 billB 已结账=旧单）/ appt5（改率后新单）
  const saveGroomRate = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'commission', changes: [{ ruleKey: 'commission_grooming_rate', valueJson: { rate_bp: 2500 } }] },
  });
  check('R9回溯② 前置：服务率 20%→25% 保存即生效（version=3）', saveGroomRate.version === 3, saveGroomRate);
  await sleep(1100); // 跨秒界：appt5 结账严格晚于改率
  const appt5 = (await db.insert(schema.appointments).values({
    code: 'E2EAQ5', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 12345, completedAt: new Date(), staffId: aqiang.id,
  }).returning())[0]!;
  const billE = await settleBill([{ kind: 'appointment', refId: appt5.id }], 'e2e 回溯 billE（appt5 服务·改率后）');
  check('R9回溯② 前置：appt5 结账 settled', billE.status === 'settled', billE);
  const sumAq3 = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const lineSvcOld = sumAq3.payload.serviceLines.find((l) => l.refId === appt4.id);
  const lineSvcNew = sumAq3.payload.serviceLines.find((l) => l.refId === appt5.id);
  check('R9回溯② 服务改率前单仍按旧率 20%（appt4/billB，rateBp=2000 金额精确）',
    lineSvcOld?.rateBp === 2000 && lineSvcOld.amountFen === Math.round((priceB * 2000) / 10000),
    { lineSvcOld, priceB });
  check('R9回溯② 服务改率后单按新率 25%（appt5，rateBp=2500 金额精确）',
    lineSvcNew?.rateBp === 2500 && lineSvcNew.amountFen === Math.round((12345 * 2500) / 10000),
    { lineSvcNew });

  // ③ perf_base_rate 5%→10%：既有全部旧单保持 5%，appt6（改率后）按 10% 逐行累加
  const poolBefore = sumAq3.payload.performance.groomerPool.amountFen; // 旧单已按 5% 逐行结算
  await sleep(1100); // 跨秒界：appt5 结账严格早于 perf 改率
  const savePerfRate = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'commission', changes: [{ ruleKey: 'perf_base_rate', valueJson: { rate_bp: 1000 } }] },
  });
  check('R9回溯③ 前置：perf_base_rate 5%→10% 保存即生效（version=4）', savePerfRate.version === 4, savePerfRate);
  await sleep(1100); // 跨秒界：appt6 结账严格晚于改率
  const appt6 = (await db.insert(schema.appointments).values({
    code: 'E2EAQ6', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 8000, completedAt: new Date(), staffId: aqiang.id,
  }).returning())[0]!;
  await settleBill([{ kind: 'appointment', refId: appt6.id }], 'e2e 回溯 billF（appt6 绩效·改率后）');
  const sumAq4 = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  check('R9回溯③ 绩效 perf_base_rate 改值不回溯（旧单仍 5%，appt6 按 10% 逐行精确累加）',
    sumAq4.payload.performance.groomerPool.amountFen === poolBefore + Math.round((8000 * 1000) / 10000),
    { before: poolBefore, after: sumAq4.payload.performance.groomerPool.amountFen, delta: Math.round((8000 * 1000) / 10000) });

  // ④ G0 学徒（裁定③）：洗护单计 5%、造型单不计（isWashService 关键词判别）
  const g0User = (await db.insert(schema.users).values({ kimiId: 'seed_e2e_g0', nickname: 'e2e 学徒小G', phone: '13900001021' }).returning())[0]!;
  await db.insert(schema.userRoles).values({ userId: g0User.id, role: 'staff' });
  const g0Staff = (await db.insert(schema.staff).values({ storeId, userId: g0User.id, name: '学徒小G', role: 'groomer', grade: 'G0', status: 'active' }).returning())[0]!;
  const [washSvc, styleSvc] = (await db.insert(schema.services).values([
    { storeId, type: 'grooming', name: '深层洗护浴', durationMin: 60, priceFen: 10000, active: true },
    { storeId, type: 'grooming', name: '泰迪造型修剪', durationMin: 90, priceFen: 10000, active: true },
  ]).returning()) as [typeof schema.services.$inferSelect, typeof schema.services.$inferSelect];
  const apptW = (await db.insert(schema.appointments).values({
    code: 'E2EG0W', customerId: customerUser!.id, storeId, petId, serviceId: washSvc.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: g0Staff.id,
  }).returning())[0]!;
  const apptS = (await db.insert(schema.appointments).values({
    code: 'E2EG0S', customerId: customerUser!.id, storeId, petId, serviceId: styleSvc.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: g0Staff.id,
  }).returning())[0]!;
  await settleBill([{ kind: 'appointment', refId: apptW.id }], 'e2e G0 billW（洗护单）');
  await settleBill([{ kind: 'appointment', refId: apptS.id }], 'e2e G0 billS（造型单）');
  const g0Cookie = await devLogin(g0User.id);
  const sumG0 = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: g0Cookie, input: {} });
  check('G0③ 洗护单计 5%（命中 洗/浴 不命中造型类；金额=10000×5%=500）',
    sumG0.payload.serviceLines.length === 1 && sumG0.payload.serviceLines[0]!.refId === apptW.id &&
      sumG0.payload.serviceLines[0]!.rateBp === 500 && sumG0.payload.serviceLines[0]!.amountFen === 500,
    sumG0.payload.serviceLines);
  check('G0③ 造型单不计提成（serviceLines 无 apptS 行，commissionTotalFen=500 仅洗护行）',
    !sumG0.payload.serviceLines.some((l) => l.refId === apptS.id) && sumG0.payload.commissionTotalFen === 500,
    { total: sumG0.payload.commissionTotalFen, lines: sumG0.payload.serviceLines.map((l) => `${l.name}:${l.amountFen}`) });

  /* ---------- 25. R10 榜尾不可达（清单⑥） ---------- */
  console.log('\n[staff-2] 25. R10 榜单查询层裁剪（前三+自己+前一名）');
  interface LbRow { staffId: string; rank: number; isSelf: boolean; totalXp: number }
  const lbTail = await trpcQuery<{ rows: LbRow[] }>('xp.leaderboard', { cookie: extra3Cookie });
  check('R10⑲ 榜尾视角 ≤5 行（前三+自己+前一名）', lbTail.rows.length > 0 && lbTail.rows.length <= 5, lbTail.rows.length);
  check('R10⑲ 榜尾视角含自己与前一名（丽丽 rank5），第 4 名（阿强）不可达',
    lbTail.rows.some((r) => r.staffId === extraS3.id && r.isSelf) &&
      lbTail.rows.some((r) => r.staffId === staffRow2.id) &&
      !lbTail.rows.some((r) => r.staffId === aqiang.id),
    lbTail.rows.map((r) => `${r.rank}:${r.staffId.slice(0, 6)}${r.isSelf ? '*' : ''}`));
  const lbTop = await trpcQuery<{ rows: LbRow[] }>('xp.leaderboard', { cookie: staffCookie });
  check('R10⑲ 前排视角仅前三（丽丽/阿强/附加丙均不出参，全榜永不外泄）',
    lbTop.rows.length === 3 &&
      !lbTop.rows.some((r) => r.staffId === staffRow2.id || r.staffId === aqiang.id || r.staffId === extraS3.id),
    lbTop.rows.map((r) => `${r.rank}:${r.staffId.slice(0, 6)}`));

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
    // 仅删除本次验收上传的图片目录 uploads/appointment/<aid>（含 staff-2 段补充上传），不动其他目录
    for (const aidX of [createdAid, ...createdAidExtras]) {
      if (aidX && existsSync(join(UPLOAD_APPT_ROOT, aidX))) {
        rmSync(join(UPLOAD_APPT_ROOT, aidX), { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      }
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
