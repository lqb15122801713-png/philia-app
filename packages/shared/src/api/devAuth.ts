/**
 * 开发登录 / 登出（契约 docs/CLIENT-CONTRACTS.md · T2.0）
 *
 * ⚠️ 仅开发环境使用，生产移除（服务端 dev-login 端点限种子用户 + 口令门内手机号
 * 自助开户（D-16），见 server/src/auth/devLogin.ts；上线后由 Kimi OAuth 回调替换）。
 *
 * 会话为 httpOnly cookie（philia_session，7 天），请求必须 credentials:'include'。
 */

/** 从错误响应体提取 message（失败时抛中文提示） */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // 保留默认错误信息
  }
  return `${fallback}（HTTP ${res.status}）`;
}

/**
 * 开发登录：POST /api/auth/dev-login { userId, code? }（仅种子用户可用）
 * 内测口令门（批次 6 任务 B2）：服务端 BETA_GATE_CODE 设置后须带 code，
 * 缺失/错误分别 401/403（message 已汉化，页面直接展示）。
 */
export async function devLogin(baseUrl: string, userId: string, code?: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(code ? { userId, code } : { userId }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, '登录失败'));
  }
}

/**
 * 自助开户（D-16 · CJ-0925-07 · 急修三件 PD-03）：POST { phone, code? }——
 * 口令门内手机号登录/注册（新号自动建档 customer，server 侧 phone: 前缀 kimi_id）。
 */
export async function devLoginByPhone(baseUrl: string, phone: string, code?: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(code ? { phone, code } : { phone }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, '登录失败'));
  }
}

/** 登出：POST /api/auth/logout（清除会话 cookie） */
export async function logout(baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, '登出失败'));
  }
}
