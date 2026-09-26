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
 *   25. 补充令①（决策 #39/#40）：owner 改体型系数→新预约引擎新值/旧单 scheduledEnd 不变/
 *      config.versions 留痕前后值；G0 scope=bath 造型不计提→scope=all 计提 5% 双向
 *   26. R10 榜尾不可达：榜尾视角≤5 行且第 4 名不可达；前排视角仅前三
 *
 * 批次 R12（退款专项）段（任务书冻结版 V1.0 §七全清单 / docs/r12/R12-DESIGN.md §六）：
 *   27. 店员 clerk 403（preview/execute/list）
 *   28. 店长≤阈值现金单全额退六联动 + 快照 rebate 列位（清单②+⑭）
 *   29. V1 拆分两笔累计超阈值顶到店主（店长 30000 成 → 再 30000 FORBIDDEN → 店主成）
 *   30. V2 日结现金段净额（现金+微信组合单部分退：dayStats 退款单列 delta + 已收不涂改 + 净额算术）
 *   31. V3 组合支付 6:4 分摊回补（现金 60%/储值 40% 按金额退，储值余额前后值留痕）
 *      + 涉储值单店长明文拦截（清单⑤+⑪）
 *   32. V4 寄养提前接回退剩余晚（剩余 2 晚×晚单价；已发生晚不退明文；分段明细透出；不动预约单）
 *   33. V5 已冲正/已撤单无退款入口（明文拒 ×2）
 *   34. V6 部分退提成按比例冲减精确到分（50%→1250）+ 退完归零 refunded +
 *      跨月退款进当月 adjustments（不动已快照月份）
 *   35. V7 跨日退款入发生日（biz_date=今日；昨日封箱日结行不变；dayStats 今含昨不含）
 *   36. V8 次卡赠次不计价（付费 10 赠 2 剩付费 4 → 折算 4×(实付÷10)；赠次 2 作废；
 *      卡作废留痕；重复退卡拒）+ 次卡退卡店长拦截（涉储值）
 *   37. 部分退款余额内可再退（30% 成 → 20% 成 → 累计超可退余额拒）
 *   38. 实退待办（executed 超 24h → pendingActual 含；settleActual → settled+RefundSettled；
 *      重复登记幂等；待办消失）
 *
 * 批次 R11a（会员前置批·骨架批）段（28 号施工令全清单 + 回归）：
 *   39. 售卡三档到店付 + 售卡提成定额（萤火 500/烛光 1000/微光 0）+ 双归属两字段 + 微光开档幂等
 *   40. 多宠第 4 只+59（4 只 25800 / 10 只 61200 / 11 只拒）
 *   41. 服务 88 折自动（adjusted=unit×0.88，unit 门市价划线不动）+ 微光无折扣对照
 *   42. grant 无月上限（同月多笔累计无 cap）+ 三本账无互转（端点扫描+储值/XP 零交叉）
 *   43. settleMonthly 次月到账批次单幂等（服务级直调：not-due / settled / already-settled）
 *   44. 抵扣段仅商品（服务行 rebate 段 403 / 商品行成）+ rebate 段不计已收
 *   45. 退货扣回接 R12（rebateClawbackFen 实算 + clawback 前后值 + 余额不足扣 0 记未扣回）
 *   46. 到期冻结（懒冻结+抵扣冻结拒+折扣失效）→ 续费解冻顺延 365 天
 *   47. plans 权益表述（安心包全员免费、无「非会员 ¥15」残留）+ savingsPreview 数值 +
 *      amortizationStats 双口径（cashFen 156700 / amortizedFen 11400）
 *   48. 退会清零 + 折算（剩余整月 7×19900/12=11608 精确到分）+ 客户频道通知 +
 *      回馈金流水前后值链完整
 *
 * 批次 R11a 复核补改段（七步复核打回①/②）：
 *   49. 打回① 退会挂号退款单：cancel → refund_bills type='membership_cancel' 在库
 *      （executed/offline_original/bill_id=售卡原单/linkage 快照全字段+rebateClawbackFen=0）
 *      → refund.list 可见 → createdAt 移位 25h（段尾铁律：移位后不再生成退款单，
 *      防 genRefundNo 撞号）→ pendingActual 含 → settleActual settled 幂等 → 待办消失；
 *      打回② 退会后结算日不到账：C 商品单 grant（期次移位至未结算期）→ cancel（作废
 *      未到账 clear 留痕行「退会作废未到账回馈金 258 分」）→ settleMonthly 合成到点 →
 *      C 余额不变/grant 未回标/批次单 granted_count 不含退会者，D 对照正常到账
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
const PORT = Number(process.env.E2E_PORT ?? 7200); // 默认 7200 不变；并行窗占用时可用 E2E_PORT 避让（验收语义不变）
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
   * - clerk 越权负例账号（仅 users+user_roles，无 staff 行——merchantOwnerProcedure
   *   角色闸先于归属，FORBIDDEN 同口径）；
   * - manager（店长）挂 staff 行绑定本店（merchantManagerProcedure 需 storeId——
   *   中间件对非 owner 商家角色只从 staff 行取门店归属；R12 店长退款链路实证用，
   *   配置端口 owner-only 403 断言不受影响）；
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
      { storeId, userId: managerFix.id, name: 'e2e 店长', role: 'frontdesk', grade: 'P3', status: 'active' }, // R12：店长退款链路需 storeId（staff 行绑定）
      { storeId, userId: extraU1.id, name: '附加甲', role: 'groomer', status: 'active' },
      { storeId, userId: extraU2.id, name: '附加乙', role: 'groomer', status: 'active' },
      { storeId, userId: extraU3.id, name: '附加丙', role: 'groomer', status: 'active' },
    ])
    .returning();
  const [managerStaff, extraS1, extraS2, extraS3] = extraStaffRows as [
    (typeof extraStaffRows)[number],
    (typeof extraStaffRows)[number],
    (typeof extraStaffRows)[number],
    (typeof extraStaffRows)[number],
  ];
  void managerStaff;
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

  /* ---------- 25. 补充令①：时长系数配置化（决策 #39/#40）+ G0 scope（决策 #40） ---------- */
  console.log('\n[staff-2] 25. 时长规则配置端口（改系数→新预约新值/旧单不变/留痕）+ G0 scope bath→all 双向');
  // ① owner 改体型系数 medium 1.5→2.0：中型犬（15kg 柯基短毛）新预约时长 90→120min；
  //    改前已建预约 scheduledEnd 原值不变（新值只管新单）；config.versions 留痕前后值
  const midDog = (await db.insert(schema.pets).values({
    ownerId: customerUser!.id, name: 'e2e 中型犬', species: 'dog', breed: '柯基', weightKg: 15,
  }).returning())[0]!;
  const slotD1 = slotPool[2];
  // D2 与 D1 间隔 ≥4h：D1 引擎时长 90min 占连续槽 + S4 可用性引擎按 groomer 空闲判定，
  // 相邻槽会因区间重叠/无空闲美容师 409（本轮实测），故取 ≥4h 后的槽位
  const slotD2 = slotD1 ? slotPool.find((s) => s.slotStart.getTime() >= slotD1.slotStart.getTime() + 4 * 3600 * 1000) : undefined;
  check('时长前置：D1/D2 可约槽（duration 用单，间隔≥4h 防区间重叠）', !!slotD1 && !!slotD2, slotPool.length);
  if (!slotD1 || !slotD2) throw new Error('可约槽不足（duration 段）');
  const apptD1 = await trpcMutate<{ id: string; scheduledStart: Date; scheduledEnd: Date }>('appointment.create', {
    cookie: customerCookie,
    input: { storeId: store.id, petId: midDog.id, serviceId: service.id, type: 'grooming', scheduledStart: slotD1.slotStart, paymentMode: 'pay_at_store', note: 'e2e 时长 apptD1（改系数前）' },
  });
  const d1Min = (apptD1.scheduledEnd.getTime() - apptD1.scheduledStart.getTime()) / 60000;
  // 引擎口径：bath 基础 60 × medium 1.5 × short 1.0 = 90min（30min 栅格已整除）
  check('时长① 改系数前：中型犬洗护新预约 scheduledEnd=引擎 90min（60×1.5×1.0）', d1Min === 90, { d1Min });
  const saveSizeCoef = await trpcMutate<{ version: number; keys: string[] }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'duration', changes: [{ ruleKey: 'duration_size_coef', valueJson: { small: 1.0, medium: 2.0, large: 2.0 } }] },
  });
  check('时长① owner 改体型系数 medium 1.5→2.0（duration domain version=2）',
    saveSizeCoef.version === 2 && saveSizeCoef.keys.includes('duration_size_coef'), saveSizeCoef);
  const apptD2 = await trpcMutate<{ id: string; scheduledStart: Date; scheduledEnd: Date }>('appointment.create', {
    cookie: customerCookie,
    input: { storeId: store.id, petId: midDog.id, serviceId: service.id, type: 'grooming', scheduledStart: slotD2.slotStart, paymentMode: 'pay_at_store', note: 'e2e 时长 apptD2（改系数后）' },
  });
  const d2Min = (apptD2.scheduledEnd.getTime() - apptD2.scheduledStart.getTime()) / 60000;
  check('时长① 改系数后：同宠物同服务新预约 scheduledEnd=新系数 120min（60×2.0×1.0）', d2Min === 120, { d2Min });
  const d1Row = await db.select().from(schema.appointments).where(eq(schema.appointments.id, apptD1.id)).get();
  check('时长① 改前已建预约 scheduledEnd 原值不变（不回溯：库内仍 90min）',
    !!d1Row && (d1Row.scheduledEnd.getTime() - d1Row.scheduledStart.getTime()) / 60000 === 90,
    d1Row && (d1Row.scheduledEnd.getTime() - d1Row.scheduledStart.getTime()) / 60000);
  const durVers = await trpcQuery<{ versions: Array<{ version: number; changedBy: string; changesJson: Array<{ rule_key: string; before: unknown; after: unknown }> }> }>(
    'config.versions',
    { cookie: ownerCookie, input: { domain: 'duration' } },
  );
  const dv2 = durVers.versions.find((v) => v.version === 2)?.changesJson.find((c) => c.rule_key === 'duration_size_coef');
  check('时长① config.versions 留痕前后值（medium 1.5→2.0，变更人=owner）',
    !!dv2 && (dv2.before as Record<string, unknown>)?.medium === 1.5 && (dv2.after as Record<string, unknown>)?.medium === 2.0 &&
      durVers.versions.find((v) => v.version === 2)?.changedBy === ownerUser!.id,
    dv2);

  // ② G0 scope（决策 #40）：阿强 grade 直改 G0（夹具）→ scope=bath 默认造型单不计提；
  //    owner 改 scope=all 后新造型单计提 5%（双向断言；秒界 sleep 防同秒 tie）
  await db.update(schema.staff).set({ grade: 'G0', updatedAt: new Date() }).where(eq(schema.staff.id, aqiang.id));
  const apptS2 = (await db.insert(schema.appointments).values({
    code: 'E2EGS2', customerId: customerUser!.id, storeId, petId, serviceId: styleSvc.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: aqiang.id,
  }).returning())[0]!;
  await settleBill([{ kind: 'appointment', refId: apptS2.id }], 'e2e G0-scope billS2（造型·scope=bath）');
  const sumAqG0a = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  check('G0scope② scope=bath（默认）：G0 造型单不计提（serviceLines 无 apptS2 行）',
    !sumAqG0a.payload.serviceLines.some((l) => l.refId === apptS2.id),
    sumAqG0a.payload.serviceLines.map((l) => `${l.name}:${l.rateBp}`));
  await sleep(1100); // 跨秒界：billS2 结账严格早于 scope 改版
  const saveG0Scope = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'commission', changes: [{ ruleKey: 'commission_grooming_assistant_g0_rate', valueJson: { rate_bp: 500, scope: 'all' } }] },
  });
  check('G0scope② owner 改 scope=all（commission version=5）', saveG0Scope.version === 5, saveG0Scope);
  await sleep(1100); // 跨秒界：billS3 结账严格晚于改版
  const apptS3 = (await db.insert(schema.appointments).values({
    code: 'E2EGS3', customerId: customerUser!.id, storeId, petId, serviceId: styleSvc.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: aqiang.id,
  }).returning())[0]!;
  await settleBill([{ kind: 'appointment', refId: apptS3.id }], 'e2e G0-scope billS3（造型·scope=all）');
  const sumAqG0b = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const lineS3 = sumAqG0b.payload.serviceLines.find((l) => l.refId === apptS3.id);
  check('G0scope② scope=all：新造型单计提 5%（rateBp=500，金额=10000×5%=500 精确）',
    lineS3?.rateBp === 500 && lineS3.amountFen === 500, lineS3);
  check('G0scope② scope=all 不回溯：scope=bath 期造型单（apptS2）仍不计提',
    !sumAqG0b.payload.serviceLines.some((l) => l.refId === apptS2.id), apptS2.id);
  // 夹具还原：阿强 grade 回 G1（防干扰后续段）
  await db.update(schema.staff).set({ grade: 'G1', updatedAt: new Date() }).where(eq(schema.staff.id, aqiang.id));

  /* ---------- 26. R10 榜尾不可达（清单⑥） ---------- */
  console.log('\n[staff-2] 26. R10 榜单查询层裁剪（前三+自己+前一名）');
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

  /* ==================================================================
   * 批次 R12（退款专项）验收段 —— 任务书冻结版 V1.0 §七全清单逐条实证
   * 纲：退款 ≠ 反结账；原单已收不涂改；当日净额=已收−退款；六联动同事务。
   * ================================================================== */

  /* ---- 共用工具：+8 门店规范日界（refund.biz_date / dayStats 与 server storeWallclock 同帧） ---- */
  const storeDayStr = (d: Date) => new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const storeToday = storeDayStr(new Date());
  const storeYesterday = storeDayStr(new Date(Date.now() - 24 * 3600 * 1000));

  interface R12CartItem { kind: 'service' | 'product' | 'appointment'; refId: string; qty?: number; paidByPass?: boolean }
  /** R12 收银夹具：hold 取服务端重算应收 → settle 按支付段组合结账（缺省全额现金；开单人=owner） */
  const settleBill2 = async (
    items: R12CartItem[],
    opts: { customerId?: string; payments?: (payableFen: number) => Array<{ method: string; amountFen: number }>; note: string },
  ): Promise<{ billId: string; billNo: string; payableFen: number }> => {
    const held = await trpcMutate<{ bill: { id: string; billNo: string; payableFen: number } }>('cashier.hold', {
      cookie: ownerCookie,
      input: { customerId: opts.customerId ?? null, items, discountType: 'none', discountValue: 0, note: opts.note },
    });
    const settled = await trpcMutate<{ bill: { id: string; status: string } }>('cashier.settle', {
      cookie: ownerCookie,
      input: {
        customerId: opts.customerId ?? null,
        items,
        billNo: held.bill.billNo,
        discountType: 'none',
        discountValue: 0,
        note: opts.note,
        payments: opts.payments ? opts.payments(held.bill.payableFen) : [{ method: 'cash', amountFen: held.bill.payableFen }],
      },
    });
    if (settled.bill.status !== 'settled') throw new Error(`R12 夹具结账失败：${opts.note}`);
    return { billId: held.bill.id, billNo: held.bill.billNo, payableFen: held.bill.payableFen };
  };

  interface RefundExecRes {
    refund: {
      id: string; refundNo: string; status: string; amountFen: number; bizDate: string; type: string;
      operatorId: string; approverId: string | null; linkageJson: Record<string, unknown> | null;
    };
    plan: {
      refundFen: number;
      segments: Array<{ paymentId: string; method: string; amountFen: number; ratioBp: number; channel: string }>;
      boarding: { totalNights: number; occurredNights: number; remainingNights: number; nights: number; perNightFen: number } | null;
      passCancel: Record<string, unknown> | null;
    } | null;
    idempotent: boolean;
  }
  const execRefund = (cookie: string, input: Record<string, unknown>) =>
    trpcMutate<RefundExecRes>('refund.execute', { cookie, input });
  interface RefundDayStats {
    date: string; count: number; totalFen: number;
    segments: { cashFen: number; wechatFen: number; alipayFen: number; passFen: number; storedValueFen: number };
  }
  const dayStats = (date: string) => trpcQuery<RefundDayStats>('refund.dayStats', { cookie: ownerCookie, input: { date } });
  /** store 频道事件计数（event_outbox 实证，SSE 数据源同表） */
  const storeEventsOf = async (eventType: string, match: (payload: Record<string, unknown>) => boolean) =>
    (await db.select().from(schema.eventOutbox)).filter(
      (r) => r.eventType === eventType && r.channel === `store:${storeId}` && match((r.payload ?? {}) as Record<string, unknown>),
    );

  /* ---------- 27. 清单①：店员 clerk 无退款入口（server 403 明文） ---------- */
  console.log('\n[R12] 27. 权限闸：店员 clerk 403（清单①）');
  const clerkPrev = await asErr(trpcMutate('refund.preview', { cookie: clerkCookie, input: { billNo: billC.billNo, type: 'full' } }));
  const clerkExec = await asErr(execRefund(clerkCookie, { billNo: billC.billNo, type: 'full', reason: 'clerk 越权验证' }));
  const clerkList = await asErr(trpcQuery('refund.list', { cookie: clerkCookie }));
  check('R12① 店员 clerk 退款无入口（preview / execute / list 全 403 FORBIDDEN）',
    [clerkPrev, clerkExec, clerkList].every((r) => r instanceof TrpcHttpError && r.httpStatus === 403 && r.code === 'FORBIDDEN'),
    [clerkPrev, clerkExec, clerkList].map((r) => r && `${r.httpStatus}:${r.code}`));

  /* ---------- 28. 清单②+⑭：店长 ≤ 阈值现金单全额退，六联动同事务 ---------- */
  console.log('\n[R12] 28. 店长≤阈值全额退：六联动 + rebate 列位（清单②+⑭）');
  const prod28 = (await db.select().from(schema.products).where(eq(schema.products.id, prod.id)).get())!;
  const mgrBill = await settleBill2(
    [{ kind: 'service', refId: service.id }, { kind: 'product', refId: prod.id }],
    { note: 'e2e R12 店长全额退单' },
  ); // 8800 + 商品价 ≤ 50000 阈值
  const stockAtSettle28 = prod28.stock - 1; // 结账已扣 1
  const fullRefund = await execRefund(managerCookie, { billNo: mgrBill.billNo, type: 'full', reason: '店长全额退（≤阈值六联动）' });
  check('R12② 店长≤阈值发起即执行（executed + 自批 approver=本人 + 幂等标记 false）',
    fullRefund.refund.status === 'executed' && fullRefund.idempotent === false &&
      fullRefund.refund.operatorId === managerFix.id && fullRefund.refund.approverId === managerFix.id,
    { status: fullRefund.refund.status, amount: fullRefund.refund.amountFen });
  check('R12② 全额退金额=可退余额全退（=原单已收）', fullRefund.refund.amountFen === mgrBill.payableFen, { refund: fullRefund.refund.amountFen, payable: mgrBill.payableFen });
  const linkage28 = fullRefund.refund.linkageJson ?? {};
  check('R12⑭ 六联动快照含回馈金扣回列位（rebateClawbackFen 键存在且=0，R11 冻结回归）',
    'rebateClawbackFen' in linkage28 && linkage28.rebateClawbackFen === 0, Object.keys(linkage28));
  check('R12② 快照六联动列位齐全（segments 支付段回补 / stockRestock 库存回补 / 提成冲减预估 / 阈值口径）',
    Array.isArray(linkage28.segments) && Array.isArray(linkage28.stockRestock) &&
      typeof linkage28.estimatedCommissionClawbackFen === 'number' && linkage28.thresholdFen === 50000,
    { keys: Object.keys(linkage28).length, threshold: linkage28.thresholdFen });
  const mgrBillRow = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, mgrBill.billId)).get();
  check('R12② 原单挂 refund_status=refunded + refund_bill_no 双向回指（已收 paidFen 一字未改）',
    mgrBillRow?.refundStatus === 'refunded' && mgrBillRow.refundBillNo === fullRefund.refund.refundNo &&
      mgrBillRow.paidFen === mgrBill.payableFen,
    { refundStatus: mgrBillRow?.refundStatus, refundBillNo: mgrBillRow?.refundBillNo, paidFen: mgrBillRow?.paidFen });
  const stockAfterRefund28 = (await db.select().from(schema.products).where(eq(schema.products.id, prod.id)).get())!.stock;
  const refundMoves28 = await db.select().from(schema.stockMovements)
    .where(and(eq(schema.stockMovements.sourceType, 'refund'), eq(schema.stockMovements.sourceId, fullRefund.refund.refundNo)));
  check('R12② 库存回补：stock_movements 来源 refund 前后值真实（delta=+1）+ products.stock 回补',
    refundMoves28.length === 1 && refundMoves28[0]!.delta === 1 &&
      refundMoves28[0]!.beforeStock === stockAtSettle28 && refundMoves28[0]!.afterStock === stockAtSettle28 + 1 &&
      stockAfterRefund28 === stockAtSettle28 + 1,
    { moves: refundMoves28.length, stockAfterRefund28 });
  check('R12② RefundExecuted 事件到店频道（店长视图/财务联动，event_outbox 实证）',
    (await storeEventsOf('refund.executed', (p) => p.refundNo === fullRefund.refund.refundNo)).length === 1,
    fullRefund.refund.refundNo);
  check('R12② 预约行清零口径不适用对照：服务行非预约行，无 appointmentReverts（本单纯服务+商品）',
    Array.isArray((linkage28.appointmentReverts as unknown[]) ?? []) && (linkage28.appointmentReverts as unknown[]).length === 0,
    linkage28.appointmentReverts);

  /* ---------- 29. 清单③（V1）：拆分两笔累计超阈值顶到店主 ---------- */
  console.log('\n[R12] 29. V1 拆分累计阈值（清单③）');
  const staple = (await db.select().from(schema.products).where(and(eq(schema.products.storeId, storeId), eq(schema.products.name, '全价成犬粮 2kg'))).get())!;
  const bigBill = await settleBill2([{ kind: 'product', refId: staple.id, qty: 5 }], { note: 'e2e R12 V1 拆分阈值单' }); // 12900×5=64500
  check('R12③ 前置：大单 64500 分 settled（店长阈值 50000 分）', bigBill.payableFen === 64500, bigBill);
  const split1 = await execRefund(managerCookie, { billNo: bigBill.billNo, type: 'partial_amount', amountFen: 30000, reason: 'V1 拆分第一笔' });
  check('R12③ 店长第一笔 30000 成（原单累计 30000 ≤ 50000）',
    split1.refund.status === 'executed' && split1.refund.amountFen === 30000, split1.refund.amountFen);
  const split2 = await asErr(execRefund(managerCookie, { billNo: bigBill.billNo, type: 'partial_amount', amountFen: 30000, reason: 'V1 拆分第二笔' }));
  check('R12③ 第二笔累计 60000>50000 → FORBIDDEN「该单累计退款已达店长上限，须店主」（V1 按原单累计校验堵拆分绕过）',
    split2 instanceof TrpcHttpError && split2.httpStatus === 403 && split2.code === 'FORBIDDEN' && split2.message.includes('累计退款已达店长上限'),
    split2 && { status: split2.httpStatus, message: split2.message });
  const split2Owner = await execRefund(ownerCookie, { billNo: bigBill.billNo, type: 'partial_amount', amountFen: 30000, reason: 'V1 拆分第二笔（店主执行）' });
  check('R12③ 店主执行成功（累计 60000/64500，可退余额余 4500）',
    split2Owner.refund.status === 'executed' && split2Owner.refund.amountFen === 30000, split2Owner.refund.amountFen);

  /* ---------- 30. 清单④（V2）：日结现金段净额 ---------- */
  console.log('\n[R12] 30. V2 日结退款单列 + 现金段净额（清单④）');
  const comboBill = await settleBill2([{ kind: 'service', refId: service.id }], {
    payments: (p) => [{ method: 'cash', amountFen: 5000 }, { method: 'wechat', amountFen: p - 5000 }],
    note: 'e2e R12 V2 现金微信组合单',
  }); // 8800 = cash 5000 + wechat 3800
  interface TenderRes { receivedTotalFen: number; tender: { cashFen: number } }
  const v2StatsBefore = await dayStats(storeToday);
  const tenderBefore = await trpcQuery<TenderRes>('store.todayTenderStats', { cookie: ownerCookie });
  const v2Refund = await execRefund(managerCookie, { billNo: comboBill.billNo, type: 'partial_amount', amountFen: 4400, reason: 'V2 组合单部分退' });
  const v2StatsAfter = await dayStats(storeToday);
  const tenderAfter = await trpcQuery<TenderRes>('store.todayTenderStats', { cookie: ownerCookie });
  check('R12④ dayStats 当日退款单列（总额 +4400；现金段退款 +2500 / 微信段 +1900，按段占比分摊精确到分）',
    v2Refund.refund.bizDate === storeToday &&
      v2StatsAfter.totalFen - v2StatsBefore.totalFen === 4400 &&
      v2StatsAfter.segments.cashFen - v2StatsBefore.segments.cashFen === 2500 &&
      v2StatsAfter.segments.wechatFen - v2StatsBefore.segments.wechatFen === 1900,
    { dTotal: v2StatsAfter.totalFen - v2StatsBefore.totalFen, dCash: v2StatsAfter.segments.cashFen - v2StatsBefore.segments.cashFen, dWechat: v2StatsAfter.segments.wechatFen - v2StatsBefore.segments.wechatFen });
  check('R12④ 已收不涂改 + 当日净额=已收−退款算术成立（净额恰 −4400；现金段净额=现金已收−现金退款恰 −2500）',
    tenderAfter.receivedTotalFen === tenderBefore.receivedTotalFen &&
      (tenderAfter.receivedTotalFen - v2StatsAfter.totalFen) - (tenderBefore.receivedTotalFen - v2StatsBefore.totalFen) === -4400 &&
      (tenderAfter.tender.cashFen - v2StatsAfter.segments.cashFen) - (tenderBefore.tender.cashFen - v2StatsBefore.segments.cashFen) === -2500,
    { receivedBefore: tenderBefore.receivedTotalFen, receivedAfter: tenderAfter.receivedTotalFen });

  /* ---------- 31. 清单⑤+⑪（V3）：组合支付 6:4 分摊回补 + 涉储值店长拦截 ---------- */
  console.log('\n[R12] 31. V3 6:4 分摊回补 + 涉储值拦截（清单⑤+⑪）');
  const svAcc = (await db.insert(schema.storedValueAccounts)
    .values({ userId: customerUser!.id, storeId, principalFen: 100000, bonusFen: 0 })
    .returning())[0]!; // 储值账户夹具直插（生产仅 R5b CSV 导入建户；e2e 不走路径外入口）
  const svBill = await settleBill2([{ kind: 'service', refId: service.id }], {
    customerId: customerUser!.id,
    payments: (p) => [{ method: 'cash', amountFen: Math.round(p * 0.6) }, { method: 'stored_value', amountFen: p - Math.round(p * 0.6) }],
    note: 'e2e R12 V3 现金6储值4组合单',
  }); // 8800 = cash 5280 + 储值 3520
  const accAfterSettle = await db.select().from(schema.storedValueAccounts).where(eq(schema.storedValueAccounts.id, svAcc.id)).get();
  check('R12⑤ 前置：储值段结账扣减（余额 100000 → 96480，先本金后赠送）',
    !!accAfterSettle && accAfterSettle.principalFen + accAfterSettle.bonusFen === 96480,
    accAfterSettle && accAfterSettle.principalFen + accAfterSettle.bonusFen);
  const mgrSv = await asErr(execRefund(managerCookie, { billNo: svBill.billNo, type: 'partial_amount', amountFen: 4400, reason: '店长涉储值验证' }));
  check('R12⑪ 涉储值单店长明文拦截（FORBIDDEN「储值退款须店主」，运营加固不设阈值）',
    mgrSv instanceof TrpcHttpError && mgrSv.httpStatus === 403 && mgrSv.code === 'FORBIDDEN' && mgrSv.message.includes('储值退款须店主'),
    mgrSv && { status: mgrSv.httpStatus, message: mgrSv.message });
  const svRefund = await execRefund(ownerCookie, { billNo: svBill.billNo, type: 'partial_amount', amountFen: 4400, reason: 'V3 按金额退 50%（6:4 分摊回补）' });
  const segs31 = svRefund.plan?.segments ?? [];
  const cashSeg31 = segs31.find((s) => s.method === 'cash');
  const svSeg31 = segs31.find((s) => s.method === 'stored_value');
  check('R12⑤ 组合支付 6:4 分摊回补精确到分（cash 2640 线下原路待登记 / 储值 1760 余额回补）',
    cashSeg31?.amountFen === 2640 && cashSeg31.channel === 'offline_pending' &&
      svSeg31?.amountFen === 1760 && svSeg31.channel === 'stored_value_restore' &&
      svRefund.refund.amountFen === 4400,
    segs31.map((s) => `${s.method}:${s.amountFen}`));
  const accAfterRefund = await db.select().from(schema.storedValueAccounts).where(eq(schema.storedValueAccounts.id, svAcc.id)).get();
  const svLogs31 = await db.select().from(schema.storedValueLogs).where(eq(schema.storedValueLogs.billNo, svBill.billNo));
  const restoreLog31 = svLogs31.find((l) => l.deltaFen > 0);
  check('R12⑤ 储值余额回补前后值留痕（96480 → 98240；stored_value_logs 正向行 note 关联退款单号）',
    !!accAfterRefund && accAfterRefund.principalFen + accAfterRefund.bonusFen === 98240 &&
      restoreLog31?.balanceBeforeFen === 96480 && restoreLog31.balanceAfterFen === 98240 &&
      (restoreLog31.note ?? '').includes(svRefund.refund.refundNo),
    { balance: accAfterRefund && accAfterRefund.principalFen + accAfterRefund.bonusFen, restoreLog: restoreLog31 && { before: restoreLog31.balanceBeforeFen, after: restoreLog31.balanceAfterFen, note: restoreLog31.note } });

  /* ---------- 32. 清单⑥（V4）：寄养提前接回退剩余晚 ---------- */
  console.log('\n[R12] 32. V4 寄养剩余晚退（清单⑥）');
  const boardingSvc = (await db.select().from(schema.services).where(and(eq(schema.services.storeId, storeId), eq(schema.services.type, 'boarding'))).get())!;
  const bStart = new Date(`${storeYesterday}T15:00:00+08:00`); // 昨日入住（+8 日界）→ 已发生 1 晚
  const boardingAppt = (await db.insert(schema.appointments).values({
    code: 'E2EBD1', customerId: customerUser!.id, storeId, petId, serviceId: boardingSvc.id,
    type: 'boarding', scheduledStart: bStart, scheduledEnd: new Date(bStart.getTime() + 3 * 86400_000),
    status: 'completed', priceFen: 59700, completedAt: new Date(), note: 'e2e R12 寄养 3 晚单（夹具直插）',
  }).returning())[0]!;
  const bBill = await settleBill2([{ kind: 'appointment', refId: boardingAppt.id }], { note: 'e2e R12 寄养结账' }); // 19900×3=59700 全现金
  const tooMany = await asErr(execRefund(ownerCookie, { billNo: bBill.billNo, type: 'boarding_nights', nights: 3, reason: '超剩余晚数验证' }));
  check('R12⑥ 已发生晚一分不退（退 3 晚 > 剩余 2 晚 → BAD_REQUEST「剩余可退晚数不足」明文）',
    tooMany instanceof TrpcHttpError && tooMany.code === 'BAD_REQUEST' && tooMany.message.includes('剩余可退晚数不足'),
    tooMany && { code: tooMany.code, message: tooMany.message });
  const bRefund = await execRefund(ownerCookie, { billNo: bBill.billNo, type: 'boarding_nights', nights: 2, reason: '提前接回退剩余 2 晚' });
  check('R12⑥ 寄养退剩余 2 晚：金额=剩余晚×晚单价（floor(59700÷3)×2=39800）', bRefund.refund.amountFen === 39800, bRefund.refund.amountFen);
  const nightRow = (await db.select().from(schema.refundBillItems)
    .where(and(eq(schema.refundBillItems.refundId, bRefund.refund.id), eq(schema.refundBillItems.kind, 'night'))))[0];
  const nightDetail = (nightRow?.detailJson ?? {}) as Record<string, unknown>;
  check('R12⑥ 分段明细透出（总 3 晚 / 已住 1 晚不退 / 退 2 晚（qty 列）/ 晚单价 19900）',
    nightRow?.qty === 2 && nightRow.amountFen === 39800 &&
      nightDetail.totalNights === 3 && nightDetail.occurredNights === 1 && nightDetail.perNightFen === 19900,
    nightDetail);
  check('R12⑥ 按支付段占比回补（全现金单 → cash 段 39800 线下原路）',
    bRefund.plan?.segments.find((s) => s.method === 'cash')?.amountFen === 39800, bRefund.plan?.segments);
  const bApptAfter = await db.select().from(schema.appointments).where(eq(schema.appointments.id, boardingAppt.id)).get();
  check('R12⑥ 只退钱不动预约单（status/paidAt 原样；退住核销由寄养域既有流程承担）',
    bApptAfter?.status === 'completed' && bApptAfter.paidAt !== null, { status: bApptAfter?.status, paidAt: bApptAfter?.paidAt });

  /* ---------- 33. 清单⑦（V5）：已冲正/已撤单无退款入口 ---------- */
  console.log('\n[R12] 33. V5 终态禁退（清单⑦）');
  const rvBill = await settleBill2([{ kind: 'product', refId: prod.id }], { note: 'e2e R12 V5 冲正单' });
  await trpcMutate('cashier.reverseBill', { cookie: ownerCookie, input: { billNo: rvBill.billNo, reason: 'R12 冲正禁退验证' } });
  const rvRow = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, rvBill.billId)).get();
  const rvRefund = await asErr(execRefund(ownerCookie, { billNo: rvBill.billNo, type: 'full', reason: '冲正单退款验证' }));
  const vdHeld = await trpcMutate<{ bill: { billNo: string } }>('cashier.hold', {
    cookie: ownerCookie,
    input: { items: [{ kind: 'product', refId: prod.id }], discountType: 'none', discountValue: 0, note: 'e2e R12 V5 撤单' },
  });
  await trpcMutate('cashier.voidBill', { cookie: ownerCookie, input: { billNo: vdHeld.bill.billNo, reason: 'R12 撤单禁退验证' } });
  const vdRefund = await asErr(execRefund(ownerCookie, { billNo: vdHeld.bill.billNo, type: 'full', reason: '撤单退款验证' }));
  check('R12⑦ 已冲正单无退款入口（reverseBill 后 execute → BAD_REQUEST「原单已冲正/已撤，不可退款」）',
    !!(rvRow?.reversedAt) && rvRefund instanceof TrpcHttpError && rvRefund.code === 'BAD_REQUEST' && rvRefund.message.includes('已冲正/已撤'),
    rvRefund && { code: rvRefund.code, message: rvRefund.message });
  check('R12⑦ 已撤单无退款入口（voided → 同明文拒）',
    vdRefund instanceof TrpcHttpError && vdRefund.code === 'BAD_REQUEST' && vdRefund.message.includes('已冲正/已撤'),
    vdRefund && { code: vdRefund.code, message: vdRefund.message });

  /* ---------- 34. 清单⑧（V6）：部分退提成按比例冲减 + 跨月调整项 ---------- */
  console.log('\n[R12] 34. V6 提成冲减（清单⑧）');
  interface R12CommLine { billId: string; itemId: string; refId: string; name: string; amountFen: number; refundRatioBp: number; refundClawbackFen: number; refunded: boolean }
  interface R12SummaryT {
    payload: {
      commissionTotalFen: number;
      serviceLines: R12CommLine[];
      adjustments: Array<{ refundNo: string; billNo: string; itemId: string; name: string; clawbackFen: number }>;
      adjustmentsTotalFen: number;
    };
  }
  // ① 同月行内冲减：阿强洗护单 10000（现行率 25% → 毛提成 2500）
  const apptV6 = (await db.insert(schema.appointments).values({
    code: 'E2EV6A', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: aqiang.id, note: 'e2e R12 V6 同月单',
  }).returning())[0]!;
  const billV6 = await settleBill2([{ kind: 'appointment', refId: apptV6.id }], { note: 'e2e R12 V6 同月冲减单' });
  await execRefund(ownerCookie, { billNo: billV6.billNo, type: 'partial_amount', amountFen: 5000, reason: 'V6 部分退 50%' });
  const sumV6a = await trpcQuery<R12SummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const lineV6a = sumV6a.payload.serviceLines.find((l) => l.billId === billV6.billId);
  check('R12⑧ 部分退 50% → 该行提成减半精确到分（毛 2500 → 净 1250，refundRatioBp=5000，refunded=false）',
    lineV6a?.amountFen === 1250 && lineV6a.refundClawbackFen === 1250 && lineV6a.refundRatioBp === 5000 && lineV6a.refunded === false,
    lineV6a);
  await execRefund(ownerCookie, { billNo: billV6.billNo, type: 'partial_amount', amountFen: 5000, reason: 'V6 退剩余 50%' });
  const sumV6b = await trpcQuery<R12SummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const lineV6b = sumV6b.payload.serviceLines.find((l) => l.billId === billV6.billId);
  check('R12⑧ 退完全额 → 该行提成归零 + refunded 标记（冲减合计 2500=毛提成全额）',
    lineV6b?.amountFen === 0 && lineV6b.refunded === true && lineV6b.refundClawbackFen === 2500, lineV6b);

  // ② 跨月调整项：源单回填上月 + 上月快照 → 今日退款差额进当月「调整项」，不动快照。
  //    历史规则行回填：种子 effective_from=2026-09-20，早于该日的源单需 v0 历史行兜底取率
  //    （active=false 不污染当前生效集；ruleAtFn 按全表 effective_from 时序解析，口径同 §24）。
  await db.insert(schema.commissionRules).values({
    version: 0, ruleKey: 'commission_grooming_rate', label: 'e2e 历史规则回填（V6 跨月夹具）',
    valueJson: { rate_bp: 2000 }, effectiveFrom: new Date('2020-01-01T00:00:00+08:00'), active: false, createdBy: ownerUser!.id,
  });
  const backTs = new Date(`${prevMonthStr}-15T12:00:00`); // 服务器本地时区口径（commission 月界同帧）
  const apptV6X = (await db.insert(schema.appointments).values({
    code: 'E2EV6X', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: backTs, scheduledEnd: backTs,
    status: 'completed', priceFen: 20000, completedAt: backTs, staffId: aqiang.id, note: 'e2e R12 V6 跨月源单',
  }).returning())[0]!;
  const billV6X = await settleBill2([{ kind: 'appointment', refId: apptV6X.id }], { note: 'e2e R12 V6 跨月源单结账' });
  // 结账时点回填上月（计提月份+规则时序同按 settled_at）。
  // 注意：createdAt 一律不回填——cashier.genBillNo 按 createdAt 计当日单数分配单号，
  // 回填会减少当日计数导致后续单号复用撞 UNIQUE（本轮实测 HD-…-021 撞号 500）。
  await db.update(schema.cashierBills).set({ settledAt: backTs, updatedAt: new Date() })
    .where(eq(schema.cashierBills.id, billV6X.billId));
  const snapRes = await trpcMutate<{ commission: number; performance: number }>('commission.snapshotMonth', {
    cookie: ownerCookie, input: { month: prevMonthStr },
  });
  const snapBefore = await db.select().from(schema.commissionSnapshots)
    .where(and(eq(schema.commissionSnapshots.staffId, aqiang.id), eq(schema.commissionSnapshots.period, prevMonthStr), eq(schema.commissionSnapshots.kind, 'commission')))
    .get();
  check('R12⑧ 前置：上月快照落库（阿强毛提成=20000×20%=4000 冻结于快照）',
    snapRes.commission > 0 && snapBefore?.totalFen === 4000, { snap: snapRes, totalFen: snapBefore?.totalFen });
  const totalBeforeAdj = sumV6b.payload.commissionTotalFen;
  const v6x = await execRefund(ownerCookie, { billNo: billV6X.billNo, type: 'partial_amount', amountFen: 10000, reason: 'V6 跨月退 50%' });
  const sumV6c = await trpcQuery<R12SummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const adj = sumV6c.payload.adjustments.find((a) => a.refundNo === v6x.refund.refundNo);
  check('R12⑧ 跨月退款差额进当月「调整项」（mySummary.adjustments 透出 refundNo + 冲减 2000=4000×50%）',
    adj?.clawbackFen === 2000 && adj.billNo === billV6X.billNo && sumV6c.payload.adjustmentsTotalFen === 2000, adj);
  check('R12⑧ 调整项从当月提成总额减除（commissionTotalFen 恰 −2000）',
    sumV6c.payload.commissionTotalFen === totalBeforeAdj - 2000,
    { before: totalBeforeAdj, after: sumV6c.payload.commissionTotalFen });
  const snapAfter = await db.select().from(schema.commissionSnapshots)
    .where(and(eq(schema.commissionSnapshots.staffId, aqiang.id), eq(schema.commissionSnapshots.period, prevMonthStr), eq(schema.commissionSnapshots.kind, 'commission')))
    .get();
  check('R12⑧ 已快照月份不动（snapshot totalFen/payload 前后一致）',
    !!snapBefore && !!snapAfter && snapAfter.totalFen === snapBefore.totalFen &&
      JSON.stringify(snapAfter.payloadJson) === JSON.stringify(snapBefore.payloadJson),
    { before: snapBefore?.totalFen, after: snapAfter?.totalFen });

  /* ---------- 35. 清单⑨（V7）：跨日退款入发生日日结，不回填封箱历史 ---------- */
  console.log('\n[R12] 35. V7 跨日退款（清单⑨）');
  const yBill = await settleBill2([{ kind: 'product', refId: prod.id }], { note: 'e2e R12 V7 昨日单' });
  const yTs = new Date(`${storeYesterday}T12:00:00+08:00`);
  await db.update(schema.cashierBills).set({ settledAt: yTs, updatedAt: new Date() })
    .where(eq(schema.cashierBills.id, yBill.billId)); // 仅回填 settledAt（createdAt 回填会撞 genBillNo 当日序号，见 §34 注释）
  const shiftRow = await db.select().from(schema.shifts).where(eq(schema.shifts.storeId, storeId)).get();
  const yClose = (await db.insert(schema.dayCloses).values({
    storeId, shiftId: shiftRow!.id, kind: 'close', bizDate: storeYesterday,
    bookCashFen: yBill.payableFen, actualCashFen: yBill.payableFen, diffFen: 0,
    cashierPaidCount: 1, paidCount: 1, status: 'frozen', createdBy: ownerUser!.id,
  }).returning())[0]!; // 昨日已日结封箱夹具（冻结态）
  const yStatsBefore = await dayStats(storeYesterday);
  const tStatsBefore = await dayStats(storeToday);
  const yRefund = await execRefund(ownerCookie, { billNo: yBill.billNo, type: 'partial_amount', amountFen: 1000, reason: 'V7 跨日退款' });
  check('R12⑨ 跨日退款入发生日（refund_bills.biz_date=今日，不回填昨日）', yRefund.refund.bizDate === storeToday, { bizDate: yRefund.refund.bizDate, storeToday });
  const yStatsAfter = await dayStats(storeYesterday);
  const tStatsAfter = await dayStats(storeToday);
  check('R12⑨ dayStats 今日含该退款（+1000）、昨日不含（昨日 count/total 原样）',
    tStatsAfter.totalFen - tStatsBefore.totalFen === 1000 &&
      yStatsAfter.totalFen === yStatsBefore.totalFen && yStatsAfter.count === yStatsBefore.count,
    { todayDelta: tStatsAfter.totalFen - tStatsBefore.totalFen, yesterday: [yStatsBefore.totalFen, yStatsAfter.totalFen] });
  const yCloseAfter = await db.select().from(schema.dayCloses).where(eq(schema.dayCloses.id, yClose.id)).get();
  check('R12⑨ 昨日已封箱日结行不变（bookCash/status/frozen 原样，封箱历史不涂改）',
    yCloseAfter?.bookCashFen === yClose.bookCashFen && yCloseAfter.status === 'frozen' && !yCloseAfter.reversedAt,
    { before: yClose.bookCashFen, after: yCloseAfter?.bookCashFen, status: yCloseAfter?.status });

  /* ---------- 36. 清单⑩（V8）：次卡赠次不计价 + 涉储值退卡店长拦截 ---------- */
  console.log('\n[R12] 36. V8 次卡退卡（清单⑩+⑪ 附证）');
  await trpcMutate('pass.topUp', { cookie: ownerCookie, input: { userId: customerUser!.id, times: 12 } }); // 付费 10 + 赠 2 口径由店主录入留痕（无金额台账，报备偏差 1）
  const passRow0 = await db.select().from(schema.memberPasses).where(and(eq(schema.memberPasses.userId, customerUser!.id), eq(schema.memberPasses.storeId, storeId))).get();
  check('R12⑩ 前置：次卡建卡（total=12 remain=12）', passRow0?.totalTimes === 12 && passRow0.remainTimes === 12, passRow0 && { total: passRow0.totalTimes, remain: passRow0.remainTimes });
  const passBill = await settleBill2(
    Array.from({ length: 6 }, () => ({ kind: 'service' as const, refId: service.id, paidByPass: true })),
    { customerId: customerUser!.id, payments: (p) => [{ method: 'pass', amountFen: p }], note: 'e2e R12 V8 扣次 6 行单' },
  );
  void passBill;
  const passRow1 = await db.select().from(schema.memberPasses).where(and(eq(schema.memberPasses.userId, customerUser!.id), eq(schema.memberPasses.storeId, storeId))).get();
  check('R12⑩ 前置：扣次 6 次（remain 12→6；付费先消耗 → 剩付费 4 + 赠 2）', passRow1?.remainTimes === 6, passRow1?.remainTimes);
  // 锚点单：该客户在本店的任一 settled 单（anchor_only：金额与其无关、不挂标记）
  const anchorBill = (await db.select().from(schema.cashierBills)
    .where(and(eq(schema.cashierBills.customerId, customerUser!.id), eq(schema.cashierBills.status, 'settled'))).get())!;
  const mgrCancel = await asErr(execRefund(managerCookie, {
    billNo: anchorBill.billNo, type: 'pass_cancel', passId: passRow1!.id,
    passPaidFen: 10000, passPaidTimes: 10, passGiftTimes: 2, reason: '店长退卡验证', refundMethod: 'offline_original',
  }));
  check('R12⑪ 次卡退卡涉储值 → 店长 FORBIDDEN「储值退款须店主」（type=pass_cancel 天然涉储值）',
    mgrCancel instanceof TrpcHttpError && mgrCancel.httpStatus === 403 && mgrCancel.code === 'FORBIDDEN' && mgrCancel.message.includes('储值退款须店主'),
    mgrCancel && { status: mgrCancel.httpStatus, message: mgrCancel.message });
  const cancel = await execRefund(ownerCookie, {
    billNo: anchorBill.billNo, type: 'pass_cancel', passId: passRow1!.id,
    passPaidFen: 10000, passPaidTimes: 10, passGiftTimes: 2, reason: '次卡退卡（剩付费 4 次）', refundMethod: 'offline_original',
  });
  check('R12⑩ 折算=剩余付费 4 次 ×（实付 10000 ÷ 付费 10 次）=4000（赠次不计价）',
    cancel.refund.status === 'executed' && cancel.refund.amountFen === 4000, cancel.refund.amountFen);
  const pc36 = (cancel.refund.linkageJson?.passCancel ?? {}) as Record<string, unknown>;
  check('R12⑩ 快照明示：剩余付费 4 / 赠次 2 随退作废不计价（giftVoided=2）',
    pc36.remainingPaidTimes === 4 && pc36.giftVoided === 2 && pc36.giftTimes === 2 && pc36.remainTimesBefore === 6, pc36);
  const passRow2 = await db.select().from(schema.memberPasses).where(eq(schema.memberPasses.id, passRow1!.id)).get();
  const passLogs = await db.select().from(schema.passDeductLogs).where(eq(schema.passDeductLogs.passId, passRow1!.id));
  check('R12⑩ 退卡后卡作废留痕（status=disabled + remain=0 + 负向流水 note 含「赠次作废 2」）',
    passRow2?.status === 'disabled' && passRow2.remainTimes === 0 &&
      passLogs.some((l) => l.delta === -6 && (l.note ?? '').includes('赠次作废 2')),
    { status: passRow2?.status, remain: passRow2?.remainTimes, logs: passLogs.map((l) => `${l.delta}:${l.note}`) });
  check('R12⑩ 锚点单不挂退款标记（anchor_only：原单 refund_status 仍 NULL）',
    (await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, anchorBill.id)).get())?.refundStatus === null,
    anchorBill.billNo);
  const cancelAgain = await asErr(execRefund(ownerCookie, {
    billNo: anchorBill.billNo, type: 'pass_cancel', passId: passRow1!.id,
    passPaidFen: 10000, passPaidTimes: 10, passGiftTimes: 2, reason: '重复退卡验证', refundMethod: 'offline_original',
  }));
  check('R12⑩ 重复退卡幂等拒（卡已作废 → BAD_REQUEST「不可重复退卡」）',
    cancelAgain instanceof TrpcHttpError && cancelAgain.code === 'BAD_REQUEST' && cancelAgain.message.includes('不可重复退卡'),
    cancelAgain && { code: cancelAgain.code, message: cancelAgain.message });

  /* ---------- 37. 清单⑫：部分退款余额内可再退 ---------- */
  console.log('\n[R12] 37. 部分退款余额内可再退（清单⑫）');
  const reBill = await settleBill2([{ kind: 'service', refId: service.id }], { note: 'e2e R12 余额再退单' }); // 8800 现金
  const re1 = await execRefund(managerCookie, { billNo: reBill.billNo, type: 'partial_amount', amountFen: 2640, reason: '先退 30%' });
  const re2 = await execRefund(managerCookie, { billNo: reBill.billNo, type: 'partial_amount', amountFen: 1760, reason: '再退 20%' });
  check('R12⑫ 余额内可再退（30%→2640 成，再 20%→1760 成；累计 4400 ≤ 8800）',
    re1.refund.status === 'executed' && re2.refund.status === 'executed' && re2.refund.amountFen === 1760,
    [re1.refund.amountFen, re2.refund.amountFen]);
  const re3 = await asErr(execRefund(managerCookie, { billNo: reBill.billNo, type: 'partial_amount', amountFen: 4401, reason: '超可退余额验证' }));
  check('R12⑫ 累计超可退余额硬拒（4400+4401 > 8800 → BAD_REQUEST「超过原单可退余额」）',
    re3 instanceof TrpcHttpError && re3.code === 'BAD_REQUEST' && re3.message.includes('可退余额'),
    re3 && { code: re3.code, message: re3.message });

  /* ---------- 38. 清单⑬：实退待办 + settleActual 幂等 ---------- */
  console.log('\n[R12] 38. 实退待办（清单⑬）');
  // 造「executed 超 24h 未登记」夹具：直插 25h 前的 executed 退款行（挂 §37 reBill）。
  // 不回填真实退款单 createdAt——genRefundNo 按 createdAt 计当日序号，回填减计数会让后续
  // 退款单号复用撞 UNIQUE（本轮实测 RB-…-013 撞号 500；与 §34 收银 genBillNo 教训同型）。
  const agedRefund = (await db.insert(schema.refundBills).values({
    storeId, refundNo: 'RB-19990101-001', bizDate: storeYesterday, billId: reBill.billId,
    type: 'partial_amount', amountFen: 2640, reason: 'e2e 实退待办夹具（回填 25h 前）',
    status: 'executed', operatorId: ownerUser!.id, approverId: ownerUser!.id,
    createdAt: new Date(Date.now() - 25 * 3600 * 1000),
  }).returning())[0]!;
  const todoBefore = await trpcQuery<Array<{ id: string; refundNo: string }>>('refund.pendingActual', { cookie: managerCookie });
  check('R12⑬ 实退待办：executed 超 24h 未登记 → pendingActual 含（店长本店可办）',
    todoBefore.some((r) => r.id === agedRefund.id), todoBefore.map((r) => r.refundNo));
  const settle1 = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: agedRefund.id, note: '线下原路已退（现金 2640）' },
  });
  check('R12⑬ 实退登记 → settled（+RefundSettled 事件到店频道）',
    settle1.refund.status === 'settled' && settle1.idempotent === false &&
      (await storeEventsOf('refund.settled', (p) => p.refundNo === agedRefund.refundNo)).length === 1,
    settle1.refund.status);
  const settle2 = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: agedRefund.id, note: '重复登记验证' },
  });
  check('R12⑬ 重复登记幂等（idempotent=true，事件不重复增发）',
    settle2.idempotent === true && settle2.refund.status === 'settled' &&
      (await storeEventsOf('refund.settled', (p) => p.refundNo === agedRefund.refundNo)).length === 1,
    settle2.idempotent);
  const todoAfter = await trpcQuery<Array<{ id: string }>>('refund.pendingActual', { cookie: managerCookie });
  check('R12⑬ 实退登记后待办消失（pendingActual 不再含该单）', !todoAfter.some((r) => r.id === agedRefund.id), todoAfter.length);

  /* ==================================================================
   * 批次 R11a（会员前置批·骨架批）验收段 —— 28 号施工令全清单 + 回归
   * 主线夹具：示例客户（萤火会员）；manager（店长，staff 绑定）售卡/续费/退会。
   * ================================================================== */
  console.log('\n[R11a] 39. 售卡三档 + 售卡提成定额 + 双归属 + 微光开档幂等');
  interface MembershipRowT {
    id: string; userId: string; planKey: string; soldStoreId: string | null;
    status: string; petCount: number; paidFen: number; expiresAt: Date; refundFen: number | null;
  }
  interface SellRes { billNo: string; billId: string; amountFen: number; membership: MembershipRowT }
  const sellPlan = (cookie: string, input: Record<string, unknown>) =>
    trpcMutate<SellRes>('membership.sell', { cookie, input });

  // ① 萤火售卖到店付（manager 开单）：成交即开通 + sold_store=办卡店（双归属）
  const sellYinghuo = await sellPlan(managerCookie, {
    userId: customerUser!.id, planKey: 'plan_yinghuo', petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  });
  check('R11a⑧ 萤火售卖到店付（现金段 19900，成交即开通 active）',
    sellYinghuo.amountFen === 19900 && sellYinghuo.membership.status === 'active' &&
      sellYinghuo.membership.planKey === 'plan_yinghuo' && sellYinghuo.membership.paidFen === 19900,
    { amount: sellYinghuo.amountFen, status: sellYinghuo.membership.status });
  const yinghuoExpiresDays = (sellYinghuo.membership.expiresAt.getTime() - Date.now()) / 86400_000;
  check('R11a⑧ 有效期=开通+365 天（读表 membership_validity_days）', yinghuoExpiresDays > 364 && yinghuoExpiresDays < 366, yinghuoExpiresDays);
  const sellBillRow = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, sellYinghuo.billId)).get();
  check('R11a⑩ 双归属两字段：memberships.sold_store_id=办卡店 且 售卡单 cashier_bills.store_id=消费店（同店场景两值同帧）',
    sellYinghuo.membership.soldStoreId === storeId && sellBillRow?.storeId === storeId &&
      sellYinghuo.membership.soldStoreId === sellBillRow?.storeId,
    { soldStore: sellYinghuo.membership.soldStoreId, billStore: sellBillRow?.storeId });
  const sellBillItem = await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, sellYinghuo.billId)).get();
  check('R11a⑩ 售卡单落 kind=membership 行（refId=plan_key，提成读侧数据源）',
    sellBillItem?.kind === 'membership' && sellBillItem.refId === 'plan_yinghuo', sellBillItem && { kind: sellBillItem.kind, refId: sellBillItem.refId });

  // ② 烛光/微光售卡（微光 0 元单直接成交，paySegments 空）
  const sellZhuguang = await sellPlan(managerCookie, { phone: '13811110001', planKey: 'plan_zhuguang', petCount: 0, paySegments: [{ method: 'wechat', amountFen: 29900 }] });
  const sellWeiguang = await sellPlan(managerCookie, { phone: '13811110002', planKey: 'plan_weiguang', petCount: 0, paySegments: [] });
  check('R11a⑧ 烛光 29900（微信段）+ 微光 0 元单直接成交（无支付段）',
    sellZhuguang.amountFen === 29900 && sellWeiguang.amountFen === 0 && sellWeiguang.membership.status === 'active',
    { zg: sellZhuguang.amountFen, wg: sellWeiguang.amountFen });

  // ③ 售卡提成定额（commission.cardLines 接通）：归属=开单人 manager
  interface CardLineT { billId: string; plan: string; amountFen: number }
  const mgrSummary1 = await trpcQuery<{ payload: { cardLines: CardLineT[] } }>('commission.mySummary', { cookie: managerCookie, input: {} });
  const cardAmts = mgrSummary1.payload.cardLines.map((l) => `${l.plan}:${l.amountFen}`).sort();
  check('R11a⑧ 售卡提成定额：萤火 500（5 元）/ 烛光 1000（10 元）/ 微光 0 三档入 cardLines（暖阳 2000 同映射表抽单免验）',
    mgrSummary1.payload.cardLines.length === 3 &&
      cardAmts.includes('plan_yinghuo:500') && cardAmts.includes('plan_zhuguang:1000') && cardAmts.includes('plan_weiguang:0'),
    cardAmts);

  // ④ 微光开档幂等（回归）：新客 openFree 两次，第二次 idempotent=true 零副作用
  const freeUser = (await db.insert(schema.users).values({ kimiId: 'seed_e2e_free1', nickname: 'e2e 微光客', phone: '13811110009' }).returning())[0]!;
  await db.insert(schema.userRoles).values({ userId: freeUser.id, role: 'customer' });
  const freeCookie = await devLogin(freeUser.id);
  const of1 = await trpcMutate<{ membership: MembershipRowT; idempotent: boolean }>('membership.openFree', { cookie: freeCookie });
  const of2 = await trpcMutate<{ membership: MembershipRowT; idempotent: boolean }>('membership.openFree', { cookie: freeCookie });
  check('R11a回归 微光一键开档幂等（首次开档 → 第二次 idempotent=true 同档不重建）',
    of1.idempotent === false && of1.membership.planKey === 'plan_weiguang' && of1.membership.paidFen === 0 &&
      of2.idempotent === true && of2.membership.id === of1.membership.id,
    { first: of1.idempotent, second: of2.idempotent });

  // ⑤ D-16 自助开户（急修三件 PD-03 件 3）：口令门内手机号分支——新号建档+登录+微光开档链路
  console.log('\n[急修三件] D-16 自助开户（手机号登录/注册）');
  const newPhone = '13977776666'; // 避开种子/e2e 既有号段（13800000000/1381111xxxx/1390000xxxx）
  const devLoginPhone = async (phone: string) => {
    const res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = (await res.json()) as { ok?: boolean; user?: { id: string; roles?: string[] } };
    return { res, body, cookie: res.ok ? sessionCookieOf(res) : null };
  };
  const reg1 = await devLoginPhone(newPhone);
  check('D-16 新手机号自助开户：注册即建档（customer 角色）并签发会话',
    reg1.res.ok && reg1.body.ok === true && !!reg1.body.user?.roles?.includes('customer'), reg1.body);
  const reg1Of = reg1.cookie
    ? await trpcMutate<{ membership: MembershipRowT; idempotent: boolean }>('membership.openFree', { cookie: reg1.cookie })
    : null;
  check('D-16 注册→登录→微光一键开档链路通（plan_weiguang active）',
    reg1Of?.membership.planKey === 'plan_weiguang' && reg1Of?.membership.status === 'active', reg1Of);
  const reg2 = await devLoginPhone(newPhone);
  check('D-16 同号再登录=同一用户（幂等建档，不重复建行）',
    reg2.res.ok && reg2.body.user?.id === reg1.body.user?.id, { first: reg1.body.user?.id, second: reg2.body.user?.id });
  const badPhone = await devLoginPhone('12345');
  check('D-16 非 11 位手机号 → 400 格式拦截（不建行）',
    badPhone.res.status === 400, { status: badPhone.res.status });

  /* ---------- 40. 清单⑨：多宠第 4 只 +59，10 只封顶 ---------- */
  console.log('\n[R11a] 40. 多宠附加费（清单⑨）');
  const sell4Pets = await sellPlan(managerCookie, { phone: '13811110003', planKey: 'plan_yinghuo', petCount: 4, paySegments: [{ method: 'cash', amountFen: 25800 }] });
  check('R11a⑨ 萤火 4 只 = 19900+5900=25800（第 4 只起 +¥59/年/只）',
    sell4Pets.amountFen === 25800 && sell4Pets.membership.petCount === 4, sell4Pets.amountFen);
  const sell10Pets = await sellPlan(managerCookie, { phone: '13811110004', planKey: 'plan_yinghuo', petCount: 10, paySegments: [{ method: 'cash', amountFen: 61200 }] });
  check('R11a⑨ 10 只封顶内放行（19900+7×5900=61200）', sell10Pets.amountFen === 61200, sell10Pets.amountFen);
  const sell11Pets = await asErr(sellPlan(managerCookie, { phone: '13811110005', planKey: 'plan_yinghuo', petCount: 11, paySegments: [{ method: 'cash', amountFen: 67100 }] }));
  check('R11a⑨ 11 只超封顶 → BAD_REQUEST「多宠封顶 10 只」',
    sell11Pets instanceof TrpcHttpError && sell11Pets.code === 'BAD_REQUEST' && sell11Pets.message.includes('多宠封顶'),
    sell11Pets && { code: sell11Pets.code, message: sell11Pets.message });

  /* ---------- 41. 清单⑦：服务 88 折自动 + 门市价划线 ---------- */
  console.log('\n[R11a] 41. 会员服务折扣（清单⑦）');
  const svcBillMember = await settleBill2([{ kind: 'service', refId: service.id }], { customerId: customerUser!.id, note: 'e2e R11a 萤火服务单' });
  const svcItemMember = await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, svcBillMember.billId)).get();
  check('R11a⑦ 萤火服务单自动 88 折（adjusted=8800×0.88=7744 精确到分，应收=7744）',
    svcItemMember?.adjustedPriceFen === 7744 && svcBillMember.payableFen === 7744,
    { adjusted: svcItemMember?.adjustedPriceFen, payable: svcBillMember.payableFen });
  check('R11a⑦ 门市价划线对照（unit_price_fen=8800 门市价原值不动）', svcItemMember?.unitPriceFen === 8800, svcItemMember?.unitPriceFen);
  const wgUserId = sellWeiguang.membership.userId;
  const svcBillWeiguang = await settleBill2([{ kind: 'service', refId: service.id }], { customerId: wgUserId, note: 'e2e R11a 微光服务单' });
  const svcItemWeiguang = await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, svcBillWeiguang.billId)).get();
  check('R11a⑦ 对照：微光（10000bp）无折扣=门市价 8800（adjusted 留空）',
    svcItemWeiguang?.adjustedPriceFen === null && svcBillWeiguang.payableFen === 8800, svcItemWeiguang?.adjustedPriceFen);

  /* ---------- 42. 清单③+①：回馈金 grant 无月上限 + 三本账无互转 ---------- */
  console.log('\n[R11a] 42. grant 无月上限 + 三本账（清单③+①）');
  // 同月两笔商品单（萤火 2%）：12900×2% = 258/笔
  const gBill1 = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: customerUser!.id, note: 'e2e R11a grant 商品单 1' });
  const gBill2 = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: customerUser!.id, note: 'e2e R11a grant 商品单 2' });
  const myAfterGrants = await trpcQuery<{ rebate: { balanceFen: number; pendingFen: number; status: string } | null }>('membership.my', { cookie: customerCookie });
  check('R11a③ 无月上限：同月两笔 grant 累计 258+258=516 全挂期次（无 cap 截断），未到账口径 balance=0',
    myAfterGrants.rebate?.pendingFen === 516 && myAfterGrants.rebate.balanceFen === 0,
    myAfterGrants.rebate);
  const grantLogs = await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, customerUser!.id), eq(schema.rebateLogs.type, 'grant')));
  check('R11a③ grant 行挂期次且余额不动（before=after=0，统一次月到账）',
    grantLogs.length === 2 && grantLogs.every((l) => l.deltaFen === 258 && l.beforeFen === l.afterFen && !!l.period),
    grantLogs.map((l) => ({ delta: l.deltaFen, period: l.period })));

  // 三本账无互转（端点扫描 + 余额变动只走自家流水表）
  const { appRouter } = await import('../routers');
  const procNames = Object.keys((appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures);
  check('R11a① 端点扫描：全路由无回馈金/储值/XP 互转通道（无 convert/transfer/exchange/互转 过程名）',
    !procNames.some((n) => /convert|transfer|exchange|互转/i.test(n)), `procedures=${procNames.length}`);
  const svAccUntouched = await db.select().from(schema.storedValueAccounts).where(eq(schema.storedValueAccounts.id, svAcc.id)).get();
  const xpCross = await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.userId, customerUser!.id));
  check('R11a① 余额变动只走自家流水表（grant×2 后：储值账仍 98240 未动 / 客户 XP 账零事件）',
    !!svAccUntouched && svAccUntouched.principalFen + svAccUntouched.bonusFen === 98240 && xpCross.length === 0,
    { sv: svAccUntouched && svAccUntouched.principalFen + svAccUntouched.bonusFen, xpEvents: xpCross.length });

  /* ---------- 43. 回归：settleMonthly 次月到账批次单幂等（服务级直调，harness 共享临时库） ---------- */
  console.log('\n[R11a] 43. settleMonthly 次月到账（回归）');
  const { settleMonthly, rebatePeriodOf } = await import('../services/rebate');
  const periodNow = rebatePeriodOf(new Date()); // 当前期次（上月26~本月25）
  const [py, pm] = periodNow.split('-').map((s) => parseInt(s, 10));
  const settleNow = new Date(py, pm, 10); // 期次 P 的次月 10 日（≥结算日 5）——结算对象=P
  const notDue = await settleMonthly(db, new Date(2030, 0, 2)); // 2 日 < 结算日 5 → 空转
  check('R11a回归 settleMonthly 未到期空转（not-due 零写入）', notDue.settled === false && notDue.reason === 'not-due', notDue);
  const rbSettle1 = await settleMonthly(db, settleNow);
  const accAfterRbSettle = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  check('R11a回归 期次结算入账（批次单 grantedCount=2/grantedFen=516；余额 0→516 前后值留痕）',
    rbSettle1.settled === true && rbSettle1.period === periodNow && rbSettle1.grantedCount === 2 && rbSettle1.grantedFen === 516 &&
      accAfterRbSettle?.balanceFen === 516,
    { settled: rbSettle1.settled, period: rbSettle1.period, count: rbSettle1.grantedCount, fen: rbSettle1.grantedFen, balance: accAfterRbSettle?.balanceFen });
  const rbSettle2 = await settleMonthly(db, settleNow);
  const batchRows = await db.select().from(schema.rebateSettlements).where(eq(schema.rebateSettlements.period, periodNow));
  check('R11a回归 批次单幂等（period unique：重入 already-settled，全表仍 1 行）',
    rbSettle2.settled === false && rbSettle2.reason === 'already-settled' && batchRows.length === 1,
    { reason: rbSettle2.reason, batches: batchRows.length });

  /* ---------- 44. 清单②：抵扣段仅商品 + 回归：rebate 段不计已收 ---------- */
  console.log('\n[R11a] 44. rebate 抵扣段（清单② + 不计已收回归）');
  const svcRebate = await asErr(trpcMutate('cashier.settle', {
    cookie: ownerCookie,
    input: {
      customerId: customerUser!.id, items: [{ kind: 'service', refId: service.id }],
      discountType: 'none', discountValue: 0, note: 'e2e R11a 服务行 rebate 段验证',
      payments: [{ method: 'rebate', amountFen: 100 }, { method: 'cash', amountFen: 7644 }],
    },
  }));
  check('R11a② 服务行单 + rebate 段 → 403 FORBIDDEN「回馈金仅可抵商品」（红线 2 硬校验）',
    svcRebate instanceof TrpcHttpError && svcRebate.httpStatus === 403 && svcRebate.code === 'FORBIDDEN' && svcRebate.message.includes('回馈金仅可抵商品'),
    svcRebate && { status: svcRebate.httpStatus, message: svcRebate.message });
  const tender44Before = await trpcQuery<{ receivedTotalFen: number; tender: { rebateFen?: number } }>('store.todayTenderStats', { cookie: ownerCookie });
  const dBill = await settleBill2([{ kind: 'product', refId: staple.id }], {
    customerId: customerUser!.id,
    payments: () => [{ method: 'rebate', amountFen: 300 }, { method: 'cash', amountFen: 12600 }],
    note: 'e2e R11a 商品行 rebate 抵扣单',
  }); // 12900 = rebate 300 + cash 12600
  const accAfterDeduct = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  const deductLog = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, customerUser!.id), eq(schema.rebateLogs.type, 'deduct'))))[0];
  check('R11a② 商品行单 + rebate 段成（余额 516→216 前后值留痕，1:1 扣已到账）',
    dBill.payableFen === 12900 && accAfterDeduct?.balanceFen === 216 &&
      deductLog?.deltaFen === -300 && deductLog.beforeFen === 516 && deductLog.afterFen === 216,
    { balance: accAfterDeduct?.balanceFen, log: deductLog && { before: deductLog.beforeFen, after: deductLog.afterFen } });
  const tender44After = await trpcQuery<{ receivedTotalFen: number; tender: { rebateFen?: number } }>('store.todayTenderStats', { cookie: ownerCookie });
  check('R11a回归 rebate 段不计已收（已收仅 +现金段 12600；rebateFen 参考列 +300）',
    tender44After.receivedTotalFen - tender44Before.receivedTotalFen === 12600 &&
      (tender44After.tender.rebateFen ?? 0) - (tender44Before.tender.rebateFen ?? 0) === 300,
    { dReceived: tender44After.receivedTotalFen - tender44Before.receivedTotalFen, dRebate: (tender44After.tender.rebateFen ?? 0) - (tender44Before.tender.rebateFen ?? 0) });

  /* ---------- 45. 清单⑥：退货扣回接 R12（实算 + 余额不足扣 0 记未扣回） ---------- */
  console.log('\n[R11a] 45. 退货扣回接 R12（清单⑥）');
  interface R11aLinkage { rebateClawbackFen?: number; rebateClawbackMissedFen?: number }
  const cb1 = await trpcMutate<RefundExecRes>('refund.execute', {
    cookie: ownerCookie,
    input: { billNo: gBill1.billNo, type: 'partial_amount', amountFen: 6450, reason: 'R11a 退货扣回 50%' },
  });
  const cb1Linkage = (cb1.refund.linkageJson ?? {}) as R11aLinkage;
  const clawLog1 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.type, 'clawback'), eq(schema.rebateLogs.sourceId, cb1.refund.refundNo))))[0];
  check('R11a⑥ 部分退 50% → rebateClawbackFen 实算=已发 258×(6450÷12900)=129（linkage 填实值，冻结接口激活）',
    cb1Linkage.rebateClawbackFen === 129 && cb1Linkage.rebateClawbackMissedFen === 0, cb1Linkage);
  check('R11a⑥ clawback 流水前后值（216→129 扣后余额 87；source_id=退款单号，note 关联原单号）',
    clawLog1?.deltaFen === -129 && clawLog1.beforeFen === 216 && clawLog1.afterFen === 87 &&
      clawLog1.sourceId === cb1.refund.refundNo && (clawLog1.note ?? '').includes(gBill1.billNo),
    clawLog1 && { delta: clawLog1.deltaFen, before: clawLog1.beforeFen, after: clawLog1.afterFen, note: clawLog1.note });
  const cb2 = await trpcMutate<RefundExecRes>('refund.execute', {
    cookie: ownerCookie,
    input: { billNo: gBill2.billNo, type: 'partial_amount', amountFen: 6450, reason: 'R11a 退货扣回余额不足' },
  });
  const cb2Linkage = (cb2.refund.linkageJson ?? {}) as R11aLinkage;
  const clawLog2 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.type, 'clawback'), eq(schema.rebateLogs.sourceId, cb2.refund.refundNo))))[0];
  const accAfterClaw2 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  check('R11a⑥ 余额不足扣 0 不负账（应扣 129 > 余额 87 → 实扣 87，差额 42 记 rebateClawbackMissedFen 未扣回）',
    cb2Linkage.rebateClawbackFen === 129 && cb2Linkage.rebateClawbackMissedFen === 42 &&
      clawLog2?.beforeFen === 87 && clawLog2.afterFen === 0 && accAfterClaw2?.balanceFen === 0,
    { linkage: cb2Linkage, balance: accAfterClaw2?.balanceFen });

  /* ---------- 46. 清单④：到期冻结 → 续费解冻顺延 ---------- */
  console.log('\n[R11a] 46. 到期冻结 / 续费解冻（清单④）');
  await db.update(schema.memberships).set({ expiresAt: new Date(Date.now() - 86400_000), updatedAt: new Date() })
    .where(eq(schema.memberships.id, sellYinghuo.membership.id)); // 到期日置昨日
  const myFrozen = await trpcQuery<{ membership: { status: string } | null; rebate: { status: string } | null }>('membership.my', { cookie: customerCookie });
  const freezeLog = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, customerUser!.id), eq(schema.rebateLogs.type, 'freeze'))))[0];
  check('R11a④ 到期过日 → 读路径懒冻结（membership frozen + 回馈金账户 frozen + freeze 留痕行）',
    myFrozen.membership?.status === 'frozen' && myFrozen.rebate?.status === 'frozen' && !!freezeLog,
    { membership: myFrozen.membership?.status, rebate: myFrozen.rebate?.status });
  const frozenDeduct = await asErr(trpcMutate('cashier.settle', {
    cookie: ownerCookie,
    input: {
      customerId: customerUser!.id, items: [{ kind: 'product', refId: staple.id }],
      discountType: 'none', discountValue: 0, note: 'e2e R11a 冻结抵扣验证',
      payments: [{ method: 'rebate', amountFen: 100 }, { method: 'cash', amountFen: 12800 }],
    },
  }));
  check('R11a④ 冻结期抵扣不可用（FORBIDDEN「回馈金账户冻结中」，余额在不可用）',
    frozenDeduct instanceof TrpcHttpError && frozenDeduct.code === 'FORBIDDEN' && frozenDeduct.message.includes('冻结'),
    frozenDeduct && { code: frozenDeduct.code, message: frozenDeduct.message });
  const frozenDiscount = await settleBill2([{ kind: 'service', refId: service.id }], { customerId: customerUser!.id, note: 'e2e R11a 冻结期服务单' });
  check('R11a④ 冻结期服务折扣同步失效（门市价 8800 不打折）', frozenDiscount.payableFen === 8800, frozenDiscount.payableFen);
  const renewRes = await trpcMutate<{ membership: MembershipRowT; amountFen: number }>('membership.renew', {
    cookie: managerCookie,
    input: { userId: customerUser!.id, paySegments: [{ method: 'cash', amountFen: 19900 }] },
  });
  const renewDays = (renewRes.membership.expiresAt.getTime() - Date.now()) / 86400_000;
  const accAfterRenew = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  check('R11a④ 续费解冻：active + expires 自今日顺延 365 天 + 回馈金账户恢复 active',
    renewRes.membership.status === 'active' && renewDays > 364 && renewDays < 366 && accAfterRenew?.status === 'active',
    { status: renewRes.membership.status, days: renewDays, acc: accAfterRenew?.status });

  /* ---------- 47. 清单⑫：安心包全员免费（权益表述）+ 回归：savingsPreview / amortizationStats ---------- */
  console.log('\n[R11a] 47. plans 权益表述 + 立省钩子 + 年费分摊双口径（清单⑫+回归）');
  const plansRes = await trpcQuery<{ plans: Array<{ planKey: string; label: string; priceFen: number; free: boolean }> }>('membership.plans', { cookie: customerCookie });
  const plansJson = JSON.stringify(plansRes.plans.map((p) => p.label));
  check('R11a⑫ 权益表述：plans 透出含「安心包全员免费」（微光档权益行）', plansJson.includes('安心包全员免费'), plansRes.plans.map((p) => p.planKey));
  check('R11a⑫ 无「非会员 ¥15」残留（全档权益文案 grep 级实证）', !/¥15|15\s*元/.test(plansJson), plansJson.slice(0, 120));
  check('R11a⑫ 四档价格明面（0 / 19900 / 29900 / 59900 升序）',
    plansRes.plans.map((p) => p.priceFen).join(',') === '0,19900,29900,59900', plansRes.plans.map((p) => p.priceFen));
  const savePrev = await trpcQuery<{ fen: number; text: string }>('membership.savingsPreview', {
    cookie: ownerCookie,
    input: { lines: [{ kind: 'service', amountFen: 8800 }, { kind: 'product', amountFen: 12900 }] },
  });
  check('R11a回归 savingsPreview 立省钩子数值（服务 8800×12% + 商品 12900×2% = 1056+258=1314）',
    savePrev.fen === 1314 && savePrev.text === '开通萤火立省 ¥13.14', savePrev);
  const amo = await trpcQuery<{ month: string; cashFen: number; amortizedFen: number }>('membership.amortizationStats', {
    cookie: ownerCookie, input: { month: currentMonth },
  });
  // 售卡实收：萤火 19900 + 烛光 29900 + 微光 0 + 4 宠 25800 + 10 宠 61200 + 续费 19900 = 156700
  // 分摊确认（退会前 active 快照）：round(19900/12)+round(29900/12)+0+2150+5100 = 1658+2492+0+2150+5100 = 11400
  check('R11a回归 年费分摊双口径并列（收现 cashFen=156700 / 分摊确认 amortizedFen=11400 精确到分）',
    amo.cashFen === 156700 && amo.amortizedFen === 11400, amo);

  /* ---------- 48. 清单⑤+⑪：退会清零 + 折算剩余整月×月均价精确到分 ---------- */
  console.log('\n[R11a] 48. 退会（清单⑤+⑪，R11a 段收尾动作）');
  // 构造「用 4 个月零几天」：到期日=今日+7 个月+3 天 → 剩余整月=7（到期日「日」>退会日「日」，零头不抹）
  const exp7 = new Date();
  exp7.setMonth(exp7.getMonth() + 7);
  exp7.setDate(exp7.getDate() + 3);
  await db.update(schema.memberships).set({ expiresAt: exp7, updatedAt: new Date() })
    .where(eq(schema.memberships.id, sellYinghuo.membership.id));
  const cancelRes = await trpcMutate<{ membership: MembershipRowT; refundFen: number; clearedRebateFen: number }>('membership.cancel', {
    cookie: managerCookie,
    input: { userId: customerUser!.id, reason: '客户申请退会（e2e）' },
  });
  // 月均价=19900÷12；剩余整月 7 → round(19900×7/12)=11608 精确到分（¥116.08）
  check('R11a⑪ 退会折算=剩余整月 7×月均价（19900×7/12=11608 分精确到分）',
    cancelRes.refundFen === 11608 && cancelRes.membership.refundFen === 11608, { refundFen: cancelRes.refundFen });
  const accAfterCancel = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  const clearLog = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, customerUser!.id), eq(schema.rebateLogs.type, 'clear'))))[0];
  check('R11a⑤ 退会清零（余额 0 + clear 留痕行前后值 + memberships cancelled）',
    accAfterCancel?.balanceFen === 0 && !!clearLog && clearLog.afterFen === 0 && cancelRes.membership.status === 'cancelled',
    { balance: accAfterCancel?.balanceFen, clearedFen: cancelRes.clearedRebateFen, status: cancelRes.membership.status });
  const cancelEvents = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'membership.cancelled' && r.channel === `user:${customerUser!.id}`,
  );
  check('R11a⑤ 客户频道通知（membership.cancelled → user 频道，payload 含折算额与「按原路退回」文案）',
    cancelEvents.length === 1 && (() => {
      const p = cancelEvents[0]!.payload as Record<string, unknown>;
      return p.refundFen === 11608 && typeof p.message === 'string' && (p.message as string).includes('原路退回');
    })(),
    cancelEvents.map((r) => r.payload));
  const myAfterCancel = await trpcQuery<{ membership: unknown; guide: string | null }>('membership.my', { cookie: customerCookie });
  check('R11a⑤ 退会后会员页回非会员引导态（membership=null + guide 透出）',
    myAfterCancel.membership === null && typeof myAfterCancel.guide === 'string', myAfterCancel.guide);

  // 收尾一致性：回馈金全生命周期流水前后值链完整（每行 before=上行 after，五类全留痕）
  const allLogs = (await db.select().from(schema.rebateLogs).where(eq(schema.rebateLogs.userId, customerUser!.id)))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));
  const chainOk = allLogs.every((l, i) => i === 0 || l.beforeFen === allLogs[i - 1]!.afterFen);
  check('R11a⑤ 回馈金流水前后值链完整（grant/deduct/clawback/freeze/clear 全周期）',
    allLogs.length >= 8 && chainOk && allLogs[allLogs.length - 1]!.afterFen === 0,
    allLogs.map((l) => `${l.type}:${l.beforeFen}→${l.afterFen}`));

  /* ==================================================================
   * 批次 R11a 复核补改（七步复核打回①/②）验收段
   * 打回①：退会折算不悬空——cancel 同事务自动挂 R12 通道退款单
   *   （refund_bills type='membership_cancel'，executed/offline_original，bill_id=售卡原单）；
   * 打回②：退会清零含未到账——未结算 grant 写「退会作废未到账回馈金」汇总 clear 行 +
   *   settleMonthly 跳过 cancelled 用户 grant（双保险，批次单只计实际入账）。
   * ================================================================== */
  console.log('\n[R11a-复核] 49. 退会退款单挂号 + 退会后结算日不到账');

  /* ---- 49a. 打回①：退会 → 退款单在库 + refund.list 可见（待办移位在 49c 段尾做） ---- */
  const sellM1 = await sellPlan(managerCookie, {
    phone: '13811110006', planKey: 'plan_yinghuo', petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  });
  interface CancelResV2 {
    membership: MembershipRowT; refundFen: number; clearedRebateFen: number;
    refundNo: string; refundId: string; voidedPendingFen: number;
  }
  const cancelM1 = await trpcMutate<CancelResV2>('membership.cancel', {
    cookie: managerCookie,
    input: { userId: sellM1.membership.userId, reason: '复核补改：退会挂号退款单验证' },
  });
  // 萤火新卡（expires=开通+365 天，剩余整月 12）→ 折算=min(19900×12/12, 19900)=19900
  check('复核① cancel 返回退款单号（refundNo/refundId 透出，折算额=19900）',
    cancelM1.refundFen === 19900 && !!cancelM1.refundNo && !!cancelM1.refundId, { refundFen: cancelM1.refundFen, refundNo: cancelM1.refundNo });
  const mRefundRow = await db.select().from(schema.refundBills).where(eq(schema.refundBills.id, cancelM1.refundId)).get();
  check('复核① refund_bills 行在库（type=membership_cancel / amount=折算额 / status=executed / refund_method=offline_original / bill_id=售卡原单）',
    mRefundRow?.type === 'membership_cancel' && mRefundRow.amountFen === 19900 &&
      mRefundRow.status === 'executed' && mRefundRow.refundMethod === 'offline_original' &&
      mRefundRow.billId === sellM1.billId,
    mRefundRow && { type: mRefundRow.type, amount: mRefundRow.amountFen, status: mRefundRow.status, method: mRefundRow.refundMethod });
  const mLinkage = (mRefundRow?.linkageJson ?? {}) as Record<string, unknown>;
  const mCancelSnap = (mLinkage.membershipCancel ?? {}) as Record<string, unknown>;
  check('复核① linkage 快照全字段（membershipCancel 含 planKey/paidFen/refundFen/clearedRebateFen/monthsRemaining/voidedPendingFen/期次）+ rebateClawbackFen=0 列位',
    mCancelSnap.planKey === 'plan_yinghuo' && mCancelSnap.paidFen === 19900 && mCancelSnap.refundFen === 19900 &&
      mCancelSnap.clearedRebateFen === 0 && mCancelSnap.monthsRemaining === 12 &&
      mCancelSnap.voidedPendingFen === 0 && Array.isArray(mCancelSnap.voidedPendingPeriods) &&
      mLinkage.rebateClawbackFen === 0,
    mCancelSnap);
  const refundList49 = await trpcQuery<Array<{ id: string; refundNo: string; type: string; amountFen: number }>>('refund.list', { cookie: ownerCookie });
  check('复核① refund.list 可见该退款单（type=membership_cancel，金额=折算额）',
    refundList49.some((r) => r.id === cancelM1.refundId && r.refundNo === cancelM1.refundNo && r.type === 'membership_cancel' && r.amountFen === 19900),
    refundList49.length);

  /* ---- 49b. 打回②：退会后结算日不到账（跳过 cancelled；正常会员对照到账） ----
   * 期次夹具：§43 已把当前期次 periodNow 结算掉（period unique），故把 C/D 两笔真实商品单
   * grant 的期次移位到 periodNow+1（未结算新期次），settleMonthly 合成 now 指向其次月 10 日——
   * 结算对象为 futurePeriod，与 §43 批次和 server 真实定时器（真实上一期次）均不相撞。 */
  const sellC = await sellPlan(managerCookie, { phone: '13811110007', planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  const sellD = await sellPlan(managerCookie, { phone: '13811110008', planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  const gBillC = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: sellC.membership.userId, note: 'e2e 复核② C 商品单（grant 258）' });
  const gBillD = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: sellD.membership.userId, note: 'e2e 复核② D 商品单（grant 258，对照组）' });
  const fpDate = new Date(py, pm, 1); // periodNow 的次月（pm 为 1 基月名 → Date 月份索引 pm 即次月）
  const futurePeriod = `${fpDate.getFullYear()}-${pad2l(fpDate.getMonth() + 1)}`;
  const settleNow2 = new Date(fpDate.getFullYear(), fpDate.getMonth() + 1, 10); // 期次次月 10 日 ≥ 结算日 5
  await db.update(schema.rebateLogs).set({ period: futurePeriod, updatedAt: new Date() })
    .where(and(eq(schema.rebateLogs.type, 'grant'), inArray(schema.rebateLogs.sourceId, [gBillC.billNo, gBillD.billNo]))); // 期次移位到未结算期（夹具）
  const accC0 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellC.membership.userId)).get();
  const accD0 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellD.membership.userId)).get();

  const cancelC = await trpcMutate<CancelResV2>('membership.cancel', {
    cookie: managerCookie,
    input: { userId: sellC.membership.userId, reason: '复核补改：退会作废未到账验证' },
  });
  check('复核② 退会作废未到账合计透出（voidedPendingFen=258=C 的未结算 grant）',
    cancelC.voidedPendingFen === 258, { voidedPendingFen: cancelC.voidedPendingFen });
  const voidLog = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, sellC.membership.userId), eq(schema.rebateLogs.type, 'clear'))))
    .find((l) => (l.note ?? '').includes('退会作废未到账回馈金'));
  check('复核② 作废留痕 clear 行在库（note 含「退会作废未到账回馈金 258 分（期次 …）」，delta=0 前后值不动）',
    !!voidLog && voidLog.deltaFen === 0 && voidLog.beforeFen === voidLog.afterFen &&
      (voidLog.note ?? '').includes('退会作废未到账回馈金 258 分') && (voidLog.note ?? '').includes(futurePeriod),
    voidLog && { note: voidLog.note, delta: voidLog.deltaFen });

  const settle49 = await settleMonthly(db, settleNow2);
  const accC1 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellC.membership.userId)).get();
  const accD1 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellD.membership.userId)).get();
  const grantC1 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, sellC.membership.userId), eq(schema.rebateLogs.type, 'grant'), eq(schema.rebateLogs.sourceId, gBillC.billNo))))[0];
  const grantD1 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, sellD.membership.userId), eq(schema.rebateLogs.type, 'grant'), eq(schema.rebateLogs.sourceId, gBillD.billNo))))[0];
  const batch49 = await db.select().from(schema.rebateSettlements).where(eq(schema.rebateSettlements.period, futurePeriod)).get();
  check('复核② 退会者结算日不到账（C 余额不变 0→0、grant 行未回标 settlement_id、无入账行）',
    settle49.settled === true && settle49.period === futurePeriod &&
      accC1?.balanceFen === accC0?.balanceFen && grantC1?.settlementId === null &&
      !(await db.select().from(schema.rebateLogs)
        .where(and(eq(schema.rebateLogs.userId, sellC.membership.userId), eq(schema.rebateLogs.settlementId, settle49.settlementId!)))).length,
    { settled: settle49.settled, cBalance: accC1?.balanceFen, cSettlementId: grantC1?.settlementId });
  check('复核② 正常会员对照到账（D 余额 0→258 + grant 行回标批次）',
    accD1?.balanceFen === (accD0?.balanceFen ?? 0) + 258 && grantD1?.settlementId === settle49.settlementId,
    { dBalance: [accD0?.balanceFen, accD1?.balanceFen], dSettlementId: grantD1?.settlementId });
  check('复核② 批次单只计实际入账（granted_count=1 不含退会者，note 记跳过 1 行）',
    batch49?.grantedCount === 1 && batch49.grantedFen === 258 && (batch49.note ?? '').includes('退会用户跳过 1 行'),
    { count: batch49?.grantedCount, fen: batch49?.grantedFen, note: batch49?.note });

  /* ---- 49c. 打回①收尾：实退待办移位（25h）→ settleActual 幂等 → 待办消失 ----
   * 段尾铁律（§34/§38 撞号教训）：createdAt 移位之后不得再发生成退款单的动作——
   * genRefundNo 按 createdAt 计当日序号，移位减计数会致后续 RB 单号撞 UNIQUE。 */
  await db.update(schema.refundBills).set({ createdAt: new Date(Date.now() - 25 * 3600 * 1000) })
    .where(eq(schema.refundBills.id, cancelM1.refundId));
  const todo49Before = await trpcQuery<Array<{ id: string; refundNo: string }>>('refund.pendingActual', { cookie: managerCookie });
  check('复核① 退会退款单超 24h 未登记 → refund.pendingActual 含该行',
    todo49Before.some((r) => r.id === cancelM1.refundId), todo49Before.map((r) => r.refundNo));
  const settle49a = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: cancelM1.refundId, note: '退会折算款已线下退（现金）' },
  });
  const settle49b = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: cancelM1.refundId, note: '重复登记验证' },
  });
  const todo49After = await trpcQuery<Array<{ id: string }>>('refund.pendingActual', { cookie: managerCookie });
  check('复核① settleActual 登记 → settled；重复登记幂等；待办消失',
    settle49a.refund.status === 'settled' && settle49a.idempotent === false &&
      settle49b.idempotent === true && settle49b.refund.status === 'settled' &&
      !todo49After.some((r) => r.id === cancelM1.refundId),
    { a: settle49a.refund.status, bIdem: settle49b.idempotent });

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
  check(`验收结束：${PORT} 端口无残留监听`, portFree);

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
