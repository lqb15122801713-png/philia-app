/**
 * cashier router（批次 M1 · 商家端收银台 server 侧契约 · K3 名下文件）
 *
 * 登记型收银（决策 #27：不碰真实支付/扫码唤起/网关），三种钱进来：服务款 /
 * 商品款 / 预约到店付（次卡款售卡充次复用 pass.topUp 链路，不在本路由）。
 *
 * 单生命周期（五态冻结）：open → held → open → settled；open/held → voided
 * （留痕不删除）；settled 终态不可撤（裁定③：撤单回补属退款专项，本批冻结，
 * voidBill 对 settled 单明确报错）。
 *
 * 关键规则落点：
 * - 单号 bill_no = HD-{YYYYMMDD}-{当日 3 位序号}：日期按门店规范时区（+8，
 *   沿用 appointment.ts storeWallclock/storeDayStartMs 位移法）取「当日」，
 *   序号 = 该店当日已开单数 + 1，事务内在串行锁下分配（收银写路径应用层
 *   串行锁 withCashierWriteLock，口径同 mall.withOrderWriteLock——@libsql/client
 *   单连接并发事务会交错中毒，串行后事务即行锁）。bill_no 同时是 settle /
 *   void 的幂等键（裁定③）。
 * - 金额口径（分）：金额一律服务端按快照重算（同 mall §4.7 不信前端金额）。
 *   有效价 = adjustedPriceFen ?? unitPriceFen；subtotal = Σ有效价×qty；
 *   应收 payable = subtotal − 单级优惠 discount；单级优惠只允许覆盖
 *   服务/商品行（预约行金额不参与优惠，保证预约财务口径可逐行对账）。
 * - 支付方式四分列（M1-补1 修订 1）：cash | wechat | alipay | pass
 *   （「扫码」拆微信/支付宝，账目四分列入流水，M2 日结批次直接取数）；
 *   「记账 credit」已删除（挂账缓做，运营口径在案）——Σ支付=应收才放行，
 *   settled 即全额已收（paid_fen = payable_fen），收银单无待收态；
 *   预留 stored_value 位但禁用（存量储值支付=老板裁定①已生效，功能列 M2，
 *   zod 不收）。连带删除：collect 端点 / cashier.billCollected 事件（无
 *   触发点，删干净）。
 * - 改价/折扣闸门（裁定① + 任务书 §1.7）：行改价（adjustedPriceFen）或
 *   单级优惠（discountType≠none）仅 merchant_owner——hold/settle 路由内
 *   assertMerchantOwner 硬校验（merchantOwnerProcedure 不能复用于整路由，
 *   因开单/挂单/结账本体对 manager 开放）；voidBill 整端点走
 *   merchantOwnerProcedure。manager 越权一律 FORBIDDEN 如实文案。
 * - 结账事务（settle）同构 appointment.create / mall.createOrder 模式：
 *   串行锁 + 单事务内 校验 Σ支付=应收 → 次卡扣次（pass 段=扣次，先于后续
 *   写库，失败整体回滚；余额不足 FORBIDDEN 如实；扣次流水 appointment_id=NULL、
 *   note 带 bill_no——裁定③）→ 商品行库存 MAX(0,stock-qty) 扣减（扣前
 *   stock<qty 的行 stockShort=true 留痕，不足不阻塞但须明示——任务书 §1.5.4）
 *   → 预约行翻转（复用 appointment.markPaid 事务内核：completed 且未 paid →
 *   paidAt/paidFen + appointment.paid 事件；预约财务口径只此一翻，禁止双头
 *   记账——收银流水不再重复认领预约行金额，见 loadCashierFinance 头注）
 *   → 落/更新单 settled + 写 cashier_payments → emitEvent(cashier.billSettled)
 *   同事务，提交后 broadcastNow。
 * - 审计链（M1-补1 修订 2）：operator_id 必填——创建/挂单/结账时 =
 *   当时操作人 ctx.user.id（v1 与 created_by 同源，M2 班次启用后分叉）；
 *   shift_id 预留恒 NULL。
 * - 幂等：settle 以 bill_no 为幂等键——同 bill_no 重复 settle 直接
 *   返回已 settled 单快照（idempotent=true），不重复扣次/扣库存/翻预约/写
 *   支付段。voidBill 对 voided 单幂等返回。
 * - 事件（契约 2）：全部走 store:{storeId} 频道（商家端 MerchantEventsProvider
 *   已订阅，零新 SSE 基建）；业务写库与 emitEvent 同事务，提交后 broadcastNow。
 * - 边界（任务书 §6）：v1 单收银台假设——无挂单超时清理、无多端开单冲突
 *   处理（串行锁仅保服务端写一致）；无 bill_no 的 settle 无法跨重试幂等
 *   （前端对重试场景应先 hold 取单号或复用已取单 bill_no），留扩展点。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, isNull, like, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import {
  assertMerchantOwner,
  merchantOwnerProcedure,
  merchantProcedure,
  router,
} from '../trpc';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { storeDayStartMs, storeWallclock } from './appointment';

/* ------------------------------------------------------------------ */
/* 常量与类型                                                            */
/* ------------------------------------------------------------------ */

/** 收银单状态取值（schema text 列的应用层枚举，五态冻结） */
const BILL_STATUSES = ['open', 'held', 'settled', 'voided'] as const;
type BillStatus = (typeof BILL_STATUSES)[number];

/** 行类型 / 支付方式 / 优惠类型枚举 */
const ITEM_KINDS = ['service', 'product', 'appointment'] as const;
/**
 * 支付方式四分列（M1-补1 修订 1）：cash 现金 | wechat 微信 | alipay 支付宝 |
 * pass 次卡扣次。「记账 credit」已删除（挂账缓做，运营口径在案）。
 * 预留 stored_value（存量储值支付）位但禁用——老板裁定①已生效、功能列 M2，
 * zod 此处不收，传了直接 400。
 */
const PAYMENT_METHODS = ['cash', 'wechat', 'alipay', 'pass'] as const;

/** 单号格式：HD-{YYYYMMDD}-{当日 3 位序号} */
const BILL_NO_RE = /^HD-\d{8}-\d{3}$/;

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

type BillRow = typeof schema.cashierBills.$inferSelect;
type BillItemRow = typeof schema.cashierBillItems.$inferSelect;
type PaymentRow = typeof schema.cashierPayments.$inferSelect;
type AppointmentRow = typeof schema.appointments.$inferSelect;
type ProductRow = typeof schema.products.$inferSelect;
type PassRow = typeof schema.memberPasses.$inferSelect;

// 注意：必须用 function 声明（而非箭头函数常量），TS 才会把「返回 never 的调用」
// 当作控制流终止点，从而在 if (!x) badRequest(...) 之后正确收窄 x 为非空。
function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* 收银写路径应用层串行化（进程内 async mutex · 单实例边界）                  */
/* ------------------------------------------------------------------ */

/**
 * hold / settle / collect / voidBill 写事务串行锁，口径同 mall.withOrderWriteLock：
 * @libsql/client 单连接上并发 db.transaction 会交错执行——败者 SQLITE_BUSY 且
 * 连接可能中毒；串行进入后事务即行锁（SQLite 单写者），bill_no 当日序号分配、
 * 幂等重读、库存/扣次校验的并发语义由此成立。未来切 MySQL 后本锁可去除。
 */
let cashierWriteQueue: Promise<unknown> = Promise.resolve();

/** 串行执行 fn（前序失败不阻塞后续队列） */
export function withCashierWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = cashierWriteQueue.then(fn);
  cashierWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/* ------------------------------------------------------------------ */
/* 单号生成（门店规范时区 +8 取「当日」，序号=当日已开单数+1）                 */
/* ------------------------------------------------------------------ */

/**
 * 事务内调用（串行锁保护下无并发撞号； UNIQUE 索引兜底）。
 * 当日窗口 = 门店规范时区（+8）当日 [00:00, 次日 00:00)，与财务 byDay 日界同帧。
 */
async function genBillNo(d: DbHandle, storeId: string, now: Date): Promise<string> {
  const w = storeWallclock(now);
  const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const row = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.cashierBills)
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        gte(schema.cashierBills.createdAt, dayStart),
        lt(schema.cashierBills.createdAt, dayEnd),
      ),
    )
    .get();
  const seq = Number(row?.n ?? 0) + 1;
  return `HD-${w.y}${pad2(w.m)}${pad2(w.day)}-${String(seq).padStart(3, '0')}`;
}

/* ------------------------------------------------------------------ */
/* 入参 schema                                                            */
/* ------------------------------------------------------------------ */

/** 购物车行入参（快照请求；价格/名称一律服务端按 refId 重查重算） */
const cartItemSchema = z.object({
  kind: z.enum(ITEM_KINDS),
  refId: z.string().min(1),
  /** 服务/预约行恒 1（路由内强校验），仅商品行可 >1 */
  qty: z.number().int().min(1).max(99).default(1),
  /** 行改价（分，留痕）；非空即触发 owner 闸门 */
  adjustedPriceFen: z.number().int().min(0).max(100_000_000).nullish(),
  /** 次卡扣次行标记（仅 grooming 服务行；须绑会员） */
  paidByPass: z.boolean().default(false),
});

/** 购物车快照（hold / settle 共用） */
const cartSnapshotSchema = z.object({
  /** 幂等键：取单后结账/挂单更新时必带；新开单缺省（服务端生成） */
  billNo: z.string().regex(BILL_NO_RE, '单号格式应为 HD-YYYYMMDD-序号').optional(),
  /** 会员用户 ID（散客缺省/null） */
  customerId: z.string().min(1).nullish(),
  items: z.array(cartItemSchema).min(1, '购物车为空').max(50),
  /** 单级优惠：none | percent（折扣%，如 90=九折） | amount（立减分）；非 none 触发 owner 闸门 */
  discountType: z.enum(['none', 'percent', 'amount']).default('none'),
  discountValue: z.number().int().min(0).max(100_000_000).default(0),
  note: z.string().max(500).optional(),
});

/** 支付段入参（settle：四分列可组合；stored_value 预留位禁用——zod 不收） */
const paymentSegmentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amountFen: z.number().int().min(1, '支付金额须 ≥1 分').max(100_000_000),
  /** method='pass' 时可指定次卡（缺省=该会员本店唯一卡）；其余方式忽略 */
  passId: z.string().min(1).optional(),
});

/* ------------------------------------------------------------------ */
/* 行解析与金额计算（服务端重算，不信前端金额）                                */
/* ------------------------------------------------------------------ */

/** 解析后的购物车行（快照数据源） */
interface ResolvedItem {
  kind: (typeof ITEM_KINDS)[number];
  refId: string;
  nameSnapshot: string;
  specSnapshot: string | null;
  qty: number;
  unitPriceFen: number;
  adjustedPriceFen: number | null;
  paidByPass: boolean;
  /** 服务行原类型（grooming 才允许次卡扣次，B2-7R 口径） */
  serviceType?: string;
  /** 预约行：翻转所需上下文 */
  appointment?: AppointmentRow;
  appointmentPetName?: string | null;
  /** 商品行：库存扣减所需当前行（事务内重读后的快照） */
  product?: ProductRow;
}

/** 行有效单价（改价留痕口径：adjusted ?? unit） */
const effPrice = (it: { unitPriceFen: number; adjustedPriceFen: number | null }): number =>
  it.adjustedPriceFen ?? it.unitPriceFen;

/**
 * 按 refId 逐行重查解析快照（名称/规格/单价），并做归属与状态校验：
 * - service：本店 + 上架；qty 恒 1；spec=「N 分钟」；
 * - product：本店 + 上架（下架/不存在 BAD_REQUEST，同 mall 口径）；qty 1-99；
 * - appointment：本店 + completed + 未收款（paidAt IS NULL，对齐 store.financeStats
 *   pendingPayments 口径）；qty 恒 1；不允许 paidByPass（预约次卡抵扣在预约链路完成，
 *   收银台预约行=到店付收款登记）。
 * 次卡扣次行约束（paidByPass）：仅 service 行且原类型 grooming（B2-7R 次卡仅洗护），
 * 且整单须绑会员（散客无次卡）。
 */
async function resolveItems(
  d: DbHandle,
  storeId: string,
  input: z.infer<typeof cartItemSchema>[],
): Promise<ResolvedItem[]> {
  const out: ResolvedItem[] = [];
  for (const it of input) {
    if (it.kind === 'service') {
      if (it.qty !== 1) badRequest('服务行数量恒为 1');
      const svc = await d
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, it.refId))
        .get();
      if (!svc || svc.storeId !== storeId || !svc.active) badRequest('服务项无效或已下架');
      out.push({
        kind: 'service',
        refId: svc.id,
        nameSnapshot: svc.name,
        specSnapshot: svc.durationMin ? `${svc.durationMin} 分钟` : null,
        qty: 1,
        unitPriceFen: svc.priceFen,
        adjustedPriceFen: it.adjustedPriceFen ?? null,
        paidByPass: it.paidByPass,
        serviceType: svc.type,
      });
    } else if (it.kind === 'product') {
      const p = await d
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, it.refId))
        .get();
      if (!p || p.storeId !== storeId) badRequest('购物车含不存在的商品，请刷新后重试');
      if (p.status !== 'on') badRequest(`「${p.name}」已下架，请移除后再结账`);
      out.push({
        kind: 'product',
        refId: p.id,
        nameSnapshot: p.name,
        specSnapshot: p.category,
        qty: it.qty,
        unitPriceFen: p.priceFen,
        adjustedPriceFen: it.adjustedPriceFen ?? null,
        paidByPass: false,
        product: p,
      });
    } else {
      // appointment 行：待收款预约（completed 且未 paid）
      if (it.qty !== 1) badRequest('预约行数量恒为 1');
      if (it.paidByPass) badRequest('预约行不支持次卡扣次（预约次卡抵扣请在预约链路完成）');
      const appt = await d
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.id, it.refId))
        .get();
      if (!appt || appt.storeId !== storeId) badRequest('预约不存在或不属于本店');
      if (appt.status !== 'completed') badRequest('仅已完成（completed）的预约可拉入收银');
      if (appt.paidAt) badRequest('该预约已登记收款，不可重复拉入');
      const pet = await d
        .select({ name: schema.pets.name })
        .from(schema.pets)
        .where(eq(schema.pets.id, appt.petId))
        .get();
      const svc = await d
        .select({ name: schema.services.name })
        .from(schema.services)
        .where(eq(schema.services.id, appt.serviceId))
        .get();
      out.push({
        kind: 'appointment',
        refId: appt.id,
        nameSnapshot: svc?.name ?? '预约服务',
        specSnapshot: pet?.name ? `宠物 · ${pet.name}` : null,
        qty: 1,
        unitPriceFen: appt.priceFen,
        adjustedPriceFen: it.adjustedPriceFen ?? null,
        paidByPass: false,
        appointment: appt,
        appointmentPetName: pet?.name ?? null,
      });
    }
  }
  const passLines = out.filter((r) => r.paidByPass);
  if (passLines.length > 0) {
    for (const r of passLines) {
      // kind==='product'/'appointment' 已在上面强制 paidByPass=false，此处仅防御
      if (r.kind !== 'service' || r.serviceType !== 'grooming') {
        badRequest('次卡扣次仅支持洗护服务行（B2-7R：次卡仅洗护可用）');
      }
    }
  }
  return out;
}

/** 单级优惠与应收计算：优惠仅可覆盖服务/商品行（预约行不参与优惠） */
function computeAmounts(
  items: ResolvedItem[],
  discountType: 'none' | 'percent' | 'amount',
  discountValue: number,
): { subtotalFen: number; discountFen: number; payableFen: number } {
  const subtotalFen = items.reduce((s, it) => s + effPrice(it) * it.qty, 0);
  let discountFen = 0;
  if (discountType === 'percent') {
    // percent 口径：90 = 九折（收 90%）；值域 1-100
    if (discountValue < 1 || discountValue > 100) badRequest('折扣%须在 1-100 之间（如 90 = 九折）');
    discountFen = subtotalFen - Math.round((subtotalFen * discountValue) / 100);
  } else if (discountType === 'amount') {
    discountFen = discountValue;
  }
  const nonApptSubtotal = items
    .filter((it) => it.kind !== 'appointment')
    .reduce((s, it) => s + effPrice(it) * it.qty, 0);
  if (discountFen > nonApptSubtotal) {
    badRequest('单级优惠不能超过服务/商品行合计（预约行金额不参与优惠）');
  }
  return { subtotalFen, discountFen, payableFen: subtotalFen - discountFen };
}

/** 改价/折扣 owner 闸门（裁定①）：行改价或单级优惠非 none 时硬校验 merchant_owner */
function assertPriceEditAllowed(ctx: Parameters<typeof assertMerchantOwner>[0], input: {
  items: Array<{ adjustedPriceFen?: number | null }>;
  discountType: string;
}): void {
  const hasAdjusted = input.items.some((it) => it.adjustedPriceFen != null);
  if (hasAdjusted || input.discountType !== 'none') assertMerchantOwner(ctx);
}

/** 次卡当前可用（口径同 pass.ts passUsable）：active + 有余量 + 未过期 */
function passUsable(p: PassRow): boolean {
  return (
    p.status === 'active' &&
    p.remainTimes > 0 &&
    (p.expiresAt === null || p.expiresAt.getTime() > Date.now())
  );
}

/* ------------------------------------------------------------------ */
/* 快照组装（路由返回统一形状）                                              */
/* ------------------------------------------------------------------ */

const maskPhone = (phone: string | null): string | null =>
  phone ? phone.replace(/^(\d{3})\d{4}(\d{3,4})$/, '$1****$2') : null;

/** 整单快照（详情/结账/挂单返回同构：单 + 行项 + 支付明细 + 开单人/会员名） */
async function billSnapshot(d: DbHandle, bill: BillRow) {
  const items = await d
    .select()
    .from(schema.cashierBillItems)
    .where(eq(schema.cashierBillItems.billId, bill.id));
  const payments = await d
    .select()
    .from(schema.cashierPayments)
    .where(eq(schema.cashierPayments.billId, bill.id));
  const creator = await d
    .select({ nickname: schema.users.nickname })
    .from(schema.users)
    .where(eq(schema.users.id, bill.createdBy))
    .get();
  const customer = bill.customerId
    ? await d
        .select({ nickname: schema.users.nickname, phone: schema.users.phone })
        .from(schema.users)
        .where(eq(schema.users.id, bill.customerId))
        .get()
    : undefined;
  return {
    bill,
    items,
    payments,
    createdByName: creator?.nickname ?? null,
    buyerName: customer?.nickname ?? '散客',
    customerPhoneMasked: maskPhone(customer?.phone ?? null),
  };
}

/* ------------------------------------------------------------------ */
/* 财务并入口径（store.financeStats / dashboardStats 共用，本文件导出）         */
/* ------------------------------------------------------------------ */

/**
 * 收银单财务切片（禁止双头记账的核心约定）：
 * - 预约行金额（effAppt = Σ 预约行有效价）**不进**收银财务并入——该部分随
 *   预约翻转（appointments.paidAt/paidFen）由既有预约口径认领（任务书 §1.5.2
 *   「预约财务口径只此一翻」）。
 * - 收银自有口径 ownPayable = payable − effAppt（单级优惠只覆盖服务/商品行，
 *   settle 已强制 discount ≤ 非预约行合计，故 ownPayable = 服务/商品净额，
 *   恒 ≥0）。服务/商品拆分：优惠先抵服务行——serviceNet = max(0, effService −
 *   discount)（封顶 ownPayable），productNet = ownPayable − serviceNet。
 * - 收款确认按 payment 段逐段认领（现金口径，与预约 paidAt 口径同基）：
 *   各段按 createdAt 顺序先抵服务净额再抵商品净额；每段产生一条 recognized
 *   入账记录（at=段时间）。M1-补1 起 settled 即全额已收（无 credit 段），
 *   ownReceived 恒 = ownPayable；历史 credit 段（M1-补1 前的本地验证数据）
 *   跳过不认领，仅作留痕。
 */
export interface CashierRecognizedEntry {
  at: Date;
  serviceFen: number;
  shopFen: number;
  /** 其中次卡扣次部分（非现金；财务「次卡扣次不计入营业额」口径的溯源依据） */
  passFen: number;
}

export interface CashierBillFinanceView {
  bill: BillRow;
  buyerName: string;
  itemCount: number;
  /** 行摘要（流水表「内容摘要」列）：前 2 行名 + 等 N 项 */
  summary: string;
  /** 支付方式去重列表（流水表「支付方式签」，四分列 cash|wechat|alipay|pass） */
  methods: string[];
  /** 次卡扣次合计（分，method='pass' 段） */
  passFen: number;
  ownPayableFen: number;
  ownReceivedFen: number;
  recognized: CashierRecognizedEntry[];
}

/**
 * 载入本店全部已结账单的财务切片（v1 数据量级一次取全量，口径同
 * store.dashboardStats 注释「本店预约一次取出在应用层聚合」）。
 */
export async function loadCashierFinance(
  d: DbHandle,
  storeId: string,
): Promise<CashierBillFinanceView[]> {
  const bills = await d
    .select({
      bill: schema.cashierBills,
      buyerName: schema.users.nickname,
    })
    .from(schema.cashierBills)
    .leftJoin(schema.users, eq(schema.users.id, schema.cashierBills.customerId))
    .where(and(eq(schema.cashierBills.storeId, storeId), eq(schema.cashierBills.status, 'settled')));
  if (bills.length === 0) return [];
  const billIds = bills.map((b) => b.bill.id);
  const [items, payments] = await Promise.all([
    d
      .select()
      .from(schema.cashierBillItems)
      .where(inArray(schema.cashierBillItems.billId, billIds)),
    d
      .select()
      .from(schema.cashierPayments)
      .where(inArray(schema.cashierPayments.billId, billIds)),
  ]);
  const itemsByBill = new Map<string, BillItemRow[]>();
  for (const it of items) {
    const arr = itemsByBill.get(it.billId) ?? [];
    arr.push(it);
    itemsByBill.set(it.billId, arr);
  }
  const paymentsByBill = new Map<string, PaymentRow[]>();
  for (const p of payments) {
    const arr = paymentsByBill.get(p.billId) ?? [];
    arr.push(p);
    paymentsByBill.set(p.billId, arr);
  }

  return bills.map(({ bill, buyerName }) => {
    const billItems = itemsByBill.get(bill.id) ?? [];
    const billPayments = (paymentsByBill.get(bill.id) ?? []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
    const effService = billItems
      .filter((it) => it.kind === 'service')
      .reduce((s, it) => s + effPrice(it) * it.qty, 0);
    const effAppt = billItems
      .filter((it) => it.kind === 'appointment')
      .reduce((s, it) => s + effPrice(it) * it.qty, 0);
    const ownPayableFen = Math.max(0, bill.payableFen - effAppt);
    const serviceNet = Math.min(ownPayableFen, Math.max(0, effService - bill.discountFen));

    const recognized: CashierRecognizedEntry[] = [];
    let covered = 0;
    let svcCovered = 0;
    let passFen = 0;
    const methods: string[] = [];
    for (const p of billPayments) {
      if (!methods.includes(p.method)) methods.push(p.method);
      if (p.method === 'pass') passFen += p.amountFen;
      // M1-补1 前本地验证数据的历史 credit 段：跳过不认领，仅留痕（credit 已废）
      if (p.method === 'credit') continue;
      const ownPart = Math.min(p.amountFen, ownPayableFen - covered);
      if (ownPart <= 0) continue;
      const svcPart = Math.min(ownPart, serviceNet - svcCovered);
      svcCovered += svcPart;
      covered += ownPart;
      recognized.push({
        at: p.createdAt,
        serviceFen: svcPart,
        shopFen: ownPart - svcPart,
        passFen: p.method === 'pass' ? ownPart : 0,
      });
    }
    const names = billItems.map((it) => it.nameSnapshot);
    const summary =
      names.length <= 2 ? names.join('、') : `${names.slice(0, 2).join('、')} 等 ${names.length} 项`;
    return {
      bill,
      buyerName: buyerName ?? '散客',
      itemCount: billItems.length,
      summary,
      methods,
      passFen,
      ownPayableFen,
      ownReceivedFen: covered,
      recognized,
    };
  });
}

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

export const cashierRouter = router({
  /**
   * 1. searchMember（merchant 本店）：手机号精确查会员。
   * 命中 → { found:true, id, nickname, phoneMasked, passRemainTimes（本店可用
   * 次卡剩余次数合计）, appointmentCount（本店在店预约数：
   * confirmed/in_service/in_boarding） }；未命中 → { found:false }（安静，
   * 不报错，不阻塞散客结账）。不做现场注册会员（任务书 §1.3）。
   */
  searchMember: merchantProcedure
    .input(z.object({ phone: z.string().trim().min(3).max(20) }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const user = await ctx.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.phone, input.phone))
        .get();
      if (!user) return { found: false as const };
      const pass = await ctx.db
        .select()
        .from(schema.memberPasses)
        .where(
          and(
            eq(schema.memberPasses.userId, user.id),
            eq(schema.memberPasses.storeId, storeId),
          ),
        )
        .get();
      const apptRows = await ctx.db
        .select({ n: sql<number>`count(*)` })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.customerId, user.id),
            eq(schema.appointments.storeId, storeId),
            inArray(schema.appointments.status, ['confirmed', 'in_service', 'in_boarding']),
          ),
        )
        .get();
      return {
        found: true as const,
        id: user.id,
        nickname: user.nickname,
        phoneMasked: maskPhone(user.phone),
        /** 本店可用次卡剩余次数（卡 unusable 时计 0；客户×门店唯一卡，见 schema） */
        passRemainTimes: pass && passUsable(pass) ? pass.remainTimes : 0,
        /** 在店预约数（已确认/服务中/寄养中） */
        appointmentCount: Number(apptRows?.n ?? 0),
      };
    }),

  /**
   * 2. pendingAppointments（merchant 本店）：待收款预约清单（开单区「待收款」
   * tab 数据源）。口径对齐 store.financeStats.pendingPayments：completed 且
   * paidAt IS NULL，按完成时间倒序，上限 100 条。
   */
  pendingAppointments: merchantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: schema.appointments.id,
        code: schema.appointments.code,
        priceFen: schema.appointments.priceFen,
        scheduledStart: schema.appointments.scheduledStart,
        completedAt: schema.appointments.completedAt,
        petName: schema.pets.name,
        serviceName: schema.services.name,
        customerName: schema.users.nickname,
      })
      .from(schema.appointments)
      .innerJoin(schema.pets, eq(schema.pets.id, schema.appointments.petId))
      .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
      .innerJoin(schema.users, eq(schema.users.id, schema.appointments.customerId))
      .where(
        and(
          eq(schema.appointments.storeId, ctx.user.storeId!),
          eq(schema.appointments.status, 'completed'),
          isNull(schema.appointments.paidAt),
        ),
      )
      .orderBy(desc(schema.appointments.completedAt))
      .limit(100);
    return rows;
  }),

  /**
   * 3. hold（merchant 本店）：挂单。当前购物车快照落 held 单：
   * - 不带 billNo：新开单，生成单号，状态直接 held；
   * - 带 billNo（已 open 的自家单再挂 / held 单更新快照）：同事务更新行项与
   *   金额，状态归 held，heldAt 刷新（同 bill_no 轨迹，不开新号）。
   * 开单区清空由前端做。行改价/单级优惠触发 owner 闸门。emit cashier.billHeld。
   */
  hold: merchantProcedure
    .input(cartSnapshotSchema)
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      assertPriceEditAllowed(ctx, input);
      return withCashierWriteLock(async () => {
        let outboxId = '';
        const result = await ctx.db.transaction(async (tx) => {
          const now = new Date();
          const resolved = await resolveItems(txDb(tx), storeId, input.items);
          const amounts = computeAmounts(resolved, input.discountType, input.discountValue);
          const customerId = input.customerId ?? null;
          if (resolved.some((r) => r.paidByPass) && !customerId) {
            badRequest('散客单不能使用次卡扣次，请先检索会员');
          }

          let bill: BillRow;
          if (input.billNo) {
            const existing = await tx
              .select()
              .from(schema.cashierBills)
              .where(eq(schema.cashierBills.billNo, input.billNo))
              .get();
            if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: '单号不存在' });
            if (existing.storeId !== storeId) forbidden('非本店单据，无权操作');
            if (existing.createdBy !== ctx.user.id) forbidden('仅可更新本人开出的挂单');
            if (existing.status !== 'open' && existing.status !== 'held') {
              badRequest(`当前状态（${existing.status}）不可挂单`);
            }
            // 同号更新：行项整组替换（快照语义），金额/会员/备注刷新；
            // operator_id 同步为当前操作人（M1-补1 审计链，by=who）
            await tx
              .delete(schema.cashierBillItems)
              .where(eq(schema.cashierBillItems.billId, existing.id));
            bill = await tx
              .update(schema.cashierBills)
              .set({
                customerId,
                discountType: input.discountType,
                discountValue: input.discountValue,
                ...amounts,
                note: input.note ?? null,
                status: 'held',
                heldAt: now,
                operatorId: ctx.user.id,
                updatedAt: now,
              })
              .where(eq(schema.cashierBills.id, existing.id))
              .returning()
              .then((r) => r[0]!);
          } else {
            const billNo = await genBillNo(txDb(tx), storeId, now);
            bill = await tx
              .insert(schema.cashierBills)
              .values({
                billNo,
                storeId,
                status: 'held',
                customerId,
                discountType: input.discountType,
                discountValue: input.discountValue,
                ...amounts,
                note: input.note ?? null,
                createdBy: ctx.user.id,
                // M1-补1：operator_id 与 created_by 同源起步（M2 班次启用后分叉）
                operatorId: ctx.user.id,
                heldAt: now,
              })
              .returning()
              .then((r) => r[0]!);
          }
          await tx.insert(schema.cashierBillItems).values(
            resolved.map((it) => ({
              billId: bill.id,
              kind: it.kind,
              refId: it.refId,
              nameSnapshot: it.nameSnapshot,
              specSnapshot: it.specSnapshot,
              qty: it.qty,
              unitPriceFen: it.unitPriceFen,
              adjustedPriceFen: it.adjustedPriceFen,
              paidByPass: it.paidByPass,
              stockShort: false, // 库存留痕在 settle 扣减时判定
            })),
          );
          outboxId = await emitEvent(txDb(tx), `store:${storeId}`, EventType.CashierBillHeld, {
            billId: bill.id,
            billNo: bill.billNo,
            payableFen: bill.payableFen,
            itemCount: resolved.length,
          });
          return bill;
        });
        const snapshot = await billSnapshot(ctx.db, result);
        broadcastNow(outboxId);
        return { ...snapshot, idempotent: false };
      });
    }),

  /**
   * 4. resume（merchant 本店）：取单。held → open，返回整单快照（含会员/折扣/
   * 备注/行项），前端据此恢复购物车。open 单重复取 = 幂等返回快照；
   * settled/voided 不可取。
   */
  resume: merchantProcedure
    .input(z.object({ billNo: z.string().regex(BILL_NO_RE) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const bill = await ctx.db
        .select()
        .from(schema.cashierBills)
        .where(eq(schema.cashierBills.billNo, input.billNo))
        .get();
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: '挂单不存在' });
      if (bill.storeId !== storeId) forbidden('非本店单据，无权操作');
      if (bill.status === 'settled' || bill.status === 'voided') {
        badRequest(`当前状态（${bill.status}）不可取单`);
      }
      const wasHeld = bill.status === 'held';
      if (wasHeld) {
        await ctx.db
          .update(schema.cashierBills)
          .set({ status: 'open', updatedAt: new Date() })
          .where(eq(schema.cashierBills.id, bill.id));
        bill.status = 'open';
      }
      return { ...(await billSnapshot(ctx.db, bill)), idempotent: !wasHeld };
    }),

  /**
   * 5. settle（merchant 本店）★：结账事务（幂等键=bill_no，裁定③）。
   * 事务内顺序：幂等快路径（同 bill_no 已 settled → 直接返回快照，
   * 不重复扣次/扣库存/翻预约/写支付段）→ 行解析与金额重算 → Σ支付=应收
   * 校验 → 次卡扣次（pass 段=Σ扣次行有效价，扣次次数=扣次行数，余额不足
   * FORBIDDEN 如实；流水 appointment_id=NULL、note 带 bill_no；后续步骤
   * 失败整体回滚）→ 商品行库存 MAX(0,stock-qty)（扣前不足 → stockShort=true
   * 留痕不阻塞）→ 预约行翻转（markPaid 同内核：paidAt/paidFen=行有效价 +
   * appointment.paid 事件）→ 落/更新单 settled → 写 cashier_payments →
   * emit cashier.billSettled 同事务。
   * M1-补1：支付方式四分列（cash|wechat|alipay|pass），credit 已删——
   * settled 即全额已收（paid_fen=payable_fen），收银单无待收态。
   * 改价/折扣触发 owner 闸门（manager 提交 FORBIDDEN 如实）。
   */
  settle: merchantProcedure
    .input(cartSnapshotSchema.extend({ payments: z.array(paymentSegmentSchema).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      assertPriceEditAllowed(ctx, input);
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const now = new Date();

          /* ---- 幂等快路径：同 bill_no 已 settled → 返回现状，零副作用 ---- */
          let existing: BillRow | undefined;
          if (input.billNo) {
            existing = await tx
              .select()
              .from(schema.cashierBills)
              .where(eq(schema.cashierBills.billNo, input.billNo))
              .get();
            if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: '单号不存在' });
            if (existing.storeId !== storeId) forbidden('非本店单据，无权操作');
            if (existing.status === 'settled') {
              return { bill: existing, idempotent: true as const };
            }
            if (existing.status === 'voided') badRequest('该单已撤单，不可结账');
          }

          /* ---- 单号前置落定（幂等键 + 扣次流水 note 必须带真实 bill_no，裁定③） ---- */
          const billNo = input.billNo ?? (await genBillNo(txDb(tx), storeId, now));

          /* ---- 行解析 / 金额重算 / 支付校验 ---- */
          const resolved = await resolveItems(txDb(tx), storeId, input.items);
          const amounts = computeAmounts(resolved, input.discountType, input.discountValue);
          const customerId = input.customerId ?? existing?.customerId ?? null;
          const passLines = resolved.filter((r) => r.paidByPass);
          if (passLines.length > 0 && !customerId) {
            badRequest('散客单不能使用次卡扣次，请先检索会员');
          }
          const sumPay = input.payments.reduce((s, p) => s + p.amountFen, 0);
          if (sumPay !== amounts.payableFen) {
            badRequest(
              `支付合计（${(sumPay / 100).toFixed(2)} 元）须等于应收（${(amounts.payableFen / 100).toFixed(2)} 元）`,
            );
          }
          const passSegs = input.payments.filter((p) => p.method === 'pass');
          if (passSegs.length > 1) badRequest('次卡扣次段至多一段（客户×门店唯一卡）');
          const passAmount = passLines.reduce((s, r) => s + effPrice(r) * r.qty, 0);
          if (passLines.length > 0) {
            if (passSegs.length !== 1) badRequest('含次卡扣次行时须含一段 pass 支付');
            if (passSegs[0]!.amountFen !== passAmount) {
              badRequest('次卡支付段金额须等于扣次行有效价合计');
            }
          } else if (passSegs.length === 1) {
            badRequest('无扣次行却存在次卡支付段：请先对服务行标记「扣次」');
          }

          /* ---- 次卡扣次（先于后续写库；失败整体回滚） ---- */
          let passRow: PassRow | null = null;
          if (passSegs.length === 1) {
            passRow =
              (passSegs[0]!.passId
                ? await tx
                    .select()
                    .from(schema.memberPasses)
                    .where(eq(schema.memberPasses.id, passSegs[0]!.passId!))
                    .get()
                : await tx
                    .select()
                    .from(schema.memberPasses)
                    .where(
                      and(
                        eq(schema.memberPasses.userId, customerId!),
                        eq(schema.memberPasses.storeId, storeId),
                      ),
                    )
                    .get()) ?? null;
            if (!passRow || passRow.userId !== customerId || passRow.storeId !== storeId) {
              badRequest('该会员在本店无次卡');
            }
            if (passRow.status !== 'active') badRequest('次卡已停用');
            if (passRow.expiresAt !== null && passRow.expiresAt.getTime() <= now.getTime()) {
              badRequest('次卡已过期');
            }
            const need = passLines.length; // 1 行 = 扣 1 次
            if (passRow.remainTimes < need) {
              // 裁定：余额不足 FORBIDDEN 如实（按钮禁用+原因行的服务端对应）
              forbidden(`次卡余额不足：剩余 ${passRow.remainTimes} 次，本单需扣 ${need} 次`);
            }
            await tx
              .update(schema.memberPasses)
              .set({ remainTimes: passRow.remainTimes - need, updatedAt: now })
              .where(eq(schema.memberPasses.id, passRow.id));
            // 扣次流水：appointment_id=NULL（裁定③，收银扣次不挂预约单）、note 带 bill_no
            await tx.insert(schema.passDeductLogs).values(
              passLines.map(() => ({
                passId: passRow!.id,
                appointmentId: null,
                delta: -1,
                note: `收银台结账 ${billNo}`,
              })),
            );
          }

          /* ---- 商品行库存扣减（不足不阻塞，stockShort 留痕） ---- */
          const stockShortByRef = new Map<string, boolean>();
          for (const it of resolved) {
            if (it.kind !== 'product' || !it.product) continue;
            // 事务内重读库存（串行锁下即最新）；扣前 stock<qty → 留痕
            const fresh = await tx
              .select({ stock: schema.products.stock })
              .from(schema.products)
              .where(eq(schema.products.id, it.refId))
              .get();
            const short = (fresh?.stock ?? 0) < it.qty;
            stockShortByRef.set(it.refId, short);
            await tx
              .update(schema.products)
              .set({ stock: sql`MAX(0, ${schema.products.stock} - ${it.qty})`, updatedAt: now })
              .where(eq(schema.products.id, it.refId));
          }

          /* ---- 预约行翻转（markPaid 事务内核：completed 且未 paid →
             paidAt/paidFen + appointment.paid；预约财务口径只此一翻） ---- */
          for (const it of resolved) {
            if (it.kind !== 'appointment' || !it.appointment) continue;
            const freshAppt = await tx
              .select()
              .from(schema.appointments)
              .where(eq(schema.appointments.id, it.refId))
              .get();
            if (!freshAppt) badRequest('预约不存在');
            if (freshAppt.status !== 'completed') {
              badRequest(`预约当前状态（${freshAppt.status}）不可收款，仅 completed 可收款登记`);
            }
            if (freshAppt.paidAt) badRequest('该预约已登记收款，不可重复结账');
            const paidFen = effPrice(it); // 预约行改价时按有效价登记
            await tx
              .update(schema.appointments)
              .set({ paidAt: now, paidFen, updatedAt: now })
              .where(eq(schema.appointments.id, freshAppt.id));
            outboxIds.push(
              await emitEvent(txDb(tx), `store:${storeId}`, EventType.AppointmentPaid, {
                appointmentId: freshAppt.id,
                petName: it.appointmentPetName,
                paidFen,
                by: 'cashier',
                billNo,
              }),
            );
          }

          /* ---- 落/更新单 → settled ---- */
          let bill: BillRow;
          const billFields = {
            customerId,
            discountType: input.discountType,
            discountValue: input.discountValue,
            ...amounts,
            note: input.note ?? null,
            status: 'settled' as const,
            settledAt: now,
            // M1-补1：Σ支付=应收才放行（上面已校验），settled 即全额已收
            paidFen: amounts.payableFen,
            // M1-补1 审计链：operator_id = 结账操作人（与 created_by 同源起步）
            operatorId: ctx.user.id,
          };
          if (existing) {
            await tx
              .delete(schema.cashierBillItems)
              .where(eq(schema.cashierBillItems.billId, existing.id));
            bill = await tx
              .update(schema.cashierBills)
              .set({ ...billFields, updatedAt: now })
              .where(eq(schema.cashierBills.id, existing.id))
              .returning()
              .then((r) => r[0]!);
          } else {
            bill = await tx
              .insert(schema.cashierBills)
              .values({
                billNo,
                storeId,
                ...billFields,
                createdBy: ctx.user.id,
              })
              .returning()
              .then((r) => r[0]!);
          }
          await tx.insert(schema.cashierBillItems).values(
            resolved.map((it) => ({
              billId: bill.id,
              kind: it.kind,
              refId: it.refId,
              nameSnapshot: it.nameSnapshot,
              specSnapshot: it.specSnapshot,
              qty: it.qty,
              unitPriceFen: it.unitPriceFen,
              adjustedPriceFen: it.adjustedPriceFen,
              paidByPass: it.paidByPass,
              stockShort: it.kind === 'product' ? (stockShortByRef.get(it.refId) ?? false) : false,
            })),
          );
          await tx.insert(schema.cashierPayments).values(
            input.payments.map((p) => ({
              billId: bill.id,
              method: p.method,
              amountFen: p.amountFen,
              passId: p.method === 'pass' ? (passRow?.id ?? null) : null,
            })),
          );
          outboxIds.push(
            await emitEvent(txDb(tx), `store:${storeId}`, EventType.CashierBillSettled, {
              billId: bill.id,
              billNo: bill.billNo,
              payableFen: bill.payableFen,
              paidFen: bill.paidFen,
              passFen: passSegs.reduce((s, p) => s + p.amountFen, 0),
              itemCount: resolved.length,
              hasStockShort: [...stockShortByRef.values()].some(Boolean),
            }),
          );
          return { bill, idempotent: false as const };
        });
        const snapshot = await billSnapshot(ctx.db, result.bill);
        outboxIds.forEach(broadcastNow);
        return { ...snapshot, idempotent: result.idempotent };
      });
    }),

  /**
   * 6. voidBill（merchant_owner 硬闸门，裁定①：撤单仅店主）：open/held →
   * voided 留痕（voidReason 选填），禁止物理删除；**settled 单明确报错不可撤**
   * （裁定③：回补属退款专项，本批冻结——不存在撤单回补路径）；voided 重复
   * 撤 = 幂等返回。emit cashier.billVoided。
   *
   * （M1-补1：原 collect 端点随「记账 credit」删除而废——收银单无待收态，
   * 死接口不留；「待收」回归预约域口径。）
   */
  voidBill: merchantOwnerProcedure
    .input(
      z.object({
        billNo: z.string().regex(BILL_NO_RE),
        reason: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        let outboxId = '';
        const result = await ctx.db.transaction(async (tx) => {
          const bill = await tx
            .select()
            .from(schema.cashierBills)
            .where(eq(schema.cashierBills.billNo, input.billNo))
            .get();
          if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: '单据不存在' });
          if (bill.storeId !== storeId) forbidden('非本店单据，无权操作');
          if (bill.status === 'voided') return { bill, idempotent: true as const }; // 幂等
          if (bill.status === 'settled') {
            // 裁定③：已结账单本批不可撤——扣次/库存/预约翻转的回补属退款专项（冻结）
            throw new TRPCError({
              code: 'CONFLICT',
              message: '已结账单不可撤单（退款专项冻结中，如需退费请走线下登记）',
            });
          }
          const now = new Date();
          const updated = await tx
            .update(schema.cashierBills)
            .set({
              status: 'voided',
              voidedAt: now,
              voidReason: input.reason ?? null,
              updatedAt: now,
            })
            .where(eq(schema.cashierBills.id, bill.id))
            .returning()
            .then((r) => r[0]!);
          outboxId = await emitEvent(txDb(tx), `store:${storeId}`, EventType.CashierBillVoided, {
            billId: updated.id,
            billNo: updated.billNo,
            reason: input.reason ?? null,
            fromStatus: bill.status,
          });
          return { bill: updated, idempotent: false as const };
        });
        const snapshot = await billSnapshot(ctx.db, result.bill);
        if (outboxId) broadcastNow(outboxId);
        return { ...snapshot, idempotent: result.idempotent };
      });
    }),

  /**
   * 8. listBills（merchant 本店）：流水屏数据源。倒序（创建时间），上限 100；
   * 过滤：status（open|held|settled|voided）/ range（today|d7|d30，today 按
   * 门店规范时区当日）/ buyer（会员昵称或手机号模糊；特殊值「散客」匹配
   * 无会员单）。行含 buyerName / itemCount / summary / passFen / methods。
   * M1-补1：收银单无待收态（credit 已删）——流水状态签只剩
   * 「已收薄荷 / 已撤单灰」（「待收」是预约域口径，不属于收银流水）。
   */
  listBills: merchantProcedure
    .input(
      z
        .object({
          status: z.enum(BILL_STATUSES).optional(),
          range: z.enum(['today', 'd7', 'd30']).optional(),
          buyer: z.string().trim().max(64).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const conds = [eq(schema.cashierBills.storeId, storeId)];
      if (input?.status) conds.push(eq(schema.cashierBills.status, input.status));
      if (input?.range) {
        const now = new Date();
        let since: Date;
        if (input.range === 'today') {
          const w = storeWallclock(now);
          since = new Date(storeDayStartMs(w.y, w.m, w.day));
        } else {
          since = new Date(now.getTime() - (input.range === 'd7' ? 7 : 30) * 24 * 3600 * 1000);
        }
        conds.push(gte(schema.cashierBills.createdAt, since));
      }
      if (input?.buyer) {
        if (input.buyer === '散客') {
          conds.push(isNull(schema.cashierBills.customerId));
        } else {
          const kw = `%${input.buyer}%`;
          const fuzzy = or(like(schema.users.nickname, kw), like(schema.users.phone, kw));
          if (fuzzy) conds.push(fuzzy);
        }
      }
      const rows = await ctx.db
        .select({ bill: schema.cashierBills, buyerName: schema.users.nickname })
        .from(schema.cashierBills)
        .leftJoin(schema.users, eq(schema.users.id, schema.cashierBills.customerId))
        .where(and(...conds))
        .orderBy(desc(schema.cashierBills.createdAt), desc(schema.cashierBills.id))
        .limit(100);
      if (rows.length === 0) return [];
      const billIds = rows.map((r) => r.bill.id);
      const [items, payments] = await Promise.all([
        ctx.db
          .select()
          .from(schema.cashierBillItems)
          .where(inArray(schema.cashierBillItems.billId, billIds)),
        ctx.db
          .select()
          .from(schema.cashierPayments)
          .where(inArray(schema.cashierPayments.billId, billIds)),
      ]);
      const itemsByBill = new Map<string, BillItemRow[]>();
      for (const it of items) {
        const arr = itemsByBill.get(it.billId) ?? [];
        arr.push(it);
        itemsByBill.set(it.billId, arr);
      }
      const paymentsByBill = new Map<string, PaymentRow[]>();
      for (const p of payments) {
        const arr = paymentsByBill.get(p.billId) ?? [];
        arr.push(p);
        paymentsByBill.set(p.billId, arr);
      }
      return rows.map(({ bill, buyerName }) => {
        const billItems = itemsByBill.get(bill.id) ?? [];
        const billPayments = paymentsByBill.get(bill.id) ?? [];
        const names = billItems.map((it) => it.nameSnapshot);
        const passFen = billPayments
          .filter((p) => p.method === 'pass')
          .reduce((s, p) => s + p.amountFen, 0);
        const methods: string[] = [];
        for (const p of billPayments) if (!methods.includes(p.method)) methods.push(p.method);
        return {
          ...bill,
          buyerName: buyerName ?? '散客',
          itemCount: billItems.length,
          summary:
            names.length <= 2
              ? names.join('、')
              : `${names.slice(0, 2).join('、')} 等 ${names.length} 项`,
          passFen,
          methods,
        };
      });
    }),

  /**
   * 9. getBill（merchant 本店）：单据详情（流水屏详情弹层数据源）——
   * 完整行项 + 支付明细 + 开单人名 + 挂/结/撤轨迹（heldAt/settledAt/
   * voidedAt/voidReason 随单返回）。
   */
  getBill: merchantProcedure
    .input(z.object({ billNo: z.string().regex(BILL_NO_RE) }))
    .query(async ({ ctx, input }) => {
      const bill = await ctx.db
        .select()
        .from(schema.cashierBills)
        .where(eq(schema.cashierBills.billNo, input.billNo))
        .get();
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: '单据不存在' });
      if (bill.storeId !== ctx.user.storeId) forbidden('非本店单据，无权查看');
      return billSnapshot(ctx.db, bill);
    }),
});

export type CashierRouter = typeof cashierRouter;
