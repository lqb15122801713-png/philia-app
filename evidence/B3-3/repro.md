# B3-3 复现记录（修复前 · commit 257be32）

## 缺陷
商家对待确认（pending）预约**没有拒单入口**：服务端无 `appointment.reject` 接口，商家端待确认列表每单只有「确认」操作。

## 复现步骤与现象

### 1. 接口级：无 reject 路由（repro-curl.txt）
- 动态取种子用户（`GET /api/auth/dev-seed-users` → seed-users.json），商家 dev-login；
- `POST /trpc/appointment.reject?batch=1`，body `{"0":{"json":{"appointmentId":"appt_x","reason":"时段已约满"}}}`；
- **现象**：HTTP 404，`No procedure found on path "appointment.reject"`（tRPC NOT_FOUND）。

### 2. 页面级：待确认列表无「婉拒」按钮（repro-merchant-list-no-reject.png + repro-shot.mjs 输出）
- 客户账号造明天 10:00 洗护 pending 单（create-pending.json，id `01M1XZ7RRS14Q63DNN4RN4TB67`）；
- 商家端 `/appointments?status=pending&date=all` 列表渲染出该单，行内仅有「确认」按钮；
- DOM 断言输出：`hasConfirmBtn: true`、`hasRejectBtn: false`，按钮全集 = [列表, 日历, 全部, 待确认, …, 确认, 管理]，无任何含「婉拒/拒」的按钮。

## 根因
v1.1 拒单能力（P1-1）未实现：`appointment.ts` 无 reject 过程、`appointments` 表无取消原因列、事件常量无 `appointment.rejected`、商家端列表组件无拒单入口。
