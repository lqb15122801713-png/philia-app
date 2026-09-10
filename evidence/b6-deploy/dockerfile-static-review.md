# Dockerfile 静态评审说明（批次 6 任务 A · 裁定书 #1 ③）

> 本机无 Docker，以下为逐行/逐段静态自评；`docker build` / `compose up` 实机日志缺，
> 待 VPS 首验补档（DEPLOY.md §10 补证链）。评审对象：根级 `Dockerfile`、
> `docker/entrypoint.sh`、`docker-compose.yml`、`caddy/Caddyfile`、`.dockerignore`。

## 1. 基础镜像

- 三阶段统一 `node:20-bookworm-slim`：与本地开发 node v20 对齐（任务书口径）；
  Debian glibc 兼容 libsql 原生绑定（`@libsql/client` 的 prebuilt binary 在
  alpine/musl 下需额外验证，bookworm-slim 稳妥）；slim 控镜像体积。
- Caddy 用官方 `caddy:2-alpine`（仅 https profile 拉取，主流程零额外镜像）。

## 2. 构建阶段

- **fe-builder**：先拷 5 个 package 清单 + 根 lock → `npm ci`（layer 缓存：
  源码变动不打破依赖层）；再拷 server 清单 `npm --prefix server ci`
  （三端 `tsc -b` 以 type-only 相对路径引用 `server/src`，解析 `@trpc/server`
  等类型需 server/node_modules 在场——本机三端 build 即依赖此布局）；
  最后拷 `packages/`、`apps/`、`server/src` 跑根 `npm run build`
  （= 三端 `tsc -b && vite build`，与本地构建命令完全一致，产物 `apps/*/dist`）。
- **server-deps**：独立 `server/package-lock.json`（既有，server 不在 workspaces）
  → `npm ci`，含 tsx（devDep）。
- **最终镜像**：只 COPY 运行必需——server `src` + `drizzle`（迁移 SQL，
  migrate.ts 按 `../../drizzle` 相对定位）+ `node_modules` + 三端 `dist` +
  `entrypoint.sh`；不拷 tests、scripts、docs、根 node_modules。
- **为何 tsx 直跑而非 tsc 产物**：server `tsconfig.json` 为 `noEmit: true`
  （现有栈 `npm run dev` 即 tsx；`build` 脚本只做类型检查无产物），
  tsx 直跑与开发/CI 行为一致，避免引入编译产物差异；tsx 已在依赖内，零新增。

## 3. 端口 / 环境契约

- `EXPOSE 7200`；`ENV PORT=7200 SERVE_STATIC=1 STATIC_ROOT=/app/apps
  PHILIA_DB_URL=file:/app/data/philia.db` —— 与 `server/src/static/spa.ts`
  （STATIC_ROOT 下 `<app>/dist`）、compose volume 挂盘点逐项对齐。
- 密钥/口令/CORS/域名**不 baked 进镜像**：compose `env_file: .env` 运行时注入，
  镜像层无真值（安全口径与 .gitignore 一致）。

## 4. volume

- `philia-data → /app/data`：libsql 库文件持久化（拍板 1 不迁库，仅挂 volume）；
- `philia-uploads → /app/server/uploads`：上传图片持久化
  （`UPLOADS_ROOT` 解析为 server/uploads，路径已核对）；
- entrypoint 对两个目录 `mkdir -p` 兜底（未挂 volume 也能起，仅不持久）。

## 5. health 对接

- `HEALTHCHECK` 用容器内 node 原生 fetch 打 `http://localhost:$PORT/api/health`，
  对接既有端点（任务 B 契约），不新增端点、无 curl/wget 依赖（slim 镜像无 curl）；
  `--start-period=20s` 覆盖首启 migrate 耗时。

## 6. 迁移幂等

- entrypoint：DB 文件缺失 → `tsx src/db/migrate.ts`；drizzle `__drizzle_migrations`
  journal 表天然幂等（重复执行不重复应用，migrate.ts 注释实证）。
- 仅「文件缺失」触发是裁定口径：避免每次启动都跑 migrate 拉长启动；
  升级带新迁移走 DEPLOY.md §9 手动 exec（同一条幂等命令）。
- `exec tsx src/index.ts`：exec 替换 shell，SIGTERM 直达 index.ts 既有优雅退出
  处理器（关 server + 停 sweeper + 关 libsql client）。

## 7. 镜像瘦身 / 构建上下文

- `.dockerignore`：`.git`、`**/node_modules`、`**/dist`、`evidence`、`shots`、
  `server/data`、`server/uploads`、`*.db`、`.env*`（豁免 `.env.example`）、
  VI 源资产 `assets/`、`PHiLIA-preview-vectors-pdf/`、Docker 自身文件
  （保留 `docker/`——entrypoint.sh 构建要用，已自纠过一轮）。
- 多阶段使最终镜像不带构建链（TypeScript/vite/三端源码外的一切 dev 依赖）；
  剩余大头 = server node_modules（含 tsx，运行必需）。

## 8. compose / Caddy

- compose：单服务 `app` + 可选 `--profile https`（caddy），骨架与任务书一致；
  `APP_DOMAIN/M_DOMAIN/S_DOMAIN` 用 `:?` 缺省即报错（防空域名起 Caddy）。
- Caddyfile：三子域 `reverse_proxy app:7200`，Host 头默认透传 → 方案一零适配；
  SSE 由 reverse_proxy 默认流式处理；证书持久化 volume `caddy-data`。

## 9. 已识别风险（如实上报）

1. `npm ci` 三端 workspaces 需外网拉包——VPS 首验若拉包慢可配置镜像源；
2. `@libsql/client` 需下载平台 prebuilt binary（linux-x64 gnu），bookworm-slim
   满足；若离线环境需预置——VPS 有网，风险低；
3. tsx 直跑冷启动略慢于编译产物（秒级），1C2G 可接受；
4. 静态评审不能替代实机构建：base 镜像拉取、npm ci 网络、entrypoint sh 权限
   （已 `chmod +x`）等待 VPS 首验实证。
