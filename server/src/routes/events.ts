/**
 * SSE 实时推送端点：GET /api/events?client_id=...&watch=<appointmentId>
 *
 * 流程（开发方案 §7.2 / §7.4）：
 * 1. 校验会话（c.get('sessionUser')，由 T1.2 会话中间件注入；未登录 401）
 * 2. 校验 client_id 归属：push_subscriptions 必须有记录且属本人（先走 push.subscribe 登记）
 * 3. 按用户角色计算订阅频道集：
 *    - user:{id} 恒有
 *    - staff（staffId 存在）→ staff:{staffId}
 *    - merchant_owner / merchant_manager（storeId 存在）→ store:{storeId}
 *    - watch=<appointmentId>：校验预约归属（customer=本人 / staff=本店且未指派或指派给自己 /
 *      merchant=本店）后动态挂入 appointment:{aid}
 * 4. 续传：按 Last-Event-ID（header 优先，兼容 ?last_event_id= 与订阅记录基线）查询
 *    event_outbox WHERE channel IN (订阅集) AND id > lastId，按 id 升序补发
 * 5. 挂入内存 Hub 实时收事件；断开时退订并回写 push_subscriptions（断开时间 + 最后事件 ID）
 */

import { and, eq, gt, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { db, schema } from '../db';
import { toEnvelope, type EventEnvelope } from '../realtime/events';
import * as hub from '../realtime/hub';

/**
 * 与契约 1 SessionUser 结构对齐的本地结构类型（结构化兼容）。
 * trpc.ts（T1.2）就位后可直接换 `import type { SessionUser } from '../trpc'`。
 */
export interface SessionUserLike {
  id: string;
  nickname: string | null;
  roles: Array<'customer' | 'merchant_owner' | 'merchant_manager' | 'staff'>;
  staffId?: string;
  storeId?: string;
}

type EventsVariables = { Variables: { sessionUser?: SessionUserLike | null } };

/* ------------------------------------------------------------------ */
/* 可独立测试的纯逻辑                                                    */
/* ------------------------------------------------------------------ */

/** 按用户角色计算基础订阅频道集（user 恒有；staff / merchant 按身份追加） */
export function channelsForUser(user: SessionUserLike): string[] {
  const channels = [`user:${user.id}`];
  if (user.staffId) channels.push(`staff:${user.staffId}`);
  const isMerchant =
    user.roles.includes('merchant_owner') || user.roles.includes('merchant_manager');
  if (isMerchant && user.storeId) channels.push(`store:${user.storeId}`);
  return channels;
}

/** watch=<appointmentId> 归属校验：本人预约 / 本店商家 / 本店且未指派或指派给自己的员工 */
export async function validateWatch(
  d: typeof db,
  user: SessionUserLike,
  appointmentId: string,
): Promise<boolean> {
  const appt = await d
    .select({
      customerId: schema.appointments.customerId,
      storeId: schema.appointments.storeId,
      staffId: schema.appointments.staffId,
    })
    .from(schema.appointments)
    .where(eq(schema.appointments.id, appointmentId))
    .get();
  if (!appt) return false;
  if (appt.customerId === user.id) return true;
  const isMerchant =
    user.roles.includes('merchant_owner') || user.roles.includes('merchant_manager');
  if (isMerchant && user.storeId && appt.storeId === user.storeId) return true;
  if (
    user.staffId &&
    user.storeId &&
    appt.storeId === user.storeId &&
    (!appt.staffId || appt.staffId === user.staffId)
  ) {
    return true;
  }
  return false;
}

/**
 * 断线续传：补发订阅频道集中 id > lastEventId 的事件（按 id 升序，单调 ULID
 * 字典序即时间序）。补发即送达，未置位的 delivered 一并置 1。
 */
export async function replayMissed(
  d: typeof db,
  channels: string[],
  lastEventId?: string | null,
): Promise<EventEnvelope[]> {
  if (!lastEventId || channels.length === 0) return [];
  const rows = await d
    .select()
    .from(schema.eventOutbox)
    .where(
      and(inArray(schema.eventOutbox.channel, channels), gt(schema.eventOutbox.id, lastEventId)),
    )
    .orderBy(schema.eventOutbox.id)
    .limit(500);

  const undelivered = rows.filter((r) => !r.delivered).map((r) => r.id);
  if (undelivered.length > 0) {
    await d
      .update(schema.eventOutbox)
      .set({ delivered: true, updatedAt: new Date() })
      .where(inArray(schema.eventOutbox.id, undelivered));
  }
  return rows.map(toEnvelope);
}

/* ------------------------------------------------------------------ */
/* Hono 路由                                                            */
/* ------------------------------------------------------------------ */

/** 心跳惰性启动（首次有连接时启动 25s 心跳定时器） */
const ensureHeartbeat = (() => {
  let started = false;
  return () => {
    if (!started) {
      started = true;
      hub.startHeartbeat(25_000);
    }
  };
})();

export const eventsRoute = new Hono<EventsVariables>().get('/', async (c) => {
  const user = c.get('sessionUser');
  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, 401);
  }

  // client_id 归属校验：push_subscriptions 有记录且属本人
  const clientId = c.req.query('client_id');
  if (!clientId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '缺少 client_id' } }, 400);
  }
  const sub = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.clientId, clientId),
        eq(schema.pushSubscriptions.userId, user.id),
      ),
    )
    .get();
  if (!sub) {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'client_id 未登记或不属于当前用户' } },
      403,
    );
  }

  // 订阅频道集 = 角色基础频道 + watch 动态频道
  const channels = channelsForUser(user);
  const watch = c.req.query('watch');
  if (watch) {
    if (!(await validateWatch(db, user, watch))) {
      return c.json(
        { error: { code: 'FORBIDDEN', message: '无权订阅该预约频道' } },
        403,
      );
    }
    channels.push(`appointment:${watch}`);
  }

  // 续传基线：Last-Event-ID header 优先，其次 ?last_event_id=，最后订阅记录里的基线
  const lastEventId =
    c.req.header('Last-Event-ID') ?? c.req.query('last_event_id') ?? sub.lastEventId ?? undefined;

  ensureHeartbeat();

  return streamSSE(c, async (stream) => {
    const conn: hub.HubConnection = {
      clientId,
      userId: user.id,
      appType: sub.appType,
      lastEventId,
      send(envelope) {
        // 续传去重：已补发过的事件不再实时推
        if (conn.lastEventId && envelope.id <= conn.lastEventId) return;
        void stream
          .writeSSE({
            data: JSON.stringify(envelope),
            event: envelope.type,
            id: envelope.id,
          })
          .then(() => {
            conn.lastEventId = envelope.id;
          });
      },
      sendComment(comment) {
        void stream.write(`: ${comment}\n\n`);
      },
    };

    // 先挂入 Hub（避免续传与订阅之间的竞态漏事件；send 内有去重保护）
    hub.subscribe(conn, channels);

    // 补发断线期间漏掉的事件
    const missed = await replayMissed(db, channels, lastEventId);
    for (const envelope of missed) {
      if (conn.lastEventId && envelope.id <= conn.lastEventId) continue;
      await stream.writeSSE({
        data: JSON.stringify(envelope),
        event: envelope.type,
        id: envelope.id,
      });
      conn.lastEventId = envelope.id;
    }

    // 断开清理：退订 + 回写 push_subscriptions（断开时间 / 最后收到的事件 ID）
    stream.onAbort(() => {
      hub.unsubscribe(conn);
      db.update(schema.pushSubscriptions)
        .set({
          disconnectedAt: new Date(),
          lastEventId: conn.lastEventId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.pushSubscriptions.id, sub.id))
        .catch((err) => console.error('[realtime] 回写订阅断开状态失败:', err));
    });

    // 保持流打开直到客户端断开（心跳由 Hub 25s 定时器统一发注释行）
    while (!stream.aborted) {
      await stream.sleep(1000);
    }
  });
});
