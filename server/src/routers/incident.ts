/**
 * incident router（tRPC）—— 客户端体验大批片 4 · 服务异常即时通报域（新域起建）
 *
 * 盘点表 B16/B18 差额：受伤/应激/就医三类异常原仓零命中（无此域级）。
 * - incident.report：staff 本店任意店员填报（安全动作=班次共享，同 dailyLog 口径）；
 *   预约须在服务中（in_service）或寄养中（in_boarding）。落行同事务发
 *   incident.reported → appointment 频道（解析=主人+门店商家+被指员工，**双通知
 *   0 分钟达标**——主人端通知落行 + 门店端通知落行；不接短信/微信外发=候资质，
 *   开工令开口项 1 裁），broadcastNow 即时推送 live 页高亮。
 * - incident.listForAppointment：预约当事人可读（本人客户/本店员工/本店商家，
 *   复用 assertAppointmentAccess）——live 页异常高亮条数据源。
 * - incident.listMine：customer 本人异常通报列表（跨单，创建倒序）。
 * - incident.markHandled：merchant 本店 owner|manager 处置（handled_at/note/by
 *   只增不改；已处置幂等返回现状）；同事务发 incident.handled → appointment 频道。
 * - 15 分钟升级：落行超 incident_escalate_minutes（service_rules 端口缺省 15）
 *   未处置 → services/careReminders.ts sweepIncidentEscalations 升级再通知一轮
 *   （主人+门店）并置 escalated_at（幂等锚）。
 */

import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent, type Db as BusDb } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  assertAppointmentAccess,
  merchantManagerProcedure,
  publicProcedure,
  router,
  staffProcedure,
} from '../trpc';

/** emitEvent 首参类型收窄（同 serviceStep.ts 惯例） */
const txBus = (tx: unknown): BusDb => tx as BusDb;

/** 异常类型枚举（与 schema 注记同帧） */
const incidentType = z.enum(['injury', 'stress', 'vet_visit'], {
  message: '异常类型仅支持 injury/stress/vet_visit',
});

/** 异常类型中文名（通知文案/透出共用） */
export const IncidentTypeLabel: Record<string, string> = {
  injury: '受伤',
  stress: '应激',
  vet_visit: '就医',
};

export const incidentRouter = router({
  /**
   * 异常填报（staff 本店任意店员；安全动作豁免归属，同 boarding.dailyLog 口径）。
   * 状态闸：仅 in_service / in_boarding 可填报（其他状态无服务现场）。
   */
  report: staffProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        type: incidentType,
        description: z.string().trim().min(1, '情况描述不能为空').max(500),
        /** 发生时间（缺省=填报时刻；回填历史可传，不许晚于当前） */
        occurredAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appt = await ctx.db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.id, input.appointmentId))
        .limit(1)
        .then((r) => r[0]);
      if (!appt) throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
      if (ctx.user.storeId !== appt.storeId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作非本店预约' });
      }
      if (appt.status !== 'in_service' && appt.status !== 'in_boarding') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `预约当前状态为 ${appt.status}，仅服务中/寄养中可填报异常`,
        });
      }
      const now = new Date();
      const occurredAt = input.occurredAt ?? now;
      if (occurredAt.getTime() > now.getTime()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '发生时间不能晚于当前时刻' });
      }
      const pet = await ctx.db
        .select({ name: schema.pets.name })
        .from(schema.pets)
        .where(eq(schema.pets.id, appt.petId))
        .get();

      const { incident, outboxId } = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.serviceIncidents)
          .values({
            appointmentId: appt.id,
            storeId: appt.storeId,
            petId: appt.petId,
            customerId: appt.customerId,
            type: input.type,
            description: input.description,
            occurredAt,
            reportedBy: ctx.user.id,
          })
          .returning();
        // 双通知同事务：appointment 频道一次发射=主人+门店商家+被指员工各落一条通知
        const outboxId = await emitEvent(txBus(tx), `appointment:${appt.id}`, EventType.IncidentReported, {
          appointmentId: appt.id,
          incidentId: row.id,
          incidentType: input.type,
          petName: pet?.name,
        });
        return { incident: row, outboxId };
      });
      broadcastNow(outboxId);
      return { incident };
    }),

  /** 预约维度异常列表（当事人读：本人客户/本店员工/本店商家；live 页高亮条数据源） */
  listForAppointment: publicProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertAppointmentAccess(ctx, input.appointmentId);
      const rows = await ctx.db
        .select()
        .from(schema.serviceIncidents)
        .where(eq(schema.serviceIncidents.appointmentId, input.appointmentId))
        .orderBy(desc(schema.serviceIncidents.createdAt))
        .limit(50);
      return { incidents: rows };
    }),

  /** 本人异常通报列表（customer；创建倒序，上限 50） */
  listMine: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.serviceIncidents)
      .where(eq(schema.serviceIncidents.customerId, ctx.user.id))
      .orderBy(desc(schema.serviceIncidents.createdAt))
      .limit(50);
    return { incidents: rows };
  }),

  /**
   * 处置登记（merchant 本店 owner|manager）：handled_at/note/by 落行（只增不改）。
   * 幂等：已处置直接返回现状，不重复写库/发事件。
   */
  markHandled: merchantManagerProcedure
    .input(
      z.object({
        incidentId: z.string().min(1),
        note: z.string().trim().min(1, '处置说明不能为空').max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db
        .select()
        .from(schema.serviceIncidents)
        .where(eq(schema.serviceIncidents.id, input.incidentId))
        .limit(1)
        .then((r) => r[0]);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '异常通报不存在' });
      if (row.storeId !== ctx.user.storeId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '非本店通报，无权处置' });
      }
      if (row.handledAt) return { incident: row, alreadyHandled: true as const };

      const now = new Date();
      const { incident, outboxId } = await ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(schema.serviceIncidents)
          .set({ handledAt: now, handledNote: input.note, handledBy: ctx.user.id, updatedAt: now })
          .where(eq(schema.serviceIncidents.id, row.id))
          .returning();
        const pet = await tx
          .select({ name: schema.pets.name })
          .from(schema.pets)
          .where(eq(schema.pets.id, row.petId))
          .get();
        const outboxId = await emitEvent(txBus(tx), `appointment:${row.appointmentId}`, EventType.IncidentHandled, {
          appointmentId: row.appointmentId,
          incidentId: row.id,
          incidentType: row.type,
          petName: pet?.name,
        });
        return { incident: updated, outboxId };
      });
      broadcastNow(outboxId);
      return { incident, alreadyHandled: false as const };
    }),
});

export type IncidentRouter = typeof incidentRouter;
