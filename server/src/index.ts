/**
 * Hono 服务入口（CONTRACTS.md · T1.6 名下文件）
 *
 * 组装顺序：
 *   1. CORS（hono/cors）：开发期允许三端 dev 端口（7100/7101/7102，含 localhost
 *      与 127.0.0.1 两种宿主写法）携带凭证跨域；
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
import { sessionMiddleware, type AuthVariables } from './auth/middleware';
import { eventsRoute } from './routes/events';
import { imagesRoute } from './routes/images';
import { payCallbackRoute } from './routes/payCallback';
import { uploadRoute } from './routes/upload';
import { assertPaymentConfig } from './payments/provider';
import { assertSecretsConfigured } from './config/secrets';
import { startOutboxSweeper } from './realtime/outboxSweeper';
import { expirePendingOrders } from './routers/mall';
import { appRouter } from './routers';
import type { Context as TrpcContext } from './trpc';

/** 开发期三端 dev 端口（客户/商家/员工），允许携带会话 cookie 跨域 */
const DEV_ORIGINS = [
  'http://localhost:7100',
  'http://localhost:7101',
  'http://localhost:7102',
  'http://127.0.0.1:7100',
  'http://127.0.0.1:7101',
  'http://127.0.0.1:7102',
];

export type AppVariables = AuthVariables;

export function createApp(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  // 1) CORS：开发端口白名单 + 凭证（生产部署时应以环境变量收敛域名）
  app.use(
    '*',
    cors({
      origin: DEV_ORIGINS,
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
    console.log(`[philia-server] 已启动: http://localhost:${info.port} （tRPC: /trpc/*, SSE: /api/events）`);
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
