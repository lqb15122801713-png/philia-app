/**
 * 考勤 router（批次 员工端2.0 · R7，任务书 V1.1 §二 + docs/staff2/R7-R10-DESIGN.md §一.1/§四）
 * 冻结规则：≤2 击 / 围栏 300m（圆心=门店经纬度）/ 容差 10min / 围栏外拦截不写异常 /
 * 异常审批+员工补卡双流（补卡限当月、每人≤3 次/月） / 月表导出仅老板 / 防代打标记（只标记不阻断）。
 *
 * 报备偏差（schema 实证适配，PR 中显式列）：
 * 1. attendance_records.lat/lng/distance_m/device_id 均为 NOT NULL —— 补卡行无真实坐标，
 *    落 lat=0/lng=0/distance_m=0，device_id 落 `makeup:{approvalId}`（唯一值，避免污染防代打维度）；
 * 2. attendance_records 无 note 列 —— 「无排班按正常计」的说明不落库，仅随响应与事件载荷透出；
 * 3. stores.lat/lng 可空：门店未配置坐标时无法围栏校验，放行打卡并落 distance_m=-1（未校验标记），
 *    不伪造拦截也不伪造正常距离；
 * 4. 月表导出留痕事件：EventType 常量表（realtime/events.ts）不在本任务文件范围，
 *    审计事件 EventType.AttendanceMonthExported（payload {by, month, rows}）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import type { StaffSchedule } from '../db/schema';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { awardXp, type DbHandle } from '../services/xpAward';
import {
  merchantManagerProcedure,
  merchantOwnerProcedure,
  router,
  staffProcedure,
} from '../trpc';

/** emitEvent/awardXp 首参类型（全局 db；事务 handle 运行时接口一致，类型上显式断言，同 appointment.ts 惯例） */
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

/** 围栏半径（米）：圆心=门店经纬度，任务书 V1.1 §二.2 冻结（运营供） */
const GEOFENCE_RADIUS_M = 300;
/** 班次比对容差（分钟），任务书 V1.1 §二.3 冻结（运营供） */
const TOLERANCE_MIN = 10;
/** 补卡每人每月上限（任务书 V1.1 §二.5 冻结；任务书称次数参数可配置，本批代码常量+报备，配置端口不含考勤参数） */
const MAKEUP_MONTHLY_LIMIT = 3;

type AttendanceRecordRow = typeof schema.attendanceRecords.$inferSelect;

/* ------------------------------------------------------------------ */
/* 本地日期/班次工具（服务器本地时区口径，与月表 YYYY-MM-DD 文本一致）          */
/* ------------------------------------------------------------------ */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date → 本地 'YYYY-MM-DD' */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM' → 下一月 'YYYY-MM'（date 文本区间右端，不含） */
function nextMonthStr(month: string): string {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  const d = new Date(y, m, 1); // m 为 1 基 → Date 月份索引 m 即下一月
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** 'HH:MM' → 当日分钟数 */
function hmToMinutes(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * 从 staff.schedule 周模板取当日班次；一天多班时取与打卡时刻最近的班次。
 * 当日无排班返回 null。
 */
function pickShift(
  schedule: StaffSchedule | null | undefined,
  d: Date,
  kind: 'in' | 'out',
): { start: number; end: number } | null {
  const shifts = schedule?.[DAY_KEYS[d.getDay()]];
  if (!shifts || shifts.length === 0) return null;
  const nowMin = minutesOf(d);
  let best = shifts[0]!;
  let bestDiff = Infinity;
  for (const s of shifts) {
    const target = kind === 'in' ? hmToMinutes(s.start) : hmToMinutes(s.end);
    const diff = Math.abs(nowMin - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return { start: hmToMinutes(best.start), end: hmToMinutes(best.end) };
}

/**
 * 打卡×班次自动比对（容差 10min）：
 * in 晚于班次开始+10 → late；out 早于班次结束-10 → early；否则 normal。
 * 当日无排班 → normal（shiftFound=false，说明随响应/事件透出，不落库——无 note 列）。
 */
function computeStatus(
  kind: 'in' | 'out',
  now: Date,
  schedule: StaffSchedule | null | undefined,
): { status: 'normal' | 'late' | 'early'; shiftFound: boolean } {
  const shift = pickShift(schedule, now, kind);
  if (!shift) return { status: 'normal', shiftFound: false };
  const nowMin = minutesOf(now);
  if (kind === 'in') {
    return { status: nowMin > shift.start + TOLERANCE_MIN ? 'late' : 'normal', shiftFound: true };
  }
  return { status: nowMin < shift.end - TOLERANCE_MIN ? 'early' : 'normal', shiftFound: true };
}

/** haversine 球面距离（米） */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 当日是否完整正常（in+out 均在，且各自 normal 或补卡）——XP 发放口径 */
function dayCompleteNormal(records: AttendanceRecordRow[]): boolean {
  const ok = (r: AttendanceRecordRow | undefined) =>
    !!r && (r.status === 'normal' || r.makeup);
  return ok(records.find((r) => r.kind === 'in')) && ok(records.find((r) => r.kind === 'out'));
}

/** 当日汇总（mark 响应 dayStatus） */
function summarizeDay(date: string, records: AttendanceRecordRow[]) {
  return {
    date,
    in: records.find((r) => r.kind === 'in') ?? null,
    out: records.find((r) => r.kind === 'out') ?? null,
    complete: dayCompleteNormal(records),
  };
}

/** CSV 单元格转义（RFC4180） */
function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const STATUS_LABEL: Record<string, string> = { normal: '正常', late: '迟到', early: '早退' };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const attendanceRouter = router({
  /**
   * mark（staff）：打卡 ≤2 击。
   * - 围栏 300m：围栏外 BAD_REQUEST「不在门店范围，无法打卡」，零写入（不写异常记录）；
   * - 幂等：同 staff+date+kind 重复打卡返回已有记录（UX 重试安全）；
   * - late/early 自动生成 type='exception' pending 审批（挂原卡 record_id）；
   * - 防代打：同 device_id 同日 >2 个不同 user_id → 该批记录 flagged=1（只标记不阻断）；
   * - kind='out' 且当日完整正常 → awardXp(source='attendance')（分值/日上限由 xp_rules 决定）；
   * - emitEvent AttendanceMarked → staff + store 双频道，事务提交后 broadcastNow。
   */
  mark: staffProcedure
    .input(
      z.object({
        kind: z.enum(['in', 'out']),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        deviceId: z.string().min(1, '缺少设备标识'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const staffId = ctx.user.staffId!;
      const userId = ctx.user.id;

      /* 围栏：圆心=门店经纬度，半径 300m；围栏外拦截+零写入 */
      const store = await ctx.db
        .select({ id: schema.stores.id, lat: schema.stores.lat, lng: schema.stores.lng })
        .from(schema.stores)
        .where(eq(schema.stores.id, storeId))
        .get();
      if (!store) throw new TRPCError({ code: 'NOT_FOUND', message: '门店不存在' });
      let distanceM: number;
      if (store.lat === null || store.lng === null) {
        distanceM = -1; // 门店未配置坐标：跳过围栏校验，-1 = 未校验标记（报备偏差 3）
      } else {
        distanceM = Math.round(haversineM(store.lat, store.lng, input.lat, input.lng));
        if (distanceM > GEOFENCE_RADIUS_M) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不在门店范围，无法打卡' });
        }
      }

      const now = new Date();
      const date = localDateStr(now);

      /* 幂等：同 staff+date+kind 已有记录 → 直接返回（≤2 击重试安全） */
      const existing = await ctx.db
        .select()
        .from(schema.attendanceRecords)
        .where(
          and(
            eq(schema.attendanceRecords.staffId, staffId),
            eq(schema.attendanceRecords.date, date),
            eq(schema.attendanceRecords.kind, input.kind),
          ),
        )
        .get();
      if (existing) {
        const dayRows = await ctx.db
          .select()
          .from(schema.attendanceRecords)
          .where(
            and(
              eq(schema.attendanceRecords.staffId, staffId),
              eq(schema.attendanceRecords.date, date),
            ),
          );
        return { record: existing, dayStatus: summarizeDay(date, dayRows), duplicated: true };
      }

      /* 班次比对（staff.schedule 周模板只读，容差 10min） */
      const staffRow = await ctx.db
        .select({ schedule: schema.staff.schedule })
        .from(schema.staff)
        .where(eq(schema.staff.id, staffId))
        .get();
      const { status, shiftFound } = computeStatus(input.kind, now, staffRow?.schedule);

      const result = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        /* 事务内幂等复核（并发双击竞态兜底） */
        const dup = await t
          .select()
          .from(schema.attendanceRecords)
          .where(
            and(
              eq(schema.attendanceRecords.staffId, staffId),
              eq(schema.attendanceRecords.date, date),
              eq(schema.attendanceRecords.kind, input.kind),
            ),
          )
          .get();
        if (dup) return { record: dup, outboxIds: [] as string[], duplicated: true };

        const record = await t
          .insert(schema.attendanceRecords)
          .values({
            storeId,
            staffId,
            userId,
            date,
            kind: input.kind,
            ts: now,
            lat: input.lat,
            lng: input.lng,
            distanceM,
            status,
            makeup: false,
            deviceId: input.deviceId,
            flagged: false,
          })
          .returning()
          .then((r) => r[0]!);

        /* 异常（迟到/早退）自动生成 pending 审批，挂原卡 record_id */
        if (status !== 'normal') {
          await t.insert(schema.attendanceApprovals).values({
            storeId,
            staffId,
            applicantUserId: userId,
            type: 'exception',
            recordId: record.id,
            date,
            kind: input.kind,
            requestedTs: null,
            reason: `系统自动生成：${status === 'late' ? '迟到' : '早退'}打卡，待店长确认`,
            status: 'pending',
          });
        }

        /* 防代打：同 device_id 同日不同 user_id >2 → 该批记录 flagged=1（只标记不阻断） */
        const deviceRows = await t
          .select({ id: schema.attendanceRecords.id, userId: schema.attendanceRecords.userId })
          .from(schema.attendanceRecords)
          .where(
            and(
              eq(schema.attendanceRecords.deviceId, input.deviceId),
              eq(schema.attendanceRecords.date, date),
            ),
          );
        if (new Set(deviceRows.map((r) => r.userId)).size > 2) {
          await t
            .update(schema.attendanceRecords)
            .set({ flagged: true, updatedAt: now })
            .where(
              and(
                eq(schema.attendanceRecords.deviceId, input.deviceId),
                eq(schema.attendanceRecords.date, date),
              ),
            );
          record.flagged = true;
        }

        /* kind='out' 且当日完整正常 → 考勤 XP（分值 xp_attendance_daily 读 xp_rules，日上限由 awardXp 处理） */
        if (input.kind === 'out') {
          const dayRows = await t
            .select()
            .from(schema.attendanceRecords)
            .where(
              and(
                eq(schema.attendanceRecords.staffId, staffId),
                eq(schema.attendanceRecords.date, date),
              ),
            );
          if (dayCompleteNormal(dayRows)) {
            await awardXp(t, {
              storeId,
              staffId,
              userId,
              source: 'attendance',
              sourceId: record.id,
              now,
            });
          }
        }

        const payload: Record<string, unknown> = {
          recordId: record.id,
          storeId,
          staffId,
          date,
          kind: input.kind,
          status,
          distanceM,
          flagged: record.flagged,
        };
        if (!shiftFound) payload.note = '今日无排班，按正常计';
        const outboxIds = [
          await emitEvent(t, `staff:${staffId}`, EventType.AttendanceMarked, payload),
          await emitEvent(t, `store:${storeId}`, EventType.AttendanceMarked, payload),
        ];
        return { record, outboxIds, duplicated: false };
      });
      result.outboxIds.forEach(broadcastNow);

      const dayRows = await ctx.db
        .select()
        .from(schema.attendanceRecords)
        .where(
          and(
            eq(schema.attendanceRecords.staffId, staffId),
            eq(schema.attendanceRecords.date, date),
          ),
        );
      return { record: result.record, dayStatus: summarizeDay(date, dayRows), duplicated: result.duplicated };
    }),

  /**
   * myRecords（staff）：本人月考勤。staffId 硬过滤=ctx.user.staffId，越权传参硬拒（strict）。
   * 附缺卡日计算：排班有班次但无 'in' 记录（含补卡行）的日期；当月算到今天为止，过往月份算全月。
   */
  myRecords: staffProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') }).strict())
    .query(async ({ ctx, input }) => {
      const staffId = ctx.user.staffId!;
      const start = `${input.month}-01`;
      const end = `${nextMonthStr(input.month)}-01`;
      const records = await ctx.db
        .select()
        .from(schema.attendanceRecords)
        .where(
          and(
            eq(schema.attendanceRecords.staffId, staffId),
            gte(schema.attendanceRecords.date, start),
            lt(schema.attendanceRecords.date, end),
          ),
        )
        .orderBy(schema.attendanceRecords.date, schema.attendanceRecords.ts);

      const staffRow = await ctx.db
        .select({ schedule: schema.staff.schedule })
        .from(schema.staff)
        .where(eq(schema.staff.id, staffId))
        .get();
      const schedule = staffRow?.schedule;

      const now = new Date();
      const curMonth = localDateStr(now).slice(0, 7);
      const lastDay =
        input.month === curMonth
          ? now
          : new Date(parseInt(input.month.slice(0, 4), 10), parseInt(input.month.slice(5, 7), 10), 0);
      const missingDays: string[] = [];
      for (
        let d = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1);
        d <= lastDay;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      ) {
        const shifts = schedule?.[DAY_KEYS[d.getDay()]];
        if (!shifts || shifts.length === 0) continue;
        const ds = localDateStr(d);
        if (!records.some((r) => r.date === ds && r.kind === 'in')) missingDays.push(ds);
      }
      return { records, missingDays };
    }),

  /**
   * requestMakeup（staff）：员工补卡申请。
   * 硬规则：限当月（else「补卡限当月」）；当月 approved+pending 补卡 < 3（MAKEUP_MONTHLY_LIMIT）；
   * 建 attendance_approvals type='makeup' pending（record_id NULL，requested_ts=申请填的实际上下班时间）。
   */
  requestMakeup: staffProcedure
    .input(
      z.object({
        date: z.string().regex(DATE_RE, '日期格式须为 YYYY-MM-DD'),
        kind: z.enum(['in', 'out']),
        requestedTs: z.date(),
        reason: z.string().min(1, '请填写补卡原因'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const staffId = ctx.user.staffId!;
      const month = input.date.slice(0, 7);
      if (month !== localDateStr(new Date()).slice(0, 7)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '补卡限当月' });
      }
      const used = await ctx.db
        .select({ id: schema.attendanceApprovals.id })
        .from(schema.attendanceApprovals)
        .where(
          and(
            eq(schema.attendanceApprovals.staffId, staffId),
            eq(schema.attendanceApprovals.type, 'makeup'),
            inArray(schema.attendanceApprovals.status, ['pending', 'approved']),
            gte(schema.attendanceApprovals.date, `${month}-01`),
            lt(schema.attendanceApprovals.date, `${nextMonthStr(month)}-01`),
          ),
        );
      if (used.length >= MAKEUP_MONTHLY_LIMIT) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `本月补卡次数已用完（每人每月限 ${MAKEUP_MONTHLY_LIMIT} 次）`,
        });
      }
      const row = await ctx.db
        .insert(schema.attendanceApprovals)
        .values({
          storeId: ctx.user.storeId!,
          staffId,
          applicantUserId: ctx.user.id,
          type: 'makeup',
          recordId: null,
          date: input.date,
          kind: input.kind,
          requestedTs: input.requestedTs,
          reason: input.reason,
          status: 'pending',
        })
        .returning()
        .then((r) => r[0]!);
      return row;
    }),

  /** myApprovals（staff）：本人补卡/异常申请与审批结果（仅本人硬过滤） */
  myApprovals: staffProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.attendanceApprovals)
      .where(eq(schema.attendanceApprovals.staffId, ctx.user.staffId!))
      .orderBy(desc(schema.attendanceApprovals.createdAt));
  }),

  /**
   * exceptionQueue（merchantManager 本店）：店长审批队列 =
   * 本店 pending 审批（exception+makeup 双流） + 本月防代打 flagged 记录。
   */
  exceptionQueue: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const approvals = await ctx.db
      .select()
      .from(schema.attendanceApprovals)
      .where(
        and(
          eq(schema.attendanceApprovals.storeId, storeId),
          eq(schema.attendanceApprovals.status, 'pending'),
        ),
      )
      .orderBy(desc(schema.attendanceApprovals.createdAt));

    const month = localDateStr(new Date()).slice(0, 7);
    const flaggedRecords = await ctx.db
      .select()
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.storeId, storeId),
          eq(schema.attendanceRecords.flagged, true),
          gte(schema.attendanceRecords.date, `${month}-01`),
          lt(schema.attendanceRecords.date, `${nextMonthStr(month)}-01`),
        ),
      )
      .orderBy(desc(schema.attendanceRecords.date));
    return { approvals, flaggedRecords };
  }),

  /**
   * resolveApproval（merchantManager 本店）：审批确认/驳回。
   * - 补卡通过：插入 makeup=1 行（status='normal'，坐标无真实值落 0，device_id 落 makeup:{approvalId}）
   *   并回链 approval.record_id；当日因此完整正常 → awardXp（补卡通过视同正常）；
   * - 驳回：维持异常（仅改审批状态）；
   * - 留痕 reviewer/reviewed_at/review_note；全部写在同一事务；
   * - emitEvent AttendanceApprovalResolved → staff:{staffId}，提交后 broadcastNow。
   */
  resolveApproval: merchantManagerProcedure
    .input(
      z.object({
        approvalId: z.string().min(1),
        approve: z.boolean(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const approval = await ctx.db
        .select()
        .from(schema.attendanceApprovals)
        .where(eq(schema.attendanceApprovals.id, input.approvalId))
        .get();
      if (!approval || approval.storeId !== storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '审批单不存在' });
      }
      if (approval.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '该审批已处理' });
      }

      const now = new Date();
      const { updated, outboxIds } = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        let recordId = approval.recordId;

        if (input.approve && approval.type === 'makeup') {
          if (!approval.requestedTs) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '补卡申请缺少打卡时间' });
          }
          /* 同日同向已有卡 → 不重复插行，直接回链已有记录（幂等兜底） */
          const existing = await t
            .select()
            .from(schema.attendanceRecords)
            .where(
              and(
                eq(schema.attendanceRecords.staffId, approval.staffId),
                eq(schema.attendanceRecords.date, approval.date),
                eq(schema.attendanceRecords.kind, approval.kind),
              ),
            )
            .get();
          if (existing) {
            recordId = existing.id;
          } else {
            const makeupRow = await t
              .insert(schema.attendanceRecords)
              .values({
                storeId: approval.storeId,
                staffId: approval.staffId,
                userId: approval.applicantUserId,
                date: approval.date,
                kind: approval.kind,
                ts: approval.requestedTs,
                lat: 0, // 报备偏差 1：lat/lng/distance_m NOT NULL，补卡无真实坐标落 0
                lng: 0,
                distanceM: 0,
                status: 'normal',
                makeup: true,
                deviceId: `makeup:${approval.id}`, // device_id NOT NULL；唯一值避免污染防代打维度
                flagged: false,
              })
              .returning()
              .then((r) => r[0]!);
            recordId = makeupRow.id;

            /* 补卡通过视同正常：当日因此完整正常 → 考勤 XP */
            const dayRows = await t
              .select()
              .from(schema.attendanceRecords)
              .where(
                and(
                  eq(schema.attendanceRecords.staffId, approval.staffId),
                  eq(schema.attendanceRecords.date, approval.date),
                ),
              );
            if (dayCompleteNormal(dayRows)) {
              await awardXp(t, {
                storeId: approval.storeId,
                staffId: approval.staffId,
                userId: approval.applicantUserId,
                source: 'attendance',
                sourceId: makeupRow.id,
                now,
              });
            }
          }
        }

        const updated = await t
          .update(schema.attendanceApprovals)
          .set({
            status: input.approve ? 'approved' : 'rejected',
            reviewerId: ctx.user.id,
            reviewedAt: now,
            reviewNote: input.note ?? null,
            recordId,
            updatedAt: now,
          })
          .where(eq(schema.attendanceApprovals.id, approval.id))
          .returning()
          .then((r) => r[0]!);

        const outboxIds = [
          await emitEvent(t, `staff:${approval.staffId}`, EventType.AttendanceApprovalResolved, {
            approvalId: approval.id,
            storeId: approval.storeId,
            staffId: approval.staffId,
            type: approval.type,
            date: approval.date,
            kind: approval.kind,
            approve: input.approve,
            recordId,
          }),
        ];
        return { updated, outboxIds };
      });
      outboxIds.forEach(broadcastNow);
      return updated;
    }),

  /**
   * monthExport（仅店主 · 任务书 §二.6「导出仅老板」留痕）：本店考勤月表 CSV。
   * - 全员工、按 员工×日期 聚合行；补卡单独成列（发薪核对可见）；
   * - UTF-8 BOM（Excel 直开不乱码，同 cashier.exportDayCloseCsv 口径）；
   * - 审计：emitEvent store 频道留痕 {by, month, rows}（事件常量表不在本任务范围，用字面量类型），
   *   除事件外零写入。
   */
  monthExport: merchantOwnerProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const rows = await ctx.db
        .select({
          record: schema.attendanceRecords,
          staffName: schema.staff.name,
        })
        .from(schema.attendanceRecords)
        .innerJoin(schema.staff, eq(schema.staff.id, schema.attendanceRecords.staffId))
        .where(
          and(
            eq(schema.attendanceRecords.storeId, storeId),
            gte(schema.attendanceRecords.date, `${input.month}-01`),
            lt(schema.attendanceRecords.date, `${nextMonthStr(input.month)}-01`),
          ),
        )
        .orderBy(schema.attendanceRecords.staffId, schema.attendanceRecords.date);

      /* 员工×日期聚合（补卡行进对应日期行，补卡列单示） */
      const dayMap = new Map<string, { name: string; date: string; in?: AttendanceRecordRow; out?: AttendanceRecordRow }>();
      for (const r of rows) {
        const key = `${r.record.staffId}|${r.record.date}`;
        let cell = dayMap.get(key);
        if (!cell) {
          cell = { name: r.staffName, date: r.record.date };
          dayMap.set(key, cell);
        }
        if (r.record.kind === 'in') cell.in = cell.in ?? r.record;
        else cell.out = cell.out ?? r.record;
      }
      const fmtTs = (r?: AttendanceRecordRow) =>
        r ? `${pad2(r.ts.getHours())}:${pad2(r.ts.getMinutes())}` : '';
      const header = '员工姓名,日期,上班打卡,上班状态,下班打卡,下班状态,补卡,上班距店(米),下班距店(米),防代打标记';
      const lines = [...dayMap.values()].map((c) =>
        [
          c.name,
          c.date,
          fmtTs(c.in),
          c.in ? (STATUS_LABEL[c.in.status] ?? c.in.status) : '',
          fmtTs(c.out),
          c.out ? (STATUS_LABEL[c.out.status] ?? c.out.status) : '',
          c.in?.makeup || c.out?.makeup ? '是' : '',
          c.in ? String(c.in.distanceM) : '',
          c.out ? String(c.out.distanceM) : '',
          c.in?.flagged || c.out?.flagged ? '是' : '',
        ]
          .map(csvCell)
          .join(','),
      );
      const csv = '﻿' + header + '\n' + lines.join('\n') + (lines.length ? '\n' : '');

      /* 导出留痕（任务书 §二.6）：事件载荷 {by, month, rows}，不落其他表 */
      const outboxId = await emitEvent(ctx.db, `store:${storeId}`, EventType.AttendanceMonthExported, {
        by: ctx.user.id,
        month: input.month,
        rows: lines.length,
      });
      broadcastNow(outboxId);

      return { filename: `attendance-${input.month}.csv`, csv, rows: lines.length };
    }),
});

export type AttendanceRouter = typeof attendanceRouter;
