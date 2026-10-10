# 卷宗 · 产品-1010 线上支付批 片 2（商城 mock 域+线上续费）

> 基线=叠片 1 尖 9230da49（codeload 钉 sha）｜ 分支=feat/pay-channel-2（base=feat/pay-channel-1，PR 只开不合）｜ 卷宗=evidence/pay-mall-renew ｜ 纪律=PM-1008+PM-1009 红区硬句 ｜ 档位=K3·Max（涉钱面）｜ 2026-10-10

## 一、两件回执（令围 B 股 1/2）

1. **商城订单线上支付（pay.createOrder 落 mall 域）**：
   - 收单：orderId 锚单（存在+本人+pending 三闸），金额=订单实算落库值（不信入参），幂等=同人同单在途复用（幂等天然锚=订单本身，无日界）；
   - 兑付：settlePayOrderPaid 加 mall 分支——内核=`fulfillMallOrderPaidTx`（从 routes/payCallback.ts 抽件单源：orders pending→paid 条件更新幂等+payments 流水+OrderPaid 双频道事件+首单礼 grantFirstOrderGift），旧链 /api/pay/callback 同步改走该内核（行为零变化，e2e 68.4/55 族零回退实证）；orders.storeId 兑付全程零触碰；
   - 掉单补开：reconcile 照 membership_open 工艺（providerForChannel 快照通道查单→补兑付）；
   - CashierModal 接 mock 收银台页四态（成功/失败/超时/掉单四链+演示徽，照 PayStatePage 工艺；改走 /api/pay/orders/mock-callback 统一轨）；
   - **履约动作不暗建**（核销码/发货规则候裁另批——本批只到 paid+明细落账）。
2. **线上续费（membership_renew 域落缺）**：
   - quote(membership_renew) 透出=server 实算+顺延至+预约换档注记；
   - 收单金额=membership.renew 同算式（当前档价+既有宠物附加；预约换档=预约档全价）；当日同档在途重放零写入；
   - 兑付=内核 `applyMembershipRenewTx`（**membership.renew 端点抽件共用单源**：顺延 max(now,expires)+365/免费档 2099/解冻 frozen→active/回馈金解冻/预约换档 executed 留痕）+membership_events type='renew' 线上留痕（billNo=NULL，meta.payNo=支付单号）+SSE membership.renewed；
   - 会员中心「续费 ›」入口接线上确认页 /member/renew（Mock 水印 R10 双位；分流卡=无档案去开通/免费档无须缴费/通道关到店办理）；到店付说明弹层随退役。

## 二、闸门（实跑全绿）

| 闸门 | 结果 | 件 |
|---|---|---|
| 三端 build（VITE_API_BASE=localhost:7200） | ✓ 3.69s/3.92s/2.73s | — |
| server typecheck | 0 错 | — |
| e2e 全量两绿 | **974 断言**（基线 964+92 族 10 件；88 族+91 族零回退） | e2e-p2-g3.log / e2e-p2-g4.log |
| nav 闭环 | 125 路由 0 死 0 弱（新增 /member/renew 已双表申报） | nav-closure.log |
| smoke-routes | 109/109（+续费页锚点） | smoke-routes.log/json |
| smoke-deploy | 全过（收尾零残留） | smoke-deploy.log |
| 实尺截图 | 七帧全绿（SHOTS_ALL_GREEN，逐项断言见 checks.json） | shots/A–G + checks.json |

## 三、实证要点（含一处真缺陷修复在案）

- **FK 实证修复（e2e 首红抓真货）**：92.2 超时关单触发 `pay.orderClosed` 事件按 `user:{bizId}` 发通知——mall 域 bizId=orders.id 撞 notifications FK（无此用户）。修=closePayOrderWithLock 用户频道按域解析（mall 域联表取 orders.customer_id）。该缺陷若在真通道上生产=关单事务回滚报警，e2e 把它拦在内测。
- 双链共存口径（明面）：mall.createPayment 旧链（orders 域）保留在跑（断言在卷）；客户端 CashierModal 已改走统一轨——旧链下线候产品侧裁（不暗拆）。两链均以 orders.status='pending' 自闸，无双写面（同人同单幂等锚）。
- 续费优惠候裁登记：quote.renewal 折后价试算透出件（68.2 在案）与线上实收全价（membership.renew 同算式，令原文口径）——bp 配置后透出与实收口径差=开口项候产品侧裁（本片零触碰该透出件）。
- e2e 直调工艺已知件照挂：通道侧关单 ALERT 噪音（跨进程账本，生产进程内闭环正常）。

## 四、文件清单（feat/pay-channel-2，12 件）

server：routers/pay.ts（四域收单+兑付分支+归属按域）/ routers/membership.ts（续费内核抽件）/ routers/mall.ts（兑付内核抽件导出）/ routes/payCallback.ts（走内核）/ routes/payOrdersCallback.ts（归属共用）/ db/schema.ts（事件注释）/ __tests__/e2e.ts（92 族）；customer：components/mall/CashierModal.tsx（统一轨四态）/ pages/MemberRenewPage.tsx（新）/ pages/MemberCenterPage.tsx（入口）/ pages/PayStatePage.tsx（分域重试+续费成交卡）/ copy/pay.ts（键）/ App.tsx（路由）；scripts：check-nav-closure.mjs / smoke-routes.mjs / gen-copy-overrides-seed.mts（双表+映射申报）。零新依赖/零迁移。
