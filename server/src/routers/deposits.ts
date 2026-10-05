/**
 * 押金台账 router（客户端体验大批 片 1 · namespace deposit）
 *
 * 开口项 2 裁：留痕不碰真钱——押金收取/退还全为登记留痕，**全链路零支付通道写**
 * （不落 pay_orders / payments / cashier_payments 任何真钱表；实收实退在线下进行，
 * 本台账只记进度）。状态机：held（已收在押）→ refunding（退还登记在途）→ refunded
 * （已退还）；markRefunded 对已 refunded 幂等返回现状。
 *
 * 端点：
 * - create         （merchantManager）{customerId, kind, amountFen, refAppointmentId?, note?}
 *                  customerId 须为本店客户（有本店预约 appointments / 会员 memberships
 *                  / 储值 stored_value_accounts 任一在店痕迹即可——校验注释明面）；
 *                  落 status=held + held_at。
 * - markRefunding  （merchantManager）{id, note?}——held→refunding + refund_requested_at；非 held 400。
 * - markRefunded   （merchantManager）{id, note?}——held|refunding→refunded + refunded_at；已 refunded 幂等。
 * - listMine       （customer）本人全部（新→旧，透出门店名）。
 * - listStore      （merchantManager）本店全部（status 过滤可选）。
 * - storeSummary   （merchantManager）本店在押合计：Σstatus=held + Σstatus=refunding
 *                  （refunded 不计入在押——留痕台账口径，涉钱算式明面）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { customerProcedure, merchantManagerProcedure, router, type Db } from '../trpc';

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

const depositKindSchema = z.string().trim();
function assertKind(v: string): 'kennel' | 'goods' | 'other' {
  if (v === 'kennel' || v === 'goods' || v === 'other') return v;
  badRequest('押金类型仅支持 kennel（寄养押金）/ goods（物品押金）/ other（其他）');
}

/**
 * 本店客户校验（任一在店痕迹即可，注释明面）：
 * ① 本店预约（appointments.customer_id+store_id）
 * ② 本店售卡会员（memberships.user_id+sold_store_id）
 * ③ 本店储值账户（stored_value_accounts.user_id+store_id）
 */
async function assertStoreCustomer(d: Db, storeId: string, customerId: string): Promise<void> {
  const appt = await d
    .select({ id: schema.appointments.id })
    .from(schema.appointments)
    .where(and(eq(schema.appointments.customerId, customerId), eq(schema.appointments.storeId, storeId)))
    .limit(1)
    .then((r) => r[0]);
  if (appt) return;
  const member = await d
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, customerId), eq(schema.memberships.soldStoreId, storeId)))
    .limit(1)
    .then((r) => r[0]);
  if (member) return;
  const sv = await d
    .select({ id: schema.storedValueAccounts.id })
    .from(schema.storedValueAccounts)
    .where(
      and(eq(schema.storedValueAccounts.userId, customerId), eq(schema.storedValueAccounts.storeId, storeId)),
    )
    .limit(1)
    .then((r) => r[0]);
  if (sv) return;
  badRequest('该客户在本店无预约/会员/储值任一在店痕迹，不可登记押金');
}

/** 本店押金行读取闸：行不存在或非本店 → NOT_FOUND（不透出他店行存在性） */
async function loadStoreDeposit(d: Db, storeId: string, id: string) {
  const row = await d
    .select()
    .from(schema.depositRecords)
    .where(eq(schema.depositRecords.id, id))
    .limit(1)
    .then((r) => r[0]);
  if (!row || row.storeId !== storeId) notFound('押金记录不存在');
  return row;
}

export const depositRouter = router({
  /**
   * create（merchantManager）：登记押金收取——落 status=held+held_at。
   * 留痕不碰真钱（开口项 2 裁）：本端点零支付通道写（不碰 pay_orders/payments/
   * cashier_payments），实收在线下，本行仅为台账登记。
   */
  create: merchantManagerProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        kind: depositKindSchema,
        amountFen: z.number().int('金额须为整数分').min(1, '押金金额须大于 0').max(100_000_000, '押金金额超限'),
        refAppointmentId: z.string().min(1).optional(),
        note: z.string().trim().max(200, '备注过长').optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const kind = assertKind(input.kind);
      await assertStoreCustomer(ctx.db, storeId, input.customerId);
      if (input.refAppointmentId) {
        const appt = await ctx.db
          .select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(eq(schema.appointments.id, input.refAppointmentId))
          .limit(1)
          .then((r) => r[0]);
        if (!appt) notFound('关联预约不存在');
      }
      const now = new Date();
      const row = await ctx.db
        .insert(schema.depositRecords)
        .values({
          storeId,
          customerId: input.customerId,
          kind,
          amountFen: input.amountFen,
          status: 'held',
          refAppointmentId: input.refAppointmentId ?? null,
          note: input.note ?? null,
          heldAt: now,
          createdBy: ctx.user.id,
        })
        .returning()
        .then((r) => r[0]!);
      return { deposit: row };
    }),

  /** markRefunding（merchantManager）：held→refunding+refund_requested_at；非 held 400 明文 */
  markRefunding: merchantManagerProcedure
    .input(z.object({ id: z.string().min(1), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const mine = await loadStoreDeposit(ctx.db, ctx.user.storeId!, input.id);
      if (mine.status !== 'held') {
        badRequest(`当前状态（${mine.status}）不可登记退还中，仅「在押 held」可登记`);
      }
      const now = new Date();
      const row = await ctx.db
        .update(schema.depositRecords)
        .set({
          status: 'refunding',
          refundRequestedAt: now,
          ...(input.note !== undefined ? { note: input.note } : {}),
          updatedAt: now,
        })
        .where(eq(schema.depositRecords.id, mine.id))
        .returning()
        .then((r) => r[0]!);
      return { deposit: row };
    }),

  /** markRefunded（merchantManager）：held|refunding→refunded+refunded_at；已 refunded 幂等返回现状（零副作用） */
  markRefunded: merchantManagerProcedure
    .input(z.object({ id: z.string().min(1), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const mine = await loadStoreDeposit(ctx.db, ctx.user.storeId!, input.id);
      if (mine.status === 'refunded') {
        return { deposit: mine, idempotent: true as const }; // 幂等：已退还重复登记返回现状
      }
      const now = new Date();
      const row = await ctx.db
        .update(schema.depositRecords)
        .set({
          status: 'refunded',
          refundedAt: now,
          ...(input.note !== undefined ? { note: input.note } : {}),
          updatedAt: now,
        })
        .where(eq(schema.depositRecords.id, mine.id))
        .returning()
        .then((r) => r[0]!);
      return { deposit: row, idempotent: false as const };
    }),

  /** listMine（customer）：本人全部（新→旧），透出门店名 */
  listMine: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ deposit: schema.depositRecords, storeName: schema.stores.name })
      .from(schema.depositRecords)
      .innerJoin(schema.stores, eq(schema.stores.id, schema.depositRecords.storeId))
      .where(eq(schema.depositRecords.customerId, ctx.user.id))
      .orderBy(desc(schema.depositRecords.createdAt), desc(schema.depositRecords.id));
    return { items: rows.map((r) => ({ ...r.deposit, storeName: r.storeName })) };
  }),

  /** listStore（merchantManager）：本店全部（status 过滤可选，新→旧） */
  listStore: merchantManagerProcedure
    .input(
      z
        .object({ status: z.enum(['held', 'refunding', 'refunded']).optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.depositRecords.storeId, ctx.user.storeId!)];
      if (input?.status) conds.push(eq(schema.depositRecords.status, input.status));
      const rows = await ctx.db
        .select()
        .from(schema.depositRecords)
        .where(and(...conds))
        .orderBy(desc(schema.depositRecords.createdAt), desc(schema.depositRecords.id));
      return { items: rows };
    }),

  /**
   * storeSummary（merchantManager）：本店在押合计（留痕台账口径，算式明面）——
   * inCustodyFen = Σ(status=held).amountFen + Σ(status=refunding).amountFen
   * （refunded 已退还，不计入在押；金额单位分，精确到分）。
   */
  storeSummary: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ status: schema.depositRecords.status, amountFen: schema.depositRecords.amountFen })
      .from(schema.depositRecords)
      .where(
        and(
          eq(schema.depositRecords.storeId, ctx.user.storeId!),
          inArray(schema.depositRecords.status, ['held', 'refunding']),
        ),
      );
    const held = rows.filter((r) => r.status === 'held');
    const refunding = rows.filter((r) => r.status === 'refunding');
    const heldFen = held.reduce((s, r) => s + r.amountFen, 0);
    const refundingFen = refunding.reduce((s, r) => s + r.amountFen, 0);
    return {
      heldCount: held.length,
      heldFen,
      refundingCount: refunding.length,
      refundingFen,
      inCustodyFen: heldFen + refundingFen, // 在押合计 = held + refunding（refunded 不计）
    };
  }),
});

export type DepositRouter = typeof depositRouter;
