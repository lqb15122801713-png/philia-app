/**
 * 三端静态托管 + Host 头分发（批次 6 任务 A · 产品侧裁定书 #1 ① 方案一）
 *
 * 单容器部署时由 server 同源托管三端 PWA 静态产物，按 **Host 头子域** 分发：
 * - app.*（如 app.example.com）  → apps/customer/dist（客户端）
 * - m.*  （如 m.example.com）    → apps/merchant/dist（商家端）
 * - s.*  （如 s.example.com）    → apps/staff/dist（员工端）
 * - 无子域 / 裸 IP / localhost / 无法识别 → customer 兜底（内测无域名期
 *   IP:7200 直连也能打开客户端，见 docs/DEPLOY.md 降级访问）
 *
 * 开关与路径（默认关，dev 行为完全不变）：
 * - SERVE_STATIC：'1' / 'true' / 'yes' 开启；未设置或其他值 → 中间件直接 next()；
 * - STATIC_ROOT：三端 dist 所在的 apps 父目录（容器内 /app/apps；本地为仓库 apps/），
 *   未设置时按仓库布局推导（server/src/static → 上三级 = 仓库根/apps）。
 *
 * 行为：
 * - 仅接管 GET / HEAD；/api/*、/trpc/* 一律 next()（API 永不被静态接管）；
 * - 命中文 file 直接流式返回；未命中 → SPA fallback 到该端 index.html；
 * - 路径穿越防护：解析结果必须落在该端 dist 目录内；
 * - 缓存头：/assets/*（vite 指纹文件）长缓存 immutable；index.html / sw.js /
 *   registerSW.js / manifest.webmanifest no-cache（PWA 更新即时生效）；
 *   其余（icons/brand/fonts/products）1 天；
 * - 三端 dist 的 PWA 文件（manifest.webmanifest / sw.js / icons）按各自端目录原样服务，
 *   各子域天然隔离（m.* 的 sw.js 不会串到 app.*）。
 *
 * 零依赖手写（node fs/stream），不引入 serve-handler 类库（任务书纪律）。
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import type { MiddlewareHandler } from 'hono';

/** 三端标识 → dist 所在子目录名（STATIC_ROOT 下） */
const APP_DIRS = {
  customer: 'customer',
  merchant: 'merchant',
  staff: 'staff',
} as const;
type AppKey = keyof typeof APP_DIRS;

/** Host 头首个子域标签 → 端；无法识别 → customer 兜底（方案一裁定口径） */
function appKeyOfHost(host: string | undefined): AppKey {
  const hostname = (host ?? '').split(':')[0]!.toLowerCase();
  const firstLabel = hostname.split('.')[0] ?? '';
  if (firstLabel === 'm') return 'merchant';
  if (firstLabel === 's') return 'staff';
  // app.* / 无子域 / 裸 IP / localhost 一律 customer
  return 'customer';
}

/** 常见静态资源 MIME（三端 dist 实际出现的类型全覆盖） */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.map': 'application/json; charset=utf-8',
};

function isEnabled(): boolean {
  const v = (process.env.SERVE_STATIC ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** STATIC_ROOT：未设置时按仓库/容器布局推导（server/src/static → <root>/apps） */
function staticRoot(): string {
  const fromEnv = process.env.STATIC_ROOT?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..', 'apps');
}

/** 缓存策略：指纹长缓存；PWA 控制面 no-cache；其余 1 天 */
function cacheControl(pathname: string): string {
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  const base = pathname.split('/').pop() ?? '';
  if (base === 'index.html' || base === 'sw.js' || base === 'registerSW.js' || base === 'manifest.webmanifest') {
    return 'no-cache';
  }
  return 'public, max-age=86400';
}

/** 解析请求路径为 dist 内文件；越界/目录 → null（走 SPA fallback） */
function resolveFile(appDist: string, pathname: string): string | null {
  // 防路径穿越：先归一化，再约束必须落在 appDist 内
  const candidate = normalize(join(appDist, pathname));
  if (candidate !== appDist && !candidate.startsWith(appDist + sep)) return null;
  try {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  } catch {
    // existsSync/statSync 异常按未命中处理
  }
  return null;
}

/**
 * 静态托管中间件工厂。装配位置：createApp 内全部 API 路由之后（最后兜底）；
 * SERVE_STATIC 未开启时零行为变化（直接 next() → 404 现状）。
 */
export function serveStatic(): MiddlewareHandler {
  return async (c, next) => {
    if (!isEnabled()) return next();
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next();

    const pathname = c.req.path;
    // API 永不被静态接管（双保险：本中间件本就装配在最后）
    if (pathname.startsWith('/api') || pathname.startsWith('/trpc')) return next();

    const appKey = appKeyOfHost(c.req.header('host'));
    const appDist = resolve(staticRoot(), APP_DIRS[appKey], 'dist');
    const indexHtml = join(appDist, 'index.html');
    if (!existsSync(indexHtml)) {
      return c.text(
        `[static] ${appKey} 端静态产物缺失：${indexHtml}（STATIC_ROOT 配置错误或三端未构建）`,
        503,
      );
    }

    const file = resolveFile(appDist, pathname) ?? indexHtml; // SPA fallback
    const isIndex = file === indexHtml;
    const size = statSync(file).size;
    const headers: Record<string, string> = {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': String(size),
      'Cache-Control': isIndex ? 'no-cache' : cacheControl(pathname),
    };
    if (c.req.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(stream, { status: 200, headers });
  };
}
