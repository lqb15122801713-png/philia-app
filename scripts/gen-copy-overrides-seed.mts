/**
 * 文案端口种子生成器（端口批片 B · CJ-1002-01）：
 * 扫三端 copy 键表（export const *_COPY）→ 生成两个产物：
 * 1. server/src/db/copySeedRows.ts —— 种子行数据（seed.ts 幂等补种用，单源）；
 * 2. server/drizzle/0024_copy_overrides.sql 的种子 INSERT 段（存量库迁移用，同单源出）。
 *
 * 用法（仓库根）：npx tsx scripts/gen-copy-overrides-seed.mts
 * 域口径：customer 按文件名成域（account/mall/refund/…，member 组件表=member 域）；
 *         merchant/staff 加端前缀（merchant:cashier / staff:today）。
 * 键全局唯一硬校验（rule_key 主键语义）——撞键即报错退出（同文去重/异文冲突分列）。
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

interface Row { key: string; domain: string; text: string }

const ROOT = process.cwd();
const CUSTOMER_COPY = 'apps/customer/src/copy';
const MERCHANT_COPY = 'apps/merchant/src/copy';
const STAFF_COPY = 'apps/staff/src/copy';
const MEMBER_COPY = 'apps/customer/src/components/member/copy.ts';

function isCopyTable(v: unknown): v is Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((x) => typeof x === 'string');
}

async function extract(absPath: string, domain: string): Promise<Row[]> {
  const mod = (await import(pathToFileURL(absPath).href)) as Record<string, unknown>;
  const rows: Row[] = [];
  for (const [exportName, value] of Object.entries(mod)) {
    if (!exportName.endsWith('_COPY')) continue;
    if (!isCopyTable(value)) continue; // PAY_AGREEMENTS 等非字典件跳过（协议全文走 agreements 表，不在本片）
    for (const [key, text] of Object.entries(value)) rows.push({ key, domain, text });
  }
  if (rows.length === 0) throw new Error(`未取到 copy 表：${absPath}`);
  return rows;
}

const rows: Row[] = [];
for (const f of readdirSync(join(ROOT, CUSTOMER_COPY)).filter((x) => x.endsWith('.ts')).sort()) {
  rows.push(...(await extract(join(ROOT, CUSTOMER_COPY, f), f.replace(/\.ts$/, ''))));
}
rows.push(...(await extract(join(ROOT, MEMBER_COPY), 'member')));
for (const f of readdirSync(join(ROOT, MERCHANT_COPY)).filter((x) => x.endsWith('.ts')).sort()) {
  rows.push(...(await extract(join(ROOT, MERCHANT_COPY, f), `merchant:${f.replace(/\.ts$/, '')}`)));
}
for (const f of readdirSync(join(ROOT, STAFF_COPY)).filter((x) => x.endsWith('.ts')).sort()) {
  rows.push(...(await extract(join(ROOT, STAFF_COPY, f), `staff:${f.replace(/\.ts$/, '')}`)));
}

/* 键全局唯一硬校验（rule_key 语义）；同文同值=去重保留一，异值=冲突报错 */
const byKey = new Map<string, Row[]>();
for (const r of rows) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);
const dupSame: string[] = [];
const conflicts: string[] = [];
const finalRows: Row[] = [];
for (const [key, list] of byKey) {
  const texts = new Set(list.map((r) => r.text));
  if (texts.size > 1) {
    conflicts.push(`${key} ← ${list.map((r) => `${r.domain}「${r.text.slice(0, 20)}」`).join(' / ')}`);
    continue;
  }
  if (list.length > 1) dupSame.push(`${key}（${list.map((r) => r.domain).join('/')}）`);
  finalRows.push({ key, domain: list[0]!.domain, text: list[0]!.text });
}
if (conflicts.length > 0) {
  console.error('键冲突（同键异文，须人工裁决）：\n' + conflicts.join('\n'));
  process.exit(1);
}
if (dupSame.length > 0) console.log(`同文去重 ${dupSame.length} 键：${dupSame.slice(0, 8).join('；')}${dupSame.length > 8 ? ' …' : ''}`);
finalRows.sort((a, b) => (a.domain + a.key).localeCompare(b.domain + b.key));
console.log(`键总数=${rows.length} 去重后=${finalRows.length} 域数=${new Set(finalRows.map((r) => r.domain)).size}`);

/* 产物 1：server/src/db/copySeedRows.ts */
const tsOut = `/**
 * 文案端口种子行（端口批片 B）——生成件，勿手改（源=scripts/gen-copy-overrides-seed.mts）；
 * 重生成：仓库根 npx tsx scripts/gen-copy-overrides-seed.mts（copy 键表增删键后须重跑+新迁移落库）。
 * 生成时间口径：${new Date().toISOString()}；键数=${finalRows.length}
 */
export const COPY_SEED_ROWS: Array<{ key: string; domain: string; text: string }> = ${JSON.stringify(finalRows, null, 1)};
`;
writeFileSync(join(ROOT, 'server/src/db/copySeedRows.ts'), tsOut);

/* 产物 2：0024 迁移种子段（存量库；幂等=rule_key active 行 NOT EXISTS 守卫，重放零副作用） */
const esc = (s: string) => s.replaceAll("'", "''");
const chunks: string[] = [];
for (let i = 0; i < finalRows.length; i += 400) {
  const slice = finalRows.slice(i, i + 400);
  const values = slice
    .map((r) => `  ('${esc(r.key)}', '${esc(r.domain)}', '${esc(r.text)}')`)
    .join(',\n');
  chunks.push(`WITH s(rule_key, label, text) AS (VALUES
${values}
)
INSERT INTO \`copy_overrides\` (\`id\`,\`version\`,\`rule_key\`,\`label\`,\`value_json\`,\`effective_from\`,\`active\`,\`created_by\`,\`created_at\`,\`updated_at\`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, s.rule_key, s.label, json_object('text', s.text), unixepoch(), 1, 'system', unixepoch(), unixepoch()
FROM s
WHERE NOT EXISTS (SELECT 1 FROM \`copy_overrides\` WHERE \`rule_key\` = s.rule_key AND \`active\` = 1);`);
}
writeFileSync(join(ROOT, 'server/drizzle/0024_seed_section.sql.part'), chunks.join('\n--> statement-breakpoint\n') + '\n');
console.log('产物：server/src/db/copySeedRows.ts + server/drizzle/0024_seed_section.sql.part');
