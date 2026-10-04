/**
 * staffExit tRPC router（员工端骨架整建批 片 3 B7-4 · 离职交接）：
 *
 * - reassignAppointments（店长）：把 fromStaff 名下未完结（scheduled_start >= 今日
 *   且 status ∈ confirmed/pending/in_service/in_boarding）的本店预约改挂 toStaffId；
 *   每单行落 staff_exit_handoffs 留痕（kind=appointment|boarding（type=boarding 的），
 *   prev_value/new_value=前后 staffId JSON 快照，changed_by=操作人）。
 *   幂等口径：零匹配单=幂等返回 {moved:0}（再调一次自然零单）。
 * - listHandoffs（店长）：{staffId}→留痕列表。
 *
 * 离职锁定本体=既有闸（staffProcedure 每请求校 staff.status≠active 即 FORBIDDEN），
 * 本路由不改中间件。memberships 无员工负责人列=零改挂（会员档案不随员工走，明面报备）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { merchantManagerProcedure, router } from '../trpc';
import { storeDayStartMs, storeWallclock } from './appointment';

function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}
function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}

/** 未完结状态集（已 completed/cancelled 的历史单不改挂——留痕口径不动历史） */
const OPEN_STATUSES = ['confirmed', 'pending', 'in_service', 'in_boarding'] as const;

export const staffExitRouter = router({
  /**
   * reassignAppointments（店长）：离职/停职员工名下未完结预约整批改挂。
   * from/to 均须本店员工（越店传参=查无此物不透出）；to 须在职。
   */
  reassignAppointments: merchantManagerProcedure
    .input(
      z.object({
        fromStaffId: z.string().min(1),
        toStaffId: z.string().min(1),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      if (input.fromStaffId === input.toStaffId) badRequest('接手员工不能与原员工相同');
      const fromStaff = await ctx.db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.id, input.fromStaffId), eq(schema.staff.storeId, storeId)))
        .get();
      if (!fromStaff) notFound('原员工不存在或不属于本店');
      const toStaff = await ctx.db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.id, input.toStaffId), eq(schema.staff.storeId, storeId)))
        .get();
      if (!toStaff) notFound('接手员工不存在或不属于本店');

      const w = storeWallclock(new Date());
      const todayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
      return ctx.db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: schema.appointments.id, type: schema.appointments.type })
          .from(schema.appointments)
          .where(
            and(
              eq(schema.appointments.storeId, storeId),
              eq(schema.appointments.staffId, fromStaff.id),
              gte(schema.appointments.scheduledStart, todayStart),
              inArray(schema.appointments.status, [...OPEN_STATUSES]),
            ),
          );
        if (rows.length === 0) return { moved: 0 }; // 零单=幂等返回
        const now = new Date();
        await tx
          .update(schema.appointments)
          .set({ staffId: toStaff.id, updatedAt: now })
          .where(inArray(schema.appointments.id, rows.map((r) => r.id)));
        await tx.insert(schema.staffExitHandoffs).values(
          rows.map((r) => ({
            storeId,
            kind: r.type === 'boarding' ? 'boarding' : 'appointment',
            refId: r.id,
            fromStaffId: fromStaff.id,
            toStaffId: toStaff.id,
            prevValue: JSON.stringify({ staffId: fromStaff.id, staffName: fromStaff.name }),
            newValue: JSON.stringify({ staffId: toStaff.id, staffName: toStaff.name }),
            note: input.note ?? null,
            changedBy: ctx.user.id,
            createdAt: now,
          })),
        );
        return { moved: rows.length };
      });
    }),

  /** listHandoffs（店长）：某员工为 from 的改挂留痕（最新在前） */
  listHandoffs: merchantManagerProcedure
    .input(z.object({ staffId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(schema.staffExitHandoffs)
        .where(
          and(
            eq(schema.staffExitHandoffs.storeId, ctx.user.storeId!),
            eq(schema.staffExitHandoffs.fromStaffId, input.staffId),
          ),
        )
        .orderBy(desc(schema.staffExitHandoffs.createdAt))
        .limit(200);
      return { handoffs: rows };
    }),
});
