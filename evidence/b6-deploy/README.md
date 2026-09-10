# 批次 6 证据卷宗（b6-deploy）

> ⚠️ **本批施工机无 Docker**：`docker build` / `docker compose up` 实机日志**缺**，
> 待 VPS 首验按 `docs/DEPLOY.md` §10 补证链补档（build 日志 → up 日志 → ps healthy →
> smoke 输出 → 真机 BETA-CHECKLIST）。Dockerfile/compose/Caddyfile 已做逐行静态评审
> （dockerfile-static-review.md）。
> 本目录不入库、不提交。

## 文件清单

### 任务 B（配置环境化 + 口令门）
- `env-var-crossref.txt` — .env.example 每行 ↔ 代码读取位置 grep 对照（含任务 A 增量：SERVE_STATIC / STATIC_ROOT / 三域名变量）
- `gate-1-dev-open.txt` — 口令门段①：dev 未设 BETA_GATE_CODE → dev-seed-users / dev-login 均 200
- `gate-2-wrong-code.txt` — 段②：设码后无码 401 BETA_GATE_REQUIRED / 错码 403 BETA_GATE_INVALID（两端口）
- `gate-3-right-code.txt` — 段③：对口令 200 + cookie 登录态 auth.me 生效
- `gate-4-prod-missing-gate.txt` — 段④：production 缺 BETA_GATE_CODE 启动即报错 exit=1
- `conflict-prod-mock-pay.txt` —（历史）production+mock §4.7 拒绝实证 → 已由裁定书 #1 ② 以 staging 口径化解
- `cors-grep.txt` — 7100-7102 残留 grep：server/src 仅剩 deploy.ts dev 缺省值与注释、vite config、历史文档
- `build-exit-codes.txt` — typecheck / appointment.smoke / 三端 build 退出码

### 任务 C（手册 + 冒烟）
- `smoke-deploy-local.txt` — smoke-deploy.mjs 对 localhost:7200 + 三端 vite dev：20/20 ✅ exit=0

### 任务 A（Docker 化 + Host 分发）
- `static-host-dispatch.txt` — 静态托管运行时实证（本机 tsx，无需 Docker）：
  Host app./m./s.beta.local 各回各端 index.html；无子域/裸 IP 兜底 customer；
  SPA fallback（m.* /appointments → merchant index.html）；/api、/trpc 不被接管；
  PWA 文件（manifest/sw.js/icons）原样服务；assets 指纹 immutable 长缓存；
  路径穿越防护回落 index.html；SERVE_STATIC 未开对照 GET / → 404（dev 行为不变）
- `staging-mock-allowed.txt` — 裁定②实证：NODE_ENV=staging + mock 合法启动，
  未注入项 7 项告警不阻断；health 200
- `smoke-deploy-static-on.txt` — 静态托管装配后 smoke 全链路回归：20/20 ✅ exit=0
- `dockerfile-static-review.md` — Dockerfile/compose/Caddyfile/entrypoint 逐行静态评审
  （基础镜像 / 构建阶段 / 端口 / volume / health / 迁移幂等 / 瘦身 / 已识别风险）
