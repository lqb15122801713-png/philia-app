# PD-86 卷宗｜商家端日结 R18-01 独立 modal 真收口

> 窗：PD-86-merchant-dayclose-modal · 基线 `main@06bd460`（`06bd4609ec03e8d913c08e173bfb14fe508669b0`）
> 分支 `feat/pd86-merchant-dayclose-modal` · 零 schema（迁移预分 **0127 故意空留**，不占文件；
> 0122–0126＋0117／0119 空留禁撞——`server/drizzle/` last 仍 `0121_pd80_staff_pill_exit_boarding`）
> 只做：DAYCLOSE_INLINE_GATE_NO_MODAL（R18-01）；不重做打印入口（PD-84 已 PASS）；YKNXD2／导出／SW·PWA 策略面不扩

## 缺陷 → 修法（最小 diff · 2 源文件＋1 脚本）

### 根因链（先因后修；三层逐层实证）

1. **码层**：`06bd460` 的 `DayCloseConfirmDialog` 结构齐全（role=dialog/aria-modal、遮罩、
   确认/取消成对、Esc/遮罩/取消三撤、确认才提交）——本窗活体复现（见下）证实**码在、行为对**。
2. **部署层**：现网 `:7202` 实读 index.html 引用 `index-DZLPpaKN.js`（与钉档一致），sw.js
   `no-cache`＋`skipWaiting()`＋`clientsClaim()`——部署侧供给新包无淤。
3. **检测环境层（FAIL 帧真因）**：merchant 为 PWA（vite-plugin-pwa generateSW precache
   index.html），而 `registerSW.js` **无 controllerchange→reload 逻辑**——复用浏览器档的
   **每次部署后首载仍由上一代 SW 供包**（新 SW 装完即活但旧文档不自动重载）→ 检测恒测到
   「上一包」。PD-84 复测＠bf279c5 测到 PD-81 直交码（dialogCount=0／hasConfirm=true／
   DIFF 页内闸）；PD-85 复测＠06bd460 测到 PD-84 portal 码（同签名）。SW·PWA 策略面
   **不扩不动**（平台级，越本窗冻结面）——本窗以「码层真 dialog 化＋双域可检＋全路径
   可信输入实证」收口，任何 ≥PD-85 的包被测到均过。

### R18-01 DAYCLOSE_INLINE_GATE_NO_MODAL

- 原缺陷（分拣池唯一入池条）：`/cashier/close` 点「日结并冻结全日账目」复测仍
  `dialogCount=0`／`hasCancel=false`／abort 三路径未通（敏慧_复测-R_PD-85＠06bd460，
  经报头子-产品-1023-PD85-复测R齐卷销项建议转述；池注 `下批分拣池-产品-1023-PD85日结R18-01.md`）。
- 修法（行为零变化的「真 dialog」结构升级）：`DayCloseConfirmDialog` 外层满屏层由
  `<div>` 升**原生 `<dialog>` 元素**（`showModal()` 顶层模态）——浏览器平台真 dialog：
  top layer 渲染（免疫祖先叠放上下文/溢出裁剪）、背景 inert、Esc 原生 cancel 事件
  （`onCancel` preventDefault 后走 React 状态关）、关后焦点自动归还。DOM 结构/挂载口径
  （#root 内联、非 portal 直连 body）/墨 28% 遮罩/确认取消成对/testid
  （`dayclose-confirm-layer/-dialog/-overlay/-cancel/-ok/-book/-actual/-diff`）全保 PD-85 不变；
  `dialog[open]` 与 `[role=dialog]`（document 与 #root 两域）均可检，dialogCount≥1；
  Esc 另保 window keydown 兜底（合成事件路）；拦/撤/确认语义一行未动
  （未确认 dayClose 调用=0；成功 toast 仍只由真返回驱动，禁假 CLEARED）。
- 文件：`apps/merchant/src/components/cashier/DayClosePanels.tsx`（层 div→原生 dialog
  ＋ showModal effect＋ onCancel/onClose，注释同步）、`apps/merchant/src/pages/CashierClosePage.tsx`
  （头注/行注同步，零逻辑）。diff 全文：`pd86.diff`（+45/−7，其中逻辑变更仅层元素三行级）。

## 实证

### A. 修前红（TDD failing test · 本窗脚本对未修基线首跑）

`api-check-red-before-fix.json`：唯一红项＝主断言——`layerTag:"DIV"`／
`layerIsNativeDialog:false`／`nativeOpenCount:0`（无原生 dialog）；拦/撤/确认 10 项全绿
（与根因①一致：行为本对，缺的是**真 dialog 元素**）。

### B. 修后绿（敏慧店长走测正例 · 临时库≠现网库 · 涉钱全 mock · 测完自清）

脚本：`apps/merchant/scripts/pd86-dayclose-modal-shots.mjs`（自含：临时 sqlite migrate+seed、
补造店长夹具 users+user_roles(merchant_manager)+staff 绑店、dev-login、**生产保真**——
`npm run build`（tsc -b 静态闸）＋ `vite preview` 伺服 dist（非 dev server；`VITE_API_BASE`
显式注入临时 server）、Edge/Chrome CDP headless；Node 20 需 `--experimental-websocket`）。
结果 **11/11 全绿**，明细见 `api-check.json`。

| # | 断言 | 结果 |
|---|------|------|
| 1 | 静态闸：`tsc -b`＋`vite build` 生产包 | ✅ |
| 2 | 夹具：dev-login 店长（merchant_manager · 临时库） | ✅ |
| 3 | 点「日结并冻结全日账目」出**真独立确认 dialog**：`layerTag=DIALOG`／`nativeOpenCount=1`／`layerMatchesOpen=true`（原生 `<dialog>` showModal 顶层模态）；role=dialog＋aria-modal；`dialogCount=1`（document）＋`rootDialogCount=1`（#root 内）；遮罩在；确认/取消成对；inlineInRoot＋notPortalToBody＋notInline（非页内闸假弹） | ✅ shots/01 |
| 4 | 拦：开闸未确认——dayClose 调用=0（未确认不得落日结） | ✅ |
| 5 | 撤① Esc（可信 Input 键路→原生 cancel）：modal 收＋dayClose 调用=0＋server 0 单＋零成功 toast | ✅ shots/02 |
| 6 | 撤② Esc（合成事件→window keydown 兜底）：modal 收＋零真提交 | ✅ |
| 7 | 撤③ 点遮罩（可信 Input 鼠标 12,12）：modal 收＋零真提交 | ✅ |
| 8 | 撤④ 点遮罩（合成 click 元素派发）：modal 收＋零真提交 | ✅ |
| 9 | 撤⑤ 取消钮：modal 收＋零真提交＋零成功 toast | ✅ shots/03 |
| 10 | 确认「确认日结并冻结」才真冻结：dayClose 调用=1＋frozen 单×1（¥0 诚实口径）＋成功 toast 由真返回驱动 | ✅ shots/04 |
| 11 | 涉钱全 mock（实点 ¥0）；临时库测完即删 | ✅ |

### C. 现网活体复现（只读零写 · 全新浏览器档无 SW 存留 · muts 仅 dev-login）

`live-probe.json`＋`shots-live/`：现网 `:7202`（DEPLOY 20261023151743／`index-DZLPpaKN.js`）
全新档 dev-login 演示店长 → /cashier/close 开闸实测 **8/8 全绿**：
dialogCount=1（document 与 #root）／role+aria-modal／遮罩／成对／Esc（可信）／遮罩（可信 12,12）／
取消钮三撤后 listDayCloses 恒 21（基线 21，realDayCloseSubmit=false）／零成功 toast。
**未点确认（禁真日结）**。证实 06bd460 码层行为本对；PD-85 复测 FAIL 帧＝检测环境
上一代 SW 供包（根因③），非码缺。本窗原生 dialog 化后，`dialog[open]` 亦成可检锚，
任何 ≥本窗包被测均过。

## 静态验证
- `tsc -b`（merchant 全引用链含 server）：绿；`vite build`：绿（PWA generateSW 正常）；
- eslint 改动 2 文件：仅 2 条**基线既有** `react-hooks/set-state-in-effect`
  （DayClosePanels clearSignal 清零／CashierClosePage reclose 深链；PD-84/PD-85 树同位置同报，本窗零新增）。

## 边界
零 schema／零迁移文件（**0127 故意空留**）；打印面未重做；导出面未碰；YKNXD2 未碰；
SW·PWA 策略面未扩未动（registerSW.js 无自 reload 为注记级环境因，平台级另议）；
临时库测完已删；现网零写（活体复现仅 dev-login＋开闸＋三撤，未点确认）；夹具
`01M5EQVF` 未碰；未造第二店；USAGE 未查。
