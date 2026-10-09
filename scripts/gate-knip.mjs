#!/usr/bin/env node
/**
 * knip 闸门包装（闸门两件之一 · CJ-1008-06/任务-A窗-1008-闸门加两件）：
 * 零基线建档（scripts/baselines/knip-baseline.json）——跑 knip（JSON 机读），
 * 当前发现项 ⊄ 基线=增量违规 → 红（列明细）；基线收窄（有消除）=提示不红。
 *
 * 用法：
 *   node scripts/gate-knip.mjs              # 闸门（增量零新增才绿）
 *   node scripts/gate-knip.mjs --write      # 重建基线（仅建档/核销时用，PR 须明说）
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BASELINE = join(ROOT, 'scripts', 'baselines', 'knip-baseline.json');
const WRITE = process.argv.includes('--write');

/** knip JSON 发现项 → 稳定可比的字符串集（类别:文件[:符号/包名]） */
function normalize(json) {
  const items = [];
  for (const file of json.issues ?? []) {
    for (const [kind, list] of Object.entries(file)) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        const name = typeof entry === 'string' ? entry : (entry.name ?? entry.symbol ?? JSON.stringify(entry));
        items.push(`${kind}:${file.file}:${name}`);
      }
    }
  }
  return [...new Set(items)].sort();
}

let raw;
try {
  /* 直跑仓内 knip CLI（不经 npx：Windows .cmd spawn 兼容面最差）；有发现项=exit 1（非异常）输出照读 */
  const knipCli = join(ROOT, 'node_modules', 'knip', 'dist', 'cli.js');
  raw = execFileSync(process.execPath, [knipCli, '--config', 'knip.config.cjs', '--reporter', 'json'], {
    cwd: ROOT, maxBuffer: 128 * 1024 * 1024, encoding: 'utf8', shell: false,
  });
} catch (err) {
  raw = err.stdout ?? '';
  if (!raw.trim().startsWith('{')) {
    console.error('knip 执行失败（非发现项 exit）：', err.stderr ?? err.message);
    process.exit(2);
  }
}
const current = normalize(JSON.parse(raw));

if (WRITE) {
  mkdirSync(join(ROOT, 'scripts', 'baselines'), { recursive: true });
  writeFileSync(BASELINE, JSON.stringify({ note: 'knip 零基线建档（任务-A窗-1008 闸门加两件）：增量必零新增；核销旧件=重跑 --write 并在 PR 明说', generatedAt: new Date().toISOString(), items: current }, null, 2) + '\n');
  console.log(`knip 基线已建档：${current.length} 项（${BASELINE}）`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('knip 基线缺失：先跑 node scripts/gate-knip.mjs --write 建档（PR 明说）');
  process.exit(1);
}
const baseline = new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).items);
const added = current.filter((i) => !baseline.has(i));
const removed = [...baseline].filter((i) => !new Set(current).has(i));
if (added.length > 0) {
  console.error(`knip 闸门红：增量违规 ${added.length} 项（基线外新增）：`);
  for (const i of added) console.error(`  + ${i}`);
  process.exit(1);
}
console.log(`knip 闸门绿：增量零新增（当前 ${current.length} 项 ⊆ 基线 ${baseline.size} 项${removed.length ? `；较基线收窄 ${removed.length} 项（可择机 --write 核销）` : ''}）`);
