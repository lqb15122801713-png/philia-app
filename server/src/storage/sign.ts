/**
 * 图片访问签名（契约 3 · T1.5）
 *
 * 签名方案与预约码同构（开发方案 §3.3）：HMAC-SHA256(`${relPath}|${exp}`, IMG_SECRET)。
 * - IMG_SECRET 缺省为开发用值，生产必须经环境变量覆盖。
 * - 签名 URL 形如：/api/img/<relPath>?sig=<hex>&exp=<unix秒>
 * - 验签在 src/routes/images.ts（GET /api/img/*），验签通过才流式返回文件。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** 与预约码同密钥体系、不同用途：独立环境变量 IMG_SECRET，缺省仅用于本地开发 */
const IMG_SECRET = process.env.IMG_SECRET ?? 'philia-dev-img-secret-do-not-use-in-prod';

/** 签名 URL 默认有效期：7 天（照片墙/时间轴需要长期可加载，过期后由前端重新拉取签名 URL） */
export const DEFAULT_SIGN_EXPIRES_SEC = 7 * 24 * 3600;

/** 计算 HMAC-SHA256(`${relPath}|${exp}`) 的 hex 摘要 */
export function computeImageSignature(relPath: string, exp: number): string {
  return createHmac('sha256', IMG_SECRET).update(`${relPath}|${exp}`).digest('hex');
}

/** 生成带签名的访问路径（契约 3）。expiresInSec 缺省 7 天。 */
export function signImagePath(relPath: string, expiresInSec: number = DEFAULT_SIGN_EXPIRES_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + Math.floor(expiresInSec);
  const sig = computeImageSignature(relPath, exp);
  return `/api/img/${relPath}?sig=${sig}&exp=${exp}`;
}

/** 仅比对签名是否匹配（不检查过期），常量时间比较防时序侧信道 */
export function imageSignatureMatches(relPath: string, sig: string, exp: number): boolean {
  if (!Number.isFinite(exp) || typeof sig !== 'string' || !/^[0-9a-f]{64}$/.test(sig)) {
    return false;
  }
  const expected = computeImageSignature(relPath, exp);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 契约 3：验签（签名匹配 且 未过期） */
export function verifyImageSignature(relPath: string, sig: string, exp: number): boolean {
  if (!imageSignatureMatches(relPath, sig, exp)) return false;
  return exp >= Math.floor(Date.now() / 1000);
}

/**
 * 存储相对路径安全校验（防路径穿越）。
 * 合法形态：`appointment/<aid>/<stepKey>/<uuid>.jpg`、`.../<uuid>_thumb.jpg` 等——
 * 段内仅允许 [A-Za-z0-9_-]，至少 2 段，末段为 .jpg 文件名；显式拒绝 `..`、反斜杠、空段。
 * 注意：传入的必须是已 URL 解码后的字符串。
 */
export function isSafeImageRelPath(relPath: string): boolean {
  if (!relPath || relPath.length > 512) return false;
  if (relPath.includes('..') || relPath.includes('\\') || relPath.includes('\0')) return false;
  if (relPath.startsWith('/') || relPath.endsWith('/')) return false;
  const segments = relPath.split('/');
  if (segments.length < 2) return false;
  // 逐段严格校验：目录段为纯安全字符，文件名段为 <name>.jpg
  const fileName = segments[segments.length - 1];
  if (!/^[A-Za-z0-9_-]+\.jpg$/.test(fileName)) return false;
  for (const dirSeg of segments.slice(0, -1)) {
    if (!/^[A-Za-z0-9_-]+$/.test(dirSeg)) return false;
  }
  return true;
}
