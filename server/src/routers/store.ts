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
 * - store.financeStats（T4.4 · MERCHANT-CONTRACTS）：merchant 本店。入参 {from,to}；
 *   区间服务收入（appointments paid_fen 按 paid_at 合计）/ 商城收入（v1 恒 0，P5 接
 *   orders）/ 按日分组序列 / 收款方式拆分 / 员工维度（完成单数·服务金额·平均评分·
 *   好评率）/ 待收款（completed 未 paid 明细+合计）。
 *   对账一致性：区间服务收入 = 按日序列 serviceFen 之和 = 员工维度 serviceFen 之和
 *   = 收款方式拆分两桶之和——四者全部由同一份「区间内已收款预约」行集在内存聚合，
 *   无二次查询，天然相等。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gt, gte, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { merchantProcedure, publicProcedure, router, type Context } from '../trpc';

/** 时间槽粒度：30min（与 seed 的 store_slots 生成粒度一致） */
const SLOT_MS = 30 * 60 * 1000;

/** 邀请码字符集：去除易混淆字符（0/O/1/I/L） */
const INVITE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_LEN = 8;
const INVITE_TTL_MS = 24 * 3600 * 1000;

/** 预约状态取值（dashboardStats 分状态计数用；与 appointment.ts 的应用层枚举一致） */
const DASHBOARD_STATUSES = [
  'pending',
  'confirmed',
  'in_service',
  'in_boarding',
  'completed',
  'cancel_requested',
  'cancelled',
] as const;

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

const openHourRange = z.object({ open: timeStr, close: timeStr });
/** 营业时间周模板：{ mon: {open,close} | null, ... }，null 表示当日休息 */
const openHoursInput = z.object({
  mon: openHourRange.nullable().optional(),
  tue: openHourRange.nullable().optional(),
  wed: openHourRange.nullable().optional(),
  thu: openHourRange.nullable().optional(),
  fri: openHourRange.nullable().optional(),
  sat: openHourRange.nullable().optional(),
  sun: openHourRange.nullable().optional(),
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

  /**
   * 财务报表统计（merchant 本店 · T4.4）。
   *
   * 口径（前端汇总卡/趋势图/员工表共用同一口径，保证对账一致）：
   * - 收入按「收款时间 paid_at」归属区间 [from, to)；金额取 paid_fen（markPaid 必写，
   *   ?? price_fen 兜底历史脏数据）。
   * - 「完成单数」= 区间内完成并收款的单数（与收入同源，可直接对账）。
   * - 员工维度：同一行集按 staff_id 聚合；未指派员工的已收款单归入「未指派」虚拟行
   *   （staffId=null），故员工金额之和恒等于区间服务收入。
   * - 收款方式拆分：pass_deduct 进次卡桶，其余（含 payment_mode 为 NULL 的历史单）
   *   进到店付桶——两桶互斥且穷尽，合计恒等于服务收入。
   * - 商城收入 v1 恒 0（商城属 P5，orders 尚无 paid_at 口径），结构预留 shopFen。
   * - 待收款：时点待办（completed 且未 paid），与区间无关，全量返回（上限 100 条）。
   */
  financeStats: merchantProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const { from, to } = input;
      if (!(from.getTime() < to.getTime())) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '时间区间无效：from 必须早于 to' });
      }
      const MAX_RANGE_MS = 400 * 24 * 3600 * 1000;
      if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '统计区间最长 400 天' });
      }

      // 同一份数据：区间内已收款预约（服务收入/按日序列/员工维度/收款方式四者共同来源）
      const paidRows = await ctx.db
        .select({
          id: schema.appointments.id,
          staffId: schema.appointments.staffId,
          paidAt: schema.appointments.paidAt,
          paidFen: schema.appointments.paidFen,
          priceFen: schema.appointments.priceFen,
          paymentMode: schema.appointments.paymentMode,
          rating: schema.appointments.rating,
        })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.storeId, storeId),
            gte(schema.appointments.paidAt, from),
            lt(schema.appointments.paidAt, to),
          ),
        );

      /** 本地日期键 YYYY-MM-DD（服务端时区，与前端周期切换同为本地口径） */
      const dayKey = (d: Date): string => {
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
      };

      // 按日序列：先把 [from, to) 每一天铺 0，再累加，保证序列连续无洞
      const byDayMap = new Map<string, { date: string; serviceFen: number; shopFen: number }>();
      for (const d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d < to; d.setDate(d.getDate() + 1)) {
        const key = dayKey(d);
        byDayMap.set(key, { date: key, serviceFen: 0, shopFen: 0 });
      }

      const payAtStore = { count: 0, totalFen: 0 };
      const passDeduct = { count: 0, totalFen: 0 };
      const staffAgg = new Map<
        string | null,
        { completedCount: number; serviceFen: number; ratedCount: number; goodCount: number; ratingSum: number }
      >();

      let serviceTotalFen = 0;
      for (const row of paidRows) {
        const fen = row.paidFen ?? row.priceFen;
        serviceTotalFen += fen;

        if (row.paidAt) {
          const key = dayKey(row.paidAt);
          const cell = byDayMap.get(key);
          // 区间边界防御：paidAt 必在 [from,to) 内，正常必命中；不命中则跳过该日格（总额不受影响）
          if (cell) cell.serviceFen += fen;
        }

        if (row.paymentMode === 'pass_deduct') {
          passDeduct.count += 1;
          passDeduct.totalFen += fen;
        } else {
          // 'pay_at_store' 或 NULL（历史单缺省按到店付口径）
          payAtStore.count += 1;
          payAtStore.totalFen += fen;
        }

        const s = staffAgg.get(row.staffId) ?? {
          completedCount: 0,
          serviceFen: 0,
          ratedCount: 0,
          goodCount: 0,
          ratingSum: 0,
        };
        s.completedCount += 1;
        s.serviceFen += fen;
        if (row.rating !== null) {
          s.ratedCount += 1;
          s.ratingSum += row.rating;
          if (row.rating >= 4) s.goodCount += 1;
        }
        staffAgg.set(row.staffId, s);
      }

      // 员工姓名解析（本店全员；未指派行 staffId=null 在前端显示「未指派」）
      const staffRows = await ctx.db
        .select({ id: schema.staff.id, name: schema.staff.name })
        .from(schema.staff)
        .where(eq(schema.staff.storeId, storeId));
      const staffNameById = new Map(staffRows.map((r) => [r.id, r.name]));

      const byStaff = [...staffAgg.entries()]
        .map(([staffId, s]) => ({
          staffId,
          staffName: staffId === null ? '未指派' : (staffNameById.get(staffId) ?? '已离职员工'),
          completedCount: s.completedCount,
          serviceFen: s.serviceFen,
          avgRating: s.ratedCount > 0 ? s.ratingSum / s.ratedCount : null,
          /** 好评率：评分≥4 占比；无评分 null */
          goodRate: s.ratedCount > 0 ? s.goodCount / s.ratedCount : null,
        }))
        .sort((a, b) => b.serviceFen - a.serviceFen);

      // 待收款：completed 未 paid（时点待办，与统计区间无关）
      const pendingRows = await ctx.db
        .select({
          id: schema.appointments.id,
          code: schema.appointments.code,
          scheduledStart: schema.appointments.scheduledStart,
          completedAt: schema.appointments.completedAt,
          priceFen: schema.appointments.priceFen,
          paymentMode: schema.appointments.paymentMode,
          petName: schema.pets.name,
          serviceName: schema.services.name,
        })
        .from(schema.appointments)
        .innerJoin(schema.pets, eq(schema.appointments.petId, schema.pets.id))
        .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
        .where(
          and(
            eq(schema.appointments.storeId, storeId),
            eq(schema.appointments.status, 'completed'),
            isNull(schema.appointments.paidAt),
          ),
        )
        .orderBy(desc(schema.appointments.completedAt))
        .limit(100);

      const pendingPaymentFen = pendingRows.reduce((sum, r) => sum + r.priceFen, 0);

      // 商城收入：v1 恒 0（P5 商城落地后接 orders 实口径，结构已预留）
      const shopTotalFen = 0;

      return {
        range: { from, to },
        totals: {
          serviceFen: serviceTotalFen,
          shopFen: shopTotalFen,
          totalFen: serviceTotalFen + shopTotalFen,
          /** 完成单数：区间内完成并收款单数（与收入同源） */
          paidCount: paidRows.length,
          pendingPaymentFen,
          pendingPaymentCount: pendingRows.length,
        },
        /** 按日分组序列（[from,to) 每日一格，无收款日为 0；shopFen v1 恒 0） */
        byDay: [...byDayMap.values()],
        /** 收款方式拆分（两桶互斥穷尽，合计 = 服务收入） */
        paymentSplit: { payAtStore, passDeduct },
        /** 员工维度（同一行集聚合；serviceFen 之和 = 区间服务收入） */
        byStaff,
        /** 待收款明细（completed 未 paid，按完成时间倒序，上限 100 条） */
        pendingPayments: pendingRows,
      };
    }),

  /**
   * 更新本店基础信息（merchant 本店 · T4.3 · MERCHANT-CONTRACTS）。
   * 入参 {name?, address?, lat?, lng?, openHours?}，仅写本店（ctx.user.storeId）字段；
   * 未提供的字段不动；updated_at 显式写（SQLite 无 ON UPDATE）。
   */
  update: merchantProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, '门店名称不能为空').max(64).optional(),
        address: z.string().trim().max(255).optional(),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
        openHours: openHoursInput.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 营业时间段校验：非休息日的 open 必须早于 close
      if (input.openHours) {
        for (const [day, range] of Object.entries(input.openHours)) {
          if (range && range.open >= range.close) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `${day} 的开门时间须早于关门时间`,
            });
          }
        }
      }

      const set: {
        name?: string;
        address?: string;
        lat?: number | null;
        lng?: number | null;
        openHours?: schema.StoreOpenHours;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (input.name !== undefined) set.name = input.name;
      if (input.address !== undefined) set.address = input.address;
      if (input.lat !== undefined) set.lat = input.lat;
      if (input.lng !== undefined) set.lng = input.lng;
      if (input.openHours !== undefined) set.openHours = input.openHours as schema.StoreOpenHours;

      const [updated] = await ctx.db
        .update(schema.stores)
        .set(set)
        .where(eq(schema.stores.id, ctx.user.storeId!))
        .returning();
      return { store: updated };
    }),

  /**
   * 仪表盘统计（merchant 本店 · T4.1 · MERCHANT-CONTRACTS）：
   * - 今日预约：scheduled_start 落在统计日 [0点, 次日0点) 的预约，分状态计数 + 总数；
   * - 服务中：in_service + in_boarding 当前在单数（不限今日，寄养可跨天）；
   * - 今日营业额：paid_at 落在统计日的 paid_fen 合计（到店付收款登记口径，单位分）；
   * - 待办（本店全量未处理项，不限今日）：待确认 pending 数 / 待派单 confirmed 且无 staff_id 数 /
   *   取消申请 cancel_requested 数 / 待收款 completed 且未 paid 数，附四项合计 total；
   * - 异常：超期寄养数（status=in_boarding 且 scheduled_end 已过，应退未退）。
   * 实现：本店预约一次取出在应用层聚合（与 staffList 同模式，v1 数据量级无压力）。
   */
  dashboardStats: merchantProcedure
    .input(z.object({ date: z.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      const dayStart = new Date(input?.date ?? now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

      const rows = await ctx.db
        .select({
          status: schema.appointments.status,
          staffId: schema.appointments.staffId,
          scheduledStart: schema.appointments.scheduledStart,
          scheduledEnd: schema.appointments.scheduledEnd,
          paidAt: schema.appointments.paidAt,
          paidFen: schema.appointments.paidFen,
        })
        .from(schema.appointments)
        .where(eq(schema.appointments.storeId, storeId));

      const byStatus = Object.fromEntries(
        DASHBOARD_STATUSES.map((s) => [s, 0]),
      ) as Record<(typeof DASHBOARD_STATUSES)[number], number>;
      let inServiceCount = 0;
      let todayRevenueFen = 0;
      const todo = { pending: 0, unassigned: 0, cancelRequested: 0, unpaid: 0 };
      let overdueBoardingCount = 0;

      for (const r of rows) {
        const s = r.status as (typeof DASHBOARD_STATUSES)[number];
        if (r.scheduledStart >= dayStart && r.scheduledStart < dayEnd && s in byStatus) {
          byStatus[s] += 1;
        }
        if (s === 'in_service' || s === 'in_boarding') inServiceCount += 1;
        if (r.paidAt && r.paidAt >= dayStart && r.paidAt < dayEnd) {
          todayRevenueFen += r.paidFen ?? 0;
        }
        if (s === 'pending') todo.pending += 1;
        else if (s === 'confirmed' && r.staffId === null) todo.unassigned += 1;
        else if (s === 'cancel_requested') todo.cancelRequested += 1;
        else if (s === 'completed' && r.paidAt === null) todo.unpaid += 1;
        if (s === 'in_boarding' && r.scheduledEnd < now) overdueBoardingCount += 1;
      }

      const todayCount = DASHBOARD_STATUSES.reduce((n, s) => n + byStatus[s], 0);
      return {
        /** 统计日 0 点（本地时区） */
        date: dayStart,
        /** 今日预约总数（全部状态合计） */
        todayCount,
        /** 今日预约分状态计数 */
        byStatus,
        /** 服务中数量（in_service + in_boarding，不限今日） */
        inServiceCount,
        /** 今日营业额（分）：paid_at 落在统计日的 paid_fen 合计 */
        todayRevenueFen,
        /** 待办：四项明细 + 合计 */
        todo: {
          ...todo,
          total: todo.pending + todo.unassigned + todo.cancelRequested + todo.unpaid,
        },
        /** 异常：超期寄养数（应退未退） */
        overdueBoardingCount,
      };
    }),
});
