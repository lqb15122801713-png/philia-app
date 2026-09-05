/**
 * 开发登录 / 登出（契约 docs/CLIENT-CONTRACTS.md · T2.0）
 *
 * ⚠️ 仅开发环境使用，生产移除（服务端 dev-login 端点同样仅限种子用户，
 * 见 server/src/auth/devLogin.ts；上线后由 Kimi OAuth 回调替换）。
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

/** 开发登录：POST /api/auth/dev-login { userId }（仅种子用户可用） */
export async function devLogin(baseUrl: string, userId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
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
