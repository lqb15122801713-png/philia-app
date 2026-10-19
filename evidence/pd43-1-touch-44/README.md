# PD-43.1 · U4 杂志／商城触控高≥44 卷宗

- Worktree：`E:\KIMI code\pd43-1-touch`
- 分支：`feat/pd43-1-touch-44`
- 基线：`main@eb95da6`（`eb95da6fa78674eb8cd27251a3c1e5e091c64f15`，PD-43 PR #139 已合；从该 tip 开本支）
- 范围：仅 M1–M4 触控高≥44（min-h-[44px] 等价手法），不扩功能／不扩扫／不判美
- 禁区：未真付真退、未动选品树、未抢 PD-42（19296 窗）、未碰 u4-mag-mall 旧树、未 reset --hard

## 改动（3 文件 4 行，均只加 `min-h-[44px]` 与 flex 居中）

| 点 | 位置 | 手法 |
|---|---|---|
| M1 杂志「去预约同款洗护」`philia-mag-lead-cta` | `apps/customer/src/pages/PhiliaPage.tsx` | `inline-flex min-h-[44px] items-center`（原 py-2，h=34） |
| M2 杂志「会员码」会员条内 `/me/card` Link | `apps/customer/src/pages/PhiliaPage.tsx` | `inline-flex min-h-[44px] items-center`（原 py-1.5，h=30） |
| M3 商城页头「购物袋」CartLink | `apps/customer/src/components/mall/CartLink.tsx` | `flex min-h-[44px] items-center`（原 py-1.5，h=27） |
| M4 商城 hero「去逛逛」`mall-hero-cta` | `apps/customer/src/pages/MallPage.tsx` | `inline-flex min-h-[44px] items-center`（原 py-1.5，h=30） |

另新增实测闸 `scripts/pd43-1-touch-44-check.mjs`（CDP 逐枚读 `getBoundingClientRect().height`，阈值 ≥44px，仿 u2/u4 既有 check 件）。

## 红绿记录（CUSTOMER_URL=http://127.0.0.1:7163，API_BASE=http://127.0.0.1:7200，390×844 移动视口）

| 阶段 | 命令 | 结果 |
|---|---|---|
| 先红 | `EVIDENCE_PREFIX=before node --experimental-websocket scripts/pd43-1-touch-44-check.mjs`（基线 stash 态） | 0/4；M1=34／M2=30／M3=27／M4=30，与工单基线值逐点一致 |
| 后绿 | 同上，`EVIDENCE_PREFIX=after`（修复态） | 4/4；四点全 44px |
| 交付前复核 | 同上，`EVIDENCE_PREFIX=final` | 4/4 |
| U4 回归 | `EVIDENCE_PREFIX=u4reg EVIDENCE_DIR=evidence/pd43-1-touch-44/u4-regression node --experimental-websocket scripts/design-upgrade-u4-mag-mall-check.mjs` | 2/6（详见诚实注记） |
| U4 基线对照 | 同上，`EVIDENCE_PREFIX=base EVIDENCE_DIR=.../u4-regression-base`（基线 stash 态） | 2/6，失败明细与修复态逐字相同 |
| scoped lint | `npx eslint src/pages/PhiliaPage.tsx src/pages/MallPage.tsx src/components/mall/CartLink.tsx`（cwd=`apps/customer`） | 通过 |
| 三端构建 | `npm run build` | 通过（exit 0）；仅既有 chunk 体积提示 |

## 证据

- 先红：`before-philia.png`、`before-mall.png`、`before-results.json`
- 后绿：`after-philia.png`、`after-mall.png`、`after-results.json`
- 复核：`final-philia.png`、`final-mall.png`、`final-results.json`
- U4 回归：`u4-regression/`（修复态）、`u4-regression-base/`（基线对照）

## 诚实注记

- 本片只修 M1–M4 触控高；未做验收结论，不判美。
- U4 回归闸 188/188D/189C/189S 四红为**基线既有**（基线 stash 态同四红、明细逐字相同）：本 worktree 全新种子库回馈金余额为 ¥0，回馈条/抵扣联动类断言依赖更富的夹具数据；与本片 min-height 改动无关（diff 仅 4 行 className）。
- 本机 7100/7143 端口被其他窗 dev 服占用，本片实测走 7163（customer）+7200（API，显式 `CORS_ORIGINS` 放行 7163，`VITE_API_BASE=http://127.0.0.1:7200` 对齐 cookie 站域）；测完已自清，未动他窗进程。
- Node 20 需 `--experimental-websocket` 跑 CDP check 件（既有 check 件同此约束）。
