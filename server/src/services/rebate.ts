/**
 * 回馈金账本域服务（批次 R11a 会员前置批·骨架批 · 27 号任务书冻结版 V1.0 §三 +
 * docs/r11/R11a-DESIGN.md §二，决策 #33+CJ-0922-13）
 *
 * 红线写死：
 * - 三本账物理分离、永不计营业额（回馈金/储值/XP 无互转通道）；
 * - 回馈金仅抵商品（红线 2，抵扣段硬校验在 cashier.settle，本文件不重复）；
 * - 不提现不转让不产息；余额变动全部留痕（rebate_logs 前后余额+来源单号）；
 * - 到期不自动续费：到期=冻结（余额在不可用）、续费解冻、退会清零。
 *
 * 口径（冻结）：
 * - 期次 period='YYYY-MM'：上月 26 日~本月 25 日为一期，期次名=本月；
 *   grant 行挂期次、**统一次月到账**（次月 5 日 rebate_settlement_day 可调，
 *   故障顺延≤3 天页面明示）——grant 落 logs 时 balance 不动（before=after），
 *   可用余额只反映已到账（rebate_accounts.balance_fen）；
 * - grant 基数=商品实收−rebate 抵扣段（用回馈金付的部分不再返），×档位 rebate_bp/10000
 *   精确到分；无月上限；无会员/微光（rebate_bp=0）不写行；
 * - deduct 仅已到账余额 1:1 扣，余额不足由调用方先判（本函数兜底 FORBIDDEN 如实）；
 * - clawback 扣回由 refund.ts 写（R12 冻结接口，不在本文件）；
 * - 月度结算 settleMonthly：Σ 上一期次未结算 grant 行 → rebate_settlements 批次单
 *   （period unique 幂等）+ 逐用户余额入账（入账行落 logs 前后值 + 原 grant 行回标
 *   settlement_id）。
 *
 * 所有函数可在事务内调用（传 tx，类型按 cashier.ts 惯例 cast 为 DbHandle）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { schema } from '../db';
import type { DbHandle } from './xpAward';

/* ------------------------------------------------------------------ */
/* 类型与常量                                                            */
/* ------------------------------------------------------------------ */

export type MembershipRow = typeof schema.memberships.$inferSelect;
export type MemberPlanRow = typeof schema.memberPlans.$inferSelect;
export type RebateAccountRow = typeof schema.rebateAccounts.$inferSelect;

/** 回馈金流水五类（schema 注释冻结）：grant 发放 / deduct 抵扣 / clawback 扣回（refund.ts 写） / freeze 冻结 / clear 清零 */
export type RebateLogType = 'grant' | 'deduct' | 'clawback' | 'freeze' | 'clear';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** member_plans.value_json 数值字段读取（缺省/非数 → fallback；配置端口保存即生效，每次实时读表） */
export function planNum(plan: MemberPlanRow | undefined, key: string, fallback: number): number {
  const v = (plan?.valueJson as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** 读取当前生效会员档位配置（member_plans active=1 全量；含 plan_* 四档与 rebate_settlement_day 等全局键） */
export async function loadMemberPlans(d: DbHandle): Promise<Map<string, MemberPlanRow>> {
  const rows = await d.select().from(schema.memberPlans).where(eq(schema.memberPlans.active, true));
  return new Map(rows.map((r) => [r.ruleKey, r]));
}

/**
 * 期次计算（冻结口径：上月 26 日~本月 25 日为一期，期次名=本月 'YYYY-MM'）：
 * 每月 26 日起进入下一期。例：10 月 25 日 → 'YYYY-10'；10 月 26 日 → 'YYYY-11'。
 */
export function rebatePeriodOf(now: Date): string {
  const base =
    now.getDate() >= 26
      ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}`;
}

/* ------------------------------------------------------------------ */
/* 会员实例读取 + 到期懒冻结（红线 4）                                      */
/* ------------------------------------------------------------------ */

/**
 * 当前会员实例（每用户至多一行 active/frozen，应用层约束；cancelled 历史行不算会员）。
 * 到期懒冻结：active 且 expires_at<=now → 同事务语义内翻 frozen + rebate 账户冻结 +
 * freeze 留痕行（余额在不可用；无自动续费任何开关——红线 4）。
 * 读路径（my/balanceOf/收银识别）与写路径（grant/deduct）共用本入口，保证
 * 「expire 过日 → frozen+余额不可用」不依赖额外定时器。
 */
export async function currentMembership(
  d: DbHandle,
  userId: string,
  now: Date = new Date(),
): Promise<MembershipRow | null> {
  const row = await d
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), inArray(schema.memberships.status, ['active', 'frozen'])))
    .orderBy(desc(schema.memberships.createdAt))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;
  if (row.status === 'active' && row.expiresAt.getTime() <= now.getTime()) {
    return freezeMembership(d, { userId, membershipId: row.id, now, note: '会员到期自动冻结（红线 4：到期不自动续费）' });
  }
  return row;
}

/**
 * 会员到期/到期前冻结助手（membership 域调用）：memberships active→frozen +
 * rebate_accounts status='frozen' + rebate_logs type='freeze' 留痕行（delta=0，余额不动不可用）。
 * 幂等：已 frozen 直接返回现状。
 */
export async function freezeMembership(
  d: DbHandle,
  opts: { userId: string; membershipId: string; now?: Date; note?: string },
): Promise<MembershipRow> {
  const now = opts.now ?? new Date();
  const acc = await ensureRebateAccount(d, opts.userId, now);
  if (acc.status !== 'frozen') {
    await d
      .update(schema.rebateAccounts)
      .set({ status: 'frozen', updatedAt: now })
      .where(eq(schema.rebateAccounts.id, acc.id));
    await writeLog(d, {
      userId: opts.userId,
      accountId: acc.id,
      type: 'freeze',
      deltaFen: 0,
      beforeFen: acc.balanceFen,
      afterFen: acc.balanceFen,
      sourceId: opts.membershipId,
      note: opts.note ?? '会员冻结（余额在不可用）',
    });
  }
  const updated = await d
    .update(schema.memberships)
    .set({ status: 'frozen', updatedAt: now })
    .where(eq(schema.memberships.id, opts.membershipId))
    .returning()
    .then((r) => r[0]!);
  return updated;
}

/**
 * 续费解冻助手（membership.renew 调用）：rebate_accounts frozen→active +
 * type='freeze' 留痕行（note 标明解冻；五类流水无独立 unfreeze 型，delta=0 余额不动）。
 */
export async function unfreezeRebateAccount(
  d: DbHandle,
  opts: { userId: string; sourceId: string; now?: Date },
): Promise<void> {
  const now = opts.now ?? new Date();
  const acc = await ensureRebateAccount(d, opts.userId, now);
  if (acc.status !== 'frozen') return;
  await d
    .update(schema.rebateAccounts)
    .set({ status: 'active', updatedAt: now })
    .where(eq(schema.rebateAccounts.id, acc.id));
  await writeLog(d, {
    userId: opts.userId,
    accountId: acc.id,
    type: 'freeze',
    deltaFen: 0,
    beforeFen: acc.balanceFen,
    afterFen: acc.balanceFen,
    sourceId: opts.sourceId,
    note: '续费解冻（回馈金账户恢复可用）',
  });
}

/**
 * 退会清零助手（membership.cancel 调用）：balance→0 + type='clear' 留痕行
 * （前后余额；余额本就为 0 也落行——退会清零是审计动作，留痕不省）。
 */
export async function clearRebateAccount(
  d: DbHandle,
  opts: { userId: string; sourceId: string; now?: Date; note?: string },
): Promise<{ clearedFen: number }> {
  const now = opts.now ?? new Date();
  const acc = await ensureRebateAccount(d, opts.userId, now);
  await d
    .update(schema.rebateAccounts)
    .set({ balanceFen: 0, updatedAt: now })
    .where(eq(schema.rebateAccounts.id, acc.id));
  await writeLog(d, {
    userId: opts.userId,
    accountId: acc.id,
    type: 'clear',
    deltaFen: -acc.balanceFen,
    beforeFen: acc.balanceFen,
    afterFen: 0,
    sourceId: opts.sourceId,
    note: opts.note ?? '退会清零（档位终止，回馈金余额清零——红线：退卡清零）',
  });
  return { clearedFen: acc.balanceFen };
}

/* ------------------------------------------------------------------ */
/* 账户与流水                                                              */
/* ------------------------------------------------------------------ */

/** 一人一本（rebate_accounts.user_id unique）；并发兜底 onConflictDoNothing 后重读 */
export async function ensureRebateAccount(
  d: DbHandle,
  userId: string,
  now: Date = new Date(),
): Promise<RebateAccountRow> {
  const acc = await d
    .select()
    .from(schema.rebateAccounts)
    .where(eq(schema.rebateAccounts.userId, userId))
    .get();
  if (acc) return acc;
  await d
    .insert(schema.rebateAccounts)
    .values({ userId, balanceFen: 0, status: 'active', createdAt: now, updatedAt: now })
    .onConflictDoNothing();
  const again = await d
    .select()
    .from(schema.rebateAccounts)
    .where(eq(schema.rebateAccounts.userId, userId))
    .get();
  return again!;
}

async function writeLog(
  d: DbHandle,
  row: {
    userId: string;
    accountId: string;
    type: RebateLogType;
    deltaFen: number;
    beforeFen: number;
    afterFen: number;
    sourceId: string;
    period?: string | null;
    settlementId?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await d.insert(schema.rebateLogs).values({
    userId: row.userId,
    accountId: row.accountId,
    type: row.type,
    deltaFen: row.deltaFen,
    beforeFen: row.beforeFen,
    afterFen: row.afterFen,
    sourceId: row.sourceId,
    period: row.period ?? null,
    settlementId: row.settlementId ?? null,
    note: row.note ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* 发放 / 抵扣                                                            */
/* ------------------------------------------------------------------ */

export interface GrantResult {
  grantedFen: number;
  /** 命中档位（无会员=null；微光/零额返还在 grantedFen=0 时透出档位便于排查） */
  planKey: string | null;
  /** true=同单已发过（幂等快路径，零副作用） */
  duplicated: boolean;
}

/**
 * 商品行回馈金计提（收银台结账成交时点调用，同事务）：
 * - 仅 active 会员付费档返（rebate_bp>0）；无会员/微光/到期冻结 = 0 不写行；
 * - grant = productFen（调用方已扣减 rebate 抵扣段口径：用回馈金付的部分不再返）
 *   × rebate_bp/10000，Math.round 精确到分；无月上限；
 * - 落 rebate_logs type='grant' 挂当期 period，**balance 不动**（before=after）
 *   ——统一次月到账（CJ-0922-13），可用余额由 settleMonthly 入账；
 * - 幂等双保险：同 user+billNo 的 grant 行已存在则跳过（settle 以 bill_no 幂等为主闸）。
 */
export async function grantOnProductSettled(
  d: DbHandle,
  opts: { userId: string; billNo: string; productFen: number; storeId: string; now?: Date },
): Promise<GrantResult> {
  const now = opts.now ?? new Date();
  const m = await currentMembership(d, opts.userId, now);
  if (!m || m.status !== 'active') return { grantedFen: 0, planKey: null, duplicated: false };
  const plans = await loadMemberPlans(d);
  const plan = plans.get(m.planKey);
  const bp = planNum(plan, 'rebate_bp', 0);
  if (bp <= 0) return { grantedFen: 0, planKey: m.planKey, duplicated: false }; // 微光=0 不写行
  const grantFen = Math.round((opts.productFen * bp) / 10000);
  if (grantFen <= 0) return { grantedFen: 0, planKey: m.planKey, duplicated: false };

  const dup = await d
    .select({ id: schema.rebateLogs.id })
    .from(schema.rebateLogs)
    .where(
      and(
        eq(schema.rebateLogs.userId, opts.userId),
        eq(schema.rebateLogs.type, 'grant'),
        eq(schema.rebateLogs.sourceId, opts.billNo),
      ),
    )
    .get();
  if (dup) return { grantedFen: 0, planKey: m.planKey, duplicated: true };

  const acc = await ensureRebateAccount(d, opts.userId, now);
  await writeLog(d, {
    userId: opts.userId,
    accountId: acc.id,
    type: 'grant',
    deltaFen: grantFen,
    beforeFen: acc.balanceFen, // 未到账：余额不动，before=after
    afterFen: acc.balanceFen,
    sourceId: opts.billNo,
    period: rebatePeriodOf(now),
    note: `商品消费回馈（档位 ${m.planKey}，${bp / 100}%），期次 ${rebatePeriodOf(now)}，次月到账`,
  });
  return { grantedFen: grantFen, planKey: m.planKey, duplicated: false };
}

/**
 * 回馈金抵扣（cashier.settle 支付段 method='rebate' 调用，同事务）：
 * 仅已到账余额 1:1 扣（rebate_accounts.balance_fen），前后余额留痕；
 * 余额不足调用方先判，本函数兜底 FORBIDDEN 如实（可混搭现金/微信/支付宝）；
 * 账户冻结（会员到期）FORBIDDEN——余额在不可用，续费解冻后可用。
 */
export async function deductRebate(
  d: DbHandle,
  opts: { userId: string; billNo: string; amountFen: number; now?: Date },
): Promise<{ beforeFen: number; afterFen: number }> {
  const now = opts.now ?? new Date();
  const acc = await ensureRebateAccount(d, opts.userId, now);
  if (acc.status !== 'active') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '回馈金账户冻结中（会员到期，续费后恢复使用）' });
  }
  if (acc.balanceFen < opts.amountFen) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `回馈金余额不足：余额 ${(acc.balanceFen / 100).toFixed(2)} 元，本单需 ${(opts.amountFen / 100).toFixed(2)} 元（可混搭现金/微信/支付宝补足）`,
    });
  }
  const after = acc.balanceFen - opts.amountFen;
  await d
    .update(schema.rebateAccounts)
    .set({ balanceFen: after, updatedAt: now })
    .where(eq(schema.rebateAccounts.id, acc.id));
  await writeLog(d, {
    userId: opts.userId,
    accountId: acc.id,
    type: 'deduct',
    deltaFen: -opts.amountFen,
    beforeFen: acc.balanceFen,
    afterFen: after,
    sourceId: opts.billNo,
    note: `收银台结账抵扣 ${opts.billNo}（仅商品行可用——红线 2）`,
  });
  return { beforeFen: acc.balanceFen, afterFen: after };
}

/* ------------------------------------------------------------------ */
/* 月度结算（次月到账）                                                    */
/* ------------------------------------------------------------------ */

export interface SettleMonthlyResult {
  /** true=本批实际执行入账；false=未到期/已结算（幂等空转） */
  settled: boolean;
  reason?: 'not-due' | 'already-settled';
  /** 结算对象期次（'YYYY-MM'） */
  period: string;
  scheduledDay: number;
  settlementId?: string;
  grantedCount: number;
  grantedFen: number;
}

/**
 * 回馈金月度结算（每月 rebate_settlement_day 读表，默认 5 日；故障顺延≤3 天页面明示）：
 * - 结算对象=上一期次（now 所在月的上一自然月：该期次覆盖上月 26~本月 25 的 grant 行）；
 *   当日 < 结算日 → not-due 空转；
 * - 幂等：rebate_settlements.period unique——已结算直接返回 already-settled，
 *   30min 滴答重入/e2e 直调互撞零副作用；
 * - 事务内：写批次单（granted_count/granted_fen/scheduled_day 快照/executed_at）→
 *   逐用户余额入账（accounts 前后值 + 入账 logs 行 delta=+Σ、settlement_id=批次）→
 *   原 grant 行回标 settlement_id（不再计入「本期预计」）；
 * - 冻结账户照常入账（余额在不可用，是欠客户的账必须到账；可用性由 deduct 闸门控制）。
 */
export async function settleMonthly(d: DbHandle, now: Date): Promise<SettleMonthlyResult> {
  const plans = await loadMemberPlans(d);
  const scheduledDay = planNum(plans.get('rebate_settlement_day'), 'day', 5);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`;
  if (now.getDate() < scheduledDay) {
    return { settled: false, reason: 'not-due', period, scheduledDay, grantedCount: 0, grantedFen: 0 };
  }

  const existing = await d
    .select({ id: schema.rebateSettlements.id })
    .from(schema.rebateSettlements)
    .where(eq(schema.rebateSettlements.period, period))
    .get();
  if (existing) {
    return { settled: false, reason: 'already-settled', period, scheduledDay, settlementId: existing.id, grantedCount: 0, grantedFen: 0 };
  }

  return d.transaction(async (tx) => {
    const t = tx as unknown as DbHandle;
    /* 事务内幂等复核（定时器与手动补跑竞态兜底；period unique 索引最终防线） */
    const dup = await t
      .select({ id: schema.rebateSettlements.id })
      .from(schema.rebateSettlements)
      .where(eq(schema.rebateSettlements.period, period))
      .get();
    if (dup) {
      return { settled: false, reason: 'already-settled', period, scheduledDay, settlementId: dup.id, grantedCount: 0, grantedFen: 0 };
    }

    /* 上一期次未结算 grant 行（入账行自身 settlement_id 非空，天然排除） */
    const grants = await t
      .select({
        id: schema.rebateLogs.id,
        userId: schema.rebateLogs.userId,
        accountId: schema.rebateLogs.accountId,
        deltaFen: schema.rebateLogs.deltaFen,
      })
      .from(schema.rebateLogs)
      .where(
        and(
          eq(schema.rebateLogs.type, 'grant'),
          eq(schema.rebateLogs.period, period),
          isNull(schema.rebateLogs.settlementId),
        ),
      );

    const batch = await t
      .insert(schema.rebateSettlements)
      .values({
        period,
        grantedCount: grants.length,
        grantedFen: grants.reduce((s, g) => s + g.deltaFen, 0),
        scheduledDay,
        executedAt: now,
        status: 'done',
        note: grants.length === 0 ? '本期无回馈金发放（占位批次，幂等标记）' : null,
      })
      .returning()
      .then((r) => r[0]!);

    /* 逐用户余额入账（前后值留痕）+ 原 grant 行回标批次 */
    const byUser = new Map<string, { accountId: string; fen: number; ids: string[] }>();
    for (const g of grants) {
      const cell = byUser.get(g.userId) ?? { accountId: g.accountId, fen: 0, ids: [] };
      cell.fen += g.deltaFen;
      cell.ids.push(g.id);
      byUser.set(g.userId, cell);
    }
    for (const [userId, cell] of byUser) {
      const acc = await t
        .select()
        .from(schema.rebateAccounts)
        .where(eq(schema.rebateAccounts.id, cell.accountId))
        .get();
      const before = acc?.balanceFen ?? 0;
      const after = before + cell.fen;
      await t
        .update(schema.rebateAccounts)
        .set({ balanceFen: after, updatedAt: now })
        .where(eq(schema.rebateAccounts.id, cell.accountId));
      await writeLog(t, {
        userId,
        accountId: cell.accountId,
        type: 'grant',
        deltaFen: cell.fen,
        beforeFen: before,
        afterFen: after,
        sourceId: batch.id,
        period,
        settlementId: batch.id,
        note: `期次 ${period} 结算入账（批次 ${batch.id}，次月到账口径）`,
      });
      await t
        .update(schema.rebateLogs)
        .set({ settlementId: batch.id, updatedAt: now })
        .where(inArray(schema.rebateLogs.id, cell.ids));
    }

    return {
      settled: true,
      period,
      scheduledDay,
      settlementId: batch.id,
      grantedCount: grants.length,
      grantedFen: grants.reduce((s, g) => s + g.deltaFen, 0),
    };
  });
}

/* ------------------------------------------------------------------ */
/* 余额查询（会员页账本 / 收银识别共用）                                     */
/* ------------------------------------------------------------------ */

/**
 * 回馈金余额视图：{ balanceFen 已到账可用, pendingFen 本期预计（未结算 grant 合计）, status }。
 * 顺带做会员到期懒冻结（读路径兜底红线 4）。
 */
export async function balanceOf(
  d: DbHandle,
  userId: string,
  now: Date = new Date(),
): Promise<{ balanceFen: number; pendingFen: number; status: string }> {
  await currentMembership(d, userId, now); // 懒冻结：到期即 frozen，余额在不可用
  const acc = await d
    .select()
    .from(schema.rebateAccounts)
    .where(eq(schema.rebateAccounts.userId, userId))
    .get();
  const pend = await d
    .select({ s: sql<number>`coalesce(sum(delta_fen),0)` })
    .from(schema.rebateLogs)
    .where(
      and(
        eq(schema.rebateLogs.userId, userId),
        eq(schema.rebateLogs.type, 'grant'),
        isNull(schema.rebateLogs.settlementId),
      ),
    )
    .get();
  return {
    balanceFen: acc?.balanceFen ?? 0,
    pendingFen: Number(pend?.s ?? 0),
    status: acc?.status ?? 'active',
  };
}

/**
 * 会员档位实时解析（收银台服务折扣 / 发放判定共用）：
 * active 且未到期 → { membership, plan }；否则 null（未识别/微光以外冻结/散客）。
 */
export async function memberPlanFor(
  d: DbHandle,
  userId: string,
  now: Date = new Date(),
): Promise<{ membership: MembershipRow; plan: MemberPlanRow } | null> {
  const m = await currentMembership(d, userId, now);
  if (!m || m.status !== 'active' || m.expiresAt.getTime() <= now.getTime()) return null;
  const plans = await loadMemberPlans(d);
  const plan = plans.get(m.planKey);
  if (!plan) return null;
  return { membership: m, plan };
}
