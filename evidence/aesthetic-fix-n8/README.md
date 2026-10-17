# PD-34／CJ-1017-06 · 拟人验证修调 N8 sticky 卷宗

- 分支：`feat/aesthetic-fix-n8`
- 基线：`6f6096712a6fa5901ddd51bbb118104ce1e082e8`
- 范围：只销 N8；Obs5a／Obs5c／Obs5e／Obs5d／新Obs／N5／O7～O10 不施工；已销 N1～N7｜Obs4｜Obs6｜PD-28 九项｜D-56～60 不动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未点立即购买／提交／支付／退款／开会员／建宠；未合并未部署；不判美

## 一、基线复现

`gates/check-before.log` 与 `before-results.json` 为 **2/6**。两种商品在 844 均正常，700／667 均复现评价空态与 fixed 购买栏重叠：

| 商品 | 视口 | 基线净空 |
|---|---|---:|
| 幼犬奶糕粮 | 390×700 | -51px |
| 幼犬奶糕粮 | 390×667 | -84px |
| 售罄成犬粮 | 390×700 | -44px |
| 售罄成犬粮 | 390×667 | -77px |

售罄态 700 基线评价卡为 545–634px，与令包底边 634px 一致。基线截图为 `before-n8-*.png`。

## 二、根因与修调

购买栏使用 `fixed`，不参与文档流；仅增加页面底垫不能改变零滚时评价卡的位置。为此只调整图区媒体高度：

- `ProductDetailPage.tsx`：图区使用 `pdp-gallery-media`，不加业务逻辑。
- `index.css`：保留 `height:270px` 回退，再以 `clamp(140px, calc(100dvh - 498px), 270px)` 在短视口收缩图区；高视口仍封顶 270px。
- 未改评价、库存、数量步进、加购、立即购买、提交或支付逻辑；Obs5e 控件未动。

## 三、最终实证

`gates/check-final.log` 与 `final-results.json` 为 **6/6**，全部 `scrollY=0`、评价中心命中 `pdp-reviews`、空态双文案完整、零重叠：

| 商品 | 视口 | 评价卡坐标 | 购买栏顶 | 净空 | 图高 |
|---|---|---|---:|---:|---:|
| 幼犬奶糕粮 | 390×844 | 526.25–615.25 | 708 | 92.75px | 270px |
| 幼犬奶糕粮 | 390×700 | 458.25–547.25 | 564 | 16.75px | 202px |
| 幼犬奶糕粮 | 390×667 | 425.25–514.25 | 531 | 16.75px | 169px |
| 售罄成犬粮 | 390×844 | 545.25–634.25 | 734 | 99.75px | 270px |
| 售罄成犬粮 | 390×700 | 477.25–566.25 | 590 | 23.75px | 202px |
| 售罄成犬粮 | 390×667 | 444.25–533.25 | 557 | 23.75px | 169px |

最终截图为 `final-n8-*.png`。售罄态购买按钮保持 disabled，未点击任何购买或提交控件。

## 四、专项与固定闸门

`scripts/aesthetic-fix-n8-check.mjs` 使用真实 Chromium CDP，覆盖两种商品×844／700／667；断言坐标、scrollY、净空、命中、空态文案与售罄禁用，并强制六项结果齐全。写库仅限路径含 `aesthetic-fix-n8` 的专用库，正常路径恢复售罄夹具库存。

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-all.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck.log` |
| `ProductDetailPage.tsx` ESLint | exit 0 | `gates/lint-targeted.log` |
| 专项脚本语法 | exit 0 | `gates/check-script-syntax.log` |
| PD-30 Obs4／Obs6 | 4/4 | `gates/regression-obs46.log` |
| PD-29 N1／N2 | 17/17 | `gates/regression-n1n2.log` |
| PD-31／32 N3／N4 | 19/19 | `gates/regression-n3n4-r2.log` |
| PD-27 B1～B5／O6 | 9/9 | `gates/regression-b1b5.log` |
| PD-27.1 D-60 | 7/7 | `gates/regression-d60.log` |
| PD-28 主专项 | 10/10 | `gates/regression-o-pd28.log` |
| PD-28 状态矩阵 | 8/8 | `gates/regression-o-pd28-state.log` |
| PD-33 N6／N7 | 14/14，独立 7202／7134 环境 | `gates/regression-n6n7.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |

## 五、独立只读评审

`review.md` 记录 agent-18 评审：Critical 0、Important 0，技术判断 Ready=Yes。两项非阻塞 Minor 均为专项脚本加固：

1. 844 图高目前只记录未纳入 `ok`，后续可补图高与 767／768 边界断言。
2. `prepareFixtures()` 位于 `try` 前，异常中途可能留下部分夹具状态；后续可将准备阶段也纳入恢复区并快照原值。

本批不借评审建议扩写范围；当前六场景实测与高视口坐标均已有证据。

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-n8-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n8-check.mjs
```

默认客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`，可用 `CUSTOMER_URL`／`API_BASE` 覆盖。脚本不点击购买、提交、会员或建宠通道。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
