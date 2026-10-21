# PD-58 · tRPC 404 回包去服务端堆栈卷宗

> A 窗 · `feat/pd58-trpc-404-stack` · 基线 `main@43ce81c3d01b894efd8762766dc6999c60c309fb` · K3 MAX · 2026-10-21
> 权威令包：`大测-产品-1021-下批令包字段-PD58-trpc-404-stack-43ce81c.md`

## 根因与最小修法

tRPC 11 默认以 `NODE_ENV !== 'production'` 决定 `isDev`，开发模式会把异常 `stack` 放进 `data.stack`。严格 production 的基线探测本就不含 stack；部署模板 `.env.example` 则明确使用 `NODE_ENV=staging`，因此实际部署的不存在路径 404 仍带完整服务端堆栈。

`server/src/trpc.ts` 只增加一处 `errorFormatter`：克隆 `shape.data`、删除 `stack`，再返回其余形状。这样不依赖部署环境是否漏配，production 与 staging 均不回 stack；`message`、数值 `code`、`data.code`、`httpStatus`、`path` 不变。未改路由、状态码或其他错误语义。

新增一条 `server/src/__tests__/trpc404.ts`：使用内存库，通过真实 `createApp()`／Hono／tRPC／superjson 链路请求 `/trpc/__pd58_missing__`，断言 HTTP 404、无 stack／`/app/server`，并保留 `code`＋`message`＋`httpStatus`。

## 证据索引

| 件 | 内容 | 结果 |
|---|---|---|
| `01_404回包_RED_GREEN.txt` | 修复前 staging 红色断言与完整泄露形状；修复后 staging／production 回包 | RED→GREEN；两者均 404、无 stack，规定字段保留 |
| `02_三端构建.txt` | 根目录 `npm run build` 原始输出 | customer／merchant／staff 均完成，exit 0 |
| `03_server_typecheck.txt` | server `npm run typecheck` | exit 0 |
| `04_e2e_全量回归.txt` | `E2E_PORT=7358 npm run test:e2e` 原始输出，独立临时库 | 跑完但 exit 1，8 项非本单断言失败，见下节 |
| `05_代码审查.txt` | 独立只读 reviewer 审查 | Critical 0／Important 0／Minor 0 |

## 全量 e2e 未绿项（不扩本单）

1. 56.1 copy 种子数：期望 4279／72 域，实际 4300／73 域。
2. 56.1 activeCopyTexts：期望 4279，实际 4300。
3. 57.1 种子六槽：实际返回 10 个槽键。
4. 74.11 到期 cohort：`due=2`、`renewed=1`，未达原断言。
5. 76.3 activeCopyTexts：期望 4279，实际 4300。
6. 77.2 dock 第五槽：实际文案为「我的」。
7. 81.4 库存效期：实际 expiry `2026-10-28T00:00:00.000Z`、`daysLeft=6`、`grade=urgent`。
8. 98.2 搜索索引 copyActive：期望 4279，实际 4300（dict=104、pages=46）。

这些项不属于本单修改面；未为消红而改动文案、种子、会员、库存或搜索代码。原始输出完整保留，不作全量绿表述。e2e 自检确认 7358 无残留监听；Windows libsql 句柄滞后导致临时库目录首次清理出现 EBUSY，随后已按本次确切路径手工删除。

## 边界

仅改 `server/src/trpc.ts` 与新增一条测试，另附本卷宗。未动 drizzle／`_journal.json`，未启用 0099，未碰 0093／0095–0098／0100／0101。未动选品、片*、PD-59／PD-60、真付真退或部署配置。未查 USAGE，未操作其他窗，不合部、不合并 PR。
