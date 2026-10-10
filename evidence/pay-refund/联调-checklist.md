# 真机联调 checklist · 线上支付真通道（C 股 · 资质三件到位后执行）

> 批次=产品-1010 线上支付批 片 3 ｜ 依据=官方字段摘录（evidence/pay-channel/official-api-fields.md）｜ 执行前提=商户号/支付宝签约/ICP 域名三件到位+真通道实现接入（另令）+通道配置端口已录真凭据（掩码在案）+切换闸切真通道。
> 口径：每条用例=Given/When/Then+实测证据位；全绿才准真钱灰度。

## 一、微信 JSAPI（微信内浏览器）

| # | 用例 | 步骤 | 预期（官方口径） | 实测 |
|---|---|---|---|---|
| W1 | 公众号内拉起 | 客户在微信内打开续费确认页→去支付 | WeixinJSBridge 调起六参（appId/timeStamp/nonceStr/package/signType/paySign）支付面板弹出 | □ |
| W2 | 回调到账 | 支付成功→等回调 | POST notify_url ≤5s 应答 200；pay_orders paid+兑付同事务；trade_state=SUCCESS | □ |
| W3 | 回调延迟兜底 | 模拟回调延迟（断网 30s 后恢复） | 客户端轮询 status 不卡；服务端 queryOrder 兜底查实 paid（不能只靠回调） | □ |
| W4 | 掉单补偿 | 支付成功后杀进程（回调未到） | 「付了没开」自助对账补开=reconcile→queryOrder 回 paid→补兑付幂等零重复 | □ |
| W5 | 退款 T+1 | 线上单退款→原路 | POST /v3/refund/domestic/refunds 受理（refundId 落痕）；退款通知/查询 refund 终态 SUCCESS；到账时限=零钱实时/银行卡 1-3 工作日 | □ |
| W6 | 重复通知幂等 | 同一通知 id 重投 | 持续应答 200；业务零重复（流水/兑付/事件不增） | □ |

## 二、微信 H5（微信外浏览器）

| # | 用例 | 步骤 | 预期 | 实测 |
|---|---|---|---|---|
| H1 | 拉起率 | 系统浏览器点支付→h5_url 跳转 | 拉起微信收银台中间页（h5_url 5 分钟有效；严禁篡改/拆分，仅可拼 redirect_url） | □ |
| H2 | 返回跳回 | 支付完成/取消→回商户页 | redirect_url 跳回商户页；订单状态以后端查单/回调为准（跳转不可靠） | □ |
| H3 | 回调/掉单/退款 | 同 W2/W4/W5 | 同左（H5 与 JSAPI 回调/退款同 API） | □ |

## 三、支付宝手机网站（alipay.trade.wap.pay）

| # | 用例 | 步骤 | 预期 | 实测 |
|---|---|---|---|---|
| A1 | 拉起 | 浏览器点支付→form 自动提交 | 跳支付宝收银台（pageRedirectionData 表单直出）；quit_url 中途退出回商户页 | □ |
| A2 | 异步通知 | 支付成功→notify_url | RSA2 验签（除 sign/sign_type 全量参数字典序）+四项一致性（单号/金额/seller/app_id）→ 明文应答 success | □ |
| A3 | 通知重试 | 故意非 success 应答 | 按 4m/10m/10m/1h/2h/6h/15h 重发；幂等零重复；回 success 即止 | □ |
| A4 | 查单兜底 | 关通知模拟掉单 | alipay.trade.query 兜底（TRADE_SUCCESS/TRADE_FINISHED=已付）→ reconcile 补开 | □ |
| A5 | 退款 T+1 | 线上单退款 | alipay.trade.refund（out_request_no 幂等）；code=10000≠成功，fund_change=Y 才算；终态以 fastpay.refund.query 的 refund_status=REFUND_SUCCESS 闭环 | □ |
| A6 | 关单 | 待支付单超时 | alipay.trade.close（仅 WAIT_BUYER_PAY 可关）；业务关单已落库不受阻 | □ |

## 四、通道对账读口（联调期每日跑）

- 读口=pay.reconcileChannel（本批落）：通道账单 vs 业务账逐笔对——mock 期=通道账本=本地账本同表（mockChannelLedger vs pay_orders/payments）；真通道期=换源不换表（通道侧换 queryOrder 批量/账单下载，对账行形状不动）；
- 对不上=逐笔列差异（单号/侧别/金额/状态），日结前清零才收工。

## 五、收尾口径

- 全部 □→✅ 且有实测证据（截图/日志行号）才算联调通过；
- 任一红=回 mock（kill switch 瞬时回落），修复后重跑全表；
- 真钱灰度=老板另令（本批永远零真钱）。
