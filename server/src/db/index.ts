/**
 * 数据库连接单点（唯一入口，全应用从这里取 db / client）
 *
 * v1 本地开发：嵌入式 SQLite —— @libsql/client + drizzle-orm/libsql，
 * 库文件默认 <server>/data/philia.db（目录自动创建）。
 * 可用环境变量 PHILIA_DB_URL 覆盖（测试/多实例场景），值形如 file:xxx.db。
 *
 * 未来切换 MySQL：仅需替换此文件的 client/drizzle 初始化（mysql2 + drizzle-orm/mysql2）
 * 与 drizzle.config.ts 的 dialect，schema 与业务代码不动。
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

/** 默认库文件：相对本文件定位（server/data/philia.db），与进程 CWD 无关 */
const defaultDbFile = fileURLToPath(new URL('../../data/philia.db', import.meta.url));

/** libsql 的 file: URL 在 Windows 下需使用正斜杠路径 */
const toFileUrl = (p: string) => `file:${p.replaceAll('\\', '/')}`;

const url = process.env.PHILIA_DB_URL ?? toFileUrl(defaultDbFile);

// file: 本地库需要确保目录存在（libsql 不会自动建目录）
if (url.startsWith('file:')) {
  mkdirSync(dirname(defaultDbFile), { recursive: true });
}

/** 底层 libsql client（执行原生 SQL / 事务脚本时使用） */
export const client = createClient({ url });

// 写锁等待 5s：libsql 单连接并发写事务会 SQLITE_BUSY 并可能中毒连接（T5.1 实测）。
// busy_timeout 让并发写串行等待而非立即失败；配合应用层串行锁（mall 域已用）双保险。
await client.execute('PRAGMA busy_timeout = 5000');

/** drizzle 实例（携带全量 schema，查询构建入口） */
export const db = drizzle(client, { schema });

export { schema };
export * from './schema';
