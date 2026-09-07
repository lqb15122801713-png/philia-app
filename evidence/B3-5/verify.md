# B3-5 验收证据映射（修复后 · 逐项）

采集时间：2026-09-07 23:00–23:55（本地）。复现记录见 repro.md（修复前 commit d7a40a5）。

## W-1 单店跳步
- 改动：BookingGroomingPage 仅 1 家门店时自动选中并跳过屏2（屏1→屏3；屏3 返回直回屏1）；摘要胶囊「门店」chip 保留可点回屏2 修改。
- 证据：verify-w1-dom.json（onTimeStep=true，屏1 点「下一步」直达选时间屏）+ verify-w1-skip-store.png（步骤条落在「选时间」，胶囊含门店）；verify-w1-back-dom.json + verify-w1-back-to-store.png（点「门店」chip 回到选店屏，店卡显示「当前选择」）。
- 回归：多店流程不变（singleStore 仅 length===1 生效）；寄养向导无独立选店屏（店选在屏2 内联胶囊），不受影响。

## W-2 今天可约口径统一（+1h 缓冲）
- 改动：assertBookableTime 首查改为「start < now+1h → BAD_REQUEST 仅可预约 1 小时之后的时段」（appointment.ts，BOOKING_LEAD_BUFFER_MS 导出）；getWithServices 改为「今天起 7 天营业时间合成 30min 栅格 + 合并 store_slots 占用行 + 剔除 +1h 内/满槽」（store.ts，无预建行按默认容量视为可约，与 create UPSERT 同口径）；SlotPicker 栅格保留未完全过期格、灰显由服务端可约集合驱动（含今天）；BoardingDateRangePicker 入住日时刻落在 +1h 内禁选。
- 证据：
  - 后端拦：verify-w2-create-within-1h.json（今天 23:00 → HTTP 400「仅可预约 1 小时之后的时段」，堆栈指向 assertBookableTime；修复前同一请求报「营业时间」——repro-w2-create-today2300.json 对照）。
  - 可约：verify-w2-create-bookable.json（明天 09:00 建单 HTTP 200；采集于打烊后 23:0x，今天已无 ≥now+1h 且在营业时间内的时段——smoke [5f] 自适应断言在营业时段运行时命中「今天晚些时候」）。
  - 可约槽口径：verify-w2-getWithServices.json（allAfterBuffer=true；合成栅格明天起全量返回）。
  - 满槽：verify-w2-fullslot.json（9/8 10:00 首单 200、次单 409「该时段已约满」——该槽另有 B3-3 证据单占位，capacity=2 打满）。
  - 前端：verify-w2-dom.json + verify-w2-today-bookable.png（CDP 冻结客户端时钟到 9/8 10:00：「今天」不再灰置，10:00 满槽灰显、19:30 因 60min 时长覆盖不到打烊灰显、其余彩色可点；页脚文案「灰色为已约满或 1 小时内的临近时段」）。
  - smoke：appointment.smoke [5f] 3 条 W-2 断言 + domain.smoke §2 合成栅格/+1h/满槽/duration 断言（smoke-run.txt）。

## W-4 客户标识
- 改动：listForStore 联 users 补 customerName/customerPhoneTail（appointment.ts；查询恒含 storeId=本店，手机号只回后 4 位）；appointment.get 补 customer{nickname, phoneTail}；商家端 AppointmentRow/DetailSummary/AppointmentDetailPage 统一 customerLabel（昵称空则「客户」）。
- 证据：verify-w4-listForStore.json（字段与样例）+ verify-w4-get.json（customer{nickname:'示例客户', phoneTail:'0000'}）；verify-w4-dom.json + verify-w4-merchant-list.png（列表 22 行均「示例客户 · 尾号 0000」，旧「客户 XDTB」消失）；verify-w4-detail-dom.json + verify-w4-merchant-detail.png（详情页客户字段同口径）。
- 越权口径：verify-w4-crossrole.json（客户角色调 listForStore → HTTP 403）；接口为 merchantProcedure 且 where 恒含 storeId=ctx.user.storeId，非本店订单不可达，客户标识只随本店订单出参。

## W-14 取消原因收集
- 改动：cancel 入参加选填 reason（≤100 字），>4h 直消与 ≤4h 申请两分支均落 cancelReason + cancelSource='customer'（复用 B3-3 迁移列，无新迁移）；客户取消弹层加原因 chips（行程有变/时间不合适/价格因素/其他，选填）+ 自由文本（合成「chip：文本」）；商家端取消审核区/已取消列表/详情摘要透出原因与来源。
- 证据：
  - 客户弹层：verify-w14-dom.json（4 chips + 自由文本框存在）+ verify-w14-cancel-sheet.png（行程有变选中 + 「临时要出差」）。
  - 直消链：orderD（UI 提交）→ verify-w14-cancelled-toast.png；查库 db-after.txt（status=cancelled, source=customer, reason=行程有变：临时要出差）。
  - ≤4h 审核链：verify-w14-cancelE-outcome.json（cancel_requested + 原因落库）→ verify-w14-merchant-review-dom.json + verify-w14-merchant-review.png（审核区透出「客户取消原因：时间不合适：临时加班赶不过来」）→ 商家 UI 批准 → verify-w14-merchant-cancelled-dom.json + verify-w14-merchant-cancelled.png（已取消列表透出「客户取消：…」/「商家婉拒：…」）；db-after.txt（orderE 批准后仍 cancelled + source=customer + 原因保留）。
  - smoke：[5f] W-14 五条断言（带原因/选填/≤4h 链/批准保留/超 100 字 400）。
- 说明：列表中一条 9/9 14:00 的乱码原因是 B3-3 证据期 Windows 控制台编码写入的历史数据，与本项无关，未动。

## W-16 员工排班前瞻
- 改动：TodayPage 加「今日 / 未来 7 天」分段切换；周视图复用 listForStaff（明天 00:00 起 7 天、本店已派本人单），按日分组升序、组内按时间升序，只读卡片（时间/宠物/服务/状态胶囊/客户备注），已取消不进列表；SSE 事件同时 invalidate 周视图。
- 证据：verify-w16-assigned.json（给小美派 9/8 09:00、9/10 14:00 两单）+ verify-w16-dom.json（tabs=[今日,未来 7 天]，分组 09-08 周二/09-10 周四 各 1 单）+ verify-w16-week-view.png。
- 回归：今日时间轴逻辑未动（view=today 分支原样）。

## A-P2-13 文案
- 改动：AppointmentLivePage ACTIVE_HINT.confirm：「等待家长确认接回」→「洗护师正在为您完成最后确认」。
- 证据：修复前 grep repro-p213-grep.txt（L73 旧文案）；verify-p213-dom.json（newCopy=true、oldCopyGone=false→true 即旧文案不存在）+ verify-p213-live-confirm.png（第 6 步「完成确认 进行中 · 洗护师正在为您完成最后确认」，夹具单已用后清理：db-after.txt）。

## A-P2-14 基类修正（boarding.checkout → staffProcedure）
- 改动：boarding.ts checkout 改 staffProcedure（手工守卫 getBoardingAppointment 保留兜底，其 merchant 分支不可达但防御性保留）；商家端 BoardingStayDetail 退房按钮禁用+说明、BoardingPage 拆除 CheckoutDialog 接线；员工端 BoardingCheckinPage 补「办理退房」入口（内联二次确认，替换原「退房请到商家端操作」引导——否则改动后全端无 UI 退房路径）。
- 证据：
  - 权限矩阵 curl：verify-p214-matrix.json（未登录 401 / 客户 403「需要员工身份」/ 商家 403 同文案）；verify-p214-staff-curl.json（非指派员工小美 403「无权操作该寄养单」——手工守卫兜底生效；阿强重复退房 alreadyCompleted=true 幂等）。
  - 员工正常退房回归：verify-p214-staff-dom.json（checkoutBtn=true、旧引导文案消失）+ verify-p214-staff-checkout-btn.png + verify-p214-staff-confirm.png（内联确认）+ verify-p214-staff-done.png（完成态）；orderG curl 退房 verify-p214-staff-curl-200.json（200，status=completed）；db-after.txt（stay checkoutAt 落库）。
  - 商家端联动：verify-p214-merchant-dom.json（按钮 found=true 且 disabled=true，说明文案透出）+ verify-p214-merchant-disabled.png。
  - 修复前对照：repro-p214-merchant-checkout-200.json（商家原本可退房 200）。
  - smoke：domain.smoke §5 新增 anon UNAUTHORIZED / 客户 FORBIDDEN / 商家 FORBIDDEN + 零副作用断言（smoke-run.txt）。

## 全绿（build.txt）
- server tsc --noEmit = 0；appointment.smoke = 0；domain.smoke = 0；customer/merchant/staff build = 0。
