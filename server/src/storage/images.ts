/**
 * 图片处理与存储管线（契约 3 · T1.5）
 *
 * processAndStoreImage：
 *   校验大小（≤10MB）→ 校验 MIME（jpg/png/webp，按魔数嗅探，不信客户端声明）
 *   → jimp 解码 → 原图最长边 >2000 则重采样到 2000 → 生成 400px 最长边缩略图
 *   → 统一转 jpeg（质量 82）写入 uploads/<relDir>/<uuid>.jpg 与 <uuid>_thumb.jpg
 *   → 返回经 signImagePath 签名的 { url, thumbUrl }。
 *
 * 存储根：server/uploads/（按本文件位置定位，与进程 CWD 无关），运行时自动建目录；
 * 图片一律经签名 URL 访问（GET /api/img/*），不直接暴露物理路径。
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jimp } from 'jimp';
import { signImagePath } from './sign';

/** 存储根：server/uploads/ */
export const UPLOADS_ROOT = fileURLToPath(new URL('../../uploads', import.meta.url));

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const ORIGINAL_MAX_EDGE = 2000;
export const THUMB_MAX_EDGE = 400;
export const JPEG_QUALITY = 82;

/** 契约 3 返回类型 */
export interface UploadedImage {
  url: string;
  thumbUrl: string;
}

/** 上传业务错误（路由层据此返回 400，而不是 500） */
export class ImageValidationError extends Error {}

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** 按魔数嗅探真实 MIME（不信任 multipart 里的 Content-Type 声明） */
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** relDir 白名单校验（防路径穿越）：形如 `appointment/<aid>/<stepKey>`，段内仅 [A-Za-z0-9_-] */
export function isSafeRelDir(relDir: string): boolean {
  if (!relDir || relDir.length > 256) return false;
  if (relDir.includes('..') || relDir.includes('\\') || relDir.includes('\0')) return false;
  if (relDir.startsWith('/') || relDir.endsWith('/')) return false;
  return relDir.split('/').every((seg) => /^[A-Za-z0-9_-]+$/.test(seg));
}

/** 将存储相对路径解析为绝对路径，并二次确认未逃逸出 UPLOADS_ROOT */
export function resolveUploadPath(relPath: string): string {
  const abs = resolve(UPLOADS_ROOT, relPath);
  const root = resolve(UPLOADS_ROOT);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new ImageValidationError('非法存储路径');
  }
  return abs;
}

/**
 * 契约 3：处理并存储图片。
 * @param buf    原始图片字节
 * @param relDir 存储相对目录，形如 `appointment/<aid>/<stepKey>`（须过 isSafeRelDir）
 * @returns      签名后的 { url, thumbUrl }
 */
export async function processAndStoreImage(buf: Buffer, relDir: string): Promise<UploadedImage> {
  // 1) 大小校验
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw new ImageValidationError('空文件');
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError('图片超过 10MB 大小限制');
  }
  // 2) MIME 校验（魔数嗅探）
  const mime = sniffImageMime(buf);
  if (!mime || !ALLOWED_MIMES.has(mime)) {
    throw new ImageValidationError('仅支持 JPG / PNG / WebP 图片');
  }
  // 3) relDir 白名单校验
  if (!isSafeRelDir(relDir)) {
    throw new ImageValidationError('relDir 非法');
  }
  // 4) 解码（jimp 纯 JS；不支持的编码如部分 webp 会在此抛出，统一包装为业务错误）
  let image;
  try {
    image = await Jimp.read(buf);
  } catch {
    throw new ImageValidationError('图片无法解析（文件损坏或编码不受支持）');
  }
  // 5) 原图最长边 >2000 则重采样到 2000
  if (Math.max(image.width, image.height) > ORIGINAL_MAX_EDGE) {
    image.scaleToFit({ w: ORIGINAL_MAX_EDGE, h: ORIGINAL_MAX_EDGE });
  }
  // 6) 缩略图：400px 最长边
  const thumb = image.clone();
  if (Math.max(thumb.width, thumb.height) > THUMB_MAX_EDGE) {
    thumb.scaleToFit({ w: THUMB_MAX_EDGE, h: THUMB_MAX_EDGE });
  }
  // 7) 统一转 jpeg（质量 82）落盘
  const name = randomUUID();
  const relPath = `${relDir}/${name}.jpg`;
  const thumbRelPath = `${relDir}/${name}_thumb.jpg`;
  mkdirSync(join(UPLOADS_ROOT, relDir), { recursive: true });
  const [origBuf, thumbBuf] = await Promise.all([
    image.getBuffer('image/jpeg', { quality: JPEG_QUALITY }),
    thumb.getBuffer('image/jpeg', { quality: JPEG_QUALITY }),
  ]);
  await Promise.all([
    writeFile(resolveUploadPath(relPath), origBuf),
    writeFile(resolveUploadPath(thumbRelPath), thumbBuf),
  ]);
  // 8) 返回签名 URL 对
  return { url: signImagePath(relPath), thumbUrl: signImagePath(thumbRelPath) };
}
