# PD-31／CJ-1017-03 · 拟人验证修调 N3｜N4 卷宗

- 分支：`feat/aesthetic-fix-n3n4`
- 基线：`f79e7964575b8c08038c4850d8023295a8432bc1`
- 范围：只销 N3｜N4；N5／Obs1＝O7／Obs2＝O8／Obs3＝O10／Obs4五态／Obs5 不施工；已销 N1｜N2｜Obs4｜Obs6｜PD-28 九项／D-56～60 不动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未点提交／开通；未触外部真实支付或会员付费通道；未合并未部署；不判美

## 一、基线复现

`gates/check-before.log` 为 2/4，量尺见 `before-results.json`：

| 项 | 视口 | 基线证据 |
|---|---|---|
| N3 | 390×844 | 合计 615–635px，提交栏从 730px 起；未复现 |
| N3 | 390×700 | 合计 615–635px，提交栏从 586px 起；合计行被压且中心不可命中 |
| N4 | 390×844 | 对比链 566–586px，开通栏从 708px 起；未复现 |
| N4 | 390×700 | 对比链 566–586px，开通栏从 564px 起；对比链被压且无法开对比弹层 |

基线截图：`before-n3-checkout-total-844.png`、`before-n3-checkout-total-700.png`、`before-n4-member-compare-844.png`、`before-n4-member-compare-700.png`。

## 二、修调

1. **N3**：`CheckoutPage.tsx` 增加 checkout-* 语义类；`index.css` 在 `max-height:792px` 压缩页首、地址卡、配送方式、字段间距、输入框、商品清单与合计行的纵向间距，并让地址卡、配送和字段间距随 `env(safe-area-inset-bottom)` 动态收缩。提交逻辑、表单校验、支付与订单链路未改。
2. **N4**：`MemberOpenPage.tsx` 增加测算注与对比链语义类；`member-v2.css` 在 `max-height:764px` 调整 deck 视觉高度并收紧对比链上方间距。组件 `height={204}` 保留用于 claim 渲染阈值，视觉高度随 inset 减少，选档、对比弹层和开通链路未改。
3. **专项**：`scripts/aesthetic-fix-n3n4-check.mjs` 使用真实浏览器和本地测试数据；只加购一件商品，不点提交；N4 仅开／关对比弹层，不点开通。N3 记录各语义类 computed style，N4 每场景断言 claim 非空且位于卡内；inset 由 `Emulation.setSafeAreaInsetsOverride` 真实模拟。

中间 `check-after.log` 曾显示 N3 仍遮；量尺证明选择器均生效，但新设 padding 比原值更大。修正后 `check-after2.log` 为 4/4。独立评审随后补充断点与 inset 场景，`check-review-before.log` 为 13/16，修后 `check-review-after.log` 与 `check-final.log` 均为 16/16。

## 三、最终实证

`gates/check-final.log` 为 **16/16**：

| 项 | 场景 | 最终量尺与行为 |
|---|---|---|
| N3 | inset 0：844／793／792／737／736／700 | 均零滚无遮；737 合计 557–577px，提交栏从 623px 起；844 保持基线位置 |
| N3 | 700 inset 34 | 合计 517–537px，提交栏从 552px 起；中心命中自身 |
| N3 | 844 inset 34 | 合计 615–635px，提交栏从 696px 起；中心命中自身 |
| N4 | inset 0：844／765／764／737／736／700 | 均零滚无遮且可开对比弹层；claim 非空且在卡内 |
| N4 | 700 inset 34 | 对比链 500–520px，开通栏从 530px 起；可开对比弹层，claim 非空且在卡内 |
| N4 | 844 inset 34 | 对比链 566–586px，开通栏从 674px 起；可开对比弹层，claim 非空且在卡内 |

最终截图使用 `final-n3-checkout-total-<height>-inset<inset>.png` 与 `final-n4-member-compare-<height>-inset<inset>.png` 命名，共 16 张，另存 `final-results.json` 全量矩形与 computed style。

## 四、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-final.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck-final.log` |
| 修改页面 ESLint／专项脚本语法 | exit 0 | `gates/customer-lint-final.log`、`gates/check-script-syntax.log` |
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

## 五、独立评审

初审指出 N3 断点空洞、两项 inset 失效与 N4 claim 双数据源。修后复核确认断点、安全区与 claim 均已销项，可开 PR（仅开不合）。详见 `review.md`。

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-n3n4-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n3n4-check.mjs
```

默认地址为客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`，可用 `CUSTOMER_URL`／`API_BASE` 覆盖。脚本只使用本地测试数据，不调用外部支付或会员付费通道。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
