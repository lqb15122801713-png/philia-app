/**
 * petHealth router（tRPC）—— 客户端体验大批片 4 · 宠物健康记录族 + 体重记录
 *
 * - healthList / healthAdd / healthRemove：疫苗/驱虫/用药/就医四类记录型档案
 *   （盘点表 D9：既有仅 pets.vaccine_valid_until 单字段，无记录实体——本片起建）。
 *   next_due_date=到期提醒扫描锚（services/careReminders.ts sweepPetDueReminders）。
 * - weightAdd / weightList：体重时序记录（盘点表第 63 行备查件照收）——
 *   add 同事务在「最新称重日」口径下回写 pets.weight_kg 快照（快照=当前值不混账，
 *   时序真值=pet_weight_logs）。
 * - overview：健康页一次拉取（档案 + 记录 + 体重序列），趋势图=客户端 SVG 手绘
 *   （零新依赖铁律，任务书开口项 2 裁）。
 *
 * 权限：全部 customerProcedure + 本人宠物硬闸（他人 403 / 不存在 404）；
 * 员工/商家侧代录与查看=留口另批（created_via 字段已预留 'staff' 语义）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { customerProcedure, router } from '../trpc';

/** ISO 纯日期 'YYYY-MM-DD'（schema 约定 date 列为 text ISO） */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD');

/** 记录类型枚举（与 schema 注记同帧） */
const recordType = z.enum(['vaccine', 'deworm', 'medication', 'vet_visit'], {
  message: '记录类型仅支持 vaccine/deworm/medication/vet_visit',
});

/** 本人宠物闸：不存在 404，非本人 403，软删 400。返回宠物行。 */
async function assertOwnPet(ctx: { db: typeof import('../db').db; user: { id: string } }, petId: string) {
  const pet = await ctx.db
    .select()
    .from(schema.pets)
    .where(eq(schema.pets.id, petId))
    .limit(1)
    .then((r) => r[0]);
  if (!pet) throw new TRPCError({ code: 'NOT_FOUND', message: '宠物档案不存在' });
  if (pet.ownerId !== ctx.user.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '只能操作本人名下的宠物档案' });
  }
  if (pet.deletedAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '该宠物档案已删除' });
  }
  return pet;
}

export const petHealthRouter = router({
  /** 健康记录列表（本人宠物；可按类型过滤；recordDate 降序，同日期按创建降序） */
  healthList: customerProcedure
    .input(z.object({ petId: z.string().min(1), type: recordType.optional() }))
    .query(async ({ ctx, input }) => {
      await assertOwnPet(ctx, input.petId);
      const conds = [eq(schema.petHealthRecords.petId, input.petId)];
      if (input.type) conds.push(eq(schema.petHealthRecords.type, input.type));
      const rows = await ctx.db
        .select()
        .from(schema.petHealthRecords)
        .where(and(...conds))
        .orderBy(desc(schema.petHealthRecords.recordDate), desc(schema.petHealthRecords.createdAt))
        .limit(200);
      return { records: rows };
    }),

  /**
   * 新增健康记录（本人宠物）。vaccine/deworm 可带 next_due_date（到期提醒扫描锚）；
   * recordDate 不许晚于今天（回填历史可以，造未来记录不行——next_due_date 才管将来）。
   */
  healthAdd: customerProcedure
    .input(
      z.object({
        petId: z.string().min(1),
        type: recordType,
        title: z.string().trim().min(1, '标题不能为空').max(64),
        recordDate: isoDate,
        nextDueDate: isoDate.optional(),
        note: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnPet(ctx, input.petId);
      const today = new Date().toISOString().slice(0, 10);
      if (input.recordDate > today) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '发生日期不能晚于今天（未来日期请填到下次到期日）' });
      }
      if (input.nextDueDate && input.nextDueDate <= input.recordDate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '下次到期日须晚于发生日期' });
      }
      const [record] = await ctx.db
        .insert(schema.petHealthRecords)
        .values({
          petId: input.petId,
          type: input.type,
          title: input.title,
          recordDate: input.recordDate,
          nextDueDate: input.nextDueDate ?? null,
          note: input.note ?? null,
          createdBy: ctx.user.id,
          createdVia: 'customer',
        })
        .returning();
      return { record };
    }),

  /** 删除健康记录（本人宠物本人建档行；硬删=自管数据，无账务留痕义务） */
  healthRemove: customerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db
        .select({ record: schema.petHealthRecords, petOwnerId: schema.pets.ownerId })
        .from(schema.petHealthRecords)
        .innerJoin(schema.pets, eq(schema.petHealthRecords.petId, schema.pets.id))
        .where(eq(schema.petHealthRecords.id, input.id))
        .get();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '记录不存在' });
      if (row.petOwnerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只能删除本人名下宠物的记录' });
      }
      await ctx.db.delete(schema.petHealthRecords).where(eq(schema.petHealthRecords.id, input.id));
      return { deleted: true as const };
    }),

  /**
   * 新增体重记录（本人宠物）：插时序行 + 若本次称重日为最新则同事务回写
   * pets.weight_kg 快照（历史补录不覆盖更新快照）。
   */
  weightAdd: customerProcedure
    .input(
      z.object({
        petId: z.string().min(1),
        weightKg: z.number().positive('体重须大于 0').max(500, '体重超出合理范围'),
        measuredAt: isoDate,
        note: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnPet(ctx, input.petId);
      const today = new Date().toISOString().slice(0, 10);
      if (input.measuredAt > today) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '称重日期不能晚于今天' });
      }
      const log = await ctx.db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(schema.petWeightLogs)
          .values({
            petId: input.petId,
            weightKg: input.weightKg,
            measuredAt: input.measuredAt,
            note: input.note ?? null,
            createdBy: ctx.user.id,
          })
          .returning();
        const latest = await tx
          .select({ measuredAt: schema.petWeightLogs.measuredAt })
          .from(schema.petWeightLogs)
          .where(eq(schema.petWeightLogs.petId, input.petId))
          .orderBy(desc(schema.petWeightLogs.measuredAt))
          .limit(1)
          .then((r) => r[0]);
        if (latest?.measuredAt === input.measuredAt) {
          await tx
            .update(schema.pets)
            .set({ weightKg: input.weightKg, updatedAt: new Date() })
            .where(eq(schema.pets.id, input.petId));
        }
        return inserted;
      });
      return { log };
    }),

  /** 体重序列（本人宠物；measuredAt 升序——趋势图数据源） */
  weightList: customerProcedure
    .input(z.object({ petId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertOwnPet(ctx, input.petId);
      const rows = await ctx.db
        .select()
        .from(schema.petWeightLogs)
        .where(eq(schema.petWeightLogs.petId, input.petId))
        .orderBy(schema.petWeightLogs.measuredAt)
        .limit(500);
      return { logs: rows };
    }),

  /** 健康页一次拉取：档案 + 记录（降序 200）+ 体重序列（升序 500） */
  overview: customerProcedure
    .input(z.object({ petId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const pet = await assertOwnPet(ctx, input.petId);
      const [records, weights] = await Promise.all([
        ctx.db
          .select()
          .from(schema.petHealthRecords)
          .where(eq(schema.petHealthRecords.petId, input.petId))
          .orderBy(desc(schema.petHealthRecords.recordDate), desc(schema.petHealthRecords.createdAt))
          .limit(200),
        ctx.db
          .select()
          .from(schema.petWeightLogs)
          .where(eq(schema.petWeightLogs.petId, input.petId))
          .orderBy(schema.petWeightLogs.measuredAt)
          .limit(500),
      ]);
      return { pet, records, weights };
    }),
});

export type PetHealthRouter = typeof petHealthRouter;
