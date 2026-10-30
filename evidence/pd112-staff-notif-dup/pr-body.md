## PD-112 · 员工端通知同文同戳双行去重

窗：`PD-112-staff-notif-dup`  
基线：`524b4bc7e203890e42dd90c01bfd7a4c6f84613b`／DEPLOY `20261029214338`  
迁移：**0148 故意空留**（零 schema，未占文件）

### 根因与最小修

只读现网首屏 50 行证实：同秒重复 24 组、同分钟重复 25 组。R64 的 20:51 双行实际相差 1 秒（`12:51:11Z`／`12:51:12Z`），原“同秒”键漏掉潘婧 `title|time|bodyHead` 口径下的同分钟双行。

本 PR 只把 `apps/staff/src/lib/notifications.ts` 的分组时间精度从秒改为分钟，并同步页面旧注释。全部原始 ID 保留、未读代表不丢，不同分钟不合并；未改接口、schema、种子、密度或全部已读。

### 候选证据

- 新回归先 RED `3!==2`，最小改动后 GREEN；受控恢复同秒键再次 RED，已还原并复跑最终绿。
- 最终相关单测 **12/12**；三端 `npm run build` exit 0；触及文件 lint exit 0。
- 同一现网只读 50 行字段的候选真实 React dist 探针：`dupPairGroups=0`、50→25 行。
- 未读角标保持原接口真实 61；25/25 含未读 ID 组保持未读；`clickedAllRead=false`、业务 `mutations=[]`。
- 机械核验 **25/25**；关键帧见 `evidence/pd112-staff-notif-dup/shots/final/notifications.png`。
- localhost 仅辅助探针，不冒充交付 HIT 或现网证据；候 PR Verifier＋异窗码质审。

### dist

| 包 | 文件 | SHA-256 |
|---|---|---|
| 冻结现网员包 | `index-STmHfnb4.js` | `6a69f2022ace565a385188e3f03ef0b5b99ab54efb284a22b4a27b6427160ef0` |
| 候选员包（非 tip、未部署） | `index-Cp859QUp.js` | `f4fd436127c85693512670aa18835629d02d017a52233df704979692b5fded0d` |

### 已知基线红与边界

全量员工 lint 仍为 **25 errors／1 warning**，全部位于本 PR 未触及文件；未扩面修，不宣称全量 lint 绿。触及文件 lint 为 0。

未做密度大改、全部已读大改、客／商端、商城、售卡、日结；未抢 PD-106、未动 108／110、未重冻 111／109／105；未碰 `01M5EQVF`，零业务写。

**PR 只开不合、合前禁部。** 合部须 Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全＋同轮新鲜 DEPLOY／HEALTH×4；缺陷不正式销，候交付 HIT 与合后潘婧路径复测。
