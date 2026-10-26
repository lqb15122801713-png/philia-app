# PD-98 R2 · 员工端通知同源去重 · 候选卷宗

- 窗／顶栏：`PD-98-staff-notif-dedupe-r2`
- WT：`E:\KIMI code\pd98-staff-notif-dedupe-r2`（自 `50d6a66` 新建，未复用原树）
- 分支：`feat/pd98-staff-notif-dedupe-r2`
- 基线：`50d6a66f2162de881c32ab57268e076f81aeca4f`／DEPLOY `20261026192944`
- mig：**0145 故意空留**；零 schema；未占 0117／0119／0122–0144
- 对照员包：`index-DRu9UKUe.js`（合前旁证 `index-DcDp2v-Y.js`）
- 候选员包：`index-B584Q7Xj.js`，**异于两份对照包，非 tip 包**
- 状态：**本地候选证据齐，候交付 HIT＋异窗监理；PR 只开不合；PD-98 禁正式销直至合后通知簇复测 PASS。**

## 1. 根因与最小修

复测-R 原始 `pd98_notif_dup.json`：50 条真实通知形成 25 组成对重复；`clickedAllRead=false`。只读 tRPC 进一步核对原始字段：每对的 `type/title/body/createdAt` 相同，只有 `link` 不同，均为同一宠物「旺财」的照护提醒。

首版分组键把 `link` 纳入，因此同源同秒、不同寄养链接的通知全部穿透。此次仅从分组键移除 `link`，保留 `type/title/body/createdAt`；不同类型仍不误并，同组所有 ID 保留并一起已读。未改接口、数据库、生成器、locale、字幕、NOTE 或其它页面。

产品改动：

- `apps/staff/src/lib/notifications.ts`：分组键移除 `link`，1 行最小产品 diff。
- `apps/staff/src/pages/staff2/NotificationsPage.tsx`：同步现有行为注释，不改布局或交互。
- `apps/staff/src/lib/notifications.test.ts`：新增真实链接差回归与 25 组／50 ID 覆盖。
- `apps/staff/scripts/pd98-staff-notif-dedupe-r2-check.mjs`：真实 dist＋同 50 条字段的通知帧与读数探针。

## 2. 缺陷 → 证据 → 状态

| 原缺陷 | 基线证据 | 候选证据 | 状态 |
|---|---|---|---|
| `NOTIF-DUP-ROWS-OBS` | `browser-baseline.json`：`rowCount=50`、`dupPairGroups=25`；`shots/baseline/notifications.png` | `browser-final.json`：`rowCount=25`、`dupPairGroups=0`、`careTitleHits=25`、`careDistinctKeys=25`；`shots/final/notifications.png` | 本地候选覆盖，候交付 HIT |
| 同源链接差穿透 | `live-notification-fields.json`：同 `type/title/body/createdAt`、不同 `link` | 同 50 条原始字段输入，50→25；50 个 ID 在分组中不丢 | 本地候选覆盖，候交付 HIT |
| 全部已读冒充修 | 基线与候选均未点击；`clickedAllRead=false`、业务 `mutations=[]` | 原始未读数仍由原接口返回；“全部已读”按钮只保持可见 | 未以此冒充清 |

**读数口径：** 复测时未读 33；当前字段快照已有新一组提醒，故未读 35。同源基线／候选比较为 **35→35**，不拿时点差或未读下降冒充去重。复测 `rowCount=51` 含页面聚合行；本探针直接数真实通知按钮，基线为 50，与接口一致。

**清零口径：** 未用 REUSE／换 tip／`hits:[]`／清未读／全部已读冒充清。基线与候选使用同一字段文件、同一视口、同一真实 React 页面；截图 SHA 不同。

## 3. dist 对照

| 包 | 文件名 | bytes | SHA-256 |
|---|---|---:|---|
| 现网 | `index-DRu9UKUe.js` | 735754 | `06b04ba2dd51c72a648d64693fe16ca4b53759e174dae9cbb374ba6e60a18392` |
| 候选 | `index-B584Q7Xj.js` | 740740 | `c4fd8c1870962b587d3b34b7670af5e2da034ce2d393ffb2ff0694fe240e549e` |

- 现网 HTML 引用 `index-DRu9UKUe.js`；候选 HTML 引用 `index-B584Q7Xj.js`。
- 候选名称同时 ≠`index-DRu9UKUe.js` 与 ≠`index-DcDp2v-Y.js`；与现网 SHA 也不同。
- 现网 HEALTH 同轮 7200–7203＝200×4；候选**未部署，不是 tip 包**。

## 4. 验证记录

| 检查 | 证据 | 结果 |
|---|---|---|
| 基线员工构建 | `baseline-build-staff.log` | exit 0 |
| 原测试 | `baseline-test-notifications.log` | 3/3，但缺同源链接差覆盖，不能据此误判无债 |
| 新回归 RED | `red-unit-link-source.log` | `3!==2`、`50!==25`，准确复现链接差穿透 |
| 真实 dist 基线 RED | `red-browser-baseline.log` | 50 行／25 组；原未读数不变；零业务 mutation |
| 新回归 GREEN | `green-unit-link-source.log` | 4/4，fail=0 |
| 受控破坏 | `mutation-red-restore-link-key.log` | 临时把 `link` 加回键，`3!==2`、`50!==25` 见红；已还原 |
| 最终三端构建 | `final-build-all.log` | customer／merchant／staff 均 exit 0 |
| 最终相关测试 | `final-test-staff-all.log` | **11/11，fail=0** |
| 触及文件 lint | `final-lint-targeted.log` | exit 0，**0 error／0 warning** |
| 全量员工 lint | `baseline-lint-staff.log`／`final-lint-staff-full.log` | 前后均 **25 errors／1 warning**；基线红未扩修，不宣称全量绿 |
| 最终通知走测 | `final-browser.log`／`browser-final.json` | **7/7 PASS，failures=0**；25 行／0 组 |
| 机械核验 | `node evidence/pd98-staff-notif-dedupe-r2/verify.mjs` | **24/24，failures=0**，输出 `validation.json` |
| 测后自清 | `final-browser-cleanup.log` | `PD98_R2_CDP_AFTER=000`；无活动后台任务 |

复跑：

```bash
npm run build
node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/staff/tsconfig.app.json --test \
  apps/staff/src/lib/notifications.test.ts \
  apps/staff/src/lib/localeInput.test.ts \
  apps/staff/src/components/boarding/boardingExposure.test.tsx
PD98_PHASE=final node apps/staff/scripts/pd98-staff-notif-dedupe-r2-check.mjs
node evidence/pd98-staff-notif-dedupe-r2/verify.mjs
```

## 5. 界面／代码质量复核

- 视觉只做减法：保留既有中文通知卡、字体、色板、顺序、未读样式和点击行为，无新 NOTE、装饰、口令卡、dev-login、QA 半壳或灰骨架。
- 列表收敛为 25 行后低于既有长列表关注阈值，不引入虚拟列表或新依赖；分组仍为 Map 单次遍历与 `useMemo` 派生。
- 原生按钮、未读 `role=status`、文本截断与键盘行为未改；未新增交互或焦点风险。
- 既有“全部已读”行为未改、未点击；本补钉不借其确认流程扩修其它债。
- `web-design-guidelines` 已拉取最新规则复核；未发现本 diff 新增的可访问性问题。

## 6. 数据／禁区与交付边界

- 只读诊断使用既有小美 QA 会话；仅查询 tRPC，未直改库、未写业务数据、未保存会话 cookie，结束登出。
- 候选走测为独立临时 profile＋明确 mock；未跨店造种、未触 `01M5EQVF`、未真支付、未点全部已读。
- 未扩 locale／英文字幕／跨面 NOTE；未抢 PD-99／PD-100；未复用原已合 pd98 树；未开第四写码窗。
- 更深不更大：小美开真通知时不再被同源重复卡刷屏；拦＝同源去重；撤＝不以全部已读／清未读／REUSE／换 tip 冒充清。
- 交付后由头子派 Verifier＋异窗码质审；本 C 窗不代开监理。
- 合前须 update branch→当时 tip；合部须 Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全＋新鲜 DEPLOY／HEALTH×4。
- **PD-98 禁正式销**直至合后部署齐、潘婧复测-R 仅通知簇 PASS。
