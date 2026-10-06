# 卷宗 · 商家端大批 片 5（批内末片：会员营销+报表+分账设计稿）

> 令=开工令-产品-1006-商家端大批片5.md ｜ 任务书=冻结版 V1.0 ｜ 附件=片 0 盘点表 ｜ 基线=叠片 4 尖 9afa63cf（本地 f3ac0a5 同树）｜ 分支 `feat/merchant-chain-5` ｜ 施工=A 窗 2026-10-06 ｜ PR 只开不合｜ **末片=批齐**。

## 一、施工总账（22 文件，+6627/−415；迁移 0057/0058 均幂等）

### 会员营销域
- **会员标签**：member_tags（猫狗/体型/偏好三类，同店同人同类唯一；tagSet 覆盖写+tagList 按类值筛；e2e 82.1）；
- **优惠券类型矩阵六类**：coupons+coupon_type（register|recharge|consume|birthday|festival|wakeup；couponCreate/couponList；券基座=登记制不接真抵扣照案）+**定向发放台账** coupon_campaigns（目标=本店客户集[预约∪次卡∪消费∪卡办]×标签类值滤；grants 批次落行 claimed+配额核+同人同券幂等不发二遍；e2e 82.2 人群匹配精确）；
- **生日营销**：birthdayBoard（**台账+通知落行不造假发**=开口项 2 裁：生日类 perk grants 台账[本店客户集]+近 30 天提醒名单[会员/宠物双源 MM-DD 照 sweep 口径]+birthday_perk_tier 配置面透出；既有 sweep 真发机制保留照案）；
- **活动配置**：promo_campaigns（满减/折扣/第二件/换购/时段促销五型+rulesJson+排期起止；**排期状态机懒算**=draft/scheduled/active/ended（promoEffectiveStatus 纯函数；e2e 82.4 当日件 active/未来件 scheduled）；**不接真结算真折扣计算**=开口项 1 裁）；
- **促销互斥·叠加规则逐项开关**：service_rules 键组 promo_stack_campaign_coupon/campaign_member/multi_campaign 注册+seed 补种+promoStackRules 公示读口（券×会员已有 coupon_stack_rule 单条照案）。

### 报表子域
- **周报/月报自动汇总**：report.weeklySummary（周一起算本周 vs 上周环比，byDay 连续铺洞，无基数 wow=null 诚实态；三视图入参照 widen 地基；e2e 82.6+chain 聚合≥单店对账）；月报=D1-D9/N 系 monthInput 已在照案；
- **商品销量排行·滞销分析**：report.d9TopGoods（orders.items JSON 聚合 qty 降序 top20+滞销=月零销+在库诚实零值；e2e 82.7）；
- **支出费用台账**：expense_records（房租/工资/水电/其他手工台账+月筛选+summary 合计/byType 分列；expenseDelete 仅 owner；**不接发票流**=开口项 3 裁；e2e 82.5 前后值）；
- **历史报表永久留存注记**：report_snapshots 月快照留档（d1/member 两型，owner 建+list 读回，无清理任务注记；e2e 82.8）；
- **会员报表连锁读口**：片 2 地基 widen 已在=已建核销（82.6 chain≥单店断言随片补）。

### 找回两件（片 0 抓账，留痕不碰真钱同族）
- **R3 换货差价补退台账**：exchange_records（原单可空/原商品名/换新商品可空/差价 diffFen[正=补收 负=退差]；状态机 applied→confirmed→settled；e2e 82.9）；
- **R4 退货待检质检分支**：return_inspections（**待检=台账标记层——不动既有直回可售链与 R12② 断言**；合格=标记清 / 不合格=failed+报损扣减[products.stock 前后值+stock_movements source=inspection_fail 留痕]；e2e 82.10 前后值精确）。

### 分账设计稿（老板本人闸，**只出稿不落码**）
- `design/01-跨店消费结算-D+1-设计稿.md` / `02-办卡归属结算-销售分账-设计稿.md` / `03-资金归集-设计稿.md`——三件各含：口径（算账 vs 清结算分离）+数据结构（留痕形状）+报表形状+合规红线+待老板本人裁定项；**入卷不入码**（仓内零代码零迁移零 schema 触及）。

### commission 历史时序多店语义（片 2 意见书 §三候裁件照执）
- `loadRuleHistory(d, storeId?)`：**读口按店域收窄**（历史行仅{总部行∪该店覆盖行}，他店覆盖行不入算）+**历史快照不溯**（时序行按 effective_from 取当时值，未来覆盖行天然不进入生效前月份）；computeMonth 调用点传本店；e2e 82.11。

## 二、申报件汇总

1. 迁移 **0057**（coupons+coupon_type+七新表[member_tags/coupon_campaigns/promo_campaigns/expense_records/exchange_records/return_inspections/report_snapshots]+service_rules 四键）+**0058**（copy 键 257 枚注册=脚本生成+INSERT 计数断言==257 ✓；生成件 copySeedRows 3601 行同帧；trf/inv 47 行=排序位移排除不重复注册）；
2. e2e 族 82 新增（12 组断言；既有断言零删改）；56.1/76.3 计数 3345→3602（域 69→70：merchant:marketing 新域）同步；
3. **屏名字典补录**（改口径=改表随批申报）：merchant:/cashier/receipt/:billNo+/ledger+/inventory+/transfers+/marketing+/marketing-ledger 六条（归屏率回 97.0%>90% 军规线，未归屏 108/3602=3.0%）；
4. **R11a① 扫描器口径细化二**（结构转正件申报：marketing.exchange*=换货台账合法件入白名单，互转红线口径不变）；
5. seed.ts service_rules 补种四键（重置后存续）；
6. 新路由 2 个 nav 双表申报（/marketing、/marketing-ledger；124 路由/108 冒烟；rail 十九口冻结不改=页面互链+ConsolePage C4 直达卡）。

## 三、闸门（2026-10-06 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（根目录单命令） | exit 0 | gate-build.log |
| server typecheck | 0 | gate-e2e-full.log 头行 |
| e2e 全量 | **全链路验收全部通过 ✅**（862 断言：族 82 十二组全绿；78/79/80/81 不回退；56.1 3602 键/70 域；76.1 归屏率 97.0%>90%；76.4 未归屏 3.0%<10% 军规线） | gate-e2e-full.log |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6**（新路由 2 申报） | nav-closure-124.json + gate-nav-closure.log |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 实尺截图 4 帧 | 会员营销五区（券矩阵六类+定向发放 1 份+生日档位+活动配置）/营销台账四区/周报环比徽/D9 排行滞销——逐屏目检已做 | 01-04-*.png |

## 四、红线自查

零新依赖 / 禁令新增行命中=0 / 行尾 LF / 迁移幂等 / 多句 INSERT 迁移=脚本生成+计数断言（0058=257 ✓）/ 活动引擎=配置台账+排期留痕不接真结算 / 生日营销=台账+通知落行不造假发 / 支出=手工台账不接发票流 / 找回两件=留痕不碰真钱 / **分账三件=只出稿不落码**（仓内零代码触及，老板本人过目后才许落码）/ 隔离族不回退（82.12 抽查绿）/ 收摊必净（TaskStop×4+netstat 复核+taskkill 补刀 PID 10884/58476/36780/60592 子树→ALL_CLEAR）。

## 五、环境件登记

- 探针备数=API 正规通路（标签三行/生日券+充值券/定向发放 vip/满减活动/支出两笔/换货一笔/待检一笔，dev 库明面登记）；
- 屏名字典补录后 trf/inv/mk 全部归屏；mk 快照 member 型 payload=report.d3MemberGrowth（口径注记，候产品侧复核）。

— A 窗（施工方）2026-10-06 深夜
