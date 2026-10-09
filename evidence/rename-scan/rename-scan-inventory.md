# 盘点表 · 微光正名批 片 0（盘点核销 · 只读零代码）

> 令=开工令-产品-1009-微光正名批片0.md ｜ 任务书=冻结版 V1.0（老板 10-09 签）｜ 纪律-PM-1008+红区补丁（纪律-PM-1009，A⑧硬句照走：口头零效力/PR 只开不合不反解/不写「验收通过」）｜ 基线=main 现尖 6c583f70（全批+急修+三缺陷全合部）｜ 档位=K3·High｜ 本片=只读+文档产出，零代码改动｜ 施工=A 窗 2026-10-09。

## 一、核销清单划线（任务书 §一核销区，码内+卷宗实证在案，已建不施工）

| # | 核销件 | 码内实证（main 现尖） | 卷宗指针 |
|---|---|---|---|
| 1 | 更名扫面（微光→注册用户） | 码内 grep「微光」=0（判留=已部署迁移 0023/0024/0027/0068 仓行留档军规不动）；copySeedRows/seed.ts=0；`card.freePrice=免费`/`claimWeiguang=在册即享基础功能` 在码 | evidence/member-link-3（rename-zero-residual.txt 三通道） |
| 2 | 建档不限 | seed.ts:504 plan_weiguang included_pets/max_pets=100、extra=0；「建档不限」码内 7 处（plans.tsx 免费档分支+两键） | 同上（89.2 断言） |
| 3 | 永久正名 | copy.ts 四键（j1.alreadyMemberFree/rules.r3Free/chg.freeNote/me.freeValidityValue+Note）在码；数据层 2099 不动 | 同上 |
| 4 | 券全员可领可用 | mall.ts couponTemplates(public)/couponClaim/availableCoupons/couponUse 零档闸（只闸券状态/配额/本人）——券引擎零改动实证在案 | 同上（89.3 全链） |
| 5 | 预约提前 7/14 | seed.ts 504-507：注册 7/萤火·烛光·暖阳 14；appointment.ts:151 maxAdvanceMsOf 兜底=7 | 同上（89.4+67.5 随改） |
| 6 | 升级死路（收银台） | MembershipPanel upgradeAvailable 免费档同亮（L150-181）；87 族在码 | evidence/member-link-1 |
| 7 | 入口断链 | MePage:144 me.cardOpenCta/ cardRenewCta 按档分化；MemberOpenPage paidMember 直达（L97/208）+compare-cta 行内 CTA | evidence/member-link-2 |
| 8 | mock 四态 | 88.4 族在码（fail/timeout/drop+reconcile） | 同上 |
| 9 | 错误人话化 | 87.3 在码（代码标识永不上屏+撤牌两键出读口） | evidence/member-link-1 |
| 10 | 画布预览（首页+收银营销位） | canvasPreviewUrl.ts 四轨在码（路径/端口/dev/Host；端口轨=急修 1008）；**memberCenter 会员中心页签=本批 A 股待修（403 面见 §四）** | evidence/prod-hotfix-1008 |
| 11 | smoke 夹具 | smoke-deploy.mjs:738-746 读端口值动态算（yhExpectFen），真绿在案 | evidence/prod-hotfix-1008 |

**划线结论：11 件全已建，零重复施工。**

## 二、正名残留扫面（片 0 §一.2）

### 2.1 「开通」动作残留（openFree 一键开档面）

| 位 | 现状 | 判定 |
|---|---|---|
| MemberOpenPage 免费档卡 CTA（j1.ctaOpenFree「免费注册 · 领个身份」→ openFreeM） | 注册即在册后，注册用户点=openFree 幂等（toast「你已是会员」） | **退位候选（片 1 C 股 1）**：注册用户态 CTA 改「当前档」注记不动作（同 compare 行既有口径）；openFree 端点留（异常面兜底：注销重申/纯新客罕见路径幂等无害） |
| MemberOpenPage 对比弹层免费行（j1.compareRowFreeCta「免费开通」） | 注册用户已是=「当前档」注记已在（片 2③） | 留（已是退位口径） |
| checkout.freePlanBody/freePlanCta（免费档误入选档出口） | 误入选档的明示出口 | 留（防死路件） |
| home.idJoin「免费领个身份 ›」（首页非会员引导） | 非会员罕见（注册即在册） | 留（幂等兜底；话术候选改「开通会员 ›」候产品裁） |
| q1.nonMemberGuide / up.nonMemberBody（「一键开通」话术两处） | 非会员引导文案 | 留（异常面兜底话术） |
| server openFree/openFreeMembershipCore | 三处同调内核（自助/微信/手动） | 留（落档内核=注册即落档同函数，永不动） |

### 2.2 「归属」三通道全量（grep 底表，改/留逐件判）

码内 ts/tsx 命中 241，分类：**双归属 17（留=连锁账目术语，会员卡 sold_store/消费店双列口径）／归属月份 9（留=财务期间词）／归属校验·归属闸·归属门店 ID（配置行店域作用域）等 193（留=权限/店域术语，与客户归属概念无关）／客户归属语义窄面 21（见下）**。

客户归属语义窄面 21 命中（**改**=B 股话术扫面触及面）：
- `authSecurity.ts:668/720/721/769/770`——申诉「归属店=客户最近消费店」口径族（CJ-1009-06 后=改「记账标签=最近消费店」话术；逻辑面不动）；
- `schema.ts:3062`（phoneAppeals 注释「无归属店」）；
- `e2e.ts:8885`（79.1 断言文案「归属店过滤/无归属店」）；
- `serviceStep.smoke.ts:7/231`（测试文案「客户归属」）；
- `appointment.ts:1758`（注释「预约归属客户」=归属客户语义，顺手类）；
- 其余=同名不同义（待片 1 逐行定稿）。

种子/端口值通道命中 25：copySeedRows「连锁归属/归属月份/差评归属/双归属（次卡售卡店·会员档办卡店）/前台绩效池（本人接待归属）」——**全留**（语义均非客户归属）；seed.ts:421 绩效注释「本人接待归属」=留。**端口值零「客户归属」话术命中**——B 股话术扫面主战场=码内窄面 21 件。

## 三、B 股定位实证（片 0 §一.3，读码坐实）

1. **断点在 forUser 一层**：`membership.forUser`（server/src/routers/membership.ts:672-703）店域闸=目标客户须在店域（预约∪次卡∪消费∪卡办在店域 sold_store_id∈店域）四路判定，全不命中=NOT_FOUND。线上注册客户 sold_store_id=NULL（线上域报备）→ 四路全空=断链（生产亲验在案）。**放行面=该四路判定的补集**：forUser 对客户全池放行读（档位/余额/宠物数=识别+服务通断面）；订单/账目隔离面不动；
2. **检索层本就全池通**：`cashier.searchMember`（cashier.ts:1179+）手机号查零店域闸（found:true 命中全池）——识别第一步不断，断在「识别后读档」forUser；
3. **记账标签触及面**：appointments.storeId／cashier_bills.storeId（接待店=已有列，留痕天然）／memberships.sold_store_id（卡办在店=已有；线上域=NULL=平台件语义正名）——**改造=既有列正名+线上 NULL 语义话术，零新列预期**；报表按店核算读侧（report.ts/chainDashboard/amortizationStats/commission 按 storeId 读）=读标签列同源，随批接通点=文案/注释口径（加性不动既有列，军规一④照办）；
4. **隔离不下移面**：订单/账目/库存/员工绩效按店隔离=原闸零改动（任务书军规一 1 照办）；候选断言面=86.8/87.8 隔离族（D-26 修复后真牙）零回退。

## 四、A 股定位（片 0 §一.4）

1. **403 面清单**：画布注册表页签三键（home/memberCenter/cashierMarketing）中会员态页=**memberCenter 单页**（MemberCenterPage 调 membership.my/mySavings/perk.myUnused 皆 customerProcedure，店主会话 401/403=「会员信息加载失败」，片 4 帧 2 在卷实证）；home=public 面零 403；cashierMarketing=商家端同 App 同源零 403。**画布三页签外的会员态页**（MemberCardPage/MemberRebatePage/MemberUpgradePage/MemberChangePage/MemberOpenPage 同调 membership.my）不在画布注册表=无预览需求，**不入本股**（防范围蔓延）；
2. **示例客户视图数据口径建议**（端口件留口照两问闸）：`?canvasPreview=1` 探针模式下 membership.my 401/403 → 落示例视图=**骨架+示例数据，零真会话零写库**——示例档=端口件指定（建议=萤火=最常见付费档，读 member_plans 端口取档名/权益表述，金额=档价端口值），回馈金余额=0（挂零引导行同既有口径），有效期=示例文案「开通日起 365 天」；**示例水印**（军规一 2：「预览示例」角标，防误导店主以为真数据）；点选反查/改文案/发布链路不动（画布 patch 通道只碰块显隐/文案键，与数据面无关）。

## 五、登记

- 本片零代码改动（盘点片只读）；
- 开口项候裁（片 1 放令前产品侧定）：①openFree CTA 退位口径（§2.1 首行候选）；②示例档默认=萤火（§四.2 建议）；③「客户归属」窄面 21 件逐行定稿在片 1 施工单内做；
- 观察项：客户档案读取粒度（店员识别后可读到哪层）=任务书已列观察项不并批，本片登记不展开。

— A 窗（施工方，角色卡⑧ V2.2+红区补丁）2026-10-09
