/**
 * pass router（v1.1-b2 B2-7 · 次卡最小闭环服务端）
 *
 * - pass.mine（customer）：本人次卡列表（可选按门店过滤），附门店名与 usable 快照；
 *   预约确认页「剩余 N 次 / 暂无可用次卡」与会员卡页余额的数据源。
 * - pass.listForStore（merchant 本店）：本店全部次卡 + 持卡人昵称/手机号。
 * - pass.listCustomers（merchant 本店）：可充次客户清单（本店有预约单或已持本店卡的
 *   用户），「充次」对话框下拉数据源，也是 topUp 归属校验的同口径。
 * - pass.topUp（merchant 本店）：充次——无卡建卡 / 有卡加次（total/remain 同 +N），
 *   事务内写 +N 流水（appointment_id=NULL）。归属红线：只能给本店客户充次，
 *   卡一律挂在 ctx.user.storeId 名下，越店操作 FORBIDDEN。
 * - pass.listLogs（merchant 本店）：次卡流水（-1 扣次 / +1 取消回补 / +N 充次），
 *   按时间倒序；经 member_pass.storeId 限定本店，不泄漏他店数据。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { customerProcedure, merchantManagerProcedure, router } from '../trpc';

type PassRow = typeof schema.memberPasses.$inferSelect;

/** 次卡当前可用：active + 有余量 + 未过期（expires_at NULL = 长期有效） */
function passUsable(p: PassRow): boolean {
  return p.status === 'active' && p.remainTimes > 0 && (p.expiresAt === null || p.expiresAt.getTime() > Date.now());
}

export const passRouter = router({
  /** mine（customer）：本人次卡（可按门店过滤），预约确认页 / 会员卡页数据源 */
  mine: customerProcedure
    .input(z.object({ storeId: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.memberPasses.userId, ctx.user.id)];
      if (input?.storeId) conds.push(eq(schema.memberPasses.storeId, input.storeId));
      const rows = await ctx.db
        .select({ pass: schema.memberPasses, storeName: schema.stores.name })
        .from(schema.memberPasses)
        .innerJoin(schema.stores, eq(schema.stores.id, schema.memberPasses.storeId))
        .where(and(...conds))
        .orderBy(desc(schema.memberPasses.createdAt));
      return rows.map((r) => ({ ...r.pass, storeName: r.storeName, usable: passUsable(r.pass) }));
    }),

  /** listForStore（merchant 本店）：本店次卡列表 + 持卡人昵称/手机号 */
  listForStore: merchantManagerProcedure.query(async ({ ctx }) => { // M1-补2 条件①：次卡台账 clerk 不可翻（矩阵 ⚠️ 仅收银识别可见余额）
    const rows = await ctx.db
      .select({
        pass: schema.memberPasses,
        customerNickname: schema.users.nickname,
        customerPhone: schema.users.phone,
      })
      .from(schema.memberPasses)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberPasses.userId))
      .where(eq(schema.memberPasses.storeId, ctx.user.storeId!))
      .orderBy(desc(schema.memberPasses.createdAt));
    return rows.map((r) => ({
      ...r.pass,
      customerNickname: r.customerNickname,
      customerPhone: r.customerPhone,
      usable: passUsable(r.pass),
    }));
  }),

  /**
   * listCustomers（merchant 本店）：可充次客户下拉清单。
   * 口径 = 本店有预约单的用户 ∪ 已持本店次卡的用户（与 topUp 归属校验同口径）。
   */
  listCustomers: merchantManagerProcedure.query(async ({ ctx }) => { // M1-补2 条件①：会员名册翻查 clerk 403
    const storeId = ctx.user.storeId!;
    const apptRows = await ctx.db
      .select({ userId: schema.appointments.customerId })
      .from(schema.appointments)
      .where(eq(schema.appointments.storeId, storeId));
    const passRows = await ctx.db
      .select({ userId: schema.memberPasses.userId })
      .from(schema.memberPasses)
      .where(eq(schema.memberPasses.storeId, storeId));
    const ids = [...new Set([...apptRows.map((r) => r.userId), ...passRows.map((r) => r.userId)])];
    if (ids.length === 0) return { customers: [] };
    const users = await ctx.db
      .select({ id: schema.users.id, nickname: schema.users.nickname, phone: schema.users.phone })
      .from(schema.users)
      .where(inArray(schema.users.id, ids));
    users.sort((a, b) => (a.nickname ?? '').localeCompare(b.nickname ?? '', 'zh'));
    return { customers: users };
  }),

  /**
   * topUp（merchant 本店）：充次。无卡建卡 / 有卡加次，写 +N 流水（appointment_id=NULL）。
   * 事务内整体提交：建/改卡与流水同生共死。归属红线：目标用户须为本店客户
   * （本店有预约或已持本店卡），否则 FORBIDDEN。
   */
  topUp: merchantManagerProcedure // M1-补2 条件①：充次=售卖性质，clerk 403（矩阵；owner|manager 保留）
    .input(
      z.object({
        userId: z.string().min(1),
        times: z.number().int().min(1, '充次次数须 ≥1').max(999, '单次充次上限 999'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const target = await ctx.db
        .select({ id: schema.users.id, nickname: schema.users.nickname })
        .from(schema.users)
        .where(eq(schema.users.id, input.userId))
        .get();
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: '客户不存在' });

      // 归属校验：只能管本店客户的卡（本店有预约单 或 已持本店次卡）
      const isStoreCustomer =
        (await ctx.db
          .select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(and(eq(schema.appointments.storeId, storeId), eq(schema.appointments.customerId, input.userId)))
          .get()) !== undefined ||
        (await ctx.db
          .select({ id: schema.memberPasses.id })
          .from(schema.memberPasses)
          .where(and(eq(schema.memberPasses.storeId, storeId), eq(schema.memberPasses.userId, input.userId)))
          .get()) !== undefined;
      if (!isStoreCustomer) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '该客户在本店无预约记录，不能为其充次' });
      }

      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(schema.memberPasses)
          .where(and(eq(schema.memberPasses.userId, input.userId), eq(schema.memberPasses.storeId, storeId)))
          .get();
        let pass: PassRow;
        let created = false;
        if (existing) {
          pass = await tx
            .update(schema.memberPasses)
            .set({
              totalTimes: existing.totalTimes + input.times,
              remainTimes: existing.remainTimes + input.times,
              updatedAt: now,
            })
            .where(eq(schema.memberPasses.id, existing.id))
            .returning()
            .then((r) => r[0]!);
        } else {
          created = true;
          pass = await tx
            .insert(schema.memberPasses)
            .values({ userId: input.userId, storeId, totalTimes: input.times, remainTimes: input.times })
            .returning()
            .then((r) => r[0]!);
        }
        await tx.insert(schema.passDeductLogs).values({
          passId: pass.id,
          appointmentId: null, // 充次无关联预约单
          delta: input.times,
        });
        return { pass, created };
      });
    }),

  /** listLogs（merchant 本店）：次卡流水（可指定某张卡），倒序，上限 100 条 */
  listLogs: merchantManagerProcedure // M1-补2 条件①：扣次流水翻查 clerk 403
    .input(z.object({ passId: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.memberPasses.storeId, ctx.user.storeId!)]; // 本店口径，防越店泄漏
      if (input?.passId) conds.push(eq(schema.passDeductLogs.passId, input.passId));
      const rows = await ctx.db
        .select({
          log: schema.passDeductLogs,
          customerNickname: schema.users.nickname,
          appointmentCode: schema.appointments.code,
        })
        .from(schema.passDeductLogs)
        .innerJoin(schema.memberPasses, eq(schema.memberPasses.id, schema.passDeductLogs.passId))
        .innerJoin(schema.users, eq(schema.users.id, schema.memberPasses.userId))
        .leftJoin(schema.appointments, eq(schema.appointments.id, schema.passDeductLogs.appointmentId))
        .where(and(...conds))
        .orderBy(desc(schema.passDeductLogs.createdAt), desc(schema.passDeductLogs.id))
        .limit(100);
      return rows.map((r) => ({
        ...r.log,
        customerNickname: r.customerNickname,
        appointmentCode: r.appointmentCode ?? null,
      }));
    }),
});

export type PassRouter = typeof passRouter;
