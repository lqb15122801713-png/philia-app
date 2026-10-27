# PD-107 · 客户端消息／历史服务通知去 QA 夹具渗 · 候选卷宗

- 窗：`PD-107-client-notif-qa-fixture`
- WT：`E:\KIMI code\pd107-client-notif-qa-fixture`
- 分支：`feat/pd107-client-notif-qa-fixture`
- PR：#204 https://github.com/lqb15122801713-png/philia-app/pull/204（OPEN，只开不合）
- 基线：`e890fa401f6bf649109379c198254905f7126cdd`／DEPLOY `20261027001820`
- mig：**0147 故意空留**；零 schema；未占 0117／0119／0122–0146；未抢 PD-106
- 状态：本地候选证据齐，候交付 HIT；现网 `PENDING_MERGE_DEPLOY`，不写验收通过，不正式销缺陷。

## 1. 根因与最小产品 diff

林晓 R45 FAIL·L 与盲测客 R44 `AE-CLIENT-R44-01` 同锚：`NotifyCenterPage` 直接渲染 `item.title`／`item.body`，历史服务数据中的夹具名因此进入客户读口；既有 `customerPetName` 只处理宠物名字段开头的 `QA夹具`，不能覆盖通知里的 `【QA夹具豆豆】` 形式。

产品码仅 2 文件、11 增 3 删：

- `apps/customer/src/lib/customerPresentation.ts`：共享夹具标记规则，新增 `customerNotificationText`，保留括号内真实宠物名并去掉夹具标记。
- `apps/customer/src/pages/NotifyCenterPage.tsx`：仅标题与正文两个读口接入该清理。
- 回归：`apps/customer/src/pages/notifyPresentation.test.tsx`，真实 React 页面＋Query 缓存，覆盖改期／派单／到店签到的标题和正文。

没有改种子、接口数据、预约表单、支付、PWA、员工端、商家端或相册。

## 2. 原缺陷 → 新证据 → 状态

| 原缺陷／门槛 | 基线证据 | 候选证据 | 状态 |
|---|---|---|---|
| 林晓 R45 FAIL·L：历史服务通知夹具名 | `baseline-live-notifications.png`＋DOM：改期／派单／签到等 10 处 `【QA夹具豆豆】` | 同一上游只读数据下，17 条服务通知夹具前缀 0；`final-notifications.png` | 本地候选覆盖；现网待合部 |
| 盲测客 R44 STILL OPEN 头号／`AE-CLIENT-R44-01` | 现网新帧复核原缺陷，非 R44 旧图 REUSE | 直达、铃、我的三份新 DOM／像素均只显示“豆豆…” | 本地候选覆盖；不冒充复测-R |
| 改期 | `【QA夹具豆豆】的预约时间已调整…` | `豆豆的预约时间已调整，请查看最新安排` | 本地候选覆盖 |
| 派单 | `【QA夹具豆豆】的预约已安排服务人员` | `豆豆的预约已安排服务人员` | 本地候选覆盖 |
| 到店签到 | `【QA夹具豆豆】已到店…` | `豆豆已到店，服务即将开始` | 本地候选覆盖 |
| 候选客 dist ≠ `C2YJDxM1` | 现网 1413565 bytes／SHA `11c8b4f6…` | `index-CJu1diFP.js`，1424040 bytes／SHA `10af6c54…`，HTTP＝本地字节 | 满足候选门槛；不是 tip 包 |

结构化字段：`validation.json`、`bundle-evidence.json`、`browser-evidence.json`。

## 3. 包与帧

| 件 | 文件名／SHA-256 | 说明 |
|---|---|---|
| 现网客包 | `index-C2YJDxM1.js`／`11c8b4f6e5fec0947ddccf3c84bdd9ed26a46d3d978a86c1e25af04440eff5d7` | 2026-10-27 新下载；HEALTH 7200–7203＝200×4 |
| 本机基线构建 | `index-Cfv2yXYL.js` | 未改产品码时构建；不拿本机差异冒充产品变化 |
| 最终候选 | `index-CJu1diFP.js`／`10af6c545686f82b19f52fce185f55ab9ddeaf1a1ede15ca6ac98fd5d99ca2ca` | 名称与字节均不同于现网；破红还原后重建仍同名同 SHA |
| 现网通知帧 | `baseline-live-notifications.png`／`acf5f24c…` | 原缺陷可见 |
| 候选直达 | `candidate-notifications-direct.png`／`83e60b57…` | 夹具前缀 0 |
| 候选铃入口 | `candidate-notifications-from-bell.png`／`a65daa58…` | 首页铃实际点击；未点「到店领」 |
| 候选我的入口 | `candidate-notifications-from-me.png`／`b4254e87…` | 实际 `me-notify-entry` 键盘 Enter |
| 最终重载帧 | `final-notifications.png`／`83e60b57…` | 最终新采集；与直达同像素是同一 UI 的正常结果，非旧 R44／R45 帧 |

## 4. 验证记录

| 闸 | 命令／证据 | 结果 |
|---|---|---|
| 初始 RED | `../../server/node_modules/.bin/tsx --test src/pages/notifyPresentation.test.tsx` | 0/1；真实页面原样露出夹具名 |
| 最终全套单测 | `../../server/node_modules/.bin/tsx --import ../../evidence/pd107-client-notif-qa-fixture/test-react-setup.mjs --test …5 个既有／新增测试文件`；`final-unit-all.txt` | 12/12，fail=0 |
| 三端构建 | `npm run build`；`final-build-all.txt` | customer／merchant／staff 均 exit 0；客户 `index-CJu1diFP.js` |
| 定向 lint | `npx eslint src/pages/NotifyCenterPage.tsx src/lib/customerPresentation.ts src/pages/notifyPresentation.test.tsx src/pages/qaPresentation.test.tsx`；`final-targeted-lint.txt` | exit 0 |
| 全量客户 lint | `npm run lint -w @philia/customer`；`final-full-lint.txt` | 前后均 65 errors／4 warnings；**INC-PREEXISTING-LINT**，不宣称全绿 |
| 测试装配 | 首次合跑 3 个既有用例 `React is not defined`；最终仅用 `test-react-setup.mjs` 补测试全局 | 非产品红；未改其他测试或产品以遮红 |
| 关闭前破红 | `mutation-red-unfiltered.txt`：临时令 `customerNotificationText` 原样返回 | 0/1，精确复现；随即还原并最终 12/12、三端构建复绿、候选 SHA 不变 |
| API／数据流 | `preview.txt`：`push.listNotifications,push.unreadCount` GET 200；`canvas.liveLayout` GET 200 | 同一真实历史数据；非种子替换 |
| 写保护 | `POST /trpc/push.markRead` | HTTP 405，未进入上游；未点已读／删除 |
| diff 卫生 | `git diff --check`；`final-diff-check.txt` | exit 0 |

## 5. 入口、环境红与边界

- 直达 `/notifications` 与首页铃均实际走通。`/me` 的 `me-notify-entry` 两次内建浏览器指针点击停留 `/me`，记 `INCONCLUSIVE_BUILTIN_BROWSER_POINTER`；随后用键盘 Enter 走通并取帧。不冒充 touch PASS，不归因本 diff，也不扩修路由。
- `/me` 自动发起的 `membership.myCardToken` POST 被只读代理 405 拦截，未进入上游；未将其当成消息写操作或会员面 PASS。
- Windows 根 `npm ci` 在嵌套 `postinstall` 递归失败；改为 server 目录内 `npm ci`（110 packages）＋根 `npm ci --ignore-scripts`（688 packages），锁文件与产品脚本未改。
- 未碰 `01M5EQVF`，未造第二店，未直改库，未查 USAGE，未安装 Action，未开第二窗。
- 未扩预约表单宠名／PWA／支付协议／底栏消息席／员通知密度／商日结／驾舱／慢读／MISLABEL／相册／PD-105／PD-106。
- 未用 REUSE、假 CLEARED、`hits:[]`、相册已清或换 tip 冒充消息面证据；涉钱无操作。
- 浏览器标签已清空，预览端口已停止，`active_background_tasks=0`。

## 6. 更深不更大

- **谁在压力下点**：客户慌着从铃／消息确认改期、派单、到店进度，撞见内部夹具名会误以为半成品或店里出错。
- **拦**：在通知标题／正文的统一展示读口去夹具标记，保留真实宠物名与服务进度；不改库、不改种子、不动禁碰夹具。
- **撤**：证据不足就不关闭；任何 REUSE、假 CLEARED、旧相册结论或空命中均不得冒充消息清。受控破红后必须还原并重采最终验证。
- **代码简洁**：共享既有 presentation 规则，一个通知文本函数、两个读口、一个真实页面回归，无新依赖、无新分支魔法。

当前只交付候选 PR 候核，未合、未部。合部另闸为 Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全，DEPLOY／HEALTH×4 同轮新鲜；本卷不领取该结论。
