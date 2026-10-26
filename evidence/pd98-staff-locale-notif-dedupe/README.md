# PD-98 · 员工端 locale／英文字幕／通知去重 · 候选卷宗

- 窗／顶栏：`PD-98-staff-locale-notif-dedupe`
- WT：`E:\KIMI code\pd98-staff-locale-notif-dedupe`
- 分支：`feat/pd98-staff-locale-notif-dedupe`
- 基线：`main@42bb0f67945fe774f2c22d098fed185a0a0929a5`／DEPLOY `20261026160104`
- 现网对照：员工 `index-DcDp2v-Y.js`
- 候选：`index-XpRzbUj5.js`，本地真实 dist 走测，**不是 tip 包，不以 localhost preview 冒领交付 HIT 或现网结论**
- mig：**0139 故意空留**；零 schema；未占 0117／0119／0122–0138／0140
- 当前状态：**本地候选证据齐，候交付 HIT＋外部 B 监理；现网 `PENDING_MERGE_DEPLOY`。**

## 1. 根因与最小产品 diff

| 根因 | 产品修 |
|---|---|
| 原生 `type=time/date` 控件的可见格式随浏览器区域设置变化；英文区域显示 AM/PM 与美式斜杠日 | 可用时间与请假日改为区域设置无关的 `HH:MM`／`YYYY-MM-DD` 文本控件，提交前校验真实时间／日期；预约日期芯片同步收口，非法输入不驱动排班查询，失焦恢复最后有效日期 |
| 四个页面把装饰性英文编号作为内容渲染；角色卡拼接 frontdesk／groomer；线上文案覆盖可重新盖回英文 | 预约／我的排班／通知／我的取消装饰性编号，保留中文标题；`SkAppHead` 编号改为可选；角色只显示前台／美容师。零迁移、零直改文案库 |
| 通知页把接口首屏 50 条原样渲染，已存在的同秒重复记录形成成对长卷 | 按同类型、同标题、同正文、同链接、同秒分组；不同链接／类型不误并；优先展示未读行；同组 ID 一起 `markRead`，未读总数仍用原 `unreadCount` 查询 |

产品源码仅 7 文件：

- `apps/staff/src/lib/localeInput.ts`
- `apps/staff/src/lib/notifications.ts`
- `apps/staff/src/pages/MySchedulePage.tsx`
- `apps/staff/src/pages/SchedulePage.tsx`
- `apps/staff/src/pages/MePage.tsx`
- `apps/staff/src/pages/staff2/NotificationsPage.tsx`
- `apps/staff/src/components/skeleton/index.tsx`

回归：`localeInput.test.ts`、`notifications.test.ts`、`pd98-staff-locale-notif-dedupe-check.mjs`。未改 customer／merchant／server／schema／迁移／相册／关店／驾舱／传感器／日结。

## 2. 原缺陷 → 证据 → 状态

| 原缺陷／门槛 | 基线证据 | 候选证据 | 状态 |
|---|---|---|---|
| `AE-STAFF-R58-06` 09 可用时间 AM/PM＋请假美式日 | `browser-baseline.json`：`type=time/date`；`shots/baseline/my-schedule-locale.png`：`09:00 AM`／`06:00 PM`／`10/26/2026` | `browser-final.json`：四个文本控件值 `09:00|18:00|2026-10-26|2026-10-26`；`shots/final/my-schedule-locale.png` 无 AM/PM／美式请假日 | 本地候选覆盖；候交付 HIT |
| `AE-STAFF-R58-07` 同文通知长卷＋NOTIFICATIONS | 基线六行、两组同秒成对；NOTIFICATIONS 可见 | 同六条 mock 收敛为四行；同组两个 ID 一起已读；英文编号不渲染 | 本地候选覆盖；候交付 HIT |
| `AE-STAFF-R58-08` SCHEDULE／MY SCHEDULE／NOTIFICATIONS／ME | 基线四个编号均可见，角色含 frontdesk／groomer | 四面编号均不渲染，角色只显示中文；英文覆盖值仍下发也无法盖回 | 本地候选覆盖；候交付 HIT |
| `NOTIF-DUP-ROWS-OBS` 照护提醒成对重复≥2组 | 基线 `care-1637-a/b`、`care-1229-a/b` 均各自独立成行；点一组只发一个 ID，未读 6→5 | 两组各收一行；真实 CDP 鼠标点击发 `care-1637-a＋care-1637-b`，未读 6→4，行数保持 4；未点全部已读 | 本地候选覆盖；候交付 HIT |
| `EN-SUBTITLE-EXPOSURE-OBS` 五个指定英文字样 | `browser-baseline.json`＋baseline 各页截图 | `browser-final.json`＋final 各页截图；截图 SHA 相对基线均不同 | 本地候选覆盖；候交付 HIT |
| 预约日期芯片美式日 | 基线 `type=date`，英文区域可见 `10/26/2026` | `type=text` 且值 `2026-10-26`；合法完整日期才驱动查询 | 本地候选覆盖；候交付 HIT |

**清零口径：** 未用 REUSE、维持面、换 tip、`hits:[]`、`reuseInodes=0` 或全部已读冒充本债清零。两组对照来自同一探针、同一视口、同一英文区域与同一 mock 数据；现网包也已只读下载对照。

## 3. 现网／基线／候选 js

| 包 | 文件名 | bytes | SHA-256 | 说明 |
|---|---|---:|---|---|
| 现网基线 | `index-DcDp2v-Y.js` | 734701 | `061fdc83250b6a5d74ba04210a9b9ee24ab8bc44f3c9f439414b77167affa9b1` | 从 `http://120.53.102.45:7203` 只读下载；HEALTH 7200–7203 同轮 200×4 |
| 本机基线 | `index-_s_wlKE7.js` | 739694 | `207564bd2e0701d7b59d785605e9fabc4839e392c287861fe2fba4212388c64b` | 未改源码构建；只作本机对照，不冒充现网包 |
| 最终候选 | `index-XpRzbUj5.js` | 740747 | `cc2704440cd0a0fad21a9315fedcbdd7f85687d19e96fa7e253c180d91b3c1e9` | 最终三端构建同源；与现网名称及 SHA 双异；**不是 tip 包** |

现网 HTML 明确引用 `index-DcDp2v-Y.js`；候选 HTML 明确引用 `index-XpRzbUj5.js`。机械核验见 `validation.json`／`final-mechanical.log`。

## 4. 验证记录

| 闸 | 命令／证据 | 结果 |
|---|---|---|
| 基线三端构建 | `npm run build`；`baseline-build-all.log` | exit 0 |
| 基线既有员工测试 | `baseline-test-staff-existing.log` | 5/5，fail=0 |
| 基线全量员工 lint | `baseline-lint-staff.log` | **25 errors／1 warning；基线红，不宣称绿** |
| 纯函数 RED | `red-unit.log` | 5/5 按预期失败：实现缺失 |
| 浏览器 RED | `red-browser-baseline.log`／`browser-baseline.json` | 8 项失败；真实 AM/PM、美式日、字幕、六行及单 ID 已读复现 |
| 类型契约红→绿 | `build-staff-initial.log` → `build-staff-after-contract.log` | `body: string \| null` 对齐既有 server 类型后构建通过 |
| 预约日期补钉 RED→绿 | `red-browser-schedule-date.log` → `browser-candidate-with-schedule-locale.log` | 原生美式日期芯片被回归捕捉后转绿 |
| 受控破坏 | `mutation-red-exact-milliseconds.log` | 同秒故意改成同毫秒，`5 !== 3` 见红；已还原 |
| 最终三端构建 | `npm run build`；`final-build-all.log` | customer／merchant／staff 均 exit 0；员工包 `index-XpRzbUj5.js` |
| 最终相关单测 | `final-test-staff-all.log` | **10/10，fail=0**（PD-98 新 5＋既有 5） |
| 触及文件 lint | `final-lint-targeted.log` | **0 error／1 warning**；warning 为 SchedulePage 基线同一条 |
| 最终全量员工 lint | `final-lint-staff-full.log` vs baseline | **仍 25 errors／1 warning，与基线完全一致；无新增，不宣称全量绿** |
| 最终真实 dist 走测 | `final-browser.log`／`browser-final.json` | **16/16 PASS，failures=0**；真实 CDP 鼠标点击；全部已读点击数 0 |
| 机械传感器 | `node evidence/pd98-staff-locale-notif-dedupe/verify.mjs` | **30/30，failures=0**；输出 `validation.json` |
| diff 卫生 | `git diff --check` | 无输出 |
| 测后自清 | `final-browser-cleanup.log`；TaskList | `PD98_PORT_9398_AFTER=000`；无活动后台任务 |

专项复跑（先完成根 `npm ci --ignore-scripts` 与 `npm --prefix server ci`，再 `npm run build`）：

```bash
node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/staff/tsconfig.app.json --test \
  apps/staff/src/lib/notifications.test.ts \
  apps/staff/src/lib/localeInput.test.ts \
  apps/staff/src/components/boarding/boardingExposure.test.tsx
PD98_PHASE=final node apps/staff/scripts/pd98-staff-locale-notif-dedupe-check.mjs
node evidence/pd98-staff-locale-notif-dedupe/verify.mjs
```

## 5. 环境红与处置（不掩盖）

- 基线对象最初本机缺失；精确 fetch `42bb0f67945fe774f2c22d098fed185a0a0929a5` 并核 `cat-file=commit` 后才建树，未换 tip。
- 标准 `npm ci` 与指定 Git Bash script-shell 均撞 Windows 嵌套 `postinstall`／`node`/`npm.cmd` 解析问题；按仓内 PD-97 已记录方案，根 `npm ci --ignore-scripts`＋server 目录独立 `npm ci` 完成锁定安装，未改 lockfile 或产品脚本。
- 探针初版误给 `readAt: null` 声明 Date 元数据，导致点击链路失真；按 PD-92 工作参照修正夹具后，基线才形成有效“单 ID 已读”对照。未把夹具故障当产品证据。
- 无头 Edge 曾在 Node 退出后残留两个本次临时 profile；核对 PID 命令行后只清理这两个进程与目录。脚本收尾已加 `Browser.close`，最终端口 000。
- 全量员工 lint 基线红未扩修；触及文件零 error，最终全量计数与基线一致。

## 6. 数据／禁区与交付边界

- 所有走测使用独立临时浏览器 profile＋明确 tRPC mock；未直改库、未造第二店、未触 `01M5EQVF`、未真支付、未点全部已读。
- 未重开日 pill／AE-04／退出／周 pill／寄养写闸／待换字面／补卡；未塞商端／客户端／相册／关店／驾舱／传感器／日结撤／旧挂账。
- 未动其他 WT；未开第三窗；未查 USAGE；未合 PR、未部署、未启动 HIT 例程。
- 更深不更大：前台慌着看排班／请假／通知时，拦下混语与重复卡；点错口径时不以 REUSE／维持面／换 tip 冒充已清，假清打回。
- 交付后由头子派 Verifier＋异窗码质审（loop-code-review／严审码质）；本 A 窗不以自审冒充 B 监理。
- 合部另闸：Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全，DEPLOY／HEALTH×4 同轮新鲜；本卷不领取该结论。
