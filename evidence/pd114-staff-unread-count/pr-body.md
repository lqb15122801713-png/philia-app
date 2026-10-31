## PD-114 · 员端未读计数口径

`UNREAD-TOP-VS-LISTROWS`：通知顶与 dock 原先读取未去重的 `push.unreadCount.total`，列表则按同类型／同文／同分钟合并 ID，导致现网 69 vs 25。

本 PR 只收编员工端计数派生：

- 通知列表与未读 hook 共用 list 查询缓存，未读数＝`groupDuplicateNotifications` 后的未读组数。
- 通知顶、我的页消息行、dock-me-badge 继续共用同一 hook；`/today` 移除独立旧口径查询。
- 不改去重规则、已读写侧、server／schema／migration、客端或商端。**mig 故意空留，未占文件。**

## 证据

- 开工现网只读自验：顶 69／列表 25／dock 69，`dupPairGroups=0`。
- TDD：4 个未读 ID→2 组回归先红后绿。
- 最终候选员 dist：`index-_G5iuJtk.js`（≠ `index-DDB3TYul.js`），SHA-256 `7f44fed4cb36248b9d924f274dc8e4dfae0956aca85b060acfb7c0c636cfb12a`。
- 真实 origin＋真实只读 API 候选探针：50 raw rows／50 未读 ID→25 组；顶 25＝列表 25＝我的页消息 25＝dock 25；`dupPairGroups=0`；旧 unreadCount 调用 0；已读 mutation 0。
- 探针为本地请求替换，**非 tip 部署包、非 localhost preview、非现网合部证据**。

## 验证

详见 `evidence/pd114-staff-unread-count/validation.json` 与同目录日志。

- `pd114UnreadCount.tsx`：exit 0
- `pd72Notifications.tsx`：exit 0
- `pd76Badge.tsx`：exit 0
- `pd92StaffAe04DayPill.tsx`：exit 0
- notifications／localeInput／boardingExposure：12/12，fail 0
- 改动文件 eslint：exit 0
- `npm run build:staff`：exit 0，产出上述新 dist
- 最终真实 API 候选探针：exit 0
- 全量 `npm run lint -w @philia/staff`：**INC_BASELINE_RED**，25 errors／1 warning 均在 17 个未改文件；完整日志已附，未改门槛或删检查

## 边界

未重开 PD-112／NOTIF-DUP，未并审美密度墙／115／116，未扩客／商／关单，未抢 PD-106，未动 108／110，未点「全部已读」或通知行，未碰 `01M5EQVF`，未造第二店。PR 只开不合；本窗未合、未部，交付 HIT／TIP-DEPLOY 待后续异窗流程。

不写验收通过。
