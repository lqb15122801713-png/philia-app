/**
 * 会员营销域 router（商家端大批片 5 · 0057）：
 * - 会员标签（member_tags：猫狗/体型/偏好三类，本店客户打标[upsert 覆盖写]/筛[按类值滤]）；
 * - 优惠券类型矩阵六类（coupons+coupon_type：register|recharge|consume|birthday|festival|wakeup；
 *   券基座=登记制不接真抵扣照案）+定向发放台账（coupon_campaigns：按标签类值/全量
 *   定向 → coupon_grants 批次落行 claimed + grantedCount 留痕；券有效期=coupons.valid_days）；
 * - 生日营销（台账+通知落行不造假发=开口项 2 裁）：生日权益台账读口（perk grants 生日类）
 *   +生日提醒名单（会员/宠物生日近 N 天[端口 birthday_perk_tier 配置面留口]）；
 * - 活动配置台账（promo_campaigns：满减/折扣/第二件/换购/时段促销+排期上下线留痕；
 *   状态懒算=draft（编辑中不上线）/scheduled 按起止时刻算[待上线|进行中|已结束]，
 *   不接真结算真折扣计算=开口项 1 裁）；
 * - 促销互斥·叠加规则逐项开关（service_rules 键组 promo_stack_* 端口值公示读口）；
 * - 支出费用台账（expense_records：房租/工资/水电/其他手工台账+月汇总；不接发票流=开口项 3 裁）；
 * - R3 换货差价补退台账（exchange_records：状态机 applied→confirmed→settled；差价方向+
 *   金额登记，留痕不碰真钱）；R4 退货待检质检（return_inspections：待检=台账标记层
 *   [不动既有直回可售链]，合格=标记清 / 不合格=触发报损扣减同族[products.stock+movements]）；
 * - 报表快照留档（report_snapshots：月快照 d1/member 两型，永久留存无清理任务注记）。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { resolveScopedRules } from './configRules';
import { merchantManagerProcedure, merchantOwnerProcedure, router, type Db } from '../trpc';

const badRequest = (m: string): never => {
  throw new TRPCError({ code: 'BAD_REQUEST', message: m });
};
const notFound = (m = '单据不存在'): never => {
  throw new TRPCError({ code: 'NOT_FOUND', message: m });
};
const mustGet = <T>(v: T | undefined, msg: string): T => {
  if (v === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: msg });
  return v;
};
type DbHandle = Parameters<typeof import('../realtime/bus').emitEvent>[0];

const TAG_KINDS = ['species', 'size', 'pref'] as const;
const COUPON_TYPES = ['register', 'recharge', 'consume', 'birthday', 'festival', 'wakeup'] as const;
const PROMO_TYPES = ['full_minus', 'discount', 'second_piece', 'exchange_gift', 'time_promo'] as const;
const EXPENSE_TYPES = ['rent', 'salary', 'utility', 'other'] as const;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 规则值读口（service_rules 分层解析；缺省 fallback） */
async function ruleVal(d: DbHandle, ruleKey: string, storeId: string, fallback: Record<string, unknown>): Promise<Record<string, unknown>> {
  const rows = await d
    .select({ ruleKey: schema.serviceRules.ruleKey, storeId: schema.serviceRules.storeId, valueJson: schema.serviceRules.valueJson })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, ruleKey), eq(schema.serviceRules.active, true)));
  return (resolveScopedRules(rows, storeId)[0]?.valueJson as Record<string, unknown> | undefined) ?? fallback;
}

/** 活动状态懒算（排期状态机留痕：draft=编辑中不上线；scheduled 按起止算） */
export function promoEffectiveStatus(
  row: { status: string; startsAt: Date | null; endsAt: Date | null },
  now: Date,
): 'draft' | 'scheduled' | 'active' | 'ended' {
  if (row.status === 'draft') return 'draft';
  const nowMs = now.getTime();
  if (row.endsAt && nowMs > row.endsAt.getTime()) return 'ended';
  if (row.startsAt && nowMs < row.startsAt.getTime()) return 'scheduled';
  return 'active';
}

export const marketingRouter = router({
  /* ------------------------------------------------------------------ */
  /* 会员标签                                                            */
  /* ------------------------------------------------------------------ */

  /** 打标（upsert 覆盖写：同店同人同类一行；值规范：species=dog|cat / size=small|medium|large / pref ≤16 字） */
  tagSet: merchantManagerProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        kind: z.enum(TAG_KINDS),
        value: z.string().trim().min(1).max(16),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      if (input.kind === 'species' && !['dog', 'cat'].includes(input.value)) badRequest('猫狗标签取值=dog|cat');
      if (input.kind === 'size' && !['small', 'medium', 'large'].includes(input.value)) badRequest('体型标签取值=small|medium|large');
      const user = await ctx.db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, input.userId)).get();
      if (!user) notFound('会员不存在');
      return ctx.db.transaction(async (tx) => {
        const exist = await tx
          .select()
          .from(schema.memberTags)
          .where(and(eq(schema.memberTags.storeId, storeId), eq(schema.memberTags.userId, input.userId), eq(schema.memberTags.kind, input.kind)))
          .get();
        if (exist) {
          const [row] = await tx
            .update(schema.memberTags)
            .set({ value: input.value, updatedAt: new Date() })
            .where(eq(schema.memberTags.id, exist.id))
            .returning();
          return { tag: row, created: false as const };
        }
        const [row] = await tx
          .insert(schema.memberTags)
          .values({ storeId, userId: input.userId, kind: input.kind, value: input.value })
          .returning();
        return { tag: row, created: true as const };
      });
    }),

  tagList: merchantManagerProcedure
    .input(z.object({ kind: z.enum(TAG_KINDS).optional(), value: z.string().trim().max(16).optional(), userId: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.memberTags.storeId, ctx.user.storeId!)];
      if (input?.kind) conds.push(eq(schema.memberTags.kind, input.kind));
      if (input?.value) conds.push(eq(schema.memberTags.value, input.value));
      if (input?.userId) conds.push(eq(schema.memberTags.userId, input.userId));
      const rows = await ctx.db
        .select({ tag: schema.memberTags, nickname: schema.users.nickname })
        .from(schema.memberTags)
        .leftJoin(schema.users, eq(schema.users.id, schema.memberTags.userId))
        .where(and(...conds))
        .orderBy(desc(schema.memberTags.updatedAt))
        .limit(500);
      return rows.map((r) => ({ ...r.tag, nickname: r.nickname ?? null }));
    }),

  /* ------------------------------------------------------------------ */
  /* 券类型矩阵 + 定向发放台账                                              */
  /* ------------------------------------------------------------------ */

  /** 券模板新建（类型矩阵六类；登记制不接真抵扣照案） */
  couponCreate: merchantManagerProcedure
    .input(
      z.object({
        couponType: z.enum(COUPON_TYPES),
        title: z.string().trim().min(1).max(64),
        amountFen: z.number().int().min(1).max(100_000_00),
        thresholdFen: z.number().int().min(0).max(100_000_00).default(0),
        validDays: z.number().int().min(1).max(3650).default(30),
        totalQuota: z.number().int().min(1).max(1_000_000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(schema.coupons)
        .values({
          storeId: ctx.user.storeId!,
          couponType: input.couponType,
          title: input.title,
          amountFen: input.amountFen,
          thresholdFen: input.thresholdFen,
          validDays: input.validDays,
          totalQuota: input.totalQuota ?? null,
          status: 'on',
          createdBy: ctx.user.id,
        })
        .returning();
      return { coupon: row };
    }),

  couponList: merchantManagerProcedure
    .input(z.object({ couponType: z.enum(COUPON_TYPES).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.coupons.storeId, ctx.user.storeId!)];
      if (input?.couponType) conds.push(eq(schema.coupons.couponType, input.couponType));
      const rows = await ctx.db
        .select()
        .from(schema.coupons)
        .where(and(...conds))
        .orderBy(desc(schema.coupons.createdAt))
        .limit(200);
      return { items: rows };
    }),

  /** 定向发放（台账+grants 批次落行 claimed；target=NULL=本店全量会员[有本店预约∪持卡∪消费∪卡办]） */
  campaignGrant: merchantManagerProcedure
    .input(
      z.object({
        couponId: z.string().min(1),
        title: z.string().trim().min(1).max(64),
        targetKind: z.enum(TAG_KINDS).optional(),
        targetValue: z.string().trim().max(16).optional(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const coupon = mustGet(await ctx.db.select().from(schema.coupons).where(eq(schema.coupons.id, input.couponId)).get(), '券模板不存在');
      if (coupon.storeId !== storeId) notFound('券模板不存在');
      if (coupon.status !== 'on') badRequest('券模板已停用');
      if (input.targetKind && !input.targetValue) badRequest('定向发放须填标签值');
      /* 目标人群：本店客户集（appointments ∪ memberPasses ∪ cashierBills ∪ memberships.sold），
         叠加标签条件（member_tags kind=value） */
      const base = new Set<string>();
      const pushIds = (rows: Array<Record<string, unknown>>, key: string) => {
        for (const r of rows) {
          const v = r[key];
          if (typeof v === 'string' && v) base.add(v);
        }
      };
      pushIds(await ctx.db.select({ customerId: schema.appointments.customerId }).from(schema.appointments).where(eq(schema.appointments.storeId, storeId)), 'customerId');
      pushIds(await ctx.db.select({ userId: schema.memberPasses.userId }).from(schema.memberPasses).where(eq(schema.memberPasses.storeId, storeId)), 'userId');
      pushIds(await ctx.db.select({ customerId: schema.cashierBills.customerId }).from(schema.cashierBills).where(eq(schema.cashierBills.storeId, storeId)), 'customerId');
      pushIds(await ctx.db.select({ userId: schema.memberships.userId }).from(schema.memberships).where(eq(schema.memberships.soldStoreId, storeId)), 'userId');
      let targets = [...base];
      if (input.targetKind && input.targetValue) {
        const tagged = await ctx.db
          .select({ userId: schema.memberTags.userId })
          .from(schema.memberTags)
          .where(and(eq(schema.memberTags.storeId, storeId), eq(schema.memberTags.kind, input.targetKind), eq(schema.memberTags.value, input.targetValue)));
        const tagSet = new Set(tagged.map((r) => r.userId));
        targets = targets.filter((id) => tagSet.has(id));
      }
      if (targets.length === 0) badRequest('定向人群为空（无匹配会员）');
      const quotaLeft = coupon.totalQuota === null ? null : coupon.totalQuota - (await grantCountOf(ctx.db, coupon.id));
      if (quotaLeft !== null && quotaLeft < targets.length) {
        badRequest(`券配额不足（余 ${quotaLeft} 份，待发 ${targets.length} 份）`);
      }
      return ctx.db.transaction(async (tx) => {
        const [campaign] = await tx
          .insert(schema.couponCampaigns)
          .values({
            storeId,
            couponId: coupon.id,
            title: input.title,
            targetKind: input.targetKind ?? null,
            targetValue: input.targetValue ?? null,
            grantedCount: targets.length,
            note: input.note ?? null,
          })
          .returning();
        const claimedAt = new Date();
        let granted = 0;
        for (const userId of targets) {
          /* 幂等=uq_coupon_grants_user_coupon（同人同券不重复发） */
          const dup = await tx
            .select({ id: schema.couponGrants.id })
            .from(schema.couponGrants)
            .where(and(eq(schema.couponGrants.userId, userId), eq(schema.couponGrants.couponId, coupon.id)))
            .get();
          if (dup) continue;
          await tx.insert(schema.couponGrants).values({
            userId,
            couponId: coupon.id,
            status: 'claimed',
            claimedAt,
          });
          granted += 1;
        }
        const [updated] = await tx
          .update(schema.couponCampaigns)
          .set({ grantedCount: granted, updatedAt: new Date() })
          .where(eq(schema.couponCampaigns.id, campaign!.id))
          .returning();
        return { campaign: updated, matched: targets.length, granted };
      });
    }),

  campaignList: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ campaign: schema.couponCampaigns, couponTitle: schema.coupons.title, couponType: schema.coupons.couponType })
      .from(schema.couponCampaigns)
      .innerJoin(schema.coupons, eq(schema.coupons.id, schema.couponCampaigns.couponId))
      .where(eq(schema.couponCampaigns.storeId, ctx.user.storeId!))
      .orderBy(desc(schema.couponCampaigns.createdAt))
      .limit(200);
    return rows.map((r) => ({ ...r.campaign, couponTitle: r.couponTitle, couponType: r.couponType }));
  }),

  /* ------------------------------------------------------------------ */
  /* 生日营销（台账+通知落行不造假发）                                       */
  /* ------------------------------------------------------------------ */

  /** 生日权益台账（perk grants 生日类发放记录读口）+ 生日提醒名单（会员/宠物生日近 N 天） */
  birthdayBoard: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const tier = await ruleVal(ctx.db, 'birthday_perk_tier', storeId, { amountFen: 500, thresholdFen: 0, validDays: 30 });
    /* 台账=生日类 perk_grants（本店客户集内） */
    const grants = await ctx.db
      .select({ grant: schema.memberPerkGrants, nickname: schema.users.nickname })
      .from(schema.memberPerkGrants)
      .leftJoin(schema.users, eq(schema.users.id, schema.memberPerkGrants.userId))
      .where(sql`${schema.memberPerkGrants.kind} IN ('birthday_owner', 'birthday_pet')`)
      .orderBy(desc(schema.memberPerkGrants.createdAt))
      .limit(200);
    const customerIds = new Set(
      (await ctx.db.select({ customerId: schema.appointments.customerId }).from(schema.appointments).where(eq(schema.appointments.storeId, storeId))).map((r) => r.customerId),
    );
    /* 提醒名单=本店客户中生日近 30 天（users.birthday / pets.birthday MM-DD 匹配，双源照 perks sweep 口径） */
    const now = new Date();
    const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const upcoming = new Set<string>();
    for (let i = 0; i < 30; i++) upcoming.add(md(new Date(now.getTime() + i * 24 * 3600 * 1000)));
    const usersWithBirthday = await ctx.db
      .select({ id: schema.users.id, nickname: schema.users.nickname, birthday: schema.users.birthday })
      .from(schema.users)
      .where(sql`${schema.users.birthday} IS NOT NULL`);
    const upcomingMembers = usersWithBirthday
      .filter((u) => customerIds.has(u.id) && u.birthday && upcoming.has(u.birthday.slice(5)))
      .map((u) => ({ userId: u.id, nickname: u.nickname, birthday: u.birthday, kind: 'member' as const }));
    const petsWithBirthday = await ctx.db
      .select({ id: schema.pets.id, name: schema.pets.name, birthday: schema.pets.birthday, ownerId: schema.pets.ownerId })
      .from(schema.pets)
      .where(sql`${schema.pets.birthday} IS NOT NULL`);
    const ownerIds = new Set(
      (await ctx.db.select({ customerId: schema.appointments.customerId }).from(schema.appointments).where(eq(schema.appointments.storeId, storeId))).map((r) => r.customerId),
    );
    const upcomingPets = petsWithBirthday
      .filter((p) => ownerIds.has(p.ownerId) && p.birthday && upcoming.has(p.birthday.slice(5)))
      .map((p) => ({ petId: p.id, name: p.name, birthday: p.birthday, kind: 'pet' as const }));
    return {
      tier,
      grants: grants.filter((g) => customerIds.has(g.grant.userId)).map((g) => ({ ...g.grant, nickname: g.nickname ?? null })),
      upcoming: [...upcomingMembers, ...upcomingPets],
      note: '生日营销=台账+通知落行（不造假发；既有 sweep 真发机制照案）',
    };
  }),

  /* ------------------------------------------------------------------ */
  /* 活动配置台账（排期状态机留痕，不接真结算）                                 */
  /* ------------------------------------------------------------------ */

  promoUpsert: merchantManagerProcedure
    .input(
      z.object({
        id: z.string().min(1).optional(),
        type: z.enum(PROMO_TYPES),
        name: z.string().trim().min(1).max(64),
        rulesJson: z.record(z.unknown()),
        startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        status: z.enum(['draft', 'scheduled']).default('draft'),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const fields = {
        type: input.type,
        name: input.name,
        rulesJson: input.rulesJson,
        startsAt: input.startsAt ? new Date(`${input.startsAt}T00:00:00Z`) : null,
        endsAt: input.endsAt ? new Date(`${input.endsAt}T23:59:59Z`) : null,
        status: input.status,
        note: input.note ?? null,
      };
      if (fields.startsAt && fields.endsAt && fields.endsAt < fields.startsAt) badRequest('排期结束不可早于开始');
      if (input.id) {
        const exist = mustGet(await ctx.db.select().from(schema.promoCampaigns).where(eq(schema.promoCampaigns.id, input.id)).get(), '活动不存在');
        if (exist.storeId !== storeId) notFound('活动不存在');
        if (exist.deletedAt) badRequest('活动在回收站，请先恢复再编辑');
        const [row] = await ctx.db
          .update(schema.promoCampaigns)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(schema.promoCampaigns.id, input.id))
          .returning();
        return { campaign: row, created: false as const };
      }
      const [row] = await ctx.db.insert(schema.promoCampaigns).values({ storeId, ...fields }).returning();
      return { campaign: row, created: true as const };
    }),

  promoList: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.promoCampaigns)
      .where(and(eq(schema.promoCampaigns.storeId, ctx.user.storeId!), isNull(schema.promoCampaigns.deletedAt)))
      .orderBy(desc(schema.promoCampaigns.createdAt))
      .limit(200);
    const now = new Date();
    return {
      now: now.toISOString(),
      items: rows.map((r) => ({ ...r, effectiveStatus: promoEffectiveStatus(r, now) })),
      note: '活动引擎=配置台账+排期状态机留痕（不接真结算真折扣计算=开口项 1 裁；真接=线上收单批/资质后）',
    };
  }),

  /** promoDelete（端口批收尾片 2 · 回收站软删，merchantManager）：运营件白名单=活动——
   * 软删置 deleted_at/deleted_by（list 默认过滤；恢复走 recycleBin.restore 统一口）；重复删除=400 */
  promoDelete: merchantManagerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.select().from(schema.promoCampaigns).where(eq(schema.promoCampaigns.id, input.id)).get();
      if (!row || row.storeId !== ctx.user.storeId!) throw new TRPCError({ code: 'NOT_FOUND', message: '活动不存在' });
      if (row.deletedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: '活动已在回收站' });
      await ctx.db
        .update(schema.promoCampaigns)
        .set({ deletedAt: new Date(), deletedBy: ctx.user.id, updatedAt: new Date() })
        .where(eq(schema.promoCampaigns.id, row.id));
      return { id: row.id, deleted: true };
    }),

  /** 促销互斥·叠加规则逐项开关（端口值公示读口） */
  promoStackRules: merchantManagerProcedure.query(async ({ ctx }) => {
    const storeId = ctx.user.storeId!;
    const keys = ['coupon_stack_rule', 'promo_stack_campaign_coupon', 'promo_stack_campaign_member', 'promo_stack_multi_campaign'] as const;
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = await ruleVal(ctx.db, k, storeId, k === 'coupon_stack_rule' ? { rule: 'none', note: '优惠券不与会员折扣叠加；每单限用 1 张（公示口径）' } : { rule: 'none' });
    }
    return { rules: out, note: '逐项开关=端口值公示（config.save 可改，门店覆盖优先于总部下发）' };
  }),

  /* ------------------------------------------------------------------ */
  /* 支出费用台账（不接发票流）                                              */
  /* ------------------------------------------------------------------ */

  expenseCreate: merchantManagerProcedure
    .input(
      z.object({
        type: z.enum(EXPENSE_TYPES),
        amountFen: z.number().int().min(1).max(100_000_00_00),
        bizMonth: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM'),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(schema.expenseRecords)
        .values({ storeId: ctx.user.storeId!, type: input.type, amountFen: input.amountFen, bizMonth: input.bizMonth, note: input.note ?? null, operatorId: ctx.user.id })
        .returning();
      return { record: row };
    }),

  expenseDelete: merchantOwnerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = mustGet(await ctx.db.select().from(schema.expenseRecords).where(eq(schema.expenseRecords.id, input.id)).get(), '台账行不存在');
      if (row.storeId !== ctx.user.storeId!) notFound('台账行不存在');
      await ctx.db.delete(schema.expenseRecords).where(eq(schema.expenseRecords.id, row.id));
      return { deleted: true };
    }),

  expenseList: merchantManagerProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.expenseRecords.storeId, ctx.user.storeId!)];
      if (input?.month) conds.push(eq(schema.expenseRecords.bizMonth, input.month));
      const rows = await ctx.db
        .select({ row: schema.expenseRecords, operatorName: schema.users.nickname })
        .from(schema.expenseRecords)
        .leftJoin(schema.users, eq(schema.users.id, schema.expenseRecords.operatorId))
        .where(and(...conds))
        .orderBy(desc(schema.expenseRecords.createdAt))
        .limit(500);
      const byType = new Map<string, number>();
      let total = 0;
      for (const r of rows) {
        byType.set(r.row.type, (byType.get(r.row.type) ?? 0) + r.row.amountFen);
        total += r.row.amountFen;
      }
      return {
        items: rows.map((r) => ({ ...r.row, operatorName: r.operatorName ?? null })),
        summary: { totalFen: total, byType: Object.fromEntries(byType) },
        note: '支出费用=手工台账留痕件（不接发票流=开口项 3 裁）',
      };
    }),

  /* ------------------------------------------------------------------ */
  /* R3 换货差价补退台账（留痕不碰真钱）                                     */
  /* ------------------------------------------------------------------ */

  exchangeCreate: merchantManagerProcedure
    .input(
      z.object({
        origBillId: z.string().min(1).optional(),
        customerId: z.string().min(1).optional(),
        origItemName: z.string().trim().min(1).max(128),
        newProductId: z.string().min(1).optional(),
        newItemName: z.string().trim().min(1).max(128),
        diffFen: z.number().int().min(-100_000_00).max(100_000_00).default(0),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      if (input.origBillId) {
        const bill = await ctx.db.select({ id: schema.cashierBills.id, storeId: schema.cashierBills.storeId }).from(schema.cashierBills).where(eq(schema.cashierBills.id, input.origBillId)).get();
        if (!bill || bill.storeId !== storeId) notFound('原收银单不存在');
      }
      if (input.newProductId) {
        const p = await ctx.db.select({ id: schema.products.id, storeId: schema.products.storeId }).from(schema.products).where(eq(schema.products.id, input.newProductId)).get();
        if (!p || p.storeId !== storeId) notFound('换新商品不存在');
      }
      const [row] = await ctx.db
        .insert(schema.exchangeRecords)
        .values({
          storeId,
          origBillId: input.origBillId ?? null,
          customerId: input.customerId ?? null,
          origItemName: input.origItemName,
          newProductId: input.newProductId ?? null,
          newItemName: input.newItemName,
          diffFen: input.diffFen,
          note: input.note ?? null,
          operatorId: ctx.user.id,
        })
        .returning();
      return { record: row };
    }),

  exchangeAdvance: merchantManagerProcedure
    .input(z.object({ id: z.string().min(1), action: z.enum(['confirm', 'settle']), note: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const row = mustGet(await ctx.db.select().from(schema.exchangeRecords).where(eq(schema.exchangeRecords.id, input.id)).get(), '换货台账行不存在');
      if (row.storeId !== storeId) notFound('换货台账行不存在');
      const next = input.action === 'confirm' ? 'confirmed' : 'settled';
      const legal =
        (row.status === 'applied' && input.action === 'confirm') ||
        ((row.status === 'applied' || row.status === 'confirmed') && input.action === 'settle');
      if (!legal) badRequest(`当前状态（${row.status}）不可 ${input.action === 'confirm' ? '确认' : '了结'}`);
      const [updated] = await ctx.db
        .update(schema.exchangeRecords)
        .set({ status: next, note: input.note ?? row.note, updatedAt: new Date() })
        .where(eq(schema.exchangeRecords.id, row.id))
        .returning();
      return { record: updated };
    }),

  exchangeList: merchantManagerProcedure
    .input(z.object({ status: z.enum(['applied', 'confirmed', 'settled']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.exchangeRecords.storeId, ctx.user.storeId!)];
      if (input?.status) conds.push(eq(schema.exchangeRecords.status, input.status));
      const rows = await ctx.db
        .select({ row: schema.exchangeRecords, operatorName: schema.users.nickname })
        .from(schema.exchangeRecords)
        .leftJoin(schema.users, eq(schema.users.id, schema.exchangeRecords.operatorId))
        .where(and(...conds))
        .orderBy(desc(schema.exchangeRecords.createdAt))
        .limit(200);
      return rows.map((r) => ({ ...r.row, operatorName: r.operatorName ?? null }));
    }),

  /* ------------------------------------------------------------------ */
  /* R4 退货待检质检（待检=台账标记层，不动既有直回可售链）                     */
  /* ------------------------------------------------------------------ */

  inspectionCreate: merchantManagerProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(1_000_000).default(1),
        refundBillId: z.string().min(1).optional(),
        qcNote: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const product = mustGet(await ctx.db.select().from(schema.products).where(eq(schema.products.id, input.productId)).get(), '商品不存在');
      if (product.storeId !== storeId) notFound('商品不存在');
      const [row] = await ctx.db
        .insert(schema.returnInspections)
        .values({ storeId, productId: product.id, qty: input.qty, refundBillId: input.refundBillId ?? null, qcNote: input.qcNote ?? null, operatorId: ctx.user.id })
        .returning();
      return { inspection: row };
    }),

  inspectionList: merchantManagerProcedure
    .input(z.object({ status: z.enum(['pending', 'passed', 'failed']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.returnInspections.storeId, ctx.user.storeId!)];
      if (input?.status) conds.push(eq(schema.returnInspections.status, input.status));
      const rows = await ctx.db
        .select({ row: schema.returnInspections, productName: schema.products.name, operatorName: schema.users.nickname })
        .from(schema.returnInspections)
        .innerJoin(schema.products, eq(schema.products.id, schema.returnInspections.productId))
        .leftJoin(schema.users, eq(schema.users.id, schema.returnInspections.operatorId))
        .where(and(...conds))
        .orderBy(desc(schema.returnInspections.createdAt))
        .limit(200);
      return {
        items: rows.map((r) => ({ ...r.row, productName: r.productName, operatorName: r.operatorName ?? null })),
        note: '待检=台账标记层（不动既有直回可售链）；不合格=触发报损扣减同族',
      };
    }),

  /** 质检：passed=标记清 / failed=触发报损扣减（products.stock+batch 同步+movements 留痕） */
  inspectionReview: merchantManagerProcedure
    .input(z.object({ id: z.string().min(1), pass: z.boolean(), qcNote: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const row = mustGet(await tx.select().from(schema.returnInspections).where(eq(schema.returnInspections.id, input.id)).get(), '待检行不存在');
        if (row.storeId !== storeId) notFound('待检行不存在');
        if (row.status !== 'pending') badRequest('该待检行已质检，不可重复质检');
        const now = new Date();
        if (!input.pass) {
          /* 不合格=报损扣减同族（库存直回后从未售出口径扣出，前后值留痕） */
          const product = await tx.select().from(schema.products).where(eq(schema.products.id, row.productId)).get();
          const deduct = Math.min(row.qty, Math.max(0, product?.stock ?? 0));
          if (product && deduct > 0) {
            await tx.update(schema.products).set({ stock: product.stock - deduct, updatedAt: now }).where(eq(schema.products.id, product.id));
            await tx.insert(schema.stockMovements).values({
              storeId,
              productId: product.id,
              delta: -deduct,
              beforeStock: product.stock,
              afterStock: product.stock - deduct,
              sourceType: 'inspection_fail',
              sourceId: row.id,
              note: `退货待检不合格销毁（待检质检分支）${input.qcNote ? `：${input.qcNote}` : ''}`,
              operatorId: ctx.user.id,
            });
          }
        }
        const [updated] = await tx
          .update(schema.returnInspections)
          .set({ status: input.pass ? 'passed' : 'failed', qcNote: input.qcNote ?? row.qcNote, reviewedBy: ctx.user.id, reviewedAt: now, updatedAt: now })
          .where(eq(schema.returnInspections.id, row.id))
          .returning();
        return { inspection: updated };
      });
    }),

  /* ------------------------------------------------------------------ */
  /* 报表快照留档（永久留存注记）                                             */
  /* ------------------------------------------------------------------ */

  snapshotCreate: merchantOwnerProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE), kind: z.enum(['d1', 'member']), payloadJson: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(schema.reportSnapshots)
        .values({ storeId: ctx.user.storeId!, month: input.month, kind: input.kind, payloadJson: input.payloadJson, createdBy: ctx.user.id, createdAt: new Date() })
        .returning();
      return { snapshot: row };
    }),

  snapshotList: merchantManagerProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.reportSnapshots.storeId, ctx.user.storeId!)];
      if (input?.month) conds.push(eq(schema.reportSnapshots.month, input.month));
      const rows = await ctx.db
        .select({ snapshot: schema.reportSnapshots, creatorName: schema.users.nickname })
        .from(schema.reportSnapshots)
        .leftJoin(schema.users, eq(schema.users.id, schema.reportSnapshots.createdBy))
        .where(and(...conds))
        .orderBy(desc(schema.reportSnapshots.month), desc(schema.reportSnapshots.createdAt))
        .limit(200);
      return {
        items: rows.map((r) => ({ ...r.snapshot, creatorName: r.creatorName ?? null })),
        note: '历史报表永久留存=月快照留档（无清理任务；即算查询永久可回溯同帧）',
      };
    }),
});

/** coupon_grants 全量计数（配额核） */
async function grantCountOf(db: Db, couponId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.couponGrants)
    .where(eq(schema.couponGrants.couponId, couponId))
    .get();
  return Number(rows?.n ?? 0);
}

export type MarketingRouter = typeof marketingRouter;
