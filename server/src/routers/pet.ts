/**
 * pet router（tRPC）—— 宠物档案
 *
 * - pet.list：customer 本人宠物列表。
 * - pet.upsert：customer 新增/编辑档案（zod 校验物种/体重/疫苗有效期等；
 *   编辑仅限本人宠物，否则 FORBIDDEN）。体验批片 4：扩 chipNo/coatColor 字段。
 * - pet.get：customer 本人可读；staff 需该宠物存在指派给本人的预约、
 *   merchant 需该宠物存在本店预约，否则 FORBIDDEN（开发方案 §6.2）。
 * - pet.setActive：多宠物全局切换（体验批片 4 · users.active_pet_id 写口）——
 *   传 petId 须为本人宠物（否则 FORBIDDEN），传 null 清除选定；auth.me 的
 *   user.activePetId 随列透出，客户端切换器据此全局生效。
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
  /** 片 2：疫苗证明图片 URL 数组（先经 /api/upload relDir=vaccine/<petId> 上传；
   *  仅留证不改寄养硬闸——寄养下单校验口径不变，行为变更报备在案） */
  vaccineProofUrls: z.array(z.string().max(512)).max(10, '疫苗证明最多 10 张').optional(),
  /** 芯片号（体验批片 4；可空，留文本不硬校验位数） */
  chipNo: z.string().trim().max(64).optional(),
  /** 花色（体验批片 4；可空） */
  coatColor: z.string().trim().max(32).optional(),
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

  /**
   * 多宠物全局切换（体验批片 4）：users.active_pet_id 写口。
   * petId=null 清除选定；非本人宠物 FORBIDDEN；已随注销软删的宠物不可选定。
   * 幂等：重复设同值零副作用（updated_at 照常刷新属既有口径，不产生业务行）。
   */
  setActive: customerProcedure
    .input(z.object({ petId: z.string().min(1).nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (input.petId !== null) {
        const pet = await ctx.db
          .select({ id: schema.pets.id, ownerId: schema.pets.ownerId, deletedAt: schema.pets.deletedAt })
          .from(schema.pets)
          .where(eq(schema.pets.id, input.petId))
          .get();
        if (!pet) throw new TRPCError({ code: 'NOT_FOUND', message: '宠物档案不存在' });
        if (pet.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能切换本人名下的宠物' });
        }
        if (pet.deletedAt) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该宠物档案已删除，不可选定' });
        }
      }
      await ctx.db
        .update(schema.users)
        .set({ activePetId: input.petId, updatedAt: new Date() })
        .where(eq(schema.users.id, ctx.user.id));
      return { activePetId: input.petId };
    }),
});
