# 商家端共享契约（P4 并行开发防冲突 · 各子代理严格遵守）

> 共享层 packages/shared 已就绪：`usePhiliaClient / useMe / useEventSource / uploadImage / getApiBase / EventType / StepTimeline / PhotoWall / tokens`。
> 商家端会话：merchant_owner 角色（种子店主）。/dev-login 登录（同客户/员工端模式，种子用户同库）。
> SSE：push.subscribe（clientId 复用 `philia.sseClientId`，appType='merchant'）→ /api/events；服务端已给 merchant 订阅 `store:{storeId}` 频道（新预约/到店/步骤更新/异常都会来）。

## P4 范围说明（主代理定）

按方案 §9，**商品管理与商城订单页不在 P4**（属 P5 商城阶段，与商城后端一起落地）。P4 页面：dashboard / appointments(+:id, :id/monitor) / boarding / staff / finance / settings。

## 文件所有权矩阵（apps/merchant/ 下）

| 文件/目录 | 所有者 |
|---|---|
| src/providers.tsx、src/components/RequireMerchant.tsx、src/pages/DevLoginPage.tsx、src/main.tsx、src/App.tsx（装线+布局壳，路由表不动） | T4.1 coder-dash |
| src/pages/DashboardPage.tsx、src/components/dashboard/** | T4.1 coder-dash |
| src/pages/AppointmentsPage.tsx、AppointmentDetailPage.tsx、AppointmentMonitorPage.tsx、src/components/appointments/** | T4.2 coder-appt-admin |
| src/pages/StaffPage.tsx、BoardingPage.tsx、SettingsPage.tsx、src/components/staff-admin/** | T4.3 coder-staff-admin |
| src/pages/FinancePage.tsx、src/components/finance/** | T4.4 coder-finance |

## 服务端新增授权（每个代理恰好一处，追加后 `cd server && node node_modules/typescript/bin/tsc --noEmit` 必须过）

| 代理 | 新增过程 | 规格 |
|---|---|---|
| T4.1 | `store.dashboardStats`（merchantProcedure） | 入参无/可选日期；返回：今日预约数（分状态计数）、服务中数量、今日营业额（今日 paid_fen 合计）、待办（待确认 pending 数、待派单 confirmed 无 staff_id 数、取消申请 cancel_requested 数、待收款 completed 未 paid 数）、异常（超期寄养数） |
| T4.2 | `appointment.reschedule`（merchantProcedure） | 入参 {appointmentId, scheduledStart, scheduledEnd?}；校验本店+状态 confirmed/pending；事务内：旧槽位回减 booked_count → 新槽位校验并 +1 → 写新时间；emitEvent appointment.rescheduled → user:{customerId}+staff（若已指派）；冲突 CONFLICT |
| T4.3 | `store.update`（merchantProcedure） | 入参 {name?, address?, lat?, lng?, openHours?}；仅本店字段更新；updated_at 显式写 |
| T4.4 | `store.financeStats`（merchantProcedure） | 入参 {from, to}；返回：区间内服务收入（appointments paid_fen 合计，按 paid_at）、商城收入（orders paid 合计，v1 恒 0）、按日分组序列、员工维度（完成单数/服务金额/平均评分/好评率） |

## 通用约定

- **平板横屏双栏优先**（lg 断点以上左列表右详情，手机单列降级）；信息密度优先（表格/紧凑卡片）；待办红点聚合在 TabBar 与仪表盘。
- 金额分→元；时间 HH:mm、日期 M月D日 周x；全部中文。
- 关键操作（确认/派单/审核）一键完成：操作→optimistic 或 loading→成功 toast→invalidate；失败原文 toast。
- SSE invalidate：`appointment.created/checkedin/completed/cancel_requested/cancelled/rescheduled/step_updated` → 对应列表与 dashboardStats；新预约到达要有红点+声音？（无声音，红点即可）。
- 验证约束（四代理并行）：**只能 `npx vite build`（跳过 tsc）自检；不得起任何 server/dev 进程**；不改 packages/shared；不改他人文件。
- merchant tsconfig.app.json 需要 `"types": ["vite/client", "node"]`（AppRouter 类型图拉服务端源码，T4.1 顺手改）。
