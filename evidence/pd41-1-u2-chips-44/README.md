# PD-41.1 / CJ-1018-07-M1 · U2 chips 触控高卷宗

- Worktree：`E:\KIMI code\pd41-1-chips`
- 分支：`feat/pd41-1-u2-chips-44`
- 基线：`main@8feca4c7`（`8feca4c7bde2efae9b8e6089086cbacb25aa1d07`，PR #136 已合）
- 范围：仅 `u2-chip-store/pet/service/staff` 顶栏 chips 的触控高；Default 与已选态共用同一 `chipClass`
- 禁区：未改时段格、未扩扫、未动选品树、未真付真退、未提交预约、未抢 PD-39

## 改动

- `apps/customer/src/pages/GroomingSinglePage.tsx`：`chipClass` 从 `min-h-10` 改为 `min-h-11`（Tailwind 44px）。
- `scripts/design-upgrade-u2-booking-check.mjs`：新增 M1 实测量，逐枚读取 `getBoundingClientRect().height`，阈值 ≥44px；闸门总数 13→14。

## 红绿记录

| 阶段 | 命令 | 结果 |
|---|---|---|
| 先红 | `CUSTOMER_URL=http://localhost:7103 API_BASE=http://localhost:7200 EVIDENCE_PREFIX=before EVIDENCE_DIR=evidence/pd41-1-u2-chips-44 node scripts/design-upgrade-u2-booking-check.mjs` | 13/14；M1 实测 store/pet/service/staff 全为 40px |
| 后绿 | 同上，`EVIDENCE_PREFIX=after` | 14/14；M1 实测四枚全为 44px；无提交预约／支付请求 |
| 交付前复核 | 同上，`EVIDENCE_PREFIX=final` | 14/14 |
| scoped lint | `npx eslint src/pages/GroomingSinglePage.tsx`（cwd=`apps/customer`） | 通过 |
| 三端构建 | `npm run build` | 通过；仅既有 bundle 体积与 zod 注释警告 |

## 证据

- 先红截图／结果：`before-*.png`、`before-results.json`
- 后绿截图／结果：`after-*.png`、`after-results.json`
- 交付前复核：`final-*.png`、`final-results.json`

## 诚实注记

- 本片只修触控高；未做验收结论，不判美。
- 本 worktree 使用主仓 node_modules junction 复用依赖；未改 package 或 lockfile。
