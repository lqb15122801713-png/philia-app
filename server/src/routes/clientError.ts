/**
 * 客户端错误上报端点（批次 9a · 任务 E）：POST /api/client-error
 *
 * 背景：批次 8 残余缺陷——应用内跳转白屏（数据/时序依赖型，沙箱未复现），
 * 三端 ErrorBoundary 兜底后把错误摘要打到本端点做根治取证。
 *
 * 选型（落库 vs 落日志文件，二选一）：**落 JSONL 日志文件**——
 *   1. 错误上报通道不依赖数据库可用性（DB 异常恰恰是最需要收集客户端错误的时刻）；
 *   2. 零 Drizzle schema/迁移改动，验收面最小；
 *   3. 容器内路径经 env PHILIA_CLIENT_ERROR_LOG 可配置（缺省 <server>/data/client-error.log，
 *      与 PHILIA_DB_URL 同目录风格；docker 可挂卷到持久路径）；
 *   4. 同步 console.warn 单行（stdout/systemd/docker logs 双通道可读，staging/production 都收）。
 *
 * 契约（与 packages/shared ErrorBoundary 的 ClientErrorReport 一致）：
 *   { app: 'customer'|'merchant'|'staff', route, message, stackFirstFrame,
 *     componentStackFirstFrame, time(ISO), ua }
 * 无需登录（崩溃可能发生在未登录态）；字段截断防刷；内存固定窗口限流
 * （每 IP 20 次/分 + 全局 200 次/分，超限 429）。不落 PII 之外数据，body 超 16KB 直接 413。
 */

import { Hono } from 'hono';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_KINDS = new Set(['customer', 'merchant', 'staff']);

/** 字段长度上限（防刷/防巨包撑爆磁盘） */
const CAP = { route: 300, message: 500, frame: 500, time: 40, ua: 300 } as const;
const MAX_BODY_BYTES = 16 * 1024;

/** 限流：固定窗口（每 IP 20 次/分，全局 200 次/分）；内存态，进程重启清零（可接受） */
const WINDOW_MS = 60_000;
const PER_IP_LIMIT = 20;
const GLOBAL_LIMIT = 200;
const ipBuckets = new Map<string, { resetAt: number; count: number }>();
let globalBucket = { resetAt: Date.now() + WINDOW_MS, count: 0 };

function hitLimit(ip: string): boolean {
  const now = Date.now();
  if (now >= globalBucket.resetAt) globalBucket = { resetAt: now + WINDOW_MS, count: 0 };
  let b = ipBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    b = { resetAt: now + WINDOW_MS, count: 0 };
    ipBuckets.set(ip, b);
  }
  // 兜底：Map 无界增长保护（异常 IP 风暴时窗口过期即清）
  if (ipBuckets.size > 10_000) {
    for (const [k, v] of ipBuckets) if (now >= v.resetAt) ipBuckets.delete(k);
  }
  globalBucket.count += 1;
  b.count += 1;
  return b.count > PER_IP_LIMIT || globalBucket.count > GLOBAL_LIMIT;
}

/** 日志文件路径：env 优先，缺省相对本文件定位（server/data/client-error.log），与进程 CWD 无关 */
export function clientErrorLogFile(): string {
  const fromEnv = process.env.PHILIA_CLIENT_ERROR_LOG;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return fileURLToPath(new URL('../../data/client-error.log', import.meta.url));
}

const cap = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;

export const clientErrorRoute = new Hono().post('/api/client-error', async (c) => {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';
  if (hitLimit(ip)) {
    return c.json({ error: 'RATE_LIMITED', message: '上报过于频繁，请稍后再试' }, 429);
  }

  const len = Number(c.req.header('content-length') ?? 0);
  if (len > MAX_BODY_BYTES) {
    return c.json({ error: 'PAYLOAD_TOO_LARGE', message: 'body 超过 16KB 上限' }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'BAD_REQUEST', message: 'body 需为 JSON' }, 400);
  }

  const app = cap(body?.app, 20);
  const route = cap(body?.route, CAP.route);
  const message = cap(body?.message, CAP.message);
  if (!app || !APP_KINDS.has(app) || !route || !message) {
    return c.json(
      { error: 'BAD_REQUEST', message: 'app（customer/merchant/staff）、route、message 必填' },
      400,
    );
  }

  const entry = {
    ts: new Date().toISOString(),
    ip,
    app,
    route,
    message,
    stackFirstFrame: cap(body?.stackFirstFrame, CAP.frame),
    componentStackFirstFrame: cap(body?.componentStackFirstFrame, CAP.frame),
    time: cap(body?.time, CAP.time),
    ua: cap(body?.ua, CAP.ua),
  };
  const line = JSON.stringify(entry);

  // 同步 console 一行（生产 stdout 可读）；再落 JSONL 文件（落盘失败不影响 200 响应，console 已有底）
  console.warn(`[client-error] ${line}`);
  try {
    const file = clientErrorLogFile();
    await mkdir(dirname(file), { recursive: true });
    await appendFile(file, `${line}\n`, 'utf8');
  } catch (err) {
    console.error('[client-error] 日志落盘失败（console 已留底）:', err);
  }

  return c.json({ ok: true }, 200);
});
