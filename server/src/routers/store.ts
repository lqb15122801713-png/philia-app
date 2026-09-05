/**
 * store router（tRPC）—— 门店与服务目录 / 员工管理
 *
 * - store.listNearby：public。入参 lat/lng 可选：有则按 (lat差²+lng差²) 平面近似
 *   粗排（v1 不做球面距离，城区尺度误差可接受），无坐标门店排最后；无则按创建序。
 *   仅 status=active，取前 20。
 * - store.getWithServices：public。门店详情 + active 服务项 + 未来 7 天可约时间槽
 *   （store_slots booked_count < capacity，按 slot_start 升序；传 serviceId 则按
 *   服务时长过滤——需 duration 覆盖的连续 30min 槽位全部有余量才算可约）。
 * - store.upsertService：merchant 本店。新增/编辑服务项（含寄养房型）；越店写 FORBIDDEN。
 * - store.staffList：merchant 本店。员工 + 技能 + 排班 + 绩效（完成单数/好评率，
 *   从 appointments 聚合）。
 * - store.inviteStaff：merchant 本店。生成 8 位去混淆字符邀请码落 staff_invites，
 *   expires_at=+24h，明文仅此一次返回；同店同 staff_name 有未使用未过期码则复用。
 * - store.setSchedule：merchant 本店。写 staff.schedule 周模板 JSON。
 */

import { TRPCError } from '@trpc/server';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { merchantProcedure, publicProcedure, router, type Context } from '../trpc';

/** 时间槽粒度：30min（与 seed 的 store_slots 生成粒度一致） */
const SLOT_MS = 30 * 60 * 1000;

/** 邀请码字符集：去除易混淆字符（0/O/1/I/L） */
const INVITE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_LEN = 8;
const INVITE_TTL_MS = 24 * 3600 * 1000;

function genInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_LEN; i++) {
    code += INVITE_CHARSET[Math.floor(Math.random() * INVITE_CHARSET.length)];
  }
  return code;
}

/** 校验资源属于当前商家门店，否则 FORBIDDEN（merchantProcedure 已保证 storeId 非空） */
function assertOwnStore(ctx: Context & { user: NonNullable<Context['user']> }, storeId: string) {
  if (ctx.user.storeId !== storeId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '只能操作本店资源' });
  }
}

const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '时间格式须为 HH:MM');
const dayValue = z.array(z.object({ start: timeStr, end: timeStr })).max(4).nullable().optional();
/** 周排班模板：{ mon: [{start,end}] | null, ... }，null 表示当日休息 */
const scheduleInput = z.object({
  mon: dayValue,
  tue: dayValue,
  wed: dayValue,
  thu: dayValue,
  fri: dayValue,
  sat: dayValue,
  sun: dayValue,
});

export const storeRouter = router({
  /** 附近门店（geo 粗排，取前 20，仅 active） */
  listNearby: publicProcedure
    .input(
      z
        .object({
          lat: z.number().min(-90).max(90).optional(),
          lng: z.number().min(-180).max(180).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const stores = await ctx.db
        .select()
        .from(schema.stores)
        .where(eq(schema.stores.status, 'active'))
        .orderBy(schema.stores.createdAt);

      const hasGeo =
        input?.lat !== undefined && input?.lng !== undefined;
      if (hasGeo) {
        const { lat, lng } = input as { lat: number; lng: number };
        // v1 粗排：平面近似 (Δlat²+Δlng²)，不做球面距离；无坐标门店排最后
        const key = (s: (typeof stores)[number]) =>
          s.lat === null || s.lng === null
            ? Number.POSITIVE_INFINITY
            : (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
        stores.sort((a, b) => key(a) - key(b));
      }
      return { stores: stores.slice(0, 20) };
    }),

  /** 门店详情 + active 服务项 + 未来 7 天可约时间槽 */
  getWithServices: publicProcedure
    .input(
      z.object({
        storeId: z.string().min(1),
        /** 可选：按服务时长过滤可约槽（需连续槽位均有剩余容量） */
        serviceId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const store = await ctx.db
        .select()
        .from(schema.stores)
        .where(eq(schema.stores.id, input.storeId))
        .limit(1)
        .then((r) => r[0]);
      if (!store) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '门店不存在' });
      }

      const services = await ctx.db
        .select()
        .from(schema.services)
        .where(and(eq(schema.services.storeId, store.id), eq(schema.services.active, true)))
        .orderBy(schema.services.createdAt);

      // 服务时长 → 需要的连续 30min 槽数（boarding 无时长按 1 槽起约）
      let slotsNeeded = 1;
      if (input.serviceId) {
        const svc = services.find((s) => s.id === input.serviceId);
        if (!svc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '服务项不存在或已下架' });
        }
        slotsNeeded = svc.durationMin ? Math.max(1, Math.ceil(svc.durationMin / 30)) : 1;
      }

      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const openSlots = await ctx.db
        .select()
        .from(schema.storeSlots)
        .where(
          and(
            eq(schema.storeSlots.storeId, store.id),
            gt(schema.storeSlots.slotStart, now),
            lt(schema.storeSlots.slotStart, weekLater),
            lt(schema.storeSlots.bookedCount, schema.storeSlots.capacity),
          ),
        )
        .orderBy(schema.storeSlots.slotStart);

      // duration 过滤：从候选起始槽起，后续 slotsNeeded-1 个连续槽（步长 30min）也须有余量
      const openSet = new Map(openSlots.map((s) => [s.slotStart.getTime(), s]));
      const available = openSlots.filter((s) => {
        const t0 = s.slotStart.getTime();
        for (let i = 1; i < slotsNeeded; i++) {
          if (!openSet.has(t0 + i * SLOT_MS)) return false;
        }
        return true;
      });

      return { store, services, slots: available };
    }),

  /**
   * 门店在职员工公开列表（public，T2.2 追加）：客户端预约「选员工」用。
   * 现状 staffList 为 merchantProcedure 客户调不了，故开此只读公开过程，
   * 仅暴露 id/name/skills（不含排班、绩效、userId 等内部字段）。
   */
  listStaffPublic: publicProcedure
    .input(z.object({ storeId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const staffRows = await ctx.db
        .select({ id: schema.staff.id, name: schema.staff.name, skills: schema.staff.skills })
        .from(schema.staff)
        .where(and(eq(schema.staff.storeId, input.storeId), eq(schema.staff.status, 'active')))
        .orderBy(schema.staff.createdAt);
      return { staff: staffRows };
    }),

  /** 新增/编辑服务项或寄养房型（merchant 本店） */
  upsertService: merchantProcedure
    .input(
      z.object({
        id: z.string().min(1).optional(),
        type: z.enum(['grooming', 'boarding'], { message: '服务大类仅支持 grooming/boarding' }),
        name: z.string().trim().min(1, '服务名称不能为空').max(64),
        durationMin: z.number().int().positive().max(24 * 60).optional(),
        priceFen: z.number().int().min(0, '价格不能为负'),
        boardingRoomType: z.string().trim().max(32).optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const now = new Date();
      if (fields.type !== 'boarding' && fields.boardingRoomType) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '仅寄养类服务可设置房型' });
      }

      if (id) {
        const existing = await ctx.db
          .select()
          .from(schema.services)
          .where(eq(schema.services.id, id))
          .limit(1)
          .then((r) => r[0]);
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '服务项不存在' });
        }
        assertOwnStore(ctx, existing.storeId);
        const [updated] = await ctx.db
          .update(schema.services)
          .set({ ...fields, updatedAt: now })
          .where(eq(schema.services.id, id))
          .returning();
        return { service: updated, created: false as const };
      }

      const [created] = await ctx.db
        .insert(schema.services)
        .values({ ...fields, storeId: ctx.user.storeId! })
        .returning();
      return { service: created, created: true as const };
    }),

  /** 员工列表 + 技能/排班 + 绩效占位（完成单数/好评率，从 appointments 聚合） */
  staffList: merchantProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const staffRows = await ctx.db
      .select()
      .from(schema.staff)
      .where(eq(schema.staff.storeId, storeId))
      .orderBy(schema.staff.createdAt);

    const appts = await ctx.db
      .select({
        staffId: schema.appointments.staffId,
        status: schema.appointments.status,
        rating: schema.appointments.rating,
      })
      .from(schema.appointments)
      .where(eq(schema.appointments.storeId, storeId));

    // 按员工聚合绩效：完成单数、评分数、好评数（评分≥4）、平均分
    const statsByStaff = new Map<
      string,
      { completedCount: number; ratedCount: number; goodCount: number; ratingSum: number }
    >();
    for (const a of appts) {
      if (!a.staffId) continue;
      const s = statsByStaff.get(a.staffId) ?? {
        completedCount: 0,
        ratedCount: 0,
        goodCount: 0,
        ratingSum: 0,
      };
      if (a.status === 'completed') s.completedCount += 1;
      if (a.rating !== null) {
        s.ratedCount += 1;
        s.ratingSum += a.rating;
        if (a.rating >= 4) s.goodCount += 1;
      }
      statsByStaff.set(a.staffId, s);
    }

    return {
      staff: staffRows.map((row) => {
        const s = statsByStaff.get(row.id);
        return {
          ...row,
          stats: {
            completedCount: s?.completedCount ?? 0,
            ratedCount: s?.ratedCount ?? 0,
            /** 好评率：评分≥4 占比；无评分时为 null */
            goodRate: s && s.ratedCount > 0 ? s.goodCount / s.ratedCount : null,
            avgRating: s && s.ratedCount > 0 ? s.ratingSum / s.ratedCount : null,
          },
        };
      }),
    };
  }),

  /**
   * 生成员工邀请码（merchant 本店）：8 位去混淆字符，24h 有效、单次使用。
   * 明文码仅此一次返回（响应里带提示）；同店同 staff_name 存在未使用未过期码则复用，不重复建行。
   */
  inviteStaff: merchantProcedure
    .input(z.object({ staffName: z.string().trim().min(1, '员工姓名不能为空').max(32) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();

      // 复用：同店同名、未使用、未过期
      const existing = await ctx.db
        .select()
        .from(schema.staffInvites)
        .where(
          and(
            eq(schema.staffInvites.storeId, storeId),
            eq(schema.staffInvites.staffName, input.staffName),
            isNull(schema.staffInvites.usedAt),
            gt(schema.staffInvites.expiresAt, now),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (existing) {
        return {
          code: existing.code,
          expiresAt: existing.expiresAt,
          reused: true as const,
          notice: '该员工已有有效邀请码，已复用；邀请码明文仅在此处展示，请妥善转交',
        };
      }

      // 生成唯一码（全局唯一约束兜底，冲突重试）
      let invite: typeof schema.staffInvites.$inferSelect | undefined;
      for (let attempt = 0; attempt < 5 && !invite; attempt++) {
        const code = genInviteCode();
        const clash = await ctx.db
          .select({ id: schema.staffInvites.id })
          .from(schema.staffInvites)
          .where(eq(schema.staffInvites.code, code))
          .limit(1)
          .then((r) => r[0]);
        if (clash) continue;
        const [row] = await ctx.db
          .insert(schema.staffInvites)
          .values({
            storeId,
            code,
            staffName: input.staffName,
            expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
            createdBy: ctx.user.id,
          })
          .returning();
        invite = row;
      }
      if (!invite) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '邀请码生成失败，请重试' });
      }
      return {
        code: invite.code,
        expiresAt: invite.expiresAt,
        reused: false as const,
        notice: '邀请码 24 小时内有效、仅可使用一次；明文仅此一次展示，请妥善转交',
      };
    }),

  /** 写员工周排班模板（merchant 本店） */
  setSchedule: merchantProcedure
    .input(z.object({ staffId: z.string().min(1), schedule: scheduleInput }))
    .mutation(async ({ ctx, input }) => {
      const staffRow = await ctx.db
        .select()
        .from(schema.staff)
        .where(eq(schema.staff.id, input.staffId))
        .limit(1)
        .then((r) => r[0]);
      if (!staffRow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '员工不存在' });
      }
      assertOwnStore(ctx, staffRow.storeId);

      const [updated] = await ctx.db
        .update(schema.staff)
        .set({
          schedule: input.schedule as schema.StaffSchedule,
          updatedAt: new Date(),
        })
        .where(eq(schema.staff.id, staffRow.id))
        .returning();
      return { staff: updated };
    }),
});
