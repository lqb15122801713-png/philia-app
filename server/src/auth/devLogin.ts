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
 * ⚠️ dev-login 仅为本地开发/内测便利，禁止无门槛暴露到生产环境。
 *
 * 内测口令门（批次 6 拍板 2 · 任务 B2）：env BETA_GATE_CODE 设置后，
 * POST /api/auth/dev-login（body 带 code）与 GET /api/auth/dev-seed-users
 * （query 带 code）均须携带正确口令——缺失 → 401 BETA_GATE_REQUIRED，
 * 错误 → 403 BETA_GATE_INVALID。production 未设置 BETA_GATE_CODE 时
 * 启动即报错（见 config/deploy.ts assertDeployConfig，生产不留后门）；
 * NODE_ENV≠production 未设置时维持现状开放（本地开发不添堵）。
 */

import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { eq, inArray, like } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db';
import { SESSION_COOKIE, SESSION_TTL_SEC, createSessionPayload, signSession } from './session';
import { loadSessionUser, type AuthVariables } from './middleware';
import { getBetaGateCode } from '../config/deploy';

export const authHttpRoutes = new Hono<{ Variables: AuthVariables }>();

const devLoginBodySchema = z.object({
  userId: z.string().min(1),
  /** 内测口令（BETA_GATE_CODE 设置后必带） */
  code: z.string().optional(),
});

/**
 * 内测口令门校验。返回 null = 放行；否则返回 { status, body }（调用方 c.json 后 return）。
 * - BETA_GATE_CODE 未设置：放行（仅开发期；生产未设置时启动已被 assertDeployConfig 拦截）；
 * - 已设置：口令缺失 → 401 BETA_GATE_REQUIRED（登录页据此显示口令输入框）；
 *   口令错误 → 403 BETA_GATE_INVALID。比对走 timingSafeEqual 防时序侧信道。
 */
function betaGateFailure(provided: string | undefined): {
  status: 401 | 403;
  body: { ok: false; error: string; message: string };
} | null {
  const gate = getBetaGateCode();
  if (!gate) return null;
  const code = provided?.trim() ?? '';
  if (!code) {
    return {
      status: 401,
      body: { ok: false, error: 'BETA_GATE_REQUIRED', message: '内测环境：请携带内测口令（code）' },
    };
  }
  const a = Buffer.from(code, 'utf8');
  const b = Buffer.from(gate, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { status: 403, body: { ok: false, error: 'BETA_GATE_INVALID', message: '内测口令错误' } };
  }
  return null;
}

authHttpRoutes.post('/api/auth/dev-login', async (c) => {
  const body = devLoginBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ ok: false, error: 'BAD_REQUEST', message: '请求体需为 JSON：{ userId }' }, 400);
  }

  // 内测口令门（批次 6 任务 B2）：口令缺失/错误先于任何用户查询被拒
  const gateFail = betaGateFailure(body.data.code);
  if (gateFail) return c.json(gateFail.body, gateFail.status);

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
 * ⚠️ 与 dev-login 同为开发便利端点：批次 6 起走内测口令门（BETA_GATE_CODE，
 * query 带 code）——设置后无码 401 / 错码 403；生产环境口令由启动闸门强制配置
 * （assertDeployConfig），绝不把种子账号清单无门槛暴露到线上（批次 6 拍板 2：
 * 内测保留 dev-login，但仅种子账号 + 口令校验）。
 */
authHttpRoutes.get('/api/auth/dev-seed-users', async (c) => {
  // 内测口令门（批次 6 任务 B2）
  const gateFail = betaGateFailure(c.req.query('code'));
  if (gateFail) return c.json(gateFail.body, gateFail.status);
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
