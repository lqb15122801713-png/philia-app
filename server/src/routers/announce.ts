/**
 * announce tRPC router（员工端骨架整建批 片 3 B6-1 · 公告+已读回执）：
 *
 * - publish（店长）：落 announcements（status=published）+ emitEvent
 *   announcement.published 到 store 频道（商家侧 SSE）+ 对定向范围内本店在职
 *   staff 逐人 notifications 落行（同事务；type='announcement.published'，
 *   link='/notices'）——store 频道解析只覆盖商家角色，员工通知须手动补写。
 * - list：双形态合一（owner 无 staff 行走不过 staffProcedure，故用 publicProcedure
 *   内部双闸）——staff 视角=本店 published 且（targetRole=all 或=我的岗位角色），
 *   附我的 readAt，pinned 置顶；manager/owner 视角=全量含 archived + readCount。
 * - markRead（员工）：(announcement_id,user_id) 唯一锚幂等；只能标本店可见公告。
 * - reads（店长）：已读回执对账——范围=定向内本店在职员工，read/unread 双名单。
 * - archive（店长）：撤下不删行。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { merchantManagerProcedure, publicProcedure, router, staffProcedure } from '../trpc';

function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}
function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

/** 公告定向范围 → 本店在职员工集（targetRole=all=全员，否则按岗位角色收窄） */
async function targetStaffOf(
  d: Parameters<typeof emitEvent>[0],
  storeId: string,
  targetRole: 'all' | 'frontdesk' | 'groomer',
): Promise<Array<{ id: string; userId: string; name: string }>> {
  const conds = [eq(schema.staff.storeId, storeId), eq(schema.staff.status, 'active')];
  if (targetRole !== 'all') conds.push(eq(schema.staff.role, targetRole));
  return d
    .select({ id: schema.staff.id, userId: schema.staff.userId, name: schema.staff.name })
    .from(schema.staff)
    .where(and(...conds));
}

export const announceRouter = router({
  /** publish（店长）：发布即 published + store 频道事件 + 定向员工逐人通知（同事务） */
  publish: merchantManagerProcedure
    .input(
      z.object({
        title: z.string().trim().min(1, '请填写公告标题').max(100),
        body: z.string().trim().min(1, '请填写公告正文').max(5000),
        targetRole: z.enum(['all', 'frontdesk', 'groomer']),
        pinned: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      let outboxId = '';
      const row = await ctx.db.transaction(async (tx) => {
        const txh = tx as unknown as Parameters<typeof emitEvent>[0];
        const inserted = await tx
          .insert(schema.announcements)
          .values({
            storeId,
            title: input.title,
            body: input.body,
            targetRole: input.targetRole,
            pinned: input.pinned,
            status: 'published',
            publishedBy: ctx.user.id,
            publishedAt: now,
          })
          .returning()
          .then((r) => r[0]!);
        // store 频道事件=商家侧 SSE；员工定向通知=逐人 notifications（频道解析覆盖不到纯 staff）
        outboxId = await emitEvent(txh, `store:${storeId}`, EventType.AnnouncementPublished, {
          announcementId: inserted.id,
          title: input.title,
          targetRole: input.targetRole,
        });
        const targets = await targetStaffOf(txh, storeId, input.targetRole);
        for (const s of targets) {
          await tx.insert(schema.notifications).values({
            userId: s.userId,
            type: 'announcement.published',
            category: 'service',
            title: '新公告',
            body: input.title,
            link: '/notices',
          });
        }
        return inserted;
      });
      broadcastNow(outboxId);
      return { announcement: row };
    }),

  /**
   * list：staff 视角=本店 published 且定向命中（all 或我的岗位角色）+ 我的 readAt
   * + pinned 置顶；manager/owner 视角=全量含 archived + readCount 对账数。
   * 用 publicProcedure 内部双闸：owner 无 staff 行（走不过 staffProcedure），
   * 普通客户（无 staffId 无商家角色）一律 FORBIDDEN。
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.user!;
    const managerView =
      (user.roles.includes('merchant_owner') || user.roles.includes('merchant_manager')) &&
      !!user.storeId;
    if (managerView) {
      const rows = await ctx.db
        .select()
        .from(schema.announcements)
        .where(eq(schema.announcements.storeId, user.storeId!))
        .orderBy(desc(schema.announcements.pinned), desc(schema.announcements.publishedAt))
        .limit(100);
      const counts = await ctx.db
        .select({ announcementId: schema.announcementReads.announcementId, n: sql<number>`count(*)` })
        .from(schema.announcementReads)
        .where(inArray(schema.announcementReads.announcementId, rows.map((r) => r.id)))
        .groupBy(schema.announcementReads.announcementId);
      const countMap = new Map(counts.map((c) => [c.announcementId, Number(c.n)]));
      return {
        view: 'manager' as const,
        announcements: rows.map((r) => ({ ...r, readCount: countMap.get(r.id) ?? 0 })),
      };
    }
    if (!user.staffId || !user.storeId) forbidden('需要员工身份查看公告');
    const me = await ctx.db
      .select({ role: schema.staff.role })
      .from(schema.staff)
      .where(eq(schema.staff.id, user.staffId))
      .get();
    const rows = await ctx.db
      .select()
      .from(schema.announcements)
      .where(and(eq(schema.announcements.storeId, user.storeId), eq(schema.announcements.status, 'published')))
      .orderBy(desc(schema.announcements.pinned), desc(schema.announcements.publishedAt))
      .limit(100);
    const visible = rows.filter((r) => r.targetRole === 'all' || r.targetRole === me?.role);
    const myReads = await ctx.db
      .select()
      .from(schema.announcementReads)
      .where(
        and(
          inArray(schema.announcementReads.announcementId, visible.map((r) => r.id)),
          eq(schema.announcementReads.userId, user.id),
        ),
      );
    const readMap = new Map(myReads.map((r) => [r.announcementId, r.readAt]));
    return {
      view: 'staff' as const,
      announcements: visible.map((r) => ({ ...r, readAt: readMap.get(r.id) ?? null })),
    };
  }),

  /** markRead（员工）：(announcement_id,user_id) 幂等锚；只能标本店可见公告 */
  markRead: staffProcedure
    .input(z.object({ announcementId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const ann = await ctx.db
        .select()
        .from(schema.announcements)
        .where(eq(schema.announcements.id, input.announcementId))
        .get();
      if (!ann || ann.storeId !== ctx.user.storeId || ann.status !== 'published') {
        notFound('公告不存在或已撤下');
      }
      const me = await ctx.db
        .select({ role: schema.staff.role })
        .from(schema.staff)
        .where(eq(schema.staff.id, ctx.user.staffId!))
        .get();
      if (ann.targetRole !== 'all' && ann.targetRole !== me?.role) {
        forbidden('该公告未定向到你的岗位');
      }
      const now = new Date();
      await ctx.db
        .insert(schema.announcementReads)
        .values({ announcementId: ann.id, userId: ctx.user.id, readAt: now, createdAt: now })
        .onConflictDoNothing({ target: [schema.announcementReads.announcementId, schema.announcementReads.userId] });
      return { read: true as const };
    }),

  /** reads（店长）：已读回执对账——范围=定向内本店在职员工，read/unread 双名单 */
  reads: merchantManagerProcedure
    .input(z.object({ announcementId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const ann = await ctx.db
        .select()
        .from(schema.announcements)
        .where(eq(schema.announcements.id, input.announcementId))
        .get();
      if (!ann || ann.storeId !== ctx.user.storeId) notFound('公告不存在');
      const targets = await targetStaffOf(ctx.db, ann.storeId, ann.targetRole as 'all' | 'frontdesk' | 'groomer');
      const reads = await ctx.db
        .select()
        .from(schema.announcementReads)
        .where(
          and(
            eq(schema.announcementReads.announcementId, ann.id),
            inArray(schema.announcementReads.userId, targets.map((t) => t.userId)),
          ),
        );
      const readMap = new Map(reads.map((r) => [r.userId, r.readAt]));
      const read: Array<{ staffId: string; name: string; readAt: Date }> = [];
      const unread: Array<{ staffId: string; name: string }> = [];
      for (const t of targets) {
        const at = readMap.get(t.userId);
        if (at) read.push({ staffId: t.id, name: t.name, readAt: at });
        else unread.push({ staffId: t.id, name: t.name });
      }
      return { read, unread };
    }),

  /** archive（店长）：撤下不删行（历史留痕）；重复撤下幂等 */
  archive: merchantManagerProcedure
    .input(z.object({ announcementId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const ann = await ctx.db
        .select()
        .from(schema.announcements)
        .where(eq(schema.announcements.id, input.announcementId))
        .get();
      if (!ann || ann.storeId !== ctx.user.storeId) notFound('公告不存在');
      if (ann.status === 'archived') return { announcement: ann, idempotent: true as const };
      const updated = await ctx.db
        .update(schema.announcements)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(schema.announcements.id, ann.id))
        .returning()
        .then((r) => r[0]!);
      return { announcement: updated, idempotent: false as const };
    }),
});
