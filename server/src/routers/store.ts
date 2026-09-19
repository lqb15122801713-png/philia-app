/**
 * store router（tRPC）—— 门店与服务目录 / 员工管理
 *
 * - store.listNearby：public。入参 lat/lng 可选：有则按 (lat差²+lng差²) 平面近似
 *   粗排（v1 不做球面距离，城区尺度误差可接受），无坐标门店排最后；无则按创建序。
 *   仅 status=active，取前 20。
 * - store.getWithServices：public。门店详情 + active 服务项 + 可约时间槽（今天起 7 天
 *   按营业时间合成 30min 栅格；统一剔除「当前时间 +1h 缓冲」内时段——B3-5 W-2，
 *   与 assertBookableTime 同口径；传 serviceId 则按服务时长过滤——需 duration 覆盖的
 *   连续区间全程可约；B9a 任务 C：可选 petId——逐服务输出时长引擎结果
 *   serviceDurations 并以引擎时长做连续性过滤，不传 petId 行为不变）。
 *   批次 S4（任务 B · 可用性引擎）：可约判定改为「目标服务区间有 ≥1 名 groomer
 *   空闲」（role=groomer + active + 排班覆盖 + 无冲突预约），时段容量=空闲 groomer
 *   数（动态，查询时计算）；store_slots 降级为占用记录，不再参与可约判定；
 *   寄养 boarding_slots 按晚口径不动。
 * - store.upsertService：merchant 本店。新增/编辑服务项（含寄养房型）；越店写 FORBIDDEN。
 * - store.staffList：merchant 本店。员工 + 技能 + 排班 + 绩效（完成单数/好评率，
 *   从 appointments 聚合）。
 * - store.inviteStaff：merchant 本店。生成 8 位去混淆字符邀请码落 staff_invites，
 *   expires_at=+24h，明文仅此一次返回；同店同 staff_name 同角色有未使用未过期码则复用。
 *   批次 S1：可指定预置角色 role（frontdesk|groomer，缺省 groomer），bindStaff 兑现时写入 staff.role。
 * - store.setSchedule：merchant 本店。写 staff.schedule 周模板 JSON。
 * - store.setStaffStatus（v1.1 P1-2 追加）：merchant 本店。停职/恢复员工
 *   （staff.status=active|suspended），停职由 staffProcedure 每请求校验即时生效。
 * - store.updateStaff（批次 S1 任务 D）：merchant 本店。更新员工岗位角色 role
 *   （frontdesk|groomer）与在职状态 status（active|suspended），二者至少传一；
 *   技能标签 skills 本批不可改（留 S4）；越店写 FORBIDDEN。
 * - store.financeStats（T4.4 · MERCHANT-CONTRACTS）：merchant 本店。入参 {from,to}；
 *   区间服务收入（appointments paid_fen 按 paid_at 合计）/ 商城收入（v1 恒 0，P5 接
 *   orders）/ 按日分组序列 / 收款方式拆分 / 员工维度（完成单数·服务金额·平均评分·
 *   好评率）/ 待收款（completed 未 paid 明细+合计）。
 *   对账一致性：区间服务收入 = 按日序列 serviceFen 之和 = 员工维度 serviceFen 之和
 *   = 收款方式拆分两桶之和——四者全部由同一份「区间内已收款预约」行集在内存聚合，
 *   无二次查询，天然相等。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gt, gte, inArray, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { merchantManagerProcedure, merchantOwnerProcedure, merchantProcedure, publicProcedure, router, type Context } from '../trpc';
import { resolveServiceDuration, type ServiceDuration } from '../config/durationEngine';
import { boardingNightDates, BOOKING_LEAD_BUFFER_MS, DEFAULT_BOARDING_ROOM_COUNT, freeGroomersInInterval, loadGroomerOccupancy, storeDayStartMs, storeWallclock } from './appointment';
import { computeDayTender, loadCashierFinance, type DayTenderStats } from './cashier';

/** 时间槽粒度：30min（与 seed 的 store_slots 生成粒度一致） */
const SLOT_MS = 30 * 60 * 1000;

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

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

/** 当日 0 点（门店规范时区 +8，与 computeDayTender / bill_no / 财务 byDay 日界同帧） */
function storeTodayStart(now: Date): Date {
  const w = storeWallclock(now);
  return new Date(storeDayStartMs(w.y, w.m, w.day));
}

/**
 * 营业额可见性（M1-补2 · 矩阵会签稿总规则②「店员不看营业额」）：
 * owner|manager 可见；仅 clerk 角色的账号在聚合出口被遮罩（分角色渲染的服务端硬闸，
 * 前端隐藏只是体验层）。
 */
function canSeeTurnover(ctx: Context & { user: NonNullable<Context['user']> }): boolean {
  return ctx.user.roles.includes('merchant_owner') || ctx.user.roles.includes('merchant_manager');
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
        /**
         * 可选（B9a 任务 C）：宠物 ID——传入时按该宠物档案经时长引擎计算各服务
         * 时长（响应扩展 serviceDurations；可约槽「时长连续」过滤的 slotsNeeded
         * 随之改用引擎输出）。不传时行为与之前完全一致（按 services.duration_min）。
         * 本接口为公开只读：仅回传时长数值（分钟），不回传宠物档案任何字段。
         */
        petId: z.string().min(1).optional(),
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

      // B9a 任务 C：petId 传入时取宠物档案（物种/体重/品种）供时长引擎推导；
      // 查不到按「无档案」回退默认时长（不阻断查询）
      const pet = input.petId
        ? ((await ctx.db
            .select({
              species: schema.pets.species,
              breed: schema.pets.breed,
              weightKg: schema.pets.weightKg,
            })
            .from(schema.pets)
            .where(eq(schema.pets.id, input.petId))
            .get()) ?? null)
        : null;
      /** 逐服务引擎时长（仅 petId 传入时输出；boarding 项 durationMin 恒 null） */
      const serviceDurations: Record<string, ServiceDuration> | null = input.petId
        ? Object.fromEntries(services.map((s) => [s.id, resolveServiceDuration(s, pet)]))
        : null;

      // 服务时长 → 需要的连续 30min 槽数（boarding 无时长按 1 槽起约；
      // B9a 任务 C：petId 传入时改用引擎输出时长，引擎回退时与服务默认 durationMin 同值）
      let slotsNeeded = 1;
      if (input.serviceId) {
        const svc = services.find((s) => s.id === input.serviceId);
        if (!svc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '服务项不存在或已下架' });
        }
        slotsNeeded =
          serviceDurations?.[svc.id]?.slotsNeeded ??
          (svc.durationMin ? Math.max(1, Math.ceil(svc.durationMin / 30)) : 1);
      }

      const now = new Date();
      /**
       * B3-5（W-2 今天可约口径统一）：可约槽不再依赖 store_slots 预建行——
       * 按门店营业时间合成「今天起 7 天」30min 栅格；统一剔除「当前时间 +1h 缓冲」
       * 内的时段（与 assertBookableTime 同一条线，前后端同拦）。休息日不产生槽位。
       * B8-B4：栅格墙钟改用门店规范时区（storeWallclock/storeDayStartMs，固定 +8）。
       * 批次 S4（任务 B · 可用性引擎）：可约判定从 store_slots 固定容量改为
       * 「该 30min 槽（按时长连续口径的服务区间）有 ≥1 名 groomer 空闲」——
       * 空闲 = role=groomer + status=active + 排班覆盖整个服务区间 + 无冲突预约
       * （非 cancelled 预约区间与目标区间重叠即冲突，含 9a 引擎时长连续占用）；
       * 时段容量 = 空闲 groomer 数（动态，随派单/改期/取消实时变化，查询时计算）；
       * 容量耗尽（0 名空闲）= 不显示为可约（日期层「约满」标签沿用）。
       * store_slots（booked_count/capacity 固定值）自此降级为占用记录——
       * create/cancel/reschedule 继续维护供报表与防回归，不再参与可约判定。
       * 寄养 boarding_slots 按晚容量口径不动（boardingAvailability）。
       */
      const nowWc = storeWallclock(now);
      const day0ms = storeDayStartMs(nowWc.y, nowWc.m, nowWc.day);
      const gridEnd = day0ms + 7 * 24 * 3600 * 1000;
      // S4：一次性取 7 天窗口的 groomer 占用快照，逐槽内存计算空闲数（不做缓存表）
      const occupancy = await loadGroomerOccupancy(ctx.db, store.id, day0ms, gridEnd);

      const earliest = now.getTime() + BOOKING_LEAD_BUFFER_MS;
      const openSlots: (typeof schema.storeSlots.$inferSelect)[] = [];
      for (let i = 0; i < 7; i++) {
        const dateMs = day0ms + i * 24 * 3600 * 1000;
        const dow = storeWallclock(new Date(dateMs)).dow;
        const hours = store.openHours?.[DAY_KEYS[dow]!];
        if (!hours) continue;
        const [oh = 0, om = 0] = hours.open.split(':').map(Number);
        const [ch = 0, cm = 0] = hours.close.split(':').map(Number);
        for (let min = oh * 60 + om; min + slotsNeeded * 30 <= ch * 60 + cm; min += 30) {
          const t = new Date(dateMs + min * 60_000);
          if (t.getTime() < earliest) continue; // +1h 缓冲内（含已过期）时段不可约
          // S4 任务 B：目标区间 = 自该槽起 slotsNeeded 个连续 30min（9a 时长连续口径），
          // 全程有 ≥1 名 groomer 空闲才可约；容量 = 空闲 groomer 数（动态）
          const freeCount = freeGroomersInInterval(
            occupancy,
            t.getTime(),
            t.getTime() + slotsNeeded * SLOT_MS,
          ).length;
          if (freeCount < 1) continue; // 容量耗尽 = 不显示为可约
          // 槽位行为合成行（id 以 virtual: 前缀标识非持久行；capacity=动态空闲 groomer 数）
          openSlots.push({
            id: `virtual:${store.id}:${t.getTime()}`,
            storeId: store.id,
            slotStart: t,
            capacity: freeCount,
            bookedCount: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      return { store, services, slots: openSlots, serviceDurations };
    }),

  /**
   * 寄养房型逐晚余量（public · v1.1-b3 B3-2 W-12）：入参 from/to（晚 = from 日
   * 到 to 日前一日，本地日界，与 appointment.create 的 boarding 占晚口径一致），
   * 返回该店全部在架寄养房型的逐晚 remaining（capacity − booked_count；
   * 无槽位行 = 该晚尚未被订，按房型房间数满额计）。
   * 客户端寄养向导房型卡据此展示「剩余 N 间」（已选区间取最小剩余 /
   * 未选日期取今晚）。区间上限 31 晚（向导最长 14 晚，留余量防爆量查询）。
   */
  boardingAvailability: publicProcedure
    .input(z.object({ storeId: z.string().min(1), from: z.date(), to: z.date() }))
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
      const nights = boardingNightDates(input.from, input.to);
      if (nights.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '查询区间须至少覆盖 1 晚（to 须晚于 from）' });
      }
      if (nights.length > 31) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '查询区间最长 31 晚' });
      }
      const boardingServices = await ctx.db
        .select({ id: schema.services.id, roomCount: schema.services.roomCount })
        .from(schema.services)
        .where(
          and(
            eq(schema.services.storeId, store.id),
            eq(schema.services.type, 'boarding'),
            eq(schema.services.active, true),
          ),
        )
        .orderBy(schema.services.createdAt);
      const rows = await ctx.db
        .select()
        .from(schema.boardingSlots)
        .where(
          and(
            eq(schema.boardingSlots.storeId, store.id),
            inArray(schema.boardingSlots.nightDate, nights),
          ),
        );
      const byKey = new Map(rows.map((r) => [`${r.serviceId}|${r.nightDate}`, r]));
      return {
        nights,
        services: boardingServices.map((s) => {
          const full = s.roomCount ?? DEFAULT_BOARDING_ROOM_COUNT;
          return {
            serviceId: s.id,
            roomCount: full,
            /** 与 nights 等长逐晚剩余间数 */
            remaining: nights.map((n) => {
              const row = byKey.get(`${s.id}|${n}`);
              return row ? row.capacity - row.bookedCount : full;
            }),
          };
        }),
      };
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

  /** 新增/编辑服务项或寄养房型（仅店主 · M1-补2 条件①：商品与服务定价管理仅老板，矩阵） */
  upsertService: merchantOwnerProcedure
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

  /** 员工列表 + 技能/排班 + 绩效占位（owner|manager · M1-补2 条件①：员工花名册 clerk 403） */
  staffList: merchantManagerProcedure.query(async ({ ctx }) => {
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
  inviteStaff: merchantOwnerProcedure // M1-补2 条件①：员工账号创建仅老板（矩阵）
    .input(
      z.object({
        staffName: z.string().trim().min(1, '员工姓名不能为空').max(32),
        /** 批次 S1：邀请时预置岗位角色（frontdesk=前台 / groomer=美容师），缺省 groomer */
        role: z.enum(['frontdesk', 'groomer']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      const role = input.role ?? 'groomer';

      // 复用：同店同名同角色、未使用、未过期（角色不同则另发新码，保证预置角色生效）
      const existing = await ctx.db
        .select()
        .from(schema.staffInvites)
        .where(
          and(
            eq(schema.staffInvites.storeId, storeId),
            eq(schema.staffInvites.staffName, input.staffName),
            eq(schema.staffInvites.role, role),
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
            role,
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

  /** 写员工周排班模板（owner|manager 本店 · M1-补2 条件①：排班维护 manager 本店，clerk 403） */
  setSchedule: merchantManagerProcedure
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
   * 停职/恢复员工（merchant 本店 · v1.1 P1-2）：写 staff.status（active|suspended），
   * updated_at 显式写。停职即时生效——staffProcedure 每请求校验在职状态，
   * 同会话下一请求即 403。现状没有任何停职入口，本接口是让「停职」可发生的最小接口。
   */
  setStaffStatus: merchantOwnerProcedure // M1-补2 条件①：员工账号停用仅老板（矩阵）
    .input(z.object({ staffId: z.string().min(1), status: z.enum(['active', 'suspended']) }))
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
      assertOwnStore(ctx, staffRow.storeId); // 越店停职 FORBIDDEN

      const [updated] = await ctx.db
        .update(schema.staff)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(schema.staff.id, staffRow.id))
        .returning();
      return { staff: updated };
    }),

  /**
   * 更新员工岗位角色与在职状态（merchant 本店 · 批次 S1 任务 D）。
   * 入参 {staffId, role?, status?}：仅 role（frontdesk|groomer）与 status（active|suspended）
   * 可改，二者至少传一；技能标签 skills 本批不可改（留 S4 派单批）；越店写 FORBIDDEN。
   * 生效口径：核销角色判定（assertFrontdeskStaff）与 staffProcedure 在职校验均每请求查库，
   * 员工端 auth.me 下次拉取即见新角色——无需等会话过期。
   */
  updateStaff: merchantOwnerProcedure // M1-补2 条件①：岗位角色/在职状态=账号管理，仅老板（矩阵）
    .input(
      z.object({
        staffId: z.string().min(1),
        role: z.enum(['frontdesk', 'groomer']).optional(),
        status: z.enum(['active', 'suspended']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.role === undefined && input.status === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'role 与 status 至少传一项' });
      }
      const staffRow = await ctx.db
        .select()
        .from(schema.staff)
        .where(eq(schema.staff.id, input.staffId))
        .limit(1)
        .then((r) => r[0]);
      if (!staffRow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '员工不存在' });
      }
      assertOwnStore(ctx, staffRow.storeId); // 越店写 FORBIDDEN

      const [updated] = await ctx.db
        .update(schema.staff)
        .set({
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.staff.id, staffRow.id))
        .returning();
      return { staff: updated };
    }),

  /**
   * 财务报表统计（merchant 本店 · T4.4）。
   * M1-补2 R2：闸门升档 merchantManagerProcedure（owner|manager；矩阵会签稿
   * 「财务流水·查看」店员 ❌，总规则②店员不看营业额）；M1-补2 R1：响应增
   * todayTender 块（今日已收统一聚合出口，与收银台头部/经营总览同源同值）。
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
  financeStats: merchantManagerProcedure
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

      /* M1-补2 R1：财务页头部「今日已收」统一出口（与收银台头部/经营总览同源，
       * 同函数 computeDayTender 同字段 todayTender；UI 阶段改接，禁止页面自算）。
       * 店员不可达本端点（merchantManagerProcedure，矩阵：财务流水·查看 clerk ❌）。 */
      const todayTender: DayTenderStats = await computeDayTender(ctx.db, storeId, storeTodayStart(new Date()));

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

      /** 日期键 YYYY-MM-DD（B8 裁定②：门店规范时区 +8 展示口径——仅按日分组展示，
       *  不改 paidAt 存储与区间过滤；复用 appointment.ts storeWallclock/storeDayStartMs） */
      const dayKey = (d: Date): string => {
        const w = storeWallclock(d);
        const m = String(w.m).padStart(2, '0');
        const day = String(w.day).padStart(2, '0');
        return `${w.y}-${m}-${day}`;
      };

      // 按日序列：先把 [from, to) 每一天铺 0，再累加，保证序列连续无洞（日界同 +8 口径）
      const byDayMap = new Map<string, { date: string; serviceFen: number; shopFen: number }>();
      const fromWc = storeWallclock(from);
      for (let ms = storeDayStartMs(fromWc.y, fromWc.m, fromWc.day); ms < to.getTime(); ms += 24 * 3600 * 1000) {
        const key = dayKey(new Date(ms));
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

      /* ---- 批次 M1：收银台并入（口径见 cashier.ts loadCashierFinance 头注） ----
       * - 已收：settled 单的「自有口径」（服务/商品行，预约行金额由预约翻转口径
       *   认领，禁止双头记账）按支付段 createdAt 逐段认领，落 [from,to) 区间与
       *   byDay 日格；服务/商品按「优惠先抵服务、收款先认服务」拆分。
       *   fix（M1 UI 集成）：已收=现金类（cash/wechat/alipay）实收，次卡扣次等值
       *   不进 serviceFen/shopFen（防 paidFen=payableFen 口径下双计），passFen
       *   单列（cashierPassFen / cashierLedger.passFen）供对账，对齐 U3「次卡扣次
       *   非现金」口径。
       * - shopFen 自本批起接实口径（收银商品行已收；商城 orders 仍无 paid_at 口径）。
       * - M1-补1：「记账 credit」已删——收银单无待收态，待收口径回归预约域
       *   （pendingPayment* 仅 completed 未 paid 预约，cashierPending 并入逻辑删除）。
       */
      const cashierFin = await loadCashierFinance(ctx.db, storeId);
      let cashierServiceFen = 0;
      let cashierShopFen = 0;
      let cashierPassFen = 0; // 区间内收银次卡扣次认领额（非现金，不计入已收营业额）
      const cashierLedger: Array<{
        billNo: string;
        time: Date | null;
        buyer: string;
        summary: string;
        itemCount: number;
        methods: string[];
        payableFen: number;
        /** 已收（现金类实收 cash/wechat/alipay，不含次卡扣次等值——fix 双计修订） */
        receivedFen: number;
        /** 次卡扣次等值（非现金，单列供对账，对齐 U3「次卡扣次非现金」口径） */
        passFen: number;
        source: 'cashier';
      }> = [];
      for (const cf of cashierFin) {
        for (const r of cf.recognized) {
          if (r.at.getTime() >= from.getTime() && r.at.getTime() < to.getTime()) {
            cashierServiceFen += r.serviceFen;
            cashierShopFen += r.shopFen;
            cashierPassFen += r.passFen;
            const cell = byDayMap.get(dayKey(r.at));
            if (cell) {
              cell.serviceFen += r.serviceFen;
              cell.shopFen += r.shopFen;
            }
          }
        }
        if (
          cf.bill.settledAt &&
          cf.bill.settledAt.getTime() >= from.getTime() &&
          cf.bill.settledAt.getTime() < to.getTime()
        ) {
          cashierLedger.push({
            billNo: cf.bill.billNo,
            time: cf.bill.settledAt,
            buyer: cf.buyerName,
            summary: cf.summary,
            itemCount: cf.itemCount,
            methods: cf.methods,
            payableFen: cf.bill.payableFen,
            // fix（M1 UI 集成）：已收=现金类实收（不含次卡等值），passFen 单列
            receivedFen: cf.cashLikeFen,
            passFen: cf.passFen,
            source: 'cashier',
          });
        }
      }
      cashierLedger.sort((a, b) => (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0));

      // 已收口径同步：服务收入 += 收银服务行实收；商城收入接收银商品行实收（不再恒 0）
      const serviceTotalFenMerged = serviceTotalFen + cashierServiceFen;
      const shopTotalFen = cashierShopFen;

      return {
        range: { from, to },
        /** M1-补2 R1：今日已收统一聚合（同 store.todayTenderStats 出口同函数同字段） */
        todayTender,
        totals: {
          serviceFen: serviceTotalFenMerged,
          shopFen: shopTotalFen,
          totalFen: serviceTotalFenMerged + shopTotalFen,
          /** 完成单数：区间内完成并收款单数（预约口径，收银单数见 cashierPaidCount） */
          paidCount: paidRows.length,
          pendingPaymentFen,
          pendingPaymentCount: pendingRows.length,
          /** 批次 M1：区间内收银台已结账单单数 */
          cashierPaidCount: cashierLedger.length,
          /** 批次 M1：区间内收银次卡扣次认领额（非现金，fix 后不计入 serviceFen/已收，单列供对账溯源） */
          cashierPassFen,
        },
        /** 按日分组序列（[from,to) 每日一格，无收款日为 0；shopFen 自 M1 接收银实口径） */
        byDay: [...byDayMap.values()],
        /** 收款方式拆分（预约口径两桶互斥穷尽；收银台并入见 cashierLedger/cashierPassFen） */
        paymentSplit: { payAtStore, passDeduct },
        /** 员工维度（同一行集聚合；serviceFen 之和 = 区间预约服务收入） */
        byStaff,
        /** 待收款明细（completed 未 paid，按完成时间倒序，上限 100 条） */
        pendingPayments: pendingRows,
        /** 批次 M1：收银台流水（区间内 settled 单，来源签 'cashier'，按结账时间倒序） */
        cashierLedger,
      };
    }),

  /**
   * 更新本店基础信息（merchant 本店 · T4.3 · MERCHANT-CONTRACTS）。
   * 入参 {name?, address?, lat?, lng?, openHours?}，仅写本店（ctx.user.storeId）字段；
   * 未提供的字段不动；updated_at 显式写（SQLite 无 ON UPDATE）。
   */
  update: merchantOwnerProcedure // M1-补2 条件①：系统设置/门店信息仅老板（矩阵；实测 clerk 越权改名红线修复）
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
   *   批次 S4（任务 A · 免商家确认）：create 落库直接 confirmed，新单的「待确认」数恒 0；
   *   todo.pending 仅计历史 pending 单与客户改期回退 pending 单（不迁移，保留计数与入口），
   *   商家端「待确认」区随任务 D 改标注「已启用自动接单」（不再作待办驱动）。
   *   批次 S4（任务 C/D）：todo.unassigned 口径收窄为 grooming——自动派单后 grooming
   *   单恒有 staff_id（天然恒 0）；boarding 按晚占房无需美容师、不参与派单待办
   *   （商家仍可经 assign 主动指派，但不作待办驱动）。
   * - 异常：超期寄养数（status=in_boarding 且 scheduled_end 已过，应退未退）。
   * 实现：本店预约一次取出在应用层聚合（与 staffList 同模式，v1 数据量级无压力）。
   */
  dashboardStats: merchantManagerProcedure
    .input(z.object({ date: z.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      const dayStart = new Date(input?.date ?? now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

      /* M1-补2 R2：闸门升档 merchantManagerProcedure（矩阵「三店六项日报/看板」店员 ❌）。
       * M1-补2 R1：todayTender = 今日已收统一聚合出口（与收银台头部/财务页头部同源，
       * 同一 computeDayTender 函数；UI 阶段改接后 todayRevenueFen 由本块替代）。
       * 注意：todayRevenueFen 为旧口径字段（含预约域 pass_deduct 已收款等值），
       * 保持语义不变供存量消费；裁定①「已收=现金类」新口径以 todayTender 为准。
       * 日界：本端点统计日沿用本地 0 点（历史口径不动），todayTender 用门店规范
       * 时区 +8 日界（与 bill_no/财务 byDay 同帧；本机 +8 二者同刻）。 */
      const todayTender: DayTenderStats = await computeDayTender(
        ctx.db,
        storeId,
        storeTodayStart(input?.date ?? now),
      );

      const rows = await ctx.db
        .select({
          status: schema.appointments.status,
          staffId: schema.appointments.staffId,
          type: schema.appointments.type,
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
        // S4：待派单仅计 grooming（自动派单后恒 0）；boarding 按晚占房无需美容师，不作待办
        else if (s === 'confirmed' && r.staffId === null && r.type === 'grooming') todo.unassigned += 1;
        else if (s === 'cancel_requested') todo.cancelRequested += 1;
        else if (s === 'completed' && r.paidAt === null) todo.unpaid += 1;
        if (s === 'in_boarding' && r.scheduledEnd < now) overdueBoardingCount += 1;
      }

      const todayCount = DASHBOARD_STATUSES.reduce((n, s) => n + byStatus[s], 0);
      /* ---- 批次 M1：收银台并入（口径见 cashier.ts loadCashierFinance 头注） ----
       * 今日营业额 += 收银已结单按支付段 createdAt 落在统计日的自有口径认领额
       * （服务/商品行；预约行金额已由上面 paidAt 口径认领，不重复计）。
       * M1-补1：「记账 credit」已删——收银单无待收态，todo.unpaid 回归纯预约口径
       * （原收银待收单计数并入逻辑删除）。
       */
      const cashierFin = await loadCashierFinance(ctx.db, storeId);
      for (const cf of cashierFin) {
        for (const r of cf.recognized) {
          if (r.at >= dayStart && r.at < dayEnd) {
            todayRevenueFen += r.serviceFen + r.shopFen;
          }
        }
      }
      return {
        /** 统计日 0 点（本地时区） */
        date: dayStart,
        /** M1-补2 R1：今日已收统一聚合（同 store.todayTenderStats 出口同函数同字段） */
        todayTender,
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

  /**
   * 今日已收·统一聚合出口（M1-补2 R1 · 裁定① · 决策 #33）。
   *
   * 三处同数同源的唯一取数口：经营总览（dashboardStats.todayTender）、收银台头部、
   * 财务页头部（financeStats.todayTender）——同一 computeDayTender 函数，禁止各页自算；
   * 收银台头部 UI 阶段自前端自算（listBills 聚合混入次卡等值，§0 取证 610 错数根因）
   * 改接本端点。
   *
   * 口径（字段语义见 cashier.ts DayTenderStats 头注）：
   * - 已收 = Σ 支付段现金类（cash/wechat/alipay 三分列，receivedTotalFen 可加总核对）；
   *   次卡扣次 passFen / 储值 storedValueFen 参考列单列、永不计入；
   *   rebateFen 回馈金列位预留（决策 #33，恒 0 不实现）；
   * - 笔数 = 合并流水行数（收银 settled 单 + 未经收银台的预约收款）；
   * - voided 单零聚合（回归保护）。
   *
   * 闸门：merchantProcedure（收银员工作面需要调用以渲染头部），但矩阵总规则②
   * 「店员不看营业额」服务端硬遮罩——仅 clerk 角色账号返回 restricted:true 且
   * 金额/笔数全 null（前端据此渲染「—」，分角色渲染的 server 侧对应）。
   */
  todayTenderStats: merchantProcedure
    .input(z.object({ date: z.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const stats = await computeDayTender(
        ctx.db,
        storeId,
        storeTodayStart(input?.date ?? new Date()),
      );
      if (!canSeeTurnover(ctx)) {
        return {
          /** 店员遮罩签（前端渲染「—」；金额/笔数一律 null，不下发） */
          restricted: true as const,
          date: stats.date,
          tender: null,
          receivedTotalFen: null,
          referenceTotalFen: null,
          legacyPayAtStoreFen: null,
          counts: null,
        };
      }
      return { restricted: false as const, ...stats };
    }),
});
