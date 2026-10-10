# 接口调用点零 if-mock grep 实证（2026-10-10，工作副本 paychannel1）

## A. 业务调用点 if-mock/===mock 扫描（routers/pay.ts routers/mall.ts routers/refund.ts routers/payChannel.ts routes/payCallback.ts routes/payOrdersCallback.ts）
```
routers/payChannel.ts:138:      portProvider: (v === 'mock' || v === 'wechat_jsapi' || v === 'wechat_h5' || v === 'alipay_wap' ? v : null) as PayChannel | null,
routes/payCallback.ts:214:    if (provider.name !== 'mock') {
routes/payOrdersCallback.ts:168:    if (provider.name !== 'mock') {
```

命中三件判定：payChannel.ts=端口值枚举校验（配置读口，非业务分支）；两回调路由=mock 演示端点暴露闸（既有件：真通道模式不暴露演示口，非业务代码分叉）。业务调用点（下单/查单/退款/回调验签）零 if-mock ✓

## B. payments 域旧名 createPayment 残留扫描（server/src 排除 __tests__）
```
./db/schema.ts:819:    /** 渠道侧支付单号（PaymentProvider.createPayment 返回的 paymentId） */
./db/schema.ts:3205:    /** 通道侧支付单号（PaymentProvider.createPayment 返回；NULL=通道未下单） */
./routers/mall.ts:743:   * 5. createPayment（customer）：对本人 pending 订单发起支付。
./routers/mall.ts:747:  createPayment: customerProcedure
./routes/payCallback.ts:208:   * mock 演示端点：前端 createPayment 拿到 { paymentId, payParams:{mock:'1'} } 后调用，
./routes/payOrdersCallback.ts:164:   * （scenario 缺省=createPayment 时 payParams 快照的场景，再缺省 'success'）。
```
