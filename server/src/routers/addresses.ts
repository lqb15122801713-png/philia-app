/**
 * 收货地址 router（客户端体验大批 片 1 · namespace address · customerProcedure）
 *
 * - list       本人全部地址（默认在前，再按创建时间倒序）
 * - create     {receiver, phone, region, detail, isDefault?}——手机号 11 位校验；
 *              isDefault=true 时同事务清本人其他默认（默认唯一=应用层保）
 * - update     {id, ...同上全可选}——本人闸（他人 id → NOT_FOUND 不透出）
 * - remove     {id}——本人闸；删除默认行后剩余第一条（list 同口径序）自动升默认
 * - setDefault {id}——本人闸；同事务清其他默认后置本行默认
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { customerProcedure, router } from '../trpc';

function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

const phoneSchema = z.string().regex(/^1\d{10}$/, '手机号应为 11 位数字（1 开头）');

const addressFieldsSchema = z.object({
  receiver: z.string().trim().min(1, '收货人不能为空').max(32, '收货人不能超过 32 字'),
  phone: phoneSchema,
  region: z.string().trim().min(1, '所在地区不能为空').max(120, '所在地区过长'),
  detail: z.string().trim().min(1, '详细地址不能为空').max(255, '详细地址过长'),
});

export const addressRouter = router({
  /** list（customer）：本人全部，默认在前（isDefault desc，再 createdAt desc） */
  list: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.addresses)
      .where(eq(schema.addresses.userId, ctx.user.id))
      .orderBy(desc(schema.addresses.isDefault), desc(schema.addresses.createdAt), desc(schema.addresses.id));
    return { items: rows };
  }),

  /** create（customer）：isDefault=true 时同事务清本人其他默认 */
  create: customerProcedure
    .input(addressFieldsSchema.extend({ isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx
            .update(schema.addresses)
            .set({ isDefault: false, updatedAt: now })
            .where(
              and(eq(schema.addresses.userId, ctx.user.id), eq(schema.addresses.isDefault, true)),
            );
        }
        const row = await tx
          .insert(schema.addresses)
          .values({
            userId: ctx.user.id,
            receiver: input.receiver,
            phone: input.phone,
            region: input.region,
            detail: input.detail,
            isDefault: input.isDefault === true,
          })
          .returning()
          .then((r) => r[0]!);
        return { address: row };
      });
    }),

  /**
   * update（customer）：{id, ...全可选}——本人闸；isDefault=true 同事务清其他默认；
   * isDefault=false=仅取消本行默认（不另升他人，保持「无默认」诚实态）。
   */
  update: customerProcedure
    .input(
      z.object({ id: z.string().min(1) }).merge(addressFieldsSchema.partial()).extend({
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mine = await ctx.db
        .select()
        .from(schema.addresses)
        .where(eq(schema.addresses.id, input.id))
        .limit(1)
        .then((r) => r[0]);
      if (!mine || mine.userId !== ctx.user.id) notFound('地址不存在');

      const now = new Date();
      const set: Partial<{
        receiver: string;
        phone: string;
        region: string;
        detail: string;
        isDefault: boolean;
      }> = {};
      if (input.receiver !== undefined) set.receiver = input.receiver;
      if (input.phone !== undefined) set.phone = input.phone;
      if (input.region !== undefined) set.region = input.region;
      if (input.detail !== undefined) set.detail = input.detail;
      if (input.isDefault !== undefined) set.isDefault = input.isDefault;

      return ctx.db.transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx
            .update(schema.addresses)
            .set({ isDefault: false, updatedAt: now })
            .where(
              and(
                eq(schema.addresses.userId, ctx.user.id),
                eq(schema.addresses.isDefault, true),
                ne(schema.addresses.id, mine.id),
              ),
            );
        }
        const row = await tx
          .update(schema.addresses)
          .set({ ...set, updatedAt: now })
          .where(eq(schema.addresses.id, mine.id))
          .returning()
          .then((r) => r[0]!);
        return { address: row };
      });
    }),

  /** remove（customer）：本人闸；删默认行后剩余第一条（默认在前/新→旧同 list 序）自动升默认 */
  remove: customerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const mine = await ctx.db
        .select()
        .from(schema.addresses)
        .where(eq(schema.addresses.id, input.id))
        .limit(1)
        .then((r) => r[0]);
      if (!mine || mine.userId !== ctx.user.id) notFound('地址不存在');

      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        await tx.delete(schema.addresses).where(eq(schema.addresses.id, mine.id));
        let promoted: typeof mine | null = null;
        if (mine.isDefault) {
          // 剩余第一条升默认（序同 list：createdAt desc，id desc 兜底）
          const rest = await tx
            .select()
            .from(schema.addresses)
            .where(eq(schema.addresses.userId, ctx.user.id))
            .orderBy(desc(schema.addresses.createdAt), desc(schema.addresses.id))
            .limit(1)
            .then((r) => r[0]);
          if (rest) {
            promoted = await tx
              .update(schema.addresses)
              .set({ isDefault: true, updatedAt: now })
              .where(eq(schema.addresses.id, rest.id))
              .returning()
              .then((r) => r[0]!);
          }
        }
        return { removed: true as const, promotedId: promoted?.id ?? null };
      });
    }),

  /** setDefault（customer）：本人闸；同事务清本人其他默认后置本行 */
  setDefault: customerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const mine = await ctx.db
        .select()
        .from(schema.addresses)
        .where(eq(schema.addresses.id, input.id))
        .limit(1)
        .then((r) => r[0]);
      if (!mine || mine.userId !== ctx.user.id) notFound('地址不存在');

      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        await tx
          .update(schema.addresses)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              eq(schema.addresses.userId, ctx.user.id),
              eq(schema.addresses.isDefault, true),
              ne(schema.addresses.id, mine.id),
            ),
          );
        const row = await tx
          .update(schema.addresses)
          .set({ isDefault: true, updatedAt: now })
          .where(eq(schema.addresses.id, mine.id))
          .returning()
          .then((r) => r[0]!);
        return { address: row };
      });
    }),
});

export type AddressRouter = typeof addressRouter;
