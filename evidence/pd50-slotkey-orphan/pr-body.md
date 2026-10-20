# fix(server): PD-50 O-SLOTKEY 续——orphan live slot_key="1" 迁并 home.banner（0091 迁移）

## 令

PD-50（权威件：D:\Philia-shared\大测-产品-1020-下批令包字段-PD50-O-SLOTKEY续-fdac5a54.md）。
基线 main@fdac5a54（含 PD-48＋PD-49）。只修一缺陷：0089 只拨正 seedslot_* 塌键种子行；
大测 publish 的 orphan live（如 01M5CJ3…）仍挂 slot_key="1"。

## 根因

塌键窗内控台唯一可见组='1'（六槽塌键种子合组），运营对首页横幅的 upload/publish 落成了
slot_key='1' 的 orphan 行；0089 白名单守卫只认 seedslot_* 种子行，orphan 残留 →
liveMap 透出 key='1'、客壳 slotContentOf('home.banner') 读不到回落壳默认、控台 list 键分裂。

## 修复（最小 diff：1 迁移 + journal 登记；router/客户端/seed 零改动）

`server/drizzle/0091_pd50_slotkey_orphan.sql` 三段（幂等，守卫=slot_key='1'）：

1. orphan 版本号按 (created_at,id) 序接 home.banner 最大整数版本续排（清塌键期文本垃圾版本）；
2. slot_key='1' 残余行一律改键 home.banner（塌键窗唯一运营对象=首页横幅位）；
3. 单 live 防御收敛：保留版本最高者（=运营最近发布件），余者 archived 留痕不物理删。

不回抬其余五槽被塌键窗 publish 连带扫成 archived 的种子 live（回落码内默认与种子 live 值
同帧零视觉差；运营可在控台自行 revert/publish——本令不代运营 publish 探测稿）。

## 验收（证据见 evidence/pd50-slotkey-orphan/）

- 新库全迁移零命中零副作用；orphan 现场迁并 changes=6、重放 changes=0（幂等）；dual-live 防御收敛；
- 真实迁移路径（抹 0091 记录重跑 db:migrate）后：liveMap key=home.banner 无 '1'；
  客壳运营条吃 orphan live 件（非壳默认）；list 无 '1' 组、upload(home.banner)→pending v3 续排、
  upload('1')→400；publish/revert 闭环；customer upload 403（商/员无误投面）；
- `tsc --noEmit` server 通过。

## 禁区

未碰选品/片*/审美文案/L-CLOCK；未代运营 publish；未合未部；无真付真退；临时件测毕自删。
