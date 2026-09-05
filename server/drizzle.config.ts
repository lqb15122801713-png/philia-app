import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit 配置
 * - v1 本地开发：嵌入式 SQLite（@libsql/client，file: 协议），dialect 为 sqlite。
 * - 未来切换 MySQL：仅需改 dialect/dbCredentials 并重新 generate，业务代码不动 schema。
 * - db:generate 只读取 schema 产出 SQL，不连接数据库；dbCredentials 供 drizzle-kit
 *   push / studio 等需要直连的命令使用。
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: 'file:./data/philia.db',
  },
});
