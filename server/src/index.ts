/**
 * Hono 服务入口（CONTRACTS.md · T1.6 名下文件）
 *
 * 组装顺序：
 *   1. CORS（hono/cors）：白名单走 env CORS_ORIGINS（逗号分隔）；开发期缺省允许
 *      三端 dev 端口（7100/7101/7102，含 localhost 与 127.0.0.1 两种宿主写法），
 *      生产必须显式配置（见 config/deploy.ts getCorsOrigins/assertDeployConfig）；
 *   2. 全局 sessionMiddleware（T1.2）：解析 philia_session cookie → c.var.sessionUser；
 *   3. GET /api/health：{ ok: true, ts }；
 *   4. Hono 原生路由：/api/auth/*（dev-login/logout）、/api/events（SSE）、
 *      /api/upload（图片上传）、/api/img/*（签名图片访问）；
 *   5. /trpc/* 挂 @hono/trpc-server，context = { db, user: c.var.sessionUser }；
 *   6. 启动 outboxSweeper（事件重投/归档）；@hono/node-server 监听 PORT（默认 7200）；
 *   7. 优雅退出：SIGINT/SIGTERM 关 server + 停 sweeper + 关 libsql client。
 *
 * createApp() 单独导出，便于测试以随机端口挂载同一应用；
 * 直接执行本文件（tsx src/index.ts / npm run dev）时才启动监听。
 */

import { serve, type ServerType } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { client, db, schema } from './db';
import { and, eq, gte } from 'drizzle-orm';
import { authHttpRoutes } from './auth/devLogin';
import { wechatMiniAuthRoutes } from './auth/wechatMini';
import { sessionMiddleware, type AuthVariables } from './auth/middleware';
import { clientErrorRoute } from './routes/clientError';
import { eventsRoute } from './routes/events';
import { imagesRoute } from './routes/images';
import { payCallbackRoute } from './routes/payCallback';
import { uploadRoute } from './routes/upload';
import { serveStatic } from './static/spa';
import { assertPaymentConfig } from './payments/provider';
import { assertSecretsConfigured } from './config/secrets';
import { assertDeployConfig, getCorsOrigins, getPublicBaseUrl, warnStagingConfig } from './config/deploy';
import { startOutboxSweeper } from './realtime/outboxSweeper';
import { expirePendingOrders } from './routers/mall';
import { awardXp, settleXpMonth } from './services/xpAward';
import { snapshotStoreMonth } from './routers/commission';
import { appRouter } from './routers';
import type { Context as TrpcContext } from './trpc';

export type AppVariables = AuthVariables;

export function createApp(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  // 1) CORS：env CORS_ORIGINS 白名单 + 凭证；开发期缺省三端 dev 端口，生产必须显式配置
  app.use(
    '*',
    cors({
      origin: getCorsOrigins(),
      credentials: true,
      allowHeaders: ['Content-Type', 'Last-Event-ID'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      maxAge: 600,
    }),
  );

  // 2) 全局会话中间件（所有 /api/* 与 /trpc/* 共享 c.var.sessionUser）
  app.use('*', sessionMiddleware);

  // 3) 健康检查
  app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

  // 4) Hono 原生路由
  app.route('/', authHttpRoutes); // POST /api/auth/dev-login、/api/auth/logout
  app.route('/', wechatMiniAuthRoutes); // POST /api/auth/wechat-mini（批次 7.1 微信小程序登录）
  app.route('/api/events', eventsRoute); // GET /api/events（SSE）
  app.route('/', uploadRoute); // POST /api/upload
  app.route('/', imagesRoute); // GET /api/img/*
  app.route('/', payCallbackRoute); // POST /api/pay/callback、/api/pay/mock-callback（mock 模式）
  app.route('/', clientErrorRoute); // POST /api/client-error（批次 9a 任务 E：三端 ErrorBoundary 错误摘要上报，落 JSONL 日志+限流）

  // 5) tRPC：context 取会话中间件注入的 sessionUser
  app.use(
    '/trpc/*',
    trpcServer({
      endpoint: '/trpc',
      router: appRouter,
      createContext: (_opts, c) =>
        // @hono/trpc-server 形参要求 Record<string, unknown>；运行时即 tRPC Context
        ({ db, user: c.get('sessionUser') ?? null }) as TrpcContext & Record<string, unknown>,
    }),
  );

  // 6) 三端静态托管（批次 6 任务 A · 方案一 Host 头分发）：SERVE_STATIC 开启时
  //    按 Host 子域分发 customer/merchant/staff 的 dist（含 SPA fallback）；
  //    装配在最后兜底，/api、/trpc 永不被接管；未开启时零行为变化
  app.use('*', serveStatic());

  return app;
}

/* ------------------------------------------------------------------ */
/* R10 XP 定时任务（批次 员工端2.0；crash-safe：逐店/逐单 try/catch，幂等重入）   */
/* ------------------------------------------------------------------ */

/**
 * R10 月度保级结算（任务书 §五.1/附件一 §四）：每月 1 日对每店结算上月。
 * 幂等：xp_levels unique(staff_id, month) + onConflictDoNothing——30min 滴答内重复触发、
 * 与 xp.monthlySettleNow 手动补跑互撞均零副作用。
 */
async function runXpMonthlySettle(): Promise<void> {
  const now = new Date();
  if (now.getDate() !== 1) return; // 仅每月 1 日生效
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const storeRows = await db.select({ id: schema.stores.id }).from(schema.stores);
  for (const s of storeRows) {
    try {
      const written = await settleXpMonth(db, s.id, month);
      if (written > 0) console.log(`[xp] 月度保级结算 store=${s.id} month=${month} 写入 ${written} 行`);
    } catch (err) {
      console.error(`[xp] 月度保级结算失败 store=${s.id} month=${month}:`, err);
    }
  }
}

/** 完成副作用补偿的回看窗口：只覆盖宕机/重启空窗，不做历史回填（避免给旧单补发 XP/骚扰通知） */
const XP_COMPLETION_LOOKBACK_MS = 2 * 24 * 3600 * 1000;

/**
 * R9 提成月度快照（任务书 §四.D：每月 1 日 02:00）：每月 1 日 02:00 起对每店快照上月
 * （上月为季度末月时同写该季度 kind='performance' 绩效快照）。
 * 幂等：commission_snapshots unique(staff_id,period,kind) + onConflictDoNothing——
 * 30min 滴答内重复触发、与 commission.snapshotMonth 手动补跑互撞均零副作用，不动历史快照。
 */
async function runCommissionSnapshot(): Promise<void> {
  const now = new Date();
  if (now.getDate() !== 1 || now.getHours() < 2) return; // 仅每月 1 日 02:00 后生效
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const storeRows = await db.select({ id: schema.stores.id }).from(schema.stores);
  for (const s of storeRows) {
    try {
      const r = await snapshotStoreMonth(db, s.id, month);
      if (r.commission + r.performance > 0) {
        console.log(`[commission] 月度快照 store=${s.id} month=${month} 提成 ${r.commission} 行 / 绩效 ${r.performance} 行`);
      }
    } catch (err) {
      console.error(`[commission] 月度快照失败 store=${s.id} month=${month}:`, err);
    }
  }
}

/**
 * R10 洗护完成副作用补偿（60s 滴答，幂等）：
 * 洗护单完成点（六步 confirm → appointment.completed 事件）位于 serviceStep.ts——
 * 该文件属其他工作线同期在改（R8 消毒扣库存钩子亦在 confirmStep），本批不交叉改文件
 * （报备在案），故洗护完成 XP（xp_service_order +2/单）与客户评价引导通知
 * （review.prompt → /appointments/{id}，任务书 §五.6 完成推送入口）由本任务按存在性
 * 检查补写：
 * - 服务 XP：completed 洗护单（有指派员工）且 xp_events 无 (source='service', source_id=单号) → 补发；
 * - 评价引导：completed 单且 notifications 无 (customer, 'review.prompt', 同 link) → 补写
 *   （寄养单在 boarding.checkout 事务内已写，同键去重自然跳过）。
 * 边界：XP 按补发当日计日上限（非完成当日）；若后续完成钩子移入完成事务，
 * 存在性检查使本任务自然空转，无需拆线。
 */
async function runXpCompletionSweep(): Promise<void> {
  const since = new Date(Date.now() - XP_COMPLETION_LOOKBACK_MS);
  const doneRows = await db
    .select({
      id: schema.appointments.id,
      type: schema.appointments.type,
      storeId: schema.appointments.storeId,
      staffId: schema.appointments.staffId,
      customerId: schema.appointments.customerId,
    })
    .from(schema.appointments)
    .where(and(eq(schema.appointments.status, 'completed'), gte(schema.appointments.completedAt, since)));
  for (const appt of doneRows) {
    try {
      // 评价引导通知（洗护+寄养同口径，一单一行）
      const link = `/appointments/${appt.id}`;
      const prompt = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, appt.customerId),
            eq(schema.notifications.type, 'review.prompt'),
            eq(schema.notifications.link, link),
          ),
        )
        .get();
      if (!prompt) {
        await db.insert(schema.notifications).values({
          userId: appt.customerId,
          type: 'review.prompt',
          title: '服务已完成，欢迎评价',
          body: '服务已完成，欢迎评价（星级必填，一句话即可）',
          link,
        });
      }
      // 洗护服务 XP（寄养按晚在 boarding.checkout 事务内发放，此处跳过）
      if (appt.type !== 'grooming' || !appt.staffId) continue;
      const awarded = await db
        .select({ id: schema.xpEvents.id })
        .from(schema.xpEvents)
        .where(and(eq(schema.xpEvents.source, 'service'), eq(schema.xpEvents.sourceId, appt.id)))
        .get();
      if (awarded) continue;
      const staffRow = await db
        .select({ id: schema.staff.id, userId: schema.staff.userId })
        .from(schema.staff)
        .where(eq(schema.staff.id, appt.staffId))
        .get();
      if (!staffRow) continue;
      await awardXp(db, {
        storeId: appt.storeId,
        staffId: staffRow.id,
        userId: staffRow.userId,
        source: 'service',
        sourceId: appt.id,
      });
      console.log(`[xp] 洗护完成 XP 补发 appointment=${appt.id} staff=${staffRow.id}`);
    } catch (err) {
      console.error(`[xp] 完成副作用补偿失败 appointment=${appt.id}:`, err);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 直接执行时启动监听                                                      */
/* ------------------------------------------------------------------ */

const isMain = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  // 生产密钥闸门（v1.1 P0-1）：三处 HMAC 密钥缺省/仍为 dev 值即拒绝启动，
  // 先于支付校验执行，保证密钥缺失首先暴露
  assertSecretsConfigured();
  // 部署配置闸门（批次 6 任务 B）：生产缺 CORS_ORIGINS / PUBLIC_BASE_URL /
  // BETA_GATE_CODE 任一项即拒绝启动，一次性列出全部缺失项
  assertDeployConfig();
  // staging 内测缺配提醒（裁定书 #1 ②）：staging 合法但闸门不触发，
  // 未显式注入的关键变量逐项 console.warn（不阻断）
  warnStagingConfig();
  // 支付配置启动校验：生产环境 mock / wechat 缺配置直接报错，不静默降级（§4.7）
  assertPaymentConfig();
  const port = Number(process.env.PORT ?? 7200);
  const app = createApp();
  const sweeper = startOutboxSweeper();
  // 商城超时关单（v1.1 P0-8）：启动即扫一次，之后每 60s 把超 30 分钟未支付的
  // pending 订单走取消事务（回补库存 + order.cancelled 事件）；unref 不阻塞退出
  expirePendingOrders().catch((err) => console.error('[mall] 超时关单扫描失败:', err));
  const orderExpiryTimer = setInterval(() => {
    expirePendingOrders().catch((err) => console.error('[mall] 超时关单扫描失败:', err));
  }, 60_000);
  orderExpiryTimer.unref?.();

  // R10 XP 月度保级结算：启动即试一次，之后每 30min 滴答（仅每月 1 日生效，幂等）
  runXpMonthlySettle().catch((err) => console.error('[xp] 月度保级结算扫描失败:', err));
  const xpSettleTimer = setInterval(() => {
    runXpMonthlySettle().catch((err) => console.error('[xp] 月度保级结算扫描失败:', err));
  }, 30 * 60_000);
  xpSettleTimer.unref?.();

  // R10 洗护完成副作用补偿：启动即扫一次，之后每 60s 幂等补写（见 runXpCompletionSweep 注释）
  runXpCompletionSweep().catch((err) => console.error('[xp] 完成副作用补偿扫描失败:', err));
  const xpCompletionTimer = setInterval(() => {
    runXpCompletionSweep().catch((err) => console.error('[xp] 完成副作用补偿扫描失败:', err));
  }, 60_000);
  xpCompletionTimer.unref?.();

  // R9 提成月度快照：启动即试一次，之后每 30min 滴答（仅每月 1 日 02:00 后生效，幂等）
  runCommissionSnapshot().catch((err) => console.error('[commission] 月度快照扫描失败:', err));
  const commissionSnapshotTimer = setInterval(() => {
    runCommissionSnapshot().catch((err) => console.error('[commission] 月度快照扫描失败:', err));
  }, 30 * 60_000);
  commissionSnapshotTimer.unref?.();

  const server: ServerType = serve({ fetch: app.fetch, port }, (info) => {
    const publicBase = getPublicBaseUrl();
    console.log(`[philia-server] 已启动: http://localhost:${info.port} （tRPC: /trpc/*, SSE: /api/events）`);
    if (publicBase) console.log(`[philia-server] PUBLIC_BASE_URL: ${publicBase}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[philia-server] 收到 ${signal}，正在优雅退出…`);
    sweeper.stop();
    clearInterval(orderExpiryTimer);
    clearInterval(xpSettleTimer);
    clearInterval(xpCompletionTimer);
    clearInterval(commissionSnapshotTimer);
    server.close(() => {
      client.close();
      console.log('[philia-server] 已退出');
      process.exit(0);
    });
    // 兜底：3s 内未能关闭（如 SSE 长连接占用）则强制退出
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
