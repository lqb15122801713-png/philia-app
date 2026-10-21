# PD-57 · O-STEPS MATRIX_STEPS_MISMATCH

## 修法

将共享盘 `D:\Philia-shared\大测-产品-1020-三角色主旅程矩阵-ea910dc.md` 的 P-03「七步服务」改为「六步服务」，与 live 六步执行壳、帮助与规范对齐。P-03 的只读／取消约束和 Status 不变。

仓内 `SERVICE_STEPS` 已锁定六项，执行页已显示 `/6`，帮助与 SOP 已写六步；因此不改状态机、不新增第七步、不真完结。共享盘不属于本 Git 仓，本 PR 仅新增 `evidence/pd57-steps-matrix/` 卷宗，实际矩阵文案已在共享盘完成最小一处修改。

## 自测

- 修复前断言按预期仅因 P-03「七步服务」失败；修复后同一断言通过。
- 三端 `npm run build` 与 server `tsc --noEmit` 通过。
- 六步状态机冒烟的六步推进／照片门槛／只读列表等核心断言通过；另有与本次无关的既有失败，详见卷宗。
- 专用临时栈真实浏览器只读走通 `/today`→`/execute/:id`、`/schedule` 六步展开与 `/me` 帮助；未拍照、取消或完结。
- 全量回归使用独立临时库与 `E2E_PORT=7357`，在 53.2 后因上传 `ECONNRESET` 失败，原始输出入卷，未改写为通过。

未动 drizzle／`_journal.json`（0098 未启用），未碰 0093／0095／0096／0097；未合未部。

— A 窗 · K3 MAX · `feat/pd57-steps-matrix`
