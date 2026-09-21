/**
 * 库存 router（批次 员工端2.0 · R8，任务书 V1.1 §三）
 * 地基=stock_movements：任何库存变动落流水行（来源单号+delta+前后值+操作人）；
 * 盘点状态机 draft→counted→confirmed→posted（店长确认才入账，confirm 前零库存写入）；
 * 安心包单独成类+效期≤30 天预警；消毒步扣减联动落流水。
 *
 * 端点闸门（设计底稿 §四 + 任务书 §三.6 权限矩阵）：
 * - 盘点建单派任务：merchantManagerProcedure（店长按店派任务/老板）——assignCount；
 * - 盘点执行/录入：staffProcedure（店员执行）——myCountTasks / recordItems；
 * - 盘点确认/驳回：merchantManagerProcedure（店长或老板，红线 4「店长确认才入账」）——
 *   confirmCount / rejectCount；
 * - 流水账/全量盘点单查看：merchantProcedure（商家三级本店）——listMovements / listCounts；
 * - 安心包效期预警（本批只读展示）：staffProcedure + merchantProcedure 双薄端点
 *   （staff 端安心包页 / 店长视图共用 loadCarePackageExpiry）。
 *
 * 口径：
 * - 日盘：本店 products.price_fen ≥ 10000（单价≥100 元）商品；周盘/盲盘：全量
 *   （含 category='care_package' 安心包耗材）；盲盘以 type='blind' 为标记。
 * - 建单快照 system_stock=当时账面库存；实盘 actual_stock NULL=未录入。
 * - 差异符号：盘亏 delta<0 / 盘盈 delta>0（UI 红/绿）。
 * - 驳回（rejected）=退回重盘：店员可重新录入，recordItems 后状态回到 counted。
 */
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type db } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  merchantManagerProcedure,
  merchantProcedure,
  router,
  staffProcedure,
} from '../trpc';

/* ------------------------------------------------------------------ */
/* 常量与工具                                                            */
/* ------------------------------------------------------------------ */

/** 流水来源枚举（schema text 列的应用层约束，见 stock_movements 头注） */
const SOURCE_TYPES = ['cashier', 'reversal', 'count', 'disinfection', 'manual'] as const;

/** 盘点类型 / 状态枚举（schema text 列的应用层约束） */
const COUNT_TYPES = ['daily', 'weekly', 'blind'] as const;
const COUNT_STATUSES = ['draft', 'counted', 'confirmed', 'posted', 'rejected'] as const;

/** 日盘门槛：单价 ≥100 元（任务书 §三.5：单价≥100 元商品每日日盘） */
const DAILY_MIN_PRICE_FEN = 10000;

/** 安心包效期预警窗口：≤30 天（任务书 §三.4，本批只读展示，处置=既有回收登记） */
const EXPIRY_WARN_DAYS = 30;
const DAY_MS = 86_400_000;

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言，同 cashier.txDb） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

/** 查询最小接口：全局 db 与事务 handle 结构上都满足 select */
type Q = Pick<typeof db, 'select'>;

// 注意：必须用 function 声明（而非箭头函数常量），TS 才会把「返回 never 的调用」
// 当作控制流终止点，从而在 if (!x) badRequest(...) 之后正确收窄 x 为非空。
function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}
function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

/* ------------------------------------------------------------------ */
/* 内部查询助手                                                          */
/* ------------------------------------------------------------------ */

/**
 * 盘点单 + 行项（含商品名/分类）装配：staff 执行视图与 merchant 管理视图共用。
 * statuses 缺省 = 全状态（含 posted）；行项按 count_id 分组回填。
 */
async function listCountsWithItems(d: Q, storeId: string, statuses?: string[]) {
  const conds = [eq(schema.inventoryCounts.storeId, storeId)];
  if (statuses && statuses.length > 0) {
    conds.push(inArray(schema.inventoryCounts.status, statuses));
  }
  const counts = await d
    .select()
    .from(schema.inventoryCounts)
    .where(and(...conds))
    .orderBy(desc(schema.inventoryCounts.createdAt));
  if (counts.length === 0) return [];
  const itemRows = await d
    .select({
      item: schema.inventoryCountItems,
      productName: schema.products.name,
      productCategory: schema.products.category,
    })
    .from(schema.inventoryCountItems)
    .leftJoin(schema.products, eq(schema.inventoryCountItems.productId, schema.products.id))
    .where(
      inArray(
        schema.inventoryCountItems.countId,
        counts.map((c) => c.id),
      ),
    );
  const byCount = new Map<
    string,
    Array<typeof schema.inventoryCountItems.$inferSelect & {
      productName: string | null;
      productCategory: string | null;
    }>
  >();
  for (const r of itemRows) {
    const arr = byCount.get(r.item.countId) ?? [];
    arr.push({ ...r.item, productName: r.productName, productCategory: r.productCategory });
    byCount.set(r.item.countId, arr);
  }
  return counts.map((c) => ({ ...c, items: byCount.get(c.id) ?? [] }));
}

/**
 * 安心包效期预警（只读）：本店 category='care_package' 且 expires_at 非空、
 * ≤30 天内到期（含已过期，expires_at ≤ now+30d）商品，按效期升序。
 * daysLeft = floor((expiresAt - now) / 1d)：已过期为负数，当天到期为 0。
 */
async function loadCarePackageExpiry(d: Q, storeId: string) {
  const nowMs = Date.now();
  const horizon = new Date(nowMs + EXPIRY_WARN_DAYS * DAY_MS);
  const rows = await d
    .select({
      id: schema.products.id,
      name: schema.products.name,
      expiresAt: schema.products.expiresAt,
      stock: schema.products.stock,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.storeId, storeId),
        eq(schema.products.category, 'care_package'),
        isNotNull(schema.products.expiresAt),
        lte(schema.products.expiresAt, horizon),
      ),
    )
    .orderBy(asc(schema.products.expiresAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    expiresAt: r.expiresAt!,
    daysLeft: Math.floor((r.expiresAt!.getTime() - nowMs) / DAY_MS),
    stock: r.stock,
  }));
}

/** 盘点单加载 + 本店归属校验（不存在 NOT_FOUND / 跨店 FORBIDDEN） */
async function loadOwnCount(d: Q, storeId: string, countId: string) {
  const count = await d
    .select()
    .from(schema.inventoryCounts)
    .where(eq(schema.inventoryCounts.id, countId))
    .get();
  if (!count) notFound('盘点单不存在');
  if (count.storeId !== storeId) forbidden('非本店盘点单，无权操作');
  return count;
}

export const inventoryRouter = router({
  /**
   * 1. listMovements（merchant 本店三级）：库存流水账，最新在前，含商品名。
   * from/to 为 Unix 秒（含边界）；limit ≤200，默认 100。
   */
  listMovements: merchantProcedure
    .input(
      z.object({
        productId: z.string().min(1).optional(),
        sourceType: z.enum(SOURCE_TYPES).optional(),
        from: z.number().int().optional(),
        to: z.number().int().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const conds = [eq(schema.stockMovements.storeId, storeId)];
      if (input.productId) conds.push(eq(schema.stockMovements.productId, input.productId));
      if (input.sourceType) conds.push(eq(schema.stockMovements.sourceType, input.sourceType));
      if (input.from !== undefined) {
        conds.push(gte(schema.stockMovements.createdAt, new Date(input.from * 1000)));
      }
      if (input.to !== undefined) {
        conds.push(lte(schema.stockMovements.createdAt, new Date(input.to * 1000)));
      }
      const rows = await ctx.db
        .select({ movement: schema.stockMovements, productName: schema.products.name })
        .from(schema.stockMovements)
        .leftJoin(schema.products, eq(schema.stockMovements.productId, schema.products.id))
        .where(and(...conds))
        .orderBy(desc(schema.stockMovements.createdAt))
        .limit(input.limit);
      return rows.map((r) => ({ ...r.movement, productName: r.productName }));
    }),

  /**
   * 2. assignCount（店长/老板）：按店派盘点任务——建 draft 单 + 账面快照行项。
   * daily=单价≥100 元商品；weekly/blind=全量（含安心包）；盲盘以 type 为标记。
   * 同事务建单建行（失败整体回滚）；无符合条件的商品时建空单（店长决策，不硬拦）。
   */
  assignCount: merchantManagerProcedure
    .input(z.object({ type: z.enum(COUNT_TYPES) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const conds = [eq(schema.products.storeId, storeId)];
        if (input.type === 'daily') {
          conds.push(gte(schema.products.priceFen, DAILY_MIN_PRICE_FEN));
        }
        const prods = await tx
          .select({ id: schema.products.id, stock: schema.products.stock })
          .from(schema.products)
          .where(and(...conds));
        const count = await tx
          .insert(schema.inventoryCounts)
          .values({ storeId, type: input.type, status: 'draft', createdBy: ctx.user.id })
          .returning()
          .then((r) => r[0]!);
        if (prods.length > 0) {
          await tx.insert(schema.inventoryCountItems).values(
            prods.map((p) => ({
              countId: count.id,
              productId: p.id,
              systemStock: p.stock, // 建单时账面快照（confirm 入账以此为 beforeStock）
            })),
          );
        }
        return { ...count, itemCount: prods.length };
      });
    }),

  /**
   * 3. myCountTasks（staff 本店）：待办盘点单 = draft（待盘）+ counted（待确认可查）
   *    + rejected（退回重盘，可重新录入），含行项与商品名。
   */
  myCountTasks: staffProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    return listCountsWithItems(ctx.db, storeId, ['draft', 'counted', 'rejected']);
  }),

  /**
   * 4. listCounts（merchant 本店三级）：全量盘点单（含 posted 历史），可按状态过滤。
   */
  listCounts: merchantProcedure
    .input(z.object({ status: z.enum(COUNT_STATUSES).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return listCountsWithItems(ctx.db, storeId, input?.status ? [input.status] : undefined);
    }),

  /**
   * 5. recordItems（staff 本店）：实盘录入。仅 draft / rejected（退回重盘）可录入；
   * 录入后 status→counted（待店长确认）。行项必须属于该单，否则整体回滚。
   * confirm 前零库存写入——本端点只写盘点行，不动 products.stock。
   */
  recordItems: staffProcedure
    .input(
      z.object({
        countId: z.string().min(1),
        items: z
          .array(
            z.object({
              itemId: z.string().min(1),
              actualStock: z.number().int().min(0, '实盘数不能为负'),
            }),
          )
          .min(1, '至少录入一行实盘数'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const count = await loadOwnCount(tx, storeId, input.countId);
        if (count.status !== 'draft' && count.status !== 'rejected') {
          badRequest(`当前状态（${count.status}）不可录入实盘数，仅草稿/退回重盘单可录入`);
        }
        const rows = await tx
          .select({ id: schema.inventoryCountItems.id })
          .from(schema.inventoryCountItems)
          .where(eq(schema.inventoryCountItems.countId, count.id));
        const rowIds = new Set(rows.map((r) => r.id));
        const now = new Date();
        for (const it of input.items) {
          if (!rowIds.has(it.itemId)) badRequest('存在不属于该盘点单的行项，已回滚');
          await tx
            .update(schema.inventoryCountItems)
            .set({ actualStock: it.actualStock, updatedAt: now })
            .where(eq(schema.inventoryCountItems.id, it.itemId));
        }
        // 退回重盘：rejected 重新录入后回到 counted（任务书 §三.3 驳回→退回重盘）
        return tx
          .update(schema.inventoryCounts)
          .set({ status: 'counted', updatedAt: now })
          .where(eq(schema.inventoryCounts.id, count.id))
          .returning()
          .then((r) => r[0]!);
      });
    }),

  /**
   * 6. confirmCount（店长/老板 · 红线 4「店长确认才入账」）：
   * 状态闸门 counted（confirm 前零库存写入由状态机保证）；存在未录入行 → 拒绝；
   * 事务内按差异落 stock_movements（sourceType='count'，sourceId=盘点单 id，
   * beforeStock=建单快照 systemStock，afterStock=实盘 actualStock；盘亏 delta<0 /
   * 盘盈 delta>0）+ 更新 products.stock=实盘数 + status→posted（confirmedBy/
   * confirmedAt/postedAt 留痕）；emit stock.countConfirmed {countId, diffs}。
   */
  confirmCount: merchantManagerProcedure
    .input(z.object({ countId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const outboxIds: string[] = [];
      const result = await ctx.db.transaction(async (tx) => {
        const count = await loadOwnCount(tx, storeId, input.countId);
        if (count.status !== 'counted') {
          badRequest(`当前状态（${count.status}）不可确认入账，仅已录入（counted）单可确认`);
        }
        const items = await tx
          .select()
          .from(schema.inventoryCountItems)
          .where(eq(schema.inventoryCountItems.countId, count.id));
        if (items.some((r) => r.actualStock === null)) {
          badRequest('存在未录入实盘数的行项，请先完成全盘录入再确认');
        }
        const now = new Date();
        let diffs = 0;
        for (const it of items) {
          const actual = it.actualStock!;
          if (actual === it.systemStock) continue; // 无差异不落流水不动账
          diffs += 1;
          await tx.insert(schema.stockMovements).values({
            storeId,
            productId: it.productId,
            sourceType: 'count',
            sourceId: count.id,
            delta: actual - it.systemStock, // 盘亏<0 / 盘盈>0（UI 红/绿）
            beforeStock: it.systemStock,
            afterStock: actual,
            operatorId: ctx.user.id,
          });
          await tx
            .update(schema.products)
            .set({ stock: actual, updatedAt: now })
            .where(eq(schema.products.id, it.productId));
        }
        const posted = await tx
          .update(schema.inventoryCounts)
          .set({
            status: 'posted',
            confirmedBy: ctx.user.id,
            confirmedAt: now,
            postedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.inventoryCounts.id, count.id))
          .returning()
          .then((r) => r[0]!);
        outboxIds.push(
          await emitEvent(txDb(tx), `store:${storeId}`, EventType.StockCountConfirmed, {
            countId: count.id,
            type: count.type,
            diffs,
            by: ctx.user.id, // 总规则①：留痕含操作人
          }),
        );
        return { count: posted, diffs };
      });
      outboxIds.forEach(broadcastNow);
      return result;
    }),

  /**
   * 7. rejectCount（店长/老板）：counted → rejected（退回重盘，店员可重新录入）。
   * note 必填（驳回说明，随响应回传前端展示）。
   */
  rejectCount: merchantManagerProcedure
    .input(
      z.object({
        countId: z.string().min(1),
        note: z.string().trim().min(1, '驳回必须填写说明').max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const count = await loadOwnCount(ctx.db, storeId, input.countId);
      if (count.status !== 'counted') {
        badRequest(`当前状态（${count.status}）不可驳回，仅已录入（counted）单可驳回`);
      }
      const updated = await ctx.db
        .update(schema.inventoryCounts)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(schema.inventoryCounts.id, count.id))
        .returning()
        .then((r) => r[0]!);
      return { ...updated, rejectNote: input.note };
    }),

  /**
   * 8. 安心包效期预警（只读 · 任务书 §三.4 本批只读展示，处置=既有回收登记）：
   * staff 端安心包页 / 店长视图双薄端点，共用 loadCarePackageExpiry。
   */
  carePackageExpiryStaff: staffProcedure.query(async ({ ctx }) => {
    return loadCarePackageExpiry(ctx.db, ctx.user.storeId!);
  }),

  carePackageExpiryMerchant: merchantProcedure.query(async ({ ctx }) => {
    return loadCarePackageExpiry(ctx.db, ctx.user.storeId!);
  }),
});
