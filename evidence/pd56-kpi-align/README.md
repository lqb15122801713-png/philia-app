# PD-56 · F-KPI 商家待办／晨报口径对齐

- 分支：`feat/pd56-kpi-align`
- 基线：`f114572434578d5301a3c63dfb59cc5312a8a858`
- 范围：仅商家待办与晨报 KPI 同源；未改图表、整页视觉或 drizzle／`_journal.json`，未使用迁移号。

## 根因与修复

服务端 `todoCountsOf` 已把 `dashboardStats.todo.total` 与 `chainDashboard.todoTotal` 统一为四类待办，超期寄养单列。晨报使用的 `todoGrandTotal` 仍额外加 `overdueBoardingCount`，导致 `82 + 3 = 85`。

修复仅让 `todoGrandTotal` 直读 `s.todo.total`；超期寄养继续独立渲染，不删除、不合并。

## RED → GREEN

回归测试：`apps/merchant/src/components/dashboard/utils.test.ts`，使用完整 `DashboardStats` 夹具（待办 82、超期 3）调用真实 helper。

```text
node server/node_modules/tsx/dist/cli.mjs --test apps/merchant/src/components/dashboard/utils.test.ts
RED:   actual=85, expected=82（1 test, 1 fail）
GREEN: 1 test, 1 pass, 0 fail
```

## 接口与页面实证

临时验证库仅造 82 条 pending 与 3 条超期 in_boarding，验证后已删除。

- `store.dashboardStats`：`todo.total=82`，`overdueBoardingCount=3`。
- `store.chainDashboard`：本店行与合计 `todoTotal=82`。
- 页面连锁合计、本店分栏、晨报均渲染「待办合计 82」；三处超期寄养均单列 3。
- 既有 86.3 `chainDashboard todoTotal === dashboardStats todo.total` 断言通过。

证据文件：

- `api-check.json`：接口实数。
- `browser-dom.txt`：真实登录后的 DOM 文本。
- `dashboard-kpi-82.png`：同帧包含连锁待办 82、晨报待办 82、超期寄养 3。

## 验证记录

| 命令 | 结果 |
|---|---|
| `node server/node_modules/tsx/dist/cli.mjs --test apps/merchant/src/components/dashboard/utils.test.ts` | 1/1 通过 |
| `npm run build` | 三端构建 exit 0 |
| `npm --prefix server run typecheck` | exit 0 |
| `npm exec -w @philia/merchant -- eslint src/components/dashboard/utils.ts src/components/dashboard/utils.test.ts` | 目标两文件 exit 0 |
| `node scripts/smoke-deploy.mjs`（本地临时库、Mock 通道） | 所有检查项通过 |
| `node scripts/smoke-routes.mjs` | 113/119；商家端路由全部通过，6 个失败均为客户端既有文案锚点，详见 `smoke-routes.json` |
| `E2E_PORT=7256 npm --prefix server run test:e2e` | 跑至 107 段；8 项失败与未修改基线逐项一致，见下 |

全量 e2e 的 8 项既有失败为：56.1 两项、57.1、74.11、76.3、77.2、81.4、98.2；均不涉及本次 KPI 修改。商家端全量 lint 另有 47 errors／5 warnings，位于未修改文件；本次目标两文件 lint 为 exit 0。上述非本令范围问题未扩修。

## 清理

验证浏览器页、API／三端 dev 进程已停止；临时 SQLite、fixture／API 脚本、smoke 失败留图及 e2e 残留临时目录已删除。仅保留本卷宗。
