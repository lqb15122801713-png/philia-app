# Philia Server

菲丽亚宠物后端服务。P1 已完成：数据库层（T1.1）、tRPC 基座与认证（T1.2）、业务
router（T1.3）、实时推送（T1.4）、上传存储（T1.5）、Hono 入口集成与全链路验收（T1.6）。

技术栈：

- **Hono 4** — 轻量 Web 框架（@hono/node-server）
- **tRPC 11**（@hono/trpc-server + superjson）— 端到端类型安全 API
- **Drizzle ORM 0.44** — 类型安全 ORM
- **嵌入式 SQLite（@libsql/client）** — v1 本地开发数据库
- **jimp** — 图片解码/缩放/缩略图

## 启动与验收

```bash
npm run dev          # 开发启动（tsx watch，默认端口 7200，PORT 环境变量可覆盖）
npm run db:migrate   # 应用迁移到 data/philia.db（幂等）
npm run db:seed      # 写入种子数据（幂等：重跑先清业务表再重插）
npm run test:e2e     # 全链路验收（独立临时库，不动种子库；退出码 0 = 全绿）
npm run typecheck    # tsc --noEmit 类型检查
node scripts/verify-db.mjs   # 数据库层冒烟：表/约束/行数
```

全新初始化：`npm run db:generate && npm run db:migrate && npm run db:seed`。

> Windows 下 bash 环境若找不到 node：`export PATH="/d/kimi/resources/resources/runtime:$PATH"`；
> 或直跑 `node node_modules/tsx/dist/cli.mjs <script>`（不经 npm.cmd）。

## 端点清单

### Hono 原生端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 → `{ ok: true, ts }` |
| POST | `/api/auth/dev-login` | 开发登录（仅种子用户），签发 httpOnly 会话 cookie ⚠️ 禁上生产 |
| POST | `/api/auth/logout` | 清除会话 cookie |
| GET | `/api/events` | SSE 实时推送（需登录 + `client_id` 已登记；支持 `watch=<aid>`、`Last-Event-ID` 续传） |
| POST | `/api/upload` | 图片上传（multipart：file + relDir，登录必填）→ 签名 `{ url, thumbUrl }` |
| GET | `/api/img/*` | 签名图片访问（`?sig=&exp=` 验签，过期 410） |

### tRPC 命名空间（`/trpc/*`，前端以 `AppRouter` 类型对齐，`src/routers/index.ts` 导出）

| 命名空间 | 主要 procedure |
| --- | --- |
| `auth` | me / bindStaff / bindStore |
| `pet` | list / upsert / get |
| `store` | listNearby / getWithServices / upsertService / staffList / inviteStaff / setSchedule |
| `appointment` | create / listMine / get / getCode / confirm / assign / cancel / reviewCancel / checkin / markPaid / review / listForStore / listTodayForStaff |
| `serviceStep` | list / addPhotos / confirmStep / flagForRedo / progressSummary |
| `boarding` | 寄养入住登记 / 每日打卡 / 退住结算等 |
| `push` | subscribe / unsubscribe / listNotifications / markRead |

## 环境变量

| 变量 | 缺省 | 说明 |
| --- | --- | --- |
| `PORT` | `7200` | HTTP 监听端口 |
| `PHILIA_DB_URL` | `file:<server>/data/philia.db` | libsql 连接 URL（e2e/多实例用临时库覆盖） |
| `SESSION_SECRET` | ⚠️ dev 缺省值 | 会话 cookie HMAC 密钥，生产必须显式设置 |
| `BOOKING_CODE_SECRET` | ⚠️ dev 缺省值 | 预约二维码 HMAC 密钥，生产必须显式设置 |
| `IMG_SECRET` | ⚠️ dev 缺省值 | 图片签名 URL HMAC 密钥，生产必须显式设置 |

## 目录结构

```
server/
├── drizzle.config.ts        # drizzle-kit 配置（dialect: sqlite）
├── drizzle/                 # drizzle-kit generate 产出的迁移 SQL + meta
├── src/
│   ├── index.ts             # Hono 入口（T1.6）：CORS/会话/tRPC/SSE/上传挂载 + 优雅退出
│   ├── trpc.ts              # tRPC 基座：Context / RBAC procedure / assertAppointmentAccess
│   ├── auth/                # 会话签发校验、Hono 会话中间件、dev-login
│   ├── db/                  # schema（18 表）/ 连接单点 / 迁移 / 种子
│   ├── realtime/            # 事件总线（outbox + 通知）、内存 Hub、SSE 事件常量、清扫器
│   ├── storage/             # 图片处理（jimp）、签名 URL、清理
│   ├── routers/             # 7 个业务 router + index.ts（appRouter 合并，导出 AppRouter 类型）
│   ├── routes/              # Hono 原生路由：events(SSE) / upload / images
│   └── __tests__/e2e.ts     # T1.6 全链路验收（41 项断言，临时库隔离）
├── scripts/verify-db.mjs    # 数据库层冒烟
├── data/philia.db           # SQLite 库文件（运行时生成，勿提交）
└── uploads/                 # 图片存储根（签名 URL 访问，运行时生成）
```

## CORS（开发期）

允许三端 dev 端口 `7100/7101/7102`（localhost 与 127.0.0.1 两种宿主）携带凭证
跨域（`credentials: true`）；生产部署应收敛为正式域名。

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
