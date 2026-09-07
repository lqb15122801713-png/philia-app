# B3-5 复现记录（修复前 · commit d7a40a5）

采集时间：2026-09-07 22:47–22:55（本地）。种子库仅 1 家门店（菲丽亚宠物·示例店），store_slots  seeded 范围 9/8–9/14（db-before.txt）。

## W-1 单店跳步
- 现象：门店列表仅 1 家（repro-w2-stores.json count=1），洗护向导第 2 步仍是整页「选门店」，
  只有一张店卡也必须手动点（repro-w1-dom.json：storeCards=1、步骤条=选服务2选门店3选时间4确认；
  截图 repro-w1-single-store-step2.png）。
- 根因：`apps/customer/src/pages/BookingGroomingPage.tsx` STEPS 固定含「选门店」，
  下一步按钮（约 L381-388）无单店跳步逻辑。

## W-2 今天可约口径
- 现象①前端：向导第 3 屏日条「今天」灰置不可选（repro-w2-dom.json dayBtns[0]={今天,gray}；
  截图 repro-w2-today-gray.png，栅格默认落到「明天」）。
  根因：getWithServices 只回传 store_slots 既有行（server/src/routers/store.ts L163-174），
  而种子槽位「明天起」生成（server/src/db/seed.ts L77 `dayOffset = 1` 起），今天没有任何行 → 全天灰。
- 现象②后端口径不统一：旧规则仅拦 `start <= now`（appointment.ts L429），无 +1h 缓冲；
  今天 23:00 建单被拒的理由是「营业时间」（repro-w2-create-today2300.json HTTP 400，
  堆栈指向 assertBookableTime L443），而非「临近不可约」。

## W-4 客户标识
- 现象：商家预约列表/详情客户显示「客户 XDTB」（customerId 后 4 位，截图 repro-w4-merchant-list.png，
  DOM repro-w4-dom.json 每行均「客户 XDTB」）。
- 根因：listForStore（appointment.ts L1408-1439）未联 users 表；响应无 nickname/手机号字段
  （repro-w4-listForStore.json firstRowKeys 无 customerName/customerPhoneTail）；
  appointment.get 同样无 customer 字段（repro-w4-get.json hasCustomer=false）。
  前端兜底：AppointmentRow.tsx L69 / DetailSummary.tsx L65 / merchant AppointmentDetailPage.tsx L89。

## W-14 取消原因收集
- 现象：客户取消弹层无原因选项（repro-w14-dom.json chips 全 false、无原因输入框；
  截图 repro-w14-cancel-sheet.png）；客户取消后 cancel_reason/cancel_source 均为 NULL
  （repro-w14-cancel-no-reason.json：旧 cancel 无 reason 入参，传入也被 zod 静默丢弃）。
- 商家端已取消列表 5 行无一透出原因（repro-w14-merchant-dom.json withReason=0）。
- 根因：appointment.cancel（appointment.ts L932-988）入参仅 appointmentId；商家端
  AppointmentRow/DetailSummary/AppointmentDetailPage 未渲染 cancelReason。

## W-16 员工排班前瞻
- 现象：员工端 /today 只有「今日任务」，无未来视图（repro-w16-dom.json hasWeekView=false；
  截图 repro-w16-today-only.png）。
- 根因：TodayPage 仅接 listTodayForStaff（当日 24h），无 listForStaff 前瞻区间调用。

## A-P2-13 文案
- 现象：客户端 live 页第 6 步提示「等待家长确认接回」（repro-p213-grep.txt：
  AppointmentLivePage.tsx L73），家长/确认表述歧义。

## A-P2-14 基类
- 现象：boarding.checkout 为 publicProcedure（repro-p214-grep.txt：boarding.ts L244），
  任何登录角色可达业务校验——商家账号直接退房成功 200（repro-p214-merchant-checkout-200.json，
  预约 01M1Y30T35… → completed）；无 stay 的在住单也进到业务校验才 404
  （repro-p214-merchant-checkout.json）。基类未表达「员工操作」意图，仅靠手工守卫兜底。
