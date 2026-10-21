# 卷宗 · PD-62 placeholder-fold（占位层「储值／报表口径」移入首屏）

- BRANCH：`feat/pd62-placeholder-fold`｜WORKTREE：`E:\KIMI code\pd62-placeholder-fold`｜基线：main@`ad9dd53`（全 `ad9dd539d7fb49a3cbbfc2abe5bad838beaf8d40`）｜模型：K3 MAX
- 令围：只修 L-2（销项-产品-1021-PD55至PD57.md 候选池第 2 条）——商家 console 办事首页**占位层（储值 C2／报表口径 E2 两张占位卡）在 1280×800 首屏外，需滚动可见**。
- **迁移号：本窗未动 drizzle／`_journal.json`（纯前端 1 件＋断言脚本 1 件），独占号 0103 声明保留未用；未碰 0093／0095–0101／0102／0104。**

## 缺陷实尺（before，基线构建产物实测）

1280×800 视口（Edge headless CDP，店主种子会话，`console-home` 终态落定后量测）：

| 元素 | y | h |
|---|---|---|
| 关停条（WDanger 危险区） | 80 | 94 |
| 常办层（5 卡） | 230 | 242 |
| 慎办层（8 卡） | 488 | 357 |
| **占位层（2 卡）** | **861** | 127 |
| 高级层折叠区 | 1016 | 84 |

占位层顶边 y=861 → y＋最小可见高 32 = **893 > 800**，断言 **FAIL**（缺陷坐实，须滚动方可见）。

## 最小 diff（2 件，令围「仅调整顺序」）

1. `apps/merchant/src/pages/ConsolePage.tsx`：`HOME_TIERS` 层序 常办→慎办→占位 换为 **常办→占位→慎办**（数组一行序换＋注释对齐）。
   卡数 15（常办5／慎办8／占位2）、层内口序、卡面工艺（慎办卡其左条／占位降透 opacity-60）、留痕数据源、端口逻辑、
   关停条危险区、侧栏 IA **全不动**；不新增功能、不加键、不动色板。
2. `scripts/pd62-placeholder-fold-check.mjs`：一条可视断言（仓例零新依赖 CDP 驱动，Playwright 同义口径）——
   1280×800 视口下 `console-tier-pending`（占位层）boundingBox.y＋最小可见高(32) ≤ 800。

## 自验（本窗栈 server@7262＋merchant preview@7162，VITE_API_BASE 构建期钉 7262，CORS 白名单 7162，独立证据库 E:/KIMI_tmp/pd62/face.db，测完即清）

- 构建：`npm run build:merchant`（tsc -b ＋ vite build）基线／改后两跑全 ✓。
- 可视断言：`node scripts/pd62-placeholder-fold-check.mjs`
  - before（基线产物）：**FAIL**——`tierPending.y=861 h=127 → y+32=893 > 800`（`before/pd62-placeholder-fold-gate.log.json`）
  - after（本分支产物）：**PASS**——`tierPending.y=488 h=127 → y+32=520 ≤ 800`，整层底边 615 ≤ 800 全层免滚动可见（`after/pd62-placeholder-fold-gate.log.json`）
  - 15 卡等权不变留痕：tierCounts after＝`{daily:5, careful:8, pending:2}`；关停条 y=80 h=94、常办层 y=230 h=242 改前后逐像素一致。
- 截图对比（1280×800）：
  - `before/console-1280x800-视口.png`：常办 5 卡＋慎办层前两行，占位层不在画面（须滚动）。
  - `after/console-1280x800-视口.png`：常办 5 卡 → **占位层「储值／报表口径」两卡整层在首屏内** → 慎办层首行随见。
  - `before|after/console-1280x800-全页.png`：整页对照（高级层折叠区、页底共构注原样）。

## 两问闸

1. 是否只碰本缺陷？——是：2 件最小 diff；未碰 KPI／STEPS／CLIP／端口业务逻辑／侧栏 IA／关停条；未碰 drizzle。
2. 是否涉钱／真写库？——否（只读登录会话＋量测截图；证据库一次性 tmp 件，测完即清）。

— KimiCode A窗（K3 MAX）· 2026-10-21
