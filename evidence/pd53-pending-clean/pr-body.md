# PD-53 · home.banner pending×3 清理（迁移独占 0094）

## 只修一缺陷

`home.banner` 槽遗留三条从未 publish 的 pending 行（live 未污染），滞留控台「待审」队列＝误点 publish 即上线探测件的隐患：

- `01M5CJ1VSGY044WYZAQM6J3V6B`（v4，大测「运营轨」遗留）
- `01M5CW2HP3F4ASD64R03GQ1ZFF`（v2，PD48 探测稿）
- `01M5CW2J26H0C69EV8X9ZPP1GB`（v3，PD48 探测稿，alt=`PD48点验探测-勿上线`）

依据：`线上运营_修后点验_PD50_O-SLOTKEY_2026-10-21.md` §6（销项观察挂②）。

## 处置（最小 diff，2 件；router／客户端／seed.ts 零改动——病在库内历史数据）

- `server/drizzle/0094_pd53_pending_clean.sql`：白名单三 id + `slot_key='home.banner'` + `status='pending'` 三重守卫 → `archived`（刷新 updated_at）。**归档留痕不物理删**（本表纪律：版本行只增不改、无删除端点；content_json 原文在册可查）。
- `server/drizzle/meta/_journal.json`：登记 idx **94**（0093/0095 为同批 PD-52/PD-54 预留，本分支跳号属设计）。

## 令禁区对账

- 未 publish 任何探测/遗留稿（迁移无 live 写入路径，实测三行终态 archived）
- 未改 live 行：`01M5CJ3ETDFNGNETQJM6DVV0J0`（v5，`/brand/banner-home-1200.png`）全字段零改动
- 客壳无误投：liveMap 只透 live，无 `PD48`／`探测` alt
- 它槽 pending 零误伤；行数守恒
- 不修 banner 待换图源（→PD-52）、不修 CLIP（→PD-54）

## 验收证据（`evidence/pd53-pending-clean/`）

| 锚点 | 证据 | 结果 |
|---|---|---|
| 新库全迁移零命中（仅种子 v1 live、零 pending）＋重放零新增 | `01+02+03_…txt` 段① | PASS |
| 现场三行 pending→archived 留痕／live 零改动／decoy 不误伤／行数守恒／0094 重放 rowsAffected=0 | 同 段② | PASS |
| 运行时：liveMap=live 件无探测 alt；list home.banner pending=[]、live=01M5CJ3…、archived 含三 id；匿名 401/403 | 同 段③ | PASS |
| `tsc --noEmit` 通过（SQL+journal only，无 TS 改动） | — | PASS |
| e2e 全量回归（E2E_PORT=7310 避让并行窗）；基线对照：8 项失败与基线卷宗逐项全同（既有失败），零新增 | `04_e2e_全量回归.txt` / `05_e2e_基线对照.txt` | PASS（零回潮） |

— A窗 · feat/pd53-pending-clean · 基线 main@4313b1c · K3 MAX · PR 只开不合
