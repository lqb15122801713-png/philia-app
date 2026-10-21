# PD-61 · 首页待办五行计数口径对齐（超期寄养）

- 分支：`feat/pd61-todo-count-scope`
- 基线：main@`ad9dd539d7fb49a3cbbfc2abe5bad838beaf8d40`（短 `ad9dd53`）
- 基线获取：git:443 阻塞（github.com TCP 重置）→ 产品侧离线快照 `D:\Philia-shared\philia-ad9dd53.tar.gz`
  解包建树（tarball 换基线为既有 sanctioned 通道，见 `vps-deploy-pd58-59-60-ad9dd53.sh` 头注「tarball swap (non git pull)」），
  本地 `git init` 基线提交 `chore: baseline main@ad9dd53 snapshot import`。
- 范围：仅商家首页顶部待办行（M2 异常卡）与「待办合计」计数口径对齐；
  未动 drizzle／`_journal.json`（**迁移号 0102 声明未占用**）、未动 PD-56 KPI／晨报口径、未动 dashboardStats 以外接口语义。

## 根因与修复

**根因**：商家首页顶部待办行（DashboardPage M2 异常卡）行集 = 取消申请＋退款＋待收款＋超期寄养＋历史待确认（＋工单/发票/申诉），
与 `dashboardStats.todo.total`（pending＋unassigned＋cancelRequested＋unpaid）构成不同：
行集**缺 todo 字段 `unassigned`（待派单）**，却**混入超期寄养**（PD-56 口径＝单列不双计）与退款/工单等独立域。
缺陷种子下行和 1+74+3+3+1=82 与 todo.total 3+5+74=82 **和值巧合相等**，掩盖口径不一致
（点验 L-1；算术复演见 `red-baseline-arithmetic.txt`：旧行集 todo 来源行合计仅 77≠82）。

**修复（最小 diff · 令许第二形「五行各项与 todo 字段一一对应」）**：

1. `apps/merchant/src/components/dashboard/utils.ts`：新增单源取数口 `buildTodoAlertRows(stats, extras)`
   ——todo 四件（cancelRequested/unassigned/unpaid/pending）一一对应成行、`countsTowardTodoTotal=true`；
   超期寄养单列显示、`false` 不计入；退款/工单/发票/申诉独立域行、`false` 不混入。
   派生 `todoAlertCountedTotal(rows)`＝计入合计行之和，任意种子下＝`todo.total`。
2. `apps/merchant/src/pages/DashboardPage.tsx`：M2 行集改经 `buildTodoAlertRows` 单源派生；
   **补齐「待派单」行**（`/appointments?status=confirmed&from=todo` 深链，appointment 页既有 `arriving` 档承接）；
   其余行文案/跳转/显隐（count>0）、testid（`wsk-alert-*`）零回退；晨报卡 `todoGrandTotal`（=todo.total）不动。
3. `apps/merchant/src/copy/dashboard.ts`：新增一键 `dash.todoUnassignedLabel`＝「待派单」（经营性文案走 copy 表纪律）。
4. `apps/merchant/src/components/dashboard/utils.test.ts`：新增一条 PD-61 测试（PD-56 原测试原样保留）。

注：旧 `TodoSection.tsx` 为 U6 后退役件（本页不再装配，页头注明「u3 旧件零改」），不在首页渲染路径，按最小 diff 不动。

## RED → GREEN

```text
RED（新测试 × 基线 utils.ts）：
  SyntaxError: The requested module './utils' does not provide an export named 'buildTodoAlertRows'
  # tests 1 / # pass 0 / # fail 1
GREEN（修复后）：
  node server/node_modules/tsx/dist/cli.mjs --test apps/merchant/src/components/dashboard/utils.test.ts
  ok 1 - PD-56 晨报待办与待办 KPI 同口径，超期寄养单列不双计
  ok 2 - PD-61 首页顶部待办行与待办合计同源同构：超期寄养≠0 单列不双计，计入合计之和=todo.total
  # tests 2 / # pass 2 / # fail 0
```

## 接口与页面实证

临时验证库（测完已清）：migrate＋seed 后造 pending×3／confirmed 无 staff×5（grooming）／completed 未收款×74／
in_boarding 超期×3——与缺陷种子同构成。

- `store.dashboardStats` 实测（`api-check.json`）：`todo={pending:3,unassigned:5,cancelRequested:0,unpaid:74,total:82}`、
  `overdueBoardingCount=3`；服务端口径未动（②满足）。
- 商家首页实渲染（`dash-todo-count-82.png`／`browser-dom.txt`，1440×900 桌面帧）：
  - 顶部待办行：待收款 **74**、待派单 **5**、超期寄养 **3**（单列）、历史待确认单 **3**（取消 0／退款 0／工单 0 不显行）；
  - 连锁卡＋本店分栏＋晨报卡三处：待办合计 **82**、超期寄养 **3** 单列；
  - 口径闭环：todo 四件行 74+5+0+3＝**82**＝待办合计＝todo.total；超期 3 只单列、不双计（否则 85）。

## 验证记录

| 命令 | 结果 |
|---|---|
| `node server/node_modules/tsx/dist/cli.mjs --test apps/merchant/src/components/dashboard/utils.test.ts` | 2/2 通过 |
| `npx tsc -b`（apps/merchant） | exit 0 |
| `npm --prefix server run typecheck` | exit 0 |
| `npm exec -w @philia/merchant -- eslint src/components/dashboard/utils.ts src/components/dashboard/utils.test.ts src/copy/dashboard.ts` | exit 0 |
| 同上 + `src/pages/DashboardPage.tsx` | 1 error＝213 行 no-fallthrough，**基线既有**（基线同文件 212 行同错，SSE 故意贯穿注释段），非本次改动引入 |
| `npm run build`（三端） | exit 0（customer/merchant/staff 均过；merchant dist 含「待派单」`todoUnassignedLabel`「待办合计」锚点） |

## 变更清单（4 文件，最小 diff）

```text
apps/merchant/src/components/dashboard/utils.ts      +55  单源 helper + 派生合计
apps/merchant/src/components/dashboard/utils.test.ts +39  PD-61 一条测试（PD-56 测试原样）
apps/merchant/src/copy/dashboard.ts                  +2   dash.todoUnassignedLabel 一键
apps/merchant/src/pages/DashboardPage.tsx            行集改单源派生 + 补待派单行
```

## 清理

临时验证库、夹具脚本（`server/_pd61-fixture.mts`）、`_pd61-tmp/`（含 chrome-profile/cookie）、API/dev 进程
均已停已删；仅保留本卷宗。迁移号 0102 未使用（未动 drizzle／`_journal.json`）。
