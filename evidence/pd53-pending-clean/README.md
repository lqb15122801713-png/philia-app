# PD-53 · home.banner pending×3 清理卷宗

> A窗 · feat/pd53-pending-clean · 基线 main@4313b1c（`4313b1c323841137972f2c0c4c7e4f5e45c53c78`）· 2026-10-21 · K3 MAX

## 现象（令包钉死）

`home.banner` 槽遗留三条从未 publish 的 pending 行（live 未污染）：

| id | version | 来源 |
|---|---|---|
| `01M5CJ1VSGY044WYZAQM6J3V6B` | v4 | 大测「运营轨」遗留 |
| `01M5CW2HP3F4ASD64R03GQ1ZFF` | v2 | PD48 探测稿 |
| `01M5CW2J26H0C69EV8X9ZPP1GB` | v3 | PD48 探测稿（alt=`PD48点验探测-勿上线`） |

探测/遗留稿滞留控台「待审」队列＝误点 publish 即上线探测件的隐患。
依据：`线上运营_修后点验_PD50_O-SLOTKEY_2026-10-21.md` §6；销项观察挂②。

## 处置（最小 diff，2 件；router／客户端／seed.ts 零改动——病在库内历史数据）

| 件 | 动作 |
|---|---|
| `server/drizzle/0094_pd53_pending_clean.sql` | 新增清理迁移（单段 UPDATE）：白名单三 id + `slot_key='home.banner'` + `status='pending'` 三重守卫 → `archived`（刷新 updated_at）。行体/content_json 原文在册＝归档留痕，不物理删（本表纪律：版本行只增不改、无删除端点） |
| `server/drizzle/meta/_journal.json` | 登记 **idx 94**（`0094_pd53_pending_clean`，when=1792548194736 > 0092 folderMillis；0093/0095 为同批 PD-52/PD-54 预留号，本分支 journal 跳号属设计） |

处置方案选型：令许「归档／作废／删除（任选可留痕方案）」——取**归档**（`status='archived'`），
与 0091 dual-live 收敛、D-40 紧急下线同族口径：历史行在册可查（控台 list archived 区透出
版本/操作人/时间），控台「待审」清零，不触 live、不代运营 publish。

## 验收锚点 → 证据

| 令锚点 | 证据 | 结果 |
|---|---|---|
| ①三行归档且留痕 | `01+02+03_…txt` 段②：三行 pending→archived，content_json（含 `PD48点验探测-勿上线` alt 原文）逐字节不动、version 不改、updated_at 刷新；行数守恒（无物理删）；list archived 区三 id 在册 | PASS |
| ②禁 publish 探测稿 | 迁移只写 `status='archived'`，无 live 写入路径；段②实测三行终态 archived | PASS |
| ③禁改 live | 段②：live 行 `01M5CJ3ETDFNGNETQJM6DVV0J0`（v5，url=`/brand/banner-home-1200.png`）status/content_json/updated_at 全字段零改动；段③ list live 仍＝该行 | PASS |
| ④客壳无探测 alt | 段③：真 server liveMap home.banner＝live 件 `/brand/banner-home-1200.png`；全槽无 `PD48`/`探测` alt；匿名 list 硬拒 401/403（权限口径不动） | PASS |
| 待审清零不误伤 | 段②：它槽 decoy pending（mall.hero）保持 pending 不动；home.banner pending=0 | PASS |
| 新库零副作用 | 段①：全迁移（含 0094）后 home.banner 仅种子 v1 live，全表零 pending；migrator 重放零新增 | PASS |
| 幂等 | 段②：0094 原文重放 rowsAffected=0；migrator 重放 __drizzle_migrations 不增 | PASS |
| 静态闸 | `tsc --noEmit` server 通过（本 diff 无 TS 改动，SQL+journal only） | PASS |
| 全量回归 | `04_e2e_全量回归.txt`（E2E_PORT=7310 避让并行窗）；`05_e2e_基线对照.txt`：✗ 集合与基线卷宗（pd51-clock-copy/04）逐项全同＝8 项失败全为基线既有（计数断言未随 0085/0086 批更新＋日期敏感项），本 diff 零新增失败 | PASS（零回潮） |

## 禁区自查

未 publish 任何探测/遗留稿；未改 live 行；未碰 0093/0095 迁移号（独占 0094/idx94）；
未碰选品树/片*/审美文案/L-CLOCK/CLIP（PD-54）/banner 待换图源（PD-52）；未合未部；
无真付真退；一令一树一分支（WORKTREE=`E:\KIMI code\pd53-pending-clean`，
BRANCH=feat/pd53-pending-clean，未动 pd52/pd54 树）；临时件（server/pd53-verify.mjs、
OS 临时库 pd53-*）测毕自删。
