# PD-37／CJ-1018-03 · 拟人验证修调 N10 卷宗

- 分支：`feat/aesthetic-fix-n10`
- 基线：`11d433747207739243035cc582574a4679a3fe72`
- 范围：只销 N10；Obs3d／Obs3e（开通 › h=20）／N5／O7／O8／O10／五态／读本期／chip／truncate／Obs5f 不施工；已销 Obs5ace／N1～N9 不动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未点会员开通真通道／立即购买／提交／真加购结账；未合并未部署；不判美

## 一、基线复现

`gates/check-before.log` 与 `before-results.json` 为 **0/1**：`/member/open` 开通 deck 共四处 `cf-claim`，最小计算字号 **11px**，均在卡内。基线截图为 `before-n10-member-open.png`。

## 二、修调与范围收窄

- 初版曾把共享 `.m2-cardface .cf-claim` 从 11px 改为 12px，开通 deck 达标。
- 独立评审 agent-21 指出该共享规则会波及会员中心／升级卡面，超出 N10。新增范围外持有卡保持 11px 的断言后，`check-review-before.log` 为 **1/2**，确认范围外也被改为 12px。
- 最终仅保留 `.m2-deck .cf-claim { margin-top: 9px; font-size: 12px; }`，共享 `.m2-cardface .cf-claim` 恢复 11px。最终 diff 仅这一行覆盖，其他 11px 样式、卡高、deck 与会员逻辑未改。

`gates/source-scan.log` 记录：共享卡=11px；开通 deck=12px。

## 三、最终实证

`gates/check-final.log` 与 `final-results.json` 为 **2/2**：

| 场景 | 最终量尺 | 结果 |
|---|---|---|
| 开通 deck 四处副标 | 最小字号 12px；均在卡内 | N10 达标 |
| 范围外持有卡副标 | 字号 11px；在卡内 | 范围未外溢 |

「在册即享基础功能」最终矩形：left=40.220、top=325.166、right=323.780、bottom=343.526；所在卡底 408.806px。其余三处副标也均为 12px 且在 204px 卡高内。截图为 `final-n10-member-open.png` 与 `final-n10-member-center.png`。

## 四、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-all.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck.log` |
| 相关 `MemberOpenPage.tsx` ESLint | exit 0 | `gates/lint-related.log` |
| 专项脚本语法 | exit 0 | `gates/check-script-syntax.log` |
| PD-30 Obs4／Obs6 | 4/4 | `gates/regression-obs46.log` |
| PD-29 N1／N2 | 17/17 | `gates/regression-n1n2.log` |
| PD-31／32 N3／N4 | 19/19 | `gates/regression-n3n4-r2.log` |
| PD-27 B1～B5／O6 | 9/9 | `gates/regression-b1b5.log` |
| PD-27.1 D-60 | 7/7 | `gates/regression-d60.log` |
| PD-28 主专项 | 10/10 | `gates/regression-o-pd28.log` |
| PD-28 状态矩阵 | 8/8 | `gates/regression-o-pd28-state.log` |
| PD-33 N6／N7 | 14/14，独立 7203／7135 | `gates/regression-n6n7.log` |
| PD-34 N8 | 6/6，独立 7202／7134 | `gates/regression-n8.log` |
| PD-35 Obs5ace | 6/6 | `gates/regression-obs5ace.log` |
| PD-36 N9 | 1/1 | `gates/regression-n9.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |

十一组固定专项合计 **101/101**。

## 五、独立只读评审

`review.md` 记录 agent-21 初审 With fixes：共享规则范围外溢为 Important，已按建议收窄到 `.m2-deck` 并以范围外 11px 红绿量尺证明；未追加第二轮评审。初审 Minor 为专项可进一步断言四卡齐全和横向裁切，当前最终 JSON 明确记录四处且均在卡内，本批不扩写。

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-n10-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n10-check.mjs
```

默认客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`。专项只读开通页与会员中心，不点会员开通、购买或提交。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
