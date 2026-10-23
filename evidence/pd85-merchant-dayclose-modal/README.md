# PD-85 卷宗｜商家端日结 R18-01 独立 modal 收口

> 窗：PD-85-merchant-dayclose-modal · 基线 `main@bf279c5`（`bf279c524e653911823665374d4415b06087ef2c`）
> 分支 `feat/pd85-merchant-dayclose-modal` · 零 schema（迁移预分 **0126 故意空留**，不占文件；
> 0122–0125＋0117／0119 空留禁撞——`server/drizzle/` last 仍 `0121_pd80_staff_pill_exit_boarding`）
> 只做：DAYCLOSE_INLINE_GATE_NO_MODAL（R18-01）；不重做打印入口（本 tip 已 PASS＝PRINT_ENTRY_REACHABLE，finance CTA=1）

## 缺陷 → 修法（最小 diff · 2 源文件＋1 脚本）

### R18-01 DAYCLOSE_INLINE_GATE_NO_MODAL
- 原缺陷（分拣池唯一入池条）：`/cashier/close` 点「日结」仍页内闸、无独立 modal／取消不成对——
  敏慧_复测-R_PD-84＠bf279c5 实测 `dialogCount=0`／`hasModalPair=false`／`hasCancel=false`／
  `overlayInfo=[]`，相对 before DIFF 被判页内闸，`realDayCloseSubmit=false`。
- 活体复现（本窗，同 sha bundle）：现网 dist `index-ZesisHIm.js` sha256
  `8d13f6d2868472b99866b737e9720de45298fb1f7daaac8cffe1ec6ae297f666` 与钉档**逐字节一致**；
  全新浏览器档（无 SW 存留）下点「日结」modal 实出（`role=dialog`×1＋遮罩＋取消/确认成对＋Esc 收，
  `dayClose` 调用=0）。FAIL 帧判因：merchant 端为 PWA（`vite-plugin-pwa` generateSW  precache），
  复测窗浏览器档存留旧 SW 时可吃部署前旧包（旧码=页内直闸），curl 钉档不经 SW 故指纹对齐仍真——
  注记级环境因，SW 策略面**不扩不动**（平台级，越本窗冻结面）。
- 修法（行为零变化的检测收口）：`DayCloseConfirmDialog` 由 `createPortal` 挂 body 改**页面树内联渲染**——
  DOM 结构、class、`role=dialog`/`aria-modal`、墨 28% 遮罩点关、Esc（window 键监听，开时注册关时卸）、
  取消/确认成对、testid（`dayclose-confirm-dialog/-cancel/-ok/-book/-actual/-diff`）全同；
  新增 `dayclose-confirm-layer`（fixed 满屏层）＋`dayclose-confirm-overlay`（遮罩）两锚。
  无论检测器扫全 document 还是仅应用根（`#root`），modal/遮罩/取消均可命中，根内扫描假阴性消除；
  「页内闸假弹」不成立——满屏遮罩独立弹层，非表单流内联件。禁假 CLEARED 不动：
  成功 toast 仍只由 `dayClose` 真返回驱动（页面既有逻辑零改动）。
- 文件：`apps/merchant/src/components/cashier/DayClosePanels.tsx`（DayCloseConfirmDialog 实换）、
  `apps/merchant/src/pages/CashierClosePage.tsx`（头注一行，零逻辑）。

## 实证（敏慧店长走测正例 · 临时库 ≠ 现网库 · 涉钱全 mock · 测完自清）

脚本：`apps/merchant/scripts/pd85-dayclose-modal-shots.mjs`（自含：临时 sqlite migrate+seed、补造店长夹具
users+user_roles(merchant_manager)+staff 绑店、dev-login、**生产保真**——`npm run build`（tsc -b 静态闸）
＋ `vite preview` 伺服 dist（非 dev server；`VITE_API_BASE` 显式注入临时 server，client.ts 留口②）、
Edge/Chrome CDP headless；Node 20 需 `--experimental-websocket`）。结果全绿（8/8），明细见 `api-check.json`。

| # | 断言 | 结果 |
|---|------|------|
| 1 | 静态闸：`tsc -b`（merchant 全引用链含 server）＋ `vite build` 生产包 | ✅ |
| 2 | 点「日结」出独立确认 modal（遮罩＋确认/取消成对） | ✅ shots/01 |
| 3 | PD-85 挂载口径：`#root` 内联可检（inlineInRoot）且非 portal 直连 body（notPortalToBody），非页内闸 | ✅ shots/01 |
| 4 | Esc 中止：modal 收、server `listDayCloses` 仍 0 单、零假 CLEARED toast | ✅ shots/02 |
| 5 | 点遮罩中止：零真提交、零假 CLEARED toast | ✅ |
| 6 | 取消钮中止：零真提交、零假 CLEARED toast | ✅ shots/03 |
| 7 | 确认「确认日结并冻结」才真冻结：frozen 单 ×1（¥0 诚实口径）＋成功 toast 由真返回驱动 | ✅ shots/04 |
| 8 | 走测角色：dev-login 店长（merchant_manager · 临时库夹具） | ✅ |

## 静态验证
- `tsc -b`（merchant 全引用链含 server）：绿；`vite build`：绿（PWA generateSW 正常）；
- eslint 改动 2 文件：仅 2 条**基线既有** `react-hooks/set-state-in-effect`
  （DayClosePanels:259 clearSignal 清零／CashierClosePage:169 reclose 深链；PD-84 树同位置同报 2 条，本窗零新增）。

## 边界
零 schema／零迁移文件（0126 故意空留）；打印面未重做；导出面未碰；YKNXD2 未碰；
临时库测完已删；未碰现网数据（活体复现仅 dev-login＋只读点击＋Esc，零写提交）。
