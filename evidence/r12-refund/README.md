# 卷宗 · 批次 R12 退款专项 — feat/r12-refund / evidence/r12-refund

> K3 集群 work 模型施工。基线 main@32ae54f0（员工端 2.0 已合入，标杆 blob 核验一致）。依据：冻结版 V1.0（老板会签 CJ-0921-23）+ 权限矩阵 V1.2 修订页（退款行）。PR 只开不合（决策 #31）。部署**含新迁移 0014**，须 db:migrate。

## 一、闸门实证（本机真跑，日志 git add -f 随卷宗）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（根单命令） | **exit 0** | gates/build.log |
| server typecheck | **exit 0** | gates/server-typecheck.log |
| smoke-routes（48 路由，+ /cashier/refunds） | **48/48 exit 0** | gates/r12-smoke-routes.log/.json |
| check-nav-closure（64 路由） | **死胡同 0 · 弱 0 exit 0** | gates/r12-nav.log/.json |
| smoke-deploy（65 项，含 §5.14 退款三类源+寄养剩余晚实证） | **exit 0** | gates/r12-smoke-deploy.log |
| e2e（§27~§38 十二段 47 新断言+全量回归） | **exit 0** | gates/e2e.log |
| 禁令 grep（diff 增量） | **=0** | — |
| 零新依赖 | package.json 零变更 | — |

## 二、任务书 §七 e2e 逐条映射（gates/e2e.log §27~§38）

店员 403 / 店长≤阈值六联动成功（自批 approver=本人）/ **拆分两笔 30000+30000 累计顶到店主（V1）** / 日结现金段净额（V2，已收不涂改+净额算术断言）/ 组合支付 6:4 分摊回补精确到分（V3，储值余额前后值留痕）/ 寄养提前接回退剩余晚（V4，已住晚一分不退）/ 已冲正已撤禁退明文拒（V5）/ 部分退提成按比例冲减精确到分+全额退归零+跨月调整项不动快照（V6）/ 跨日退款入发生日日结不回填封箱（V7）/ 次卡赠次不计价退卡作废（V8）/ 涉储值店长明文拦截店主成 / 余额内可再退+超余额拒 / 实退待办>24h+登记+幂等 / 快照含 rebate 列位=0。

## 三、红线落地对照

1. 六联动同事务（退款单/支付段回补/库存 refund 流水/储值次卡回补/财务口径/回馈金列位 rebateClawbackFen=0）任一失败整体回滚；
2. 原单永存不涂改（仅挂 refund_status/refund_bill_no 双向可查）；
3. 强制原因+全留痕；
4. 权限闸：店员无入口 403/店长≤原单累计阈值（配置端口 refund_threshold_fen 默认 ¥500 可调）/涉储值一律店主/驳回权仅店主/导出仅老板留痕；
5. 退款不抹账：当日净额=已收−退款、现金段净额、跨日入发生日；
6. 提成冲减按比例精确到分（读侧，回溯修复口径保持）；
7. 回馈金扣回接口冻结（快照列位，R11 回归）；
8. 幂等（同参重放返回现状，部分退累计≤可退余额）。

## 四、迁移与配置

- `0014_brainy_the_enforcers.sql`：refund_bills/refund_bill_items/refund_rules 三表 + cashier_bills.refund_status/refund_bill_no 两列。
- 配置端口第四域 refund：refund_threshold_fen=50000 默认（待老板终拍口径在 label），页面可改保存即生效版本化留痕。

## 五、偏差/判断点报备

1. 快照键名 camelCase（rebateClawbackFen；任务书原文 rebate_clawback_fen 为列位语义，planView 直存口径）。
2. 次卡退卡：售卖走 pass.topUp 无金额台账 → 实付/付费次数/赠次由店主录入随快照留痕；退卡单挂该客户本店任一 settled 单作锚点（不占其可退余额不挂标记）；member_pass 无 voided 状态 → disabled+次数清零+负向流水。
3. refund.list/dayStats 从严 merchantManagerProcedure（任务书 merchantProcedure 会放行 clerk，与矩阵「店员❌」冲突，收档报备）。
4. 按金额退不回库存（口径写死）；寄养退只退钱不动预约单；储值回补先赠送后本金镜像逆序。
5. smoke-deploy §5.14 储值建户走 executeImport 真通道（相对值断言幂等安全）；寄养"已发生晚不退"硬断言由 e2e §32 承担（smoke 演示单只能明天入住）。
6. 抓回自修：inventory.listMovements sourceType 枚举漏 'refund'（smoke-deploy 首轮抓回）+ ManagerPage 流水中文签补「退款回补」。
7. 兑现承诺：两个批次站岗的「退款功能随专项批开通」拦截文案（商家端 RefundBlockDialog + 店长视图拦截卡）已全部退役替换为真退款链路。

## 六、部署提示

含迁移 0014 须先 db:migrate；阈值改值走配置端口 refund 域；回馈金扣回待 R11 上线按冻结规则回归验收。
