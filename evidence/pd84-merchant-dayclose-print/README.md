# PD-84 卷宗｜商家端日结 R18-01 独立 modal＋打印入口

> 窗：PD-84-merchant-dayclose-print · 基线 `main@dcec051`（`dcec051a7de2812fea1bb73a397617f2646c8eb2`）
> 分支 `feat/pd84-merchant-dayclose-print` · 零 schema（迁移预分 **0125 故意空留**，不占文件）
> 只做：DAYCLOSE_INLINE_GATE_NO_MODAL（R18-01）＋ PRINT_ENTRY_MISSING；不重做 YKNXD2 隐藏／导出（本 tip 已 PASS）

## 缺陷 → 修法（最小 diff · 6 源文件）

### R18-01 DAYCLOSE_INLINE_GATE_NO_MODAL
- 原缺陷：`/cashier/close` 点「日结并冻结全日账目」直提 `dayClose`，页内闸无独立 modal／取消不成对。
- 修法：表单 onSubmit 不再直提，先入 `pendingDayClose` → `DayCloseConfirmDialog`（CashierModal 工艺：
  portal 挂 body、role=dialog aria-modal、墨 28% 遮罩、Esc 关；摘要透出 账面/实点/差异，盲交遮罩口径同表单）。
  「取消」/Esc/点遮罩＝中止零提交；「确认日结并冻结」才 `dayCloseM.mutate`。成败均收 modal；
  成功 toast 仍只由真返回驱动（禁假 CLEARED）；400「须填差异说明」聚焦保留输入行为不动。
- 文件：`apps/merchant/src/components/cashier/DayClosePanels.tsx`（+DayCloseConfirmDialog/DayCloseSubmitInput）、
  `apps/merchant/src/pages/CashierClosePage.tsx`（接线）、`apps/merchant/src/copy/cashier.ts`（3 键）。

### PRINT_ENTRY_MISSING
- 原缺陷：PD-81 打印入口仅店主闸（详情弹层「打印日结单」、报表页头「打印」），店长视界全缺；财务页无打印口。
- 修法（浅点即止、禁真送打）：
  - 日结单详情「打印日结单」放宽 owner|manager（`canPrint`）；导出 CSV 仍仅 owner（总规则③不动）；
  - 报表页头「打印」放宽 owner|manager（`role.canManage`）；导出仍仅 owner；
  - 财务 `/finance` 页头新增「打印」QuietButton（本页 owner|manager 闸，同页可见即可点）＋
    `@media print` 隔离 `#finance-print-area`（打印头亮出表名+期间，屏上 display:none）——照 ReportPage/ReceiptPage 先例。
- 文件：`DayClosePanels.tsx`、`apps/merchant/src/pages/ReportPage.tsx`、`apps/merchant/src/pages/FinancePage.tsx`、
  `apps/merchant/src/copy/finance.ts`（`fin.printCta`）。

## 实证（敏慧店长走测正例 · 临时库 ≠ 现网库 · 涉钱全 mock · 测完自清）

脚本：`apps/merchant/scripts/pd84-dayclose-print-shots.mjs`（自含：临时 sqlite migrate+seed、补造店长夹具
users+user_roles(merchant_manager)+staff 绑店、dev-login、Edge/Chrome CDP headless；Node 20 需
`--experimental-websocket`）。结果全绿（14/14），明细见 `api-check.json`。

| # | 断言 | 结果 |
|---|------|------|
| 1 | 点「日结」出独立确认 modal（遮罩＋确认/取消成对，portal 挂 body，非页内闸） | ✅ shots/01 |
| 2 | Esc 中止：modal 收、server `listDayCloses` 仍 0 单（零真提交） | ✅ shots/02 |
| 3 | 点遮罩中止：零真提交 | ✅ |
| 4 | 取消钮中止：零真提交 | ✅ shots/03 |
| 5 | 确认才真冻结：frozen 单 ×1（¥0 诚实口径） | ✅ shots/04 |
| 6 | 打印①：详情「打印日结单」店长可见，打桩浅点计数=1（禁真送打） | ✅ shots/05 |
| 7 | 打印②：报表 D1「打印」店长可达可浅点；「导出 CSV」店长不渲染（总规则③不动） | ✅ shots/06 |
| 8 | 打印②：报表打印隔离生效（打印头亮出／钮区隐藏） | ✅ |
| 9 | 打印③：财务页头「打印」店长可达可浅点（打桩计数=1） | ✅ shots/07 |
| 10 | 打印③：财务打印隔离生效 | ✅ |

## 静态验证
- `tsc -b`（merchant 全引用链含 server）：绿；
- `vite build`：绿（PWA generateSW 正常）；
- eslint 改动 6 文件：仅 2 条**基线既有** `react-hooks/set-state-in-effect`
  （`DayClosePanels` clearSignal 清零 effect、`CashierClosePage` reclose 深链 effect；
  PD-81 树同位置同报，本窗零新增）。

## 边界守规
零 schema／未碰迁移号（0125 故意空留；0117/0119/0122/0123 未占）；未碰夹具 01M5EQVF；
临时库测完即删（KEEP_ENV=1 才留）；未真日结现网、未真送打；YKNXD2 隐藏／导出入口未重做。
