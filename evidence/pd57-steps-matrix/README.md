# PD-57 · O-STEPS MATRIX_STEPS_MISMATCH 卷宗

> A 窗 · `feat/pd57-steps-matrix` · 基线 `main@f114572434578d5301a3c63dfb59cc5312a8a858` · K3 MAX · 2026-10-21
> 权威令包：`大测-产品-1021-下批令包字段-PD57-steps-matrix-f114572.md`

## 根因与最小修法

令包所称矩阵是共享盘产品文件 `D:\Philia-shared\大测-产品-1020-三角色主旅程矩阵-ea910dc.md`，P-03 原写「七步服务」。仓内事实源已经统一为六步：

- `packages/shared/src/constants/steps.ts` 的 `SERVICE_STEPS` 恰为 6 项，`stepOrder` 为 1–6。
- 员工执行页 `apps/staff/src/pages/ExecutePage.tsx` 摘要为 `N/6`；帮助文案 `apps/staff/src/copy/me.ts` 为「六步影像规范」。
- 规范 `docs/ops/04_功能对账表.md` 的 SOP-01 已列六个冻结步名。

因此只将共享矩阵 P-03 的「七步服务」改为「六步服务」，其余字符、Status、只读／取消约束原样保留。未新增第七步、未改状态机、未改交付完结规则、未触真实服务完结。

**共享盘不是 Git 仓库；仓内基线已是六步，所以本分支没有生产代码改动，PR 只携带本卷宗。** 实际矩阵修复已直接落在上述共享盘文件，避免为了制造代码 diff 而改动正确实现。

## 证据索引

| 件 | 内容 |
|---|---|
| `01_口径断言.txt` | 修复前红色断言（仅 P-03 七步）与修复后绿色断言；同时核对六步常量、`/6`、帮助、路由、只读列表和取消锚点 |
| `02_构建与状态机.txt` | 三端构建、server typecheck、六步状态机冒烟结果及既有失败说明 |
| `03_P03运行时只读.txt` | 专用临时栈真实浏览器只读核查：`/today`→`/execute/:id`、`/schedule` 六步展开、`/me` 帮助 |
| `04_e2e_全量回归.txt` | 独立临时库、`E2E_PORT=7357` 的全量回归原始输出；在 53.2 后遇上传 `ECONNRESET`，未掩盖失败，未归因于本修复 |

## P-03 路径保持

- `apps/staff/src/App.tsx` 的 `/execute/:appointmentId` 路由未改。
- `apps/staff/src/pages/SchedulePage.tsx` 继续通过 `serviceStep.list` 展开六步只读表，并可导航到执行页。
- `ExecutePage.tsx` 的取消／取消审核中引导分支未改；未执行真实取消或完结动作。

## 边界

未动 drizzle／`_journal.json`，0098 未启用；未碰 0093／0095／0096／0097。未动选品、片*、拟人审美、运营商城、PD-55／PD-56 范围。未合未部，不写产品验收结论。

令包引用的 `潘婧_成品大测_主旅程_2026-10-20.md` 与 `大测-产品-1020-分拣回报-盲测+运营轨-ea910dc.md` 在共享盘未找到；本卷以权威令包、可读取的矩阵原文和仓内实际实现核对，未将该缺失伪装成已读。
