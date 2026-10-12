# 卷宗 · 候裁清零批（CJ-1012-01 老板裁死）· evidence/houcai-zero

> 令=开工令-产品-1012-候裁清零批.md ｜ 源=产品-1012-候裁清单一页 ｜ 裁定=CJ-1012-01（退会开+审批闸／迁移搁置出队列／余四件照建议）｜ 基线=main 现尖 `5a0bb835`（codeload 钉 sha）｜ 分支 `feat/houcai-zero`（PR 只开不合）｜ 纪律=PM-1008+红区补丁+拟人化死规 ｜ 档位=**K3·Max（涉钱面）** ｜ 2026-10-12

## 一、六件落码（令围全量）

1. **线上退会+审批闸（P0 涉钱）**：客户端会员中心退会弹层内嵌「线上退会申请」段——线上付（有线上售卡原单 pay_orders membership_* paid）可线上退：折算明示（CJ-0922-13 冻结算式=剩余整月×月均价，server 预览值前端不算）→申请落双单（`membership_cancel_requests` 新表+`approvalRequests` kind='membership_cancel'）+SSE 店频道→**商家审批中心审批闸**（运营页「会员退会审批」区，批准/驳回+驳回注记必填）→批准=同事务兑付（会员 cancelled+未到账权益作废+回馈金清零留痕+通道退款联动=mock 本地账本翻退 refundNo 幂等+`membership_events` cancel_online 留痕行）+驳回=零钱动；幂等=申请重放同一单/重复审批现状返回/通道同号重试只退一笔；线下付=到店退现状不动；无线上原单=申请 400 明文硬拒（0929 口径）。
   - **兑付留痕面**（候裁明面①）：refund_bills.billId 绑收银原单 notNull，线上售卡无收银单→退会兑付行不进 refund_bills——业务侧退款留痕=membership_events cancel_online 行（refundNo+通道退款号+折算快照全字段），**对账读口 payChannel.reconcile 会员域退款额聚合加该源**（等额才平，99.4 实证）；通道侧=mock 账本 refundNo 幂等行。
2. **旧链退役**：`mall.createPayment` 端点拒单明文「该支付入口已停用，请走新收银台」（入参 schema 保留=类型兼容；在跑新链 pay.createOrder 零回退）；mall.smoke.ts [4]/[5]/[7] 族迁新链全绿（57 断言 1:1 平移，验收清单在册不动）；CheckoutPage/MallOrdersPage 过时注释更正；demo-mall.ts 迁新链。**旧回调端点 /api/pay/mock-callback 不动**（e2e 68.4 在跑）。
3. **续费口径钉死**：续费暂不打折=零折扣字段；e2e 99.6 钉=quote 透出=createOrder 实收永相等。
4. **取消原因 chips**：保持所见即所交（零码改动，登记口径）。
5. **sheets 慎隐注记**：画布「商品订单」屏 mallOrders.sheets 块行 warn 徽「慎隐：藏了=改单直接提交无确认弹层」（新 copy 键 cadm.canvasSheetsHideNote）。
6. **带参记录屏预览读口**：11 屏预览兜底示例单（RecordsPage/MallOrdersPage/AppointmentsPage 列表屏+带参屏 8 件）——canvasPreview=1 且预览顶替查不到/拉取失败时渲染客户端合成示例单（零真数据零写库，假名「示例·画布预览」系，水印注记照在）；PDP 加购/收藏等动作在示例态拦截为水印提示（零落库）。

## 二、闸门实证（全绿在案）

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 build / server typecheck | 绿 | build-gate.log / typecheck.log |
| e2e 全量（99 族七断言） | **两绿采信**（fix3-1+fix3-3 全绿含 99 族；途中 fix3-2=ECONNRESET 环境件早夭复跑即绿；修前红两件在案：落店缺省+对账支路） | e2e-green-1.log / e2e-green-2.log |
| mall.smoke.ts（验收清单在册 58 断言） | 迁新链后**全绿** | mall-smoke.log |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0（零新路由=零申报） | nav.log / nav.json |
| smoke-routes / smoke-deploy | 109/109 · 全部通过 🎉 | smoke-routes.log/.json / smoke-deploy.log |
| 实尺截图 | 全绿（S1-S7+S5 断言件） | shots/ + checks.json + shots.log |

## 三、实尺截图清单（shots/；栈=7130 客户/7131 商家 preview+7200 API+hc-gate.db；夹具客户=每跑唯一 seed 行）

- S1-quit-online-sheet.png：**退会申请页**（退会弹层=原到店退文案+线上退会申请段+折算明示「退回 ¥199.00（剩余 12 整月×月均价）」）；
- S2-quit-pending.png：**提交后审批中状态卡**；
- S3-ops-quit-queue.png：**审批中心闸**（运营页「会员退会审批」区 pending 行=拟退额+剩余月+原因+批准/驳回双钮；既有库存审批队列同源透出 approvalRequests 行）；
- S4-after-approve-customer.png：**批准兑付后客户侧**（会员终止分流）+checks.json 内库级断言（membership_events cancel_online 留痕行全字段）；
- S5=**旧链拒单明文**（mall.createPayment → 400「该支付入口已停用，请走新收银台」，checks.json 断言件）；
- S6-canvas-sheets-note.png：**慎隐注记帧**（画布 sheets 块 warn 徽）；
- S7-canvas-records-preview.png：**预览示例单帧**（消费记录屏预览=示例单行渲染不看空壳）。

## 四、迁移申报（本片一件，幂等）

`server/drizzle/0077_houcai_zero.sql`（journal idx 77）：`membership_cancel_requests` 新表（CREATE IF NOT EXISTS+双索引）+27 枚新 copy 键种子（a3.quitOnline 13+ops.quit 13+cadm.canvasSheetsHideNote 1；值=生成件单源逐字）；临时库 migrate+seed 实证（4211 键全落=4184+27、新表在、重放零副作用）。**台账新规照走=键入码必随迁移。**

## 五、候裁明面（不暗建）

1. **退会兑付行不进 refund_bills**（billId 绑收银原单 notNull；线上售卡无收银单）——业务侧留痕=membership_events cancel_online 行，对账读口会员域聚合已加该源（等额才平）；要进退款单体系=refund_bills.billId 可空化=钱域表结构变更，候立项单批；
2. **审批落店口径**：线上开档 sold_store_id=NULL（PR-4 OP-01② 在案）→ 审批落店=售卡店>归属店>当前唯一 active 店（mock 期单店口径；连锁期=待连锁合批再分）；
3. **列表屏三件兜底口径放宽半步**（施工员报备）：预览拉取失败（店主预览 iframe 无客户端会话）也喂示例单——仅 canvasPreview=1 生效，真用户页照旧；要严格「只兜列空」=删三处析取即可；
4. **合成示例卡动作钮**：服务端对合成 id 硬拒零落库（PDP 加购/立即购买额外拦截为水印提示）；
5. **RecordsPage 无会话预览骨架长转**（depositsQ/recordsQ enabled 闸，片 3 既有口径未动）——要兜=动 enabled 闸，超件授权候裁；
6. 客户撤回申请=暂不开口（申请后只能等审批；撤回口=下批留口候裁）；
7. 支付批/画布批/控制台批候裁明面件照挂零触碰；迁移执行包搁置出队列（CJ-1012-01）本批零触碰。

## 六、红线自查

零新依赖 ｜ 迁移幂等+申报（0077 一件） ｜ 键入码必随迁移 ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ 闸门栈 7130-7132+7200（CORS 显式） ｜ 收摊必净（netstat 实证 PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合 ｜ 涉钱面：折算=CJ-0922-13 冻结件零翻案+审批闸先行（不批不动钱）+幂等重放零重复退+账平（对账读口等额）四道全实证。
