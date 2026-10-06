/**
 * mall router（P5 T5.1 · coder-mall-server 名下文件）
 *
 * 商城全链路：商品目录 → 下单（事务防超卖）→ 支付（PaymentProvider 适配层，§4.7）
 * → 支付回调（原生 Hono 端点，见 routes/payCallback.ts）→ 发货 → 收货。
 *
 * 关键规则落点：
 * - 金额口径：total_fen 一律服务端按商品现价重算，绝不信任前端金额（§4.7 全链路分）。
 * - 防超卖（§6.2 mall.createOrder）：事务内逐商品条件更新
 *   UPDATE products SET stock=stock-qty WHERE id=? AND status='on' AND stock>=qty，
 *   影响行数=0 即抛 CONFLICT 整体回滚。SQLite 单写者模型下事务即行锁（等价
 *   SELECT ... FOR UPDATE），保留事务结构，未来切 MySQL 语义直接成立。
 * - 一单多店：v1 一单仅限同一门店商品（orders.store_id 单列），跨店直接拒绝。
 * - 事件（契约 2）：业务写库与 emitEvent 同事务，事务提交后 broadcastNow。
 *   order.created → store 频道；order.paid → customer（payCallback 内）；
 *   order.shipped → customer；order.received → store。
 * - 支付回调（验签/幂等/流水）不在本文件，见 routes/payCallback.ts（原生端点，
 *   无登录态，由 T1.6 集成挂载）。
 * - 片 3（客户端体验大批）追加：优惠券（模板/领取/台账/结算推荐/核销登记——
 *   **不接真抵扣**：used 仅登记 order_id，orders.total_fen/payments 零触碰）/
 *   收藏（唯一锚幂等 toggle）/商品评价晒单（received 闸+一单一件一评 409）/
 *   配送方式（delivery_method 落列，pickup/same_city 地址可缺省）/超时自动收货
 *   （shipOrder 置 shipped_at 锚 + sweepAutoReceive 60s 滴答，读端口
 *   order_auto_receive_days）/物流半程注记（trackingNote 常量透出，copy 键候批）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, isNotNull, like, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { db, schema } from '../db';
import { parseCsv } from '../lib/csvParse';
import { customerProcedure, merchantManagerProcedure, merchantOwnerProcedure, merchantProcedure, publicProcedure, router } from '../trpc';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { getPaymentProvider } from '../payments/provider';
import { storeWallclock } from './appointment';
import { resolveScopedRules } from './configRules';

/* ------------------------------------------------------------------ */
/* 常量与工具                                                            */
/* ------------------------------------------------------------------ */

/** 订单状态取值（schema text 列的应用层枚举） */
const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'received', 'cancelled', 'refunding'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

/** 商家端待办队列（§6.2 listStoreOrders：待发货 / 已发货 / 售后） */
const STORE_QUEUE_STATUSES = ['paid', 'shipped', 'refunding'] as const;

/** 订单号随机段字符集：去除易混淆字符 0/O/1/I/L（人类可读口径同预约人工码） */
const ORDER_NO_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

/* ------------------------------------------------------------------ */
/* 订单写路径应用层串行化（进程内 async mutex · 单实例边界）                */
/* ------------------------------------------------------------------ */

/**
 * createOrder / payCallback 写事务的串行化锁。
 *
 * 为什么必须串行：@libsql/client 单连接上两个并发 db.transaction 会交错执行——
 * 败者 SQLITE_BUSY，且连接进入 "SQL statements in progress" 中毒态（后续事务
 * 全部无法提交，已用最小复现验证）。因此写事务必须在应用层串行进入：
 * SQLite 单写者模型下，串行化后事务即行锁（等价 SELECT ... FOR UPDATE），
 * createOrder 的条件扣库存（stock>=qty 影响行数=0 → CONFLICT）防超卖语义由此成立。
 * 保留事务结构，未来切 MySQL（多连接行锁天然安全）后本锁可去除。
 * 边界：单实例内存实现；多实例部署需替换为 Redis 等共享锁（口径同预约核销限流注释）。
 */
let orderWriteQueue: Promise<unknown> = Promise.resolve();

/** 串行执行 fn（前序失败不阻塞后续队列） */
export function withOrderWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = orderWriteQueue.then(fn);
  orderWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

type OrderRow = typeof schema.orders.$inferSelect;
type ProductRow = typeof schema.products.$inferSelect;

/** 下单快照行：schema OrderItem + 首图（§5.4 快照含 image；snake_case 与 OrderItem 对齐） */
export type OrderItemSnapshot = schema.OrderItem & { image: string | null };

// 注意：必须用 function 声明（而非箭头函数常量），TS 才会把「返回 never 的调用」
// 当作控制流终止点，从而在 if (!x) badRequest(...) 之后正确收窄 x 为非空。
function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

/** 人类可读订单号：P + yyMMdd + 6 位去混淆随机段（≤20 字符，全局唯一靠 UNIQUE 索引 + 重试）。
 *  B8 裁定②：日期段按门店规范时区（+8）展示口径——仅订单号可读性，不涉及存储/状态机 */
function genOrderNo(now: Date): string {
  const w = storeWallclock(now);
  const yy = String(w.y).slice(-2);
  const mm = String(w.m).padStart(2, '0');
  const dd = String(w.day).padStart(2, '0');
  let rand = '';
  for (let i = 0; i < 6; i++) rand += ORDER_NO_ALPHABET[randomInt(ORDER_NO_ALPHABET.length)];
  return `P${yy}${mm}${dd}${rand}`;
}

async function getOrderOrThrow(d: DbHandle, orderId: string): Promise<OrderRow> {
  const row = await d.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
  return row;
}

/** 列表项：订单行 + 门店名（+ 商家端队列里的客户昵称 + 物流半程注记 + 回馈金抵扣额真值列 W-09） */
type OrderListItem = OrderRow & { storeName: string | null; customerNickname?: string | null; trackingNote?: string | null; rebateFen?: number };

/** 物流跟踪半程口径（片 3 · 无全程物流接口=现状单号展示保留）：已发货单读口附注记。 */
const TRACKING_NOTE = '物流轨迹以快递公司为准';


const groupOrders = (statuses: readonly string[]) =>
  Object.fromEntries(statuses.map((s) => [s, [] as OrderListItem[]])) as Record<string, OrderListItem[]>;

/* ------------------------------------------------------------------ */
/* 待支付取消 / 超时关单（v1.1 批次1 · P0-8）                               */
/* ------------------------------------------------------------------ */

/** 取消来源：customer 客户主动取消 / system_timeout 超时自动关单（事件 payload 用） */
type OrderCancelBy = 'customer' | 'system_timeout';

/** 待支付订单超时阈值：30 分钟未支付自动关单 */
export const PENDING_ORDER_TTL_MS = 30 * 60 * 1000;

/**
 * 待支付订单取消事务（mall.cancelOrder 与 expirePendingOrders 共用同一路径）。
 * 串行写锁 + 事务内重读状态：
 * - 已 cancelled → 幂等返回现状（不重复回补库存、不重复发事件）；
 * - 非 pending（已支付/已发货等）→ BAD_REQUEST；
 * - pending → 逐商品回补 stock（stock += qty，与 createOrder 扣减互逆）
 *   → status=cancelled → emitEvent(store:{storeId}, order.cancelled) → 提交后 broadcastNow。
 */
async function cancelPendingOrderWithLock(
  d: DbHandle,
  orderId: string,
  by: OrderCancelBy,
): Promise<{ order: OrderRow; idempotent: boolean }> {
  return withOrderWriteLock(async () => {
    let outboxId = '';
    const result = await d.transaction(async (tx) => {
      // 锁内事务重读：与并发取消/支付回调串行，状态以事务内读到的为准
      const order = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .get();
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
      if (order.status === 'cancelled') return { order, idempotent: true }; // 幂等：不重复回补
      if (order.status !== 'pending') {
        badRequest(`当前状态（${order.status}）不可取消，仅待支付（pending）订单可取消`);
      }
      const now = new Date();
      // 逐商品回补库存（商品行必然存在——下单时校验过；无条件更新，取消必回补成功）
      for (const item of order.items) {
        await tx
          .update(schema.products)
          .set({ stock: sql`${schema.products.stock} + ${item.quantity}`, updatedAt: now })
          .where(eq(schema.products.id, item.product_id));
      }
      const updated = await tx
        .update(schema.orders)
        .set({ status: 'cancelled', updatedAt: now })
        .where(eq(schema.orders.id, order.id))
        .returning()
        .then((r) => r[0]!);
      outboxId = await emitEvent(txDb(tx), `store:${order.storeId}`, EventType.OrderCancelled, {
        orderId: order.id,
        orderNo: order.orderNo,
        storeId: order.storeId,
        totalFen: order.totalFen,
        itemCount: order.items.length,
        by,
      });
      return { order: updated, idempotent: false };
    });
    if (outboxId) broadcastNow(outboxId); // 幂等路径无事件，不广播
    return result;
  });
}

/**
 * 超时关单（P0-8）：pending 且 createdAt < now - ttlMs 的订单逐个走与
 * cancelOrder 相同的取消事务（回补库存 + order.cancelled 事件，by=system_timeout）。
 * 返回本轮新取消的订单数（被并发取消的单幂等跳过，不重复计入/回补）。
 * 由服务入口以 60s 间隔调用（见 src/index.ts，模式同 outboxSweeper）。
 */
export async function expirePendingOrders(
  now: Date = new Date(),
  ttlMs: number = PENDING_ORDER_TTL_MS,
): Promise<number> {
  const cutoff = new Date(now.getTime() - ttlMs);
  const stale = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, 'pending'), lt(schema.orders.createdAt, cutoff)));
  let cancelled = 0;
  for (const row of stale) {
    const r = await cancelPendingOrderWithLock(db, row.id, 'system_timeout');
    if (!r.idempotent) cancelled++;
  }
  return cancelled;
}

/* ------------------------------------------------------------------ */
/* 片 3：超时自动确认收货（order_auto_receive_days 端口值）+ 端口读件          */
/* ------------------------------------------------------------------ */

/**
 * 超时自动收货天数：service_rules active 行 order_auto_receive_days.days，
 * 缺行/缺键回落 7（迁移 0040 种子口径；fresh 库=seed 补种先于迁移，读口一律回落缺省）。
 * 大批片 2 分层：传 storeId 按本店作用域解析（本店覆盖行优先）；不传=既有全量口径
 * （超时自动收货=全域滴答无单店上下文，单活跃行不变式下=最新端口值）。
 */
async function loadAutoReceiveDays(d: DbHandle, storeId?: string | null): Promise<number> {
  const rows = await d
    .select({ ruleKey: schema.serviceRules.ruleKey, valueJson: schema.serviceRules.valueJson, storeId: schema.serviceRules.storeId })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, 'order_auto_receive_days'), eq(schema.serviceRules.active, true)))
    .orderBy(desc(schema.serviceRules.version));
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  const v = (row?.valueJson as Record<string, unknown> | undefined)?.days;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 7;
}

/** 券叠加规则公示：service_rules active 行 coupon_stack_rule.value_json，缺行回落默认公示口径。
 * 大批片 2 分层：传 storeId 按本店作用域解析；不传=既有全量口径（公示读口无店上下文沿用） */
async function loadCouponStackRule(d: DbHandle, storeId?: string | null): Promise<{ rule: string; note: string }> {
  const rows = await d
    .select({ ruleKey: schema.serviceRules.ruleKey, valueJson: schema.serviceRules.valueJson, storeId: schema.serviceRules.storeId })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, 'coupon_stack_rule'), eq(schema.serviceRules.active, true)))
    .orderBy(desc(schema.serviceRules.version));
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  const v = row?.valueJson as Record<string, unknown> | undefined;
  return {
    rule: typeof v?.rule === 'string' ? v.rule : 'none',
    note:
      typeof v?.note === 'string'
        ? v.note
        : '优惠券不与会员折扣叠加；每单限用 1 张（公示口径）',
  };
}

/**
 * 超时自动确认收货（片 3 · 60s 滴答，e2e 可直调）：
 * status='shipped' 且 shipped_at < now − order_auto_receive_days 天的订单，
 * 逐单条件更新 shipped→received + emitEvent(store, order.received)（同 receiveOrder
 * 工艺：业务写库与事件同事务，提交后 broadcastNow）。
 * 幂等=条件更新天然（与 receiveOrder 并发互撞/滴答重入均零副作用：影响行数=0 即跳过）；
 * 边界同 expirePendingOrders：单实例串行锁，逐单失败不阻断整轮。
 */
export async function sweepAutoReceive(
  d: DbHandle = db,
  now: Date = new Date(),
): Promise<number> {
  const days = await loadAutoReceiveDays(d);
  const cutoff = new Date(now.getTime() - days * 24 * 3600 * 1000);
  const stale = await d
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.status, 'shipped'),
        isNotNull(schema.orders.shippedAt), // 存量 shipped 单无发货时刻锚=不自动收（保守口径明面）
        lt(schema.orders.shippedAt, cutoff),
      ),
    )
    .limit(200);
  let received = 0;
  for (const row of stale) {
    try {
      let outboxId = '';
      const flipped = await withOrderWriteLock(async () => {
        return d.transaction(async (tx) => {
          /* 条件更新：仍 shipped 才翻（receiveOrder 并发/重入互撞=影响行数 0 幂等跳过） */
          const updated = await tx
            .update(schema.orders)
            .set({ status: 'received', updatedAt: now })
            .where(and(eq(schema.orders.id, row.id), eq(schema.orders.status, 'shipped')))
            .returning();
          if (updated.length === 0) return false;
          outboxId = await emitEvent(txDb(tx), `store:${updated[0]!.storeId}`, EventType.OrderReceived, {
            orderId: updated[0]!.id,
            orderNo: updated[0]!.orderNo,
            by: 'system_auto_receive', // 超时自动确认（与 customer 手动收货区分留痕）
          });
          return true;
        });
      });
      if (outboxId) broadcastNow(outboxId);
      if (flipped) received++;
    } catch (err) {
      console.error(`[mall] 超时自动收货失败 order=${row.id}:`, err);
    }
  }
  if (received > 0) console.log(`[mall] 超时自动收货：本轮翻转 ${received} 单（阈值 ${days} 天）`);
  return received;
}

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

export const mallRouter = router({
  /**
   * 1. listProducts（public）：商品目录。仅上架（status=on）；
   * 支持 storeId / category 过滤、keyword 搜索（name/description 模糊）、分页。
   * QA40-D2（修复包 PR-1 · CJ-0922-01/13）：安心包类目（care_package）结构性排除——
   * 安心包=独立库存域不进入售卖区（应急下架是状态位、误上架即复活，须代码层关停）；
   * 入参 includeCarePackage=true 显式放行（管理端用），缺省排除。
   */
  listProducts: publicProcedure
    .input(
      z.object({
        storeId: z.string().min(1).optional(),
        category: z.string().min(1).max(32).optional(),
        keyword: z.string().min(1).max(64).optional(),
        /** 安心包类目显式放行（默认排除；QA40-D2 结构性关停） */
        includeCarePackage: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conds: SQL[] = [eq(schema.products.status, 'on')];
      if (input.storeId) conds.push(eq(schema.products.storeId, input.storeId));
      if (input.category) conds.push(eq(schema.products.category, input.category));
      if (!input.includeCarePackage) conds.push(ne(schema.products.category, 'care_package'));
      if (input.keyword) {
        const kw = `%${input.keyword}%`;
        const fuzzy = or(
          like(schema.products.name, kw),
          like(schema.products.description, kw),
        );
        if (fuzzy) conds.push(fuzzy);
      }
      const where = and(...conds);
      const totalRow = await ctx.db
        .select({ n: sql<number>`count(*)` })
        .from(schema.products)
        .where(where)
        .get();
      const items = await ctx.db
        .select()
        .from(schema.products)
        .where(where)
        .orderBy(desc(schema.products.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { items, total: Number(totalRow?.n ?? 0), page: input.page, pageSize: input.pageSize };
    }),

  /** 2. getProduct（public）：商品详情（仅上架可见，下架一律 404） */
  getProduct: publicProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db
        .select({ product: schema.products, storeName: schema.stores.name })
        .from(schema.products)
        .innerJoin(schema.stores, eq(schema.stores.id, schema.products.storeId))
        .where(and(eq(schema.products.id, input.productId), eq(schema.products.status, 'on')))
        .get();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在或已下架' });
      return row;
    }),

  /**
   * 3. upsertProduct（merchant 本店）：新增/编辑/上下架/库存编辑一体。
   * 带 productId → 更新（强制本店归属，否则 FORBIDDEN）；不带 → 本店新增。
   */
  upsertProduct: merchantOwnerProcedure // M1-补2 条件①：商品定价管理仅老板（矩阵）
    .input(
      z.object({
        productId: z.string().min(1).optional(),
        category: z.string().min(1).max(32),
        name: z.string().min(1).max(128),
        description: z.string().max(2000).optional(),
        images: z.array(z.string().max(255)).max(9).optional(),
        priceFen: z.number().int().min(0).max(100_000_000),
        stock: z.number().int().min(0).max(1_000_000),
        status: z.enum(['on', 'off']),
        /** 片 4：进价/成本价（分，台账字段不写支付链；毛利视界=owner|manager） */
        costFen: z.number().int().min(0).max(100_000_000).nullish(),
        /** 库存下限/上限（上下限预警；null=不设） */
        minStock: z.number().int().min(0).max(1_000_000).nullish(),
        maxStock: z.number().int().min(0).max(1_000_000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const fields = {
        category: input.category,
        name: input.name,
        description: input.description ?? null,
        images: input.images ?? [],
        priceFen: input.priceFen,
        stock: input.stock,
        status: input.status,
        costFen: input.costFen ?? null,
        minStock: input.minStock ?? null,
        maxStock: input.maxStock ?? null,
      };
      if (!input.productId) {
        return ctx.db
          .insert(schema.products)
          .values({ storeId, ...fields })
          .returning()
          .then((r) => r[0]!);
      }
      const existing = await ctx.db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, input.productId))
        .get();
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在' });
      if (existing.storeId !== storeId) forbidden('非本店商品，无权编辑');
      return ctx.db
        .update(schema.products)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(schema.products.id, existing.id))
        .returning()
        .then((r) => r[0]!);
    }),

  /**
   * 3b. listProductsForStore（merchant 本店，P5 T5.2 追加 · coder-mall-merchant 授权小改）：本店商品管理列表。
   * 与 listProducts（public、仅上架）的区别：本店全部商品含下架（不按 status 过滤），
   * storeId 强制取 ctx.user.storeId（不看入参，天然不越店）；支持 category / keyword 过滤与分页。
   * pageSize 上限放宽到 200（管理端一屏全量编辑场景），返回结构同 listProducts。
   * QA40-D2：care_package（安心包）类目默认排除（售卖侧结构性关停）——管理端
   * ProductsPage 传 includeCarePackage=true 显式放行（独立库存域接管前的管理可见性）。
   */
  listProductsForStore: merchantProcedure
    .input(
      z.object({
        category: z.string().min(1).max(32).optional(),
        keyword: z.string().min(1).max(64).optional(),
        /** 安心包类目显式放行（默认排除=售卖侧结构性关停 QA40-D2；管理端 ProductsPage 传 true） */
        includeCarePackage: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conds: SQL[] = [eq(schema.products.storeId, ctx.user.storeId!)];
      if (input.category) conds.push(eq(schema.products.category, input.category));
      if (!input.includeCarePackage) conds.push(ne(schema.products.category, 'care_package'));
      if (input.keyword) {
        const kw = `%${input.keyword}%`;
        const fuzzy = or(
          like(schema.products.name, kw),
          like(schema.products.description, kw),
        );
        if (fuzzy) conds.push(fuzzy);
      }
      const where = and(...conds);
      const totalRow = await ctx.db
        .select({ n: sql<number>`count(*)` })
        .from(schema.products)
        .where(where)
        .get();
      const items = await ctx.db
        .select()
        .from(schema.products)
        .where(where)
        .orderBy(desc(schema.products.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      /* 片 4 毛利权限隔离（开口项 1 裁，server 闸）：clerk 零透出成本/上下限字段
         （毛利视界=owner|manager；canManage=页面级闸同口径双层） */
      const canManage =
        ctx.user.roles.includes('merchant_owner') || ctx.user.roles.includes('merchant_manager');
      const itemsOut = canManage
        ? items
        : items.map((p) => ({ ...p, costFen: null, minStock: null, maxStock: null }));
      return { items: itemsOut, total: Number(totalRow?.n ?? 0), page: input.page, pageSize: input.pageSize };
    }),

  /**
   * 4. createOrder（customer）★：下单。
   * 事务内：逐商品校验 status=on → 条件扣减库存（stock>=qty，影响行数=0 抛
   * CONFLICT 回滚）→ 服务端口径重算 total_fen → 生成订单号 → 建 pending 订单
   * （items 快照含 name/priceFen/image）→ emitEvent(store, order.created)。
   * 订单号撞唯一索引时换号整体重试（同预约人工码模式）。
   * 片 3：deliveryMethod（express 快递|same_city 同城|pickup 自提，缺省 express
   * 存量零破坏）落 orders.delivery_method 列；pickup/same_city 时 address 可缺省
   * （自提/同城无快递地址诉求），express 必传（硬校验明文）。
   */
  createOrder: customerProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              productId: z.string().min(1),
              qty: z.number().int().min(1).max(99),
            }),
          )
          .min(1)
          .max(20),
        address: z
          .object({
            name: z.string().min(1).max(64),
            phone: z.string().min(3).max(20),
            detail: z.string().min(1).max(255),
          })
          .optional(), // 片 3：pickup/same_city 可缺省（express 在 mutation 内硬校验必传）
        deliveryMethod: z.enum(['express', 'same_city', 'pickup']).default('express'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.deliveryMethod === 'express' && !input.address) {
        badRequest('快递配送须填写收货地址（自提/同城可缺省）');
      }
      // 同商品多行先合并数量，保证库存语义与金额口径一致
      const merged = new Map<string, number>();
      for (const it of input.items) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty);

      // v1 一单仅限同一门店（orders.store_id 单列）：先取齐商品做跨店预检
      const preload: ProductRow[] = [];
      for (const productId of merged.keys()) {
        const p = await ctx.db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, productId))
          .get();
        if (!p) badRequest('购物车含不存在的商品，请刷新后重试');
        preload.push(p);
      }
      const storeIds = new Set(preload.map((p) => p.storeId));
      if (storeIds.size > 1) badRequest('一次下单仅支持同一门店的商品，请分开结算');
      const storeId = preload[0]!.storeId;

      // 写事务串行进入（见 withOrderWriteLock 注释）：并发下单被逐单串行化，
      // 后到单在条件扣库存处得到 0 行 → CONFLICT「库存不足」，绝不超卖、互不污染连接。
      return withOrderWriteLock(async () => {
        const MAX_NO_RETRIES = 5;
        let lastErr: unknown;
        for (let attempt = 0; attempt < MAX_NO_RETRIES; attempt++) {
        const now = new Date();
        const orderNo = genOrderNo(now);
        try {
          let outboxId = '';
          const created = await ctx.db.transaction(async (tx) => {
            // SQLite 单写者（叠加应用层串行锁）：事务即行锁（等价 SELECT ... FOR UPDATE），杜绝并发超卖
            const lines: OrderItemSnapshot[] = [];
            let totalFen = 0;
            for (const [productId, qty] of merged) {
              const p = await tx
                .select()
                .from(schema.products)
                .where(eq(schema.products.id, productId))
                .get();
              if (!p) badRequest('购物车含不存在的商品，请刷新后重试');
              if (p.status !== 'on') badRequest(`「${p.name}」已下架，请移除后再结算`);
              // 条件更新扣库存：stock>=qty 才生效；影响行数=0 → 库存不足，抛错整体回滚
              const decremented = await tx
                .update(schema.products)
                .set({ stock: sql`${schema.products.stock} - ${qty}`, updatedAt: now })
                .where(
                  and(
                    eq(schema.products.id, p.id),
                    eq(schema.products.status, 'on'),
                    gte(schema.products.stock, qty),
                  ),
                )
                .returning({ id: schema.products.id });
              if (decremented.length === 0) {
                throw new TRPCError({
                  code: 'CONFLICT',
                  message: `「${p.name}」库存不足（剩余 ${p.stock} 件）`,
                });
              }
              totalFen += p.priceFen * qty; // 服务端口径：按下单时商品现价重算
              lines.push({
                product_id: p.id,
                name: p.name,
                quantity: qty,
                price_fen: p.priceFen,
                image: p.images?.[0] ?? null,
              });
            }
            const order = await tx
              .insert(schema.orders)
              .values({
                orderNo,
                customerId: ctx.user.id,
                storeId,
                items: lines,
                totalFen,
                address: input.address
                  ? {
                      receiver: input.address.name,
                      phone: input.address.phone,
                      detail: input.address.detail,
                    }
                  : null, // 片 3：pickup/same_city 可缺省（express 已在入参后硬校验必传）
                deliveryMethod: input.deliveryMethod, // 片 3：配送方式落列（缺省 express）
                status: 'pending',
              })
              .returning()
              .then((r) => r[0]!);
            outboxId = await emitEvent(txDb(tx), `store:${storeId}`, EventType.OrderCreated, {
              orderId: order.id,
              orderNo,
              storeId,
              totalFen,
              itemCount: lines.length,
            });
            return order;
          });
          broadcastNow(outboxId);
          return created;
        } catch (err) {
          // 订单号撞唯一索引：换号重试整个事务；其他错误（含 CONFLICT 库存不足）直接抛出
          if (err instanceof Error && /UNIQUE constraint failed: orders\.order_no/.test(err.message)) {
            lastErr = err;
            continue;
          }
          throw err;
        }
        }
        throw lastErr;
      });
    }),

  /**
   * 5. createPayment（customer）：对本人 pending 订单发起支付。
   * 经 PaymentProvider 适配层（§4.7）创建支付单，返回前端调起参数；
   * mock 模式下前端随后调 POST /api/pay/mock-callback 完成演示闭环。
   */
  createPayment: customerProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderOrThrow(ctx.db, input.orderId);
      if (order.customerId !== ctx.user.id) forbidden('只能支付本人订单');
      if (order.status !== 'pending') {
        badRequest(`当前状态（${order.status}）不可发起支付，仅 pending 可支付`);
      }
      const provider = getPaymentProvider();
      const subject = `菲丽亚商城订单${order.orderNo}`;
      const { paymentId, payParams } = await provider.createPayment({
        orderId: order.id,
        totalFen: order.totalFen,
        subject,
      });
      return {
        orderId: order.id,
        orderNo: order.orderNo,
        totalFen: order.totalFen,
        provider: provider.name,
        paymentId,
        payParams,
      };
    }),

  /** 6. listMyOrders（customer）：我的订单按状态分组（六态齐全，附门店名）；
   *  片 3：已发货单附 trackingNote 半程注记「物流轨迹以快递公司为准」（常量透出，
   *  copy 端口键入册候批——注记明面）；deliveryMethod 随订单行透出。 */
  listMyOrders: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ order: schema.orders, storeName: schema.stores.name })
      .from(schema.orders)
      .innerJoin(schema.stores, eq(schema.stores.id, schema.orders.storeId))
      .where(eq(schema.orders.customerId, ctx.user.id))
      .orderBy(desc(schema.orders.createdAt));
    const groups = groupOrders(ORDER_STATUSES) as Record<OrderStatus, OrderListItem[]>;
    for (const r of rows) {
      const bucket = groups[r.order.status as OrderStatus];
      if (bucket) {
        bucket.push({
          ...r.order,
          storeName: r.storeName,
          trackingNote: r.order.trackingNo ? TRACKING_NOTE : null, // 物流半程注记（有单号才附）
        });
      }
    }
    return { groups };
  }),

  /**
   * 6b. cancelOrder（customer 本人 · v1.1 P0-8）：待支付订单取消。
   * 仅本人 + 仅 status=pending；事务内（withOrderWriteLock 串行）逐商品回补
   * stock → status=cancelled → emitEvent(store:{storeId}, order.cancelled)。
   * 幂等：已 cancelled 返回现状（idempotent=true，不重复回补/发事件）；
   * 已支付等其他状态 BAD_REQUEST。超时自动关单走 expirePendingOrders 同一事务。
   */
  cancelOrder: customerProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderOrThrow(ctx.db, input.orderId);
      if (order.customerId !== ctx.user.id) forbidden('只能取消本人订单');
      if (order.status === 'cancelled') return { order, idempotent: true }; // 幂等快路径
      if (order.status !== 'pending') {
        badRequest(`当前状态（${order.status}）不可取消，仅待支付（pending）订单可取消`);
      }
      // 状态在锁内事务里再校验一次（防与支付回调/并发取消竞态）
      return cancelPendingOrderWithLock(ctx.db, order.id, 'customer');
    }),

  /**
   * 7. shipOrder（merchant 本店）：paid → shipped + 填物流单号；
   * 片 3：同事置 shipped_at=now（超时自动收货锚=shipped_at+order_auto_receive_days 端口值）；
   * emitEvent(user:{customerId}, order.shipped)。
   */
  shipOrder: merchantManagerProcedure // M1-补2 条件①：订单履约管理 owner|manager，clerk 403
    .input(
      z.object({
        orderId: z.string().min(1),
        trackingNo: z.string().min(1).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderOrThrow(ctx.db, input.orderId);
      if (order.storeId !== ctx.user.storeId) forbidden('非本店订单，无权操作');
      if (order.status !== 'paid') {
        badRequest(`当前状态（${order.status}）不可发货，仅 paid 可发货`);
      }
      const now = new Date();
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.orders)
          .set({ status: 'shipped', trackingNo: input.trackingNo, shippedAt: now, updatedAt: now })
          .where(eq(schema.orders.id, order.id))
          .returning()
          .then((r) => r[0]!);
        outboxId = await emitEvent(txDb(tx), `user:${order.customerId}`, EventType.OrderShipped, {
          orderId: order.id,
          orderNo: order.orderNo,
          trackingNo: input.trackingNo,
        });
        return row;
      });
      broadcastNow(outboxId);
      return updated;
    }),

  /**
   * 8. receiveOrder（customer 本人）：shipped → received；
   * emitEvent(store:{storeId}, order.received)。
   */
  receiveOrder: customerProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderOrThrow(ctx.db, input.orderId);
      if (order.customerId !== ctx.user.id) forbidden('只能操作本人订单');
      if (order.status !== 'shipped') {
        badRequest(`当前状态（${order.status}）不可确认收货，仅 shipped 可收货`);
      }
      const now = new Date();
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.orders)
          .set({ status: 'received', updatedAt: now })
          .where(eq(schema.orders.id, order.id))
          .returning()
          .then((r) => r[0]!);
        outboxId = await emitEvent(txDb(tx), `store:${order.storeId}`, EventType.OrderReceived, {
          orderId: order.id,
          orderNo: order.orderNo,
        });
        return row;
      });
      broadcastNow(outboxId);
      return updated;
    }),

  /**
   * 9. listStoreOrders（merchant 本店）：待办队列——待发货 paid / 已发货 shipped /
   * 售后 refunding 三组（附客户昵称，按创建时间倒序）。
   * 体验批片 5（B 区点亮）：行附 rebateFen=回馈金抵扣额真值（rebate_logs type='deduct'
   * 联 source_id=order_no 聚合；商城结算当前无回馈金抵扣写入口——列真值恒 0 是诚实
   * 现状，通道开通即自动有值；W-09 红字口径接真值，不画假数）。
   */
  listStoreOrders: merchantManagerProcedure.query(async ({ ctx }) => { // M1-补2 条件①：商城订单流水 clerk 403
    const rows = await ctx.db
      .select({ order: schema.orders, customerNickname: schema.users.nickname })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.users.id, schema.orders.customerId))
      .where(
        and(
          eq(schema.orders.storeId, ctx.user.storeId!),
          or(
            eq(schema.orders.status, 'paid'),
            eq(schema.orders.status, 'shipped'),
            eq(schema.orders.status, 'refunding'),
          ),
        ),
      )
      .orderBy(desc(schema.orders.createdAt));
    /* 回馈金列透出：rebate_logs deduct 联 order_no（无行=0） */
    const orderNos = rows.map((r) => r.order.orderNo);
    const rebateRows = orderNos.length
      ? await ctx.db
          .select({ sourceId: schema.rebateLogs.sourceId, deltaFen: schema.rebateLogs.deltaFen })
          .from(schema.rebateLogs)
          .where(and(eq(schema.rebateLogs.type, 'deduct'), inArray(schema.rebateLogs.sourceId, orderNos)))
      : [];
    const rebateByOrderNo = new Map<string, number>();
    for (const r of rebateRows) {
      if (!r.sourceId) continue;
      rebateByOrderNo.set(r.sourceId, (rebateByOrderNo.get(r.sourceId) ?? 0) + Math.abs(r.deltaFen));
    }
    const groups = groupOrders(STORE_QUEUE_STATUSES);
    for (const r of rows) {
      groups[r.order.status]?.push({
        ...r.order,
        storeName: null,
        customerNickname: r.customerNickname,
        rebateFen: rebateByOrderNo.get(r.order.orderNo) ?? 0,
      });
    }
    return { groups };
  }),

  /* ------------------------------------------------------------------ */
  /* 片 3：优惠券（开口项 1 裁：不接真抵扣结算——used 仅登记 order_id，        */
  /* orders.total_fen/payments 一字不碰，注释明面）                            */
  /* ------------------------------------------------------------------ */

  /**
   * couponTemplates（public 登录可读）：在售券模板列表（status='on'），
   * 附已领计数（配额进度 UI 用）；store_id NULL=全场通用券。
   */
  couponTemplates: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.status, 'on'))
      .orderBy(desc(schema.coupons.createdAt));
    const counts = await ctx.db
      .select({ couponId: schema.couponGrants.couponId, n: sql<number>`count(*)` })
      .from(schema.couponGrants)
      .groupBy(schema.couponGrants.couponId);
    const countMap = new Map(counts.map((c) => [c.couponId, Number(c.n)]));
    return {
      items: rows.map((c) => ({ ...c, claimedCount: countMap.get(c.id) ?? 0 })),
    };
  }),

  /**
   * couponClaim（customer）：领券。幂等=uq_coupon_grants_user_coupon(coupon_id,
   * user_id) 唯一锚——重复领=返回现状 idempotent=true 零新增；配额（total_quota
   * 非空）满 → 400 明文「已领完」（事务内计数+唯一锚双保险，并发超额由锚兜底）。
   */
  couponClaim: customerProcedure
    .input(z.object({ couponId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return withOrderWriteLock(async () => {
        return ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          const coupon = await t
            .select()
            .from(schema.coupons)
            .where(eq(schema.coupons.id, input.couponId))
            .get();
          if (!coupon || coupon.status !== 'on') badRequest('优惠券不存在或已下架');
          const now = new Date();
          const inserted = await t
            .insert(schema.couponGrants)
            .values({ couponId: coupon.id, userId: ctx.user.id, status: 'claimed', claimedAt: now })
            .onConflictDoNothing({ target: [schema.couponGrants.couponId, schema.couponGrants.userId] })
            .returning();
          if (inserted.length === 0) {
            /* 唯一锚命中：重复领=返回现状幂等 */
            const existing = await t
              .select()
              .from(schema.couponGrants)
              .where(
                and(
                  eq(schema.couponGrants.couponId, coupon.id),
                  eq(schema.couponGrants.userId, ctx.user.id),
                ),
              )
              .get();
            return { grant: existing!, idempotent: true as const };
          }
          if (coupon.totalQuota !== null) {
            const cnt = await t
              .select({ n: sql<number>`count(*)` })
              .from(schema.couponGrants)
              .where(eq(schema.couponGrants.couponId, coupon.id))
              .get();
            if (Number(cnt?.n ?? 0) > coupon.totalQuota) {
              badRequest('该优惠券已领完（配额已满）'); // 抛错整体回滚，本行不落
            }
          }
          return { grant: inserted[0]!, idempotent: false as const };
        });
      });
    }),

  /** myCoupons（customer）：本人领用台账（可按状态过滤），联券模板透出面额/门槛/效期 */
  myCoupons: customerProcedure
    .input(
      z
        .object({ status: z.enum(['claimed', 'used', 'expired', 'voided']).optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.couponGrants.userId, ctx.user.id)];
      if (input?.status) conds.push(eq(schema.couponGrants.status, input.status));
      const rows = await ctx.db
        .select({ grant: schema.couponGrants, coupon: schema.coupons })
        .from(schema.couponGrants)
        .innerJoin(schema.coupons, eq(schema.coupons.id, schema.couponGrants.couponId))
        .where(and(...conds))
        .orderBy(desc(schema.couponGrants.createdAt));
      return { items: rows.map((r) => ({ ...r.grant, coupon: r.coupon })) };
    }),

  /**
   * availableCoupons（customer · 结算推荐读口）：{totalFen} 按门槛过滤的可用券——
   * 本人 status='claimed' 且未过效期（claimed_at+valid_days 天）且 threshold_fen ≤
   * totalFen。**只读推荐，不做任何抵扣登记**（开口项 1 裁）。
   */
  availableCoupons: customerProcedure
    .input(z.object({ totalFen: z.number().int().min(0).max(100_000_000) }))
    .query(async ({ ctx, input }) => {
      const nowSec = Math.floor(Date.now() / 1000);
      const rows = await ctx.db
        .select({ grant: schema.couponGrants, coupon: schema.coupons })
        .from(schema.couponGrants)
        .innerJoin(schema.coupons, eq(schema.coupons.id, schema.couponGrants.couponId))
        .where(
          and(
            eq(schema.couponGrants.userId, ctx.user.id),
            eq(schema.couponGrants.status, 'claimed'),
            sql`${schema.coupons.thresholdFen} <= ${input.totalFen}`,
            /* 效期：claimed_at + valid_days 天 > now（缺 claimed_at 保守视为可用——种子/迁移期口径） */
            sql`(${schema.couponGrants.claimedAt} IS NULL OR ${schema.couponGrants.claimedAt} + ${schema.coupons.validDays} * 86400 > ${nowSec})`,
          ),
        )
        .orderBy(desc(schema.coupons.amountFen));
      return { items: rows.map((r) => ({ ...r.grant, coupon: r.coupon })) };
    }),

  /**
   * couponUse（customer）：核销登记——claimed→used，仅登记 order_id 留痕。
   * **开口项 1 裁（明面）：不接真抵扣结算——orders.total_fen / payments 一字
   * 不碰**（真抵扣候线上收单批）；幂等=已 used 返回现状（idempotent=true）；
   * 本人闸：券/单均须属本人（他人券 NOT_FOUND 不透出，他人单 403）。
   */
  couponUse: customerProcedure
    .input(z.object({ grantId: z.string().min(1), orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return withOrderWriteLock(async () => {
        return ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          const grant = await t
            .select()
            .from(schema.couponGrants)
            .where(and(eq(schema.couponGrants.id, input.grantId), eq(schema.couponGrants.userId, ctx.user.id)))
            .get();
          if (!grant) throw new TRPCError({ code: 'NOT_FOUND', message: '券记录不存在' });
          const order = await t
            .select({ id: schema.orders.id, customerId: schema.orders.customerId })
            .from(schema.orders)
            .where(eq(schema.orders.id, input.orderId))
            .get();
          if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
          if (order.customerId !== ctx.user.id) forbidden('只能核销到本人订单');
          if (grant.status === 'used') return { grant, idempotent: true as const };
          if (grant.status !== 'claimed') badRequest('券状态不可核销（已作废或已过期）');
          /* 条件更新 claimed→used（并发双核销=影响行数 0 幂等）；**只动 grant 行，
             订单金额/支付流水零触碰**（开口项 1 裁，注释明面） */
          const now = new Date();
          const updated = await t
            .update(schema.couponGrants)
            .set({ status: 'used', usedAt: now, orderId: order.id, updatedAt: now })
            .where(and(eq(schema.couponGrants.id, grant.id), eq(schema.couponGrants.status, 'claimed')))
            .returning();
          if (updated.length === 0) return { grant: { ...grant, status: 'used' }, idempotent: true as const };
          return { grant: updated[0]!, idempotent: false as const };
        });
      });
    }),

  /** couponStackRule（public 登录可读）：券叠加规则公示（service_rules.coupon_stack_rule
   *  端口值，保存即生效只管新读；缺行回落默认公示口径） */
  couponStackRule: publicProcedure.query(async ({ ctx }) => {
    const v = await loadCouponStackRule(ctx.db);
    return { ...v, source: 'service_rules.coupon_stack_rule' };
  }),

  /* ------------------------------------------------------------------ */
  /* 片 3：收藏/心愿单（(user_id,product_id) 唯一锚幂等）                     */
  /* ------------------------------------------------------------------ */

  /**
   * favToggle（customer）：收藏开关——在=删（fav:false）/不在=插（fav:true）；
   * uq_favorites_user_product 唯一锚幂等（并发双击撞锚按已收藏处理）。
   */
  favToggle: customerProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.id, input.productId))
        .get();
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在' });
      return ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        const existing = await t
          .select({ id: schema.favorites.id })
          .from(schema.favorites)
          .where(and(eq(schema.favorites.userId, ctx.user.id), eq(schema.favorites.productId, input.productId)))
          .get();
        if (existing) {
          await t.delete(schema.favorites).where(eq(schema.favorites.id, existing.id));
          return { fav: false as const };
        }
        await t
          .insert(schema.favorites)
          .values({ userId: ctx.user.id, productId: input.productId, createdAt: new Date() })
          .onConflictDoNothing({ target: [schema.favorites.userId, schema.favorites.productId] });
        return { fav: true as const };
      });
    }),

  /** favList（customer）：本人收藏列表（联商品快照：名/价/首图/上架状态，新→旧） */
  favList: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: schema.favorites.id,
        productId: schema.favorites.productId,
        createdAt: schema.favorites.createdAt,
        name: schema.products.name,
        priceFen: schema.products.priceFen,
        images: schema.products.images,
        status: schema.products.status,
        storeId: schema.products.storeId,
      })
      .from(schema.favorites)
      .innerJoin(schema.products, eq(schema.products.id, schema.favorites.productId))
      .where(eq(schema.favorites.userId, ctx.user.id))
      .orderBy(desc(schema.favorites.createdAt));
    return {
      items: rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        name: r.name,
        priceFen: r.priceFen,
        image: r.images?.[0] ?? null,
        status: r.status,
        storeId: r.storeId,
        createdAt: r.createdAt,
      })),
    };
  }),

  /** favCheck（customer）：{productId} 是否已收藏（商详页星标读口） */
  favCheck: customerProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db
        .select({ id: schema.favorites.id })
        .from(schema.favorites)
        .where(and(eq(schema.favorites.userId, ctx.user.id), eq(schema.favorites.productId, input.productId)))
        .get();
      return { fav: !!row };
    }),

  /* ------------------------------------------------------------------ */
  /* 片 3：商品评价晒单（挂 order_id+product_id 一单一件一评；与服务评价域      */
  /* reviews 分键不混——schema 头注口径）                                       */
  /* ------------------------------------------------------------------ */

  /**
   * reviewProduct（customer）：晒单评价——
   * - 闸：订单须属本人（他人 403）且 status='received'（未收货 400 明文）；
   *   productId 须在该单 items 内（否则 400）；
   * - 幂等：uq_product_reviews_order_product(order_id,product_id) 一单一件一评，
   *   重复评 → 409 CONFLICT 明文；
   * - anonymous=匿名（读口匿名录名处理，见 productReviews）。
   */
  reviewProduct: customerProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        productId: z.string().min(1),
        rating: z.number().int().min(1, '评分须为 1-5 星').max(5, '评分须为 1-5 星'),
        text: z.string().max(500).optional(),
        photoUrls: z.array(z.string().max(255)).max(9).optional(),
        anonymous: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderOrThrow(ctx.db, input.orderId);
      if (order.customerId !== ctx.user.id) forbidden('只能评价本人订单');
      if (order.status !== 'received') badRequest('订单确认收货后才能评价（当前状态不可评）');
      if (!order.items.some((it) => it.product_id === input.productId)) {
        badRequest('该订单不含此商品，无法评价');
      }
      const inserted = await ctx.db
        .insert(schema.productReviews)
        .values({
          orderId: order.id,
          productId: input.productId,
          storeId: order.storeId,
          customerId: ctx.user.id,
          rating: input.rating,
          text: input.text ?? null,
          photoUrls: input.photoUrls ?? [],
          anonymous: input.anonymous ?? false,
        })
        .onConflictDoNothing({ target: [schema.productReviews.orderId, schema.productReviews.productId] })
        .returning();
      if (inserted.length === 0) {
        throw new TRPCError({ code: 'CONFLICT', message: '该订单此商品已评价过，请勿重复评价' });
      }
      return { review: inserted[0]! };
    }),

  /**
   * productReviews（public 登录可读）：{productId} 评价分页 + 均分聚合
   * （avgRating 精确到 0.1，count 总数）；anonymous=匿名录名（昵称不透出，
   * 透出「匿名用户」）。
   */
  productReviews: publicProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const agg = await ctx.db
        .select({ n: sql<number>`count(*)`, avg: sql<number>`avg(${schema.productReviews.rating})` })
        .from(schema.productReviews)
        .where(eq(schema.productReviews.productId, input.productId))
        .get();
      const rows = await ctx.db
        .select({ review: schema.productReviews, nickname: schema.users.nickname })
        .from(schema.productReviews)
        .innerJoin(schema.users, eq(schema.users.id, schema.productReviews.customerId))
        .where(eq(schema.productReviews.productId, input.productId))
        .orderBy(desc(schema.productReviews.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      const count = Number(agg?.n ?? 0);
      return {
        total: count,
        avgRating: count > 0 ? Math.round(Number(agg?.avg ?? 0) * 10) / 10 : null,
        page: input.page,
        pageSize: input.pageSize,
        items: rows.map((r) => ({
          ...r.review,
          nickname: r.review.anonymous ? '匿名用户' : (r.nickname ?? '匿名用户'),
        })),
      };
    }),
  /* 体验批片 5 · B 区点亮：商品 CSV 导入端口（W-10 商品屏；模板下载+预览     */
  /* dry-run+落账+失败行回显零落账+留痕；闸=owner|manager，开工令 §一.B）      */
  /* 模板列写死（任务书 §三.2 名单内字段写死）：分类/商品名/描述/价格(元)/库存/   */
  /* 是否消毒耗材——六列顺序固定，表头行固定。                                  */
  /* ------------------------------------------------------------------ */

  /** 模板下载（登录即可读=公开形状；写闸在 preview/execute） */
  productImportTemplate: merchantManagerProcedure.query(() => {
    const csv =
      '﻿分类,商品名,描述,价格(元),库存,是否消毒耗材\n' +
      '主粮,全价成犬粮 2kg,鸡肉味全价犬粮,129.00,50,否\n' +
      '清洁,宠物消毒液 500ml,环境消杀用,39.90,30,是\n';
    return { filename: 'product-import-template.csv', csv, columns: ['分类', '商品名', '描述', '价格(元)', '库存', '是否消毒耗材'] };
  }),

  /** 预览 dry-run（零写入）：解析+逐行校验+对账报告（失败行原因分布全量回显） */
  productImportPreview: merchantManagerProcedure
    .input(z.object({ csvText: z.string().min(1, 'CSV 内容为空').max(1024 * 1024, 'CSV 超出 1MB 上限'), filename: z.string().max(255).optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = buildProductImportPlan(input.csvText);
      void ctx;
      return { report: plan.report, rows: plan.rows.map((r) => ({ line: r.line, ok: r.ok, error: r.error ?? null, name: r.name })) };
    }),

  /**
   * 落账（全量或零：任一行校验失败 → 400+失败行回显，零落账零批次行）；
   * 全量合法 → 事务内逐行插 products（status='on' 上架）+ product_import_batches 批次行
   * 留痕（report_json=逐行报告全量）。储值导入同族工艺（storedValue.executeImport）。
   */
  productImportExecute: merchantManagerProcedure
    .input(z.object({ csvText: z.string().min(1, 'CSV 内容为空').max(1024 * 1024, 'CSV 超出 1MB 上限'), filename: z.string().max(255).optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = buildProductImportPlan(input.csvText);
      if (plan.rows.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '无可导入数据行' });
      const failRows = plan.rows.filter((r) => !r.ok);
      if (failRows.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `存在 ${failRows.length} 行校验失败，已零落账：${failRows.map((r) => `行${r.line}（${r.error}）`).join('；')}`,
        });
      }
      const batch = await ctx.db.transaction(async (tx) => {
        for (const r of plan.rows) {
          await tx.insert(schema.products).values({
            storeId: ctx.user.storeId!,
            category: r.category!,
            name: r.name!,
            description: r.description ?? null,
            priceFen: r.priceFen!,
            stock: r.stock!,
            costFen: r.costFen ?? null,
            minStock: r.minStock ?? null,
            maxStock: r.maxStock ?? null,
            status: 'on',
            isDisinfectionSupply: r.isSupply,
          });
        }
        const [batch] = await tx
          .insert(schema.productImportBatches)
          .values({
            storeId: ctx.user.storeId!,
            filename: input.filename ?? '未命名.csv',
            totalRows: plan.rows.length,
            okRows: plan.rows.length,
            failRows: 0,
            reportJson: { lines: plan.rows.map((r) => ({ line: r.line, name: r.name, ok: true })) } as Record<string, unknown>,
            createdBy: ctx.user.id,
          })
          .returning();
        return batch;
      });
      return { batchId: batch.id, okRows: batch.okRows, failRows: 0 };
    }),
});

/* ------------------------------------------------------------------ */
/* 商品 CSV 导入：解析+校验计划（模板六列写死；失败行零落账判定在 execute）   */
/* ------------------------------------------------------------------ */

interface ProductImportRow {
  line: number;
  ok: boolean;
  error?: string;
  category?: string;
  name?: string;
  description?: string;
  priceFen?: number;
  stock?: number;
  isSupply?: boolean;
  /** 片 4 期初库存导入扩列（可选尾列）：进价（分）/库存下限/库存上限 */
  costFen?: number | null;
  minStock?: number | null;
  maxStock?: number | null;
}

/** 模板六列（写死）：分类/商品名/描述/价格(元)/库存/是否消毒耗材；片 4 期初导入扩列=可选尾列 进价(元)/库存下限/库存上限（缺省 NULL，与六列模板向后兼容） */
const PRODUCT_IMPORT_HEADER = ['分类', '商品名', '描述', '价格(元)', '库存', '是否消毒耗材'];
/** 可选尾列（片 4 期初导入扩列；表头可全列可缺省） */
const PRODUCT_IMPORT_OPT_HEADER = ['进价(元)', '库存下限', '库存上限'];

function buildProductImportPlan(csvText: string): { rows: ProductImportRow[]; report: Record<string, unknown> } {
  const table = parseCsv(csvText);
  const rows: ProductImportRow[] = [];
  const header = table[0] ?? [];
  const headerOk = PRODUCT_IMPORT_HEADER.every((h, i) => (header[i] ?? '').trim() === h) &&
    PRODUCT_IMPORT_OPT_HEADER.every((h, i) => { const v = (header[PRODUCT_IMPORT_HEADER.length + i] ?? '').trim(); return v === '' || v === h; });
  if (!headerOk) {
    return {
      rows: [],
      report: { totalRows: 0, okRows: 0, failRows: Math.max(0, table.length - 1), headerError: `表头须为：${PRODUCT_IMPORT_HEADER.join('/')}`, templateHint: '先下载模板再填' },
    };
  }
  for (let i = 1; i < table.length; i++) {
    const cells = table[i]!.map((c) => c.trim());
    const line = i + 1; // 含表头行的物理行号
    const [category, name, description, priceRaw, stockRaw, supplyRaw, costRaw, minRaw, maxRaw] = cells;
    const fail = (error: string): ProductImportRow => ({ line, ok: false, error, name: name || undefined });
    if (cells.every((c) => c === '')) continue; // 空行跳过
    if (!category || category.length > 32) { rows.push(fail('分类必填且 ≤32 字')); continue; }
    if (!name || name.length > 64) { rows.push(fail('商品名必填且 ≤64 字')); continue; }
    if (description && description.length > 255) { rows.push(fail('描述 ≤255 字')); continue; }
    const priceMatch = /^(\d+)(\.\d{1,2})?$/.exec(priceRaw ?? '');
    if (!priceMatch) { rows.push(fail('价格须为数字（最多两位小数）')); continue; }
    const priceFen = Math.round(parseFloat(priceRaw!) * 100);
    if (priceFen <= 0 || priceFen > 100_000_00) { rows.push(fail('价格须 >0 且 ≤100 万元')); continue; }
    if (!/^\d+$/.test(stockRaw ?? '')) { rows.push(fail('库存须为非负整数')); continue; }
    const stock = parseInt(stockRaw!, 10);
    if (stock > 1_000_000) { rows.push(fail('库存超出合理上限')); continue; }
    if (supplyRaw !== '是' && supplyRaw !== '否') { rows.push(fail('是否消毒耗材仅可填 是/否')); continue; }
    /* 可选尾列（片 4 期初导入扩列）：进价(元)/库存下限/库存上限——空=NULL 不设 */
    const numOpt = (raw: string | undefined, label: string, max: number): { v: number | null } | { err: string } => {
      if (raw === undefined || raw === '') return { v: null };
      const m = /^(\d+)(\.\d{1,2})?$/.exec(raw);
      if (!m) return { err: `${label}须为数字（最多两位小数）` };
      const fen = Math.round(parseFloat(raw) * 100);
      if (fen < 0 || fen > max) return { err: `${label}超上限` };
      return { v: fen };
    };
    const costOpt = numOpt(costRaw, '进价', 100_000_00);
    if ('err' in costOpt) { rows.push(fail(costOpt.err!)); continue; }
    const intOpt = (raw: string | undefined, label: string): { v: number | null } | { err: string } => {
      if (raw === undefined || raw === '') return { v: null };
      if (!/^\d+$/.test(raw)) return { err: `${label}须为非负整数` };
      const n = parseInt(raw, 10);
      if (n > 1_000_000) return { err: `${label}超出合理上限` };
      return { v: n };
    };
    const minOpt = intOpt(minRaw, '库存下限');
    if ('err' in minOpt) { rows.push(fail(minOpt.err!)); continue; }
    const maxOpt = intOpt(maxRaw, '库存上限');
    if ('err' in maxOpt) { rows.push(fail(maxOpt.err!)); continue; }
    if (minOpt.v !== null && maxOpt.v !== null && minOpt.v > maxOpt.v) { rows.push(fail('库存下限不可大于上限')); continue; }
    rows.push({ line, ok: true, category, name, description: description || undefined, priceFen, stock, isSupply: supplyRaw === '是', costFen: costOpt.v, minStock: minOpt.v, maxStock: maxOpt.v });
  }
  const failRows = rows.filter((r) => !r.ok);
  return {
    rows,
    report: {
      totalRows: rows.length,
      okRows: rows.length - failRows.length,
      failRows: failRows.length,
      failReasons: failRows.map((r) => ({ line: r.line, error: r.error })),
      note: 'preview 零写入；execute=全量或零（失败行回显零落账）',
    },
  };
}
