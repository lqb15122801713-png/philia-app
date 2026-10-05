/**
 * report tRPC router —— 客户端体验大批片 5：尾牙读口 5 + 报表目录 17 张点亮（W-13）
 *
 * 铁规与口径（任务书冻结版 V1.0 + 开工令-1005-片 5）：
 * - 单店口径写死（ctx.user.storeId 过滤全表；连锁预留注记——多店合批另批）；
 * - 涉钱零新规：全部为读口径，不写账；营收口径与 financeStats 同源（appointments
 *   paid_at + 收银 recognized 现金类段，次卡/储值/回馈金三段非现金单列不计已收）；
 * - 导出 CSV 仅店主（总规则③）：exportCsv 一口径派发 17 张同闸，clerk/manager 403；
 * - N6 海底捞铁规（附录 B）：申诉通道（metric_appeals 进审批队列）+数据错误兜底
 *   （approved 申诉读口径即时扣减+correction_json 前后值留痕+报表明示纠错数）——
 *   两件配齐故 N6 点亮（不配齐只置灰的闸门在 N6 读口 gate 字段透出）；
 * - N7/N8=埋点预埋不出表：content_events 底座+track 写口+stats 读数有效性实证；
 * - 时刻口径：月界/日界=门店规范时区 +8（storeDayStartMs/storeWallclock）。
 */

import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent, type Db as BusDb } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { storeDayStartMs, storeWallclock } from './appointment';
import { loadCashierFinance } from './cashier';
import {
  merchantManagerProcedure,
  merchantOwnerProcedure,
  publicProcedure,
  router,
  staffProcedure,
} from '../trpc';

/* ------------------------------------------------------------------ */
/* 常量与工具                                                            */
/* ------------------------------------------------------------------ */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthInput = z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') });

/** 门店时区月界 [from, to)（ms epoch） */
function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  const from = new Date(storeDayStartMs(y, m, 1));
  const to = m === 12 ? new Date(storeDayStartMs(y + 1, 1, 1)) : new Date(storeDayStartMs(y, m + 1, 1));
  return { from, to };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const dayKeyOf = (d: Date): string => {
  const w = storeWallclock(d);
  return `${w.y}-${pad2(w.m)}-${pad2(w.day)}`;
};

/** 上月/去年同月 */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${pad2((t % 12) + 1)}`;
}

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}

/* ------------------------------------------------------------------ */
/* 营收同源聚合（与 store.financeStats 同一口径：预约 paid_at + 收银        */
/* recognized 现金类段；次卡/储值/回馈金=非现金单列，永不计入已收）            */
/* ------------------------------------------------------------------ */

interface RevenueAgg {
  serviceFen: number;
  shopFen: number;
  /** 非现金单列（对账参考，不进已收） */
  passFen: number;
  storedValueFen: number;
  rebateFen: number;
  paidCount: number;
  byDay: Map<string, { date: string; serviceFen: number; shopFen: number }>;
}

/** 区间营收聚合（[from,to)；byDay 铺洞连续） */
async function revenueInRange(
  db: Parameters<typeof loadCashierFinance>[0],
  storeId: string,
  from: Date,
  to: Date,
): Promise<RevenueAgg> {
  const paidRows = await db
    .select({
      id: schema.appointments.id,
      paidAt: schema.appointments.paidAt,
      paidFen: schema.appointments.paidFen,
      priceFen: schema.appointments.priceFen,
    })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.storeId, storeId),
        gte(schema.appointments.paidAt, from),
        lt(schema.appointments.paidAt, to),
      ),
    );

  const byDay = new Map<string, { date: string; serviceFen: number; shopFen: number }>();
  const fromW = storeWallclock(from);
  for (let ms = storeDayStartMs(fromW.y, fromW.m, fromW.day); ms < to.getTime(); ms += 24 * 3600 * 1000) {
    const key = dayKeyOf(new Date(ms));
    byDay.set(key, { date: key, serviceFen: 0, shopFen: 0 });
  }

  let serviceFen = 0;
  for (const r of paidRows) {
    const fen = r.paidFen ?? r.priceFen;
    serviceFen += fen;
    if (r.paidAt) {
      const cell = byDay.get(dayKeyOf(r.paidAt));
      if (cell) cell.serviceFen += fen;
    }
  }

  let shopFen = 0;
  let passFen = 0;
  let storedValueFen = 0;
  let rebateFen = 0;
  const cashierFin = await loadCashierFinance(db, storeId);
  for (const cf of cashierFin) {
    for (const r of cf.recognized) {
      if (r.at.getTime() >= from.getTime() && r.at.getTime() < to.getTime()) {
        serviceFen += r.serviceFen;
        shopFen += r.shopFen;
        passFen += r.passFen;
        storedValueFen += r.storedValueFen;
        rebateFen += r.rebateFen;
        const cell = byDay.get(dayKeyOf(r.at));
        if (cell) {
          cell.serviceFen += r.serviceFen;
          cell.shopFen += r.shopFen;
        }
      }
    }
  }
  return {
    serviceFen,
    shopFen,
    passFen,
    storedValueFen,
    rebateFen,
    paidCount: paidRows.length,
    byDay,
  };
}

/** 年费收现（与 membership.amortizationStats 同源：收银单 membership 行 settled 未冲正按月） */
async function memberFeeCashOf(
  db: Parameters<typeof loadCashierFinance>[0],
  storeId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const row = await db
    .select({ s: sql<number>`coalesce(sum(${schema.cashierBills.payableFen}),0)` })
    .from(schema.cashierBills)
    .innerJoin(
      schema.cashierBillItems,
      and(
        eq(schema.cashierBillItems.billId, schema.cashierBills.id),
        eq(schema.cashierBillItems.kind, 'membership'),
      ),
    )
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        eq(schema.cashierBills.status, 'settled'),
        isNull(schema.cashierBills.reversedAt),
        gte(schema.cashierBills.settledAt, from),
        lt(schema.cashierBills.settledAt, to),
      ),
    )
    .get();
  return Number(row?.s ?? 0);
}

/** 年费分摊（同源：active 会员 paidFen/12 按月计提；本店=sold_store_id ∪ 微光 NULL） */
async function memberFeeAmortizedOf(
  db: Parameters<typeof loadCashierFinance>[0],
  storeId: string,
): Promise<number> {
  const rows = await db
    .select({ paidFen: schema.memberships.paidFen })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.status, 'active'),
        sql`(${schema.memberships.soldStoreId} = ${storeId} OR ${schema.memberships.soldStoreId} IS NULL)`,
      ),
    );
  return rows.reduce((s, r) => s + Math.round((r.paidFen ?? 0) / 12), 0);
}

/** 本店会员 userId 集（办卡店=本店 ∪ 微光 NULL，与 amortizationStats 同口径） */
async function memberUserIdsOf(
  db: Parameters<typeof loadCashierFinance>[0],
  storeId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(sql`(${schema.memberships.soldStoreId} = ${storeId} OR ${schema.memberships.soldStoreId} IS NULL)`);
  return new Set(rows.map((r) => r.userId));
}

/** 差评界值= rating ≤ 2（xp.storeFlaggedReviews rating<3 同口径） */
const isBad = (rating: number) => rating <= 2;

/** D6 预警阈值端口（service_rules.d6_refund_spike_warn_bp，缺省 3000=30%） */
async function refundSpikeWarnBp(db: Parameters<typeof loadCashierFinance>[0]): Promise<number> {
  const row = await db
    .select({ valueJson: schema.serviceRules.valueJson })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, 'd6_refund_spike_warn_bp'), eq(schema.serviceRules.active, true)))
    .orderBy(desc(schema.serviceRules.version))
    .limit(1)
    .then((r) => r[0]);
  const bp = row?.valueJson?.bp;
  return typeof bp === 'number' && Number.isFinite(bp) ? bp : 3000;
}

/* ================================================================== */
/* 路由                                                                  */
/* ================================================================== */

export const reportRouter = router({
  /* ---------------- A 区 · 尾牙读口 5（单店口径） ---------------- */

  /** A1 储值负债店级聚合：Σ(principal+bonus)（欠客户的钱=负债口径） */
  storedValueLiability: merchantManagerProcedure.query(async ({ ctx }) => {
    const row = await ctx.db
      .select({
        principal: sql<number>`coalesce(sum(${schema.storedValueAccounts.principalFen}),0)`,
        bonus: sql<number>`coalesce(sum(${schema.storedValueAccounts.bonusFen}),0)`,
        n: sql<number>`count(*)`,
      })
      .from(schema.storedValueAccounts)
      .where(eq(schema.storedValueAccounts.storeId, ctx.user.storeId!))
      .get();
    const principalFen = Number(row?.principal ?? 0);
    const bonusFen = Number(row?.bonus ?? 0);
    return { principalFen, bonusFen, totalFen: principalFen + bonusFen, accountCount: Number(row?.n ?? 0) };
  }),

  /** A2 回馈金负债店级聚合：本店会员（办卡店=本店 ∪ 微光 NULL）的 rebate 余额 Σ */
  rebateLiability: merchantManagerProcedure.query(async ({ ctx }) => {
    const memberIds = await memberUserIdsOf(ctx.db, ctx.user.storeId!);
    if (memberIds.size === 0) return { totalFen: 0, accountCount: 0 };
    const row = await ctx.db
      .select({ s: sql<number>`coalesce(sum(${schema.rebateAccounts.balanceFen}),0)`, n: sql<number>`count(*)` })
      .from(schema.rebateAccounts)
      .where(inArray(schema.rebateAccounts.userId, [...memberIds]))
      .get();
    return { totalFen: Number(row?.s ?? 0), accountCount: Number(row?.n ?? 0) };
  }),

  /** A3 昨日营收（financeStats 同源口径）+ 日结同源出口对账字段（day_closes 昨日行） */
  yesterdayRevenue: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const nowW = storeWallclock(new Date());
    const todayStart = storeDayStartMs(nowW.y, nowW.m, nowW.day);
    const y = new Date(todayStart - 24 * 3600 * 1000);
    const yW = storeWallclock(y);
    const from = new Date(storeDayStartMs(yW.y, yW.m, yW.day));
    const agg = await revenueInRange(ctx.db, storeId, from, new Date(todayStart));
    const dayKey = `${yW.y}-${pad2(yW.m)}-${pad2(yW.day)}`;
    // 日结同源出口对账：day_closes 昨日行（close 且未冲正）
    const closes = await ctx.db
      .select()
      .from(schema.dayCloses)
      .where(
        and(
          eq(schema.dayCloses.storeId, storeId),
          eq(schema.dayCloses.bizDate, dayKey),
          eq(schema.dayCloses.kind, 'close'),
          eq(schema.dayCloses.status, 'frozen'),
        ),
      );
    const closeBookCash = closes.reduce((s, c) => s + c.bookCashFen, 0);
    const closeWechat = closes.reduce((s, c) => s + c.wechatFen, 0);
    const closeAlipay = closes.reduce((s, c) => s + c.alipayFen, 0);
    return {
      date: dayKey,
      serviceFen: agg.serviceFen,
      shopFen: agg.shopFen,
      totalFen: agg.serviceFen + agg.shopFen,
      passFen: agg.passFen,
      storedValueFen: agg.storedValueFen,
      rebateFen: agg.rebateFen,
      paidCount: agg.paidCount,
      dayClose: closes.length
        ? { count: closes.length, bookCashFen: closeBookCash, wechatFen: closeWechat, alipayFen: closeAlipay }
        : null,
    };
  }),

  /** A4 近 14 日营收 spark（同源 byDay 序列；今日格=截至当前的当日已收） */
  revenueSpark14: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const nowW = storeWallclock(new Date());
    const todayStart = storeDayStartMs(nowW.y, nowW.m, nowW.day);
    const from = new Date(todayStart - 13 * 24 * 3600 * 1000);
    const agg = await revenueInRange(ctx.db, storeId, from, new Date(todayStart + 24 * 3600 * 1000));
    const days = [...agg.byDay.values()].map((d) => ({ date: d.date, totalFen: d.serviceFen + d.shopFen }));
    return { days };
  }),

  /** A5 差评聚合（reviews 底座：店级差评率/均分/员工分布/近十条差评明细含回复态） */
  badReviewAgg: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const rows = await ctx.db
      .select({
        id: schema.reviews.id,
        rating: schema.reviews.rating,
        text: schema.reviews.text,
        staffId: schema.reviews.staffId,
        customerId: schema.reviews.customerId,
        anonymous: schema.reviews.anonymous,
        replyText: schema.reviews.replyText,
        repliedAt: schema.reviews.repliedAt,
        createdAt: schema.reviews.createdAt,
      })
      .from(schema.reviews)
      .where(eq(schema.reviews.storeId, storeId))
      .orderBy(desc(schema.reviews.createdAt));
    const total = rows.length;
    const bad = rows.filter((r) => isBad(r.rating));
    const staffRows = await ctx.db
      .select({ id: schema.staff.id, name: schema.staff.name })
      .from(schema.staff)
      .where(eq(schema.staff.storeId, storeId));
    const nameOf = new Map(staffRows.map((s) => [s.id, s.name]));
    const byStaffMap = new Map<string, { total: number; bad: number }>();
    for (const r of rows) {
      const cell = byStaffMap.get(r.staffId) ?? { total: 0, bad: 0 };
      cell.total += 1;
      if (isBad(r.rating)) cell.bad += 1;
      byStaffMap.set(r.staffId, cell);
    }
    return {
      total,
      badCount: bad.length,
      badRate: total > 0 ? bad.length / total : null,
      avgRating: total > 0 ? rows.reduce((s, r) => s + r.rating, 0) / total : null,
      byStaff: [...byStaffMap.entries()].map(([staffId, c]) => ({
        staffId,
        staffName: nameOf.get(staffId) ?? '已离职员工',
        total: c.total,
        badCount: c.bad,
        badRate: c.total > 0 ? c.bad / c.total : null,
      })),
      recent: bad.slice(0, 10).map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        staffName: nameOf.get(r.staffId) ?? '已离职员工',
        customerLabel: r.anonymous ? '匿名客户' : r.customerId.slice(-4),
        replied: r.repliedAt !== null,
        replyText: r.replyText,
        createdAt: r.createdAt,
      })),
    };
  }),

  /* ---------------- C 区 · 报表 17 张（附录 A 名单冻结） ---------------- */

  /** D1 营收日报/月报（改口径）：年费收现 vs 12 个月分摊双口径并显（amortizationStats
   *  同源）+ 会员 vs 散客消费占比 + 同比环比 + byDay/byKind 下钻（≤3 层：月→日/类） */
  d1Revenue: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const agg = await revenueInRange(ctx.db, storeId, from, to);
    const feeCash = await memberFeeCashOf(ctx.db, storeId, from, to);
    const feeAmortized = await memberFeeAmortizedOf(ctx.db, storeId);

    /* 会员 vs 散客（消费时点会员口径：paidAt ∈ [startedAt, expiresAt) 且 status=active） */
    const memberRows = await ctx.db
      .select({ userId: schema.memberships.userId, startedAt: schema.memberships.startedAt, expiresAt: schema.memberships.expiresAt })
      .from(schema.memberships)
      .where(sql`(${schema.memberships.soldStoreId} = ${storeId} OR ${schema.memberships.soldStoreId} IS NULL)`);
    const memberAt = (userId: string | null, at: Date | null): boolean => {
      if (!userId || !at) return false;
      return memberRows.some(
        (m) => m.userId === userId && m.startedAt.getTime() <= at.getTime() && m.expiresAt.getTime() > at.getTime(),
      );
    };
    const paidAppts = await ctx.db
      .select({ customerId: schema.appointments.customerId, paidAt: schema.appointments.paidAt, paidFen: schema.appointments.paidFen, priceFen: schema.appointments.priceFen })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.storeId, storeId), gte(schema.appointments.paidAt, from), lt(schema.appointments.paidAt, to)));
    let memberFen = 0;
    let nonMemberFen = 0;
    for (const r of paidAppts) {
      const fen = r.paidFen ?? r.priceFen;
      if (memberAt(r.customerId, r.paidAt)) memberFen += fen;
      else nonMemberFen += fen;
    }
    const bills = await ctx.db
      .select({ customerId: schema.cashierBills.customerId, settledAt: schema.cashierBills.settledAt, payableFen: schema.cashierBills.payableFen })
      .from(schema.cashierBills)
      .where(and(eq(schema.cashierBills.storeId, storeId), eq(schema.cashierBills.status, 'settled'), isNull(schema.cashierBills.reversedAt), gte(schema.cashierBills.settledAt, from), lt(schema.cashierBills.settledAt, to)));
    for (const b of bills) {
      if (memberAt(b.customerId, b.settledAt)) memberFen += b.payableFen;
      else nonMemberFen += b.payableFen;
    }

    /* 环比/同比（同源聚合，零数据=null 诚实空） */
    const prev = await revenueInRange(ctx.db, storeId, ...Object.values(monthRange(shiftMonth(input.month, -1))) as [Date, Date]);
    const lastYear = await revenueInRange(ctx.db, storeId, ...Object.values(monthRange(shiftMonth(input.month, -12))) as [Date, Date]);
    const total = agg.serviceFen + agg.shopFen + feeCash;
    const prevTotal = prev.serviceFen + prev.shopFen + (await memberFeeCashOf(ctx.db, storeId, ...Object.values(monthRange(shiftMonth(input.month, -1))) as [Date, Date]));
    const yearTotal = lastYear.serviceFen + lastYear.shopFen + (await memberFeeCashOf(ctx.db, storeId, ...Object.values(monthRange(shiftMonth(input.month, -12))) as [Date, Date]));
    return {
      month: input.month,
      /** 收现口径（口径①）：服务+商品+年费收现 */
      cashFen: total,
      /** 分摊口径（口径②）：服务+商品+年费分摊（防收钱当月虚胖） */
      amortizedFen: agg.serviceFen + agg.shopFen + feeAmortized,
      breakdown: {
        serviceFen: agg.serviceFen,
        shopFen: agg.shopFen,
        memberFeeCashFen: feeCash,
        memberFeeAmortizedFen: feeAmortized,
        /** 非现金参考列（不计入已收）：次卡/储值/回馈金三本账分列 */
        passFen: agg.passFen,
        storedValueFen: agg.storedValueFen,
        rebateFen: agg.rebateFen,
      },
      memberVsGuest: {
        memberFen,
        nonMemberFen,
        memberShare: memberFen + nonMemberFen > 0 ? memberFen / (memberFen + nonMemberFen) : null,
      },
      momBp: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 10000) : null,
      yoyBp: yearTotal > 0 ? Math.round(((total - yearTotal) / yearTotal) * 10000) : null,
      byDay: [...agg.byDay.values()].map((d) => ({ date: d.date, totalFen: d.serviceFen + d.shopFen })),
    };
  }),

  /** D2 服务营收构成：按服务项聚合笔数+金额+附加项目搭售率（行业基准 30-45% 注记） */
  d2ServiceMix: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const rows = await ctx.db
      .select({
        appointmentId: schema.appointments.id,
        serviceId: schema.appointments.serviceId,
        serviceName: schema.services.name,
        type: schema.appointments.type,
        paidFen: schema.appointments.paidFen,
        priceFen: schema.appointments.priceFen,
      })
      .from(schema.appointments)
      .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .where(and(eq(schema.appointments.storeId, storeId), gte(schema.appointments.paidAt, from), lt(schema.appointments.paidAt, to)));
    const byService = new Map<string, { name: string; type: string; count: number; fen: number }>();
    for (const r of rows) {
      const cell = byService.get(r.serviceId) ?? { name: r.serviceName, type: r.type, count: 0, fen: 0 };
      cell.count += 1;
      cell.fen += r.paidFen ?? r.priceFen;
      byService.set(r.serviceId, cell);
    }
    /* 附加项目搭售率=有附加项快照的服务单数/服务单总数（appointment_addons，片 2 域） */
    const apptIds = rows.map((r) => r.appointmentId);
    const addonRows = apptIds.length
      ? await ctx.db
          .select({ appointmentId: schema.appointmentAddons.appointmentId, priceFen: schema.appointmentAddons.priceFen })
          .from(schema.appointmentAddons)
          .where(inArray(schema.appointmentAddons.appointmentId, apptIds))
      : [];
    const withAddon = new Set(addonRows.map((r) => r.appointmentId));
    return {
      month: input.month,
      totalCount: rows.length,
      totalFen: rows.reduce((s, r) => s + (r.paidFen ?? r.priceFen), 0),
      byService: [...byService.values()].sort((a, b) => b.fen - a.fen),
      addon: {
        attachCount: withAddon.size,
        attachRate: rows.length > 0 ? withAddon.size / rows.length : null,
        addonFen: addonRows.reduce((s, r) => s + r.priceFen, 0),
        benchmark: '行业基准 30-45%（H 调研表）',
      },
    };
  }),

  /** D3 会员增长（改口径=会员经营族首行）：增长数保留+等级分布+活跃率+升级转化（N1 同源联动） */
  d3MemberGrowth: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const all = await ctx.db
      .select()
      .from(schema.memberships)
      .where(sql`(${schema.memberships.soldStoreId} = ${storeId} OR ${schema.memberships.soldStoreId} IS NULL)`);
    const now = new Date();
    const newInMonth = all.filter((m) => m.createdAt.getTime() >= from.getTime() && m.createdAt.getTime() < to.getTime());
    const active = all.filter((m) => m.status === 'active' && m.expiresAt.getTime() > now.getTime());
    /* 活跃会员率=90 天有交易（已收预约/收银单/商城单任一）/存量会员（H 表口径 40-55% 基准注记） */
    const d90 = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
    const activeIds = new Set(active.map((m) => m.userId));
    const tradeRows = await ctx.db
      .select({ customerId: schema.appointments.customerId })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.storeId, storeId), gte(schema.appointments.paidAt, d90)));
    const billRows = await ctx.db
      .select({ customerId: schema.cashierBills.customerId })
      .from(schema.cashierBills)
      .where(and(eq(schema.cashierBills.storeId, storeId), eq(schema.cashierBills.status, 'settled'), isNull(schema.cashierBills.reversedAt), gte(schema.cashierBills.settledAt, d90)));
    const traded = new Set([...tradeRows.map((r) => r.customerId), ...billRows.map((r) => r.customerId)].filter((x): x is string => !!x));
    const activeTraded = [...activeIds].filter((id) => traded.has(id)).length;
    const byPlan = new Map<string, number>();
    for (const m of newInMonth) byPlan.set(m.planKey, (byPlan.get(m.planKey) ?? 0) + 1);
    /* 档名映射（member_plans plan_ 前缀过滤后 label 拆名，与 N1 同源） */
    const plansForName = await ctx.db.select().from(schema.memberPlans).where(eq(schema.memberPlans.active, true));
    const planNameOf = new Map(
      plansForName.filter((p) => p.ruleKey.startsWith('plan_')).map((p) => [p.ruleKey, String(p.label).split('：')[0].replace('会员档·', '')]),
    );
    return {
      month: input.month,
      newCount: newInMonth.length,
      newByPlan: [...byPlan.entries()].map(([planKey, count]) => ({ planKey, planName: planNameOf.get(planKey) ?? planKey, count })),
      activeTotal: active.length,
      active90dCount: activeTraded,
      active90dRate: active.length > 0 ? activeTraded / active.length : null,
      note: '增长数=虚荣指标护栏：等级分布/升级转化见 N1（同页联动，数据源同表）',
    };
  }),

  /** D4 次卡台账：售卡充次/扣次/剩余次数负债（次数口径永不混金额）+消耗率趋势（近 6 月扣次序列） */
  d4PassLedger: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const passes = await ctx.db
      .select()
      .from(schema.memberPasses)
      .where(eq(schema.memberPasses.storeId, storeId));
    const passIds = passes.map((p) => p.id);
    const logs = passIds.length
      ? await ctx.db
          .select({ delta: schema.passDeductLogs.delta, createdAt: schema.passDeductLogs.createdAt })
          .from(schema.passDeductLogs)
          .where(inArray(schema.passDeductLogs.passId, passIds))
      : [];
    const { from, to } = monthRange(input.month);
    const deductedInMonth = logs.filter((l) => l.delta < 0 && l.createdAt.getTime() >= from.getTime() && l.createdAt.getTime() < to.getTime());
    const grantedInMonth = logs.filter((l) => l.delta > 0 && l.createdAt.getTime() >= from.getTime() && l.createdAt.getTime() < to.getTime());
    /* 消耗率趋势=近 6 个月逐月扣次数（消耗过慢批次=沉睡预警注记） */
    const trend: Array<{ month: string; deductedTimes: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const mk = shiftMonth(input.month, -i);
      const r = monthRange(mk);
      trend.push({
        month: mk,
        deductedTimes: logs.filter((l) => l.delta < 0 && l.createdAt.getTime() >= r.from.getTime() && l.createdAt.getTime() < r.to.getTime()).reduce((s, l) => s + l.delta, 0) * -1,
      });
    }
    return {
      month: input.month,
      passCount: passes.length,
      totalTimes: passes.reduce((s, p) => s + p.totalTimes, 0),
      remainTimes: passes.reduce((s, p) => s + p.remainTimes, 0),
      grantedTimesInMonth: grantedInMonth.reduce((s, l) => s + l.delta, 0),
      deductedTimesInMonth: deductedInMonth.reduce((s, l) => s + l.delta, 0) * -1,
      consumeTrend6m: trend,
      note: '次数口径永不混金额；消耗率趋势=近 6 月逐月扣次，消耗过慢=沉睡预警',
    };
  }),

  /** D5 储值台账（改口径=负债视角）：本月收支 + 期末未耗余额 + 预收负债总额行（储值+回馈金合并） */
  d5StoredValue: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const logs = await ctx.db
      .select({ deltaPrincipal: schema.storedValueLogs.deltaPrincipalFen, deltaBonus: schema.storedValueLogs.deltaBonusFen })
      .from(schema.storedValueLogs)
      .where(and(eq(schema.storedValueLogs.storeId, storeId), gte(schema.storedValueLogs.createdAt, from), lt(schema.storedValueLogs.createdAt, to)));
    let rechargeFen = 0;
    let consumeFen = 0;
    for (const l of logs) {
      const d = l.deltaPrincipal + l.deltaBonus;
      if (d > 0) rechargeFen += d;
      else consumeFen += -d;
    }
    const liability = await ctx.db
      .select({ s: sql<number>`coalesce(sum(${schema.storedValueAccounts.principalFen} + ${schema.storedValueAccounts.bonusFen}),0)` })
      .from(schema.storedValueAccounts)
      .where(eq(schema.storedValueAccounts.storeId, storeId))
      .get();
    const storedLiabilityFen = Number(liability?.s ?? 0);
    const memberIds = await memberUserIdsOf(ctx.db, storeId);
    const rebate = memberIds.size
      ? await ctx.db
          .select({ s: sql<number>`coalesce(sum(${schema.rebateAccounts.balanceFen}),0)` })
          .from(schema.rebateAccounts)
          .where(inArray(schema.rebateAccounts.userId, [...memberIds]))
          .get()
      : { s: 0 };
    const rebateLiabilityFen = Number(rebate?.s ?? 0);
    return {
      month: input.month,
      rechargeFen,
      consumeFen,
      liabilityFen: storedLiabilityFen,
      /** 预收负债总额=储值未耗余额+回馈金负债（D5 改口径正文行） */
      prepaidLiabilityTotalFen: storedLiabilityFen + rebateLiabilityFen,
      rebateLiabilityFen,
      note: '负债视角：期末未耗余额=欠客户的钱；预收负债总额=储值+回馈金合并行（H 表 D5 裁定）',
    };
  }),

  /** D6 退款售后（改口径=体验信号源）：笔数/金额/类型分布/驳回率 + 原因聚类
   *  （refund_requests.reasonCode）+ 退款关联差评（退款单→预约→差评）+
   *  退款率环比突增预警（d6_refund_spike_warn_bp 端口，缺省 30%） */
  d6Refunds: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const prev = monthRange(shiftMonth(input.month, -1));
    const billsIn = async (f: Date, t: Date) =>
      ctx.db
        .select({ type: schema.refundBills.type, amountFen: schema.refundBills.amountFen })
        .from(schema.refundBills)
        .where(
          and(
            eq(schema.refundBills.storeId, storeId),
            gte(schema.refundBills.createdAt, f),
            lt(schema.refundBills.createdAt, t),
            inArray(schema.refundBills.status, ['executed', 'settled']),
          ),
        );
    const thisBills = await billsIn(from, to);
    const prevBills = await billsIn(prev.from, prev.to);
    const thisFen = thisBills.reduce((s, b) => s + b.amountFen, 0);
    const prevFen = prevBills.reduce((s, b) => s + b.amountFen, 0);
    const byType = new Map<string, { count: number; fen: number }>();
    for (const b of thisBills) {
      const cell = byType.get(b.type) ?? { count: 0, fen: 0 };
      cell.count += 1;
      cell.fen += b.amountFen;
      byType.set(b.type, cell);
    }
    /* 驳回率=客户端申请单 rejected/(submitted 全集)（月内申请口径） */
    const reqs = await ctx.db
      .select({ status: schema.refundRequests.status, reasonLabel: schema.refundRequests.reasonLabel, orderKind: schema.refundRequests.orderKind, billId: schema.refundRequests.billId })
      .from(schema.refundRequests)
      .where(and(eq(schema.refundRequests.storeId, storeId), gte(schema.refundRequests.createdAt, from), lt(schema.refundRequests.createdAt, to)));
    const rejected = reqs.filter((r) => r.status === 'rejected').length;
    const reasonCluster = new Map<string, number>();
    for (const r of reqs) reasonCluster.set(r.reasonLabel, (reasonCluster.get(r.reasonLabel) ?? 0) + 1);
    /* 退款关联差评：到店单申请 → cashier_bill_items appointment 行 → review ≤2 星 */
    const apptBillIds = reqs.filter((r) => r.orderKind === 'appointment').map((r) => r.billId);
    let linkedBadReviews = 0;
    if (apptBillIds.length > 0) {
      const items = await ctx.db
        .select({ refId: schema.cashierBillItems.refId })
        .from(schema.cashierBillItems)
        .where(and(inArray(schema.cashierBillItems.billId, apptBillIds), eq(schema.cashierBillItems.kind, 'appointment')));
      const apptIds = items.map((i) => i.refId).filter((x): x is string => !!x);
      if (apptIds.length > 0) {
        const revs = await ctx.db
          .select({ rating: schema.reviews.rating })
          .from(schema.reviews)
          .where(and(eq(schema.reviews.storeId, storeId), inArray(schema.reviews.appointmentId, apptIds)));
        linkedBadReviews = revs.filter((r) => isBad(r.rating)).length;
      }
    }
    const bp = await refundSpikeWarnBp(ctx.db);
    const spikeBp = prevFen > 0 ? Math.round(((thisFen - prevFen) / prevFen) * 10000) : null;
    return {
      month: input.month,
      count: thisBills.length,
      amountFen: thisFen,
      byType: [...byType.entries()].map(([type, c]) => ({ type, count: c.count, amountFen: c.fen })),
      requests: { total: reqs.length, rejected, rejectRate: reqs.length > 0 ? rejected / reqs.length : null },
      reasonCluster: [...reasonCluster.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      linkedBadReviews,
      spike: { prevMonthFen: prevFen, momBp: spikeBp, warn: spikeBp !== null && spikeBp > bp, thresholdBp: bp },
    };
  }),

  /** D7 员工绩效（改口径=海底捞模式：服务质量指标进绩效——差评率/报告时效/复购率
   *  与营收同屏；申诉通道+纠错兜底两件=N6 同配在 metric_appeals，本表透出逐员申诉/纠错数） */
  d7StaffPerf: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const staffRows = await ctx.db
      .select({ id: schema.staff.id, name: schema.staff.name, userId: schema.staff.userId })
      .from(schema.staff)
      .where(eq(schema.staff.storeId, storeId));
    /* 营收（financeStats byStaff 同源：paid_at 区间 paidFen 按 staffId 聚合） */
    const paidRows = await ctx.db
      .select({ staffId: schema.appointments.staffId, paidFen: schema.appointments.paidFen, priceFen: schema.appointments.priceFen, customerId: schema.appointments.customerId, paidAt: schema.appointments.paidAt })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.storeId, storeId), gte(schema.appointments.paidAt, from), lt(schema.appointments.paidAt, new Date(from.getTime() + 90 * 24 * 3600 * 1000))));
    const reviews = await ctx.db
      .select({ staffId: schema.reviews.staffId, rating: schema.reviews.rating })
      .from(schema.reviews)
      .where(and(eq(schema.reviews.storeId, storeId), gte(schema.reviews.createdAt, from), lt(schema.reviews.createdAt, to)));
    const reports = await ctx.db
      .select({
        staffId: schema.appointments.staffId,
        generatedAt: schema.serviceReports.generatedAt,
        deliveredAt: schema.serviceReports.deliveredAt,
      })
      .from(schema.serviceReports)
      .innerJoin(schema.appointments, eq(schema.serviceReports.appointmentId, schema.appointments.id))
      .where(and(eq(schema.serviceReports.userId, schema.appointments.customerId), eq(schema.appointments.storeId, storeId), gte(schema.serviceReports.generatedAt, from), lt(schema.serviceReports.generatedAt, to)));
    const appeals = await ctx.db
      .select({ staffId: schema.metricAppeals.staffId, status: schema.metricAppeals.status })
      .from(schema.metricAppeals)
      .where(eq(schema.metricAppeals.storeId, storeId));
    const rows = staffRows.map((s) => {
      /* 本月行=窗口内且 paidAt 落本月（窗口=月起 90 天，复购判定用全窗口） */
      const mine = paidRows.filter((r) => r.staffId === s.id && r.paidAt && r.paidAt.getTime() < to.getTime());
      const myReviews = reviews.filter((r) => r.staffId === s.id);
      const myReports = reports.filter((r) => r.staffId === s.id);
      const delivered = myReports.filter((r) => r.deliveredAt !== null);
      const myCustomers = new Set(mine.map((r) => r.customerId));
      /* 复购率=本月服务客户中 90 天窗口内 ≥2 笔已收款单（任意员工）的比例 */
      const repurchased = [...myCustomers].filter(
        (cid) => paidRows.filter((l) => l.customerId === cid && l.paidAt !== null).length >= 2,
      ).length;
      const myAppeals = appeals.filter((a) => a.staffId === s.id);
      return {
        staffId: s.id,
        staffName: s.name,
        serviceFen: mine.reduce((sum, r) => sum + (r.paidFen ?? r.priceFen), 0),
        completedCount: mine.length,
        reviewCount: myReviews.length,
        badCount: myReviews.filter((r) => isBad(r.rating)).length,
        badRate: myReviews.length > 0 ? myReviews.filter((r) => isBad(r.rating)).length / myReviews.length : null,
        reportAvgMinutes:
          delivered.length > 0
            ? Math.round(delivered.reduce((sum, r) => sum + (r.deliveredAt!.getTime() - r.generatedAt.getTime()) / 60000, 0) / delivered.length)
            : null,
        repurchaseRate: myCustomers.size > 0 ? repurchased / myCustomers.size : null,
        appealCount: myAppeals.length,
        correctedCount: myAppeals.filter((a) => a.status === 'approved').length,
      };
    });
    return {
      month: input.month,
      rows: rows.sort((a, b) => b.serviceFen - a.serviceFen),
      guard: { appealChannel: true, correctionLog: true, note: '海底捞警示口径（附录 B）：申诉通道+数据错误兜底已配齐（metric_appeals），质量指标方可进绩效' },
    };
  }),

  /** D8 寄养经营：入住率（基准 70-80%）/宠物夜数/每宠物夜营收/增值服务搭售率（目标 20%）/超期单数 */
  d8Boarding: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const appts = await ctx.db
      .select({ id: schema.appointments.id, scheduledStart: schema.appointments.scheduledStart, scheduledEnd: schema.appointments.scheduledEnd, paidFen: schema.appointments.paidFen, priceFen: schema.appointments.priceFen, status: schema.appointments.status })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.storeId, storeId), eq(schema.appointments.type, 'boarding'), lt(schema.appointments.scheduledStart, to), gte(schema.appointments.scheduledEnd, from)));
    /* 宠物夜数=预约区间与月交叠晚数（逐晚口径，与 boarding_slots 占容同族） */
    let petNights = 0;
    for (const a of appts) {
      const s = Math.max(a.scheduledStart.getTime(), from.getTime());
      const e = Math.min(a.scheduledEnd.getTime(), to.getTime());
      if (e > s) petNights += Math.ceil((e - s) / (24 * 3600 * 1000));
    }
    /* 入住率=宠物夜数 /（房型总间数 × 当月天数）；容量=boarding 服务项 roomCount Σ */
    const roomRows = await ctx.db
      .select({ roomCount: schema.services.roomCount })
      .from(schema.services)
      .where(and(eq(schema.services.storeId, storeId), eq(schema.services.type, 'boarding')));
    const capacity = roomRows.reduce((s, r) => s + (r.roomCount ?? 0), 0);
    const daysInMonth = Math.round((to.getTime() - from.getTime()) / (24 * 3600 * 1000));
    const paidBoarding = appts.filter((a) => a.paidFen !== null);
    const boardingFen = paidBoarding.reduce((s, a) => s + (a.paidFen ?? a.priceFen), 0);
    const addonRows = appts.length
      ? await ctx.db
          .select({ appointmentId: schema.appointmentAddons.appointmentId })
          .from(schema.appointmentAddons)
          .where(inArray(schema.appointmentAddons.appointmentId, appts.map((a) => a.id)))
      : [];
    const withAddon = new Set(addonRows.map((r) => r.appointmentId));
    const now = new Date();
    const overdue = await ctx.db
      .select({ id: schema.boardingStays.id })
      .from(schema.boardingStays)
      .innerJoin(schema.appointments, eq(schema.boardingStays.appointmentId, schema.appointments.id))
      .where(and(eq(schema.appointments.storeId, storeId), isNull(schema.boardingStays.checkoutAt), lt(schema.appointments.scheduledEnd, now)));
    return {
      month: input.month,
      petNights,
      capacityNights: capacity * daysInMonth,
      occupancyRate: capacity > 0 ? petNights / (capacity * daysInMonth) : null,
      boardingFen,
      revenuePerPetNightFen: petNights > 0 ? Math.round(boardingFen / petNights) : null,
      addonAttachRate: appts.length > 0 ? withAddon.size / appts.length : null,
      overdueCount: overdue.length,
      note: '入住率行业基准 70-80%；增值服务搭售率目标 20%（H 表/Kennel Connection 口径）',
    };
  }),

  /** D9 商品销售与库存周转：销量/销售额/动销率/周转天数（非核心业务不加码） */
  d9Goods: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    /* orders 无 paid_at 口径（financeStats 注记在案）——商城按月口径=createdAt 落月且
       status ∈ paid/shipped/received（已成交口径写死） */
    const orders = await ctx.db
      .select({ items: schema.orders.items, totalFen: schema.orders.totalFen })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.storeId, storeId),
          gte(schema.orders.createdAt, from),
          lt(schema.orders.createdAt, to),
          inArray(schema.orders.status, ['paid', 'shipped', 'received']),
        ),
      );
    const qtyByProduct = new Map<string, { name: string; qty: number; fen: number }>();
    let units = 0;
    for (const o of orders) {
      for (const it of o.items ?? []) {
        units += it.quantity;
        const cell = qtyByProduct.get(it.product_id) ?? { name: it.name, qty: 0, fen: 0 };
        cell.qty += it.quantity;
        cell.fen += it.quantity * it.price_fen;
        qtyByProduct.set(it.product_id, cell);
      }
    }
    const onSale = await ctx.db
      .select({ id: schema.products.id, stock: schema.products.stock })
      .from(schema.products)
      .where(and(eq(schema.products.storeId, storeId), eq(schema.products.status, 'on')));
    const daysInMonth = Math.round((to.getTime() - from.getTime()) / (24 * 3600 * 1000));
    const stockTotal = onSale.reduce((s, p) => s + p.stock, 0);
    return {
      month: input.month,
      orderCount: orders.length,
      unitsSold: units,
      salesFen: orders.reduce((s, o) => s + o.totalFen, 0),
      byProduct: [...qtyByProduct.values()].sort((a, b) => b.fen - a.fen),
      sellThroughRate: onSale.length > 0 ? qtyByProduct.size / onSale.length : null,
      turnoverDays: units > 0 ? Math.round((stockTotal / (units / daysInMonth)) * 10) / 10 : null,
      note: '周转天数=当前库存/（月销/当月天数）；商城按成交月（createdAt）归集——无 paid_at 口径在案',
    };
  }),

  /** N1 等级分布与升级转化：四档存量/新增/退出+逐级升级降级率+按入会月份 cohort 拆
   *  （Costco 口径：高档占比×贡献=第一结构指标；档变流水=membership_events 同源） */
  n1LevelDist: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const plansAll = await ctx.db.select().from(schema.memberPlans).where(eq(schema.memberPlans.active, true));
    /* member_plans 表混存会员域配置键（rebate_* 等）——四档口径=plan_ 前缀过滤（写死） */
    const plans = plansAll.filter((p) => p.ruleKey.startsWith('plan_'));
    const planName = new Map(plans.map((p) => [p.ruleKey, String(p.label).split('：')[0].replace('会员档·', '')]));
    const planPrice = new Map(plans.map((p) => [p.ruleKey, Number(p.valueJson?.price_fen ?? 0)]));
    const all = await ctx.db
      .select()
      .from(schema.memberships)
      .where(sql`(${schema.memberships.soldStoreId} = ${storeId} OR ${schema.memberships.soldStoreId} IS NULL)`);
    const now = new Date();
    const active = all.filter((m) => m.status === 'active' && m.expiresAt.getTime() > now.getTime());
    const stockByPlan = new Map<string, number>();
    for (const m of active) stockByPlan.set(m.planKey, (stockByPlan.get(m.planKey) ?? 0) + 1);
    const newByPlan = new Map<string, number>();
    for (const m of all) {
      if (m.createdAt.getTime() >= from.getTime() && m.createdAt.getTime() < to.getTime()) {
        newByPlan.set(m.planKey, (newByPlan.get(m.planKey) ?? 0) + 1);
      }
    }
    /* 退出=status cancelled 且 updatedAt 落月（cancel 写 updatedAt 口径注记） */
    const exitInMonth = all.filter((m) => m.status === 'cancelled' && m.cancelledAt !== null && m.cancelledAt.getTime() >= from.getTime() && m.cancelledAt.getTime() < to.getTime());
    const events = await ctx.db
      .select()
      .from(schema.membershipEvents)
      .where(and(gte(schema.membershipEvents.createdAt, from), lt(schema.membershipEvents.createdAt, to)));
    const upgrades = events.filter((e) => e.type === 'upgrade');
    const downgrades = events.filter(
      (e) => e.type === 'change_schedule' && (planPrice.get(e.toPlan ?? '') ?? 0) < (planPrice.get(e.fromPlan ?? '') ?? 0),
    );
    /* 入会 cohort：按 createdAt 月份分组 → 当期新增数 + 至今仍 active 数（留存） */
    const cohortMap = new Map<string, { cohort: string; count: number; retained: number }>();
    for (const m of all) {
      const w = storeWallclock(m.createdAt);
      const key = `${w.y}-${pad2(w.m)}`;
      const cell = cohortMap.get(key) ?? { cohort: key, count: 0, retained: 0 };
      cell.count += 1;
      if (m.status === 'active' && m.expiresAt.getTime() > now.getTime()) cell.retained += 1;
      cohortMap.set(key, cell);
    }
    return {
      month: input.month,
      plans: plans.map((p) => p.ruleKey),
      stock: [...stockByPlan.entries()].map(([planKey, count]) => ({ planKey, planName: planName.get(planKey) ?? planKey, count })),
      newInMonth: [...newByPlan.entries()].map(([planKey, count]) => ({ planKey, planName: planName.get(planKey) ?? planKey, count })),
      exitCount: exitInMonth.length,
      upgradeCount: upgrades.length,
      downgradeCount: downgrades.length,
      upgradeRate: active.length + exitInMonth.length > 0 ? upgrades.length / (active.length + exitInMonth.length) : null,
      downgradeRate: active.length + exitInMonth.length > 0 ? downgrades.length / (active.length + exitInMonth.length) : null,
      cohorts: [...cohortMap.values()].sort((a, b) => a.cohort.localeCompare(b.cohort)),
      note: '升级率/降级率分母=期初存量（当月末存量+当月退出）；cohort 留存=至今仍 active 数',
    };
  }),

  /** N2 续费与回本：到期 cohort 续费率（顺延口径注记）+到期前 30 天预警名单+回本率
   *  （年费 vs 年内会员价实省=服务折扣差额+回馈金核销，三本账不混） */
  n2Renewal: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    void input;
    const all = await ctx.db
      .select()
      .from(schema.memberships)
      .where(sql`(${schema.memberships.soldStoreId} = ${storeId} OR ${schema.memberships.soldStoreId} IS NULL)`);
    const plansAll = await ctx.db.select().from(schema.memberPlans).where(eq(schema.memberPlans.active, true));
    /* member_plans 表混存会员域配置键（rebate_* 等）——四档口径=plan_ 前缀过滤（写死） */
    const plans = plansAll.filter((p) => p.ruleKey.startsWith('plan_'));
    const planName = new Map(plans.map((p) => [p.ruleKey, String(p.label).split('：')[0].replace('会员档·', '')]));
    const now = new Date();
    /* 到期 cohort（近 6 个月+本月）：expiresAt 落月分组；续费判定=expiresAt−startedAt>400 天
       （年费 365+宽限 35；membership_events 无 renew 流水——顺延口径写死注记，逐次流水另批补） */
    const cohorts: Array<{ month: string; dueCount: number; renewedCount: number; renewRate: number | null }> = [];
    for (let i = 6; i >= 0; i--) {
      const mk = shiftMonth(`${storeWallclock(now).y}-${pad2(storeWallclock(now).m)}`, -i);
      const r = monthRange(mk);
      const due = all.filter((m) => m.expiresAt.getTime() >= r.from.getTime() && m.expiresAt.getTime() < r.to.getTime());
      const renewed = due.filter((m) => m.expiresAt.getTime() - m.startedAt.getTime() > 400 * 24 * 3600 * 1000);
      cohorts.push({ month: mk, dueCount: due.length, renewedCount: renewed.length, renewRate: due.length > 0 ? renewed.length / due.length : null });
    }
    const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const warnList = all
      .filter((m) => m.status === 'active' && m.expiresAt.getTime() > now.getTime() && m.expiresAt.getTime() <= in30.getTime())
      .map((m) => ({ userId: m.userId, planKey: m.planKey, planName: planName.get(m.planKey) ?? m.planKey, expiresAt: m.expiresAt }));
    /* 回本率（按会员逐人）：实省=服务折扣差额（priceFen−paidFen，次卡口除外）+回馈金核销 Σ|deduct| */
    const users = await ctx.db.select({ id: schema.users.id, nickname: schema.users.nickname }).from(schema.users)
      .where(inArray(schema.users.id, all.length ? all.map((m) => m.userId) : ['__none__']));
    const nameOf = new Map(users.map((u) => [u.id, u.nickname]));
    const detail: Array<{ userId: string; nickname: string | null; planKey: string; paidFen: number; savedFen: number; paybackRate: number | null }> = [];
    for (const m of all.filter((x) => x.status === 'active')) {
      const appts = await ctx.db
        .select({ priceFen: schema.appointments.priceFen, paidFen: schema.appointments.paidFen, paymentMode: schema.appointments.paymentMode })
        .from(schema.appointments)
        .where(and(eq(schema.appointments.storeId, storeId), eq(schema.appointments.customerId, m.userId), sql`${schema.appointments.paidAt} IS NOT NULL`));
      const discountFen = appts
        .filter((a) => a.paymentMode !== 'pass_deduct')
        .reduce((s, a) => s + Math.max(0, a.priceFen - (a.paidFen ?? a.priceFen)), 0);
      const rebate = await ctx.db
        .select({ s: sql<number>`coalesce(sum(-${schema.rebateLogs.deltaFen}),0)` })
        .from(schema.rebateLogs)
        .where(and(eq(schema.rebateLogs.userId, m.userId), eq(schema.rebateLogs.type, 'deduct')))
        .get();
      const savedFen = discountFen + Number(rebate?.s ?? 0);
      detail.push({
        userId: m.userId,
        nickname: nameOf.get(m.userId) ?? null,
        planKey: m.planKey,
        paidFen: m.paidFen ?? 0,
        savedFen,
        paybackRate: (m.paidFen ?? 0) > 0 ? savedFen / m.paidFen! : null,
      });
    }
    return {
      cohorts,
      warnList,
      payback: {
        members: detail.length,
        paidFen: detail.reduce((s, d) => s + d.paidFen, 0),
        savedFen: detail.reduce((s, d) => s + d.savedFen, 0),
        avgRate: detail.filter((d) => d.paybackRate !== null).length > 0
          ? detail.reduce((s, d) => s + (d.paybackRate ?? 0), 0) / detail.filter((d) => d.paybackRate !== null).length
          : null,
        detail,
      },
      note: '续费判定=到期顺延口径（expiresAt−startedAt>400 天）；30/60/90 天窗口精算候逐次续费流水件（另批）；回本率=会员价实省（服务折扣差额+回馈金核销）/年费',
    };
  }),

  /** N3 回馈金发行核销：滚动表（期初+发行−核销−过期/破损=期末）+核销率（基准 20-35%）+负债估值 */
  n3RebateRoll: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    void input;
    const memberIds = await memberUserIdsOf(ctx.db, ctx.user.storeId!);
    const logs = memberIds.size
      ? await ctx.db
          .select({ type: schema.rebateLogs.type, deltaFen: schema.rebateLogs.deltaFen, period: schema.rebateLogs.period })
          .from(schema.rebateLogs)
          .where(inArray(schema.rebateLogs.userId, [...memberIds]))
      : [];
    const byPeriod = new Map<string, { period: string; grantFen: number; deductFen: number; clawbackFen: number; clearFen: number }>();
    for (const l of logs) {
      const key = l.period ?? '无期次';
      const cell = byPeriod.get(key) ?? { period: key, grantFen: 0, deductFen: 0, clawbackFen: 0, clearFen: 0 };
      if (l.type === 'grant') cell.grantFen += l.deltaFen;
      else if (l.type === 'deduct') cell.deductFen += -l.deltaFen;
      else if (l.type === 'clawback') cell.clawbackFen += -l.deltaFen;
      else if (l.type === 'clear') cell.clearFen += -l.deltaFen;
      byPeriod.set(key, cell);
    }
    const closing = memberIds.size
      ? await ctx.db
          .select({ s: sql<number>`coalesce(sum(${schema.rebateAccounts.balanceFen}),0)` })
          .from(schema.rebateAccounts)
          .where(inArray(schema.rebateAccounts.userId, [...memberIds]))
          .get()
      : { s: 0 };
    const grantTotal = logs.filter((l) => l.type === 'grant').reduce((s, l) => s + l.deltaFen, 0);
    const deductTotal = -logs.filter((l) => l.type === 'deduct').reduce((s, l) => s + l.deltaFen, 0);
    return {
      periods: [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period)),
      closingLiabilityFen: Number(closing?.s ?? 0),
      grantTotalFen: grantTotal,
      deductTotalFen: deductTotal,
      redeemRate: grantTotal > 0 ? deductTotal / grantTotal : null,
      note: '滚动口径：期初+发行−核销−过期/破损=期末；期末负债=Σ 账户余额（时点真值）；核销率基准 20-35%（H 表）；三本账不混',
    };
  }),

  /** N4 评价分布与差评聚类：星级分布（店/服务/员工）+差评率+差评原因标签聚类+
   *  差评回复率与时效（reviews 同源，0044 扩列）+approved 申诉纠错扣减明示 */
  n4ReviewDist: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const rows = await ctx.db
      .select()
      .from(schema.reviews)
      .where(and(eq(schema.reviews.storeId, storeId), gte(schema.reviews.createdAt, from), lt(schema.reviews.createdAt, to)));
    const staffRows = await ctx.db.select({ id: schema.staff.id, name: schema.staff.name }).from(schema.staff).where(eq(schema.staff.storeId, storeId));
    const nameOf = new Map(staffRows.map((s) => [s.id, s.name]));
    const dist = [1, 2, 3, 4, 5].map((star) => ({ star, count: rows.filter((r) => r.rating === star).length }));
    const bad = rows.filter((r) => isBad(r.rating));
    /* 纠错扣减：approved 申诉（target_type='review'）的差评从指标扣减（算错即更正读口径） */
    const approvedAppeals = await ctx.db
      .select({ targetId: schema.metricAppeals.targetId })
      .from(schema.metricAppeals)
      .where(and(eq(schema.metricAppeals.storeId, storeId), eq(schema.metricAppeals.targetType, 'review'), eq(schema.metricAppeals.status, 'approved')));
    const correctedIds = new Set(approvedAppeals.map((a) => a.targetId));
    const badEffective = bad.filter((r) => !correctedIds.has(r.id));
    const byStaffMap = new Map<string, { total: number; bad: number }>();
    for (const r of rows) {
      const cell = byStaffMap.get(r.staffId) ?? { total: 0, bad: 0 };
      cell.total += 1;
      if (isBad(r.rating) && !correctedIds.has(r.id)) cell.bad += 1;
      byStaffMap.set(r.staffId, cell);
    }
    const byServiceMap = new Map<string, { total: number; bad: number }>();
    const apptSvc = await ctx.db
      .select({ id: schema.appointments.id, serviceName: schema.services.name })
      .from(schema.appointments)
      .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .where(eq(schema.appointments.storeId, storeId));
    const svcOf = new Map(apptSvc.map((a) => [a.id, a.serviceName]));
    for (const r of rows) {
      const name = svcOf.get(r.appointmentId) ?? '未知服务';
      const cell = byServiceMap.get(name) ?? { total: 0, bad: 0 };
      cell.total += 1;
      if (isBad(r.rating) && !correctedIds.has(r.id)) cell.bad += 1;
      byServiceMap.set(name, cell);
    }
    const tagCluster = new Map<string, number>();
    for (const r of badEffective) for (const t of r.tags ?? []) tagCluster.set(t, (tagCluster.get(t) ?? 0) + 1);
    const replied = bad.filter((r) => r.repliedAt !== null);
    return {
      month: input.month,
      total: rows.length,
      dist,
      badCount: bad.length,
      badEffectiveCount: badEffective.length,
      correctedCount: correctedIds.size,
      badRate: rows.length > 0 ? badEffective.length / rows.length : null,
      avgRating: rows.length > 0 ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null,
      byStaff: [...byStaffMap.entries()].map(([staffId, c]) => ({ staffId, staffName: nameOf.get(staffId) ?? '已离职员工', ...c })),
      byService: [...byServiceMap.entries()].map(([serviceName, c]) => ({ serviceName, ...c })),
      tagCluster: [...tagCluster.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
      reply: {
        repliedCount: replied.length,
        replyRate: bad.length > 0 ? replied.length / bad.length : null,
        avgMinutes: replied.length > 0 ? Math.round(replied.reduce((s, r) => s + (r.repliedAt!.getTime() - r.createdAt.getTime()) / 60000, 0) / replied.length) : null,
      },
      note: '差评=评分≤2；纠错扣减=approved 申诉从差评指标即时剔除（附录 B 兜底口径，留痕在 metric_appeals）',
    };
  }),

  /** N5 服务交付合规与时效：照片张数/覆盖率+报告送达时效分布+实际 vs 标准时长+抽检率
   *  （serviceStep/serviceReports 同源；抽检率=被打标重拍步占比=质检 proxy，注记明面） */
  n5Delivery: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const completed = await ctx.db
      .select({ id: schema.appointments.id, serviceId: schema.appointments.serviceId, completedAt: schema.appointments.completedAt })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.storeId, storeId), eq(schema.appointments.type, 'grooming'), gte(schema.appointments.completedAt, from), lt(schema.appointments.completedAt, to)));
    const apptIds = completed.map((a) => a.id);
    const steps = apptIds.length
      ? await ctx.db.select().from(schema.appointmentSteps).where(inArray(schema.appointmentSteps.appointmentId, apptIds))
      : [];
    const stepIds = steps.map((s) => s.id);
    const photos = stepIds.length
      ? await ctx.db
          .select({ stepId: schema.stepPhotos.id, stepRef: schema.stepPhotos.stepId })
          .from(schema.stepPhotos)
          .where(and(inArray(schema.stepPhotos.stepId, stepIds), isNull(schema.stepPhotos.invalidatedAt)))
      : [];
    const photoCountByStep = new Map<string, number>();
    for (const p of photos) photoCountByStep.set(p.stepRef, (photoCountByStep.get(p.stepRef) ?? 0) + 1);
    let requiredTotal = 0;
    let coveredTotal = 0;
    let actualMinutes = 0;
    let flaggedSteps = 0;
    for (const s of steps) {
      requiredTotal += s.requiredPhotos;
      coveredTotal += Math.min(photoCountByStep.get(s.id) ?? 0, s.requiredPhotos);
      if (s.startedAt && s.doneAt) actualMinutes += (s.doneAt.getTime() - s.startedAt.getTime()) / 60000;
      if (s.flagged) flaggedSteps += 1;
    }
    const svcRows = await ctx.db.select().from(schema.services).where(eq(schema.services.storeId, storeId));
    const durOf = new Map(svcRows.map((s) => [s.id, s.durationMin]));
    const stdMinutes = completed.reduce((s, a) => s + (durOf.get(a.serviceId) ?? 0), 0);
    const reports = apptIds.length
      ? await ctx.db
          .select({ generatedAt: schema.serviceReports.generatedAt, deliveredAt: schema.serviceReports.deliveredAt })
          .from(schema.serviceReports)
          .where(inArray(schema.serviceReports.appointmentId, apptIds))
      : [];
    const buckets = { within5: 0, within30: 0, within120: 0, over120: 0, unread: 0 };
    for (const r of reports) {
      if (!r.deliveredAt) {
        buckets.unread += 1;
        continue;
      }
      const min = (r.deliveredAt.getTime() - r.generatedAt.getTime()) / 60000;
      if (min <= 5) buckets.within5 += 1;
      else if (min <= 30) buckets.within30 += 1;
      else if (min <= 120) buckets.within120 += 1;
      else buckets.over120 += 1;
    }
    return {
      month: input.month,
      completedCount: completed.length,
      photosTotal: photos.length,
      photoCoverage: requiredTotal > 0 ? coveredTotal / requiredTotal : null,
      reportCount: reports.length,
      deliveryBuckets: buckets,
      actualMinutesAvg: completed.length > 0 ? Math.round(actualMinutes / Math.max(1, completed.length)) : null,
      stdMinutesAvg: completed.length > 0 ? Math.round(stdMinutes / completed.length) : null,
      sampleRate: steps.length > 0 ? flaggedSteps / steps.length : null,
      note: '抽检率=打标重拍步占比（质检 proxy 口径注记）；时效=报告生成→客户端首读（delivered_at 幂等置位口径）',
    };
  }),

  /** N6 员工×服务质量（海底捞警示口径·附录 B）：员工维度差评率/报告时效/复购率交叉——
   *  铁规两件配齐故点亮：①申诉通道=metric_appeals（进审批队列）②数据错误兜底=approved
   *  申诉读口径即时扣减+correction_json 留痕；gate 字段透出配齐证据（不配齐只置灰） */
  n6StaffQuality: merchantManagerProcedure.input(monthInput).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const { from, to } = monthRange(input.month);
    const staffRows = await ctx.db.select().from(schema.staff).where(eq(schema.staff.storeId, storeId));
    const reviews = await ctx.db
      .select({ id: schema.reviews.id, staffId: schema.reviews.staffId, rating: schema.reviews.rating })
      .from(schema.reviews)
      .where(and(eq(schema.reviews.storeId, storeId), gte(schema.reviews.createdAt, from), lt(schema.reviews.createdAt, to)));
    const reports = await ctx.db
      .select({ staffId: schema.appointments.staffId, generatedAt: schema.serviceReports.generatedAt, deliveredAt: schema.serviceReports.deliveredAt })
      .from(schema.serviceReports)
      .innerJoin(schema.appointments, eq(schema.serviceReports.appointmentId, schema.appointments.id))
      .where(and(eq(schema.appointments.storeId, storeId), gte(schema.serviceReports.generatedAt, from), lt(schema.serviceReports.generatedAt, to)));
    const paidRows = await ctx.db
      .select({ staffId: schema.appointments.staffId, customerId: schema.appointments.customerId, paidAt: schema.appointments.paidAt })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.storeId, storeId), gte(schema.appointments.paidAt, from), lt(schema.appointments.paidAt, new Date(from.getTime() + 90 * 24 * 3600 * 1000))));
    const appeals = await ctx.db
      .select()
      .from(schema.metricAppeals)
      .where(eq(schema.metricAppeals.storeId, storeId));
    const approvedReviewIds = new Set(appeals.filter((a) => a.status === 'approved' && a.targetType === 'review').map((a) => a.targetId));
    const rows = staffRows.map((s) => {
      const myReviews = reviews.filter((r) => r.staffId === s.id);
      const myBad = myReviews.filter((r) => isBad(r.rating) && !approvedReviewIds.has(r.id));
      const myReports = reports.filter((r) => r.staffId === s.id && r.deliveredAt !== null);
      const mine = paidRows.filter((r) => r.staffId === s.id && r.paidAt && r.paidAt.getTime() < to.getTime());
      const myCustomers = new Set(mine.map((r) => r.customerId));
      /* 复购率=本月服务客户中 90 天内 ≥2 笔已收款单（任意员工）的比例 */
      const repurchased = [...myCustomers].filter(
        (cid) => paidRows.filter((l) => l.customerId === cid && l.paidAt !== null).length >= 2,
      ).length;
      const myAppeals = appeals.filter((a) => a.staffId === s.id);
      return {
        staffId: s.id,
        staffName: s.name,
        reviewCount: myReviews.length,
        badRate: myReviews.length > 0 ? myBad.length / myReviews.length : null,
        reportAvgMinutes: myReports.length > 0
          ? Math.round(myReports.reduce((sum, r) => sum + (r.deliveredAt!.getTime() - r.generatedAt.getTime()) / 60000, 0) / myReports.length)
          : null,
        repurchaseRate: myCustomers.size > 0 ? repurchased / myCustomers.size : null,
        appealCount: myAppeals.length,
        correctedCount: myAppeals.filter((a) => a.status === 'approved').length,
      };
    });
    return {
      month: input.month,
      rows,
      gate: {
        appealChannel: true,
        correctionLog: true,
        appealEntry: '员工端「我的评价」申诉钮 → metric_appeals 队列（审批中心 /ops）',
        note: '附录 B 铁规两件配齐点亮；员工本人视图=仅本人（V1.3 口径不动）',
      },
    };
  }),

  /* ---------------- 写口族（N4 回复 / N6 申诉 / N7N8 埋点 / CSV 导出） ---------------- */

  /** N4 写口：差评回复+原因标签（owner|manager 本店；再回复覆盖最新，tags 取值集=REVIEWS 表头注） */
  reviewReply: merchantManagerProcedure
    .input(
      z.object({
        reviewId: z.string().min(1),
        reply: z.string().trim().min(1, '回复内容不能为空').max(500),
        tags: z.array(z.string().refine((t) => (schema.REVIEW_TAG_SET as readonly string[]).includes(t), '标签不在既定集合内')).max(5).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.select().from(schema.reviews).where(eq(schema.reviews.id, input.reviewId)).get();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '评价不存在' });
      if (row.storeId !== ctx.user.storeId) throw new TRPCError({ code: 'FORBIDDEN', message: '非本店评价，无权回复' });
      const [updated] = await ctx.db
        .update(schema.reviews)
        .set({ replyText: input.reply, repliedAt: new Date(), repliedBy: ctx.user.id, tags: input.tags ?? row.tags, updatedAt: new Date() })
        .where(eq(schema.reviews.id, row.id))
        .returning();
      return { review: updated };
    }),

  /** N6 铁规①申诉通道（staff 本店）：对差评归属/报表指标提异议 → pending 进审批队列；
   *  同人同目标 pending 在途幂等 duplicated（payrollAppeals 同族工艺） */
  raiseMetricAppeal: staffProcedure
    .input(
      z.object({
        targetType: z.enum(['review', 'report_metric']),
        targetId: z.string().trim().min(1).max(128),
        reason: z.string().trim().min(1, '请填写申诉理由').max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(schema.metricAppeals)
        .where(
          and(
            eq(schema.metricAppeals.staffId, ctx.user.staffId!),
            eq(schema.metricAppeals.targetType, input.targetType),
            eq(schema.metricAppeals.targetId, input.targetId),
            eq(schema.metricAppeals.status, 'pending'),
          ),
        )
        .get();
      if (existing) return { appeal: existing, duplicated: true as const };
      const [row] = await ctx.db
        .insert(schema.metricAppeals)
        .values({
          storeId: ctx.user.storeId!,
          staffId: ctx.user.staffId!,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
        })
        .returning();
      return { appeal: row, duplicated: false as const };
    }),

  /** N6 申诉队列（owner|manager 本店；审批中心数据源：pending 创建升序在前，已审近 50 条在后） */
  listMetricAppeals: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.metricAppeals)
      .where(eq(schema.metricAppeals.storeId, ctx.user.storeId!))
      .orderBy(asc(schema.metricAppeals.createdAt));
    const staffRows = await ctx.db.select({ id: schema.staff.id, name: schema.staff.name }).from(schema.staff).where(eq(schema.staff.storeId, ctx.user.storeId!));
    const nameOf = new Map(staffRows.map((s) => [s.id, s.name]));
    const withName = rows.map((r) => ({ ...r, staffName: nameOf.get(r.staffId) ?? '已离职员工' }));
    return {
      pending: withName.filter((r) => r.status === 'pending'),
      reviewed: withName.filter((r) => r.status !== 'pending').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50),
    };
  }),

  /** N6 铁规②数据错误兜底（owner|manager 本店复核）：approved 必带 correction 前后值
   *  留痕（算错即更正=读口径即时扣减，报表明示纠错数）；rejected 必填意见；
   *  重复复核 400；同事务发 metric.appealResolved → 申诉员工 */
  reviewMetricAppeal: merchantManagerProcedure
    .input(
      z.object({
        appealId: z.string().min(1),
        result: z.enum(['approved', 'rejected']),
        note: z.string().trim().max(500).optional(),
        correction: z.object({ before: z.unknown(), after: z.unknown(), note: z.string().max(255).optional() }).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.select().from(schema.metricAppeals).where(eq(schema.metricAppeals.id, input.appealId)).get();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '申诉不存在' });
      if (row.storeId !== ctx.user.storeId) throw new TRPCError({ code: 'FORBIDDEN', message: '非本店申诉，无权复核' });
      if (row.status !== 'pending') badRequest('该申诉已复核，不可重复复核');
      if (input.result === 'approved' && !input.correction) badRequest('approved 必须携带纠错前后值（correction）——兜底留痕铁规');
      if (input.result === 'rejected' && !input.note) badRequest('驳回必须填写复核意见');
      const now = new Date();
      const { updated, outboxId } = await ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(schema.metricAppeals)
          .set({
            status: input.result,
            reviewerId: ctx.user.id,
            reviewedAt: now,
            reviewNote: input.note ?? null,
            correctionJson: input.correction ?? null,
            updatedAt: now,
          })
          .where(eq(schema.metricAppeals.id, row.id))
          .returning();
        const outboxId = await emitEvent(tx as unknown as BusDb, `staff:${row.staffId}`, EventType.MetricAppealResolved, {
          appealId: row.id,
          result: input.result,
          targetType: row.targetType,
        });
        return { updated, outboxId };
      });
      broadcastNow(outboxId);
      return { appeal: updated };
    }),

  /** N7/N8 埋点预埋写口（登录即可写；event_type 清单=content_events 表头注九类写死） */
  trackContentEvent: publicProcedure
    .input(
      z.object({
        eventType: z.enum([
          'case_impression',
          'case_detail_view',
          'case_dwell',
          'case_read_finish',
          'case_interact',
          'book_same_impression',
          'book_same_click',
          'booking_attributed',
          'booking_verified',
        ]),
        caseId: z.string().trim().max(64).optional(),
        appointmentId: z.string().trim().max(64).optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let storeId: string | null = null;
      if (input.appointmentId) {
        const appt = await ctx.db
          .select({ storeId: schema.appointments.storeId })
          .from(schema.appointments)
          .where(eq(schema.appointments.id, input.appointmentId))
          .get();
        storeId = appt?.storeId ?? null;
      }
      const [row] = await ctx.db
        .insert(schema.contentEvents)
        .values({
          eventType: input.eventType,
          caseId: input.caseId ?? null,
          userId: ctx.user.id,
          appointmentId: input.appointmentId ?? null,
          storeId,
          meta: input.meta ?? null,
        })
        .returning();
      return { id: row.id };
    }),

  /** N7/N8 预埋有效性读数（owner|manager；按事件类型计数——出表=瀑布流批） */
  contentEventStats: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ eventType: schema.contentEvents.eventType, n: sql<number>`count(*)` })
      .from(schema.contentEvents)
      .where(sql`(${schema.contentEvents.storeId} = ${ctx.user.storeId!} OR ${schema.contentEvents.storeId} IS NULL)`)
      .groupBy(schema.contentEvents.eventType);
    return { byType: rows.map((r) => ({ eventType: r.eventType, count: Number(r.n) })), note: 'N7/N8=埋点预埋不出表（瀑布流批出表，H 表 §方向三清单）' };
  }),

  /** CSV 导出（**仅店主** · 总规则③，17 张同闸）：report=d1..d9/n1..n6 + month；
   *  N7/N8=预埋不出表 400 明文；返回 {filename, csv, rows}（BOM+手写转义同 refund.exportCsv 工艺）。
   *  数据源=createCaller 直调本路由读口（口径同源零复制，不另写聚合）。 */
  exportCsv: merchantOwnerProcedure
    .input(z.object({ report: z.enum(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']), month: z.string().regex(MONTH_RE).optional() }))
    .query(async ({ ctx, input }) => {
      const month = input.month ?? `${storeWallclock(new Date()).y}-${pad2(storeWallclock(new Date()).m)}`;
      const caller = reportRouter.createCaller(ctx);
      /* 类型安全 dispatch（报表键→读口名固定映射；名单外无口） */
      const data = await (async (): Promise<Record<string, unknown>> => {
        switch (input.report) {
          case 'd1': return caller.d1Revenue({ month });
          case 'd2': return caller.d2ServiceMix({ month });
          case 'd3': return caller.d3MemberGrowth({ month });
          case 'd4': return caller.d4PassLedger({ month });
          case 'd5': return caller.d5StoredValue({ month });
          case 'd6': return caller.d6Refunds({ month });
          case 'd7': return caller.d7StaffPerf({ month });
          case 'd8': return caller.d8Boarding({ month });
          case 'd9': return caller.d9Goods({ month });
          case 'n1': return caller.n1LevelDist({ month });
          case 'n2': return caller.n2Renewal({ month });
          case 'n3': return caller.n3RebateRoll({ month });
          case 'n4': return caller.n4ReviewDist({ month });
          case 'n5': return caller.n5Delivery({ month });
          case 'n6': return caller.n6StaffQuality({ month });
        }
      })();
      /* 统一骨架：[区, 指标, 值]（明细表逐行展开，section=表明）；列写死=名单内字段 */
      const cell = (v: unknown): string => {
        const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
        return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
      };
      const rows: Array<Array<unknown>> = [['区', '指标', '值']];
      for (const [k, v] of Object.entries(data)) {
        if (k === 'note' || k === 'month') continue;
        if (Array.isArray(v)) {
          for (const item of v as Array<Record<string, unknown>>) {
            rows.push([k, typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item), '']);
          }
        } else if (typeof v === 'object' && v !== null) {
          for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) rows.push([k, k2, v2 as unknown]);
        } else {
          rows.push(['汇总', k, v]);
        }
      }
      const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
      return { filename: `report-${input.report}-${month}.csv`, csv, rows: rows.length };
    }),
});

export type ReportRouter = typeof reportRouter;
