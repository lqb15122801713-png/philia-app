/**
 * 会员权益 router（客户端体验大批 片 3 · server 侧 · coder Q 名下新文件）
 *
 * namespace perk 端点：
 * - myUnused   未用权益包（customer）：次卡剩余次数（passTimes，与会员权益分列展示
 *              **不并账**——两本账各算各的，注记明面）+ member_perk_grants 本人
 *              status='granted' 台账行（生日礼/新人礼包/升级礼遇/次数型权益通用）；
 * - consume    核销写口（merchantManager）：台账先行——仅落核销留痕（次数型
 *              remain_count-1、归零翻 exhausted；资格型直接翻 exhausted）。
 *              **本片不落真核销链**：与收银台结账的折扣/抵现联动候批（开口项口径），
 *              收银台结账处的调用点注释明面，见 cashier 结账链（本批不接线）。
 *
 * 内部服务（export，供其他域/定时器/e2e 直调）：
 * - sweepBirthdayPerks    生日礼每日扫描（index.ts 30min 滴答调用）：
 *     users.birthday / pets.birthday 的 MM-DD = 今日（门店规范时区 +8）且当年未发 →
 *     member_perk_grants 落行（kind='birthday_owner'/'birthday_pet'，year+pet_id 入
 *     幂等锚）+ notifications 营销类落行。**礼=权益资格留痕（kind 即资格），真发
 *     （实物/券兑付）候资质批，本片不碰任何钱域表**。
 * - grantWelcomePack      新人礼包：注册建档触发（auth/devLogin.ts 手机号建档处调用），
 *     kind='welcome_pack'，(user_id,kind,source_id) 幂等锚；
 * - grantFirstOrderGift   升级礼遇：商城订单 pending→paid 首单翻转点触发
 *     （routes/payCallback.ts 事务内调用），kind='upgrade_gift'。
 *
 * 幂等口径（明面注记）：uq_perk_grants_birthday(user_id,kind,year,pet_id) 是唯一
 * 锚，但 SQLite 唯一索引对 NULL 字段不判重（welcome/upgrade 的 year/pet_id 为
 * NULL、birthday_owner 的 pet_id 为 NULL）——故一律「先查后插」应用层幂等，
 * 非 NULL 场景唯一索引兜底双保险；重扫/重放/重复注册均零重复行（e2e 实证）。
 *
 * 通知纪律：营销类（category='marketing'）落 notifications 前查 user_notify_prefs，
 * 退订用户跳过通知（与 realtime/bus.ts 营销拦截同口径），权益台账行不受影响。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import type { DbHandle } from '../services/xpAward';
import { customerProcedure, merchantManagerProcedure, router } from '../trpc';
import { storeWallclock } from './appointment';

const txDb = (tx: unknown): DbHandle => tx as DbHandle;

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 权益资格类型（应用层枚举；kind 即资格——真发候资质批，注释明面） */
export const PERK_KINDS = [
  'service_discount_count', // 服务折扣次数（次数型）
  'care_package', // 安心包（次数型）
  'birthday_owner', // 生日礼·主人（年度资格）
  'birthday_pet', // 生日礼·宠物（年度资格，pet_id 入锚）
  'welcome_pack', // 新人礼包（注册触发）
  'upgrade_gift', // 升级礼遇（首单 paid 触发）
] as const;

type PerkGrantRow = typeof schema.memberPerkGrants.$inferSelect;

/* ------------------------------------------------------------------ */
/* 内部服务：资格落台账（先查后插幂等）+ 营销通知落行                        */
/* ------------------------------------------------------------------ */

/**
 * 资格留痕（先查后插幂等）：命中锚（user_id+kind+year+pet_id+source_id 组合
 * 语义键）已存在 → 返回现状 created=false 零写入；否则落 granted 行。
 * 注：SQLite 唯一索引 NULL 不判重（见文件头注），故不靠 onConflict 兜底，
 * 统一应用层存在性检查；调用方若在事务内（payCallback）天然串行安全，
 * 定时器/devLogin 单写路径无并发互撞（同 XP 补发任务边界口径）。
 */
export async function grantPerkIfAbsent(
  d: DbHandle,
  opts: {
    userId: string;
    kind: string;
    storeId?: string | null;
    totalCount?: number | null;
    remainCount?: number | null;
    sourceId?: string | null;
    year?: number | null;
    petId?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<{ created: boolean; grant: PerkGrantRow }> {
  const conds = [
    eq(schema.memberPerkGrants.userId, opts.userId),
    eq(schema.memberPerkGrants.kind, opts.kind),
    opts.year == null ? isNull(schema.memberPerkGrants.year) : eq(schema.memberPerkGrants.year, opts.year),
    opts.petId == null ? isNull(schema.memberPerkGrants.petId) : eq(schema.memberPerkGrants.petId, opts.petId),
    opts.sourceId == null
      ? isNull(schema.memberPerkGrants.sourceId)
      : eq(schema.memberPerkGrants.sourceId, opts.sourceId),
  ];
  const existing = await d
    .select()
    .from(schema.memberPerkGrants)
    .where(and(...conds))
    .get();
  if (existing) return { created: false, grant: existing };
  const grant = await d
    .insert(schema.memberPerkGrants)
    .values({
      userId: opts.userId,
      kind: opts.kind,
      storeId: opts.storeId ?? null,
      totalCount: opts.totalCount ?? null,
      remainCount: opts.remainCount ?? null,
      sourceId: opts.sourceId ?? null,
      year: opts.year ?? null,
      petId: opts.petId ?? null,
      status: 'granted',
      meta: opts.meta ?? { note: '权益资格留痕（真发候资质批）' },
    })
    .returning()
    .then((r) => r[0]!);
  return { created: true, grant };
}

/**
 * 营销类站内通知落行（category='marketing'）：退订（user_notify_prefs
 * marketing.enabled=0）用户跳过（与 bus.ts 营销拦截同口径）；返回是否落行。
 */
async function insertMarketingNotification(
  d: DbHandle,
  opts: { userId: string; type: string; title: string; body: string; link?: string },
): Promise<boolean> {
  const disabled = await d
    .select({ userId: schema.userNotifyPrefs.userId })
    .from(schema.userNotifyPrefs)
    .where(
      and(
        eq(schema.userNotifyPrefs.userId, opts.userId),
        eq(schema.userNotifyPrefs.category, 'marketing'),
        eq(schema.userNotifyPrefs.enabled, false),
      ),
    )
    .get();
  if (disabled) return false;
  await d.insert(schema.notifications).values({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    link: opts.link ?? '/member/perks',
    category: 'marketing',
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* 内部服务：生日礼扫描（index.ts 30min 滴答；e2e 可直调）                    */
/* ------------------------------------------------------------------ */

/**
 * 生日礼每日扫描：users.birthday / pets.birthday 的 MM-DD = 今日（门店规范
 * 时区 +8，与全店 wallclock 口径同帧）→ 当年未发则落资格行 + 营销通知。
 * 幂等：grantPerkIfAbsent 先查后插（year+pet_id 锚），30min 滴答重入/重扫
 * 同年零新增（e2e 68.3 实证）。已注销账号（deactivated_at 非空）/已删宠物
 * 跳过。内测口径明面：2-29 生日仅闰年当天触发（MM-DD 精确匹配）。
 */
export async function sweepBirthdayPerks(
  d: DbHandle,
  now: Date = new Date(),
): Promise<{ ownerGranted: number; petGranted: number }> {
  const w = storeWallclock(now);
  const mmdd = `${pad2(w.m)}-${pad2(w.day)}`;
  const year = w.y;
  let ownerGranted = 0;
  let petGranted = 0;

  /* 主人生日：users.birthday='YYYY-MM-DD'，substr(6,5)='MM-DD' 匹配今日 */
  const birthdayUsers = await d
    .select({ id: schema.users.id, nickname: schema.users.nickname })
    .from(schema.users)
    .where(
      and(
        sql`substr(${schema.users.birthday}, 6, 5) = ${mmdd}`,
        isNull(schema.users.deactivatedAt),
      ),
    );
  for (const u of birthdayUsers) {
    try {
      const r = await grantPerkIfAbsent(d, {
        userId: u.id,
        kind: 'birthday_owner',
        year,
        meta: { note: '生日礼·主人：资格留痕（真发候资质批）', year },
      });
      if (!r.created) continue; // 当年已发：重扫零新增
      ownerGranted++;
      await insertMarketingNotification(d, {
        userId: u.id,
        type: 'perk.birthday',
        title: '生日礼已放入您的权益包',
        body: '生日快乐！生日专属礼遇已发放，到店出示会员码即可使用（以门店核销为准）',
      });
    } catch (err) {
      console.error(`[perk] 生日礼（主人）发放失败 user=${u.id}:`, err); // crash-safe：单用户失败不阻断整轮
    }
  }

  /* 宠物生日：pets.birthday 同链，pet_id 入幂等锚；通知发给主人 */
  const birthdayPets = await d
    .select({ id: schema.pets.id, ownerId: schema.pets.ownerId, name: schema.pets.name })
    .from(schema.pets)
    .where(
      and(
        sql`substr(${schema.pets.birthday}, 6, 5) = ${mmdd}`,
        isNull(schema.pets.deletedAt),
      ),
    );
  for (const p of birthdayPets) {
    try {
      const r = await grantPerkIfAbsent(d, {
        userId: p.ownerId,
        kind: 'birthday_pet',
        year,
        petId: p.id,
        meta: { note: '生日礼·宠物：资格留痕（真发候资质批）', year, petName: p.name },
      });
      if (!r.created) continue;
      petGranted++;
      await insertMarketingNotification(d, {
        userId: p.ownerId,
        type: 'perk.birthday_pet',
        title: `【${p.name}】生日礼已放入权益包`,
        body: `【${p.name}】生日快乐！宠物生日专属礼遇已发放，到店出示会员码即可使用（以门店核销为准）`,
      });
    } catch (err) {
      console.error(`[perk] 生日礼（宠物）发放失败 pet=${p.id}:`, err);
    }
  }
  if (ownerGranted + petGranted > 0) {
    console.log(`[perk] 生日礼扫描 ${year}-${mmdd}：主人 ${ownerGranted} 行 / 宠物 ${petGranted} 行`);
  }
  return { ownerGranted, petGranted };
}

/* ------------------------------------------------------------------ */
/* 内部服务：新人礼包（注册建档触发）/ 升级礼遇（首单 paid 触发）              */
/* ------------------------------------------------------------------ */

/**
 * 新人礼包：注册建档触发（devLogin 手机号建档处调用；发放=资格留痕不真发，
 * 候资质批——注释明面）。幂等锚 (user_id, kind='welcome_pack', source_id=user_id)
 * 先查后插：重复注册（同号再登录=不建档）/重放零重复。
 */
export async function grantWelcomePack(d: DbHandle, userId: string): Promise<void> {
  const r = await grantPerkIfAbsent(d, {
    userId,
    kind: 'welcome_pack',
    sourceId: userId,
    meta: { note: '新人礼包：注册资格留痕（真发候资质批）' },
  });
  if (!r.created) return;
  await insertMarketingNotification(d, {
    userId,
    type: 'perk.welcome_pack',
    title: '新人礼包已放入您的权益包',
    body: '欢迎加入菲丽亚！新人专属礼包已发放，到店出示会员码即可使用（以门店核销为准）',
  });
}

/**
 * 升级礼遇：商城订单 pending→paid 首单翻转点触发（payCallback 事务内调用，
 * 与订单翻转同生共死）。口径：本人首笔 paid 商城单触发一次（首单转化礼遇，
 * kind='upgrade_gift' 沿用台账枚举）；幂等=本人已有 upgrade_gift 行即跳过
 * （同人全场唯一——重复回调在订单层已被幂等闸拦，次单 paid 同锚不重复，
 * 双保险；source_id=首单 id 留痕溯源）。发放=资格留痕不真发（注释明面）。
 */
export async function grantFirstOrderGift(
  d: DbHandle,
  order: { id: string; customerId: string; storeId: string; orderNo: string },
): Promise<void> {
  /* 首单语义=同人唯一：按 (user_id, kind) 查存在性（source_id 逐单不同，不能入锚，
     否则次单会再发——e2e 68.4 实证），落行时 source_id=首单 id 留痕 */
  const existing = await d
    .select({ id: schema.memberPerkGrants.id })
    .from(schema.memberPerkGrants)
    .where(and(eq(schema.memberPerkGrants.userId, order.customerId), eq(schema.memberPerkGrants.kind, 'upgrade_gift')))
    .get();
  if (existing) return;
  await d.insert(schema.memberPerkGrants).values({
    userId: order.customerId,
    kind: 'upgrade_gift',
    sourceId: order.id,
    storeId: order.storeId,
    status: 'granted',
    meta: { note: '升级礼遇：首单 paid 资格留痕（真发候资质批）', orderNo: order.orderNo },
  });
  await insertMarketingNotification(d, {
    userId: order.customerId,
    type: 'perk.upgrade_gift',
    title: '升级礼遇已放入您的权益包',
    body: '首单达成！专属升级礼遇已发放，到店出示会员码即可使用（以门店核销为准）',
    link: '/member/perks',
  });
}

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

export const perkRouter = router({
  /**
   * myUnused（customer 本人）：未用权益包——
   * - passTimes：次卡剩余次数合计（active 且未过期的 member_pass Σ remain_times）；
   *   **并显不并账注记**：次卡次数与会员权益是两本账，本读口仅并列展示，
   *   不做任何合并折算（passNote 明面透出，UI 照读）；
   * - grants：member_perk_grants 本人 status='granted' 台账行（新→旧），
   *   次数型带 total/remain，资格型（生日/礼包）kind 即资格。
   */
  myUnused: customerProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const passes = await ctx.db
      .select({ remainTimes: schema.memberPasses.remainTimes })
      .from(schema.memberPasses)
      .where(
        and(
          eq(schema.memberPasses.userId, ctx.user.id),
          eq(schema.memberPasses.status, 'active'),
          sql`(${schema.memberPasses.expiresAt} IS NULL OR ${schema.memberPasses.expiresAt} > ${Math.floor(now.getTime() / 1000)})`,
        ),
      );
    const passTimes = passes.reduce((s, p) => s + p.remainTimes, 0);
    const grants = await ctx.db
      .select()
      .from(schema.memberPerkGrants)
      .where(
        and(
          eq(schema.memberPerkGrants.userId, ctx.user.id),
          eq(schema.memberPerkGrants.status, 'granted'),
        ),
      )
      .orderBy(desc(schema.memberPerkGrants.createdAt));
    return {
      passTimes,
      passNote: '次卡次数与会员权益分列展示、互不并账（两本账各算各的）',
      grants,
    };
  }),

  /**
   * consume（merchantManager 收银台核销写口 · 台账先行）：
   * - 次数型（remain_count 非空）：条件更新 remain_count>0 → -1，归零翻
   *   status='exhausted'（条件更新天然幂等防并发双扣）；
   * - 资格型（remain_count NULL，生日/礼包类）：granted→exhausted 一次性核销；
   * - 已核销/已作废重调 → 400 明文「该权益已核销或已作废」；
   * - 店域闸：grant.store_id 非空且非本店 → 403（NULL=全局资格放行）。
   * **本片不落真核销链**（与结账折扣/抵现联动候批）：仅台账核销留痕，
   * 不碰 cashier/orders/payments 任何钱域列——收银台结账链路调用点留
   * 注释明面（ cashier 结账事务处，本批不接线）。
   */
  consume: merchantManagerProcedure
    .input(z.object({ grantId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        const grant = await t
          .select()
          .from(schema.memberPerkGrants)
          .where(eq(schema.memberPerkGrants.id, input.grantId))
          .get();
        if (!grant) throw new TRPCError({ code: 'NOT_FOUND', message: '权益记录不存在' });
        if (grant.storeId && grant.storeId !== ctx.user.storeId) {
          forbidden('非本店发放的权益，无权核销');
        }
        if (grant.status !== 'granted') badRequest('该权益已核销或已作废，请勿重复操作');
        const now = new Date();
        if (grant.remainCount !== null) {
          /* 次数型：条件更新 remain_count>0 才扣（并发双扣天然免疫） */
          const updated = await t
            .update(schema.memberPerkGrants)
            .set({
              remainCount: sql`${schema.memberPerkGrants.remainCount} - 1`,
              status: grant.remainCount <= 1 ? 'exhausted' : 'granted',
              updatedAt: now,
            })
            .where(
              and(
                eq(schema.memberPerkGrants.id, grant.id),
                eq(schema.memberPerkGrants.status, 'granted'),
                sql`${schema.memberPerkGrants.remainCount} > 0`,
              ),
            )
            .returning();
          if (updated.length === 0) badRequest('该权益次数已用完');
          return { grant: updated[0]!, consumed: true as const };
        }
        /* 资格型：一次性核销（granted→exhausted） */
        const updated = await t
          .update(schema.memberPerkGrants)
          .set({ status: 'exhausted', updatedAt: now })
          .where(
            and(
              eq(schema.memberPerkGrants.id, grant.id),
              eq(schema.memberPerkGrants.status, 'granted'),
            ),
          )
          .returning();
        if (updated.length === 0) badRequest('该权益已核销或已作废，请勿重复操作');
        return { grant: updated[0]!, consumed: true as const };
      });
    }),
});

export type PerkRouter = typeof perkRouter;
