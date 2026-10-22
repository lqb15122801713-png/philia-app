# PD-69 · 商家告警六行朴素和 88≠83（附加行与待办合计口径分离）

- 分支：`feat/pd69-alert-row-sum`
- 基线：main@`fd99fb921b871c74b6fc1fc699dce805148672fa`（短 `fd99fb9`；github.com TCP 阻塞 → 经 gh-proxy 镜像核对远端 main tip＝该值后取回）
- 范围：仅商家首页 M2 异常卡（WAlert）附加行口径注记；**未动 drizzle／`_journal.json`（迁移号 0110 声明未占用）**、未动 todo.total／晨报／连锁口径、未动 dashboardStats 以外接口语义

## 根因与修复

**根因**：M2 异常卡行集自 PD-61 起由 `buildTodoAlertRows` 单源派生，行携 `countsTowardTodoTotal` 标记；
但渲染层六行同构直出（行题＋计数），附加行（退款／超期寄养／工单／发票／申诉）与计入「待办合计」的
todo 四件**视觉上无任何口径分离**——用户把六行数字朴素相加得 88，与晨报卡／连锁卡 `todo.total=83` 对不上，
误判为算错（附加行 5＝退款 2＋超期 3 被误加）。

**修复（最小 diff · 令许第一形「附加行标注不计入待办合计」）**：

1. `apps/merchant/src/copy/dashboard.ts`：新增一键 `dash.alertRowNotCounted`＝「不计入待办合计」（经营性文案走 copy 表纪律）。
2. `apps/merchant/src/components/skeleton/index.tsx`：`WAlertItem` 增可选 `notCountedNote?: string`；
   `WAlert` 行内渲染弱化小字注记（`data-testid="wsk-alert-<key>-notcounted"`）。可选字段，MonitorHubPage 等存量调用零回退。
3. `apps/merchant/src/styles/console.css`：一条 `.wsk-alert .nn` 规则（11px／muted／nowrap，照 `.empty` 口径）。
4. `apps/merchant/src/pages/DashboardPage.tsx`：flatMap 内一行派生 `notCountedNote = row.countsTowardTodoTotal ? undefined : dc('dash.alertRowNotCounted')`，
   九 case 各加 `notCountedNote,` 一行——口径归属判断仍由数据层单源（`countsTowardTodoTotal`）给出，渲染层只展示。
5. `apps/merchant/src/components/dashboard/utils.test.ts`：新增 PD-69 一条测试（PD-56／PD-61 两条原样保留）。

未动：行序／显隐（count>0）／跳转／`todoGrandTotal`／`todoAlertCountedTotal`／服务端聚合——todo.total＝晨报＝连锁同源零回归。

## RED → GREEN

```text
RED（基线 fd99fb9）：
  git grep -c alertRowNotCounted fd99fb9 -- apps/merchant → 0 匹配（无注记键/字段，附加行与计入行同构直出）
  DOM 断言「附加行挂 .nn 注记」在基线不成立（.nn 不存在）
GREEN（修复后）：
  node server/node_modules/tsx/dist/cli.mjs --test apps/merchant/src/components/dashboard/utils.test.ts
  ok 1 - PD-56 晨报待办与待办 KPI 同口径，超期寄养单列不双计
  ok 2 - PD-61 首页顶部待办行与待办合计同源同构：超期寄养≠0 单列不双计，计入合计之和=todo.total
  ok 3 - PD-69 附加行与计入合计四件口径分离：六行朴素和 88 的差额全部来自不计入行
  # tests 3 / # pass 3 / # fail 0
```

## 接口与页面实证

临时验证库（测完已清）：migrate＋seed 后直写缺陷种子——todo 四件 83（cancel2＋unassigned5＋unpaid74＋pending2）
＋附加行 5（refund_requests submitted×2＋in_boarding 超期×3）。

- `store.dashboardStats` 实测（`api-check.json`，owner 真链路 HTTP 读回）：`todo={pending:2,unassigned:5,cancelRequested:2,unpaid:74,total:83}`、
  `overdueBoardingCount=3`；服务端口径未动（②满足）。夹具旁证 `chainDashboard.total.todoTotal=83`（连锁合计同源）。
- 商家首页实渲染（`dash-alert-notcounted.png`／`browser-dom.txt`，1440×900 桌面帧，vite preview←server 7269←临时库）：
  - 告警区六行：取消申请待审 2／客户退款申请 2 **不计入待办合计**／待收款 74／待派单 5／超期寄养 3 **不计入待办合计**／历史待确认单 2；
  - 朴素和 88 与待办合计 83 的差额 5 全部来自挂注记的附加行；计入行无注记；
  - 晨报卡待办合计 **83**、连锁卡待办合计 **83**（与 todo.total 三位同数，PD-61 回归满足）；
  - CDP 断言 8/8 全绿（六行在场／naiveSum=88／countedSum=83／postcardTodo=83／附加行注记集合={refund,overdue}／注记文案）。

## 验证记录

| 命令 | 结果 |
|---|---|
| `node server/node_modules/tsx/dist/cli.mjs --test apps/merchant/src/components/dashboard/utils.test.ts` | 3/3 通过 |
| `npx tsc -b`（apps/merchant） | exit 0 |
| `npm exec -w @philia/merchant -- eslint <改动五文件>` | 1 error＝DashboardPage.tsx:213 no-fallthrough，**基线既有**（SSE 故意贯穿注释段，PD-61 卷宗同记录），非本次引入 |
| `npm --prefix server run typecheck` | exit 2＝12 错全在基线文件 `src/db/pd66EvidenceFixture.ts`（TS1375）；本分支 server 零改动，与基线同错 |
| `npm run build`（三端） | exit 0；merchant dist 含「不计入待办合计」锚点 |

## 变更清单（5 文件，最小 diff）

```text
apps/merchant/src/copy/dashboard.ts                  +4   dash.alertRowNotCounted 一键
apps/merchant/src/components/skeleton/index.tsx      +9   WAlertItem.notCountedNote 可选字段＋行内渲染
apps/merchant/src/styles/console.css                 +2   .wsk-alert .nn 一条
apps/merchant/src/pages/DashboardPage.tsx            +12  flatMap 一行派生＋九 case 各一行
apps/merchant/src/components/dashboard/utils.test.ts +35  PD-69 一条测试（既有两条原样）
```

## 清理

临时验证库（`E:/KIMI_tmp/pd69/dash.db`）、夹具（`server/_pd69-evidence.mts`）、截图脚本（`E:/KIMI_tmp/pd69/shots.mjs`）、
浏览器临时档案、server(7269)/preview(7169) 进程均已停已删；`package-lock.json` 安装副作用已回滚；仅保留本卷宗。
迁移号 0110 未使用（未动 drizzle／`_journal.json`）。
