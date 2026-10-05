/**
 * 平台分叉请求层（批次 7.1 任务 B）
 *
 * - H5：浏览器 cookie jar，fetch credentials:'include'（跨域 7103 → 7200 走 CORS
 *   dev 白名单，server config/deploy.ts DEV_ORIGINS 已含 7103）；
 * - weapp：小程序无浏览器 cookie 语义，会话 cookie 按任务口径走请求头——
 *   登录响应的 Set-Cookie 存 storage，后续请求统一带 Cookie 头。
 */

import Taro from '@tarojs/taro';

const SESSION_COOKIE_KEY = 'philia_session_cookie';

export function getStoredSessionCookie(): string {
  if (process.env.TARO_ENV === 'h5') return '';
  try {
    return (Taro.getStorageSync(SESSION_COOKIE_KEY) as string) ?? '';
  } catch {
    return '';
  }
}

export function clearStoredSessionCookie(): void {
  if (process.env.TARO_ENV === 'h5') return;
  try {
    Taro.removeStorageSync(SESSION_COOKIE_KEY);
  } catch {
    /* 忽略 */
  }
}

export interface ApiErrorShape {
  status: number;
  data: unknown;
}

export class ApiError extends Error implements ApiErrorShape {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    const msg =
      data && typeof data === 'object' && 'message' in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).message)
        : `HTTP ${status}`;
    super(msg);
    this.status = status;
    this.data = data;
  }
}

interface ReqOptions {
  url: string;
  method?: 'GET' | 'POST';
  data?: unknown;
}

/** 统一请求：返回解析后的 JSON；非 2xx 抛 ApiError（含 status 与响应体） */
export async function apiFetch<T = unknown>(opts: ReqOptions): Promise<T> {
  if (process.env.TARO_ENV === 'h5') {
    const res = await fetch(opts.url, {
      method: opts.method ?? 'GET',
      headers: opts.data !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.data !== undefined ? JSON.stringify(opts.data) : undefined,
      credentials: 'include',
    });
    const data = (await res.json().catch(() => null)) as T;
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  // weapp：手动会话 cookie（请求头口径）
  const cookie = getStoredSessionCookie();
  const res = await Taro.request({
    url: opts.url,
    method: opts.method ?? 'GET',
    data: (opts.data ?? {}) as Record<string, unknown>,
    header: {
      ...(opts.data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const setCookie = res.header?.['Set-Cookie'] ?? res.header?.['set-cookie'];
  if (setCookie) {
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const pair = raw.split(';')[0];
    if (pair) {
      try {
        Taro.setStorageSync(SESSION_COOKIE_KEY, pair);
      } catch {
        /* 忽略 */
      }
    }
  }
  const data = res.data as T;
  if (res.statusCode < 200 || res.statusCode >= 300) throw new ApiError(res.statusCode, data);
  return data;
}
