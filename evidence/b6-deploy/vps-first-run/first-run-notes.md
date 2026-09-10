# VPS 首验档案 · first-run-notes（批次 6.1 任务 C）

> 素材来源：产品侧《批次 6.1 任务书》VPS 首验结论与缺陷清单（老板亲测，2026-09-10）。
> 运行日志 `/mnt/agents/output/vps-first-run-deploy.log` 由产品侧持有，**待移交**
> （见 deploy.log.placeholder.md）。VPS 上的临时补丁**不回传**，修复以本批入库为准。

## 一、三缺陷现场（报错原文）

### D1 · 根 package-lock.json 不在仓库（P1 历史遗留）
- 成因：P1 阶段 lock 超 MCP 推送上限未推，此后仓库一直无根 lock。
- 现场：`docker compose up -d --build` 在 zip 部署（GitHub 自动整包）必炸——
  Dockerfile `COPY package.json package-lock.json ./` 找不到文件：
  `"/package-lock.json": not found`

### D2 · Dockerfile 漏拷 packages/config/package.json
- 成因：fe-builder 阶段装依赖前只拷了 packages/shared 的清单，漏了 packages/config。
- 现场：npm ci 不链接 @philia/config 工作区，构建期报错：
  `Cannot find module '@philia/config/tailwind-preset'`

### D3 · VITE_API_BASE 构建期变量无注入通道
- 成因：`VITE_API_BASE` 是 vite 构建期变量（getApiBase 读 import.meta.env，
  build 时静态替换），但 Dockerfile/compose 没有 ARG/args 通道。
- 现场：构建出的三端 API 地址恒为缺省 `http://localhost:7200`，
  手机端真机访问全部 `Failed to fetch`（getApiBase 缺省值实证）。

## 二、老板临时补丁思路（对症，VPS 本地改，不回传）

- D1：在 VPS 部署目录手工生成/放入根 package-lock.json（对齐 package.json），
  让 `COPY package-lock.json` 有文件可拷、npm ci 得以执行。
- D2：给 Dockerfile 装依赖步骤前补一行
  `COPY packages/config/package.json packages/config/`，恢复 @philia/config 链接。
- D3：给构建传入 VITE_API_BASE（构建参数/环境），指到 VPS 公共地址
  `http://<VPS-IP>:7200`，重建三端产物。

## 三、解堵后实证（产品侧记录）

- 三端在线：客户端 / 商家端 / 员工端均可访问（Host 头分发按子域正确路由）。
- 真实下单入库：真机完成一单，商家端「待确认 = 1」正确显示。
- 启动日志健康：`NODE_ENV=staging` 全注入 ✓（无 warnStagingConfig 告警）、
  `SERVE_STATIC=1`、`PUBLIC_BASE_URL` 指向正确公共地址。
- 内测口令门生效：dev-login 无口令被拒、带口令可登录。

## 四、本批正式入库的对应修复（fix/b6.1-deploy）

| 缺陷 | 入库修复 | commit |
|---|---|---|
| D1 | 根 package-lock.json 补录（hash-object 自证逐字节一致） | 7aa1c5b |
| D2 | Dockerfile 补拷 packages/config/package.json（npm ci 前） | a346c77 |
| D3 | Dockerfile ARG/ENV + compose build.args + .env.example 注释 | 9b0e5ca |

同步核查（替代实证，本机无 Docker）：全新 clone 本分支 → `npm ci` →
`npm --prefix server ci` → 三端 `npm run build` + server typecheck 全绿，
日志见 `../b61-fresh-clone-build.log`；Dockerfile 引用文件存在性逐行核对见
`../dockerfile-static-review.md` 末尾 b6.1 更新段。
