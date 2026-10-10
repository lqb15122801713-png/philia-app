# 片 1 设计定稿 · 通道抽象层（五接口冻结）+通道配置端口+切换闸

> 依据=开工令-产品-1010-线上支付批片1 + 任务书冻结版 V1.0 + official-api-fields.md（官方字段摘录，本卷同目录）。
> 基线=main 66665136；分支=feat/pay-channel-1；纪律=PM-1008 人类可维护六条+PM-1009 红区硬句。

## 一、现状盘点（施工前实证，均在基线亲读）

- `server/src/payments/`：`provider.ts`（PaymentProvider 四接口：createPayment/verifyCallback/queryOrder/refund+env 注入+assertPaymentConfig 启动红线）、`mockPay.ts`（四态模拟+内存通道账本+HMAC 验签）、`wechatPay.ts`（JSAPI 骨架全 notImplemented）、`alipayPay.ts`（wap 骨架未注入）。
- 调用点：routers/pay.ts（createOrder 收单 :664/:787、reconcile :958、closePayOrderWithLock :442）、routers/mall.ts:755、routers/refund.ts:962、routes/payCallback.ts、routes/payOrdersCallback.ts。
- schema 已预留通道枚举 `PayChannel='mock'|'wechat_jsapi'|'wechat_h5'|'alipay_wap'`（schema.ts:3162）。
- 配置端口：8 域规则表+rule_config_versions 留痕；高危族三层=D 套口令弹层（前端）+confirmedHighRisk+涉钱二级审批（pay 全域涉钱）；kill switch=service_rules `config_kill_switch`，读方内联回落安全值（loadPayChannelEnabled 工艺）。
- **关键制约**：config.save 有「种子宇宙校验」（未知键拒）+涉钱二级审批硬闸 → 通道配置键**不走 generic save**，新开专用 router 自门口令复核（令口径=口令复核+留痕+掩码）。
- 密钥入库+掩码读出=无先例，本批自裁口径（§三.3）。

## 二、五接口冻结签名（官方字段归一，逐项可溯 official-api-fields.md）

```ts
/** 下单入参：微信 description/out_trade_no/amount.total(分) ⇄ 支付宝 subject/out_trade_no/total_amount(元换算) */
export interface CreateOrderInput { orderId: string; totalFen: number; subject: string }
/** 下单出参：paymentId=通道侧支付单号（mock=mock_ulid；微信=prepay 会话映射，回调以 transaction_id 为准；支付宝=下单时 out_trade_no 映射，通知以 trade_no 为准）。
 *  payParams=前端调起凭据全集（Record<string,string> 形状不动），按通道约定键：
 *  - mock：{ mock:'1', orderId, scenario }（现状不动）
 *  - wechat_jsapi：{ channel:'wechat_jsapi', appId, timeStamp, nonceStr, package, signType:'RSA', paySign }（官方二次签名六元组）
 *  - wechat_h5：{ channel:'wechat_h5', h5Url }（官方 h5_url，禁篡改仅可拼 redirect_url）
 *  - alipay_wap：{ channel:'alipay_wap', form }（官方 pageRedirectionData 自动提交表单串） */
export interface CreateOrderResult { paymentId: string; payParams: Record<string, string> }
/** 回调验签出参（现状形状冻结）：paymentId=通道交易号 / orderId=商户订单号 / paidFen=实付分 */
export interface VerifiedPayment { paymentId: string; orderId: string; paidFen: number }
/** 查单出参：status 扩 'closed'（微信 CLOSED ⇄ 支付宝 TRADE_CLOSED 归一；paid=微信 SUCCESS ⇄ 支付宝 TRADE_SUCCESS/TRADE_FINISHED） */
export interface QueryOrderResult { paymentId: string; status: 'paid' | 'unpaid' | 'closed'; paidFen?: number }
/** 退款入参：refundNo=幂等键（微信 out_refund_no ⇄ 支付宝 out_request_no，重试必须同号——业务侧=退款单号 RB-*）；
 *  totalFen=原单总额（微信 amount.total 必填）；reason ⇄ reason/refund_reason */
export interface RefundInput { paymentId: string; refundNo: string; amountFen: number; totalFen: number; reason?: string }
/** 退款出参：refundId=通道退款单号；status 归一（微信 SUCCESS/PROCESSING/CLOSED/ABNORMAL ⇄ 支付宝 fund_change/refund_status） */
export interface RefundResult { refundId: string; status: 'success' | 'processing' | 'closed' | 'abnormal' }

export interface PaymentProvider {
  createOrder(order: CreateOrderInput): Promise<CreateOrderResult>;   // ①下单（原 createPayment 更名）
  verifyCallback(headers: Record<string, string>, rawBody: string): Promise<VerifiedPayment>; // ②回调验签（不动）
  queryOrder(paymentId: string): Promise<QueryOrderResult>;           // ③查询（status 枚举扩 closed）
  refund(refund: RefundInput): Promise<RefundResult>;                 // ④退款（签名升级：幂等键+终态枚举）
  close(order: { orderId: string }): Promise<void>;                   // ⑤关单（新增；仅未支付可关=通道口径）
}
```

- 真通道实现=留口：五方法全抛 `通道未开通` 明文（格式 `[payments] 通道未开通：<Provider>.<method> 真通道实现留口（本批不接真钱；资质三件到位+老板另令后按官方文档接入）`）——调用方零感知（既有 catch 透出拒工艺不动）。
- mock 实现=真接口同形：createOrder 现状不动；queryOrder 增 'closed'；refund 记通道账本退款行返回 `{refundId:'mock_rf_*',status:'success'}`；close 记账本 'closed'（仅 created 可关；paid/failed 拒同真通道口径；重复关幂等）。
- notify_url/return_url=通道配置项（端口件），不进下单入参（微信 WECHAT_NOTIFY_URL 既有工艺对齐）。

## 三、通道配置端口（高危件 · 口令复核+留痕+掩码）

1. **存储**：pay_rules 两个新键（无种子、零迁移；首存建行）：
   - `pay_channel_provider {provider: PayChannel}`——切换闸读口（轻量无密）；
   - `pay_channel_credentials {wechat?:{appid,mchid,serial,apiV3Key}, alipay?:{appid,privateKey,publicKey}}`——高危密钥件；active 行存真值（server-only），**任何读口/留痕永不明文**。
   - 全局单份（storeId=NULL 总部行口径：线上收款=总公司账户，任务书开口项②裁）。
2. **server router `payChannel.ts`（新件，merchantOwnerProcedure 硬闸）**：
   - `get`：返回 {portProvider|null(未配置=env 兜底现状), credentials=掩码视图（每字段 configured+mask '****后4位'）, killSwitchOn}；
   - `save`：入参 {provider, confirmPhrase, wechat?, alipay?}——**口令复核 server 硬闸**：confirmPhrase≠「确认变更支付通道」→400 人话；事务内版本化写行（旧 active 失效+新行 version=域 max+1）+rule_config_versions 留痕 **changesJson 全掩码**（note='pay-channel-save'）+ConfigVersionSaved SSE。密钥字段缺省=保留旧值（部分更新口径）。
3. **掩码口径（自裁登记）**：所有读出路径（get/versions 留痕/日志）密钥类字段一律 `****`+末 4 位；真值只存在于 active 行 valueJson（server 内读取）；不回填表单（编辑时留空=不变）。
4. **UI（merchant）**：ConsolePage E 章新增 E3「支付通道」seal（PortKey+PORT_GROUPS+cadm 键），直嵌新件 `PayChannelPortBody.tsx`——当前通道指示/四通道单选/凭据表单（password 输入+已配置掩码占位）/保存走 D 套口令弹层（键入「确认变更支付通道」）/kill 开时显著回落提示。零新路由（/console 内嵌）→nav 双表零新增申报。

## 四、通道切换闸（mock↔真=端口参数；kill 开=瞬时回落 mock）

- **解析序（下单/回调入口）`resolvePaymentProvider(d)`**：① isKillSwitchOn → mock（瞬时回落安全值，loadPayChannelEnabled 同族工艺）；② pay_rules active 行 pay_channel_provider（全局单份）；③ 无端口行 → env PAYMENT_PROVIDER 现状兜底（零回退）。
- **在途单按快照通道解析 `providerForChannel(d, channel)`**（reconcile/退款联动/关单用）：mock 恒可解析；真通道=读 credentials 构造（缺配置→抛「通道配置缺失」明文，**绝不静默回落 mock**——资金红线）；旅程 3「在途 mock 单不受影响」由此坐实。
- 平台回调端点=当前切换 provider 验签（现状语义）；真通道接入时回调 URL 按通道分立=留口注记（不暗建，资质到位另批）。
- env 注入+assertPaymentConfig 启动红线**逐字不动**（production+mock 启动报错；mall.smoke [8] 绿）；env 'wechat'=wechat_jsapi 映射。
- 关单业务接线：closePayOrderWithLock 提交后 best-effort 通道关单（仅 paymentId 存在=通道已下单的单；失败 console.error ALERT 不阻断业务关单——外部调用不进事务工艺）。

## 五、零回退口径（验收尺对照）

- 88 族全绿不动：mock 四态/兑付/幂等/拒单人话全保留；createPayment→createOrder 更名=纯机械改（调用点同改，行为零变化）。
- 换通道零业务码改动=grep 实证：业务调用点（pay/mall/refund/callback 路由）只调 resolvePaymentProvider/providerForChannel，码内零 if-mock（grep 实证入卷）。
- refund.ts 联动：genRefundNo 前移至 provider.refund 前（同事务，throw 整体回滚半态零容忍口径不动）；onlineRefund 形状保留+增 channelRefundId 留痕位。
- 与 PR #91（闸门两件批，OPEN 候合）同域邻接：本批不改 types.ts 开环件（#91 内容），两 PR 同触 payments/* 文件——合序候 PM/产品侧裁，PR 内注记。

## 六、e2e 91 族断言设计（挂尾新族）

- 91.1 mock 五接口同形可调用：createOrder→queryOrder(unpaid)→close→queryOrder(closed)→refund(refundId/success)→verifyCallback 签名闭环；
- 91.2 真通道留口：wechat_jsapi/wechat_h5/alipay_wap 三实现五方法全抛「通道未开通」明文；
- 91.3 切换闸翻转：口令复核 save(wechat_jsapi)→resolvePaymentProvider=wechat_jsapi→客户 createOrder 透出「通道未开通」拒；save(mock)→恢复 mock 全链；
- 91.4 kill switch 回落：port=wechat_jsapi + kill 开 → resolve=mock（在途口径）；kill 复原；
- 91.5 高危件：错口令 400/掩码读出无明文/versions 留痕无明文（三断言）；
- 91.6 在途快照解析：port 切 wechat_jsapi 后 mock 在途单 reconcile 仍走 mock（providerForChannel 快照）——旅程 3 前半句坐实；
- 族尾复原：provider=mock + kill off + 默认档钉回（83.5 漂移防先例工艺）。

## 七、闸门与实证清单

三端 build / server typecheck / e2e 全量（88 族不动+91 族新增）/ nav 申报（零新路由注记）/ smoke-routes / smoke-deploy / 实尺截图（端口配置页+口令弹层+切换闸翻转前后）/ grep 零 if-mock 实证 / 卷宗三件（本件+official-api-fields.md+闸门日志）。
