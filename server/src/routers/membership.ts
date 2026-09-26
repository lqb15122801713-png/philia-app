/**
 * 会员 router（批次 R11a 会员前置批·骨架批 · 27 号任务书冻结版 V1.0 §二/§四/§六/§七 +
 * docs/r11/R11a-DESIGN.md §三/§四）
 *
 * namespace membership 端点：
 * - plans            四档配置透出（public；客户端开通页/收银台共用，多宠规则与权益表述明面，
 *                    安心包=全员免费表述在权益 label——CJ-0922-13 落槌，非会员 ¥15 作废）
 * - my               本人会员+回馈金账本（customer；非会员 null+引导）
 * - openFree         微光一键注册（customer；免费 0 元，手机号即会员=用户本身，幂等）
 * - sell             收银台售卡（merchant；到店付现金/微信/支付宝段，多宠附加费入单）
 * - renew            收银台续费（merchant；解冻 frozen→active+expires 顺延+回馈金解冻）
 * - cancel           退会（manager|owner；折算=剩余整月×月均价精确到分，回馈金清零留痕）
 * - savingsPreview   非会员当单「开通萤火立省 ¥X」（merchant；实时读 member_plans 萤火行）
 * - amortizationStats 年费分摊双口径（merchant；日结/看板用：当月售卡实收 + 当月分摊确认）
 *
 * 红线落点：
 * - 三本账物理分离永不计营业额（售卡款=会员费权益服务费，不计储值账户不进储值看板；
 *   回馈金账本见 services/rebate.ts 头注）；
 * - 内测期售卡/续费=收银台「到店付」收款+开通确认（成交即开通；微信/支付宝线上通道
 *   未接入，接口预留——任务书 §〇④）；退会退款=内测期线下原路退回口径（R12 沿用），
 *   refund_fen 透出待线下退，本端点无任何线上退款写入；
 * - 连锁双归属（决策 #41）：会员卡=全局档位表（member_plans 中央建卡，三店通用）；
 *   售卡单 sold_store=bill.store_id=本店落 memberships.sold_store_id；
 * - 售卡提成定额由 commission 读侧自然计提（本路由已落 cashier_bill_items
 *   kind='membership' 行，commission.ts 卡线计提不在本文件——另一代理施工）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  balanceOf,
  clearRebateAccount,
  currentMembership,
  ensureRebateAccount,
  loadMemberPlans,
  planNum,
  rebatePeriodOf,
  unfreezeRebateAccount,
  voidPendingGrants,
  type MemberPlanRow,
} from '../services/rebate';
import type { DbHandle } from '../services/xpAward';
import {
  customerProcedure,
  merchantManagerProcedure,
  merchantProcedure,
  publicProcedure,
  router,
} from '../trpc';
import { ensureOpenShift, genBillNo, withCashierWriteLock } from './cashier';
import { storeDayStartMs, storeWallclock } from './appointment';

/** 事务 handle 类型断言（同 attendance.ts 惯例） */
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* 打回①：退会折算自动挂退款单（R12 同通道）工具                            */
/* ------------------------------------------------------------------ */

/**
 * 退款单号日序发生器：RB-{YYYYMMDD}-{当日 3 位序号}。
 * refund.ts 的 genRefundNo 未导出且本批不动 refund.ts（另一代理钱域文件），
 * 同模式自写（照 cashier genBillNo / refund genRefundNo 模式：门店规范时区 +8
 * 当日窗口 count+1；调用方须在收银写串行锁/事务内使用）。
 */
async function genRefundNoLocal(d: DbHandle, storeId: string, now: Date): Promise<string> {
  const w = storeWallclock(now);
  const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const row = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.refundBills)
    .where(
      and(
        eq(schema.refundBills.storeId, storeId),
        gte(schema.refundBills.createdAt, dayStart),
        lt(schema.refundBills.createdAt, dayEnd),
      ),
    )
    .get();
  const seq = Number(row?.n ?? 0) + 1;
  return `RB-${w.y}${pad2(w.m)}${pad2(w.day)}-${String(seq).padStart(3, '0')}`;
}

/** 门店规范时区（+8）YYYY-MM-DD（refund.ts storeLocalDateStr 未导出，同口径自写） */
function storeLocalDateStrLocal(d: Date): string {
  const w = storeWallclock(d);
  return `${w.y}-${pad2(w.m)}-${pad2(w.day)}`;
}
/** 'YYYY-MM' → 当月起止（本地时区 Date） */
function monthWindow(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

/** 剩余整月数（退会折算口径）：expires_at 往前整月数，已用零头月不计 */
export function remainingWholeMonths(now: Date, expiresAt: Date): number {
  let months =
    (expiresAt.getFullYear() * 12 + expiresAt.getMonth()) -
    (now.getFullYear() * 12 + now.getMonth());
  if (expiresAt.getDate() < now.getDate()) months -= 1; // 已用零头月不计
  return Math.max(0, months);
}

/**
 * 退会折算（CJ-0922-13 落槌口径）：剩余整月×月均价，精确到分。
 * - 月均价=paid_fen÷12（不先取整：59900÷12=4991.66…，×3=14975 精确到分=¥149.75，
 *   对齐任务书示例）；已用零头月不计（到期日「日」< 退会日「日」时当月零头抹掉）；
 * - 续费场景 paid_fen 为当期实付（见 renew），剩余整月理论可超 12，折算封顶 paid_fen
 *   （内测期口径报备：多缴年度折算超额部分不放大退款）。
 */
export function cancelRefundFen(paidFen: number, now: Date, expiresAt: Date): number {
  if (paidFen <= 0) return 0;
  const months = remainingWholeMonths(now, expiresAt);
  return Math.min(Math.round((paidFen * months) / 12), paidFen);
}

/** 档位公开展示形状（plans 端点透出；多宠规则/权益表述明面，label 即权益文案） */
function planPublicShape(row: MemberPlanRow | undefined) {
  if (!row) return null;
  return {
    planKey: row.ruleKey,
    label: row.label,
    version: row.version,
    free: planNum(row, 'free', 0) === 1 || (row.valueJson as Record<string, unknown>).free === true,
    priceFen: planNum(row, 'price_fen', 0),
    rebateBp: planNum(row, 'rebate_bp', 0),
    serviceDiscountBp: planNum(row, 'service_discount_bp', 10000),
    includedPets: planNum(row, 'included_pets', 3),
    extraPetFen: planNum(row, 'extra_pet_fen', 5900),
    maxPets: planNum(row, 'max_pets', 10),
  };
}

/** 售卡/续费金额=档价+多宠附加费（含 included_pets 只，超出每只 +extra_pet_fen；max_pets 封顶硬校验） */
function membershipChargeFen(
  plan: MemberPlanRow,
  petCount: number,
): { amountFen: number; extraCount: number; priceFen: number } {
  const priceFen = planNum(plan, 'price_fen', 0);
  const included = planNum(plan, 'included_pets', 3);
  const extraPetFen = planNum(plan, 'extra_pet_fen', 5900);
  const maxPets = planNum(plan, 'max_pets', 10);
  if (petCount > maxPets) badRequest(`多宠封顶 ${maxPets} 只（第 ${included + 1} 只起 +¥${(extraPetFen / 100).toFixed(2)}/年/只）`);
  const extraCount = Math.max(0, petCount - included);
  return { amountFen: priceFen + extraCount * extraPetFen, extraCount, priceFen };
}

/** 售卡/续费收银段落库（kind='membership' 行 + 支付段 + settled 单；内测期到店付口径） */
async function writeMembershipBill(
  t: DbHandle,
  opts: {
    storeId: string;
    operatorId: string;
    userId: string;
    planKey: string;
    planLabel: string;
    petCount: number;
    amountFen: number;
    paySegments: Array<{ method: 'cash' | 'wechat' | 'alipay'; amountFen: number }>;
    now: Date;
    kindNote: '售卡' | '续费';
    outboxIds: string[];
  },
): Promise<{ billNo: string; billId: string }> {
  const outboxIds = opts.outboxIds;
  const billNo = await genBillNo(t, opts.storeId, opts.now);
  const { shift, openedOutboxId } = await ensureOpenShift(t, opts.storeId, opts.operatorId, opts.now);
  if (openedOutboxId) outboxIds.push(openedOutboxId);
  const bill = await t
    .insert(schema.cashierBills)
    .values({
      billNo,
      storeId: opts.storeId,
      status: 'settled', // 内测期到店付：收款登记即成交（开通确认=成交即开通）
      customerId: opts.userId,
      discountType: 'none', // 售卡单不计服务折扣（年费=权益服务费，红线 6 折扣仅限服务行）
      discountValue: 0,
      subtotalFen: opts.amountFen,
      discountFen: 0,
      payableFen: opts.amountFen,
      paidFen: opts.amountFen,
      note: `${opts.kindNote} ${opts.planLabel}`,
      createdBy: opts.operatorId,
      operatorId: opts.operatorId,
      receptionistId: opts.operatorId,
      shiftId: shift.id,
      settledAt: opts.now,
    })
    .returning()
    .then((r) => r[0]!);
  await t.insert(schema.cashierBillItems).values({
    billId: bill.id,
    kind: 'membership', // 决策 #41 售卡单：sold_store=bill.store_id（消费店语义注释写死）；commission 卡线定额读侧计提
    refId: opts.planKey,
    nameSnapshot: opts.planLabel,
    specSnapshot: `含宠物 ${opts.petCount} 只`,
    qty: 1,
    unitPriceFen: opts.amountFen,
    adjustedPriceFen: null,
    paidByPass: false,
    stockShort: false,
  });
  if (opts.paySegments.length > 0) {
    await t.insert(schema.cashierPayments).values(
      opts.paySegments.map((p) => ({ billId: bill.id, method: p.method, amountFen: p.amountFen, passId: null })),
    );
  }
  outboxIds.push(
    await emitEvent(t, `store:${opts.storeId}`, EventType.CashierBillSettled, {
      billId: bill.id,
      billNo,
      payableFen: opts.amountFen,
      paidFen: opts.amountFen,
      passFen: 0,
      storedValueFen: 0,
      rebateFen: 0,
      storedValueBalanceAfterFen: null,
      itemCount: 1,
      hasStockShort: false,
      kind: 'membership', // 售卡/续费单标记（流水展示区分）
      by: opts.operatorId,
    }),
  );
  return { billNo, billId: bill.id };
}

const paySegmentSchema = z.object({
  method: z.enum(['cash', 'wechat', 'alipay']), // 内测期到店付三段（回馈金/储值/次卡段不用于售卡——三本账物理分离）
  amountFen: z.number().int().min(1, '支付金额须 ≥1 分').max(100_000_000),
});

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const membershipRouter = router({
  /**
   * plans（public）：member_plans active 行透出——客户端开通页/收银台售卡区共用。
   * 四档价格/回馈 bp/折扣 bp/多宠规则+权益表述（label）明面；全局参数
   * （回馈金到账日/回馈金有效期/会员有效期）同包返回（红线 5 规则明面数据源）。
   */
  plans: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.memberPlans)
      .where(eq(schema.memberPlans.active, true));
    const byKey = new Map(rows.map((r) => [r.ruleKey, r]));
    const plans = [...byKey.values()]
      .filter((r) => r.ruleKey.startsWith('plan_'))
      .map(planPublicShape)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .sort((a, b) => a.priceFen - b.priceFen);
    return {
      plans,
      rebateSettlementDay: planNum(byKey.get('rebate_settlement_day'), 'day', 5),
      rebateValidityDays: planNum(byKey.get('rebate_validity_days'), 'days', 365),
      membershipValidityDays: planNum(byKey.get('membership_validity_days'), 'days', 365),
    };
  }),

  /**
   * my（customer）：本人会员页数据源——membership+档位+回馈金账本（balanceOf：
   * 余额/本期预计/状态）+本期明细（当期 period 流水）+非会员 null+引导。
   * 读路径顺带到期懒冻结（红线 4：expire 过日→frozen+余额不可用）。
   */
  my: customerProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const m = await currentMembership(ctx.db, ctx.user.id, now);
    if (!m) {
      return {
        membership: null,
        plan: null,
        rebate: null,
        period: rebatePeriodOf(now),
        periodLogs: [],
        guide: '开通会员享商品回馈金与服务折扣；微光档免费，一键开通（手机号即会员）',
      };
    }
    const plans = await loadMemberPlans(ctx.db);
    const rebate = await balanceOf(ctx.db, ctx.user.id, now);
    const period = rebatePeriodOf(now);
    const periodLogs = await ctx.db
      .select()
      .from(schema.rebateLogs)
      .where(and(eq(schema.rebateLogs.userId, ctx.user.id), eq(schema.rebateLogs.period, period)))
      .orderBy(desc(schema.rebateLogs.createdAt))
      .limit(50);
    return {
      membership: m,
      plan: planPublicShape(plans.get(m.planKey)),
      rebate,
      period,
      periodLogs,
      guide: null,
    };
  }),

  /**
   * forUser（merchant 本店，clerk 放行）：收银台「识别会员后带出档位/回馈金余额/宠物数」
   * 正式通道（任务书 §四.1）——此前收银台靠成交回写缓存降级，本端点消降级。
   * 返回该用户当前 membership（档位/status/expiresAt/petCount/paidFen/soldStore）+
   * 档位配置 + rebate balanceOf（余额/本期预计/status）；非会员 membership=null。
   * 读路径顺带到期懒冻结（红线 4，同 my）。
   */
  forUser: merchantProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const m = await currentMembership(ctx.db, input.userId, now);
      const plans = await loadMemberPlans(ctx.db);
      const rebate = await balanceOf(ctx.db, input.userId, now);
      return {
        membership: m,
        plan: m ? planPublicShape(plans.get(m.planKey)) : null,
        rebate,
      };
    }),

  /**
   * openFree（customer）：微光一键注册——免费档 0 元开档（paid_fen=0，
   * expires=+membership_validity_days 读表默认 365 天，status=active）。
   * 手机号即会员=用户本身（users 行即会员身份，无需另建档案）。
   * 幂等：已有 active/frozen 会员直接返回现状；退会（cancelled）后可重新开通。
   */
  openFree: customerProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    return ctx.db.transaction(async (tx) => {
      const t = txDb(tx);
      const existing = await currentMembership(t, ctx.user.id, now);
      if (existing) return { membership: existing, idempotent: true as const };
      const plans = await loadMemberPlans(t);
      const days = planNum(plans.get('membership_validity_days'), 'days', 365);
      const row = await t
        .insert(schema.memberships)
        .values({
          userId: ctx.user.id,
          planKey: 'plan_weiguang',
          soldStoreId: null, // 微光自助开档无办卡店（决策 #41 双归属：NULL 或注册店，骨架批=NULL）
          startedAt: now,
          expiresAt: new Date(now.getTime() + days * 24 * 3600 * 1000),
          status: 'active',
          petCount: 0,
          paidFen: 0,
        })
        .returning()
        .then((r) => r[0]!);
      await ensureRebateAccount(t, ctx.user.id, now); // 回馈金账户一人一本预建（余额 0）
      return { membership: row, idempotent: false as const };
    });
  }),

  /**
   * sell（merchant 本店）：收银台售卡（开通确认=成交即开通）。
   * - 用户：userId 直传 或 手机号旁路建档（手机号无账号→仅建 users+user_roles
   *   customer 档案，不开任何档位；购卡成交才开档——任务书 §四.6 新客快速开卡口径）；
   * - 金额=档价+多宠附加费（petCount>included_pets 起每只 +extra_pet_fen，max_pets
   *   封顶硬校验）；微光档 price=0 → 0 元单直接成交（paySegments 须为空）；
   * - 事务：cashier 单落 kind='membership' 行+支付段（settled，不计服务折扣）+
   *   memberships 落库（sold_store=本店，+365 天读表，status=active）+回馈金账户预建；
   *   售卡提成由 commission 读侧自然计提（kind='membership' 行已落，不在本文件）；
   * - 已是会员（active/frozen）拒售卡，指引走 renew；退会后可重新购卡。
   */
  sell: merchantProcedure
    .input(
      z
        .object({
          userId: z.string().min(1).optional(),
          phone: z.string().trim().regex(/^1\d{10}$/, '手机号格式不正确').optional(),
          planKey: z.string().min(1),
          petCount: z.number().int().min(0).max(99),
          paySegments: z.array(paySegmentSchema).max(3).default([]),
        })
        .refine((v) => !!v.userId || !!v.phone, { message: '须传 userId 或手机号（旁路建档）' }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          const now = new Date();
          const plans = await loadMemberPlans(t);
          const plan = plans.get(input.planKey);
          if (!plan || !plan.ruleKey.startsWith('plan_')) badRequest('档位不存在或已停用');
          const { amountFen, extraCount } = membershipChargeFen(plan, input.petCount);
          const sumPay = input.paySegments.reduce((s, p) => s + p.amountFen, 0);
          if (amountFen === 0) {
            if (input.paySegments.length > 0) badRequest('免费档开档无须支付段');
          } else if (sumPay !== amountFen) {
            badRequest(
              `支付合计（${(sumPay / 100).toFixed(2)} 元）须等于售卡金额（${(amountFen / 100).toFixed(2)} 元${extraCount > 0 ? `，含多宠附加 ${extraCount} 只` : ''}）`,
            );
          }

          /* 用户解析：手机号旁路建档（仅建档不开档，购卡才开——本端点即购卡成交） */
          let userId = input.userId ?? null;
          if (!userId && input.phone) {
            const found = await t
              .select({ id: schema.users.id })
              .from(schema.users)
              .where(eq(schema.users.phone, input.phone))
              .get();
            if (found) {
              userId = found.id;
            } else {
              const created = await t
                .insert(schema.users)
                .values({
                  kimiId: `phone:${input.phone}`, // 旁路建档占位（Kimi/微信账号未绑定；手机号即建档键）
                  phone: input.phone,
                  nickname: `新客 ${input.phone.slice(-4)}`,
                })
                .returning({ id: schema.users.id })
                .then((r) => r[0]!);
              await t.insert(schema.userRoles).values({ userId: created.id, role: 'customer' });
              userId = created.id;
            }
          }
          if (!userId) badRequest('须传 userId 或手机号（旁路建档）');
          const userRow = await t
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .get();
          if (!userRow) badRequest('客户不存在');

          const existing = await currentMembership(t, userId, now);
          if (existing) badRequest('该客户已是会员（续费请走 membership.renew；退会后可重新购卡）');

          const { billNo, billId } = await writeMembershipBill(t, {
            storeId,
            operatorId: ctx.user.id,
            userId,
            planKey: input.planKey,
            planLabel: plan.label,
            petCount: input.petCount,
            amountFen,
            paySegments: input.paySegments,
            now,
            kindNote: '售卡',
            outboxIds,
          });

          const days = planNum(plans.get('membership_validity_days'), 'days', 365);
          const membership = await t
            .insert(schema.memberships)
            .values({
              userId,
              planKey: input.planKey,
              soldStoreId: storeId, // 决策 #41 双归属：售卡单 sold_store=本店
              startedAt: now,
              expiresAt: new Date(now.getTime() + days * 24 * 3600 * 1000),
              status: 'active',
              petCount: input.petCount,
              paidFen: amountFen, // 实付（多宠附加费含）
            })
            .returning()
            .then((r) => r[0]!);
          await ensureRebateAccount(t, userId, now);
          return { billNo, billId, membership, amountFen };
        });
        outboxIds.forEach(broadcastNow);
        return result;
      });
    }),

  /**
   * renew（merchant 本店）：收银台续费（内测期到店付同售卡链路）。
   * 解冻 frozen→active + expires 顺延（max(now, expires_at)+365 天读表）+
   * 回馈金账户解冻（freeze 留痕行 note 解冻）；active 续费=提前顺延。
   * 金额按当前档位价+既有 petCount 多宠附加费重算（档位变更请退会后重售）。
   * 报备口径：续费后 paid_fen 落当期实付（分摊/退会折算按当期卡价口径）。
   */
  renew: merchantProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        paySegments: z.array(paySegmentSchema).max(3).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          const now = new Date();
          const m = await currentMembership(t, input.userId, now);
          if (!m) badRequest('该客户无会员档案（新开通请走售卡）');
          const plans = await loadMemberPlans(t);
          const plan = plans.get(m.planKey);
          if (!plan) badRequest('档位配置缺失，请检查会员档配置');
          const { amountFen } = membershipChargeFen(plan, m.petCount);
          const sumPay = input.paySegments.reduce((s, p) => s + p.amountFen, 0);
          if (amountFen === 0) {
            if (input.paySegments.length > 0) badRequest('免费档续期无须支付段');
          } else if (sumPay !== amountFen) {
            badRequest(`支付合计（${(sumPay / 100).toFixed(2)} 元）须等于续费金额（${(amountFen / 100).toFixed(2)} 元）`);
          }

          const { billNo, billId } = await writeMembershipBill(t, {
            storeId,
            operatorId: ctx.user.id,
            userId: input.userId,
            planKey: m.planKey,
            planLabel: plan.label,
            petCount: m.petCount,
            amountFen,
            paySegments: input.paySegments,
            now,
            kindNote: '续费',
            outboxIds,
          });

          const days = planNum(plans.get('membership_validity_days'), 'days', 365);
          const base = m.expiresAt.getTime() > now.getTime() ? m.expiresAt : now; // 到期冻结后续费自今日顺延
          const membership = await t
            .update(schema.memberships)
            .set({
              status: 'active', // 解冻 frozen→active（红线 4：续费解冻）
              expiresAt: new Date(base.getTime() + days * 24 * 3600 * 1000),
              paidFen: amountFen, // 报备：当期实付口径（分摊/退会折算按当期卡价）
              updatedAt: now,
            })
            .where(eq(schema.memberships.id, m.id))
            .returning()
            .then((r) => r[0]!);
          await unfreezeRebateAccount(t, { userId: input.userId, sourceId: billNo, now });
          return { billNo, billId, membership, amountFen };
        });
        outboxIds.forEach(broadcastNow);
        return result;
      });
    }),

  /**
   * cancel（manager|owner · 任务书 §六 退会审批档）：退会。
   * - 折算=剩余整月×月均价精确到分（cancelRefundFen，CJ-0922-13 口径）→ refund_fen
   *   落留痕；**内测期线下原路退回**（无线上退款通道，refund_fen 透出待线下退）；
   * - 同事务：回馈金清零（clear 行前后值）+ memberships status='cancelled'+
   *   cancelled_at/reason；到期已 frozen 也可退会（余额一样清零）；
   * - 打回②（七步复核）：退会清零含未到账——未结算 grant 先写「退会作废未到账
   *   回馈金 N 分（期次 X）」汇总 clear 留痕行（before=after，pendings 不进余额
   *   故前后值不动）；settleMonthly 同步跳过 cancelled 用户 grant（双保险）；
   * - 打回①（七步复核）：折算不悬空——同事务自动挂退款单（R12 同通道
   *   refund_bills，type='membership_cancel'[中文签「会员退会」（UI/CSV 映射已落地）]，
   *   status='executed' 账已联动/refund_method='offline_original' 现金实退待线下），
   *   bill_id=该会员售卡原单（kind='membership' 最近 settled 未冲正单；查不到→
   *   拒绝退会并明示「无售卡原单，退会须店主人工办理」）——实退待办
   *   refund.pendingActual（>24h）自动可见、refund.list 可查、settleActual 通用；
   * - emitEvent user 频道（客户侧文案口径「退款已安排，按原路退回」）。
   */
  cancel: merchantManagerProcedure
    .input(z.object({ userId: z.string().min(1), reason: z.string().min(1, '退会原因必填').max(200) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const result = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        const now = new Date();
        const m = await currentMembership(t, input.userId, now);
        if (!m) badRequest('该客户无有效会员（或已退会）');

        /* ---- 打回①前置：售卡原单挂号（折算不悬空——查不到原单拒绝退会，先于任何写入） ---- */
        const origItem = await t
          .select({ billId: schema.cashierBillItems.billId })
          .from(schema.cashierBillItems)
          .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.cashierBillItems.billId))
          .where(
            and(
              eq(schema.cashierBillItems.kind, 'membership'),
              eq(schema.cashierBills.customerId, input.userId),
              eq(schema.cashierBills.status, 'settled'),
              isNull(schema.cashierBills.reversedAt), // 被冲正单不算原单
            ),
          )
          .orderBy(desc(schema.cashierBills.settledAt))
          .limit(1)
          .then((r) => r[0]);
        if (!origItem) {
          badRequest('无售卡原单，退会须店主人工办理（退会折算不悬空挂号）');
        }

        const refundFen = cancelRefundFen(m.paidFen, now, m.expiresAt);
        const monthsRemaining = remainingWholeMonths(now, m.expiresAt);

        /* ---- 打回②：未结算 grant 作废留痕（汇总 clear 行，前后值不动）→ 余额清零 ---- */
        const { voidedFen, periods } = await voidPendingGrants(t, {
          userId: input.userId,
          sourceId: m.id,
          now,
        });
        const { clearedFen } = await clearRebateAccount(t, {
          userId: input.userId,
          sourceId: m.id,
          now,
          note: `退会清零（${m.planKey}，退会原因：${input.reason}）`,
        });
        const updated = await t
          .update(schema.memberships)
          .set({
            status: 'cancelled',
            cancelledAt: now,
            cancelReason: input.reason,
            refundFen,
            updatedAt: now,
          })
          .where(eq(schema.memberships.id, m.id))
          .returning()
          .then((r) => r[0]!);

        /* ---- 打回①：退款单落库（R12 同通道；store=执行店，bill=售卡原单店——
           决策 #41 会员卡三店通用，退会实退由执行店登记待办） ---- */
        const refundNo = await genRefundNoLocal(t, storeId, now);
        const refund = await t
          .insert(schema.refundBills)
          .values({
            storeId,
            refundNo,
            bizDate: storeLocalDateStrLocal(now), // V7 口径：执行日
            billId: origItem.billId,
            type: 'membership_cancel', // 中文签「会员退会」（UI/CSV 映射已落地）
            amountFen: refundFen,
            reason: input.reason,
            status: 'executed', // 账已联动（回馈金清零同事务）；现金实退待线下
            refundMethod: 'offline_original', // 内测期线下原路退回
            linkageJson: {
              membershipCancel: {
                planKey: m.planKey,
                paidFen: m.paidFen,
                refundFen,
                clearedRebateFen: clearedFen,
                monthsRemaining,
                voidedPendingFen: voidedFen, // 打回②：作废未到账合计（期次 periods）
                voidedPendingPeriods: periods,
              },
              rebateClawbackFen: 0, // 退会非商品退款，无扣回（列位口径同 R12）
              executedAt: now.toISOString(),
              operatorId: ctx.user.id,
              approverId: ctx.user.id,
              refundMethod: 'offline_original',
              reason: input.reason,
            },
            operatorId: ctx.user.id,
            approverId: ctx.user.id, // 退会审批档=执行人本人（merchantManager 闸门已在路由层）
          })
          .returning()
          .then((r) => r[0]!);

        const outboxId = await emitEvent(t, `user:${input.userId}`, EventType.MembershipCancelled, {
          userId: input.userId,
          planKey: m.planKey,
          refundFen,
          refundNo, // 打回①：退款单号透出（实退待办/查询对齐）
          clearedRebateFen: clearedFen,
          reason: input.reason,
          message: '退款已安排，按原路退回', // 客户侧口径（内测期线下原路退回）
          by: ctx.user.id,
        });
        return {
          membership: updated,
          refundFen,
          refundNo,
          refundId: refund.id,
          clearedRebateFen: clearedFen,
          voidedPendingFen: voidedFen,
          outboxId,
        };
      });
      broadcastNow(result.outboxId);
      const { outboxId: _drop, ...rest } = result;
      return rest;
    }),

  /**
   * savingsPreview（merchant 本店）：非会员当单「开通萤火立省 ¥X」立省钩子
   * （APP-47，结算页一屏一次不打扰）=服务/预约行×(1−萤火折扣 bp)+商品行×萤火回馈 2%，
   * 读 member_plans 萤火行实时算（配置端口改值即生效）。
   */
  savingsPreview: merchantProcedure
    .input(
      z.object({
        lines: z
          .array(
            z.object({
              kind: z.enum(['service', 'product', 'appointment']),
              amountFen: z.number().int().min(0).max(100_000_000),
            }),
          )
          .min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const plans = await loadMemberPlans(ctx.db);
      const yinghuo = plans.get('plan_yinghuo');
      const discBp = planNum(yinghuo, 'service_discount_bp', 8800);
      const rebateBp = planNum(yinghuo, 'rebate_bp', 200);
      let fen = 0;
      for (const l of input.lines) {
        if (l.kind === 'product') fen += Math.round((l.amountFen * rebateBp) / 10000);
        else fen += Math.round((l.amountFen * (10000 - discBp)) / 10000);
      }
      return { fen, text: `开通萤火立省 ¥${(fen / 100).toFixed(2)}` };
    }),

  /**
   * amortizationStats（merchant 本店 · APP-32 年费分摊双口径，日结/看板用）：
   * - cashFen 收现口径：当月售卡/续费实收（settled 且未冲正的 kind='membership'
   *   单 payable 合计，按 settledAt 落月）；
   * - amortizedFen 分摊口径：当月分摊确认=Σ active 会员 paid_fen÷12 精确到分
   *   （逐会员 round 后求和；内测口径=当前 active 快照，month 参数供对账展示同帧）。
   *   Y7 本店口径（急修三件 PD-03 件 2，老板已圈）：Σ 按办卡店过滤
   *   （memberships.sold_store_id=本店）；微光线上开档无办卡店暂不计入任何店
   *   （待连锁合批裁定口径，注释留痕）。
   */
  amortizationStats: merchantProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const { start, end } = monthWindow(input.month);
      const cashRows = await ctx.db
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
            isNull(schema.cashierBills.reversedAt), // 被冲正单不进收入聚合（同 computeDayTender 口径）
            gte(schema.cashierBills.settledAt, start),
            lt(schema.cashierBills.settledAt, end),
          ),
        )
        .get();
      const activeRows = await ctx.db
        .select({ paidFen: schema.memberships.paidFen })
        .from(schema.memberships)
        .where(
          and(
            eq(schema.memberships.status, 'active'),
            /* Y7 本店口径（PD-03 件 2）：分摊按办卡店归属过滤（sold_store_id=本店）；
               微光线上开档 sold_store_id=NULL——暂不计入任何店，待连锁合批裁定口径 */
            eq(schema.memberships.soldStoreId, storeId),
          ),
        );
      return {
        month: input.month,
        cashFen: Number(cashRows?.s ?? 0),
        amortizedFen: activeRows.reduce((s, r) => s + Math.round(r.paidFen / 12), 0),
      };
    }),
});

export type MembershipRouter = typeof membershipRouter;
