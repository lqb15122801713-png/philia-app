#!/bin/sh
# ============================================================================
# Philia 容器入口（批次 6 任务 A；批次 S1.1 迁移口径修正）
# 1) 数据库迁移：**无论 DB 文件是否存在，启动一律先执行** db:migrate——
#    drizzle 迁移记录 __drizzle_migrations 日志表，天然幂等（已应用零副作用，
#    0 pending 秒过）；首装与存量升级同口径，杜绝「含迁移批次在存量库上不迁移
#    即上线」（批次 S1 VPS 实录缺陷）。set -e 保证迁移失败 fail-fast 不起服务；
# 2) exec tsx 起 server（exec 替换进程，SIGTERM 直达 index.ts 优雅退出处理器）。
# ============================================================================
set -e

DB_URL="${PHILIA_DB_URL:-file:/app/data/philia.db}"
DB_PATH="${DB_URL#file:}"

# 数据目录/上传目录兜底（volume 未挂载时容器内也能起，仅数据不持久）
mkdir -p "$(dirname "$DB_PATH")" /app/server/uploads

cd /app/server
echo "[entrypoint] 执行数据库迁移（首装/存量升级同口径，drizzle journal 幂等）…"
./node_modules/.bin/tsx src/db/migrate.ts

echo "[entrypoint] 迁移检查完成，启动 philia-server（PORT=${PORT:-7200} SERVE_STATIC=${SERVE_STATIC:-1}）…"
exec ./node_modules/.bin/tsx src/index.ts
