# PD-48 · O-SLOTKEY（SLOTKEY_MISMATCH）slotKey 接线修

> 基线 main@ea910dc（含 PD-47）· 只修一缺陷 · **只开不合**

## 根因

迁移 `server/drizzle/0025_slot_contents.sql` 种子段 **SELECT 列序与 INSERT 列单错位**：
`INSERT (id, slot_key, version, …)` 配 `SELECT 'seedslot_'||key, 1, key, …` —— `1` 落进 `slot_key`、真键文本落进 `version`（SQLite 动态类型不拦）。
凡纯迁移建库的环境（大测库），六槽 `slot_key` 全塌成 `"1"`：

- 客户端 `slotContentOf('home.banner')` 与 liveMap key 对不上 → 首页运营条回落码内默认；
- `slotPort.upload(home.banner)` → **400 未知槽位键**；
- 控台 `slotPort.list` 只剩 `"1"` 组可操作。

`seed.ts`（SLOT_SEED_ROWS）与 0086 本就正确——这也是 e2e（migrate 后必经 seed 重建槽位）长期没拦住、只在纯迁移建库环境发作的原因。

## 修复（3 件，最小 diff）

1. `server/drizzle/0025_slot_contents.sql`：SELECT 列序更正（新库源头即正）。
2. `server/drizzle/0089_pd48_slotkey_repair.sql`：校正迁移拨正存量库——`slot_key←version 真键、version 回 1`；三重守卫（`slot_key='1'` + 六键白名单 + `id='seedslot_'||version`）只认塌键种子行，新库/已修复库零命中（幂等，重放零副作用）。
3. `server/drizzle/meta/_journal.json`：登记 idx 89。

服务端 router／客户端读键／seed.ts 零改动。历史 `"1"` 处置=迁移拨正，不存兼容映射（`slotKey='1'` 此后按注册表纪律 400）。

## 验收锚点自测（卷宗 evidence/pd48-slotkey-fix/）

| 锚点 | 结果 |
|---|---|
| ①种子/读写一致 | PASS（01 新库全迁移 10 槽真键 v=1；03 seed 落库同帧） |
| ②客首页运营条↔运营位 | PASS（liveMap key=home.banner=/brand/banner-home-1200.png；mall.hero 三行同运营轨配置包） |
| ③upload home.banner ≠400 | PASS（pending v2→publish 即新值→revert 复原 读写闭环） |
| ④四端可见性回归 | PASS（customer upload 403；旧塌键 '1'→400；商/员端无 home.banner 误投面） |
| 旧库拨正＋幂等 | PASS（02：6 行塌键全拨正，干扰行零误伤，重放 changes=0） |
| tsc --noEmit（server） | PASS |

## 全量 e2e

7398 口全程跑完，8 项 ✗；**stash 本 diff 后基线 ea910dc 复跑同 8 项逐字同帧**（56.1×2/76.3/98.2=0086 copy 计数断言漂移；57.1=「六槽」旧口径；74.11/77.2/81.4=他域日况漂移）——全部基线既有伤，本令 0 新增回归。对照件：05/06。

## 禁区

不碰选品/片*/审美；不扩 INCONCLUSIVE3（人群/排期/Dismiss 未动）；不真付真退；**不写验收通过**；只开不合。
