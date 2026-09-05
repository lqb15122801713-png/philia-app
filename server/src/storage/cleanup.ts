/**
 * 孤儿文件回收（开发方案 §4.5 · T1.5）
 *
 * 背景：/api/upload 成功但随后 serviceStep.addPhotos 登记失败（弱网中断、客户端崩溃）
 * 会产生无表记录引用的孤儿文件。本模块扫描 uploads/，回收「mtime 超过 24h 且
 * 无任何表记录引用」的图片文件（原图与 _thumb 各自独立判定）。
 *
 * 引用来源（URL 取路径部分比对，忽略 sig/exp 查询串）：
 *   step_photos.url / thumb_url、products.images[]、boarding_daily_logs.photos[]、
 *   users.avatar_url、pets.avatar_url。
 *
 * 导出 cleanupOrphanImages() 供定时任务调用；也可直接手动跑：
 *   npx tsx src/storage/cleanup.ts            # 实际回收
 *   npx tsx src/storage/cleanup.ts --dry-run  # 只列出不删除
 */

import { readdir, stat, unlink } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { db, schema } from '../db';
import { UPLOADS_ROOT } from './images';

export const ORPHAN_MIN_AGE_MS = 24 * 3600 * 1000; // 24h

export interface CleanupOptions {
  /** 回收阈值：mtime 早于 now-olderThanMs 才考虑回收，默认 24h */
  olderThanMs?: number;
  /** 只列出不删除 */
  dryRun?: boolean;
  /** 限定扫描子目录（相对 uploads/，测试隔离用）；默认全量扫描 */
  scopePrefix?: string;
  /** 注入"当前时间"（测试用） */
  now?: number;
}

export interface CleanupResult {
  scanned: number;
  deleted: string[];
  /** 超过 24h 但有表记录引用，保留 */
  keptReferenced: string[];
  /** 未满 24h，跳过 */
  skippedYoung: number;
}

/** 递归列出 uploads/ 下所有文件（相对路径，正斜杠） */
async function listFilesRecursive(absDir: string, relPrefix: string, out: string[]): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true }).catch(() => [] as never[]);
  for (const entry of entries) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await listFilesRecursive(join(absDir, entry.name), rel, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
}

/** 从存储的 URL（可能带 ?sig=...&exp=...）提取 /api/img/ 后的 relPath；非本站图片 URL 返回 null */
function extractRelPath(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const path = url.split('?')[0];
  const idx = path.indexOf('/api/img/');
  if (idx === -1) return null;
  const rel = path.slice(idx + '/api/img/'.length);
  return rel || null;
}

/** 汇总全库引用的图片 relPath 集合 */
async function collectReferencedRelPaths(): Promise<Set<string>> {
  const refs = new Set<string>();
  const add = (url: unknown) => {
    const rel = extractRelPath(url);
    if (rel) refs.add(rel);
  };

  const photoRows = await db
    .select({ url: schema.stepPhotos.url, thumbUrl: schema.stepPhotos.thumbUrl })
    .from(schema.stepPhotos);
  for (const row of photoRows) {
    add(row.url);
    add(row.thumbUrl);
  }

  const productRows = await db.select({ images: schema.products.images }).from(schema.products);
  for (const row of productRows) {
    if (Array.isArray(row.images)) row.images.forEach(add);
  }

  const logRows = await db
    .select({ photos: schema.boardingDailyLogs.photos })
    .from(schema.boardingDailyLogs);
  for (const row of logRows) {
    if (Array.isArray(row.photos)) row.photos.forEach(add);
  }

  const userRows = await db.select({ avatarUrl: schema.users.avatarUrl }).from(schema.users);
  for (const row of userRows) add(row.avatarUrl);

  const petRows = await db.select({ avatarUrl: schema.pets.avatarUrl }).from(schema.pets);
  for (const row of petRows) add(row.avatarUrl);

  return refs;
}

/** 扫描 uploads/，回收 >24h 且无表记录引用的孤儿文件 */
export async function cleanupOrphanImages(options: CleanupOptions = {}): Promise<CleanupResult> {
  const olderThanMs = options.olderThanMs ?? ORPHAN_MIN_AGE_MS;
  const now = options.now ?? Date.now();
  const scopePrefix = options.scopePrefix?.replace(/^\/+|\/+$/g, '');

  const files: string[] = [];
  const scanRoot = scopePrefix ? join(UPLOADS_ROOT, scopePrefix) : UPLOADS_ROOT;
  await listFilesRecursive(scanRoot, scopePrefix ?? '', files);

  const referenced = await collectReferencedRelPaths();

  const result: CleanupResult = { scanned: 0, deleted: [], keptReferenced: [], skippedYoung: 0 };
  for (const rel of files) {
    result.scanned += 1;
    const abs = join(UPLOADS_ROOT, ...rel.split('/'));
    const info = await stat(abs).catch(() => null);
    if (!info?.isFile()) continue;
    if (now - info.mtimeMs < olderThanMs) {
      result.skippedYoung += 1;
      continue;
    }
    if (referenced.has(rel)) {
      result.keptReferenced.push(rel);
      continue;
    }
    result.deleted.push(rel);
    if (!options.dryRun) {
      await unlink(abs);
    }
  }
  return result;
}

/* ---------------- 手动脚本入口 ---------------- */

const invokedAsScript =
  !!process.argv[1] && import.meta.url === pathToFileURL(join(process.argv[1])).href;

if (invokedAsScript) {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[cleanup] 扫描 ${UPLOADS_ROOT}${dryRun ? '（dry-run，不删除）' : ''} …`);
  const result = await cleanupOrphanImages({ dryRun });
  console.log(`[cleanup] 扫描 ${result.scanned} 个文件；跳过(未满24h) ${result.skippedYoung}；保留(有引用) ${result.keptReferenced.length}；回收 ${result.deleted.length}：`);
  for (const rel of result.deleted) console.log(`  - ${rel.split(sep).join('/')}`);
}
