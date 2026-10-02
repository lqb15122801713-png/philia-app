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

import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
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
 * - store:{storeId}   → 该店 merchant_owner / merchant_manager / merchant_clerk 全部 userId
 *                       （店主 stores.owner_id + 该店员工中具有商家角色的用户；clerk=M1-补2 R2）
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
      // 该店员工中具有商家角色（owner/manager/clerk，M1-补2 R2 增 clerk）的用户
      const managers = await d
        .select({ userId: schema.staff.userId })
        .from(schema.staff)
        .innerJoin(
          schema.userRoles,
          and(
            eq(schema.userRoles.userId, schema.staff.userId),
            inArray(schema.userRoles.role, ['merchant_owner', 'merchant_manager', 'merchant_clerk']),
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
  /* 补缺修复小批 P2-2：主语完整式（「【旺财】的预约已确认」——消「您旺财的预约」拼接语病）。
     petN=【名】（主语位），pet=【名】的（领属位）；无 petName 回落通称 */
  const petN = typeof data.petName === 'string' && data.petName ? `【${data.petName}】` : '';
  const pet = petN ? `${petN}的` : '';
  const stepKey = typeof data.stepKey === 'string' ? data.stepKey : '';
  const step = StepKeyLabel[stepKey] ?? stepKey;
  switch (eventType) {
    case EventType.AppointmentCreated:
      return { title: '新预约提醒', body: `收到一条${pet}新预约，请及时确认` };
    case EventType.AppointmentConfirmed:
      return { title: '预约已确认', body: `${pet}预约已确认，请按时到店` };
    case EventType.AppointmentAssigned:
      return { title: '预约已派单', body: `${pet}预约已安排服务人员` };
    case EventType.AppointmentCheckedIn:
      return { title: '已到店签到', body: `${petN}已到店，服务即将开始` };
    case EventType.StepUpdated:
      return { title: '服务进度更新', body: `${pet}「${step}」步骤已更新` };
    case EventType.StepFlagged: {
      // v1.1 P1-4：商家打标可填原因（AppointmentMonitorPage 弹层已传 reason，服务端透传进通知文案）
      const reason = typeof data.reason === 'string' && data.reason ? `（原因：${data.reason}）` : '';
      return { title: '步骤需重拍', body: `${pet}「${step}」被商家标记，请重新拍照上传${reason}` };
    }
    case EventType.AppointmentCompleted:
      return { title: '服务已完成', body: `${pet}服务已完成，欢迎评价` };
    case EventType.AppointmentReopened:
      // v1.1-b3 B3-1：completed 单打标重开——预约回 in_service，目标步待重拍
      return { title: '预约已重新开启', body: `${pet}「${step}」被商家打标，服务已重新开启等待重拍` };
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
    case EventType.OrderCancelled:
      return data.by === 'system_timeout'
        ? { title: '订单已关闭', body: '一笔待支付订单超时未支付，已自动取消并回补库存' }
        : { title: '订单已取消', body: '客户取消了待支付订单，库存已回补' };
    // 批次 M1 收银台（登记型收银，store 频道）
    case EventType.CashierBillHeld:
      return { title: '收银台挂单', body: `单 ${data.billNo ?? ''} 已挂单` };
    case EventType.CashierBillSettled:
      return { title: '收银台结账', body: `单 ${data.billNo ?? ''} 已结账` };
    case EventType.CashierBillVoided:
      return { title: '收银台撤单', body: `单 ${data.billNo ?? ''} 已撤单` };
    /* ---- 补缺大批片 5：片 1/片 4 事件槽位（事件到达即落通知；写入链路不新增，
     * 仅映射表加行——对应业务方 emitEvent 挂接在片 1/片 4 分支落地） ---- */
    case 'refundRequest.approved':
      return { title: '退款申请已批准', body: '您的退款申请已批准，退款将按约定方式退回' };
    case 'refundRequest.rejected': {
      const reason = typeof data.reason === 'string' && data.reason ? `（原因：${data.reason}）` : '';
      return { title: '退款申请已驳回', body: `您的退款申请已被驳回${reason}，如有疑问请联系门店` };
    }
    case 'certificate.ready':
      return { title: '安心证书已生成', body: `${pet}安心证书已生成，点击查看` };
    case 'report.ready':
      return { title: '美容报告已送达', body: `${pet}美容报告已送达，点击查看` };
    case 'ticket.replied':
      return { title: '小棉花回复', body: '您有一条新的客服回复，点击查看' };
    case 'invoice.issued':
      return { title: '发票已开具', body: '您的发票已开具，点击查看' };
    default:
      return { title: '消息提醒', body: '您有一条新消息' };
  }
}

function linkFor(eventType: string, data: Record<string, unknown>): string | undefined {
  /* 补缺修复小批 P2-2：payload 预约键三态兼容（appointmentId / appointment_id / aid——
     aid=serviceStep 证书/报告事件键；兼容前证书/报告通知 link 落 undefined 无跳转） */
  const aid =
    typeof data.appointmentId === 'string'
      ? data.appointmentId
      : typeof data.appointment_id === 'string'
        ? data.appointment_id
        : typeof data.aid === 'string'
          ? data.aid
          : undefined;
  const orderId = typeof data.orderId === 'string' ? data.orderId : undefined;
  // 补缺大批片 5：片 1/片 4 事件槽位链接（先于 order./appointment 通用兜底判定）
  if (eventType === 'refundRequest.approved' || eventType === 'refundRequest.rejected') return '/refunds';
  if (eventType === 'certificate.ready') return aid ? `/philia/certs/${aid}` : undefined;
  if (eventType === 'report.ready') return aid ? `/philia/reports/${aid}` : undefined;
  if (eventType === 'ticket.replied') {
    const ticketId = typeof data.ticketId === 'string' ? data.ticketId : undefined;
    return ticketId ? `/support/${ticketId}` : undefined;
  }
  if (eventType === 'invoice.issued') return '/invoices';
  if (eventType.startsWith('order.')) return orderId ? `/orders/${orderId}` : undefined;
  return aid ? `/appointments/${aid}/live` : undefined;
}

/* ------------------------------------------------------------------ */
/* 补缺修复小批 P2-2：同单同刻聚合（聚合键=appointmentId+分钟桶）              */
/* ------------------------------------------------------------------ */

/** 聚合键提取：payload 预约键三态（appointmentId / appointment_id / aid） */
function appointmentKeyOf(data: Record<string, unknown>): string | undefined {
  if (typeof data.appointmentId === 'string' && data.appointmentId) return data.appointmentId;
  if (typeof data.appointment_id === 'string' && data.appointment_id) return data.appointment_id;
  if (typeof data.aid === 'string' && data.aid) return data.aid;
  return undefined;
}

/** 同预约通知 link 族（linkFor 三格式：live 进度页 / 证书 / 报告）——聚合匹配既有行用 */
function appointmentLinksOf(aid: string): string[] {
  return [`/appointments/${aid}/live`, `/philia/certs/${aid}`, `/philia/reports/${aid}`];
}

/* ------------------------------------------------------------------ */
/* 通知分类（补缺大批片 5 · 四类口径与迁移 0017 回填同帧）                  */
/* ------------------------------------------------------------------ */

export type NotifyCategory = 'trade' | 'service' | 'account' | 'marketing';

/**
 * 事件类型 → 通知分类（前缀映射）：
 * - trade：appointment.paid / order.* / cashier.* / refund.* / refundRequest.* / invoice.*
 * - service：appointment.* / step.* / step_* / boarding.* / certificate.* / report.*（含兜底）
 * - account：membership.* / auth.* / account.* / phone.* / deactivation.*
 * - marketing：marketing.*
 * 硬口径：仅 marketing 可退订；trade/service/account 恒落通知（保障服务履约）。
 */
export function categoryOf(eventType: string): NotifyCategory {
  const t = eventType.toLowerCase();
  if (t.startsWith('marketing.')) return 'marketing';
  if (t.startsWith('membership.') || t.startsWith('auth.') || t.startsWith('account.') ||
      t.startsWith('phone.') || t.startsWith('deactivation.')) return 'account';
  if (t === 'appointment.paid' || t.startsWith('order.') || t.startsWith('cashier.') ||
      t.startsWith('refund.') || t.startsWith('refundrequest.') || t.startsWith('invoice.')) return 'trade';
  // service：显式前缀命中 + 其余类型兜底（与列默认值 'service' 同帧）
  return 'service';
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
    const category = categoryOf(eventType);
    let receivers = targets;
    // 补缺大批片 5 订阅拦截：仅 marketing 类查 user_notify_prefs（enabled=0 跳过该用户）；
    // trade/service/account 恒落（保障服务履约硬口径）。
    if (category === 'marketing') {
      const disabledRows = await d
        .select({ userId: schema.userNotifyPrefs.userId })
        .from(schema.userNotifyPrefs)
        .where(
          and(
            inArray(schema.userNotifyPrefs.userId, targets),
            eq(schema.userNotifyPrefs.category, 'marketing'),
            eq(schema.userNotifyPrefs.enabled, false),
          ),
        );
      const disabled = new Set(disabledRows.map((r) => r.userId));
      receivers = targets.filter((uid) => !disabled.has(uid));
    }
    if (receivers.length > 0) {
      /* 补缺修复小批 P2-2：同单同刻聚合——同用户 + 同预约（link 族）+ 同分钟桶的后续事件
         不新增行，更新既有进度卡（type/title/body/link/category=最新进度，readAt 置回未读
         提示新进度）；无预约键的事件不聚合照常落行。零新迁移（不加业务键列，link 族反解）。 */
      const mergeAid = appointmentKeyOf(data);
      const now = new Date();
      const bucketStartMs = Math.floor(now.getTime() / 60000) * 60000;
      for (const userId of receivers) {
        if (mergeAid) {
          const existing = await d
            .select({ id: schema.notifications.id })
            .from(schema.notifications)
            .where(
              and(
                eq(schema.notifications.userId, userId),
                inArray(schema.notifications.link, appointmentLinksOf(mergeAid)),
                gte(schema.notifications.createdAt, new Date(bucketStartMs)),
                lt(schema.notifications.createdAt, new Date(bucketStartMs + 60000)),
              ),
            )
            .orderBy(desc(schema.notifications.createdAt))
            .limit(1)
            .then((r) => r[0]);
          if (existing) {
            await d
              .update(schema.notifications)
              .set({ type: eventType, title, body, link, category, readAt: null, updatedAt: now })
              .where(eq(schema.notifications.id, existing.id));
            continue;
          }
        }
        await d
          .insert(schema.notifications)
          .values({ userId, type: eventType, title, body, link, category });
      }
    }
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
