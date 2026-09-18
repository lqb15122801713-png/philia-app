# 批次 M1 证据卷宗 · 商家端收银台（功能批次 · 零件制首试）

- 工作分支：`feat/m1-cashier`（基线 main@`e8916a87`，U4 已合）
- 真相源：《批次M1任务书-商家端收银台》封版 + 《M1-补1修订单》+ 试样 m1-cashier.html（8 零件注释分区）
- 日期：2026-09-18 ｜ 施工：K3 集群 work
- 验收方式：零件目检 8/8 + 3 态拼装 + 联动实证 + 权限实证（不再逐屏并排图，本批首试口径）
- 视口：1440×900 主力（平板横屏基准）+ 390×844 手机降级（修订单④）

## §5 验收闸门逐项

| 闸门 | 结果 | 证据 |
|---|---|---|
| gates 三件套 | ✅ 三端 build exit 0；server typecheck exit 0；smoke-routes **35/35**（新增 /cashier、/cashier/records 两路由锚点） | gates/build-all.log、server-typecheck.log、smoke-routes.log/.json |
| smoke-deploy（新增收银用例） | ✅ 全绿（现行 20 项 + 收银 13 项：pendingAppointments/会员检索命中与未命中/topUp/挂单 HD 单号/取单/结账/幂等重放/库存 −1/流水可查/getBill 支付段/扣次 −1/撤单留痕/财务接数） | gates/smoke-deploy.log |
| 契约实证 | ✅ 67/0（自造自用存量免疫版：四分列/幂等/扣次时点/库存/预约翻转/撤单冻结/manager 403 ×3/审计链 operatorId 分叉/财务对账差值口径） | gates/contract-check.log |
| 零件库 8/8 | ✅ P1-P8 逐件对照试样（见下「零件目检索引」） | shots/ |
| 抽 3 态拼装 | ✅ 主屏空态 01 / 购物车有货+会员选中+扣次 02 / 支付面板展开含找零 04（+成功态 05） | shots/01,02,04,05 |
| §1.5 联动五条 | ✅ 逐条实证（见下「联动实证索引」） | shots/14,15,16,40-43,50-53 |
| 权限实证 | ✅ manager（演示店长）撤单/改价置灰+原因行实拍；server 403 硬闸门断言在契约实证 | shots/30,31 + contract-check.log |
| 走测图 | ✅ 收银三屏（主屏 01/02、支付 04/05、流水 10）+ 受影响屏（总览 14/40/43、财务 15、次卡 16） | shots/ |
| 常客纯服务 3 步链路（修订单③） | ✅ 待收款拉入 → 结账 → 确认 三步实证链（中间零额外界面）；步数审计=3 | shots/06,07,08,09 |
| 390 降级三屏（修订单④） | ✅ 单栏 tab（开单/购物车/挂单流水）+ 支付全屏化 + 流水横滑藏条 | shots/20-26 |
| 疑点清单 | ✅ 9 条在案（见下） | 本文件 |
| evidence 分支随 PR 同步推送 | ✅ 本分支 | — |

## 零件目检索引（P1-P8，对照 m1-cashier.html 试样）

| 零件 | 图证 | 备注 |
|---|---|---|
| P1 会员检索条 | 02（命中浅木条）/ 17（未命中安静灰字） | 字圈+脱敏手机+次卡余额薄荷签+在店预约数 |
| P2 选品卡 | 01 / 02（点击柠檬边反馈） | 40px 圆角 10 浅木图标档+lucide 类映射 |
| P3 购物车行 | 02 / 03 | 数量器仅商品行、×墨 30%、扣次行薄荷签+划线、改价留痕划线、库存不足红警示不阻塞 |
| P4 挂单卡 | 01 右栏 / 42 | HD 单号 Montserrat、刚挂柠檬点、点卡取单、⋯撤单 |
| P5 支付胶囊（四分列） | 04 / 23 | 现金/微信/支付宝/次卡扣次（次卡带余额小字、不足禁用+原因行）；stored_value 预留位不出现 |
| P6 金额面板 | 02 / 04 | kv 14+dashed+应收 Montserrat 28；展示=应付现金部分（试样 ¥362−¥88=¥274 语义） |
| P7 流水行 | 01 右栏今日流水 / 10 | 单号 Montserrat+买家+金额右对齐+方式/状态签 |
| P8 撤单弹层 | 12 / 13（撤后灰签） | 420px 20 圆角、原因选填、红描边确认；settled 无入口（退款冻结） |

## §1.5 联动实证索引（五连）

| # | 联动 | 图证 | 结果 |
|---|---|---|---|
| 1 | 总览待收款 → 收银台自动拉入 | 40（待收款 2）→ 41（?pull= 自动拉入+toast+参数自清除） | ✅ |
| 2 | 结账反哺预约财务口径 | 52（详情「去收款」待收）→ 53（已收）+ 43（待收款 2→0） | ✅ paidAt NULL→有值、paidFen=8800 |
| 3 | 次卡扣次 | 02（扣次行薄荷签）→ 16（次卡页余 N−1 + 收银台扣次流水） | ✅ smoke 断言 remain −1 |
| 4 | 商城库存 −N | 50（商品页前）→ 51（后） | ✅ stock 44→42（×2 行）；不足红警示不阻塞另有契约断言（stockShort 留痕） |
| 5 | 财务流水（来源签「收银台」+ 三卡口径同步） | 15 | ✅ 财务页零结构改动，cashierLedger 并入；次卡扣次非现金单列不计入营业额 |

## M1-补1 修订单落点对照

| 修订 | 落点 |
|---|---|
| ① 支付四分列 | CashierPayment.method=cash\|wechat\|alipay\|pass；「记账」删除（collect 端点/billCollected 事件/credit 分支/收银待收并入全部连带删净，无死接口）；stored_value 注释预留禁用（zod 不收，实证 400） |
| ② schema 预留 | cashier_bills 增 shift_id（可空，M2）+ operator_id（必填，迁移 0009 存量回填=created_by，实证未回填 0 行）；创建/挂单/结账 operatorId=当时操作人（分叉实证：owner 开单 manager 结账） |
| ③ 3 步链路 | 拉入→结账→确认零中间页（实拍链 06-09）；支付面板打开即预填应收、确认即 settle |
| ④ 390 降级 | 单栏 tab 三档+支付全屏+流水横滑；零件零改动仅拼装变 |
| ⑤ 红线 | 全域无充值/储值入口；无会员档位名/价格（决策 15）；无真支付/扫码唤起/打印/退款影子 |

## 钱口径登记（分文有出处）

- 分单位存储（*Fen，对齐既有 orders/passes）；幂等键=bill_no（同号重放 idempotent，库存/扣次/支付段/预约翻转零重复，契约实证逐项断言）
- 撤单留痕不物理删（voided+原因）；settled 本批不可撤（退款专项冻结，CONFLICT 如实）；扣次回补属退款专项（注释在码，不预留路径）
- 扣次时点=结账事务提交时（裁定③）；流水 appointment_id=NULL + note 带 bill_no
- 已收=现金+微信+支付宝实收（次卡等值经 passFen 单列对账，不进已收总额——修双计后实证「纯 pass 单 receivedFen=0、totals 不胀」）
- 优惠归属：单级优惠仅覆盖服务/商品行（server 强校验封顶），预约行不参与（翻转金额逐行可对账）；「优惠先抵服务、收款先认服务」
- 买家名：未选会员（customerId 缺省）+含预约行 → 回填首行预约客户；显式 null=确认散客不回填（listBills 买家=散客，反例实证在 contract-check.log）
- 挂单号 HD-{YYYYMMDD}-{当日 3 位序号}（门店规范时区 +8 取日，串行锁内分配；v1 单收银台假设在案）

## seed_manager 演示账号（裁定②：SQL 直造，dev-login 仅 seed_ 前缀不扩权限面）

```sql
INSERT INTO users (id, kimi_id, nickname, phone, created_at, updated_at)
VALUES ('01M2TCPFPK4H07D69WEC9R1WY9', 'seed_manager', '演示店长', '13900000009', 1789739613, 1789739613);
INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
VALUES ('01M2TCPFPPT9ZJXNEC0XY7JY3T', '01M2TCPFPK4H07D69WEC9R1WY9', 'merchant_manager', 1789739613, 1789739613);
INSERT INTO staff (id, store_id, user_id, name, status, role, created_at, updated_at)
VALUES ('01M2TCPFPKC6H1VH6Z081A0NGB', '01M2SVYE6HYGV7T2ESTNM814M2', '01M2TCPFPK4H07D69WEC9R1WY9', '演示店长', 'active', 'frontdesk', 1789739613, 1789739613);
```

实证：dev-login 可登；开单/挂单/结账可用；撤单 403、改价/折扣 403（置灰实拍 shots/30,31）。

## 疑点清单（疑点≠缺陷，逐条立项待裁）

| # | 内容 |
|---|---|
| M1-Y1 | 无 bill_no 的新开单 settle 无法跨重试幂等（响应丢失重试会开新单）；现口径：UI 结账路径先 hold 取号/取单复用号。建议 M2 固化「支付面板拿号后放行重试」 |
| M1-Y2 | hold/resume 同号更新限本人开出的单（createdBy 校验）；挂单跨店员取单由 resume 放开——若产品要挂单全店共享编辑需复议 |
| M1-Y3 | listBills「已收」签由前端按支付段渲染（收银单无待收态）；chips 映射属前端拼装口径备案 |
| M1-Y4 | 改价 percent 折扣 server 按全量 subtotal 计再封顶非预约行；UI 弹层预览按非预约行估算，极端组合可能差 1 分内——以 server 重算为准，错误原文 toast |
| M1-Y5 | 390 下 MainScaffold 页头（流水屏标题+搜索框）偏挤——共享组件未动，全域课题另立 |
| M1-Y6 | TodoSection 待收款样例取今日时间轴（既有口径）：跨午夜场景无样例时落 /cashier 无 pull 参，待收款 tab 仍可达全部 |
| M1-Y7 | PassPage 扣次流水不渲染 note 内单号（listLogs 不返回 note，server 留扩展位） |
| M1-Y8 | 体验条款「真机 ≤30 秒」（APP-41）：本卷实证=步数审计（3 步封顶）+ 链路截图；真机计时需部署后走测补证 |
| M1-Y9 | U4 在案疑点 E-14/E-16/F-31/F-39 等仍待裁（与本批无耦合，延续跟踪） |

## 施工口径备注

- diff 范围：apps/merchant（16）+ server（14：schema/迁移 0008+0009/cashier/trpc/store/bus/events）+ packages/shared（事件枚举）+ scripts（2）；apps/customer、apps/staff 零改动（员工端本批不动）
- 禁令 grep（diff + 行）：珊瑚粉=0 / text-white=0 / 渐变=0；零新 npm 依赖
- 非安全上下文：全部实拍于 http://m.beta.local:7200（isSecureContext=false）不崩
- 管线工具（u4-pipeline/：造数/实拍/契约脚本）为一次性走查工具不入库；seed_manager 及验收数据经真实链路或裁定② SQL 口径生成
