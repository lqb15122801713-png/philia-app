# PD-32／CJ-1017-04 · 拟人验证修调 N3｜N4 续修卷宗

- 分支：`feat/aesthetic-fix-n3n4-r2`
- 基线：`3c6069c3efee4920ad2425797c8d118a041d4549`
- 范围：只销 N3｜N4 续修；N5／Obs1＝O7／Obs2＝O8／Obs3＝O10／Obs4五态／Obs5 不施工；已销 N1｜N2｜Obs4｜Obs6｜PD-28 九项／D-56～60 不动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未点提交／开通；未触外部真实支付或会员付费通道；未合并未部署；不判美

## 一、PD-31 点验 FAIL 与本批复现

PD-31 生产点验：N3 合计底 576 > sticky 顶 550（重叠约 26px）；N4 对比链底 553 > sticky 顶 528（重叠约 25px）。数值与 `max()` 失效后回到 PD-31 初版布局的形态一致。

本批 `gates/check-before.log` 为 16/17：16 项视口／inset 布局通过，但 N3／N4 两段均含 `max()`，兼容性硬断言失败。另有 17 项均要求 `clearance >= 8`，防止只靠无重叠布尔值掩盖“差一点”。

## 二、续修

1. **N3**：`index.css` 对应媒体段移除 `max()`，地址卡上下 padding 固定 4px、配送 margin 0、字段 gap 0；其他 792px 以下避让不变。提交、校验、订单与支付逻辑未改。
2. **N4**：`member-v2.css` 对应媒体段移除 `max()`，deck 视觉高度固定 156px；组件 `height={204}` 保留用于 claim 渲染阈值。选档、对比弹层和开通链路未改。
3. **专项**：`scripts/aesthetic-fix-n3n4-check.mjs` 复制为 `aesthetic-fix-n3n4-r2-check.mjs`，新增兼容性检查与所有场景的 ≥8px 净空硬尺。兼容性扫描只提取对应 `@media` 块，标记或块缺失直接 FAIL。

## 三、最终实证

`gates/check-after.log` 与 `check-final.log` 为 **19/19**：16 项视口实测＋N3 793 inset34＋N4 765 inset34＋1 项兼容性检查。

| 项 | 场景 | 最终量尺与行为 |
|---|---|---|
| N3 | inset 0：844／793／792／737／736／700 | 均零滚无遮，净空 94／43／140／85／84／48px |
| N3 | 700 inset 34 | 合计 517–537px，sticky 顶 552px，净空 14px |
| N3 | 793 inset 34 | 合计 615–635px，sticky 顶 645px，净空 9px |
| N3 | 844 inset 34 | 合计 615–635px，sticky 顶 696px，净空 60px |
| N4 | inset 0：844／765／764／737／736／700 | 均零滚无遮，对比弹层可开，claim 可见；净空 122／43／108／81／80／44px |
| N4 | 700 inset 34 | 对比链 500–520px，sticky 顶 530px，净空 10px |
| N4 | 765 inset 34 | 对比链 566–586px，sticky 顶 595px，净空 9px |
| N4 | 844 inset 34 | 对比链 566–586px，sticky 顶 674px，净空 88px |
| 兼容性 | N3／N4 媒体块 | `max()` 均为 false；只扫对应块，标记缺失直接 FAIL |

最终截图使用 `final-n3-checkout-total-<height>-inset<inset>.png` 与 `final-n4-member-compare-<height>-inset<inset>.png` 命名，另存 `final-results.json` 全量坐标。

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

PD-28 状态矩阵一次 O11 换码落在同一秒，秒级 `exp` 相同导致换码=false，记录保留在 `regression-o-pd28-state-same-second.log`；错开秒后复跑为 8/8，未借此修改 PD-28 文件。

## 五、独立评审

评审确认固定避让覆盖 PD-31 FAIL 的 `max()` 失效形态、无裁切或越界，并建议补 793／765 inset34 与精确媒体块扫描。两项已补齐后最终 19/19，复核结论为可开 PR（仅开不合）。详见 `review.md`。

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-n3n4-r2-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n3n4-r2-check.mjs
```

默认地址为客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`，可用 `CUSTOMER_URL`／`API_BASE` 覆盖。脚本只使用本地测试数据，不调用外部支付或会员付费通道。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
