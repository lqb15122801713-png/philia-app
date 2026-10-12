# 卷宗 · 控制台改版批 片 1（办事导向首页+入口归并）· evidence/console-ia

> 令=开工令-产品-1012-控制台改版批片1.md ｜ 任务书=冻结版 V1.0（老板 10-12 签；开口项两件裁死：默认首页=新办事首页/侧边栏留开发者管理端单入口）｜ 基线=main 现尖 `8a6b87b2`（codeload 钉 sha）｜ 分支 `feat/console-ia-1`（PR 只开不合）｜ 纪律=PM-1008+红区补丁+拟人化五条死规+**视觉零改动纪律** ｜ 2026-10-12

## 一、片 1 交付面（令围全量）

1. **刀 1 · 控制台首页改「办事导向」**（默认首页）：`/console` 无参落地=办事卡面——15 口=现有 A/C/D/E/F 域端口件一个不删全量成卡（改文案/换素材/画布装修/改会员档/改提成/改 XP/改支付通道/数据订正/参数字典/回收站/门店档案/安心包/会员营销直达/储值·报表口径置灰待立）；每卡=标题「你能干什么」+一句人话说明+**最近改动留痕行**（既有读口透出：config.versions 五域/slotPort.list/canvas.getLayout(home)/correction.list，零新建数据源）；**参数表形态降级=高级层**（默认折叠，展开=15 端口全量目录点即达，不再是门面）；点卡进端口内核直嵌渲染+页内「‹ 回办事首页」返回行；?port= 直达口保留（画布权益墙「去会员档改数 ›」等既有跳口不断）。
2. **刀 3 · 重复入口归并**：侧边栏底部「规则配置/文案端口/槽位端口」三重复子行收进控制台（卡面+高级层），rail foot 留「开发者管理端」单入口；**旧路由 /settings/rules|copy|slots 保留可直达不删**（路由表零改动=既有书签不断）。

## 二、边界自查（写死件）

视觉零改动（全用既有 wsk-card/wsk-hd/Btn 件+既有色板字号，只动 IA）｜ 端口件内核零改动（右栏直嵌原内核一行不动）｜ 商家端主体（驾驶舱/收银台等）不动 ｜ 今日经营台不做。

## 三、闸门实证（全绿在案）

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 build（根一条命令） | 绿 | build-gate.log |
| server typecheck | 绿 | typecheck.log |
| e2e 全量（97 族） | **五绿**（连跑六绿一红，红=ECONNRESET 环境件早夭复跑即绿，同族在案） | e2e-green-1.log / e2e-green-2.log |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0（零新路由=零路由申报） | nav.log / nav.json |
| smoke-routes | 109/109（**旧路由零死链断言**=/settings/rules|copy|slots 三行既有覆盖全过） | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 🎉 | smoke-deploy.log |
| 实尺截图 | 全绿（S1-S5 八帧） | shots/ + checks.json + shots.log |

e2e 97 族新断言：97.1 办事卡面人话键族 37 枚全落库（0075 种子·台账新规对账）+默认值抽查；97.2 留痕行数据源读口全通（config.versions[copy]+canvas.getLayout[home]+slotPort.list+correction.list 形状齐）。

## 四、实尺截图清单（shots/；栈=7131 商家 preview+7200 API+ia-gate.db）

- S1-console-home-cards.png：**新首页办事卡面**（/console 默认落地 15 卡+留痕行）；
- S2-advanced-expanded.png：**高级层展开**（参数表降级实证：默认折叠→展开=15 端口目录）；
- S3-card-to-canvas-port.png：**点卡进端口**（画布装修卡→画布端口内核直嵌）+返回首页断言在 checks.json；
- S4-rail-single-entry.png：**侧边栏归并**（foot=开发者管理端单入口，三重复子行消失）；
- S5-legacy-rules/copy/slots.png×3：**旧路由直达三帧**（/settings/rules|copy|slots 照常渲染零死链）。

## 五、迁移申报（本片一件，幂等）

`server/drizzle/0075_console_ia1.sql`（journal idx 75）：copy_overrides 37 枚新键种子（cadm.home/card 办事卡面人话键族；值/screen/position=生成件 copySeedRows.ts 单源逐字）；全 NOT EXISTS 守卫；临时库 migrate+seed 实证 4171 键全落（4134+37）、重放零副作用（计数断言==37 在文件头）。**台账新规照走：键入码必随迁移。**

## 六、候裁明面

1. 留痕行=既有读口零新建：五域（copy/member_plans/commission/xp/pay）读 config.versions、槽位读 slotPort.list、画布读 home 屏版本轴、订正读订正单首行；**无读口卡（字典/回收站/档案/安心包/营销/置灰两口）留痕行=「近期无改动留痕」诚实占位**——要全域留痕=需建统一审计读口（新系统件，候立项）；
2. 片 2（全局搜索 Cmd+K）候令随发——高级层目录=搜索落地前的过渡可达面；
3. 支付批/画布批候裁明面件照挂零触碰。

## 七、红线自查

零新依赖 ｜ 迁移幂等+申报（0075 一件） ｜ 键入码必随迁移 ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ 闸门栈 7130-7132+7200（CORS 显式） ｜ 收摊必净（netstat 实证 PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合 ｜ 视觉零改动纪律（组件/色板/字号全照旧）。
