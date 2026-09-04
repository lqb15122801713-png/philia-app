# Philia 菲丽亚宠物 · 主代理编排计划（plan.md — 单一事实来源）

> 依据：《菲丽亚宠物三端App开发方案.md》v1.0（工作目录根下）
> 本文档由主代理维护，每个 Phase 完成后勾选并记录偏差。

## 本地适配声明（与原文档的差异）

| 项 | 原文档 | 本地执行 | 原因 |
|---|---|---|---|
| 后端运行环境 | backend-building-swarm + MySQL + Kimi 登录 | P1 阶段再定（本地无该 swarm；MySQL/Kimi 登录需适配，可能用本地 MySQL/SQLite 或 docker + 会话 stub） | 平台技能本地不可用 |
| GitHub 仓库 | P0 建 philia-app 仓库 | 先本地 git init；推送 GitHub 需用户确认后执行 | 外部可见操作需确认 |
| 视觉资产 | image_generation 插件 | 用 openart-agent MCP 生成 | 本地可用插件 |
| 预览 | website_version_manager 版本卡 | Kimi Work 本地预览卡（dev server，customer 端口 7100） | 平台能力差异 |
| 端口约定 | — | customer=7100 / merchant=7101 / staff=7102 | 客户端预览规则 |

## 技术栈（锁定）

Monorepo（npm workspaces）：apps/customer、apps/merchant、apps/staff（React18+Vite+TS+Tailwind3.4+shadcn/ui+vite-plugin-pwa+React Router），packages/shared（tokens/组件/常量/类型），packages/config（共享 tsconfig/tailwind preset），server/（P1 建：Hono+tRPC+Drizzle）。

---

## P0 — 地基与设计系统 〔已完成 ✅ 2026-09-04〕

里程碑 M0：三端 `npm run dev` 可起；客户端空壳带完整 5 栏凸起 TabBar；设计 token 三端生效。**全部达成。**

- [x] T0.1 `coder-scaffold`：Monorepo 脚手架（apps×3 + packages×2 + server/ 占位），vite PWA 配置，三端空路由+布局壳。首次 commit `7b39abc`
- [x] T0.2 `designer-brand`：tokens.ts + Tailwind preset + docs/DESIGN.md。⚠️ musepool 因本机无 agent-gw 网关凭证（KIMI_API_KEY 未配置）不可用，按方案 §8.1 锁定色板降级，衍生色用 HSL 同温同饱和推导；凭证恢复后可补跑检索做方向校准
- [x] T0.3 `designer-assets`：4/4 资产落盘 assets/（logo-512 / tab-icon-256 / 空状态插画 / 首页 banner），Seedream 4.5 生成+本地去水印；OpenArt CDN 需走本机 SOCKS5 127.0.0.1:1081 下载（后续代理沿用）
- [x] T0.4 `coder-tabbar`：ConvexTabBar（SVG 凹口+64px 凸起按钮+呼吸光环+按下回弹）、StepTimeline、PhotoWall（packages/shared），接入客户端壳；四张资产拷入 customer/public/brand/
- [x] T0.5 集成冒烟：三端构建通过；CDP 真机视口截图验证（shots/）。修复项：①三端 tailwind content 未扫描 packages/shared 导致共享组件样式缺失；②员工端 TabBar flex 布局改 grid-cols-3。⚠️ 本机 Chrome `--screenshot` 受系统 120% DPI 影响会右偏裁切，截图须走 CDP setDeviceMetricsOverride（shots/cdp-shot.mjs）
- [ ] （待用户确认）GitHub 建仓库 + main/dev 分支 + PR 模板

### P0 遗留偏差记录
- staff「执行」Tab 暂指向 /execute/demo 占位，P3 改由今日任务进入
- merchant「管理」Tab 暂指向 /boarding，管理聚合导航 P4 定
- React 18.3 + react-router-dom v6.30（模板原为 React 19/RRv7，已按方案降级）
- npm 安装需 `--registry=https://registry.npmmirror.com`（npmjs 直连超时）

## P1 — 后端与数据模型 〔未开始〕
（Drizzle schema 16 表 / 认证与 RBAC / appointment+serviceStep router / SSE Hub+outbox / 上传管线）

## P2 — 客户端 〔未开始〕
## P3 — 员工端与六步流 〔未开始〕
## P4 — 商家端 〔未开始〕
## P5 — 商城后端与全链路 〔未开始〕
## P6 — 推送联调、打磨与发布准备 〔未开始〕

---

## 执行日志

- 2026-09-04 17:18 主代理读取开发方案全文（1117 行），建立 plan.md，启动 P0。
- 2026-09-04 17:30 并行派出 T0.1/T0.2/T0.3 三个子代理。
- 2026-09-04 18:10 三子代理全部完成；派 T0.4 组件集成子代理。
- 2026-09-04 18:40 T0.5 集成冒烟完成（三端构建 + CDP 截图验证），修复 2 处集成问题。**P0 收官（M0 达成）**，GitHub 建仓待用户确认，待指令进入 P1。
