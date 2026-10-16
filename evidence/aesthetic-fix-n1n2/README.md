# PD-29／CJ-1017-01 · 拟人验证修调 N1｜N2 卷宗

- 分支：`feat/aesthetic-fix-n1n2`
- 基线：`af65ab44f438a3b121bc2211f87f2d54bed87051`
- 范围：只销 N1｜N2；Obs／O7／O8／O10 不施工，D-56～D-60／O6／PD-28 九项不改
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未触外部真实支付或退款通道；未合并未部署；寄养页未加 dock

## 一、基线复现

`gates/check-before.log` 为 1/3，基线量尺见 `before-results.json`：

| 项 | 视口 | 基线证据 |
|---|---|---|
| N1 | 390×844 | 次卡选项 631–697px，ConfirmBar 从 644px 起；两行文案均被压 |
| N2 | 390×844 | 房型卡 423–634px，ConfirmBar 从 749px 起；本视口未复现 |
| N2 | 390×700 | 房型卡 423–634px，ConfirmBar 从 605px 起；标准间名称、副名和余量均被压 |

基线截图：`before-n1-payment-pass.png`、`before-n2-boarding-standard-room-844.png`、`before-n2-boarding-standard-room-700.png`。

## 二、修调

1. `ExtrasBlock.tsx`：收款 accordion 展开后，将选项滚动到带 15rem `scroll-margin-bottom` 的安全区；该安全区覆盖既有固定 ConfirmBar 与洗护 dock。支付模式、次卡接口和 accordion 形态均未改。
2. `RoomTypeBlock.tsx`／`index.css`：按视口高度动态收缩房型照片；在更短视口收紧页首与房型前节距。疫苗警示抬高 ConfirmBar 时使用对应避让规则，保留价格胶囊、底条文案和至少 8px 间隙；寄养数据与提交逻辑未改。
3. `scripts/aesthetic-fix-n1n2-check.mjs`：零依赖 CDP 回归，使用本地隔离库准备真实可用次卡，测量矩形、遮挡、视口与 `elementFromPoint`。N1 先硬断言切到到店付，再做坐标点击并断言切回次卡；N2 覆盖初始与疫苗警示状态。

独立评审曾指出固定 120px 在 390×667 失效、疫苗警示未覆盖及 N1 中间态可能假绿。对应红证据见 `gates/check-review-before.log`（2/6），修后量尺见 `gates/check-review-after.log`（6/6）。

## 三、最终实证

`gates/check-final.log` 为 6/6，明细见 `final-results.json`：

| 项 | 状态／视口 | 最终量尺与行为 |
|---|---|---|
| N1 | 390×844 | 次卡选项 526–592px，ConfirmBar 从 644px 起；到店付中间态=true；坐标点击切到次卡=true；文案被压 0 |
| N2 | 初始 390×844 | 零滚；房型卡 423–634px，ConfirmBar 从 749px 起；间隙 115px；dock=false |
| N2 | 初始 390×700 | 零滚；房型卡 367–578px，ConfirmBar 从 605px 起；间隙 27px；dock=false |
| N2 | 初始 390×667 | 零滚；房型卡 367–564px，ConfirmBar 从 572px 起；间隙 8px；dock=false |
| N2 | 疫苗警示 390×700 | 零滚；房型卡 381–525px，ConfirmBar 从 533px 起；间隙 8px；价格与底条文案完整 |
| N2 | 疫苗警示 390×667 | 零滚；房型卡 381–492px，ConfirmBar 从 500px 起；间隙 8px；价格与底条文案完整 |

最终截图：`final-n1-payment-pass.png`，以及 `final-n2-boarding-standard-room-` 下的 844／700／667 与 vaccine-700／vaccine-667 五张房型证据。

## 四、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-final.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck-final.log` |
| 修改组件 ESLint／专项脚本语法 | exit 0 | `gates/customer-lint-final.log`、`gates/check-script-syntax.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |
| PD-27 回归 | 9/9，含 D-59／O6 时段格无压 | `gates/regression-b1b5.log` |
| PD-27.1 回归 | 7/7 | `gates/regression-d60.log` |
| PD-28 主专项 | 10/10，含 O6 与九工单 | `gates/regression-o-pd28.log` |
| PD-28 状态矩阵 | 8/8 | `gates/regression-o-pd28-state.log` |

辅助状态矩阵首次误连 N1/N2 库，缺少其专用夹具，记录保留在 `regression-o-pd28-state-invalid-fixture.log`；改用 PD-28 专用库与 7133／7201 隔离端口后进入真实检查。另一次 O11 换码断言落在同一秒，HMAC payload 的秒级 `exp` 相同，记录保留在 `regression-o-pd28-state-same-second.log`；错开秒后复跑为 8/8。PD-28 主专项复跑前，状态矩阵给共享夹具用户新增的测试宠物使空态前置不成立，记录在 `regression-o-pd28-fixture-pet.log`；清理该测试宠物后复跑为 10/10。上述记录均非本批源码回退，未借此修改 PD-28 文件。

## 五、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-n1n2-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n1n2-check.mjs
```

默认地址为客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`，可用 `CUSTOMER_URL`／`API_BASE` 覆盖。脚本只写本地测试数据，不调用外部支付或退款通道。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
