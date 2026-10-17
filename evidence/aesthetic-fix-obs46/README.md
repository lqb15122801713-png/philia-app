# PD-30／CJ-1017-02 · 拟人验证修调 Obs4｜Obs6 卷宗

- 分支：`feat/aesthetic-fix-obs46`
- 基线：`1430ee7fd97523be62ad00fe969bbb3b98a4f2a0`
- 范围：只销 Obs4｜Obs6；Obs1＝O7／Obs2＝O8／Obs3＝O10／Obs5 不施工；N1｜N2／PD-28 九项／D-56～60／O6 不扩业务
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未触外部真实支付或退款通道；未合并未部署；不判美

## 一、基线复现

`gates/check-before.log` 为 0/3：

| 项 | 基线证据 |
|---|---|
| Obs4 390×844／700 | 寄养 `dock=false`、`booking-with-dock=false`、预约激活态为空 |
| Obs6 390×844 | 六个 chip 只有五个完整；“活动”右缘 428px，超过 390px 视口，无法点击 |

基线截图：`before-obs4-boarding-844.png`、`before-obs4-boarding-700.png`、`before-obs6-notify-chips.png`。

## 二、修调

1. **Obs4**：`App.tsx` 仅将 `/booking/boarding` 及尾斜杠纳入 `booking-with-dock` 与 AppDock；向导、成功页和其他详情页不扩。`index.css` 将寄养 ConfirmBar 与洗护同族上移 78px，并按 dock 后的视口重新计算 N2 照片与节距避让，页底保留 14rem。
2. **Obs4 联动**：极短视口疫苗警示隐藏照片时，同一价格节点改为底条内静态布局；默认仍在照片胶囊，不产生第二个价格 DOM。寄养单屏局部抑制 InstallBanner，避免 PWA 引导条与确认按钮争用热区；其他路由不变。
3. **Obs6**：消息分类 chip 改为 `flex-wrap`，窄屏自然换行；筛选、查询、已读、删除和消息跳转逻辑未改。
4. **回归脚本**：新增 `aesthetic-fix-obs46-check.mjs`；`aesthetic-fix-n1n2-check.mjs` 按新现实要求寄养 dock 存在，并增加 ConfirmBar/dock、价格节点数／可见数／非零矩形断言。

## 三、最终实证

`gates/check-final.log` 为 **4/4**：

- Obs4 390×844／700：dock 存在、同族 class 存在、预约 `aria-current=page`；ConfirmBar／dock、房型卡／dock、房型卡／ConfirmBar 均不相交，卡与确认按钮可命中。
- Obs4 iOS Safari：安装条不出现，确认按钮中心命中 `bs-confirm`；修前红证据见 `check-review-before.log`（安装条遮挡且不可点）。
- Obs6：六个 chip 全部完整，活动真实坐标点击成功，页面无横向溢出。

`gates/regression-n1n2-boundaries.log` 为 **17/17**：N1 一项；N2 初始 844／825／824／815／814／701／700／667，疫苗警示 900／901／815／814／734／733／700／667。全部 dock=true、ConfirmBar/dock 不相交、间隙至少 8px、价格为单一可见 DOM 节点、文案异常 0。

最终截图：`final-obs4-boarding-844.png`、`final-obs4-boarding-700.png`、`final-obs4-install-banner.png`、`final-obs6-notify-chips.png`，以及 `regression-n1n2-boundaries/` 下各边界证据。

## 四、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-final.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck-final.log` |
| 修改组件 ESLint／两专项脚本语法 | exit 0 | `gates/customer-lint-final.log`、`gates/check-script-syntax.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |
| PD-27 回归 | 9/9，含 D-59／O6 | `gates/regression-b1b5.log` |
| PD-27.1 回归 | 7/7 | `gates/regression-d60.log` |
| PD-28 主专项 | 10/10，含 O6 与九工单 | `gates/regression-o-pd28.log` |
| PD-28 状态矩阵 | 8/8 | `gates/regression-o-pd28-state.log` |
| PD-29 N1／N2 边界回归 | 17/17 | `gates/regression-n1n2-boundaries.log` |

PD-28 状态矩阵一次 O11 换码落在同一秒，秒级 `exp` 相同导致换码=false，记录保留在 `regression-o-pd28-state-same-second.log`；错开秒后复跑为 8/8，未借此修改 PD-28 文件。

## 五、独立评审

评审发现 PWA 安装条热区冲突与默认价格 DOM 重复，均有修前红证据、修后源码与量尺；复核确认两项 Important 已消除，可开 PR（仅开不合）。详见 `review.md`。

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-obs46-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-obs46-check.mjs
EVIDENCE_DIR=evidence/aesthetic-fix-obs46/regression-n1n2-boundaries EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n1n2-check.mjs
```

默认地址为客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`，可用 `CUSTOMER_URL`／`API_BASE` 覆盖。脚本只使用本地测试数据，不调用外部支付或退款通道。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
