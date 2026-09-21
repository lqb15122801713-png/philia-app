/**
 * XP router（批次 员工端2.0 · R10，任务书 V1.1 §五 + 附件一冻结版 V1.0）
 *
 * 端点总览（发放红线统一走 services/xpAward.ts，本层只做归属校验+查询裁剪）：
 * - mySummary（staff）：本人 XP 档案——累计/段位/下一段位差距/今日进度/月增量/保级线/考试解锁标记；
 * - myEvents（staff）：本人 XP 事件流（仅本人硬过滤，createdAt+id 复合游标分页，limit≤50）；
 * - leaderboard（staff）：本店榜——查询层裁剪（前三+自己+前一名），前端拿不到全榜；
 * - leaderboardAllStores（owner）：三店榜——老板名下各店同口径裁剪（老板不入榜，各店取前三）；
 * - rulesView（staff）：规则页数据源——当前生效 xp_rules 分组 + 冻结一句话 + 拉新行置灰标注；
 * - recordExamPass（staff）：考试通过 XP 学习通道入口。考试中心域未建（设计稿 §六.1 已报备），
 *   本端点即学习通道入口，考试中心批对接时复用本调用（source=exam、channel=learning、
 *   每级每月限 1 次由 awardXp 内部强制）；
 * - assignCover（manager|owner 本店）：临时补位店长指派 +15（xp_cover_shift），
 *   留痕 = xp_events 行（source_id 记指派人 userId）+ awardXp 内 emit XpAwarded（staff 频道）；
 * - myReviews（staff）：本人评价列表（最小评价域；匿名评价对员工不暴露客户身份——
 *   出参本就不含客户字段，anonymous 标记原样返回）；
 * - monthlySettleNow（owner）：月度保级结算手动触发（e2e 实证 + 补跑入口；
 *   生产路径为 index.ts 每月 1 日定时器，两者同走 settleXpMonth，unique(staff_id,month) 幂等）。
 */
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gte, lt, or, sql, type SQLWrapper } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import {
  merchantManagerProcedure,
  merchantOwnerProcedure,
  router,
  staffProcedure,
  type Db,
} from '../trpc';
import {
  awardXp,
  levelForXp,
  levelTable,
  loadXpRules,
  monthRange,
  settleXpMonth,
  todayXp,
} from '../services/xpAward';

/** 规则值取数（xp_rules.value_json 为自由 JSON；缺行时回退附件一冻结值，与 xpAward.num 同口径） */
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** 规则页一句话（附件一 §五冻结文案，任务书 §五.7 软性验收） */
const XP_RULES_ONE_LINER =
  '干活、学习、被夸都长经验；经验升段位；段位高的伙伴先排班、先考试、先被提名。';

/** 段位≥能手（2）解锁 P2 考试资格（附件一 §三段位挂钩；页面明示，不做死按钮） */
const EXAM_UNLOCK_LABEL = '能手解锁 P2 考试资格';

/** 分页复合游标：created_at 为秒级精度（同秒可能多行），id（ULID）决胜保证翻页确定不重不漏 */
const cursorSchema = z.object({ createdAt: z.date(), id: z.string() }).optional();

/** 榜单行（裁剪后出参：名次/姓名/段位名/累计 XP/是否本人） */
interface RankRow {
  staffId: string;
  name: string;
  totalXp: number;
  levelName: string;
}
interface ClippedRankRow extends RankRow {
  rank: number;
  isSelf: boolean;
}

/**
 * 本店全员 XP 排名（服务端内部全量计算，出参一律经 clipRanking 裁剪——
 * 任务书 §五.4：只显前三+自己+前一名，查询层裁剪，前端拿不到全榜）。
 * 口径：累计 XP = xp_events 未丢弃（dropped=0）分值合计（学习通道同计；月度保级见 xp_levels）。
 * 零事件员工以 totalXp=0 参排（否则本人无事件时排名缺失）。
 */
async function buildStoreRanking(d: Db, storeId: string): Promise<RankRow[]> {
  const staffRows = await d
    .select({ id: schema.staff.id, name: schema.staff.name })
    .from(schema.staff)
    .where(eq(schema.staff.storeId, storeId))
    .orderBy(asc(schema.staff.createdAt));
  const sums = await d
    .select({
      staffId: schema.xpEvents.staffId,
      total: sql<number>`coalesce(sum(${schema.xpEvents.points}), 0)`,
    })
    .from(schema.xpEvents)
    .where(and(eq(schema.xpEvents.storeId, storeId), eq(schema.xpEvents.dropped, false)))
    .groupBy(schema.xpEvents.staffId);
  const byStaff = new Map(sums.map((s) => [s.staffId, s.total]));
  const rules = await loadXpRules(d);
  const table = levelTable(rules);
  return staffRows
    .map((s) => {
      const totalXp = byStaff.get(s.id) ?? 0;
      const lv = levelForXp(totalXp, rules);
      return { staffId: s.id, name: s.name, totalXp, levelName: table[lv]?.name ?? String(lv) };
    })
    .sort((a, b) => b.totalXp - a.totalXp || (a.staffId < b.staffId ? -1 : 1));
}

/**
 * 榜单查询层裁剪（任务书 §五.4 红线）：前三 + 自己 + 前一名，其余一律不出参。
 * selfStaffId 不在榜（如老板看三店榜）时仅出前三。
 */
function clipRanking(ranked: RankRow[], selfStaffId?: string): ClippedRankRow[] {
  const picks = new Set<number>();
  for (let i = 0; i < Math.min(3, ranked.length); i++) picks.add(i);
  const selfIdx = selfStaffId ? ranked.findIndex((r) => r.staffId === selfStaffId) : -1;
  if (selfIdx >= 0) {
    picks.add(selfIdx);
    if (selfIdx > 0) picks.add(selfIdx - 1); // 前一名（榜尾不可达：仅相邻一名）
  }
  return [...picks]
    .sort((a, b) => a - b)
    .map((i) => ({ ...ranked[i]!, rank: i + 1, isSelf: i === selfIdx }));
}

/** 分页 where 片段：严格早于游标（createdAt 降序 + id 降序） */
function cursorCond(
  cursor: { createdAt: Date; id: string } | undefined,
  createdAtCol: SQLWrapper,
  idCol: SQLWrapper,
) {
  if (!cursor) return undefined;
  return or(
    lt(createdAtCol, cursor.createdAt),
    and(eq(createdAtCol, cursor.createdAt), lt(idCol, cursor.id)),
  );
}

export const xpRouter = router({
  /**
   * 本人 XP 档案（staff · XP 页头数据源）：
   * 累计 XP / 当前段位（名称+门槛）/ 下一段位（差距）/ 今日进度（日上限明示"今日经验已满"）/
   * 当月增量 / 当前段位保级线 / 考试解锁标记（段位≥能手 → P2 考试资格）。
   */
  mySummary: staffProcedure.query(async ({ ctx }) => {
    const staffId = ctx.user.staffId!;
    const rules = await loadXpRules(ctx.db);
    const table = levelTable(rules);

    const totalRows = await ctx.db
      .select({ s: sql<number>`coalesce(sum(${schema.xpEvents.points}), 0)` })
      .from(schema.xpEvents)
      .where(and(eq(schema.xpEvents.staffId, staffId), eq(schema.xpEvents.dropped, false)));
    const totalXp = totalRows[0]?.s ?? 0;

    const lv = levelForXp(totalXp, rules);
    const cur = table[lv]!;
    const next = lv + 1 < table.length ? table[lv + 1]! : null;

    const { start, end } = monthRange(new Date());
    const monthRows = await ctx.db
      .select({ s: sql<number>`coalesce(sum(${schema.xpEvents.points}), 0)` })
      .from(schema.xpEvents)
      .where(
        and(
          eq(schema.xpEvents.staffId, staffId),
          eq(schema.xpEvents.dropped, false),
          gte(schema.xpEvents.createdAt, start),
          lt(schema.xpEvents.createdAt, end),
        ),
      );

    const today = await todayXp(ctx.db, staffId);

    return {
      totalXp,
      level: { index: lv, name: cur.name, threshold: cur.threshold },
      nextLevel: next
        ? {
            index: next.level,
            name: next.name,
            threshold: next.threshold,
            gap: Math.max(0, next.threshold - totalXp),
          }
        : null,
      today, // { earned, cap }——earned >= cap 即"今日经验已满"
      monthGained: monthRows[0]?.s ?? 0,
      /** 当前段位保级线（月增量固定值；嫩芽 retention=0 即无保级要求） */
      retention: { name: cur.name, monthlyXp: cur.retention },
      /** 段位≥能手（2）→ P2 考试资格（任务书 §五.5 段位挂钩，页面明示） */
      examUnlock: { unlocked: lv >= 2, label: EXAM_UNLOCK_LABEL },
    };
  }),

  /**
   * 本人 XP 事件流（staff · 仅本人硬过滤，无入参可越权）。
   * 复合游标 {createdAt, id} 降序翻页；limit ≤ 50。含 dropped 行（超限丢弃留痕，页面可明示）。
   */
  myEvents: staffProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          cursor: cursorSchema,
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const rows = await ctx.db
        .select({
          id: schema.xpEvents.id,
          source: schema.xpEvents.source,
          sourceId: schema.xpEvents.sourceId,
          points: schema.xpEvents.points,
          channel: schema.xpEvents.channel,
          ruleVersion: schema.xpEvents.ruleVersion,
          dropped: schema.xpEvents.dropped,
          createdAt: schema.xpEvents.createdAt,
        })
        .from(schema.xpEvents)
        .where(
          and(
            eq(schema.xpEvents.staffId, ctx.user.staffId!),
            cursorCond(input?.cursor, schema.xpEvents.createdAt, schema.xpEvents.id),
          ),
        )
        .orderBy(desc(schema.xpEvents.createdAt), desc(schema.xpEvents.id))
        .limit(limit);
      const last = rows[rows.length - 1];
      return {
        items: rows,
        nextCursor: rows.length === limit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    }),

  /**
   * 本店榜（staff）：前三 + 自己 + 前一名（查询层裁剪红线，见 clipRanking）。
   * 全榜永不出参——e2e「XP 榜尾不可达」验收对端。
   */
  leaderboard: staffProcedure.query(async ({ ctx }) => {
    const ranked = await buildStoreRanking(ctx.db, ctx.user.storeId!);
    return {
      storeId: ctx.user.storeId!,
      generatedAt: new Date(),
      rows: clipRanking(ranked, ctx.user.staffId!),
    };
  }),

  /**
   * 三店榜（owner · 老板名下各店）：与 leaderboard 同口径裁剪（clipRanking）。
   * 老板本人不是 staff、不入榜 → 各店实际出前三（若老板恰好兼某店 staff 则同员工口径
   * 补出自己+前一名）。门店范围 = stores.owner_id = 当前老板；极端情况下 owner 账号
   * 未挂 owner_id 门店时回退其绑定门店（merchantOwnerProcedure 保证 storeId 存在）。
   */
  leaderboardAllStores: merchantOwnerProcedure.query(async ({ ctx }) => {
    let storeList = await ctx.db
      .select({ id: schema.stores.id, name: schema.stores.name })
      .from(schema.stores)
      .where(eq(schema.stores.ownerId, ctx.user.id))
      .orderBy(asc(schema.stores.createdAt));
    if (storeList.length === 0) {
      const bound = await ctx.db
        .select({ id: schema.stores.id, name: schema.stores.name })
        .from(schema.stores)
        .where(eq(schema.stores.id, ctx.user.storeId!))
        .get();
      storeList = bound ? [bound] : [];
    }
    const boards = [];
    for (const s of storeList) {
      const ranked = await buildStoreRanking(ctx.db, s.id);
      boards.push({ storeId: s.id, storeName: s.name, rows: clipRanking(ranked, ctx.user.staffId) });
    }
    return { generatedAt: new Date(), boards };
  }),

  /**
   * 规则页数据源（staff）：当前生效 xp_rules（active=1）按来源/上限防刷/段位门槛保级分组
   * + 冻结一句话 + 拉新行置灰（active=0 也返回，标注"随会员游戏化批开通"——
   * 任务书 §五.6：置灰标依赖，不是悬空；server 侧 awardXp 对 referral 拒写）。
   */
  rulesView: staffProcedure.query(async ({ ctx }) => {
    const rules = await loadXpRules(ctx.db);
    // 拉新行 active=0 不在 loadXpRules 内，单独取回用于置灰展示（多版本历史行取任一）
    const referralRow = await ctx.db
      .select({ label: schema.xpRules.label })
      .from(schema.xpRules)
      .where(eq(schema.xpRules.ruleKey, 'xp_referral'))
      .get();
    const g = (key: string) => rules.byKey.get(key);
    const source = (key: string, label: string, extra?: Record<string, unknown>) => ({
      key,
      label,
      points: num(g(key)?.points, 0),
      ...extra,
    });
    return {
      version: rules.version,
      oneLiner: XP_RULES_ONE_LINER,
      /** 六来源分值（附件一 §一；学习通道单列标注 channel='learning'） */
      sources: [
        source('xp_attendance_daily', '出勤：正常打卡全勤'),
        source('xp_service_order', '服务量：完成一单服务'),
        source('xp_service_boarding_night', '服务量：寄养按晚计'),
        source('xp_review_5_star', '客户好评：5 星'),
        source('xp_review_4_star', '客户好评：4 星'),
        source('xp_exam_p0', '考试学习：P0 通过', { channel: 'learning' }),
        source('xp_exam_p1', '考试学习：P1 通过', { channel: 'learning' }),
        source('xp_exam_p2', '考试学习：P2 通过', { channel: 'learning' }),
        source('xp_cover_shift', '临时补位：店长指派'),
        source('xp_penalty_low_star', '差评扣分：≤2 星（扣分不扣款）'),
        {
          key: 'xp_referral',
          label: referralRow?.label ?? '拉新拓客',
          points: 0,
          disabled: true as const,
          disabledNote: '随会员游戏化批开通',
        },
      ],
      /** 日上限与防刷（附件一 §二） */
      dailyCap: num(g('xp_daily_cap')?.cap, 60),
      antiFraud: {
        examMonthlyLimit: num(g('xp_exam_monthly_limit')?.limit, 1),
        reviewDailyLimitPerCustomer: num(g('xp_review_daily_limit_per_customer')?.limit, 1),
      },
      /** 段位门槛+保级线（附件一 §三/§四；levelTable 已按 level 升序合并两行） */
      levels: levelTable(rules),
    };
  }),

  /**
   * 考试通过 XP（staff · 学习通道入口）。
   * 考试中心域未建（设计稿 §六.1 已报备），本端点即学习通道入口，考试中心批对接时复用本调用：
   * source=exam、channel=learning 单列不占日上限、每级每月限 1 次（awardXp 内部强制，
   * 重复计抛 BAD_REQUEST「该级别本月已计过学习经验」）。
   */
  recordExamPass: staffProcedure
    .input(z.object({ level: z.enum(['P0', 'P1', 'P2']) }))
    .mutation(async ({ ctx, input }) =>
      awardXp(ctx.db, {
        storeId: ctx.user.storeId!,
        staffId: ctx.user.staffId!,
        userId: ctx.user.id,
        source: 'exam',
        sourceId: input.level,
        channel: 'learning',
      }),
    ),

  /**
   * 临时补位指派（manager|owner 本店 · 附件一 §一 +15/次，xp_cover_shift）。
   * 目标员工必须属本店且在职；留痕 = xp_events 行（source='cover'，source_id 记指派人
   * userId——xp_events 无 note 列，指派人身份落 source_id）+ awardXp 内 emit XpAwarded。
   * note 为必填说明（回显给调用方；xp_events 表无备注列，不落库——设计稿冻结 schema 不动）。
   */
  assignCover: merchantManagerProcedure
    .input(
      z.object({
        staffId: z.string().min(1),
        note: z.string().trim().min(1, '请填写补位说明').max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const staffRow = await ctx.db
        .select()
        .from(schema.staff)
        .where(eq(schema.staff.id, input.staffId))
        .get();
      if (!staffRow || staffRow.storeId !== ctx.user.storeId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '员工不存在或不属于本店' });
      }
      if (staffRow.status !== 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '该员工已停职，不可指派补位' });
      }
      const result = await awardXp(ctx.db, {
        storeId: staffRow.storeId,
        staffId: staffRow.id,
        userId: staffRow.userId,
        source: 'cover',
        sourceId: `cover:${ctx.user.id}`, // 指派留痕：发起店长/老板 userId
      });
      return { ...result, staffId: staffRow.id, staffName: staffRow.name, note: input.note };
    }),

  /**
   * 本人评价列表（staff · 最小评价域，任务书 §五.6）。
   * 仅本人硬过滤（staffId=ctx.user.staffId），最新在前；出参不含任何客户身份字段——
   * 匿名评价对员工天然匿名（anonymous 标记原样返回，前端可展示"匿名评价"）。
   */
  myReviews: staffProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          cursor: cursorSchema,
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const rows = await ctx.db
        .select({
          id: schema.reviews.id,
          appointmentId: schema.reviews.appointmentId,
          rating: schema.reviews.rating,
          text: schema.reviews.text,
          anonymous: schema.reviews.anonymous,
          createdAt: schema.reviews.createdAt,
        })
        .from(schema.reviews)
        .where(
          and(
            eq(schema.reviews.staffId, ctx.user.staffId!),
            cursorCond(input?.cursor, schema.reviews.createdAt, schema.reviews.id),
          ),
        )
        .orderBy(desc(schema.reviews.createdAt), desc(schema.reviews.id))
        .limit(limit);
      const last = rows[rows.length - 1];
      return {
        items: rows,
        nextCursor: rows.length === limit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    }),

  /**
   * 月度保级结算手动触发（owner · e2e 实证 + 补跑入口）。
   * 生产路径 = index.ts 每月 1 日定时器；两者同走 settleXpMonth，
   * unique(staff_id, month) + onConflictDoNothing 幂等（重复触发零副作用）。
   * 入参 month='YYYY-MM'（结算对象月，通常传上月）；storeId 缺省=老板名下全部门店。
   */
  monthlySettleNow: merchantOwnerProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份格式须为 YYYY-MM'),
        storeId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let storeIds: string[];
      if (input.storeId) {
        const st = await ctx.db
          .select({ id: schema.stores.id, ownerId: schema.stores.ownerId })
          .from(schema.stores)
          .where(eq(schema.stores.id, input.storeId))
          .get();
        if (!st) throw new TRPCError({ code: 'NOT_FOUND', message: '门店不存在' });
        if (st.ownerId !== ctx.user.id && st.id !== ctx.user.storeId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅可结算本人名下门店' });
        }
        storeIds = [st.id];
      } else {
        const owned = await ctx.db
          .select({ id: schema.stores.id })
          .from(schema.stores)
          .where(eq(schema.stores.ownerId, ctx.user.id));
        storeIds = owned.length > 0 ? owned.map((s) => s.id) : [ctx.user.storeId!];
      }
      const results = [];
      for (const storeId of storeIds) {
        const written = await settleXpMonth(ctx.db, storeId, input.month);
        results.push({ storeId, month: input.month, written });
      }
      return { results };
    }),

  /**
   * 店长视图差评提示（R10⑥）：本店 ≤2 星评价列表（不等于工单，不建处理流）。
   * merchantManagerProcedure：店长/老板可看本店；店员由员工端 UI 隐藏入口（硬闸门在此）。
   */
  storeFlaggedReviews: merchantManagerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).strict())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const rows = await ctx.db
        .select({
          id: schema.reviews.id,
          appointmentId: schema.reviews.appointmentId,
          staffId: schema.reviews.staffId,
          staffName: schema.staff.name,
          rating: schema.reviews.rating,
          text: schema.reviews.text,
          anonymous: schema.reviews.anonymous,
          createdAt: schema.reviews.createdAt,
        })
        .from(schema.reviews)
        .leftJoin(schema.staff, eq(schema.reviews.staffId, schema.staff.id))
        .where(and(eq(schema.reviews.storeId, storeId), lt(schema.reviews.rating, 3)))
        .orderBy(desc(schema.reviews.createdAt))
        .limit(input.limit);
      return { items: rows };
    }),
});

export type XpRouter = typeof xpRouter;
