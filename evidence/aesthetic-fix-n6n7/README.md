# PD-33／CJ-1017-05 · 拟人验证修调 N6｜N7 AppDock 卷宗

- 分支：`feat/aesthetic-fix-n6n7`
- 基线：`e15c5e73b6bc6f4c8942d1ea95bea372e315b062`
- 范围：只销 N6｜N7；Obs×5／N5／O7～O10／Obs5a／Obs5c 不施工；已销 N1～N4｜Obs4｜Obs6｜PD-28 九项／D-56～60 不动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未点支付／提交／开会员／建宠；未合并未部署；不判美

## 一、基线复现

`gates/check-before.log` 为 2/4，量尺见 `before-results.json`：

| 项 | 视口 | 基线证据 |
|---|---|---|
| N6 | 390×844 | 首行价与售罄均清出 dock，净空 71／48px |
| N6 | 390×700 | 首行价 641–661px，dock 顶 588px，净空 -73px；售罄 665–684px，净空 -96px；命中 dock |
| N7 | 390×844 | 空宠引导清出 dock，净空 103px；管理 44×44 可见 |
| N7 | 390×700 | 空宠引导 585.5–629.5px，dock 顶 588px，净空 -41px；命中 dock 中央钮 |

安装条回归红证据为 `gates/check-pwa-before.log`：iOS Safari UA 下安装条仍出现并遮挡目标，0/14。基线截图为 `before-*.png`。

## 二、修调

1. **N6**：`MallPage.tsx` 增加 `mall-product-image` 与 `mall-hero-media`；`index.css` 在 `max-height:804px` 将 hero 比例调为 21/7、商品图比例调为 3/1，内层图片使用 `object-fit:contain`，并将配送、入口、搜索、分类和商品网格顶部间距收紧为 8px。商品、库存、购物车与支付逻辑未改。
2. **N7**：`HomePage.tsx` 根节点增加 `home-page` 选择器；`home-v2.css` 在 `max-height:766px` 压缩 banner、统计、身份带与毛孩子区间距。无运营文案时 banner-space 为 100px，有文案时为 165px；`home-entry-card` 原 `-16px` 不变。空宠引导、管理入口、建宠与会员业务逻辑未改。
3. **安装条避让**：`App.tsx` 将既有寄养路由安装条抑制扩至 `/`、`/home`、`/mall`（含商城尾斜杠），其他路由行为不变。
4. **专项**：`scripts/aesthetic-fix-n6n7-check.mjs` 使用真实浏览器和 iOS Safari UA，检查首行价、售罄标、空宠引导、管理按钮、安装条、图片 fit、中央凸钮 transformed rect＋3px outline、身份带文字、`.ac` 与会员码完整矩形。夹具写库仅限路径含 `aesthetic-fix-n6n7` 的本地专用库。

## 三、最终实证

`gates/check-final.log` 与 `final-results.json` 为 **14/14**，全部 `scrollY=0`、`bannerPresent=false`：

| 项 | 视口 | 最终量尺 |
|---|---|---|
| N6 | 390×844 | 价净空 71px；售罄净空 48px；fit=cover |
| N6 | 390×804 | 价净空 169px；售罄净空 146px；fit=contain |
| N6 | 390×803 | 价净空 168px；售罄净空 145px；fit=contain |
| N6 | 390×751 | 价净空 116px；售罄净空 93px；fit=contain |
| N6 | 390×750 | 价净空 115px；售罄净空 92px；fit=contain |
| N6 | 390×700 | 价净空 65px；售罄净空 42px；fit=contain |
| N6 | 390×667 | 价净空 32px；售罄净空 9px；fit=contain |
| N7 | 390×844 | 引导净空 88px；中央凸钮顶 717px；管理 44×44 可命中 |
| N7 | 390×766 | 引导净空 120px；中央凸钮顶 639px；管理可命中 |
| N7 | 390×767 | 引导净空 11px；中央凸钮顶 640px；管理可命中 |
| N7 | 390×700 | 引导净空 54px；中央凸钮顶 573px；管理可命中 |
| N7 | 390×667 | 引导净空 21px；中央凸钮顶 540px；管理可命中 |
| N7 文案态 | 390×700 | 引导净空 44px；banner 高 165px；`.ac`／会员码与服务大卡零相交 |
| N7 文案态 | 390×667 | 引导净空 11px；banner 高 165px；`.ac`／会员码与服务大卡零相交 |

最终截图为 `final-n6-*.png` 与 `final-n7-*.png`。N6 最紧售罄净空 9px，N7 最紧文案态净空 11px，均满足 ≥8px 且零重叠。

## 四、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 客户端最终构建 | exit 0 | `gates/build-final.log` |
| 三端 `npm run build` | exit 0 | `gates/build-all.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck.log` |
| 专项脚本语法 | exit 0 | `gates/script-syntax.log` |
| `App.tsx`／`MallPage.tsx` ESLint | exit 0 | `gates/lint-targeted.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |
| PD-27 回归 | 9/9，含 D-59／O6 | `gates/regression-b1b5.log` |
| PD-27.1 回归 | 7/7 | `gates/regression-d60.log` |
| PD-28 主专项 | 10/10，含 O6 与九工单 | `gates/regression-o-pd28.log` |
| PD-28 状态矩阵 | 8/8 | `gates/regression-o-pd28-state.log` |
| PD-29 N1／N2 回归 | 17/17 | `gates/regression-n1n2.log` |
| PD-30 Obs4／Obs6 回归 | 4/4 | `gates/regression-obs46.log` |
| PD-31／32 N3／N4 回归 | 19/19 | `gates/regression-n3n4-r2.log` |

`HomePage.tsx` 全文件 lint 仍有基线 227／235 行 `Date.now()` 纯度错误，本批未借题回改；留痕见 `gates/home-lint-preexisting.log`。

`smoke-deploy-stock0-fixture.log` 保留 N6 售罄夹具导致的两项库存断言失败：Mock 脚本选取的第一个在售商品正是专项置为 stock=0 的「全价成犬粮 2kg」。`fixture-stock-restore.log` 记录在同一专用库将该商品恢复为种子库存 50，随后 `smoke-deploy-final.log` 全部通过；未改业务源码。

## 五、独立只读评审

`review.md` 记录 agent-17 对工作树 diff、专项断言、截图和闸门日志的独立评审：Critical 0、Important 0，技术判断 Ready=Yes。唯一 Minor 为 compact 文案态 `.qr` 高 32px 的触控热区建议；本批不扩范围回改，记为后续非阻塞项。

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-n6n7-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n6n7-check.mjs
```

默认地址为客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`，可用 `CUSTOMER_URL`／`API_BASE` 覆盖。专项每次会重建售罄与空宠夹具；若之后复跑 Mock `smoke-deploy`，须先恢复专用库夹具库存。脚本不调用外部支付或会员付费通道。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
