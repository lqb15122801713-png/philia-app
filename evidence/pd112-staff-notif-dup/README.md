# PD-112 · 员工端通知同文同戳双行去重 · 候选卷宗

- 窗／顶栏：`PD-112-staff-notif-dup`
- WT：`E:\KIMI code\pd112-staff-notif-dup`
- 分支：`feat/pd112-staff-notif-dup`
- 基线：`524b4bc7e203890e42dd90c01bfd7a4c6f84613b`／DEPLOY `20261029214338`
- 对照员包：`index-STmHfnb4.js`
- 候选员包：`index-Cp859QUp.js`（非 tip 包、未部署）
- mig：**0148 故意空留**；零 schema、未占文件；未撞 0117／0119／0122–0147；未抢 PD-106。
- 状态：本地候选证据已落，候交付 HIT＋异窗监理；PR 只开不合；不正式销缺陷。localhost 辅助探针不冒充交付 HIT 或现网证据。

## 1. 根因与最小产品改动

缺陷码：`NOTIF-DUP-ROWS-OBS`。潘婧 R64 在 `title|time|bodyHead` 口径下录得 `dupPairGroups=1`，20:51 照护提醒同文同戳双行、tid 不同。

本窗只读现网 tRPC 首屏 50 行证实：

- 同秒键重复 24 组，同分钟键重复 25 组；这正解释同秒去重后仍剩 1 组。
- R64 的 20:51 双行原始时间为 `2026-10-29T12:51:11.000Z` 与 `2026-10-29T12:51:12.000Z`（本地 20:51:11／20:51:12），同类型、同标题、同正文但跨秒。
- 原分组键精度为秒，列表时间精度为分钟，因此跨秒双插穿透。

最小修复仅在 `apps/staff/src/lib/notifications.ts` 将分组时间从 `1000` 毫秒精度改为 `60_000` 毫秒精度；`NotificationsPage.tsx` 只同步旧行为注释。分组仍保留全部原始 ID、优先未读代表，点击时同组 ID 一起已读；不同分钟不合并，未做同文密度治理。

## 2. 未读自洽口径

- 未读角标继续来自既有 `push.unreadCount.total`，同一字段输入前后均为 61；没有通过全部已读、清未读或改种子压低数字。
- 每个含未读 ID 的组仍选未读行作代表；最终 25／25 组保持未读态。
- 同组全部 ID 保留，回归测试断言全部未读 ID 均在分组内，避免去重时 silently 丢未读。
- 原始未读总数是后端真实通知 ID 数；可见卡数是分组数，二者不混算、不互相冒充。

## 3. 缺陷 → 证据

| 检查 | 证据 | 读数 |
|---|---|---|
| 跨秒回归 RED | `red-unit-minute.log` | `3!==2`，fail=1；准确复现同分钟跨秒穿透 |
| 跨秒回归 GREEN | `green-unit-minute.log` | 5/5，fail=0 |
| 受控破坏 | `mutation-red-second-key.log` | 临时恢复同秒键后再次 `3!==2`；已还原并复跑最终绿 |
| 最终相关单测 | `final-test-staff-all.log` | 12/12，fail=0 |
| 潘婧分组口径 | `browser-final.json`／`final-browser.log` | `dupPairGroups=0`；50→25 行 |
| 未读自洽 | 同上 | 原接口未读 61；25/25 含未读 ID 组保持未读；全部已读未点、业务 mutation=[] |
| 非密度治理 | 同上 | 25 个不同分钟提醒各保留一行；未按标题合并 |
| 机械核验 | `final-mechanical.log`／`validation.json` | 25/25，fail=0 |
| 关键帧 | `shots/final/notifications.png` | 20:51 仅一行；未读 61；全部已读仅可见未点 |

`browser-final.json` 是候选真实 React dist＋同一份现网只读字段 mock 的本地辅助探针，非 localhost preview HIT PASS，非 tip 包。

## 4. dist 对照

| 包 | 文件名 | bytes | SHA-256 |
|---|---|---:|---|
| 冻结现网员包 | `index-STmHfnb4.js` | 735747 | `6a69f2022ace565a385188e3f03ef0b5b99ab54efb284a22b4a27b6427160ef0` |
| 候选员包 | `index-Cp859QUp.js` | 740740 | `f4fd436127c85693512670aa18835629d02d017a52233df704979692b5fded0d` |

候选文件名与内容 hash 均异于冻结员包；候选不是 tip 包，未部署。现网基线字段只读获取后会话已登出，未保存 cookie。

## 5. 原生验证记录

| 命令 | 结果 |
|---|---|
| `node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/staff/tsconfig.app.json --test apps/staff/src/lib/notifications.test.ts apps/staff/src/lib/localeInput.test.ts apps/staff/src/components/boarding/boardingExposure.test.tsx` | exit 0；12/12 |
| `npm run build` | exit 0；customer／merchant／staff 均完成 |
| `npx eslint src/lib/notifications.ts src/lib/notifications.test.ts src/pages/staff2/NotificationsPage.tsx`（`apps/staff`） | exit 0；0 error／0 warning |
| `PD112_PHASE=final node apps/staff/scripts/pd112-staff-notif-dup-check.mjs` | exit 0；8/8 检查；dupPairGroups=0 |
| `node evidence/pd112-staff-notif-dup/verify.mjs` | exit 0；25/25 |
| `npm run lint -w @philia/staff` | **exit 1；25 errors／1 warning**，全部位于未触及文件；与仓内既有基线红计数一致，未扩面修，不宣称全量 lint 绿 |

依赖环境：Windows 根 `npm ci` 的既有嵌套 `postinstall` 递归失败；按仓内 PD-97／PD-98 已记录流程，使用根 `npm ci --ignore-scripts`＋`npm --prefix server ci --ignore-scripts` 完成同一 lockfile 安装（688＋110 packages），未改安装脚本或 lockfile。

## 6. 范围与禁区

只改员工端通知同文同分钟去重与未读自洽。未做密度大改、全部已读大改、客／商端改动、商城／售卡 abort／日结／驾舱／监控／YKNXD2／发货；未动 PD-106／108／110／101／111／109／105；未真支付、未碰 `01M5EQVF`、未造第二店、未直改库、未点全部已读。

更深不更大：店员班中扫通知时，同条照护同文同戳双行会干扰未读判断与处理；拦＝产品态分组键与显示时间同精度；撤／修＝全部 ID 保留、未读代表不丢；点错口径＝只改测夹具、只压审美密度或拿全部已读冒充功能去重，均不作本刀证据。

交付后由头子派 PR Verifier＋码质审／loop-code-review（异窗）。本窗不合、不部；合部须 Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全，并有同轮新鲜 DEPLOY／HEALTH×4。
