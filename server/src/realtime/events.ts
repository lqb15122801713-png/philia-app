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
  AppointmentCheckedIn:  'appointment.checkedin',    // → appointment 频道（三端）
  StepUpdated:           'step_updated',             // → appointment 频道（照片+状态）
  StepFlagged:           'step_flagged',             // 商家打标重拍 → staff + appointment
  AppointmentCompleted:  'appointment.completed',    // → appointment 频道（三端）
  AppointmentCancelRequested: 'appointment.cancel_requested', // → store
  AppointmentCancelled:  'appointment.cancelled',    // → 相关方
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
