# PD-48 · O-SLOTKEY（SLOTKEY_MISMATCH）卷宗

> A窗 · feat/pd48-slotkey-fix · 基线 main@ea910dc（含 PD-47）· 2026-10-20 · K3 MAX

## 根因（一句话）

迁移 `server/drizzle/0025_slot_contents.sql` 种子段 **SELECT 列序与 INSERT 列单错位**：
`INSERT (id, slot_key, version, …)` 配 `SELECT 'seedslot_'||key, 1, key, …` —— 字面量 `1` 落进 `slot_key`、真键文本落进 `version`（SQLite 动态类型不拦 text 入 integer 列）。
凡经迁移建库的环境（大测库），六槽 `slot_key` 全塌成 `"1"`：

- 客户端 `slotContentOf('home.banner')` 读不到（liveMap 只有 key `"1"`）→ 首页运营条回落码内默认；
- `slotPort.upload(home.banner)` 查无此键 → **400 未知槽位键**；
- 控台 `slotPort.list` 按 slotKey 聚组 → 只剩 `"1"` 组可操作。

`seed.ts`（SLOT_SEED_ROWS 单源）与 0086 迁移本就正确；唯一错位件=0025 种子段。

## 修复（最小 diff，3 件）

| 件 | 动作 |
|---|---|
| `server/drizzle/0025_slot_contents.sql` | SELECT 列序更正为 `…, s.slot_key, 1, …`（新库源头即正） |
| `server/drizzle/0089_pd48_slotkey_repair.sql` | 新增校正迁移：`UPDATE slot_contents SET slot_key=version, version=1 WHERE slot_key='1' AND version IN (六键白名单) AND id='seedslot_'||version`——三重守卫只认 0025 塌键种子行，新库/已修复库零命中（幂等） |
| `server/drizzle/meta/_journal.json` | 登记 idx 89 |

服务端 router／客户端读键／seed.ts 零改动（本就正确，病在库内数据）。历史 `"1"` 处置=迁移拨正为真键，不存兼容映射（`slotKey='1'` 此后按注册表纪律 400 未知槽位键，见 03 实测）。

## 验收锚点 → 证据

| 令锚点 | 证据 | 结果 |
|---|---|---|
| ①种子/读写一致 | `01_新库全迁移_种子键正确.txt`（新库 0025+0089 全迁移：10 槽真键 v=1 live，无塌键）＋`03` 段①（seed.ts 落库同帧） | PASS |
| 旧库拨正/幂等 | `02_旧库塌键_0089拨正_幂等.txt`（复刻塌键现场 6 行全拨正；干扰行 2 条零误伤；重放 changes=0） | PASS |
| ②客首页运营条↔运营位对得上 | `03` 段②：liveMap 客户读口 key=`home.banner`（url=/brand/banner-home-1200.png, alt=首页品牌横幅）＝客户端 `slotContentOf('home.banner')` 读键；`mall.hero` 三行=运营轨同配置包同帧 | PASS |
| ③upload home.banner ≠400 | `03` 段③：owner upload→pending v2；publish→liveMap 即新值；revert→复原（读写闭环） | PASS |
| ④四端可见性不误投 | `03` 段④：customer upload 403；旧塌键 `'1'`→400。客户端 audience 闸（HomePage.tsx:148-158）不在本缺陷链路，未动；商/员两端不读 `home.banner` 营销条（merchant 画布仅缩图读 live 值、staff 用 `login.hero.staff`），无误投面 | PASS |
| 静态闸 | `tsc --noEmit` server 通过 | PASS |

## 全量 e2e 说明（8 项失败=基线既有伤同帧，本令 0 新增）

- `04_e2e_全量回归.txt`：首跑 7200 口，56.2 起 ECONNRESET 中断（并行窗/端口环境干扰），仅录得 56.1 一项 ✗，样本作废。
- `05_e2e_全量回归_7398.txt`：E2E_PORT=7398 避让全程跑完（107 段到底、端口自清），8 项 ✗：
  56.1×2／76.3／98.2（copy 计数 4279→4300=0086 增 21 键断言未同步）、57.1（「六槽」断言=前 0086 口径，现 10 槽）、74.11／77.2／81.4（会员 cohort/导航 copy/效期，与日况或他批漂移相关）。
- `06_e2e_基线对照_7398.txt`：stash 本令 diff 后基线 ea910dc 复跑，**同 8 项 ✗ 逐字同帧**——全部属基线既有伤，与本 diff 零因果（本 diff 只触 slot_contents 种子/迁移，且 e2e 流程 migrate 后必经 seed.ts 重建槽位，基线下键面亦正——这正是塌键只在纯迁移建库的大测库发作的原因）。copy 计数口径疑归 PD-49 窗，本窗不越界。

## 禁区自查

未碰选品树/片*/审美文案；未扩 INCONCLUSIVE3（人群/排期/Dismiss 未动）；未合未部；无真付真退；临时件（pd48-*.mjs、KIMI_tmp 库）测毕自删。
