# 卷宗 · design-s4-member-mine（产品-1015 换皮 · 片4-运营商城）

- **对象**：A1 W-09 商城订单／W-10 商品／W-11 会员·次卡（READY `203:917`／`203:1284`／`203:1688`）；A2 W-12 员工／W-13 报表／W-14 权限矩阵（`203:2354`／`203:2725`／`203:3067`）；A3 W-15 门店设置／W-16 运营后台端（`203:3739`／`203:4047`）；A4 客户端商城／PHILIA／回馈金表面（`187:2`／`188:2`／`188:111`／`189:2`／`189:56`／`189:104`）；A5 员工余屏表面 S-05~S-12（`203:4787`／`203:4852`／`203:4917`／`203:5611`／`203:5663`／`203:5720`／`203:5776`／`203:5821`）。
- **分支／基线**：`feat/design-s4-member-mine` ＠ 基线生产 main@`be3293eaa58f52e4ce8fd7a1825d21f8fdca1869`
- **施工方**：A 窗（Kimi Code · 角色卡⑧ · 已用 K3 MAX）· 2026-10-16 Asia/Shanghai · 弃脏重建会话（旧窗「废-片4串台」回执一律不认）· 换路A续跑
- **实证环境**：本片 server :7242（本片独立库 `E:\KIMI_tmp\s4-member-mine\face.db`，跑前 db:migrate+db:seed 复位）＋ 三端 preview :7163/:7164/:7165（本片分支构建产物，`VITE_API_BASE=http://localhost:7242` 构建期烘入）；headless Edge CDP :9242–9244；视口桌面 1440×900／手机 390×844 mobile 实尺（deviceScaleFactor:1）。
- **错口纪律**：在跑的他窗栈未碰——7100-7112/7150-7152/7160-7162/7200-7201/7231/7241/9223-9241 全程零触碰；本片只用 7163-7165/7242/9242-9244。
- **画布/锚点纪律**：全部既有 `data-testid`、路由、接口、交互链路零改动；**服务端改动白名单**＝端口轻批令围内三件：迁移 0086（slot 4 增+copy 21 增，幂等）＋ `slotSeedRows.ts`/`seed.ts`（D-42 三行随种子同帧）＋ `copySeedRows.ts`（生成件重跑）。
- **端口轻批（令围写死）**：批 C 杂志 `philia.magazine.lead/.02/.03` 三槽（选题卡内容端口，壳写死）；批 D `mall.hero` 促销横幅槽＋新品角标（`mall.badgeNew`，createdAt 14 天视窗+每屏帽 2 签，不含真券）；A4 半端口=类目 chip 展示名 6 键（查询值码内枚举写死）＋我的标签兜底 `me.tagGuest`；回馈金 hint＝既有键本片只核不增（口径不扩）。W-15/W-16 端口已有零新键。

## 一、shots/（实尺廿四帧 · 全绿 · 真链路驱动）

| 文件 | 对应帧 | 驱动方式（不画假态） |
|---|---|---|
| d01-w09-orders.png | W-09 商城订单 `203:917` | 客户商城真下单（pickup）→ pay.createOrder+mock-callback 真支付（既有演示链路）→ /orders 待发货真行（示例客户 ¥129）；回馈金抵扣列真值注记明面 |
| d02-w10-products.png | W-10 商品 `203:1284` | 种子商品 13 行台账（在售/低库存胶囊、成本列 owner 视界真值） |
| d03-w11-pass.png | W-11 会员·次卡 `203:1688` | 预约前置（次日早班窗，当日尾盘撞打烊闸改约）→ 店主 pass.topUp 真售卡 10 次 → 台账真行+扣次流水+M3 次数包真值 |
| d04-w12-staff.png | W-12 员工 `203:2354` | 种子员工 4 行（角色 pill2 双态、排班摘要、考勤在班态真值）+ 权限口径卡（/matrix 链） |
| d05-w13-finance.png | W-13 报表总览 `203:2725` | 收银 settle 真结一单 ¥68 → 今日已收真值卡+期间 chips |
| d06-w13-report-d1.png | W-13 报表详情 `203:2725` 族 | /finance/report/d1 当月真表（周报/月份/单店·分店·合计三视图在场） |
| d07-w14-matrix.png | W-14 权限矩阵 `203:3067` | 静态四态只读矩阵+锁死区红胶囊（密度临界走测优先口径在案） |
| d08-w15-settings.png | W-15 门店设置 `203:3739` | 门店档案表单（名称/营业时间真值） |
| d09-w16-console.png | W-16 运营后台端 `203:4047` | 端口目录 15 口；展示名「运营后台端」不回退（PD-25 已合） |
| c01-philia-magazine.png | PHILIA·杂志 `187:2` | 批C 三槽内容真读：封面主打（渐变占位+主副题+读本期滚动到条目列）+条目两卡+PGC 口径注；**非开放 Feed**（无发帖器/点赞评论/无限流） |
| c02-mall-home.png | 商城·首页 `188:2` | 批D mall.hero 槽位横幅（渐变占位+主副题+去看看滚动到商品流）+类目 chip 端口展示名+新品角标 violet（帽 2 签）+回馈金 hint 既有键+快加购 brand-cta 令牌 |
| c03-mall-cart.png | 商城·购物车 `189:2` | 真点快加购 → 购物袋真行+全选合计+「本单返 ¥x 回馈金」返显 sub（**可抵未建=现网无抵扣通道诚实现状**，见 §五.3） |
| c04-mall-checkout.png | 商城·结算 `189:56` | 结算费用明细白卡+配送方式+提交闸（返显 sub 同口径） |
| c05-mall-product.png | 商城·详情 `188:111` | 图轮播+名价 mono+回馈金返显卡+吸底 CTA（brand-cta 令牌） |
| c06-me.png | 我的 `189:104` | 山姆骨架身份大卡（VI brand 渐变收敛）+档签（无档=me.tagGuest 端口兜底「菲丽亚宠友」）+回馈金格+白 qrrow 顶码行+订单五格+grid8 |
| c07-member-rebate.png | 回馈金账本（A4 回馈金表面） | /member/rebate 真余额环+规则明面（口径零触） |
| s05-pay.png | S-05 提成 `203:4787` | 真汇总表面+口径注（规则零触；弹层令牌换代） |
| s06-xp.png | S-06 XP `203:4852` | 段位五段条+事件流（规则 server 下发渲染零触） |
| s07-reviews.png | S-07 评价 `203:4917` | trio+评价卡（骨架令牌族） |
| s08-inventory.png | S-08 盘点列表 `203:5611` | 店主 assignCount 盲盘 → 员工真任务行（draft 金点） |
| s09-inventory-count.png | S-09 盘点录入 `203:5663` | 盲盘录入卡 13 行项（不透账面口径明面） |
| s10-boarding-checkin.png | S-10 寄养打卡 `203:5720` | 寄养单 create→confirm→人工码 checkin → in_boarding 真在店（旺财 10/16→10/17）；六件令牌换代后首帧 |
| s11-manager.png | S-11 补卡审批 `203:5776` | 种子无店长角色员工 → 非店长引导卡诚实态（smoke 同口径，见 §五.7） |
| s12-schedule-past.png | S-12 切日历史 `203:5821` | G1「昨天」chip 真点 → 切日态班轴+班结行 |

截图脚本：`apps/merchant|customer|staff/scripts/s4-member-mine-shots.mjs`（零新依赖 CDP 实证器：真登录/真下单/真支付（mock 演示链路）/真售卡/真结单/真派盘/真在店取景，可复跑）；运行日志见 `gates/s4-shots-merchant|customer|staff.log`（廿四帧全绿，exit=0）。

**shots-baseline/**（廿四帧 · 施工前同机位基线）：同脚本同库种在基线 tip（stash 施工改动后）跑批；新面（c01 杂志/c02 hero/新品角标）基线=旧面同机位帧（c01=旧 F-01 陪伴页、c02=无 hero 旧商城）＋新锚点红=预期（新面基线无对应 testid），对照明面不掺假。

## 二、gates/（闸门实证 · 全部零回退）

| 文件 | 闸门 | 结果 |
|---|---|---|
| `build-3apps.log` | 根 `npm run build`（三端 tsc+vite，`VITE_API_BASE=http://localhost:7242`） | ✅ exit=0 |
| `server-typecheck.log` | server `tsc --noEmit`（本片 server 改动白名单三件，照跑自证） | ✅ exit=0 |
| `server-e2e.log` | server `test:e2e`（API 级全链路；迁移 0086 随 e2e 临时库实跑） | ✅ 断言全绿（含 107 族 CJ-1015-02 键值、种子库原样、7200 无残留）；**1 项失败=收尾清理 EPERM**（e2e.ts:12534 临时库目录 rm——脚本自述「Windows libsql 句柄滞后，可手工删」环境件，非断言失败非回退；temp 已手工删，复跑同点位确定性复现） |
| `smoke-routes.log` / `.json` | 三端构建产物路由级冒烟 | ✅ **117/117** 通过，exit=0（110+本片双表申报 7 新锚：merchant /orders /products /staff /finance /settings；customer /philia /me） |
| `check-nav-closure.log` / `.json` | 导航闭环体检 | ✅ 126 路由 · 死胡同 0 · 弱 0 · 豁免 6，exit=0（既有覆盖零改；/philia 杂志面四要素齐） |
| `e2e-nav-check.log` | 真点击导航实证（成功页四要素/选宠弹层/tab 保状态/底栏 PHILIA 标签） | ✅ 全绿，exit=0 |
| `s4-shots-merchant.log` / `-customer.log` / `-staff.log` | 本片三端实尺截图脚本运行归档 | ✅ 廿四帧全绿，exit=0 |
| `lint-customer.log` / `-merchant.log` / `-staff.log` + `lint-crosscheck.log` | `eslint .`（非令列闸门，自查项） | ⚠️ 存量 customer 74 错 4 警／merchant 47 错 5 警／staff 28 错 2 警（react-compiler/react-refresh 规则族旧逻辑件）；机器交叉核对（旗标行 ∩ 本片 diff hunk @be3293ea）：**片内 0／片外 160——本片零新增** |

## 三、令围落点（A1→A5 同片序照令）

- **A1 · W-09~W-11**：OrdersPage/OrderCard/ProductsPage/PassPage 旧墨 alpha 基底换代 `rgba(59,46,36,x)→rgba(44,40,34,x)`（4+5+19+19 处）；mall-admin/ui（danger 纸色字→bg-card）与 staff-admin/ui（danger/Switch 圆点/Modal/Empty 面板 bg-card 收敛、focus 环/开关墨基换代、头注同步）两套基件令牌收敛（W-10~W-12/W-15/W-16 弹层表单同源受惠）；PassPage 扣次深墨点 #2E2318→body #2C2822（片0/片3 深棕收敛同族），**档色点/档色谱保留**（档色即身份，非旧雾感四值，见 §五.11）；回馈金抵扣列/口径注、三队列 chips、CSV 导入、批量网格、售卡/充次链路零触。
- **A2 · W-12~W-14**：StaffPage 14 处换代+头像底归 sunken（READY §2.1 头像底档）；EditStaff/ExitHandoff/ScheduleEditor 三弹层 focus 环/纸面底换代（1+2+2 处）；ReportPage 45 处换代（含 SVG 图柱/条形图墨基）；MatrixPage 核档=已对齐零改；权限矩阵规则 PIN 零触；FinancePage 核档=片3 已对齐零改。
- **A3 · W-15~W-16**：SettingsPage 核档=片3 已对齐（staff-admin/ui 收敛后开关/空态同帧）；ConsolePage/ConsoleSearch（7+8 处）+ 直嵌内核十件（CanvasPortBody/CarePackPortBody/ConfigDictBody/CopyConfigPage/CorrectionBody/PayChannelPortBody/ProfilePortBody/RecycleBinBody/RulesConfigPage/SlotPortPage 共 160 处换代）；选中态深棕 `bg-[#3B2E24] text-[#FAF8F2]`→`bg-ink text-canvas`（6 处）；空态纸面 `bg-[#FFFDF6]`→`bg-card`（4 处）；未归屏注旧淡金 rgba(242,223,166,.18)→brand-primary-light；**展示名「运营后台端」零触不回退**；15 口元数据/角色闸门三件套/owner 硬闸零触。
- **A4 · 客商城/PHILIA/回馈金**：PHILIA 换面=PGC 杂志（187:2 对照；批C 三槽内容端口+mag.* 壳键 10 枚；旧 F-01 陪伴页退役，见 §五.2）；MallPage 加 mall.hero 槽位横幅+类目 chip 展示名端口（查询值写死）+新品角标（双闸：14 天视窗×序位帽 2）+快加购 brand-cta；PDP/Cart/Checkout 主 CTA `#2E2318`→brand-cta 令牌（5 处）、渐出底 #FAF8F2→canvas（3 处）、价字归 ink；MePage 档签兜底 `me.tagGuest`+头像字色收敛；home-v2.css me2 族（hero 渐变→brand→pressed、qrrow 白卡、五格/网格墨基换代、档签旧淡金→cream）；member-v2.css 变量收敛（paper/v2ink/ink-deep/line/gold→READY §2.1 档，见 §五.6）；回馈金表面（MemberRebatePage SVG 字、plans.tsx 3 处、MemberOpenPage 微光档边）换代，**机制口径零触**。
- **A5 · S-05~S-12 表面**：S-10 寄养打卡六件（BoardingPetCard/CheckinForm/DailyLogForm/DailyLogList/StayInfoCard/PetHeader）旧墨 alpha 换代 18 处+墨底选中反白 text-canvas；S-05 AppealModal/S-06 XpAppModal 弹层 6 处换代（遮罩/虚线框/次钮）；S-07/S-08/S-09/S-11/S-12 核档=骨架令牌族已对齐零改；**提成/XP/评价/盘点规则 PIN 零触**（数值 server 下发渲染原样）；u1-card 类本体=片0 已令牌化零触；片2 屏（S-00~S-04/执行/考勤/排班）零触。

## 四、红线自报（零触）

- 钱权／L2-②／回馈比例深改／日盘门槛／服务时长／监控 45 分阈值（PIN 灰区）：零触。
- 回馈金机制口径（购可得/可抵/支付后再得）：零扩——earn 返显既有键原样；**未建抵扣 UI/数据口**（现网无抵扣通道=恒 0 诚实现状，通道=另闸，见 §五.3）。
- 不做开放 Feed：PHILIA=PGC 杂志三槽策展（无发帖器/点赞评论/无限流/UGC 任何件）。
- 提成/XP 规则 PIN：零触（表面令牌换代 only）。
- 权限矩阵/退款/日结/收银/店间隔离/Rail 十五口/手机五槽/支付结算：写死项零触。
- 运营后台展示名：零触不回退（PD-25「运营后台端」明面）。
- 零新依赖（package\*.json/lock 零改动）；**新迁移=0086 一号**（幂等双跑实证；已部署迁移永不重写）；server 改动=端口白名单三件。
- icon 库全量／真图终摄／判美／IA 重做／片0·1·2·3 范围／选品系统任何目录：非目标未触。
- A 窗禁合禁部：PR 只开不合；未点「完成/完成任务/归档/中断」；勿碰 CJ「读取 Philia 施工文件」与选品系统及片0/1/2/3 会话栈。

## 五、边界与报备（提请产品侧知悉，不擅自扩）

1. **Figma 帧不可直读**（同片1/片2/片3 口径）：本片无 Figma 读取通道（无 token/MCP；`figma.com/design/ot5SBoqhKAw2UIZRVFzhel` 公开访问为登录墙）。施工对照=READY-FOR-DEV-20261015（§2 令牌／§3 组件／§4 态规则／§6 写死）＋片0/片1/片2/片3 已合部工艺。若帧面与本片有出入，以产品侧对照 Ready 结论为准，本片听裁。
2. **PHILIA 旧 F-01 陪伴页退役**：/philia 归位主级 Tab 常规页（旧 fixed 全屏 dialog+下滑关闭手势+关闭钮退役，dock 明面）；旧画布块 philia.header…diary 九行**注册表保留未删**（服务端内容，画布端口三屏页签本不含 philia；清册另批）；`f1.*` copy 键留端口库（调用点退役，生成器如实标未归屏；全库未归屏率 149/4299=3.5%，军规线 <10%）；`home.panelEntryTitle/Sub` 两键归屏注由「客户·Philia 爪」变 null（生成器归因 HomeBookingPanel 现仅首页引用；键值/运行零影响）；/philia/pets、/philia/moments、/philia/certs 子路由零触可达；HomeBookingPanel/PhotoWall 等共享件在首页/他页在役零触，未留死代码。
3. **回馈金「可抵」未建**：READY 帧 189:2 注「可抵」，但现网结算无抵扣通道（OrdersPage 注记「恒 0 是诚实现状，通道开通即自动有值」在案）；本片守「口径不扩」未建抵扣 UI/数据口/任何新键——通道=钱权另闸，提请产品侧排期。
4. **新品角标数据源**：listProducts 全列直出 createdAt（`.select()` 全列既有），**零服务端改动**；判据=14 天视窗+每屏帽 2 签（列表=server createdAt 倒序）守 violet ≤10%；「热销/门店同款」角标无真源（SKU 经营面/销量口径=另批，核对表行 10 留口报备）。
5. **mall.hero 未入画布块注册表**：mall 块序现不在画布端口三屏页签（home/memberCenter/cashierMarketing）——按「壳写死、内容端口化」直渲于页头后，内容发布走 A5 槽流（mall.hero 槽含 D-42 三行+图，owner 可换/可回退）；如需画布拖排/显隐另批。
6. **member-v2.css 变量收敛**（paper/v2ink/ink-deep/v2line/v2line-soft/gold/gold-deep→READY §2.1 档）：.m2 作用域会员区整族页（设置族/券/会员中心/开通页等**超出 A4 帧清单者**）同帧生效——**仅色值层面，布局/密度/IA 零触**（片3 A6 同族先例）；home-v2.css 仅 me2 族受改，hv2（片1 首页）零触。
7. **S-11 补卡审批实证=非店长引导卡诚实态**：种子无店长角色员工（invite 仅 frontdesk/groomer），审批动作面 owner|manager 方可渲染——与 smoke-routes /manager 锚点同口径；审批面令牌族=S-11 页内既有骨架件（本片零改）。
8. **server e2e 收尾清理 EPERM**：临时库目录 rm 权限失败（e2e.ts:12534，脚本自述「Windows libsql 句柄滞后，可手工删」）；266 断言全绿、复跑同点位确定性复现=环境件非回退；temp 已手工删。是否把清理改容错（warn 不 fail）属闸门脚本本体，未自作主张改，提请知悉。
9. **merchant 未触清单（片外旧色存量，留账另批）**：BoardingStayCard/BoardingStayDetail（W-05 片3 域）、amortization.tsx（W-01/W-07 片3 域，「属别批文件，不动」注记在案）、OpsPage/PayrollPage/LedgerPage/InventoryPage/MarketingPage/AnnouncementsPage/TaskTemplatesPage/ScheduleManagePage/TransfersPage/XpAdminPage/MarketingLedgerPage/ReceiptPage/CashierRecordsPage（非 W-09~W-16 屏）、dashboard 三件未装配旧件（片3 保留口径）——本片零触；customer 侧 MallOrdersPage/CouponsPage/退款族（非 A4 帧清单）同口径零触。
10. **档色点/档色谱保留**：PLAN_TIER_COLOR（#FBF6EA/#F2DFA6/#A08B62/#34271C）=档色即身份（客户端 1.0 定稿 §1.3），非旧雾感四值、READY §2.1 未定义档色档——保留未动，若产品另有档色令牌口径听裁。
11. **双表申报**：smoke-routes +7 锚点行（merchant /orders /products /staff /finance /settings；customer /philia /me——本片换面屏静态路由，非新路由）；check-nav-closure 既有覆盖零改；动态路由（/mall/product/:id、/inventory/:id、/boarding/:id/checkin）由本片 shots 实证覆盖。
12. **等宽轨**：金额/单号/时刻=JetBrains Mono（tokens 既有），READY §2.2 所书 IBM Plex Mono 未进本片（字体轨换代属令牌层另口，同片3 报备）。
13. **lint 存量**：customer 74/4、merchant 47/5、staff 28/2 全为 react-compiler/react-refresh 规则族旧逻辑件（片外 160 旗标）；本片 diff 逐 hunk 机器交叉核对片内 0——不自作主张修旧件（修=他片令围）。
