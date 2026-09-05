/**
 * 开发登录（dev-login）—— Kimi 登录是线上平台能力、本地不可用时的适配方案。
 *
 * - `POST /api/auth/dev-login`，body `{ userId }`：仅允许种子用户（kimi_id 以
 *   `seed_` 开头，从 users 表查），通过后签发会话 cookie（httpOnly，7 天）。
 * - `POST /api/auth/logout`：清除会话 cookie。
 * - `GET /api/auth/dev-seed-users`（v1.1 P1-13）：动态拉取种子用户列表
 *   （登录页免硬编码）；生产环境一律 404。
 *
 * 会话结构（uid + kimiId + iat/exp，见 session.ts）与未来 Kimi 登录完全兼容：
 * 上线时仅需把 dev-login 端点替换为 Kimi OAuth 回调，回调内同样调用
 * signSession 签发，中间件与 RBAC 不需要任何改动。
 *
 * ⚠️ dev-login 仅为本地开发便利，禁止暴露到生产环境。
 */

import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { eq, inArray, like } from 'drizzle-orm';
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

/**
 * GET /api/auth/dev-seed-users（v1.1 P1-13）：开发期登录页动态拉取种子用户列表。
 * 返回 { users: [{ id, nickname, roles[] }] }（users 表 kimi_id LIKE 'seed_%'，与
 * dev-login 的种子用户约束同口径）；roles 从 user_roles 聚合。
 * ⚠️ 与 dev-login 同为开发便利端点：生产环境（NODE_ENV=production）一律 404，
 * 绝不把种子账号清单暴露到线上。
 */
authHttpRoutes.get('/api/auth/dev-seed-users', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    return c.json({ ok: false, error: 'NOT_FOUND', message: 'Not Found' }, 404);
  }
  const seedUsers = await db
    .select({ id: schema.users.id, nickname: schema.users.nickname })
    .from(schema.users)
    .where(like(schema.users.kimiId, 'seed_%'))
    .orderBy(schema.users.createdAt);
  const roleRows = seedUsers.length
    ? await db
        .select({ userId: schema.userRoles.userId, role: schema.userRoles.role })
        .from(schema.userRoles)
        .where(
          inArray(
            schema.userRoles.userId,
            seedUsers.map((u) => u.id),
          ),
        )
    : [];
  const rolesByUser = new Map<string, string[]>();
  for (const r of roleRows) {
    const arr = rolesByUser.get(r.userId) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.userId, arr);
  }
  return c.json({
    users: seedUsers.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      roles: rolesByUser.get(u.id) ?? [],
    })),
  });
});

authHttpRoutes.post('/api/auth/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});
