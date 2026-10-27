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

## 新鲜验证

- 修改前同源文案检查：7 项 FAIL；当前树：7 项 PASS（`baseline-copy-red.txt`／`after-copy-green.txt`）。
- 真实 seed 服务名调用展示映射：5／5 PASS（`mapping-green.txt`）。
- 本刀 4 文件 ESLint：退出码 0（`lint-targeted.txt`）。
- `npm test --workspaces --if-present`：退出码 0；没有 workspace 测试脚本被调用（`test-workspaces.txt`）。
- `npm run build`：退出码 0，customer／merchant／staff 三端均完成（`build-three-apps.txt`）。
- 客端全量 lint：退出码 1，65 errors／4 warnings，与修改前基线数量一致，未扩红；本刀文件无新增项（`lint-customer-full.txt`）。

## 候选 dist

- customer：`index-BFzpZXL6.js`（≠ `index-BfqWSVmi.js`）
- customer SHA-256：`d4be645f984e2fce674ebc95c95aa7000aee7ce4a035644658c420f3c89e5d9e`
- merchant：`index-_dA59x8G.js`
- staff：`index-B584Q7Xj.js`

依赖环境备注：基线根 `postinstall` 经 `--prefix server` 在当前 npm 10／Windows 环境递归装入根包；使用根 `npm ci --ignore-scripts` 与 `server` 目录内正常 `npm ci` 完成锁定依赖安装，未修改仓内脚本或 lockfile。
