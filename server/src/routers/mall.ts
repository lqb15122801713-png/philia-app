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
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, like, lt, or, sql, type SQL } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { db, schema } from '../db';
import { customerProcedure, merchantProcedure, publicProcedure, router } from '../trpc';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { getPaymentProvider } from '../payments/provider';

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

/** 人类可读订单号：P + yyMMdd + 6 位去混淆随机段（≤20 字符，全局唯一靠 UNIQUE 索引 + 重试） */
function genOrderNo(now: Date): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  let rand = '';
  for (let i = 0; i < 6; i++) rand += ORDER_NO_ALPHABET[randomInt(ORDER_NO_ALPHABET.length)];
  return `P${yy}${mm}${dd}${rand}`;
}

async function getOrderOrThrow(d: DbHandle, orderId: string): Promise<OrderRow> {
  const row = await d.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
  return row;
}

/** 列表项：订单行 + 门店名（+ 商家端队列里的客户昵称） */
type OrderListItem = OrderRow & { storeName: string | null; customerNickname?: string | null };

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
/* router                                                               */
/* ------------------------------------------------------------------ */

export const mallRouter = router({
  /**
   * 1. listProducts（public）：商品目录。仅上架（status=on）；
   * 支持 storeId / category 过滤、keyword 搜索（name/description 模糊）、分页。
   */
  listProducts: publicProcedure
    .input(
      z.object({
        storeId: z.string().min(1).optional(),
        category: z.string().min(1).max(32).optional(),
        keyword: z.string().min(1).max(64).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conds: SQL[] = [eq(schema.products.status, 'on')];
      if (input.storeId) conds.push(eq(schema.products.storeId, input.storeId));
      if (input.category) conds.push(eq(schema.products.category, input.category));
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
  upsertProduct: merchantProcedure
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
   */
  listProductsForStore: merchantProcedure
    .input(
      z.object({
        category: z.string().min(1).max(32).optional(),
        keyword: z.string().min(1).max(64).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conds: SQL[] = [eq(schema.products.storeId, ctx.user.storeId!)];
      if (input.category) conds.push(eq(schema.products.category, input.category));
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

  /**
   * 4. createOrder（customer）★：下单。
   * 事务内：逐商品校验 status=on → 条件扣减库存（stock>=qty，影响行数=0 抛
   * CONFLICT 回滚）→ 服务端口径重算 total_fen → 生成订单号 → 建 pending 订单
   * （items 快照含 name/priceFen/image）→ emitEvent(store, order.created)。
   * 订单号撞唯一索引时换号整体重试（同预约人工码模式）。
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
        address: z.object({
          name: z.string().min(1).max(64),
          phone: z.string().min(3).max(20),
          detail: z.string().min(1).max(255),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
                address: {
                  receiver: input.address.name,
                  phone: input.address.phone,
                  detail: input.address.detail,
                },
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

  /** 6. listMyOrders（customer）：我的订单按状态分组（六态齐全，附门店名） */
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
      if (bucket) bucket.push({ ...r.order, storeName: r.storeName });
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
   * emitEvent(user:{customerId}, order.shipped)。
   */
  shipOrder: merchantProcedure
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
          .set({ status: 'shipped', trackingNo: input.trackingNo, updatedAt: now })
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
   */
  listStoreOrders: merchantProcedure.query(async ({ ctx }) => {
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
    const groups = groupOrders(STORE_QUEUE_STATUSES);
    for (const r of rows) {
      groups[r.order.status]?.push({
        ...r.order,
        storeName: null,
        customerNickname: r.customerNickname,
      });
    }
    return { groups };
  }),
});
