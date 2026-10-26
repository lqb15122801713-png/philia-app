## PD-97 · 客户端待换清零（本地候选，PR 只开不合）

### 根因与最小修

- `ProductImage` 将已有 `/products/*.svg` 商品矢量图主动误判为占位，导致商城／PDP／袋／结算／订单统一显示「待换」。删除该误判；真缺图回落改为诚实「暂无图片」。
- 首页三张内容图被写死为 `null`，缺图组件直接输出「待换」。精选接入既有洗护／寄养／美容插画，守护卡使用既有品牌图／洗护插画；缺图只显示真实 alt。
- 商城英雄无槽图时使用既有 `ic-shop.png`；默认 alt 改为真实标题「本周上新」。插画以 `contain` 防裁切。

缺陷码：`AE-CLIENT-01`／`R10-01`（`AE-CLIENT-R10-01`）／`AE-CLIENT-R42-01`。

产品源码仅 6 文件、18 增 17 删；零 server／schema／订单逻辑／支付改动。**0138 故意空留**；未占 0117／0119／0122–0137／0139。

### 本地候选证据（非现网结论）

- 基线六面：0/6 GREEN；identity 六面全 true；pending＝home 5／mall 11／product 1／有货袋 1／有货结算 1／orders 5。
- 最终六面：6/6 GREEN；identity 与 asset 均 true，六面 pending 全 0。
- PDP：真实 `/mall/product/:id`＋`pdp-add-cart`；购物袋：`/mall/cart`＋1 行／qty=1；结算：`/mall/checkout`＋1 件商品。**product≠cart_empty，未用空袋当清。**
- 订单：5 笔真实 `mall.createOrder` 产生的订单（初始 pending，后续由既有超时任务自动转 cancelled），全部真商品缩略；未执行支付。
- 同脚本同视口六组 baseline／final 截图 SHA 均不同，见 `live-probe.json`；不是 REUSE_CROSS_TIP 充证。
- 候选客 dist：`index-Dv5UMifb.js`，size `1423318`，SHA-256 `bb780e35a2476d08d592fed7d47a3d07601a0c9d95ff30b2fb56c2fa2caa9b79`。
- 现网仍 `index-0tBLrJnt.js`，SHA-256 `0f10dd7ea484e797d73a122e3893893573e272ab44a60ae1825c3d88b28a3e8a`；候选名称与 SHA 双异；现网 HEALTH 200×4。

卷宗：`evidence/pd97-client-pending-swap-clear/README.md`／`validation.json`／`final-results.json`／六组 baseline・final PNG。

### 验证

- `npm run build`：customer／merchant／staff 全 exit 0。
- 单测：4/4 PASS（新 2＋既有 2）。
- 定向 lint：其他改动文件 exit 0；HomePage 仍有基线既有 `react-hooks/purity`＠128 一条。
- 全量客户 lint：基线与最终均 65 errors／4 warnings，未冒称全量 lint 绿。
- 破坏验证：临时加回商品 SVG 误判，1/2 RED；已还原并最终 4/4 PASS。
- 固定 CDP 端口旧会话曾造成数量累加假红；已清理、改独立端口与 `Browser.close`，干净会话重跑 6/6 GREEN，残留进程 0。

### 更深不更大／边界

客户在店里／路上扫首页精选、商城、订单缩略时不再撞见「待换」；有货袋与有货结算均可成帧。未用空态、SKIP、换 tip、`hits:[]` 或 `reuseInodes=0` 冒充清。

未触 `01M5EQVF`；未造第二店／跨店种；未写现网或共享库；未扩相册／驾舱／传感器／关店／员商侧／底栏；未查 USAGE。

**本 PR 只开不合、合前禁部；外部 B 监理与交付 HIT 候挂。现网同源 tip／新 dist／Merge SHA=Deployed SHA 仍属合部后另闸。**
