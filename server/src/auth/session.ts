/**
 * 会话签发 / 校验：HMAC-SHA256 签名 cookie
 *
 * - cookie 名 `philia_session`，httpOnly，有效期 7 天。
 * - 密钥取 env `SESSION_SECRET`；缺省 dev 值 `philia-dev-secret`
 *   —— 仅供本地开发，**禁止用于生产**！生产部署必须显式设置 SESSION_SECRET。
 * - 会话载荷 { uid, kimiId, iat, exp }：kimiId 字段为未来 Kimi 登录预留
 *   （上线后由 Kimi OAuth 回调用同一 signSession 签发，结构不变）。
 *
 * 值格式：base64url(JSON payload) + '.' + base64url(HMAC-SHA256(payload))
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** 会话 cookie 名 */
export const SESSION_COOKIE = 'philia_session';

/** 会话有效期：7 天（秒） */
export const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

/** ⚠️ 仅本地开发的缺省密钥，禁止用于生产环境 */
const DEV_SECRET = 'philia-dev-secret';

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET ?? DEV_SECRET;
}

/** 会话载荷（与未来 Kimi 登录兼容：kimiId 预留） */
export interface SessionPayload {
  /** users.id */
  uid: string;
  /** users.kimi_id —— Kimi 账号 ID（预留字段，dev-login 下为种子用户的 seed_ 前缀 ID） */
  kimiId: string;
  /** 签发时间（Unix 秒） */
  iat: number;
  /** 过期时间（Unix 秒） */
  exp: number;
}

function hmac(data: string): string {
  return createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
}

/** 生成会话载荷（iat/exp 单位 Unix 秒） */
export function createSessionPayload(
  user: { id: string; kimiId: string },
  now = Date.now(),
): SessionPayload {
  const iat = Math.floor(now / 1000);
  return { uid: user.id, kimiId: user.kimiId, iat, exp: iat + SESSION_TTL_SEC };
}

/** 签发会话 cookie 值 */
export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${hmac(body)}`;
}

/** 校验会话 cookie 值；签名不符 / 过期 / 结构非法一律返回 null */
export function verifySession(value: string | undefined | null, now = Date.now()): SessionPayload | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0 || dot === value.length - 1) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = hmac(body);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
