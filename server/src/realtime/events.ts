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
  precheck: '术前检查',
  grooming: '洗护',
  detail: '精修',
  before_after: '前后对比照',
  confirm: '家长确认',
};
