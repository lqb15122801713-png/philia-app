# 卷宗 · 会员链路修正小批 片 4（末片·画布预览死链+C 股用例组）

> 令=开工令-产品-1008-会员链路小批片4.md ｜ 任务书=冻结版 V1.0 §一 D 股+C 股 ｜ 纪律-PM-1008（CJ-1008-01）随批 ｜ 基线=叠片 3 尖 73b4add9（codeload 钉 sha 拉取）｜ 分支 `feat/member-link-4` ｜ 卷宗 `evidence/member-link-4` ｜ PR 只开不合（base=feat/member-link-3）｜ 档位=K3·High（非涉钱面）｜ 施工=A 窗 2026-10-08。

## 一、施工总账（D 股+C 股全收）

1. **画布预览死链修通**（D 股）：
   - 实证在案=生产单域路径分端（7200 同口：客户端 /、员工端 /staff、商家端 /admin，.env 三域=占位 example.com），现码 Host 前缀推导（m.*→app.*）落空=死链；
   - 修=推导内核抽纯函数 **`apps/merchant/src/pages/canvasPreviewUrl.ts`**（可测件），三轨并存判定互斥：①单域路径分端（判定=控制台挂 /admin/ 路径前缀）：home→客户端同源 /home、memberCenter→/member、cashierMarketing→/admin/cashier（同源相对路径）；②dev/截图双轨（vite dev 或 localhost）：7101→7100/7131→7130 端口映射**零改动**；③Host 前缀工艺（m.*→app.*）**保留不拆**（将来真域名子域启用）；
   - 连带修（同源同问题）：merchant `main.tsx` BrowserRouter `basename={import.meta.env.BASE_URL}`（缺省 '/' 行为不变；/admin 路径分端托管下深链路由不断链——不修则生产形态下控制台深链即落 RoleLanding 兜底）；
   - **可测断言**=推导矩阵机读件（canvas-url-matrix.probe.mjs → canvas-url-matrix.json：三轨 10 例全过，含店锚参/兜底例）；
2. **C 股补用例组交付**：《会员链路小批走测用例组 V1.0》落共享区（会员链路小批走测用例组V1.0（A窗片4随附）.md，卷宗同名存档 walkthrough-cases.md）——收银台升级全链/已是会员拦截人话/续费回归/线上升级四态/入口链路/更名零残留走查/券全员+预约提前/画布三页签点验+走测红线；
3. **实尺实证**：生产形态模拟（7140 单口静态服务=客户 dist-probe 托 / +商家 dist-probe（base=/admin/ 构建）托 /admin；API=7200）——控制台 /admin/console 深链可达+三页签预览真页出图非死链（帧 1/2/3）+修复前对照帧（旧推导指 7100=连接拒绝，00 帧）。

## 二、申报件

1. **零迁移**（预期照令；copy 零增删改=无 0070）；
2. **nav 双表零申报**（零新路由；124 路由 0 死 0 弱 豁免 6）；
3. e2e 全量两绿采信 954 断言（零回退；本片 server 零改动=族号不加）；
4. **CJ-1008-01 六条自过**：推导抽纯函数单源（可测件）/命名说人话（canvasPreviewUrl/PreviewLoc）/注释写为什么（三轨判定信号写死来历）/零死代码零调试残留/结构按业务域摆（画布页同目录件）/维护者视角自过 diff=已做。

## 三、闸门（2026-10-08 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build | exit 0 | gate-build.log |
| server typecheck | 0 | gate-typecheck.log |
| e2e 全量 | **两绿采信 954 断言**（55-89 全族零回退） | gate-e2e-green1.log + gate-e2e-green2.log |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6** | gate-nav-closure.log + nav-closure.json |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 ✅ | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 推导矩阵 | 三轨 10 例全过 | canvas-url-matrix.json |
| 实尺截图 4 帧 | 三页签预览真页（home/memberCenter/cashierMarketing）+修复前死链对照（7100 连接拒绝）——**逐屏目检已做**（PROBE_ALL_GREEN） | 00-03-*.png + probe-result.json |

## 四、红线自查

零新依赖 / 禁令零命中 / 行尾 LF（3 改动件 CR=0）/ 零迁移（申报）/ gh API 四步 / 收摊必净（TaskStop×4+taskkill 补刀+netstat 复核 7100-7103/7200 零监听+dist-probe/uploads 清零）/ **CJ-1008-01 六条自过**。

## 五、观察项与环境件登记

1. **探针备数污染事件（环境件，已复原）**：探针给店主加挂 customer 角色 → dev-seed-users 的 customer 首选换位（按 createdAt 序）→ review-e2e/smoke-deploy 首跑夹具前置红（pet=undefined/充次无预约）；复原（删角色行）后两闸门复跑全绿——**非产品回归，探针工艺注记：备数加角色须用后复原**（已入本卷宗，后续批次探针纪律沿用）；
2. **探针拓扑注记**：生产形态模拟用 7103（CORS 白名单内空闲口；7140 不在 DEV_ORIGINS 被拒=环境口径件）；商家端探针构建=vite build --base=/admin/（CLI 覆写零仓内改动）——**生产若按 /admin 路径分端托管商家端，部署构建须带 base=/admin/**（Dockerfile ARG 留口候部署批，本批不改构建管线）；
3. 帧 2（会员中心预览）内文=开通引导页（预览会话=店主无会员档→真页引导态渲染=非死链实证成立；会员态渲染走客户端既有链，片 2 帧 2 已实证）；
4. Host 前缀轨保留未实机验（生产无真子域名可验；矩阵断言件覆盖推导逻辑）。

— A 窗（施工方，角色卡⑧ V2.2）2026-10-08 晚
