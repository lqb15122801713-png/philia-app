# PD-50 · O-SLOTKEY 续（orphan live slot_key="1" → home.banner 迁并）卷宗

> A窗 · feat/pd50-slotkey-orphan · 基线 main@fdac5a54（含 PD-48＋PD-49）· 2026-10-20 · K3 MAX

## 根因（一句话）

PD-48 的 0089 迁移只拨正 `seedslot_*` 塌键种子行（三重守卫）；塌键窗内大测经控台
upload/publish 的 **orphan 行**（id 非 `seedslot_*`，如 `01M5CJ3…`）仍挂 `slot_key='1'`：

- 注册表无 `'1'` 键 → 控台 `slotPort.list` 另立 `'1'` 组＝键分裂；`upload('1')` 400；
- `liveMap` 透出 key `'1'`，客户端 `slotContentOf('home.banner')` 读不到 →
  客壳首页运营条回落码内壳默认，吃不到运营已发布的 live 件；
- 塌键窗那次 publish 同槽清扫连带把六槽塌键种子 live 全扫成 archived（0089 拨正键后
  状态仍 archived），home.banner 组内无真键 live。

## 修复（最小 diff，2 件；router／客户端／seed.ts 零改动——病在库内数据）

| 件 | 动作 |
|---|---|
| `server/drizzle/0091_pd50_slotkey_orphan.sql` | 新增迁并迁移（3 段）：①orphan 版本号按 (created_at,id) 序接 home.banner 现有最大整数版本续排（清塌键期文本垃圾版本）；②`slot_key='1'` 残余行一律改键 `home.banner`；③单 live 防御收敛（保留版本最高者=运营最近发布件，余者 archived 留痕不物理删） |
| `server/drizzle/meta/_journal.json` | 登记 idx 91（when=1792508469590 > 0089/0090 folderMillis，drizzle migrator「when>库内最大 created_at」口径下必被应用） |

口径说明：塌键窗内控台唯一可见组即首页横幅运营位（`'1'` 组=六槽塌键种子合组，运营
操作对象=home.banner），凡残余 `slot_key='1'` 行（含 PD-48 白名单外干扰行形态）一律
归并 home.banner——与 PD-48「不存兼容映射、`'1'` 按注册表纪律 400」的收口一致，本段
只在迁移层归并历史数据，不加运行期兼容映射。

不回抬其余五槽种子 live：它们被塌键窗 publish 连带扫成 archived，0089 已拨正键；
liveMap 缺行=客户端回落码内默认，与种子 live 值同帧零视觉差；运营如需可在控台对该槽
revert/publish 恢复（已在迁移注释留说明）。**不代运营 publish 探测稿（令禁区）。**

## 验收锚点 → 证据

| 令锚点 | 证据 | 结果 |
|---|---|---|
| 新库零副作用 | `01+02_迁移层_新库零命中+orphan迁并+幂等+dual-live防御.txt` 段①：全迁移（含 0091）10 槽全真键 v=1 单 live，无 `'1'` 行 | PASS |
| orphan 迁并 | 同文件段②：复刻 0089 后大测库现场（六槽种子 archived＋orphan live/pending 挂 `'1'` 文本垃圾版本＋白名单外干扰行）→ 0091 第一次 changes=6：orphan live→home.banner v2 live（运营发布件保住）、pending→v3、干扰行→v4、种子 v1 archived 留痕、其余槽位零误伤 | PASS |
| 幂等 | 同文件段②：0091 重放 changes=0 | PASS |
| dual-live 防御 | 同文件段③：人为并立双 live → 收敛为 orphan 单 live（高版本留存） | PASS |
| ①liveMap key=home.banner | `03_runtime_链路实测.txt`：真实迁移路径（抹 0091 记录重跑 db:migrate）后 liveMap 客户读口 key=`home.banner`、无 `'1'` | PASS |
| ②客壳运营条吃 slotPort live | 同上：liveMap home.banner 值=orphan 运营件（url=/api/img/slots/1/orphan-banner.jpg，非壳默认 /brand 路径） | PASS |
| ③upload/list 无键分裂 | 同上：list 无 `'1'` 组、home.banner 单组 live=orphan v2＋种子 archived 留痕；upload(home.banner)→pending v3 续排；upload('1')→400 未知槽位键 | PASS |
| 读写闭环不回潮 | 同上：publish v3→liveMap 即新值；revert→回 orphan 运营件 | PASS |
| ④商／员无误投营销条 | 同上：customer upload 403；商/员两端本就不读 home.banner 营销条（PD-48 卷宗 §锚点④已证，本令该链路零改动） | PASS |
| 静态闸 | `tsc --noEmit` server 通过（本 diff 无 TS 改动，SQL+journal only） | PASS |

## 禁区自查

未碰选品树/片*/审美文案/L-CLOCK；未代运营 publish 探测稿；未合未部；无真付真退；
一令一树一分支（WORKTREE=E:\KIMI code\pd50-slotkey-orphan，BRANCH=feat/pd50-slotkey-orphan）；
临时件（pd50-verify-*.mjs、pd50-probe*.mjs、OS 临时库 pd50_*.db）测毕自删。
