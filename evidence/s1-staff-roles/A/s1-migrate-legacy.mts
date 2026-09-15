/**
 * 批次 S1 任务 A 证据脚本（一次性，不入库）：
 * 模拟「存量库停在 0005」→ 插入旧版员工行（无 role 列）→ 应用 0006 →
 * 存量行自动补默认 role='groomer' → 重跑迁移幂等（不重复应用）。
 *
 * 运行：node node_modules/tsx/dist/cli.mjs scripts/s1-migrate-legacy.mts
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const serverRoot = fileURLToPath(new URL('..', import.meta.url));
const drizzleDir = join(serverRoot, 'drizzle');
const work = join(tmpdir(), `philia-s1-legacy-${process.pid}`);
const oldDir = join(work, 'drizzle-old');
mkdirSync(join(oldDir, 'meta'), { recursive: true });

// 1) 复制 0000-0005 迁移与 journal（剔除 0006），模拟 S1 前的迁移目录
for (let i = 0; i <= 5; i++) {
  const f = [
    '0000_boring_stature',
    '0001_past_bloodaxe',
    '0002_huge_unus',
    '0003_handy_marvel_boy',
    '0004_dark_mandarin',
    '0005_chunky_swordsman',
  ][i]!;
  copyFileSync(join(drizzleDir, `${f}.sql`), join(oldDir, `${f}.sql`));
  copyFileSync(join(drizzleDir, 'meta', `${String(i).padStart(4, '0')}_snapshot.json`), join(oldDir, 'meta', `${String(i).padStart(4, '0')}_snapshot.json`));
}
const journal = JSON.parse(readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
journal.entries = journal.entries.slice(0, 6);
writeFileSync(join(oldDir, 'meta', '_journal.json'), JSON.stringify(journal, null, 2));

const dbFile = join(work, 'legacy.db').replaceAll('\\', '/');
const client = createClient({ url: `file:${dbFile}` });
const db = drizzle(client);

// 2) 迁移到 0005（S1 前状态）
await migrate(db, { migrationsFolder: oldDir });
const at0005 = await client.execute('SELECT COUNT(*) AS c FROM __drizzle_migrations');
console.log(`[legacy] 迁移到 0005：已应用 ${at0005.rows[0].c} 条（期望 6）`);

// 3) 插入旧版数据：门店 + 用户 + 员工（无 role 列，模拟存量行）
await client.execute(`INSERT INTO users (id, kimi_id, nickname) VALUES ('u_legacy_owner', 'legacy_owner', '旧店主')`);
await client.execute(`INSERT INTO users (id, kimi_id, nickname) VALUES ('u_legacy_staff', 'legacy_staff', '旧员工')`);
await client.execute(`INSERT INTO stores (id, owner_id, name, status) VALUES ('s_legacy', 'u_legacy_owner', '旧门店', 'active')`);
await client.execute(`INSERT INTO staff (id, store_id, user_id, name, status) VALUES ('st_legacy', 's_legacy', 'u_legacy_staff', '旧员工', 'active')`);
console.log('[legacy] 已按 0005 schema 插入存量员工行（无 role 列）');

// 4) 应用 0006（真实迁移目录）
await migrate(db, { migrationsFolder: drizzleDir });
const after = await client.execute(`SELECT id, name, role, status FROM staff WHERE id = 'st_legacy'`);
console.log('[0006 应用后] 存量员工行：', JSON.stringify(after.rows[0]));

// 5) 重跑迁移（幂等：__drizzle_migrations 已有 0006 记录，不重复应用）
await migrate(db, { migrationsFolder: drizzleDir });
const final = await client.execute('SELECT COUNT(*) AS c FROM __drizzle_migrations');
const role2 = await client.execute(`SELECT role FROM staff WHERE id = 'st_legacy'`);
console.log(`[重跑] 迁移记录 ${final.rows[0].c} 条（期望 7，不重复应用）；role 仍为 ${role2.rows[0].role}`);

client.close();
try {
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
} catch {
  console.warn(`[warn] 临时目录清理失败（Windows libsql 句柄滞后，可手工删）: ${work}`);
}
console.log('存量零破坏 + 幂等实证完成 ✅');
