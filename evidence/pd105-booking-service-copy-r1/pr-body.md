# PD-105｜客端网约服务文案／口径窄刀

## 范围

- 默认网约路由的服务 pill、服务半屏与服务 chips 统一以「洗澡／美容」作为展示大类，不再直接渲染服务细项名。
- 服务卡与选项副文使用共用文案「细节到店看宠再定」。
- 页头「默认已填…」改为自然口语。
- 零新交互；未改骨架、四 pill 行为、时段、禁用逻辑、运营配置字段、价目或 schema。

## 基线／边界

- 基线：`f8b4a17081cdeaf04acc293466fff8230246df8a`（`f8b4a17`）
- DEPLOY 对照：`20261027103103`
- 对照客 dist：`index-BfqWSVmi.js`
- 本窗无 mig；不占 0142–0146。
- PR 只开不合；合前需 update branch 到当时 tip，合后复测-R 另走既有流程。

## 首轮验证

- 修改前同源文案检查：7 项 FAIL；首轮树：7 项 PASS（`baseline-copy-red.txt`／`after-copy-green.txt`）。
- 真实 seed 服务名调用展示映射：5／5 PASS（`mapping-green.txt`）。
- 首轮 4 文件 ESLint：退出码 0（`lint-targeted.txt`）。
- 首轮 `npm run build`：退出码 0（`build-three-apps.txt`）。
- 首轮客包：`index-BFzpZXL6.js`；SHA-256 `d4be645f984e2fce674ebc95c95aa7000aee7ce4a035644658c420f3c89e5d9e`。

## 补刀 r2｜BLOCK2＋证据闸

- 页头 hint 已改走 `CK k="booking.groomingHint"`＋`bkc`；服务 pill 空标题同走 copy。
- `groomingServiceCategory` 以具名正则返回 `wash|style`；CATEGORIES 只比较 stable key，显示中文经 `booking.groomingCatWash|Style` 提供。
- BLOCK2 基线检查 16／20 项 FAIL（`baseline-block2-red.txt`）；当前静态检查 20／20 PASS（`static-copy-green.txt`／`mutation-restored-green.txt`）。
- 临时破坏 header copy：`COPY_CHECK_RED=1/20`（`mutation-red.txt`）；恢复后 `COPY_CHECK_GREEN=20/20`。
- 真实 helper 调用 5／5 PASS（`mapping-r2-green.txt`）；触及 4 文件 lint 退出码 0（`lint-targeted-r2.txt`）。
- 本机只读 preview＋headless 截图退出码 0：`visible-grooming-r2.png`；可见 hint、洗澡／美容与到店副文，无细项名；写请求 0（`visible-grooming-r2.json`／`visible-preview.txt`）。
- 三端 rebuild 退出码 0（`build-three-apps-r2.txt`）；customer 全量 lint 仍为 65 errors／4 warnings，与基线一致（`lint-customer-full-r2.txt`）。
- workspace 回归脚本：`SKIP-NO_WORKSPACE_TEST_SCRIPTS`；空 scripts 不作回归证据。

## NEW 候选 dist

- customer：`index-B8VZWDwO.js`（≠`index-BfqWSVmi.js` 且 ≠`index-BFzpZXL6.js`）
- customer SHA-256：`38038beddd90538733a8d0065aed5ff89e9245e5dd7b0d524e700a73d23efca7`
- merchant：`index-_dA59x8G.js`
- staff：`index-B584Q7Xj.js`

依赖环境备注：基线根 `postinstall` 经 `--prefix server` 在当前 npm 10／Windows 环境递归装入根包；使用根 `npm ci --ignore-scripts` 与 `server` 目录内正常 `npm ci` 完成锁定依赖安装，未修改仓内脚本或 lockfile。
