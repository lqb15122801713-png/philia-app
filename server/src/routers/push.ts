/**
 * push tRPC router —— 推送订阅登记与站内通知（T1.4；补缺大批片 5 站内信分类扩展）
 *
 * - push.subscribe        登记/重连 push_subscriptions（user_id + client_id 幂等 upsert，
 *                         置 connected_at、清 disconnected_at）
 * - push.unsubscribe      断开：置 disconnected_at（仅本人记录，幂等）
 * - push.listNotifications 站内通知分页（id 游标降序，ULID 字典序≈时间序；
 *                         片 5 增 category 过滤入参，返回行带 category）
 * - push.markRead         批量已读（仅本人通知）
 * - push.unreadCount      未读数（total + byCategory 分类分列）
 * - push.markAllRead      全部已读（可按 category 过滤；幂等，返回实际已读条数）
 * - push.deleteNotification 删除通知（仅本人：他人 → 403 FORBIDDEN）
 * - push.notifyPrefs      本人四类订阅开关状态（缺省全 1，user_notify_prefs 无行即订阅）
 * - push.setNotifyPref    订阅开关写入（硬口径：仅 marketing 可置 0，
 *                         trade/service/account 置 0 硬拒「交易/服务/账户通知为保障服务履约不可关闭」）
 *
 * SSE 端点（GET /api/events，见 src/routes/events.ts）会校验 client_id 归属：
 * 客户端须先调 push.subscribe 登记，再建立 SSE 连接。
 */

import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { publicProcedure, router } from '../trpc';

const AppType = z.enum(['customer', 'merchant', 'staff']);

/** 通知分类（与 bus.ts categoryOf / 迁移 0017 回填口径同帧） */
const NotifyCategory = z.enum(['trade', 'service', 'account', 'marketing']);

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

  /** 站内通知分页：id 游标降序（最新在前），支持仅看未读 + 按分类过滤 */
  listNotifications: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        unreadOnly: z.boolean().default(false),
        category: NotifyCategory.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.notifications.userId, ctx.user.id)];
      if (input.unreadOnly) conds.push(isNull(schema.notifications.readAt));
      if (input.cursor) conds.push(lt(schema.notifications.id, input.cursor));
      if (input.category) conds.push(eq(schema.notifications.category, input.category));

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
          category: n.category,
          title: n.title,
          body: n.body,
          link: n.link,
          readAt: n.readAt,
          createdAt: n.createdAt,
        })),
        nextCursor: hasMore ? items[items.length - 1]!.id : null,
      };
    }),

  /** 未读数：total + byCategory 分类分列（仅本人未读） */
  unreadCount: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ category: schema.notifications.category, n: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, ctx.user.id), isNull(schema.notifications.readAt)))
      .groupBy(schema.notifications.category);
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byCategory[r.category] = r.n;
      total += r.n;
    }
    return { total, byCategory };
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

  /** 全部已读（仅本人；可按 category 过滤；幂等——重复调用零副作用，返回实际已读条数） */
  markAllRead: publicProcedure
    .input(z.object({ category: NotifyCategory.optional() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const conds = [
        eq(schema.notifications.userId, ctx.user.id),
        isNull(schema.notifications.readAt),
      ];
      if (input.category) conds.push(eq(schema.notifications.category, input.category));
      const updated = await ctx.db
        .update(schema.notifications)
        .set({ readAt: now, updatedAt: now })
        .where(and(...conds))
        .returning({ id: schema.notifications.id });
      return { marked: updated.length };
    }),

  /** 删除通知（仅本人：他人 → 403 FORBIDDEN；不存在 → 404 NOT_FOUND） */
  deleteNotification: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db
        .select({ id: schema.notifications.id, userId: schema.notifications.userId })
        .from(schema.notifications)
        .where(eq(schema.notifications.id, input.id))
        .get();
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '通知不存在' });
      }
      if (row.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '无权删除他人通知' });
      }
      await ctx.db.delete(schema.notifications).where(eq(schema.notifications.id, input.id));
      return { deleted: true };
    }),

  /** 本人四类订阅开关状态（user_notify_prefs 无行 = 默认全订阅 enabled=true） */
  notifyPrefs: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ category: schema.userNotifyPrefs.category, enabled: schema.userNotifyPrefs.enabled })
      .from(schema.userNotifyPrefs)
      .where(eq(schema.userNotifyPrefs.userId, ctx.user.id));
    const map = new Map(rows.map((r) => [r.category, r.enabled]));
    return {
      prefs: NotifyCategory.options.map((category) => ({
        category,
        enabled: map.get(category) ?? true,
        /** 硬口径：仅 marketing 可关；trade/service/account 恒订阅（写 0 由 setNotifyPref 硬拒） */
        mutable: category === 'marketing',
      })),
    };
  }),

  /**
   * 订阅开关写入（幂等 upsert）：
   * - category='marketing' 可写 0（退订）/ 1（恢复订阅）；
   * - trade/service/account 写 enabled=false 硬拒「交易/服务/账户通知为保障服务履约不可关闭」，
   *   写 enabled=true 放行（恢复幂等）。
   */
  setNotifyPref: publicProcedure
    .input(z.object({ category: NotifyCategory, enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!input.enabled && input.category !== 'marketing') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '交易/服务/账户通知为保障服务履约不可关闭',
        });
      }
      const now = new Date();
      const existing = await ctx.db
        .select({ id: schema.userNotifyPrefs.id })
        .from(schema.userNotifyPrefs)
        .where(
          and(
            eq(schema.userNotifyPrefs.userId, ctx.user.id),
            eq(schema.userNotifyPrefs.category, input.category),
          ),
        )
        .get();
      if (existing) {
        await ctx.db
          .update(schema.userNotifyPrefs)
          .set({ enabled: input.enabled, updatedAt: now })
          .where(eq(schema.userNotifyPrefs.id, existing.id));
      } else {
        await ctx.db.insert(schema.userNotifyPrefs).values({
          userId: ctx.user.id,
          category: input.category,
          enabled: input.enabled,
        });
      }
      return { category: input.category, enabled: input.enabled };
    }),
});

export type PushRouter = typeof pushRouter;
