# PD-96 · 商家端关店侧栏入口卷宗

- 基线：`main@33f92d545a7691aa334aecd7ca401668692cc344`
- WORKTREE：`E:\KIMI code\pd96-merchant-hq-sidebar-entry`
- BRANCH：`feat/pd96-merchant-hq-sidebar-entry`
- 对照部署：`DEPLOY 20261025205907`；现网商家包 `index-ZxpJoGaZ.js`
- 迁移：零 schema、零 migration；**0137 故意空留**。未占 `0117／0119／0122–0136`，未预分或占 `0138`。
- 边界：本卷宗是代码与本地候选证据，不是现网 HIT 或验收结论；PR 只开不合、不部署。

## 根因与最小产品改动

`/hq` 路由、PD-94 总部台与关店 CTA 均在，但 `MerchantRail` 的既有「总部台」项仅 `role.isOwner` 可见，店长只能依赖地址栏直达，形成侧栏可发现性缺口。

产品 diff 仅两个商家端文件、4 增 4 删：

- `apps/merchant/src/components/MerchantRail.tsx`：同一 `rail-hq-console` 原生 `NavLink` 的显示条件改为 `role.canManage`，即 owner／manager 均可见可点；路由、图标、文案、testid、位置均复用。clerk 提前分流不变。
- `apps/merchant/src/copy/console.ts`：仅同步入口角色注释，无文案或行为变化。

未改 `HqConsolePage`、`App.tsx`、server、`merchantOwnerProcedure`、schema、员工端或客户端；未重开 PD-89／91／93／94／95；未扩驾舱／传感器／相册／日结。

## 更深不更大

- 谁在压力下点：店长／店主在店里慌时从侧栏找关店入口，不会记 `/hq`。
- 拦：侧栏可达＋既有独立确认层；店长最终确认仍禁用，店主也有知晓勾与 server 硬闸。
- 撤：经侧栏进入后，CTA→独立层→cancel 成对；未点确认关闭，未真关、不可逆写为零。

## RED → GREEN 与运行证据

| 腿 | 结果 | 关键证据 |
|---|---|---|
| 冻结基线 manager | 有效 RED | 从 `/matrix` 出发，`HQ_SIDEBAR_ENTRY_NOT_SEEN actual=false expected=true`；`baseline-manager-result.json`／`baseline-manager.txt`／`shots/baseline/manager/` |
| 最终 manager | 14/14 | 原生侧栏链接可见、点击到 `/hq`、CTA、独立层、cancel acted+closed；三类写调用空；`after-manager-result.json` |
| 最终 owner | 14/14 | 同一侧栏路径与 cancel 回归；未执行真实关店；`after-owner-result.json` |
| Desktop 内置浏览器 | 候选复走 | 关闭 device emulation 后，从 `/matrix` 点「总部台」到 `/hq`，CTA→dialog→cancel；`desktop-browser.json` |

所有 CDP 腿直接读取商家生产 `dist`，由同源 HTTP 提供静态包和内存 mock tRPC；禁用 Service Worker 与缓存，使用真实鼠标事件。mock 仅替代账号、门店和 API 数据；UI、路由、链接、CTA、弹层与 cancel 均运行真实产品代码。`mockOnly=true`、`hit=false`，localhost 不递补现网结论。

复跑命令（仓库根目录）：

```bash
node --experimental-websocket evidence/pd96-merchant-hq-sidebar-entry/sidebar-hq-path.mjs
PD96_PHASE=baseline PD96_ROLE=manager node --experimental-websocket evidence/pd96-merchant-hq-sidebar-entry/sidebar-hq-path.mjs
PD96_PHASE=after PD96_ROLE=manager node --experimental-websocket evidence/pd96-merchant-hq-sidebar-entry/sidebar-hq-path.mjs
PD96_PHASE=after PD96_ROLE=owner node --experimental-websocket evidence/pd96-merchant-hq-sidebar-entry/sidebar-hq-path.mjs
node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/merchant/tsconfig.app.json --test apps/merchant/src/pages/appointmentDetail.utils.test.ts apps/merchant/src/components/mall-admin/format.test.ts apps/merchant/src/components/dashboard/utils.test.ts apps/merchant/src/components/cashier/model.test.ts
npm run build
```

注意：baseline 复跑用于保留缺陷证据，会覆盖同名 baseline 结果且应以预期 RED 退出；after 复跑前需先构建候选。当前 Node 20 需 `--experimental-websocket`。

## 构建、lint 与独立审查

- `npm run build`：customer／merchant／staff 三端 exit 0；`build-final.txt`。
- 商家既有测试：10/10，fail=0；`unit-final.txt`。这些既有用例不冒充 PD-96 专项路径覆盖，专项由上述浏览器探针承担。
- 定向 ESLint：`npx eslint src/components/MerchantRail.tsx src/copy/console.ts`（cwd `apps/merchant`）exit 0；`lint-target.txt` 明示仅覆盖两个变更文件，不外推全端 lint。
- `git diff --check`：exit 0；零 server／schema diff。
- 独立 B 初审无 Critical／Important；两项证据 Minor 已收尾并经同一会话只读复核 closed，最终 Ready to open PR=Yes。详见 `independent-review.md`。

### 其他见红与恢复（不冒充产品 RED）

- 首次建树因本地缺冻结对象见红；仅 fetch `origin main` 取得 `33f92d5` 后重建，未重置或合入本地 main。
- 根 `npm ci` 的 Windows postinstall 在 Git Bash 递归见红；分开执行根与 server 的 `npm ci --ignore-scripts`，随后正常执行全部 build／test 脚本，未改项目安装脚本。
- 首次探针因 Node 20 无默认 WebSocket 而未到产品断言；加运行时开关后才取得有效 RED。
- Desktop `fit=0.8` 下发生工具坐标误点及快照异常，未据此改产品；关闭 device emulation 后完整复走。细节在 `desktop-browser.json`。

## Bundle 与现网只读对照

| 包 | 文件名 | SHA-256 | 是否现网 tip 包 |
|---|---|---|---|
| 现网只读对照 | `index-ZxpJoGaZ.js` | `14d477f68684f9a9c90b9d744a7bd8e7425dfc7777d1d875fdbcd2445b5fd663` | 与 PD-94 钉档包一致；本窗未合未部 |
| 本地冻结基线 | `index-Bzkt2irq.js` | `3384bb31cc3c43c8c90d8e449fa0d0345ea77d7c32e46d6b06ccd176b8cd41a3` | 否，仅 RED 对照 |
| 本地最终候选 | `index-Bh5WsuOY.js` | `bc5ad0849a6efe59b60f76f40e565425be13bba12ee9c85c7adbfe43a8475362` | 否；合部前候选 |

候选名称与内容均异于现网对照。`live-probe.json` 记录现网 index 与资产 hash 的只读获取结果；未绕口令、未做现网业务写。

## 交付 HIT 表（候选与现网分开）

| 原缺陷／门槛 | 当前证据 | 状态 |
|---|---|---|
| 店长侧栏无总部台入口 | baseline RED vs after manager／owner 原生链接与帧 | 本地候选覆盖；现网待合部后核 |
| 只靠地址栏直达 `/hq` | `/matrix`→真实点击侧栏→`/hq`，CDP 与 Desktop 双路径 | 本地候选覆盖；现网待核 |
| 经路径 CTA＋开闸＋cancel | 两角色各 14 项；dialog 1→0、cancel acted+closed | 本地候选覆盖；现网待核 |
| 未真关不可逆 | close/reopen/clone 调用均空；同一 mock 店 active；无第二店、无数据库 | 候选边界成立；现网只核 cancel 零写 |
| 新商家 js 异于 `index-ZxpJoGaZ.js` | 候选 `index-Bh5WsuOY.js` 名称与 SHA-256 均不同 | 候选成立；合后现网新名待核 |
| 合部同源 tip 现网包／HIT | 本窗不合、不部署；现网仍为对照包 | **PENDING_MERGE_DEPLOY；未启动现网 HIT** |

## 禁区与自清

未触夹具 `01M5EQVF`，无第二店、无跨店造种、无真实关店、无日结或资金操作；所有 API 数据为单店内存 mock。临时 Desktop tab 与 mock 服务均已关闭，headless 浏览器随探针退出。WT 保留供 PR 反馈；未启动 smoke-deploy 或 HIT 例程。
