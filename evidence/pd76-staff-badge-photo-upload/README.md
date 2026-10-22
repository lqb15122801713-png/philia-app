# 卷宗 · PD-76-staff-badge-photo-upload（A窗 · 点验件，非验收）

> 基线 main@a73f02b（a73f02b2b7cc1fdb2f92398f640946546a7d4ec0，PD-75 合部 #175）· 分支 feat/pd76-staff-badge-photo-upload · K3 MAX · 2026-10-22
> 迁移：**零 migration · 未动 journal**（`server/drizzle/` 零改动；禁撞 0114–0116／不占 0117–0120 均遵守；本令纯前端＋错误态透传）
> 施工：Desktop；证据栈=本窗专口 7262(API)/7162(staff preview=本分支构建)/9262(CDP)，他窗栈零触碰，测毕已自清（库复位、进程尽杀）

## 验收口径逐条点验

| # | 断言 | 证据 | 状态 |
|---|---|---|---|
| 1 | 角标 A：底栏 99+、aria＝真值、me／通知头真值＋一致说明；三处同源同规则 | shots/01（dock 徽 text=1 aria="1 条未读"）、shots/02（/me 行真值 1＋本屏 dock 徽同源 1）、shots/03（通知头「未读 1 条」）；>99 封顶/说明由 `apps/staff/src/__tests__/pd76Badge.tsx` 钉（192 → dock 显示 99+、aria「192 条未读」、通知头真值 192＋cap-note；5 → 无说明）——四段全绿。同源=唯一 selector `lib/unreadBadge.ts`（push.unreadCount.total，dock／me／通知头同键同规则） | 已点验 |
| 2 | 执行页全步骤无原生「Choose Files」 | shots/04；DOM 实测 `{chooseFilesText:false, inputCount:1, allHidden:true(display:none), addSlot:true}`；原生 input 视觉隐藏＋保留可访问性 label（aria-label），品牌虚线槽「＋拍照/相册」触发 | 已点验 |
| 3 | 旧图（服务端拒收）→ 拒收态＋原因透传＋重试，非长期「上传中」；成功图 → 成功、底钮解禁 | shots/05（缩略图红圈＋「未通过」＋「未通过：照片拍摄时刻不在服务窗口内，须现场拍摄」＋重试/重拍）、shots/06（重试后仍拒收态，不卡上传中）、shots/07（成功图后「已传 2/1 张·可确认」，底钮「确认本步，进入预检」解禁）；网络双录 network-addphotos.json：脚本侧 upload 200(exif=1577844000) → addPhotos **400** BAD_REQUEST 原因原文；无 EXIF 图 → addPhotos **200** added=1；浏览器侧 CDP Network：upload 200 → addPhotos 400（拒）→ 重试 upload 200 → addPhotos 400（再拒）→ 正常图 upload 200 → addPhotos 200 | 已点验 |
| 4 | 上传中态仅一处 | 状态机改后「上传中」只渲染在缩略图/双槽角标；头卡行、底钮文案已摘除（ExecutePage 两处删除）。DOM 实测：拒收帧头卡 `…张照片上传中` 零命中、stepper 内「上传中」角标 0 处（无在上传件时）、底钮文案不含上传中 | 已点验 |
| 5 | 扫码页无「HTTP」技术词，手输可达 | shots/09（错误态「无法打开摄像头，请检查设备后重试，或使用下方手动输入核销码。」＋主钮「手动输入核销码」＋次级「重试摄像头」）、shots/10（主钮直达手输页）；DOM 实测 `httpTechWord:false`（/HTTP\|HTTPS\|secure context/ 全文零命中）；源文 `secureContext.ts` 摄像头口径改「相机暂不可用，请手动输入核销码」 | 已点验 |
| 6 | 列表末条不被底栏压 | shots/11、12；DOM 实测 /today `gap=292`（末条 sk-dayfoot 底 494 ＜ dock 顶 786；本页自渲 58px dock，根 padding 由 safe-area-only 改 94+safe-area）、/schedule `gap=617`（App 壳 94+safe-area 既有，复核在） | 已点验 |
| 7 | 拍照时间窗本令未做 | **拆 PD-77 未做**——本令零触服务端窗口判定（serviceStep.ts 窗口闸原样）；仅把其 400 拒收原因原文透传到缩略图拒收态 | 声明件 |

## 改动面（最小 diff；13 改 3 增）

- `apps/staff/src/lib/unreadBadge.ts`（新）：口径 A 唯一来源——UNREAD_COUNT_KEY／badgeCapText(99+)／badgeAriaText(真值)／useUnreadTotal(60s 轮询)。
- `apps/staff/src/components/skeleton/index.tsx`：SkDock 徽标走 badgeCapText/badgeAriaText（行为不变，规则收编单一来源）。
- `apps/staff/src/components/StaffDock.tsx`：全域 dock 接入 `badges={{me: useUnreadTotal()}}`（原只 /today 自渲 dock 有徽，/schedule／attendance／me 三主级屏 dock 无徽——同源后全主级屏一致）。
- `apps/staff/src/pages/MePage.tsx`、`pages/staff2/NotificationsPage.tsx`：未读数改走 useUnreadTotal；通知头 >99 时增一致说明行（`ntf-unread-cap-note`）。
- `apps/staff/src/copy/notifications.ts`：新键 `snt.unreadCapNote`（「底栏『我的』角标最多显示 99+，此处为实际未读数」）。
- `apps/staff/src/lib/offlineQueue.ts`：状态机落地——记录增可选 `rejected` 原因串；`isPermanentRegisterError` 判据=FORBIDDEN／addPhotos BAD_REQUEST 全口径（400=服务端拒收，message 原文透传，**判定规则在服务端、本令未改**）；永久拒收由「静默删记录+toast」改「标 rejected 留队、flusher 跳过不堵队」；新增 `retryQueuedPhoto`（清标记即补冲=retry 边）/`photoRejectionOf`/`rejectionReasonOf`；契约签名（QueuedPhoto/enqueuePhoto/pendingPhotos/removePhoto/startQueueFlusher）逐字未动。
- `packages/shared/src/api/upload.ts`：/api/upload 400 响应挂 `data.code='BAD_REQUEST'`（服务端拒收转拒收态、原因透传；其它状态码维持瞬态退避语义）。
- `apps/staff/src/components/execute/ExecuteStepper.tsx`：Thumb/DualSlot 增 rejected 渲染（红圈＋「未通过」徽，不再脉冲）；新 RejectedLine（原因＋重试/重拍，挂在缩略图同区=单处显示位）；两枚原生 input 加 `display:none` 内联兜底＋tabIndex=-1＋aria-label（品牌化控件可访问性）。
- `apps/staff/src/pages/ExecutePage.tsx`：摘头卡「N 张照片上传中…」行、摘底钮「照片上传中…」文案替换与禁用（底钮按真实成功张数 serverCount 解禁，未满点击走既有 toast）；队列记录映射带 queueId/rejectedReason；接 onRetryPhoto/onDiscardPhoto；onDropped toast 摘除（单处显示）。
- `apps/staff/src/lib/secureContext.ts`：摄像头口径去 HTTP 技术词（定位口径非扫码页，未动）。
- `apps/staff/src/components/scan/QrScanner.tsx`：无摄像头文案去 HTTPS 技术词；错误态「手动输入核销码」升主钮、「重试摄像头」降次级。
- `apps/staff/src/pages/TodayPage.tsx`：根 padding safe-area-only → `calc(94px+env(safe-area-inset-bottom))`（本页自渲 58px dock，末条被压实锤修复；/schedule 走 App 壳同口径既有，复核在）。
- `apps/staff/scripts/offline-queue.smoke.mjs`：钉随新口径同步——BAD_REQUEST 任意文案=永久（400 拒收透传）；新增第 7 段 rejected 径（留队/跳过/重试边）；旧 5 段保留（无 markRejected 注入时旧径兼容）。
- `apps/staff/src/__tests__/pd76Badge.tsx`（新）：口径 A SSR 钉（pd72Notifications 同跑法）。
- `apps/staff/scripts/pd76-badge-upload-shots.mjs`（新）：本证据采集器（s4-member-mine-shots 同工艺 CDP 实尺帧）。

## 测试

- `offline-queue.smoke.mjs`：**30 ✓ / 0 ✗**（含新第 7 段 rejected 径 6 断言）。
- `pd76Badge.tsx`：4 段全绿（纯函数 7 断言＋dock 渲染＋通知头 192/5 两态）。
- `pd72Notifications.tsx`（PD-72 自带钉）：**绿**（192 真值/全部已读可用；SSR useLayoutEffect 警告 3 条=基线固有，对照 pd75 窗同 3 条）。
- `npm run build`（customer+merchant+staff，tsc -b＋vite build）：**三端全绿**；`build:staff`（VITE_API_BASE 指本窗 7262）绿。
- 实机帧证据：CDP 实尺 390×844，18/18 绿（见上表）；合成单 aid=01M5HQ3GDNHFM9XDP9TF29XHC5（本店新造，库已复位即弃）。
- 已知非本令件：脚本侧上传的服务端图在 preview 帧里裂图（图片 URL 指向 API 口、preview 无 /api 反代所致，纯证据环境工件；浏览器注入件 blob 预览正常）——三端 app 代码零涉。

## 帧索引（shots/）

01 dock「我的」徽（text+aria 同源）· 02 /me 行真值＋本屏 dock 徽 · 03 通知头真值 · 04 执行页品牌虚线槽（零 Choose Files）· 05 旧图拒收态（红圈＋原因＋重试/重拍）· 06 重试后仍拒收（不卡上传中）· 07 成功图底钮解禁 · 08 执行页底部留白 · 09 扫码错误态（手输主钮）· 10 手输可达 · 11 /today 末条安全区 · 12 /schedule 末条安全区

## 禁令自查

未动 journal／零 migration；未碰夹具 01M5EQVFSQCFZYXB6FB945DSQB（合成单新造本店）；未跨店造种；未重复 WRITE_OPEN_P1；addPhotos 判定规则零触（仅透传 400 原因）；拍照时间窗拆 PD-77 未做；未抢前台／未动双屏；USAGE 未查；PR 只开不合；不写验收通过；测完自清（证据栈进程尽杀、库复位 seed）。
