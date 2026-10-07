/**
 * 薪资域 router（员工端骨架整建批 片 4 · B3-1~B3-6，涉钱批；迁移 0033）
 *
 * 冻结口径（算式明面 R15 同口径：金额 integer 分、比例 bp 万分比、规则全端口零常量）：
 * - B3-1 双轨分账透出：laborTotalFen/salesTotalFen 由 computeMonth 载荷带出
 *   （=serviceLines/productLines 求和，算式在 commission.ts，本层不动）；
 * - B3-2 协作拆分：appointment_collaborators 全量覆盖写（先删后插同事务）；
 *   ΣsplitBp ∈ (0,10000)，协作人须本店在职且≠主操作人；缺省建议比读端口
 *   commission_rules.commission_collab_split_default；拆分算式在 computeMonth
 *   （协作人=round(行毛提成×splitBp/10000)，余数落主操作人，精确到分）；
 * - B3-3 回冲提成：写侧零挂载沿用读侧（R12 全扛），本层不加任何退款联动；
 * - B3-4 工资条：generateMonth 先确保 commission_snapshots 已跑（snapshotStoreMonth
 *   同内核幂等），再 payroll_runs（uq store+month）+ 逐人 payroll_items
 *   （uq run+staff，payload=computeMonth 载荷快照）；
 *   四费列+net 服务端算：net = commission + performance − deduction + adjustment，
 *   其中 commissionFen=毛口径（payload.commissionTotalFen+adjustmentsTotalFen，
 *   调整项未减除）、adjustmentFen=−adjustmentsTotalFen+手工调整台账合算（带符号，负=跨月
 *   回冲，正=补调；手工调整=端口批收尾片 3 pay_adjustments 同步下游）、
 *   deductionFen=仅 status='active' 扣减合计（reverted 申诉返还不计）；
 *   发放=标记留痕（marked_by/at/method_note）不碰真钱——全链路零支付通道（开口项 3 裁）；
 * - B3-5/6 异议申诉：同人同目标 pending 在途幂等拒（返回现状）；approved 且
 *   target=deduction 时同事务置 deduction.status='reverted'+reverted_*（返还留痕
 *   不删行，refundFen 默认=原扣减额，校验 ≤原额）；SLA 读 service_rules
 *   .payroll_appeal_sla_hours（缺省 24h，页面注记数据源）；
 * - 店域一律 eq(storeId)；mySlip 仅本人硬过滤（staffId 传参≠本人 → FORBIDDEN，
 *   查不到非遮蔽，同 mySummary 工艺）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import {
  merchantManagerProcedure,
  merchantOwnerProcedure,
  router,
  staffProcedure,
} from '../trpc';
import { computeMonth, snapshotStoreMonth, type DbHandle } from './commission';
import { resolveScopedRules, validateValueJson } from './configRules';

const txDb = (tx: unknown): DbHandle => tx as DbHandle;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** service_rules 读法（同 taskCollab.ts readServiceRule：active 行取最高版本）。
 * 大批片 2 分层：传 storeId 按本店作用域解析（本店覆盖行优先）；不传=既有全量口径 */
async function readServiceRule(d: DbHandle, ruleKey: string, storeId?: string | null): Promise<Record<string, unknown> | null> {
  const rows = await d
    .select({ ruleKey: schema.serviceRules.ruleKey, valueJson: schema.serviceRules.valueJson, storeId: schema.serviceRules.storeId })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, ruleKey), eq(schema.serviceRules.active, true)))
    .orderBy(desc(schema.serviceRules.version));
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  return (row?.valueJson ?? null) as Record<string, unknown> | null;
}

/** 协作拆分缺省建议比（commission_rules.commission_collab_split_default.splitBp；缺行回退 5000=对半）。
 * 大批片 2 分层：同 readServiceRule 的 storeId 口径 */
async function readDefaultSplitBp(d: DbHandle, storeId?: string | null): Promise<number> {
  const rows = await d
    .select({ ruleKey: schema.commissionRules.ruleKey, valueJson: schema.commissionRules.valueJson, storeId: schema.commissionRules.storeId })
    .from(schema.commissionRules)
    .where(and(eq(schema.commissionRules.ruleKey, 'commission_collab_split_default'), eq(schema.commissionRules.active, true)))
    .orderBy(desc(schema.commissionRules.version));
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  return num((row?.valueJson as Record<string, unknown> | null)?.splitBp, 5000);
}

export const payrollRouter = router({
  /**
   * collabOf（店长或老板）：协作拆分查询——单信息+现有协作行+端口缺省建议比。
   * 预约单须属本店（越店 FORBIDDEN，查不到非遮蔽同族口径）。
   */
  collabOf: merchantManagerProcedure
    .input(z.object({ appointmentId: z.string().min(1) }).strict())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const appt = await ctx.db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.id, input.appointmentId))
        .get();
      if (!appt || appt.storeId !== storeId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '预约单不存在或不属于本店' });
      }
      const collaborators = await ctx.db
        .select({
          id: schema.appointmentCollaborators.id,
          staffId: schema.appointmentCollaborators.staffId,
          role: schema.appointmentCollaborators.role,
          splitBp: schema.appointmentCollaborators.splitBp,
          staffName: schema.staff.name,
        })
        .from(schema.appointmentCollaborators)
        .leftJoin(schema.staff, eq(schema.appointmentCollaborators.staffId, schema.staff.id))
        .where(eq(schema.appointmentCollaborators.appointmentId, input.appointmentId));
      return {
        appointment: {
          id: appt.id,
          code: appt.code,
          type: appt.type,
          status: appt.status,
          staffId: appt.staffId,
          priceFen: appt.priceFen,
        },
        collaborators,
        defaultSplitBp: await readDefaultSplitBp(ctx.db, storeId), // 端口缺省建议值（commission_collab_split_default；大批片 2 分层按本店解析）
      };
    }),

  /**
   * setCollaborators（店长或老板）：协作拆分全量覆盖写（先删后插同事务）。
   * 校验：单须本店+type=grooming+未 completed；协作人须本店在职且≠主操作人；
   * ΣsplitBp ∈ (0,10000)（空数组=清空协作行，全量覆盖写语义）；单内协作人不重复。
   */
  setCollaborators: merchantManagerProcedure
    .input(
      z
        .object({
          appointmentId: z.string().min(1),
          collaborators: z
            .array(
              z.object({
                staffId: z.string().min(1),
                role: z.string().trim().min(1, '请填写协作角色').max(50),
                splitBp: z.number().int('比例必须是整数（bp）').positive('拆分比例必须大于 0').max(10000),
              }),
            )
            .max(10),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const appt = await ctx.db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.id, input.appointmentId))
        .get();
      if (!appt || appt.storeId !== storeId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '预约单不存在或不属于本店' });
      }
      if (appt.type !== 'grooming') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '仅洗护/美容单支持协作拆分' });
      }
      if (appt.status === 'completed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '已完成的预约单不可再改协作拆分' });
      }
      const seen = new Set<string>();
      let sumBp = 0;
      for (const c of input.collaborators) {
        if (appt.staffId && c.staffId === appt.staffId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '协作人不可与主操作人重复' });
        }
        if (seen.has(c.staffId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '同一协作人不可重复登记' });
        }
        seen.add(c.staffId);
        sumBp += c.splitBp;
        const st = await ctx.db.select().from(schema.staff).where(eq(schema.staff.id, c.staffId)).get();
        if (!st || st.storeId !== storeId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '协作人须为本店员工' });
        }
        if (st.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `协作人「${st.name}」已停职，不可登记` });
        }
      }
      // ΣsplitBp ∈ (0,10000)：须给主操作人留余数（=10000 则主操作人颗粒无收，硬拒）
      if (input.collaborators.length > 0 && (sumBp <= 0 || sumBp >= 10000)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '协作拆分比例合计须在 (0,10000) 之间，须给主操作人留余数' });
      }
      const now = new Date();
      const rows = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        await t
          .delete(schema.appointmentCollaborators)
          .where(eq(schema.appointmentCollaborators.appointmentId, input.appointmentId));
        if (input.collaborators.length === 0) return [];
        return t
          .insert(schema.appointmentCollaborators)
          .values(
            input.collaborators.map((c) => ({
              appointmentId: input.appointmentId,
              staffId: c.staffId,
              role: c.role,
              splitBp: c.splitBp,
              createdBy: ctx.user.id,
              createdAt: now,
            })),
          )
          .returning();
      });
      return { appointmentId: input.appointmentId, collaborators: rows, count: rows.length };
    }),

  /**
   * generateMonth（仅店主）：月度工资条生成。
   * 1) 先确保 commission_snapshots 已跑（snapshotStoreMonth 同内核，onConflictDoNothing 幂等）；
   * 2) payroll_runs INSERT OR IGNORE（uq store+month）；
   * 3) 按本店在职 staff 逐人 payroll_items（uq run+staff 幂等；payload=computeMonth 载荷快照）。
   * 四费列+net 服务端算（算式明面）：
   *   commissionFen  = payload.commissionTotalFen + payload.adjustmentsTotalFen（毛口径，调整项未减除）
   *   adjustmentFen  = −payload.adjustmentsTotalFen（带符号，负=跨月回冲调整项）
   *   deductionFen   = Σ status='active' 扣减（reverted 申诉返还不计）
   *   netFen         = commissionFen + performanceFen − deductionFen + adjustmentFen
   * 重复调用=幂等返回现状（已存在行不动）。
   */
  generateMonth: merchantOwnerProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') }).strict())
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      await snapshotStoreMonth(ctx.db, storeId, input.month); // 先确保快照已跑（同内核幂等）
      const now = new Date();
      await ctx.db
        .insert(schema.payrollRuns)
        .values({ storeId, month: input.month, status: 'generated', generatedBy: ctx.user.id, generatedAt: now })
        .onConflictDoNothing();
      const run = await ctx.db
        .select()
        .from(schema.payrollRuns)
        .where(and(eq(schema.payrollRuns.storeId, storeId), eq(schema.payrollRuns.month, input.month)))
        .get();
      if (!run) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '工资批次创建失败' });

      const staffRows = await ctx.db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.storeId, storeId), eq(schema.staff.status, 'active')));
      let itemsInserted = 0;
      for (const st of staffRows) {
        const payload = await computeMonth(ctx.db, st, input.month);
        /* 片 3 薪资调整端口 · 同步下游：手工调整台账 pay_adjustments（staff+month+active）
           合算进 adjustmentFen（与退款回冲同通道带符号；已发[marked_at]月份不进=应用帧硬拒在案） */
        const manualRows = await ctx.db
          .select({ amountFen: schema.payAdjustments.amountFen })
          .from(schema.payAdjustments)
          .where(
            and(
              eq(schema.payAdjustments.staffId, st.id),
              eq(schema.payAdjustments.month, input.month),
              eq(schema.payAdjustments.status, 'active'),
            ),
          );
        const manualAdjustFen = manualRows.reduce((s, r) => s + r.amountFen, 0);
        // 毛口径提成（调整项单列带符号，净额不双扣）+ 仅 active 扣减
        const commissionFen = payload.commissionTotalFen + payload.adjustmentsTotalFen;
        const adjustmentFen = -payload.adjustmentsTotalFen + manualAdjustFen;
        const deductionFen = payload.deductions
          .filter((dd) => dd.status === 'active')
          .reduce((s, dd) => s + dd.amountFen, 0);
        // net = commission + performance − deduction + adjustment（adjustment 带符号）
        const netFen = commissionFen + payload.performance.payableFen - deductionFen + adjustmentFen;
        const snap = await ctx.db
          .select({ id: schema.commissionSnapshots.id })
          .from(schema.commissionSnapshots)
          .where(
            and(
              eq(schema.commissionSnapshots.staffId, st.id),
              eq(schema.commissionSnapshots.period, input.month),
              eq(schema.commissionSnapshots.kind, 'commission'),
            ),
          )
          .get();
        const ins = await ctx.db
          .insert(schema.payrollItems)
          .values({
            runId: run.id,
            storeId,
            staffId: st.id,
            month: input.month,
            payloadJson: payload as unknown as Record<string, unknown>,
            commissionFen,
            performanceFen: payload.performance.payableFen,
            deductionFen,
            adjustmentFen,
            netFen,
            ruleVersion: payload.ruleVersion,
            snapshotId: snap?.id ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: schema.payrollItems.id });
        itemsInserted += ins.length;
      }
      return { run, staffCount: staffRows.length, itemsInserted, duplicated: itemsInserted === 0 };
    }),

  /**
   * confirmRun（仅店主）：工资批次 generated→confirmed（两态；重复确认幂等返回现状）。
   */
  confirmRun: merchantOwnerProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') }).strict())
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const run = await ctx.db
        .select()
        .from(schema.payrollRuns)
        .where(and(eq(schema.payrollRuns.storeId, storeId), eq(schema.payrollRuns.month, input.month)))
        .get();
      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: '该月工资批次不存在，请先生成' });
      if (run.status === 'confirmed') return { run, duplicated: true };
      const updated = await ctx.db
        .update(schema.payrollRuns)
        .set({ status: 'confirmed', confirmedBy: ctx.user.id, confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.payrollRuns.id, run.id))
        .returning()
        .then((r) => r[0]!);
      return { run: updated, duplicated: false };
    }),

  /**
   * listRun（店长或老板）：{month} → 本店工资批次+逐人明细（含员工名）。
   */
  listRun: merchantManagerProcedure
    .input(
      z
        .object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') })
        .strict()
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      /* 月份缺省=当月（UI 首挂无参调用口径；显式传月照旧） */
      const now = new Date();
      const month = input?.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const run = await ctx.db
        .select()
        .from(schema.payrollRuns)
        .where(and(eq(schema.payrollRuns.storeId, storeId), eq(schema.payrollRuns.month, month)))
        .get();
      if (!run) return { run: null, items: [] };
      const items = await ctx.db
        .select({
          id: schema.payrollItems.id,
          staffId: schema.payrollItems.staffId,
          staffName: schema.staff.name,
          month: schema.payrollItems.month,
          commissionFen: schema.payrollItems.commissionFen,
          performanceFen: schema.payrollItems.performanceFen,
          deductionFen: schema.payrollItems.deductionFen,
          adjustmentFen: schema.payrollItems.adjustmentFen,
          netFen: schema.payrollItems.netFen,
          ruleVersion: schema.payrollItems.ruleVersion,
          snapshotId: schema.payrollItems.snapshotId,
          markedBy: schema.payrollItems.markedBy,
          markedAt: schema.payrollItems.markedAt,
          methodNote: schema.payrollItems.methodNote,
        })
        .from(schema.payrollItems)
        .leftJoin(schema.staff, eq(schema.payrollItems.staffId, schema.staff.id))
        .where(eq(schema.payrollItems.runId, run.id))
        .orderBy(schema.staff.name);
      return { run, items };
    }),

  /**
   * mySlip（staff · 仅本人硬过滤）：本人工资条。staffId 传参≠本人一律 FORBIDDEN
   * （查不到非遮蔽，同 commission.mySummary 工艺）；其余额外字段 .strict() 硬拒。
   */
  mySlip: staffProcedure
    .input(
      z
        .object({
          month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM'),
          staffId: z.string().min(1).optional(),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      const staffId = ctx.user.staffId!;
      if (input.staffId && input.staffId !== staffId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅可查看本人工资条' });
      }
      const item = await ctx.db
        .select()
        .from(schema.payrollItems)
        .where(
          and(
            eq(schema.payrollItems.storeId, ctx.user.storeId!),
            eq(schema.payrollItems.staffId, staffId),
            eq(schema.payrollItems.month, input.month),
          ),
        )
        .get();
      return { month: input.month, item: item ?? null };
    }),

  /**
   * markDisbursed（仅店主）：标记工资条已发放（marked_by/at/method_note 置位）。
   * 留痕不碰真钱——全链路零支付通道（开口项 3 裁：发放只登记，不走 pay_orders/转账）。
   * 重复标记幂等返回现状（不覆盖首次留痕）。
   */
  markDisbursed: merchantOwnerProcedure
    .input(
      z
        .object({
          itemId: z.string().min(1),
          methodNote: z.string().trim().max(200).optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db
        .select()
        .from(schema.payrollItems)
        .where(eq(schema.payrollItems.id, input.itemId))
        .get();
      if (!item || item.storeId !== ctx.user.storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '工资条不存在或不属于本店' });
      }
      if (item.markedAt) return { item, duplicated: true };
      const updated = await ctx.db
        .update(schema.payrollItems)
        .set({
          markedBy: ctx.user.id,
          markedAt: new Date(),
          methodNote: input.methodNote ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.payrollItems.id, item.id))
        .returning()
        .then((r) => r[0]!);
      return { item: updated, duplicated: false };
    }),

  /**
   * raiseAppeal（staff）：薪资异议申诉（B3-5）。目标类：deduction（扣款/罚单）|
   * slip_line（工资条行）| adjustment（调整项，targetId 自由文本如 refundNo）。
   * deduction/slip_line 须挂本人目标（他人目标 FORBIDDEN）；同人同目标 pending
   * 在途幂等拒（返回现状 duplicated=true，不重复建行）。
   */
  raiseAppeal: staffProcedure
    .input(
      z
        .object({
          targetKind: z.enum(['deduction', 'slip_line', 'adjustment']),
          targetId: z.string().min(1),
          month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM'),
          reason: z.string().trim().min(1, '请填写申诉原因').max(500),
          evidenceUrls: z.array(z.string().url()).max(9).optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const staffId = ctx.user.staffId!;
      if (input.targetKind === 'deduction') {
        const dd = await ctx.db
          .select()
          .from(schema.deductionRecords)
          .where(eq(schema.deductionRecords.id, input.targetId))
          .get();
        if (!dd || dd.storeId !== storeId || dd.staffId !== staffId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅可申诉本人的扣减记录' });
        }
      } else if (input.targetKind === 'slip_line') {
        const item = await ctx.db
          .select()
          .from(schema.payrollItems)
          .where(eq(schema.payrollItems.id, input.targetId))
          .get();
        if (!item || item.storeId !== storeId || item.staffId !== staffId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅可申诉本人工资条行' });
        }
      }
      const existing = await ctx.db
        .select()
        .from(schema.payrollAppeals)
        .where(
          and(
            eq(schema.payrollAppeals.staffId, staffId),
            eq(schema.payrollAppeals.targetKind, input.targetKind),
            eq(schema.payrollAppeals.targetId, input.targetId),
            eq(schema.payrollAppeals.status, 'pending'),
          ),
        )
        .get();
      if (existing) return { appeal: existing, duplicated: true };
      const appeal = await ctx.db
        .insert(schema.payrollAppeals)
        .values({
          storeId,
          staffId,
          targetKind: input.targetKind,
          targetId: input.targetId,
          month: input.month,
          reason: input.reason,
          evidenceUrls: input.evidenceUrls ?? null,
        })
        .returning()
        .then((r) => r[0]!);
      return { appeal, duplicated: false };
    }),

  /** myAppeals（staff）：本人申诉列表（新→旧）。 */
  myAppeals: staffProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.payrollAppeals)
      .where(eq(schema.payrollAppeals.staffId, ctx.user.staffId!))
      .orderBy(desc(schema.payrollAppeals.createdAt));
    return { items: rows };
  }),

  /** listAppeals（店长或老板）：本店申诉列表（status 过滤，含员工名）。 */
  listAppeals: merchantManagerProcedure
    .input(
      z
        .object({ status: z.enum(['pending', 'approved', 'rejected']).optional() })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: schema.payrollAppeals.id,
          staffId: schema.payrollAppeals.staffId,
          staffName: schema.staff.name,
          targetKind: schema.payrollAppeals.targetKind,
          targetId: schema.payrollAppeals.targetId,
          month: schema.payrollAppeals.month,
          reason: schema.payrollAppeals.reason,
          evidenceUrls: schema.payrollAppeals.evidenceUrls,
          status: schema.payrollAppeals.status,
          reviewerId: schema.payrollAppeals.reviewerId,
          reviewedAt: schema.payrollAppeals.reviewedAt,
          reviewNote: schema.payrollAppeals.reviewNote,
          refundFen: schema.payrollAppeals.refundFen,
          createdAt: schema.payrollAppeals.createdAt,
        })
        .from(schema.payrollAppeals)
        .leftJoin(schema.staff, eq(schema.payrollAppeals.staffId, schema.staff.id))
        .where(
          and(
            eq(schema.payrollAppeals.storeId, ctx.user.storeId!),
            input.status ? eq(schema.payrollAppeals.status, input.status) : undefined,
          ),
        )
        .orderBy(desc(schema.payrollAppeals.createdAt));
      /* 审批面辅助透出：目标单原额+单行摘要（deduction→罚单原额/原因；slip_line→工资条净额/月份；adjustment→暂无源单 null） */
      const dedIds = rows.filter((r) => r.targetKind === 'deduction').map((r) => r.targetId);
      const slipIds = rows.filter((r) => r.targetKind === 'slip_line').map((r) => r.targetId);
      const dedMap = new Map<string, { amountFen: number; reason: string }>();
      if (dedIds.length > 0) {
        const ds = await ctx.db
          .select({ id: schema.deductionRecords.id, amountFen: schema.deductionRecords.amountFen, reason: schema.deductionRecords.reason })
          .from(schema.deductionRecords)
          .where(inArray(schema.deductionRecords.id, dedIds));
        for (const d of ds) dedMap.set(d.id, { amountFen: d.amountFen, reason: d.reason });
      }
      const slipMap = new Map<string, { netFen: number; month: string }>();
      if (slipIds.length > 0) {
        const ss = await ctx.db
          .select({ id: schema.payrollItems.id, netFen: schema.payrollItems.netFen, month: schema.payrollItems.month })
          .from(schema.payrollItems)
          .where(inArray(schema.payrollItems.id, slipIds));
        for (const s of ss) slipMap.set(s.id, { netFen: s.netFen, month: s.month });
      }
      return {
        appeals: rows.map((r) => {
          const ded = r.targetKind === 'deduction' ? dedMap.get(r.targetId) : undefined;
          const slip = r.targetKind === 'slip_line' ? slipMap.get(r.targetId) : undefined;
          return {
            ...r,
            targetAmountFen: ded?.amountFen ?? slip?.netFen ?? null,
            targetLabel: ded?.reason ?? (slip ? `工资条 ${slip.month}` : null),
          };
        }),
      };
    }),

  /** listDeductions（店长或老板）：罚单表读口（月份过滤；含员工名+reverted 已返还灰态——UI 区 3 数据源） */
  listDeductions: merchantManagerProcedure
    .input(
      z
        .object({ month: z.string().regex(/^\d{4}-\d{2}$/, '月份格式须为 YYYY-MM').optional() })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: schema.deductionRecords.id,
          staffId: schema.deductionRecords.staffId,
          staffName: schema.staff.name,
          month: schema.deductionRecords.month,
          amountFen: schema.deductionRecords.amountFen,
          reason: schema.deductionRecords.reason,
          status: schema.deductionRecords.status,
          revertedBy: schema.deductionRecords.revertedBy,
          revertedAt: schema.deductionRecords.revertedAt,
          revertNote: schema.deductionRecords.revertNote,
          createdAt: schema.deductionRecords.createdAt,
        })
        .from(schema.deductionRecords)
        .leftJoin(schema.staff, eq(schema.deductionRecords.staffId, schema.staff.id))
        .where(
          and(
            eq(schema.deductionRecords.storeId, ctx.user.storeId!),
            input?.month ? eq(schema.deductionRecords.month, input.month) : undefined,
          ),
        )
        .orderBy(desc(schema.deductionRecords.createdAt))
        .limit(100);
      return { deductions: rows };
    }),

  /**
   * reviewAppeal（店长或老板）：申诉复核（B3-6）。
   * approved 且 target=deduction：同事务置 deduction.status='reverted'+reverted_*
   * （返还留痕不删行，只增不改同族口径；refundFen 默认=原扣减额，校验 ≤原额 >0）。
   * reviewer/reviewed_at/review_note 落列；重复复核幂等拒（BAD_REQUEST 明文）。
   */
  reviewAppeal: merchantManagerProcedure
    .input(
      z
        .object({
          appealId: z.string().min(1),
          result: z.enum(['approved', 'rejected']),
          note: z.string().trim().min(1, '请填写复核说明').max(500),
          refundFen: z.number().int('金额必须是整数（分）').positive('返还金额必须大于 0').optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const appeal = await ctx.db
        .select()
        .from(schema.payrollAppeals)
        .where(eq(schema.payrollAppeals.id, input.appealId))
        .get();
      if (!appeal || appeal.storeId !== storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申诉单不存在或不属于本店' });
      }
      if (appeal.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '该申诉已复核，不可重复处理' });
      }
      const now = new Date();
      let refundFen: number | null = null;
      if (input.result === 'approved' && appeal.targetKind === 'deduction') {
        const dd = await ctx.db
          .select()
          .from(schema.deductionRecords)
          .where(eq(schema.deductionRecords.id, appeal.targetId))
          .get();
        if (!dd || dd.storeId !== storeId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '申诉目标扣减记录不存在' });
        }
        if (dd.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该扣减已返还或已失效，不可重复返还' });
        }
        refundFen = input.refundFen ?? dd.amountFen; // 缺省=原扣减额全额返还
        if (refundFen > dd.amountFen) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '返还金额不可超过原扣减额' });
        }
        const rf = refundFen;
        await ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          await t
            .update(schema.payrollAppeals)
            .set({
              status: 'approved',
              reviewerId: ctx.user.id,
              reviewedAt: now,
              reviewNote: input.note,
              refundFen: rf,
              updatedAt: now,
            })
            .where(eq(schema.payrollAppeals.id, appeal.id));
          // 返还留痕不删行：原扣减置 reverted（前后值可溯：amountFen 原额 + refundFen 返还额）
          await t
            .update(schema.deductionRecords)
            .set({ status: 'reverted', revertedBy: ctx.user.id, revertedAt: now, revertNote: input.note, updatedAt: now })
            .where(eq(schema.deductionRecords.id, dd.id));
        });
      } else {
        await ctx.db
          .update(schema.payrollAppeals)
          .set({
            status: input.result,
            reviewerId: ctx.user.id,
            reviewedAt: now,
            reviewNote: input.note,
            updatedAt: now,
          })
          .where(eq(schema.payrollAppeals.id, appeal.id));
      }
      const updated = await ctx.db
        .select()
        .from(schema.payrollAppeals)
        .where(eq(schema.payrollAppeals.id, appeal.id))
        .get();
      return { appeal: updated!, refundFen };
    }),

  /**
   * appealSlaHours（staff）：申诉处理时限（小时），读 service_rules
   * .payroll_appeal_sla_hours（缺省 24；页面注记数据源，配置端口第七域可改）。
   */
  appealSlaHours: staffProcedure.query(async ({ ctx }) => {
    const rule = await readServiceRule(ctx.db, 'payroll_appeal_sla_hours', ctx.user.storeId); // 大批片 2 分层：按员工本店作用域解析
    return {
      hours: num(rule?.hours, 24),
      source: 'service_rules.payroll_appeal_sla_hours',
    };
  }),

  /* ------------------------------------------------------------------ */
  /* 端口批收尾片 3 · 薪资调整端口 4 件：试算/手工调整/阈值分级审批链/同步下游      */
  /* ------------------------------------------------------------------ */

  /**
   * simulateCommission（试算/模拟器，owner 只读不落库）：按指定月份既有数据跑「新规则」——
   * overrides 键必须∈commission_rules 宇宙（validateValueJson 同 config.save 校验）；
   * 每人两帧（baseline=现行规则 / simulated=覆盖规则全域生效模拟，computeMonth rulesOverride 参），
   * 差值精确到分透出；只读零落库（试算不产生任何留痕行/快照行）。
   */
  simulateCommission: merchantOwnerProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, '月份格式 YYYY-MM'),
        overrides: z
          .array(z.object({ ruleKey: z.string().min(1), valueJson: z.record(z.unknown()) }))
          .min(1, '试算覆盖不能为空')
          .max(10, '单次最多 10 键'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const seen = new Set<string>();
      for (const o of input.overrides) {
        if (seen.has(o.ruleKey)) throw new TRPCError({ code: 'BAD_REQUEST', message: `同一规则键重复提交：${o.ruleKey}` });
        seen.add(o.ruleKey);
        validateValueJson(o.ruleKey, o.valueJson);
      }
      const universeRows = await ctx.db.select({ ruleKey: schema.commissionRules.ruleKey }).from(schema.commissionRules);
      const universe = new Set(universeRows.map((r) => r.ruleKey));
      for (const o of input.overrides) {
        if (!universe.has(o.ruleKey)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `未知规则键：${o.ruleKey}（试算仅覆盖既有提成参数）` });
        }
      }
      const overrideMap = new Map(input.overrides.map((o) => [o.ruleKey, o.valueJson]));
      const staffRows = await ctx.db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.storeId, storeId), eq(schema.staff.status, 'active')));
      const netOf = (p: Awaited<ReturnType<typeof computeMonth>>) =>
        p.commissionTotalFen +
        p.performance.payableFen -
        p.deductions.filter((dd) => dd.status === 'active').reduce((s, dd) => s + dd.amountFen, 0);
      const items = [] as Array<Record<string, unknown>>;
      for (const st of staffRows) {
        const baseline = await computeMonth(ctx.db, st, input.month);
        const simulated = await computeMonth(ctx.db, st, input.month, overrideMap);
        items.push({
          staffId: st.id,
          name: st.name,
          baseline: { commissionTotalFen: baseline.commissionTotalFen, netFen: netOf(baseline) },
          simulated: { commissionTotalFen: simulated.commissionTotalFen, netFen: netOf(simulated) },
          deltaCommissionFen: simulated.commissionTotalFen - baseline.commissionTotalFen,
          deltaNetFen: netOf(simulated) - netOf(baseline),
        });
      }
      return {
        month: input.month,
        overrides: input.overrides,
        items,
        note: '试算=只读模拟（按现行库内数据跑覆盖规则，不落库不回溯；规则值全域生效模拟非时序帧）',
      };
    }),

  /**
   * proposeAdjustment（单笔提成/工时手工调整·发起，owner）：pay_adjust_proposals 载荷单+
   * approval_requests kind='pay_adjust' pending（不新建审批表；金额阈值分级在 review 帧）。
   */
  proposeAdjustment: merchantOwnerProcedure
    .input(
      z.object({
        kind: z.enum(['commission', 'work_hours']),
        staffId: z.string().min(1, '员工不能为空'),
        month: z.string().regex(/^\d{4}-\d{2}$/, '月份格式 YYYY-MM'),
        amountFen: z.number().int('必须是整数分').refine((v) => v !== 0, '调整金额不能为零'),
        reason: z.string().trim().min(1, '调整事由必填（留痕用）').max(500, '调整事由过长'),
        meta: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const st = await ctx.db.select().from(schema.staff).where(eq(schema.staff.id, input.staffId)).get();
      if (!st || st.storeId !== storeId) throw new TRPCError({ code: 'NOT_FOUND', message: '员工不存在' });
      return ctx.db.transaction(async (tx) => {
        const txh = tx as unknown as typeof ctx.db;
        const [proposal] = await txh
          .insert(schema.payAdjustProposals)
          .values({
            storeId,
            kind: input.kind,
            staffId: input.staffId,
            month: input.month,
            amountFen: input.amountFen,
            metaJson: input.meta ?? null,
            reason: input.reason,
            status: 'pending',
            proposerId: ctx.user.id,
          })
          .returning({ id: schema.payAdjustProposals.id });
        const summary = `薪资手工调整：${st.name} · ${input.month} · ${input.amountFen > 0 ? '+' : ''}${input.amountFen} 分（${input.kind === 'commission' ? '单笔提成' : '工时折算'}）`;
        const [req] = await txh
          .insert(schema.approvalRequests)
          .values({
            storeId,
            kind: 'pay_adjust',
            refId: proposal!.id,
            summary,
            status: 'pending',
            applicantId: ctx.user.id,
            timelineJson: [{ at: new Date().toISOString(), action: 'submitted', by: ctx.user.id }],
          })
          .returning({ id: schema.approvalRequests.id });
        return { proposalId: proposal!.id, requestId: req!.id, summary };
      });
    }),

  /** adjustmentList（owner）：调整单+审批单联查（pending 在前），按月过滤 */
  adjustmentList: merchantOwnerProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }))
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.payAdjustProposals.storeId, ctx.user.storeId!)];
      if (input.month) conds.push(eq(schema.payAdjustProposals.month, input.month));
      const rows = await ctx.db
        .select({
          proposal: schema.payAdjustProposals,
          proposerNickname: schema.users.nickname,
          staffName: schema.staff.name,
          approvalId: schema.approvalRequests.id,
          approvalStatus: schema.approvalRequests.status,
          reviewerId: schema.approvalRequests.reviewerId,
          reviewNote: schema.approvalRequests.reviewNote,
          timelineJson: schema.approvalRequests.timelineJson,
        })
        .from(schema.payAdjustProposals)
        .leftJoin(schema.users, eq(schema.users.id, schema.payAdjustProposals.proposerId))
        .leftJoin(schema.staff, eq(schema.staff.id, schema.payAdjustProposals.staffId))
        .leftJoin(
          schema.approvalRequests,
          and(eq(schema.approvalRequests.refId, schema.payAdjustProposals.id), eq(schema.approvalRequests.kind, 'pay_adjust')),
        )
        .where(and(...conds))
        .orderBy(desc(schema.payAdjustProposals.createdAt))
        .limit(100);
      return { items: rows };
    }),

  /**
   * reviewAdjustment（复核，owner/manager）：金额阈值分级——|amountFen|>阈值（service_rules
   * pay_adjust_threshold_fen.amountFen，缺省 10000 分）仅 owner 可复核（manager 403 明文）；
   * 通过=同事务落 pay_adjustments active 行（**只进当月未发单不回溯已发**：目标 (staff,month)
   * 工资单行已带 marked_at=已发 → 400 硬拒应用）；驳回=双 rejected 不落库。timeline 只增。
   */
  reviewAdjustment: merchantManagerProcedure
    .input(z.object({ requestId: z.string().min(1), approve: z.boolean(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const txh = tx as unknown as typeof ctx.db;
        const req = (await txh.select().from(schema.approvalRequests).where(eq(schema.approvalRequests.id, input.requestId)).limit(1))[0];
        if (!req || req.storeId !== storeId || req.kind !== 'pay_adjust') {
          throw new TRPCError({ code: 'NOT_FOUND', message: '审批单不存在' });
        }
        if (req.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该审批已处理，不可重复审批' });
        }
        const proposal = (await txh.select().from(schema.payAdjustProposals).where(eq(schema.payAdjustProposals.id, req.refId)).limit(1))[0];
        if (!proposal) throw new TRPCError({ code: 'NOT_FOUND', message: '调整载荷单不存在' });
        /* 金额阈值分级（端口键 pay_adjust_threshold_fen，缺省 10000 分） */
        const th = (await readServiceRule(txh, 'pay_adjust_threshold_fen', storeId)) ?? {};
        const thresholdFen = typeof th.amountFen === 'number' && th.amountFen > 0 ? th.amountFen : 10000;
        if (Math.abs(proposal.amountFen) > thresholdFen && !ctx.user.roles.includes('merchant_owner')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `调整金额超阈值 ${thresholdFen} 分，仅店主可复核（金额阈值分级）`,
          });
        }
        const now = new Date();
        const timeline = [
          ...req.timelineJson,
          { at: now.toISOString(), action: input.approve ? 'approved' : 'rejected', by: ctx.user.id, ...(input.note ? { note: input.note } : {}) },
        ];
        await txh
          .update(schema.approvalRequests)
          .set({
            status: input.approve ? 'approved' : 'rejected',
            reviewerId: ctx.user.id,
            reviewNote: input.note ?? null,
            reviewedAt: now,
            timelineJson: timeline,
            updatedAt: now,
          })
          .where(eq(schema.approvalRequests.id, req.id));
        if (!input.approve) {
          await txh
            .update(schema.payAdjustProposals)
            .set({ status: 'rejected', updatedAt: now })
            .where(eq(schema.payAdjustProposals.id, proposal.id));
          return { requestId: req.id, approved: false };
        }
        /* 只进当月未发单不回溯已发：该 (staff,month) 工资单行已带发放标记 marked_at → 硬拒 */
        const paidItem = await txh
          .select({ id: schema.payrollItems.id })
          .from(schema.payrollItems)
          .where(
            and(
              eq(schema.payrollItems.staffId, proposal.staffId),
              eq(schema.payrollItems.month, proposal.month),
              isNotNull(schema.payrollItems.markedAt),
            ),
          )
          .get();
        if (paidItem) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `该员工 ${proposal.month} 工资单已发放（marked_at 在案）——调整只进当月未发单，不回溯已发`,
          });
        }
        const [adj] = await txh
          .insert(schema.payAdjustments)
          .values({
            storeId,
            staffId: proposal.staffId,
            month: proposal.month,
            kind: proposal.kind,
            amountFen: proposal.amountFen,
            reason: proposal.reason,
            metaJson: proposal.metaJson,
            sourceId: proposal.id,
            status: 'active',
            createdBy: proposal.proposerId,
          })
          .returning({ id: schema.payAdjustments.id });
        await txh
          .update(schema.payAdjustProposals)
          .set({ status: 'applied', appliedAt: now, updatedAt: now })
          .where(eq(schema.payAdjustProposals.id, proposal.id));
        return { requestId: req.id, approved: true, adjustmentId: adj!.id };
      });
    }),
});

export type PayrollRouter = typeof payrollRouter;
