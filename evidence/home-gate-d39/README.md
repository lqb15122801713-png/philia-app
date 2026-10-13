# home 错端加闸（D-39 · PD-19）卷宗 · evidence/home-gate-d39

- 开工令：产品-1013-home错端加闸（任务书=冻结版 V1.0，老板 10-13「签」；候裁①升格=客户端 `/home` 路由层角色闸）
- 档位：K2（安全边界/路由闸；无新钱域）；单片一件；分支 feat/home-gate-d39（PR 只开不合，base=main）
- 基线：生产 main@`2a2505dd`（codeload 钉 sha；PD-18 走查P2 已合部亲验尖）

## 一、单件明细（D-39）

- **修**：客户端 `/home` 路由层角色闸 `RequireCustomerEnd`——staff/merchant（及等价错端角色：groomer/frontdesk/merchant_*，以**会话角色字段**为准）访问 `/home` 不渲染宠友业务壳，人话明示错端+正确出路链接（员工端 :7203／商家端 :7202；未知拓扑兜底生产口）。
- **最小充分**：入口集合摸点=`/` 与路由兜底 `*` 均 Navigate 汇入 `/home`——闸 `/home` 一处即全覆盖（两汇入点同闸实证在卷）；**未升格**全站 RBAC/菜单级/API 鉴权（另案）。
- **判定单源**：角色集/端口映射/resolveEndTarget 抽 `apps/customer/src/lib/endGate.ts`，dev-login 出口卡（D-33/D-36）与路由闸（D-39）共用零漂移；文案复用 D-36 出口卡 devlogin.end* 键=**零新 copy 键、零迁移**。
- **不改**：D-36 已摘按钮口径（登录卡软口不回退，守卫帧在卷）；员工端/商家端正确落点；客户会话零误拦。

文件清单：`apps/customer/src/lib/endGate.ts`（新）、`apps/customer/src/components/RequireCustomerEnd.tsx`（新）、`apps/customer/src/App.tsx`（/home 接线+汇入注记）、`apps/customer/src/pages/DevLoginPage.tsx`（判定件改引 lib/endGate 单源，行为零改动）。

## 二、闸门表（栈=7130 客户 preview + 7200 API，CORS 显式三端；库=hg-gate.db 新库 migrate+seed 4222 键照存）

| 闸门 | 结果 | 件 |
|---|---|---|
| server typecheck / 全仓 build 零参版 / 栈版（VITE_API_BASE=7200） | 绿 | typecheck.log / build-gate.log / build-stack.log |
| e2e 连跑 | **三绿**（1009 断言/跑，100 族 D-29 守卫+101 族 0079 落库+D-36 相关族全绿，零回退） | e2e-green-1/2/3.log |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0 · 豁免 6（零新路由） | nav.log / nav.json |
| smoke-routes | 109/109 通过 | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 | smoke-deploy.log |
| 实尺截图 | 四帧 SHOTS_ALL_GREEN（8 项断言） | shots/ + shots.log + shots/checks.json |

## 三、实尺截图清单（shots/）

1. G1-staff-home-blocked.png —— 员工会话直输 `/home`：闸卡「该账号是员工账号…前往员工端 ›」(:7203)，宠友业务壳零渲染；G1b 汇入点断言在 checks.json（`/` 与乱路径同闸）
2. G2-merchant-home-blocked.png —— 商家会话直输 `/home`：闸卡「该账号是商家账号…前往商家端 ›」(:7202)
3. G3-customer-home-pass.png —— 客户会话 `/home` 正常可达（业务壳在屏、闸卡零误拦）
4. G4-d36-guard-holds.png —— D-36 守卫帧：dev-login 员工种子仍无「进入首页」软口+明示出口卡

## 四、候裁明面（两件照实报）

1. 闸卡页底部 AppDock 仍常显（全局 pathname 驱动工艺件，非 /home 业务壳内容；点 dock 进 /mall 等其它页=**范围外**，全站错端闸=另案登记）。
2. 闸卡仅出「前往正确端」链接（生产拓扑兜底 7203/7202）；未知拓扑不盲跳照 D-33 口径——未另加「退出登录」钮（出口卡既有口径对齐，判增删=产品侧）。

## 五、纪律自查

零新依赖 ｜ 零新 copy 键（复用 D-36 键，键入码零迁移申报=无迁移件） ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ D-31 开关未碰（仍关） ｜ D-34 生产库坐标未动 ｜ 真支付/真退款零触 ｜ 不判美不换皮 ｜ 角色判定=会话角色字段（非种子标记） ｜ 闸门栈 CORS 显式 ｜ 收摊必净（netstat 实证 PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合、禁合禁部。
