/**
 * T1.2 冒烟脚本：认证接入 + RBAC 中间件 + auth router
 *
 * 运行：npx tsx src/auth/__tests__/smoke.ts
 *
 * 覆盖：
 * 1. dev-login 给种子客户签发会话 → 中间件解析得到正确 SessionUser
 * 2. 篡改 cookie 签名 → 拒绝
 * 3. customerProcedure 无会话 → UNAUTHORIZED
 * 4. 邀请码全流程：直接 SQL 造未用邀请码 → bindStaff 成功且幂等拒绝二次使用；过期邀请码被拒
 * 5. bindStore 创建门店 + 角色写入；重复调用返回现有门店不重复建行
 *
 * 脚本会清理自己插入的测试数据，跑完后种子数据保持原样。
 */

import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { client, db, schema } from '../../db';
import { router, customerProcedure, type SessionUser } from '../../trpc';
import { authRouter } from '../../routers/auth';
import { authHttpRoutes } from '../devLogin';
import { loadSessionUser, sessionMiddleware, type AuthVariables } from '../middleware';
import { SESSION_COOKIE, verifySession } from '../session';

/* ---------- 测试数据清理登记 ---------- */
const cleanup = {
  inviteCodes: [] as string[],
  staffIds: [] as string[],
  roleRows: [] as Array<{ userId: string; role: string }>,
  storeIds: [] as string[],
  userIds: [] as string[],
};

async function runCleanup() {
  for (const code of cleanup.inviteCodes) {
    await db.delete(schema.staffInvites).where(eq(schema.staffInvites.code, code));
  }
  for (const id of cleanup.staffIds) {
    await db.delete(schema.staff).where(eq(schema.staff.id, id));
  }
  for (const r of cleanup.roleRows) {
    await db
      .delete(schema.userRoles)
      .where(and(eq(schema.userRoles.userId, r.userId), eq(schema.userRoles.role, r.role)));
  }
  for (const id of cleanup.storeIds) {
    await db.delete(schema.stores).where(eq(schema.stores.id, id));
  }
  for (const id of cleanup.userIds) {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }
}

async function main() {
  /* ---------- 前置：种子客户 / 种子门店 ---------- */
  const customer = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.kimiId, 'seed_kimi_customer'))
    .limit(1)
    .then((r) => r[0]);
  assert.ok(customer, '种子客户不存在，请先 npm run db:seed');
  const seedStore = await db
    .select()
    .from(schema.stores)
    .limit(1)
    .then((r) => r[0]);
  assert.ok(seedStore, '种子门店不存在，请先 npm run db:seed');

  /* ---------- 测试用 Hono app（中间件 + dev-login + 探针端点） ---------- */
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', sessionMiddleware);
  app.route('/', authHttpRoutes);
  app.get('/whoami', (c) => c.json({ user: c.get('sessionUser') ?? null }));

  /* ===== 1. dev-login 签发会话 → 解析为正确 SessionUser ===== */
  const loginRes = await app.request('/api/auth/dev-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: customer.id }),
  });
  assert.equal(loginRes.status, 200, `dev-login 应 200，实际 ${loginRes.status}`);
  const setCookieHeader = loginRes.headers.get('set-cookie') ?? '';
  const cookieValue = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(setCookieHeader)?.[1] ?? '';
  assert.ok(cookieValue, 'Set-Cookie 中缺少会话 cookie');
  assert.ok(/HttpOnly/i.test(setCookieHeader), '会话 cookie 应 httpOnly');

  const who1 = (await (
    await app.request('/whoami', { headers: { cookie: `${SESSION_COOKIE}=${cookieValue}` } })
  ).json()) as { user: SessionUser | null };
  assert.equal(who1.user?.id, customer.id);
  assert.ok(who1.user?.roles.includes('customer'));
  console.log(`✅ 1. dev-login 签发会话 → 解析 SessionUser 正确（id=${who1.user!.id}, roles=${who1.user!.roles.join('/')}）`);

  /* ===== 2. 篡改 cookie 签名 → 拒绝 ===== */
  const tampered = `${cookieValue.slice(0, -2)}${cookieValue.endsWith('AA') ? 'BB' : 'AA'}`;
  assert.equal(verifySession(tampered), null, '篡改后 verifySession 应返回 null');
  const who2 = (await (
    await app.request('/whoami', { headers: { cookie: `${SESSION_COOKIE}=${tampered}` } })
  ).json()) as { user: SessionUser | null };
  assert.equal(who2.user, null, '篡改 cookie 后中间件应解析为未登录');
  console.log('✅ 2. 篡改 cookie 签名 → 拒绝（verifySession=null，中间件视为未登录）');

  /* ===== 3. customerProcedure 无会话 → UNAUTHORIZED ===== */
  const probeRouter = router({ ping: customerProcedure.query(() => 'pong') });
  const anonCaller = probeRouter.createCaller({ db, user: null });
  await assert.rejects(
    anonCaller.ping(),
    (err: unknown) => (err as { code?: string }).code === 'UNAUTHORIZED',
  );
  console.log('✅ 3. customerProcedure 无会话 → UNAUTHORIZED');

  /* ===== 4. 邀请码全流程 ===== */
  const customerUser = await loadSessionUser(customer.id);
  assert.ok(customerUser);

  // auth.me：绑定前 staff/store 为 null
  const meBefore = await authRouter.createCaller({ db, user: customerUser }).me();
  assert.equal(meBefore.user.id, customer.id);
  assert.deepEqual(meBefore.roles, ['customer']);
  assert.equal(meBefore.staff, null);

  // 直接 SQL 造邀请码：一个未用（24h 有效）、一个已过期
  const inviteCode = `SMOKE-INV-OK-${ulid()}`;
  const expiredCode = `SMOKE-INV-EXP-${ulid()}`;
  cleanup.inviteCodes.push(inviteCode, expiredCode);
  await db.insert(schema.staffInvites).values([
    {
      storeId: seedStore.id,
      code: inviteCode,
      staffName: '烟雾员工',
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
    {
      storeId: seedStore.id,
      code: expiredCode,
      staffName: '过期员工',
      expiresAt: new Date(Date.now() - 1000),
    },
  ]);

  // bindStaff 成功
  const bound = await authRouter.createCaller({ db, user: customerUser }).bindStaff({ code: inviteCode });
  cleanup.staffIds.push(bound.staff.id);
  cleanup.roleRows.push({ userId: customer.id, role: 'staff' });
  assert.equal(bound.staff.storeId, seedStore.id);
  assert.equal(bound.staff.name, '烟雾员工');
  assert.equal(bound.staff.userId, customer.id);
  const usedInvite = await db
    .select()
    .from(schema.staffInvites)
    .where(eq(schema.staffInvites.code, inviteCode))
    .limit(1)
    .then((r) => r[0]);
  assert.ok(usedInvite.usedAt, 'bindStaff 成功后 used_at 应已写入');

  // 绑定后 auth.me 带 staff/store 信息
  const staffSession = await loadSessionUser(customer.id);
  assert.ok(staffSession?.staffId === bound.staff.id && staffSession.storeId === seedStore.id);
  const meAfter = await authRouter.createCaller({ db, user: staffSession! }).me();
  assert.equal(meAfter.staff?.id, bound.staff.id);
  assert.equal(meAfter.store?.id, seedStore.id);

  // 幂等拒绝二次使用（used_at 已写）
  await assert.rejects(
    authRouter.createCaller({ db, user: staffSession! }).bindStaff({ code: inviteCode }),
    (err: unknown) => (err as { code?: string }).code === 'BAD_REQUEST',
  );

  // 过期邀请码被拒
  await assert.rejects(
    authRouter.createCaller({ db, user: customerUser }).bindStaff({ code: expiredCode }),
    (err: unknown) =>
      (err as { code?: string }).code === 'BAD_REQUEST' &&
      /过期/.test((err as Error).message),
  );
  console.log('✅ 4. 邀请码全流程：bindStaff 成功（staff+角色+used_at 落库）；二次使用被拒；过期码被拒');

  /* ===== 5. bindStore：创建门店 + 角色写入；重复调用幂等 ===== */
  const merchant = await db
    .insert(schema.users)
    .values({ kimiId: `smoke_kimi_${ulid().toLowerCase()}`, nickname: '烟雾商家' })
    .returning()
    .then((r) => r[0]);
  cleanup.userIds.push(merchant.id);
  const merchantUser = await loadSessionUser(merchant.id);
  assert.ok(merchantUser);
  const merchantCaller = authRouter.createCaller({ db, user: merchantUser });

  const first = await merchantCaller.bindStore({ name: '烟雾测试门店', address: '测试路 1 号' });
  assert.equal(first.created, true);
  assert.equal(first.store.ownerId, merchant.id);
  cleanup.storeIds.push(first.store.id);
  cleanup.roleRows.push({ userId: merchant.id, role: 'merchant_owner' });

  const ownerRoles = await db
    .select()
    .from(schema.userRoles)
    .where(and(eq(schema.userRoles.userId, merchant.id), eq(schema.userRoles.role, 'merchant_owner')));
  assert.equal(ownerRoles.length, 1, 'merchant_owner 角色应恰好写入 1 行');

  const second = await merchantCaller.bindStore({ name: '不应被创建的门店' });
  assert.equal(second.created, false);
  assert.equal(second.store.id, first.store.id, '重复调用应返回现有门店');
  const ownedStores = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.ownerId, merchant.id));
  assert.equal(ownedStores.length, 1, '重复调用不得重复建行');
  console.log('✅ 5. bindStore 创建门店+merchant_owner 角色；重复调用返回现有门店（未重复建行）');

  console.log('\n[smoke] 全部 5 项通过 🎉');
}

try {
  await main();
} finally {
  await runCleanup();
  client.close();
}
