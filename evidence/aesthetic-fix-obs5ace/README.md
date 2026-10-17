# PD-35／CJ-1018-01 · 拟人验证修调 Obs5ace 卷宗

- 分支：`feat/aesthetic-fix-obs5ace`
- 基线：`ae4f51f180d9ac5cfa16f18f7bf8d1ab87b95ba9`
- 范围：只销 Obs5a｜Obs5c｜Obs5e；O7／O8／O10／N5／五态 h=42／读本期 h=32（Obs5d）／消息 truncate（Obs5f）不施工；已销 N1～N8｜Obs4｜Obs6｜PD-28 九项｜D-56～60 不动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未提交预约、未点会员开通／立即购买／提交／真加购结账；未合并未部署；不判美

## 一、基线量尺

`gates/check-before.log` 与 `before-results.json` 为 **0/5**：

| 项 | 基线 |
|---|---|
| Obs5a | 房型副文 9px；同场景 N2 净空 18px |
| Obs5c | 对比链热区 80×20px |
| Obs5e 商详 | 加减热区 30×30px；N8 评价净空 17px |
| Obs5e quick-add | 10 个按钮均 30×30px |
| Obs5e 购物列表 | 加减热区 26×26px |

## 二、修调

1. **Obs5a**：单／多房型副文统一为 `text-caption`（12px），并用 `leading-3` 保持 N2 既有避让；房型数据与预约逻辑未改。
2. **Obs5c**：仅对比链使用 44px 最小热区，向上扩热区并以 12px 本体位移保留下缘；其他 `m2-link` 与会员开通逻辑未改。
3. **Obs5e**：商详、购物列表步进钮及商城 quick-add 均为 44×44px；事件、禁用条件与交易逻辑未改。
4. **quick-add 周边避让**：商品名与价格／返显行预留 48px 右侧空间，避免 44px 按钮与两行名称或付费返显相交。

## 三、最终实证

`gates/check-final.log` 与 `final-results.json` 为 **6/6**：

| 项 | 最终量尺 | 同场回归尺 |
|---|---|---|
| Obs5a | 副文 12px；房型卡底 507.5px | sticky 顶 527px；净空 19.5px |
| Obs5c | 热区 79.6875×44px；链底 520.109px | sticky 顶 530.25px；净空 10.141px；中心命中 |
| Obs5e quick-add | 10 个按钮均 44×44px | 两行名称叠=false；付费返显叠=false |
| quick-add 内容避让 | 按钮 x=133–177、y=490.234–534.234 | 名称文字最右 123.5；返显最右 125.422，均不与按钮相交 |
| Obs5e 商详 | 两个按钮均 44×44px | N8 评价净空 17px |
| Obs5e 购物列表 | 两个按钮均 44×44px | 本地 localStorage 夹具，无真加购 |

截图为 `final-obs5a-*.png`、`final-obs5c-*.png`、`final-obs5e-*.png`。

## 四、评审发现的回退与修复留痕

- **N2 行高**：初版 12px／16px 行高使 N1／N2 一度 13/17、四个边界净空 6px；改 `leading-3` 后最终 17/17，最紧边界恢复 ≥9.5px。
- **独立评审**：agent-19 初审为 With fixes，指出 quick-add 与付费返显／两行名称相交（Important）及对比链下划线脱离（Minor）。新增内容矩形检查后，`check-review-before.log` 为 4/6：名称叠=true、返显叠=true，付费态 N4 净空 -2px。
- **修复**：名称与价格／返显行右侧预留 48px，quick-add 相交项归零；对比链本体向上 12px 后，付费态净空恢复 10.141px，下划线随本体归位。最终 6/6，未追加第二轮评审。

详见 `review.md` 与 `check-review-before.log`／`check-review-after.log`／`check-review-after2.log`。

## 五、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-all.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck.log` |
| 五个修改 TSX 文件 ESLint | exit 0 | `gates/lint-targeted.log` |
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
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-obs5ace-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-obs5ace-check.mjs
```

默认客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`。专项使用既有种子客户／宠物／标准间与本地购物车夹具，不创建宠物或预约，不触发会员开通、购买、加购或提交。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
