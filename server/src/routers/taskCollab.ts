/**
 * taskCollab tRPC router 群（员工端骨架整建批 片 3 · 任务执行+PDCA+自检）——
 * 三个 router 同文件（同属「门店协作执行」域，共享店域闸与端口读工艺）：
 *
 * - taskExec：循环任务。模板店长自管（upsert/deactivate 不删行）；落实例
 *   「触读即补生成」——listToday 先按当日命中模板 INSERT OR IGNORE（(template_id,
 *   biz_date) 唯一锚幂等，ensureOpenShift 懒建同工艺），scope=staff 落人到行、
 *   scope=role 落 NULL（该角色全员可见，完成落 doneBy）。提醒=listToday 顺带：
 *   now ≥ 截止−remindMin 且 pending 且 remindedAt IS NULL → task.reminder 事件
 *   （staff 频道：assignee 或该角色全员逐一）+ notifications 落行 + remindedAt
 *   条件置位（WHERE reminded_at IS NULL 保证并发也只发一次）。
 * - pdca：问题→整改→复检闭环。状态机 open→fixing→recheck→closed(pass)/fixing(fail
 *   回炉)；category 须命中端口 service_rules.pdca_categories.categories（集外 400
 *   「不在类目集」）；timeline_json 只增留痕照 support_tickets 工艺；门店内全员
 *   可见（公开透明=整改压力来源），recheck 闸门=merchantManager。
 * - selfCheck：门店每日自检。表项=service_rules.self_check_items 端口值（提交时
 *   快照进 items_json，端口后改不回溯）；分数服务端算（Σpass 项 score，不信前端）；
 *   (store_id,biz_date) 一店一日一表幂等锚——同日重交返回现状不覆盖；店长 review。
 *
 * 店域全部 eq(storeId) 卡死；listToday 的「我可见」=指给我 OR（角色池且我角色命中）
 * OR 我是 manager/owner 全见。
 */

import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  merchantManagerProcedure,
  router,
  staffProcedure,
  type Context,
} from '../trpc';
import { storeDayStartMs, storeWallclock } from './appointment';
import { resolveScopedRules } from './configRules';

/* ------------------------------------------------------------------ */
/* 公共小件                                                              */
/* ------------------------------------------------------------------ */

/** emitEvent 首参类型（事务 handle 运行时同构，类型断言同 cashier.ts 惯例） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

const pad2 = (n: number) => String(n).padStart(2, '0');

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}
function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

/** 门店规范时区（+8）今日 ISO 日期 + 当日起算 epoch ms + 今日星期几 */
function storeToday(now: Date): { bizDate: string; dayStartMs: number; dow: number } {
  const w = storeWallclock(now);
  return {
    bizDate: `${w.y}-${pad2(w.m)}-${pad2(w.day)}`,
    dayStartMs: storeDayStartMs(w.y, w.m, w.day),
    dow: w.dow, // 0=周日 … 6=周六
  };
}

/** 调用者是否本店管理岗（owner|manager——listToday/done 的「全见/可代办」口径） */
function isManagerSide(ctx: Context): boolean {
  return (
    ctx.user!.roles.includes('merchant_owner') || ctx.user!.roles.includes('merchant_manager')
  );
}

/** 读端口值（service_rules 最新 active 行；无行=null——端口未配置时调用方给明文）。
 * 大批片 2 分层：传 storeId 按本店作用域解析（本店覆盖行优先）；不传=既有全量口径 */
async function readServiceRule(d: DbHandle, ruleKey: string, storeId?: string | null): Promise<Record<string, unknown> | null> {
  const rows = await d
    .select({ ruleKey: schema.serviceRules.ruleKey, valueJson: schema.serviceRules.valueJson, storeId: schema.serviceRules.storeId })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, ruleKey), eq(schema.serviceRules.active, true)))
    .orderBy(desc(schema.serviceRules.version));
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  return row?.valueJson ?? null;
}

/** 本店在职员工（提醒/公告定向共用；可按岗位角色收窄） */
async function activeStaffOfStore(
  d: DbHandle,
  storeId: string,
  role?: 'frontdesk' | 'groomer',
): Promise<Array<{ id: string; userId: string; name: string; role: string }>> {
  const conds = [eq(schema.staff.storeId, storeId), eq(schema.staff.status, 'active')];
  if (role) conds.push(eq(schema.staff.role, role));
  return d
    .select({ id: schema.staff.id, userId: schema.staff.userId, name: schema.staff.name, role: schema.staff.role })
    .from(schema.staff)
    .where(and(...conds));
}

/* ------------------------------------------------------------------ */
/* taskExec：循环任务                                                    */
/* ------------------------------------------------------------------ */

/** 周日命中判定：weekdays 集 0/7 同指周日（种子与 UI 两侧都可能给 7） */
function hitsWeekday(weekdays: number[], dow: number): boolean {
  return weekdays.includes(dow) || (dow === 0 && weekdays.includes(7));
}

/**
 * 触读即补生成：对本店 active 模板、当日命中 freq/weekdays 的，
 * INSERT OR IGNORE task_runs（(template_id,biz_date) 幂等锚——并发触读/重复调用零双行）。
 * scope=staff 落 staffId=assignStaffId；scope=role 落 NULL（角色池共享一行）。
 */
async function ensureRunsForDate(d: DbHandle, storeId: string, bizDate: string, dow: number): Promise<void> {
  const templates = await d
    .select()
    .from(schema.taskTemplates)
    .where(and(eq(schema.taskTemplates.storeId, storeId), eq(schema.taskTemplates.active, true)));
  for (const tpl of templates) {
    const due = tpl.freq === 'daily' ? true : hitsWeekday(tpl.weekdays ?? [], dow);
    if (!due) continue;
    await d
      .insert(schema.taskRuns)
      .values({
        storeId,
        templateId: tpl.id,
        bizDate,
        staffId: tpl.assignScope === 'staff' ? tpl.assignStaffId : null,
        status: 'pending',
      })
      .onConflictDoNothing({ target: [schema.taskRuns.templateId, schema.taskRuns.bizDate] });
  }
}

const templateInput = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, '请填写任务标题').max(100),
  detail: z.string().trim().max(1000).optional(),
  assignScope: z.enum(['role', 'staff']),
  assignRole: z.enum(['frontdesk', 'groomer']).optional(),
  assignStaffId: z.string().min(1).optional(),
  freq: z.enum(['daily', 'weekly']),
  /** 0/7=周日…6=周六；daily 传全集或空（空=每日） */
  weekdays: z.array(z.number().int().min(0).max(7)).max(8).default([]),
  /** 当日起算截止分钟（如 1080=18:00） */
  dueMin: z.number().int().min(0).max(1440),
  /** 截止前提醒分钟（不传=不提醒） */
  remindMin: z.number().int().min(1).max(720).optional(),
});

export const taskExecRouter = router({
  /** templates（店长）：本店模板全量（含 inactive——管理视图要能见已停用） */
  templates: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.taskTemplates)
      .where(eq(schema.taskTemplates.storeId, ctx.user.storeId!))
      .orderBy(asc(schema.taskTemplates.createdAt));
    return { templates: rows };
  }),

  /**
   * upsertTemplate（店长）：id 在=更新（本店闸），不在=新建。
   * 校验：scope=staff 时 assignStaffId 必须属本店；scope=role 必须给 assignRole；
   * freq=weekly 时 weekdays 须非空子集。
   */
  upsertTemplate: merchantManagerProcedure.input(templateInput).mutation(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    if (input.assignScope === 'role' && !input.assignRole) {
      badRequest('按角色指派时必须选择岗位角色（frontdesk/groomer）');
    }
    if (input.assignScope === 'staff') {
      if (!input.assignStaffId) badRequest('指定到人时必须选择员工');
      const s = await ctx.db
        .select({ id: schema.staff.id })
        .from(schema.staff)
        .where(and(eq(schema.staff.id, input.assignStaffId!), eq(schema.staff.storeId, storeId)))
        .get();
      if (!s) badRequest('指派员工不属于本店');
    }
    if (input.freq === 'weekly' && input.weekdays.length === 0) {
      badRequest('按周循环时必须选择至少一个周日');
    }
    const values = {
      title: input.title,
      detail: input.detail ?? null,
      assignScope: input.assignScope,
      // 互斥落列：非本 scope 的指派字段清空，防「换 scope 后旧值幽灵生效」
      assignRole: input.assignScope === 'role' ? input.assignRole! : null,
      assignStaffId: input.assignScope === 'staff' ? input.assignStaffId! : null,
      freq: input.freq,
      weekdays: input.freq === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [...new Set(input.weekdays)].sort(),
      dueMin: input.dueMin,
      remindMin: input.remindMin ?? null,
      updatedAt: new Date(),
    };
    if (input.id) {
      const existing = await ctx.db
        .select()
        .from(schema.taskTemplates)
        .where(eq(schema.taskTemplates.id, input.id))
        .get();
      if (!existing || existing.storeId !== storeId) notFound('任务模板不存在');
      const updated = await ctx.db
        .update(schema.taskTemplates)
        .set(values)
        .where(eq(schema.taskTemplates.id, existing.id))
        .returning()
        .then((r) => r[0]!);
      return { template: updated, idempotent: false as const };
    }
    const created = await ctx.db
      .insert(schema.taskTemplates)
      .values({ ...values, storeId, createdBy: ctx.user.id })
      .returning()
      .then((r) => r[0]!);
    return { template: created, idempotent: false as const };
  }),

  /** deactivateTemplate（店长）：active=false 不删行（历史 runs 可追溯） */
  deactivateTemplate: merchantManagerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(schema.taskTemplates)
        .where(eq(schema.taskTemplates.id, input.id))
        .get();
      if (!existing || existing.storeId !== ctx.user.storeId) notFound('任务模板不存在');
      if (!existing.active) return { template: existing, idempotent: true as const };
      const updated = await ctx.db
        .update(schema.taskTemplates)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(schema.taskTemplates.id, existing.id))
        .returning()
        .then((r) => r[0]!);
      return { template: updated, idempotent: false as const };
    }),

  /**
   * listToday（员工）：先触读补生成今日 runs，再返回「我可见」集合
   * （指给我 / 我角色池 / manager 全见），并联模板取 title/detail/dueMin/remindMin。
   * 顺带提醒：到点（now ≥ 截止−remindMin）且 pending 且未提醒的 run，
   * 同事务条件置 remindedAt + emit task.reminder（assignee 或该角色全员 staff 频道）。
   */
  listToday: staffProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const now = new Date();
    const { bizDate, dayStartMs, dow } = storeToday(now);
    await ensureRunsForDate(ctx.db, storeId, bizDate, dow);

    const me = await ctx.db
      .select({ role: schema.staff.role })
      .from(schema.staff)
      .where(eq(schema.staff.id, ctx.user.staffId!))
      .get();
    const myRole = me?.role ?? null;
    const managerView = isManagerSide(ctx);

    const rows = await ctx.db
      .select({ run: schema.taskRuns, template: schema.taskTemplates })
      .from(schema.taskRuns)
      .innerJoin(schema.taskTemplates, eq(schema.taskTemplates.id, schema.taskRuns.templateId))
      .where(and(eq(schema.taskRuns.storeId, storeId), eq(schema.taskRuns.bizDate, bizDate)))
      .orderBy(asc(schema.taskRuns.createdAt));

    const visible = rows.filter(
      ({ run, template }) =>
        managerView ||
        run.staffId === ctx.user.staffId ||
        (run.staffId === null && template.assignRole === myRole),
    );

    /* ---- 提醒一发闸：条件 UPDATE 抢到置位权才发事件（并发触读不双发） ---- */
    const outboxIds: string[] = [];
    for (const { run, template } of visible) {
      if (run.status !== 'pending' || run.remindedAt || template.remindMin == null) continue;
      const remindAtMs = dayStartMs + (template.dueMin - template.remindMin) * 60_000;
      if (now.getTime() < remindAtMs) continue;
      const claimed = await ctx.db.transaction(async (tx) => {
        const got = await tx
          .update(schema.taskRuns)
          .set({ remindedAt: now, updatedAt: now })
          .where(and(eq(schema.taskRuns.id, run.id), isNull(schema.taskRuns.remindedAt)))
          .returning({ id: schema.taskRuns.id });
        if (got.length === 0) return false; // 已被并发触读发过
        const targets =
          run.staffId !== null
            ? [{ id: run.staffId }]
            : (await activeStaffOfStore(txDb(tx), storeId, template.assignRole as 'frontdesk' | 'groomer')).map(
                (s) => ({ id: s.id }),
              );
        for (const t of targets) {
          outboxIds.push(
            await emitEvent(txDb(tx), `staff:${t.id}`, EventType.TaskReminder, {
              runId: run.id,
              templateId: template.id,
              title: template.title,
              dueMin: template.dueMin,
              bizDate,
            }),
          );
        }
        return true;
      });
      if (claimed) run.remindedAt = now; // 返回体同帧（已提醒态透出）
    }
    outboxIds.forEach(broadcastNow);

    return {
      bizDate,
      runs: visible.map(({ run, template }) => ({
        ...run,
        title: template.title,
        detail: template.detail,
        dueMin: template.dueMin,
        remindMin: template.remindMin,
        assignRole: template.assignRole,
      })),
    };
  }),

  /**
   * done（员工）：只能由 assignee 本人 / 角色匹配者 / manager+ 完成。
   * 幂等：已 done 返回现状（doneBy/doneAt 不变，不覆盖）。
   */
  done: staffProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db
        .select({ run: schema.taskRuns, template: schema.taskTemplates })
        .from(schema.taskRuns)
        .innerJoin(schema.taskTemplates, eq(schema.taskTemplates.id, schema.taskRuns.templateId))
        .where(eq(schema.taskRuns.id, input.runId))
        .get();
      if (!row || row.run.storeId !== ctx.user.storeId) notFound('任务不存在');
      const { run, template } = row;
      const me = await ctx.db
        .select({ role: schema.staff.role })
        .from(schema.staff)
        .where(eq(schema.staff.id, ctx.user.staffId!))
        .get();
      const allowed =
        isManagerSide(ctx) ||
        run.staffId === ctx.user.staffId ||
        (run.staffId === null && template.assignRole === (me?.role ?? null));
      if (!allowed) forbidden('该任务未指派给你，无权完成');
      if (run.status === 'done') return { run, idempotent: true as const }; // 幂等：返回现状
      const now = new Date();
      const updated = await ctx.db
        .update(schema.taskRuns)
        .set({ status: 'done', doneBy: ctx.user.id, doneAt: now, updatedAt: now })
        .where(eq(schema.taskRuns.id, run.id))
        .returning()
        .then((r) => r[0]!);
      return { run: updated, idempotent: false as const };
    }),

  /** listRuns（店长）：日期段 runs + 模板名 + 完成人名（周视图用） */
  listRuns: merchantManagerProcedure
    .input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          run: schema.taskRuns,
          title: schema.taskTemplates.title,
          dueMin: schema.taskTemplates.dueMin,
          doneByName: schema.users.nickname,
          staffName: schema.staff.name,
        })
        .from(schema.taskRuns)
        .innerJoin(schema.taskTemplates, eq(schema.taskTemplates.id, schema.taskRuns.templateId))
        .leftJoin(schema.users, eq(schema.users.id, schema.taskRuns.doneBy))
        .leftJoin(schema.staff, eq(schema.staff.id, schema.taskRuns.staffId))
        .where(
          and(
            eq(schema.taskRuns.storeId, ctx.user.storeId!),
            gte(schema.taskRuns.bizDate, input.from),
            sql`${schema.taskRuns.bizDate} <= ${input.to}`,
          ),
        )
        .orderBy(asc(schema.taskRuns.bizDate), asc(schema.taskRuns.createdAt));
      return { runs: rows };
    }),
});

/* ------------------------------------------------------------------ */
/* pdca：问题-整改-复检闭环                                               */
/* ------------------------------------------------------------------ */

type PdcaTimelineEntry = { at: number; by: string; action: string; note?: string };

export const pdcaRouter = router({
  /**
   * raise（员工）：提问题。category 须命中本店端口集 pdca_categories.categories，
   * 集外 400「不在类目集」（类目=巡检排行分组维度，自由文本会把排行打散）。
   */
  raise: staffProcedure
    .input(
      z.object({
        title: z.string().trim().min(1, '请填写问题标题').max(100),
        category: z.string().trim().min(1, '请选择问题类目').max(50),
        detail: z.string().trim().max(1000).optional(),
        photoUrls: z.array(z.string().min(1).max(1024)).max(9, '附图最多 9 张').default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const port = await readServiceRule(ctx.db, 'pdca_categories', ctx.user.storeId); // 大批片 2 分层：按本店作用域解析
      const categories = Array.isArray(port?.categories) ? (port!.categories as string[]) : [];
      if (!categories.includes(input.category)) {
        badRequest(`问题类目「${input.category}」不在类目集内，请联系店长在配置端口维护类目`);
      }
      const now = new Date();
      const timeline: PdcaTimelineEntry[] = [
        { at: Math.floor(now.getTime() / 1000), by: ctx.user.id, action: 'raise' },
      ];
      const row = await ctx.db
        .insert(schema.pdcaIssues)
        .values({
          storeId: ctx.user.storeId!,
          title: input.title,
          detail: input.detail ?? null,
          category: input.category,
          photoUrls: input.photoUrls,
          raisedBy: ctx.user.id,
          status: 'open',
          timelineJson: timeline,
        })
        .returning()
        .then((r) => r[0]!);
      return { issue: row };
    }),

  /** categories（员工）：读端口 pdca_categories 当前类目集（raise 表单下拉数据源；与 raise 校验同口） */
  categories: staffProcedure.query(async ({ ctx }) => {
    const port = await readServiceRule(ctx.db, 'pdca_categories', ctx.user.storeId); // 大批片 2 分层：按本店作用域解析
    const categories = Array.isArray(port?.categories) ? (port!.categories as string[]) : [];
    return { categories };
  }),

  /** list（员工）：本店全部（门店内公开透明=整改压力来源），支持 status 过滤 */
  list: staffProcedure
    .input(
      z
        .object({ status: z.enum(['open', 'fixing', 'recheck', 'closed']).optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.pdcaIssues.storeId, ctx.user.storeId!)];
      if (input?.status) conds.push(eq(schema.pdcaIssues.status, input.status));
      const rows = await ctx.db
        .select()
        .from(schema.pdcaIssues)
        .where(and(...conds))
        .orderBy(desc(schema.pdcaIssues.createdAt))
        .limit(100);
      return { issues: rows };
    }),

  /** startFix（assignee 本人或 manager+）：open→fixing；未指派时领取=指派给自己 */
  startFix: staffProcedure
    .input(z.object({ issueId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const issue = await loadStoreIssue(ctx, input.issueId);
      assertAssigneeOrManager(ctx, issue.assignStaffId);
      if (issue.status !== 'open') badRequest('仅待认领（open）的问题可开始整改');
      const now = new Date();
      const updated = await ctx.db
        .update(schema.pdcaIssues)
        .set({
          status: 'fixing',
          assignStaffId: issue.assignStaffId ?? ctx.user.staffId!, // 领取即落责任人
          timelineJson: [
            ...issue.timelineJson,
            { at: Math.floor(now.getTime() / 1000), by: ctx.user.id, action: 'startFix' },
          ],
          updatedAt: now,
        })
        .where(eq(schema.pdcaIssues.id, issue.id))
        .returning()
        .then((r) => r[0]!);
      return { issue: updated };
    }),

  /** submitFix（assignee 本人或 manager+）：fixing→recheck，fixNote 必填 */
  submitFix: staffProcedure
    .input(z.object({ issueId: z.string().min(1), fixNote: z.string().trim().min(1, '请填写整改说明').max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const issue = await loadStoreIssue(ctx, input.issueId);
      assertAssigneeOrManager(ctx, issue.assignStaffId);
      if (issue.status !== 'fixing') badRequest('仅整改中（fixing）的问题可提交复检');
      const now = new Date();
      const updated = await ctx.db
        .update(schema.pdcaIssues)
        .set({
          status: 'recheck',
          fixNote: input.fixNote,
          fixedBy: ctx.user.id,
          fixedAt: now,
          timelineJson: [
            ...issue.timelineJson,
            { at: Math.floor(now.getTime() / 1000), by: ctx.user.id, action: 'submitFix', note: input.fixNote },
          ],
          updatedAt: now,
        })
        .where(eq(schema.pdcaIssues.id, issue.id))
        .returning()
        .then((r) => r[0]!);
      return { issue: updated };
    }),

  /** recheck（店长）：pass→closed / fail→fixing（回炉）；都落 recheck* 列+timeline */
  recheck: merchantManagerProcedure
    .input(
      z.object({
        issueId: z.string().min(1),
        result: z.enum(['pass', 'fail']),
        note: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db
        .select()
        .from(schema.pdcaIssues)
        .where(eq(schema.pdcaIssues.id, input.issueId))
        .get();
      if (!issue || issue.storeId !== ctx.user.storeId) notFound('问题不存在');
      if (issue.status !== 'recheck') badRequest('仅待复检（recheck）的问题可复检');
      const now = new Date();
      const pass = input.result === 'pass';
      const updated = await ctx.db
        .update(schema.pdcaIssues)
        .set({
          status: pass ? 'closed' : 'fixing', // fail=回炉重修
          recheckNote: input.note ?? null,
          recheckBy: ctx.user.id,
          recheckAt: now,
          recheckResult: input.result,
          timelineJson: [
            ...issue.timelineJson,
            {
              at: Math.floor(now.getTime() / 1000),
              by: ctx.user.id,
              action: pass ? 'recheckPass' : 'recheckFail',
              ...(input.note ? { note: input.note } : {}),
            },
          ],
          updatedAt: now,
        })
        .where(eq(schema.pdcaIssues.id, issue.id))
        .returning()
        .then((r) => r[0]!);
      return { issue: updated };
    }),

  /**
   * summary（店长）：巡检聚合只读——byStatus 计数 / byCategory 排行 / 近 30 天 closed 数。
   * 单店口径（eq storeId）；跨店排行=开口项 5，待多店口径冻结后再开。
   */
  summary: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const rows = await ctx.db
      .select({ status: schema.pdcaIssues.status, category: schema.pdcaIssues.category, updatedAt: schema.pdcaIssues.updatedAt })
      .from(schema.pdcaIssues)
      .where(eq(schema.pdcaIssues.storeId, storeId));
    const byStatus: Record<string, number> = {};
    const catCount = new Map<string, number>();
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    let closed30d = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.category) catCount.set(r.category, (catCount.get(r.category) ?? 0) + 1);
      if (r.status === 'closed' && r.updatedAt >= cutoff) closed30d += 1;
    }
    const byCategory = [...catCount.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    return { byStatus, byCategory, closedLast30d: closed30d, total: rows.length };
  }),
});

/** 本店问题加载（店域闸：非本店一律 NOT_FOUND，不透出他店存在性） */
async function loadStoreIssue(ctx: Context, issueId: string) {
  const issue = await ctx.db
    .select()
    .from(schema.pdcaIssues)
    .where(eq(schema.pdcaIssues.id, issueId))
    .get();
  if (!issue || issue.storeId !== ctx.user!.storeId) notFound('问题不存在');
  return issue;
}

/** assignee 本人（staffId 对齐）或 manager+ 才可推进整改 */
function assertAssigneeOrManager(ctx: Context, assignStaffId: string | null): void {
  if (isManagerSide(ctx)) return;
  if (assignStaffId && assignStaffId === ctx.user!.staffId) return;
  if (!assignStaffId) return; // 未指派=全员可领（startFix 领取落人）
  forbidden('仅整改责任人本人或店长可推进该问题');
}

/* ------------------------------------------------------------------ */
/* selfCheck：门店每日自检 + 上级审核                                       */
/* ------------------------------------------------------------------ */

const selfCheckItemSchema = z.object({
  key: z.string().min(1).max(50),
  pass: z.boolean(),
  photoUrl: z.string().min(1).max(1024).optional(),
  note: z.string().trim().max(500).optional(),
});

interface SelfCheckPortItem {
  key: string;
  label: string;
  score: number;
}

export const selfCheckRouter = router({
  /** items（员工）：读端口 self_check_items 当前生效表项（提交按此快照） */
  items: staffProcedure.query(async ({ ctx }) => {
    const port = await readServiceRule(ctx.db, 'self_check_items', ctx.user.storeId); // 大批片 2 分层：按本店作用域解析
    const items = (Array.isArray(port?.items) ? port!.items : []) as SelfCheckPortItem[];
    return { items };
  }),

  /**
   * submit（员工）：按端口表项快照 + 服务端算分（Σpass 项 score，不信前端）。
   * 同日同店已有 → 幂等返回现状（不双写不覆盖——(store_id,biz_date) 唯一锚）。
   * 入参只取 pass/photoUrl/note 三个意愿位，label/score 一律以端口快照为准。
   */
  submit: staffProcedure
    .input(z.object({ items: z.array(selfCheckItemSchema).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const { bizDate } = storeToday(new Date());
      const existing = await ctx.db
        .select()
        .from(schema.selfCheckRuns)
        .where(and(eq(schema.selfCheckRuns.storeId, storeId), eq(schema.selfCheckRuns.bizDate, bizDate)))
        .get();
      if (existing) return { run: existing, idempotent: true as const };

      const port = await readServiceRule(ctx.db, 'self_check_items', storeId); // 大批片 2 分层：按本店作用域解析
      const portItems = (Array.isArray(port?.items) ? port!.items : []) as SelfCheckPortItem[];
      if (portItems.length === 0) badRequest('自检表项未配置，请联系店长在配置端口维护 self_check_items');
      const answerByKey = new Map(input.items.map((i) => [i.key, i]));
      let score = 0;
      const snapshot = portItems.map((p) => {
        const a = answerByKey.get(p.key);
        const pass = a?.pass === true;
        if (pass) score += p.score;
        return {
          key: p.key,
          label: p.label,
          score: p.score,
          pass,
          ...(a?.photoUrl ? { photoUrl: a.photoUrl } : {}),
          ...(a?.note ? { note: a.note } : {}),
        };
      });
      const row = await ctx.db
        .insert(schema.selfCheckRuns)
        .values({
          storeId,
          bizDate,
          itemsJson: snapshot,
          score,
          filledBy: ctx.user.id,
          status: 'submitted',
        })
        .returning()
        .then((r) => r[0]!);
      return { run: row, idempotent: false as const };
    }),

  /** today（员工）：本店今日 run 或 null；透出 items 数组（=itemsJson 同帧，页面已交态回显形状——片 3 复核打回件：原样行缺 items 致 .find 崩） */
  today: staffProcedure.query(async ({ ctx }) => {
    const { bizDate } = storeToday(new Date());
    const row = await ctx.db
      .select()
      .from(schema.selfCheckRuns)
      .where(and(eq(schema.selfCheckRuns.storeId, ctx.user.storeId!), eq(schema.selfCheckRuns.bizDate, bizDate)))
      .get();
    return { run: row ? { ...row, items: row.itemsJson } : null };
  }),

  /** listPending（店长）：submitted 未审（提交升序=先交先审） */
  listPending: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.selfCheckRuns)
      .where(and(eq(schema.selfCheckRuns.storeId, ctx.user.storeId!), eq(schema.selfCheckRuns.status, 'submitted')))
      .orderBy(asc(schema.selfCheckRuns.createdAt))
      .limit(100);
    return { runs: rows };
  }),

  /** review（店长）：submitted→reviewed + reviewBy/At；已审重复调=幂等返回现状 */
  review: merchantManagerProcedure
    .input(z.object({ runId: z.string().min(1), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db
        .select()
        .from(schema.selfCheckRuns)
        .where(eq(schema.selfCheckRuns.id, input.runId))
        .get();
      if (!run || run.storeId !== ctx.user.storeId) notFound('自检记录不存在');
      if (run.status === 'reviewed') return { run, idempotent: true as const };
      const now = new Date();
      const updated = await ctx.db
        .update(schema.selfCheckRuns)
        .set({ status: 'reviewed', reviewNote: input.note ?? null, reviewBy: ctx.user.id, reviewAt: now, updatedAt: now })
        .where(eq(schema.selfCheckRuns.id, run.id))
        .returning()
        .then((r) => r[0]!);
      return { run: updated, idempotent: false as const };
    }),
});
