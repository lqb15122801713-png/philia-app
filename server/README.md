# Philia Server

菲丽亚宠物后端服务。P1 阶段已完成数据库层（T1.1：Drizzle ORM schema + 迁移 + 种子）。

技术栈：

- **Hono** — 轻量 Web 框架（P1 后续任务接入）
- **tRPC** — 端到端类型安全 API（P1 后续任务接入）
- **Drizzle ORM 0.44** — 类型安全 ORM
- **嵌入式 SQLite（@libsql/client）** — v1 本地开发数据库

## 目录结构

```
server/
├── drizzle.config.ts        # drizzle-kit 配置（dialect: sqlite）
├── drizzle/                 # drizzle-kit generate 产出的迁移 SQL + meta
│   └── 0000_boring_stature.sql
├── src/
│   └── db/
│       ├── schema.ts        # 18 张表完整 schema（字段级中文注释）
│       ├── index.ts         # 连接单点：client + db + schema 导出
│       ├── migrate.ts       # 迁移执行器（drizzle migrate helper，幂等）
│       └── seed.ts          # 幂等种子脚本
├── scripts/
│   └── verify-db.mjs        # 冒烟验证：表/约束/行数
└── data/
    └── philia.db            # SQLite 库文件（运行时生成，勿提交）
```

## 常用命令

```bash
npm run db:generate   # 依据 schema 生成迁移 SQL（产出到 drizzle/）
npm run db:migrate    # 应用迁移到 data/philia.db（幂等，可重复执行）
npm run db:seed       # 写入种子数据（幂等：重跑先清业务表再重插，数据不翻倍）
npm run typecheck     # tsc --noEmit 类型检查
node scripts/verify-db.mjs   # 冒烟验证 18 表 / 约束 / 种子行数
```

全新初始化：`npm run db:generate && npm run db:migrate && npm run db:seed`。

## 数据库决策：v1 用嵌入式 SQLite，未来切 MySQL

本机无 MySQL/Docker，v1 本地开发采用 **@libsql/client + drizzle-orm/libsql**
（`file:data/philia.db`，连接单点 `src/db/index.ts`）。切换 MySQL 的路径：

1. `drizzle.config.ts`：`dialect: 'sqlite'` → `'mysql'`，改 `dbCredentials`；
2. `src/db/index.ts`：`createClient`/`drizzle` 初始化换成 mysql2 驱动；
3. 重新 `db:generate` 产出 MySQL 方言迁移；
4. schema 字段语义（类型/约束/默认值）保持不变，业务代码零改动。

SQLite 单写者模型下行锁天然安全；代码中保留 `db.transaction` 事务结构，
切到 MySQL 后事务语义直接成立。

## schema 约定（全库统一）

- **表名/字段名**：snake_case。
- **主键**：text ULID，应用层生成（`ulid` 包，`$defaultFn`）；`event_outbox.id`
  使用 `monotonicFactory` 保证单调递增（按 id 排序即按时间排序）。
- **枚举**：text 列 + 注释标明取值集合（如 `status: active | closed`），
  应用层用 zod 约束；SQLite 无原生 enum。
- **JSON 列**：text（`mode: 'json'`）+ `$type<T>()`，TS 类型定义集中在
  `schema.ts` 顶部（`StoreOpenHours` / `OrderItem` 等），应用层 zod 校验结构。
- **金额**：integer，单位「分」，字段名 `*_fen`。
- **日期时间**：integer（`mode: 'timestamp'`），Unix 秒，JS `Date` 读写，
  默认 `(unixepoch())`；纯日期字段（`birthday` / `vaccine_valid_until` /
  `log_date`）用 text，ISO 格式 `YYYY-MM-DD`。
- **审计列**：`created_at` / `updated_at` 全表必备；SQLite 无 `ON UPDATE`，
  `updated_at` 由应用层在更新时显式写入。

## 18 张表一览

| 章节 | 表 |
| --- | --- |
| 5.1 账号/门店 | `users`、`user_roles`、`stores`、`staff`、`staff_invites` |
| 5.2 宠物/服务 | `pets`、`services` |
| 5.3 预约/步骤/寄养 | `appointments`、`store_slots`、`appointment_steps`、`step_photos`、`boarding_stays`、`boarding_daily_logs` |
| 5.4 商城 | `products`、`orders` |
| 5.5 推送/事件/通知 | `push_subscriptions`、`event_outbox`、`notifications` |

## 种子数据说明

`db:seed` 写入：1 门店（菲丽亚宠物·示例店，全周 09:00-20:00）、1 店主
（merchant_owner）+ 3 员工（staff，技能覆盖 wash/groom/boarding）+ 1 客户、
2 宠物（1 狗 1 猫含疫苗有效期）、10 服务项（grooming 6 + boarding 4 含房型）、
10 商品（主粮/零食/玩具/清洁，images 用 `/brand/` 占位路径）、
`store_slots` 154 条（明天起 7 天 × 22 个 30min 时段，capacity=2）。

详见根目录 `plan.md`。
