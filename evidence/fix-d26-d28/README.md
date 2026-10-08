# 卷宗 · 三缺陷修复（D-26/D-27/D-28 · B 窗 PR-Agent 实测移交）

> 源=登记-B窗-1008-PR-Agent实测信噪比.md（3 真 1 误，信噪比 75% 达标留）+登记-PM-1008-3（D-26 与急修四件同级 P1 钉）｜ 基线=main 尖 e1f34a16（急修合部后）｜ 分支 `feat/fix-d26-d28` ｜ 卷宗 `evidence/fix-d26-d28` ｜ PR 只开不合 ｜ 施工=A 窗 2026-10-08 晚。

## 一、三件总账

1. **D-26（P1 测试完整性·监考闸假绿）**：e2e 86.8 段原码 `ownerBCookie86` 声明零引用、chainDashboard 实查用 A 店 ownerCookie → 「B 店不透 A」恒过假绿。修=**B 店 cookie 真用上**：①B 店主查自家 chainDashboard→B 店行 todoTotal=0；②**前提断言**=A 店行 todoTotal≥1（86.3 E2E86P1 pending 在途，断言有牙）；③B cookie 跨店读 A 域细目（membership.forUser 86.1 新户）=404。**负向验证（PM 钉②）**：临时放行件=B 店造 pending 预约（插在查询前）→ 86.8 真红（bTodo=1/aTodo=10/fuB=404，d26-negative-red.log 在卷）→ 收回后两绿。AUD-10/11 隔离结论随修复重验一句：86.8/87.8 现真绿（B 店 cookie 真发请求）。
2. **D-27（P2 批量保存静默丢弃）**：ProductsPage 原码 `payload.slice(0, 50)` 截断+成功即 exitBulk 清草稿 → 超 50 行编辑静默丢。修=**分批提交**（50/批顺次；server 单批上限 50 同帧）；任一批失败=已成功批剔草稿、未提交批保留批量态不丢弃（不再 exitBulk）；全成才 toast+退出。
3. **D-28（P2 钱域边缘口径）**：FinancePage 月营收（chipRange month=本机时区 startOfMonth）vs 月退款（storeTodayStr=门店墙钟 +8）双源基准，跨月边界错位。修=chipRange month 档改**门店规范时区 +8 月起止**（与 storeTodayStr 同工艺同基准）；day/7d 档不动（无跨源对照面）。机读断言件（d28-chiprange-probe）：月中常态+跨月边界（UTC 10-31 16:30=门店 11-01 凌晨→月档=11 月）全过。

## 二、闸门（2026-10-08 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build / server typecheck | 0 / 0 | gate-build.log / gate-typecheck.log |
| e2e 全量 | **两绿采信 955 断言**（86.8 修复后真绿；零回退） | gate-e2e-green1/green2.log |
| D-26 负向验证 | **故意放行=86.8 真红**（bTodo=1），收回后两绿 | d26-negative-red.log |
| D-28 机读断言 | chipRange 月档 2 例全过（含跨月边界） | d28-chiprange-probe.json |
| check-nav-closure | 124 路由 0 死 0 弱 | nav.log + nav-closure.json |
| smoke-routes | 108/108 | routes.log |
| review-e2e | 全绿 ✅ | review.log |
| smoke-deploy | 全部通过 🎉 | deploy.log |

## 三、红线自查

零新依赖 / 零迁移（纯码修）/ 行尾 LF / 禁令零命中 / 收摊必净（7100-7102/7200 零监听实证）/ **CJ-1008-01 六条自过**（D-26 注释写明负向验证来历；D-27 分批单职责；D-28 注释写为什么=双源口径来历）。

## 四、登记

- 误报件（#70 invalidateFinance 致 noUnusedLocals）=B 窗已自证误报（build 绿反证），不在本片；
- PR-Agent 试点信噪比 75% 留=维持（本卷宗即三真件的修复闭环实证）。

— A 窗（施工方，角色卡⑧ V2.2）2026-10-08 晚
