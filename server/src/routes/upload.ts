/**
 * 上传端点（契约 3 · T1.5）：POST /api/upload
 *
 * multipart form-data：file（图片）+ relDir（存储相对目录，白名单校验防路径穿越）。
 * 要求已登录（Hono context 注入 sessionUser，由 T1.2 会话中间件提供；冒烟脚本可直接注入）。
 * 成功返回 { url, thumbUrl }（均为签名 URL）；业务校验失败 400，未登录 401。
 *
 * T1.6 集成时：app.route('/', uploadRoute) 或 app.route('/api', ...) 均可，
 * 本文件只导出 Hono 子路由，路径前缀在此固定为 /api/upload。
 */

import { Hono } from 'hono';
import {
  ImageValidationError,
  isSafeRelDir,
  MAX_IMAGE_BYTES,
  processAndStoreImage,
} from '../storage/images';

/** 会话用户（结构对齐契约 1 SessionUser；仅做存在性校验，不 import T1.2 并行开发中的文件） */
export interface SessionUserLike {
  id: string;
  nickname?: string | null;
  roles?: string[];
  staffId?: string;
  storeId?: string;
}

type UploadEnv = { Variables: { sessionUser?: SessionUserLike | null } };

export const uploadRoute = new Hono<UploadEnv>().post('/api/upload', async (c) => {
  const user = c.get('sessionUser');
  if (!user?.id) {
    return c.json({ error: 'UNAUTHORIZED', message: '请先登录' }, 401);
  }

  const body = await c.req.parseBody();
  const file = body['file'];
  const relDir = body['relDir'];

  if (typeof relDir !== 'string' || !isSafeRelDir(relDir)) {
    return c.json({ error: 'BAD_REQUEST', message: 'relDir 缺失或非法' }, 400);
  }
  if (!(file instanceof File)) {
    return c.json({ error: 'BAD_REQUEST', message: '缺少 file 字段' }, 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return c.json({ error: 'BAD_REQUEST', message: '图片超过 10MB 大小限制' }, 400);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const result = await processAndStoreImage(buf, relDir);
    return c.json(result, 200);
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return c.json({ error: 'BAD_REQUEST', message: err.message }, 400);
    }
    throw err;
  }
});
