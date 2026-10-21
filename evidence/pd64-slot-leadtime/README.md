# 卷宗 · PD-64 slot-leadtime（M-1 时段提前量 UI）

- BRANCH：`feat/pd64-slot-leadtime`｜WORKTREE：`E:\KIMI code\pd64-slot-leadtime`｜基线：main@`923b4b3`（全 `923b4b382d40a50a8d3a1b07a6035454b857be61`）｜模型：K3 MAX
- 令围：只修 M-1 时段提前量 UI 一缺陷（销项-产品-1021-PD59.md 候选池第 3 条）——
  ① 距服务开始不足 1h 的时段仍可选中；② 被拒／409 后底栏仍显示「已选」；③ 409「可约」语义与约满呈现矛盾。
- **迁移号：本窗未动 drizzle／`_journal.json`（纯客户端 3 件＋测试 1 件＋闸脚本 1 件），独占号 0105 声明保留未用；未碰 0093／0095–0104／0106／0107。**

## 根因与修复（最小 diff）

**根因**：
1. 可约集是查询时刻快照——`getWithServices` 服务端按「当前 +1h 缓冲」剔除，但客户端栅格（`TimeGridBlock`）只凭
   滞留的 `availableSet` 置灰；数据滞留（时间流逝未 refetch）时 <1h 槽仍 `disabled=false` 可选中（实证：注入滞留槽后
   基线底栏出「已选 今天 19:30」）。
2. `GroomingSinglePage.createM.onError` 只 toast＋refetch，**不清 `slot`**——拒约／409 后 `ConfirmBar` 仍渲染「已选」。
3. `TimeGridBlock` 对一切不可约格一刀切标「已满」、图例「灰 = 已满」——<1h 临近格被误导成约满。

**修复（3 件源码）**：
1. `apps/customer/src/components/booking/single/slotGrid.ts`：新增 `LEAD_BUFFER_MS`（与 server `BOOKING_LEAD_BUFFER_MS`
   同值同口径，边界 `t == now+1h` 可约与 server `t < earliest` 剔除同帧）、`isSlotSelectable(t, available, now)`、
   `retainSelectedSlot(selected, available, now)`（已选槽保留口径：仍处可约集且越出 +1h 缓冲，否则视为未选）、`freshNow()`。
2. `.../single/TimeGridBlock.tsx`：栅格 `ok` 改走 `isSlotSelectable`（数据落定时刻再卡一道）；`<1h` 临近格灰显
   **保留时刻明文不标「已满」**、aria「临近不可约」；`nextTime` 同口径；图例改「灰 = 已满或 1 小时内临近」。
3. `.../pages/GroomingSinglePage.tsx`：`pickSlot` 点选时刻前置校验（拦截＋toast「仅可预约 1 小时之后的时段，请改约
   稍晚时间」＋清空已选）；`onError` 增 `setSlot(null)`（拒约／409 后底栏「已选」立即清零）；底栏/提交/缺项提示统一改读
   `effSlot = retainSelectedSlot(slot, availableTimes)`——409 后该槽随 refetch 出集，已选态双保险不残留。

旧版向导（`/booking/grooming/wizard` 的 `BookingGroomingPage`/`SlotPicker`）为隐藏回滚路由退役件，按最小 diff 不动
（同 PD-61 不动退役件先例）。寄养按晚口径不动。

## 一条测试（RED → GREEN）

`apps/customer/src/components/booking/single/slotGrid.test.ts`（node:test，PD-61 同例）：
构造距开场 <1h 的 slot（即使在滞留可约集内）断言 `isSlotSelectable=false` 且 `retainSelectedSlot→null`
（不可进入已选态）；409 后新鲜可约集不含该槽，`retainSelectedSlot→null`（底栏无已选）；边界 `t==now+1h` 可约、
>1h 可约槽保留已选。

```text
RED（基线 slotGrid.ts 跑同一测试）：
  TypeError: (0 , import_slotGrid.isSlotSelectable) is not a function
  # pass 0 / # fail 1
GREEN（修复后）：
  node server/node_modules/tsx/dist/cli.mjs --test apps/customer/src/components/booking/single/slotGrid.test.ts
  # tests 1 / # pass 1 / # fail 0
```

## 实证（本窗栈 server@7264＋customer preview 双构建，Edge headless CDP，零新依赖）

闸脚本 `scripts/pd64-slot-leadtime-check.mjs`（PD-62 范式），证据库 `E:/KIMI_tmp/pd64/face.db`（migrate＋seed＋
营业/排班放宽全天以脱墙钟；测完即清）。双跑：before=基线构建（preview@7163）／after=本分支构建（preview@7164）。

| 断言 | before（基线） | after（本分支） |
|---|---|---|
| A1 不足1h时段不可选／拦截后无已选 | **FAIL**：注入 <1h 滞留槽（19:30）可选中，底栏出「已选 今天 19:30」 | PASS：该格 disabled、点不动，底栏无「已选」 |
| A2 临近格不误导约满（时刻明文＋图例） | **FAIL**：图例「灰 = 已满」 | PASS：格显「19:30」灰显、aria「临近不可约」、图例「灰 = 已满或 1 小时内临近」 |
| C 可约槽照常可选（不过拦） | PASS | PASS（点选 20:30 底栏「已选 今天 20:30 · 约 150 分钟 · ¥88」） |
| B0 接口证：appointment.create 真回 409 | PASS（409） | PASS（409） |
| B1 409 后底栏无已选 | **FAIL**：409 后底栏残留「已选 明天 00:00 · 约 150 分钟 · ¥88」 | PASS：409 后底栏「下一可约 04:30 已提示 · 点选时段后确认」 |
| B2 409 后该槽置灰（不可约即不可选） | PASS | PASS（T 随 refetch 出集标「已满」） |

汇总：before 3/6（缺陷三件全复现）→ after **6/6**（`after-results.json`／`before-results.json`）。

- 真 409 构造：选中可约槽 T 后直插证据库——两名 groomer 各挂一单 confirmed 叠占 [T-30min, T+90min)（容量打满），
  页面点「确认预约」走真接口，`Network` 域留痕 `appointment.create` HTTP **409**。
- 截图：`before|after-a-lead-gate.png`（A 场景栅格＋底栏）、`before|after-b-selected.png`（选中态）、
  `before|after-b-after-409.png`（409 toast「该时段已约满，请换个时间」＋底栏对照：before 残留已选／after 清零）。

## 验证记录

| 命令 | 结果 |
|---|---|
| `npx tsc -b`（apps/customer） | ✓ 无错 |
| `npx tsc --noEmit`（server） | ✓ 无错 |
| `npx eslint`（4 改动/新增件） | ✓ 0 problem（基线既有 SlotPicker 2 误不动不扩） |
| `node server/node_modules/tsx/dist/cli.mjs --test .../slotGrid.test.ts` | 1/1 pass |
| `VITE_API_BASE=http://localhost:7264 npx vite build`（基线／本分支双构建） | ✓ 双出 |
| `PREFIX=before CUSTOMER_URL=...7163 node scripts/pd64-slot-leadtime-check.mjs` | 3/6（A1/A2/B1 FAIL＝缺陷复现） |
| `PREFIX=after CUSTOMER_URL=...7164 node scripts/pd64-slot-leadtime-check.mjs` | 6/6 PASS |

## 两问闸

1. 是否只碰本缺陷？——是：客户端 3 件＋测试 1 件＋闸脚本 1 件＋卷宗；未碰 server／drizzle／wizard 退役件／寄养口径。
2. 是否涉钱／真写库？——否（证据库为一次性 tmp 件，测完即清；占用行直插证据库只为造真 409，未碰种子库）。

— KimiCode A窗（K3 MAX）· 2026-10-21
