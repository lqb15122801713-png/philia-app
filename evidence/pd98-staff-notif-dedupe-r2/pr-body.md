## PD-98 R2 · 员工端通知同源去重

窗：`PD-98-staff-notif-dedupe-r2`
基线：`50d6a66f2162de881c32ab57268e076f81aeca4f`／DEPLOY `20261026192944`
迁移：**0145 故意空留**（零 schema）

### 根因与最小修

只读 tRPC 证实：25 组重复行的 `type/title/body/createdAt` 相同，只有 `link` 不同。首版把 `link` 纳入分组键，导致同源同秒提醒全部穿透。

本补钉仅从分组键移除 `link`，保留 `type/title/body/createdAt`；不同类型不误并，同组 ID 保留并一起已读。未改接口、数据库、生成器、locale、字幕、NOTE 或其它页面。

### 候选证据

- 同一 50 条现网基线字段：`rowCount 50→25`、`dupPairGroups 25→0`。
- 25 个不同提醒各保留一行，50 个原始 ID 不丢。
- `clickedAllRead=false`、业务 `mutations=[]`；未读数来自原接口。
- 复测时未读 33；当前快照为 35，同源比较 **35→35**，不以时点差冒充清。
- `NOTIF-DUP-ROWS-OBS`：本地候选覆盖，候交付 HIT；未用 REUSE／换 tip／全部已读冒充清。

### 新鲜验证

- 三端 `npm run build`：exit 0。
- 相关测试：11/11，fail=0。
- 真实 dist 通知走测：7/7，failures=0。
- 机械核验：24/24，failures=0（`evidence/pd98-staff-notif-dedupe-r2/validation.json`）。
- 触及文件 lint：0 error／0 warning。
- 全量员工 lint：baseline 与 final 均 25 errors／1 warning；基线红未扩修，不宣称全量绿。
- 受控破坏：把 `link` 加回键后 `3!==2`、`50!==25` 见红；已还原并复跑。

### dist 对照

| 包 | 文件 | SHA-256 |
|---|---|---|
| 现网 | `index-DRu9UKUe.js` | `06b04ba2dd51c72a648d64693fe16ca4b53759e174dae9cbb374ba6e60a18392` |
| 候选 | `index-B584Q7Xj.js` | `c4fd8c1870962b587d3b34b7670af5e2da034ce2d393ffb2ff0694fe240e549e` |

候选名称同时异于 `index-DRu9UKUe.js` 与 `index-DcDp2v-Y.js`，**非 tip 包，未部署**。现网 HEALTH 同轮 200×4。

PR 只开不合；请头子派 Verifier＋异窗码质审。合前 update branch→当时 tip；合部须 Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全。PD-98 禁正式销直至合后潘婧复测-R 仅通知簇 PASS。

完整卷宗：`evidence/pd98-staff-notif-dedupe-r2/`。
