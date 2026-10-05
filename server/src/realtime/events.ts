/**
 * 实时推送 · 事件类型常量与事件信封（开发方案 §7.3）
 *
 * EventType 为三端共用语义（后续同步到 packages/shared），此处先落 server。
 * 事件信封统一结构：{ id, type, channel, data, ts }，SSE 消息按 id 续传。
 */

export const EventType = {
  // 预约生命周期
  AppointmentCreated:    'appointment.created',      // → store 频道
  AppointmentConfirmed:  'appointment.confirmed',    // → customer user 频道
  AppointmentAssigned:   'appointment.assigned',     // → staff + customer
  AppointmentCheckedIn:  'appointment.checkedin',    // → appointment 频道（三端）+ store 频道（B2-8）
  StepUpdated:           'step_updated',             // → appointment 频道（照片+状态）
  StepFlagged:           'step_flagged',             // 商家打标重拍 → staff + appointment
  AppointmentCompleted:  'appointment.completed',    // → appointment 频道（三端）+ store 频道（B2-8）
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
  OrderPaid:             'order.paid',               // → customer（支付回调成功，P5 T5.1 追加）
  OrderShipped:          'order.shipped',            // → customer
  OrderReceived:         'order.received',           // → store
  OrderCancelled:        'order.cancelled',          // → store（待支付取消/超时关单，库存已回补；v1.1 P0-8）
  // 收银台（批次 M1 · 登记型收银；统一走 store 频道，商家端 MerchantEventsProvider 已订阅）
  // M1-补1：cashier.billCollected 已随「记账 credit」删除（无触发点，删干净）
  CashierBillHeld:       'cashier.billHeld',         // 挂单 → store
  CashierBillSettled:    'cashier.billSettled',      // 结账 → store
  CashierBillVoided:     'cashier.billVoided',       // 撤单 → store
  // 批次 M1-补2：R3 交接班/日结 + 反结账双件（与 packages/shared constants/events.ts 同步）
  CashierShiftOpened:    'cashier.shiftOpened',      // 开班（含懒建） → store
  CashierShiftClosed:    'cashier.shiftClosed',      // 交接班确认闭班 → store
  CashierDayClosed:      'cashier.dayClosed',        // 日结冻结当班账目 → store
  CashierDayCloseReversed: 'cashier.dayCloseReversed', // 日结反结账（拆箱，仅店主） → store
  CashierBillReversed:   'cashier.billReversed',     // 收银台反结账单（已支付单冲正，仅店主） → store
  // 批次 员工端2.0（R7~R10；与 packages/shared constants/events.ts 同步）
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
  // 批次 C5 客户退款申请（客户端申请 → 商家审批缝；packages/shared 由补缺大批片 1 顺手收编同步）
  RefundRequestSubmitted: 'refundRequest.submitted', // 客户退款申请提交（补缺大批片 1 补发） → store
  RefundRequestApproved: 'refundRequest.approved',  // 客户退款申请批准（已生成 R12 退款单/商城售后） → store + user
  // 批次 R11a 会员前置批（双端同步）
  MembershipOpened:      'membership.opened',       // 售卡/微光开档/线上开通兑付 → user + store
  MembershipRenewed:     'membership.renewed',      // 续费解冻 → user
  MembershipCancelled:   'membership.cancelled',    // 退会（折算+清零留痕） → user + store
  // 补缺-3（46 号档+PD-07）：期内升档成交 → user（换档预约/取消走 membership_events 留痕，不发 SSE）
  MembershipUpgraded:    'membership.upgraded',     // 升档补差成交 → user
  RebateSettled:         'rebate.settled',          // 回馈金月度到账批次 → store
  // 补缺大批片 4（服务闭环：证书/报告/工单/发票；本片范围=server/，packages/shared 同步留客户端批）
  CertificateReady:      'certificate.ready',       // 安心证书生成 → user（客户）
  ReportReady:           'report.ready',            // 美容报告生成 → user（客户）
  TicketReplied:         'ticket.replied',          // 客服工单被回复 → user（客户）
  InvoiceIssued:         'invoice.issued',          // 发票登记开出 → user（客户）
  // 批次 6 补缺大批 · server 侧支付骨架
  PayOrderClosed:        'pay.orderClosed',         // 支付单超时关单（sweeper/懒超时） → user
  // 员工端骨架整建批 片 2（排班域；与 packages/shared constants/events.ts 同步）
  SchedulePublished:     'schedule.published',      // 周班表发布 → 逐受影响员工 staff:{staffId} 频道
  ShiftSwapResolved:     'shift.swapResolved',      // 换班审批结果（批准换挂/驳回留痕） → 双方 staff 频道
  // 员工端骨架整建批 片 3（任务执行+通讯；与 packages/shared constants/events.ts 同步）
  TaskReminder:          'task.reminder',           // 循环任务截止前提醒 → staff:{staffId}（assignee 或该角色全员逐一）
  AnnouncementPublished: 'announcement.published',  // 公告发布 → store 频道（员工定向通知=announce.publish 逐人补写）
  // 客户端体验大批 片 5（N6 海底捞铁规·申诉通道；与 packages/shared constants/events.ts 同步）
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

/** event_outbox 行 → 事件信封 */
export function toEnvelope(row: {
  id: string;
  eventType: string;
  channel: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}): EventEnvelope {
  return {
    id: row.id,
    type: row.eventType,
    channel: row.channel,
    data: row.payload ?? {},
    ts: row.createdAt.getTime(),
  };
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
