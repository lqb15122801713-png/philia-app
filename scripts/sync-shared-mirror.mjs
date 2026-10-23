#!/usr/bin/env node
/* 共享区镜像同步（走查修复批交付后立规：每日收工跑一次）
 *
 * 源=D:\Philia-shared\*.md（顶面一层，不递归）→ 仓 docs/ops/shared-mirror/
 * 排除=含 PII 的客户台账两件（运营-0923 会员台账导出原件.xls / 次卡夹带逐人明细.csv——
 *   本就非 md 天然出局，名单兜底登记防后续同名 md 混入）；行尾归一 LF；
 * 镜像语义=仓侧有而源侧已无者删；内容比对后零变化零写（幂等）。
 *
 * 用法：node scripts/sync-shared-mirror.mjs [--src <sharedDir>] [--dst <repoMirrorDir>]
 * 默认：src=D:/Philia-shared，dst=<repoRoot>/docs/ops/shared-mirror（repoRoot=脚本上两级）
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = argOf('--src', 'D:/Philia-shared');
const DST = argOf('--dst', join(REPO_ROOT, 'docs', 'ops', 'shared-mirror'));

/* PII 排除名单（两件客户台账；按文件名精确匹配，大小写不敏感） */
const PII_EXCLUDE = new Set([
  '运营-0923-宠老板会员台账导出原件（含pii·切换日对账用）.xls',
  '运营-0923-次卡夹带会员逐人明细（含pii·切换日施工用）.csv',
].map((s) => s.toLowerCase()));

const norm = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n');

if (!existsSync(SRC)) { console.error(`源目录不存在：${SRC}`); process.exit(1); }
mkdirSync(DST, { recursive: true });

const srcFiles = readdirSync(SRC).filter((n) => n.toLowerCase().endsWith('.md') && !PII_EXCLUDE.has(n.toLowerCase()));
const dstFiles = new Set(existsSync(DST) ? readdirSync(DST).filter((n) => n.endsWith('.md')) : []);

let added = 0, updated = 0, deleted = 0, same = 0;
for (const n of srcFiles) {
  const content = norm(readFileSync(join(SRC, n)));
  const dstPath = join(DST, n);
  if (dstFiles.has(n)) {
    if (norm(readFileSync(dstPath)) === content) { same++; continue; }
    updated++;
  } else {
    added++;
  }
  writeFileSync(dstPath, content);
}
const srcSet = new Set(srcFiles);
for (const n of dstFiles) {
  if (!srcSet.has(n)) { rmSync(join(DST, n)); deleted++; }
}
console.log(`shared-mirror 同步：源 ${srcFiles.length} 件 → 新增 ${added} / 更新 ${updated} / 删除 ${deleted} / 不变 ${same}`);
console.log(`PII 排除名单在册 2 件（非 md 天然出局，兜底登记）：${[...PII_EXCLUDE].join(' | ')}`);
