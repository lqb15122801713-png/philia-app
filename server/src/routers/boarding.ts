/**
 * boarding router（tRPC）—— 寄养扩展（开发方案 §3.1 寄养差异点 / §6.2）
 *
 * - boarding.checkinStay：staff 本店。对 in_boarding 预约做入住登记
 *   （称重 checkin_weight_kg + belongings 物品清单 JSON + room_no）；
 *   幂等——已登记则更新（boarding_stays.appointment_id 唯一）。
 * - boarding.dailyLog：staff 本店。每日打卡 UPSERT by (stay_id, log_date)；
 *   写后 emitEvent(user:{customerId} + store:{storeId}, boarding.daily_update)。
 * - boarding.checkout：staff 本店（v1.1-b3 B3-5 A-P2-14 基类修正：publicProcedure →
 *   staffProcedure，未绑定 staff 记录/已停职即时 FORBIDDEN；getBoardingAppointment
 *   手工守卫保留兜底）。退房核销：stay.checkout_at=now +
 *   预约 in_boarding→completed（completed_at）+ emitEvent(appointment:{aid},
 *   boarding.completed)；幂等（已退房直接返回现状）。
 * - boarding.stayBoard：merchant 本店。在店宠物看板（in_boarding 的 stays
 *   join appointment/pet/customer，含最近一次打卡日期与超期标记：
 *   scheduled_end < now 且未退房）。
 * - boarding.stayForStaff：staff 本店（P3 T3.4 员工端寄养打卡页数据源）。
 *   员工查看单个寄养单现状（stay + 每日打卡按 log_date 升序）；myStay 是
 *   customerProcedure、stayBoard 是 merchantProcedure，员工均不可用，故增设。
 */

import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { emitEvent, broadcastNow, type Db as BusDb } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  assertFrontdeskStaff,
  customerProcedure,
  merchantProcedure,
  router,
  staffProcedure,
  type AppointmentRow,
  type Context,
} from '../trpc';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD');

/** 随身物品清单项（name 必填；photoUrl/note 可选） */
const belongingItem = z.object({
  name: z.string().trim().min(1).max(64),
  photoUrl: z.string().max(255).optional(),
  note: z.string().max(255).optional(),
});

const mealItem = z.object({
  time: z.string().max(32),
  food: z.string().trim().min(1).max(64),
  amount: z.string().max(32).optional(),
  finished: z.boolean().optional(),
});

/**
 * 取寄养预约并校验「本店」归属（staff：本店且未指派/指派给本人；merchant：本店）。
 * 预约不存在 NOT_FOUND；非寄养类 / 越店 / 越权抛相应错误。
 * S1-R1：opts.staffStorewide=true 时 staff 放宽为「本店任意员工」（仅 checkinStay
 * 在 assertFrontdeskStaff 之后使用——前台到店登记豁免归属；其余过程不传，口径不变）。
 */
async function getBoardingAppointment(
  ctx: Context & { user: NonNullable<Context['user']> },
  appointmentId: string,
  opts?: { staffStorewide?: boolean },
): Promise<AppointmentRow> {
  const appt = await ctx.db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, appointmentId))
    .limit(1)
    .then((r) => r[0]);
  if (!appt) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
  }
  if (appt.type !== 'boarding') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '该预约不是寄养单' });
  }
  const user = ctx.user;
  const staffOk =
    !!user.staffId &&
    user.storeId === appt.storeId &&
    (opts?.staffStorewide === true || appt.staffId === null || appt.staffId === user.staffId);
  const merchantOk =
    (user.roles.includes('merchant_owner') || user.roles.includes('merchant_manager')) &&
    user.storeId === appt.storeId;
  if (!staffOk && !merchantOk) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作该寄养单' });
  }
  return appt;
}

/** 取宠物名（事件 payload 用，通知文案需要 petName） */
async function petNameOf(ctx: Context, petId: string): Promise<string | undefined> {
  const row = await ctx.db
    .select({ name: schema.pets.name })
    .from(schema.pets)
    .where(eq(schema.pets.id, petId))
    .limit(1)
    .then((r) => r[0]);
  return row?.name;
}

export const boardingRouter = router({
  /** 入住登记（staff 本店；幂等：已登记则更新；批次 S1 收口前台 + R1 到店登记口径：豁免归属） */
  checkinStay: staffProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        checkinWeightKg: z.number().positive('入住体重须大于 0').max(500),
        belongings: z.array(belongingItem).max(20).default([]),
        roomNo: z.string().trim().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 批次 S1 任务 B：与 appointment.checkin 同口径——仅前台可入住登记
      await assertFrontdeskStaff(ctx);
      // S1-R1：前台=到店登记，豁免归属（本店任意寄养单，不论指派给谁；同店校验保留）
      const appt = await getBoardingAppointment(ctx, input.appointmentId, { staffStorewide: true });
      if (appt.status !== 'in_boarding') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `预约当前状态为 ${appt.status}，须为 in_boarding（已核销入店）才能入住登记`,
        });
      }

      const now = new Date();
      const existing = await ctx.db
        .select()
        .from(schema.boardingStays)
        .where(eq(schema.boardingStays.appointmentId, appt.id))
        .limit(1)
        .then((r) => r[0]);

      if (existing) {
        // 幂等：已登记 → 更新登记信息
        const [updated] = await ctx.db
          .update(schema.boardingStays)
          .set({
            checkinWeightKg: input.checkinWeightKg,
            belongings: input.belongings as schema.Belongings,
            roomNo: input.roomNo ?? existing.roomNo,
            updatedAt: now,
          })
          .where(eq(schema.boardingStays.id, existing.id))
          .returning();
        return { stay: updated, created: false as const };
      }

      const [stay] = await ctx.db
        .insert(schema.boardingStays)
        .values({
          appointmentId: appt.id,
          checkinWeightKg: input.checkinWeightKg,
          belongings: input.belongings as schema.Belongings,
          roomNo: input.roomNo ?? null,
        })
        .returning();
      return { stay, created: true as const };
    }),

  /** 每日打卡（staff 本店；UPSERT by (stay_id, log_date)；写完发 boarding.daily_update） */
  dailyLog: staffProcedure
    .input(
      z.object({
        stayId: z.string().min(1),
        logDate: isoDate,
        meals: z.array(mealItem).max(12).optional(),
        walks: z.number().int().min(0).max(99).default(0),
        note: z.string().trim().max(500).optional(),
        photos: z.array(z.string().min(1).max(255)).max(6, '每日打卡照片最多 6 张').optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const stay = await ctx.db
        .select()
        .from(schema.boardingStays)
        .where(eq(schema.boardingStays.id, input.stayId))
        .limit(1)
        .then((r) => r[0]);
      if (!stay) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '寄养住宿记录不存在' });
      }
      const appt = await getBoardingAppointment(ctx, stay.appointmentId);
      const petName = await petNameOf(ctx, appt.petId);

      const now = new Date();
      const payload = {
        appointmentId: appt.id,
        stayId: stay.id,
        logDate: input.logDate,
        petName,
      };

      const { log, outboxIds } = await ctx.db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(schema.boardingDailyLogs)
          .where(
            and(
              eq(schema.boardingDailyLogs.stayId, stay.id),
              eq(schema.boardingDailyLogs.logDate, input.logDate),
            ),
          )
          .limit(1)
          .then((r) => r[0]);

        let log: typeof schema.boardingDailyLogs.$inferSelect;
        if (existing) {
          // UPSERT：同日已有记录 → 覆盖更新
          const [updated] = await tx
            .update(schema.boardingDailyLogs)
            .set({
              staffId: ctx.user.staffId!,
              meals: input.meals ?? existing.meals,
              walks: input.walks,
              note: input.note ?? existing.note,
              photos: input.photos ?? existing.photos,
              updatedAt: now,
            })
            .where(eq(schema.boardingDailyLogs.id, existing.id))
            .returning();
          log = updated;
        } else {
          const [inserted] = await tx
            .insert(schema.boardingDailyLogs)
            .values({
              stayId: stay.id,
              staffId: ctx.user.staffId!,
              logDate: input.logDate,
              meals: input.meals ?? null,
              walks: input.walks,
              note: input.note ?? null,
              photos: input.photos ?? null,
            })
            .returning();
          log = inserted;
        }

        // 同一事务落 outbox：客户端 + 商家端同步收到当日打卡
        const txBus = tx as unknown as BusDb;
        const outboxIds = [
          await emitEvent(txBus, `user:${appt.customerId}`, EventType.BoardingDailyUpdate, payload),
          await emitEvent(txBus, `store:${appt.storeId}`, EventType.BoardingDailyUpdate, payload),
        ];
        return { log, outboxIds };
      });

      for (const id of outboxIds) broadcastNow(id);
      return { log };
    }),

  /**
   * 退房核销（staff 本店；幂等）。
   * B3-5（A-P2-14 基类修正）：publicProcedure → staffProcedure——基类直接表达
   * 「员工操作」意图，未绑定 staff 记录的角色（含商家/客户）在中间件层即
   * FORBIDDEN/UNAUTHORIZED；getBoardingAppointment 的本店/指派手工守卫保留兜底
   * （其 merchant 分支自此不可达，仅作防御性保留）。商家端不再提供退房按钮，
   * 收款仍走 appointment.markPaid（completed 后商家在财务页确认）。
   */
  checkout: staffProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const appt = await getBoardingAppointment(ctx, input.appointmentId);
      const stay = await ctx.db
        .select()
        .from(schema.boardingStays)
        .where(eq(schema.boardingStays.appointmentId, appt.id))
        .limit(1)
        .then((r) => r[0]);
      if (!stay) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '尚未入住登记，无法退房' });
      }

      // 幂等：已退房且预约已 completed → 直接返回现状，不重复写库/发事件
      if (stay.checkoutAt && appt.status === 'completed') {
        return { stay, appointment: appt, alreadyCompleted: true as const };
      }
      if (appt.status !== 'in_boarding') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `预约当前状态为 ${appt.status}，须为 in_boarding 才能退房核销`,
        });
      }

      const petName = await petNameOf(ctx, appt.petId);
      const now = new Date();
      const { updatedStay, updatedAppt, outboxId } = await ctx.db.transaction(async (tx) => {
        const [updatedStay] = await tx
          .update(schema.boardingStays)
          .set({ checkoutAt: now, updatedAt: now })
          .where(eq(schema.boardingStays.id, stay.id))
          .returning();
        const [updatedAppt] = await tx
          .update(schema.appointments)
          .set({ status: 'completed', completedAt: now, updatedAt: now })
          .where(eq(schema.appointments.id, appt.id))
          .returning();
        const outboxId = await emitEvent(
          tx as unknown as BusDb,
          `appointment:${appt.id}`,
          EventType.BoardingCompleted,
          { appointmentId: appt.id, stayId: stay.id, petName },
        );
        return { updatedStay, updatedAppt, outboxId };
      });

      broadcastNow(outboxId);
      return { stay: updatedStay, appointment: updatedAppt, alreadyCompleted: false as const };
    }),

  /** 在店宠物看板（merchant 本店）：含最近一次打卡日期与超期标记 */
  stayBoard: merchantProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const rows = await ctx.db
      .select({
        stay: schema.boardingStays,
        appointment: schema.appointments,
        pet: schema.pets,
        customer: {
          id: schema.users.id,
          nickname: schema.users.nickname,
          phone: schema.users.phone,
        },
      })
      .from(schema.boardingStays)
      .innerJoin(
        schema.appointments,
        eq(schema.boardingStays.appointmentId, schema.appointments.id),
      )
      .innerJoin(schema.pets, eq(schema.appointments.petId, schema.pets.id))
      .innerJoin(schema.users, eq(schema.appointments.customerId, schema.users.id))
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          eq(schema.appointments.status, 'in_boarding'),
        ),
      )
      .orderBy(schema.appointments.scheduledStart);

    const now = Date.now();
    const board = await Promise.all(
      rows.map(async (row) => {
        // 最近一次打卡日期（log_date 为 ISO 文本，字典序即时间序）
        const lastLog = await ctx.db
          .select({ logDate: schema.boardingDailyLogs.logDate })
          .from(schema.boardingDailyLogs)
          .where(eq(schema.boardingDailyLogs.stayId, row.stay.id))
          .orderBy(desc(schema.boardingDailyLogs.logDate))
          .limit(1)
          .then((r) => r[0]);
        return {
          ...row,
          lastLogDate: lastLog?.logDate ?? null,
          /** 超期：预约结束时间已过且未退房 */
          overdue: row.stay.checkoutAt === null && row.appointment.scheduledEnd.getTime() < now,
        };
      }),
    );
    return { board };
  }),

  /**
   * 我的寄养进度（customer 本人 · T2.3 客户端 live 页寄养变体数据源）：
   * 校验预约属本人且 type=boarding，返回 boarding_stays + 该 stay 的
   * boarding_daily_logs（按 log_date 升序；log_date 为 ISO 文本，字典序即时间序）。
   * 尚未入住登记（stay 未创建）时返回 { stay: null, logs: [] }，不视为错误。
   */
  myStay: customerProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const appt = await ctx.db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.id, input.appointmentId))
        .limit(1)
        .then((r) => r[0]);
      if (!appt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
      }
      if (appt.customerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只能查看本人名下的寄养单' });
      }
      if (appt.type !== 'boarding') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '该预约不是寄养单' });
      }

      const stay = await ctx.db
        .select()
        .from(schema.boardingStays)
        .where(eq(schema.boardingStays.appointmentId, appt.id))
        .limit(1)
        .then((r) => r[0]);
      if (!stay) {
        return { stay: null, logs: [] };
      }

      const logs = await ctx.db
        .select()
        .from(schema.boardingDailyLogs)
        .where(eq(schema.boardingDailyLogs.stayId, stay.id))
        .orderBy(asc(schema.boardingDailyLogs.logDate));
      return { stay, logs };
    }),

  /**
   * 员工看寄养单现状（staff 本店 · P3 T3.4 员工端寄养打卡页数据源）：
   * 校验预约属本店且 type=boarding（复用 getBoardingAppointment 的归属/类型校验），
   * 返回 boarding_stays + 该 stay 的 boarding_daily_logs（按 log_date 升序；
   * log_date 为 ISO 文本，字典序即时间序）。
   * 尚未入住登记（stay 未创建）时返回 { stay: null, logs: [] }，不视为错误。
   */
  stayForStaff: staffProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const appt = await getBoardingAppointment(ctx, input.appointmentId);

      const stay = await ctx.db
        .select()
        .from(schema.boardingStays)
        .where(eq(schema.boardingStays.appointmentId, appt.id))
        .limit(1)
        .then((r) => r[0]);
      if (!stay) {
        return { stay: null, logs: [] };
      }

      const logs = await ctx.db
        .select()
        .from(schema.boardingDailyLogs)
        .where(eq(schema.boardingDailyLogs.stayId, stay.id))
        .orderBy(asc(schema.boardingDailyLogs.logDate));
      return { stay, logs };
    }),
});
