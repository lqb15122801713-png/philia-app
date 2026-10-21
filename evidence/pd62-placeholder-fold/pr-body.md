# fix(merchant): PD-62 占位层（储值／报表口径）移入首屏

> 档号 PD-62 ｜ 基线 main@`ad9dd53` ｜ 只修一缺陷（L-2，销项-产品-1021-PD55至PD57 候选池第 2 条）｜ **迁移号 0103 声明保留未用**（本 PR 未动 drizzle／`_journal.json`）

## 缺陷

商家 console 办事首页 `/console`：PD-55 三层分区后，**占位层（储值 C2／报表口径 E2 两张占位卡）在 1280×800 首屏外**，店主须滚动才能看见「端口待立」状态。

基线实测（1280×800，店主种子会话，Edge headless CDP）：占位层顶边 `boundingBox.y=861`（h=127）→ y＋最小可见高 32 = **893 > 800** ❌

## 修法（最小 diff = 1 行层序＋1 条可视断言）

- `apps/merchant/src/pages/ConsolePage.tsx`：`HOME_TIERS` 层序 常办→慎办→占位 换为 **常办→占位→慎办**（数组一行序换＋注释对齐）。
  慎办层高 357px，不改卡尺寸／等权前提下「调整顺序」是令围内唯一归口。
- `scripts/pd62-placeholder-fold-check.mjs`：一条可视断言——1280×800 视口下 `console-tier-pending` 顶边 `boundingBox.y＋32 ≤ 800`
  （仓例零新依赖：Edge headless CDP 驱动，Playwright boundingBox 同义口径；复跑：`node scripts/pd62-placeholder-fold-check.mjs`）。

## 不改项（PD-55 钉死保持）

- 15 卡等权：常办 5／慎办 8／占位 2（after 实测 tierCounts=`{5,8,2}`）；层内口序、卡面工艺（慎办卡其左条／占位降透）、留痕数据源、端口逻辑全不动
- 危险区关停条（after y=80 h=94 与基线逐像素一致）、侧栏 IA／「独立运营壳」分区注、高级层折叠区、页底共构注原样
- 不新增功能、不加 copy 键、不动色板、不碰 KPI／STEPS／CLIP

## 证据（卷宗 `evidence/pd62-placeholder-fold`）

| 帧 | 结果 |
|---|---|
| before 视口／全页（基线产物） | 断言 **FAIL**：`tierPending.y=861 → y+32=893 > 800`；首屏无占位层 |
| after 视口／全页（本分支产物） | 断言 **PASS**：`tierPending.y=488 h=127 → y+32=520 ≤ 800`，整层底边 615 ≤ 800 免滚动可见 |

- 闸门日志：`before|after/pd62-placeholder-fold-gate.log.json`（全量 boundingBox 留痕）
- 构建：`npm run build:merchant`（tsc -b＋vite build）基线／改后两跑全 ✓

## 两问闸

1. 只碰本缺陷：是（2 件最小 diff＋卷宗；未碰 drizzle／端口业务逻辑）
2. 涉钱／真写库：否（只读会话＋量测截图；证据库 tmp 件测完即清）

— KimiCode A窗（K3 MAX）· 2026-10-21
