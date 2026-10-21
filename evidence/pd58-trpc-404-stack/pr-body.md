# PD-58 · tRPC 404 回包去服务端堆栈

## 修法

在 `server/src/trpc.ts` 增加一处 `errorFormatter`，删除 tRPC 错误回包的 `data.stack`，其余形状保持不变。不存在路径仍返回 404，保留 `code`、`message`、`httpStatus` 与 `path`。

基线调查确认：严格 `NODE_ENV=production` 时 tRPC 默认已隐藏 stack，但部署模板使用 `NODE_ENV=staging`，默认 `isDev` 仍会泄露。formatter 在 superjson 序列化前统一删除 stack，因此两种部署环境都不再泄露。

新增一条真实请求回归 `server/src/__tests__/trpc404.ts`，覆盖 createApp／Hono／tRPC／superjson 链路，不 mock 错误响应。

## 自测

- 修复前：`NODE_ENV=staging` 回归按预期因 `data.stack` 存在而失败。
- 修复后：staging 与 production 回归均通过；HTTP 404、无 stack／`/app/server`，`code=NOT_FOUND`、message 非空、`httpStatus=404`。
- `server: npm run typecheck`：通过。
- 根目录 `npm run build`：customer／merchant／staff 三端通过。
- 独立只读代码审查：Critical 0／Important 0／Minor 0。
- `E2E_PORT=7358 npm run test:e2e`：**未全绿，8 项非本单断言失败**。包括 copy/槽位种子数量、会员 cohort、库存效期与搜索索引数量；原始日志和逐项清单在 `evidence/pd58-trpc-404-stack/04_e2e_全量回归.txt` 与卷宗 README。本 PR 未扩范围修改这些领域。

## 边界

无路由改动，无迁移改动；0099 未启用，未触碰保留号或他窗号。卷宗位于 `evidence/pd58-trpc-404-stack`。

— A 窗 · K3 MAX · `feat/pd58-trpc-404-stack`
