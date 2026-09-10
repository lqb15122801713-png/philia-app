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
import { client, db } from './db';
import { authHttpRoutes } from './auth/devLogin';
import { wechatMiniAuthRoutes } from './auth/wechatMini';
import { sessionMiddleware, type AuthVariables } from './auth/middleware';
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
