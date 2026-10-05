/**
 * 迁移执行器（npm run db:migrate）
 *
 * 使用 drizzle-orm 官方 migrate helper：读取 drizzle/ 目录下的迁移 SQL，
 * 按 drizzle/meta/_journal.json 的顺序逐条应用，已应用的迁移记录在
 * __drizzle_migrations 表中 —— 天然幂等，重复执行不会重复应用。
 *
 * 执行后打印已应用迁移清单。
 */

import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { client, db } from './index';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

console.log(`[migrate] 迁移目录: ${migrationsFolder}`);

/**
 * SQLite 迁移标准前置（12-step 口径）：迁移期间关闭外键约束。
 * drizzle libsql migrator 把语句包在事务批内执行，PRAGMA foreign_keys 在事务内
 * 无效，必须在进入迁移前在连接级关闭（M1-补1：cashier_bills 增 operator_id
 * NOT NULL+REFERENCES 列需 DEFAULT 回填窗，FK 开启时 SQLite 拒绝该 ALTER）。
 * 迁移结束后恢复开启。
 */
await client.execute('PRAGMA foreign_keys = OFF');
try {
  await migrate(db, { migrationsFolder });
} finally {
  await client.execute('PRAGMA foreign_keys = ON');
}

// drizzle 的迁移记录表：__drizzle_migrations(hash, created_at)
// 注：该表主键为 SERIAL PRIMARY KEY（非 INTEGER PRIMARY KEY），SQLite 下 id 恒为
// NULL，属 drizzle 已知行为，故按 created_at 排序展示。
const applied = await client.execute(
  'SELECT hash, created_at AS createdAt FROM __drizzle_migrations ORDER BY created_at',
);

console.log(`[migrate] 迁移完成，已应用 ${applied.rows.length} 条迁移：`);
for (const row of applied.rows) {
  console.log(
    `  - hash=${String(row.hash).slice(0, 12)}…  applied_at=${new Date(Number(row.createdAt)).toISOString()}`,
  );
}

client.close();
