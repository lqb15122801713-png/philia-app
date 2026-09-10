/**
 * 微信小程序登录（批次 7.1 任务 B）
 *
 * - `POST /api/auth/wechat-mini`，body `{ jsCode }`：
 *   1. mock 旁路：env `WECHAT_MINI_MOCK_OPENID` 设置时跳过 code2session，直接以该
 *      openid 继续（无真实 AppID 也能跑通链路；production 下该变量存在即拒启动，
 *      见 config/deploy.ts assertDeployConfig）；
 *   2. 否则调微信 code2session（WECHAT_MINI_APPID/SECRET env）换 openid；
 *   3. 按 users.wx_openid（批次 7.1 新增 unique 列，迁移 0005；kimi_id 不删，wx
 *      用户以 `wxmini:` 前缀占位）查/建用户，新用户自动写 user_roles('customer')；
 *   4. 复用 signSession 签 philia_session cookie（与 dev-login 完全同构，中间件
 *      与 RBAC 零改动）。
 *
 * 响应：{ ok: true, created, user } —— created 标识本次是否新建用户（冒烟首登断言用）。
 */

import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db';
import { SESSION_COOKIE, SESSION_TTL_SEC, createSessionPayload, signSession } from './session';
import { loadSessionUser, type AuthVariables } from './middleware';
import {
  getWechatMiniAppId,
  getWechatMiniMockOpenid,
  getWechatMiniSecret,
} from '../config/deploy';

export const wechatMiniAuthRoutes = new Hono<{ Variables: AuthVariables }>();

const bodySchema = z.object({
  jsCode: z.string().min(1),
});

/** 微信 jscode2session 响应（成功含 openid；失败含 errcode/errmsg） */
interface Code2SessionResult {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

/** mock 旁路或 code2session 换 openid；失败抛 { status, body } 由路由统一响应 */
async function resolveOpenid(jsCode: string): Promise<string> {
  const mockOpenid = getWechatMiniMockOpenid();
  if (mockOpenid) return mockOpenid;

  const appid = getWechatMiniAppId();
  const secret = getWechatMiniSecret();
  if (!appid || !secret) {
    throw {
      status: 503,
      body: {
        ok: false,
        error: 'WECHAT_MINI_NOT_CONFIGURED',
        message: '小程序 WECHAT_MINI_APPID/SECRET 未配置（内测期可设 WECHAT_MINI_MOCK_OPENID 走 mock 旁路）',
      },
    };
  }
  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}` +
    `&js_code=${encodeURIComponent(jsCode)}&grant_type=authorization_code`;
  let res: Code2SessionResult;
  try {
    res = (await (await fetch(url)).json()) as Code2SessionResult;
  } catch {
    throw {
      status: 502,
      body: { ok: false, error: 'WECHAT_UPSTREAM_FAILED', message: '微信 code2session 请求失败' },
    };
  }
  if (!res.openid) {
    throw {
      status: 401,
      body: {
        ok: false,
        error: 'WECHAT_CODE_INVALID',
        message: `code2session 未返回 openid：errcode=${res.errcode ?? '-'} errmsg=${res.errmsg ?? '-'}`,
      },
    };
  }
  return res.openid;
}

wechatMiniAuthRoutes.post('/api/auth/wechat-mini', async (c) => {
  const body = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ ok: false, error: 'BAD_REQUEST', message: '请求体需为 JSON：{ jsCode }' }, 400);
  }

  let openid: string;
  try {
    openid = await resolveOpenid(body.data.jsCode);
  } catch (e) {
    const err = e as { status: number; body: Record<string, unknown> };
    return c.json(err.body, err.status as 400);
  }

  // 查/建用户（wx_openid unique；kimi_id 不删，wx 用户 wxmini: 前缀占位）
  let user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.wxOpenid, openid))
    .limit(1)
    .then((r) => r[0]);

  let created = false;
  if (!user) {
    await db.insert(schema.users).values({
      kimiId: `wxmini:${openid}`,
      wxOpenid: openid,
      nickname: '微信用户',
    });
    user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.wxOpenid, openid))
      .limit(1)
      .then((r) => r[0]);
    if (!user) {
      return c.json({ ok: false, error: 'INTERNAL', message: '用户创建失败' }, 500);
    }
    // 新用户自动写 customer 角色
    await db.insert(schema.userRoles).values({ userId: user.id, role: 'customer' });
    created = true;
  }

  setCookie(c, SESSION_COOKIE, signSession(createSessionPayload(user)), {
    httpOnly: true,
    path: '/',
    maxAge: SESSION_TTL_SEC, // 7 天
    sameSite: 'Lax',
  });

  return c.json({ ok: true, created, user: await loadSessionUser(user.id) });
});
