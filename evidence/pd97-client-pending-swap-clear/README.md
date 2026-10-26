# PD-97 · 客户端待换清零 · 候选卷宗

- 窗：`PD-97-client-pending-swap-clear`
- WT：`E:\KIMI code\pd97-client-pending-swap-clear`
- 分支：`feat/pd97-client-pending-swap-clear`
- 基线：`main@287cf4f2aaf31195692040d3c2248b5e6c653166`／DEPLOY `20261026112609`
- 现网对照：客 `index-0tBLrJnt.js`
- 候选：`http://127.0.0.1:7297`（仅本地候选，**不是 tip 包，不冒领现网结论**）
- mig：**0138 故意空留**；零 schema；未碰 0117／0119／0122–0137／0139
- 结构化核验：`validation.json`；候选／现网与截图 hash：`live-probe.json`

## 1. 根因与最小产品 diff

| 根因 | 产品修 |
|---|---|
| `HomePage` 把三张内容图写死为 `null`，`HomeImage` 的缺图分支直接显示「待换」 | 首页精选接入既有洗护／寄养／美容插画；守护卡使用既有品牌图与洗护插画；缺图分支改为真实 alt 文本 |
| `ProductImage` 把所有 `/products/*.svg` 主动判成 `generatedPlaceholder`，即使商品已有专属矢量图也不显示 | 删除该误判分支；商城／PDP／袋／结算／订单共用真图；真缺图仍保留 slot 与诚实「暂无图片」回落 |
| `mall.hero` 无槽图时直接显示「待换」，默认 alt 还读出库槽的素材注记 | 无槽图时使用既有 `ic-shop.png`；默认 alt 用真实标题「本周上新」，有真槽图仍尊重运营 alt |
| 插画被 `object-fit: cover` 裁切 | 精选与守护插画改 `contain`，不新增布局或功能面 |

产品码仅 6 文件、18 增 17 删：

- `apps/customer/src/components/mall/ProductImage.tsx`
- `apps/customer/src/copy/mall.ts`
- `apps/customer/src/pages/HomePage.tsx`
- `apps/customer/src/pages/MallPage.tsx`
- `apps/customer/src/pages/ProductDetailPage.tsx`（旧行为注释同步）
- `apps/customer/src/styles/home-v2.css`

回归码：`apps/customer/src/components/mall/ProductImage.test.tsx`＋`scripts/pd97-client-pending-swap-clear-check.mjs`。零 server／schema／订单逻辑／支付改动；零相册／驾舱／传感器／关店／员商侧扩面。

## 2. 原缺陷 → 证据 → 状态（本地候选）

| 原缺陷／门槛 | 基线证据 | 候选证据 | 状态 |
|---|---|---|---|
| `AE-CLIENT-01` 首页／商城／订单占位资产墙 | `baseline-results.json`：home=5／mall=11／orders=5；六面身份均真 | `final-results.json`：三面 pending=0；`final-home.png`／`final-mall.png`／`final-orders.png` | 本地候选覆盖；现网待合部 |
| `R10-01`（`AE-CLIENT-R10-01`）商城扩面墙 | PDP=1／有货袋=1／有货结算=1；均非空态 | PDP／袋／结算均真商品图、pending=0 | 本地候选覆盖；现网待合部 |
| `AE-CLIENT-R42-01` 换 tip 后仍头号 | 同脚本同视口 baseline 六面全 RED | 同脚本同数据 final 六面全 GREEN；六组截图 SHA 均不同 | 本地候选覆盖；不以换 tip 充清 |
| 有货面永久 SKIP | `baseline-cart-in-stock.png`／`baseline-checkout-in-stock.png`：1 件有货仍「待换」 | `final-cart-in-stock.png`／`final-checkout-in-stock.png`：1 行／qty=1／1 件商品，真图加载成功 | 有货袋与有货结算均可成帧 |
| `product≡cart_empty` MISLABEL | R43 两帧同 MD5 `88ffa0709accfd36592448a23216eb52`，文本也同为空袋 | 最终 `product.path=/mall/product/:id` 且有 `pdp-add-cart`；cart.path=`/mall/cart` 且有 1 行；checkout.path=`/mall/checkout` 且有 1 件；三者分别断言 | 已纠；未用空袋当清 |
| 商城／订单 REUSE_CROSS_TIP 同字节 | baseline 与 final 同脚本、同视口、同临时订单数据 | `live-probe.json`：mall 与 orders 截图 SHA 均不同；候选 js 名称与 SHA 也均不同 | 新字节真钉；不是 `reuseInodes=0` 或 `hits:[]` 充证 |

六面最终：`home identity=true asset=true pending=0`／`mall identity=true asset=true pending=0`／`product identity=true asset=true pending=0`／`cart-in-stock identity=true asset=true pending=0`／`checkout-in-stock identity=true asset=true pending=0`／`orders identity=true asset=true pending=0`。

## 3. 候选 js 与现网／基线新字节

| 包 | 文件名 | size | SHA-256 | 说明 |
|---|---|---|---|---|
| 现网基线 | `index-0tBLrJnt.js` | 1412840 | `0f10dd7ea484e797d73a122e3893893573e272ab44a60ae1825c3d88b28a3e8a` | 从 `http://120.53.102.45:7201` 只读下载；HEALTH 7200–7203＝200×4 |
| 本机基线构建 | `index-CU2PlPFq.js` | 1423140 | `79018db3d2d72d90a65b3accd26b0d2f3d36652a3b6932e25d14e1ca35fdf54f` | 未改源码时构建；证明本机与现网构建环境并非同字节，不拿它当现网包 |
| 最终本地候选 | `index-Dv5UMifb.js` | 1423318 | `bb780e35a2476d08d592fed7d47a3d07601a0c9d95ff30b2fb56c2fa2caa9b79` | 从本地候选下载核验；与 `0tBLrJnt` 名称及 SHA 双异；不是 tip 包 |

截图 hash 见 `live-probe.json.comparisons.screenshots`：home／mall／product／cart-in-stock／checkout-in-stock／orders 六组 `different=true`。这是相对本机基线的独立像素字节证据，不是 REUSE_CROSS_TIP。

## 4. 验证记录

| 闸 | 命令／证据 | 结果 |
|---|---|---|
| 基线客户构建 | `npm run build:customer`；`baseline-build-customer.txt` | exit 0，产出 `index-CU2PlPFq.js` |
| 基线既有单测 | `baseline-test-slotGrid.log`／`baseline-test-legendCopy.log` | 2/2 PASS |
| 组件 RED | `red-product-image.txt` | 2/2 RED：商品 SVG 被换占位；真缺图仍「待换」 |
| 六面 RED | `baseline-e2e.txt`／`baseline-results.json` | 0/6 GREEN；identity 六面全 true；pending=5/11/1/1/1/5 |
| 破坏 RED | `mutation-red-product-image.txt` | 临时加回旧误判，1/2 RED；已还原，最终包不含破坏码 |
| 最终单测 | `final-unit-all.txt` | 4/4 PASS，fail=0（PD-97 新 2＋既有 2） |
| 最终三端构建 | `npm run build`；`final-build-all.txt` | customer／merchant／staff 均 exit 0；客户产出 `index-Dv5UMifb.js` |
| 其他改动文件定向 lint | `final-lint-other.txt` | exit 0 |
| HomePage 定向 lint | `final-lint-home.txt` | 基线既有 `react-hooks/purity`＠128 仍 1 error；本批未扩修 |
| 全量客户 lint | `final-lint-customer.txt` vs `baseline-lint-customer.log` | 前后均 65 errors／4 warnings；不宣称全量 lint 绿 |
| 最终六面 | `final-e2e-rerun.txt`／`final-results.json` | 6/6 GREEN，failures=0；有货面与面身份同时成立 |
| diff 卫生 | `git diff --check` | 无输出 |

复跑专项（需本卷所述隔离 API／候选静态预览）：

```bash
NODE_OPTIONS=--experimental-websocket \
CUSTOMER_URL=http://127.0.0.1:7297 \
API_BASE=http://127.0.0.1:7297 \
EVIDENCE_PREFIX=final \
node scripts/pd97-client-pending-swap-clear-check.mjs
```

## 5. 环境红与处置（不掩盖）

- Windows 根 `npm ci`：`server` 嵌套 `npm install` 把父包纳入并递归 `postinstall`，另有 POSIX PATH／`node` 解析问题。两次原始路径均复现后，根 `npm ci --ignore-scripts`＋在 `server` 目录内 `npm ci` 完成等价锁定安装；未改 lockfile／产品脚本。
- Desktop 内置浏览器 `fit` 缩放出现重复帧并误点账号，未用作最终证据；最终由 CDP 真 dist 探针完成，截图逐张人工复核。
- 固定 CDP 端口残留旧会话导致数量按轮次 1→2→3 累加；曾分别出现 checkout／product RED（`final-e2e.txt`／`diagnostic-e2e.txt`）。查实不是产品重复加购：清理仅 PD-97 浏览器，脚本改进程独立端口＋`Browser.close`，干净会话全套重跑才转 6/6 GREEN；残留进程复核为 0。
- 本机基线 js 与现网钉档名称不同，故采用现网下载包＋同机同视口截图双重对照，未仅凭本地 hash 变化报清。

## 6. 数据／禁区与交付边界

- 数据：项目标准 migrate＋seed 创建 PD-97 独立临时单店库（stores=1）；仅通过真实 `mall.createOrder` 创建 5 笔订单（初始 pending，后续由既有超时任务自动转 cancelled）；未支付、未造第二店、未手工直改现网或共享库。
- 禁区：未触 `01M5EQVF`；未跨店造种；未查 USAGE；未开第二产品窗／第三窗；未动其他 WT；未合并、未部署、未启动现网 HIT 例程。
- 更深不更大：客户在店里／路上扫首页、商城与订单时不再撞见「待换」；拦＝真图或诚实缺图说明＋有货面可测；撤＝不把空袋／空结算无字当清，不用 REUSE／SKIP／换 tip 充证。
- 当前状态：**本地候选证据齐，PR 候开／候外部 B 监理；现网仍 `PENDING_MERGE_DEPLOY`。**
- 合部另闸：Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全，DEPLOY／HEALTH×4 同轮新鲜；本卷不领取该结论。
