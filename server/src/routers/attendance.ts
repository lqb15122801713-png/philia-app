/**
 * 考勤 router（批次 员工端2.0 · R7，任务书 V1.1 §二 + docs/staff2/R7-R10-DESIGN.md §一.1/§四）
 * 冻结规则：围栏 300m（圆心=门店经纬度）/ 容差 10min / 围栏外拦截不写异常（外勤除外，见下）/
 * 异常审批+员工补卡双流（补卡限当月、每人≤3 次/月） / 月表导出仅老板 / 防代打标记（只标记不阻断）。
 *
 * 员工端骨架整建批片 2（冻结版 V1.0 §二.B1 七件，本片全落）：
 * - 读序切换：班次比对改 当日 shift_assignments(active) 优先 → 无则 staff.schedule 周模板兜底（零中断）；
 * - B1-1 WiFi 打卡：mark 入参 bssid；本店 attendance_wifi_bssids 有 active 行=启用校验——
 *   命中白名单=到岗直接过（免围栏）；未命中回落围栏判定；白名单为空=现状不变；
 * - B1-2 外勤打卡：围栏外 + photoUrl 非空 → 放行落行（source='field'）+ 自动挂 exception 审批；
 *   围栏外无照片照旧拒（零写入）；
 * - B1-3 断网补传：入参 clientTs（秒）+source='offline_relay' → ts=clientTs（实际打点时刻），
 *   拒绝未来时刻；now−clientTs 超 service_rules.attendance_offline_stale_hours 端口值 →
 *   放行落行+自动挂 exception 审批（不无声丢卡）；
 * - B1-5 多对打卡：kind 由当日末行推导（无记录/末行 out → 下一击 in；末行 in → 下一击 out），
 *   同 kind 60 秒内重击=幂等返回末行（防双击）；状态逐对判定（in 对班始/out 对班末）；
 * - B1-6 员工确认 confirmDay（幂等置位 confirmed_by/at）+ 店长 managerAdjust（改 ts + type='adjust'
 *   approved 留痕行，确认后改考勤同样 manager-only+留痕；员工无改权）；
 * - B1-7 申诉 appeal（type='exception' pending 挂原卡，同卡同人 pending 在途幂等）；
 * - B1-4 异常实时推送：late/early/field 落行 → AttendanceException → store + staff 双频道。
 *
 * 报备偏差（schema 实证适配，PR 中显式列）：
 * 1. attendance_records.lat/lng/distance_m/device_id 均为 NOT NULL —— 补卡行无真实坐标，
 *    落 lat=0/lng=0/distance_m=0，device_id 落 `makeup:{approvalId}`（唯一值，避免污染防代打维度）；
 * 2. attendance_records 无 note 列 —— 「无排班按正常计」的说明不落库，仅随响应与事件载荷透出；
 * 3. stores.lat/lng 可空：门店未配置坐标时无法围栏校验，放行打卡并落 distance_m=-1（未校验标记），
 *    不伪造拦截也不伪造正常距离；
 * 4. 月表导出留痕事件：EventType 常量表（realtime/events.ts）不在本任务文件范围，
 *    审计事件 EventType.AttendanceMonthExported（payload {by, month, rows}）；
 * 5. 片 2：attendance_approvals.type 增 'adjust' 取值（店长改打卡时刻留痕行；schema 注释枚举
 *    仅 exception|makeup，列无 CHECK 约束故零迁移；applicantUserId 落操作人=店长本人）；
 * 6. 片 2：bssid 列仅 WiFi 命中时落库（未命中=回落围栏判定，不落尝试值，与列注释「命中 BSSID」一致）；
 * 7. 片 2：WiFi 命中免围栏时 distance_m 仍如实落实测距离（不伪造 0，留审计真值）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
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

/** 多段取最近：in 对班始 / out 对班末，取与打卡时刻距离最近的一段（周模板/按日排班共用语义） */
function pickNearestShift(
  shifts: Array<{ start: number; end: number }>,
  d: Date,
  kind: 'in' | 'out',
): { start: number; end: number } {
  const nowMin = minutesOf(d);
  let best = shifts[0]!;
  let bestDiff = Infinity;
  for (const s of shifts) {
    const diff = Math.abs(nowMin - (kind === 'in' ? s.start : s.end));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

/**
 * 从 staff.schedule 周模板取当日班次（读序兜底档）；一天多班时取与打卡时刻最近的班次。
 * 当日无排班返回 null。
 */
function pickShift(
  schedule: StaffSchedule | null | undefined,
  d: Date,
  kind: 'in' | 'out',
): { start: number; end: number } | null {
  const shifts = schedule?.[DAY_KEYS[d.getDay()]];
  if (!shifts || shifts.length === 0) return null;
  return pickNearestShift(
    shifts.map((s) => ({ start: hmToMinutes(s.start), end: hmToMinutes(s.end) })),
    d,
    kind,
  );
}

/**
 * 班次读序（片 2 硬骨头 · 读序切换）：
 * 当日 shift_assignments（status='active'）优先 → 无则 staff.schedule 周模板兜底（零中断）。
 * 当日多段 assignment 取离打卡时刻最近者（同周模板 pickShift 语义）。
 */
async function resolveShiftForPunch(
  db: DbHandle,
  storeId: string,
  staffId: string,
  date: string,
  d: Date,
  kind: 'in' | 'out',
): Promise<{ start: number; end: number; from: 'assignment' | 'template' } | null> {
  const assigns = await db
    .select({ startMin: schema.shiftAssignments.startMin, endMin: schema.shiftAssignments.endMin })
    .from(schema.shiftAssignments)
    .where(
      and(
        eq(schema.shiftAssignments.storeId, storeId),
        eq(schema.shiftAssignments.staffId, staffId),
        eq(schema.shiftAssignments.date, date),
        eq(schema.shiftAssignments.status, 'active'),
      ),
    );
  if (assigns.length > 0) {
    const s = pickNearestShift(
      assigns.map((a) => ({ start: a.startMin, end: a.endMin })),
      d,
      kind,
    );
    return { ...s, from: 'assignment' };
  }
  const staffRow = await db
    .select({ schedule: schema.staff.schedule })
    .from(schema.staff)
    .where(eq(schema.staff.id, staffId))
    .get();
  const t = pickShift(staffRow?.schedule, d, kind);
  return t ? { ...t, from: 'template' } : null;
}

/** 断网暂存兜底时限（小时）读口：service_rules.attendance_offline_stale_hours 生效最新版；缺行/坏值回落 24（种子值） */
async function offlineStaleHours(db: DbHandle): Promise<number> {
  const row = await db
    .select({ valueJson: schema.serviceRules.valueJson })
    .from(schema.serviceRules)
    .where(
      and(
        eq(schema.serviceRules.ruleKey, 'attendance_offline_stale_hours'),
        eq(schema.serviceRules.active, true),
      ),
    )
    .orderBy(desc(schema.serviceRules.version))
    .limit(1)
    .then((r) => r[0]);
  const h = row?.valueJson?.hours;
  return typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : 24;
}

/**
 * 打卡×班次自动比对（容差 10min）：
 * in 晚于班次开始+10 → late；out 早于班次结束-10 → early；否则 normal。
 * shift=null（当日无排班） → normal（shiftFound=false，说明随响应/事件透出，不落库——无 note 列）。
 */
function computeStatus(
  kind: 'in' | 'out',
  now: Date,
  shift: { start: number; end: number } | null,
): { status: 'normal' | 'late' | 'early'; shiftFound: boolean } {
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
   * mark（staff）：打卡（片 2 B1-5 起改多对：中途离岗/返岗还原，不再 ≤2 击封顶）。
   * - kind 由服务端按当日末行推导（无记录/末行 out → 本击 in；末行 in → 本击 out），
   *   入参 kind 仅用于「同 kind 60 秒内重击=幂等返回末行」防双击判定（客户端可按其预期传）；
   * - 围栏 300m：围栏外 BAD_REQUEST「不在门店范围，无法打卡」，零写入（不写异常记录）；
   *   B1-2 外勤：围栏外 + photoUrl 非空 → 放行落行（source='field'）+ 自动挂 exception 审批；
   * - B1-1 WiFi 打卡：本店白名单（attendance_wifi_bssids active 行）非空=启用校验——
   *   命中=到岗直接过（免围栏）；未命中回落围栏判定；白名单为空=现状不变；
   * - B1-3 断网补传：source='offline_relay' 须带 clientTs（秒）→ ts=clientTs（实际打点时刻），
   *   拒绝未来时刻；超 attendance_offline_stale_hours 端口值 → 落行+自动挂 exception 审批；
   * - late/early 自动生成 type='exception' pending 审批（挂原卡 record_id）；
   * - 防代打：同 device_id 同日 >2 个不同 user_id → 该批记录 flagged=1（只标记不阻断）；
   * - kind='out' 且当日完整正常 → awardXp(source='attendance')（分值/日上限由 xp_rules 决定）；
   * - emitEvent AttendanceMarked → staff + store 双频道（载荷含 status），事务提交后 broadcastNow；
   * - B1-4：late/early/field 落行 → AttendanceException → store + staff 双频道。
   */
  mark: staffProcedure
    .input(
      z.object({
        kind: z.enum(['in', 'out']),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        deviceId: z.string().min(1, '缺少设备标识'),
        /** B1-1：当前连接的门店 WiFi BSSID（Web 端=手动选择映射，见 AttendancePage 注记） */
        bssid: z.string().min(1).optional(),
        /** B1-2：外勤打卡现场照片 URL（围栏外放行双要件之一） */
        photoUrl: z.string().min(1).optional(),
        /** B1-3：设备端打点时刻（Unix 秒；仅 source='offline_relay' 时有效） */
        clientTs: z.number().int().positive().optional(),
        /** B1-3：断网暂存补传标记 */
        source: z.enum(['offline_relay']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const staffId = ctx.user.staffId!;
      const userId = ctx.user.id;
      const wallNow = new Date(); // 服务器真实时刻（留痕/XP 日用）

      /* B1-3 断网补传：ts=clientTs（考勤口径=实际打点时刻）；拒绝未来时刻；超时兜底时限读端口 */
      let punchAt = wallNow;
      let staleRelay = false;
      let staleHours = 0;
      if (input.source === 'offline_relay') {
        if (!input.clientTs) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '离线补传须携带设备端打点时刻（clientTs）' });
        }
        punchAt = new Date(input.clientTs * 1000);
        if (punchAt.getTime() > wallNow.getTime()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '打点时刻晚于当前时刻，拒绝补传未来卡' });
        }
        staleHours = await offlineStaleHours(ctx.db);
        staleRelay = wallNow.getTime() - punchAt.getTime() > staleHours * 3600 * 1000;
      } else if (input.clientTs !== undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'clientTs 仅断网补传（source=offline_relay）可携带' });
      }
      const date = localDateStr(punchAt);

      const store = await ctx.db
        .select({ id: schema.stores.id, lat: schema.stores.lat, lng: schema.stores.lng })
        .from(schema.stores)
        .where(eq(schema.stores.id, storeId))
        .get();
      if (!store) throw new TRPCError({ code: 'NOT_FOUND', message: '门店不存在' });

      /* B1-1 WiFi 白名单：本店 active 行非空=启用校验 */
      const wifiRows = await ctx.db
        .select({ bssid: schema.attendanceWifiBssids.bssid })
        .from(schema.attendanceWifiBssids)
        .where(
          and(
            eq(schema.attendanceWifiBssids.storeId, storeId),
            eq(schema.attendanceWifiBssids.active, true),
          ),
        );
      const wifiHit =
        wifiRows.length > 0 && !!input.bssid && wifiRows.some((w) => w.bssid === input.bssid);

      /* 围栏：圆心=门店经纬度，半径 300m。WiFi 命中免围栏；未命中回落围栏；围栏外+照片=外勤放行 */
      let distanceM: number;
      let field = false;
      if (wifiHit) {
        distanceM =
          store.lat === null || store.lng === null
            ? -1
            : Math.round(haversineM(store.lat, store.lng, input.lat, input.lng)); // 免围栏但如实记距（报备偏差 7）
      } else if (store.lat === null || store.lng === null) {
        distanceM = -1; // 门店未配置坐标：跳过围栏校验，-1 = 未校验标记（报备偏差 3）
      } else {
        distanceM = Math.round(haversineM(store.lat, store.lng, input.lat, input.lng));
        if (distanceM > GEOFENCE_RADIUS_M) {
          if (input.photoUrl) {
            field = true; // B1-2 外勤：围栏外+照片 → 放行落行+自动挂 exception（下方统一处理）
          } else {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '不在门店范围，无法打卡' });
          }
        }
      }
      const source = input.source === 'offline_relay' ? 'offline_relay' : field ? 'field' : null;

      /* B1-5 多对打卡：kind 由当日末行推导；同 kind 60 秒内重击=幂等返回末行 */
      const dayRowsPre = await ctx.db
        .select()
        .from(schema.attendanceRecords)
        .where(
          and(
            eq(schema.attendanceRecords.staffId, staffId),
            eq(schema.attendanceRecords.date, date),
          ),
        )
        .orderBy(schema.attendanceRecords.ts);
      const lastPre = dayRowsPre[dayRowsPre.length - 1];
      if (
        lastPre &&
        lastPre.kind === input.kind &&
        Math.abs(punchAt.getTime() - lastPre.ts.getTime()) < 60_000
      ) {
        return { record: lastPre, dayStatus: summarizeDay(date, dayRowsPre), duplicated: true };
      }
      const kind: 'in' | 'out' = !lastPre ? 'in' : lastPre.kind === 'in' ? 'out' : 'in';

      /* 班次比对（读序切换：当日 shift_assignments 优先 → staff.schedule 周模板兜底，容差 10min 既有口径） */
      const shift = await resolveShiftForPunch(ctx.db, storeId, staffId, date, punchAt, kind);
      const { status, shiftFound } = computeStatus(kind, punchAt, shift);

      const result = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        /* 事务内幂等复核（并发双击竞态兜底，同 60 秒同 kind 口径） */
        const txRows = await t
          .select()
          .from(schema.attendanceRecords)
          .where(
            and(
              eq(schema.attendanceRecords.staffId, staffId),
              eq(schema.attendanceRecords.date, date),
            ),
          )
          .orderBy(schema.attendanceRecords.ts);
        const lastTx = txRows[txRows.length - 1];
        if (lastTx && lastTx.kind === kind && Math.abs(punchAt.getTime() - lastTx.ts.getTime()) < 60_000) {
          return { record: lastTx, outboxIds: [] as string[], duplicated: true };
        }

        const record = await t
          .insert(schema.attendanceRecords)
          .values({
            storeId,
            staffId,
            userId,
            date,
            kind,
            ts: punchAt, // B1-3：补传落实际打点时刻；现场=服务器当前时刻
            lat: input.lat,
            lng: input.lng,
            distanceM,
            status,
            makeup: false,
            deviceId: input.deviceId,
            flagged: false,
            source,
            clientTs: input.source === 'offline_relay' ? punchAt : null,
            bssid: wifiHit ? input.bssid! : null, // 仅命中落库（报备偏差 6）
            photoUrl: field ? input.photoUrl! : null,
          })
          .returning()
          .then((r) => r[0]!);

        /* 异常自动生成 pending 审批，挂原卡 record_id：late/early（既有）+ 外勤（B1-2）+ 断网补传超时（B1-3 兜底） */
        const exceptionReasons: string[] = [];
        if (status !== 'normal') {
          exceptionReasons.push(`系统自动生成：${status === 'late' ? '迟到' : '早退'}打卡，待店长确认`);
        }
        if (field) exceptionReasons.push('外勤打卡待店长确认');
        if (staleRelay) exceptionReasons.push(`断网补传超时（超 ${staleHours} 小时）待店长确认`);
        for (const reason of exceptionReasons) {
          await t.insert(schema.attendanceApprovals).values({
            storeId,
            staffId,
            applicantUserId: userId,
            type: 'exception',
            recordId: record.id,
            date,
            kind,
            requestedTs: null,
            reason,
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
            .set({ flagged: true, updatedAt: wallNow })
            .where(
              and(
                eq(schema.attendanceRecords.deviceId, input.deviceId),
                eq(schema.attendanceRecords.date, date),
              ),
            );
          record.flagged = true;
        }

        /* kind='out' 且当日完整正常 → 考勤 XP（分值 xp_attendance_daily 读 xp_rules，日上限由 awardXp 处理） */
        if (kind === 'out') {
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
              now: wallNow,
            });
          }
        }

        const payload: Record<string, unknown> = {
          recordId: record.id,
          storeId,
          staffId,
          date,
          kind,
          status, // B1-4：既有载荷透出 status（staff 频道本人收）
          distanceM,
          flagged: record.flagged,
        };
        if (source) payload.source = source;
        if (!shiftFound) payload.note = '今日无排班，按正常计';
        const outboxIds = [
          await emitEvent(t, `staff:${staffId}`, EventType.AttendanceMarked, payload),
          await emitEvent(t, `store:${storeId}`, EventType.AttendanceMarked, payload),
        ];
        /* B1-4 异常实时推送：late/early/field → AttendanceException → store（主管）+ staff（本人） */
        if (status !== 'normal' || field) {
          const exPayload: Record<string, unknown> = { recordId: record.id, storeId, staffId, date, kind, status };
          if (source) exPayload.source = source;
          outboxIds.push(
            await emitEvent(t, `store:${storeId}`, EventType.AttendanceException, exPayload),
            await emitEvent(t, `staff:${staffId}`, EventType.AttendanceException, exPayload),
          );
        }
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
   * wifiBssids（staff，B1-1）：本店 WiFi 白名单 active 行（bssid+label）。
   * 员工端打卡页「门店 WiFi」下拉数据源；空数组=未启用 WiFi 校验（页面不显示胶囊）。
   */
  wifiBssids: staffProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({ bssid: schema.attendanceWifiBssids.bssid, label: schema.attendanceWifiBssids.label })
      .from(schema.attendanceWifiBssids)
      .where(
        and(
          eq(schema.attendanceWifiBssids.storeId, ctx.user.storeId!),
          eq(schema.attendanceWifiBssids.active, true),
        ),
      )
      .orderBy(schema.attendanceWifiBssids.label);
  }),

  /**
   * confirmDay（staff，B1-6 闸门件 §五.2 已签）：本人当日全部打卡行置 confirmed_by/at。
   * 幂等：当日行全部已确认 → 零写入返回现状（alreadyConfirmed=true）；当日无记录 → 400。
   */
  confirmDay: staffProcedure
    .input(z.object({ date: z.string().regex(DATE_RE, '日期格式须为 YYYY-MM-DD') }))
    .mutation(async ({ ctx, input }) => {
      const staffId = ctx.user.staffId!;
      const rows = await ctx.db
        .select()
        .from(schema.attendanceRecords)
        .where(
          and(
            eq(schema.attendanceRecords.staffId, staffId),
            eq(schema.attendanceRecords.date, input.date),
          ),
        )
        .orderBy(schema.attendanceRecords.ts);
      if (rows.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '当日无考勤记录，无需确认' });
      }
      const unconfirmed = rows.filter((r) => !r.confirmedAt);
      if (unconfirmed.length > 0) {
        const now = new Date();
        await ctx.db
          .update(schema.attendanceRecords)
          .set({ confirmedBy: ctx.user.id, confirmedAt: now, updatedAt: now })
          .where(
            and(
              eq(schema.attendanceRecords.staffId, staffId),
              eq(schema.attendanceRecords.date, input.date),
              isNull(schema.attendanceRecords.confirmedAt),
            ),
          );
      }
      const records = await ctx.db
        .select()
        .from(schema.attendanceRecords)
        .where(
          and(
            eq(schema.attendanceRecords.staffId, staffId),
            eq(schema.attendanceRecords.date, input.date),
          ),
        )
        .orderBy(schema.attendanceRecords.ts);
      return { date: input.date, records, confirmedNow: unconfirmed.length, alreadyConfirmed: unconfirmed.length === 0 };
    }),

  /**
   * appeal（staff，B1-7 考勤申诉入口）：本人打卡记录建 type='exception' pending 审批（挂原卡 recordId）。
   * 幂等：同卡同人已有 pending 在途 → 零写入返回现状（duplicated=true）。
   */
  appeal: staffProcedure
    .input(
      z.object({
        recordId: z.string().min(1),
        reason: z.string().min(1, '请填写申诉原因'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const staffId = ctx.user.staffId!;
      const record = await ctx.db
        .select()
        .from(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.id, input.recordId))
        .get();
      if (!record || record.staffId !== staffId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '打卡记录不存在' });
      }
      const existing = await ctx.db
        .select()
        .from(schema.attendanceApprovals)
        .where(
          and(
            eq(schema.attendanceApprovals.recordId, record.id),
            eq(schema.attendanceApprovals.applicantUserId, ctx.user.id),
            eq(schema.attendanceApprovals.type, 'exception'),
            eq(schema.attendanceApprovals.status, 'pending'),
          ),
        )
        .get();
      if (existing) return { approval: existing, duplicated: true };
      const approval = await ctx.db
        .insert(schema.attendanceApprovals)
        .values({
          storeId: record.storeId,
          staffId,
          applicantUserId: ctx.user.id,
          type: 'exception',
          recordId: record.id,
          date: record.date,
          kind: record.kind,
          requestedTs: null,
          reason: input.reason,
          status: 'pending',
        })
        .returning()
        .then((r) => r[0]!);
      return { approval, duplicated: false };
    }),

  /**
   * managerAdjust（merchantManager 本店，B1-6）：店长改打卡时刻（员工无改权——本端点 manager-only）。
   * 确认后改考勤同样放行+留痕：无论行是否已确认，均写 attendance_approvals type='adjust'
   * approved 留痕行（reason=note 必填，reviewer=操作人，requestedTs=新时刻）。
   */
  managerAdjust: merchantManagerProcedure
    .input(
      z.object({
        recordId: z.string().min(1),
        ts: z.date(),
        note: z.string().min(1, '请填写调整原因（留痕用）'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const record = await ctx.db
        .select()
        .from(schema.attendanceRecords)
        .where(eq(schema.attendanceRecords.id, input.recordId))
        .get();
      if (!record || record.storeId !== storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '打卡记录不存在' });
      }
      const now = new Date();
      const updated = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        const row = await t
          .update(schema.attendanceRecords)
          .set({ ts: input.ts, updatedAt: now })
          .where(eq(schema.attendanceRecords.id, record.id))
          .returning()
          .then((r) => r[0]!);
        /* 留痕行：type='adjust'（新取值，报备偏差 5）+ status='approved'（店长操作即时生效，无需二审） */
        await t.insert(schema.attendanceApprovals).values({
          storeId,
          staffId: record.staffId,
          applicantUserId: ctx.user.id,
          type: 'adjust',
          recordId: record.id,
          date: record.date,
          kind: record.kind,
          requestedTs: input.ts,
          reason: input.note,
          status: 'approved',
          reviewerId: ctx.user.id,
          reviewedAt: now,
        });
        return row;
      });
      return updated;
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
