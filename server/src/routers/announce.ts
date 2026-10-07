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
 *
 * 端口批收尾片 2（店铺公告/全局广播）：新建即带草稿·发布两步流
 * （saveDraft→publishDraft 同既有四域同族）+起止时间（startsAt/endsAt，NULL=不限；
 * 员工读口懒算过滤）+回收站软删（remove，白名单=运营件；恢复走 recycleBin.restore）；
 * publish 兼容旧直发（起止可空）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
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

/** 公告发布通知（publish/publishDraft 共用，同事务）：store 频道事件+定向员工逐人 notifications */
async function notifyAnnouncement(
  d: Parameters<typeof emitEvent>[0],
  storeId: string,
  announcementId: string,
  title: string,
  targetRole: 'all' | 'frontdesk' | 'groomer',
): Promise<string> {
  const outboxId = await emitEvent(d, `store:${storeId}`, EventType.AnnouncementPublished, {
    announcementId,
    title,
    targetRole,
  });
  const targets = await targetStaffOf(d, storeId, targetRole);
  for (const s of targets) {
    await d.insert(schema.notifications).values({
      userId: s.userId,
      type: 'announcement.published',
      category: 'service',
      title: '新公告',
      body: title,
      link: '/notices',
    });
  }
  return outboxId;
}

export const announceRouter = router({
  /** publish（店长）：发布即 published + store 频道事件 + 定向员工逐人通知（同事务）；
   * 片 2：起止可空（startsAt/endsAt ISO 串，NULL=不限；起止倒置 400） */
  publish: merchantManagerProcedure
    .input(
      z.object({
        title: z.string().trim().min(1, '请填写公告标题').max(100),
        body: z.string().trim().min(1, '请填写公告正文').max(5000),
        targetRole: z.enum(['all', 'frontdesk', 'groomer']),
        pinned: z.boolean().default(false),
        startsAt: z.string().max(64).optional(),
        endsAt: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      const startsAt = input.startsAt ? new Date(input.startsAt) : null;
      const endsAt = input.endsAt ? new Date(input.endsAt) : null;
      if ((startsAt && !Number.isFinite(startsAt.getTime())) || (endsAt && !Number.isFinite(endsAt.getTime()))) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '起止时刻格式非法（须 ISO 时刻串）' });
      }
      if (startsAt && endsAt && endsAt < startsAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '结束时间不可早于开始时间' });
      }
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
            startsAt,
            endsAt,
          })
          .returning()
          .then((r) => r[0]!);
        outboxId = await notifyAnnouncement(txh, storeId, inserted.id, input.title, input.targetRole);
        return inserted;
      });
      broadcastNow(outboxId);
      return { announcement: row };
    }),

  /**
   * saveDraft（片 2 · 两步流新建件，店长）：新建=草稿（status='draft'，员工不可见）；
   * 带 id=更新既有草稿（仅 draft 态可改；published/archived/回收站行 400）。
   */
  saveDraft: merchantManagerProcedure
    .input(
      z.object({
        id: z.string().min(1).optional(),
        title: z.string().trim().min(1, '请填写公告标题').max(100),
        body: z.string().trim().min(1, '请填写公告正文').max(5000),
        targetRole: z.enum(['all', 'frontdesk', 'groomer']),
        pinned: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      if (input.id) {
        const exist = await ctx.db.select().from(schema.announcements).where(eq(schema.announcements.id, input.id)).get();
        if (!exist || exist.storeId !== storeId) notFound('草稿不存在');
        if (exist.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: '仅草稿态可编辑' });
        if (exist.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: '公告在回收站，请先恢复' });
        const [row] = await ctx.db
          .update(schema.announcements)
          .set({ title: input.title, body: input.body, targetRole: input.targetRole, pinned: input.pinned, updatedAt: now })
          .where(eq(schema.announcements.id, exist.id))
          .returning();
        return { announcement: row, created: false as const };
      }
      const [row] = await ctx.db
        .insert(schema.announcements)
        .values({
          storeId,
          title: input.title,
          body: input.body,
          targetRole: input.targetRole,
          pinned: input.pinned,
          status: 'draft',
          publishedBy: ctx.user.id,
          publishedAt: now,
        })
        .returning();
      return { announcement: row, created: true as const };
    }),

  /**
   * publishDraft（片 2 · 两步流发布步，店长）：草稿→published（publishedAt=发布时刻+
   * 起止写入；起止倒置 400）+store 频道事件+定向逐人通知（与 publish 同工艺）。
   */
  publishDraft: merchantManagerProcedure
    .input(
      z.object({
        id: z.string().min(1),
        startsAt: z.string().max(64).optional(),
        endsAt: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      const startsAt = input.startsAt ? new Date(input.startsAt) : null;
      const endsAt = input.endsAt ? new Date(input.endsAt) : null;
      if ((startsAt && !Number.isFinite(startsAt.getTime())) || (endsAt && !Number.isFinite(endsAt.getTime()))) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '起止时刻格式非法（须 ISO 时刻串）' });
      }
      if (startsAt && endsAt && endsAt < startsAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '结束时间不可早于开始时间' });
      }
      const exist = await ctx.db.select().from(schema.announcements).where(eq(schema.announcements.id, input.id)).get();
      if (!exist || exist.storeId !== storeId) notFound('草稿不存在');
      if (exist.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: '仅草稿可发布（两步流：新建草稿→发布）' });
      if (exist.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: '公告在回收站，请先恢复' });
      let outboxId = '';
      const row = await ctx.db.transaction(async (tx) => {
        const txh = tx as unknown as Parameters<typeof emitEvent>[0];
        const [updated] = await tx
          .update(schema.announcements)
          .set({ status: 'published', publishedAt: now, startsAt, endsAt, updatedAt: now })
          .where(eq(schema.announcements.id, exist.id))
          .returning();
        outboxId = await notifyAnnouncement(txh, storeId, exist.id, updated!.title, updated!.targetRole as 'all' | 'frontdesk' | 'groomer');
        return updated!;
      });
      broadcastNow(outboxId);
      return { announcement: row };
    }),

  /** remove（片 2 · 回收站软删，店长）：白名单=运营件——公告软删置 deleted_at/deleted_by
   * （读侧 list 默认过滤；恢复走 recycleBin.restore 统一口）；重复删除=400 */
  remove: merchantManagerProcedure
    .input(z.object({ announcementId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const row = await ctx.db.select().from(schema.announcements).where(eq(schema.announcements.id, input.announcementId)).get();
      if (!row || row.storeId !== storeId) notFound('公告不存在');
      if (row.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: '公告已在回收站' });
      await ctx.db
        .update(schema.announcements)
        .set({ deletedAt: new Date(), deletedBy: ctx.user.id, updatedAt: new Date() })
        .where(eq(schema.announcements.id, row.id));
      return { announcementId: row.id, deleted: true };
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
        .where(and(eq(schema.announcements.storeId, user.storeId!), isNull(schema.announcements.deletedAt)))
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
      .where(
        and(
          eq(schema.announcements.storeId, user.storeId),
          eq(schema.announcements.status, 'published'),
          isNull(schema.announcements.deletedAt),
        ),
      )
      .orderBy(desc(schema.announcements.pinned), desc(schema.announcements.publishedAt))
      .limit(100);
    /* 片 2 起止懒算过滤：startsAt≤now≤endsAt 才可见（NULL=不限） */
    const nowList = new Date();
    const visible = rows.filter(
      (r) =>
        (r.targetRole === 'all' || r.targetRole === me?.role) &&
        (r.startsAt === null || r.startsAt <= nowList) &&
        (r.endsAt === null || r.endsAt >= nowList),
    );
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
