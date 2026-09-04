/**
 * pet router（tRPC）—— 宠物档案
 *
 * - pet.list：customer 本人宠物列表。
 * - pet.upsert：customer 新增/编辑档案（zod 校验物种/体重/疫苗有效期等；
 *   编辑仅限本人宠物，否则 FORBIDDEN）。
 * - pet.get：customer 本人可读；staff 需该宠物存在指派给本人的预约、
 *   merchant 需该宠物存在本店预约，否则 FORBIDDEN（开发方案 §6.2）。
 */

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { customerProcedure, publicProcedure, router } from '../trpc';

/** ISO 纯日期 'YYYY-MM-DD'（schema 约定 date 列为 text ISO） */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD');

const petUpsertInput = z.object({
  /** 传 id 即编辑（限本人宠物），否则新增 */
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, '宠物名不能为空').max(32),
  species: z.enum(['dog', 'cat', 'other'], { message: '物种仅支持 dog/cat/other' }),
  breed: z.string().trim().max(64).optional(),
  birthday: isoDate.optional(),
  weightKg: z.number().positive('体重须大于 0').max(500, '体重超出合理范围').optional(),
  vaccineValidUntil: isoDate.optional(),
  neutered: z.boolean().optional(),
  temperamentTags: z.array(z.string().trim().min(1).max(16)).max(12).optional(),
  avatarUrl: z.string().max(255).optional(),
});

export const petRouter = router({
  /** 我的宠物列表（customer） */
  list: customerProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.pets)
      .where(eq(schema.pets.ownerId, ctx.user.id))
      .orderBy(schema.pets.createdAt);
  }),

  /** 新增/编辑宠物档案（customer，编辑限本人） */
  upsert: customerProcedure.input(petUpsertInput).mutation(async ({ ctx, input }) => {
    const { id, ...fields } = input;
    const now = new Date();

    if (id) {
      const existing = await ctx.db
        .select()
        .from(schema.pets)
        .where(eq(schema.pets.id, id))
        .limit(1)
        .then((r) => r[0]);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '宠物档案不存在' });
      }
      if (existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只能编辑本人的宠物档案' });
      }
      const [updated] = await ctx.db
        .update(schema.pets)
        .set({ ...fields, updatedAt: now })
        .where(eq(schema.pets.id, id))
        .returning();
      return { pet: updated, created: false as const };
    }

    const [created] = await ctx.db
      .insert(schema.pets)
      .values({ ...fields, ownerId: ctx.user.id })
      .returning();
    return { pet: created, created: true as const };
  }),

  /**
   * 宠物详情：
   * - customer：仅本人宠物
   * - staff：该宠物存在指派给本人的预约
   * - merchant（owner/manager）：该宠物存在本店预约
   */
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const pet = await ctx.db
        .select()
        .from(schema.pets)
        .where(eq(schema.pets.id, input.id))
        .limit(1)
        .then((r) => r[0]);
      if (!pet) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '宠物档案不存在' });
      }

      const user = ctx.user;
      // customer 本人
      if (user.roles.includes('customer') && pet.ownerId === user.id) {
        return { pet };
      }
      // staff：存在指派给本人的关联预约
      if (user.staffId) {
        const related = await ctx.db
          .select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(
            and(
              eq(schema.appointments.petId, pet.id),
              eq(schema.appointments.staffId, user.staffId),
            ),
          )
          .limit(1)
          .then((r) => r[0]);
        if (related) return { pet };
      }
      // merchant：存在本店关联预约
      const isMerchant =
        user.roles.includes('merchant_owner') || user.roles.includes('merchant_manager');
      if (isMerchant && user.storeId) {
        const related = await ctx.db
          .select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(
            and(
              eq(schema.appointments.petId, pet.id),
              eq(schema.appointments.storeId, user.storeId),
            ),
          )
          .limit(1)
          .then((r) => r[0]);
        if (related) return { pet };
      }
      throw new TRPCError({ code: 'FORBIDDEN', message: '无权查看该宠物档案' });
    }),
});
