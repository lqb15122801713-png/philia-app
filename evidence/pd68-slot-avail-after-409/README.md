# 卷宗 · PD-68 slot-avail-after-409（409 后目标槽仍 data-available=true）

- BRANCH：`feat/pd68-slot-avail-after-409`｜WORKTREE：`E:\KIMI code\pd68-slot-avail-after-409`｜基线：main@`fd99fb9`（全 `fd99fb921b871c74b6fc1fc699dce805148672fa`）｜模型：K3 MAX
- 令围：只修一缺陷——`appointment.create` 已 HTTP 409「该时段已约满」后，目标时段格仍 `data-available=true`／可再点（列表未与 create 重叠闸同源剔槽）。
  依据：林晓_修后点验_PD64_2026-10-21.md OBS；排批-产品-1022-候选池续排-fd99fb9.md；大测-产品-1022-下批令包字段-PD68-slot-avail-after-409-fd99fb9.md。
- **迁移号：本窗未动 drizzle／`_journal.json`（纯客户端 1 件＋server 测试 1 件＋闸脚本 1 件＋卷宗），独占号 0109 声明保留未用；未碰 0093／0095–0108／0110。**

## 根因与修复（最小 diff）

**根因**：`GroomingSinglePage` 的可约槽查询只带 URL 预填 `serviceOverride`——自然进店（无 `?serviceId=`）时
`getWithServices` 按 `slotsNeeded=1`（30min）过滤栅格；而 `appointment.create` 以时长引擎输出
（生效服务 × 宠物档案，如 60min→2 连续槽）判 groomer 空闲。**首槽空、续槽占**的时段：列表显示可约
（`data-available=true`）→ create 409 → onError refetch 仍按 `slotsNeeded=1` → 该槽仍可约可再点
（409 回路不收敛）。即「列表 vs create 重叠闸差」。

**修复（客户端 1 件）** `apps/customer/src/pages/GroomingSinglePage.tsx`（+23/−12）：
栅格查询改两段式（仓内既有先例 `HomeBookingPanel` 同构）——
1. 第一段 `catalogQ`：门店＋服务目录（不带 serviceId），供解析 B4-3 生效服务；
2. 第二段 `servicesQ`：可约槽查询带**生效 `serviceId`**（＋`petId` 走同一时长引擎），
   与 create 同一 `slotsNeeded` 重叠闸——同源剔槽；409 后 `servicesQ.refetch()`（PD-64 已接）
   即把该槽剔出可约集（`data-available=false`／灰显不可点）。queryKey 与 HomeBookingPanel
   槽段同形，同店同服务同宠直接命中缓存。
零 setState-in-effect（过 `react-hooks/set-state-in-effect` 闸）；门店回退链补 `catalogQ` 一段。

## 一条测试（RED → GREEN）

`server/src/routers/__tests__/slotAvailAfter409.smoke.ts`（独立临时库，跑完即删，appointment.smoke 同例）：
唯一 groomer 在 [T+30min, T+90min) 有 confirmed 单——
①漏传 serviceId 的列表（修复前客户端口径，slotsNeeded=1）**仍含 T**（闸差实证）；
②create（60min 服务）于 T → **CONFLICT「该时段已约满」**（真 409）；
③带生效 serviceId 的列表（与 create 同闸＝修复后客户端口径）**剔除 T**，409 后再查仍剔除（槽不可再选）；
④不过度拦截：T±边界相接槽（09:30／11:30 起始）照常在同源列表。
结果：**6/6 PASS**。

## 实证（本窗栈 server@7268＋customer preview 双构建，Edge headless CDP，零新依赖）

闸脚本 `scripts/pd68-slot-avail-after-409-check.mjs`（PD-64 范式），证据库 `E:/KIMI_tmp/pd68/face.db`
（migrate＋seed＋营业/排班放宽全天脱墙钟；场景占用行直插证据库只为造真 409，未碰种子库；测完即清）。
双跑：before=基线构建（preview@7168）／after=本分支构建（preview@7178；7169 被并行窗占用，不抢）。

| 断言 | before（基线） | after（本分支） |
|---|---|---|
| A1 闸差剔槽：续槽占用时段初始即不可约 | **FAIL**：cell(10:00) `available=true disabled=false` | PASS：`available=false disabled=true`「已满」 |
| A2 409 后该槽不可再选（闸差路径 OBS 复现） | **FAIL**：点选→真 409（`[204,409]`）→refetch 后仍 `available=true` | PASS：槽不可点，不进入 409 回路 |
| B0 接口证：appointment.create 真回 409 | PASS（409） | PASS（409） |
| B1 409 后底栏无已选（PD-64 承继回归） | PASS | PASS |
| B2 并发占满→409 后该槽置灰 | PASS | PASS |

汇总：before **3/5**（A1/A2＝缺陷复现）→ after **5/5**（`before-results.json`／`after-results.json`）。
截图：`before|after-a-gate-diff.png`、`before-a-after-409.png`、`before|after-b-selected.png`、`before|after-b-after-409.png`。

## 验证记录

| 命令 | 结果 |
|---|---|
| `node server/node_modules/tsx/dist/cli.mjs server/src/routers/__tests__/slotAvailAfter409.smoke.ts` | 6/6 PASS |
| `node server/node_modules/tsx/dist/cli.mjs --test apps/customer/src/components/booking/single/slotGrid.test.ts` | 1/1 pass |
| `npx tsc -b`（apps/customer） | ✓ 无错 |
| `npx eslint src/pages/GroomingSinglePage.tsx`（apps/customer） | ✓ 0 problem |
| `VITE_API_BASE=http://localhost:7268 npx vite build`（基线／本分支双构建） | ✓ 双出 |
| `PREFIX=before CUSTOMER_URL=...7168 node scripts/pd68-slot-avail-after-409-check.mjs` | 3/5（A1/A2 FAIL＝缺陷复现） |
| `PREFIX=after CUSTOMER_URL=...7178 node scripts/pd68-slot-avail-after-409-check.mjs` | 5/5 PASS |
| `npx tsc --noEmit`（server） | 仅基线既有 `src/db/pd66EvidenceFixture.ts` 12 错（PD-66 留下，本窗零 server 源码改动，不动不扩） |
| `domain.smoke`（须先 `db:migrate` 本窗 dev 库）／`mall.smoke`／`voidcheckin.smoke` | ✓ 全过 |
| `appointment.smoke`／`serviceStep.smoke` | 基线既有红：1 项（寄养医疗授权闸 uncaught）／4 项（跨店归属期望 FORBIDDEN 得 NOT_FOUND）——server 树与 `fd99fb9` 逐字节一致（`git status` 仅客端 1 件），与本修无关，不扩修 |

## 两问闸

1. 是否只碰本缺陷？——是：客端 1 件（GroomingSinglePage 两段式同源查询）＋server 测试 1 件＋闸脚本 1 件＋卷宗；未碰 server 源码／drizzle／wizard 退役件／寄养口径／PD-67／PD-69／跨店造种。
2. 是否涉钱／真写库？——否（证据库为一次性 tmp 件，测完即清；占用行直插证据库只为造真 409，未碰种子库）。

— KimiCode A窗（K3 MAX）· 2026-10-22
