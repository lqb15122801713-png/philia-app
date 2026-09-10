#!/bin/sh
# ============================================================================
# Philia 容器入口（批次 6 任务 A）
# 1) 数据库初始化：PHILIA_DB_URL（file: 前缀）指向的 DB 文件缺失时执行
#    db:migrate —— drizzle 迁移记录 __drizzle_migrations 日志表，天然幂等，
#    重复执行不会重复应用（升级带新迁移时按 docs/DEPLOY.md 手动 exec migrate）；
# 2) exec tsx 起 server（exec 替换进程，SIGTERM 直达 index.ts 优雅退出处理器）。
# ============================================================================
set -e

DB_URL="${PHILIA_DB_URL:-file:/app/data/philia.db}"
DB_PATH="${DB_URL#file:}"

# 数据目录/上传目录兜底（volume 未挂载时容器内也能起，仅数据不持久）
mkdir -p "$(dirname "$DB_PATH")" /app/server/uploads

cd /app/server
if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] 数据库文件 $DB_PATH 不存在，执行首次迁移（drizzle journal 幂等）…"
  ./node_modules/.bin/tsx src/db/migrate.ts
fi

echo "[entrypoint] 启动 philia-server（PORT=${PORT:-7200} SERVE_STATIC=${SERVE_STATIC:-1}）…"
exec ./node_modules/.bin/tsx src/index.ts
