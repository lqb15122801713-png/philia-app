# PD-45 · U6 商家桌面定稿升档 · 卷宗

- 档号：PD45｜令号：CJ-1018-11｜分支：`feat/design-upgrade-u6-merchant-desk`｜基线：main@`dd0417a0`（全 `dd0417a02a63f775bc90abdf9dbb190ca5f8475e`，含 PD-42 MERGED；1020 基线升档补丁口径，勿再用 08f0e36b）
- 模型：K3 MAX｜窗：「全端升档-U6-商家桌面」｜WORKTREE：`E:\KIMI code\design-upgrade-u6-merchant-desk`
- 权威对照：figma bro 定稿＋Ready `READY-FOR-DEV-20261015` §1.C 全表（W-00 `203:14`／W-01 `199:2`／W-02 `203:39`／W-03 `203:125`／W-04 `203:211`／W-05 `203:297`／W-06 `203:383`／W-07 `203:469`／W-08 `203:555`／W-09 `203:917`／W-10 `203:1284`／W-11 `203:1688`／W-12 `203:2354`／W-13 `203:2725`／W-14 `203:3067`／W-15 `203:3739`／W-16 `203:4047`）／§2 Token（VI `193:2`）／§3 组件（WAlert 左赭红仅异常·MerchantRail15 激活左 cream·PrimaryCTA cream ≤1）／§4 态规则／§6 禁改；Figma `ot5SBoqhKAw2UIZRVFzhel`
- 本卷宗只证「施工完成并对照自查」；**不写验收通过**、不判美；验收归产品 ROG／头子点验。

## 一、施工面（只销 U6 商家桌面 W-00～W-16）

### A · 副文 ≥12px 全量抬升（硬尺；可读文字清零 <12px）

| 落点 | 换代 |
|---|---|
| `apps/merchant/tailwind.config.js` | preset `caption-xs` 11px → **12/16**（仅商家端构建生效；packages preset 与客/员两端不动） |
| `styles/console.css` | 32 处 <12px 全抬 12（wsk-top .no 9／total cap·cell·spark 8.5–9／postcard eb·figcap·cr 8.5–11.5／list .s 9.5／pill 9／capcal lg·d·ful 8–10／redline tt·it 9–11／matrix th·mx·locked 9–10／cports gp·seal·no 8.5–9／cpub st·ar·rb 9.5–10／clog meta 9／fdot small 9.5／hd .a 9／note 9／rail gp·sub·bd·ft 8–11／dock 签 10.5） |
| `index.css` u3 族 | 9 处 11px → 12（panel-head aside／tbl th／st／stat cap·d／todo small／kv cap／field lb／stepv small） |
| 页面/组件 TSX | `text-[11px]`×39 → `text-[12px]`、`text-[10px]`×1 → 12（AppointmentsPage／AppointmentDetailPage／BoardingPage／DashboardPage×9／DevLoginPage×7／PassPage×8／ProductsPage／ConsoleSearch／RescheduleSheet×2／AppointmentRow×2／amortization／InvoiceTodoSection／TicketTodoSection／StatCards×3／TodayTimeline×2） |
| `components/skeleton/index.tsx` | WCapCal 星期行内联 8.5 → 12 |
| `pages/ReceiptPage.tsx` | 打印小票 11 → 12 |

### B · C4–C6 入口分列（只露入口，业务规则零翻案）

| # | 缺口（产品缺口清单） | 本片落点 | 实证 |
|---|---|---|---|
| **C4** | 强制完成：详情有、**列表单卡无 CTA** | `pages/AppointmentsPage.tsx` 操作列：in_service 且超 24h 未翻步行（判定同监控 Hub `isZombie24h`）露「**强制完成**」（赭红字）；复用 `forceCompleteStale` 单源端点＋同一确认句 `mon.forceCompleteConfirm`＋留痕注 `mon.forceCompleteNote`（监控 Hub／单约监视页同语义第三处入口） | `u6-w02-appointments.png` 僵尸行 CTA；`u6-w04-monitor-hub.png` WAlert 行内次动作 |
| **C5** | 改期：列表无横幅、详情才见 | 同操作列：pending\|confirmed 行露「**改期**」（资格口径与详情页 `canReschedule` 一致）；直开 `RescheduleSheet`（详情页同件同服务端强校验；`listForStore` 行自带 storeId/serviceId/petId/scheduledEnd 零服务端改动） | `u6-w02-reschedule-sheet.png` 列表行真弹层 |
| **C6** | 日结「已冻结」明示弱 | 历史行状态格＋详情弹层字段：硬编码「冻结生效」→ copy 键 **`cashier.closeStatusFrozen`＝「已冻结」**（u3-st live 明示签）；banner（`day-frozen-banner`）＋班次徽（`close-shift-day-frozen`）既有三处并列 | `u6-w07-close-frozen.png` 三处同帧 |

- 新 copy 键 3 个（码内默认 fallback 即生效，端口可覆写）：`appt.rowReschedule`／`appt.rowForceComplete`／`cashier.closeStatusFrozen`。**迁移申报**：随批注册进 copy_overrides（生成器重跑）＝产品侧端口批另册。

### C · cream 预算收敛（Ready §3 PrimaryCTA ≤1「此刻要做」／§2.1 ≤2 硬帽）

| 屏 | 调整 |
|---|---|
| W-06 收银台 | `cashier-quick-add`（快速加单）＋`cashier-scan-verify`（扫码核销）cream → **深棕 CTA**（bg-brand-cta／text-brand-cta-on）；本屏唯一 cream＝结账（实证 cream=1） |
| W-07 日结 | `cash-move-submit`（现金登记）cream → 深棕 CTA；唯一 cream＝日结并冻结（实证 cream=1） |
| W-10 商品 | `csv-execute`（确认导入）＋`products-bulk-save`（批量保存）cream → 深棕 CTA；唯一 cream＝＋新增商品（实证 cream=1） |

### D · 脸面校形与死码清账

- **W-00 登录**：居中卡 400 → **420**（UX-02 W-00 规格）；账号行角色字 → **mono 轨**（「角色 mono」口径）。
- **旧墨 alpha 基底换代**：`rgba(59,46,36,*)` → `rgba(44,40,34,*)` 全 src 机械换代 351 处（S3 同向收尾；含 W 帧页与非 W 子页，端内一致）。
- **死码禁色清账**（S3 报备「如需清账请另令」→ 本令清，文件保留不拆回滚）：`StatCards.tsx` 渐变／纸白／淡金全令牌化（bg-philia-gradient／text-canvas／bg-success-deep／text-brand-primary）；`TodoSection.tsx` DOT_LEMON `#F2DFA6→#F2DC8C`、DOT_MINT `#2E2318→#2C2822`；`BoardingStayCard.tsx` 选中底 `rgba(242,223,166)→rgba(242,220,140)`；`BoardingStayDetail.tsx` 纸面 `#FFFDF6→bg-card`；`PassPage.tsx` 萤火档色 `#F2DFA6→#F2DC8C`；`OpsPage/PayrollPage/ScheduleManagePage/TaskTemplatesPage/TransfersPage` 文字淡金 → cream 现值；`LedgerPage` 深棕/纸白 → ink/canvas。
- **红线复扫=0**：旧雾感四色（#5C4330/#6B5238/#C4A574/#FAF8F4）、#F2DFA6、#FAF8F2、#FFFDF6、rgba(59,46,36、rgba(250,248,242（index.css dark 域注记例外＝令牌既有口径）、爪印、text-v2-trace/v2-micro/v2-note 引用。
- 赭红 `#B4502E` 字面量＝Ready §2.1 alert 同值现令牌值（bg-destructive 同值族），S3 既收录口径本片不动。

## 二、缺口吞表销项对照

- **A 商家桌面半成品**：W-00～W-16 十七屏全帧实拍复核（shots/ 十八帧）；字阶／cream／空态／密度按 Ready 硬尺收；WAlert 左赭红仅异常行（空态无条）。
- **C4–C6 入口可见性（分列，非业务翻案）**：见 §一.B——入口三分列；资格判定／确认句／留痕注／服务端强校验全部复用既有单源，**零业务规则改动**。
- **勿塞**（全程未触）：三本账／日结／钱权／L2 翻案；B7／PD-40／209:*；B10；U1～U5／U7 深脸；员工 K8 混销；pd44-1-logout 树。

## 三、验证（截图／Argus 级实测 · 全绿）

- 脚本：`apps/merchant/scripts/u6-merchant-desk-shots.mjs`（CDP 无头 Edge，1440×900 桌面实尺；零新依赖；`@libsql/client` 经 server/node_modules createRequire 取用）。
- 运行：`node --experimental-websocket apps/merchant/scripts/u6-merchant-desk-shots.mjs`（前置：本片 server 7251＋merchant preview 7171，库 `E:\KIMI_tmp\u6-merchant\face.db` migrate+seed 复位；CORS_ORIGINS 含 7171）。
- 真链路驱动：dev-seed → 客户真下单×2（A=核销 in_service→**库直写 checked_in_at 回拨 25h 秒级**成僵尸）→ 寄养单 in_boarding → settle 两单 → 退款双态 → **cashier.dayClose 真冻结**（实点=账面 ¥124 差异 0）→ **D-29 冻结后新开单自动开次日班次**。**不走**预约提交／支付真通道。
- 结果：**全绿**（`u6-results.json`，66/66）。覆盖：W-00 结构＋420 卡＋mono 角色、W-01 WAlert+M3+rail、W-02 台账真行×3＋**C4 僵尸行强制完成可见**＋**C5 行改期可见＋弹层真开**、W-03 fdot+folio、W-04 僵尸出列＋**WAlert 行内强制完成次动作**、W-05 M3+在店、W-06 三栏（cream=1）、W-07 **C6 banner+班次徽+历史行「已冻结」三处**、W-08 双态、W-09 空态诚实、W-10 cream=1、W-11 M3+档色点、W-12 台账×4、W-13 四格+D1–D9 目录、W-14 矩阵+锁死、W-15 档案行、W-16 运营后台端（无「开发者」可视残留）；**每帧三闸：可读文字全量 ≥12px（计算样式巡检）／爪印=0／cream 计数 ≤2（实测 0–1）**。
- 构建闸：`npm run build -w @philia/merchant`（tsc -b＋vite build）**exit=0**（`gates/build-merchant.log`）。
- lint：`eslint .`＝47 错 5 警——**与 S3 登记基线同数，本批零新增**（旗标三件 DayClosePanels 232／AppointmentsPage 196／DevLoginPage 96 均为基线旧件，非本批 hunk）（`gates/lint-merchant.log`）。

## 四、禁区遵守

未做：真付真退（退款为既有 execute/settleActual 内测夹具同族，非真实支付通道）；提交预约；开会员真通道；真加购结账；三本账／日结／钱权／L2 翻案；B7／B10／U1～U5／U7／员工 K8；选品；合部；写验收通过；判美。真图未齐处=既有浅色占位／「待换」原样，无爪印冒充。W-11 四格 3/4 读口待补=诚实置灰占位原样（产品缺口清单另册）。W-15 通知偏好=本地占位（产品缺口另册）。

— KimiCode A 窗 · 全端升档-U6-商家桌面 · 2026-10-20 · K3 MAX
