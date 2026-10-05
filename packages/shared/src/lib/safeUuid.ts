/**
 * 安全 UUID（批次 9a.1 任务 D · VPS 实战捕获）
 *
 * 背景：crypto.randomUUID() 仅在安全上下文（HTTPS 或 localhost）存在；
 * 内测走普通 HTTP（http://<IP>）时该方法为 undefined——批次 9a 各处
 * getClientId 的 try 分支抛错后 catch 分支再次调用同一方法，二次抛出
 * 无人接 → 客户端 /home 直接崩进 ErrorBoundary。
 *
 * safeUuid()：优先 crypto.randomUUID()，不存在则 Math.random 版 v4 模板兜底，
 * 任何路径不得二次抛出（仅用于客户端 id/SSE client_id/列表 key 等非安全场景，
 * 不用于任何鉴权/签名用途）。
 */

/** Math.random 版 RFC4122 v4 模板兜底（非加密强度，仅保证唯一性/格式） */
function uuidV4Fallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 取 UUID v4：安全上下文走 crypto.randomUUID()，否则模板兜底；永不抛出 */
export function safeUuid(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? uuidV4Fallback();
  } catch {
    return uuidV4Fallback();
  }
}
