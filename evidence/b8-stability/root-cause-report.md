# 批次 8 任务 A · 白屏群根因报告（只调查，未改任何代码）

| 项 | 值 |
|---|---|
| 日期 | 2026-09-10 |
| 基线 | main @ 649b713（分支 fix/b8-stability） |
| 复现环境 | 本机三端 `vite build` 产物 + `vite preview`（customer 7100 / merchant 7101）+ server 7200（dev 无 BETA_GATE_CODE，口令门维持开放）；另以 `SERVE_STATIC=1` 的 server 静态托管（= VPS 服务路径，经 `*.localhost` 子域 Host 分发）复核 |
| 复现工具 | Edge headless CDP（9223），全量收集 Runtime.consoleAPICalled / exceptionThrown / Log / Network + window.onerror + 截图 |
| 测试数据 | 本地库种子：预约单（pending 01M20KGGXFE47W602NK45YND79、in_service 01M256D240E19GWNG2QMFV3Q8V，宠物 旺财）；本地无走查员 VPS 数据，自造等价商城待支付单 ¥129（MO-B8-0001，脚本 server/scripts/b8-seed-order.mjs） |

---

## 总体结论（先读）

**四条白屏是同一根因族：三端 `vite.config.ts` 均配置 `base: './'`（相对基座）。**

构建产物 `index.html` 以**相对路径**引用全部静态资源：

```html
<script type="module" crossorigin src="./assets/index-tnp8dJmB.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-BXkHFDj0.css">
<link rel="manifest" href="./manifest.webmanifest"><script id="vite-plugin-pwa:register-sw" src="./registerSW.js"></script>
```

当浏览器在 **≥2 段路径**（如 `/appointments/:id`、`/mall/orders`、`/philia/pets`）或**尾斜杠路径**（如 `/appointments/`）直开/刷新时，`./assets/index-*.js` 按当前文档 URL 解析到路由前缀之下：

- 文档 `http://host/appointments/<id>` → 主 bundle 实际请求 `http://host/appointments/assets/index-tnp8dJmB.js`

该路径不存在这个文件：

- **vite preview**（任务书施工顺序第 1 步的复现路径）→ 404，脚本加载失败；
- **server 静态托管**（VPS 真实路径，`server/src/static/spa.ts`）→ SPA fallback 把 `index.html` 以 `text/html` 返回（HTTP 200），模块脚本被浏览器 MIME 强校验拒绝执行。

两种风味殊途同归：**主 bundle 从未执行，React 从未挂载，`#root` 为空 → 纯白屏**（无错误边界、无 UI 残片，window.onerror 只能抓到经典脚本 `registerSW.js` 解析 HTML 的 SyntaxError）。

- 报错是**资源加载失败**，不是应用代码运行时异常——bundle 压根没执行，因此没有应用层堆栈、sourcemap 无从映射；关键定位信息是 **chunk 文件名 + 404/MIME 错配**。
- 单段路径（`/home`、`/appointments`、`/dashboard` 等）直开**正常**——`./assets` 恰好解析回根路径。走查「页内跳转正常」同理：SPA 已启动，client-side 导航不再请求文档与静态资源。
- 影响面**远超任务书点名的 4 条**：客户端 20 条路由中 14 条嵌套路由直开必白（含下单主链路 `/booking/grooming`、`/mall/checkout`、`/booking/success`），商家端 `/appointments/:id`、`/appointments/:id/monitor` 必白（确认+派单主流程所在页），员工端 `/execute/:appointmentId`、`/boarding/:id/checkin` 同隐患。
- **一次根治建议**：三端 `vite.config.ts` 的 `base: './'` 改为 `base: '/'`（每端一行）。部署架构本来就是按 Host 子域把三端服务在各自域的根路径（server spa.ts + Caddy 三子域），不存在子路径托管需求；`base: './'` 是 initial import（353cfae）的脚手架遗留。

---

## A1 · 客户端 `/appointments/:id`（4/4 白屏）

### 现象
直开 `/appointments/<id>`（pending 与 in_service 两单均测）纯白屏，`#root innerHTML length = 0`，`body.innerText` 为空。截图 `a1-appointments-id-pending.png` / `a1-appointments-id-inservice.png`。

### 报错原文（vite preview 风味，逐字，a1-appointments-id-pending.txt）
```
[net.404] http://localhost:7100/appointments/assets/index-tnp8dJmB.js
[log.error] (network) Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:7100/appointments/assets/index-tnp8dJmB.js:1
[net.fail] net::ERR_ABORTED type=Script canceled=true
[net.404] http://localhost:7100/appointments/registerSW.js
[log.error] (network) Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:7100/appointments/registerSW.js:1
[log.error] (other) Manifest: Line: 1, column: 1, Syntax error. http://localhost:7100/appointments/manifest.webmanifest:1
```
window.__errs: 0 条（bundle 未执行，连 onerror 都无从触发）；chunk 文件名 `assets/index-tnp8dJmB.js`（customer 产物主 bundle，733.52 kB）。

### 报错原文（VPS 服务路径风味，逐字，vps-a1-appt-detail.txt）
```
[net.MIME-ODD 200 text/html] http://app.localhost:7200/appointments/assets/index-tnp8dJmB.js
[log.error] (javascript) Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec. http://app.localhost:7200/appointments/assets/index-tnp8dJmB.js
[EXCEPTION] SyntaxError: Unexpected token '<'
window.onerror: Uncaught SyntaxError: Unexpected token '<'
[log.error] (other) Manifest: Line: 1, column: 1, Syntax error.
```
（`SyntaxError: Unexpected token '<'` 来自经典脚本 `registerSW.js` 拿到 `<!doctype html>`。走查 VPS 环境的 console 应是这一风味。）

### 源位置
- `apps/customer/vite.config.ts:9` → `base: './'`；
- 产物 `apps/customer/dist/index.html:10-12` → `./assets/index-tnp8dJmB.js` 等相对引用；
- 文档 URL `/appointments/<id>` → 相对引用解析为 `/appointments/assets/...` → 不存在。

### dev vs 生产机理差异
dev 的 `apps/customer/index.html:13` 是 `<script type="module" src="/src/main.tsx">`（**根绝对**），vite dev 按 URL 路径直取源模块，无 hash bundle、无相对资源引用；`base` 只作用于 `vite build` 产物。故 dev 任何嵌套路由都不发作，历史验收（全在 dev 层）全绿。

### 页内跳转对照（实证）
`/appointments` 列表页内点击卡片 → `/appointments/01M20FDY59VECCMZEH27ZJVAYR` 完整渲染（rootLen=20430，截图 `nav-a1-detail-inapp.png`）——client-side 导航不重新加载文档与静态资源，相对 base 不发作。

---

## A2 · 客户端 `/mall/orders`

### 现象
直开纯白屏，`#root innerHTML length = 0`。截图 `a2-mall-orders.png`。VPS 风味复测同白（vps-a2-mall-orders.txt）。

### 报错原文（vite preview 风味，逐字，a2-mall-orders.txt）
```
[net.404] http://localhost:7100/mall/assets/index-tnp8dJmB.js
[log.error] (network) Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:7100/mall/assets/index-tnp8dJmB.js:1
[net.fail] net::ERR_ABORTED type=Script canceled=true
[net.404] http://localhost:7100/mall/registerSW.js
[log.error] (other) Manifest: Line: 1, column: 1, Syntax error. http://localhost:7100/mall/manifest.webmanifest:1
```

### 源位置
同 A1（`apps/customer/vite.config.ts:9`）。`/mall/orders` 为 2 段路径，`./assets` → `/mall/assets/...` → 404/fallback。

### dev vs 生产机理差异
同 A1。

### 页内跳转对照（实证）
`/me` 页内点击「商品订单」→ `/mall/orders` 完整渲染（rootLen=11444，截图 `nav-a2-orders-inapp.png`）。

---

## A3 · 商家端 `/appointments`（三种进入方式全白屏）

### 本地实证结果（重要，与走查记录存在出入）
| 进入方式 | 服务路径 | 结果 |
|---|---|---|
| 直开 `/appointments`（单段） | vite preview 7101 | **渲染正常**（rootLen=11007，截图 `a3-merchant-appointments.png`：预约管理 + 状态/日期筛选 + 空态 + TabBar 徽标 8） |
| 直开 `/appointments`（单段） | server 静态托管（VPS 路径，curl Host m.beta.local） | 200 `text/html` len=755（index.html 正常下发，资源 `./assets` → `/assets/...` 命中） |
| 仪表盘页内点 TabBar「预约」 | vite preview 7101 | **渲染正常**（rootLen=11007，`nav-m-appt-tab-inapp.png`） |
| 直开 `/appointments/`（**尾斜杠**） | server 静态托管（VPS 路径） | **白屏**（rootLen=0，`vps-m-appt-trailslash.png/.txt`，MIME 风味报错同 A1） |
| 直开 `/appointments/<id>`（详情，确认+派单所在页） | server 静态托管（VPS 路径） | **白屏**（rootLen=0，`vps-m-appt-detail.png/.txt`） |

### 报错原文（尾斜杠 / 详情，VPS 风味，逐字，vps-m-appt-detail.txt）
```
[net.MIME-ODD 200 text/html] http://m.localhost:7200/appointments/assets/index-zGCSFLkn.js
[log.error] (javascript) Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.
[EXCEPTION] SyntaxError: Unexpected token '<'
window.onerror: Uncaught SyntaxError: Unexpected token '<'
```
chunk 文件名 `assets/index-zGCSFLkn.js`（merchant 产物主 bundle，562.75 kB）。

### 源位置
- `apps/merchant/vite.config.ts:9` → `base: './'`（与客户端同一行配置）；
- 产物 `apps/merchant/dist/index.html:10-12` 相对引用；
- 商家端嵌套路由 `/appointments/:id`、`/appointments/:id/monitor`（`apps/merchant/src/App.tsx:36-37`）与尾斜杠变体全部命中同机理。**确认+派单主流程就在详情页 `AppointmentDetailPage`（ConfirmDialog / AssignStaffSheet）**，与走查「确认+派单主流程断」互证。

### 判定
同一根因族。走查「三种进入方式全白屏」按 URL 结构推断，其进入 URL 应均落在嵌套/尾斜杠形态（预约管理的三种钻取——列表行、今日时间线 `TodayTimeline → /appointments/:id`、待办 `TodoSection → /appointments?status=...`——最终承载页是 2 段的 `/appointments/:id`；或走查脚本生成的 URL 带尾斜杠）。**建议修复验证前对照走查 37 张截图的 URL 栏逐张确认 A3 的实际进入 URL**；无论落在哪种，根因与修法不变，且任务 C 的路由级冒烟会把单段/嵌套/尾斜杠全部纳入断言。

### dev vs 生产机理差异
同 A1（dev 根绝对模块路径，永不发作）。

---

## A4 · 客户端 `/philia/pets`、`/philia/moments`（深链接/刷新白屏、页内跳转正常）

### 现象
直开两路由均纯白屏（rootLen=0，截图 `a4-philia-pets.png`、`a4-philia-moments.png`；VPS 风味复测同白）；页内 `/philia` 点击「宠物档案」卡片 → `/philia/pets` **完整渲染**（rootLen=16470，截图 `nav-a4-pets-inapp.png`：旺财/咪咪档案卡 + TabBar）——与走查「直开白屏、页内跳转正常」逐字吻合。

### 报错原文（vite preview 风味，逐字，a4-philia-pets.txt）
```
[net.404] http://localhost:7100/philia/assets/index-tnp8dJmB.js
[log.error] (network) Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:7100/philia/assets/index-tnp8dJmB.js:1
[net.fail] net::ERR_ABORTED type=Script canceled=true
[net.404] http://localhost:7100/philia/registerSW.js
[log.error] (other) Manifest: Line: 1, column: 1, Syntax error. http://localhost:7100/philia/manifest.webmanifest:1
```
`/philia/moments` 同文（a4-philia-moments.txt）。

### 源位置
同 A1（`apps/customer/vite.config.ts:9`）。`/philia/pets`、`/philia/moments` 均为 2 段路径。**不是 hydrate/时序问题**——任务书疑似方向（hydrate/时序）被报错原文排除：bundle 根本没有加载执行，不存在 React 启动后的任何时序。

### 「刷新白屏、页内跳转正常」的机理（走查现象逐字解释）
- 直开/刷新 = 新文档加载 → `./assets` 相对解析错位 → bundle 404/MIME 拒绝 → 白屏；
- 页内跳转 = 已启动 SPA 的 client-side 导航 → 不请求文档与静态资源 → 正常；
- PWA Service Worker 也救不了：产物 `sw.js` 的 `NavigationRoute(createHandlerBoundToURL("index.html"))` 虽把 index.html 回退给一切导航，但 precache 清单是**根路径**资源（`assets/index-tnp8dJmB.js` 相对 sw.js 所在根注册）；嵌套路径下的 `./assets` 请求 SW precache 不命中 → 回落网络 → SPA fallback 回 HTML → 依然白屏（这同时解释了首访/无痕必现、与 SW 状态无关）。

---

## 影响面全景（同根因族，远超点名的 4 条）

直开/刷新必白（≥2 段路径）清单（已逐条实测 rootLen=0，截图 `x-*.png`）：

| 端 | 必白路由（直开/刷新） | 备注 |
|---|---|---|
| 客户端 | `/appointments/:id`、`/appointments/:id/live` | A1；核销码/取消入口失联即此 |
| 客户端 | `/mall/orders`、`/mall/cart`、`/mall/checkout`、`/mall/product/:id` | A2 + 商城下单链路 |
| 客户端 | `/philia/pets`、`/philia/moments`、`/philia/member` | A4 |
| 客户端 | `/booking/grooming`、`/booking/grooming/wizard`、`/booking/boarding`、`/booking/boarding/wizard`、`/booking/success` | **预约下单主链路全部直开必白** |
| 商家端 | `/appointments/:id`、`/appointments/:id/monitor`（及一切尾斜杠变体） | A3；确认+派单在详情页 |
| 员工端 | `/execute/:appointmentId`、`/boarding/:id/checkin` | 同隐患未实测（未起 7102 preview），`apps/staff/vite.config.ts:9` 同款 `base: './'`，机理相同；**B1 的手动核销页正是 `/execute/:appointmentId`，深链接/刷新同白** |

直开正常的单段路由（实证）：客户端 `/home`、`/appointments`、`/philia`、`/me`；商家端 `/dashboard`、`/appointments`。

---

## 修复方案建议（供产品侧裁定，本阶段未动任何代码）

### 首选（一次根治，推荐）
三端 `vite.config.ts`（customer/merchant/staff）各改一行：`base: './'` → `base: '/'`。

- 部署架构完全匹配：server 按 Host 子域把三端 dist 服务在**各自域的根路径**（`server/src/static/spa.ts` 方案一），Caddy 三子域反代根路径，无子路径托管需求；`base: './'` 系 initial import（353cfae）脚手架遗留，全仓库无任何依赖相对 base 的设计。
- 一行修同时根治：A1/A2/A3/A4 + 上表全部未点名嵌套路由 + 员工端隐患。
- PWA 无副作用：`manifest.start_url: './'` 在根域等价于 `/`；`sw.js` 居根、precache URL 本就根相对；`registerSW.js` 的 `scope: './'` 解析为 `/` 不变；`getApiBase()` 走 `VITE_API_BASE` 与 base 无关。
- `apps/*/index.html` 源码中的 `./brand/...` 图标引用在 base `/` 构建后同样转为根绝对，顺带治好嵌套路由下 favicon 404（当前仅静默 404，不白屏）。

### 不推荐
- 在 server SPA fallback 里对嵌套 `/assets` 请求做重定向/特殊服务：治标，且把路由耦合泄进静态层；
- `<base href="/">` hack：与 vite base 双写易漂移；
- 逐页打补丁：任务书已明令禁止，且本根因无「页」可补（页面代码零缺陷，纯白屏全是资源装载层问题）。

### 配套（任务 C 固定闸门必须覆盖，否则本次教训会重演）
1. `scripts/smoke-routes.mjs` 对三端**构建产物**逐路由断言：HTTP 200 + 锚点文本存在 + **#root 非空**（或关键 DOM 锚点），覆盖清单必须含 ≥2 段嵌套路由（`/appointments/<id>`、`/mall/orders`、`/philia/pets`、`/booking/grooming`、商家端 `/appointments/<id>`、员工端 `/execute/<id>`）与尾斜杠变体；
2. 冒烟监听 console：`Failed to load resource` / `MIME type` / `SyntaxError: Unexpected token '<'` 任一出现即判红；
3. 每批验收必跑（证据卷宗惯例），堵死「只在 dev/构建日志层验证」的盲区——本次 4 条白屏在 dev 与历史验收中全绿，正是因为 dev 的模块装载路径与生产产物根本不同。

---

## 证据清单（evidence/b8-stability/，不入库）

| 文件 | 内容 |
|---|---|
| `root-cause-report.md` | 本报告 |
| `repro.mjs` / `repro2.mjs` / `repro3.mjs` / `repro4.mjs` | CDP 复现脚本（preview 直开 / VPS 服务路径 / 页内跳转对照 / 影响面扫尾） |
| `a1-appointments-id-pending.png/.txt`、`a1-appointments-id-inservice.png/.txt` | A1 白屏截图 + console 原文（vite preview 风味） |
| `a2-mall-orders.png/.txt` | A2 白屏截图 + console 原文 |
| `a3-merchant-appointments.png/.txt` | A3 单段直开**渲染正常**对照（preview） |
| `a4-philia-pets.png/.txt`、`a4-philia-moments.png/.txt` | A4 白屏截图 + console 原文 |
| `c0-home-control.png/.txt`、`c1-appt-list-control.png/.txt`、`c2-philia-control.png/.txt`、`m0-dashboard-control.png/.txt` | 单段路由正常对照 |
| `vps-a1-appt-detail`、`vps-a2-mall-orders`、`vps-a4-pets`、`vps-a4-moments`（.png/.txt） | VPS 服务路径（server 静态托管）白屏 + MIME 风味报错原文 |
| `vps-m-appt-direct`、`vps-m-appt-trailslash`、`vps-m-appt-detail`、`vps-m-dashboard-control`（.png/.txt） | 商家端 VPS 路径：单段正常 / 尾斜杠白 / 详情白 |
| `nav-a1-detail-inapp`、`nav-a2-orders-inapp`、`nav-a4-pets-inapp`、`nav-m-appt-tab-inapp`、`nav-m-detail-inapp`（.png/.txt） | 页内跳转全部正常对照（「页内跳转正常」实证） |
| `x-booking-grooming`、`x-booking-success`、`x-mall-cart`、`x-mall-checkout`、`x-philia-member`、`x-mall-product`（.png/.txt） | 影响面扫尾：6 条未点名嵌套路由直开全白 |
| `server/scripts/b8-inspect.mjs`、`server/scripts/b8-seed-order.mjs` | 查库/造数脚本（¥129 待支付单 MO-B8-0001；仓库内新增脚本，未 commit） |
