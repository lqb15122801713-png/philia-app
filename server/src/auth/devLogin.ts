/**
 * 开发登录（dev-login）—— Kimi 登录是线上平台能力、本地不可用时的适配方案。
 *
 * - `POST /api/auth/dev-login`，body `{ userId }`：仅允许种子用户（kimi_id 以
 *   `seed_` 开头，从 users 表查），通过后签发会话 cookie（httpOnly，7 天）。
 * - `POST /api/auth/logout`：清除会话 cookie。
 *
 * 会话结构（uid + kimiId + iat/exp，见 session.ts）与未来 Kimi 登录完全兼容：
 * 上线时仅需把 dev-login 端点替换为 Kimi OAuth 回调，回调内同样调用
 * signSession 签发，中间件与 RBAC 不需要任何改动。
 *
 * ⚠️ dev-login 仅为本地开发便利，禁止暴露到生产环境。
 */

import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db';
import { SESSION_COOKIE, SESSION_TTL_SEC, createSessionPayload, signSession } from './session';
import { loadSessionUser, type AuthVariables } from './middleware';

export const authHttpRoutes = new Hono<{ Variables: AuthVariables }>();

const devLoginBodySchema = z.object({ userId: z.string().min(1) });

authHttpRoutes.post('/api/auth/dev-login', async (c) => {
  const body = devLoginBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ ok: false, error: 'BAD_REQUEST', message: '请求体需为 JSON：{ userId }' }, 400);
  }

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, body.data.userId))
    .limit(1)
    .then((r) => r[0]);

  // 安全约束：仅允许种子用户（kimi_id 以 seed_ 开头），防止 dev 端点被用于登录任意账号
  if (!user || !user.kimiId.startsWith('seed_')) {
    return c.json({ ok: false, error: 'FORBIDDEN', message: 'dev-login 仅允许种子用户' }, 403);
  }

  setCookie(c, SESSION_COOKIE, signSession(createSessionPayload(user)), {
    httpOnly: true,
    path: '/',
    maxAge: SESSION_TTL_SEC, // 7 天
    sameSite: 'Lax',
  });

  return c.json({ ok: true, user: await loadSessionUser(user.id) });
});

authHttpRoutes.post('/api/auth/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});
