# 任务卡 · A 窗 · 补缺大批收口（集成 PR · 六片合一）

> 产品侧 2026-10-02 · 六片交付全齐（PR #56~#61）后收口件。产品侧试合实测：逐片对 main 全 clean，**序贯累进有冲突面 12 类**（全为机械性撞车，清单+消解图如下）。
> 产出=**集成 PR 一支**（`integration/liuxin-batch` 分支，自 main@d3c5d24c 按合序集成六片）——PR 只开不合，验收=集中复核+老板授权。

## 一、合序（照你报备建议，产品侧准）

`片 1（refund-client）→ 片 4（service-loop）→ 片 2（account-security）→ 片 3（member-upgrade）→ 片 5（notify-center）→ 片 6（pay-skeleton）`
（片 1 先于片 4=退款入口挂接；片 3 先于片 6=upgrade 挂接；片 2/5 独立域）

## 二、冲突消解图（产品侧试合实测 12 类，逐类修法）

| 冲突区 | 性质 | 消解 |
|---|---|---|
| `server/drizzle/meta/_journal.json`+`0017_snapshot.json` | 六片同号 0017 | **迁移重排 0017~0022**：按合序各片迁移改号（0017=片 1 refund_requests/0018=片 4/0019=片 2/0020=片 3/0021=片 5/0022=片 6），journal 按序并录，snapshot=集成后 schema 重新生成（drizzle-kit 重出终态快照，勿手合 JSON） |
| `server/src/__tests__/e2e.ts` | 段号撞号（50.x/51.x/52.x 各家撞） | 段号重排：片 1=50.x／片 4=53.x／片 2=51.x／片 3=52.x／片 5=54.x／片 6=55.x（片 3 原 52.x 保持，片 4 让号）；**断言零删改**，只动编号与引用 |
| `apps/customer/src/App.tsx` | 路由表各家追加 | 并集（四片路由全收，顺序无关） |
| `scripts/check-nav-closure.mjs`+`smoke-routes.mjs` | 双表各家追加 | 并集 |
| `server/src/routers/index.ts` | router 注册各家追加 | 并集 |
| `server/src/storage/cleanup.ts` | 白名单各家追加 | 并集 |
| `apps/merchant/.../TodoSection.tsx`+`DashboardPage.tsx` | 待办行各家追加（片 1/2/4 三家） | 并集三行（退款申请/换绑申诉/工单+发票） |
| `apps/merchant/src/copy/cashier.ts` 等 copy 域 | 键各家追加 | 并集（撞键=内容一致保留一份，不一致=报备产品侧） |
| `server/src/routers/refund.ts`（片 6 撞片 1 域） | 同文件不同段 | 并集（executeRefundCore 共用件在片 1，片 6 挂接段保留） |
| 其余散点 | 同型 | 并集优先，语义冲突=停工报备，不许自裁 |

## 三、收口闸门（集成态全绿才交付）

三端 build 根单命令 0 / typecheck 0 / **server e2e 全量（六片断言全集+既有断言，零删改）** / nav-closure 0 / smoke-deploy / review-e2e / smoke-routes / 禁令 grep=0 / 零新依赖／**迁移重排后：fresh 库 migrate 全过+幂等复跑零副作用实证**（入卷）。

## 四、能跑能验

集成态三端代表屏截图（退款申请/注销/升级试算/消息中心/收银台支付流各一）+迁移重排实证日志入卷。

## 五、纪律

消解图外的语义冲突=停工报备产品侧；零新代码（只集成不新写，缺口=报备）；PR 只开不合；回执=回执-施工方-1002-收口.md。
