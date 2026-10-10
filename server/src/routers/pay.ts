/**
 * 线上支付 router（批次 6 补缺大批 · server 侧收单骨架，namespace pay）
 *
 * 端点：
 * - quote        （customer·query）金额试算透出：server 重算（membership_open=membershipChargeFen 同源；
 *                membership_upgrade=computeUpgradeDiff 同源，与 membership.upgrade 端点同算式）；
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
 * - biz_domain 已实现 membership_open + membership_upgrade（会员链路片 2）；mall（既有
 *   orders/payments 链路）仍为枚举预留，createOrder 拒单（BAD_REQUEST）；
 * - 线上开通兑付=照 sell 的 memberships 写行工艺但 sold_store_id=NULL（线上域，报备）；
 * - 线上升级兑付=照 merchant upgrade 端点写行工艺（注册用户=新购口径全价+有效期重起算；
 *   付费档=即时换档到期日不变+paid_fen=原实付+补差）但**无收银补差单**（线上域无店上下文：
 *   bill_no=NULL，补差留痕=membership_events.meta.payNo=支付单号）+sold_store_id=NULL；
 *   幂等=已是目标档零写入零单据（只置 paid）；
 * - EventType.MembershipOpened / MembershipUpgraded 复用 R11a 既有事件类型，非新增；
 * - createOrder 不拒「已是会员」（membership_open）：兑付幂等（已是会员同档不重建只置 paid），
 *   重复支付退款走 R12 refund.execute 线上原路联动（refund.ts 骨架，双域反查）；
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db';
import { CLIENT_AGREEMENT_CONTENT } from '../config/agreements';
import { providerForChannel, resolvePaymentProvider } from '../payments/provider';
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
import { isKillSwitchOn, resolveScopedRules } from './configRules';
import { fulfillMallOrderPaidTx, withOrderWriteLock } from './mall';
import { applyMembershipRenewTx, computeUpgradeDiff, defaultPlanKeyOf, deriveRenewChargePlan, membershipChargeFen } from './membership';

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

/** 协议三键（线上开通必传，缺一拒单） */
const AGREEMENT_KEYS = ['member_service', 'not_prepaid', 'no_auto_renew'] as const;

/** 片 2（体验大批）：客户端自助签署协议键（寄养协议/医疗授权）——内容为服务端常量
 *  快照（config/agreements.ts，内测简版明面注记；真实文本进 copy 键族由 UI coder 读） */
const SELF_SIGN_AGREEMENT_KEYS = ['boarding_consent', 'medical_auth'] as const;

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

/** 支付超时关单时长（分钟）：pay_rules active 行 pay_timeout_minutes.minutes，缺行兜底 30（种子口径）。
 * 大批片 2 分层：传 storeId 按 resolveScopedRules 解析（本店覆盖行优先）；不传=既有全量口径
 * （membership_open 域无店上下文：quote/create/超时滴答均不传，单活跃行不变式下=最新端口值） */
async function loadPayTimeoutMinutes(d: DbHandle, storeId?: string | null): Promise<number> {
  const rows = await d
    .select({ ruleKey: schema.payRules.ruleKey, valueJson: schema.payRules.valueJson, storeId: schema.payRules.storeId })
    .from(schema.payRules)
    .where(and(eq(schema.payRules.ruleKey, 'pay_timeout_minutes'), eq(schema.payRules.active, true)));
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  const v = (row?.valueJson as Record<string, unknown> | undefined)?.minutes;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 30;
}

/** 线上支付通道开关：pay_rules active 行 pay_channel_enabled.enabled，缺行兜底 true（种子口径）。
 * 大批片 2 分层：同 loadPayTimeoutMinutes 的 storeId 口径；
 * 端口批收尾片 1：kill switch 开=可关参数瞬时回落安全值（本函数恒 false=通道关） */
export async function loadPayChannelEnabled(d: DbHandle, storeId?: string | null): Promise<boolean> {
  if (await isKillSwitchOn(d)) return false;
  const rows = await d
    .select({ ruleKey: schema.payRules.ruleKey, valueJson: schema.payRules.valueJson, storeId: schema.payRules.storeId })
    .from(schema.payRules)
    .where(and(eq(schema.payRules.ruleKey, 'pay_channel_enabled'), eq(schema.payRules.active, true)));
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  return (row?.valueJson as Record<string, unknown> | undefined)?.enabled !== false;
}

/** provider 名 → 通道枚举：产品-1010 片 1 起 ResolvedPaymentProvider.name=PayChannel 直用（映射函数随闸退役） */

/** 手机号掩码（138****5678 口径；无号/非法 → null） */
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const m = /^(\d{3})\d{4}(\d{4})$/.exec(phone);
  return m ? `${m[1]}****${m[2]}` : null;
}

/**
 * 归属校验：本人单才可操作（status/reconcile/mock-callback 共用）。
 * biz_id 语义按域：membership_open / membership_upgrade / membership_renew=users.id
 * （会员域同人同键）；mall=orders.id（联表回查 orders.customer_id，产品-1010 片 2）。
 */
export async function assertPayOrderOwnership(d: DbHandle, order: PayOrderRow, userId: string): Promise<void> {
  if (
    (order.bizDomain === 'membership_open' || order.bizDomain === 'membership_upgrade' || order.bizDomain === 'membership_renew') &&
    order.bizId === userId
  ) return;
  if (order.bizDomain === 'mall') {
    const mallOrder = await d
      .select({ customerId: schema.orders.customerId })
      .from(schema.orders)
      .where(eq(schema.orders.id, order.bizId))
      .get();
    if (mallOrder?.customerId === userId) return;
  }
  forbidden('只能操作本人支付单');
}

/** 业务摘要（listMine/status 透出；membership_open → 档位/宠物数；membership_upgrade → 加原档/新购口径；mall → 订单号；membership_renew → 档位+顺延前到期） */
function bizSummaryOf(order: PayOrderRow) {
  const biz = (order.bizJson ?? {}) as Record<string, unknown>;
  if (order.bizDomain === 'membership_open' || order.bizDomain === 'membership_upgrade') {
    return {
      bizDomain: order.bizDomain,
      planKey: typeof biz.planKey === 'string' ? biz.planKey : null,
      planLabel: typeof biz.planLabel === 'string' ? biz.planLabel : null,
      petCount: typeof biz.petCount === 'number' ? biz.petCount : null,
      fromPlanKey: typeof biz.fromPlanKey === 'string' ? biz.fromPlanKey : null,
      newPurchase: biz.newPurchase === true,
    };
  }
  if (order.bizDomain === 'mall') {
    return {
      bizDomain: order.bizDomain,
      orderId: typeof biz.orderId === 'string' ? biz.orderId : null,
      orderNo: typeof biz.orderNo === 'string' ? biz.orderNo : null,
      storeId: typeof biz.storeId === 'string' ? biz.storeId : null,
    };
  }
  if (order.bizDomain === 'membership_renew') {
    return {
      bizDomain: order.bizDomain,
      planKey: typeof biz.planKey === 'string' ? biz.planKey : null,
      planLabel: typeof biz.planLabel === 'string' ? biz.planLabel : null,
      petCount: typeof biz.petCount === 'number' ? biz.petCount : null,
      previousExpiresAt: typeof biz.previousExpiresAt === 'string' ? biz.previousExpiresAt : null,
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
 * membership_upgrade 兑付（事务内调用；会员链路片 2）：照 merchant upgrade 端点写行工艺，
 * 线上域差异两点——无收银补差单（bill_no=NULL，补差留痕=membership_events.meta.payNo=
 * 支付单号）、sold_store_id=NULL（报备同 membership_open）。
 * - 注册用户档=新购口径：started_at/expires_at 重起算、paid_fen=新档全价（含附加按现 petCount 重算）；
 * - 付费档升档：即时生效新档（plan_key 换、paid_fen=原实付+补差；expires_at/pet_count 不动）；
 * - 幂等：已是目标档（同档重放/重复回调）→ 零写入零单据，membershipCreated=false（只置 paid）；
 * - 金额口径：diffFen=order.amountFen（创建时 computeUpgradeDiff server 重算快照；
 *   settle 内核已硬核 paidFen=amountFen，此处不再复算金额，只复算公式标签留痕）。
 */
async function fulfillMembershipUpgrade(
  t: DbHandle,
  order: PayOrderRow,
  now: Date,
): Promise<FulfillResult> {
  const biz = (order.bizJson ?? {}) as Record<string, unknown>;
  const planKey = typeof biz.planKey === 'string' ? biz.planKey : '';
  if (!planKey) badRequest('支付单业务上下文缺失（biz_json.planKey），拒绝兑付');

  const m = await currentMembership(t, order.bizId, now);
  if (!m) badRequest('会员档案不存在，拒绝兑付');
  // 幂等：已是目标档（同档重放/重复回调）→ 零写入零单据（钱域命门：重放必须零副作用）
  if (m.planKey === planKey) return { membershipId: m.id, membershipCreated: false };
  if (m.status !== 'active') badRequest('会员已到期冻结，拒绝兑付（请续费解冻后再升档）');
  const plans = await loadMemberPlans(t);
  const target = plans.get(planKey);
  if (!target || !target.ruleKey.startsWith('plan_')) badRequest('档位配置缺失，拒绝兑付');
  const cur = plans.get(m.planKey);
  if (m.planKey !== defaultPlanKeyOf(plans) && cur) {
    /* 配置漂移防御：兑付时再核只升不降（创建单后档位价被端口改低的情形） */
    if (planNum(target, 'price_fen', 0) <= planNum(cur, 'price_fen', 0)) {
      badRequest('目标档位价格不高于当前档（期内只升不降），拒绝兑付');
    }
  }
  const diff = computeUpgradeDiff(plans, m, target, now); // 复算取公式标签留痕（金额以单为准）
  const diffFen = order.amountFen;
  const days = planNum(plans.get('membership_validity_days'), 'days', 365);
  const row = await t
    .update(schema.memberships)
    .set(
      diff.formula.newPurchase
        ? {
            /* 注册用户档=新购口径：开通时点重起算有效期，paid_fen=新档全价，线上域 sold_store_id=NULL */
            planKey: target.ruleKey,
            startedAt: now,
            expiresAt: new Date(now.getTime() + days * 24 * 3600 * 1000),
            soldStoreId: null,
            paidFen: diffFen,
            updatedAt: now,
          }
        : {
            /* 付费档升档即时生效：到期日不变、pet_count 不变、paid_fen=原实付+补差 */
            planKey: target.ruleKey,
            paidFen: m.paidFen + diffFen,
            updatedAt: now,
          },
    )
    .where(eq(schema.memberships.id, m.id))
    .returning()
    .then((r) => r[0]!);
  await t.insert(schema.membershipEvents).values({
    userId: order.bizId,
    type: 'upgrade',
    fromPlan: m.planKey,
    toPlan: target.ruleKey,
    diffFen,
    billNo: null, // 线上域无收银补差单；补差留痕=meta.payNo（支付单号）
    meta: {
      payNo: order.payNo,
      online: true, // 线上域（sold_store_id=NULL，报备）
      remainingMonths: diff.remainingMonths,
      baseDiffFen: diff.baseDiffFen,
      petDiffFen: diff.petDiffFen,
      petCount: m.petCount,
      newPurchase: diff.formula.newPurchase,
    },
  });
  return { membershipId: row.id, membershipCreated: true };
}

/**
 * membership_renew 兑付（事务内调用；产品-1010 片 2）：线上续费=到期顺延+回馈金解冻，
 * 内核=applyMembershipRenewTx（与 membership.renew 端点共用单源：同算式同事务）。
 * 线上域差异：无收银单（bill_no=NULL；续费留痕=membership_events type='renew' meta.payNo=
 * 支付单号）+sold_store_id 不动（续费不改归属；线上域口径照 membership_open 报备）。
 * - 幂等：重复回调/补开由 settle 条件更新闸拦（paid 幂等零兑付），此处不另闸；
 * - 漂移防御：兑付时按 deriveRenewChargePlan live 推导计费档，与创建快照 bizJson.planKey
 *   不符=漂移拒（人话，单据留 paying 待超时关单——升级域配置漂移防御同族工艺）；
 * - 金额以单为准（创建时 server 实算快照；settle 内核已硬核 paidFen=amountFen）。
 */
async function fulfillMembershipRenew(t: DbHandle, order: PayOrderRow, now: Date): Promise<void> {
  const biz = (order.bizJson ?? {}) as Record<string, unknown>;
  const snapPlanKey = typeof biz.planKey === 'string' ? biz.planKey : '';
  if (!snapPlanKey) badRequest('支付单业务上下文缺失（biz_json.planKey），拒绝兑付');
  const { m, chargePlan, executesSchedule } = await deriveRenewChargePlan(t, order.bizId, now);
  if (chargePlan.ruleKey !== snapPlanKey) {
    badRequest('续费计费档已变更（预约换档/档位配置变动），本支付单失效——请回会员中心重新发起续费');
  }
  const previousExpiresAt = m.expiresAt;
  const { membership } = await applyMembershipRenewTx(t, {
    m,
    chargePlan,
    executesSchedule,
    now,
    paidFen: order.amountFen,
    rebateSourceId: order.payNo, // 线上域=支付单号留痕（无收银单）
    billNo: null, // 线上域无收银单（同升级域 bill_no=NULL 先例）
  });
  await t.insert(schema.membershipEvents).values({
    userId: order.bizId,
    type: 'renew',
    fromPlan: m.planKey,
    toPlan: chargePlan.ruleKey,
    billNo: null,
    meta: {
      payNo: order.payNo,
      online: true, // 线上域（报备）
      amountFen: order.amountFen,
      petCount: m.petCount,
      previousExpiresAt: previousExpiresAt.toISOString(),
      expiresAt: membership.expiresAt.toISOString(),
    },
  });
}

/**
 * 置 paid + 同事务兑付（回调 / reconcile 共用内核）：
 * - 金额核对红线：paidFen ≠ order.amountFen → 拒 + 告警（不进事务不动单）；
 * - 状态机：条件更新 WHERE status IN ('created','paying') → paid；
 *   影响行数=0：已 paid=重复投递幂等零副作用；closed/failed=非法迁移 400 硬拒；
 * - 同事务兑付（membership_open → memberships 写行幂等不重建；membership_upgrade →
 *   memberships 换档/新购口径重起算+membership_events('upgrade') 留痕，已是目标档零写入）+
 *   SSE user 频道 membership.opened / membership.upgraded（提交后 broadcastNow）。
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

  let outboxIds: string[] = [];
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
      const biz = (order.bizJson ?? {}) as Record<string, unknown>;
      if (order.bizDomain === 'membership_open') {
        const fulfill = await fulfillMembershipOpen(t, order, now);
        outboxIds.push(await emitEvent(t, `user:${order.bizId}`, EventType.MembershipOpened, {
          userId: order.bizId,
          payNo: order.payNo,
          paymentId: opts.paymentId,
          channel: order.channel,
          planKey: biz.planKey ?? null,
          paidFen: order.amountFen,
          membershipId: fulfill.membershipId,
          membershipCreated: fulfill.membershipCreated,
          via: opts.via, // callback=回调兑付 / reconcile=掉单自助补开
          online: true, // 线上域（sold_store_id=NULL，报备）
        }));
        return { order, idempotent: false as const, fulfill };
      }
      if (order.bizDomain === 'membership_upgrade') {
        const fulfill = await fulfillMembershipUpgrade(t, order, now);
        outboxIds.push(await emitEvent(t, `user:${order.bizId}`, EventType.MembershipUpgraded, {
          userId: order.bizId,
          fromPlan: biz.fromPlanKey ?? null,
          toPlan: biz.planKey ?? null,
          diffFen: order.amountFen,
          billNo: null, // 线上域无收银补差单（补差留痕=payNo）
          payNo: order.payNo,
          paymentId: opts.paymentId,
          channel: order.channel,
          membershipId: fulfill.membershipId,
          membershipCreated: fulfill.membershipCreated,
          via: opts.via, // callback=回调兑付 / reconcile=掉单自助补开
          online: true, // 线上域（sold_store_id=NULL，报备）
        }));
        return { order, idempotent: false as const, fulfill };
      }
      /* 产品-1010 片 2：mall 域兑付（商城线上单）——内核=fulfillMallOrderPaidTx（与
         /api/pay/callback 旧链共用单源：pending→paid 条件更新幂等+payments 流水+OrderPaid
         双频道+首单礼）；orders.storeId 兑付全程零触碰（订单店归属=下单事实） */
      if (order.bizDomain === 'mall') {
        const biz = (order.bizJson ?? {}) as Record<string, unknown>;
        const mallOrderId = typeof biz.orderId === 'string' ? biz.orderId : '';
        if (!mallOrderId) badRequest('支付单业务上下文缺失（biz_json.orderId），拒绝兑付');
        const r = await fulfillMallOrderPaidTx(tx, {
          orderId: mallOrderId,
          providerName: order.channel,
          paymentId: opts.paymentId,
          paidFen: opts.paidFen,
          rawCallback: opts.callbackJson ?? null,
        });
        outboxIds.push(...r.outboxIds);
        return { order, idempotent: false as const, fulfill: null };
      }
      /* 产品-1010 片 2：membership_renew 域兑付（线上续费=到期顺延+回馈金解冻，
         内核=applyMembershipRenewTx 与 membership.renew 端点共用单源）+SSE membership.renewed */
      if (order.bizDomain === 'membership_renew') {
        await fulfillMembershipRenew(t, order, now);
        const biz = (order.bizJson ?? {}) as Record<string, unknown>;
        outboxIds.push(await emitEvent(t, `user:${order.bizId}`, EventType.MembershipRenewed, {
          userId: order.bizId,
          planKey: biz.planKey ?? null,
          payNo: order.payNo,
          paymentId: opts.paymentId,
          channel: order.channel,
          amountFen: order.amountFen,
          via: opts.via, // callback=回调兑付 / reconcile=掉单自助补开
          online: true, // 线上域（bill_no=NULL 无收银单，报备）
        }));
        return { order, idempotent: false as const, fulfill: null };
      }
      // 预留域未实现兑付：拒绝（事务回滚，半态零容忍）
      badRequest(`业务域 ${order.bizDomain} 兑付未实现（预留）`);
    }),
  );
  outboxIds.forEach(broadcastNow);
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
      /* 用户频道按域解析（产品-1010 片 2）：会员域 bizId=users.id 直用；mall 域 bizId=orders.id
         须联表取 customer_id——直用 bizId 会撞 notifications FK（无此用户），实证=92.2 红 */
      let userChannelId: string | undefined = order.bizId;
      if (order.bizDomain === 'mall') {
        userChannelId = (
          await txDb(tx)
            .select({ customerId: schema.orders.customerId })
            .from(schema.orders)
            .where(eq(schema.orders.id, order.bizId))
            .get()
        )?.customerId;
      }
      if (userChannelId) {
        outboxId = await emitEvent(txDb(tx), `user:${userChannelId}`, EventType.PayOrderClosed, {
          orderId: order.id,
          payNo: order.payNo,
          bizDomain: order.bizDomain,
          amountFen: order.amountFen,
          by,
        });
      }
      return { order, idempotent: false };
    }),
  );
  if (outboxId) broadcastNow(outboxId);
  /* 产品-1010 片 1 接口族⑤接线：业务关单落库后 best-effort 通道侧关单（仅通道已下单的单；
     外部调用不进事务——失败 ALERT 留日志不阻断业务关单，通道侧差额由对账读口兜底（片 3 留口）） */
  if (!result.idempotent && result.order.paymentId) {
    try {
      const p = await providerForChannel(d, result.order.channel);
      await p.close({ orderId: result.order.id });
    } catch (err) {
      console.error(`[pay] ALERT 通道侧关单失败 orderId=${result.order.id}（业务关单已落库，不阻断）:`, err);
    }
  }
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
   * 读 member_plans 同源，含多宠附加费+封顶；membership_upgrade=computeUpgradeDiff 同源，
   * 注册用户档=新购口径全价、付费档=剩余整月折算补差）；附通道开关与超时时长（开通页明示）。
   * 升级域 petCount 入参不适用（升档不改动宠物数，按现会员档案值重算附加）。
   */
  quote: customerProcedure
    .input(
      z.discriminatedUnion('bizDomain', [
        z.object({
          bizDomain: z.enum(['membership_open', 'membership_upgrade']),
          planKey: z.string().min(1),
          petCount: z.number().int().min(0).max(99),
          /* 片 3 续费优惠试算（开口项 1 裁：只试算透出不碰真收——续费真收=商家端
             到店付既有链 membership.renew，本分支不落任何单据） */
          renewal: z.boolean().optional(),
        }),
        /* 产品-1010 片 2：membership_renew 域续费试算（档位/宠物数=档案 server 读，零入参依赖） */
        z.object({ bizDomain: z.literal('membership_renew') }),
      ]),
    )
    .query(async ({ ctx, input }) => {
      if (input.bizDomain === 'membership_renew') {
        /* 线上续费试算透出（片 2）：金额 server 实算=membership.renew 同算式（当前档价+既有
           宠物附加；预约换档=预约档全价）+顺延至透出；免费档=0 元透出（确认页引导不缴费） */
        const now = new Date();
        const { m, chargePlan, executesSchedule } = await deriveRenewChargePlan(ctx.db, ctx.user.id, now);
        const charge = membershipChargeFen(chargePlan, m.petCount);
        const plans = await loadMemberPlans(ctx.db);
        const days = planNum(plans.get('membership_validity_days'), 'days', 365);
        const base = m.expiresAt.getTime() > now.getTime() ? m.expiresAt : now; // 冻结后自今日顺延（同内核口径）
        return {
          bizDomain: input.bizDomain,
          planKey: chargePlan.ruleKey,
          planLabel: chargePlan.label,
          petCount: m.petCount,
          priceFen: planNum(chargePlan, 'price_fen', 0),
          extraCount: charge.extraCount,
          amountFen: charge.amountFen, // server 实算值（前端展示口径=下单口径，唯一可信源）
          renewal: null,
          renewInfo: {
            fromPlanKey: m.planKey,
            scheduledChange: executesSchedule,
            membershipStatus: m.status,
            currentExpiresAt: m.expiresAt.toISOString(),
            nextExpiresAt: new Date(base.getTime() + days * 24 * 3600 * 1000).toISOString(),
          },
          channelEnabled: await loadPayChannelEnabled(ctx.db),
          timeoutMinutes: await loadPayTimeoutMinutes(ctx.db),
        };
      }
      const plans = await loadMemberPlans(ctx.db);
      const plan = plans.get(input.planKey);
      if (!plan || !plan.ruleKey.startsWith('plan_')) badRequest('档位不存在或已停用');
      if (input.bizDomain === 'membership_upgrade') {
        /* 升级域试算：computeUpgradeDiff 与 membership.upgrade 端点/兑付内核同算式（单源） */
        const now = new Date();
        const m = await currentMembership(ctx.db, ctx.user.id, now);
        if (!m) badRequest('当前还没有会员档案，开通会员请走开通页');
        if (m.planKey === plan.ruleKey) badRequest('当前已是该档会员，无需升级');
        if (m.status !== 'active') badRequest('会员已到期冻结，请续费解冻后再办理升档');
        const diff = computeUpgradeDiff(plans, m, plan, now);
        return {
          bizDomain: input.bizDomain,
          planKey: input.planKey,
          planLabel: plan.label,
          petCount: m.petCount, // 升档不改宠物数：透出档案现值（多宠附加已含在差价算式）
          priceFen: planNum(plan, 'price_fen', 0),
          extraCount: 0,
          amountFen: diff.totalDiffFen, // server 重算值（升级补差/新购全价，唯一可信源）
          renewal: null,
          upgrade: {
            fromPlanKey: m.planKey,
            newPurchase: diff.formula.newPurchase, // true=注册用户档新购口径（全价+有效期重起算）
            remainingMonths: diff.remainingMonths,
            baseDiffFen: diff.baseDiffFen,
            petDiffFen: diff.petDiffFen,
          },
          channelEnabled: await loadPayChannelEnabled(ctx.db),
          timeoutMinutes: await loadPayTimeoutMinutes(ctx.db),
        };
      }
      const { amountFen, extraCount, priceFen } = membershipChargeFen(plan, input.petCount);
      /* 续费优惠：读档 renew_discount_bp（缺键回落 10000=无优惠——fresh 库/未配档
         安全口径）；折后价=全价（档价+多宠附加合计）×bp/10000 精确到分 */
      let renewalQuote: { discountBp: number; amountFen: number; note: string } | null = null;
      if (input.renewal === true) {
        const discountBp = planNum(plan, 'renew_discount_bp', 10000);
        renewalQuote = {
          discountBp,
          amountFen: Math.round((amountFen * discountBp) / 10000),
          note: '续费优惠试算透出（真收走商家端到店付既有链，本片不碰）',
        };
      }
      return {
        bizDomain: input.bizDomain,
        planKey: input.planKey,
        planLabel: plan.label,
        petCount: input.petCount,
        priceFen,
        extraCount,
        amountFen, // server 重算值（前端展示口径=下单口径，唯一可信源）
        renewal: renewalQuote,
        channelEnabled: await loadPayChannelEnabled(ctx.db),
        timeoutMinutes: await loadPayTimeoutMinutes(ctx.db),
      };
    }),

  /**
   * signAgreement（customer · 片 2）：预约链路协议自助签署——boarding_consent 寄养协议 /
   * medical_auth 医疗授权。复用 agreements 表快照工艺：content/version=服务端常量快照
   * （config/agreements.ts，签署时点固化、改版不回溯）+ checked_at + user_snapshot
   * （userId/phoneMasked 取证要素）。只增不改，重复签署留新行（幂等不做去重——留痕口径）。
   */
  signAgreement: customerProcedure
    .input(z.object({ agreementKey: z.enum(SELF_SIGN_AGREEMENT_KEYS) }))
    .mutation(async ({ ctx, input }) => {
      const def = CLIENT_AGREEMENT_CONTENT[input.agreementKey];
      const user = await ctx.db
        .select({ phone: schema.users.phone })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .get();
      const row = await ctx.db
        .insert(schema.agreements)
        .values({
          userId: ctx.user.id,
          agreementKey: input.agreementKey,
          version: def.version,
          content: def.content, // 服务端常量快照（不信客户端传入文本）
          checkedAt: new Date(),
          userSnapshot: { userId: ctx.user.id, phoneMasked: maskPhone(user?.phone) },
        })
        .returning()
        .then((r) => r[0]!);
      return { agreement: row };
    }),

  /**
   * createOrder（customer）：创建支付单（四域：membership_open / membership_upgrade / mall / membership_renew）。
   * - 会员域：三协议必传（member_service/not_prepaid/no_auto_renew 各一，缺一/重复/未知键拒单）；
   *   幂等=同人同档当日在途（created/paying）重复创建=返回现状 idempotent=true（协议不重复留痕）；
   * - 商城域（片 2）：orderId 锚单（存在+本人+pending 闸），金额=订单实算落库值；
   *   幂等=同人同单在途=同一支付单复用（幂等天然锚=订单本身，无日界）；
   * - 续费域（片 2）：金额 server 实算=membership.renew 同算式（当前档价+既有宠物附加；预约换档=
   *   预约档全价）；幂等=当日同档在途重放零写入；
   * - 事务①：分域校验+金额重算（入参 amountFen 一律不信直接忽略）+协议三行快照（会员域）
   *   + pay_orders 落（timeoutAt=now+端口时长；channel=provider 通道快照；idemKey=base 或 base+#a{N}）；
   * - 事务外：provider.createOrder（外部调用不进事务；真通道留口「通道未开通」明文
   *   透出拒，单留 created 待超时关闭）→ 条件更新 status='paying'+paymentId。
   */
  createOrder: customerProcedure
    .input(
      z.discriminatedUnion('bizDomain', [
        z.object({
          bizDomain: z.enum(['membership_open', 'membership_upgrade']),
          planKey: z.string().min(1),
          petCount: z.number().int().min(0).max(99),
          /** 前端透传金额（一律不信，仅联调对照留位；落库恒=server 重算） */
          amountFen: z.number().int().min(0).max(100_000_000).optional(),
          agreements: z.array(agreementItemSchema).length(3, '三协议必传（会员服务协议/非预付卡声明/到期不自动续费告知）'),
        }),
        /* 产品-1010 片 2：mall 域（商城订单线上支付）——orderId 锚单；金额=订单实算（不信入参）；协议闸不适用（商城无三协议件） */
        z.object({
          bizDomain: z.literal('mall'),
          orderId: z.string().min(1, '订单号不能为空'),
          amountFen: z.number().int().min(0).max(100_000_000).optional(),
        }),
        /* 产品-1010 片 2：membership_renew 域（线上续费）——档位/宠物数=会员档案 server 读（零入参依赖）；金额=membership.renew 同算式 */
        z.object({
          bizDomain: z.literal('membership_renew'),
          amountFen: z.number().int().min(0).max(100_000_000).optional(),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      /* 协议三键齐校验（会员域独有闸；缺一/重复/未知键一律拒；zod enum 已拦未知键） */
      if (input.bizDomain === 'membership_open' || input.bizDomain === 'membership_upgrade') {
        const keySet = new Set(input.agreements.map((a) => a.agreementKey));
        if (keySet.size !== 3 || !AGREEMENT_KEYS.every((k) => keySet.has(k))) {
          badRequest('三协议必须各传一份（member_service / not_prepaid / no_auto_renew），缺一或重复拒单');
        }
      }
      if (!(await loadPayChannelEnabled(ctx.db))) {
        badRequest('线上支付通道已关闭（pay_channel_enabled=off，内测期请到店办理）');
      }

      const provider = await resolvePaymentProvider(ctx.db); // 切换闸解析（kill 回落 mock→端口行→env 兜底）
      const user = await ctx.db
        .select({ id: schema.users.id, phone: schema.users.phone })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .get();
      const phoneMasked = maskPhone(user?.phone);

      const now = new Date();
      const w = storeWallclock(now);

      /* ---- 事务①：分域校验+金额 server 重算 + 幂等闸 + 协议留痕（会员域） + 支付单落库（写串行锁内分配日序号） ---- */
      const created = await withOrderWriteLock(() =>
        ctx.db.transaction(async (tx) => {
          const t = txDb(tx);

          /* 分域业务上下文（幂等基/金额源/摘要快照）：全部 server 实算，前端入参 amountFen 一律不信 */
          let bizId: string;
          let idemBase: string;
          let amountFen = 0;
          let bizJson: Record<string, unknown> = {};
          let subject = '';
          let timeoutStoreId: string | undefined; // 大批片 2 分层：有店上下文按本店解析端口值（会员域不传=既有全量口径）
          if (input.bizDomain === 'mall') {
            /* 商城域（片 2）：订单锚（存在+本人+pending 闸）；金额=订单实算落库值（创建时逐商品现价重算） */
            const mo = await t.select().from(schema.orders).where(eq(schema.orders.id, input.orderId)).get();
            if (!mo) badRequest('订单不存在');
            if (mo.customerId !== ctx.user.id) forbidden('只能支付本人订单');
            if (mo.status !== 'pending') badRequest(`当前状态（${mo.status}）不可发起支付，仅待支付订单可线上付款`);
            bizId = mo.id;
            idemBase = `${ctx.user.id}|mall|${mo.id}`; // 同人同单在途=同一支付单复用（幂等天然锚=订单本身，无日界）
            amountFen = mo.totalFen;
            bizJson = { orderId: mo.id, orderNo: mo.orderNo, storeId: mo.storeId, phoneMasked };
            subject = `菲丽亚商城订单${mo.orderNo}`;
            timeoutStoreId = mo.storeId;
          } else if (input.bizDomain === 'membership_renew') {
            /* 续费域（片 2）：金额 server 实算=membership.renew 同算式（当前档价+既有宠物附加；预约换档=预约档全价） */
            const { m, chargePlan, executesSchedule } = await deriveRenewChargePlan(t, ctx.user.id, now);
            const charge = membershipChargeFen(chargePlan, m.petCount);
            if (charge.amountFen === 0) badRequest('免费档续期无须线上支付（续期自动顺延，无须缴费）');
            bizId = ctx.user.id;
            idemBase = `${ctx.user.id}|membership_renew|${chargePlan.ruleKey}|${w.y}${pad2(w.m)}${pad2(w.day)}`; // 当日同档在途重放零写入
            amountFen = charge.amountFen;
            bizJson = {
              planKey: chargePlan.ruleKey,
              planLabel: chargePlan.label,
              petCount: m.petCount,
              fromPlanKey: m.planKey,
              scheduledChange: executesSchedule,
              previousExpiresAt: m.expiresAt.toISOString(),
              phoneMasked,
            };
            subject = `菲丽亚会员续费·${chargePlan.label}`;
          } else {
            bizId = ctx.user.id; // 会员域（open/upgrade）：biz_id=开通用户（归属/幂等/反查同键）
            idemBase = `${ctx.user.id}|${input.bizDomain}|${input.planKey}|${w.y}${pad2(w.m)}${pad2(w.day)}`;
          }

          /* 幂等闸：同人同域同基在途（created/paying）→ 返回现状 */
          const mine = await t
            .select()
            .from(schema.payOrders)
            .where(
              and(
                eq(schema.payOrders.bizDomain, input.bizDomain),
                eq(schema.payOrders.bizId, bizId),
                inArray(schema.payOrders.status, ['created', 'paying']),
              ),
            );
          const inflight = mine.find((o) => o.idemKey === idemBase || o.idemKey.startsWith(`${idemBase}#`));
          if (inflight) return { order: inflight as PayOrderRow, idempotent: true as const, subject: '' };

          /* 尝试序号：同 base 历史单（含已终结）数 → 新单 idemKey=base 或 base+#a{N+1}（unique 不撞） */
          const allMine = await t
            .select({ idemKey: schema.payOrders.idemKey })
            .from(schema.payOrders)
            .where(
              and(
                eq(schema.payOrders.bizDomain, input.bizDomain),
                eq(schema.payOrders.bizId, bizId),
              ),
            );
          const priorAttempts = allMine.filter(
            (o) => o.idemKey === idemBase || o.idemKey.startsWith(`${idemBase}#`),
          ).length;
          const idemKey = priorAttempts === 0 ? idemBase : `${idemBase}#a${priorAttempts + 1}`;

          /* 会员域：金额重算+收单闸+协议留痕（既有逻辑逐字包进分支） */
          if (input.bizDomain === 'membership_open' || input.bizDomain === 'membership_upgrade') {
            const plans = await loadMemberPlans(t);
            const plan = plans.get(input.planKey);
            if (!plan || !plan.ruleKey.startsWith('plan_')) badRequest('档位不存在或已停用');
            if (input.bizDomain === 'membership_upgrade') {
              /* 升级域：差价=computeUpgradeDiff 重算（与 membership.upgrade 端点/兑付内核同算式）；
                 宠物数=现会员档案值（升档不改 petCount，入参不适用） */
              const m = await currentMembership(t, ctx.user.id, now);
              if (!m) badRequest('当前还没有会员档案，开通会员请走开通页');
              if (m.planKey === plan.ruleKey) badRequest('当前已是该档会员，无需重复支付');
              if (m.status !== 'active') badRequest('会员已到期冻结，请续费解冻后再办理升档');
              const cur = plans.get(m.planKey);
              if (m.planKey !== defaultPlanKeyOf(plans)) {
                if (!cur) badRequest('当前档位配置缺失，请检查会员档配置');
                /* 期内只升不降（冻结明文逐字，同 merchant upgrade 端点口径） */
                if (planNum(plan, 'price_fen', 0) <= planNum(cur, 'price_fen', 0)) {
                  badRequest('会员期内不降级，可在到期前 30 天预约下期档位');
                }
              }
              const diff = computeUpgradeDiff(plans, m, plan, now);
              if (diff.totalDiffFen <= 0) badRequest('零差价升档无需线上支付，请联系门店办理');
              amountFen = diff.totalDiffFen;
              bizJson = {
                planKey: plan.ruleKey,
                planLabel: plan.label,
                petCount: m.petCount,
                phoneMasked,
                fromPlanKey: m.planKey,
                fromPlanLabel: cur?.label ?? m.planKey,
                newPurchase: diff.formula.newPurchase,
                remainingMonths: diff.remainingMonths,
                baseDiffFen: diff.baseDiffFen,
                petDiffFen: diff.petDiffFen,
              };
            } else {
              amountFen = membershipChargeFen(plan, input.petCount).amountFen;
              bizJson = { planKey: input.planKey, planLabel: plan.label, petCount: input.petCount, phoneMasked };
            }
            subject = `菲丽亚会员·${plan.label}`;
            /* 协议三行快照（会员域独有；content/version/checkedAt/userSnapshot 取证四要素） */
            const userSnapshot = { userId: ctx.user.id, phoneMasked, planKey: input.planKey, petCount: bizJson.petCount as number };
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
          }

          const timeoutMinutes = await loadPayTimeoutMinutes(t, timeoutStoreId);
          const payNo = await genPayNo(t, now);
          const order = await t
            .insert(schema.payOrders)
            .values({
              payNo,
              bizDomain: input.bizDomain,
              bizId,
              bizJson,
              amountFen,
              channel: provider.name, // 通道快照=下单时解析结果（PayChannel；在途单按快照解析，切换闸不回溯）
              status: 'created',
              idemKey,
              timeoutAt: new Date(now.getTime() + timeoutMinutes * 60_000),
            })
            .returning()
            .then((r) => r[0]!);
          return { order: order as PayOrderRow, idempotent: false as const, subject };
        }),
      );
      if (created.idempotent) return { ...created, paymentId: created.order.paymentId, payParams: null };

      /* ---- 事务外：通道下单（外部调用不进事务；失败单留 created 待超时关闭） ---- */
      let payment: { paymentId: string; payParams: Record<string, string> };
      try {
        payment = await provider.createOrder({
          orderId: created.order.id,
          totalFen: created.order.amountFen,
          subject: created.subject || '菲丽亚订单',
        });
      } catch (err) {
        // 真通道留口「通道未开通」明文透出拒；单留 created（status 可查/sweeper 到点关）
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
      await assertPayOrderOwnership(ctx.db, order, ctx.user.id);
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
    // 会员域双域并集（open/upgrade）：biz_id=users.id（预留域接入时按域并集）
    const rows = await ctx.db
      .select()
      .from(schema.payOrders)
      .where(
        and(
          inArray(schema.payOrders.bizDomain, ['membership_open', 'membership_upgrade']),
          eq(schema.payOrders.bizId, ctx.user.id),
        ),
      )
      .orderBy(desc(schema.payOrders.createdAt), desc(schema.payOrders.id))
      .limit(50);
    return { items: rows.map((o) => ({ order: o, biz: bizSummaryOf(o) })) };
  }),

  /**
   * recordsMine（customer · 客户端体验大批 片 1 · 开口项 3 裁；产品-1010 片 3 透出扩）：消费记录统一入口——
   * 聚合本人 支付单（pay_orders 会员域三域 open/upgrade/renew + 商城域 mall 联表本人）+ 商城订单
   * （orders，mall 域本人订单读口同源口径）+ 发票申请（invoice_requests，serviceLoop 发票列表同源
   * 口径）三源，按 createdAt 倒序合并返回。
   * 片 3 透出扩：支付单行带 payNo/channel/paymentId/bizDomain/mock 徽标（mock 标「演示」）；
   * 商城域支付单不另立行——挂回商城单行 onlinePaid 字段（防同单双出）。
   * **纯聚合只读视图：零新表零新账，不互相调路由（各源各直接查表）**；他人数据零透出
   * （各源均按本人 userId/customerId 过滤）。
   */
  recordsMine: customerProcedure.query(async ({ ctx }) => {
    const uid = ctx.user.id;
    const [payRows, mallPayRows, orderRows, invoiceRows] = await Promise.all([
      // 源① 支付单（会员域三域并集 open/upgrade/renew，biz_id=users.id；片 3 透出扩 renew）
      ctx.db
        .select()
        .from(schema.payOrders)
        .where(and(inArray(schema.payOrders.bizDomain, ['membership_open', 'membership_upgrade', 'membership_renew']), eq(schema.payOrders.bizId, uid)))
        .orderBy(desc(schema.payOrders.createdAt), desc(schema.payOrders.id))
        .limit(50),
      // 源①b 商城域支付单（bizId=orders.id，联表回查本人；片 3 透出扩 mall）
      ctx.db
        .select({ po: schema.payOrders })
        .from(schema.payOrders)
        .innerJoin(schema.orders, eq(schema.payOrders.bizId, schema.orders.id))
        .where(and(eq(schema.payOrders.bizDomain, 'mall'), eq(schema.orders.customerId, uid)))
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
    /* 商城域支付单按订单挂回（透出=商城单行挂线上支付信息，不另立支付单行——防同单双出） */
    const mallPayByOrderId = new Map(mallPayRows.map((r) => [r.po.bizId, r.po]));
    /* 支付单透出字段（片 3）：payNo/channel/paymentId/bizDomain/mock 徽标（channel='mock'） */
    const payExpose = (o: typeof payRows[number]) => ({
      payNo: o.payNo,
      channel: o.channel,
      paymentId: o.paymentId,
      bizDomain: o.bizDomain,
      mock: o.channel === 'mock',
    });
    const items = [
      ...payRows.map((o) => ({
        kind: 'pay' as const,
        id: o.id,
        title:
          o.bizDomain === 'membership_renew'
            ? `线上续费·${String((o.bizJson as Record<string, unknown> | null)?.planLabel ?? o.payNo)}`
            : `线上支付·${String((o.bizJson as Record<string, unknown> | null)?.planLabel ?? o.payNo)}`,
        amountFen: o.amountFen,
        status: o.status,
        createdAt: o.createdAt,
        link: `/pay/${o.payNo}`,
        ...payExpose(o),
      })),
      ...orderRows.map((o) => {
        const po = mallPayByOrderId.get(o.id);
        return {
          kind: 'order' as const,
          id: o.id,
          title: `商城订单 ${o.orderNo}`,
          amountFen: o.totalFen,
          status: o.status,
          createdAt: o.createdAt,
          link: '/mall/orders', // 客户侧无 /orders/:id 详情页——订单行跳商城订单列表（coder N 报备，主窗对齐）
          /* 片 3：商城单行挂线上支付信息（有线上支付单才挂；无=纯线下/未付单） */
          onlinePaid: po ? { payNo: po.payNo, channel: po.channel, status: po.status, paymentId: po.paymentId, mock: po.channel === 'mock' } : null,
        };
      }),
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
      await assertPayOrderOwnership(ctx.db, order, ctx.user.id);

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
      const provider = await providerForChannel(ctx.db, order.channel); // 在途单按快照通道解析（切换闸不回溯）
      let q: { paymentId: string; status: 'paid' | 'unpaid' | 'closed'; paidFen?: number };
      try {
        q = await provider.queryOrder(order.paymentId);
      } catch (err) {
        // 真通道留口「通道未开通」明文透出拒（零写入）
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
