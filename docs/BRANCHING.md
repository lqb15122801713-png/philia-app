# 分支策略（BRANCHING）

本仓库采用 **main / dev / 功能分支** 三级模型，所有变更经 Pull Request 流转，禁止直接向 main、dev 推送提交。

## 分支角色

| 分支 | 角色 | 规则 |
|---|---|---|
| `main` | 保护分支（发布基线） | 仅接受来自 `dev` 的 PR 合入；合并后按里程碑打 tag（如 `v0.1-p0`） |
| `dev` | 集成分支 | 仅接受功能分支 / 修复分支的 PR 合入；始终保持可构建状态 |
| `feat/<任务ID>-<简述>` | 功能分支 | 从 `dev` 切出，对应 plan.md 中的任务 ID，如 `feat/t1.2-auth-rbac` |
| `fix/<简述>` | 修复分支 | 从 `dev` 切出（紧急修复可从 `main` 切出，合并后需回灌 `dev`），如 `fix/tabbar-safe-area` |

## 标准流程

1. **领任务**：从 plan.md 认领任务 ID，从 `dev` 最新提交切出功能分支：
   `git checkout -b feat/<任务ID>-<简述> dev`
2. **开发**：小步提交，commit message 遵循 Conventional Commits（见下）。
3. **提 PR 到 dev**：填写 PR 模板（`.github/pull_request_template.md`）全部栏目，
   勾选验收标准核对项，UI 变更附截图，API 变更附 curl/测试结果。
4. **评审与合并**：评审通过后合入 `dev`（建议 squash merge 保持历史整洁），删除功能分支。
5. **里程碑发布**：里程碑达成后，从 `dev` 提 PR 到 `main`，合并后在 `main` 上打 tag，
   tag 命名 `v<阶段号>-<里程碑>`，如 `v0.1-m0`。

## Commit 规范（Conventional Commits）

格式：`<type>: <简述>`，type 取值：

- `feat`：新功能
- `fix`：缺陷修复
- `chore`：构建 / 脚手架 / 依赖等杂项
- `docs`：文档变更
- `refactor`：不改变行为的重构
- `test`：测试相关

示例：`feat: add ConvexTabBar halo animation`、`fix: staff tabbar grid layout`。

## 注意事项

- 合并 PR 前确保 `npm run build` 三端（customer / merchant / staff）全部通过。
- 涉及数据库迁移（server/drizzle）的 PR，在「影响范围」中必须显式声明。
- 二进制资产（设计图、截图）不入库，统一走 assets/ 之外的存储约定（见 plan.md）。
