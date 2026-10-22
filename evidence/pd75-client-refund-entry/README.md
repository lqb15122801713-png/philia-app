# 卷宗 · PD-75-client-refund-entry（A窗 · 点验件，非验收）

> 基线 main@b401f9e（b401f9eed6334f9f1118e6ad06a4806164b023b9）· 分支 feat/pd75-client-refund-entry · K3 MAX · 2026-10-22
> 迁移独占 **0116**（idx 116，`server/drizzle/0116_pd75_client_refund_entry.sql`，copy 域 3 增 14 改，零 schema 变更；0114/0115 让予 PD-73/74）

## 验收口径逐条点验

| # | 断言 | 证据 | 状态 |
|---|---|---|---|
| 1 | 自造商城 mock 单→订单详情可见订单信息（单号/件数/金额/自提）＋退款或取消入口 | shots/015（shipped 单 P261022D443WD：单号/共3件/¥377/自提/退款售后 ›）、shots/017（pending 单 P261022S9RKNB：取消入口） | 已点验 |
| 2 | mock 退款/取消提交后状态变更可读；夹具 P2610223GZ7SV/P261022KKT4J9 保留禁撤（本库零触碰）；退款验证只用本窗自造 mock 单 | shots/016（退款详情 审核中 RR-20261022-001 ¥377）、shots/018（取消后 已取消 签） | 已点验 |
| 3 | 预约未开始/已取消时首页不显示「服务进行中」 | shots/003a（in_service 但明日始＝未开始：无面板）、shots/003b（cancelled：无面板）；守卫=HomePage inServiceAppt 加 status+scheduledStart≤now | 已点验 |
| 4 | 收银台件数/金额＝确认单 | shots/013（确认单 3件 ¥377）＋ shots/013b（收银台 订单P261022D443WD 共3件 ¥377） | 已点验 |
| 5 | 余额 0 抵扣默认关 | shots/012（使用回馈金 开关关+禁用，余额¥0·本单抵¥0）；元素态 switch=disabled/unchecked | 已点验 |
| 6 | 登录页 rg 不命中 seed/userId/db:seed/角色英文枚举 | shots/001（hero+口令登录 ›）＋ shots/004（选择演示账号登录/角色中文/账号 ID 登录）；DOM 全文快照零命中（含「内测口令」撤为「访问口令」） | 已点验 |
| 7 | 现有门店地址与导航坐标一致（禁第二店造种） | seed 坐标 120.1315→120.1489 / 30.275→30.2812（文三路100号=文锦大厦，近马塍路/保俶北路；旧值落文三路中段跑偏约1.6km）；取值链=stores 行 →appointment.get →AppointmentDetailPage navLinks（hasGeo→高德/腾讯 marker 直链）；e2e 100.3 绿；单店零新增 | 已点验（取值链说明件） |
| 8 | 观感交盲测 | — | 不在本窗判定 |

## 同簇 P0：疫苗闸 server 拒确认（AE-CLIENT-R3-01）

- server `assertBoardingVaccine()`：create 寄养分支 + confirm 寄养分支双闸；无苗/临期（vaccineValidUntil < 退房本地日 +8）→ 400 明文。
- 直证：vaccine-gate-api.md（curl 400 原文）；e2e 67.7 双向（覆盖可下 confirmed + 无苗 BAD_REQUEST）绿。

## 带/同窗项落点

- HP-CLIENT-03 浮底栏遮挡：机制本批已在位（全局 main pb-24＋booking-with-dock 上抬 confirm bar 78px＋gs-time-grid 滚动安全区）；shots/002/003a 帧见 dock 不遮内容。零代码改动（防回退 PD-67/68 底栏）。
- HP-CLIENT-06 服务过程：删「入口来自预约成功「查看服务过程」」溯源句；serviceProcessModel cancelled/cancel_requested 归 not-started（不落「服务进行中」）。
- P-CLIENT-03 自提文案：paySuccessSubPickup（成功页）＋statusWaitPickup（自提 paid 签「待自取」）＋toastPaid 改「备货」中性；成功页自提单改示取货门店、不再渲染空收货信息行（shots/014）。

## 测试

- 全量 e2e（E2E_PORT=7409，run5）：**1043 ✓ / 4 ✗**。4 项均为基线（b401f9e）遗留红，本窗零触其子系统：57.1 槽位种子 live 计数、74.11 到期 cohort 日期钉、77.2 PD-72 自带 wnav.dockMe 文案钉、81.4 效期日期钉（钉 10-28 剩 5 天，今日 10-22＝6）。
- 本窗相关 e2e 全绿：67.7 疫苗闸双向、100.3 演示店坐标、56.1/76.3/98.2 copy 计数钉（4303/73＋去重面 4302；钉随本窗同步并吸收基线漂移）。
- server tsc --noEmit：本窗改动文件零错误（基线遗留 pd66EvidenceFixture.ts 12 错与 PD-66 同源，未动）。
- customer `npm run build`（tsc -b + vite build）：绿。

## touched files（互报 PD-74：本窗未触 server 退款模块，仅客端入口复用既有 refundRequest 链路）

- server：routers/appointment.ts（疫苗闸）、db/seed.ts（门店坐标）、db/schema.ts（注释）、db/copySeedRows.ts（copy 手补 3 增 14 改）、drizzle/0116_*、drizzle/meta/_journal.json（idx 116）、__tests__/e2e.ts（67.7/100.3/计数钉/夹具疫苗字段）
- apps/customer：pages/HomePage.tsx、MallOrderDetailPage.tsx、MallOrdersPage.tsx、CheckoutPage.tsx、CartPage.tsx、DevLoginPage.tsx、components/mall/CashierModal.tsx、components/live/GroomingServiceProcess.tsx、components/live/serviceProcessModel.ts、copy/mall.ts、copy/devlogin.ts、copy/agreements.ts

## 帧索引（shots/）

001 登录 hero（口令登录 ›）· 002 首页基态（无服务进行中，dock 不遮）· 003a/003b 首页两态（未开始/已取消无面板）· 004 登录账号区（演示账号/中文角色/账号 ID）· 012 回馈金0默认关 · 013 确认单件数金额 · 013b 收银台件数金额一致 · 014 支付成功自提文案（无空收货行）· 015 订单详情退款/售后入口 · 016 退款进度可读（审核中）· 017 订单详情取消入口（pending）· 018 取消后已取消可读

## 禁令自查

未动双屏/未抢前台；钱全 mock（演示收银台+mock 物流单号 SF-pd75-mock）；夹具 01M5EQVF 与 P2610223GZ7SV/P261022KKT4J9 零触碰；未删库；未改商家端 UI；未做「待换」素材；客端 R3 非 P0 未扩；PR 只开不合；不写验收通过。
