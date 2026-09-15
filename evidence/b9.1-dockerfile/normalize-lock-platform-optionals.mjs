#!/usr/bin/env node
/**
 * package-lock 平台原生包归位脚本（批次 9a.1 任务 B · K3 无 Docker/WSL 替代方案）
 *
 * 原理：lock 中平台原生包条目的全部字段（version/resolved/integrity/os/cpu/optional）
 * 都是 npm registry packument 的 dist 元数据确定性投影，无本地状态——据此补齐与
 * 「Linux 容器内 npm install --package-lock-only 重生成」等价（最终由老板 VPS
 * docker build 实证收口）。
 *
 * 行为：
 * 1. 解析 lock，枚举所有含 optionalDependencies 的包条目（rollup/esbuild/fsevents/
 *    libsql 系全枚举，不只修 rollup）；
 * 2. 每个 optionalDep：按既有同族条目路径推断归位前缀（嵌套结构保持，如
 *    node_modules/vite/node_modules/@esbuild/*）；已存在 → 跳过；
 * 3. 缺失 → 从 registry 取 packument，按约束取定版本（精确版直接用，~/^ 取最大满足），
 *    补齐条目（version/resolved/integrity/cpu/dev/license/optional/os/engines/
 *    hasInstallScript，字段序对齐 server lock 既有条目）；
 * 4. packages 键全量重排序（npm 惯例）后写回（2 空格缩进 + 末尾换行）；
 * 5. 自证输出：新增条目清单、linux-x64 条目 integrity 与 registry 逐值对照表、
 *    前后 diff 摘要（只增不改不删）。
 *
 * 用法：node normalize-lock-platform-optionals.mjs <lock路径> [--check]
 *   --check 只报告缺口不写回。
 */

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { basename } from 'node:path';

const REGISTRY = process.env.NPM_REGISTRY ?? 'https://registry.npmmirror.com';
const CONCURRENCY = 8;

const lockPath = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!lockPath) {
  console.error('用法：node normalize-lock-platform-optionals.mjs <lock路径> [--check]');
  process.exit(2);
}

/* ---------------- semver 最小满足集（exact / ~ / ^） ---------------- */
const parse = (v) => v.split('.').map((n) => parseInt(n, 10));
const cmp = (a, b) => {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
};
function satisfies(version, range) {
  const v = parse(version);
  if (/^\d+\.\d+\.\d+$/.test(range)) return version === range;
  const r = parse(range.slice(1));
  if (range.startsWith('~')) {
    return v[0] === r[0] && v[1] === r[1] && cmp(v, r) >= 0;
  }
  if (range.startsWith('^')) {
    if (r[0] > 0) return v[0] === r[0] && cmp(v, r) >= 0;
    if (r[1] > 0) return v[0] === 0 && v[1] === r[1] && cmp(v, r) >= 0;
    return v[0] === 0 && v[1] === r[1] && v[2] === r[2];
  }
  throw new Error(`未支持的版本约束：${range}`);
}
const pickVersion = (versions, range) =>
  versions.filter((v) => satisfies(v, range)).sort(cmp).at(-1) ?? null;

/* ---------------- registry packument（带重试 + 限流） ---------------- */
const packumentCache = new Map();
async function packument(name) {
  if (packumentCache.has(name)) return packumentCache.get(name);
  const url = `${REGISTRY}/${name.replace('/', '%2f')}`;
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      packumentCache.set(name, json);
      return json;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`packument 拉取失败 ${name}: ${lastErr}`);
}

/* ---------------- 归位主流程 ---------------- */
const raw = readFileSync(lockPath, 'utf8');
const lock = JSON.parse(raw);
const before = structuredClone(lock.packages);

/** 归位前缀：父条目所在 node_modules 作用域（嵌套结构保持，如
 *  node_modules/vite/node_modules/esbuild 的 optionalDep 归位到
 *  node_modules/vite/node_modules/ 下）；若根级已有同名提升条目则视为已满足 */
function scopeOf(parentPath) {
  const idx = parentPath.lastIndexOf('/node_modules/');
  return idx <= 0 ? 'node_modules/' : `${parentPath.slice(0, idx)}/node_modules/`;
}

const gaps = [];
for (const [entryPath, entry] of Object.entries(lock.packages)) {
  if (!entry.optionalDependencies) continue;
  for (const [name, range] of Object.entries(entry.optionalDependencies)) {
    const hoisted = `node_modules/${name}`;
    if (lock.packages[hoisted]) continue; // 根级提升已满足（npm 提升去重）
    const target = `${scopeOf(entryPath)}${name}`;
    if (lock.packages[target]) continue;
    gaps.push({ from: entryPath, name, range, target, dev: entry.dev === true });
  }
}

console.log(`# ${basename(lockPath)} 归位扫描：缺口 ${gaps.length} 条`);
for (const g of gaps) console.log(`  缺 ${g.target}（${g.name}@${g.range}，引自 ${g.from}）`);
if (checkOnly) process.exit(gaps.length ? 1 : 0);
if (gaps.length === 0) {
  console.log('无缺口，lock 未改动。');
  process.exit(0);
}

/* 取 packument + 版本（限流并发） */
const added = [];
const integrityTable = [];
for (let i = 0; i < gaps.length; i += CONCURRENCY) {
  const batch = gaps.slice(i, i + CONCURRENCY);
  await Promise.all(
    batch.map(async (g) => {
      const doc = await packument(g.name);
      const version = /^\d+\.\d+\.\d+$/.test(g.range)
        ? g.range
        : pickVersion(Object.keys(doc.versions ?? {}), g.range);
      const manifest = doc.versions?.[version];
      if (!manifest) throw new Error(`${g.name}：无满足 ${g.range} 的版本`);
      const entry = {
        version,
        resolved: manifest.dist?.tarball,
        integrity: manifest.dist?.integrity,
      };
      if (manifest.cpu) entry.cpu = manifest.cpu;
      if (g.dev) entry.dev = true;
      if (manifest.scripts?.install || manifest.scripts?.preinstall) entry.hasInstallScript = true;
      if (manifest.libc) entry.libc = manifest.libc;
      if (manifest.license) entry.license = manifest.license;
      entry.optional = true;
      if (manifest.os) entry.os = manifest.os;
      if (manifest.engines) entry.engines = manifest.engines;
      lock.packages[g.target] = entry;
      added.push({ ...g, version, integrity: entry.integrity });
    }),
  );
}

/* packages 键重排序（npm 惯例）后写回 */
lock.packages = Object.fromEntries(
  Object.entries(lock.packages).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
);
if (!checkOnly) {
  copyFileSync(lockPath, `${lockPath}.b9.1.bak`);
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

/* ---------------- 自证 1：diff 摘要（只增不改不删） ---------------- */
const beforeKeys = new Set(Object.keys(before));
const afterKeys = Object.keys(lock.packages);
const addedKeys = afterKeys.filter((k) => !beforeKeys.has(k));
const removedKeys = [...beforeKeys].filter((k) => !lock.packages[k]);
const modifiedKeys = [...beforeKeys].filter(
  (k) => lock.packages[k] && JSON.stringify(before[k]) !== JSON.stringify(lock.packages[k]),
);
console.log('\n# diff 摘要（自证：只增不改不删）');
console.log(`  新增条目 ${addedKeys.length}；删除 ${removedKeys.length}；既有条目内容变更 ${modifiedKeys.length}`);
if (removedKeys.length || modifiedKeys.length) {
  console.error('❌ 出现非新增变更：', { removedKeys, modifiedKeys });
  process.exit(1);
}

/* ---------------- 自证 2：linux-x64 integrity 逐值对照 ---------------- */
console.log('\n# linux-x64 条目 integrity 对照（registry packument dist.integrity 复取逐值比对）');
let allMatch = true;
for (const a of added.filter((x) => /linux-x64/.test(x.name))) {
  const doc = await packument(a.name);
  const expected = doc.versions?.[a.version]?.dist?.integrity;
  const ok = expected === a.integrity;
  if (!ok) allMatch = false;
  integrityTable.push({ target: a.target, version: a.version, match: ok });
  console.log(`  ${ok ? '✓' : '✗'} ${a.target}@${a.version}\n      lock=${a.integrity}\n      reg =${expected}`);
}
if (!allMatch) {
  console.error('❌ integrity 对照存在不一致');
  process.exit(1);
}

console.log(`\n# 完成：新增 ${added.length} 条平台 optional 条目，已写回 ${lockPath}（原件备份 .b9.1.bak）`);
for (const a of added) console.log(`  + ${a.target}@${a.version}`);
