/**
 * 库存域 router 第二段（商家端大批片 4 · 0055；inventory.ts 为盘点/流水域，本文件=批次/
 * 预警/估清/报损/供应商/采购/要货/调拨/审批中心）：
 * - 批次 productBatches：收货入批（采购收货/手工入批）/列表/过期隔离（quarantine：批次
 *   qty 同步扣出 products.stock 留痕，隔离批次不计可售）/销毁登记（destroyed，扣减留痕）；
 * - 效期分级：expiry_date 自动=production+shelfLifeDays；分级=expired/urgent(≤expiry_urgent_days
 *   缺省 7)/warn(≤expiry_warn_days 缺省 30)/ok（阈值 service_rules 端口留口）；
 * - FEFO 出库建议序（开口项 2 裁：建议+预警，不强制改既有扣减链）：按品 expiry 升序
 *   qty>0 active 批序；非 FEFO 出库=预警注记（不拦截）；
 * - 上下限预警：stock<min_stock=缺 / stock>max_stock=溢（NULL 不设）；
 * - 缺货禁售·估清：手动估清（stock 归零+流水留痕）/恢复（补货回 stock）；
 * - 采购：suppliers CRUD + purchase_orders（draft→submitted[进审批]→approved→received
 *   [逐行生成批次+products.stock 累加+movements 流水]）；
 * - 报损：当场录入（pending 进审批）→approved 扣库存前后值（products.stock+batch.qty）；
 * - 要货：建议量=max(0, maxStock−stock) 读口 + 申请（pending 进审批）→approved→fulfilled；
 * - 调拨：发起（pending 进审批）→approved→ship（转出扣 stock 在途归属=in_transit 双侧
 *   不可售）→receive（转入店按商品名匹配/无则档案复制，stock 累加+双侧 movements 流水）；
 *   在途库存视图+超时预警（transfer_in_transit_warn_hours 缺省 24h）；
 * - 审批中心：approval_requests 通用四类（purchase/replenish/transfer/writeoff），
 *   owner|manager review+note 留痕（timeline 只增不改）；店域闸=本店（跨店 NOT_FOUND 统一口径）。
 * 涉钱零新规：进价/成本=台账字段不写支付链（开口项 4 裁）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { resolveScopedRules } from './configRules';
import { merchantManagerProcedure, router } from '../trpc';

const badRequest = (m: string): never => {
  throw new TRPCError({ code: 'BAD_REQUEST', message: m });
};
const notFound = (m = '单据不存在'): never => {
  throw new TRPCError({ code: 'NOT_FOUND', message: m });
};
/** 取非空行（get() 后守卫收窄单源；undefined → NOT_FOUND 统一防探测口径） */
const mustGet = <T>(v: T | undefined, msg: string): T => {
  if (v === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: msg });
  return v;
};

type DbHandle = Parameters<typeof import('../realtime/bus').emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

/** 规则值读口（service_rules 分层解析；缺省 fallback） */
async function ruleNum(d: DbHandle, ruleKey: string, storeId: string, path: string, fallback: number): Promise<number> {
  const rows = await d
    .select({ ruleKey: schema.serviceRules.ruleKey, storeId: schema.serviceRules.storeId, valueJson: schema.serviceRules.valueJson })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, ruleKey), eq(schema.serviceRules.active, true)));
  const v = (resolveScopedRules(rows, storeId)[0]?.valueJson as Record<string, unknown> | undefined)?.[path];
  return typeof v === 'number' && v >= 0 ? v : fallback;
}

/** 单号生成（前缀-yyyymmdd-3 位序号，按表当日行数+1） */
async function genOrderNo(d: DbHandle, table: 'purchase_orders' | 'transfer_orders', prefix: string, _storeId: string): Promise<string> {
  void _storeId;
  const w = new Date();
  const ymd = `${w.getFullYear()}${String(w.getMonth() + 1).padStart(2, '0')}${String(w.getDate()).padStart(2, '0')}`;
  const col = table === 'purchase_orders' ? schema.purchaseOrders.orderNo : schema.transferOrders.orderNo;
  const tbl = table === 'purchase_orders' ? schema.purchaseOrders : schema.transferOrders;
  const rows = await d
    .select({ orderNo: col })
    .from(tbl)
    .where(sql`${col} LIKE ${`${prefix}-${ymd}-%`}`)
    .orderBy(desc(col))
    .limit(1);
  const last = rows[0]?.orderNo;
  const seq = last ? Number(last.slice(-3)) + 1 : 1;
  return `${prefix}-${ymd}-${String(seq).padStart(3, '0')}`;
}

/** 效期分级（纯函数）：expired=已过期 / urgent=≤急阈值 / warn=≤临阈值 / ok */
export function expiryGrade(daysLeft: number, urgentDays: number, warnDays: number): 'expired' | 'urgent' | 'warn' | 'ok' {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= urgentDays) return 'urgent';
  if (daysLeft <= warnDays) return 'warn';
  return 'ok';
}

async function loadProduct(d: DbHandle, storeId: string, productId: string) {
  const p = await d.select().from(schema.products).where(eq(schema.products.id, productId)).get();
  if (!p || p.storeId !== storeId) notFound('商品不存在');
  return p!;
}

/** 库存流水（sourceType 自证口径；与 inventory.ts 同表，before/after 快照全列） */
async function addMovement(
  d: DbHandle,
  row: { storeId: string; productId: string; delta: number; beforeStock: number; afterStock: number; sourceType: string; sourceId?: string | null; note?: string | null; operatorId: string },
) {
  await d.insert(schema.stockMovements).values({
    storeId: row.storeId,
    productId: row.productId,
    delta: row.delta,
    beforeStock: row.beforeStock,
    afterStock: row.afterStock,
    sourceType: row.sourceType as never,
    sourceId: row.sourceId ?? null,
    note: row.note ?? null,
    operatorId: row.operatorId,
  });
}

/** 审批落行（四类共用；timeline 只增不改） */
async function raiseApproval(
  d: DbHandle,
  input: { storeId: string; kind: 'purchase' | 'replenish' | 'transfer' | 'writeoff'; refId: string; summary: string; applicantId: string },
) {
  await d.insert(schema.approvalRequests).values({
    storeId: input.storeId,
    kind: input.kind,
    refId: input.refId,
    summary: input.summary,
    status: 'pending',
    applicantId: input.applicantId,
    timelineJson: [{ at: new Date().toISOString(), action: 'submitted', by: input.applicantId }],
  });
}

export const stock2Router = router({
  /* ------------------------------------------------------------------ */
  /* 批次管理                                                            */
  /* ------------------------------------------------------------------ */

  /** 手工入批（采购收货外的补充口；效期=生产+保质自动计算） */
  batchCreate: merchantManagerProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        batchNo: z.string().trim().min(1, '批号必填').max(64),
        qty: z.number().int().min(1).max(1_000_000),
        productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        shelfLifeDays: z.number().int().min(1).max(36500).optional(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const product = await loadProduct(ctx.db, storeId, input.productId);
      const dup = await ctx.db
        .select({ id: schema.productBatches.id })
        .from(schema.productBatches)
        .where(and(eq(schema.productBatches.productId, product.id), eq(schema.productBatches.batchNo, input.batchNo), eq(schema.productBatches.storeId, storeId)))
        .get();
      if (dup) badRequest(`批号 ${input.batchNo} 已存在（同品同店批号唯一）`);
      const productionDate = input.productionDate ? new Date(`${input.productionDate}T00:00:00Z`) : null;
      const expiryDate = productionDate && input.shelfLifeDays ? new Date(productionDate.getTime() + input.shelfLifeDays * 24 * 3600 * 1000) : null;
      return ctx.db.transaction(async (tx) => {
        const [batch] = await tx
          .insert(schema.productBatches)
          .values({
            storeId,
            productId: product.id,
            batchNo: input.batchNo,
            productionDate,
            shelfLifeDays: input.shelfLifeDays ?? null,
            expiryDate,
            qty: input.qty,
            note: input.note ?? null,
          })
          .returning();
        await tx
          .update(schema.products)
          .set({ stock: product.stock + input.qty, updatedAt: new Date() })
          .where(eq(schema.products.id, product.id));
        await addMovement(txDb(tx), {
          storeId,
          productId: product.id,
          delta: input.qty,
          beforeStock: product.stock,
          afterStock: product.stock + input.qty,
          sourceType: 'batch_in',
          sourceId: batch!.id,
          note: `批次入批 ${input.batchNo}`,
          operatorId: ctx.user.id,
        });
        return { batch };
      });
    }),

  batchList: merchantManagerProcedure
    .input(z.object({ productId: z.string().min(1).optional(), status: z.enum(['active', 'quarantined', 'destroyed']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const urgentDays = await ruleNum(ctx.db, 'expiry_urgent_days', storeId, 'days', 7);
      const warnDays = await ruleNum(ctx.db, 'expiry_warn_days', storeId, 'days', 30);
      const conds = [eq(schema.productBatches.storeId, storeId)];
      if (input?.productId) conds.push(eq(schema.productBatches.productId, input.productId));
      if (input?.status) conds.push(eq(schema.productBatches.status, input.status));
      const rows = await ctx.db
        .select({ batch: schema.productBatches, productName: schema.products.name })
        .from(schema.productBatches)
        .innerJoin(schema.products, eq(schema.products.id, schema.productBatches.productId))
        .where(and(...conds))
        .orderBy(schema.productBatches.expiryDate, desc(schema.productBatches.createdAt))
        .limit(500);
      const now = Date.now();
      return {
        urgentDays,
        warnDays,
        items: rows.map((r) => {
          const daysLeft = r.batch.expiryDate ? Math.floor((r.batch.expiryDate.getTime() - now) / (24 * 3600 * 1000)) : null;
          return {
            ...r.batch,
            productName: r.productName,
            daysLeft,
            grade: daysLeft === null ? 'ok' : expiryGrade(daysLeft, urgentDays, warnDays),
          };
        }),
      };
    }),

  /** 过期隔离（批次→quarantined：qty 同步扣出 products.stock+流水留痕；幂等=已隔离读回） */
  batchQuarantine: merchantManagerProcedure
    .input(z.object({ batchId: z.string().min(1), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const batch = mustGet(await tx.select().from(schema.productBatches).where(eq(schema.productBatches.id, input.batchId)).get(), '批次不存在');
        if (batch.storeId !== storeId) notFound('批次不存在');
        if (batch.status === 'quarantined') return { batch, idempotent: true as const };
        if (batch.status === 'destroyed') badRequest('已销毁批次不可再隔离');
        const product = await tx.select().from(schema.products).where(eq(schema.products.id, batch.productId)).get();
        const deduct = Math.min(batch.qty, Math.max(0, product?.stock ?? 0));
        const [updated] = await tx
          .update(schema.productBatches)
          .set({ status: 'quarantined', note: input.note ?? batch.note, updatedAt: new Date() })
          .where(eq(schema.productBatches.id, batch.id))
          .returning();
        if (deduct > 0 && product) {
          await tx.update(schema.products).set({ stock: product.stock - deduct, updatedAt: new Date() }).where(eq(schema.products.id, product.id));
          await addMovement(txDb(tx), {
            storeId,
            productId: product.id,
            delta: -deduct,
            beforeStock: product.stock,
            afterStock: product.stock - deduct,
            sourceType: 'quarantine',
            sourceId: batch.id,
            note: `过期隔离 ${batch.batchNo}${input.note ? `：${input.note}` : ''}`,
            operatorId: ctx.user.id,
          });
        }
        return { batch: updated, idempotent: false as const, deductedFen: deduct };
      });
    }),

  /** 销毁登记（quarantined→destroyed；批次 qty 清零+留痕） */
  batchDestroy: merchantManagerProcedure
    .input(z.object({ batchId: z.string().min(1), note: z.string().trim().min(1, '销毁事由必填').max(200) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const batch = mustGet(await tx.select().from(schema.productBatches).where(eq(schema.productBatches.id, input.batchId)).get(), '批次不存在');
        if (batch.storeId !== storeId) notFound('批次不存在');
        if (batch.status === 'destroyed') return { batch, idempotent: true as const };
        if (batch.qty > 0 && batch.status !== 'quarantined') {
          badRequest('销毁仅限已隔离批次（请先过期隔离）');
        }
        const [updated] = await tx
          .update(schema.productBatches)
          .set({ status: 'destroyed', qty: 0, note: input.note, updatedAt: new Date() })
          .where(eq(schema.productBatches.id, batch.id))
          .returning();
        return { batch: updated, idempotent: false as const };
      });
    }),

  /** FEFO 出库建议序（开口项 2 裁：建议+预警不强制）：active 且 qty>0 批按效期升序；
      返回首位=建议先出批；非 FEFO 出库预警=读口注记（不拦截） */
  fefoSuggestion: merchantManagerProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      await loadProduct(ctx.db, storeId, input.productId);
      const now = Date.now();
      const rows = await ctx.db
        .select()
        .from(schema.productBatches)
        .where(
          and(
            eq(schema.productBatches.storeId, storeId),
            eq(schema.productBatches.productId, input.productId),
            eq(schema.productBatches.status, 'active'),
            gt(schema.productBatches.qty, 0),
          ),
        )
        .orderBy(schema.productBatches.expiryDate);
      const usable = rows.filter((b) => !b.expiryDate || b.expiryDate.getTime() >= now);
      return {
        suggestion: usable[0] ?? null,
        sequence: usable.map((b) => ({ batchId: b.id, batchNo: b.batchNo, expiryDate: b.expiryDate, qty: b.qty })),
        note: 'FEFO 建议序（开口项 2 裁=先出建议+预警，不强制改既有扣减链）；非建议批出库=预警注记不拦截',
      };
    }),

  /** 效期看板（临期分级徽数据源；含过期未隔离预警） */
  expiryBoard: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const urgentDays = await ruleNum(ctx.db, 'expiry_urgent_days', storeId, 'days', 7);
    const warnDays = await ruleNum(ctx.db, 'expiry_warn_days', storeId, 'days', 30);
    const rows = await ctx.db
      .select({ batch: schema.productBatches, productName: schema.products.name })
      .from(schema.productBatches)
      .innerJoin(schema.products, eq(schema.products.id, schema.productBatches.productId))
      .where(and(eq(schema.productBatches.storeId, storeId), eq(schema.productBatches.status, 'active'), gt(schema.productBatches.qty, 0)))
      .orderBy(schema.productBatches.expiryDate);
    const now = Date.now();
    const items = rows
      .map((r) => {
        const daysLeft = r.batch.expiryDate ? Math.floor((r.batch.expiryDate.getTime() - now) / (24 * 3600 * 1000)) : null;
        return { ...r.batch, productName: r.productName, daysLeft, grade: daysLeft === null ? 'ok' : expiryGrade(daysLeft, urgentDays, warnDays) };
      })
      .filter((r) => r.grade !== 'ok');
    return { urgentDays, warnDays, items };
  }),

  /* ------------------------------------------------------------------ */
  /* 上下限预警 / 缺货禁售·估清                                            */
  /* ------------------------------------------------------------------ */

  /** 上下限预警读口：stock<min=缺（含建议量=max−stock）/ stock>max=溢 */
  stockAlerts: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.storeId, ctx.user.storeId!), eq(schema.products.status, 'on')));
    const low = rows
      .filter((p) => p.minStock !== null && p.stock < p.minStock)
      .map((p) => ({ productId: p.id, name: p.name, stock: p.stock, minStock: p.minStock, suggestQty: Math.max(0, (p.maxStock ?? p.minStock!) - p.stock) }));
    const high = rows
      .filter((p) => p.maxStock !== null && p.stock > p.maxStock)
      .map((p) => ({ productId: p.id, name: p.name, stock: p.stock, maxStock: p.maxStock }));
    return { low, high };
  }),

  /** 手动估清（商品级：stock 归零+流水留痕；缺货禁售=商城下单 stock>=qty 既有闸拦零） */
  markSoldOut: merchantManagerProcedure
    .input(z.object({ productId: z.string().min(1), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const product = await loadProduct(txDb(tx), storeId, input.productId);
        if (product.stock === 0) return { product, idempotent: true as const };
        const [updated] = await tx
          .update(schema.products)
          .set({ stock: 0, updatedAt: new Date() })
          .where(eq(schema.products.id, product.id))
          .returning();
        await addMovement(txDb(tx), {
          storeId,
          productId: product.id,
          delta: -product.stock,
          beforeStock: product.stock,
          afterStock: 0,
          sourceType: 'soldout',
          note: `手动估清${input.note ? `：${input.note}` : ''}`,
          operatorId: ctx.user.id,
        });
        return { product: updated, idempotent: false as const };
      });
    }),

  /** 估清恢复（补货回 stock+流水） */
  restockProduct: merchantManagerProcedure
    .input(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(1_000_000), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const product = await loadProduct(txDb(tx), storeId, input.productId);
        const [updated] = await tx
          .update(schema.products)
          .set({ stock: product.stock + input.qty, updatedAt: new Date() })
          .where(eq(schema.products.id, product.id))
          .returning();
        await addMovement(txDb(tx), {
          storeId,
          productId: product.id,
          delta: input.qty,
          beforeStock: product.stock,
          afterStock: product.stock + input.qty,
          sourceType: 'restock',
          note: input.note ?? '估清恢复补货',
          operatorId: ctx.user.id,
        });
        return { product: updated };
      });
    }),

  /* ------------------------------------------------------------------ */
  /* 报损（当场录入+审批）                                                 */
  /* ------------------------------------------------------------------ */

  writeoffCreate: merchantManagerProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(1_000_000),
        reason: z.string().trim().min(1, '报损原因必填').max(200),
        batchId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const product = await loadProduct(ctx.db, storeId, input.productId);
      if (input.qty > product.stock) badRequest(`报损数量超当前库存（现存 ${product.stock} 件）`);
      if (input.batchId) {
        const batch = mustGet(await ctx.db.select().from(schema.productBatches).where(eq(schema.productBatches.id, input.batchId)).get(), '批次不存在');
        if (batch.storeId !== storeId || batch.productId !== product.id) notFound('批次不存在');
      }
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.stockWriteoffs)
          .values({ storeId, productId: product.id, batchId: input.batchId ?? null, qty: input.qty, reason: input.reason, operatorId: ctx.user.id })
          .returning();
        await raiseApproval(txDb(tx), {
          storeId,
          kind: 'writeoff',
          refId: row!.id,
          summary: `报损：${product.name} ×${input.qty}（${input.reason}）`,
          applicantId: ctx.user.id,
        });
        return { writeoff: row };
      });
    }),

  writeoffList: merchantManagerProcedure
    .input(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.stockWriteoffs.storeId, ctx.user.storeId!)];
      if (input?.status) conds.push(eq(schema.stockWriteoffs.status, input.status));
      const rows = await ctx.db
        .select({ row: schema.stockWriteoffs, productName: schema.products.name, operatorName: schema.users.nickname })
        .from(schema.stockWriteoffs)
        .innerJoin(schema.products, eq(schema.products.id, schema.stockWriteoffs.productId))
        .leftJoin(schema.users, eq(schema.users.id, schema.stockWriteoffs.operatorId))
        .where(and(...conds))
        .orderBy(desc(schema.stockWriteoffs.createdAt))
        .limit(200);
      return rows.map((r) => ({ ...r.row, productName: r.productName, operatorName: r.operatorName ?? null }));
    }),

  /* ------------------------------------------------------------------ */
  /* 供应商 / 采购订单                                                    */
  /* ------------------------------------------------------------------ */

  supplierUpsert: merchantManagerProcedure
    .input(
      z.object({
        id: z.string().min(1).optional(),
        name: z.string().trim().min(1, '供应商名必填').max(64),
        contact: z.string().trim().max(64).optional(),
        phone: z.string().trim().max(32).optional(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      if (input.id) {
        const exist = await ctx.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, input.id)).get();
        if (!exist || exist.storeId !== storeId) notFound('供应商不存在');
        const [row] = await ctx.db
          .update(schema.suppliers)
          .set({ name: input.name, contact: input.contact ?? null, phone: input.phone ?? null, note: input.note ?? null, updatedAt: new Date() })
          .where(eq(schema.suppliers.id, input.id))
          .returning();
        return { supplier: row, created: false as const };
      }
      const [row] = await ctx.db
        .insert(schema.suppliers)
        .values({ storeId, name: input.name, contact: input.contact ?? null, phone: input.phone ?? null, note: input.note ?? null })
        .returning();
      return { supplier: row, created: true as const };
    }),

  supplierList: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.suppliers)
      .where(and(eq(schema.suppliers.storeId, ctx.user.storeId!), eq(schema.suppliers.status, 'active')))
      .orderBy(schema.suppliers.createdAt);
    return { items: rows };
  }),

  purchaseCreate: merchantManagerProcedure
    .input(
      z.object({
        supplierId: z.string().min(1).optional(),
        items: z.array(
          z.object({
            productId: z.string().min(1),
            qty: z.number().int().min(1).max(1_000_000),
            costFen: z.number().int().min(0).max(100_000_000).nullish(),
            batchNo: z.string().trim().max(64).optional(),
            productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            shelfLifeDays: z.number().int().min(1).max(36500).optional(),
          }),
        ).min(1, '采购行至少一行').max(100),
        expectAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      if (input.supplierId) {
        const sup = await ctx.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, input.supplierId)).get();
        if (!sup || sup.storeId !== storeId) notFound('供应商不存在');
      }
      const items: Array<{ productId: string; name: string; qty: number; costFen: number | null; batchNo?: string; productionDate?: string; shelfLifeDays?: number }> = [];
      for (const it of input.items) {
        const p = await loadProduct(ctx.db, storeId, it.productId);
        items.push({ productId: p.id, name: p.name, qty: it.qty, costFen: it.costFen ?? null, batchNo: it.batchNo, productionDate: it.productionDate, shelfLifeDays: it.shelfLifeDays });
      }
      return ctx.db.transaction(async (tx) => {
        const orderNo = await genOrderNo(txDb(tx), 'purchase_orders', 'PO', storeId);
        const [row] = await tx
          .insert(schema.purchaseOrders)
          .values({
            storeId,
            supplierId: input.supplierId ?? null,
            orderNo,
            status: 'draft',
            itemsJson: items,
            expectAt: input.expectAt ? new Date(`${input.expectAt}T00:00:00Z`) : null,
            note: input.note ?? null,
          })
          .returning();
        return { order: row };
      });
    }),

  /** 提交审批（draft→submitted+审批落行） */
  purchaseSubmit: merchantManagerProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const order = mustGet(await tx.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, input.orderId)).get(), '采购单不存在');
        if (order.storeId !== storeId) notFound('采购单不存在');
        if (order.status !== 'draft') badRequest(`当前状态（${order.status}）不可提交`);
        const totalQty = order.itemsJson.reduce((s, it) => s + it.qty, 0);
        const [updated] = await tx
          .update(schema.purchaseOrders)
          .set({ status: 'submitted', updatedAt: new Date() })
          .where(eq(schema.purchaseOrders.id, order.id))
          .returning();
        await raiseApproval(txDb(tx), {
          storeId,
          kind: 'purchase',
          refId: order.id,
          summary: `采购单 ${order.orderNo}：${order.itemsJson.length} 品 ${totalQty} 件`,
          applicantId: ctx.user.id,
        });
        return { order: updated };
      });
    }),

  /** 收货入批（approved→received：逐行生成批次+products.stock 累加+movements 流水；幂等=已收货读回） */
  purchaseReceive: merchantManagerProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const order = mustGet(await tx.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, input.orderId)).get(), '采购单不存在');
        if (order.storeId !== storeId) notFound('采购单不存在');
        if (order.status === 'received') return { order, idempotent: true as const };
        if (order.status !== 'approved') badRequest(`当前状态（${order.status}）不可收货（须先经审批通过）`);
        for (const it of order.itemsJson) {
          const product = mustGet(await tx.select().from(schema.products).where(eq(schema.products.id, it.productId)).get(), `商品不存在：${it.name}`);
          const productionDate = it.productionDate ? new Date(`${it.productionDate}T00:00:00Z`) : null;
          const expiryDate = productionDate && it.shelfLifeDays ? new Date(productionDate.getTime() + it.shelfLifeDays * 24 * 3600 * 1000) : null;
          const batchNo = it.batchNo?.trim() || `${order.orderNo}-${it.productId.slice(-4)}`;
          const dup = await tx
            .select({ id: schema.productBatches.id })
            .from(schema.productBatches)
            .where(and(eq(schema.productBatches.productId, product.id), eq(schema.productBatches.batchNo, batchNo), eq(schema.productBatches.storeId, storeId)))
            .get();
          let batchId: string;
          if (dup) {
            await tx.update(schema.productBatches).set({ qty: sql`${schema.productBatches.qty} + ${it.qty}`, updatedAt: new Date() }).where(eq(schema.productBatches.id, dup.id));
            batchId = dup.id;
          } else {
            const [b] = await tx
              .insert(schema.productBatches)
              .values({ storeId, productId: product.id, batchNo, productionDate, shelfLifeDays: it.shelfLifeDays ?? null, expiryDate, qty: it.qty })
              .returning();
            batchId = b!.id;
          }
          await tx.update(schema.products).set({ stock: product.stock + it.qty, costFen: it.costFen ?? product.costFen, updatedAt: new Date() }).where(eq(schema.products.id, product.id));
          await addMovement(txDb(tx), {
            storeId,
            productId: product.id,
            delta: it.qty,
            beforeStock: product.stock,
            afterStock: product.stock + it.qty,
            sourceType: 'purchase',
            sourceId: order.id,
            note: `采购收货 ${order.orderNo} 批 ${batchNo}`,
            operatorId: ctx.user.id,
          });
          void batchId;
        }
        const [updated] = await tx
          .update(schema.purchaseOrders)
          .set({ status: 'received', receivedAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.purchaseOrders.id, order.id))
          .returning();
        return { order: updated, idempotent: false as const };
      });
    }),

  purchaseList: merchantManagerProcedure
    .input(z.object({ status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'received']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.purchaseOrders.storeId, ctx.user.storeId!)];
      if (input?.status) conds.push(eq(schema.purchaseOrders.status, input.status));
      const rows = await ctx.db
        .select({ order: schema.purchaseOrders, supplierName: schema.suppliers.name })
        .from(schema.purchaseOrders)
        .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.purchaseOrders.supplierId))
        .where(and(...conds))
        .orderBy(desc(schema.purchaseOrders.createdAt))
        .limit(200);
      return rows.map((r) => ({ ...r.order, supplierName: r.supplierName ?? null }));
    }),

  /* ------------------------------------------------------------------ */
  /* 要货/补货                                                           */
  /* ------------------------------------------------------------------ */

  /** 建议量读口：max(0, maxStock−stock)（无上限=按下限补到下限；双 NULL=不建议） */
  replenishSuggest: merchantManagerProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const product = await loadProduct(ctx.db, ctx.user.storeId!, input.productId);
      const target = product.maxStock ?? product.minStock;
      return { productId: product.id, name: product.name, stock: product.stock, minStock: product.minStock, maxStock: product.maxStock, suggestQty: target === null ? 0 : Math.max(0, target - product.stock) };
    }),

  replenishCreate: merchantManagerProcedure
    .input(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(1_000_000), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const product = await loadProduct(ctx.db, storeId, input.productId);
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.replenishRequests)
          .values({ storeId, productId: product.id, qty: input.qty, note: input.note ?? null, operatorId: ctx.user.id })
          .returning();
        await raiseApproval(txDb(tx), {
          storeId,
          kind: 'replenish',
          refId: row!.id,
          summary: `要货：${product.name} ×${input.qty}`,
          applicantId: ctx.user.id,
        });
        return { request: row };
      });
    }),

  replenishList: merchantManagerProcedure
    .input(z.object({ status: z.enum(['pending', 'approved', 'rejected', 'fulfilled']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.replenishRequests.storeId, ctx.user.storeId!)];
      if (input?.status) conds.push(eq(schema.replenishRequests.status, input.status));
      const rows = await ctx.db
        .select({ row: schema.replenishRequests, productName: schema.products.name })
        .from(schema.replenishRequests)
        .innerJoin(schema.products, eq(schema.products.id, schema.replenishRequests.productId))
        .where(and(...conds))
        .orderBy(desc(schema.replenishRequests.createdAt))
        .limit(200);
      return rows.map((r) => ({ ...r.row, productName: r.productName }));
    }),

  /** 要货履约（approved→fulfilled：products.stock 累加+流水） */
  replenishFulfill: merchantManagerProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const req = mustGet(await tx.select().from(schema.replenishRequests).where(eq(schema.replenishRequests.id, input.requestId)).get(), '要货申请不存在');
        if (req.storeId !== storeId) notFound('要货申请不存在');
        if (req.status === 'fulfilled') return { request: req, idempotent: true as const };
        if (req.status !== 'approved') badRequest(`当前状态（${req.status}）不可履约（须先经审批通过）`);
        const product = await tx.select().from(schema.products).where(eq(schema.products.id, req.productId)).get();
        await tx.update(schema.products).set({ stock: product!.stock + req.qty, updatedAt: new Date() }).where(eq(schema.products.id, product!.id));
        await addMovement(txDb(tx), {
          storeId,
          productId: product!.id,
          delta: req.qty,
          beforeStock: product!.stock,
          afterStock: product!.stock + req.qty,
          sourceType: 'replenish',
          sourceId: req.id,
          note: '要货履约入库',
          operatorId: ctx.user.id,
        });
        const [updated] = await tx
          .update(schema.replenishRequests)
          .set({ status: 'fulfilled', updatedAt: new Date() })
          .where(eq(schema.replenishRequests.id, req.id))
          .returning();
        return { request: updated, idempotent: false as const };
      });
    }),

  /* ------------------------------------------------------------------ */
  /* 店间调拨（成对确认/在途归属/超时预警）                                  */
  /* ------------------------------------------------------------------ */

  /** 调拨发起（draft+审批落行；店域闸：转入店须在老板全域集合内） */
  transferCreate: merchantManagerProcedure
    .input(
      z.object({
        toStoreId: z.string().min(1),
        items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(1_000_000) })).min(1).max(50),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const { storeScopeIds } = await import('../trpc');
      const scope = storeScopeIds(ctx.user);
      const toStore = mustGet(await ctx.db.select().from(schema.stores).where(eq(schema.stores.id, input.toStoreId)).get(), '目标门店不存在');
      if (!scope.includes(toStore.id)) notFound('目标门店不存在');
      if (toStore.id === storeId) badRequest('调拨目标店不可为本店');
      const items: Array<{ productId: string; name: string; qty: number }> = [];
      for (const it of input.items) {
        const p = await loadProduct(ctx.db, storeId, it.productId);
        if (it.qty > p.stock) badRequest(`「${p.name}」调拨数量超当前库存（现存 ${p.stock} 件）`);
        items.push({ productId: p.id, name: p.name, qty: it.qty });
      }
      return ctx.db.transaction(async (tx) => {
        const orderNo = await genOrderNo(txDb(tx), 'transfer_orders', 'TR', storeId);
        const [row] = await tx
          .insert(schema.transferOrders)
          .values({ fromStoreId: storeId, toStoreId: toStore.id, orderNo, status: 'pending', itemsJson: items, note: input.note ?? null })
          .returning();
        const totalQty = items.reduce((s, it) => s + it.qty, 0);
        await raiseApproval(txDb(tx), {
          storeId,
          kind: 'transfer',
          refId: row!.id,
          summary: `调拨单 ${orderNo}：→${toStore.name} ${items.length} 品 ${totalQty} 件`,
          applicantId: ctx.user.id,
        });
        return { order: row };
      });
    }),

  /** 发货（approved→in_transit：转出扣 stock 在途归属=双侧不可售+流水；
      店域闸=转出店∈店域集合[老板全域两店互调可发；店长=本店单值同口径]） */
  transferShip: merchantManagerProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const { storeScopeIds } = await import('../trpc');
      const scope = storeScopeIds(ctx.user);
      return ctx.db.transaction(async (tx) => {
        const order = mustGet(await tx.select().from(schema.transferOrders).where(eq(schema.transferOrders.id, input.orderId)).get(), '调拨单不存在');
        if (!scope.includes(order.fromStoreId)) notFound('调拨单不存在');
        if (order.status === 'in_transit') return { order, idempotent: true as const };
        if (order.status !== 'approved') badRequest(`当前状态（${order.status}）不可发货（须先经审批通过）`);
        for (const it of order.itemsJson) {
          const product = mustGet(await tx.select().from(schema.products).where(eq(schema.products.id, it.productId)).get(), `商品不存在：${it.name}`);
          if (product.stock < it.qty) badRequest(`「${it.name}」库存不足（现存 ${product.stock} 件），不可发货`);
          await tx.update(schema.products).set({ stock: product.stock - it.qty, updatedAt: new Date() }).where(eq(schema.products.id, product.id));
          await addMovement(txDb(tx), {
            storeId,
            productId: product.id,
            delta: -it.qty,
            beforeStock: product.stock,
            afterStock: product.stock - it.qty,
            sourceType: 'transfer_out',
            sourceId: order.id,
            note: `调拨发出 ${order.orderNo}（在途归属=in_transit 双侧不可售）`,
            operatorId: ctx.user.id,
          });
        }
        const [updated] = await tx
          .update(schema.transferOrders)
          .set({ status: 'in_transit', sentAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.transferOrders.id, order.id))
          .returning();
        return { order: updated, idempotent: false as const };
      });
    }),

  /** 接收（成对确认终环：in_transit→received；转入店按商品名匹配/无则档案复制，stock 累加+流水；
      店域闸=转入店∈店域集合[老板全域；店长=本店]） */
  transferReceive: merchantManagerProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      void ctx.user.storeId;
      const { storeScopeIds } = await import('../trpc');
      const scope = storeScopeIds(ctx.user);
      return ctx.db.transaction(async (tx) => {
        const order = mustGet(await tx.select().from(schema.transferOrders).where(eq(schema.transferOrders.id, input.orderId)).get(), '调拨单不存在');
        if (!scope.includes(order.toStoreId)) notFound('调拨单不存在');
        if (order.status === 'received') return { order, idempotent: true as const };
        if (order.status !== 'in_transit') badRequest(`当前状态（${order.status}）不可接收（须先在途）`);
        for (const it of order.itemsJson) {
          const src = await tx.select().from(schema.products).where(eq(schema.products.id, it.productId)).get();
          let target = await tx
            .select()
            .from(schema.products)
            .where(and(eq(schema.products.storeId, order.toStoreId), eq(schema.products.name, it.name)))
            .get();
          if (!target) {
            /* 转入店无同品=档案复制（成对确认口径：商品名匹配优先，无则按调出店档案建行） */
            const [created] = await tx
              .insert(schema.products)
              .values({
                storeId: order.toStoreId,
                category: src?.category ?? '调拨',
                name: it.name,
                description: src?.description ?? null,
                images: src?.images ?? null,
                priceFen: src?.priceFen ?? 0,
                costFen: src?.costFen ?? null,
                minStock: src?.minStock ?? null,
                maxStock: src?.maxStock ?? null,
                stock: 0,
                status: 'on',
              })
              .returning();
            target = created!;
          }
          await tx.update(schema.products).set({ stock: target.stock + it.qty, updatedAt: new Date() }).where(eq(schema.products.id, target.id));
          await addMovement(txDb(tx), {
            storeId: order.toStoreId,
            productId: target.id,
            delta: it.qty,
            beforeStock: target.stock,
            afterStock: target.stock + it.qty,
            sourceType: 'transfer_in',
            sourceId: order.id,
            note: `调拨接收 ${order.orderNo}（成对确认）`,
            operatorId: ctx.user.id,
          });
        }
        const [updated] = await tx
          .update(schema.transferOrders)
          .set({ status: 'received', receivedAt: new Date(), receivedBy: ctx.user.id, updatedAt: new Date() })
          .where(eq(schema.transferOrders.id, order.id))
          .returning();
        return { order: updated, idempotent: false as const };
      });
    }),

  transferList: merchantManagerProcedure
    .input(z.object({ direction: z.enum(['out', 'in']).optional(), status: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const conds = input?.direction === 'in' ? [eq(schema.transferOrders.toStoreId, storeId)] : [eq(schema.transferOrders.fromStoreId, storeId)];
      if (input?.status) conds.push(eq(schema.transferOrders.status, input.status));
      const rows = await ctx.db
        .select()
        .from(schema.transferOrders)
        .where(and(...conds))
        .orderBy(desc(schema.transferOrders.createdAt))
        .limit(200);
      const storeNames = new Map((await ctx.db.select({ id: schema.stores.id, name: schema.stores.name }).from(schema.stores)).map((s) => [s.id, s.name]));
      return rows.map((r) => ({ ...r, fromStoreName: storeNames.get(r.fromStoreId) ?? null, toStoreName: storeNames.get(r.toStoreId) ?? null }));
    }),

  /** 在途库存视图+超时预警（in_transit 行+超 transfer_in_transit_warn_hours 标记） */
  transferInTransit: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const warnHours = await ruleNum(ctx.db, 'transfer_in_transit_warn_hours', storeId, 'hours', 24);
    const rows = await ctx.db
      .select()
      .from(schema.transferOrders)
      .where(eq(schema.transferOrders.status, 'in_transit'));
    const scopeIds = (await import('../trpc')).storeScopeIds(ctx.user);
    const now = Date.now();
    const items = rows
      .filter((r) => scopeIds.includes(r.fromStoreId) || scopeIds.includes(r.toStoreId))
      .map((r) => ({
        ...r,
        inTransitHours: r.sentAt ? Math.floor((now - r.sentAt.getTime()) / 3600_000) : null,
        overdue: r.sentAt ? now - r.sentAt.getTime() > warnHours * 3600_000 : false,
      }));
    return { warnHours, items };
  }),

  /* ------------------------------------------------------------------ */
  /* 审批中心（四类通用）                                                  */
  /* ------------------------------------------------------------------ */

  approvalListPending: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ row: schema.approvalRequests, applicantName: schema.users.nickname })
      .from(schema.approvalRequests)
      .leftJoin(schema.users, eq(schema.users.id, schema.approvalRequests.applicantId))
      .where(and(eq(schema.approvalRequests.storeId, ctx.user.storeId!), eq(schema.approvalRequests.status, 'pending')))
      .orderBy(schema.approvalRequests.createdAt);
    return { items: rows.map((r) => ({ ...r.row, applicantName: r.applicantName ?? null })) };
  }),

  approvalPendingCount: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ id: schema.approvalRequests.id })
      .from(schema.approvalRequests)
      .where(and(eq(schema.approvalRequests.storeId, ctx.user.storeId!), eq(schema.approvalRequests.status, 'pending')));
    return { count: rows.length };
  }),

  /** 审批（owner|manager；approve/reject+note 留痕，联动各单据状态机） */
  approvalReview: merchantManagerProcedure
    .input(z.object({ requestId: z.string().min(1), approve: z.boolean(), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const req = mustGet(await tx.select().from(schema.approvalRequests).where(eq(schema.approvalRequests.id, input.requestId)).get(), '审批单不存在');
        if (req.storeId !== storeId) notFound('审批单不存在');
        if (req.status !== 'pending') badRequest('该审批已处理，不可重复审批');
        const now = new Date();
        const timeline = [...req.timelineJson, { at: now.toISOString(), action: input.approve ? 'approved' : 'rejected', by: ctx.user.id, note: input.note }];
        const [updated] = await tx
          .update(schema.approvalRequests)
          .set({
            status: input.approve ? 'approved' : 'rejected',
            reviewerId: ctx.user.id,
            reviewNote: input.note ?? null,
            reviewedAt: now,
            timelineJson: timeline,
            updatedAt: now,
          })
          .where(eq(schema.approvalRequests.id, req.id))
          .returning();
        /* 联动：四类单据状态机推进（approved 才推进业务；rejected 仅置拒） */
        const next = input.approve ? 'approved' : 'rejected';
        if (req.kind === 'purchase') {
          await tx.update(schema.purchaseOrders).set({ status: next, updatedAt: now }).where(eq(schema.purchaseOrders.id, req.refId));
        } else if (req.kind === 'replenish') {
          await tx.update(schema.replenishRequests).set({ status: next, reviewNote: input.note ?? null, reviewedBy: ctx.user.id, reviewedAt: now, updatedAt: now }).where(eq(schema.replenishRequests.id, req.refId));
        } else if (req.kind === 'transfer') {
          await tx.update(schema.transferOrders).set({ status: next, updatedAt: now }).where(eq(schema.transferOrders.id, req.refId));
        } else {
          /* writeoff：approved → 扣库存前后值（products.stock+batch.qty 同步+流水留痕） */
          const wo = await tx.select().from(schema.stockWriteoffs).where(eq(schema.stockWriteoffs.id, req.refId)).get();
          if (input.approve && wo) {
            const product = await tx.select().from(schema.products).where(eq(schema.products.id, wo.productId)).get();
            const deduct = Math.min(wo.qty, Math.max(0, product?.stock ?? 0));
            if (product) {
              await tx.update(schema.products).set({ stock: product.stock - deduct, updatedAt: now }).where(eq(schema.products.id, product.id));
              if (wo.batchId) {
                await tx.update(schema.productBatches).set({ qty: sql`MAX(0, ${schema.productBatches.qty} - ${deduct})`, updatedAt: now }).where(eq(schema.productBatches.id, wo.batchId));
              }
              await addMovement(txDb(tx), {
                storeId,
                productId: product.id,
                delta: -deduct,
                beforeStock: product.stock,
                afterStock: product.stock - deduct,
                sourceType: 'writeoff',
                sourceId: wo.id,
                note: `报损核销：${wo.reason}`,
                operatorId: ctx.user.id,
              });
            }
          }
          await tx.update(schema.stockWriteoffs).set({ status: next, reviewNote: input.note ?? null, reviewedBy: ctx.user.id, reviewedAt: now, updatedAt: now }).where(eq(schema.stockWriteoffs.id, req.refId));
        }
        return { request: updated };
      });
    }),
});

export type Stock2Router = typeof stock2Router;
