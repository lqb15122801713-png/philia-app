/**
 * refundRequest router（批次 C5 · 客户退款申请实体 + 审批缝）
 *
 * 纲：客户端发起退款申请（实体留痕）→ 商家审批缝（店长本店/店主）→ 到店单批准
 * 直通 R12 内核生成退款单（executeRefundCore 复用，阈值/涉储值闸天然生效）；
 * R12 链路本体零改动（refund_bills/computePlan 六联动/阈值/驳回权一行未动）。
 *
 * order_kind 双源（口径写死，见 schema.ts refund_requests 头注）：
 * - appointment = 到店收银单（cashier_bills，预约/商品/混合单，已结账 settled + 本人）：
 *   批准 = executeRefundCore 直通（type=full / partial_items 由申请行项构造，
 *   reason=申请原因+申请单号），直通 executed → 申请单 status='refunded'（退款中），
 *   settleActual 实退登记后联动 'settled'（联动在 refund.ts settleActual 内）；
 * - order = 商城订单（orders，status∈shipped/received + 本人；pending=走取消）：
 *   批准 = 申请单 approved + orders.status='refunding'（售后队列既有档位），
 *   退款线下原路办理——refund_bills.bill_id NOT NULL→cashier_bills（红线禁改），
 *   商城单无 R12 挂接（报备偏差 1）。
 *
 * 端口域（refund_rules 五键，种子随 0017 幂等迁移；config.save 仅 owner，改值零改码）：
 *   refund_request_enabled {enabled} 开关 / refund_apply_window_days {days} 时限 /
 *   refund_free_regret_hours {hour} 免费反悔窗（透出客户端展示用） /
 *   refund_reason_options {keywords} 原因枚举 / refund_sla_hours {hour} 审批 SLA。
 *   读侧缺行兜底默认（同 loadRefundThresholdFen 口径）。
 *
 * 闸序（create）：开关闸 → 原单归属闸（本人+已结账/可退状态）→ 时限闸 → 类型闸
 * （到店单强制 refund_only）→ 原因闸（固定 6 码族禁手打，other=description 必填）
 * → 行项闸（itemIds 按行 / 缺省全额；金额=有效价合计 ≤ 可退余额）→ 幂等闸 → 重购留痕。
 *
 * 幂等（红线同 R12 口径）：同 (customerId,billId) 在途单（submitted/approved/refunded）
 * → create 返回现状 idempotent=true 不新建；approve/reject/cancel 重复调用幂等返回。
 *
 * 报备偏差（PR 中显式列）：
 * 1. 商城订单批准无 R12 退款单挂接（refund_bills.bill_id 红线），走 approved +
 *    orders.status='refunding' + 线下原路；refund_bill_no 恒 NULL，settled 联动不适用。
 * 2. orderKind 语义：appointment=到店收银单（含纯商品收银单——「商品单」归此档，
 *    与预约单同走 cashier_bills）；order=商城订单（orders 表）。
 * 3. 商城单「完成时」口径：orders 无 received_at 列，时限闸取 updated_at（received
 *    转换即更新该列）作完成时代理。
 * 4. 在途集合含 refunded（批准直通后退款中），比任务书（submitted/approved）多一档——
 *    防止退款在途期间对同一原单重复申请。
 * 5. 原因码=固定 6 码族（service_unsatisfied/not_as_described/wrong_order/
 *    overdue_service/pet_health/other），label 取端口 keywords 位置快照——端口改文案
 *    不破码位；历史申请 reason_label 为申请时快照不回溯。
 * 6. 全额退申请 itemsJson=[]（明细由 R12 内核全量处理）；approve 据此区分
 *    full / partial_items。免费反悔窗只透出客户端展示，server 不另设计价闸。
 * 7. SSE 事件：refundRequest.submitted（新申请 → store 频道，补缺大批片 1 补发）+
 *    refundRequest.approved（store+user 双频道，客户端轮询 listMine 兜底）；
 *    EventType 常量 packages/shared 已由补缺大批片 1 顺手收编同步。
 * 8. 重购留痕 reappliedAfterDays（补缺大批片 1 接线）：同客户同 billId 最近一笔
 *    settled 历史申请 → 本次 createdAt−上次 settled 落写（updatedAt 口径，表无
 *    settled_at 列）的天数；只留痕不拦截。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { customerProcedure, merchantManagerProcedure, router } from '../trpc';
import { storeDayStartMs, storeWallclock } from './appointment';
import { withCashierWriteLock } from './cashier';
import { resolveScopedRules } from './configRules';
import { providerForChannel } from '../payments/provider';
import { executeRefundCore } from './refund';

/* ------------------------------------------------------------------ */
/* 常量与类型                                                            */
/* ------------------------------------------------------------------ */

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言，同 cashier.ts 惯例） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

type RefundRequestRow = typeof schema.refundRequests.$inferSelect;
type TimelineEntry = schema.RefundRequestTimelineEntry;

/** 在途状态（create 幂等闸 / approve·reject·cancel 前置）：批准直通后 refunded=退款中亦在途（报备偏差 4） */
const OPEN_STATUSES = ['submitted', 'approved', 'refunded'] as const;

/** 原因码固定 6 码族（禁手打；label 取端口枚举位置快照，报备偏差 5） */
const REASON_CODES = [
  'service_unsatisfied',
  'not_as_described',
  'wrong_order',
  'overdue_service',
  'pet_health',
  'other',
] as const;

/** 原因枚举兜底默认（端口缺行时；与 0017 种子同文） */
const DEFAULT_REASON_OPTIONS = [
  '服务不满意',
  '商品与描述不符',
  '拍错/多拍',
  '未按约定时间服务',
  '宠物健康原因',
  '其他（请补充说明）',
];

// 注意：必须用 function 声明（而非箭头函数常量），TS 才会把「返回 never 的调用」
// 当作控制流终止点（同 cashier.ts 惯例）。
function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* 申请单号发生器（日序，仿 refund.genRefundNo 口径；串行锁保护下分配）        */
/* ------------------------------------------------------------------ */

async function genRequestNo(d: DbHandle, storeId: string, now: Date): Promise<string> {
  const w = storeWallclock(now);
  const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const row = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.refundRequests)
    .where(
      and(
        eq(schema.refundRequests.storeId, storeId),
        gte(schema.refundRequests.createdAt, dayStart),
        lt(schema.refundRequests.createdAt, dayEnd),
      ),
    )
    .get();
  const seq = Number(row?.n ?? 0) + 1;
  return `RR-${w.y}${pad2(w.m)}${pad2(w.day)}-${String(seq).padStart(3, '0')}`;
}

/* ------------------------------------------------------------------ */
/* 端口读取（refund_rules 五键 active 行；缺行兜底默认，同 loadRefundThresholdFen 口径） */
/* ------------------------------------------------------------------ */

interface RefundRequestConfig {
  enabled: boolean;
  applyWindowDays: number;
  freeRegretHours: number;
  reasonOptions: string[];
  slaHours: number;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

async function loadConfig(d: DbHandle, storeId?: string | null): Promise<RefundRequestConfig> {
  const rows = await d
    .select({ ruleKey: schema.refundRules.ruleKey, valueJson: schema.refundRules.valueJson, storeId: schema.refundRules.storeId })
    .from(schema.refundRules)
    .where(
      and(
        inArray(schema.refundRules.ruleKey, [
          'refund_request_enabled',
          'refund_apply_window_days',
          'refund_free_regret_hours',
          'refund_reason_options',
          'refund_sla_hours',
        ]),
        eq(schema.refundRules.active, true),
      ),
    );
  /* 大批片 2 分层：传 storeId 按本店作用域解析（本店覆盖行优先）；不传=既有全量口径 */
  const scoped = storeId === undefined ? rows : resolveScopedRules(rows, storeId);
  const byKey = new Map(scoped.map((r) => [r.ruleKey, r.valueJson]));
  const kw = byKey.get('refund_reason_options')?.keywords;
  return {
    enabled: byKey.get('refund_request_enabled')?.enabled !== false, // 缺行兜底 true（种子口径）
    applyWindowDays: num(byKey.get('refund_apply_window_days')?.days, 30),
    freeRegretHours: num(byKey.get('refund_free_regret_hours')?.hour, 24),
    reasonOptions:
      Array.isArray(kw) && kw.every((x) => typeof x === 'string') && kw.length > 0
        ? kw
        : [...DEFAULT_REASON_OPTIONS],
    slaHours: num(byKey.get('refund_sla_hours')?.hour, 24),
  };
}

/* ------------------------------------------------------------------ */
/* 原单解析（双源，报备偏差 2/3）                                            */
/* ------------------------------------------------------------------ */

interface OriginBill {
  storeId: string;
  billNo: string;
  /** 完成时（时限闸基准）：到店单=settled_at；商城单=updated_at 代理（报备偏差 3） */
  completedAt: Date;
  /** 到店单可退余额（分；商城单=null 不走余额口径，按行/全单于订单总额内） */
  refundableFen: number | null;
  lines: Array<{ itemId: string; label: string; amountFen: number }>;
  /** 按行已退（分/行；商城单恒空） */
  lineRefundedFen: Map<string, number>;
  /* 补缺修复小批 P1-1：算式明面数据源（applyContext 透出；口径与 create 闸单点同源） */
  /** 原单总额（分）：到店单=bill.paidFen；商城单=行合计 */
  originTotalFen: number;
  /** 已退累计（分）：到店单=refund_bills executed|settled 求和（除 pass_cancel 锚点）；
      商城单=refund_requests refunded|settled 求和（线下原路无系统账，通常 0） */
  refundedSoFarFen: number;
}

async function resolveOrigin(
  d: DbHandle,
  orderKind: 'appointment' | 'order',
  billId: string,
  customerId: string,
): Promise<OriginBill> {
  if (orderKind === 'appointment') {
    /* 到店收银单（预约/商品/混合；客户只见本人单） */
    const bill = await d
      .select()
      .from(schema.cashierBills)
      .where(eq(schema.cashierBills.id, billId))
      .get();
    if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: '原单不存在' });
    if (bill.customerId !== customerId) forbidden('非本人单据，无权申请退款');
    if (bill.status === 'open' || bill.status === 'held') badRequest('未支付的单请走取消');
    if (bill.status === 'voided' || bill.reversedAt || bill.status === 'reversal') {
      badRequest('原单已撤单/已冲正，不可申请退款');
    }
    if (bill.status !== 'settled') badRequest('原单未结账，无已收款可退');
    const items = await d
      .select()
      .from(schema.cashierBillItems)
      .where(eq(schema.cashierBillItems.billId, bill.id));
    /* 已退累计（executed|settled 口径；pass_cancel 锚点单不占余额，同 R12 computePlan 口径） */
    const posted = await d
      .select()
      .from(schema.refundBills)
      .where(and(eq(schema.refundBills.billId, bill.id), inArray(schema.refundBills.status, ['executed', 'settled'])));
    const refundedSoFarFen = posted
      .filter((r) => r.linkageJson == null || (r.linkageJson as Record<string, unknown>).anchorOnly !== true)
      .reduce((s, r) => s + r.amountFen, 0);
    const postedIds = posted.map((r) => r.id);
    const prevItems = postedIds.length
      ? await d
          .select()
          .from(schema.refundBillItems)
          .where(inArray(schema.refundBillItems.refundId, postedIds))
      : [];
    const lineRefundedFen = new Map<string, number>();
    for (const pi of prevItems) {
      if (pi.kind === 'item' && pi.billItemId) {
        lineRefundedFen.set(pi.billItemId, (lineRefundedFen.get(pi.billItemId) ?? 0) + pi.amountFen);
      }
    }
    const eff = (it: (typeof items)[number]) => (it.adjustedPriceFen ?? it.unitPriceFen) * it.qty;
    return {
      storeId: bill.storeId,
      billNo: bill.billNo,
      completedAt: bill.settledAt ?? bill.updatedAt,
      refundableFen: bill.paidFen - refundedSoFarFen,
      lines: items.map((it) => ({ itemId: it.id, label: it.nameSnapshot, amountFen: eff(it) })),
      lineRefundedFen,
      originTotalFen: bill.paidFen,
      refundedSoFarFen,
    };
  }
  /* 商城订单（orders；pending=走取消，paid=待发货联系门店，shipped/received 可退——mall.ts 现状口径） */
  const order = await d.select().from(schema.orders).where(eq(schema.orders.id, billId)).get();
  if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
  if (order.customerId !== customerId) forbidden('非本人订单，无权申请退款');
  if (order.status === 'pending') badRequest('未支付的单请走取消');
  if (order.status === 'paid') badRequest('订单待发货，请联系门店办理退款');
  if (order.status === 'cancelled') badRequest('订单已取消，不可申请退款');
  if (order.status !== 'shipped' && order.status !== 'received') {
    badRequest('当前订单状态不可申请退款');
  }
  /* P1-1：商城单已退累计=refund_requests refunded|settled 求和（线下原路无 refund_bills 账，
     通常 0；仅作算式明面透出，create 金额口径不受影响） */
  const postedReqs = await d
    .select({ amountFen: schema.refundRequests.amountFen })
    .from(schema.refundRequests)
    .where(
      and(
        eq(schema.refundRequests.billId, order.id),
        inArray(schema.refundRequests.status, ['refunded', 'settled']),
      ),
    );
  const orderLines = order.items.map((it) => ({
    itemId: it.product_id,
    label: it.name,
    amountFen: it.price_fen * it.quantity,
  }));
  return {
    storeId: order.storeId,
    billNo: order.orderNo,
    completedAt: order.updatedAt, // 完成时代理（报备偏差 3）
    refundableFen: null,
    lines: orderLines,
    lineRefundedFen: new Map(),
    originTotalFen: orderLines.reduce((s, l) => s + l.amountFen, 0),
    refundedSoFarFen: postedReqs.reduce((s, r) => s + r.amountFen, 0),
  };
}

/** timeline 追加（不可变式，返回新数组） */
const appendTimeline = (row: RefundRequestRow, entry: TimelineEntry): TimelineEntry[] => [
  ...(row.timelineJson ?? []),
  entry,
];

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

export const refundRequestRouter = router({
  /**
   * configView（customer）：退款申请页配置透出——五键 active 值一次读，
   * 缺行兜底默认。reasonOptions 返回 [{code,label}]（码族固定，label=端口枚举位置值）。
   */
  configView: customerProcedure.query(async ({ ctx }) => {
    const cfg = await loadConfig(ctx.db);
    return {
      enabled: cfg.enabled,
      applyWindowDays: cfg.applyWindowDays,
      freeRegretHours: cfg.freeRegretHours,
      reasonOptions: REASON_CODES.map((code, i) => ({
        code,
        label: cfg.reasonOptions[i] ?? DEFAULT_REASON_OPTIONS[i]!,
      })),
      slaHours: cfg.slaHours,
    };
  }),

  /**
   * applyContext（customer，补缺修复小批 P1-1）：申请页金额算式明面数据源——
   * 「原单 originTotalFen − 已退 refundedSoFarFen = 本次可退 refundableFen」三件套，
   * 口径与 create 闸单点同源（resolveOrigin；到店单=refund_bills 余额口径除锚点，
   * 商城单=refund_requests refunded|settled 求和、refundableFen=null 客户端照现值）。
   * 归属/状态闸随 resolveOrigin 既有；时限闸属 create 域不在此查（展示层只读）。
   */
  applyContext: customerProcedure
    .input(
      z.object({
        orderKind: z.enum(['appointment', 'order']),
        billId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const origin = await resolveOrigin(ctx.db, input.orderKind, input.billId, ctx.user.id);
      return {
        originTotalFen: origin.originTotalFen,
        refundedSoFarFen: origin.refundedSoFarFen,
        refundableFen: origin.refundableFen,
      };
    }),

  /**
   * create（customer）：退款申请创建。闸序见文件头；全部校验不过=中文明文拒。
   * 幂等：同 (customerId,billId) 在途单 → 返回现状 idempotent=true 不新建。
   */
  create: customerProcedure
    .input(
      z.object({
        orderKind: z.enum(['appointment', 'order']),
        billId: z.string().min(1),
        type: z.enum(['refund_only', 'return_refund']),
        reasonCode: z.string().trim().min(1).max(50),
        description: z.string().trim().max(500).optional(),
        photoUrls: z.array(z.string().min(1).max(500)).max(9).optional(),
        itemIds: z.array(z.string().min(1)).min(1).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customerId = ctx.user.id;
      return withCashierWriteLock(async () => {
        /* SSE 新申请事件（补缺大批片 1）：同事务 emitEvent，提交后 broadcastNow（幂等返回不发） */
        let outboxId: string | null = null;
        const result = await ctx.db.transaction(async (tx) => {
          const d = txDb(tx);
          const now = new Date();

          /* ---- 开关闸 ---- */
          const cfg = await loadConfig(d);
          if (!cfg.enabled) forbidden('退款申请通道维护中，请到店办理');

          /* ---- 原单归属闸（本人+已结账/可退状态）+ 时限闸 ---- */
          const origin = await resolveOrigin(d, input.orderKind, input.billId, customerId);
          /* 大批片 2 分层：时限/原因枚举按原单店作用域解析（本店覆盖行优先于总部行） */
          const cfgS = await loadConfig(d, origin.storeId);
          const windowMs = cfgS.applyWindowDays * 24 * 3600 * 1000;
          if (now.getTime() - origin.completedAt.getTime() > windowMs) {
            badRequest(`已超退款申请时限（${cfgS.applyWindowDays} 天），请到店协商办理`);
          }

          /* ---- 类型闸：到店单强制 refund_only ---- */
          if (input.orderKind === 'appointment' && input.type !== 'refund_only') {
            badRequest('到店单仅支持仅退款（商品需退货请到店办理）');
          }

          /* ---- 原因闸（码族禁手打；other=description 必填） ---- */
          const reasonIdx = (REASON_CODES as readonly string[]).indexOf(input.reasonCode);
          if (reasonIdx === -1) badRequest('退款原因不在可选范围内，请重新选择');
          const reasonLabel = cfgS.reasonOptions[reasonIdx] ?? DEFAULT_REASON_OPTIONS[reasonIdx]!;
          if (input.reasonCode === 'other' && !input.description) {
            badRequest('选择「其他」请补充说明');
          }

          /* ---- 行项闸：itemIds 按行（行须属原单且未退）；缺省=全额 ---- */
          let amountFen = 0;
          let itemsJson: schema.RefundRequestItem[] = [];
          if (input.itemIds && input.itemIds.length > 0) {
            const idSet = new Set(input.itemIds);
            const lines = origin.lines.filter((l) => idSet.has(l.itemId));
            if (lines.length !== idSet.size) badRequest('退款行不属于原单，请刷新后重试');
            for (const l of lines) {
              if ((origin.lineRefundedFen.get(l.itemId) ?? 0) > 0) {
                badRequest(`「${l.label}」已退款，不可重复申请`);
              }
            }
            amountFen = lines.reduce((s, l) => s + l.amountFen, 0);
            if (amountFen <= 0) badRequest('退款行金额合计为 0');
            itemsJson = lines;
          } else {
            /* 全额：到店单=可退余额全量；商城单=订单总额（行明细由内核/售后全量处理，itemsJson=[]） */
            amountFen = origin.refundableFen ?? origin.lines.reduce((s, l) => s + l.amountFen, 0);
            if (amountFen <= 0) badRequest('原单可退余额为 0，不可申请');
          }
          if (origin.refundableFen !== null && amountFen > origin.refundableFen) {
            badRequest('超过原单可退余额');
          }

          /* ---- 幂等闸：同 (customerId,billId) 在途单 → 返回现状不新建 ---- */
          const dup = await d
            .select()
            .from(schema.refundRequests)
            .where(
              and(
                eq(schema.refundRequests.customerId, customerId),
                eq(schema.refundRequests.billId, input.billId),
                inArray(schema.refundRequests.status, [...OPEN_STATUSES]),
              ),
            )
            .orderBy(desc(schema.refundRequests.createdAt), desc(schema.refundRequests.id))
            .limit(1)
            .then((r) => r[0]);
          if (dup) return { request: dup, idempotent: true as const };

          /* ---- 重购留痕（补缺大批片 1 接线）：同客户同原单最近一笔已 settled 历史申请
             → reappliedAfterDays=本次 createdAt−上次 settled 落写时刻的天数（只留痕不拦截）。
             refund_requests 无 settled_at 列：settled 落写=refund.ts settleActual 联动
             （status→'settled' + updatedAt=now），故上次 settled 时刻取该行 updatedAt。 ---- */
          const lastSettled = await d
            .select({ updatedAt: schema.refundRequests.updatedAt })
            .from(schema.refundRequests)
            .where(
              and(
                eq(schema.refundRequests.customerId, customerId),
                eq(schema.refundRequests.billId, input.billId),
                eq(schema.refundRequests.status, 'settled'),
              ),
            )
            .orderBy(desc(schema.refundRequests.updatedAt), desc(schema.refundRequests.id))
            .limit(1)
            .then((r) => r[0]);
          const reappliedAfterDays = lastSettled
            ? Math.max(0, Math.floor((now.getTime() - lastSettled.updatedAt.getTime()) / (24 * 3600 * 1000)))
            : null;

          /* ---- 写行 + timeline 初始 ---- */
          const requestNo = await genRequestNo(d, origin.storeId, now);
          const request = await d
            .insert(schema.refundRequests)
            .values({
              requestNo,
              customerId,
              storeId: origin.storeId,
              orderKind: input.orderKind,
              billId: input.billId,
              billNo: origin.billNo,
              type: input.type,
              reasonCode: input.reasonCode,
              reasonLabel,
              description: input.description ?? null,
              photoUrls: input.photoUrls ?? [],
              amountFen,
              itemsJson,
              status: 'submitted',
              reappliedAfterDays,
              timelineJson: [{ status: 'submitted', at: now.toISOString() }],
            })
            .returning()
            .then((r) => r[0]!);
          /* 补缺大批片 1：新申请 SSE → store 频道（商家端待办实时刷新；幂等返回不发） */
          outboxId = await emitEvent(d, `store:${origin.storeId}`, EventType.RefundRequestSubmitted, {
            requestId: request.id,
            requestNo: request.requestNo,
            billNo: request.billNo,
            amountFen: request.amountFen,
            orderKind: request.orderKind,
          });
          return { request, idempotent: false as const };
        });
        if (outboxId) broadcastNow(outboxId);
        return result;
      });
    }),

  /**
   * cancel（customer）：撤回申请——仅本人 + 仅 submitted 可撤 → cancelled + timeline。
   */
  cancel: customerProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db
        .select()
        .from(schema.refundRequests)
        .where(eq(schema.refundRequests.id, input.requestId))
        .get();
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '申请单不存在' });
      if (req.customerId !== ctx.user.id) forbidden('非本人申请单，无权操作');
      if (req.status === 'cancelled') return { request: req, idempotent: true as const };
      if (req.status !== 'submitted') {
        badRequest(`当前状态（${req.status}）不可撤回，仅待审批的申请可撤回`);
      }
      const now = new Date();
      const updated = await ctx.db
        .update(schema.refundRequests)
        .set({
          status: 'cancelled',
          timelineJson: appendTimeline(req, { status: 'cancelled', at: now.toISOString(), note: '客户撤回' }),
          updatedAt: now,
        })
        .where(eq(schema.refundRequests.id, req.id))
        .returning()
        .then((r) => r[0]!);
      return { request: updated, idempotent: false as const };
    }),

  /**
   * listMine（customer）：本人申请倒序（附原单号/店铺名）。
   */
  listMine: customerProcedure
    .input(
      z
        .object({
          status: z.enum(['submitted', 'approved', 'refunded', 'settled', 'rejected', 'cancelled']).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.refundRequests.customerId, ctx.user.id)];
      if (input?.status) conds.push(eq(schema.refundRequests.status, input.status));
      const rows = await ctx.db
        .select({ request: schema.refundRequests, storeName: schema.stores.name })
        .from(schema.refundRequests)
        .leftJoin(schema.stores, eq(schema.stores.id, schema.refundRequests.storeId))
        .where(and(...conds))
        .orderBy(desc(schema.refundRequests.createdAt), desc(schema.refundRequests.id))
        .limit(100);
      return rows.map((r) => ({ ...r.request, storeName: r.storeName ?? null }));
    }),

  /**
   * getById（customer）：本人申请单全字段（含 timeline / rejectReason / refundBillNo）。
   */
  getById: customerProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const req = await ctx.db
        .select()
        .from(schema.refundRequests)
        .where(eq(schema.refundRequests.id, input.requestId))
        .get();
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '申请单不存在' });
      if (req.customerId !== ctx.user.id) forbidden('无权查看他人申请单');
      return { request: req };
    }),

  /**
   * approve（owner|manager 本店）：批准申请。
   * 到店单：executeRefundCore 直通 R12 六联动（阈值/涉储值闸内核既有天然生效——
   *   店长超阈值照常 FORBIDDEN/留口开关落 draft）；直通 executed → 申请单 'refunded'
   *   （已批准且已生成退款单=退款中）+ refundBillNo 回挂 + approverId/approvedAt +
   *   timeline + SSE refundRequest.approved（store+user 双频道，客户端轮询兜底）。
   * 商城单：approved + orders.status='refunding'；线上付单（pay_orders mall 域 paid）=
   *   通道退款原路联动（产品-1010 片 3：provider.refund 幂等键=requestNo；真通道留口
   *   「通道未开通」透出拒=整体不批可重批）；线下到店付单=照旧线下原路办理（报备偏差 1 不动）。
   * 幂等：已 approved/refunded/settled → 返回现状 idempotent=true。
   */
  approve: merchantManagerProcedure
    .input(z.object({ requestId: z.string().min(1), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const req = await ctx.db
        .select()
        .from(schema.refundRequests)
        .where(eq(schema.refundRequests.id, input.requestId))
        .get();
      if (!req || req.storeId !== storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申请单不存在' });
      }
      if (req.status === 'approved' || req.status === 'refunded' || req.status === 'settled') {
        return { request: req, refundId: null, refundNo: req.refundBillNo, idempotent: true as const, draft: false as const };
      }
      if (req.status !== 'submitted') {
        badRequest(`当前状态（${req.status}）不可批准，仅待审批的申请可批准`);
      }
      const now = new Date();

      if (req.orderKind === 'order') {
        /* ---- 商城单：线上付=通道退款原路联动（产品-1010 片 3；0929 口径：线上付线上退/线下付到店退两路不串） ---- */
        const order = await ctx.db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, req.billId))
          .get();
        /* 线上付判定：pay_orders mall 域 paid 单（bizId=orders.id）存在=线上付单 */
        const paidPayOrder = order
          ? await ctx.db
              .select()
              .from(schema.payOrders)
              .where(
                and(
                  eq(schema.payOrders.bizDomain, 'mall'),
                  eq(schema.payOrders.bizId, order.id),
                  eq(schema.payOrders.status, 'paid'),
                ),
              )
              .orderBy(desc(schema.payOrders.createdAt), desc(schema.payOrders.id))
              .limit(1)
              .then((r) => r[0])
          : undefined;
        let onlineRefundNote: string | null = null;
        if (order && paidPayOrder?.paymentId) {
          /* 通道退款（幂等键=申请单号 requestNo，同号重试只退一笔；失败=整体拒半态零容忍，
             申请单留 submitted 可重批） */
          const provider = await providerForChannel(ctx.db, paidPayOrder.channel); // 在途单按快照通道解析
          const rf = await provider.refund({
            paymentId: paidPayOrder.paymentId,
            refundNo: req.requestNo,
            amountFen: req.amountFen,
            totalFen: paidPayOrder.amountFen,
            reason: `商城售后 ${req.requestNo}：${req.reasonLabel}`,
          });
          onlineRefundNote = `线上原路退回已发起（通道退款单 ${rf.refundId}，支付单 ${paidPayOrder.payNo}）`;
        }
        if (order && order.status !== 'refunding') {
          await ctx.db
            .update(schema.orders)
            .set({ status: 'refunding', updatedAt: now })
            .where(eq(schema.orders.id, order.id));
        }
        const updated = await ctx.db
          .update(schema.refundRequests)
          .set({
            status: 'approved',
            approverId: ctx.user.id,
            approvedAt: now,
            timelineJson: appendTimeline(req, {
              status: 'approved',
              at: now.toISOString(),
              note: input.note ?? onlineRefundNote ?? '商城售后：已批准，退款由线下原路办理',
            }),
            updatedAt: now,
          })
          .where(eq(schema.refundRequests.id, req.id))
          .returning()
          .then((r) => r[0]!);
        const outboxIds = [
          await emitEvent(ctx.db, `store:${storeId}`, EventType.RefundRequestApproved, {
            requestId: req.id,
            requestNo: req.requestNo,
            billNo: req.billNo,
            amountFen: req.amountFen,
            orderKind: req.orderKind,
            refundNo: null,
            by: ctx.user.id,
          }),
          await emitEvent(ctx.db, `user:${req.customerId}`, EventType.RefundRequestApproved, {
            requestId: req.id,
            requestNo: req.requestNo,
            status: 'approved',
            refundNo: null,
          }),
        ];
        outboxIds.forEach(broadcastNow);
        return { request: updated, refundId: null, refundNo: null, idempotent: false as const, draft: false as const };
      }

      /* ---- 到店单：复用 R12 execute 内核（六联动同事务；reason=申请原因+申请单号） ---- */
      const execInput = {
        billNo: req.billNo,
        ...(req.itemsJson.length > 0
          ? { type: 'partial_items' as const, itemIds: req.itemsJson.map((it) => it.itemId) }
          : { type: 'full' as const }),
        reason: `客户申请退款：${req.reasonLabel}（申请单 ${req.requestNo}）`.slice(0, 200),
      };
      const result = await executeRefundCore(ctx, execInput);

      /* 留口开关 on 且超阈值 → 内核落 draft 申请行：申请单保持 submitted 待店主重新批准
         （refund draft 行由店主重新走 execute；本申请单不推进，幂等重入安全） */
      if (result.draft) {
        return { request: req, refundId: result.refund.id, refundNo: result.refund.refundNo, idempotent: false as const, draft: true as const };
      }

      /* 直通 executed → refunded（退款中）；settleActual 实退登记后联动 settled */
      const newStatus = result.refund.status === 'executed' ? 'refunded' : 'approved';
      const timeline = appendTimeline(req, {
        status: 'approved',
        at: now.toISOString(),
        note: input.note ?? `批准人 ${ctx.user.nickname ?? ctx.user.id}`,
      });
      if (newStatus === 'refunded') {
        timeline.push({ status: 'refunded', at: now.toISOString(), note: `退款单 ${result.refund.refundNo} 已执行` });
      }
      const updated = await ctx.db
        .update(schema.refundRequests)
        .set({
          status: newStatus,
          approverId: ctx.user.id,
          approvedAt: now,
          refundBillNo: result.refund.refundNo,
          timelineJson: timeline,
          updatedAt: now,
        })
        .where(eq(schema.refundRequests.id, req.id))
        .returning()
        .then((r) => r[0]!);
      const outboxIds = [
        await emitEvent(ctx.db, `store:${storeId}`, EventType.RefundRequestApproved, {
          requestId: req.id,
          requestNo: req.requestNo,
          billNo: req.billNo,
          amountFen: req.amountFen,
          orderKind: req.orderKind,
          refundNo: result.refund.refundNo,
          by: ctx.user.id,
        }),
        await emitEvent(ctx.db, `user:${req.customerId}`, EventType.RefundRequestApproved, {
          requestId: req.id,
          requestNo: req.requestNo,
          status: newStatus,
          refundNo: result.refund.refundNo,
        }),
      ];
      outboxIds.forEach(broadcastNow);
      return { request: updated, refundId: result.refund.id, refundNo: result.refund.refundNo, idempotent: false as const, draft: false as const };
    }),

  /**
   * reject（owner|manager 本店）：驳回申请——reason 必填（客户端 getById 可见）。
   * submitted→rejected + timeline。幂等：已 rejected → idempotent=true。
   */
  reject: merchantManagerProcedure
    .input(z.object({ requestId: z.string().min(1), reason: z.string().trim().min(1, '驳回必须填写理由').max(200) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const req = await ctx.db
        .select()
        .from(schema.refundRequests)
        .where(eq(schema.refundRequests.id, input.requestId))
        .get();
      if (!req || req.storeId !== storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申请单不存在' });
      }
      if (req.status === 'rejected') return { request: req, idempotent: true as const };
      if (req.status !== 'submitted') {
        badRequest(`当前状态（${req.status}）不可驳回，仅待审批的申请可驳回`);
      }
      const now = new Date();
      const updated = await ctx.db
        .update(schema.refundRequests)
        .set({
          status: 'rejected',
          rejectReason: input.reason,
          approverId: ctx.user.id,
          approvedAt: now,
          timelineJson: appendTimeline(req, { status: 'rejected', at: now.toISOString(), note: input.reason }),
          updatedAt: now,
        })
        .where(eq(schema.refundRequests.id, req.id))
        .returning()
        .then((r) => r[0]!);
      return { request: updated, idempotent: false as const };
    }),

  /**
   * listPending（owner|manager 本店）：商家端退款申请待办——本店 submitted 申请
   * 按提交时间升序（先到先审），附客户昵称 + SLA 超期标记（createdAt+slaHours<now，端口值）。
   */
  listPending: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const cfg = await loadConfig(ctx.db, storeId); // 大批片 2 分层：SLA 按本店作用域解析
    const slaMs = cfg.slaHours * 3600 * 1000;
    const nowMs = Date.now();
    const rows = await ctx.db
      .select({ request: schema.refundRequests, customerNickname: schema.users.nickname })
      .from(schema.refundRequests)
      .leftJoin(schema.users, eq(schema.users.id, schema.refundRequests.customerId))
      .where(and(eq(schema.refundRequests.storeId, storeId), eq(schema.refundRequests.status, 'submitted')))
      .orderBy(schema.refundRequests.createdAt, schema.refundRequests.id)
      .limit(200);
    return rows.map((r) => ({
      ...r.request,
      customerNickname: r.customerNickname ?? null,
      /** SLA 超期标记（refund_sla_hours 端口值；超期=true 商家端置顶提醒用） */
      slaOverdue: r.request.createdAt.getTime() + slaMs < nowMs,
    }));
  }),
});

export type RefundRequestRouter = typeof refundRequestRouter;
