# PD-91 · 商家端发货独立确认层卷宗

- 窗口：`PD-91-merchant-ship-confirm-gate`
- 分支：`feat/pd91-merchant-ship-confirm-gate`
- 基线：`main@6eb5bf0241d5d5ba7249af87d9353a120f01519e`
- 对照：DEPLOY `20261023220749`／商家 `index-DYnZSVSy.js`
- 主线：`SHIP_NO_MODAL_OR_INLINE`／`AE-MERCHANT-R32-01`
- 零 schema：预分 `0132` 故意空留；`0117／0119／0122–0130` 未占。

## 根因复核

基线首击「发货 ›」已有首层物流表单 `role=dialog`，并有取消／确认发货；因此不能把“首层完全不存在”当作代码事实。真实缺口在首层之后：输入物流单号，点击确认或按 Enter 会直接调用 `mall.shipOrder`，最终履约写请求前没有第二道独立确认闸。

- 基线首层：`shots/baseline/02-independent-first-layer.png`
- 基线直接提交：`baseline-result.json` 的 `form confirm is held before ship mutation` 失败，`shipMutationCalls=1`
- 基线提交后帧：`shots/baseline/04-independent-confirm-gate.png`

## 产品改动（仅两个商家文件）

- `apps/merchant/src/components/mall-admin/ShipOrderDialog.tsx`
  - 首层物流表单保留；按钮与 Enter 统一只进入 `requestShip`，不得直接 mutation。
  - 第二道独立 Modal 明示“确认后将订单标记为已发货”，复核订单号与 trim 后物流单号。
  - 取消／Esc／overlay 返回表单；首层取消仍整层关闭；只有最终 `confirmShip` 调用原 `mall.shipOrder`。
  - pending 时取消／确认不可用；错误后确认层保留并恢复 CTA。
- `apps/merchant/src/components/mall-admin/ui.tsx`
  - `Modal` 新增默认 `false` 的 `closeDisabled`；确认层 pending 时同步约束 X／Esc／overlay，其他调用方默认行为不变。
- 未改服务端、数据库、订单履约接口或其他商家域；无 migration 文件。

## 更深不更大

- 谁在压力下点：店主在待发货列表误点「发货 ›」，怕直接标已发。
- 拦：首层之后的独立确认闸；最终确认前不发履约写请求。
- 撤：cancel 与 Esc 均有 acted＋closed 证据；overlay 在 pending 时不可伪装撤销。
- 禁真发：所有订单、身份与 tRPC 均为本地 mock；独立 finalize 场景也只改变内存 mock，不触达真实订单。

## 行为证据

| 场景 | 命令／文件 | 结果 |
|---|---|---|
| 基线对照 | `PD91_PHASE=baseline node --experimental-websocket evidence/pd91-merchant-ship-confirm-gate/ship-confirm-gate.mjs` | 预期红灯：首层确认后 `shipCalls=1` |
| 防误发主回归 | 同上，`PD91_PHASE=after` | 20/20；独立层、双 CTA、cancel、Esc、Enter 防绕过；`shipMutationCalls=[]` |
| 审查目标红灯 | `PD91_SCENARIO=finalize PD91_PHASE=review-red ...` | 预期红灯：pending X `disabled=false` |
| 最终确认／pending／错误 | `PD91_SCENARIO=finalize PD91_PHASE=finalize ...` | 16/16；成功 mock 1 次、rejection mock 1 次、trim payload、pending 控件、错误留层 |
| Desktop 独立复核 | `desktop-result.json` | 8/8；内置浏览器双 CTA、cancel 闭环、订单仍待发、零 mock ship |

关键帧：

- 独立确认层＋双 CTA：`shots/after/04-independent-confirm-gate.png`
- cancel 返回表单：`shots/after/05-confirm-cancel-returned.png`
- Esc 全撤且仍待发：`shots/after/06-esc-closed-no-ship.png`
- pending 控件：`shots/finalize/01-pending-controls.png`
- 成功 mock：`shots/finalize/02-final-success.png`
- rejection 留层：`shots/finalize/03-final-rejection.png`

## 构建与静态检查

详见 `validation.json`。

- `npm run build`：三端构建命令执行成功。
- 最新本地商家 dist：`index-B8zXBmuD.js`，不同于 `index-DYnZSVSy.js`。
- dist SHA-256：`4778d848bd3217ad02367053d6cfacd204311fa86e7506ceeac1b61ba71f6e77`；`apps/merchant/dist/index.html` 已核对引用同名文件。
- merchant 现有单测：10/10。
- `ShipOrderDialog.tsx` eslint 通过；`ui.tsx` 屏蔽基线已有的 `numStyle` Fast Refresh 规则后无其他问题。
- 全量 merchant lint：基线与修改后均为 47 errors／5 warnings，新增 0；本单不扩修其他页面。
- `git diff --check` 通过；复核两项 Important 关闭，无新 Critical/Important。

环境注记：Windows 下根 `npm ci` 的既有递归 postinstall 失败；审查该脚本后分步安装根/server 依赖并跳过该递归脚本。Node 20 浏览器探针使用自带 `--experimental-websocket`，未新增产品依赖。

## HIT 状态

- 本包只开 PR，不合并、不部署；未启动 HIT 例程。
- `index-B8zXBmuD.js` 是本地候选包，**不是合部同源 tip 现网包**，不得据此认领现网结果。
- 合后须另取 tip 现网商家包，核对其 js 文件名仍不同于 `index-DYnZSVSy.js`，再按同一误点／成对 CTA／撤路／未真发口径补现网证据。
