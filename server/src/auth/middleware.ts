/**
 * 会话中间件（Hono）：解析会话 cookie → 查 users / user_roles / staff 表
 * → 组装 SessionUser → 挂到 Hono context（c.get('sessionUser')）。
 *
 * 供 tRPC context（T1.6 在 createContext 里读 c.var.sessionUser）与
 * Hono 原生端点（上传、SSE 等）共用。
 *
 * storeId 组装规则：
 * - 有 staff 记录 → staff.storeId（M1-补2 R2 口径登记：merchant_clerk 店员绑定门店
 *   即走此路径——users + user_roles(merchant_clerk) + staff 行，同 seed_manager 口径）；
 * - 否则若含 merchant 角色 → 其名下门店（stores.owner_id = user.id，取第一行；
 *   仅 owner/manager 兜底——clerk 不是门店 owner，无 staff 行即无 storeId，
 *   merchantProcedure 会拒绝，符合「店员须绑定门店」口径）；
 * - 都没有 → 不含 storeId（merchantProcedure 会因此拒绝，符合契约）。
 */

import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { SessionUser } from '../trpc';
import { SESSION_COOKIE, verifySession, type SessionPayload } from './session';

/** Hono context 变量（c.var.*） */
export interface AuthVariables {
  sessionUser: SessionUser | null;
  sessionPayload: SessionPayload | null;
}

/** M1-补2 R2：新增 merchant_clerk（店员，收银执行层）——商家端三级账号 */
const VALID_ROLES = ['customer', 'merchant_owner', 'merchant_manager', 'merchant_clerk', 'staff'] as const;
type Role = (typeof VALID_ROLES)[number];

/** 按用户 ID 组装 SessionUser（users + user_roles + staff + 门店归属）；用户不存在返回 null */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
    .then((r) => r[0]);
  if (!user) return null;

  const roleRows = await db
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, userId));
  const roles = roleRows
    .map((r) => r.role)
    .filter((r): r is Role => (VALID_ROLES as readonly string[]).includes(r));

  const staffRow = await db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.userId, userId))
    .limit(1)
    .then((r) => r[0]);

  let storeId = staffRow?.storeId;
  if (!storeId && (roles.includes('merchant_owner') || roles.includes('merchant_manager'))) {
    const store = await db
      .select({ id: schema.stores.id })
      .from(schema.stores)
      .where(eq(schema.stores.ownerId, userId))
      .limit(1)
      .then((r) => r[0]);
    storeId = store?.id;
  }

  return {
    id: user.id,
    nickname: user.nickname,
    roles,
    ...(staffRow ? { staffId: staffRow.id } : {}),
    ...(storeId ? { storeId } : {}),
  };
}

/**
 * Hono 中间件：校验 philia_session cookie（签名+有效期），
 * 通过则装载 SessionUser；失败（无 cookie / 篡改 / 过期 / 用户已删）一律 sessionUser=null。
 */
export const sessionMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const payload = verifySession(getCookie(c, SESSION_COOKIE));
    const user = payload ? await loadSessionUser(payload.uid) : null;
    c.set('sessionUser', user);
    c.set('sessionPayload', user ? payload : null);
    await next();
  },
);
