/**
 * XP 统一发放与月度结算服务（批次 员工端2.0 · R10，任务书 V1.1 §五 + 附件一冻结版）
 *
 * 红线写死：
 * - 数值全落 xp_rules 配置表（active=1 当前版本），代码零常量（保存即生效，不回溯历史事件）；
 * - 每日上限（xp_daily_cap）仅约束 channel='daily'；考试学习通道 channel='learning' 单列不占；
 * - 超限丢弃+留痕：事件落库 dropped=1（不计分），页面据此明示"今日经验已满"；
 * - 拉新 referral 置灰：server 拒写+明示（随会员游戏化批 G3 链路开通），防假功能第三态；
 * - 防刷：考试每级每月限 1 次；同一客户对同一员工当日好评只计 1 次（查 reviews 表）；
 * - 差评扣分（penalty，负分）不受日上限约束、不扣款。
 *
 * 所有函数可在事务内调用（传 tx，类型按 cashier.ts 惯例 cast 为 DbHandle）。
 */

import { TRPCError } from '@trpc/server';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';

export type DbHandle = typeof db;

export type XpSource =
  | 'attendance'
  | 'service'
  | 'review'
  | 'exam'
  | 'referral'
  | 'cover'
  | 'penalty';

export interface XpRuleSet {
  /** 当前生效版本号（active 行中最大 version） */
  version: number;
  byKey: Map<string, Record<string, unknown>>;
}

/** 读取当前生效 XP 规则（每次实时读表：配置端口保存即生效） */
export async function loadXpRules(d: DbHandle): Promise<XpRuleSet> {
  const rows = await d
    .select({
      ruleKey: schema.xpRules.ruleKey,
      valueJson: schema.xpRules.valueJson,
      version: schema.xpRules.version,
    })
    .from(schema.xpRules)
    .where(eq(schema.xpRules.active, true));
  const byKey = new Map<string, Record<string, unknown>>();
  let version = 0;
  for (const r of rows) {
    byKey.set(r.ruleKey, (r.valueJson ?? {}) as Record<string, unknown>);
    if (r.version > version) version = r.version;
  }
  return { version, byKey };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** source → 分值 rule_key 映射（review/penalty 分值随星级由调用方传入 points） */
const SOURCE_RULE_KEY: Partial<Record<XpSource, string>> = {
  attendance: 'xp_attendance_daily',
  service: 'xp_service_order',
  cover: 'xp_cover_shift',
};
const EXAM_RULE_KEY: Record<string, string> = {
  P0: 'xp_exam_p0',
  P1: 'xp_exam_p1',
  P2: 'xp_exam_p2',
};

/** 当月起止（本地时区，Unix 秒 Date） */
export function monthRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

/** 当日起止 */
export function dayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

export interface AwardInput {
  storeId: string;
  staffId: string;
  userId: string;
  source: XpSource;
  /** 来源单号留痕（appointmentId / attendanceRecordId / reviewId / 考试级别 P0|P1|P2 …） */
  sourceId?: string | null;
  /** 分值：review/penalty 随星级必传；其余缺省查 xp_rules */
  points?: number;
  /** 通道：exam 强制 learning；其余默认 daily */
  channel?: 'daily' | 'learning';
  /** review 来源必传：防刷"同客户对员工当日好评只计 1 次" */
  customerId?: string;
  now?: Date;
}

export interface AwardResult {
  awarded: number;
  dropped: boolean;
  skipped: boolean;
  eventId: string | null;
  ruleVersion: number;
  note?: string;
}

/**
 * 发放一条 XP（事务内可调用）。
 * - 丢弃/去重均落库或明示返回，不静默；
 * - 发放成功 emit staff 频道 xp.awarded（含 dropped 标记）。
 */
export async function awardXp(d: DbHandle, input: AwardInput): Promise<AwardResult> {
  const now = input.now ?? new Date();
  if (input.source === 'referral') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '拉新拓客随会员游戏化批开通' });
  }
  const rules = await loadXpRules(d);

  let points = input.points;
  if (points === undefined) {
    if (input.source === 'exam') {
      const key = EXAM_RULE_KEY[input.sourceId ?? ''] ?? 'xp_exam_p0';
      points = num(rules.byKey.get(key)?.points, 0);
    } else {
      const key = SOURCE_RULE_KEY[input.source];
      points = key ? num(rules.byKey.get(key)?.points, 0) : 0;
    }
  }
  const channel = input.channel ?? (input.source === 'exam' ? 'learning' : 'daily');

  /* 防刷①：考试每级每月限 1 次（limit 取自 xp_rules，可配置） */
  if (input.source === 'exam') {
    const limit = num(rules.byKey.get('xp_exam_monthly_limit')?.limit, 1);
    const { start, end } = monthRange(now);
    const dup = await d
      .select({ n: sql<number>`count(*)` })
      .from(schema.xpEvents)
      .where(
        and(
          eq(schema.xpEvents.staffId, input.staffId),
          eq(schema.xpEvents.source, 'exam'),
          eq(schema.xpEvents.sourceId, input.sourceId ?? '-'),
          gte(schema.xpEvents.createdAt, start),
          lt(schema.xpEvents.createdAt, end),
        ),
      );
    if ((dup[0]?.n ?? 0) >= limit) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '该级别本月已计过学习经验（每级每月限 1 次）' });
    }
  }

  /* 防刷②：同客户对员工当日好评只计 1 次（reviews 表实证；第二个起不报错、不计分、明示） */
  if (input.source === 'review' && input.customerId) {
    const limit = num(rules.byKey.get('xp_review_daily_limit_per_customer')?.limit, 1);
    const { start, end } = dayRange(now);
    const cnt = await d
      .select({ n: sql<number>`count(*)` })
      .from(schema.reviews)
      .where(
        and(
          eq(schema.reviews.customerId, input.customerId),
          eq(schema.reviews.staffId, input.staffId),
          gte(schema.reviews.createdAt, start),
          lt(schema.reviews.createdAt, end),
        ),
      );
    if ((cnt[0]?.n ?? 0) > limit) {
      return { awarded: 0, dropped: false, skipped: true, eventId: null, ruleVersion: rules.version, note: '同客户当日好评已计过一次' };
    }
  }

  /* 日上限：仅 daily 通道正分；超限丢弃留痕（dropped=1 不计分） */
  let dropped = false;
  if (channel === 'daily' && points > 0) {
    const cap = num(rules.byKey.get('xp_daily_cap')?.cap, 60);
    const { start, end } = dayRange(now);
    const got = await d
      .select({ s: sql<number>`coalesce(sum(points),0)` })
      .from(schema.xpEvents)
      .where(
        and(
          eq(schema.xpEvents.staffId, input.staffId),
          eq(schema.xpEvents.channel, 'daily'),
          eq(schema.xpEvents.dropped, false),
          gte(schema.xpEvents.createdAt, start),
          lt(schema.xpEvents.createdAt, end),
        ),
      );
    if ((got[0]?.s ?? 0) + points > cap) dropped = true;
  }

  const inserted = await d
    .insert(schema.xpEvents)
    .values({
      storeId: input.storeId,
      staffId: input.staffId,
      userId: input.userId,
      source: input.source,
      sourceId: input.sourceId ?? '-',
      points,
      channel,
      ruleVersion: rules.version,
      dropped,
    })
    .returning({ id: schema.xpEvents.id });
  const eventId = inserted[0]?.id ?? null;

  await emitEvent(d, `staff:${input.staffId}`, EventType.XpAwarded, {
    staffId: input.staffId,
    source: input.source,
    sourceId: input.sourceId ?? null,
    points,
    dropped,
  });

  return { awarded: dropped ? 0 : points, dropped, skipped: false, eventId, ruleVersion: rules.version };
}

/** 当日已计分（daily 通道、未丢弃）与上限：页面"今日经验已满"明示用 */
export async function todayXp(d: DbHandle, staffId: string, now = new Date()): Promise<{ earned: number; cap: number }> {
  const rules = await loadXpRules(d);
  const cap = num(rules.byKey.get('xp_daily_cap')?.cap, 60);
  const { start, end } = dayRange(now);
  const got = await d
    .select({ s: sql<number>`coalesce(sum(points),0)` })
    .from(schema.xpEvents)
    .where(
      and(
        eq(schema.xpEvents.staffId, staffId),
        eq(schema.xpEvents.channel, 'daily'),
        eq(schema.xpEvents.dropped, false),
        gte(schema.xpEvents.createdAt, start),
        lt(schema.xpEvents.createdAt, end),
      ),
    );
  return { earned: got[0]?.s ?? 0, cap };
}

export interface LevelInfo {
  level: number;
  name: string;
  threshold: number;
  retention: number;
}

/** 段位表（门槛+保级线，从 xp_rules 读；按 level 升序） */
export function levelTable(rules: XpRuleSet): LevelInfo[] {
  const out: LevelInfo[] = [];
  for (let lv = 0; lv <= 4; lv++) {
    const t = rules.byKey.get(`xp_level_threshold_${lv}`);
    const r = rules.byKey.get(`xp_retention_${lv}`);
    out.push({
      level: lv,
      name: typeof t?.name === 'string' ? t.name : String(lv),
      threshold: num(t?.threshold, 0),
      retention: num(r?.monthly_xp, 0),
    });
  }
  return out;
}

/** 累计 XP → 段位序号（0=嫩芽…4=导师） */
export function levelForXp(totalXp: number, rules: XpRuleSet): number {
  const table = levelTable(rules);
  let lv = 0;
  for (const row of table) if (totalXp >= row.threshold) lv = row.level;
  return lv;
}

/**
 * 月度保级结算（每月 1 日；任务书附件一 §四）：
 * 上月 XP 增量≥保级线→保级；不足→降一级（不降多级）；累计 XP 不清零。
 * 幂等：unique(staff_id, month) 冲突即跳过。返回写入行数。
 * @param month 'YYYY-MM'（结算对象=该月；通常传上月）
 */
export async function settleXpMonth(d: DbHandle, storeId: string, month: string): Promise<number> {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const rules = await loadXpRules(d);
  const table = levelTable(rules);

  const staffRows = await d
    .select({ id: schema.staff.id, userId: schema.staff.userId })
    .from(schema.staff)
    .where(eq(schema.staff.storeId, storeId));

  let written = 0;
  for (const st of staffRows) {
    const gainedRows = await d
      .select({ s: sql<number>`coalesce(sum(points),0)` })
      .from(schema.xpEvents)
      .where(
        and(
          eq(schema.xpEvents.staffId, st.id),
          eq(schema.xpEvents.dropped, false),
          gte(schema.xpEvents.createdAt, start),
          lt(schema.xpEvents.createdAt, end),
        ),
      );
    const gained = gainedRows[0]?.s ?? 0;
    const startRows = await d
      .select({ s: sql<number>`coalesce(sum(points),0)` })
      .from(schema.xpEvents)
      .where(and(eq(schema.xpEvents.staffId, st.id), eq(schema.xpEvents.dropped, false), lt(schema.xpEvents.createdAt, start)));
    const startXp = startRows[0]?.s ?? 0;
    const endXp = startXp + gained;

    /* 当前段位：累计口径（保级降级只影响"段位状态"，累计不清零——level_after 以保级裁定为准） */
    const cumulativeLevel = levelForXp(endXp, rules);
    const prev = await d
      .select({ levelAfter: schema.xpLevels.levelAfter })
      .from(schema.xpLevels)
      .where(eq(schema.xpLevels.staffId, st.id))
      .orderBy(sql`${schema.xpLevels.month} desc`)
      .limit(1);
    const levelBefore = prev[0]?.levelAfter ?? cumulativeLevel;
    let levelAfter = cumulativeLevel;
    let retained = true;
    if (levelBefore > 0 && gained < (table[levelBefore]?.retention ?? 0)) {
      levelAfter = Math.max(cumulativeLevel, levelBefore - 1); // 降一级，不降多级
      retained = false;
    }

    const res = await d
      .insert(schema.xpLevels)
      .values({
        storeId,
        staffId: st.id,
        month,
        startXp,
        gainedXp: gained,
        endXp,
        levelBefore,
        levelAfter,
        retained,
      })
      .onConflictDoNothing()
      .returning({ id: schema.xpLevels.id });
    if (res.length > 0) written++;
  }
  return written;
}
