/**
 * 图片访问端点（契约 3 · T1.5）：GET /api/img/*
 *
 * 流程：URL 解码 relPath → 路径安全校验（拒 `..`/穿越，403）
 *   → 验签（sig/exp/relPath 三者一致，失败 403）
 *   → 过期校验（exp < now，410 Gone）
 *   → 流式返回文件（image/jpeg，长缓存；URL 本身含签名，内容不变）。
 * 文件不存在返回 404。物理路径永不暴露在响应中。
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Hono } from 'hono';
import { Readable } from 'node:stream';
import { resolveUploadPath } from '../storage/images';
import { imageSignatureMatches, isSafeImageRelPath } from '../storage/sign';

const PATH_PREFIX = '/api/img/';

export const imagesRoute = new Hono().get('/api/img/*', async (c) => {
  // 1) 提取并解码 relPath（URL.pathname 保持百分号编码，须显式解码后验签/校验）
  let relPath: string;
  try {
    relPath = decodeURIComponent(new URL(c.req.url).pathname.slice(PATH_PREFIX.length));
  } catch {
    return c.json({ error: 'FORBIDDEN', message: '非法路径' }, 403);
  }

  // 2) 路径安全校验（含 ..%2F 穿越尝试，解码后必被拦截）
  if (!isSafeImageRelPath(relPath)) {
    return c.json({ error: 'FORBIDDEN', message: '非法路径' }, 403);
  }

  // 3) 验签：sig/exp/relPath 三者一致
  const sig = c.req.query('sig') ?? '';
  const exp = Number(c.req.query('exp'));
  if (!imageSignatureMatches(relPath, sig, exp)) {
    return c.json({ error: 'FORBIDDEN', message: '签名无效' }, 403);
  }

  // 4) 过期校验（签名合法但已过期 → 410 Gone）
  if (exp < Math.floor(Date.now() / 1000)) {
    return c.json({ error: 'GONE', message: '链接已过期' }, 410);
  }

  // 5) 读文件并流式返回
  let filePath: string;
  try {
    filePath = resolveUploadPath(relPath);
  } catch {
    return c.json({ error: 'FORBIDDEN', message: '非法路径' }, 403);
  }
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) {
    return c.json({ error: 'NOT_FOUND', message: '图片不存在' }, 404);
  }

  c.header('Content-Type', 'image/jpeg');
  c.header('Content-Length', String(info.size));
  // 内容按 uuid 命名不可变，签名 URL 内可长缓存
  c.header('Cache-Control', 'private, max-age=31536000, immutable');
  return c.body(Readable.toWeb(createReadStream(filePath)) as ReadableStream);
});
