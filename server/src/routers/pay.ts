/**
 * 线上支付 router（批次 6 补缺大批 · server 侧收单骨架，namespace pay）
 *
 * 端点：
 * - quote        （customer·query）金额试算透出：server 重算（membership_open=membershipChargeFen 同源）；
 * - createOrder  （customer·mutation）创建支付单：三协议留痕+pay_orders 落库（金额 server 重算，
 *                前端入参金额一律不信）+ 通道下单（mock 内测）→ paying；
 *                幂等=同人同档当日在途（created/paying）重复创建返回现状 idempotent=true；
 * - status       （customer·query）本人单查询 + 懒超时（created/paying 且过 timeout_at → 置 closed）；
 * - listMine     （customer·query）本人支付单倒序 + 业务摘要；
 * - reconcile    （customer·mutation）「付了没开」自助补开：查通道 queryOrder（mock=本地账本），
 *                通道已付但业务未兑付 → 事务内条件推进 paid + 同事务补兑付（掉单补偿）。
 *
 * 回调/演示端点（Hono 原生，routes/payOrdersCallback.ts）：
 * - POST /api/pay/orders/callback       平台回调（验签即鉴权；Mock 也走 HMAC 验签流程）；
 * - POST /api/pay/orders/mock-callback  mock 客户端驱动端点（登录+本人+scenario 四态可选，
 *                照 mall mock-callback 同款工艺：服务端构造签名回调走同一验签/处理路径）。
 *
 * 涉钱最高戒律落点：
 * - server 重算一切金额：createOrder 入参 amountFen 直接忽略（保留入参位仅为联调对照，
 *   落库值恒=membershipChargeFen 读表重算）；回调/reconcile 金额核对不符即拒+告警；
 * - 回调验签：Mock 也走 HMAC 验签流程（与真实通道同一路径，绝不绕过）；
 * - 状态机非法迁移硬拒：置 paid/closed/failed 均为条件更新（WHERE status IN (...)），
 *   影响行数=0 且非幂等终态 → 400 硬拒；重复回调（已 paid）幂等零副作用；
 * - 原子事务半态零容忍：协议留痕+支付单落库同事务；置 paid+兑付（memberships 写行）+
 *   事件同事务，任一失败整体回滚；
 * - 超时关单端口化：timeout_at=创建时 pay_timeout_minutes 端口值快照（新规只管新单），
 *   sweeper 60s 轮查置 closed + SSE user 频道 pay.orderClosed；
 * - 移位铁律：pay_no 日序按 created_at 计号，e2e 不得对 pay_orders.created_at 移位。
 *
 * 边界/报备：
 * - biz_domain 本批仅实现 membership_open；membership_upgrade（片 3 未合）/mall（既有
 *   orders/payments 链路）为枚举预留，createOrder 拒单（BAD_REQUEST）；
 * - 线上开通兑付=照 sell 的 memberships 写行工艺但 sold_store_id=NULL（线上域，报备）；
 * - EventType.MembershipOpened 复用 R11a 既有事件类型（'membership.opened'），非新增；
 * - createOrder 不拒「已是会员」：兑付幂等（已是会员同档不重建只置 paid），重复支付
 *   退款走 R12 refund.execute 线上原路联动（refund.ts 骨架）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db';
import { getPaymentProvider } from '../payments/provider';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  currentMembership,
  ensureRebateAccount,
  loadMemberPlans,
  planNum,
} from '../services/rebate';
import type { DbHandle } from '../services/xpAward';
import { customerProcedure, router } from '../trpc';
import { storeDayStartMs, storeWallclock } from './appointment';
import { withOrderWriteLock } from './mall';
import { membershipChargeFen } from './membership';

/** 事务 handle 类型断言（同 attendance.ts 惯例） */
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

// 注意：必须用 function 声明（而非箭头函数常量），TS 才会把「返回 never 的调用」
// 当作控制流终止点（同 mall.ts 惯例）。
function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

type PayOrderRow = typeof schema.payOrders.$inferSelect;

/** 已实现收单的业务域（membership_upgrade 片 3 未合 / mall 既有链路，均为预留） */
const IMPLEMENTED_BIZ_DOMAINS = ['membership_open'] as const;

/** 协议三键（线上开通必传，缺一拒单） */
const AGREEMENT_KEYS = ['member_service', 'not_prepaid', 'no_auto_renew'] as const;

/* ------------------------------------------------------------------ */
/* 单号 / 端口 / 归属                                                    */
/* ------------------------------------------------------------------ */

/**
 * 支付单号日序发生器：PO-{YYYYMMDD}-{当日 3 位序号}（全局日序，无门店维度）。
 * 照 cashier genBillNo / refund genRefundNo 模式：门店规范时区 +8 当日窗口 count+1；
 * 调用方须在写串行锁（withOrderWriteLock）+ 事务内使用。
 */
async function genPayNo(d: DbHandle, now: Date): Promise<string> {
  const w = storeWallclock(now);
  const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const row = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.payOrders)
    .where(and(gte(schema.payOrders.createdAt, dayStart), lt(schema.payOrders.createdAt, dayEnd)))
    .get();
  const seq = Number(row?.n ?? 0) + 1;
  return `PO-${w.y}${pad2(w.m)}${pad2(w.day)}-${String(seq).padStart(3, '0')}`;
}

/** 支付超时关单时长（分钟）：pay_rules active 行 pay_timeout_minutes.minutes，缺行兜底 30（种子口径） */
async function loadPayTimeoutMinutes(d: DbHandle): Promise<number> {
  const row = await d
    .select({ valueJson: schema.payRules.valueJson })
    .from(schema.payRules)
    .where(and(eq(schema.payRules.ruleKey, 'pay_timeout_minutes'), eq(schema.payRules.active, true)))
    .get();
  const v = (row?.valueJson as Record<string, unknown> | undefined)?.minutes;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 30;
}

/** 线上支付通道开关：pay_rules active 行 pay_channel_enabled.enabled，缺行兜底 true（种子口径） */
async function loadPayChannelEnabled(d: DbHandle): Promise<boolean> {
  const row = await d
    .select({ valueJson: schema.payRules.valueJson })
    .from(schema.payRules)
    .where(and(eq(schema.payRules.ruleKey, 'pay_channel_enabled'), eq(schema.payRules.active, true)))
    .get();
  return (row?.valueJson as Record<string, unknown> | undefined)?.enabled !== false;
}

/** provider 名 → 通道枚举（内测=mock；wechat→JSAPI 默认） */
function channelOfProvider(name: string): string {
  return name === 'wechat' ? 'wechat_jsapi' : 'mock';
}

/** 手机号掩码（138****5678 口径；无号/非法 → null） */
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const m = /^(\d{3})\d{4}(\d{4})$/.exec(phone);
  return m ? `${m[1]}****${m[2]}` : null;
}

/**
 * 归属校验：本人单才可操作（status/reconcile/mock-callback 共用）。
 * biz_id 语义按域：membership_open=users.id（本批唯一实现域）；
 * 其余域（预留）一律拒——接入时按域补归属解析（mall=orders.customer_id）。
 */
function assertPayOrderOwnership(order: PayOrderRow, userId: string): void {
  if (order.bizDomain === 'membership_open' && order.bizId === userId) return;
  forbidden('只能操作本人支付单');
}

/** 业务摘要（listMine/status 透出；membership_open → 档位/宠物数） */
function bizSummaryOf(order: PayOrderRow) {
  const biz = (order.bizJson ?? {}) as Record<string, unknown>;
  if (order.bizDomain === 'membership_open') {
    return {
      bizDomain: order.bizDomain,
      planKey: typeof biz.planKey === 'string' ? biz.planKey : null,
      planLabel: typeof biz.planLabel === 'string' ? biz.planLabel : null,
      petCount: typeof biz.petCount === 'number' ? biz.petCount : null,
    };
  }
  return { bizDomain: order.bizDomain };
}

/* ------------------------------------------------------------------ */
/* 兑付内核（回调 / reconcile 共用）                                      */
/* ------------------------------------------------------------------ */

export interface FulfillResult {
  membershipId: string | null;
  /** false=幂等命中（已是会员同档不重建，只置 paid） */
  membershipCreated: boolean;
}

/**
 * membership_open 兑付（事务内调用）：照 sell 的 memberships 写行工艺但
 * sold_store_id=NULL（线上域，报备）。幂等：已是会员（active/frozen）不重建，
 * 返回现状 membershipCreated=false（只置 paid）。
 */
async function fulfillMembershipOpen(
  t: DbHandle,
  order: PayOrderRow,
  now: Date,
): Promise<FulfillResult> {
  const biz = (order.bizJson ?? {}) as Record<string, unknown>;
  const planKey = typeof biz.planKey === 'string' ? biz.planKey : '';
  const petCount = typeof biz.petCount === 'number' ? biz.petCount : 0;
  if (!planKey) badRequest('支付单业务上下文缺失（biz_json.planKey），拒绝兑付');

  const existing = await currentMembership(t, order.bizId, now);
  if (existing) {
    // 幂等：已是会员同档不重建（只置 paid；不同档同样不重建——升级端点片 3 未合，报备）
    return { membershipId: existing.id, membershipCreated: false };
  }
  const plans = await loadMemberPlans(t);
  const plan = plans.get(planKey);
  if (!plan || !plan.ruleKey.startsWith('plan_')) badRequest('档位配置缺失，拒绝兑付');
  const days = planNum(plans.get('membership_validity_days'), 'days', 365);
  const row = await t
    .insert(schema.memberships)
    .values({
      userId: order.bizId,
      planKey,
      soldStoreId: null, // 线上域（报备）：无办卡店
      startedAt: now,
      expiresAt: new Date(now.getTime() + days * 24 * 3600 * 1000),
      status: 'active',
      petCount,
      paidFen: order.amountFen, // 实付=支付单 server 重算金额
    })
    .returning()
    .then((r) => r[0]!);
  await ensureRebateAccount(t, order.bizId, now); // 回馈金账户一人一本预建（余额 0）
  return { membershipId: row.id, membershipCreated: true };
}

/**
 * 置 paid + 同事务兑付（回调 / reconcile 共用内核）：
 * - 金额核对红线：paidFen ≠ order.amountFen → 拒 + 告警（不进事务不动单）；
 * - 状态机：条件更新 WHERE status IN ('created','paying') → paid；
 *   影响行数=0：已 paid=重复投递幂等零副作用；closed/failed=非法迁移 400 硬拒；
 * - 同事务兑付（membership_open → memberships 写行，幂等不重建）+
 *   SSE user 频道 membership.opened（提交后 broadcastNow）。
 */
export async function settlePayOrderPaid(
  d: typeof db,
  opts: {
    orderId: string;
    paymentId: string;
    paidFen: number;
    /** 回调原文（callback 路径必传存档；reconcile 路径无回调原文传 null） */
    callbackJson?: Record<string, unknown> | null;
    via: 'callback' | 'reconcile';
  },
): Promise<{ order: PayOrderRow; idempotent: boolean; fulfill: FulfillResult | null }> {
  const order0 = await d
    .select()
    .from(schema.payOrders)
    .where(eq(schema.payOrders.id, opts.orderId))
    .get();
  if (!order0) {
    console.error(`[pay] ALERT ${opts.via} 指向不存在支付单 orderId=${opts.orderId} paymentId=${opts.paymentId}`);
    throw new TRPCError({ code: 'NOT_FOUND', message: '支付单不存在' });
  }
  /* 金额核对（防篡改/对账红线）：不符即拒 + 告警，订单不动 */
  if (opts.paidFen !== order0.amountFen) {
    console.error(
      `[pay] ALERT ${opts.via} 金额不符：payOrder=${order0.payNo} 应付=${order0.amountFen}fen 实报=${opts.paidFen}fen paymentId=${opts.paymentId}`,
    );
    throw new TRPCError({ code: 'BAD_REQUEST', message: '金额与支付单金额不符（AMOUNT_MISMATCH）' });
  }

  let outboxId = '';
  // 与 createOrder/回调同锁串行进入写事务（libsql 单连接并发事务会中毒连接，见 mall.ts 注释）
  const result = await withOrderWriteLock(() =>
    d.transaction(async (tx) => {
      const t = txDb(tx);
      const now = new Date();
      // SQLite 单写者（叠加应用层串行锁）：事务即行锁。条件更新影响行数=0 ⇒ 已非在途（含重复投递）
      const updated = await tx
        .update(schema.payOrders)
        .set({
          status: 'paid',
          paymentId: opts.paymentId,
          ...(opts.callbackJson !== undefined ? { callbackJson: opts.callbackJson } : {}),
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.payOrders.id, order0.id),
            inArray(schema.payOrders.status, ['created', 'paying']),
          ),
        )
        .returning();
      if (updated.length === 0) {
        const current = await tx
          .select()
          .from(schema.payOrders)
          .where(eq(schema.payOrders.id, order0.id))
          .get();
        if (current!.status === 'paid') {
          // 幂等：已 paid（重复回调/重复 reconcile）→ 直接成功，不重复兑付、不发事件
          return { order: current!, idempotent: true as const, fulfill: null };
        }
        // 状态机非法迁移硬拒：closed/failed 再回调/再支付一律拒
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `当前状态（${current!.status}）不可置 paid（状态机非法迁移硬拒，STATE_CONFLICT）`,
        });
      }
      const order = updated[0]!;
      if (order.bizDomain !== 'membership_open') {
        // 预留域未实现兑付：拒绝（事务回滚，半态零容忍）
        badRequest(`业务域 ${order.bizDomain} 兑付未实现（预留）`);
      }
      const fulfill = await fulfillMembershipOpen(t, order, now);
      outboxId = await emitEvent(t, `user:${order.bizId}`, EventType.MembershipOpened, {
        userId: order.bizId,
        payNo: order.payNo,
        paymentId: opts.paymentId,
        channel: order.channel,
        planKey: (order.bizJson as Record<string, unknown> | null)?.planKey ?? null,
        paidFen: order.amountFen,
        membershipId: fulfill.membershipId,
        membershipCreated: fulfill.membershipCreated,
        via: opts.via, // callback=回调兑付 / reconcile=掉单自助补开
        online: true, // 线上域（sold_store_id=NULL，报备）
      });
      return { order, idempotent: false as const, fulfill };
    }),
  );
  if (outboxId) broadcastNow(outboxId);
  return result;
}

/* ------------------------------------------------------------------ */
/* 超时关单（sweeper 60s / status 懒超时 共用）                            */
/* ------------------------------------------------------------------ */

/**
 * 关单事务（sweeper 与 status 懒超时共用同一路径；口径照 mall cancelPendingOrderWithLock）：
 * 串行写锁 + 条件更新 WHERE status IN ('created','paying') → closed；
 * 影响行数=0（已 paid/closed/failed）→ 幂等返回现状零副作用；
 * 成功关单 → SSE user 频道 pay.orderClosed（提交后广播）。
 */
async function closePayOrderWithLock(
  d: typeof db,
  orderId: string,
  by: 'system_timeout' | 'lazy_status',
): Promise<{ order: PayOrderRow; idempotent: boolean }> {
  let outboxId = '';
  const result = await withOrderWriteLock(() =>
    d.transaction(async (tx) => {
      const now = new Date();
      const updated = await tx
        .update(schema.payOrders)
        .set({ status: 'closed', updatedAt: now })
        .where(
          and(
            eq(schema.payOrders.id, orderId),
            inArray(schema.payOrders.status, ['created', 'paying']),
          ),
        )
        .returning();
      if (updated.length === 0) {
        const current = await tx
          .select()
          .from(schema.payOrders)
          .where(eq(schema.payOrders.id, orderId))
          .get();
        return { order: current!, idempotent: true };
      }
      const order = updated[0]!;
      outboxId = await emitEvent(txDb(tx), `user:${order.bizId}`, EventType.PayOrderClosed, {
        orderId: order.id,
        payNo: order.payNo,
        bizDomain: order.bizDomain,
        amountFen: order.amountFen,
        by,
      });
      return { order, idempotent: false };
    }),
  );
  if (outboxId) broadcastNow(outboxId);
  return result;
}

/**
 * 超时关单扫描（outboxSweeper 60s 轮查；e2e 可直调）：
 * created/paying 且 timeout_at < now 的支付单逐个走关单事务（created=通道下单失败遗留
 * 一并关闭，paying=用户未付超时）。端口值 pay_timeout_minutes 在创建时快照进 timeout_at，
 * 本扫描只按 timeout_at 比较（端口改值只管新单，不回溯在途单）。
 * 返回本轮新关闭的单数（被并发推进的单幂等跳过，不重复计入/发事件）。
 */
export async function closeTimeoutPayOrders(
  d: typeof db = db,
  now: Date = new Date(),
): Promise<number> {
  const stale = await d
    .select({ id: schema.payOrders.id })
    .from(schema.payOrders)
    .where(
      and(
        inArray(schema.payOrders.status, ['created', 'paying']),
        lt(schema.payOrders.timeoutAt, now),
      ),
    )
    .limit(200);
  let closed = 0;
  for (const row of stale) {
    const r = await closePayOrderWithLock(d, row.id, 'system_timeout');
    if (!r.idempotent) closed++;
  }
  return closed;
}

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

const agreementItemSchema = z.object({
  agreementKey: z.enum(AGREEMENT_KEYS),
  version: z.string().trim().min(1, '协议版本不能为空').max(50),
  content: z.string().trim().min(1, '协议内容不能为空').max(20000),
});

export const payRouter = router({
  /**
   * quote（customer）：金额试算透出——server 重算（membership_open=membershipChargeFen
   * 读 member_plans 同源，含多宠附加费+封顶）；附通道开关与超时时长（开通页明示）。
   */
  quote: customerProcedure
    .input(
      z.object({
        bizDomain: z.enum(IMPLEMENTED_BIZ_DOMAINS),
        planKey: z.string().min(1),
        petCount: z.number().int().min(0).max(99),
      }),
    )
    .query(async ({ ctx, input }) => {
      const plans = await loadMemberPlans(ctx.db);
      const plan = plans.get(input.planKey);
      if (!plan || !plan.ruleKey.startsWith('plan_')) badRequest('档位不存在或已停用');
      const { amountFen, extraCount, priceFen } = membershipChargeFen(plan, input.petCount);
      return {
        bizDomain: input.bizDomain,
        planKey: input.planKey,
        planLabel: plan.label,
        petCount: input.petCount,
        priceFen,
        extraCount,
        amountFen, // server 重算值（前端展示口径=下单口径，唯一可信源）
        channelEnabled: await loadPayChannelEnabled(ctx.db),
        timeoutMinutes: await loadPayTimeoutMinutes(ctx.db),
      };
    }),

  /**
   * createOrder（customer）：创建支付单（本批仅 bizDomain='membership_open'）。
   * - 三协议必传（member_service/not_prepaid/no_auto_renew 各一，缺一/重复/未知键拒单）；
   * - 幂等：idem(userId+bizDomain+planKey+当日窗口)→同人同档当日在途（created/paying）
   *   重复创建=返回现状 idempotent=true（协议不重复留痕）；
   * - 事务①：agreements 三行快照（content/version/checkedAt/userSnapshot 取证四要素）
   *   + pay_orders 落（amountFen=server 重算，入参 amountFen 直接忽略不信；
   *   timeoutAt=now+端口时长；channel=provider 映射；idemKey=base 或 base+#a{N}）；
   * - 事务外：provider.createPayment（外部调用不进事务；wechat 骨架 notImplemented 原文
   *   透出拒，单留 created 待超时关闭）→ 条件更新 status='paying'+paymentId。
   */
  createOrder: customerProcedure
    .input(
      z.object({
        bizDomain: z.enum(IMPLEMENTED_BIZ_DOMAINS),
        planKey: z.string().min(1),
        petCount: z.number().int().min(0).max(99),
        /** 前端透传金额（一律不信，仅联调对照留位；落库恒=server 重算） */
        amountFen: z.number().int().min(0).max(100_000_000).optional(),
        agreements: z.array(agreementItemSchema).length(3, '三协议必传（会员服务协议/非预付卡声明/到期不自动续费告知）'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.bizDomain !== 'membership_open') {
        badRequest(`业务域 ${input.bizDomain} 收单未实现（预留）`);
      }
      /* 协议三键齐校验（缺一/重复/未知键一律拒；zod enum 已拦未知键） */
      const keySet = new Set(input.agreements.map((a) => a.agreementKey));
      if (keySet.size !== 3 || !AGREEMENT_KEYS.every((k) => keySet.has(k))) {
        badRequest('三协议必须各传一份（member_service / not_prepaid / no_auto_renew），缺一或重复拒单');
      }
      if (!(await loadPayChannelEnabled(ctx.db))) {
        badRequest('线上支付通道已关闭（pay_channel_enabled=off，内测期请到店办理）');
      }

      const provider = getPaymentProvider();
      const user = await ctx.db
        .select({ id: schema.users.id, phone: schema.users.phone })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .get();
      const phoneMasked = maskPhone(user?.phone);

      const now = new Date();
      const w = storeWallclock(now);
      const idemBase = `${ctx.user.id}|${input.bizDomain}|${input.planKey}|${w.y}${pad2(w.m)}${pad2(w.day)}`;

      /* ---- 事务①：幂等闸 + 协议留痕 + 支付单落库（写串行锁内分配日序号） ---- */
      const created = await withOrderWriteLock(() =>
        ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          /* 幂等闸：同人同档当日在途（created/paying）→ 返回现状 */
          const mine = await t
            .select()
            .from(schema.payOrders)
            .where(
              and(
                eq(schema.payOrders.bizDomain, input.bizDomain),
                eq(schema.payOrders.bizId, ctx.user.id),
                inArray(schema.payOrders.status, ['created', 'paying']),
              ),
            );
          const inflight = mine.find((o) => o.idemKey === idemBase || o.idemKey.startsWith(`${idemBase}#`));
          if (inflight) return { order: inflight as PayOrderRow, idempotent: true as const };

          /* 尝试序号：同 base 历史单（含已终结）数 → 新单 idemKey=base 或 base+#a{N+1}（unique 不撞） */
          const allMine = await t
            .select({ idemKey: schema.payOrders.idemKey })
            .from(schema.payOrders)
            .where(
              and(
                eq(schema.payOrders.bizDomain, input.bizDomain),
                eq(schema.payOrders.bizId, ctx.user.id),
              ),
            );
          const priorAttempts = allMine.filter(
            (o) => o.idemKey === idemBase || o.idemKey.startsWith(`${idemBase}#`),
          ).length;
          const idemKey = priorAttempts === 0 ? idemBase : `${idemBase}#a${priorAttempts + 1}`;

          /* server 重算金额（前端入参 amountFen 一律不信，直接忽略） */
          const plans = await loadMemberPlans(t);
          const plan = plans.get(input.planKey);
          if (!plan || !plan.ruleKey.startsWith('plan_')) badRequest('档位不存在或已停用');
          const { amountFen } = membershipChargeFen(plan, input.petCount);
          const timeoutMinutes = await loadPayTimeoutMinutes(t);

          const userSnapshot = { userId: ctx.user.id, phoneMasked, planKey: input.planKey, petCount: input.petCount };
          await t.insert(schema.agreements).values(
            input.agreements.map((a) => ({
              userId: ctx.user.id,
              agreementKey: a.agreementKey,
              version: a.version,
              content: a.content,
              checkedAt: now,
              userSnapshot,
            })),
          );

          const payNo = await genPayNo(t, now);
          const order = await t
            .insert(schema.payOrders)
            .values({
              payNo,
              bizDomain: input.bizDomain,
              bizId: ctx.user.id, // membership_open：biz_id=开通用户（归属/幂等/反查同键）
              bizJson: { planKey: input.planKey, planLabel: plan.label, petCount: input.petCount, phoneMasked },
              amountFen,
              channel: channelOfProvider(provider.name),
              status: 'created',
              idemKey,
              timeoutAt: new Date(now.getTime() + timeoutMinutes * 60_000),
            })
            .returning()
            .then((r) => r[0]!);
          return { order: order as PayOrderRow, idempotent: false as const };
        }),
      );
      if (created.idempotent) return { ...created, paymentId: created.order.paymentId, payParams: null };

      /* ---- 事务外：通道下单（外部调用不进事务；失败单留 created 待超时关闭） ---- */
      let payment: { paymentId: string; payParams: Record<string, string> };
      try {
        payment = await provider.createPayment({
          orderId: created.order.id,
          totalFen: created.order.amountFen,
          subject: `菲丽亚会员·${String((created.order.bizJson as Record<string, unknown>).planLabel ?? input.planKey)}`,
        });
      } catch (err) {
        // 真通道骨架 notImplemented 原文透出拒；单留 created（status 可查/sweeper 到点关）
        console.error(`[pay] ALERT 通道下单失败 payNo=${created.order.payNo}:`, err);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `通道下单失败：${err instanceof Error ? err.message : String(err)}`,
        });
      }
      const paying = await ctx.db
        .update(schema.payOrders)
        .set({ status: 'paying', paymentId: payment.paymentId, updatedAt: new Date() })
        .where(and(eq(schema.payOrders.id, created.order.id), eq(schema.payOrders.status, 'created')))
        .returning()
        .then((r) => r[0]);
      return {
        order: paying ?? created.order,
        idempotent: false as const,
        paymentId: payment.paymentId,
        payParams: payment.payParams,
      };
    }),

  /**
   * status（customer）：本人单查询 + 懒超时——created/paying 且 now>timeoutAt →
   * 关单事务置 closed（sweeper 同一路径）后返回现状。
   */
  status: customerProcedure
    .input(z.object({ payNo: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      let order = await ctx.db
        .select()
        .from(schema.payOrders)
        .where(eq(schema.payOrders.payNo, input.payNo))
        .get();
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '支付单不存在' });
      assertPayOrderOwnership(order, ctx.user.id);
      const now = new Date();
      if (
        (order.status === 'created' || order.status === 'paying') &&
        order.timeoutAt &&
        order.timeoutAt.getTime() < now.getTime()
      ) {
        const r = await closePayOrderWithLock(ctx.db, order.id, 'lazy_status');
        order = r.order;
      }
      return { order, biz: bizSummaryOf(order) };
    }),

  /** listMine（customer）：本人支付单倒序（最新 50 条）+ 业务摘要。 */
  listMine: customerProcedure.query(async ({ ctx }) => {
    // 本批唯一实现域 membership_open：biz_id=users.id（预留域接入时按域并集）
    const rows = await ctx.db
      .select()
      .from(schema.payOrders)
      .where(
        and(
          eq(schema.payOrders.bizDomain, 'membership_open'),
          eq(schema.payOrders.bizId, ctx.user.id),
        ),
      )
      .orderBy(desc(schema.payOrders.createdAt), desc(schema.payOrders.id))
      .limit(50);
    return { items: rows.map((o) => ({ order: o, biz: bizSummaryOf(o) })) };
  }),

  /**
   * recordsMine（customer · 客户端体验大批 片 1 · 开口项 3 裁）：消费记录统一入口——
   * 聚合本人 支付单（pay_orders，pay.listMine 同源口径）+ 商城订单（orders，mall
   * 域本人订单读口同源口径）+ 发票申请（invoice_requests，serviceLoop 发票列表同源
   * 口径）三源，按 createdAt 倒序合并返回。
   * **纯聚合只读视图：零新表零新账，不互相调路由（三源各直接查表）**；他人数据零透出
   * （三源均按本人 userId/customerId 过滤）。
   */
  recordsMine: customerProcedure.query(async ({ ctx }) => {
    const uid = ctx.user.id;
    const [payRows, orderRows, invoiceRows] = await Promise.all([
      // 源① 支付单（同 pay.listMine 口径：本批唯一实现域 membership_open，biz_id=users.id）
      ctx.db
        .select()
        .from(schema.payOrders)
        .where(and(eq(schema.payOrders.bizDomain, 'membership_open'), eq(schema.payOrders.bizId, uid)))
        .orderBy(desc(schema.payOrders.createdAt), desc(schema.payOrders.id))
        .limit(50),
      // 源② 商城订单（同 mall.listMyOrders 口径：customer_id=本人）
      ctx.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.customerId, uid))
        .orderBy(desc(schema.orders.createdAt), desc(schema.orders.id))
        .limit(50),
      // 源③ 发票申请（同 serviceLoop.invoiceListMine 口径：user_id=本人）
      ctx.db
        .select()
        .from(schema.invoiceRequests)
        .where(eq(schema.invoiceRequests.userId, uid))
        .orderBy(desc(schema.invoiceRequests.createdAt), desc(schema.invoiceRequests.id))
        .limit(50),
    ]);
    const items = [
      ...payRows.map((o) => ({
        kind: 'pay' as const,
        id: o.id,
        title: `线上支付·${String((o.bizJson as Record<string, unknown> | null)?.planLabel ?? o.payNo)}`,
        amountFen: o.amountFen,
        status: o.status,
        createdAt: o.createdAt,
        link: `/pay/${o.payNo}`,
      })),
      ...orderRows.map((o) => ({
        kind: 'order' as const,
        id: o.id,
        title: `商城订单 ${o.orderNo}`,
        amountFen: o.totalFen,
        status: o.status,
        createdAt: o.createdAt,
        link: '/mall/orders', // 客户侧无 /orders/:id 详情页——订单行跳商城订单列表（coder N 报备，主窗对齐）
      })),
      ...invoiceRows.map((r) => ({
        kind: 'invoice' as const,
        id: r.id,
        title: `发票申请 ${r.invoiceNo}`,
        amountFen: r.amountFen,
        status: r.status,
        createdAt: r.createdAt,
        link: '/invoices',
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
    return { items };
  }),

  /**
   * reconcile（customer）：「付了没开」自助补开（掉单补偿）。
   * - 本人单 + 在途（created/paying；先走懒超时，过点置 closed 返回现状明文）；
   * - 查通道 queryOrder（mock=本地账本）：通道侧已付且金额核对过 →
   *   settlePayOrderPaid 事务内条件推进 paid + 同事务补兑付（幂等：已存在会员不重建只置 paid）；
   * - 通道未付 → 返回当前态明文（零写入）。
   */
  reconcile: customerProcedure
    .input(z.object({ payNo: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      let order = await ctx.db
        .select()
        .from(schema.payOrders)
        .where(eq(schema.payOrders.payNo, input.payNo))
        .get();
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '支付单不存在' });
      assertPayOrderOwnership(order, ctx.user.id);

      const now = new Date();
      if (
        (order.status === 'created' || order.status === 'paying') &&
        order.timeoutAt &&
        order.timeoutAt.getTime() < now.getTime()
      ) {
        const r = await closePayOrderWithLock(ctx.db, order.id, 'lazy_status');
        order = r.order;
      }
      if (order.status === 'paid') {
        return { order, reconciled: false as const, message: '支付单已是 paid（业务已兑付）' };
      }
      if (order.status !== 'created' && order.status !== 'paying') {
        return { order, reconciled: false as const, message: `当前状态（${order.status}）不可自助补开` };
      }
      if (!order.paymentId) {
        return { order, reconciled: false as const, message: '通道未下单（created），请稍后或重新创建支付单' };
      }
      const provider = getPaymentProvider();
      let q: { paymentId: string; status: 'paid' | 'unpaid'; paidFen?: number };
      try {
        q = await provider.queryOrder(order.paymentId);
      } catch (err) {
        // 真通道骨架 notImplemented 原文透出拒（零写入）
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `通道查单失败：${err instanceof Error ? err.message : String(err)}`,
        });
      }
      if (q.status !== 'paid') {
        return { order, reconciled: false as const, message: '通道侧未支付（请完成支付后再试）' };
      }
      /* 通道已付但业务未兑付 → 事务内条件推进 + 补兑付（金额核对在 settle 内核，不符拒） */
      const r = await settlePayOrderPaid(ctx.db, {
        orderId: order.id,
        paymentId: order.paymentId,
        paidFen: q.paidFen ?? -1,
        callbackJson: null, // reconcile 无回调原文（callbackJson 保持 NULL，兑付留痕在事件）
        via: 'reconcile',
      });
      return {
        order: r.order,
        reconciled: !r.idempotent,
        message: r.idempotent ? '支付单已是 paid（幂等）' : '通道已付，已自助补开（掉单补偿）',
      };
    }),
});
