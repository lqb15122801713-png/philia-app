# PD43 / CJ-1018-09 · U4 杂志商城 · 施工卷宗

- 分支：`feat/design-upgrade-u4-mag-mall`
- 当前基线：`origin/main = 42294f015fed1ab82b076739ba6d1eb9fe67d951`，`ahead/behind = 0/0`
- 模型：已用 K3 MAX
- 权威对照：Figma `ot5SBoqhKAw2UIZRVFzhel`；nodes `187:2`、`188:2`、`188:111`、`189:2`、`189:56`；VI `193:2`
- 范围：PHILIA PGC 杂志；商城列表、详情、购物车、结算表面
- 边界：不写服务端文件；不接真券、真支付、真退款、真建单、预约提交或会员开通通道；不触碰 B7／PD-40／`209:*`／CLEAN 旧节点

## 施工要点

- `187:2`：会员细条读真实 `membership.my`；权益／券／任务入口；今日编辑精选；前／后对照；杂志封面与条目缺图时为浅色「待换」。
- `188:2`：搜索＋回馈金 pill＋购物袋；类目为推荐／粮／零食／洗护／玩具／出行并映射既有查询枚举；会员礼 Hero；双列商品卡；列表无快加购；生成 SVG 占位不再露出爪印。
- `188:111`：全宽主图；名称、会员价信息位、回馈金条、真实可解析规格、成分描述；吸底仅保留单一加入购物车闸口。
- `189:2`：默认无勾选圆点；管理态保留勾选／删除；数量步进保留；回馈金开关驱动本单抵扣与应付表面。
- `189:56`：默认到店自提；门店与两件商品汇总；商品金额／运费／回馈金抵扣／应付明细；回馈金开关；配送到家时保留原快递／同城与地址表单。
- 回馈金抵扣只做表面：开启时线上提交被提示并停在闸口，不改 `createOrder` 金额或服务端契约。
- `?channel=groupbuy` 上游待上线分支已在 `MallPage.tsx` 冲突合并中保留，并有回归检查。
- 回馈金开关经 `philia.rebateUse` 在购物车与结算间共享；缺省按定稿开启，开启时停在结算闸口，关闭时保留原有建单链路。

## 审查修项与欠账登记

- 商城画布客户端只消费 `mall.search/categories/productGrid/feedTail`；旧注册表里的 `mall.head/deliverySlot/entries` 已被客户端白名单过滤。清册迁移属于 server 侧，本片边界不写 server，留待后续批次移除死端口与 copy 键。
- 购物车单店规则注已恢复为 12px 明示，不因默认隐藏勾选圆点而丢规则。
- 杂志「今日 · 门店」读 `store.listNearby` 真实首店；「后」图在没有专用字段前始终为诚实「待换」，不再借用另一篇文章封面；PGC「不开放投稿」口径已恢复明面。
- 心愿单入口与新品角标不在本次五个定稿节点内，且不符合当前版面；本片按定稿移除，后续若产品需要，走功能缺口清单另批恢复。
- 本片仍不写 server；回馈金真实核销、商品会员价差、专用前后图槽位均不在本片实现。

## 自动化证据

| 命令 | 结果 |
|---|---|
| `EVIDENCE_PREFIX=final node scripts/design-upgrade-u4-mag-mall-check.mjs` | 6/6 通过；见 `final-results.json` |
| `npm run build` | 三端构建退出码 0 |
| `cd server && npm run typecheck` | 退出码 0 |
| `npm exec -w @philia/customer -- eslint <本片触碰文件>` | 退出码 0 |
| `cd server && npm exec -- tsx src/routers/__tests__/mall.smoke.ts` | 全部商城冒烟通过；尾部仅 Windows 临时库 EBUSY 清理提示，不影响断言 |
| `node server/node_modules/tsx/dist/cli.mjs apps/customer/scripts/magazine-copy-check.mts` | PASS |
| `PHILIA_DB_URL=<全新隔离库> E2E_PORT=7299 npm run test:e2e` | 7 项失败；失败点为 copy/slot/report/wnav 数据口径（56.1×2、57.1、74.11、76.3、77.2、98.2），本片无 server 文件改动；完整输出见 `server-e2e-7299.log` |

客户端全量 lint 在基线原有 74 errors／4 warnings，本片不把它混作本片结果；本片触碰文件的单列 ESLint 为 0。

## 截图

- `final-187-philia.png`：PHILIA 杂志
- `final-188-mall.png`：商城列表（洗护筛选后）
- `final-188-product.png`：商品详情
- `final-189-cart.png`：购物车（回馈金默认开启）
- `final-189-checkout.png`：结算（回馈金默认开启）
- `final-188-groupbuy.png`：上游 groupbuy 待上线分支
- `reference/`：Figma 对照截图

## 测试纪律

- 浏览器检查使用真实 Chromium CDP、390×844、隔离 API `7242`、客户端 `7163`、隔离种子库。
- 购物车夹具只写浏览器 `localStorage`；没有点击加购、提交订单或进入收银台。
- 每条断言均由当前真实 DOM／computed style／实际金额文本驱动，不做源码文本扫描代替。

## 状态

PR 只开不合；合入与部署仍由产品走 ROG。
