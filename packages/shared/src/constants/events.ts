/**
 * 实时推送 · 事件类型常量与事件信封（开发方案 §7.3）
 *
 * ⚠️ 与服务端同步：本文件抄自 server/src/realtime/events.ts（T2.0），
 * 为三端共用语义。服务端改动 EventType / EventEnvelope 时必须同步本文件，
 * 请勿在客户端单独增删事件类型。
 * 补缺大批片 1：顺手收编 C5 refundRequest.submitted / refundRequest.approved 双常量。
 *
 * 事件信封统一结构：{ id, type, channel, data, ts }，SSE 消息按 id 续传。
 */

export const EventType = {
  // 预约生命周期
  AppointmentCreated:    'appointment.created',      // → store 频道
  AppointmentConfirmed:  'appointment.confirmed',    // → customer user 频道
  AppointmentAssigned:   'appointment.assigned',     // → staff + customer
  AppointmentCheckedIn:  'appointment.checkedin',    // → appointment 频道（三端）
  StepUpdated:           'step_updated',             // → appointment 频道（照片+状态）
  StepFlagged:           'step_flagged',             // 商家打标重拍 → staff + appointment
  AppointmentCompleted:  'appointment.completed',    // → appointment 频道（三端）
  AppointmentReopened:   'appointment.reopened',     // completed 打标重开 → appointment + store + user 三频道（v1.1-b3 B3-1）
  AppointmentCancelRequested: 'appointment.cancel_requested', // → store
  AppointmentCancelled:  'appointment.cancelled',    // → 相关方
  AppointmentRejected:   'appointment.rejected',     // 商家拒单 → user + store 双频道（v1.1-b3 B3-3）
  AppointmentRescheduled:'appointment.rescheduled',  // → 相关方
  AppointmentReviewed:   'appointment.reviewed',     // → store + staff
  AppointmentPaid:       'appointment.paid',         // → store（到店付收款登记）
  // 寄养
  BoardingDailyUpdate:   'boarding.daily_update',    // → customer + store（商家端同步看打卡）
  BoardingOverdue:       'boarding.overdue',         // → store
  BoardingCompleted:     'boarding.completed',       // → 相关方
  // 商城
  OrderCreated:          'order.created',            // → store
  OrderPaid:             'order.paid',               // → customer + store（T5.4 同步服务端 events.ts）
  OrderShipped:          'order.shipped',            // → customer
  OrderReceived:         'order.received',           // → store
  // 收银台（批次 M1 · 登记型收银；统一走 store 频道，与 server 端 realtime/events.ts 同步）
  // M1-补1：cashier.billCollected 已随「记账 credit」删除
  CashierBillHeld:       'cashier.billHeld',         // 挂单 → store
  CashierBillSettled:    'cashier.billSettled',      // 结账 → store
  CashierBillVoided:     'cashier.billVoided',       // 撤单 → store
  // 批次 M1-补2：R3 交接班/日结 + 反结账双件（同步自 server realtime/events.ts）
  CashierShiftOpened:    'cashier.shiftOpened',      // 开班（含懒建） → store
  CashierShiftClosed:    'cashier.shiftClosed',      // 交接班确认闭班 → store
  CashierDayClosed:      'cashier.dayClosed',        // 日结冻结当班账目 → store
  CashierDayCloseReversed: 'cashier.dayCloseReversed', // 日结反结账（拆箱，仅店主） → store
  CashierBillReversed:   'cashier.billReversed',     // 收银台反结账单（已支付单冲正，仅店主） → store
  // 批次 员工端2.0（R7~R10；同步自 server realtime/events.ts）
  AttendanceMarked:      'attendance.marked',        // 打卡落痕 → staff + store
  AttendanceException:   'attendance.exception',     // 考勤异常（迟到/早退/外勤，片 2 B1-4） → store + staff
  AttendanceApprovalResolved: 'attendance.approvalResolved', // 异常/补卡审批结果 → staff
  AttendanceMonthExported: 'attendance.monthExported', // 考勤月表导出审计（仅老板） → store
  StockCountConfirmed:   'stock.countConfirmed',     // 盘点店长确认入账 → store
  ReviewSubmitted:       'review.submitted',         // 评价落库 → staff
  ReviewFlagged:         'review.flagged',           // ≤2 星差评提示 → store（店长视图）
  XpAwarded:             'xp.awarded',               // XP 事件（含 dropped 标记） → staff
  ConfigVersionSaved:    'config.versionSaved',      // 规则配置版本保存 → store
  // 批次 R12 退款专项（双端同步）
  RefundExecuted:        'refund.executed',         // 退款确认六联动落账 → store
  RefundSettled:         'refund.settled',          // 实退完成登记 → store
  RefundRejected:        'refund.rejected',         // 退款申请驳回（仅店主） → store
  RefundMonthExported:   'refund.monthExported',    // 退款月表导出审计（仅老板） → store
  // 批次 C5 客户退款申请（补缺大批片 1 顺手收编同步自 server realtime/events.ts）
  RefundRequestSubmitted: 'refundRequest.submitted', // 客户退款申请提交 → store
  RefundRequestApproved: 'refundRequest.approved',  // 客户退款申请批准 → store + user
  // 批次 R11a 会员前置批（双端同步）
  MembershipOpened:      'membership.opened',       // 售卡/注册用户开档 → user + store
  MembershipRenewed:     'membership.renewed',      // 续费解冻 → user
  MembershipCancelled:   'membership.cancelled',    // 退会（折算+清零留痕） → user + store
  RebateSettled:         'rebate.settled',          // 回馈金月度到账批次 → store
  // 员工端骨架整建批 片 2（排班域；同步自 server realtime/events.ts）
  SchedulePublished:     'schedule.published',      // 周班表发布 → 逐受影响员工 staff:{staffId} 频道
  ShiftSwapResolved:     'shift.swapResolved',      // 换班审批结果（批准换挂/驳回留痕） → 双方 staff 频道
  // 员工端骨架整建批 片 3（任务执行+通讯；同步自 server realtime/events.ts）
  TaskReminder:          'task.reminder',           // 循环任务截止前提醒 → staff:{staffId}
  AnnouncementPublished: 'announcement.published',  // 公告发布 → store 频道
  // 客户端体验大批 片 1（账户体系；同步自 server realtime/events.ts）
  SecurityNewDevice:     'security.newDevice',      // 新设备登录提醒（首见设备登记） → user 频道
  // 客户端体验大批 片 4（异常通报域/寄养拆封；同步自 server realtime/events.ts）
  IncidentReported:      'incident.reported',       // 异常通报落行 → appointment 频道
  IncidentHandled:       'incident.handled',        // 异常处置登记 → appointment 频道
  IncidentEscalated:     'incident.escalated',      // 超时未处置升级 → user + store
  BoardingUnsealed:      'boarding.unsealed',       // 寄养用品拆封 → user + store
  TicketEscalated:       'ticket.escalated',        // 工单升级店长介入 → store
  // 客户端体验大批 片 5（N6 申诉通道；同步自 server realtime/events.ts）
  MetricAppealResolved:  'metric.appealResolved',   // 指标申诉复核结果 → staff
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];

/** 事件统一信封（SSE data 载荷，§7.3） */
export interface EventEnvelope {
  /** 事件 ID（event_outbox 主键，单调递增 ULID，SSE id: 字段） */
  id: string;
  /** 事件类型（EventTypeValue） */
  type: string;
  /** 投递频道（user:{uid} / store:{storeId} / staff:{staffId} / appointment:{aid}） */
  channel: string;
  /** 事件载荷 */
  data: Record<string, unknown>;
  /** 事件时间（Unix 毫秒） */
  ts: number;
}

/** 洗护六步步骤 key → 中文名（通知文案用） */
export const StepKeyLabel: Record<string, string> = {
  disinfection: '消毒',
  precheck: '预检',
  grooming: '洗护',
  detail: '精修',
  before_after: '交付检查',
  confirm: '完成确认',
};
