# 修复包 PR-1（钱域独立先行）· evidence 卷宗（A 窗施工）

> 批次：复走修复包 PR-1（PD-10 施工令 · PD-02 冻结版第 1 层剩余三件 · 免签直发）
> 分支：feat/fixpack-pr1（基线 main@5693c0c，含 R11b+急修三件已合）｜施工：Kimi Code A 窗
> 日期：2026-09-27 ｜ PR 只开不合

## 三件落点

1. **QA40-D10 账本双倍计数**（死线 10-05 红线级）：`membership.ledger` 的 yearGrantFen
   每期只计一类行（未结算=计提行 settlement_id 空／已结算=入账行 source_id=批次 id）；
   e2e 实证 settleMonthly 真跑一遍 500→500 不翻倍 + 幂等 already-settled。
2. **QA40-D2 安心包代码层关停**：mall.listProducts/listProductsForStore 增入参开关
   `includeCarePackage`（默认排除=结构性防复活；管理端 ProductsPage 显式含保留可见性）。
3. **H4-01 驳回权放开店长**（矩阵 V1.3）：rejectDraft 店主→店主全域+店长本店；
   OP-01③ 店员 403 分口径「请联系店长」；前端退款页驳回钮 isOwner→canManage；
   超阈值落 draft=端口化开关 `refund_over_threshold_to_draft` 默认硬拒（CJ-0923-20① 留口，
   on=落 draft 申请行零联动纯留痕，批准=店主重新执行——开关种子行随 0016 幂等迁移，
   configRules BOOL_KEYS 补 'enabled'）。

## 闸门实证（真跑原文入卷）

| 闸门 | 证据件 | 结果 |
|---|---|---|
| 三端 build 根单命令 | pr1-build.log | ✅ exit 0 |
| server typecheck | pr1-tc.log | ✅ 0 |
| server e2e（PR-1 新增 8 断言） | pr1-e2e.log | ✅ 全链路验收全部通过，0 红 |
| smoke-routes | pr1-smoke.log | ✅ 49/51（唯二红=F1 已登记 D-2 环境口径，非本批域） |
| check-nav-closure | pr1-nav.log | ✅ 67 路由 0 死胡同（零新路由） |
| 禁令+禁用色 grep | diff 域 | ✅ 0 命中 |
| 迁移 | 0016 幂等配置种子（Y6 豁免写明） | ✅ 唯一豁免件 |

## 能跑能验截图（shots/）

- pr1-cashier-no-carepkg.png：收银台商品区 10 件（安心包 3 件结构性消失）
- pr1-products-admin.png：管理端商品页 13 件全含（安心包管理可见性保留）
- 钱域片其余实证=server e2e 断言级（draft 零联动/驳回权/开关三态），见 e2e log。

## 过程诚实账（自检+环境事故）

- e2e 首两跑抓出三处我自造问题并修复：期次撞车两轮（server 每日滴答已结上期→改挂
  当前期次+2，与 43 段/49b 段三方各占其期）；config.save 种子宇宙校验拦新键→0016 种子行
  +seed.ts 同步（fresh 库与生产双通道）；execute 返回丢 draft 标志→透出。
- 环境事故两桩（与代码无关）：7101/7100 端口被「UX 预览台」类残留进程占用致 smoke/nav
  大面积假红——清占后重跑全绿；smoke-shots/ 为运行产物不入仓。
- 待裁疑点（开工回执已报备）：OP-01② 微光 NULL 进全店合计口径（本批未动，建议随 PR-4 搭车）；
  退款阈值前端页签未见五片映射（影响留口开关端口可达性——当前可 API 改）。
