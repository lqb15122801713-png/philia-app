# PD-38／CJ-1018-04 · 拟人验证修调 N11｜N12 卷宗

- 分支：`feat/aesthetic-fix-n11n12`
- 基线：`3dd668df65e00e2096cf1f5544cf835770a22721`
- 范围：只销 N11｜N12；Obs3d／Obs3e／N5／O7／O8／O10／五态／读本期／chip／truncate／Obs5f／本轮 Obs1–5（含时段微标9px＋首页图标36）不施工；已销 Obs5ace／N1～N10 不动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未提交预约、未点立即购买／会员开通真通道／真加购结账；未改服务或账本业务；未合并未部署；不判美

## 一、基线复现

`gates/check-before.log` 与 `before-results.json` 为 **0/2**：

- N11：双栏服务副文最小 **9.5px**。
- N12：「余额 ¥0 · 每月 5 日到账」为 **11px**。
- 专用库仅写入一条 `plan_weiguang` 免费会员夹具，用于复现令中账本会员态；不走会员开通接口、不改业务逻辑。

## 二、修调

- `home-v2.css`：仅 `.hv2-mc-col .s` 改为 `12px / line-height:1 / margin-top:2px`。
- `HomePage.tsx`：仅 `home-rebate-guide .cap` 改为 `fontSize:12 / lineHeight:1 / marginTop:2`。
- 付费结算环 `.hv2-mc-ring .cap`、首页图标、其他微标、服务与账本逻辑均未改。

初版字阶曾使 N7 两项净空降到 5px；收紧两处副文行高与上间距后，最终 N6／N7 为 14/14，最紧净空 20.25px。红绿过程见 `review.md`。

## 三、最终实证

`gates/check-final.log` 与 `final-results.json` 为 **2/2**：

| 项 | 文案 | 最终字号与矩形 |
|---|---|---|
| N11 洗澡美容 | 约 45 分钟起 · ¥68 起 | 12px；left=43、top=330.25、right=186.5、bottom=342.25、143.5×12px |
| N11 预约寄养 | ¥199 起/晚 | 12px；left=203.5、top=330.25、right=347、bottom=342.25、143.5×12px |
| N12 回馈金账本 | 余额 ¥0 · 每月 5 日到账 | 12px；left=35、top=391.75、right=160.766、bottom=403.75、125.766×12px |

最终截图为 `final-n11n12-home.png`。

## 四、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-all.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck.log` |
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
| PD-37 N10 | 2/2 | `gates/regression-n10.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |

固定回归合计 **103/103**；N11／N12 专项另为 **2/2**。`HomePage.tsx` 既有 227／235 行 `Date.now()` 纯度错误单列于 `gates/home-lint-preexisting.log`，本批未借题修改。

## 五、独立只读评审

`review.md` 记录 agent-22 评审：Critical 0、Important 0，技术判断 Ready=Yes。唯一 Minor 为证据合计误差；复核后按上表更正为固定回归 103/103，不再误写为 101/101。

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-n11n12-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n11n12-check.mjs
```

默认客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`。专项只读首页并测量 computed style，不提交预约、不点购买或会员开通。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
