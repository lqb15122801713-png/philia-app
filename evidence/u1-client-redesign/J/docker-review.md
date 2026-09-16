# U1-J docker build 口径 · 两案材料（本机无 Docker/WSL，主 agent 已查证）

## 背景：两条闸门口径并列（请产品侧裁定以哪条为准）

- **口径 A（docs/ACCEPTANCE.md 附记 · 固定闸门条款）**：凡 diff 含 `Dockerfile` /
  `docker/entrypoint.sh` / `docker-compose*.yml` 的批次，验收必须附真实 docker build 实证；
  施工环境无 Docker 时，以「Dockerfile 逐行静态核对 + 引用文件存在性核对」为过程证据，
  并登记由 VPS 首验补档。
- **口径 B（批次 U1 任务书 · Tools 表）**：「本批动客户端产物，须附真实 docker build 日志」。

**本批事实**：`git diff --name-only 30d2f06..HEAD` 不含 Dockerfile / docker/entrypoint.sh /
docker-compose*.yml（核对输出 exit=1 无命中，见 exit-codes.txt 附记）——按口径 A 不触发
强制 docker build，走静态评审 + 缺口登记；但口径 B 字面要求附真实日志。
**处理：两种材料均备齐（①静态评审 ②缺口标注），请产品侧裁定。**

## 材料① Dockerfile/构建链静态评审说明

逐段静态核对（Dockerfile 全文在库，批次 6 产物；本批未改一行）：

| 段 | 内容 | 静态核对 |
|---|---|---|
| fe-builder | node:20-bookworm-slim；COPY 根+三端+两 packages 清单 → scripts/postinstall.mjs → `npm ci` → server 依赖 `npm --prefix server ci` → ARG VITE_API_BASE → COPY 源码 → `npm run build`（三端） | ✅ 引用文件全部在场（docker-refs-check.txt 12/12 OK）；npm ci 与本地依赖同源（本批三端 build exit=0 同链） |
| server-deps | `npm ci`（server 独立 lock） | ✅ server/package-lock.json 在场 |
| 最终镜像 | ENV PORT/SERVE_STATIC/STATIC_ROOT/PHILIA_DB_URL；server(src+drizzle+node_modules)+三端 dist+entrypoint；chmod/mkdir；EXPOSE 7200；HEALTHCHECK 打 GET /api/health | ✅ 三端 dist 本批均重新构建成功（exit=0）；/api/health 实测 `{"ok":true}`（见下）；entrypoint 逐行核对：set -e + 幂等迁移（drizzle journal）+ exec tsx，与 S1.1 口径一致 |
| entrypoint.sh | mkdir 兜底 → tsx src/db/migrate.ts（幂等）→ exec tsx src/index.ts | ✅ server/drizzle 迁移 SQL 在场（0000-0002+）；本批零 server 改动、零新依赖 → 构建链输入面与本批前完全一致 |
| docker-compose.yml | env_file 注入密钥/口令/CORS；build.args VITE_API_BASE | ✅ 本批未触碰 |

**本批对构建链的影响面评估**：U1 全部改动限于 apps/customer 源码 + packages/{config,shared}
token 新增与 ConvexTabBar 退役删除 + scripts/smoke-routes.mjs 锚点行；零新依赖
（package-lock.json 零改动，git status 核对）；merchant/staff/server 零改动。
fe-builder 阶段唯一变化 = customer vite build 产物内容（本批本地 exit=0 反复实证），
构建命令/依赖图/拷贝路径全部未变。

## 材料② 如实缺口标注

**docker build 日志缺，待老板 VPS 实证。** 本机无 Docker/WSL（主 agent 已查证），
无法产出真实 docker build 日志；按批次 6 裁定③先例登记由 VPS 首验补档。
若产品侧裁定以口径 B 为准，本批收口需等 VPS 补档；若以口径 A 为准，
静态评审 + 本登记即满足过程证据要求。

附：同源形态功能等价实证已做——SERVE_STATIC=1（entrypoint 同款开关）+ LAN IP
逐屏实证 57/57（matrix-nonsecure.json），覆盖镜像运行契约的静态分发与 API 链路。
