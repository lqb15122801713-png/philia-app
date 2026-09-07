# B2-6 复现记录（修复前）

## 缺陷
客户端预约详情页只有「取消预约」，客户换时间只能取消重约（走查 W-13，合并旧 P1-3）。

## 复现步骤（2026-09-07）
1. 启动 server:7200 + customer:7100；
2. dev-seed-users 动态取 customer（示例客户）→ dev-login；
3. 打开明天待确认洗护单详情页 `/appointments/01M1WYH9QB9Z5PPH6N1S7FZMFM`，滚到底部截图。

## 现象
底部操作区只有「取消预约」一个按钮，无任何改期入口。见 `repro-detail-bottom-before.png`。

## 根因（文件 + 行号）
1. **客户端无入口**：`apps/customer/src/pages/AppointmentDetailPage.tsx`
   - L401–442「取消规则」区块：cancellable（pending/confirmed）状态下只渲染取消按钮/取消确认卡，无改期按钮；
   - L8 文件头注释亦只声明取消规则，无改期语义。
2. **服务端无客户改期接口**：`server/src/routers/appointment.ts`
   - L741–829 已存在的 `reschedule` 是 **merchantProcedure**（P4 T4.2 商家端改期，契约 docs/MERCHANT-CONTRACTS.md L26，商家端 RescheduleSheet 在用），customer 角色调用直接被中间件 FORBIDDEN；
   - 客户侧全生命周期只有 create/cancel（L642–696），客户想换时间只能 cancel 后重新 create。

## 修复方案（与任务书对齐）
- 服务端：把 `appointment.reschedule` 扩为「登录 + 角色分派」（publicProcedure 之上自行判角色）：
  - 商家（本店）→ 走原有分支，行为逐行不变（保 MERCHANT-CONTRACTS 契约）；
  - 客户（本人）→ 新增分支：仅 pending/confirmed、距原开始 >4h（与取消同阈值 CANCEL_FREE_BEFORE_SEC），
    复用 assertBookableTime + create 同款槽位容量校验；**同一事务**内：旧槽位 releaseSlot → 新槽位
    校验并 +1（满槽 CONFLICT 整体回滚）→ 更新 scheduledStart/End + status 回退 pending + staffId 置空；
    事件 `appointment.rescheduled` 发 `appointment:{aid}` + `store:{storeId}` 两频道。
- 客户端：详情页「取消预约」旁加「改期」按钮（pending/confirmed 且 >4h 的洗护单），展开复用
  预约向导的 SlotPicker（数据源 store.getWithServices 带当前 serviceId，等价预填当前服务/门店；
  宠物/服务在改期中不可变，页内摘要展示）→ 确认调 appointment.reschedule → toast「改期已提交，等待商家重新确认」。
