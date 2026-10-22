# PD-81 卷宗 · 商家端死单前台隐藏＋日结 R18-01＋导出/打印入口

- 窗名：`PD-81-merchant-dead-order-dayclose` · 模型 K3 MAX
- WORKTREE：`E:\KIMI code\pd81-merchant-dead-order-dayclose` · BRANCH：`feat/pd81-merchant-dead-order-dayclose`
- 基线：`main@8ec880e`（`8ec880ee425f9ea3beaf79a391bd6d0001bec55b` · DEPLOY 20261022202611）
- 迁移：**零 schema——预分 0122 故意空留，不占文件**（禁撞 0114–0120 ✓；0117／0119 空留未占 ✓）
- 走测：2026-10-22 ≈22:11 Asia/Shanghai · 本窗临时库（`.runtime/pd81-*`，测后已删）· server 7210／merchant 7111（避让并行窗 7200/7101）

## HIT（原缺陷 → 证据 → 状态）

| # | 原缺陷 | 修法 | 证据 | 状态 |
|---|--------|------|------|------|
| 1 | **YKNXD2 死单仍露**：商城夹具死单 `P261022YKNXD2`／`01M5H1E1…`（¥19 已付无退口）在商家端 /orders 待发货队列露出（PD-74 显示层过滤只覆盖收银面，商城订单页无过滤） | `mall-admin/format.ts` 加 `isDeadOrderDisplayHidden`（单号集＋ULID 前缀名单）；`OrdersPage` 三队列 useMemo 同源过滤（列表＋chips 计数＋副行同剔除）；**禁删库/禁直改库** | shots/01（/orders 仅对照单 `P261022PD81C` 可见·待发货 1）；api-check.json（deadRow=false／deadText=false／ctrlRow=true）；走测后同库 SELECT 死单 `status=paid, total_fen=1900` 仍在 | 已修·可点验 |
| 2 | **日结 R18-01（NOT_RECAPTURED）**：日结单详情无打印入口，盲测无法落凭据复证 | `DayClosePanels.tsx` 详情弹层加「打印日结单」（仅 owner 同导出闸·总规则③口径不动；`window.print()`＋@media print 内联隔离 `#dayclose-print-sheet`，照 ReceiptPage 先例）；`CashierClosePage` 传 `isOwner` | shots/02（日结单详情 footer「打印日结单／关闭」）；api-check.json（printBtn=true，日结单=真接口 `cashier.dayClose(actualCashFen:0)` HTTP 200 冻结今日） | 已修·可 RECAPTURED |
| 3 | **EXPORT_ENTRY_MISSING**：报表页无打印入口（导出 CSV 已存在但打印缺） | `ReportPage.tsx` 页头加「打印」钮（仅 owner 同导出闸；`window.print()`＋@media print 隔离 `#report-print-area`，打印头亮出表名＋月份）；copy 键 `rpt.page.printCta`／`cashier.dayClosePrint` | shots/03（D1 页头「导出 CSV＋打印」双钮）；api-check.json（report-print/report-export/print-area 均在；print 媒体下打印头 display:block、钮区 visibility:hidden） | 已修·可点验 |
| 4 | **盲测商家 R21～R22 新H 甄别** | 权威池（`D:\Philia-shared\下批分拣池-产品-1022-基线8ec880e.md`＋连续测分拣桶）仅载题头无条目明细：**无可最小修之具体件入窗，不造修**；**单店无切换＝INC 只登记**（跨店锁 PD-70+ 口径：manager 不出现切换＝固定本店现状设计，禁造第二店种子） | 登记入交付回执 HIT 表 | 登记 |

## 验证记录

- `npm run build:merchant`：✓（tsc -b＋vite build 通过，5.60s）
- 单测：`tsx --test format.test.ts model.test.ts` → **5/5 PASS**（PD-81 新增 2＋PD-74 回归 3）
- 走测脚本：`apps/merchant/scripts/pd81-dead-order-dayclose-shots.mjs`（自含：临时库 migrate+seed → 夹具死单/对照单 → 真接口日结 → Edge CDP 1280×800 店主走测）→ **13/13 全绿**，明细见 `api-check.json`
- 关键断言：死单 /orders 行＋全文双缺席 · 对照单不误伤 · 待发货计数=1（同源剔除）· 日结详情打印可达 · 报表双入口可达 · 打印隔离生效 · **死单库内仍在（零库写）**

## 纪律

- 未合／未部（PR 只开不合）；不写验收通过；未直改库（现网/共享库零触碰；夹具只落本窗临时库，测后已删）
- 夹具 `01M5EQVF` 零触碰；未跨店造种（单店种子库）；涉钱全 mock（无真实支付/退款；日结 ¥0 诚实口径）
- 未抢前台／未动双屏；未查 USAGE；端口 7210/7111/9271 测后已收，`.runtime/pd81-*` 已删
- 权限口径不动：导出/打印均仅 owner（总规则③ 不扩 manager）
