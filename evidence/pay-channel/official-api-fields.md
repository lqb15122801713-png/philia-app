# 官方文档字段摘录 · 微信支付（JSAPI+H5）+ 支付宝（手机网站支付）

> 批次=产品-1010 线上支付批 片 1（通道抽象层）｜ 摘录日期=2026-10-10 ｜ 用途=五接口签名冻结的唯一事实源（军规一①：不凭空造）
> 来源=微信支付商户文档中心 pay.weixin.qq.com / 支付宝开放平台 opendocs.alipay.com 官方页面原文（逐页 FetchURL 取证；支付宝 SPA 页用搜索引擎 UA 取 SSR 正文）。
>
> ⚠️ **勘误一件**：既有代码 `server/src/payments/alipayPay.ts` 注释写 `product_code='QUICK_WAP_PAY'`，与官方文档不符——手机网站支付官方产品码=**`QUICK_WAP_WAY`**（本批随码修正注释；骨架未实现调用，零运行时影响）。

---

# 一、微信支付 APIv3 字段摘录（直连商户模式）

> 通用约定：主域名 `https://api.mch.weixin.qq.com`（备域名 `https://api2.mch.weixin.qq.com`）；Header 必填 `Authorization`（WECHATPAY2-SHA256-RSA2048 认证串）、`Accept: application/json`、POST 接口另需 `Content-Type: application/json`。

## 1. JSAPI 下单（直连）

`POST /v3/pay/transactions/jsapi`（文档更新时间 2025.03.31）

**请求体关键字段**

| 字段 | 类型 | 必填 | 含义/限制 |
|---|---|---|---|
| appid | string(32) | 必填 | 公众账号ID（公众号/小程序/移动应用均可），须与 mchid 有绑定关系 |
| mchid | string(32) | 必填 | 微信支付分配的商户号 |
| description | string(127) | 必填 | 商品描述，用户账单可见，不超过 127 字符 |
| out_trade_no | string(32) | 必填 | 商户订单号，6–32 字符，仅数字、大小写字母、`_-*|`，同商户号下唯一 |
| notify_url | string(255) | 必填 | 支付结果回调地址 |
| amount | object | 必填 | 订单金额对象 |
| amount.total | integer | 必填 | 总金额，单位：分，必须 >0（1 元=100） |
| amount.currency | string(16) | 选填 | 币种，ISO 4217，固定传 `CNY` |
| payer | object | 必填 | 支付者信息 |
| payer.openid | string(128) | 必填 | 用户在商户 appid 下的唯一标识，下单前需先获取 |
| time_expire | string(64) | 选填 | 支付结束时间，rfc3339 格式；须在下单后 1 分钟～15 天之间 |
| attach | string(128) | 选填 | 商户自定义数据包，查单与回调原样返回 |
| scene_info（payer_client_ip 等） | object | 选填 | 场景信息；JSAPI 下整体选填，其内 payer_client_ip（string(45)）在传入该对象时必填 |
| settle_info.profit_sharing | boolean | 选填 | 分账标识，默认 false |

**应答（200 OK）**：`prepay_id` string(64) 必填——预支付交易会话标识，有效期 2 小时。

**前端调起支付（二次签名）**：`WeixinJSBridge.invoke('getBrandWCPayRequest', {...})`：

| 参数 | 类型 | 必填 | 口径 |
|---|---|---|---|
| appId | string(32) | 必填 | 须与下单传入的 appid 一致 |
| timeStamp | string(32) | 必填 | **秒级** Unix 时间戳（不可传毫秒） |
| nonceStr | string(32) | 必填 | 随机字符串，不长于 32 位 |
| package | string(128) | 必填 | 固定格式 `prepay_id=***` |
| signType | string(32) | 必填 | 固定填 `RSA`；不参与签名 |
| paySign | string(512) | 必填 | 对 appId、timeStamp、nonceStr、package 四者计算的签名值 |

paySign 生成口径：签名串四行（`appId\n时间戳\n随机字符串\nprepay_id=***\n`，每行以 `\n` 结尾含最后一行），商户 API 证书私钥 SHA256 with RSA 签名后 Base64。调起与下单必须同一商户 API 证书。前端 `err_msg` 不可靠，订单状态以后端查单与回调为准。

**文档 URL**
- JSAPI/小程序下单：https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/direct-jsons/jsapi-prepay.html
- JSAPI调起支付：https://pay.weixin.qq.com/doc/v3/merchant/4012791857 （注：该页位于 `/doc/v3/merchant/` 路径；`/docs/merchant/` 下对应页未定位到，路径存疑、内容为官方）
- JSAPI调起支付签名：https://pay.weixin.qq.com/doc/v3/merchant/4012365339 （同注）
- 服务端签名生成：https://pay.weixin.qq.com/docs/merchant/development/interface-rules/signature-generation.html

## 2. H5 下单（直连）

`POST /v3/pay/transactions/h5`（文档更新时间 2025.03.31）

与 JSAPI 差异：公共字段口径一致；**没有 `payer` 对象**；`scene_info` 由选填变**必填**且必须携带 `h5_info`。

| 差异字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| scene_info.payer_client_ip | string(45) | 必填 | 用户终端 IP，支持 IPv4/IPv6 |
| scene_info.h5_info.type | string(32) | 必填 | 场景类型：`Wap`、`iOS`、`Android` |
| scene_info.h5_info.app_name | string(64) | 选填 | 应用名称 |
| scene_info.h5_info.app_url | string(128) | 选填 | 网站 URL |
| scene_info.h5_info.bundle_id | string(128) | 选填 | iOS BundleID |
| scene_info.h5_info.package_name | string(128) | 选填 | Android PackageName |

**应答（200 OK）**：`h5_url` string(256) 必填——支付跳转链接（拉起微信收银台中间页），有效期 5 分钟；严禁篡改/拆分/截断，仅允许拼接 `redirect_url` 指定支付后回跳页。

**文档 URL**：https://pay.weixin.qq.com/docs/merchant/apis/h5-payment/direct-jsons/h5-prepay.html

## 3. 查询订单（按商户订单号）

`GET /v3/pay/transactions/out-trade-no/{out_trade_no}?mchid=xxx`（文档更新时间 2024.12.27）

- path：`out_trade_no` string(32) 必填；query：`mchid` string(32) 必填。
- 未支付订单只能用商户订单号查；已支付也可用 `/v3/pay/transactions/id/{transaction_id}`。

**应答关键字段**

| 字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| appid / mchid / out_trade_no | string(32) | 必填 | 下单时原值 |
| transaction_id | string(32) | 选填 | 微信支付订单号，支付成功后返回 |
| trade_type | string(16) | 选填 | JSAPI / NATIVE / APP / MICROPAY / MWEB / FACEPAY |
| trade_state | string(32) | 必填 | 交易状态（枚举见下） |
| trade_state_desc | string(256) | 必填 | 交易状态描述 |
| success_time | string(64) | 选填 | 支付完成时间（rfc3339），支付成功后返回 |
| payer.openid | string(128) | 选填 | 支付成功后返回 |
| amount.total / amount.payer_total | integer | 选填 | 订单总金额 / 用户实付（分） |

**trade_state 枚举全集**：`SUCCESS`（支付成功）、`REFUND`（转入退款）、`NOTPAY`（未支付）、`CLOSED`（已关闭）、`REVOKED`（已撤销，仅付款码）、`USERPAYING`（用户支付中，仅付款码）、`PAYERROR`（支付失败，仅付款码）。

**文档 URL**：https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/query-by-out-trade-no.html

## 4. 关闭订单

`POST /v3/pay/transactions/out-trade-no/{out_trade_no}/close`（文档更新时间 2024.12.11）

| 字段 | 位置 | 类型 | 必填 | 含义 |
|---|---|---|---|---|
| out_trade_no | path | string(32) | 必填 | 商户下单时传入的商户订单号 |
| mchid | body | string(32) | 必填 | 商户下单时传入的商户号 |

- **应答：`204 No Content`，无应答包体**。
- 仅未支付状态订单可关。主要业务错误码：`403 TRADE_ERROR`、`403 RULE_LIMIT`、`429 FREQUENCY_LIMITED`、`500 SYSTEM_ERROR`（同参重试）。

**文档 URL**：https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/close-order.html

## 5. 申请退款与查询退款

### 5.1 申请退款 `POST /v3/refund/domestic/refunds`（文档更新时间 2025.01.09）

| 字段 | 类型 | 必填 | 含义/限制 |
|---|---|---|---|
| transaction_id | string(32) | 条件必填 | 微信支付订单号；与 out_trade_no **二选一** |
| out_trade_no | string(32) | 条件必填 | 商户订单号；与 transaction_id 二选一 |
| out_refund_no | string(64) | 必填 | 商户退款单号，商户系统内唯一；**重试必须用原单号**（幂等，同号多次请求只退一笔） |
| reason | string(80) | 选填 | 退款原因，展示在用户的退款消息中 |
| notify_url | string(256) | 选填 | 退款结果回调地址 |
| amount.refund | integer | 必填 | 退款金额（分），不能超过原订单支付金额 |
| amount.total | integer | 必填 | 原订单总金额（分） |
| amount.currency | string(16) | 必填 | 固定传 `CNY` |

**应答关键字段**：`refund_id`（微信支付退款单号）、`out_refund_no`/`out_trade_no`/`transaction_id`（原值回显）、`channel`（ORIGINAL 原路 等）、`status`（`SUCCESS`/`CLOSED`/`PROCESSING`/`ABNORMAL`）、`create_time`、`success_time`（仅 SUCCESS）、amount 明细组。
注意：接口返回成功仅代表**受理成功**，终态以退款结果通知和查询退款接口为准；一笔订单最多 50 次部分退款。

### 5.2 查询单笔退款 `GET /v3/refund/domestic/refunds/{out_refund_no}`（2025.01.09）

应答结构同 5.1（含 status 枚举）。建议提交后 1 分钟起查，PROCESSING 超 5 分钟逐步衰减频率。

**文档 URL**：https://pay.weixin.qq.com/docs/merchant/apis/refund/refunds/create.html ・ https://pay.weixin.qq.com/docs/merchant/apis/refund/refunds/query-by-out-refund-no.html

## 6. 支付结果通知（回调）

（2024.12.27）支付成功后微信以 POST 向 `notify_url` 发 JSON 通知（APP/H5/JSAPI/Native/小程序共用同一结构）。

**回调 HTTP 头（验签要素）**：`Wechatpay-Serial`（平台证书序列号 / 微信支付公钥ID `PUB_KEY_ID_数字串`）、`Wechatpay-Signature`（注意 `WECHATPAY/SIGNTEST/` 探测签名须正确处理）、`Wechatpay-Timestamp`、`Wechatpay-Nonce`。

**验签流程**：以 Timestamp+Nonce+原始请求体构建验签串，按 Serial 选平台证书/微信支付公钥验签。

**回调 body 结构**：`id`（通知唯一编号）/ `create_time` / `event_type`（支付成功=`TRANSACTION.SUCCESS`）/ `resource_type`（固定 `encrypt-resource`）/ `summary` / `resource`（`original_type`/`algorithm`=AEAD_AES_256_GCM/`ciphertext`/`associated_data`/`nonce`）。

**解密口径**：APIv3 密钥 + `resource.nonce` + `resource.associated_data` 对 `ciphertext` 做 AES-256-GCM 解密（rfc5116）得 JSON 业务信息（out_trade_no/transaction_id/trade_state/success_time/amount{total,payer_total}/payer.openid 等）。

**应答码口径**：5 秒内验签并应答，建议先应答再异步处理；成功=200/204 无包体；失败=4XX/5XX + `{"code":"FAIL","message":"..."}`；重试 15s/15s/30s/3m/10m/20m/30m×3/60m/3h×3/6h×2 最多 15 次，重复通知须幂等并持续应答 200；**不能只依赖回调**，须结合查询订单接口兜底。

**文档 URL**：https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/payment-notice.html

## 7. 微信侧抽象建议（JSAPI+H5 双通道同覆盖）

- **createOrder**：入参最小集=channel（JSAPI|H5）、appid、mchid、description、outTradeNo、amountTotal（分）、notifyUrl、payerClientIp（H5 必填）、openid（仅 JSAPI）、h5Info（仅 H5）；可选 timeExpire、attach。出参归一化：JSAPI=二次签名六元组；H5=h5_url——抽象出参 `{ prepayPayload }` 由前端按 channel 分派。
- **verifyCallback**：入参=四个 Wechatpay-* 头+原始请求体原文；输出标准化 `{ eventType, outTradeNo, transactionId, tradeState, successTime, amountTotal, amountPayerTotal }`；应答 200/204 或 4XX/5XX+FAIL；消费端幂等（通知 id+out_trade_no 去重），回调只作触发器、终态以 queryOrder 为准。
- **queryOrder**：入参 outTradeNo+mchid；出参 transactionId（可空）/tradeState 枚举全集/tradeStateDesc/successTime/amount.payerTotal；枚举映射内部统一状态（至少 PAID/NOT_PAID/CLOSED/REFUNDING）。
- **refund**：`{outTradeNo 或 transactionId, outRefundNo, refundAmount, totalAmount, reason?, notifyUrl?}` → refundId+status；**重试必须复用原 outRefundNo**；受理成功≠终态（退款回调/queryRefund 闭环）。
- **close**：`{outTradeNo}` + body mchid；成功=204 无 body，「无异常即成功」建模。
- **配置层**：五接口共享凭证集 `{appid, mchid, 商户API证书序列号, 商户私钥, APIv3密钥, 平台证书/微信支付公钥}`，须支持 JSAPI 与 H5 各绑不同 appid 的多配置实例。
- 未核实项：① 回调时间戳偏移容忍窗口（官方页未写明）；② H5 下单对 openid 是否显式拒绝（官方页仅未列出）。

---

# 二、支付宝手机网站支付 字段摘录

> 取证说明：opendocs 新版页面为 SPA，改用搜索引擎爬虫 UA（Googlebot）触发服务端渲染取回完整正文，内容与官方页面一致；原始页面文本缓存在 `E:\KIMI code\tmp\alipay-docs\`（8 份，本机复核件，不入卷）。

## 1. alipay.trade.wap.pay（手机网站支付接口 2.0）

**页面跳转类接口**（非系统调用类）：SDK `pageExecute` 返回——POST 方式=自动提交 HTML form（`<form action="https://openapi.alipay.com/gateway.do?...">` + 隐藏域 + 自动 submit），GET 方式=跳转 URL；官方建议 POST。

**公共请求参数**：`app_id`(32 必) / `method`=`alipay.trade.wap.pay`(必) / `format`=JSON(可) / `return_url`(256 可，同步跳转不可靠) / `charset`=utf-8(必) / `sign_type`=**RSA2 推荐**(必) / `sign`(344 必) / `timestamp` `yyyy-MM-dd HH:mm:ss`(必) / `version`=`1.0`(必) / `notify_url`(256 可=异步通知) / `app_auth_token`(可) / `biz_content`(JSON 串 必)。

**biz_content 关键字段**

| 字段 | 类型 | 必选 | 最大长度 | 含义 |
|---|---|---|---|---|
| out_trade_no | string | 必选 | 64 | 商户订单号，字母/数字/下划线，商户端唯一 |
| total_amount | price | 必选 | 9 | 订单总金额，**单位元**，两位小数，[0.01, 100000000] |
| subject | string | 必选 | 256 | 订单标题，不可含 `/`、`=`、`&` 等特殊字符 |
| product_code | string | 必选 | 64 | 手机网站支付固定 **`QUICK_WAP_WAY`**（⚠️勘误见文首） |
| quit_url | string | 可选 | 400 | 用户付款中途退出返回地址 |
| body | string | 可选 | 128 | 订单附加信息，异步通知/对账单原样返回 |
| passback_params | string | 可选 | 512 | 公用回传参数，**必须 UrlEncode** |
| time_expire | string | 可选 | 32 | 绝对超时 `yyyy-MM-dd HH:mm:ss`，1m~15d，优先于 timeout_express |
| timeout_express | string | 可选 | 6 | 相对超时，无线支付最小 5m，默认 15d |

**响应**：业务响应仅 `pageRedirectionData`（String 必，≤16384）=HTML form 或 URL；支付结果**不以该响应为准**，以异步通知+query 为准。

文档 URL：https://opendocs.alipay.com/apis/api_1/alipay.trade.wap.pay （页面标注 2025-12-17）

## 2. alipay.trade.query（统一收单交易查询）

- biz_content：`out_trade_no`/`trade_no` 二选一（同传优先 trade_no）；`query_options` 可选（trade_settle_info/fund_bill_list 等）。
- 响应（`alipay_trade_query_response`+顶层 sign）：code/msg 必，sub_code/sub_msg 可，sign 必；`trade_no`（未生成真实交易时不返回）/`out_trade_no` 必/`buyer_logon_id`（脱敏）/`trade_status` 必/`total_amount`（元，两位小数）/`buyer_pay_amount`/`receipt_amount`/`buyer_open_id` 等。
- **trade_status 枚举全集**：`WAIT_BUYER_PAY`（等待买家付款）/ `TRADE_CLOSED`（未付款超时关闭，或支付完成后全额退款）/ `TRADE_SUCCESS`（支付成功）/ `TRADE_FINISHED`（交易结束，不可退款）。
- 关键错误码：`ACQ.TRADE_NOT_EXIST`（交易不存在）、`ACQ.SYSTEM_ERROR`（重试）。

文档 URL：https://opendocs.alipay.com/apis/api_1/alipay.trade.query （页面标注 2026-03-03）

## 3. alipay.trade.refund + 退款查询

**refund biz_content**：`out_trade_no`/`trade_no` 二选一（同传优先 trade_no）/ `refund_amount`（元，两位小数，必，累计不得超交易总额）/ `out_request_no`（可，**部分退款必传**；重试必须不变，支付宝保证同一退款请求号只退一次）/ `refund_reason`（可 256）。

**注意（官方原文要点）**：同一笔交易两次退款至少间隔 3s；`code=10000` 仅代表请求成功，**`fund_change=Y` 才是退款成功**；退款周期 12 个月；资金原路返回；手续费不退。

**refund 响应**：`trade_no`/`out_trade_no` 必 / `buyer_logon_id` 必 / `refund_fee`（**累计**已退金额，元）必 / `fund_change`（Y/N）可。

**alipay.trade.fastpay.refund.query**：入参 `out_request_no` **必选**（退款时未传则为下单商户订单号）+trade_no/out_trade_no 二选一；出参 `refund_status`（`REFUND_SUCCESS`；**未返回=退款未收到或失败**）、`refund_amount`、`gmt_refund_pay`（须 query_options 显式指定才返回）。官方建议退款请求后间隔 10s 以上再查。

文档 URL：https://opendocs.alipay.com/apis/api_1/alipay.trade.refund （2025-03-06）・ https://opendocs.alipay.com/apis/api_1/alipay.trade.fastpay.refund.query （2024-10-28）

## 4. alipay.trade.close（统一收单交易关闭）

- biz_content：`trade_no`（最短 16 位）/`out_trade_no` 二选一（同传以 trade_no 为准）；`operator_id` 可选。
- 响应仅 `trade_no`/`out_trade_no`+公共 code/msg；**仅待支付（WAIT_BUYER_PAY）可关**；关键错误码 `ACQ.TRADE_NOT_EXIST`、`ACQ.TRADE_STATUS_ERROR`。

文档 URL：https://opendocs.alipay.com/apis/api_1/alipay.trade.close （2025-04-21）

## 5. 交易异步通知（notify_url 回调）

**通知字段（POST form）**：`notify_time`/`notify_type`（如 trade_status_sync）/`notify_id`（**同一通知重试时不变**）/`app_id`/`charset`/`version`/`sign_type`(RSA2)/`sign`/`trade_no`/`out_trade_no`/`out_biz_no`（退款通知=退款流水号）/`buyer_id`/`buyer_logon_id`/`seller_id`/`trade_status`（四枚举同 query）/`total_amount`/`receipt_amount`/`buyer_pay_amount`/`refund_fee`/`subject`/`body`/`gmt_create`/`gmt_payment`/`gmt_refund`/`gmt_close`/`fund_bill_list`/`passback_params` 等。

**RSA2 验签流程（官方原文步骤）**：
1. 通知参数中**除去 `sign`、`sign_type`** 外全部为待验签参数；url_decode 后按**字典序**排序拼接成待验签串；
2. `sign` base64 解码；
3. 用**支付宝公钥**（非商户私钥/非商户公钥）RSA 验签；
4. 验签通过还须校验：a. out_trade_no 是商户系统创建的订单号；b. total_amount 等于订单创建时金额；c. seller_id/seller_email 为该订单对应操作方；d. app_id 为商户本身。任一不通过必须忽略通知。

**应答与重试**：业务处理成功后必须明文回 **`success`**（非 success 判定失败）；重试间隔 4m、10m、10m、1h、2h、6h、15h 直到 success；notify_url 不得含空格/HTML 标签、**不得重定向**；只有 `TRADE_SUCCESS`/`TRADE_FINISHED` 认定付款成功；必须配合 alipay.trade.query 兜底；换 out_trade_no 重付前须先查单，WAIT_BUYER_PAY 须先 close 再重下单。

文档 URL：https://opendocs.alipay.com/open/203/105286 （手机网站支付·异步通知说明，2026-08-06）；交叉印证：https://opendocs.alipay.com/open/270/105899

## 6. 支付宝侧抽象建议

- **createOrder**：`{outOrderNo, amount(元两位小数), subject, notifyUrl, returnUrl, quitUrl?, expireTime?}` → 返回 **Redirect 联合类型**（url | htmlForm），与微信 prepay 系差异最大点。
- **verifyCallback**：入参须带**全量原始 form 参数**（验签不能只用挑选字段）→ 验签+四项一致性校验 → 仅 TRADE_SUCCESS/TRADE_FINISHED 记已支付 → 应答明文 `success`；幂等依据=notify_id 不变+out_trade_no 唯一。
- **queryOrder**：归一 `status ∈ {PENDING/CLOSED/SUCCESS/FINISHED}`；`ACQ.TRADE_NOT_EXIST` 归一「未创建」；支付完成时间以通知 gmt_payment 为准（query 侧取支付时间未核实）。
- **refund**：`{outOrderNo|tradeNo, refundAmount(元), outRequestNo(抽象层强制必填并持久化，重试不变), refundReason?}` → `{tradeNo, refundFee(累计), fundChange}`；**code=10000≠退款成功**必须写进状态机；queryRefund 闭环同微信思路对齐。
- **close**：`{outOrderNo|tradeNo}`；仅待支付可关，「非待支付」错误归一业务失败并提示先 queryOrder。
- **通道级公共差异**：金额单位（元两位小数字串 vs 微信分整数）/ 签名（RSA2 商户私钥签+支付宝公钥验 vs 微信 APIv3密钥+平台证书）/ createOrder 返回（跳转 url/HTML form vs prepay 调起参数）/ 回调成功应答（明文 success vs 200/204 空包体）。

---

## 三、五接口冻结签名（本批钉死件，照 §一.7+§二.6 归一）

见同卷 `design.md` §二（接口族冻结签名表）——字段一律可在本摘录上文找到官方出处；无出处不入选。
