# ============================================================================
# Philia 单容器镜像（批次 6 任务 A · 产品侧裁定书 #1 ① 方案一 Host 头分发）
#
# 多阶段构建：
#   阶段 fe-builder ：node:20-bookworm-slim，npm ci（workspaces 根）+ 三端 vite build
#                     → apps/{customer,merchant,staff}/dist；
#                     （另装 server 依赖：三端 tsc 以相对路径类型引用 server/src，
#                      解析 @trpc/server 等类型需要 server/node_modules 在场）
#   阶段 server-deps：node:20-bookworm-slim，npm ci（server 独立 lock 文件，含 tsx）；
#   最终镜像        ：node:20-bookworm-slim，仅 server(src+drizzle+node_modules)
#                     + 三端 dist + entrypoint；tsx 直跑（server tsconfig noEmit，
#                     现有栈即 tsx，稳妥不引入编译产物差异）。
#
# 运行契约（与 server/src/static/spa.ts、config/deploy.ts 对齐）：
#   PORT=7200、SERVE_STATIC=1、STATIC_ROOT=/app/apps、PHILIA_DB_URL=file:/app/data/philia.db；
#   密钥/口令/CORS/域名经 compose env_file(.env) 注入，不 baked 进镜像（真值永不入镜像层）。
# 数据库初始化：entrypoint 判断 DB 文件缺失时跑 db:migrate（drizzle journal 天然幂等）；
#   种子数据（内测演示账号）按 docs/DEPLOY.md 手动 exec db:seed（只首装需要）。
# ============================================================================

# ---------- 阶段 1：三端静态产物 ----------
FROM node:20-bookworm-slim AS fe-builder
WORKDIR /app
# 先拷 package 清单层（最大化 Docker layer 缓存：源码变动不打破依赖层）
# workspaces = apps/* + packages/*（packages 仅 shared 与 config 两名成员，
# 清单缺一不可，否则 npm ci 工作区链接失败——b6.1 D2 实证 @philia/config 漏拷报错）
COPY package.json package-lock.json ./
COPY apps/customer/package.json apps/customer/
COPY apps/merchant/package.json apps/merchant/
COPY apps/staff/package.json apps/staff/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
RUN npm ci
# server 依赖仅用于三端 tsc 的类型解析（type-only 相对路径引用，构建期擦除）
COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci
# 再拷源码并构建三端（vite build 输出 apps/*/dist）
COPY packages ./packages
COPY apps ./apps
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
RUN npm run build

# ---------- 阶段 2：server 运行依赖（含 tsx 直跑所需） ----------
FROM node:20-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci

# ---------- 最终镜像 ----------
FROM node:20-bookworm-slim
ENV PORT=7200 \
    SERVE_STATIC=1 \
    STATIC_ROOT=/app/apps \
    PHILIA_DB_URL=file:/app/data/philia.db
WORKDIR /app
# server：源码 + drizzle 迁移 SQL + 依赖（tsx 直跑，无需编译产物）
COPY server/package.json ./server/
COPY server/src ./server/src
COPY server/drizzle ./server/drizzle
COPY --from=server-deps /app/server/node_modules ./server/node_modules
# 三端静态产物（Host 头分发：app.*→customer / m.*→merchant / s.*→staff）
COPY --from=fe-builder /app/apps/customer/dist ./apps/customer/dist
COPY --from=fe-builder /app/apps/merchant/dist ./apps/merchant/dist
COPY --from=fe-builder /app/apps/staff/dist ./apps/staff/dist
# 入口：首启迁移（幂等）→ tsx 起服务；数据目录与上传目录预建（volume 挂盘点）
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && mkdir -p /app/data /app/server/uploads
EXPOSE 7200
# 健康检查对接既有 GET /api/health（不新增端点，与任务 B/C 契约一致）
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch(`http://localhost:${process.env.PORT||7200}/api/health`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/entrypoint.sh"]
