# 卷宗 · 批次 R11a 会员前置批（骨架批）— feat/r11-membership / evidence/r11-membership

> K3 集群 work 模型施工。基线 main 最新（R12 已合入，refund.ts blob 8235bc62 核验一致）。依据：docs/ops/27 冻结版 V1.0（CJ-0922-12 会签+CJ-0922-13 三小项清零）+ docs/ops/28 施工令。PR 只开不合（决策 #31）。部署**含新迁移 0015**，须 db:migrate。

## 一、闸门实证（本机真跑，日志 git add -f 随卷宗）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（根单命令） | **exit 0** | gates/build.log |
| server typecheck | **exit 0** | gates/server-typecheck.log |
| smoke-routes（50 路由，+ /member /member/open） | **50/50 exit 0** | gates/r11a-sr.log/.json |
| check-nav-closure（66 路由） | **死胡同 0 · 弱 0 exit 0** | gates/r11a-nav.log/.json |
| smoke-deploy（73 项，含 §5.15 微光开档/萤火到店付/返 2%/抵扣仅商品/日结分摊双口径） | **exit 0** | gates/smoke-deploy.log |
| e2e（§39~§48 十段 38 新断言+全量回归） | **exit 0** | gates/e2e.log |
| 禁令 grep 增量 / 零新依赖 | **=0 / 零变更** | — |

## 二、28 号令 e2e 清单映射（gates/e2e.log §39~§48）

三本账无互转（端点扫描+余额只走自家流水）/ 抵扣段仅商品（服务行 403「回馈金仅可抵商品」）/ 无月上限（多笔累计无截断）/ 到期冻结+续费解冻（懒冻结+顺延 365 天）/ 退卡清零（余额清零+档位终止+折算剩余整月×月均价精确到分 11608）/ 退货扣回接 R12（rebateClawbackFen 实算 129+余额不足扣 0 未扣回 42 差额留痕）/ 服务 88 折自动+门市价划线 / 售卡提成定额（萤火 500/烛光 1000/暖阳 2000/微光 0）/ 多宠第 4 只+59（4 只=25800，11 只封顶拒）/ 双归属两字段（sold_store=办卡店/消费单=消费店）/ 安心包全员免费（权益表述+无 ¥15 残留）。回归：openFree 幂等/立省钩子 1314 精确/settleMonthly 批次幂等/rebate 段不计已收。

## 三、范围落地（骨架批八项）

五表迁移 0015（member_plans/memberships/rebate_accounts/rebate_logs/rebate_settlements）/ 回馈金账本（商品实收×档率 2/5/10%、无月上限、**统一次月到账**（每月 5 日端口可调、故障顺延≤3 天口径明示）、1:1 可抵不提现不转让、用回馈金付部分不再返、365 天、到期冻结续费解冻退卡清零、退货按比例扣回接 R12）/ 收银台四件（售卡四档到店付+开通确认+多宠附加费；服务折扣自动+划线；rebate 抵扣段仅商品硬校验不计已收；立省钩子一屏一次）/ 连锁双归属（中央建卡禁分店）/ 年费分摊双口径（日结看板收现+分摊并列）/ 退会折算剩余整月×月均价 / 微光一键注册+安心包全员免费（权益表述）/ member_plans 全入配置端口第四页签「会员档」。

## 四、客户端骨架版（美观不评审，R11b 随 v2.0）

/member 会员中心（身份大卡/回馈金账本五类明细/规则明面八条/权益对照/续费退会指引无假按钮）+ /member/open 开通页（四档对照≤3 步+微光页内一键开）+ MePage 入口 + 码页档位联动（旧三档占位卡面退役换真四档——占位假档名与冻结档位冲突，报备）。旧路由 /philia/member（T2.1）未动并存，是否退役待产品侧裁定。

## 五、偏差/判断点报备

1. 售卡提成归属=开单人不限岗位（任务书口径）；判档键映射 PLAN_KEY→种子标签（配置端口改键自动兼容）。
2. grant 落 logs 即"已发"含未到账期次；扣回对象是已到账余额——次月 5 日前可现"已发有余额不足"，差额记 rebateClawbackMissedFen 不追债（§三原口径）。
3. 入账留痕：settleMonthly 回标 grant 行 settlement_id + 逐用户加写入账行（accounts 前后值承载）。
4. 退会折算月均价不先取整（round(paid×剩余整月/12) 与任务书示例 149.75 对齐）；续费后折算封顶当期实付。
5. 到期冻结=读写路径懒冻结（不设每日定时器；定时器仅 settleMonthly）。
6. cashier 改价闸门补丁：系统折扣（adjusted 精确等于 会员档公式值）不算人工改价不误伤 clerk；非等值仍走原闸（owner 可人工改价回归实证）。
7. smoke-deploy 幂等两修：售卡夹具手机号每次唯一；服务行 rebate 用例先 hold 取折后应收（会员 88 折 8800→7744）。
8. 待裁定小项 3（安心包"每单 1 包"字面）未随令到：权益表述落"安心包免费（全员同享）"不写数量，字面到后改文案不改码。

## 六、部署提示

含迁移 0015 须先 db:migrate；档位/比例/折扣/多宠/到账日全在配置端口「会员档」页签；回馈金月度结算=server 定时器每月 5 日（端口可调）幂等。

---

# 复核补改①（2026-09-23 · 七步复核退回两条+裁定一条）

## 打回① 退会折算只算不挂号 → 已修
membership.cancel 同事务自动落 refund_bills（type='membership_cancel'，RB 日序单号，bill_id=售卡原单，status='executed'，refund_method='offline_original'，linkage 快照含 membershipCancel 全字段+rebateClawbackFen:0 列位）——R12 同通道：refund.list 可查/实退待办>24h 可见/settleActual 实退登记通用；无售卡原单拒退会（明文"须店主人工办理"，不悬空）。e2e §49a/c：在库断言+移位 25h 待办可见+登记幂等+待办消失。

## 打回② 退卡清零边界 → 已修（双保险）
cancel 写作废汇总 clear 行（「退会作废未到账回馈金 N 分（期次 X）」，前后值不动）+settleMonthly 跳过 status='cancelled' 用户 grant（批次单 note 记跳过行数）。e2e §49b：退会者余额不变/grant 不回标/批次单不含退会者/正常会员对照到账。

## 裁定：旧路由 /philia/member 退役 → /member 重定向
App.tsx 重定向+四处链接改指+MemberPage 旧组件零引用删除+me-page-e2e.mjs 入口清单同步 6 项（顺手修复在案）。签文案裁定统一「会员退会」（UI/CSV/server 注释三处一致）。

## 补改轮闸门复跑（备用端口栈：并行窗占 7200，本批 API=7300/三端=7110-7112，CORS 白名单+构建期 VITE_API_BASE 根进程注入——Y1 环境变量根注入口径）
build exit 0 / server typecheck exit 0 / smoke-routes 50/50 / check-nav-closure 66 路由 0 死胡同 / smoke-deploy 73 项 / e2e exit 0（§49 含，全量回归）。日志已刷新为本轮。e2e 新增 E2E_PORT 环境变量覆盖（默认 7200 不变，端口空闲闸门不变）。
