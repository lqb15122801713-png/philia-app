# PD-72 · 员工端审美半成品修 · 施工卷宗

- 分支：`feat/pd72-staff-aesthetic-halfbaked`
- 基线：`b2558760b48dfdbf7c3b0e341c7e9e8a41a82a49`
- 范围：仅 AE-STAFF-01／02／04／R2-01；未做 AE-STAFF-03／05／06／07／FT-STAFF-02，未扩成品大测。
- 迁移：仅新增 `server/drizzle/0113_pd72_staff_aesthetic_halfbaked.sql`，journal 独占 `idx=113`；未使用 0093／0095–0112。

## 改动与可检索断言

| ID | 最小修复 | 证据 |
|---|---|---|
| AE-STAFF-01 | `sk.apptHistoryNote` 改为员工口语「选择过去的日期，可回看当天的服务单」；码内默认、种子、active 端口覆盖同源 | `server/src/__tests__/pd72StaffAesthetic.ts` 的同名断言；`0113` 在重新 seed 前的独立升级断言 |
| AE-STAFF-02 | dock 页主内容及 `/today` 页根均加入 `env(safe-area-inset-bottom)`；共享 `.sk-dayfoot` 保持 88px，避免历史预约页双算 | `06_me_before.png` vs `06_me_after.png`；后帧为真实 `App`／`MePage`／`StaffDock` SSR＋构建 CSS，滚动到底后第三组消息／公告等菜单完整位于 dock 上方 |
| AE-STAFF-04 | 通知中心标题与「全部已读」按钮改用 `push.unreadCount` 服务端总未读，不再只数首屏 50 条 | `apps/staff/src/__tests__/pd72Notifications.tsx`：192 时页面显示 192 且按钮可用；`pd72StaffAesthetic.ts`：120→0 真计数全量清零 |
| AE-STAFF-R2-01 | 前台工位读取本店今日确认／完成单；前台预约页显式 `storewide=true`，默认个人绩效与美容师口径不变；空态不再冒称全店无预约 | `pd72StaffAesthetic.ts`：同事确认单与刚完成单在工位／预约均可见；个人绩效仍不扩店；非前台显式 `storewide` 也不见他人单；`0113` 同步空态端口文案 |

## 命令与实测结果

- `server/`：`node node_modules/tsx/dist/cli.mjs src/__tests__/pd72StaffAesthetic.ts`
  - exit 0；实际执行 92 条迁移（原 91＋`0113`），九项断言全部命中预期；先迁移后 seed 的升级路径单独断言，临时首店库由父进程在子进程退出后删除。
  - RED 已先见：旧端口文案两项、前台工位空、前台预约空；GREEN 复跑转绿。
- 仓库根：`node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/staff/tsconfig.app.json apps/staff/src/__tests__/pd72Notifications.tsx`
  - exit 0；192 真计数与按钮可用断言成立。SSR 输出有 React `useLayoutEffect` 固有提示，不断言这些框架提示。
- `npm run build:staff`
  - exit 0；`tsc -b && vite build` 完成，2191 modules transformed。
- `npm run lint -w @philia/staff`
  - 与未改代码基线相同：25 errors／2 warnings（共 27），无新增计数；既有红项不属本令，未扩修。
- `server/`：`npm run typecheck`
  - 输出仅剩未改文件 `src/db/pd66EvidenceFixture.ts` 的 13 条 TS1375（顶层 await 所在文件不是 module）；本令引入的类型错误已清零，该既有文件未扩修。
- `git diff --check`
  - exit 0。

## 02 关键帧说明

- `06_me_before.png`：令包附带原始帧，dock 遮住第三组菜单。
- `06_me_after.png`：本令真实组件 SSR 后，以构建 CSS 在 390×857 视口滚动到底的单视口裁剪帧；第三组各行完整可见，dock 位于其后。
- 复现脚本：`render-me.tsx`。需先运行 `npm run build:staff`，再在仓库根用 Vite `ssrLoadModule('/evidence/pd72-staff-aesthetic-halfbaked/render-me.tsx')` 加载；生成物写入 `apps/staff/dist/pd72-me.html`，本次取帧后已删除生成物。

## 边界与清理

- 未做跨店／第二店造种，未真核销，未碰生产账号与预约。
- 本地 7200／7102／7104 验证进程已按 PID＋命令行核实后停止；`pd72-layout.db` 已删除；浏览器验证页已关闭。
- 未合并、未部署；本卷宗只记录施工与自测证据，不作验收结论。
