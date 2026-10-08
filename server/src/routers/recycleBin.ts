/**
 * 回收站 router（端口批收尾片 2 · 数据 3 之回收站软删除 · 任务书冻结版 V1.0 §一+开口项 3 裁）
 *
 * 冻结口径：
 * - 白名单=运营件三域：product（商品）/ promo（活动）/ announce（公告）——其余 domain 一律
 *   BAD_REQUEST（账务/支付/账单类永不进回收站=硬删禁令照旧，无 purge 硬删口）；
 * - 软删=各域 deleted_at/deleted_by 置位（delete 口在各域 router：mall.deleteProduct /
 *   marketing.promoDelete / announce.remove），读侧 list 默认过滤（回收站行只在 recycleBin.list 可见）；
 * - 恢复=统一口 recycleBin.restore（清 deleted_at/deleted_by，置位帧已留痕操作人）。
 */
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { merchantOwnerProcedure, router } from '../trpc';

const RECYCLE_DOMAINS = ['product', 'promo', 'announce'] as const;

export const recycleBinRouter = router({
  /** list（owner）：三域回收站行联查（删除人昵称 join），按删除新→旧 */
  list: merchantOwnerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const products = await ctx.db
      .select({
        id: schema.products.id,
        title: schema.products.name,
        subtitle: schema.products.category,
        deletedAt: schema.products.deletedAt,
        deletedByNickname: schema.users.nickname,
      })
      .from(schema.products)
      .leftJoin(schema.users, eq(schema.users.id, schema.products.deletedBy))
      .where(and(eq(schema.products.storeId, storeId), isNotNull(schema.products.deletedAt)))
      .orderBy(desc(schema.products.deletedAt))
      .limit(100);
    const promos = await ctx.db
      .select({
        id: schema.promoCampaigns.id,
        title: schema.promoCampaigns.name,
        subtitle: schema.promoCampaigns.type,
        deletedAt: schema.promoCampaigns.deletedAt,
        deletedByNickname: schema.users.nickname,
      })
      .from(schema.promoCampaigns)
      .leftJoin(schema.users, eq(schema.users.id, schema.promoCampaigns.deletedBy))
      .where(and(eq(schema.promoCampaigns.storeId, storeId), isNotNull(schema.promoCampaigns.deletedAt)))
      .orderBy(desc(schema.promoCampaigns.deletedAt))
      .limit(100);
    const announces = await ctx.db
      .select({
        id: schema.announcements.id,
        title: schema.announcements.title,
        subtitle: schema.announcements.targetRole,
        deletedAt: schema.announcements.deletedAt,
        deletedByNickname: schema.users.nickname,
      })
      .from(schema.announcements)
      .leftJoin(schema.users, eq(schema.users.id, schema.announcements.deletedBy))
      .where(and(eq(schema.announcements.storeId, storeId), isNotNull(schema.announcements.deletedAt)))
      .orderBy(desc(schema.announcements.deletedAt))
      .limit(100);
    const items = [
      ...products.map((r) => ({ domain: 'product' as const, ...r })),
      ...promos.map((r) => ({ domain: 'promo' as const, ...r })),
      ...announces.map((r) => ({ domain: 'announce' as const, ...r })),
    ].sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0));
    return { items };
  }),

  /** restore（owner）：清 deleted_at/deleted_by；白名单外 domain 硬拒（账务类永不进） */
  restore: merchantOwnerProcedure
    .input(z.object({ domain: z.enum(RECYCLE_DOMAINS), id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      if (input.domain === 'product') {
        const row = (await ctx.db.select().from(schema.products).where(eq(schema.products.id, input.id)).limit(1))[0];
        if (!row || row.storeId !== storeId || row.deletedAt === null) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '回收站行不存在' });
        }
        await ctx.db
          .update(schema.products)
          .set({ deletedAt: null, deletedBy: null, updatedAt: now })
          .where(eq(schema.products.id, input.id));
      } else if (input.domain === 'promo') {
        const row = (await ctx.db.select().from(schema.promoCampaigns).where(eq(schema.promoCampaigns.id, input.id)).limit(1))[0];
        if (!row || row.storeId !== storeId || row.deletedAt === null) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '回收站行不存在' });
        }
        await ctx.db
          .update(schema.promoCampaigns)
          .set({ deletedAt: null, deletedBy: null, updatedAt: now })
          .where(eq(schema.promoCampaigns.id, input.id));
      } else {
        const row = (await ctx.db.select().from(schema.announcements).where(eq(schema.announcements.id, input.id)).limit(1))[0];
        if (!row || row.storeId !== storeId || row.deletedAt === null) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '回收站行不存在' });
        }
        await ctx.db
          .update(schema.announcements)
          .set({ deletedAt: null, deletedBy: null, updatedAt: now })
          .where(eq(schema.announcements.id, input.id));
      }
      return { domain: input.domain, id: input.id, restored: true };
    }),
});
