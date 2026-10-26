## PD-98 · 员工端 locale／英文字幕／通知去重

窗：`PD-98-staff-locale-notif-dedupe`
基线：`42bb0f67945fe774f2c22d098fed185a0a0929a5`／DEPLOY `20261026160104`
迁移：**0139 故意空留**（零 schema；未占 0140）

### 范围

- 可用时间／请假／预约日期芯片统一为区域设置无关的 `HH:MM`／`YYYY-MM-DD`，并校验真实日期时间；非法预约日期不驱动查询。
- 预约／我的排班／通知／我的取消装饰性英文编号；角色只显示中文，不受线上英文覆盖值回盖。
- 通知按同类型、同文、同链接、同秒分组；不同链接不误并；同组 ID 一起已读，未读总数仍走原查询。

仅员工端 7 个产品源文件＋3 个回归文件；无 customer／merchant／server／schema／迁移改动。未重开日 pill／AE-04／退出／周 pill／寄养／待换／补卡；未扩相册／关店／驾舱／传感器／日结。

### 缺陷与候选证据

- `AE-STAFF-R58-06`：基线原生控件在 `en-US` 显示 `09:00 AM`／`06:00 PM`／`10/26/2026`；候选四个值＝`09:00|18:00|2026-10-26|2026-10-26`，预约日期也为 ISO。
- `AE-STAFF-R58-07`：同六条 mock 从六行收为四行；真实 CDP 点击同组发两个 ID，未读 6→4，未点全部已读。
- `AE-STAFF-R58-08`：SCHEDULE／MY SCHEDULE／NOTIFICATIONS／ME 不渲染，frontdesk／groomer 不再外露。
- `NOTIF-DUP-ROWS-OBS`：两组成对重复各收一行，未读总数仍来自原接口。
- `EN-SUBTITLE-EXPOSURE-OBS`：五个指定字幕均有基线／候选页面与截图对照。

以上均为**本地候选覆盖，候交付 HIT**；未用 REUSE／维持面／换 tip／全部已读冒充清零。

### 新鲜验证

- `npm run build`：三端 exit 0。
- 相关单测：10/10，fail=0。
- 真实员工 dist 浏览器：16/16，failures=0。
- 机械核验：30/30，failures=0（`evidence/pd98-staff-locale-notif-dedupe/validation.json`）。
- 触及文件 lint：0 error／1 条基线 warning。
- 全量员工 lint：baseline 与 final 均 25 errors／1 warning；**基线红未扩修，不宣称全量绿**。
- 关闭前受控破坏：同秒改同毫秒后 `5 !== 3` 见红，已还原并复跑。
- 测试端口／后台任务已清理。

### dist 对照

| 包 | 文件 | SHA-256 |
|---|---|---|
| 现网 | `index-DcDp2v-Y.js` | `061fdc83250b6a5d74ba04210a9b9ee24ab8bc44f3c9f439414b77167affa9b1` |
| 候选 | `index-XpRzbUj5.js` | `cc2704440cd0a0fad21a9315fedcbdd7f85687d19e96fa7e253c180d91b3c1e9` |

现网 HEALTH 同轮 200×4。候选**不是 tip 包**，不以 localhost preview 冒领交付 HIT。PR 只开不合；请头子派 Verifier＋异窗码质审（loop-code-review／严审码质）。现网保持 `PENDING_MERGE_DEPLOY`；合部须 Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全。

完整卷宗：`evidence/pd98-staff-locale-notif-dedupe/`。
