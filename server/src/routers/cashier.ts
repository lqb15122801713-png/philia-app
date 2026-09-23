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
 * - 支付方式五分列（M1-补2 R5 起）：cash | wechat | alipay | pass | stored_value
 *   （「扫码」拆微信/支付宝；stored_value=存量储值消费，M1-补2 启用——仅消费、
 *   无充值入口，账户仅经 R5b CSV 导入批次建立）；
 *   「记账 credit」已删除（挂账缓做，运营口径在案）——Σ支付=应收才放行，
 *   settled 即全额已收（paid_fen = payable_fen），收银单无待收态。
 *   连带删除：collect 端点 / cashier.billCollected 事件（无触发点，删干净）。
 * - 改价/折扣闸门（M1-补2 R2 · 补丁①+矩阵会签稿）：行改价（adjustedPriceFen）或
 *   单级优惠（discountType≠none）仅 owner|manager——hold/settle 路由内
 *   assertMerchantManager 硬校验（M1 原 owner-only，补丁①放宽一档至 manager；
 *   merchantManagerProcedure 不能复用于整路由，因开单/挂单/结账本体对 clerk 开放）。
 *   voidBill 整端点走 merchantProcedure（补丁①作废 M1 的 owner-only：撤单三级全开，
 *   边界仍锁「仅未支付单」——settled 单 CONFLICT 不变，已支付单走反结账，S1b 另批）。
 *   clerk 越权一律 FORBIDDEN 如实文案。
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
  assertMerchantManager,
  merchantManagerProcedure,
  merchantOwnerProcedure,
  merchantProcedure,
  router,
} from '../trpc';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { storeDayStartMs, storeWallclock } from './appointment';
// R11a 会员前置批：回馈金账本内核（抵扣/计提）+ 会员档位服务折扣读侧
import {
  deductRebate,
  grantOnProductSettled,
  memberPlanFor,
  planNum as memberPlanNum,
} from '../services/rebate';

/* ------------------------------------------------------------------ */
/* 常量与类型                                                            */
/* ------------------------------------------------------------------ */

/** 收银单状态取值（schema text 列的应用层枚举，五态冻结） */
const BILL_STATUSES = ['open', 'held', 'settled', 'voided'] as const;

/** 行类型 / 支付方式 / 优惠类型枚举 */
const ITEM_KINDS = ['service', 'product', 'appointment'] as const;
/**
 * 支付方式五分列（M1-补2 R5）：cash 现金 | wechat 微信 | alipay 支付宝 |
 * pass 次卡扣次 | stored_value 存量储值消费。「记账 credit」已删除（挂账缓做，运营口径在案）。
 * stored_value 本批正式启用（裁定①③：仅存量消费，余额不足可混搭，储值消费不计入
 * 已收、参考列单列）；**全域无充值/新售入口**（新售冻结不变，回归保护——本文件
 * 不出现任何储值充值端点，账户余额仅经 R5b CSV 导入批次建立）。
 * R11a 增第六段 rebate 回馈金抵扣（批次 R11a · 决策 #33+红线 2）：仅商品行可用
 * （服务/寄养行 server 硬校验 FORBIDDEN「回馈金仅可抵商品」），余额不足可混搭，
 * 不计已收（参考列同储值口径，computeDayTender rebateFen 单列），扣减留痕见
 * rebate_logs（前后余额+单号，services/rebate.ts deductRebate）。
 */
const PAYMENT_METHODS = ['cash', 'wechat', 'alipay', 'pass', 'stored_value', 'rebate'] as const;

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
 * R11a：导出供 membership.sell/renew 售卡/续费单用（同一单号序列）。
 */
export async function genBillNo(d: DbHandle, storeId: string, now: Date): Promise<string> {
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

/** 支付段入参（settle：五分列+回馈金段可组合；stored_value=存量储值消费（M1-补2 R5）与
 *  rebate=回馈金抵扣（R11a，仅商品行可用——红线 2，硬校验在 settle）均须绑会员） */
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

/**
 * 改价/折扣闸门（M1-补2 R2 · 补丁①+矩阵会签稿；R11a 补丁②修订）：行改价或单级优惠
 * 非 none 时硬校验 owner|manager（M1 原 owner-only 放宽一档至 manager；clerk 越权
 * FORBIDDEN 如实）。留痕不变：operator_id = 操作人，事件带 by。
 *
 * R11a 补丁②（收银台 UI 复核真缺口）：**系统折扣 ≠ 人工改价**——会员服务折扣由
 * applyMemberServiceDiscount 落 adjusted=round(门市价×service_discount_bp/10000)，
 * 挂单/取单回显后随购物车快照回传；若一刀切视为人工改价，clerk 会员折扣单结账被
 * 闸门误拦（传 adjusted=null 又与前端应收口径打架）。最小可靠判据：
 * 账单带会员（customerId 已按 resolveBillCustomerId 口径解析）+ 该行为服务/预约行 +
 * input.adjustedPriceFen 精确等于 round(该行门市价×当前会员档 bp/10000)
 * → 视为系统折扣回显，不触发闸门；不等值/散客单/商品行一律按人工改价走原闸。
 * （判据局限写死：人工改价恰好等于公式值时无法区分，按系统折扣放行——可接受，
 *  改价留痕仍落 adjustedPriceFen 行快照。）
 */
async function assertPriceEditAllowed(
  ctx: Parameters<typeof assertMerchantManager>[0],
  d: DbHandle,
  input: {
    items: Array<{ adjustedPriceFen?: number | null }>;
    discountType: string;
  },
  resolved: ResolvedItem[],
  customerId: string | null,
): Promise<void> {
  const hasAdjusted = input.items.some((it) => it.adjustedPriceFen != null);
  if (!hasAdjusted && input.discountType === 'none') return; // 快路径：无改价无优惠
  /* 当前识别会员档折扣 bp（无会员/微光=10000，公式恒等于门市价故天然不匹配改价） */
  let memberBp = 10000;
  if (customerId) {
    const mp = await memberPlanFor(d, customerId);
    if (mp) memberBp = memberPlanNum(mp.plan, 'service_discount_bp', 10000);
  }
  const hasManualAdjust = input.items.some((it, i) => {
    if (it.adjustedPriceFen == null) return false;
    const r = resolved[i]; // resolveItems 按 input 顺序逐行解析，下标一一对应
    if (
      memberBp < 10000 &&
      r &&
      (r.kind === 'service' || r.kind === 'appointment') &&
      it.adjustedPriceFen === Math.round((r.unitPriceFen * memberBp) / 10000)
    ) {
      return false; // R11a 补丁②：系统折扣回显，非人工改价
    }
    return true;
  });
  if (hasManualAdjust || input.discountType !== 'none') assertMerchantManager(ctx);
}

/** 次卡当前可用（口径同 pass.ts passUsable）：active + 有余量 + 未过期 */
function passUsable(p: PassRow): boolean {
  return (
    p.status === 'active' &&
    p.remainTimes > 0 &&
    (p.expiresAt === null || p.expiresAt.getTime() > Date.now())
  );
}

/**
 * 会员归属解析（fix：收银单买家名缺失；散客混单口径在案）：
 * - 显式传 customerId 字符串 → 该会员；
 * - 显式传 null → **确认散客，不回填**（前端显式选择散客的语义保持不变）；
 * - 字段缺省（undefined = 未选会员）→ 单含预约行时回填首行预约的客户
 *   （「待收款拉入 → 结账」链路天然带会员归属，避免流水买家名丢失；
 *   一单多预约行取首行，它们必然同客户——pendingAppointments 按单拉入）；
 * - settle 对既有单（取单/再挂轨迹）缺省时先沿用单上已有 customerId。
 */
function resolveBillCustomerId(
  inputCustomerId: string | null | undefined,
  resolved: ResolvedItem[],
  existingCustomerId?: string | null,
): string | null {
  if (typeof inputCustomerId === 'string') return inputCustomerId;
  if (inputCustomerId === null) return null; // 显式散客
  if (existingCustomerId) return existingCustomerId;
  const apptLine = resolved.find((r) => r.kind === 'appointment' && r.appointment);
  return apptLine?.appointment?.customerId ?? null;
}

/**
 * staff-2 R9-C 接待人归属（默认=开单人，预约核销改挂优先）：
 * 单含预约行时 receptionist_id 取该预约的 receptionist_id（核销改挂落点，0012 新增列）；
 * 无预约行或预约未指定 → 开单人（operator 同源起步，同 resolveBillCustomerId 首行口径）。
 */
function resolveReceptionistId(operatorUserId: string, resolved: ResolvedItem[]): string {
  const apptLine = resolved.find((r) => r.kind === 'appointment' && r.appointment);
  return apptLine?.appointment?.receptionistId ?? operatorUserId;
}

/**
 * R11a 会员服务折扣（任务书 §四.3 · 红线 6 全员同价：商品无会员价，折扣仅限服务）：
 * 识别会员（active 付费档）后服务/预约行自动按档折扣——adjusted=门市价×
 * service_discount_bp/10000 精确到分（unit_price_fen 不动=门市价划线对照）；
 * 行已被人工改价（adjustedPriceFen 非空，owner|manager 闸门动作）时不覆盖；
 * 未识别/散客/微光（bp=10000）=门市价原价。hold/settle 在 computeAmounts 前调用。
 */
async function applyMemberServiceDiscount(
  d: DbHandle,
  customerId: string | null,
  resolved: ResolvedItem[],
): Promise<void> {
  if (!customerId) return;
  const mp = await memberPlanFor(d, customerId);
  if (!mp) return;
  const bp = memberPlanNum(mp.plan, 'service_discount_bp', 10000);
  if (bp >= 10000) return; // 微光无折扣（红线 7）
  for (const it of resolved) {
    if (it.kind !== 'service' && it.kind !== 'appointment') continue; // 商品行全员同价，不打折
    if (it.adjustedPriceFen != null) continue; // 人工改价优先（改价留痕语义不覆盖）
    it.adjustedPriceFen = Math.round((it.unitPriceFen * bp) / 10000);
  }
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
 * - 钱口径（fix：receivedFen 重复计次卡段修订）：「已收」= 现金类
 *   （cash/wechat/alipay）实收，**不含次卡扣次等值**——pass 段的认领额
 *   不进 recognized 的 serviceFen/shopFen（避免 settled 单 paidFen=payableFen
 *   口径下与 passFen 双计），只在 recognized.passFen 单列（对齐 U3 财务
 *   「次卡扣次非现金」口径，供对账溯源）；pass 段仍照常推进服务/商品归属
 *   簿记（svcCovered），保证后续现金类段不被重复归到服务桶。
 */
export interface CashierRecognizedEntry {
  at: Date;
  serviceFen: number;
  shopFen: number;
  /** 次卡扣次等值（非现金，单列对账；不进 serviceFen/shopFen/todayRevenueFen） */
  passFen: number;
  /** 储值消费额（M1-补2 R5；非现金，单列对账，永不计入已收——裁定①同次卡口径） */
  storedValueFen: number;
  /** 回馈金抵扣额（R11a；非现金，单列对账，永不计入已收——三本账物理分离，同储值口径） */
  rebateFen: number;
}

export interface CashierBillFinanceView {
  bill: BillRow;
  buyerName: string;
  itemCount: number;
  /** 行摘要（流水表「内容摘要」列）：前 2 行名 + 等 N 项 */
  summary: string;
  /** 支付方式去重列表（流水表「支付方式签」，五分列 cash|wechat|alipay|pass|stored_value） */
  methods: string[];
  /** 次卡扣次合计（分，method='pass' 段；非现金，单列供对账） */
  passFen: number;
  /** 储值消费合计（分，method='stored_value' 段；非现金，单列供对账） */
  storedValueFen: number;
  /** 回馈金抵扣合计（分，method='rebate' 段；R11a，非现金，单列供对账，永不计入已收） */
  rebateFen: number;
  /** 现金类实收（分）= Σ cash/wechat/alipay 段（「已收」口径，不含次卡等值与储值消费） */
  cashLikeFen: number;
  ownPayableFen: number;
  ownReceivedFen: number;
  recognized: CashierRecognizedEntry[];
}

/**
 * 载入本店全部已结账单的财务切片（v1 数据量级一次取全量，口径同
 * store.dashboardStats 注释「本店预约一次取出在应用层聚合」）。
 * M1-补2 R3b：被反结账冲正的原单（reversed_at 非空）不进任何收入聚合——
 * 财务口径随冲正自动回补（与 computeDayTender 同一排除口径）。
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
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        eq(schema.cashierBills.status, 'settled'),
        isNull(schema.cashierBills.reversedAt),
      ),
    );
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
    let storedValueFen = 0;
    let rebateFen = 0; // R11a：回馈金抵扣段（非现金单列，同储值口径）
    let cashLikeFen = 0;
    const methods: string[] = [];
    for (const p of billPayments) {
      if (!methods.includes(p.method)) methods.push(p.method);
      // M1-补1 前本地验证数据的历史 credit 段：跳过不认领，仅留痕（credit 已废）
      if (p.method === 'credit') continue;
      const ownPart = Math.min(p.amountFen, ownPayableFen - covered);
      if (ownPart <= 0) continue;
      const svcPart = Math.min(ownPart, serviceNet - svcCovered);
      svcCovered += svcPart;
      covered += ownPart;
      if (p.method === 'pass') {
        // 次卡扣次等值：非现金，单列 passFen 供对账，不进 serviceFen/shopFen
        // （fix：settled 单 paidFen=payableFen 口径下防双计）
        passFen += ownPart;
        recognized.push({ at: p.createdAt, serviceFen: 0, shopFen: 0, passFen: ownPart, storedValueFen: 0, rebateFen: 0 });
      } else if (p.method === 'stored_value') {
        // M1-补2 R5：储值消费非现金（裁定①同次卡口径），单列 storedValueFen 供对账；
        // 仍推进服务/商品归属簿记，保证后续现金类段不被重复归桶
        storedValueFen += ownPart;
        recognized.push({ at: p.createdAt, serviceFen: 0, shopFen: 0, passFen: 0, storedValueFen: ownPart, rebateFen: 0 });
      } else if (p.method === 'rebate') {
        // R11a：回馈金抵扣非现金（三本账物理分离，红线 1），单列 rebateFen 供对账；
        // 仍推进服务/商品归属簿记（rebate 段仅覆盖商品行——settle 硬校验）
        rebateFen += ownPart;
        recognized.push({ at: p.createdAt, serviceFen: 0, shopFen: 0, passFen: 0, storedValueFen: 0, rebateFen: ownPart });
      } else {
        cashLikeFen += p.amountFen;
        recognized.push({
          at: p.createdAt,
          serviceFen: svcPart,
          shopFen: ownPart - svcPart,
          passFen: 0,
          storedValueFen: 0,
          rebateFen: 0,
        });
      }
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
      storedValueFen,
      rebateFen,
      cashLikeFen,
      ownPayableFen,
      ownReceivedFen: covered,
      recognized,
    };
  });
}

/* ------------------------------------------------------------------ */
/* R1 统一聚合出口（M1-补2 · 账目口径统一 · 裁定①，决策 #33 回馈金列位预留）   */
/* ------------------------------------------------------------------ */

/**
 * 单日「已收」聚合（三处同数同源的唯一出口：经营总览 dashboardStats /
 * 收银台头部 / 财务页头部 一律经 store.todayTenderStats 或内嵌 todayTender 块取数，
 * 禁止各页自算）：
 * - 「已收」唯一定义 = Σ 支付段现金类（cash+wechat+alipay，按支付段 createdAt 落日，
 *   与 financeStats 认领口径同帧）；**次卡扣次 pass、储值消费 stored_value 永不计入**，
 *   作参考列单列（裁定①）；**回馈金 rebateFen 列位预留**（决策 #33：三本账物理分离，
 *   会员批启用，本批恒 0 不实现——避免届时聚合返工）。
 * - 收银单支付段携全单金额（含预约行），按 method 分列最准；经收银台翻转的预约
 *   金额已在段内，预约域不再重复认领（禁止双头记账，同 loadCashierFinance 头注）。
 * - 未经收银台的预约到店付直收（appointment.markPaid，无支付段）：pay_at_store/NULL
 *   按历史缺省口径并入 cash 列（与 financeStats paymentSplit.payAtStore 同桶），
 *   金额另列 legacyPayAtStoreFen 供对账；pass_deduct 进 passFen 参考列（不计已收）。
 * - 笔数 = 合并流水行数（收银 settled 单数 + 未经收银台的预约收款笔数），消除
 *   「头部取预约域笔数、列表是合并视图」的 264 错数矛盾（修订单 R1③）。
 * - voided 单零聚合：支付段仅在 settle 事务写入，撤单（open/held→voided）本无
 *   支付段；且段查询强制 bill.status='settled'——双保险（修订单 R1④ 回归保护）。
 */
export interface DayTenderStats {
  /** 统计日 0 点（门店规范时区 +8，与 bill_no/财务 byDay 日界同帧） */
  date: Date;
  tender: {
    cashFen: number;
    wechatFen: number;
    alipayFen: number;
    /** 次卡扣次等值（参考列，永不计入已收）：收银 pass 段 + 预约域 pass_deduct 直收 */
    passFen: number;
    /** 储值消费（参考列，永不计入已收）：stored_value 段现禁用恒 0，R5 启用后接管 */
    storedValueFen: number;
    /** 回馈金抵扣段（参考列，永不计入已收——三本账物理分离）：R11a 起实额接管（原列位预留恒 0） */
    rebateFen: number;
  };
  /** 已收合计（分）= cashFen + wechatFen + alipayFen（分列可加总核对） */
  receivedTotalFen: number;
  /** 参考列合计（分）= passFen + storedValueFen + rebateFen（R11a 回馈金抵扣段并入）；不进已收 */
  referenceTotalFen: number;
  /** 其中未经收银台的预约到店付直收额（已并入 cash 列；单列供对账溯源） */
  legacyPayAtStoreFen: number;
  counts: {
    /** 当日 settled 收银单数（按 settledAt） */
    cashierPaidCount: number;
    /** 当日未经收银台的预约收款笔数（按 paidAt；经收银台翻转的预约已含在单内不重复计） */
    appointmentPaidCount: number;
    /** 合并流水行数 = cashierPaidCount + appointmentPaidCount（财务页笔数口径） */
    paidCount: number;
  };
}

export async function computeDayTender(
  d: DbHandle,
  storeId: string,
  dayStart: Date,
): Promise<DayTenderStats> {
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

  /* ---- 收银支付段分列（仅 settled 且未被反结账冲正的单——M1-补2 R3b：
     被冲正原单（reversed_at 非空）与冲正单（status='reversal' 天然非 settled）
     一律不进收入聚合；voided 双保险排除；credit 历史段跳过不认领） ---- */
  const segments = await d
    .select({ method: schema.cashierPayments.method, amountFen: schema.cashierPayments.amountFen })
    .from(schema.cashierPayments)
    .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.cashierPayments.billId))
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        eq(schema.cashierBills.status, 'settled'),
        isNull(schema.cashierBills.reversedAt),
        gte(schema.cashierPayments.createdAt, dayStart),
        lt(schema.cashierPayments.createdAt, dayEnd),
      ),
    );
  let cashFen = 0;
  let wechatFen = 0;
  let alipayFen = 0;
  let passFen = 0;
  let storedValueFen = 0;
  let rebateFen = 0; // R11a：回馈金抵扣段（参考列，永不计入已收——三本账物理分离）
  for (const s of segments) {
    if (s.method === 'cash') cashFen += s.amountFen;
    else if (s.method === 'wechat') wechatFen += s.amountFen;
    else if (s.method === 'alipay') alipayFen += s.amountFen;
    else if (s.method === 'pass') passFen += s.amountFen;
    else if (s.method === 'stored_value') storedValueFen += s.amountFen;
    else if (s.method === 'rebate') rebateFen += s.amountFen; // R11a（同储值口径，读侧排除已收）
    // 'credit'（M1-补1 前历史脏数据）：跳过不认领，仅留痕（同 loadCashierFinance 口径）
  }

  /* ---- 预约域：经收银台翻转的预约（金额已在支付段内）剔除后，直收部分入列 ---- */
  const cashierApptRows = await d
    .select({ refId: schema.cashierBillItems.refId })
    .from(schema.cashierBillItems)
    .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.cashierBillItems.billId))
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        eq(schema.cashierBillItems.kind, 'appointment'),
      ),
    );
  const viaCashier = new Set(cashierApptRows.map((r) => r.refId));

  const apptPaids = await d
    .select({
      id: schema.appointments.id,
      paidFen: schema.appointments.paidFen,
      priceFen: schema.appointments.priceFen,
      paymentMode: schema.appointments.paymentMode,
    })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.storeId, storeId),
        gte(schema.appointments.paidAt, dayStart),
        lt(schema.appointments.paidAt, dayEnd),
      ),
    );
  let legacyPayAtStoreFen = 0;
  let appointmentPaidCount = 0;
  for (const a of apptPaids) {
    if (viaCashier.has(a.id)) continue; // 经收银台翻转：金额已在支付段按 method 分列
    const fen = a.paidFen ?? a.priceFen;
    appointmentPaidCount += 1;
    if (a.paymentMode === 'pass_deduct') {
      passFen += fen; // 次卡扣次等值：参考列，不计已收（裁定①）
    } else {
      // markPaid 直收无支付段：按到店付历史缺省口径并入现金列，另列对账
      cashFen += fen;
      legacyPayAtStoreFen += fen;
    }
  }

  /* ---- 笔数：合并流水行数（收银 settled 单 + 预约域直收笔数） ---- */
  const billCountRow = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.cashierBills)
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        eq(schema.cashierBills.status, 'settled'),
        isNull(schema.cashierBills.reversedAt), // R3b：被冲正原单不计笔数
        gte(schema.cashierBills.settledAt, dayStart),
        lt(schema.cashierBills.settledAt, dayEnd),
      ),
    )
    .get();
  const cashierPaidCount = Number(billCountRow?.n ?? 0);

  return {
    date: dayStart,
    tender: {
      cashFen,
      wechatFen,
      alipayFen,
      passFen,
      storedValueFen,
      rebateFen, // R11a：回馈金抵扣段实额接管列位（原预留恒 0）
    },
    receivedTotalFen: cashFen + wechatFen + alipayFen,
    referenceTotalFen: passFen + storedValueFen + rebateFen,
    legacyPayAtStoreFen,
    counts: {
      cashierPaidCount,
      appointmentPaidCount,
      paidCount: cashierPaidCount + appointmentPaidCount,
    },
  };
}

/* ------------------------------------------------------------------ */
/* R3 班次 / 日结（M1-补2 · 修订单 R3 + 补丁①）                            */
/* ------------------------------------------------------------------ */

type ShiftRow = typeof schema.shifts.$inferSelect;
type DayCloseRow = typeof schema.dayCloses.$inferSelect;

/**
 * 当班班次（懒建开班口径）：本店当前 open 班次；无则创建（openedBy=当前写操作人）
 * 并 emit cashier.shiftOpened（同事务，由调用方 broadcast）。
 * 仅在收银写事务（hold/settle/reverseBill 创建单据时点）调用——读路径不建班，
 * clerk 无任何交接班端点入口（补丁①②），懒建保证 clerk 收银单也能挂当班 shift_id。
 * R11a：导出供 membership.sell/renew 售卡/续费单挂当班（日结口径一致）。
 */
export async function ensureOpenShift(
  d: DbHandle,
  storeId: string,
  operatorId: string,
  now: Date,
): Promise<{ shift: ShiftRow; openedOutboxId: string | null }> {
  const open = await d
    .select()
    .from(schema.shifts)
    .where(and(eq(schema.shifts.storeId, storeId), eq(schema.shifts.status, 'open')))
    .orderBy(desc(schema.shifts.openedAt))
    .limit(1)
    .then((r) => r[0]);
  if (open) return { shift: open, openedOutboxId: null };
  const shift = await d
    .insert(schema.shifts)
    .values({ storeId, openedBy: operatorId, openedAt: now, status: 'open' })
    .returning()
    .then((r) => r[0]!);
  const outboxId = await emitEvent(d, `store:${storeId}`, EventType.CashierShiftOpened, {
    shiftId: shift.id,
    openedBy: operatorId,
    lazy: true, // 懒建开班标记（首笔收银写触发，非交接班确认动作）
    by: operatorId,
  });
  return { shift, openedOutboxId: outboxId };
}

/**
 * 班次账面聚合（日结账面口径）：当班（bills.shift_id=班次）settled 且未被冲正单的
 * 支付段分列 Σ——与 computeDayTender 同一「已收=现金类」定义（裁定①）的班次切片；
 * pass/stored_value 参考列单列。口径注释：班次账=收银域支付段口径，预约域 markPaid
 * 直收（无支付段的历史通道）不进班次账——v1 收银收款全量经收银台。
 */
async function computeShiftTender(
  d: DbHandle,
  storeId: string,
  shiftId: string,
): Promise<{
  cashFen: number;
  wechatFen: number;
  alipayFen: number;
  passFen: number;
  storedValueFen: number;
  rebateFen: number; // R11a：回馈金抵扣段（参考列，同储值口径不进已收）
  receivedTotalFen: number;
  cashierPaidCount: number;
}> {
  const segments = await d
    .select({ method: schema.cashierPayments.method, amountFen: schema.cashierPayments.amountFen })
    .from(schema.cashierPayments)
    .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.cashierPayments.billId))
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        eq(schema.cashierBills.shiftId, shiftId),
        eq(schema.cashierBills.status, 'settled'),
        isNull(schema.cashierBills.reversedAt),
      ),
    );
  let cashFen = 0;
  let wechatFen = 0;
  let alipayFen = 0;
  let passFen = 0;
  let storedValueFen = 0;
  let rebateFen = 0; // R11a：回馈金抵扣段（参考列，永不计入已收）
  for (const s of segments) {
    if (s.method === 'cash') cashFen += s.amountFen;
    else if (s.method === 'wechat') wechatFen += s.amountFen;
    else if (s.method === 'alipay') alipayFen += s.amountFen;
    else if (s.method === 'pass') passFen += s.amountFen;
    else if (s.method === 'stored_value') storedValueFen += s.amountFen;
    else if (s.method === 'rebate') rebateFen += s.amountFen; // R11a
    // credit 历史段跳过不认领（同 computeDayTender 口径）
  }
  const countRow = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.cashierBills)
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        eq(schema.cashierBills.shiftId, shiftId),
        eq(schema.cashierBills.status, 'settled'),
        isNull(schema.cashierBills.reversedAt),
      ),
    )
    .get();
  const cashierPaidCount = Number(countRow?.n ?? 0);
  return {
    cashFen,
    wechatFen,
    alipayFen,
    passFen,
    storedValueFen,
    rebateFen,
    receivedTotalFen: cashFen + wechatFen + alipayFen,
    cashierPaidCount,
  };
}

/**
 * 日结预览/冻结同源聚合（M1-补2 条件② 全日口径裁定）：
 * - 总额=computeDayTender（全日、跨班次，与 todayTenderStats 同函数同值——
 *   预览=冻结同源，UI 只展示）；
 * - shiftBreakdown=当日班次逐班拆分（computeShiftTender，展示用；跨日仍开班的
 *   班次并入；无班次归属的存量单/预约直收不在拆分内，以全日总额为准）；
 * - existingFrozenCloseId：该自然日（bizDate）已有 frozen 日结单则带出
 *   （一日一结守卫的数据源）。
 */
export interface DayClosePreviewData {
  stats: DayTenderStats;
  bizDate: string;
  shiftBreakdown: Array<{
    shiftId: string;
    openedAt: Date;
    closedAt: Date | null;
    status: string;
    cashFen: number;
    wechatFen: number;
    alipayFen: number;
    passFen: number;
    storedValueFen: number;
    rebateFen: number; // R11a：回馈金抵扣段参考列（同储值口径不进已收）
    receivedTotalFen: number;
    cashierPaidCount: number;
  }>;
  existingFrozenCloseId: string | null;
}

async function computeDayClosePreview(
  d: DbHandle,
  storeId: string,
  dayStart: Date,
): Promise<DayClosePreviewData> {
  const stats = await computeDayTender(d, storeId, dayStart);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const w = storeWallclock(dayStart);
  const bizDate = `${w.y}-${pad2(w.m)}-${pad2(w.day)}`;
  const dayShifts = await d
    .select()
    .from(schema.shifts)
    .where(
      and(
        eq(schema.shifts.storeId, storeId),
        lt(schema.shifts.openedAt, dayEnd),
        // 当日内开班，或仍在开班的跨日班次（其当日收银单挂该班）
        or(gte(schema.shifts.openedAt, dayStart), eq(schema.shifts.status, 'open')),
      ),
    )
    .orderBy(schema.shifts.openedAt);
  const shiftBreakdown: DayClosePreviewData['shiftBreakdown'] = [];
  for (const s of dayShifts) {
    const t = await computeShiftTender(d, storeId, s.id);
    shiftBreakdown.push({
      shiftId: s.id,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      status: s.status,
      ...t,
    });
  }
  const frozen = await d
    .select({ id: schema.dayCloses.id })
    .from(schema.dayCloses)
    .where(
      and(
        eq(schema.dayCloses.storeId, storeId),
        eq(schema.dayCloses.bizDate, bizDate),
        eq(schema.dayCloses.kind, 'close'),
        eq(schema.dayCloses.status, 'frozen'),
      ),
    )
    .get();
  return { stats, bizDate, shiftBreakdown, existingFrozenCloseId: frozen?.id ?? null };
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
      // M1-补2 R5：收银识别可见储值余额（矩阵 clerk 口径：可见档位/余额/次卡，
      // 不可翻台账——此处仅余额数字，不含流水）
      const svAccount = await ctx.db
        .select()
        .from(schema.storedValueAccounts)
        .where(
          and(
            eq(schema.storedValueAccounts.userId, user.id),
            eq(schema.storedValueAccounts.storeId, storeId),
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
        /** M1-补2 R5：储值余额（分）= 本金 + 赠送；无账户=0 */
        storedValueBalanceFen: (svAccount?.principalFen ?? 0) + (svAccount?.bonusFen ?? 0),
        /** 其中本金（分） */
        storedValuePrincipalFen: svAccount?.principalFen ?? 0,
        /** 其中赠送（分） */
        storedValueBonusFen: svAccount?.bonusFen ?? 0,
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
        customerId: schema.appointments.customerId, // fix：收银台拉入后买家回填/会员条联动用
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
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const now = new Date();
          const resolved = await resolveItems(txDb(tx), storeId, input.items);

          /* ---- R11a：会员归属先于金额计算（服务折扣判定用）——带 billNo 时先取既有单校验 ---- */
          let existing: BillRow | undefined;
          if (input.billNo) {
            existing = await tx
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
          }
          // 会员归属：缺省沿用单上已有值，含预约行可回填（见 resolveBillCustomerId 注释）
          const customerId = resolveBillCustomerId(input.customerId, resolved, existing?.customerId);
          if (resolved.some((r) => r.paidByPass) && !customerId) {
            badRequest('散客单不能使用次卡扣次，请先检索会员');
          }
          /* R11a 补丁②：改价闸门移到归属解析后（事务内、任何写入前）——系统折扣回显不拦 clerk */
          await assertPriceEditAllowed(ctx, txDb(tx), input, resolved, customerId);
          // R11a：会员服务/预约行按档折扣（adjusted=门市价×bp，unit 不动划线对照；人工改价不覆盖）
          await applyMemberServiceDiscount(txDb(tx), customerId, resolved);
          const amounts = computeAmounts(resolved, input.discountType, input.discountValue);

          let bill: BillRow;
          if (existing) {
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
            // M1-补2 R3：创建时点挂当班 shift_id（无开班懒建；同号更新不改班次归属）
            const { shift, openedOutboxId } = await ensureOpenShift(txDb(tx), storeId, ctx.user.id, now);
            if (openedOutboxId) outboxIds.push(openedOutboxId);
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
                // staff-2 R9-C: 接待人默认=开单人；含预约行时优先取预约 receptionist_id（核销改挂落点）
                receptionistId: resolveReceptionistId(ctx.user.id, resolved),
                shiftId: shift.id,
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
          outboxIds.push(await emitEvent(txDb(tx), `store:${storeId}`, EventType.CashierBillHeld, {
            billId: bill.id,
            billNo: bill.billNo,
            payableFen: bill.payableFen,
            itemCount: resolved.length,
            by: ctx.user.id, // M1-补2 R2 总规则①：留痕含操作人
          }));
          return bill;
        });
        const snapshot = await billSnapshot(ctx.db, result);
        outboxIds.forEach(broadcastNow);
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
   * M1-补2：支付方式五分列（cash|wechat|alipay|pass|stored_value），credit 已删——
   * settled 即全额已收（paid_fen=payable_fen），收银单无待收态；储值段同事务扣减
   * （先本金后赠送，流水含前后余额+单号+操作人）；单据创建时点挂当班 shift_id（R3）。
   * 改价/折扣触发 owner 闸门（manager 提交 FORBIDDEN 如实）。
   */
  settle: merchantProcedure
    .input(cartSnapshotSchema.extend({ payments: z.array(paymentSegmentSchema).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
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

          /* ---- 行解析 / 会员归属 / 会员服务折扣（R11a） / 金额重算 / 支付校验 ---- */
          const resolved = await resolveItems(txDb(tx), storeId, input.items);
          // 会员归属：缺省沿用单上已有值 / 含预约行回填首行预约客户（显式 null=确认散客，
          // 见 resolveBillCustomerId 注释——「待收款拉入→结账」链路流水买家名不再丢失）
          // R11a：归属先于金额计算——服务折扣与 rebate 段校验均以 customerId 为前提
          const customerId = resolveBillCustomerId(input.customerId, resolved, existing?.customerId);
          /* R11a 补丁②：改价闸门移到归属解析后（幂等快路径之后、任何写入前）——
             系统折扣回显不拦 clerk；不等值改价/单级优惠仍拦（assertMerchantManager 原闸） */
          await assertPriceEditAllowed(ctx, txDb(tx), input, resolved, customerId);
          // R11a：会员服务/预约行按档折扣（adjusted=门市价×bp，unit 不动划线对照；人工改价不覆盖）
          await applyMemberServiceDiscount(txDb(tx), customerId, resolved);
          const amounts = computeAmounts(resolved, input.discountType, input.discountValue);
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
          // M1-补2 R5：储值段校验（至多一段；须绑会员——散客无储值账户）
          const svSegs = input.payments.filter((p) => p.method === 'stored_value');
          if (svSegs.length > 1) badRequest('储值支付段至多一段');
          if (svSegs.length === 1 && !customerId) {
            badRequest('散客单不能使用储值支付，请先检索会员');
          }
          // R11a：回馈金段校验（红线 2 server 硬校验——仅商品行可用，服务/寄养行禁用；
          // 至多一段；须绑会员——散客无回馈金账户；余额扣减前校验见 deductRebate）
          const rebateSegs = input.payments.filter((p) => p.method === 'rebate');
          if (rebateSegs.length > 1) badRequest('回馈金支付段至多一段');
          if (rebateSegs.length === 1 && !customerId) {
            badRequest('散客单不能使用回馈金支付，请先检索会员');
          }
          const rebateSegAmount = rebateSegs[0]?.amountFen ?? 0;
          if (rebateSegAmount > 0) {
            const effProductFen = resolved
              .filter((r) => r.kind === 'product')
              .reduce((s, r) => s + effPrice(r) * r.qty, 0);
            if (rebateSegAmount > effProductFen) {
              forbidden('回馈金仅可抵商品（服务/寄养行禁用回馈金支付段）');
            }
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

          /* ---- 储值扣减（M1-补2 R5：存量消费，裁定①③；失败整体回滚） ----
           * 余额=本金+赠送；扣减顺序先本金后赠送；余额不足 FORBIDDEN 如实；
           * 流水同事务：含前后余额 + 单号 + 操作人。储值消费不计入已收（聚合出口
           * storedValueFen 参考列）；全域无充值入口（账户仅经 R5b CSV 导入建立）。 */
          let svAccountDeducted: { accountId: string; before: number; after: number } | null = null;
          if (svSegs.length === 1) {
            const svAmount = svSegs[0]!.amountFen;
            const acc = await tx
              .select()
              .from(schema.storedValueAccounts)
              .where(
                and(
                  eq(schema.storedValueAccounts.userId, customerId!),
                  eq(schema.storedValueAccounts.storeId, storeId),
                ),
              )
              .get();
            if (!acc) {
              forbidden('该会员在本店无储值账户（存量储值余额须经台账导入，本店无充值入口）');
            }
            const before = acc.principalFen + acc.bonusFen;
            if (before < svAmount) {
              forbidden(
                `储值余额不足：余额 ${(before / 100).toFixed(2)} 元，本单需 ${(svAmount / 100).toFixed(2)} 元（可混搭现金/微信/支付宝补足）`,
              );
            }
            const dPrincipal = Math.min(acc.principalFen, svAmount); // 先本金
            const dBonus = svAmount - dPrincipal; // 后赠送
            await tx
              .update(schema.storedValueAccounts)
              .set({
                principalFen: acc.principalFen - dPrincipal,
                bonusFen: acc.bonusFen - dBonus,
                updatedAt: now,
              })
              .where(eq(schema.storedValueAccounts.id, acc.id));
            await tx.insert(schema.storedValueLogs).values({
              accountId: acc.id,
              userId: customerId!,
              storeId,
              deltaPrincipalFen: -dPrincipal,
              deltaBonusFen: -dBonus,
              deltaFen: -svAmount,
              balanceBeforeFen: before,
              balanceAfterFen: before - svAmount,
              billNo,
              operatorId: ctx.user.id,
              note: `收银台结账 ${billNo}`,
            });
            svAccountDeducted = { accountId: acc.id, before, after: before - svAmount };
          }

          /* ---- R11a 回馈金扣减（红线 2/三本账物理分离；失败整体回滚） ----
           * 仅已到账余额 1:1 扣（rebate_accounts.balance_fen，grant 统一次月到账不在其内）；
           * 前后余额+单号留痕（rebate_logs type='deduct'）；余额不足 deductRebate 兜底
           * FORBIDDEN 如实；不计已收（computeDayTender rebateFen 参考列单列，同储值口径）。 */
          let rebateDeducted: { beforeFen: number; afterFen: number } | null = null;
          if (rebateSegs.length === 1) {
            rebateDeducted = await deductRebate(txDb(tx), {
              userId: customerId!,
              billNo,
              amountFen: rebateSegAmount,
            });
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
            // staff-2 R8: 库存流水——按条件更新真实前后值落行（兜底扣到 0 时 afterStock=0、
            // delta=实际扣减量；stockShort 行为不变，同事务）
            const beforeStock = fresh?.stock ?? 0;
            const afterStock = Math.max(0, beforeStock - it.qty);
            await tx.insert(schema.stockMovements).values({
              storeId,
              productId: it.refId,
              sourceType: 'cashier',
              sourceId: billNo,
              delta: afterStock - beforeStock,
              beforeStock,
              afterStock,
              operatorId: ctx.user.id,
            });
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
                operatorId: ctx.user.id, // M1-补2 R2：by=来源签保留，操作人另列（审计链）
                billNo,
              }),
            );
          }

          /* ---- 落/更新单 → settled ---- */
          // M1-补2 R3：创建时点挂当班 shift_id（无开班懒建；既有单沿用原班次不改）
          const { shift, openedOutboxId } = await ensureOpenShift(txDb(tx), storeId, ctx.user.id, now);
          if (openedOutboxId) outboxIds.push(openedOutboxId);
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
                // staff-2 R9-C: 接待人默认=开单人；含预约行时优先取预约 receptionist_id（核销改挂落点）
                receptionistId: resolveReceptionistId(ctx.user.id, resolved),
                shiftId: shift.id, // M1-补2 R3：挂当班
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

          /* ---- R11a 商品行回馈金计提（结账成交时点，同事务；决策 #33 无月上限） ----
           * 基数=商品实收−rebate 抵扣段（用回馈金付的部分不再返）；商品实收口径同
           * loadCashierFinance：优惠先抵服务行，productNet=ownPayable−serviceNet。
           * 仅 active 付费档返（微光/散客/到期冻结=0 不写行）；grant 挂期次余额不动，
           * 统一次月到账（settleMonthly 入账）。 */
          let rebateGrantedFen = 0;
          if (customerId) {
            const effServiceFen = resolved
              .filter((r) => r.kind === 'service')
              .reduce((s, r) => s + effPrice(r) * r.qty, 0);
            const effApptFen = resolved
              .filter((r) => r.kind === 'appointment')
              .reduce((s, r) => s + effPrice(r) * r.qty, 0);
            const ownPayableFen = Math.max(0, amounts.payableFen - effApptFen);
            const serviceNetFen = Math.min(ownPayableFen, Math.max(0, effServiceFen - amounts.discountFen));
            const productRealFen = ownPayableFen - serviceNetFen;
            const grantBaseFen = Math.max(0, productRealFen - rebateSegAmount);
            const g = await grantOnProductSettled(txDb(tx), {
              userId: customerId,
              billNo,
              productFen: grantBaseFen,
              storeId,
            });
            rebateGrantedFen = g.grantedFen;
          }

          outboxIds.push(
            await emitEvent(txDb(tx), `store:${storeId}`, EventType.CashierBillSettled, {
              billId: bill.id,
              billNo: bill.billNo,
              payableFen: bill.payableFen,
              paidFen: bill.paidFen,
              passFen: passSegs.reduce((s, p) => s + p.amountFen, 0),
              storedValueFen: svSegs.reduce((s, p) => s + p.amountFen, 0), // M1-补2 R5
              storedValueBalanceAfterFen: svAccountDeducted?.after ?? null, // 扣减后余额留痕
              rebateFen: rebateSegAmount, // R11a：回馈金抵扣段（参考列，不计已收）
              rebateBalanceAfterFen: rebateDeducted?.afterFen ?? null, // 抵扣后余额留痕
              rebateGrantedFen, // R11a：本单商品行计提回馈金（次月到账，不进可用余额）
              itemCount: resolved.length,
              hasStockShort: [...stockShortByRef.values()].some(Boolean),
              by: ctx.user.id, // M1-补2 R2 总规则①：留痕含操作人
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
   * 6. voidBill（M1-补2 R2：merchantProcedure，撤单三级全开——补丁①作废 M1 的
   * owner-only；owner/manager/clerk 均可撤，矩阵边界不变「仅未支付单」）：open/held →
   * voided 留痕（voidReason 选填 + 事件带 by=操作人，审计链总规则①），禁止物理删除；
   * **settled 单明确报错不可撤**（文案保留不变；M1-补1「回补属退款专项冻结」已由
   * 补丁①3b 覆盖启用——已支付单冲正走 reverseBill 反结账单，仅店主，见下）；
   * voided 重复撤 = 幂等返回。emit cashier.billVoided。
   *
   * （M1-补1：原 collect 端点随「记账 credit」删除而废——收银单无待收态，
   * 死接口不留；「待收」回归预约域口径。）
   */
  voidBill: merchantProcedure
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
            // M1-补2 补丁①3b：已结账单冲正走 reverseBill（仅店主）；文案保留不变
            throw new TRPCError({
              code: 'CONFLICT',
              message: '已结账单不可撤单（退款专项冻结中，如需退费请走线下登记）',
            });
          }
          // M1-补2 R3b：冲正单（reversal）永驻流水，不可撤
          if (bill.status !== 'open' && bill.status !== 'held') {
            badRequest(`当前状态（${bill.status}）不可撤单`);
          }
          const now = new Date();
          const updated = await tx
            .update(schema.cashierBills)
            .set({
              status: 'voided',
              voidedAt: now,
              voidReason: input.reason ?? null,
              // M1-补2 R2 审计链：operator_id = 撤单操作人（三级全开后谁是经手人必须可追溯）
              operatorId: ctx.user.id,
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
            by: ctx.user.id, // M1-补2 R2 总规则①：动钱/改数动作留痕含操作人
          });
          return { bill: updated, idempotent: false as const };
        });
        const snapshot = await billSnapshot(ctx.db, result.bill);
        if (outboxId) broadcastNow(outboxId);
        return { ...snapshot, idempotent: result.idempotent };
      });
    }),

  /**
   * 7b. reverseBill（merchantOwnerProcedure 硬闸门 · M1-补2 补丁①3b：收银台
   * 反结账单=已支付单冲正，仅店主；强制填原因+关联原单号留痕）。
   * 与退款专项的区分（补充令②，冻结）：本端点是**店主冲正通道**——全单镜像
   * 回滚+留痕；它不是客户退款本体（本批无退款功能，任何「伪退款」写入端点
   * 禁止出现；店长/店员点退款=明文拦截零副作用，不落账不改状态不生成退款单）。
   * M1-补1「settled 回补属退款专项冻结」被补丁①3b 正式启用覆盖（仅此通道）。
   *
   * 事务内动作（失败整体回滚）：
   * - 原单：永存不涂改——仅置 reversed_at/reversed_by/reversal_bill_no 链接
   *   元数据（status 仍 settled；收入聚合经 reversed_at 排除，见
   *   computeDayTender/loadCashierFinance——反结账单不计当日已收）；
   * - 冲正单：独立行 status='reversal'、金额镜像负值、reversal_of_bill_no
   *   指原单、挂当前班次、永驻流水（双向可查）；
   * - 库存回补：商品行 stock += qty；
   * - 财务回补：预约行 paid_at/paid_fen 清零（预约回到待收款口径）；
   * - 次卡回补：按原扣次行数 +N 流水（note「反结账回补 {billNo}」）；
   * - 储值回补：按原消费日志镜像负负得正（前后余额留痕）。
   * 幂等：已冲正单重复冲正返回现状（idempotent=true）。emit cashier.billReversed。
   */
  reverseBill: merchantOwnerProcedure
    .input(
      z.object({
        billNo: z.string().regex(BILL_NO_RE),
        reason: z.string().trim().min(1, '反结账必须填写原因').max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const now = new Date();
          const bill = await tx
            .select()
            .from(schema.cashierBills)
            .where(eq(schema.cashierBills.billNo, input.billNo))
            .get();
          if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: '单据不存在' });
          if (bill.storeId !== storeId) forbidden('非本店单据，无权操作');
          if (bill.status !== 'settled') {
            badRequest(`当前状态（${bill.status}）不可反结账，仅已结账（settled）单可冲正`);
          }
          if (bill.reversedAt) {
            // 幂等：已冲正返回现状（附冲正单号）
            return { bill, reversalBillNo: bill.reversalBillNo, idempotent: true as const };
          }
          const items = await tx
            .select()
            .from(schema.cashierBillItems)
            .where(eq(schema.cashierBillItems.billId, bill.id));
          const payments = await tx
            .select()
            .from(schema.cashierPayments)
            .where(eq(schema.cashierPayments.billId, bill.id));

          /* ---- 库存回补（商品行 stock += qty） ---- */
          const restocked: Array<{ productId: string; qty: number }> = [];
          // staff-2 R8: 回补前后值暂存，冲正单号分配后统一落流水（见冲正单段落之后）
          const restockMoves: Array<{ productId: string; qty: number; beforeStock: number }> = [];
          for (const it of items) {
            if (it.kind !== 'product') continue;
            // staff-2 R8: 事务内重读库存取真实前值（串行锁下即最新）
            const fresh = await tx
              .select({ stock: schema.products.stock })
              .from(schema.products)
              .where(eq(schema.products.id, it.refId))
              .get();
            const beforeStock = fresh?.stock ?? 0;
            await tx
              .update(schema.products)
              .set({ stock: sql`${schema.products.stock} + ${it.qty}`, updatedAt: now })
              .where(eq(schema.products.id, it.refId));
            restocked.push({ productId: it.refId, qty: it.qty });
            restockMoves.push({ productId: it.refId, qty: it.qty, beforeStock });
          }

          /* ---- 预约回补（翻转回退：paidAt/paidFen 清零 → 回到待收款口径） ---- */
          const restoredAppointments: string[] = [];
          for (const it of items) {
            if (it.kind !== 'appointment') continue;
            await tx
              .update(schema.appointments)
              .set({ paidAt: null, paidFen: null, updatedAt: now })
              .where(eq(schema.appointments.id, it.refId));
            restoredAppointments.push(it.refId);
          }

          /* ---- 次卡回补（按原扣次行数 +N，流水 note 带原单号） ---- */
          const passLines = items.filter((i) => i.paidByPass);
          const passSeg = payments.find((p) => p.method === 'pass');
          let passTimesBack = 0;
          if (passSeg?.passId && passLines.length > 0) {
            const passRow = await tx
              .select()
              .from(schema.memberPasses)
              .where(eq(schema.memberPasses.id, passSeg.passId))
              .get();
            if (passRow) {
              passTimesBack = passLines.length;
              await tx
                .update(schema.memberPasses)
                .set({ remainTimes: passRow.remainTimes + passTimesBack, updatedAt: now })
                .where(eq(schema.memberPasses.id, passRow.id));
              await tx.insert(schema.passDeductLogs).values(
                passLines.map(() => ({
                  passId: passRow.id,
                  appointmentId: null,
                  delta: 1,
                  note: `反结账回补 ${bill.billNo}`,
                })),
              );
            }
          }

          /* ---- 储值回补（按原消费日志镜像：负负得正，前后余额留痕） ---- */
          let storedValueBackFen = 0;
          const consumeLogs = await tx
            .select()
            .from(schema.storedValueLogs)
            .where(
              and(
                eq(schema.storedValueLogs.billNo, bill.billNo),
                lt(schema.storedValueLogs.deltaFen, 0),
              ),
            );
          for (const log of consumeLogs) {
            const acc = await tx
              .select()
              .from(schema.storedValueAccounts)
              .where(eq(schema.storedValueAccounts.id, log.accountId))
              .get();
            if (!acc) continue;
            const backP = -log.deltaPrincipalFen;
            const backB = -log.deltaBonusFen;
            const before = acc.principalFen + acc.bonusFen;
            await tx
              .update(schema.storedValueAccounts)
              .set({
                principalFen: acc.principalFen + backP,
                bonusFen: acc.bonusFen + backB,
                updatedAt: now,
              })
              .where(eq(schema.storedValueAccounts.id, acc.id));
            await tx.insert(schema.storedValueLogs).values({
              accountId: acc.id,
              userId: acc.userId,
              storeId,
              deltaPrincipalFen: backP,
              deltaBonusFen: backB,
              deltaFen: backP + backB,
              balanceBeforeFen: before,
              balanceAfterFen: before + backP + backB,
              billNo: bill.billNo,
              operatorId: ctx.user.id,
              note: `反结账回补 ${bill.billNo}`,
            });
            storedValueBackFen += backP + backB;
          }

          /* ---- 冲正单（独立行，金额镜像负值，挂当前班次） ---- */
          const { shift, openedOutboxId } = await ensureOpenShift(txDb(tx), storeId, ctx.user.id, now);
          if (openedOutboxId) outboxIds.push(openedOutboxId);
          const reversalBillNo = await genBillNo(txDb(tx), storeId, now);
          await tx
            .insert(schema.cashierBills)
            .values({
              billNo: reversalBillNo,
              storeId,
              status: 'reversal',
              customerId: bill.customerId,
              discountType: bill.discountType,
              discountValue: bill.discountValue,
              subtotalFen: -bill.subtotalFen,
              discountFen: -bill.discountFen,
              payableFen: -bill.payableFen,
              paidFen: -bill.paidFen,
              note: `反结账冲正 ${bill.billNo}：${input.reason}`,
              reversalOfBillNo: bill.billNo,
              createdBy: ctx.user.id,
              operatorId: ctx.user.id,
              // staff-2 R9-C: 冲正单接待人镜像原单（金额镜像负值随原接待人对冲，不改挂到冲正操作人）
              receptionistId: bill.receptionistId ?? null,
              shiftId: shift.id,
            })
            .returning()
            .then((r) => r[0]!);

          // staff-2 R8: 反结账回补流水（sourceId=冲正单号，delta=+qty，前后值留痕）
          if (restockMoves.length > 0) {
            await tx.insert(schema.stockMovements).values(
              restockMoves.map((m) => ({
                storeId,
                productId: m.productId,
                sourceType: 'reversal',
                sourceId: reversalBillNo,
                delta: m.qty,
                beforeStock: m.beforeStock,
                afterStock: m.beforeStock + m.qty,
                operatorId: ctx.user.id,
                note: `反结账回补 ${bill.billNo}`,
              })),
            );
          }

          /* ---- 原单标记被冲正（永存不涂改，仅链接元数据） ---- */
          const updated = await tx
            .update(schema.cashierBills)
            .set({
              reversedAt: now,
              reversedBy: ctx.user.id,
              reversalBillNo,
              updatedAt: now,
            })
            .where(eq(schema.cashierBills.id, bill.id))
            .returning()
            .then((r) => r[0]!);

          outboxIds.push(
            await emitEvent(txDb(tx), `store:${storeId}`, EventType.CashierBillReversed, {
              billId: bill.id,
              billNo: bill.billNo,
              reversalBillNo,
              reason: input.reason,
              payableFen: bill.payableFen,
              restocked,
              restoredAppointments,
              passTimesBack,
              storedValueBackFen,
              by: ctx.user.id, // 总规则①：留痕含操作人
            }),
          );
          return { bill: updated, reversalBillNo, idempotent: false as const };
        });
        const snapshot = await billSnapshot(ctx.db, result.bill);
        outboxIds.forEach(broadcastNow);
        return { ...snapshot, reversalBillNo: result.reversalBillNo, idempotent: result.idempotent };
      });
    }),

  /* ------------------------------------------------------------------ */
  /* R3 交接班 / 日结（M1-补2）                                             */
  /* ------------------------------------------------------------------ */

  /**
   * 7c. currentShift（merchant 本店）：当前 open 班次（无则 null）。
   * 只含班次骨架（开班人/时间），不含营业额（店员不看营业额，总规则②）。
   */
  currentShift: merchantProcedure.query(async ({ ctx }) => {
    const shift = await ctx.db
      .select()
      .from(schema.shifts)
      .where(and(eq(schema.shifts.storeId, ctx.user.storeId!), eq(schema.shifts.status, 'open')))
      .orderBy(desc(schema.shifts.openedAt))
      .limit(1)
      .then((r) => r[0]);
    return { shift: shift ?? null };
  }),

  /**
   * 7d. closeShift（owner|manager · 补丁①②：交接班确认=店长/店主，clerk 无入口）：
   * 闭当前 open 班次（不含账目冻结——冻结走 dayClose）。闭班后下一笔收银写
   * 懒建下一班。emit cashier.shiftClosed。
   */
  closeShift: merchantManagerProcedure.mutation(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const shift = await ctx.db
      .select()
      .from(schema.shifts)
      .where(and(eq(schema.shifts.storeId, storeId), eq(schema.shifts.status, 'open')))
      .orderBy(desc(schema.shifts.openedAt))
      .limit(1)
      .then((r) => r[0]);
    if (!shift) badRequest('当前无开班班次');
    const now = new Date();
    const updated = await ctx.db
      .update(schema.shifts)
      .set({ status: 'closed', closedAt: now, closedBy: ctx.user.id, updatedAt: now })
      .where(eq(schema.shifts.id, shift.id))
      .returning()
      .then((r) => r[0]!);
    const outboxId = await emitEvent(ctx.db, `store:${storeId}`, EventType.CashierShiftClosed, {
      shiftId: shift.id,
      by: ctx.user.id,
    });
    broadcastNow(outboxId);
    return { shift: updated };
  }),

  /**
   * 7e0. dayClosePreview（owner|manager · M1-补2 条件②）：日结预览=冻结同源同值
   * （同一 computeDayClosePreview → computeDayTender 全日口径），UI 只展示不自算；
   * 附班次拆分展示与「本日是否已有冻结单」标记。
   */
  dayClosePreview: merchantManagerProcedure
    .input(z.object({ date: z.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const w = storeWallclock(input?.date ?? new Date());
      const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
      return computeDayClosePreview(ctx.db, ctx.user.storeId!, dayStart);
    }),

  /**
   * 7e. dayClose（owner|manager · 修订单 R3 + M1-补2 条件② 全日口径裁定）：
   * 日结=生成日结单并冻结**自然日全部支付段（跨班次）**。
   * - 账面现金=当日现金支付段 Σ（computeDayTender 全日，与 todayTenderStats/
   *   收银台头部/财务页头部同一聚合出口——预览与冻结同源同值，错账红线修复：
   *   原当班口径 computeShiftTender 冻结与全日预览劈叉已废）；
   *   实点现金手输；差异=实点−账面（红字数据源）；微信/支付宝/次卡等值/储值
   *   分列 + 笔数快照随单冻结；班次拆分明细存 snapshot_json.shiftBreakdown
   *   （展示用拆分，冻结数字以全日为准）。
   * - 一日一结：同一自然日（bizDate，+8）已有 frozen 日结单 → CONFLICT；
   *   反结账拆箱（原单 reversed）后同日可重新日结。
   * - shiftId 入参仅作兼容追溯记录（旧端拆箱重结传入）；记录列缺省=当前 open 班
   *   → 当日最近班 → 懒建即闭。日结即闭当前 open 班（交接班闭班不冻结，
   *   维持当班小结口径不变）。
   * emit cashier.dayClosed。
   */
  dayClose: merchantManagerProcedure
    .input(
      z.object({
        /** 兼容旧端（拆箱重结传入原班次）：仅作追溯记录，冻结口径=全日 */
        shiftId: z.string().min(1).optional(),
        /** 实点现金（分，手输） */
        actualCashFen: z.number().int().min(0).max(100_000_000),
        note: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const close = await ctx.db.transaction(async (tx) => {
          const now = new Date();
          const w = storeWallclock(now);
          const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
          const preview = await computeDayClosePreview(txDb(tx), storeId, dayStart);
          // 一日一结（条件②）：同自然日已有冻结单 → CONFLICT（拆箱后 reversed 才放行）
          if (preview.existingFrozenCloseId) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: '该自然日已有冻结的日结单（一日一结）；如需重新日结，请先由店主反结账拆箱',
            });
          }
          /* ---- 追溯用班次记录列（冻结口径与班次无关） ---- */
          let recordShift: ShiftRow | undefined;
          if (input.shiftId) {
            recordShift = await tx
              .select()
              .from(schema.shifts)
              .where(eq(schema.shifts.id, input.shiftId))
              .get();
            if (!recordShift || recordShift.storeId !== storeId) {
              throw new TRPCError({ code: 'NOT_FOUND', message: '班次不存在' });
            }
          }
          if (!recordShift) {
            recordShift = await tx
              .select()
              .from(schema.shifts)
              .where(and(eq(schema.shifts.storeId, storeId), eq(schema.shifts.status, 'open')))
              .orderBy(desc(schema.shifts.openedAt))
              .limit(1)
              .then((r) => r[0]);
          }
          if (!recordShift) {
            recordShift = await tx
              .select()
              .from(schema.shifts)
              .where(eq(schema.shifts.storeId, storeId))
              .orderBy(desc(schema.shifts.openedAt))
              .limit(1)
              .then((r) => r[0]);
          }
          if (!recordShift) {
            // 全日无任何班次（零收银日）：懒建即闭，保证 shift_id 追溯列非空
            const { shift, openedOutboxId } = await ensureOpenShift(txDb(tx), storeId, ctx.user.id, now);
            if (openedOutboxId) outboxIds.push(openedOutboxId);
            recordShift = shift;
          }
          const tender = preview.stats;
          const diffFen = input.actualCashFen - tender.tender.cashFen;
          const row = await tx
            .insert(schema.dayCloses)
            .values({
              storeId,
              shiftId: recordShift.id,
              kind: 'close',
              bizDate: preview.bizDate,
              bookCashFen: tender.tender.cashFen,
              actualCashFen: input.actualCashFen,
              diffFen,
              wechatFen: tender.tender.wechatFen,
              alipayFen: tender.tender.alipayFen,
              passFen: tender.tender.passFen,
              storedValueFen: tender.tender.storedValueFen,
              cashierPaidCount: tender.counts.cashierPaidCount,
              paidCount: tender.counts.paidCount,
              reason: input.note ?? null,
              // 条件②：全日口径标记 + 班次拆分展示明细（拆分不求和勾稽——无班次
              // 归属的存量单/预约直收以全日总额为准）
              snapshotJson: JSON.stringify({
                scope: 'full-day',
                note: '冻结=全日口径（computeDayTender 同源）；shiftBreakdown 为班次拆分展示',
                shiftBreakdown: preview.shiftBreakdown,
                legacyPayAtStoreFen: tender.legacyPayAtStoreFen,
              }),
              status: 'frozen',
              createdBy: ctx.user.id,
            })
            .returning()
            .then((r) => r[0]!);
          // 日结即闭当前 open 班（当班冻结废止后，闭班=交接班语义维持不冻结）
          const openShift = await tx
            .select()
            .from(schema.shifts)
            .where(and(eq(schema.shifts.storeId, storeId), eq(schema.shifts.status, 'open')))
            .orderBy(desc(schema.shifts.openedAt))
            .limit(1)
            .then((r) => r[0]);
          if (openShift) {
            await tx
              .update(schema.shifts)
              .set({ status: 'closed', closedAt: now, closedBy: ctx.user.id, updatedAt: now })
              .where(eq(schema.shifts.id, openShift.id));
          }
          outboxIds.push(
            await emitEvent(txDb(tx), `store:${storeId}`, EventType.CashierDayClosed, {
              closeId: row.id,
              shiftId: recordShift.id,
              bizDate: row.bizDate,
              scope: 'full-day', // 条件②：全日口径标记
              bookCashFen: row.bookCashFen,
              actualCashFen: row.actualCashFen,
              diffFen: row.diffFen,
              paidCount: row.paidCount,
              by: ctx.user.id,
            }),
          );
          return row;
        });
        outboxIds.forEach(broadcastNow);
        return { close };
      });
    }),

  /**
   * 7f. listDayCloses（owner|manager）：日结留痕可查——日结单 + 冲正关联单
   * 按创建倒序（双向可查：close 行 reversalId → 冲正单；reversal 行 refCloseId → 原单）。
   */
  listDayCloses: merchantManagerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ close: schema.dayCloses, createdByName: schema.users.nickname })
        .from(schema.dayCloses)
        .leftJoin(schema.users, eq(schema.users.id, schema.dayCloses.createdBy))
        .where(eq(schema.dayCloses.storeId, ctx.user.storeId!))
        .orderBy(desc(schema.dayCloses.createdAt), desc(schema.dayCloses.id))
        .limit(input?.limit ?? 50);
      return rows.map((r) => ({ ...r.close, createdByName: r.createdByName ?? null }));
    }),

  /**
   * 7g. reverseDayClose（仅店主 · 裁定④+补丁①3a：日结反结账=拆箱）：
   * 强制原因；原日结单永存不涂改（仅置 status='reversed' 与 reversed_at/reversed_by/
   * reversal_id 链接元数据）；冲正关联单独立行（ref_close_id 指原单，snapshot_json
   * 存前后值——M1-补2 条件②起为全日口径快照，含操作人/时间/原因）；之后可对**同日**
   * 重新日结（一日一结的 frozen 守卫放行）。emit cashier.dayCloseReversed。幂等：已 reversed 返回现状。
   */
  reverseDayClose: merchantOwnerProcedure
    .input(
      z.object({
        closeId: z.string().min(1),
        reason: z.string().trim().min(1, '反结账必须填写原因').max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        let outboxId = '';
        const result = await ctx.db.transaction(async (tx) => {
          const close = await tx
            .select()
            .from(schema.dayCloses)
            .where(eq(schema.dayCloses.id, input.closeId))
            .get();
          if (!close || close.storeId !== storeId || close.kind !== 'close') {
            throw new TRPCError({ code: 'NOT_FOUND', message: '日结单不存在' });
          }
          if (close.status === 'reversed') {
            return { close, reversal: null as DayCloseRow | null, idempotent: true as const };
          }
          const now = new Date();
          // 冲正关联单（独立行；金额列镜像原单冻结值，前后值快照含原状与冲正后语义）
          const reversal = await tx
            .insert(schema.dayCloses)
            .values({
              storeId,
              shiftId: close.shiftId,
              kind: 'reversal',
              refCloseId: close.id,
              bizDate: close.bizDate,
              bookCashFen: close.bookCashFen,
              actualCashFen: close.actualCashFen,
              diffFen: close.diffFen,
              wechatFen: close.wechatFen,
              alipayFen: close.alipayFen,
              passFen: close.passFen,
              storedValueFen: close.storedValueFen,
              cashierPaidCount: close.cashierPaidCount,
              paidCount: close.paidCount,
              reason: input.reason,
              snapshotJson: JSON.stringify({
                before: {
                  status: 'frozen',
                  bookCashFen: close.bookCashFen,
                  actualCashFen: close.actualCashFen,
                  diffFen: close.diffFen,
                  wechatFen: close.wechatFen,
                  alipayFen: close.alipayFen,
                  passFen: close.passFen,
                  storedValueFen: close.storedValueFen,
                  cashierPaidCount: close.cashierPaidCount,
                  paidCount: close.paidCount,
                },
                after: { status: 'reversed', note: '冲正后原班账目解冻，可对同班次重新日结' },
                operatorId: ctx.user.id,
                at: now.toISOString(),
                reason: input.reason,
              }),
              status: 'frozen',
              createdBy: ctx.user.id,
            })
            .returning()
            .then((r) => r[0]!);
          const updated = await tx
            .update(schema.dayCloses)
            .set({
              status: 'reversed',
              reversedAt: now,
              reversedBy: ctx.user.id,
              reversalId: reversal.id,
              updatedAt: now,
            })
            .where(eq(schema.dayCloses.id, close.id))
            .returning()
            .then((r) => r[0]!);
          outboxId = await emitEvent(txDb(tx), `store:${storeId}`, EventType.CashierDayCloseReversed, {
            closeId: close.id,
            reversalId: reversal.id,
            shiftId: close.shiftId,
            bizDate: close.bizDate,
            reason: input.reason,
            by: ctx.user.id,
          });
          return { close: updated, reversal, idempotent: false as const };
        });
        if (outboxId) broadcastNow(outboxId);
        return result;
      });
    }),

  /**
   * 7h. adjustDayClose（owner|manager · 修订单 R3⑤次日调整单留痕，最小实现）：
   * 日结差错调整备注——只增不改（adjustments_json 追加 {at, by, note}），
   * 原冻结数字不涂改；被冲正的单也可追加（差错留痕不受冻结状态限制）。
   */
  adjustDayClose: merchantManagerProcedure
    .input(
      z.object({
        closeId: z.string().min(1),
        note: z.string().trim().min(1, '调整备注不能为空').max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const close = await ctx.db
        .select()
        .from(schema.dayCloses)
        .where(eq(schema.dayCloses.id, input.closeId))
        .get();
      if (!close || close.storeId !== storeId || close.kind !== 'close') {
        throw new TRPCError({ code: 'NOT_FOUND', message: '日结单不存在' });
      }
      const list = close.adjustmentsJson
        ? (JSON.parse(close.adjustmentsJson) as Array<{ at: string; by: string; note: string }>)
        : [];
      list.push({ at: new Date().toISOString(), by: ctx.user.id, note: input.note });
      const updated = await ctx.db
        .update(schema.dayCloses)
        .set({ adjustmentsJson: JSON.stringify(list), updatedAt: new Date() })
        .where(eq(schema.dayCloses.id, close.id))
        .returning()
        .then((r) => r[0]!);
      return { close: updated };
    }),

  /**
   * 7i. exportDayCloseCsv（仅店主 · 补丁①4③「导出仅老板」收紧）：日结单 CSV 导出。
   * 返回 UTF-8 BOM 文本（Excel 直开不乱码）；金额列元口径；含冲正状态与原因。
   */
  exportDayCloseCsv: merchantOwnerProcedure
    .input(z.object({ closeId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const close = await ctx.db
        .select({ close: schema.dayCloses, createdByName: schema.users.nickname })
        .from(schema.dayCloses)
        .leftJoin(schema.users, eq(schema.users.id, schema.dayCloses.createdBy))
        .where(eq(schema.dayCloses.id, input.closeId))
        .get();
      if (!close || close.close.storeId !== ctx.user.storeId || close.close.kind !== 'close') {
        throw new TRPCError({ code: 'NOT_FOUND', message: '日结单不存在' });
      }
      const c = close.close;
      const reversedByName = c.reversedBy
        ? await ctx.db
            .select({ nickname: schema.users.nickname })
            .from(schema.users)
            .where(eq(schema.users.id, c.reversedBy))
            .get()
        : undefined;
      const yuan = (fen: number | null) => (fen === null ? '' : (fen / 100).toFixed(2));
      const header = '日结单号,营业日,班次,状态,账面现金(元),实点现金(元),差异(元),微信(元),支付宝(元),次卡等值(元·参考),储值消费(元·参考),收银单数,合并笔数,确认人,确认时间,反结账人,反结账时间';
      const line = [
        c.id, c.bizDate, c.shiftId,
        c.status === 'reversed' ? '已冲正' : '冻结生效',
        yuan(c.bookCashFen), yuan(c.actualCashFen), yuan(c.diffFen),
        yuan(c.wechatFen), yuan(c.alipayFen), yuan(c.passFen), yuan(c.storedValueFen),
        String(c.cashierPaidCount), String(c.paidCount),
        close.createdByName ?? c.createdBy, c.createdAt.toISOString(),
        reversedByName?.nickname ?? '', c.reversedAt?.toISOString() ?? '',
      ].join(',');
      return {
        filename: `day-close-${c.bizDate}-${c.id.slice(-6)}.csv`,
        csv: '﻿' + header + '\n' + line + '\n',
      };
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
