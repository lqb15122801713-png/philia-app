# PD-114 员端未读计数口径｜候选卷宗

## 基线与根因

- 基线：main `c3d17f3343b7af21b76b872cf143b7e20f2b534c`／DEPLOY `20261031112230`／员 `index-DDB3TYul.js`。
- 2026-10-31 11:37–11:42 +0800 现网只读自验：通知顶 **69**、去重列表 **25**、我的页 dock **69**，`dupPairGroups=0`，为 FAIL `UNREAD-TOP-VS-LISTROWS`。未点「全部已读」或通知行。
- 根因：列表使用 `groupDuplicateNotifications` 合并同类型／同文／同分钟 ID；通知顶与 dock 却读取未去重的 `push.unreadCount.total`，两处口径分叉。

## 产品改动

- `apps/staff/src/lib/unreadBadge.ts`：未读 hook 与通知列表共用 list 查询键，以同一分组函数派生未读组数；dock／me／通知顶继续共用此 hook。
- `apps/staff/src/pages/staff2/NotificationsPage.tsx`：列表与顶部共用缓存键及失效路径。
- `apps/staff/src/pages/TodayPage.tsx`：移除独立的旧 `push.unreadCount` 查询，收编到共享 hook。
- `apps/staff/src/components/StaffDock.tsx`、`MePage.tsx`、`styles/skeleton.css`：仅同步旧口径注释。
- `groupDuplicateNotifications` 与通知已读写侧未改；server／schema／migration／customer／merchant 未改。**mig 故意空留，未占文件。**

## TDD 破红与最终验证

- 破红：`pd114UnreadCount.tsx` 先以 4 个未读 ID／2 个去重组运行，未改产品码时按预期失败：`4 个未读 ID 去重为 2 行后，通知顶应显示 2`，exit 1。
- 最终命令、退出码与日志见 `validation.json`；相关 SSR／Node 测试均 exit 0，Node 套件 **12/12，fail 0**；改动文件 eslint exit 0；`npm run build:staff` exit 0。
- 全量 `npm run lint -w @philia/staff` 为 **INC_BASELINE_RED**：25 errors／1 warning，位于 17 个本刀未改文件；改动文件 lint 独立 exit 0。完整输出保留 `final-lint-full-baseline-red.log`，未改门槛或删检查。
- 初次 `npm install` 的 postinstall 红已记录开工回执；依赖以显式 `--ignore-scripts` 分步恢复，安装造成的 root／server 清单噪声均已恢复，不进入 diff。

## 候选生产包＋真实 API 只读探针

- 候选员 dist：`index-_G5iuJtk.js`（≠ `index-DDB3TYul.js`）；SHA-256 `7f44fed4cb36248b9d924f274dc8e4dfae0956aca85b060acfb7c0c636cfb12a`。
- 探针只在本地浏览器把真实员工端 origin 的旧 JS 响应替换为候选生产 JS；真实登录、真实 `push.listNotifications` 只读响应，无 localhost preview，无数据 mock，**`isTipPackage=false`**。
- 原始响应独立重算：50 raw rows／50 未读 ID → 25 去重组／25 未读组。
- 候选可见面：通知顶 **25**＝列表 **25**＝我的页消息 **25**＝dock **25**；`dupPairGroups=0`；旧 `push.unreadCount` 调用 0；已读 mutation 0；未点「全部已读」或通知行。
- 证据：`live-candidate-report.json`、`final-live-candidate.log`、`candidate-notifications.png`、`candidate-me.png`、可复跑 `live-candidate-probe.mjs`。

## 交付边界

候选证据不等于合部 tip 现网证据。PR 只开不合；本窗未合、未部，交付 HIT 与 TIP-DEPLOY 仍待异窗监理／头子流程。未重开 PD-112／NOTIF-DUP，未并审美密度墙／115／116，未扩客／商／关单，未抢 PD-106，未动 108／110，未碰 `01M5EQVF`，未造第二店。

— 不写验收通过
