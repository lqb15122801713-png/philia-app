# 卷宗 · design-s3-merchant-face（产品-1015 换皮 · 片3-商家收银）

- **对象**：A1 W-00 登录（READY `203:14`）；A2 W-02 预约台账／W-03 预约详情（`203:39`／`203:125`）；A3 W-04 监控 Hub（`203:211`）；A4 W-05 寄养（`203:297`）；A5 W-06 收银台桌面／W-07 日结／W-08 退款（`203:383`／`203:469`／`203:555`）；A6 手机五槽（`198:374` 总览／`203:5219` 门店／`198:445` 收银／`203:5365` 报表简／`203:5480` 我的）。
- **分支／基线**：`feat/design-s3-merchant-face` ＠ 基线生产 main@`f0299e7333dda450d73d54b16eb027db4690021f`
- **施工方**：A 窗（Kimi Code · 角色卡⑧ · 已用 K3 MAX）· 2026-10-16 Asia/Shanghai
- **实证环境**：本片 server :7241（本片独立库 `E:\KIMI_tmp\s3-merchant\face.db`，跑前 db:seed 复位）＋ 三端 preview :7160/:7161/:7162（本片分支构建产物，`VITE_API_BASE=http://localhost:7241` 构建期烘入）；headless Edge/Chrome CDP :9236–9241；视口桌面 1440×900／手机 390×844 mobile 实尺。
- **错口纪律**：在跑的他窗栈未碰——7100-7112/7150-7152/7200-7201/7231/9223-9235 全程零触碰；本片只用 7160-7162/7241/9236-9241。
- **画布/锚点纪律**：全部既有 `data-testid`（merchant-rail／merchant-dock／cashier-page／dash-m3-chain／finance-received-card／settings-entries 等）、copy 键、路由、接口、交互链路零改动；**零新 copy 键（零新迁移）**；零服务端改动。
- **端口轻批（令围写死）**：晨报题／引言（`wsk.postcardEyebrow/postcardTitle/postcardMore`＋`dash.postcardFigCap/postcardRowBoarding/postcardRowTodo/postcardRowOverdue`，数字来自账）与异常卡模板句（`wsk.alertEmpty/alertGo`）＝既有键且在种子库（copySeedRows），A4 端口链路本片只核不增。

## 一、shots/（实尺十三帧 · 全绿 · 真链路驱动）

| 文件 | 对应帧 | 驱动方式（不画假态） |
|---|---|---|
| d01-w00-login.png | W-00 登录 `203:14` | 净库未登录直访 /dev-login：canvas 底白卡+衬线宣言+cream 主钮（本屏 cream 唯一） |
| d02-w02-appointments.png | W-02 台账 `203:39` | 客户真下单×2＋寄养单（create→confirm→assign 钉阿强）→ /appointments：七列台账真行×3，状态胶囊（服务中 N/6＝墨底 cream 字／寄养中／待到店） |
| d03-w03-appointment-detail.png | W-03 详情 `203:125` | A 单核销进 in_service 后 /appointments/:A：两栏+状态流+WFolio 真值 |
| d04-w04-monitor-hub.png | W-04 监控 Hub `203:211` | A 单 in_service＋寄养单 in_boarding → /monitor：异常前置卡+服务中卡（六步 stepdots 可视）+寄养卡 D1；IA 零触 |
| d05-w05-boarding.png | W-05 寄养 `203:297` | 寄养单在店 → /boarding：M3 四格+房型卡+在店台账真行+容量日历 |
| d06-w06-cashier.png | W-06 收银台 `203:383` | 真结两单后 /cashier：三栏（开单/当前单/挂单队列）+今日流水（墨底 cream 支付签） |
| d07-w07-close.png | W-07 日结 `203:469` | /cashier/close：当前班次+今日账面四分列（现金¥124 真值；储值参考列不计入=裁定①明面）+日结冻结区 |
| d08-w08-refunds.png | W-08 退款 `203:555` | 退款 execute×2（一留 executed 待实退、一 settleActual 实退登记）→ /cashier/refunds：双态真行（已实退 墨底签／待实退登记 cream 签）+驳回权口径卡 |
| p01-phone-overview.png | 手机槽一 总览 `198:374` | 390×844 → /dashboard：连锁视图卡（合计六项真值¥124/3 单/在店 1）+dock 五槽 |
| p02-phone-store.png | 手机槽二 门店 `203:5219` | /appointments：台账真行+dock 五槽（门店激活） |
| p03-phone-cashier.png | 手机槽三 收银 `198:445` | /cashier：390 单栏 tab 降级+dock 五槽（收银激活 cream 短划） |
| p04-phone-report.png | 手机槽四 报表简 `203:5365` | /finance：已收卡+spark 真值+dock 五槽 |
| p05-phone-me.png | 手机槽五 我的 `203:5480` | /settings（dock「我的」暂驻）：条目组+dock 五槽 |

截图脚本：`apps/merchant/scripts/s3-merchant-face-shots.mjs`（零新依赖 CDP 实证器：真登录/真下单/真派单/真核销/真结单/真退款取景，可复跑）；运行日志见 `gates/s3-merchant-face-shots.log`（十三帧全绿，exit=0）。shots-baseline/＝施工前同机位十三帧（同脚本同库种基线 tip 跑批）。

## 二、gates/（闸门实证 · 全部零回退）

| 文件 | 闸门 | 结果 |
|---|---|---|
| `build-3apps.log` | 根 `npm run build`（三端 tsc+vite） | ✅ exit=0 |
| `server-typecheck.log` | server `tsc --noEmit`（本片 server 零改动，照跑自证） | ✅ exit=0 |
| `smoke-routes.log` / `smoke-routes.json` | 三端构建产物路由级冒烟（110 路由锚点+console 红线） | ✅ 110/110 通过，exit=0（首跑检出本片 CORS 白名单缺 7160/7162 环境缺口，server 侧 env 补齐后复跑全绿；非码面问题） |
| `check-nav-closure.log` / `.json` | 导航闭环体检（126 路由四要素） | ✅ 死胡同 0 · 弱 0 · 豁免 6，exit=0 |
| `e2e-nav-check.log` | 真点击导航实证（成功页四要素/选宠弹层/tab 保状态/底栏爪标签） | ✅ 全绿，exit=0 |
| `s3-merchant-face-shots.log` | 本片实尺截图脚本运行归档 | ✅ 十三帧全绿，exit=0 |
| `lint-merchant.log` | `eslint .`（非令列闸门，自查项） | ⚠️ 存量 47 错 5 警（react-compiler/react-refresh/no-fallthrough 规则族旧逻辑件）；机器交叉核对（旗标行 ∩ 本片 diff hunk）：**片内 0／片外 52——本片零新增** |

## 三、令围落点（A1→A6 同片序照令）

- **A1 · W-00 登录**：卡面/字段/发丝线全令牌化（bg-card／bg-canvas／rounded-control／`rgba(44,40,34,x)`）；字色 ink 令牌族（secondary/placeholder）；柠檬主钮旧称注释→cream（bg-brand-primary=#F2DC8C，本屏 cream 唯一）；种子登录/口令门/登出真链路零触。随齐：守卫两件 RequireMerchant／RoleGuidePage 爪印→IdCard 线性 icon（Ready §4 禁爪印占位，片2 RequireStaff 同族）。
- **A2 · W-02／W-03**：AppointmentRow／AppointmentsPage／AppointmentDetailPage／MonitorTimeline／ConfirmDialog／Toast 旧墨 alpha→ink 令牌族；装饰 alpha 基底换代 `rgba(59,46,36,x)→rgba(44,40,34,x)`；danger 钮→bg-destructive 令牌；空态图标字色令牌化。
- **A3 · W-04 监控 Hub**：卡面/badge/骨架洗底令牌化；**IA 零触**（异常前置卡/卡墙/45 分阈值/强制完成链路/僵尸预警全部原样，监控不借机重做 IA）。
- **A4 · W-05 寄养**：M3/在店台账/容量日历字色线色令牌化；BoardingMonitorPanel 爪印→BedDouble（寄养打卡同族）。
- **A5 · W-06／W-07／W-08**：收银全家 17 件令牌换代——旧淡金 `#F2DFA6`→cream 令牌；深棕 `#3B2E24/#2E2318`→ink 收敛（员工端片0「--ink-deep 收敛 body」同族）；`#FFFDF6→bg-card`；`#FAF8F2→bg-canvas`；`#F1E8D4→bg-sunken`；字色 ink 令牌族；**Folio／PayChips（PaySheet 支付段 chips 族）／Redline（WRedline 四句）明面原样在场**；三本账（储值核销≠现金营收／扣次非现金／回馈金仅抵商品／四分列）、日结冻结／反结账、退款 draft/executed/settled 规则零触；店间隔离（server 侧 storeId 硬过滤）零触。
- **A6 · 手机五槽**：总览/门店/收银/报表简/我的五槽共享件（DashboardPage/FinancePage/SettingsPage/InvoiceTodoSection/TicketTodoSection/MainScaffold）令牌化；dock 五槽＝总览·门店·收银·报表·我的（片0 壳）零触；未装配旧件 StatCards/TodoSection/TodayTimeline 按片2 保留口径未动（不留死代码≠拆既有回滚）。
- **u3 骨架族（index.css）**：u3-panel/tbl/st/chipf/stat/kv/field/stepv 全量令牌换代（禁色清零；`:root` 令牌片0 已落；**dark 域不随动**＝片0 注记）。

## 四、红线自报（零触）

- 钱权／L2／日盘门槛／服务时长／监控 45 分阈值（PIN 灰区）：零触。
- 三本账／收银／日结／退款／权限／Rail 十五口／手机五槽／支付结算／店间隔离：写死项零触，实证帧明面。
- 监控 IA：零触（不借机重做）。
- 零新依赖（package\*.json/lock 零改动）；零新迁移（零新 copy 键）；零服务端改动。
- icon 库全量／真图终摄／五槽外手机屏／片0·1·2·4 范围：非目标未触；不判美。
- A 窗禁合禁部：PR 只开不合；未点「完成／完成任务／归档／中断」；勿碰 CJ「读取 Philia 施工文件」与选品系统窗及片0／1／2／4 会话栈。

## 五、边界与报备（提请产品侧知悉，不擅自扩）

1. **Figma 帧不可直读**（同片1/片2 口径）：本片无 Figma 读取通道（无 token/MCP；`figma.com/design/ot5SBoqhKAw2UIZRVFzhel` 公开访问为登录墙）。施工对照=READY-FOR-DEV-20261015（§2 令牌／§3 组件／§4 态规则／§6 写死）＋片0/片1/片2 已合部工艺。若帧面与本片有出入，以产品侧对照 Ready 结论为准，本片听裁。
2. **共享件断点副作用**：商家端=单一组件树+CSS 断点互斥（无独立手机页）。A6 手机五槽 VI 对齐所涉共享件（DashboardPage/FinancePage/SettingsPage 等）令牌化在桌面断点同帧生效——**仅色值层面（禁色→令牌），布局/密度/IA 零触**；W-01 驾驶舱桌面／W-13 报表桌面／W-15 设置桌面内容脸属片0壳/片4令围，本片未做布局性改动，提请知悉。
3. **深棕收敛方向**：员工端片0 注「--ink-deep 原 #2E2318 与 --ink 同收敛为 body #2C2822（Ready §2.1 无更深档）」；本片收银族深棕徽章 `#2E2318/#3B2E24` 同族收敛 `bg-ink`，live 签字色 `#F2DFA6→cream`——与员工端 livetag 同族。
4. **未装配旧件**：`components/dashboard/StatCards.tsx/TodoSection.tsx/TodayTimeline.tsx` 未被 DashboardPage 装配（u3 旧件保留口径），按片2「不留死代码≠拆既有回滚」未动；其中 StatCards/TodoSection 残留旧淡金字面量，如需清账请另令。
5. **dock「我的」暂驻 /settings**：READY 五槽帧 203:5480「我的」与现网路由 /settings 的映射维持片0 壳口径（`wnav.dockMe` 端口运行值=「设置」，片0 已报备），本片未翻壳层裁量。
6. **PayChips 命名**：READY §3 组件表「Folio + PayChips + Redline」中 PayChips 在码内=PaySheet 支付段 chips 族（现金/微信/支付宝/储值/回馈金/挂账，含次卡），非独立命名件；明面在场零触。
7. **等宽轨**：金额/单号/时刻现网=JetBrains Mono（tokens.ts/preset 既有），READY §2.2 所书 IBM Plex Mono 未进本片（字体轨换代属令牌层另口）。
8. **lint 存量**：47 错 5 警全为 react-compiler/react-refresh/no-fallthrough/no-irregular-whitespace 规则族旧逻辑件（片外 52 旗标）；本片 diff 逐 hunk 机器交叉核对片内 0——不自作主张修旧件（修=他片令围）。
