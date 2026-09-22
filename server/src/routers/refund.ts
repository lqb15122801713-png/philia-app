/**
 * refund router（批次 R12 退款专项 Phase 2 · 退款六联动内核 · 冻结版 V1.0 唯一施工依据）
 *
 * 纲：退款 ≠ 反结账。反结账既有逻辑一行不动；退款=经营行为计退款单列，
 * 原单已收不涂改（cashier_bills 仅挂 refund_status/refund_bill_no 标记），
 * 当日净额=已收−退款（V2 现金段净额 / V7 跨日计入发生日 biz_date，不回填封箱历史）。
 *
 * 六联动（红线 1：同事务，任一失败整体回滚，禁止第三态）：
 *   ① 退款单落库（refund_bills status='executed' + refund_bill_items 明细 +
 *      linkage_json 快照，含 rebate_clawback_fen:0 列位——回馈金未上线 R11，冻结回归）；
 *   ② 支付段回补：全额=逐段全回；按行/按金额/寄养晚=按支付段占比同比例分摊（V3，
 *      computeSegmentSplit 精确到分、余数落最大段）。现金/微信/支付宝段→仅落 segment
 *      回补行+实退标记待登记（内测期线下原路）；储值段→stored_value_accounts 余额回补
 *      （先赠送后本金，镜像扣减逆序；stored_value_logs 正向行前后余额留痕，
 *      note='退款回补 RB-xxx'）；次卡段→member_pass 次数回补+pass_deduct_log 正向行；
 *   ③ 库存回补：商品行→stock_movements source_type='refund' source_id=refund_no，
 *      delta 正前后值真实+products.stock 回补。**按金额退不回库存只退钱**（口径写死：
 *      按金额退无行归属，强回补会乱账，见 computePlan partial_amount 分支注释）；
 *   ④ 预约行：仅未核销未服务（status 不在 in_service/in_boarding/completed）→
 *      paid_at/paid_fen 清零回待收款；已核销/已服务→execute 直接拒
 *      「已服务预约禁止退款，请转店主特批」（本批不建特批流，明文引导）；
 *   ⑤ 财务口径：refund.dayStats 读侧按 biz_date 聚合退款单列+支付段分列（V2/V7）；
 *   ⑥ 回馈金扣回列位 rebate_clawback_fen=0 落快照（接口冻结，R11 回归）。
 *
 * 权限闸（矩阵 V1.2 修订页写死）：
 * - 店员：无入口——本路由写端点全部 merchantManagerProcedure 起，clerk 天然 403；
 * - 店长：原单累计退款额+本次 ≤ refund_threshold_fen（refund_rules active 行，
 *   默认 ¥500=50000）且不涉储值 → 发起即执行（自批 approver=本人）；超阈值 FORBIDDEN
 *   「该单累计退款已达店长上限，须店主」（V1 累计校验堵拆分绕过）；涉储值（原单含
 *   stored_value/pass 支付段，或 type='pass_cancel'）→ FORBIDDEN「储值退款须店主」；
 * - 店主：全域；驳回权仅店主（rejectDraft）；导出仅店主留痕（总规则③）。
 *
 * 状态机与幂等（§三/红线 8）：draft→executed（账已联动，不可撤销，纠错=再开正单）
 * →settled（实退完成）；rejected=驳回留痕。同原单同参重复提交→返回最新一笔现状
 * 不重复落账；部分退款累计 ≤ 原单可退余额。
 *
 * 报备偏差（PR 中显式列）：
 * 1. 次卡退卡（pass_cancel）的金额台账缺口：次卡售卖走 pass.topUp 链路，系统内无
 *    实付金额/付费次数/赠次的资金台账（member_pass 仅 totalTimes/remainTimes）。
 *    V8 折算所需 paidFen/paidTimes/giftTimes 由店主录入随快照留痕（linkage_json
 *    .passCancel 全字段）；剩余付费次数按「付费次数先消耗」推导（consumedPaid=
 *    min(已扣次数, paidTimes)）。又因 refund_bills.bill_id NOT NULL（迁移 0014），
 *    pass_cancel 须挂一张该客户在本店的 settled 单作**锚点单**（anchor_only=true：
 *    金额与锚点单无关、锚点单不挂 refund_status 标记、不动其可退余额），报备。
 * 2. 次卡作废：member_pass 状态枚举仅 active|disabled（无 voided）——退卡后
 *    status='disabled' + remain_times=0 + pass_deduct_log 负向行（delta=−清零前剩余，
 *    note='次卡退卡作废 RB-xxx'）留痕，注释报备。
 * 3. 储值回补顺序：扣减=先本金后赠送，回补=先赠送后本金（镜像逆序），分列边界按
 *    原消费日志（bill_no 负向行）与累计已回补推算，前后余额留痕不变。
 * 4. 按金额退分摊命中次卡段：次数不可拆——次数回补=round(段回补额×原扣次数÷段金额)，
 *    不足 1 次等值的残余分在 detail_json.residualFen 明示（额度挂段明细，线下结清），
 *    不静默吞分。
 * 5. 退款单查询/日结统计端点按矩阵 V1.2 收至 merchantManagerProcedure（店员 403）——
 *    任务书§四「退款单查询 店员❌」；merchantProcedure 会放行 clerk，与矩阵冲突，从严。
 * 6. 导出留痕事件：EventType 常量表（realtime/events.ts）不在本批文件清单，
 *    审计事件用字面量 EventType.RefundMonthExported（payload {by, month, rows}），
 *    与 attendance.ts 报备偏差 4 同型；常量双端同步由后续批补齐。
 * 7. 寄养剩余晚（boarding_nights）只退钱不动预约单（提前接回的退住/核销由寄养域
 *    既有流程承担）；已发生晚一分不退：occurred=入住日~执行日（门店规范时区 +8 日界），
 *    晚单价=floor(原单寄养行有效价÷总晚)，残余分归已发生晚（注释写死）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  merchantManagerProcedure,
  merchantOwnerProcedure,
  router,
} from '../trpc';
import { storeDayStartMs, storeWallclock } from './appointment';
import { withCashierWriteLock } from './cashier';

/* ------------------------------------------------------------------ */
/* 常量与类型                                                            */
/* ------------------------------------------------------------------ */

/** 退款类型枚举（冻结版 §二六场景：未支付单走既有撤单，不在本批） */
const REFUND_TYPES = ['full', 'partial_items', 'partial_amount', 'boarding_nights', 'pass_cancel'] as const;
type RefundType = (typeof REFUND_TYPES)[number];

/** 退款单号格式：RB-{YYYYMMDD}-{当日 3 位序号}（日序发生器照 cashier genBillNo 模式，server 生成无需入参校验） */
const BILL_NO_RE = /^HD-\d{8}-\d{3}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 已落账（参与累计/冲减/幂等）的退款状态 */
const POSTED_STATUSES = ['executed', 'settled'] as const;

/** 预约行禁止退款的状态（已核销/已服务）；其余（pending/confirmed/cancel_requested/cancelled）可清零回待收款 */
const APPT_BLOCKING_STATUSES = ['in_service', 'in_boarding', 'completed'] as const;

/** 实退登记超时阈值（24h，冻结版 §三：超 24h 未登记进店长待办提醒） */
const SETTLE_TODO_MS = 24 * 3600 * 1000;

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言，同 cashier.ts 惯例） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

type BillRow = typeof schema.cashierBills.$inferSelect;
type BillItemRow = typeof schema.cashierBillItems.$inferSelect;
type PaymentRow = typeof schema.cashierPayments.$inferSelect;

// 注意：必须用 function 声明（而非箭头函数常量），TS 才会把「返回 never 的调用」
// 当作控制流终止点（同 cashier.ts 惯例）。
function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 门店规范时区（+8）本地日期 'YYYY-MM-DD'（biz_date 口径，与 cashier 单号/日界同帧） */
function storeLocalDateStr(d: Date): string {
  const w = storeWallclock(d);
  return `${w.y}-${pad2(w.m)}-${pad2(w.day)}`;
}

/* ------------------------------------------------------------------ */
/* A) 内部纯函数（导出供 e2e 直测）                                        */
/* ------------------------------------------------------------------ */

export interface SegmentSplitInput {
  id: string;
  method: string;
  amountFen: number;
}
export interface SegmentSplitRow {
  paymentId: string;
  method: string;
  amountFen: number;
  /** 分摊占比 bp（原段金额占原单支付合计比例，页面明示用） */
  ratioBp: number;
}

/**
 * 按金额退的支付段分摊（V3）：按支付段占比同比例分摊，精确到分、余数落最大段。
 * 每段 base = floor(refundFen × 段金额 ÷ 支付合计)；余数（<段数 分）全部落金额最大段
 * （并列取先入先出第一段）。合计恒 = refundFen。refundFen≤0 或支付合计≤0 → 全零。
 */
export function computeSegmentSplit(
  payments: SegmentSplitInput[],
  refundFen: number,
): SegmentSplitRow[] {
  const total = payments.reduce((s, p) => s + p.amountFen, 0);
  if (total <= 0 || refundFen <= 0 || payments.length === 0) {
    return payments.map((p) => ({ paymentId: p.id, method: p.method, amountFen: 0, ratioBp: 0 }));
  }
  let maxIdx = 0;
  payments.forEach((p, i) => {
    if (p.amountFen > payments[maxIdx]!.amountFen) maxIdx = i;
  });
  let assigned = 0;
  const rows = payments.map((p) => {
    const base = Math.floor((refundFen * p.amountFen) / total);
    assigned += base;
    return {
      paymentId: p.id,
      method: p.method,
      amountFen: base,
      ratioBp: Math.round((p.amountFen * 10000) / total),
    };
  });
  rows[maxIdx]!.amountFen += refundFen - assigned; // 余数落最大段
  return rows;
}

/**
 * 次卡退卡折算（V8 付费次数口径）：折算额 = 剩余付费次数 ×（实付 ÷ 付费总次数），
 * 赠次不计价（随退作废、明示）。精确到分（四舍五入到分）。
 * @returns refundFen 折算退款额；giftVoided 随退作废的剩余赠次（=剩余次数−剩余付费次数，
 *          封顶 giftTimes；「付费次数先消耗」推导口径，见文件头报备偏差 1）
 */
export function computePassCancel(
  pass: { totalTimes: number; remainTimes: number },
  paidFen: number,
  paidTimes: number,
  giftTimes: number,
  remainingPaidTimes: number,
): { refundFen: number; giftVoided: number } {
  if (paidTimes < 1) badRequest('付费总次数须 ≥1');
  if (paidFen < 0) badRequest('实付金额不能为负');
  if (remainingPaidTimes < 0 || remainingPaidTimes > paidTimes) {
    badRequest('剩余付费次数须在 0 ~ 付费总次数之间');
  }
  const refundFen = Math.round((remainingPaidTimes * paidFen) / paidTimes);
  const giftVoided = Math.max(0, Math.min(giftTimes, pass.remainTimes - remainingPaidTimes));
  return { refundFen, giftVoided };
}

/**
 * 涉储值判定（运营加固：涉储值一律店主，不设阈值）：原单含 stored_value 或 pass
 * 支付段、或 type='pass_cancel' → true。bill 参为原单上下文（当前判定只看支付段与
 * 类型；签名保留供 R11 回馈金联动扩展，防二次改签名）。
 */
export function hasStoredValueInvolvement(
  bill: Pick<BillRow, 'id' | 'billNo'> | null,
  payments: Array<Pick<PaymentRow, 'method'>>,
  type: RefundType,
): boolean {
  void bill; // 见头注：判定口径只看支付段+类型，bill 留位
  if (type === 'pass_cancel') return true;
  return payments.some((p) => p.method === 'stored_value' || p.method === 'pass');
}

/* ------------------------------------------------------------------ */
/* 退款单号发生器（日序，照 cashier.genBillNo 模式；串行锁保护下分配）         */
/* ------------------------------------------------------------------ */

async function genRefundNo(d: DbHandle, storeId: string, now: Date): Promise<string> {
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

/* ------------------------------------------------------------------ */
/* 规则读取（refund_rules active 行；配置端口第四域 domain='refund'）          */
/* ------------------------------------------------------------------ */

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** 店长累计阈值（分）：refund_rules active 行 refund_threshold_fen.threshold_fen，缺行兜底 50000（种子口径） */
async function loadRefundThresholdFen(d: DbHandle): Promise<number> {
  const row = await d
    .select({ valueJson: schema.refundRules.valueJson })
    .from(schema.refundRules)
    .where(and(eq(schema.refundRules.ruleKey, 'refund_threshold_fen'), eq(schema.refundRules.active, true)))
    .get();
  return num(row?.valueJson?.threshold_fen, 50000);
}

/* ------------------------------------------------------------------ */
/* 六联动计划（preview 干跑 / execute 实跑共用同一计算内核，口径同源）          */
/* ------------------------------------------------------------------ */

/** 计划行：退款涉及的原始单行（全额/按行/按金额分摊），供提成冲减读侧（V6） */
interface PlanItemRow {
  billItemId: string;
  kind: string; // 原单行 kind：service | product | appointment
  name: string;
  /** 数量（按金额退的分摊行无数量语义 → null） */
  qty: number | null;
  /** 本行回补额（分；按金额退=按行有效价占比分摊的分摊额，detail.apportioned=true） */
  amountFen: number;
  paidByPass: boolean;
  apportioned: boolean;
}

interface PlanSegmentRow extends SegmentSplitRow {
  /** 回补通道：offline_pending 线下原路（实退标记待登记）| stored_value_restore 余额回补 | pass_times_restore 次数回补 */
  channel: 'offline_pending' | 'stored_value_restore' | 'pass_times_restore';
}

interface RefundPlan {
  bill: BillRow;
  items: BillItemRow[];
  payments: PaymentRow[];
  type: RefundType;
  /** 原单已退累计（分，executed|settled 口径） */
  refundedSoFarFen: number;
  /** 原单可退余额（分）= paidFen − refundedSoFarFen */
  refundableFen: number;
  /** 本次退款总额（分） */
  refundFen: number;
  segments: PlanSegmentRow[];
  itemRows: PlanItemRow[];
  /** 库存回补（商品行；按金额退恒空——口径写死） */
  stockRestock: Array<{ productId: string; name: string; qty: number }>;
  /** 预约行清零回待收款（已过已服务闸门） */
  appointmentReverts: Array<{ appointmentId: string; name: string }>;
  /** 寄养剩余晚快照（boarding_nights） */
  boarding: {
    appointmentId: string;
    billItemId: string;
    totalNights: number;
    occurredNights: number;
    remainingNights: number;
    nights: number;
    perNightFen: number;
  } | null;
  /** 次卡退卡快照（pass_cancel；anchor_only 锚点单口径见头注报备偏差 1） */
  passCancel: {
    passId: string;
    userId: string;
    paidFen: number;
    paidTimes: number;
    giftTimes: number;
    remainingPaidTimes: number;
    giftVoided: number;
    remainTimesBefore: number;
  } | null;
  /** 储值段回补合计（分；execute 时按账户实落前后值） */
  storedValueRestoreFen: number;
  /** 次卡段次数回补合计（次） */
  passTimesRestore: number;
  /** 提成冲减预估（分；实际以提成读侧 computeMonth V6 为准） */
  estimatedCommissionClawbackFen: number;
  /** 回馈金扣回列位（冻结恒 0，R11 回归） */
  rebateClawbackFen: 0;
  /** pass_cancel 锚点单标记：true=金额与锚点单无关、原单不挂标记 */
  anchorOnly: boolean;
  thresholdFen: number;
}

/** 退款输入（preview/execute 共用字段；execute 加 reason 必填 + refundMethod） */
const refundInputSchema = z.object({
  billNo: z.string().regex(BILL_NO_RE, '原单号格式应为 HD-YYYYMMDD-序号'),
  type: z.enum(REFUND_TYPES),
  /** 按行退的行 ID 列表（partial_items 必填） */
  itemIds: z.array(z.string().min(1)).min(1).max(50).optional(),
  /** 按金额退的退款额（分，partial_amount 必填） */
  amountFen: z.number().int().min(1, '退款金额须 ≥1 分').max(100_000_000).optional(),
  /** 寄养退晚数（boarding_nights 必填） */
  nights: z.number().int().min(1).max(365).optional(),
  reason: z.string().trim().max(200).optional(),
  /* ---- pass_cancel 专属（次卡无金额台账，店主录入留痕——头注报备偏差 1） ---- */
  passId: z.string().min(1).optional(),
  passPaidFen: z.number().int().min(0).max(100_000_000).optional(),
  passPaidTimes: z.number().int().min(1).max(9999).optional(),
  passGiftTimes: z.number().int().min(0).max(9999).optional(),
});
type RefundInput = z.infer<typeof refundInputSchema>;

const effPriceOf = (it: Pick<BillItemRow, 'unitPriceFen' | 'adjustedPriceFen'>): number =>
  it.adjustedPriceFen ?? it.unitPriceFen;

/** 通用按比例分摊（行分摊复用段分摊算法：余数落最大额行） */
function splitProportional(parts: Array<{ id: string; amountFen: number }>, totalFen: number): Map<string, number> {
  const rows = computeSegmentSplit(
    parts.map((p) => ({ id: p.id, method: '-', amountFen: p.amountFen })),
    totalFen,
  );
  return new Map(rows.map((r) => [r.paymentId, r.amountFen]));
}

/**
 * 六联动计划内核（preview 与 execute 共用，零写入）：
 * 终态/权限/余额/行归属/晚数全部校验在此跑（同 execute 口径），任一不过抛错。
 * @param callerIsOwner 店主全通；店长走阈值+涉储值闸（V1 累计校验）
 */
async function computePlan(
  d: DbHandle,
  storeId: string,
  input: RefundInput,
  callerIsOwner: boolean,
  now: Date,
): Promise<RefundPlan> {
  /* ---- 原单与终态闸（V5） ---- */
  const bill = await d
    .select()
    .from(schema.cashierBills)
    .where(eq(schema.cashierBills.billNo, input.billNo))
    .get();
  if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: '原单不存在' });
  if (bill.storeId !== storeId) forbidden('非本店单据，无权操作');
  if (bill.status === 'voided' || bill.reversedAt || bill.status === 'reversal') {
    // 冲正与撤单已是终态，再退即双冲（V5 明文冻结）
    badRequest('原单已冲正/已撤，不可退款');
  }
  if (bill.status !== 'settled') badRequest('原单未结账，无已收款可退');
  // pass_cancel 挂的是锚点单（金额与原单无关，报备偏差 1），其自身退款状态不影响退卡
  if (input.type !== 'pass_cancel' && bill.refundStatus === 'refunded') {
    badRequest('原单已全额退款，不可再退');
  }

  const items = await d
    .select()
    .from(schema.cashierBillItems)
    .where(eq(schema.cashierBillItems.billId, bill.id));
  const payments = await d
    .select()
    .from(schema.cashierPayments)
    .where(eq(schema.cashierPayments.billId, bill.id));

  /* ---- 已退累计（V1 按原单累计校验；可退余额幂等基线） ---- */
  const postedRefunds = await d
    .select()
    .from(schema.refundBills)
    .where(and(eq(schema.refundBills.billId, bill.id), inArray(schema.refundBills.status, [...POSTED_STATUSES])));
  const refundedSoFarFen = postedRefunds
    .filter((r) => r.linkageJson == null || (r.linkageJson as Record<string, unknown>).anchorOnly !== true)
    .reduce((s, r) => s + r.amountFen, 0); // pass_cancel 锚点单不占原单可退余额（报备偏差 1）
  const refundableFen = bill.paidFen - refundedSoFarFen;

  /* ---- 既有退款明细（按行已退/按段已退，供全额退的逐段逐行余额口径） ---- */
  const postedIds = postedRefunds.map((r) => r.id);
  const prevItems = postedIds.length
    ? await d
        .select()
        .from(schema.refundBillItems)
        .where(inArray(schema.refundBillItems.refundId, postedIds))
    : [];
  const segRefunded = new Map<string, number>();
  const lineRefundedFen = new Map<string, number>();
  const lineRefundedQty = new Map<string, number>();
  for (const pi of prevItems) {
    if (pi.kind === 'segment' && pi.paymentId) {
      segRefunded.set(pi.paymentId, (segRefunded.get(pi.paymentId) ?? 0) + pi.amountFen);
    }
    if (pi.kind === 'item' && pi.billItemId) {
      lineRefundedFen.set(pi.billItemId, (lineRefundedFen.get(pi.billItemId) ?? 0) + pi.amountFen);
      lineRefundedQty.set(pi.billItemId, (lineRefundedQty.get(pi.billItemId) ?? 0) + (pi.qty ?? 0));
    }
  }

  /* ---- 类型分支解析 ---- */
  let refundFen = 0;
  let segments: PlanSegmentRow[] = [];
  let itemRows: PlanItemRow[] = [];
  let stockRestock: RefundPlan['stockRestock'] = [];
  let appointmentReverts: RefundPlan['appointmentReverts'] = [];
  let boarding: RefundPlan['boarding'] = null;
  let passCancel: RefundPlan['passCancel'] = null;
  let passTimesRestore = 0;
  let anchorOnly = false;

  const segChannel = (method: string): PlanSegmentRow['channel'] =>
    method === 'stored_value'
      ? 'stored_value_restore'
      : method === 'pass'
        ? 'pass_times_restore'
        : 'offline_pending';

  const appointmentItems = items.filter((it) => it.kind === 'appointment');
  const apptRows = appointmentItems.length
    ? await d
        .select()
        .from(schema.appointments)
        .where(inArray(schema.appointments.id, appointmentItems.map((it) => it.refId)))
    : [];
  const apptById = new Map(apptRows.map((a) => [a.id, a]));

  /** 预约行已服务闸门（⑤）：in_service/in_boarding/completed → 明文拒 */
  const assertAppointmentsRefundable = (lines: BillItemRow[]) => {
    for (const it of lines) {
      if (it.kind !== 'appointment') continue;
      const appt = apptById.get(it.refId);
      if (!appt) badRequest('预约行源单不存在');
      if ((APPT_BLOCKING_STATUSES as readonly string[]).includes(appt.status)) {
        badRequest('已服务预约禁止退款，请转店主特批');
      }
    }
  };

  if (input.type === 'full') {
    /* 全额：可退余额全退；逐段全回（扣既有段已退）；逐行余额落 item 明细（V6 读侧） */
    if (refundableFen <= 0) badRequest('原单可退余额为 0，不可再退');
    refundFen = refundableFen;
    segments = payments
      .map((p) => ({
        paymentId: p.id,
        method: p.method,
        amountFen: p.amountFen - (segRefunded.get(p.id) ?? 0),
        ratioBp: 0,
        channel: segChannel(p.method),
      }))
      .filter((s) => s.amountFen > 0);
    const payTotal = payments.reduce((s, p) => s + p.amountFen, 0);
    for (const s of segments) {
      const orig = payments.find((p) => p.id === s.paymentId)!;
      s.ratioBp = payTotal > 0 ? Math.round((orig.amountFen * 10000) / payTotal) : 0;
    }
    itemRows = items
      .map((it) => ({
        billItemId: it.id,
        kind: it.kind,
        name: it.nameSnapshot,
        qty: it.qty - (lineRefundedQty.get(it.id) ?? 0),
        amountFen: effPriceOf(it) * it.qty - (lineRefundedFen.get(it.id) ?? 0),
        paidByPass: it.paidByPass,
        apportioned: false,
      }))
      .filter((r) => r.amountFen > 0 || r.qty > 0);
    assertAppointmentsRefundable(items);
    appointmentReverts = appointmentItems.map((it) => ({ appointmentId: it.refId, name: it.nameSnapshot }));
    stockRestock = items
      .filter((it) => it.kind === 'product')
      .map((it) => ({ productId: it.refId, name: it.nameSnapshot, qty: it.qty - (lineRefundedQty.get(it.id) ?? 0) }))
      .filter((r) => r.qty > 0);
    passTimesRestore = items.filter((it) => it.paidByPass && (lineRefundedFen.get(it.id) ?? 0) === 0).length;
  } else if (input.type === 'partial_items') {
    /* 按行：指定行全联动（该行金额按支付段占比分摊 V3）；已退行拒重退 */
    if (!input.itemIds || input.itemIds.length === 0) badRequest('按行退款须指定行');
    const idSet = new Set(input.itemIds);
    const lines = items.filter((it) => idSet.has(it.id));
    if (lines.length !== idSet.size) badRequest('退款行不属于原单，请刷新后重试');
    for (const it of lines) {
      if ((lineRefundedFen.get(it.id) ?? 0) > 0) badRequest(`「${it.nameSnapshot}」已退款，不可重复退`);
    }
    refundFen = lines.reduce((s, it) => s + effPriceOf(it) * it.qty, 0);
    if (refundFen <= 0) badRequest('退款行金额合计为 0');
    if (refundFen > refundableFen) badRequest('超过原单可退余额');
    segments = computeSegmentSplit(payments, refundFen)
      .filter((s) => s.amountFen > 0)
      .map((s) => ({ ...s, channel: segChannel(s.method) }));
    itemRows = lines.map((it) => ({
      billItemId: it.id,
      kind: it.kind,
      name: it.nameSnapshot,
      qty: it.qty,
      amountFen: effPriceOf(it) * it.qty,
      paidByPass: it.paidByPass,
      apportioned: false,
    }));
    assertAppointmentsRefundable(lines);
    appointmentReverts = lines
      .filter((it) => it.kind === 'appointment')
      .map((it) => ({ appointmentId: it.refId, name: it.nameSnapshot }));
    stockRestock = lines
      .filter((it) => it.kind === 'product')
      .map((it) => ({ productId: it.refId, name: it.nameSnapshot, qty: it.qty }));
    passTimesRestore = lines.filter((it) => it.paidByPass).length;
  } else if (input.type === 'partial_amount') {
    /* 按金额：只退钱不回库存（口径写死：无行归属，强回补会乱账）；
       行维度按有效价占比分摊落 item 明细（apportioned=true，仅供 V6 提成读侧按比例冲减） */
    if (!input.amountFen) badRequest('按金额退款须填退款金额');
    refundFen = input.amountFen;
    if (refundFen > refundableFen) badRequest('超过原单可退余额');
    segments = computeSegmentSplit(payments, refundFen)
      .filter((s) => s.amountFen > 0)
      .map((s) => ({ ...s, channel: segChannel(s.method) }));
    const effParts = items.map((it) => ({ id: it.id, amountFen: effPriceOf(it) * it.qty }));
    const alloc = splitProportional(effParts, refundFen);
    itemRows = items
      .map((it) => ({
        billItemId: it.id,
        kind: it.kind,
        name: it.nameSnapshot,
        qty: null, // 分摊行无数量语义（qty 列置空）
        amountFen: alloc.get(it.id) ?? 0,
        paidByPass: it.paidByPass,
        apportioned: true,
      }))
      .filter((r) => r.amountFen > 0);
    stockRestock = []; // 写死：按金额退不回库存只退钱
    /* 按金额退命中次卡段的次数折算在 execute 落实（round 口径，残余分明示，头注报备偏差 4） */
  } else if (input.type === 'boarding_nights') {
    /* 寄养剩余晚（V4）：只退钱不动预约单；已发生晚一分不退 */
    if (!input.nights) badRequest('寄养退款须填退晚数');
    const boardingLine = appointmentItems.find((it) => apptById.get(it.refId)?.type === 'boarding');
    if (!boardingLine) badRequest('原单无寄养行，不可用寄养剩余晚退');
    const appt = apptById.get(boardingLine.refId)!;
    const totalNights = Math.max(
      1,
      Math.ceil((appt.scheduledEnd.getTime() - appt.scheduledStart.getTime()) / (24 * 3600 * 1000)),
    );
    // 已发生晚=入住日~执行日（+8 日界）；已退住（checkoutAt）则截至退住日
    const stay = await d
      .select()
      .from(schema.boardingStays)
      .where(eq(schema.boardingStays.appointmentId, appt.id))
      .get();
    const startW = storeWallclock(appt.scheduledStart);
    const startDayMs = storeDayStartMs(startW.y, startW.m, startW.day);
    const endRef = stay?.checkoutAt && stay.checkoutAt.getTime() < now.getTime() ? stay.checkoutAt : now;
    const endW = storeWallclock(endRef);
    const endDayMs = storeDayStartMs(endW.y, endW.m, endW.day);
    const occurredNights = Math.max(
      0,
      Math.min(totalNights, Math.round((endDayMs - startDayMs) / (24 * 3600 * 1000))),
    );
    const remainingNights = totalNights - occurredNights;
    if (input.nights > remainingNights) {
      badRequest(`剩余可退晚数不足：已住 ${occurredNights} 晚不退，剩余 ${remainingNights} 晚可退`);
    }
    // 晚单价=floor(行有效价÷总晚)，残余分归已发生晚（口径写死）
    const perNightFen = Math.floor((effPriceOf(boardingLine) * boardingLine.qty) / totalNights);
    refundFen = perNightFen * input.nights;
    if (refundFen <= 0) badRequest('寄养退款金额为 0');
    if (refundFen > refundableFen) badRequest('超过原单可退余额');
    segments = computeSegmentSplit(payments, refundFen)
      .filter((s) => s.amountFen > 0)
      .map((s) => ({ ...s, channel: segChannel(s.method) }));
    boarding = {
      appointmentId: appt.id,
      billItemId: boardingLine.id,
      totalNights,
      occurredNights,
      remainingNights,
      nights: input.nights,
      perNightFen,
    };
  } else {
    /* pass_cancel 次卡退卡（V8；涉储值→店主唯一通道；锚点单口径见头注报备偏差 1） */
    anchorOnly = true;
    if (!input.passId) badRequest('退卡须指定次卡');
    if (input.passPaidFen == null || input.passPaidTimes == null || input.passGiftTimes == null) {
      badRequest('退卡须录入实付金额/付费总次数/赠次（次卡无金额台账，留痕口径）');
    }
    const pass = await d
      .select()
      .from(schema.memberPasses)
      .where(eq(schema.memberPasses.id, input.passId))
      .get();
    if (!pass || pass.storeId !== storeId) badRequest('次卡不存在或不属于本店');
    if (pass.status !== 'active') badRequest('次卡已停用/作废，不可重复退卡');
    if (bill.customerId !== pass.userId) badRequest('锚点单须为该持卡客户在本店的已结账单单');
    // 剩余付费次数推导：付费次数先消耗（consumedPaid=min(已扣次数, paidTimes)）
    const totalDeducted = Math.max(0, pass.totalTimes - pass.remainTimes);
    const consumedPaid = Math.min(totalDeducted, input.passPaidTimes);
    const remainingPaidTimes = Math.max(0, input.passPaidTimes - consumedPaid);
    const calc = computePassCancel(pass, input.passPaidFen, input.passPaidTimes, input.passGiftTimes, remainingPaidTimes);
    if (calc.refundFen <= 0 && calc.giftVoided <= 0) badRequest('该卡无可退付费次数与赠次');
    refundFen = calc.refundFen;
    passCancel = {
      passId: pass.id,
      userId: pass.userId,
      paidFen: input.passPaidFen,
      paidTimes: input.passPaidTimes,
      giftTimes: input.passGiftTimes,
      remainingPaidTimes,
      giftVoided: calc.giftVoided,
      remainTimesBefore: pass.remainTimes,
    };
    segments = []; // 退卡金额不走原单支付段（anchor_only）
  }

  const storedValueRestoreFen = segments
    .filter((s) => s.channel === 'stored_value_restore')
    .reduce((s, x) => s + x.amountFen, 0);

  /* ---- 提成冲减预估（preview 明示；实际以 computeMonth V6 读侧为准） ---- */
  let estimatedCommissionClawbackFen = 0;
  if (itemRows.length > 0) {
    const rules = await d
      .select({ ruleKey: schema.commissionRules.ruleKey, valueJson: schema.commissionRules.valueJson })
      .from(schema.commissionRules)
      .where(
        and(
          inArray(schema.commissionRules.ruleKey, ['commission_grooming_rate', 'commission_product_rate']),
          eq(schema.commissionRules.active, true),
        ),
      );
    const rateOf = (key: string) => num(rules.find((r) => r.ruleKey === key)?.valueJson?.rate_bp, 0);
    for (const r of itemRows) {
      const src = items.find((it) => it.id === r.billItemId)!;
      const lineEff = effPriceOf(src) * src.qty;
      const ratio = lineEff > 0 ? Math.min(1, r.amountFen / lineEff) : 0;
      const rateBp = r.kind === 'product' ? rateOf('commission_product_rate') : r.kind === 'appointment' ? rateOf('commission_grooming_rate') : 0;
      estimatedCommissionClawbackFen += Math.round((lineEff * rateBp * ratio) / 10000);
    }
  }

  /* ---- 权限闸（V1 累计校验 + 运营加固涉储值；preview 与 execute 同口径） ---- */
  const thresholdFen = await loadRefundThresholdFen(d);
  if (!callerIsOwner) {
    if (hasStoredValueInvolvement(bill, payments, input.type)) {
      forbidden('储值退款须店主');
    }
    if (refundedSoFarFen + refundFen > thresholdFen) {
      forbidden('该单累计退款已达店长上限，须店主');
    }
  }

  return {
    bill,
    items,
    payments,
    type: input.type,
    refundedSoFarFen,
    refundableFen,
    refundFen,
    segments,
    itemRows,
    stockRestock,
    appointmentReverts,
    boarding,
    passCancel,
    storedValueRestoreFen,
    passTimesRestore,
    estimatedCommissionClawbackFen,
    rebateClawbackFen: 0, // 第六联动列位冻结：回馈金未上线 R11，冻结规则+R11 回归
    anchorOnly,
    thresholdFen,
  };
}

/** 计划 → 响应/快照通用视图（preview 清单与 linkage_json 同构） */
function planView(plan: RefundPlan) {
  return {
    billNo: plan.bill.billNo,
    type: plan.type,
    refundFen: plan.refundFen,
    refundedSoFarFen: plan.refundedSoFarFen,
    refundableFen: plan.refundableFen,
    anchorOnly: plan.anchorOnly,
    segments: plan.segments,
    items: plan.itemRows,
    stockRestock: plan.stockRestock,
    appointmentReverts: plan.appointmentReverts,
    boarding: plan.boarding,
    passCancel: plan.passCancel,
    storedValueRestoreFen: plan.storedValueRestoreFen,
    passTimesRestore: plan.passTimesRestore,
    estimatedCommissionClawbackFen: plan.estimatedCommissionClawbackFen,
    commissionNote: '提成冲减为预估，实际以提成读侧 computeMonth（R9 只读计算）为准',
    rebateClawbackFen: 0,
    rebateNote: '回馈金扣回（随 R11 会员批生效）',
    thresholdFen: plan.thresholdFen,
  };
}

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

export const refundRouter = router({
  /**
   * preview（owner|manager）：六联动干跑预览——退什么钱按段分摊明细/补什么货/回什么
   * 余额或次数/提成冲减预估/rebate_clawback_fen:0 列位明示。零写入；
   * 终态/权限/余额校验与 execute 同一内核同口径（computePlan）。
   */
  preview: merchantManagerProcedure.input(refundInputSchema).mutation(async ({ ctx, input }) => {
    const callerIsOwner = ctx.user.roles.includes('merchant_owner');
    const plan = await computePlan(ctx.db, ctx.user.storeId!, input, callerIsOwner, new Date());
    return { plan: planView(plan) };
  }),

  /**
   * execute（owner|manager）★：退款确认=同事务六联动（红线 1，任一失败整体回滚）。
   * 店长自批单发起即执行（approver=本人）；超阈值/涉储值天然被 computePlan 闸到店主。
   * 幂等：同原单同参（type+金额+原因）重复提交 → 返回最新一笔现状不重复落账。
   * 内测期实退=线下原路+「实退完成」登记（settleActual），现金/微信/支付宝段落
   * segment 回补行后 settled_at 待登记（通道期换装 API 自动退，接口预留）。
   */
  execute: merchantManagerProcedure
    .input(
      refundInputSchema.extend({
        reason: z.string().trim().min(1, '退款必须填写原因').max(200),
        /** 实退方式（pass_cancel 必选）：offline_original 线下原路 | to_stored_value 退储值账户 */
        refundMethod: z.enum(['offline_original', 'to_stored_value']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const callerIsOwner = ctx.user.roles.includes('merchant_owner');
      if (input.type === 'pass_cancel' && !input.refundMethod) {
        badRequest('次卡退卡须选实退方式（退储值账户或线下原路）');
      }
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const d = txDb(tx);
          const now = new Date();

          /* ---- 幂等快路径（红线 8，先于终态/余额校验：重复提交时原单可能已挂
             refunded，同参重放必须返回现状而不是被终态闸误拦）：同原单 + 同类型 +
             同原因（按金额退再同额）+ 已落账（executed|settled）→ 返回最新一笔 ---- */
          const billForDup = await d
            .select({ id: schema.cashierBills.id })
            .from(schema.cashierBills)
            .where(eq(schema.cashierBills.billNo, input.billNo))
            .get();
          if (billForDup && billForDup.id && input.type !== 'pass_cancel') {
            const dupConds = [
              eq(schema.refundBills.billId, billForDup.id),
              eq(schema.refundBills.type, input.type),
              eq(schema.refundBills.reason, input.reason),
              inArray(schema.refundBills.status, [...POSTED_STATUSES]),
            ];
            if (input.type === 'partial_amount' && input.amountFen) {
              dupConds.push(eq(schema.refundBills.amountFen, input.amountFen));
            }
            const dup = await d
              .select()
              .from(schema.refundBills)
              .where(and(...dupConds))
              .orderBy(desc(schema.refundBills.createdAt), desc(schema.refundBills.id))
              .limit(1)
              .then((r) => r[0]);
            if (dup) return { refund: dup, plan: null, idempotent: true as const };
          }

          const plan = await computePlan(d, storeId, input, callerIsOwner, now);

          /* ---- ① 退款单落库（RB 日序单号；biz_date=执行日 V7；快照含 rebate 列位） ---- */
          const refundNo = await genRefundNo(d, storeId, now);
          const bizDate = storeLocalDateStr(now);
          const linkage = {
            ...planView(plan),
            executedAt: now.toISOString(),
            operatorId: ctx.user.id,
            approverId: ctx.user.id, // 店长自批单发起即执行 approver=本人；店主执行 approver=店主
            refundMethod: input.refundMethod ?? null,
            reason: input.reason,
          };
          const refund = await d
            .insert(schema.refundBills)
            .values({
              storeId,
              refundNo,
              bizDate,
              billId: plan.bill.id,
              type: plan.type,
              amountFen: plan.refundFen,
              reason: input.reason,
              status: 'executed',
              linkageJson: linkage,
              refundMethod: input.refundMethod ?? null,
              operatorId: ctx.user.id,
              approverId: ctx.user.id,
            })
            .returning()
            .then((r) => r[0]!);

          /* ---- 明细行落库（segment / item / night / pass） ---- */
          const itemRowsToInsert: Array<typeof schema.refundBillItems.$inferInsert> = [];
          for (const s of plan.segments) {
            itemRowsToInsert.push({
              refundId: refund.id,
              paymentId: s.paymentId,
              kind: 'segment',
              amountFen: s.amountFen,
              detailJson: { method: s.method, ratioBp: s.ratioBp, channel: s.channel },
            });
          }
          for (const r of plan.itemRows) {
            itemRowsToInsert.push({
              refundId: refund.id,
              billItemId: r.billItemId,
              kind: 'item',
              qty: r.qty, // 按金额退分摊行 qty=null（无数量语义）
              amountFen: r.amountFen,
              detailJson: r.apportioned ? { apportioned: true, note: '按金额退按行有效价占比分摊（V6 提成读侧）' } : null,
            });
          }
          if (plan.boarding) {
            itemRowsToInsert.push({
              refundId: refund.id,
              billItemId: plan.boarding.billItemId,
              kind: 'night',
              qty: plan.boarding.nights,
              amountFen: plan.refundFen,
              detailJson: {
                totalNights: plan.boarding.totalNights,
                occurredNights: plan.boarding.occurredNights,
                remainingNights: plan.boarding.remainingNights,
                perNightFen: plan.boarding.perNightFen,
                note: `已住 ${plan.boarding.occurredNights} 晚不退/退 ${plan.boarding.nights} 晚`,
              },
            });
          }
          if (plan.passCancel) {
            itemRowsToInsert.push({
              refundId: refund.id,
              kind: 'pass',
              amountFen: plan.refundFen,
              detailJson: { ...plan.passCancel, refundMethod: input.refundMethod },
            });
          }
          if (itemRowsToInsert.length > 0) {
            await d.insert(schema.refundBillItems).values(itemRowsToInsert);
          }

          /* ---- ② 支付段回补 ---- */
          for (const s of plan.segments) {
            if (s.channel === 'stored_value_restore') {
              // 储值段→余额回补（先赠送后本金，镜像扣减逆序；前后余额留痕）
              if (!plan.bill.customerId) badRequest('散客单无储值账户，储值段不可回补');
              const acc = await d
                .select()
                .from(schema.storedValueAccounts)
                .where(
                  and(
                    eq(schema.storedValueAccounts.userId, plan.bill.customerId),
                    eq(schema.storedValueAccounts.storeId, storeId),
                  ),
                )
                .get();
              if (!acc) badRequest('储值账户不存在，无法回补');
              // 原消费分列（bill_no 负向行）与累计已回补（正向行）推算剩余可回补分列
              const svLogs = await d
                .select()
                .from(schema.storedValueLogs)
                .where(eq(schema.storedValueLogs.billNo, plan.bill.billNo));
              const origDeductB = svLogs.filter((l) => l.deltaFen < 0).reduce((x, l) => x - l.deltaBonusFen, 0);
              const restoredSoFar = svLogs.filter((l) => l.deltaFen > 0).reduce((x, l) => x + l.deltaFen, 0);
              const bonusAlready = Math.min(restoredSoFar, origDeductB);
              const bonusPart = Math.min(s.amountFen, Math.max(0, origDeductB - bonusAlready));
              const principalPart = s.amountFen - bonusPart;
              const before = acc.principalFen + acc.bonusFen;
              await d
                .update(schema.storedValueAccounts)
                .set({
                  principalFen: acc.principalFen + principalPart,
                  bonusFen: acc.bonusFen + bonusPart,
                  updatedAt: now,
                })
                .where(eq(schema.storedValueAccounts.id, acc.id));
              await d.insert(schema.storedValueLogs).values({
                accountId: acc.id,
                userId: plan.bill.customerId,
                storeId,
                deltaPrincipalFen: principalPart,
                deltaBonusFen: bonusPart,
                deltaFen: s.amountFen,
                balanceBeforeFen: before,
                balanceAfterFen: before + s.amountFen,
                billNo: plan.bill.billNo,
                operatorId: ctx.user.id,
                note: `退款回补 ${refundNo}`,
              });
            } else if (s.channel === 'pass_times_restore') {
              // 次卡段→次数回补（pass_deduct_log 正向行 note 关联退款单号）
              const paySeg = plan.payments.find((p) => p.id === s.paymentId);
              if (!paySeg?.passId) continue;
              const passRow = await d
                .select()
                .from(schema.memberPasses)
                .where(eq(schema.memberPasses.id, paySeg.passId))
                .get();
              if (!passRow) continue;
              const origTimes = plan.items.filter((it) => it.paidByPass).length;
              let times = 0;
              let residualFen = 0;
              if (plan.type === 'full' || plan.type === 'partial_items') {
                // 行口径：回补次数=本次退的扣次行数（1 行=1 次，精确整数）
                times = plan.passTimesRestore;
              } else {
                // 金额口径（报备偏差 4）：round(段回补额×原扣次数÷段金额)，残余分明示
                const perTimeFen = origTimes > 0 ? paySeg.amountFen / origTimes : 0;
                times = perTimeFen > 0 ? Math.round(s.amountFen / perTimeFen) : 0;
                residualFen = s.amountFen - Math.round(times * perTimeFen);
              }
              if (times > 0) {
                await d
                  .update(schema.memberPasses)
                  .set({ remainTimes: passRow.remainTimes + times, updatedAt: now })
                  .where(eq(schema.memberPasses.id, passRow.id));
                await d.insert(schema.passDeductLogs).values({
                  passId: passRow.id,
                  appointmentId: null, // 退款回补无关联预约单（裁定③同收银扣次口径）
                  delta: times,
                  note: `退款回补 ${refundNo}`,
                });
              }
              if (residualFen !== 0) {
                // 不足 1 次等值的残余分：补写 segment 明细 detail（额度挂账明示，不静默吞分）
                await d
                  .update(schema.refundBillItems)
                  .set({
                    detailJson: {
                      method: s.method,
                      ratioBp: s.ratioBp,
                      channel: s.channel,
                      timesRestored: times,
                      residualFen,
                      residualNote: '不足 1 次等值的差额随线下原路结清',
                    },
                  })
                  .where(
                    and(
                      eq(schema.refundBillItems.refundId, refund.id),
                      eq(schema.refundBillItems.paymentId, s.paymentId),
                    ),
                  );
              }
            }
            // cash/wechat/alipay 段：segment 回补行已落，实退标记待登记（内测期线下原路）
          }

          /* ---- ③ 库存回补（商品行；按金额退恒空——口径写死） ---- */
          for (const r of plan.stockRestock) {
            const fresh = await d
              .select({ stock: schema.products.stock })
              .from(schema.products)
              .where(eq(schema.products.id, r.productId))
              .get();
            const beforeStock = fresh?.stock ?? 0;
            await d
              .update(schema.products)
              .set({ stock: sql`${schema.products.stock} + ${r.qty}`, updatedAt: now })
              .where(eq(schema.products.id, r.productId));
            await d.insert(schema.stockMovements).values({
              storeId,
              productId: r.productId,
              sourceType: 'refund',
              sourceId: refundNo,
              delta: r.qty,
              beforeStock,
              afterStock: beforeStock + r.qty,
              operatorId: ctx.user.id,
              note: `退款回补 ${plan.bill.billNo}`,
            });
          }

          /* ---- ④ 预约行清零回待收款（已服务闸门在 computePlan 已拦） ---- */
          for (const r of plan.appointmentReverts) {
            await d
              .update(schema.appointments)
              .set({ paidAt: null, paidFen: null, updatedAt: now })
              .where(eq(schema.appointments.id, r.appointmentId));
          }

          /* ---- ⑧ 次卡退卡（V8）：折算额按 refundMethod 落地 + 卡作废留痕 ---- */
          if (plan.passCancel) {
            const pc = plan.passCancel;
            if (input.refundMethod === 'to_stored_value' && plan.refundFen > 0) {
              // 退储值账户（前后余额留痕；无账户则建——退卡回补通道，非充值入口，报备）
              const existingAcc = await d
                .select()
                .from(schema.storedValueAccounts)
                .where(
                  and(
                    eq(schema.storedValueAccounts.userId, pc.userId),
                    eq(schema.storedValueAccounts.storeId, storeId),
                  ),
                )
                .get();
              const acc: typeof schema.storedValueAccounts.$inferSelect =
                existingAcc ??
                (await d
                  .insert(schema.storedValueAccounts)
                  .values({ userId: pc.userId, storeId, principalFen: 0, bonusFen: 0 })
                  .returning()
                  .then((r) => r[0]!));
              const before = acc.principalFen + acc.bonusFen;
              await d
                .update(schema.storedValueAccounts)
                .set({ principalFen: acc.principalFen + plan.refundFen, updatedAt: now })
                .where(eq(schema.storedValueAccounts.id, acc.id));
              await d.insert(schema.storedValueLogs).values({
                accountId: acc.id,
                userId: pc.userId,
                storeId,
                deltaPrincipalFen: plan.refundFen,
                deltaBonusFen: 0,
                deltaFen: plan.refundFen,
                balanceBeforeFen: before,
                balanceAfterFen: before + plan.refundFen,
                billNo: null, // 退卡无原单支付段（锚点单非资金单）
                operatorId: ctx.user.id,
                note: `次卡退卡回补 ${refundNo}`,
              });
            }
            // offline_original：金额明细已落 pass 行，实退标记待登记（内测期线下原路）
            const passRow = await d
              .select()
              .from(schema.memberPasses)
              .where(eq(schema.memberPasses.id, pc.passId))
              .get();
            if (passRow) {
              // 退卡后卡作废留痕：无 voided 状态值 → disabled + 次数清零 + 负向流水（报备偏差 2）
              await d
                .update(schema.memberPasses)
                .set({ status: 'disabled', remainTimes: 0, updatedAt: now })
                .where(eq(schema.memberPasses.id, passRow.id));
              if (passRow.remainTimes > 0) {
                await d.insert(schema.passDeductLogs).values({
                  passId: passRow.id,
                  appointmentId: null,
                  delta: -passRow.remainTimes,
                  note: `次卡退卡作废 ${refundNo}（含赠次作废 ${pc.giftVoided} 次，赠次不计价）`,
                });
              }
            }
          }

          /* ---- ⑤ 原单挂标记（原单一字不改；pass_cancel 锚点单不挂——报备偏差 1） ---- */
          if (!plan.anchorOnly) {
            const newRefunded = plan.refundedSoFarFen + plan.refundFen;
            await d
              .update(schema.cashierBills)
              .set({
                refundStatus: newRefunded >= plan.bill.paidFen ? 'refunded' : 'partial',
                refundBillNo: refundNo,
                updatedAt: now,
              })
              .where(eq(schema.cashierBills.id, plan.bill.id));
          }

          /* ---- 同事务事件：RefundExecuted → store 频道（店长视图待办/财务联动） ---- */
          outboxIds.push(
            await emitEvent(d, `store:${storeId}`, EventType.RefundExecuted, {
              refundNo,
              billNo: plan.bill.billNo,
              amountFen: plan.refundFen,
              type: plan.type,
              by: ctx.user.id,
            }),
          );
          return { refund, plan, idempotent: false as const };
        });
        outboxIds.forEach(broadcastNow);
        return {
          refund: result.refund,
          /** 幂等重放不重新干跑计划（原单可能已终态），plan=null 由退款单快照还原 */
          plan: result.plan ? planView(result.plan) : null,
          idempotent: result.idempotent,
        };
      });
    }),

  /**
   * rejectDraft（仅店主——驳回权仅店主，矩阵 V1.2）：draft→rejected 留痕 +
   * emit RefundRejected。非 draft 单（executed 不可撤销）明文拒。
   * 备注列复用 settle_note 落「驳回：…」（无专用驳回列，报备）。
   */
  rejectDraft: merchantOwnerProcedure
    .input(z.object({ refundId: z.string().min(1), note: z.string().trim().min(1, '驳回须填原因').max(200) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const refund = await ctx.db
        .select()
        .from(schema.refundBills)
        .where(eq(schema.refundBills.id, input.refundId))
        .get();
      if (!refund || refund.storeId !== storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '退款单不存在' });
      }
      if (refund.status !== 'draft') {
        badRequest(`当前状态（${refund.status}）不可驳回，仅 draft 可驳回（executed 不可撤销，纠错=再开正单）`);
      }
      const now = new Date();
      const updated = await ctx.db
        .update(schema.refundBills)
        .set({
          status: 'rejected',
          approverId: ctx.user.id,
          settleNote: `驳回：${input.note}`,
          updatedAt: now,
        })
        .where(eq(schema.refundBills.id, refund.id))
        .returning()
        .then((r) => r[0]!);
      const bill = await ctx.db
        .select({ billNo: schema.cashierBills.billNo })
        .from(schema.cashierBills)
        .where(eq(schema.cashierBills.id, refund.billId))
        .get();
      const outboxId = await emitEvent(ctx.db, `store:${storeId}`, EventType.RefundRejected, {
        refundId: refund.id,
        refundNo: refund.refundNo,
        billNo: bill?.billNo ?? null,
        amountFen: refund.amountFen,
        note: input.note,
        by: ctx.user.id,
      });
      broadcastNow(outboxId);
      return { refund: updated };
    }),

  /**
   * settleActual（owner|manager 本店——实退登记店长本店可办）：executed→settled
   * （settled_at/settle_note），emit RefundSettled。已 settled 重复登记=幂等返回。
   * 超 24h 未登记 → pendingActual 待办（查询侧承担）。
   */
  settleActual: merchantManagerProcedure
    .input(z.object({ refundId: z.string().min(1), note: z.string().trim().min(1, '实退登记须填备注').max(200) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const refund = await ctx.db
        .select()
        .from(schema.refundBills)
        .where(eq(schema.refundBills.id, input.refundId))
        .get();
      if (!refund || refund.storeId !== storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '退款单不存在' });
      }
      if (refund.status === 'settled') return { refund, idempotent: true as const };
      if (refund.status !== 'executed') {
        badRequest(`当前状态（${refund.status}）不可登记实退，仅 executed 可登记`);
      }
      const now = new Date();
      const updated = await ctx.db
        .update(schema.refundBills)
        .set({ status: 'settled', settledAt: now, settleNote: input.note, updatedAt: now })
        .where(eq(schema.refundBills.id, refund.id))
        .returning()
        .then((r) => r[0]!);
      const bill = await ctx.db
        .select({ billNo: schema.cashierBills.billNo })
        .from(schema.cashierBills)
        .where(eq(schema.cashierBills.id, refund.billId))
        .get();
      const outboxId = await emitEvent(ctx.db, `store:${storeId}`, EventType.RefundSettled, {
        refundId: refund.id,
        refundNo: refund.refundNo,
        billNo: bill?.billNo ?? null,
        amountFen: refund.amountFen,
        by: ctx.user.id,
      });
      broadcastNow(outboxId);
      return { refund: updated, idempotent: false as const };
    }),

  /**
   * list（owner|manager 本店——矩阵「退款单查询 店员❌」，头注报备偏差 5）：
   * {status?, from?, to?} 按 biz_date 倒序，含原单号/金额/类型/操作人/审批人/实退标记。
   */
  list: merchantManagerProcedure
    .input(
      z
        .object({
          status: z.enum(['draft', 'executed', 'settled', 'rejected']).optional(),
          from: z.string().regex(DATE_RE, '日期格式须为 YYYY-MM-DD').optional(),
          to: z.string().regex(DATE_RE, '日期格式须为 YYYY-MM-DD').optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const conds = [eq(schema.refundBills.storeId, storeId)];
      if (input?.status) conds.push(eq(schema.refundBills.status, input.status));
      if (input?.from) conds.push(gte(schema.refundBills.bizDate, input.from));
      if (input?.to) conds.push(lt(schema.refundBills.bizDate, nextDayStr(input.to)));
      const rows = await ctx.db
        .select({
          refund: schema.refundBills,
          billNo: schema.cashierBills.billNo,
          operatorName: schema.users.nickname,
        })
        .from(schema.refundBills)
        .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.refundBills.billId))
        .leftJoin(schema.users, eq(schema.users.id, schema.refundBills.operatorId))
        .where(and(...conds))
        .orderBy(desc(schema.refundBills.bizDate), desc(schema.refundBills.createdAt), desc(schema.refundBills.id))
        .limit(200);
      const approverIds = [...new Set(rows.map((r) => r.refund.approverId).filter((x): x is string => !!x))];
      const approvers = approverIds.length
        ? await ctx.db
            .select({ id: schema.users.id, nickname: schema.users.nickname })
            .from(schema.users)
            .where(inArray(schema.users.id, approverIds))
        : [];
      const approverNameById = new Map(approvers.map((a) => [a.id, a.nickname]));
      return rows.map((r) => ({
        ...r.refund,
        billNo: r.billNo,
        operatorName: r.operatorName ?? null,
        approverName: r.refund.approverId ? (approverNameById.get(r.refund.approverId) ?? null) : null,
        /** 实退标记：settled=已登记实退；executed=待登记（线下原路内测期口径） */
        actualSettled: r.refund.status === 'settled',
      }));
    }),

  /**
   * pendingActual（owner|manager 本店）：店长视图第八区块「实退待办」数据源——
   * executed 且 settled_at IS NULL 且执行超 24h 的待办列表（冻结版 §三）。
   */
  pendingActual: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const deadline = new Date(Date.now() - SETTLE_TODO_MS);
    const rows = await ctx.db
      .select({
        refund: schema.refundBills,
        billNo: schema.cashierBills.billNo,
        operatorName: schema.users.nickname,
      })
      .from(schema.refundBills)
      .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.refundBills.billId))
      .leftJoin(schema.users, eq(schema.users.id, schema.refundBills.operatorId))
      .where(
        and(
          eq(schema.refundBills.storeId, storeId),
          eq(schema.refundBills.status, 'executed'),
          isNull(schema.refundBills.settledAt),
          lt(schema.refundBills.createdAt, deadline),
        ),
      )
      .orderBy(schema.refundBills.createdAt);
    return rows.map((r) => ({ ...r.refund, billNo: r.billNo, operatorName: r.operatorName ?? null }));
  }),

  /**
   * exportCsv（仅店主——导出仅老板，总规则③）：{month} → CSV 全列 +
   * emitEvent 留痕 {by, month, rows}（事件名字面量报备，头注偏差 6）。UTF-8 BOM。
   */
  exportCsv: merchantOwnerProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const rows = await ctx.db
        .select({
          refund: schema.refundBills,
          billNo: schema.cashierBills.billNo,
          operatorName: schema.users.nickname,
        })
        .from(schema.refundBills)
        .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.refundBills.billId))
        .leftJoin(schema.users, eq(schema.users.id, schema.refundBills.operatorId))
        .where(and(eq(schema.refundBills.storeId, storeId), gte(schema.refundBills.bizDate, `${input.month}-01`), lt(schema.refundBills.bizDate, `${nextMonthStr(input.month)}-01`)))
        .orderBy(schema.refundBills.bizDate, schema.refundBills.refundNo);
      const approverIds = [...new Set(rows.map((r) => r.refund.approverId).filter((x): x is string => !!x))];
      const approvers = approverIds.length
        ? await ctx.db
            .select({ id: schema.users.id, nickname: schema.users.nickname })
            .from(schema.users)
            .where(inArray(schema.users.id, approverIds))
        : [];
      const approverNameById = new Map(approvers.map((a) => [a.id, a.nickname]));
      const TYPE_LABEL: Record<string, string> = {
        full: '全额退款',
        partial_items: '部分退款（按行）',
        partial_amount: '部分退款（按金额）',
        boarding_nights: '寄养剩余晚退',
        pass_cancel: '次卡退卡',
      };
      const STATUS_LABEL: Record<string, string> = {
        draft: '草稿',
        executed: '已执行（待实退登记）',
        settled: '实退完成',
        rejected: '已驳回',
      };
      const METHOD_LABEL: Record<string, string> = {
        offline_original: '线下原路退回',
        to_stored_value: '退储值账户',
      };
      const cell = (v: string | number | null | undefined): string => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
      };
      const header = '退款单号,退款日期,原单号,类型,金额(元),原因,状态,实退方式,操作人,审批人,实退时间,实退备注,创建时间';
      const lines = rows.map((r) =>
        [
          r.refund.refundNo,
          r.refund.bizDate,
          r.billNo,
          TYPE_LABEL[r.refund.type] ?? r.refund.type,
          (r.refund.amountFen / 100).toFixed(2),
          r.refund.reason,
          STATUS_LABEL[r.refund.status] ?? r.refund.status,
          r.refund.refundMethod ? (METHOD_LABEL[r.refund.refundMethod] ?? r.refund.refundMethod) : '',
          r.operatorName ?? r.refund.operatorId,
          r.refund.approverId ? (approverNameById.get(r.refund.approverId) ?? r.refund.approverId) : '',
          r.refund.settledAt?.toISOString() ?? '',
          r.refund.settleNote ?? '',
          r.refund.createdAt.toISOString(),
        ]
          .map(cell)
          .join(','),
      );
      const csv = '﻿' + header + '\n' + lines.join('\n') + (lines.length ? '\n' : '');
      /* 导出留痕（总规则③）：事件载荷 {by, month, rows}，不落其他表 */
      const outboxId = await emitEvent(ctx.db, `store:${storeId}`, EventType.RefundMonthExported, {
        by: ctx.user.id,
        month: input.month,
        rows: lines.length,
      });
      broadcastNow(outboxId);
      return { filename: `refunds-${input.month}.csv`, csv, rows: lines.length };
    }),

  /**
   * dayStats（owner|manager 本店）：日结「退款单列」钩子——**不改 cashier.ts
   * 既有日结函数**，本端点只出退款侧分列，前端做差。
   * V2 口径：现金段净额=现金已收−现金退款——现金已收由 cashier 既有统计
   * （computeDayTender/todayTenderStats）出，本端点只出退款段分列；
   * V7 口径：按 refund_bills.biz_date=date 聚合（退款发生日），不回填历史封箱。
   */
  dayStats: merchantManagerProcedure
    .input(z.object({ date: z.string().regex(DATE_RE, '日期格式须为 YYYY-MM-DD') }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const refunds = await ctx.db
        .select()
        .from(schema.refundBills)
        .where(
          and(
            eq(schema.refundBills.storeId, storeId),
            eq(schema.refundBills.bizDate, input.date),
            inArray(schema.refundBills.status, [...POSTED_STATUSES]),
          ),
        );
      const totalFen = refunds.reduce((s, r) => s + r.amountFen, 0);
      const segments = { cashFen: 0, wechatFen: 0, alipayFen: 0, passFen: 0, storedValueFen: 0 };
      if (refunds.length > 0) {
        const segRows = await ctx.db
          .select({
            method: schema.cashierPayments.method,
            amountFen: schema.refundBillItems.amountFen,
          })
          .from(schema.refundBillItems)
          .innerJoin(schema.cashierPayments, eq(schema.cashierPayments.id, schema.refundBillItems.paymentId))
          .where(
            and(
              inArray(schema.refundBillItems.refundId, refunds.map((r) => r.id)),
              eq(schema.refundBillItems.kind, 'segment'),
            ),
          );
        for (const s of segRows) {
          if (s.method === 'cash') segments.cashFen += s.amountFen;
          else if (s.method === 'wechat') segments.wechatFen += s.amountFen;
          else if (s.method === 'alipay') segments.alipayFen += s.amountFen;
          else if (s.method === 'pass') segments.passFen += s.amountFen;
          else if (s.method === 'stored_value') segments.storedValueFen += s.amountFen;
        }
      }
      return {
        date: input.date,
        /** 当日退款笔数（executed|settled 已落账口径） */
        count: refunds.length,
        /** 当日退款总额（分；日结「退款单列」） */
        totalFen,
        /** 按支付段分列的退款额（分）：现金段净额=现金已收−cashFen，已收由 cashier 既有统计出（V2） */
        segments,
        note: '当日净额=已收−退款；已收由 cashier.computeDayTender 既有统计出，本端点只出退款段分列（V2/V7 口径）',
      };
    }),
});

/** 'YYYY-MM-DD' → 次日 'YYYY-MM-DD'（list.to 右端不含） */
function nextDayStr(date: string): string {
  const [y, m, d] = date.split('-').map((s) => parseInt(s, 10));
  const nd = new Date(y, m - 1, d + 1);
  return `${nd.getFullYear()}-${pad2(nd.getMonth() + 1)}-${pad2(nd.getDate())}`;
}

/** 'YYYY-MM' → 下一月 'YYYY-MM'（exportCsv 右端不含；同 attendance.ts 口径） */
function nextMonthStr(month: string): string {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  const d = new Date(y, m, 1); // m 为 1 基 → Date 月份索引 m 即下一月
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export type RefundRouter = typeof refundRouter;
