/**
 * 发票抬头 router（客户端体验大批 片 1 · namespace invoiceTitle · customerProcedure）
 *
 * 同地址五件工艺（list/create/update/remove/setDefault，全部本人闸——他人 id →
 * NOT_FOUND 不透出）：
 * - titleType ∈ personal|business；business 须 taxNo 非空（400 明文）；
 *   personal 恒 taxNo=NULL（置空口径同 invoice_requests）；
 * - 默认唯一=应用层保（isDefault=true 同事务清本人其他默认）；删默认行后剩余第一条
 *   （list 同口径序）自动升默认；
 * - 发票申请（serviceLoop.invoiceCreate）可选引用抬头——server 侧只供 CRUD，引用是前端活。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { customerProcedure, router } from '../trpc';

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

const titleTypeSchema = z.string().trim();

function assertTitleType(v: string): 'personal' | 'business' {
  if (v === 'personal' || v === 'business') return v;
  badRequest('抬头类型仅支持 personal（个人）/ business（企业）');
}

const titleFieldsSchema = z.object({
  titleType: titleTypeSchema,
  title: z.string().trim().min(1, '发票抬头不能为空').max(100, '抬头不能超过 100 字'),
  taxNo: z.string().trim().max(30, '税号过长').optional(),
});

/** business 税号闸：titleType=business 时税号非空（create/update 共用） */
function assertBusinessTaxNo(titleType: 'personal' | 'business', taxNo: string | undefined | null): void {
  if (titleType === 'business' && !taxNo) badRequest('企业抬头必须填写税号');
}

export const invoiceTitleRouter = router({
  /** list（customer）：本人全部，默认在前（isDefault desc，再 createdAt desc） */
  list: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.invoiceTitles)
      .where(eq(schema.invoiceTitles.userId, ctx.user.id))
      .orderBy(desc(schema.invoiceTitles.isDefault), desc(schema.invoiceTitles.createdAt), desc(schema.invoiceTitles.id));
    return { items: rows };
  }),

  /** create（customer）：business 须税号；isDefault=true 同事务清本人其他默认 */
  create: customerProcedure
    .input(titleFieldsSchema.extend({ isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const titleType = assertTitleType(input.titleType);
      assertBusinessTaxNo(titleType, input.taxNo);
      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx
            .update(schema.invoiceTitles)
            .set({ isDefault: false, updatedAt: now })
            .where(
              and(eq(schema.invoiceTitles.userId, ctx.user.id), eq(schema.invoiceTitles.isDefault, true)),
            );
        }
        const row = await tx
          .insert(schema.invoiceTitles)
          .values({
            userId: ctx.user.id,
            titleType,
            title: input.title,
            taxNo: titleType === 'business' ? input.taxNo! : null, // personal 恒 NULL
            isDefault: input.isDefault === true,
          })
          .returning()
          .then((r) => r[0]!);
        return { title: row };
      });
    }),

  /**
   * update（customer）：{id, ...全可选}——本人闸；改 titleType=business 时税号取
   * 入参或原值（两者皆空 → 400）；改 personal 则税号置空。
   */
  update: customerProcedure
    .input(
      z.object({ id: z.string().min(1) }).merge(titleFieldsSchema.partial()).extend({
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mine = await ctx.db
        .select()
        .from(schema.invoiceTitles)
        .where(eq(schema.invoiceTitles.id, input.id))
        .limit(1)
        .then((r) => r[0]);
      if (!mine || mine.userId !== ctx.user.id) notFound('发票抬头不存在');

      const nextType = input.titleType !== undefined ? assertTitleType(input.titleType) : (mine.titleType as 'personal' | 'business');
      const nextTaxNo =
        nextType === 'personal' ? null : input.taxNo !== undefined ? input.taxNo : mine.taxNo;
      assertBusinessTaxNo(nextType, nextTaxNo);

      const now = new Date();
      const set: Partial<{
        titleType: string;
        title: string;
        taxNo: string | null;
        isDefault: boolean;
      }> = {};
      if (input.titleType !== undefined) set.titleType = nextType;
      if (input.title !== undefined) set.title = input.title;
      if (input.titleType !== undefined || input.taxNo !== undefined) set.taxNo = nextTaxNo;
      if (input.isDefault !== undefined) set.isDefault = input.isDefault;

      return ctx.db.transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx
            .update(schema.invoiceTitles)
            .set({ isDefault: false, updatedAt: now })
            .where(
              and(
                eq(schema.invoiceTitles.userId, ctx.user.id),
                eq(schema.invoiceTitles.isDefault, true),
                ne(schema.invoiceTitles.id, mine.id),
              ),
            );
        }
        const row = await tx
          .update(schema.invoiceTitles)
          .set({ ...set, updatedAt: now })
          .where(eq(schema.invoiceTitles.id, mine.id))
          .returning()
          .then((r) => r[0]!);
        return { title: row };
      });
    }),

  /** remove（customer）：本人闸；删默认行后剩余第一条（同 list 序）自动升默认 */
  remove: customerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const mine = await ctx.db
        .select()
        .from(schema.invoiceTitles)
        .where(eq(schema.invoiceTitles.id, input.id))
        .limit(1)
        .then((r) => r[0]);
      if (!mine || mine.userId !== ctx.user.id) notFound('发票抬头不存在');

      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        await tx.delete(schema.invoiceTitles).where(eq(schema.invoiceTitles.id, mine.id));
        let promoted: typeof mine | null = null;
        if (mine.isDefault) {
          const rest = await tx
            .select()
            .from(schema.invoiceTitles)
            .where(eq(schema.invoiceTitles.userId, ctx.user.id))
            .orderBy(desc(schema.invoiceTitles.createdAt), desc(schema.invoiceTitles.id))
            .limit(1)
            .then((r) => r[0]);
          if (rest) {
            promoted = await tx
              .update(schema.invoiceTitles)
              .set({ isDefault: true, updatedAt: now })
              .where(eq(schema.invoiceTitles.id, rest.id))
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
        .from(schema.invoiceTitles)
        .where(eq(schema.invoiceTitles.id, input.id))
        .limit(1)
        .then((r) => r[0]);
      if (!mine || mine.userId !== ctx.user.id) notFound('发票抬头不存在');

      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        await tx
          .update(schema.invoiceTitles)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              eq(schema.invoiceTitles.userId, ctx.user.id),
              eq(schema.invoiceTitles.isDefault, true),
              ne(schema.invoiceTitles.id, mine.id),
            ),
          );
        const row = await tx
          .update(schema.invoiceTitles)
          .set({ isDefault: true, updatedAt: now })
          .where(eq(schema.invoiceTitles.id, mine.id))
          .returning()
          .then((r) => r[0]!);
        return { title: row };
      });
    }),
});

export type InvoiceTitleRouter = typeof invoiceTitleRouter;
