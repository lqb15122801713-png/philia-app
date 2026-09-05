/**
 * 事件总线（CONTRACTS.md 契约 2）—— 发件箱 + 站内通知 + 即时广播
 *
 * 业务 router 用法（T1.3）：
 *   await db.transaction(async (tx) => {
 *     ...业务写库...
 *     const outboxId = await emitEvent(tx, `store:${storeId}`, EventType.AppointmentCreated, {...});
 *     // 事务提交后：
 *     broadcastNow(outboxId);
 *   });
 *
 * - emitEvent：事务内调用。写 event_outbox（单调 ULID），并按 resolveChannelTargets
 *   解析出的接收人逐个写 notifications（离线补偿与历史记录，§7.1）。返回 outbox id。
 * - broadcastNow：事务提交后调用（fire-and-forget）。即时广播到在线 SSE 连接；
 *   有在线连接送达才把 delivered 置 1，否则留给 outboxSweeper 重投。
 * - resolveChannelTargets：频道 → 接收用户集合。
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { EventType, StepKeyLabel, toEnvelope, type EventEnvelope } from './events';
import * as hub from './hub';

/** drizzle 实例类型（契约 2 的 Db；业务方传全局 db 或事务 handle 均可） */
export type Db = typeof db;

/* ------------------------------------------------------------------ */
/* 频道 → 接收用户集合解析                                               */
/* ------------------------------------------------------------------ */

/**
 * 频道 → 接收用户 ID 数组（去重）：
 * - user:{uid}        → 本人
 * - store:{storeId}   → 该店 merchant_owner / merchant_manager 全部 userId
 *                       （店主 stores.owner_id + 该店员工中具有商家角色的用户）
 * - staff:{staffId}   → 该员工的 userId
 * - appointment:{aid} → customer_id + 门店商家 + 被指 staff 的 userId
 */
export async function resolveChannelTargets(d: Db, channel: string): Promise<string[]> {
  const sep = channel.indexOf(':');
  if (sep <= 0) return [];
  const kind = channel.slice(0, sep);
  const key = channel.slice(sep + 1);
  const dedupe = (ids: Array<string | null | undefined>) => [
    ...new Set(ids.filter((x): x is string => !!x)),
  ];

  switch (kind) {
    case 'user':
      return dedupe([key]);

    case 'store': {
      const store = await d
        .select({ ownerId: schema.stores.ownerId })
        .from(schema.stores)
        .where(eq(schema.stores.id, key))
        .get();
      // 该店员工中角色为 merchant_owner / merchant_manager 的用户
      const managers = await d
        .select({ userId: schema.staff.userId })
        .from(schema.staff)
        .innerJoin(
          schema.userRoles,
          and(
            eq(schema.userRoles.userId, schema.staff.userId),
            inArray(schema.userRoles.role, ['merchant_owner', 'merchant_manager']),
          ),
        )
        .where(eq(schema.staff.storeId, key));
      return dedupe([store?.ownerId, ...managers.map((r) => r.userId)]);
    }

    case 'staff': {
      const row = await d
        .select({ userId: schema.staff.userId })
        .from(schema.staff)
        .where(eq(schema.staff.id, key))
        .get();
      return dedupe([row?.userId]);
    }

    case 'appointment': {
      const appt = await d
        .select({
          customerId: schema.appointments.customerId,
          storeId: schema.appointments.storeId,
          staffId: schema.appointments.staffId,
        })
        .from(schema.appointments)
        .where(eq(schema.appointments.id, key))
        .get();
      if (!appt) return [];
      const storeTargets = await resolveChannelTargets(d, `store:${appt.storeId}`);
      const staffTargets = appt.staffId
        ? await resolveChannelTargets(d, `staff:${appt.staffId}`)
        : [];
      return dedupe([appt.customerId, ...storeTargets, ...staffTargets]);
    }

    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* 通知文案（事件类型 → 简短中文 title/body + 跳转 link）                 */
/* ------------------------------------------------------------------ */

function notificationCopy(
  eventType: string,
  data: Record<string, unknown>,
): { title: string; body: string } {
  const pet = typeof data.petName === 'string' && data.petName ? `${data.petName}的` : '';
  const stepKey = typeof data.stepKey === 'string' ? data.stepKey : '';
  const step = StepKeyLabel[stepKey] ?? stepKey;
  switch (eventType) {
    case EventType.AppointmentCreated:
      return { title: '新预约提醒', body: `收到一条${pet}新预约，请及时确认` };
    case EventType.AppointmentConfirmed:
      return { title: '预约已确认', body: `您${pet}预约已确认，请按时到店` };
    case EventType.AppointmentAssigned:
      return { title: '预约已派单', body: `${pet}预约已安排服务人员` };
    case EventType.AppointmentCheckedIn:
      return { title: '已到店签到', body: `${pet}已到店，服务即将开始` };
    case EventType.StepUpdated:
      return { title: '服务进度更新', body: `${pet}「${step}」步骤已更新` };
    case EventType.StepFlagged:
      return { title: '步骤需重拍', body: `${pet}「${step}」被商家标记，请重新拍照上传` };
    case EventType.AppointmentCompleted:
      return { title: '服务已完成', body: `${pet}服务已完成，欢迎评价` };
    case EventType.AppointmentCancelRequested:
      return { title: '取消申请', body: `客户申请取消${pet}预约，请尽快处理` };
    case EventType.AppointmentCancelled:
      return { title: '预约已取消', body: `${pet}预约已取消` };
    case EventType.AppointmentRescheduled:
      return { title: '预约已改期', body: `${pet}预约时间已调整，请查看最新安排` };
    case EventType.AppointmentReviewed:
      return { title: '收到新评价', body: `客户评价了${pet}服务` };
    case EventType.AppointmentPaid:
      return { title: '收款登记', body: `${pet}预约已完成到店收款登记` };
    case EventType.BoardingDailyUpdate:
      return { title: '寄养日报', body: `${pet}今日寄养打卡已更新` };
    case EventType.BoardingOverdue:
      return { title: '寄养逾期提醒', body: `${pet}寄养已到期未退住，请联系客户` };
    case EventType.BoardingCompleted:
      return { title: '寄养结束', body: `${pet}寄养已退住结算` };
    case EventType.OrderCreated:
      return { title: '新订单提醒', body: '收到一条新的商城订单，请及时处理' };
    case EventType.OrderPaid:
      return { title: '订单支付成功', body: '您的订单已支付成功，商家将尽快发货' };
    case EventType.OrderShipped:
      return { title: '订单已发货', body: '您的订单已发货，请注意查收' };
    case EventType.OrderReceived:
      return { title: '订单已签收', body: '客户已确认收货' };
    default:
      return { title: '消息提醒', body: '您有一条新消息' };
  }
}

function linkFor(eventType: string, data: Record<string, unknown>): string | undefined {
  const aid =
    typeof data.appointmentId === 'string'
      ? data.appointmentId
      : typeof data.appointment_id === 'string'
        ? data.appointment_id
        : undefined;
  const orderId = typeof data.orderId === 'string' ? data.orderId : undefined;
  if (eventType.startsWith('order.')) return orderId ? `/orders/${orderId}` : undefined;
  return aid ? `/appointments/${aid}/live` : undefined;
}

/* ------------------------------------------------------------------ */
/* 契约 2：emitEvent / broadcastNow                                     */
/* ------------------------------------------------------------------ */

/**
 * 事务内调用：写 event_outbox + notifications（按 resolveChannelTargets 解析的
 * 接收人逐人生成站内通知）。返回 outbox id。
 */
export async function emitEvent(
  d: Db,
  channel: string,
  eventType: string,
  data: Record<string, unknown>,
): Promise<string> {
  const targets = await resolveChannelTargets(d, channel);
  const inserted = await d
    .insert(schema.eventOutbox)
    .values({ channel, eventType, payload: data })
    .returning({ id: schema.eventOutbox.id });
  const outboxId = inserted[0]!.id;

  if (targets.length > 0) {
    const { title, body } = notificationCopy(eventType, data);
    const link = linkFor(eventType, data);
    await d.insert(schema.notifications).values(
      targets.map((userId) => ({ userId, type: eventType, title, body, link })),
    );
  }
  return outboxId;
}

/** 广播一条 outbox 事件到在线连接；送达 ≥1 连接时置 delivered=1。返回送达数。 */
export async function deliverOutboxRow(outboxId: string): Promise<number> {
  const row = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.id, outboxId))
    .get();
  if (!row) return 0;
  const envelope: EventEnvelope = toEnvelope(row);
  const delivered = hub.broadcast(row.channel, envelope);
  if (delivered > 0 && !row.delivered) {
    await db
      .update(schema.eventOutbox)
      .set({ delivered: true, updatedAt: new Date() })
      .where(eq(schema.eventOutbox.id, outboxId));
  }
  return delivered;
}

/**
 * 事务提交后调用：把 outbox 事件即时广播到在线 SSE 连接（fire-and-forget）。
 * 无在线订阅者时 delivered 保持 0，由 outboxSweeper 每 30s 重投。
 */
export function broadcastNow(outboxId: string): void {
  deliverOutboxRow(outboxId).catch((err) => {
    console.error(`[realtime] broadcastNow(${outboxId}) 失败:`, err);
  });
}
