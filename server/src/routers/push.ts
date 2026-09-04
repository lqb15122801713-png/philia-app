/**
 * push tRPC router —— 推送订阅登记与站内通知（T1.4）
 *
 * - push.subscribe        登记/重连 push_subscriptions（user_id + client_id 幂等 upsert，
 *                         置 connected_at、清 disconnected_at）
 * - push.unsubscribe      断开：置 disconnected_at（仅本人记录，幂等）
 * - push.listNotifications 站内通知分页（id 游标降序，ULID 字典序≈时间序）
 * - push.markRead         批量已读（仅本人通知）
 *
 * SSE 端点（GET /api/events，见 src/routes/events.ts）会校验 client_id 归属：
 * 客户端须先调 push.subscribe 登记，再建立 SSE 连接。
 */

import { and, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { publicProcedure, router } from '../trpc';

const AppType = z.enum(['customer', 'merchant', 'staff']);

export const pushRouter = router({
  /** 登记推送订阅（SSE 连接前的必经步骤；同 user+client 重复调用为重连刷新） */
  subscribe: publicProcedure
    .input(z.object({ clientId: z.string().min(1).max(128), appType: AppType }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: schema.pushSubscriptions.id })
        .from(schema.pushSubscriptions)
        .where(
          and(
            eq(schema.pushSubscriptions.userId, ctx.user.id),
            eq(schema.pushSubscriptions.clientId, input.clientId),
          ),
        )
        .get();

      const now = new Date();
      if (existing) {
        await ctx.db
          .update(schema.pushSubscriptions)
          .set({
            appType: input.appType,
            connectedAt: now,
            disconnectedAt: null,
            updatedAt: now,
          })
          .where(eq(schema.pushSubscriptions.id, existing.id));
        return { subscriptionId: existing.id, reconnected: true };
      }

      const inserted = await ctx.db
        .insert(schema.pushSubscriptions)
        .values({
          userId: ctx.user.id,
          clientId: input.clientId,
          appType: input.appType,
          connectedAt: now,
        })
        .returning({ id: schema.pushSubscriptions.id });
      return { subscriptionId: inserted[0]!.id, reconnected: false };
    }),

  /** 断开订阅（仅本人记录；幂等，重复断开不报错） */
  unsubscribe: publicProcedure
    .input(z.object({ clientId: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const updated = await ctx.db
        .update(schema.pushSubscriptions)
        .set({ disconnectedAt: now, updatedAt: now })
        .where(
          and(
            eq(schema.pushSubscriptions.userId, ctx.user.id),
            eq(schema.pushSubscriptions.clientId, input.clientId),
            isNull(schema.pushSubscriptions.disconnectedAt),
          ),
        )
        .returning({ id: schema.pushSubscriptions.id });
      return { disconnected: updated.length > 0 };
    }),

  /** 站内通知分页：id 游标降序（最新在前），支持仅看未读 */
  listNotifications: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        unreadOnly: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.notifications.userId, ctx.user.id)];
      if (input.unreadOnly) conds.push(isNull(schema.notifications.readAt));
      if (input.cursor) conds.push(lt(schema.notifications.id, input.cursor));

      const rows = await ctx.db
        .select()
        .from(schema.notifications)
        .where(and(...conds))
        .orderBy(desc(schema.notifications.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items: items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          readAt: n.readAt,
          createdAt: n.createdAt,
        })),
        nextCursor: hasMore ? items[items.length - 1]!.id : null,
      };
    }),

  /** 批量标记已读（仅本人且未读的通知；返回实际已读条数） */
  markRead: publicProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const updated = await ctx.db
        .update(schema.notifications)
        .set({ readAt: now, updatedAt: now })
        .where(
          and(
            eq(schema.notifications.userId, ctx.user.id),
            inArray(schema.notifications.id, input.ids),
            isNull(schema.notifications.readAt),
          ),
        )
        .returning({ id: schema.notifications.id });
      return { marked: updated.length };
    }),
});

export type PushRouter = typeof pushRouter;
