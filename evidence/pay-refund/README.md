# 卷宗 · 产品-1010 线上支付批 片 3（末片：退款联动+记录透出+联调预备）

> 基线=叠片 2 尖 cac3cb4f（codeload 钉 sha）｜ 分支=feat/pay-channel-3（base=feat/pay-channel-2，PR 只开不合）｜ 卷宗=evidence/pay-refund ｜ 纪律=PM-1008+PM-1009 红区硬句 ｜ 档位=K3·Max（涉钱面）｜ 2026-10-10

## 一、三件回执（令围 B 股 3/4+C 股）

1. **线上退款原路联动（四域接通）**：
   - 会员域：refund.ts 反查双域→三域（`membership_renew` 入列，refund.ts 缺口实证行在案）——退最近一笔线上费（倒序最新单口径不动）；refundNo=退款单号幂等键（片 1 接口族④签名）；真通道留口「通道未开通」透出拒=事务内整体回滚（半态零容忍不动）；
   - 商城域：**refundRequest.approve 挂接**（refund_bills.bill_id→cashier_bills 红线不动）——线上付判定=pay_orders mall 域 paid 单（bizId=orders.id），批准=provider.refund（幂等键=申请单号 requestNo，同号重试只退一笔）+申请单 approved+timeline 留痕（通道退款单号入 note）；失败=整体拒可重批；线下到店付=现状不动（报备偏差 1 不碰）；
   - **账平四账（SC-003）**：e2e 93.1 断言=支付单 paid/金额不动 + 退款单 executed 等额 + 会员档 active 不退 + 对账读口 channelRefundedFen=退款额 ≤ 通道原单额。
2. **消费记录透出线上单**：recordsMine 源①扩三域（renew 入列）+商城域联表挂回（onlinePaid 挂商城单行，防同单双出）；透出字段=payNo/channel/paymentId/bizDomain/mock 徽（channel='mock' →「演示」）；RecordsPage RecordRow 渲染（支付单号 mono 行+演示徽+商城单挂线上支付行）；copy 键 3 件入 copy/records.ts。
3. **联调预备（C 股）**：
   - 真机联调 checklist 成文=`联调-checklist.md`（微信 JSAPI/H5/支付宝 wap 三通道 16 条用例+对账跑表+收尾口径；依据=片 1 官方字段摘录逐项可溯）；
   - 通道对账读口=`payChannel.reconcile`（owner 硬闸）+LedgerPage 第五区「通道对账」（笔数/差异/逐笔行：单据/域/业务额/业务态/通道态/通道额/通道退/业务退/对账徽）；**mock 期=通道账本=本地账本同表，真通道换源不换表**（行形状冻结）。

## 二、闸门（实跑全绿）

| 闸门 | 结果 | 件 |
|---|---|---|
| 三端 build（VITE_API_BASE=localhost:7200） | ✓ | — |
| server typecheck | 0 错 | — |
| e2e 全量两绿 | **980 断言**（基线 974+93 族 6 件；88/91/92 族零回退） | e2e-g6/g9 日志 |
| nav 闭环 | 125 路由 0 死 0 弱（零新增） | nav-closure.log |
| smoke-routes | 109/109 | smoke-routes.log/json |
| smoke-deploy | 全过（收尾零残留） | smoke-deploy.log |
| 实尺截图 | 五帧全绿（SHOTS_ALL_GREEN） | shots/A–E + checks.json |

## 三、实证与修复在案（本批 e2e/截图真抓到三件）

1. **跨进程账本误读自修正**：93 族首稿直读 mock 内存账本（runner 进程≠server 进程）→ 红；改走对账读口（server 内聚读径）断言通道退款行——读口同时是 C 股交付件，断言与交付件同口。
2. **对账读口同源去重修复**（实尺帧 D 首拍抓真货）：新轨兑付写 payments 流水与 pay_orders 同源——读口双列致「退款不等」假差异；修=payment_flow 行按 paymentId 去重（旧链独有流水才单列）。复验帧=去重后差异清零（见 shots/D-ledger-recon.png；本机残留差异=首跑 FATAL+server 重启 mock 内存账本丢失口径——读口正确捕获「通道无此单」，有效性实证）。
3. **e2e 端口自检实证**：闸门栈未收摊跑 e2e=7200 占用拒跑（g8 红在案，环境件；清场后两绿采信）。

## 四、候办与开口登记

- membership.cancel 线上域退会：线上开通会员无售卡原单（sold_store_id=NULL）撞「无售卡原单」硬拒——**候裁另批**（本批令围=refund.execute/refundRequest 两链，不暗建）；
- 旧链 mall.createPayment 退役候裁（片 2 登记照挂）；
- 续费优惠 bp 透出 vs 实收口径差候裁（片 2 登记照挂）；
- 真机联调=资质三件到位后照 `联调-checklist.md` 执行（本批永远零真钱）。

## 五、文件清单（feat/pay-channel-3，7 件）

server：routers/refund.ts（三域反查）/ routers/refundRequest.ts（商城线上退款联动）/ routers/pay.ts（recordsMine 透出扩）/ routers/payChannel.ts（reconcile 读口+去重）/ __tests__/e2e.ts（93 族）；customer：pages/RecordsPage.tsx+copy/records.ts；merchant：pages/LedgerPage.tsx（通道对账第五区）。零新依赖/零迁移/零新路由。
