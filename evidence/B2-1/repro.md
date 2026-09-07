# B2-1 复现记录（修复前，2026-09-07 11:2x 本地）

## 缺陷
商家待办「去处理」深链撞上「今天」日期过滤：仪表盘显示「待确认 1」，点入列表默认过滤「今天」，预约在明天 → 空列表「该条件下暂无预约」。

## 复现步骤
1. 起 server(:7200) 与 merchant(:7101)。
2. 客户登录（dev-seed-users 取 roles 含 customer 的用户 → POST /api/auth/dev-login），通过 tRPC `appointment.create` 造一单**明天（2026-09-08 13:00）**的洗护预约，paymentMode=pay_at_store，勿确认。
   - 造单输出见 `setup-output.txt`：created `01M1WYH9QB9Z5PPH6N1S7FZMFM` status=pending scheduledStart=2026-09-08T05:00:00Z（本地 13:00）。
3. Edge CDP 以商家（roles 含 merchant_owner）登录，打开 `/dashboard` → 待办区显示「待确认 1 · 去处理」（截图 `before-1-dashboard.png`）。
4. 点击该行「去处理」→ 落在 `/appointments?status=pending`，日期过滤停在默认「今天」→ 列表空态「该条件下暂无预约」，看不到明天的那单（截图 `before-2-list.png`，DOM 事实见 `before-dom.json`：`empty=true, activeRange=["今天"], hasWangcai=false`）。

## 根因
- `apps/merchant/src/components/dashboard/TodoSection.tsx`：待办行深链只带 `?status=pending`。
- `apps/merchant/src/pages/AppointmentsPage.tsx`：`rangeKey` 无条件默认 `'today'`，不读任何 URL 参数 → 预约不在今天时列表为空。

## 修复（最小集）
- TodoSection：三条 `/appointments` 深链追加 `&from=todo`。
- AppointmentsPage：读到 `from=todo`（或 `date=all`）时 `rangeKey` 初始化为新增的 `'all'` 档（日期过滤「全部」，不传 from/to，服务端本就按 scheduledStart 升序）。
- appt-utils：`RangeKey` 增 `'all'`，`RANGE_LABEL.all='全部'`；列表查询在 `'all'` 时省略 from/to。
- 非待办入口（无参数）默认 `'today'` 不变。
