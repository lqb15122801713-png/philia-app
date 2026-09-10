/**
 * 登录链路封装（批次 7.1 任务 B）
 *
 * - weapp：Taro.login() 拿 jsCode → POST /api/auth/wechat-mini（mock 旁路见 server
 *   auth/wechatMini.ts）→ cookie 存 storage（请求头口径，见 ./request.ts）；
 * - H5 降级：内测期走现有 dev-login（种子用户 + BETA_GATE_CODE 口令门），
 *   cookie 由浏览器 jar 托管；
 * - auth.me 探活：启动守卫 / 我的页共用。
 */

import Taro from '@tarojs/taro';
import { API_BASE } from './config';
import { apiFetch, clearStoredSessionCookie } from './request';
import { trpcQuery } from './trpc';

export interface LoginUser {
  id: string;
  nickname: string | null;
  roles: string[];
}

interface WechatMiniLoginResp {
  ok: boolean;
  created: boolean;
  user: LoginUser;
}

interface DevLoginResp {
  ok: boolean;
  user: LoginUser | null;
}

export interface SeedUser {
  id: string;
  nickname: string | null;
  roles: string[];
}

/** 微信一键登录（weapp）：wx.login → wechat-mini 端点 */
export async function loginWechatMini(): Promise<WechatMiniLoginResp> {
  const { code } = await Taro.login();
  if (!code) throw new Error('wx.login 未返回 jsCode');
  return apiFetch<WechatMiniLoginResp>({
    url: `${API_BASE}/api/auth/wechat-mini`,
    method: 'POST',
    data: { jsCode: code },
  });
}

/** H5 降级：拉种子用户列表（口令门 code 按需携带） */
export async function fetchSeedUsers(code?: string): Promise<SeedUser[]> {
  const qs = code ? `?code=${encodeURIComponent(code)}` : '';
  const data = await apiFetch<{ users: SeedUser[] }>({
    url: `${API_BASE}/api/auth/dev-seed-users${qs}`,
  });
  return data.users;
}

/** H5 降级：dev-login（内测期，带口令门） */
export async function devLogin(userId: string, code?: string): Promise<DevLoginResp> {
  return apiFetch<DevLoginResp>({
    url: `${API_BASE}/api/auth/dev-login`,
    method: 'POST',
    data: code ? { userId, code } : { userId },
  });
}

/** 当前会话（auth.me）；未登录/失效抛 ApiError(401) */
export async function fetchMe() {
  return trpcQuery('auth', 'me');
}

/** 退出登录：清 server cookie + 本地 storage */
export async function logout(): Promise<void> {
  try {
    await apiFetch({ url: `${API_BASE}/api/auth/logout`, method: 'POST', data: {} });
  } finally {
    clearStoredSessionCookie();
  }
}
