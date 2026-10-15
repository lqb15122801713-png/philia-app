# 卷宗 · 运营后台改名纯 copy（D-56 · PD-25 · 任务书冻结版 V1.0 · CJ-1014-01）

> 分支 `feat/ops-console-rename-p0` ｜ 基线=现网 tip main@`e8d91da3`（PD-24 #113 已合后钉；全 `e8d91da3c9eee5798ffe3cd6bff705bcbfe0f348`）｜ 档位 **K0**（纯文案）｜ 2026-10-15
> 令书三件套在区；开口已按 CJ-1014-01 收死；并行纪律=不堵 PD-24（已合部）。

## 一、交付清单（片内序照令：A1→A2→A4→A5→C3→D1→D2→D4）

| 刀 | 交付 | 实证 |
|---|---|---|
| **A1** 侧栏 foot | `wnav.footConsole`「开发者管理端→**运营后台端**」（console.ts 默认值+0084 覆写值同改，禁半改） | F1 + e2e 106.1 |
| **A2** 页顶 | `cadm.pageTitle`→「**运营后台端**」；`cadm.pageSub` 写死=「**内容与脸面 · 店主 · 钱权另闸**」（零「运营」角色字样） | F1 + e2e 106.1 逐字 |
| **A4** 拒访 | `cadm.ownerOnlyTitle`→「运营后台端仅店主可用」（ownerOnlyBody 无旧名，不动）；owner 硬闸/角色矩阵**零变更** | F2 + 硬闸零改 diff |
| **A5** 店员引导 | `roles.ts` /console 引导句→「运营后台端由店主处理」（去「店长或店主」歧义；hint「店员工作面=收银台」既有沿承） | F3 |
| **C3** kill 支付语义 | `cadm.killArm`→「支付一键关停」、`killArmNote`→「支付一键关停（非 Banner）：线上支付通道等可关参数瞬时回落安全值（全局）。」、`killArmConfirm`→「确认支付一键关停？…（与 Banner 槽位下线无关）。」；**闸/端点/行为零改动**（config_kill_switch 一行未动） | F1 + e2e 106.1 |
| **D1** | `docs/ops/18_老板端控制台端口全集.md` §〇：展示名改「运营后台端（Ops Console）」+CJ-1014-01 校正注；**CJ-0921-18 史实句原样保留**（§〇由来段一行未动） | diff 在码 |
| **D2** | UX-02 四处（十五口冻结行/M1 轨 foot/W-00 注/W-16 标题）+UX-08 foot 行同步换名，均带「CJ-1014-01 展示改名：曾称开发者管理端」注 | diff 在码 |
| **D4** | **声明无命中**：共享区无《控制台运营视角优化_V1》文档本体；「A5三刀」命中件全为 PD-20 令书流转凭证（历史档案纪律不改）；`philia-online-ops` 为产品侧工作区不在本机面 | 回执 §五 |

## 二、闸门（全绿）

| 闸 | 结果 |
|---|---|
| server typecheck / merchant tsc -b | 0 |
| e2e 全链路 | **全绿**（新增 106 族三断言：七键逐字/ kill 支付语义/老板可见面零旧名残留；既有 1036 项零回退；copy 计数 4266/72 不变）——`e2e-green.log` |
| build 双版（零参录证 + 栈版 VITE_API_BASE=7200） | 全绿 —— `build-zero.log` / `build-stack.log` |
| nav 闭环 / smoke-routes / smoke-deploy | **126 路由 · 死胡同 0 · 弱 0** / **110/110** / **78 ✓ 全过** —— `nav-closure.log(.json)` / `smoke-routes.log` / `smoke-deploy.log`（首跑 routes 红 1=/console 锚点钉旧名→注册表同步后复跑绿，红日志留 `shots-run.log` 同卷说明） |
| 迁移 0084 | 幂等（UPDATE active=1 ×7；0071/0079/0083 范式）；闸门库核：copy active=**4266**/72 域不变；键入码必随迁移 ✓ |

## 三、实尺帧（shots/）

| 帧 | 内容 |
|---|---|
| F1-console-owner.png | 店主 /console：侧栏 foot「运营后台端」+页顶标题+pageSub 写死值+kill 区「支付一键关停（非 Banner）」同框；URL=/console 未改 |
| F2-console-manager-denied.png | 店长 /console：拒访「运营后台端仅店主可用」（换名不放权） |
| F3-console-clerk-guide.png | 店员 /console：引导页「运营后台端由店主处理」（去歧义） |
| shot-results.json | 帧内断言全绿（含三帧 body 零「开发者管理端」残留） |

## 四、禁区遵守（逐条）

改名**未放权**（角色矩阵/owner 硬闸零 diff）；**未开放 L2-②**；未进钱权徽章/折叠；**path `/console` 未改**（帧证 URL）；**未混 `/ops`**；`/dev-login` 工程定位未动；kill **未**改成 Banner 下线语义；未碰支付通道/提成/价目闸；**未堵 PD-24**（已合部，本批基线=合后 tip）；未判美；未拟人化布置走测 Bot；CJ-0921-18 史实句保留；台账/18 号档未单独 git push（文档改动随本分支 PR）；**A 窗禁合禁部**。

## 五、候裁明面（产品侧定夺）

1. **copy `screen` 归屏元数据**仍含「商家·开发者管理端」字样（文案端口编辑器的归屏分组名，老板后台可见但非三端展示面）——D5/D6 深挖口径「不扩」，本批未动；建议另批统一改归屏名。
2. **代码注释**（MerchantRail/ConsolePage/App.tsx 头部沿革注）保留「开发者管理端」历史称呼——D5 口径不扩；渲染面零残留已由 106.2 全扫钉死。
3. 02 台账/09 看板/12 表/23 卡面等**历史档案件**内的旧名记录未动（档案纪律：历史真身不改；新称呼自本批起生效）。
4. `cadm.ownerOnlyBody` 无旧名成分，未为换名而换名（拒访 body 原文沿承）。

— A 窗（施工方 · Kimi Code）2026-10-15
