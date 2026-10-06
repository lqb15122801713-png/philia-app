/**
 * 排班域 router（员工端骨架整建批 片 2 · 冻结版 V1.0 §二.B2）
 *
 * 覆盖件：班次模板（建/停/幂等重放）/ 按周生成（全员铺 + 请假跳过 skipReport）/
 * 手动排班（请假硬校验「排到请假人=系统责任」）/ 取消留痕 / 周发布（幂等 +
 * schedule.published 逐员工事件）/ 换班申请审批（未批责任归原人，批准才换挂 +
 * shift.swapResolved 双方事件）/ 可用时间 upsert / 请假调休双流 / 调休台账 /
 * 技能标签（标签集=service_rules.staff_skill_tags 端口）/ 周视图 / CSV 导入
 * （preview 零写入 + execute 幂等跳过，列名映射改映射不改码）。
 *
 * 口径：
 * - 日期一律 ISO 'YYYY-MM-DD' 文本列；「未过」判定按门店规范时区（+8）今日；
 * - 幂等三件套：同 staff+date+startMin 撞 active 行=跳过/400（唯一索引兜底）、
 *   同单 pending 换班/同人同期 pending 请假=返回现状、publishWeek 只发未发布行；
 * - 取消/驳回/调整一律留痕不删行（cancelled+note / decided* 三列 / comp_off_ledger 只增）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { schema } from '../db';
import { parseCsv } from '../lib/csvParse';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  merchantManagerProcedure,
  publicProcedure,
  router,
  staffProcedure,
  type Db,
} from '../trpc';
import { resolveScopedRules } from './configRules';
import { storeWallclock } from './appointment';

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上显式断言，同 appointment.ts 惯例） */
const txDb = (tx: unknown): Db => tx as Db;

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
/* 日期工具（ISO 文本日界；周历计算用 UTC 位移避免服务器时区干扰）              */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateSchema = z.string().regex(DATE_RE, '日期格式须为 YYYY-MM-DD');
const pad2 = (n: number) => String(n).padStart(2, '0');

/** ISO 日期 + n 天 → ISO 日期 */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO 日期 → 周日序号（0=周日 1=周一…6=周六） */
function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** 模板/可用时间周日值归一：0 与 7 都=周日 → 0 */
function normWeekday(w: number): number {
  return w === 7 ? 0 : w;
}

/** 门店规范时区（+8）今日 ISO */
function todayStr(): string {
  const w = storeWallclock(new Date());
  return `${w.y}-${pad2(w.m)}-${pad2(w.day)}`;
}

/* ------------------------------------------------------------------ */
/* 共享查询件                                                              */
/* ------------------------------------------------------------------ */

type StaffRow = typeof schema.staff.$inferSelect;
type LeaveRow = typeof schema.leaveRequests.$inferSelect;

/** 本店员工硬校验（存在即返回行；跨店/不存在一律 BAD_REQUEST 不明文泄露） */
async function staffInStore(d: Db, storeId: string, staffId: string): Promise<StaffRow> {
  const row = await d
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.id, staffId), eq(schema.staff.storeId, storeId)))
    .get();
  if (!row) badRequest('员工不存在或不属于本店');
  return row!;
}

/** 员工某日是否有 approved 请假/调休单覆盖（排到请假人=系统责任 的判定源） */
function approvedLeaveOn(leaves: LeaveRow[], staffId: string, date: string): LeaveRow | undefined {
  return leaves.find(
    (l) => l.staffId === staffId && l.startDate <= date && date <= l.endDate,
  );
}

/** 请假硬校验文案（assign / importExecute 共用同一明文） */
function leaveBlockMessage(leave: LeaveRow): string {
  return `该员工当日已准假（请假单 ${leave.id}），排到请假人=系统责任`;
}

/** 读取本店 approved 请假单（可按日期窗收窄） */
async function approvedLeaves(d: Db, storeId: string, from: string, to: string): Promise<LeaveRow[]> {
  return d
    .select()
    .from(schema.leaveRequests)
    .where(
      and(
        eq(schema.leaveRequests.storeId, storeId),
        eq(schema.leaveRequests.status, 'approved'),
        lte(schema.leaveRequests.startDate, to),
        gte(schema.leaveRequests.endDate, from),
      ),
    );
}

/** 当前生效的技能标签集（service_rules.staff_skill_tags，读法同 serviceLoop.serviceHours）。
 * 大批片 2 分层：传 storeId 按本店作用域解析（本店覆盖行优先）；不传=既有全量口径 */
async function loadSkillTags(d: Db, storeId?: string | null): Promise<string[]> {
  const rows = await d
    .select({ ruleKey: schema.serviceRules.ruleKey, valueJson: schema.serviceRules.valueJson, storeId: schema.serviceRules.storeId })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, 'staff_skill_tags'), eq(schema.serviceRules.active, true)))
    .orderBy(desc(schema.serviceRules.version));
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  const tags = row?.valueJson?.tags;
  return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
}

/* ------------------------------------------------------------------ */
/* CSV 导入（preview / execute 共用同一解析管线）                              */
/* ------------------------------------------------------------------ */

/**
 * 列名映射表（列名漂移改本表不改码）：必要列=员工/日期/开始/结束。
 * 员工列按姓名或 staff id 匹配本店员工；日期兼容 YYYY-MM-DD 与 YYYY/M/D；
 * 时间兼容 H:MM / HH:MM（当日分钟数落库）。
 */
const IMPORT_COLUMN_MAP = {
  staff: ['员工', '员工姓名', '姓名'],
  date: ['日期', '排班日期', '上班日期'],
  start: ['开始', '开始时间', '上班时间'],
  end: ['结束', '结束时间', '下班时间'],
} as const;

interface ImportRowPlan {
  /** 1-based 行号（含表头） */
  line: number;
  staffInput: string;
  staffId?: string;
  date?: string;
  startMin?: number;
  endMin?: number;
  ok: boolean;
  failReason?: string;
}

/** CSV 日期：YYYY-MM-DD 或 YYYY/M/D（月日可单 digit）→ ISO；非法返回 null */
function parseImportDate(raw: string): string | null {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const iso = `${y}-${pad2(Number(mo))}-${pad2(Number(d))}`;
  return weekdayOf(iso) >= 0 && addDays(iso, 0) === iso ? iso : null;
}

/** CSV 时间：H:MM / HH:MM → 当日分钟数；非法返回 null */
function parseImportTime(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null;
}

async function buildImportPlan(
  d: Db,
  storeId: string,
  csvText: string,
): Promise<{ plans: ImportRowPlan[]; okRows: number; failRows: number }> {
  const grid = parseCsv(csvText);
  if (grid.length < 2) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'CSV 为空或缺少表头/数据行' });
  }
  const header = grid[0]!.map((h) => h.trim());
  const colOf = (aliases: readonly string[]) => {
    for (const a of aliases) {
      const idx = header.indexOf(a);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const colIdx = {
    staff: colOf(IMPORT_COLUMN_MAP.staff),
    date: colOf(IMPORT_COLUMN_MAP.date),
    start: colOf(IMPORT_COLUMN_MAP.start),
    end: colOf(IMPORT_COLUMN_MAP.end),
  };
  for (const key of ['staff', 'date', 'start', 'end'] as const) {
    if (colIdx[key] < 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `CSV 表头缺少必要列「${IMPORT_COLUMN_MAP[key][0]}」（可接受别名：${IMPORT_COLUMN_MAP[key].join('/')}；实际表头：${header.join(' | ')}）`,
      });
    }
  }

  const staffRows = await d
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.storeId, storeId));
  const byId = new Map(staffRows.map((s) => [s.id, s]));
  const byName = new Map<string, StaffRow[]>();
  for (const s of staffRows) {
    const list = byName.get(s.name) ?? [];
    list.push(s);
    byName.set(s.name, list);
  }
  const leaves = await d
    .select()
    .from(schema.leaveRequests)
    .where(and(eq(schema.leaveRequests.storeId, storeId), eq(schema.leaveRequests.status, 'approved')));

  const dataRows = grid.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
  const plans: ImportRowPlan[] = [];
  let okRows = 0;
  let failRows = 0;

  dataRows.forEach((cols, i) => {
    const line = i + 2; // 含表头的 1-based 行号
    const cell = (idx: number) => (idx >= 0 ? (cols[idx] ?? '').trim() : '');
    const plan: ImportRowPlan = {
      line,
      staffInput: cell(colIdx.staff),
      ok: false,
    };
    const fail = (reason: string) => {
      plan.failReason = reason;
      failRows += 1;
      plans.push(plan);
    };

    // 员工列：先按 staff id 精确匹配，再按姓名（重名须改用 id）
    const staffRow = byId.get(plan.staffInput) ?? (() => {
      const hits = byName.get(plan.staffInput) ?? [];
      return hits.length === 1 ? hits[0]! : undefined;
    })();
    if (!plan.staffInput) return fail('员工列为空');
    if (!staffRow) {
      const hits = byName.get(plan.staffInput) ?? [];
      return fail(
        hits.length > 1
          ? `员工姓名「${plan.staffInput}」重名，请改用 staff id`
          : `员工「${plan.staffInput}」不在本店员工名册`,
      );
    }
    plan.staffId = staffRow.id;
    if (staffRow.status !== 'active') return fail(`员工「${staffRow.name}」已停职，不可排班`);

    const date = parseImportDate(cell(colIdx.date));
    if (!date) return fail(`日期「${cell(colIdx.date)}」格式不支持（需 YYYY-MM-DD 或 YYYY/M/D）`);
    plan.date = date;
    const startMin = parseImportTime(cell(colIdx.start));
    const endMin = parseImportTime(cell(colIdx.end));
    if (startMin === null || endMin === null) {
      return fail(`时间格式不支持（需 HH:MM）：${cell(colIdx.start)} ~ ${cell(colIdx.end)}`);
    }
    if (endMin <= startMin) return fail('结束时间须晚于开始时间');
    plan.startMin = startMin;
    plan.endMin = endMin;

    // 请假联动硬校验（与 assign 同闸）
    const leave = approvedLeaveOn(leaves, staffRow.id, date);
    if (leave) return fail(leaveBlockMessage(leave));

    plan.ok = true;
    okRows += 1;
    plans.push(plan);
  });

  return { plans, okRows, failRows };
}

/* ------------------------------------------------------------------ */
/* router                                                                */
/* ------------------------------------------------------------------ */

const weekdaySchema = z.number().int().min(0).max(7); // 0/7=周日 1=周一…6=周六
const minutesSchema = z.number().int().min(0).max(24 * 60);

export const scheduleRouter = router({
  /* ---- 1. 班次模板 ---- */

  /** templates（manager 读）：本店模板列表（含已停用，最新在前） */
  templates: merchantManagerProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db
      .select()
      .from(schema.shiftTemplates)
      .where(eq(schema.shiftTemplates.storeId, ctx.user.storeId!))
      .orderBy(desc(schema.shiftTemplates.createdAt));
    return { templates };
  }),

  /** templateUpsert（manager 写）：按 (store,name) 归位；同 name 同参数重放=返回现状幂等 */
  templateUpsert: merchantManagerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, '班次名必填'),
        startMin: minutesSchema,
        endMin: minutesSchema,
        weekdays: z.array(weekdaySchema).min(1, '至少选一个适用周日'),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.endMin <= input.startMin) badRequest('结束时间须晚于开始时间');
      const storeId = ctx.user.storeId!;
      const weekdays = [...new Set(input.weekdays.map(normWeekday))].sort((a, b) => a - b);
      const existing = await ctx.db
        .select()
        .from(schema.shiftTemplates)
        .where(and(eq(schema.shiftTemplates.storeId, storeId), eq(schema.shiftTemplates.name, input.name)))
        .get();
      if (existing) {
        const sameParams =
          existing.startMin === input.startMin &&
          existing.endMin === input.endMin &&
          JSON.stringify(existing.weekdays) === JSON.stringify(weekdays) &&
          existing.active === (input.active ?? existing.active);
        if (sameParams) return { template: existing, idempotent: true };
        const updated = await ctx.db
          .update(schema.shiftTemplates)
          .set({
            startMin: input.startMin,
            endMin: input.endMin,
            weekdays,
            active: input.active ?? existing.active,
            updatedAt: new Date(),
          })
          .where(eq(schema.shiftTemplates.id, existing.id))
          .returning()
          .then((r) => r[0]!);
        return { template: updated, idempotent: false };
      }
      const inserted = await ctx.db
        .insert(schema.shiftTemplates)
        .values({
          storeId,
          name: input.name,
          startMin: input.startMin,
          endMin: input.endMin,
          weekdays,
          active: input.active ?? true,
          createdBy: ctx.user.id,
        })
        .returning()
        .then((r) => r[0]!);
      return { template: inserted, idempotent: false };
    }),

  /** templateDeactivate（manager）：停用不删行（幂等，重放逐字段同值） */
  templateDeactivate: merchantManagerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const tpl = await ctx.db
        .select()
        .from(schema.shiftTemplates)
        .where(and(eq(schema.shiftTemplates.id, input.id), eq(schema.shiftTemplates.storeId, ctx.user.storeId!)))
        .get();
      if (!tpl) notFound('模板不存在');
      if (!tpl.active) return { template: tpl, idempotent: true };
      const updated = await ctx.db
        .update(schema.shiftTemplates)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(schema.shiftTemplates.id, tpl.id))
        .returning()
        .then((r) => r[0]!);
      return { template: updated, idempotent: false };
    }),

  /* ---- 2. 按周生成（模板 × 全员 active 员工；请假跳过列 skipReport） ---- */

  generate: merchantManagerProcedure
    .input(z.object({ weekStart: dateSchema }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const days = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i));
      const templates = await ctx.db
        .select()
        .from(schema.shiftTemplates)
        .where(and(eq(schema.shiftTemplates.storeId, storeId), eq(schema.shiftTemplates.active, true)));
      const staffRows = await ctx.db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.storeId, storeId), eq(schema.staff.status, 'active')));
      const leaves = await approvedLeaves(ctx.db, storeId, days[0]!, days[6]!);
      const existing = await ctx.db
        .select({
          staffId: schema.shiftAssignments.staffId,
          date: schema.shiftAssignments.date,
          startMin: schema.shiftAssignments.startMin,
        })
        .from(schema.shiftAssignments)
        .where(
          and(
            eq(schema.shiftAssignments.storeId, storeId),
            eq(schema.shiftAssignments.status, 'active'),
            gte(schema.shiftAssignments.date, days[0]!),
            lte(schema.shiftAssignments.date, days[6]!),
          ),
        );
      const existingKeys = new Set(existing.map((r) => `${r.staffId}|${r.date}|${r.startMin}`));

      let created = 0;
      let skippedExisting = 0;
      const skipReport: Array<{ staffId: string; staffName: string; date: string; reason: string }> = [];
      await ctx.db.transaction(async (tx) => {
        for (const tpl of templates) {
          const tplDays = new Set(tpl.weekdays.map(normWeekday));
          for (const date of days) {
            if (!tplDays.has(weekdayOf(date))) continue;
            for (const s of staffRows) {
              const leave = approvedLeaveOn(leaves, s.id, date);
              if (leave) {
                // 生成侧跳过=不排（assign 侧硬拒）；排到请假人=系统责任
                skipReport.push({
                  staffId: s.id,
                  staffName: s.name,
                  date,
                  reason: `已准假（请假单 ${leave.id}）`,
                });
                continue;
              }
              const key = `${s.id}|${date}|${tpl.startMin}`;
              if (existingKeys.has(key)) {
                skippedExisting += 1;
                continue;
              }
              await tx.insert(schema.shiftAssignments).values({
                storeId,
                staffId: s.id,
                date,
                startMin: tpl.startMin,
                endMin: tpl.endMin,
                templateId: tpl.id,
                source: 'template',
                createdBy: ctx.user.id,
              });
              existingKeys.add(key);
              created += 1;
            }
          }
        }
      });
      return { weekStart: input.weekStart, created, skippedExisting, skipReport };
    }),

  /* ---- 3. 手动排班（请假硬校验 + 同键撞 400） ---- */

  assign: merchantManagerProcedure
    .input(
      z.object({
        staffId: z.string().min(1),
        date: dateSchema,
        startMin: minutesSchema,
        endMin: minutesSchema,
        note: z.string().trim().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.endMin <= input.startMin) badRequest('结束时间须晚于开始时间');
      const storeId = ctx.user.storeId!;
      const staffRow = await staffInStore(ctx.db, storeId, input.staffId);
      if (staffRow.status !== 'active') badRequest(`员工「${staffRow.name}」已停职，不可排班`);
      const leaves = await approvedLeaves(ctx.db, storeId, input.date, input.date);
      const leave = approvedLeaveOn(leaves, input.staffId, input.date);
      if (leave) badRequest(leaveBlockMessage(leave));
      const dup = await ctx.db
        .select({ id: schema.shiftAssignments.id })
        .from(schema.shiftAssignments)
        .where(
          and(
            eq(schema.shiftAssignments.staffId, input.staffId),
            eq(schema.shiftAssignments.date, input.date),
            eq(schema.shiftAssignments.startMin, input.startMin),
            eq(schema.shiftAssignments.status, 'active'),
          ),
        )
        .get();
      if (dup) badRequest('该员工当日同时段已有排班（同 staff+date+startMin 撞）');
      const inserted = await ctx.db
        .insert(schema.shiftAssignments)
        .values({
          storeId,
          staffId: input.staffId,
          date: input.date,
          startMin: input.startMin,
          endMin: input.endMin,
          source: 'manual',
          note: input.note ?? null,
          createdBy: ctx.user.id,
        })
        .returning()
        .then((r) => r[0]!);
      return { assignment: inserted };
    }),

  /* ---- 4. 取消排班（留痕不删行，note 必填） ---- */

  cancelAssignment: merchantManagerProcedure
    .input(z.object({ assignmentId: z.string().min(1), note: z.string().trim().min(1, '取消须填注记（顶班/临时调整留痕）') }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db
        .select()
        .from(schema.shiftAssignments)
        .where(and(eq(schema.shiftAssignments.id, input.assignmentId), eq(schema.shiftAssignments.storeId, ctx.user.storeId!)))
        .get();
      if (!row) notFound('排班不存在');
      if (row.status === 'cancelled') return { assignment: row, idempotent: true };
      const updated = await ctx.db
        .update(schema.shiftAssignments)
        .set({ status: 'cancelled', note: input.note, updatedAt: new Date() })
        .where(eq(schema.shiftAssignments.id, row.id))
        .returning()
        .then((r) => r[0]!);
      return { assignment: updated, idempotent: false };
    }),

  /* ---- 5. 周发布（幂等：只发未发布行；逐受影响员工 schedule.published） ---- */

  publishWeek: merchantManagerProcedure
    .input(z.object({ weekStart: dateSchema }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const weekEnd = addDays(input.weekStart, 6);
      const rows = await ctx.db
        .select({ id: schema.shiftAssignments.id, staffId: schema.shiftAssignments.staffId })
        .from(schema.shiftAssignments)
        .where(
          and(
            eq(schema.shiftAssignments.storeId, storeId),
            eq(schema.shiftAssignments.status, 'active'),
            isNull(schema.shiftAssignments.publishedAt),
            gte(schema.shiftAssignments.date, input.weekStart),
            lte(schema.shiftAssignments.date, weekEnd),
          ),
        );
      if (rows.length === 0) {
        return { weekStart: input.weekStart, published: 0, perStaff: [] as Array<{ staffId: string; count: number }> };
      }
      const now = new Date();
      const countByStaff = new Map<string, number>();
      for (const r of rows) countByStaff.set(r.staffId, (countByStaff.get(r.staffId) ?? 0) + 1);
      const outboxIds: string[] = [];
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(schema.shiftAssignments)
          .set({ publishedAt: now, updatedAt: now })
          .where(inArray(schema.shiftAssignments.id, rows.map((r) => r.id)));
        for (const [staffId, count] of countByStaff) {
          outboxIds.push(
            await emitEvent(txDb(tx), `staff:${staffId}`, EventType.SchedulePublished, {
              weekStart: input.weekStart,
              count,
            }),
          );
        }
      });
      outboxIds.forEach(broadcastNow);
      return {
        weekStart: input.weekStart,
        published: rows.length,
        perStaff: [...countByStaff.entries()].map(([staffId, count]) => ({ staffId, count })),
      };
    }),

  /* ---- 6. 换班申请（staff；未认领前责任归原人） ---- */

  swapRequest: staffProcedure
    .input(
      z.object({
        assignmentId: z.string().min(1),
        toStaffId: z.string().min(1).optional(),
        reason: z.string().trim().min(1, '换班原因必填'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const staffId = ctx.user.staffId!;
      const assignment = await ctx.db
        .select()
        .from(schema.shiftAssignments)
        .where(eq(schema.shiftAssignments.id, input.assignmentId))
        .get();
      if (!assignment || assignment.storeId !== storeId) notFound('排班不存在');
      if (assignment.staffId !== staffId) forbidden('只能对本人的班发起换班');
      if (assignment.status !== 'active') badRequest('该班已取消，不可换班');
      if (assignment.date < todayStr()) badRequest('已过班次不可换班');
      const pending = await ctx.db
        .select()
        .from(schema.shiftSwaps)
        .where(and(eq(schema.shiftSwaps.assignmentId, assignment.id), eq(schema.shiftSwaps.status, 'pending')))
        .get();
      if (pending) return { swap: pending, idempotent: true }; // 同单一 pending 换班=幂等返回现状
      if (input.toStaffId) {
        const target = await staffInStore(ctx.db, storeId, input.toStaffId);
        if (target.id === staffId) badRequest('接手员工不能是本人');
        if (target.status !== 'active') badRequest(`接手员工「${target.name}」已停职`);
      }
      const inserted = await ctx.db
        .insert(schema.shiftSwaps)
        .values({
          storeId,
          assignmentId: assignment.id,
          fromStaffId: staffId,
          toStaffId: input.toStaffId ?? null,
          reason: input.reason,
        })
        .returning()
        .then((r) => r[0]!);
      return { swap: inserted, idempotent: false };
    }),

  /* ---- 7. 换班审批（manager；批准才换挂 assignment.staffId） ---- */

  /** swapQueue（manager 本店）：pending 换班申请队列（审批区数据源；附双方员工名+班次信息） */
  swapQueue: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const fromStaff = alias(schema.staff, 'swap_from_staff');
    const toStaff = alias(schema.staff, 'swap_to_staff');
    const rows = await ctx.db
      .select({
        id: schema.shiftSwaps.id,
        assignmentId: schema.shiftSwaps.assignmentId,
        reason: schema.shiftSwaps.reason,
        createdAt: schema.shiftSwaps.createdAt,
        fromStaffName: fromStaff.name,
        toStaffName: toStaff.name,
        date: schema.shiftAssignments.date,
        startMin: schema.shiftAssignments.startMin,
        endMin: schema.shiftAssignments.endMin,
      })
      .from(schema.shiftSwaps)
      .leftJoin(fromStaff, eq(fromStaff.id, schema.shiftSwaps.fromStaffId))
      .leftJoin(toStaff, eq(toStaff.id, schema.shiftSwaps.toStaffId))
      .leftJoin(schema.shiftAssignments, eq(schema.shiftAssignments.id, schema.shiftSwaps.assignmentId))
      .where(and(eq(schema.shiftSwaps.storeId, storeId), eq(schema.shiftSwaps.status, 'pending')))
      .orderBy(schema.shiftSwaps.createdAt);
    return { swaps: rows };
  }),

  swapResolve: merchantManagerProcedure
    .input(
      z.object({
        swapId: z.string().min(1),
        approve: z.boolean(),
        /** 开放认领单（申请时 toStaffId 为空）批准时由店长指定接手员工 */
        toStaffId: z.string().min(1).optional(),
        note: z.string().trim().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const swap = await ctx.db
        .select()
        .from(schema.shiftSwaps)
        .where(and(eq(schema.shiftSwaps.id, input.swapId), eq(schema.shiftSwaps.storeId, storeId)))
        .get();
      if (!swap) notFound('换班单不存在');
      if (swap.status !== 'pending') badRequest('该换班单已处理');
      if (!input.approve && !input.note) badRequest('驳回必须填写备注');

      const now = new Date();
      const outboxIds: string[] = [];
      if (!input.approve) {
        const updated = await ctx.db
          .update(schema.shiftSwaps)
          .set({ status: 'rejected', decidedBy: ctx.user.id, decidedAt: now, decideNote: input.note!, updatedAt: now })
          .where(eq(schema.shiftSwaps.id, swap.id))
          .returning()
          .then((r) => r[0]!);
        outboxIds.push(
          await emitEvent(ctx.db, `staff:${swap.fromStaffId}`, EventType.ShiftSwapResolved, {
            swapId: swap.id,
            assignmentId: swap.assignmentId,
            approved: false,
            fromStaffId: swap.fromStaffId,
            toStaffId: swap.toStaffId,
            note: input.note!,
          }),
        );
        outboxIds.forEach(broadcastNow);
        return { swap: updated };
      }

      // 批准：换挂 assignment.staffId（开放认领单须指定接手员工）
      const targetId = input.toStaffId ?? swap.toStaffId;
      if (!targetId) badRequest('请指定接手员工');
      const target = await staffInStore(ctx.db, storeId, targetId);
      if (target.status !== 'active') badRequest(`接手员工「${target.name}」已停职`);
      const assignment = await ctx.db
        .select()
        .from(schema.shiftAssignments)
        .where(eq(schema.shiftAssignments.id, swap.assignmentId))
        .get();
      if (!assignment || assignment.status !== 'active') badRequest('原排班已不存在或已取消');
      const conflict = await ctx.db
        .select({ id: schema.shiftAssignments.id })
        .from(schema.shiftAssignments)
        .where(
          and(
            eq(schema.shiftAssignments.staffId, targetId),
            eq(schema.shiftAssignments.date, assignment.date),
            eq(schema.shiftAssignments.startMin, assignment.startMin),
            eq(schema.shiftAssignments.status, 'active'),
          ),
        )
        .get();
      if (conflict) badRequest('接手员工当日同时段已有排班');

      const updatedSwap = await ctx.db.transaction(async (tx) => {
        await tx
          .update(schema.shiftAssignments)
          .set({ staffId: targetId, updatedAt: now })
          .where(eq(schema.shiftAssignments.id, assignment.id));
        const row = await tx
          .update(schema.shiftSwaps)
          .set({
            status: 'approved',
            toStaffId: targetId,
            decidedBy: ctx.user.id,
            decidedAt: now,
            decideNote: input.note ?? null,
            updatedAt: now,
          })
          .where(eq(schema.shiftSwaps.id, swap.id))
          .returning()
          .then((r) => r[0]!);
        const payload = {
          swapId: swap.id,
          assignmentId: assignment.id,
          approved: true,
          fromStaffId: swap.fromStaffId,
          toStaffId: targetId,
          note: input.note ?? null,
        };
        outboxIds.push(await emitEvent(txDb(tx), `staff:${swap.fromStaffId}`, EventType.ShiftSwapResolved, payload));
        outboxIds.push(await emitEvent(txDb(tx), `staff:${targetId}`, EventType.ShiftSwapResolved, payload));
        return row;
      });
      outboxIds.forEach(broadcastNow);
      return { swap: updatedSwap };
    }),

  /* ---- 8. 可用时间（staff 本人读写，按 (staff,weekday,startMin) upsert 幂等） ---- */

  myAvailability: staffProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.staffAvailability)
      .where(eq(schema.staffAvailability.staffId, ctx.user.staffId!))
      .orderBy(schema.staffAvailability.weekday, schema.staffAvailability.startMin);
    return { availability: rows };
  }),

  upsertAvailability: staffProcedure
    .input(
      z.object({
        weekday: weekdaySchema,
        startMin: minutesSchema,
        endMin: minutesSchema,
        note: z.string().trim().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.endMin <= input.startMin) badRequest('结束时间须晚于开始时间');
      const staffId = ctx.user.staffId!;
      const storeId = ctx.user.storeId!;
      const existing = await ctx.db
        .select()
        .from(schema.staffAvailability)
        .where(
          and(
            eq(schema.staffAvailability.staffId, staffId),
            eq(schema.staffAvailability.weekday, input.weekday),
            eq(schema.staffAvailability.startMin, input.startMin),
          ),
        )
        .get();
      if (existing) {
        const updated = await ctx.db
          .update(schema.staffAvailability)
          .set({ endMin: input.endMin, note: input.note ?? existing.note, updatedAt: new Date() })
          .where(eq(schema.staffAvailability.id, existing.id))
          .returning()
          .then((r) => r[0]!);
        return { availability: updated, idempotent: true };
      }
      const inserted = await ctx.db
        .insert(schema.staffAvailability)
        .values({
          storeId,
          staffId,
          weekday: input.weekday,
          startMin: input.startMin,
          endMin: input.endMin,
          note: input.note ?? null,
        })
        .returning()
        .then((r) => r[0]!);
      return { availability: inserted, idempotent: false };
    }),

  /* ---- 9. 请假/调休双流 ---- */

  leaveRequest: staffProcedure
    .input(
      z.object({
        kind: z.enum(['leave', 'comp_off']),
        startDate: dateSchema,
        endDate: dateSchema,
        reason: z.string().trim().min(1, '请假原因必填'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.endDate < input.startDate) badRequest('结束日期不得早于开始日期');
      const staffId = ctx.user.staffId!;
      const pending = await ctx.db
        .select()
        .from(schema.leaveRequests)
        .where(
          and(
            eq(schema.leaveRequests.staffId, staffId),
            eq(schema.leaveRequests.kind, input.kind),
            eq(schema.leaveRequests.startDate, input.startDate),
            eq(schema.leaveRequests.endDate, input.endDate),
            eq(schema.leaveRequests.status, 'pending'),
          ),
        )
        .get();
      if (pending) return { leave: pending, idempotent: true }; // 同人同期 pending 不重复
      const inserted = await ctx.db
        .insert(schema.leaveRequests)
        .values({
          storeId: ctx.user.storeId!,
          staffId,
          kind: input.kind,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason,
        })
        .returning()
        .then((r) => r[0]!);
      return { leave: inserted, idempotent: false };
    }),

  leaveResolve: merchantManagerProcedure
    .input(
      z.object({
        leaveId: z.string().min(1),
        approve: z.boolean(),
        note: z.string().trim().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const leave = await ctx.db
        .select()
        .from(schema.leaveRequests)
        .where(and(eq(schema.leaveRequests.id, input.leaveId), eq(schema.leaveRequests.storeId, ctx.user.storeId!)))
        .get();
      if (!leave) notFound('请假单不存在');
      if (leave.status !== 'pending') badRequest('该请假单已审批');
      if (!input.approve && !input.note) badRequest('驳回必须填写备注');
      const now = new Date();
      const updated = await ctx.db
        .update(schema.leaveRequests)
        .set({
          status: input.approve ? 'approved' : 'rejected',
          decidedBy: ctx.user.id,
          decidedAt: now,
          decideNote: input.note ?? null,
          updatedAt: now,
        })
        .where(eq(schema.leaveRequests.id, leave.id))
        .returning()
        .then((r) => r[0]!);
      return { leave: updated };
    }),

  myLeaves: staffProcedure.query(async ({ ctx }) => {
    const leaves = await ctx.db
      .select()
      .from(schema.leaveRequests)
      .where(eq(schema.leaveRequests.staffId, ctx.user.staffId!))
      .orderBy(desc(schema.leaveRequests.createdAt));
    return { leaves };
  }),

  /** leaveQueue（manager 读本店 pending，含员工名） */
  leaveQueue: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ leave: schema.leaveRequests, staffName: schema.staff.name })
      .from(schema.leaveRequests)
      .innerJoin(schema.staff, eq(schema.staff.id, schema.leaveRequests.staffId))
      .where(and(eq(schema.leaveRequests.storeId, ctx.user.storeId!), eq(schema.leaveRequests.status, 'pending')))
      .orderBy(schema.leaveRequests.createdAt);
    return { queue: rows.map((r) => ({ ...r.leave, staffName: r.staffName })) };
  }),

  /* ---- 10. 调休台账 ---- */

  /** compOffBalance（staff 读）：余额=sum(delta_minutes)（小时=显示值）+ 流水近 20 条 */
  compOffBalance: staffProcedure.query(async ({ ctx }) => {
    const staffId = ctx.user.staffId!;
    const all = await ctx.db
      .select({ deltaMinutes: schema.compOffLedger.deltaMinutes })
      .from(schema.compOffLedger)
      .where(eq(schema.compOffLedger.staffId, staffId));
    const balanceMinutes = all.reduce((sum, r) => sum + r.deltaMinutes, 0);
    const logs = await ctx.db
      .select()
      .from(schema.compOffLedger)
      .where(eq(schema.compOffLedger.staffId, staffId))
      .orderBy(desc(schema.compOffLedger.createdAt))
      .limit(20);
    return { balanceMinutes, balanceHours: balanceMinutes / 60, logs };
  }),

  /** compOffAdjust（manager）：台账留痕（只增不改） */
  compOffAdjust: merchantManagerProcedure
    .input(
      z.object({
        staffId: z.string().min(1),
        deltaMinutes: z.number().int().refine((n) => n !== 0, '变动分钟不可为 0'),
        reason: z.string().trim().min(1, '调整原因必填'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      await staffInStore(ctx.db, storeId, input.staffId);
      const inserted = await ctx.db
        .insert(schema.compOffLedger)
        .values({
          storeId,
          staffId: input.staffId,
          deltaMinutes: input.deltaMinutes,
          reason: input.reason,
          createdBy: ctx.user.id,
        })
        .returning()
        .then((r) => r[0]!);
      return { entry: inserted };
    }),

  /* ---- 11. 技能标签（标签集=service_rules.staff_skill_tags 端口） ---- */

  /** skillTags（公开读）：当前生效标签集 */
  skillTags: publicProcedure.query(async ({ ctx }) => {
    return { tags: await loadSkillTags(ctx.db) };
  }),

  /** setSkills（manager）：全量覆盖写 staff_skills；标签集外硬拒「不在标签集」 */
  setSkills: merchantManagerProcedure
    .input(z.object({ staffId: z.string().min(1), tags: z.array(z.string().trim().min(1)) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      await staffInStore(ctx.db, storeId, input.staffId);
      const allowed = new Set(await loadSkillTags(ctx.db, storeId)); // 大批片 2 分层：按本店作用域解析
      const tags = [...new Set(input.tags)];
      for (const tag of tags) {
        if (!allowed.has(tag)) badRequest(`标签「${tag}」不在标签集（可在配置端口 staff_skill_tags 维护）`);
      }
      await ctx.db.transaction(async (tx) => {
        await tx.delete(schema.staffSkills).where(eq(schema.staffSkills.staffId, input.staffId));
        if (tags.length > 0) {
          await tx.insert(schema.staffSkills).values(tags.map((tag) => ({ storeId, staffId: input.staffId, tag })));
        }
      });
      return { staffId: input.staffId, tags };
    }),

  /** staffSkills（manager 读本店全员工标签） */
  staffSkills: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const staffRows = await ctx.db
      .select({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role })
      .from(schema.staff)
      .where(eq(schema.staff.storeId, storeId));
    const skillRows = await ctx.db
      .select({ staffId: schema.staffSkills.staffId, tag: schema.staffSkills.tag })
      .from(schema.staffSkills)
      .where(eq(schema.staffSkills.storeId, storeId));
    const tagsByStaff = new Map<string, string[]>();
    for (const r of skillRows) {
      const list = tagsByStaff.get(r.staffId) ?? [];
      list.push(r.tag);
      tagsByStaff.set(r.staffId, list);
    }
    return {
      staff: staffRows.map((s) => ({ ...s, tags: tagsByStaff.get(s.id) ?? [] })),
    };
  }),

  /* ---- 12. 周视图（staff+manager 读；published 状态透出） ---- */

  weekView: publicProcedure
    .input(z.object({ weekStart: dateSchema }))
    .query(async ({ ctx, input }) => {
      const isManager =
        ctx.user.roles.includes('merchant_owner') || ctx.user.roles.includes('merchant_manager');
      if ((!ctx.user.staffId && !isManager) || !ctx.user.storeId) {
        forbidden('需要本店员工或店长/店主身份');
      }
      const storeId = ctx.user.storeId!;
      const weekEnd = addDays(input.weekStart, 6);
      const staffRows = await ctx.db
        .select({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role })
        .from(schema.staff)
        .where(and(eq(schema.staff.storeId, storeId), eq(schema.staff.status, 'active')));
      const assignments = await ctx.db
        .select({
          assignment: schema.shiftAssignments,
          staffName: schema.staff.name,
          staffRole: schema.staff.role,
        })
        .from(schema.shiftAssignments)
        .innerJoin(schema.staff, eq(schema.staff.id, schema.shiftAssignments.staffId))
        .where(
          and(
            eq(schema.shiftAssignments.storeId, storeId),
            gte(schema.shiftAssignments.date, input.weekStart),
            lte(schema.shiftAssignments.date, weekEnd),
          ),
        )
        .orderBy(schema.shiftAssignments.date, schema.shiftAssignments.startMin);
      return {
        weekStart: input.weekStart,
        staff: staffRows,
        assignments: assignments.map((r) => ({
          ...r.assignment,
          staffName: r.staffName,
          staffRole: r.staffRole,
          published: r.assignment.publishedAt !== null,
        })),
      };
    }),

  /* ---- 13. CSV 导入（preview 零写入 / execute 幂等跳过 + 请假硬校验同 assign） ---- */

  importPreview: merchantManagerProcedure
    .input(z.object({ csvText: z.string().min(1, 'CSV 内容为空') }))
    .mutation(async ({ ctx, input }) => {
      // 零写入对账：仅解析+校验，不落任何行
      const { plans, okRows, failRows } = await buildImportPlan(ctx.db, ctx.user.storeId!, input.csvText);
      return { okRows, failRows, rows: plans };
    }),

  importExecute: merchantManagerProcedure
    .input(z.object({ csvText: z.string().min(1, 'CSV 内容为空') }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      // execute 前重跑同一管线（含请假硬校验，与 assign 同闸）
      const { plans, okRows, failRows } = await buildImportPlan(ctx.db, storeId, input.csvText);
      const okPlans = plans.filter((p) => p.ok);
      const existing = okPlans.length
        ? await ctx.db
            .select({
              staffId: schema.shiftAssignments.staffId,
              date: schema.shiftAssignments.date,
              startMin: schema.shiftAssignments.startMin,
            })
            .from(schema.shiftAssignments)
            .where(
              and(
                eq(schema.shiftAssignments.storeId, storeId),
                eq(schema.shiftAssignments.status, 'active'),
                inArray(schema.shiftAssignments.staffId, [...new Set(okPlans.map((p) => p.staffId!))]),
              ),
            )
        : [];
      const existingKeys = new Set(existing.map((r) => `${r.staffId}|${r.date}|${r.startMin}`));
      let inserted = 0;
      let skippedDuplicates = 0;
      await ctx.db.transaction(async (tx) => {
        for (const p of okPlans) {
          const key = `${p.staffId}|${p.date}|${p.startMin}`;
          if (existingKeys.has(key)) {
            skippedDuplicates += 1; // 幂等：已有 active 同键行跳过（唯一索引兜底）
            continue;
          }
          await tx.insert(schema.shiftAssignments).values({
            storeId,
            staffId: p.staffId!,
            date: p.date!,
            startMin: p.startMin!,
            endMin: p.endMin!,
            source: 'manual',
            note: 'CSV 导入',
            createdBy: ctx.user.id,
          });
          existingKeys.add(key);
          inserted += 1;
        }
      });
      return { inserted, skippedDuplicates, okRows, failRows, rows: plans };
    }),
});

export type ScheduleRouter = typeof scheduleRouter;
