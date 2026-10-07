/**
 * 数据订正 router（端口批收尾片 2 · 数据 3 之订正界面+审批流 · 任务书冻结版 V1.0 §一+开口项 2 裁）
 *
 * 冻结口径：
 * - 三类订正：stored_value（储值余额 principal/bonus 绝对值修正）/ rebate（回馈金 balance_fen
 *   绝对值修正）/ work_hours（考勤打卡时刻修正）；
 * - owner 发起（merchantOwnerProcedure）→ 复核通过才生效（review=merchantManagerProcedure，
 *   owner/manager 皆可，与片 1 二级审批同族同表：approval_requests 加 kind='correction'
 *   不新建审批表；载荷表=data_corrections）；
 * - 前后值留痕：应用时同步落域内流水（stored_value_logs / rebate_logs[type='correction'，
 *   应用层枚举新取值报备] / attendance_approvals[type='adjust' 同 managerAdjust 工艺]）；
 * - 不回溯已封箱：只调当前余额/当前打卡行，日结/月结快照/已结算期次/提成快照一律不重算；
 * - 订正=台账字段修正，零支付链触及（留痕不碰真钱照裁）。
 */
import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { emitEvent } from '../realtime/bus';
import { merchantManagerProcedure, merchantOwnerProcedure, router } from '../trpc';

type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

const CORRECTION_KINDS = ['stored_value', 'rebate', 'work_hours'] as const;

const proposeSchema = z.object({
  kind: z.enum(CORRECTION_KINDS),
  /** stored_value/rebate=目标用户 users.id；work_hours=attendance_records.id */
  targetKey: z.string().min(1, '目标键不能为空'),
  note: z.string().min(1, '订正事由必填（留痕用）').max(500, '订正事由过长'),
  /** stored_value：本金/赠送新绝对值（分，非负） */
  principalFen: z.number().int('必须是整数分').min(0, '不允许为负').optional(),
  bonusFen: z.number().int('必须是整数分').min(0, '不允许为负').optional(),
  /** rebate：可用余额新绝对值（分，非负） */
  balanceFen: z.number().int('必须是整数分').min(0, '不允许为负').optional(),
  /** work_hours：打卡新时刻（ISO 串） */
  ts: z.string().max(64).optional(),
});

/** 每类订正的 before 取数（propose/review 两帧共用；review 帧重算防存货漂移） */
async function loadBefore(d: DbHandle, storeId: string, kind: string, targetKey: string) {
  if (kind === 'stored_value') {
    const user = await d.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, targetKey)).get();
    if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '目标用户不存在' });
    const acc = await d
      .select()
      .from(schema.storedValueAccounts)
      .where(and(eq(schema.storedValueAccounts.userId, targetKey), eq(schema.storedValueAccounts.storeId, storeId)))
      .get();
    return { before: { principalFen: acc?.principalFen ?? 0, bonusFen: acc?.bonusFen ?? 0 }, accountId: acc?.id ?? null };
  }
  if (kind === 'rebate') {
    const user = await d.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, targetKey)).get();
    if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '目标用户不存在' });
    const acc = await d.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, targetKey)).get();
    return { before: { balanceFen: acc?.balanceFen ?? 0 }, accountId: acc?.id ?? null };
  }
  /* work_hours */
  const rec = await d
    .select()
    .from(schema.attendanceRecords)
    .where(eq(schema.attendanceRecords.id, targetKey))
    .get();
  if (!rec || rec.storeId !== storeId) throw new TRPCError({ code: 'NOT_FOUND', message: '打卡记录不存在' });
  return { before: { ts: rec.ts.toISOString() }, accountId: null, record: rec };
}

function afterOf(input: z.infer<typeof proposeSchema>): Record<string, unknown> {
  if (input.kind === 'stored_value') {
    if (input.principalFen === undefined || input.bonusFen === undefined) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '储值订正须传 principalFen+bonusFen（新绝对值，分）' });
    }
    return { principalFen: input.principalFen, bonusFen: input.bonusFen };
  }
  if (input.kind === 'rebate') {
    if (input.balanceFen === undefined) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '回馈金订正须传 balanceFen（新绝对值，分）' });
    }
    return { balanceFen: input.balanceFen };
  }
  if (!input.ts) throw new TRPCError({ code: 'BAD_REQUEST', message: '工时订正须传 ts（打卡新时刻 ISO 串）' });
  const d = new Date(input.ts);
  if (!Number.isFinite(d.getTime())) throw new TRPCError({ code: 'BAD_REQUEST', message: 'ts 格式非法（须 ISO 时刻串）' });
  return { ts: d.toISOString() };
}

export const correctionRouter = router({
  /**
   * propose（owner 发起）：before 取数→data_corrections 载荷单+approval_requests kind='correction'
   * pending 落行；值不动，待复核。
   */
  propose: merchantOwnerProcedure.input(proposeSchema).mutation(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const after = afterOf(input);
    const { before } = await loadBefore(ctx.db, storeId, input.kind, input.targetKey);
    return ctx.db.transaction(async (tx) => {
      const [corr] = await txDb(tx)
        .insert(schema.dataCorrections)
        .values({
          storeId,
          kind: input.kind,
          targetKey: input.targetKey,
          payloadJson: { before, after },
          note: input.note,
          status: 'pending',
          proposerId: ctx.user.id,
        })
        .returning({ id: schema.dataCorrections.id });
      const summary = `数据订正：${input.kind} · ${input.targetKey.slice(0, 12)}…（${input.note.slice(0, 30)}）`;
      const [req] = await txDb(tx)
        .insert(schema.approvalRequests)
        .values({
          storeId,
          kind: 'correction',
          refId: corr!.id,
          summary,
          status: 'pending',
          applicantId: ctx.user.id,
          timelineJson: [{ at: new Date().toISOString(), action: 'submitted', by: ctx.user.id }],
        })
        .returning({ id: schema.approvalRequests.id });
      return { correctionId: corr!.id, requestId: req!.id, summary };
    });
  }),

  /** list（owner 双视角）：订正单+审批单联查（pending 在前），按类/态过滤 */
  list: merchantOwnerProcedure
    .input(z.object({ status: z.enum(['pending', 'applied', 'rejected']).optional(), kind: z.enum(CORRECTION_KINDS).optional() }))
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.dataCorrections.storeId, ctx.user.storeId!)];
      if (input.status) conds.push(eq(schema.dataCorrections.status, input.status));
      if (input.kind) conds.push(eq(schema.dataCorrections.kind, input.kind));
      const rows = await ctx.db
        .select({
          correction: schema.dataCorrections,
          proposerNickname: schema.users.nickname,
          approvalId: schema.approvalRequests.id,
          approvalStatus: schema.approvalRequests.status,
          reviewerId: schema.approvalRequests.reviewerId,
          reviewNote: schema.approvalRequests.reviewNote,
          timelineJson: schema.approvalRequests.timelineJson,
        })
        .from(schema.dataCorrections)
        .leftJoin(schema.users, eq(schema.users.id, schema.dataCorrections.proposerId))
        .leftJoin(
          schema.approvalRequests,
          and(eq(schema.approvalRequests.refId, schema.dataCorrections.id), eq(schema.approvalRequests.kind, 'correction')),
        )
        .where(and(...conds))
        .orderBy(desc(schema.dataCorrections.createdAt))
        .limit(100);
      return { items: rows };
    }),

  /**
   * review（owner/manager 复核）：通过=同事务应用（before 重算防漂移+前后值流水留痕）；
   * 驳回=双 rejected 不落库。timeline 只增不改。
   */
  review: merchantManagerProcedure
    .input(z.object({ requestId: z.string().min(1), approve: z.boolean(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const req = (
          await txDb(tx).select().from(schema.approvalRequests).where(eq(schema.approvalRequests.id, input.requestId)).limit(1)
        )[0];
        if (!req || req.storeId !== storeId || req.kind !== 'correction') {
          throw new TRPCError({ code: 'NOT_FOUND', message: '审批单不存在' });
        }
        if (req.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该审批已处理，不可重复审批' });
        }
        const now = new Date();
        const timeline = [
          ...req.timelineJson,
          { at: now.toISOString(), action: input.approve ? 'approved' : 'rejected', by: ctx.user.id, ...(input.note ? { note: input.note } : {}) },
        ];
        await txDb(tx)
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
        const corr = (
          await txDb(tx).select().from(schema.dataCorrections).where(eq(schema.dataCorrections.id, req.refId)).limit(1)
        )[0];
        if (!corr) throw new TRPCError({ code: 'NOT_FOUND', message: '订正载荷单不存在' });
        if (!input.approve) {
          await txDb(tx)
            .update(schema.dataCorrections)
            .set({ status: 'rejected', updatedAt: now })
            .where(eq(schema.dataCorrections.id, corr.id));
          return { requestId: req.id, approved: false };
        }
        /* 应用分支：before 重算（防 propose→approve 间漂移，留痕以应用帧前后值为准） */
        const after = corr.payloadJson.after as Record<string, unknown>;
        if (corr.kind === 'stored_value') {
          const cur = await loadBefore(txDb(tx), storeId, corr.kind, corr.targetKey);
          const before = cur.before as { principalFen: number; bonusFen: number };
          const afterP = after.principalFen as number;
          const afterB = after.bonusFen as number;
          let accountId = cur.accountId;
          if (accountId === null) {
            const [ins] = await txDb(tx)
              .insert(schema.storedValueAccounts)
              .values({ userId: corr.targetKey, storeId, principalFen: afterP, bonusFen: afterB })
              .returning({ id: schema.storedValueAccounts.id });
            accountId = ins!.id;
          } else {
            await txDb(tx)
              .update(schema.storedValueAccounts)
              .set({ principalFen: afterP, bonusFen: afterB, updatedAt: now })
              .where(eq(schema.storedValueAccounts.id, accountId!));
          }
          const accId = accountId!;
          await txDb(tx).insert(schema.storedValueLogs).values({
            accountId: accId,
            userId: corr.targetKey,
            storeId,
            deltaPrincipalFen: afterP - before.principalFen,
            deltaBonusFen: afterB - before.bonusFen,
            deltaFen: afterP + afterB - (before.principalFen + before.bonusFen),
            balanceBeforeFen: before.principalFen + before.bonusFen,
            balanceAfterFen: afterP + afterB,
            operatorId: corr.proposerId,
            note: `数据订正单 ${corr.id}（复核 ${ctx.user.id}）`,
          });
        } else if (corr.kind === 'rebate') {
          const cur = await loadBefore(txDb(tx), storeId, corr.kind, corr.targetKey);
          const before = cur.before as { balanceFen: number };
          const afterBal = after.balanceFen as number;
          let accountId = cur.accountId;
          if (accountId === null) {
            const [ins] = await txDb(tx)
              .insert(schema.rebateAccounts)
              .values({ userId: corr.targetKey, balanceFen: afterBal })
              .returning({ id: schema.rebateAccounts.id });
            accountId = ins!.id;
          } else {
            await txDb(tx)
              .update(schema.rebateAccounts)
              .set({ balanceFen: afterBal, updatedAt: now })
              .where(eq(schema.rebateAccounts.id, accountId!));
          }
          const accId = accountId!;
          await txDb(tx).insert(schema.rebateLogs).values({
            userId: corr.targetKey,
            accountId: accId,
            type: 'correction',
            deltaFen: afterBal - before.balanceFen,
            beforeFen: before.balanceFen,
            afterFen: afterBal,
            sourceId: corr.id,
            note: `数据订正单 ${corr.id}（复核 ${ctx.user.id}）`,
          });
        } else {
          /* work_hours：打卡时刻修正（attendance_approvals type='adjust' 留痕行同 managerAdjust 工艺） */
          const cur = await loadBefore(txDb(tx), storeId, corr.kind, corr.targetKey);
          const rec = (cur as { record: typeof schema.attendanceRecords.$inferSelect }).record;
          const newTs = new Date(after.ts as string);
          await txDb(tx)
            .update(schema.attendanceRecords)
            .set({ ts: newTs, updatedAt: now })
            .where(eq(schema.attendanceRecords.id, rec.id));
          await txDb(tx).insert(schema.attendanceApprovals).values({
            storeId,
            staffId: rec.staffId,
            applicantUserId: corr.proposerId,
            type: 'adjust',
            recordId: rec.id,
            date: rec.date,
            kind: rec.kind,
            requestedTs: newTs,
            reason: `数据订正单 ${corr.id}：${corr.note}`,
            status: 'approved',
            reviewerId: ctx.user.id,
            reviewedAt: now,
          });
        }
        await txDb(tx)
          .update(schema.dataCorrections)
          .set({ status: 'applied', appliedAt: now, updatedAt: now })
          .where(eq(schema.dataCorrections.id, corr.id));
        return { requestId: req.id, approved: true, correctionId: corr.id, kind: corr.kind };
      });
    }),
});
