# 卷宗 · 产品-1010 线上支付批 片 1（通道抽象层+配置端口+切换闸）

> 基线=main 66665136（codeload 钉 sha）｜ 分支=feat/pay-channel-1 ｜ 卷宗=evidence/pay-channel ｜ 纪律=PM-1008 六条+PM-1009 红区硬句 ｜ 档位=K3·Max（涉钱面）｜ 2026-10-10

## 一、三件回执（令围）

1. **payments provider 接口族钉死**：五接口签名冻结（createOrder/verifyCallback/queryOrder/refund/close）——**先读官方文档再定签名**（official-api-fields.md：微信 JSAPI+H5 v3 五页 + 支付宝 wap/query/refund/close/异步通知五页，逐字段可溯）；mock 实现=真接口同形（MockPayProvider 收敛：账本增 closed 态+退款行 refundNo 幂等+close 关单）；真通道（wechat_jsapi/wechat_h5/alipay_wap）=留口，五方法全抛「通道未开通」明文，调用方零感知。
   - ⚠️ 勘误入卷：既有 alipayPay.ts 注释 `QUICK_WAP_PAY` 与官方不符，官方=`QUICK_WAP_WAY`（已随码修正注释；骨架未实现调用，零运行时影响）。
2. **通道配置端口（高危件）**：pay_rules 两键（pay_channel_provider 切换闸读口 / pay_channel_credentials 凭据件），server 新 router `payChannel`（owner 硬闸）——口令复核 server 硬闸（「确认变更支付通道」同句）+版本化留痕（rule_config_versions changesJson **全掩码**）+密钥永不明文回显（get/list/versions 三路掩码，****+末 4 位）；generic 三口（config.save/proposeChange/rollback）对本两键一律 400 拒收（防真值进审批载荷/留痕/回滚应用）。
3. **通道切换闸**：mock↔真=端口参数（resolvePaymentProvider：kill switch 开→瞬时回落 mock → 端口行 → env 兜底零回退）；在途单按快照通道解析（providerForChannel=pay_orders.channel）；真通道凭据缺件=抛「通道配置缺失」明文（绝不静默回落 mock，资金红线）；env 启动红线 assertPaymentConfig 逐字不动（production+mock 启动报错）。

## 二、闸门（实跑全绿）

| 闸门 | 结果 | 件 |
|---|---|---|
| 三端 build（VITE_API_BASE=localhost:7200） | ✓ customer/merchant/staff | 见交付回执 |
| server typecheck | 0 错 | 同上 |
| e2e 全量 | **两绿 964 断言**（88 族零回退+91 族七断言新增） | e2e-g2.log / e2e-g3.log |
| nav 闭环 | 124 路由 0 死 0 弱 豁免 6（零新路由=零申报义务） | nav-closure.log |
| smoke-routes | 见 smoke-routes.log | smoke-routes.log |
| smoke-deploy | 见交付回执（闸门段） | smoke-deploy.log |
| 实尺截图 | 五帧全绿（SHOTS_ALL_GREEN） | shots/01-05 + checks.json |

## 三、验收尺实证

- **换通道零业务码改动**：grep-no-if-mock.md——业务调用点（下单/查单/退款/回调验签）零 if-mock；唯二命中=mock 演示端点暴露闸（既有件，非业务分叉）+端口值枚举校验（配置读口）。
- **mock 链零回退**：e2e 88 族全绿不动（g2/g3 两绿同数 964=957 基线+91 族 7 件）。
- **真钱零接**：91.2 断言三实现五方法全抛「通道未开通」；91.3 客户下单透出拒单实证。

## 四、邻接与候办

- **PR #91（闸门两件批）同域邻接**：本批不改 types.ts 开环件（#91 内容）；两 PR 同触 payments/* 文件——合序候 PM/产品侧裁。
- 凭据口径自裁登记（无 DB 存密钥先例）：active 行真值 server-only，读出/留痕全掩码 ****+末4位；编辑留空=该位不变（部分更新）。
- 通道侧关单=best-effort（业务关单落库后接线；跨进程账本 ALERT 噪音=e2e 直调工艺已知件，生产 server 进程内闭环正常）。
- 平台回调=当前切换通道验签（现状语义）；真通道接入时回调 URL 按通道分立=留口注记（不暗建）。
- 片 2（商城 mock 域+线上续费）候令随发。

## 五、文件清单（feat/pay-channel-1，17 件）

server：payments/{provider,mockPay,wechatPay,alipayPay}.ts 重写+payments/channelKeys.ts 新+routers/payChannel.ts 新+routers/{index,configRules,pay,mall,refund}.ts+routes/{payCallback,payOrdersCallback}.ts+__tests__/e2e.ts（91 族）；merchant：pages/PayChannelPortBody.tsx 新+pages/ConsolePage.tsx+copy/consoleAdmin.ts。零新依赖/零迁移/零新路由。
