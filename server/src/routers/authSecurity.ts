/**
 * 账号安全 router（批次 R13a 大片 2 · server 侧）
 *
 * namespace authSecurity 端点：
 * - sendCode               换绑验证码发送（customer；60s 一码 + 日 10 码内存限流；
 *                          原号须=当前绑定号 / 新号撞号闸；内测回显 devCode）
 * - changePhone            本人双码自助换绑（customer；双码一次性验证 → 事务改号
 *                          + phone_change_logs('self') 留痕；返回 auth.me 同构——
 *                          会话载荷无 phone 字段，换绑后会话零丢失）
 * - deactivationPrecheck   注销前置阻断校验（customer；预约/订单/在途退款——
 *                          refund_requests 走表存在性守卫，见下「报备」）
 * - requestDeactivation    提交注销申请（customer；三项影响勾选缺一不可 + precheck
 *                          闸 + 在途幂等）
 * - cancelDeactivation     撤销注销申请（customer；仅 submitted 可撤）
 * - deactivationStatus     本人注销申请状态（customer；decideNote 客户端可见）
 * - reviewDeactivation     门店审批注销（manager|owner；approve=软注销事务：
 *                          deactivated_at 置位 + phone 释放 `_deact_<uid>_<原号>` +
 *                          回馈金清零（余额>0 才调 clearRebateAccount）+ 会员
 *                          active/frozen→cancelled（注销≠退会，不走折算退款——报备口径）
 *                          + pets 软删标记 + 申请单留痕；reject=note 必填）
 * - submitPhoneAppeal      换绑申诉提交（customer；原号一致闸 + 新号撞号闸 +
 *                          在途幂等；脱敏落表 + 时间线）
 * - appealStatus           本人申诉列表（customer）
 * - listPhoneAppeals       待审申诉队列（manager|owner；submitted 升序 + >24h SLA
 *                          超期标记，照 refund.pendingActual 工艺）
 * - reviewPhoneAppeal      门店审批申诉（manager|owner；approve=强制 note + 事务
 *                          改号（申诉通道无需原号验证码——原号已不可用即为本通道存在
 *                          意义）+ phone_change_logs('assisted', operator=审批人)；
 *                          reject=note 必填客户端可见）
 * - registerDevice         设备登记（customer；(user_id, device_id) 唯一 upsert，
 *                          客户端登录后静默调一次；片 1 起首见设备插入时落
 *                          security.newDevice outbox 事件 + security.new_device
 *                          站内信「新设备登录提醒」，同设备重登记零新增零通知）
 * - listDevices            本人设备倒序 + 换绑留痕记录（customer；设备页数据源）
 *
 * 报备项（冻结口径）：
 * 1. refund_requests 表存在性守卫：本基线 main@d3c5d24c 无 refund_requests 表
 *    （片1分支表）。precheck 先查 sqlite_master，表存在才查在途退款，不存在=跳过；
 *    集中合并后两片共存时守卫自然生效。在途状态集合按 'submitted'|'processing'|
 *    'approved' 口径（片1 表结构未知，按语义推断，合并时以片1 实际枚举校准）。
 * 2. phone_change_requests.new_phone 明文列：审批通过须把新号写回 users.phone，
 *    仅存 masked 无法执行——明文列仅为审批执行载荷，透出/日志全 masked。
 * 3. pets 软删=本批新增 deleted_at/delete_reason 两列（pets 原无状态列）；读侧
 *    不过滤（注销账号全接口 401 不可达，历史单据保留可见）。
 * 4. 注销=门店复核（merchantManagerProcedure）：注销语义为账号级非门店级，内测
 *    口径由店长本店/店主审批（店级过滤对账号级申请不适用，申诉/注销队列不做
 *    store_id 过滤——申请本身无门店维度）。
 * 5. phone 释放含 kimiId：D-16 自助开户渠道以 kimi_id=`phone:<手机号>` 为唯一键，
 *    注销审批对 phone: 前缀账号同步把 kimiId 改写为 `_deact_<uid>_<原值>`（否则
 *    同号重新注册撞 kimi_id UNIQUE——e2e 51.4 实证）；wx 渠道 wx_openid 不释放
 *    （wechat-mini 登录须命中原档明文拒「该账号已注销」）。
 */

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { client, schema } from '../db';
import { broadcastNow } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { clearRebateAccount } from '../services/rebate';
import { maskPhone } from '../services/phoneMask';
import { smsProvider } from '../services/sms';
import type { DbHandle } from '../services/xpAward';
import { customerProcedure, merchantManagerProcedure, router } from '../trpc';
import { storeDayStartMs, storeWallclock } from './appointment';

/** 事务 handle 类型断言（同 membership.ts/attendance.ts 惯例） */
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function tooMany(message: string): never {
  throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const phoneSchema = z.string().regex(/^1\d{10}$/, '手机号格式应为 11 位数字');

/* ------------------------------------------------------------------ */
/* 验证码：哈希 + 限流（内存 Map 固定窗 · 照核销防爆破工艺）                  */
/* ------------------------------------------------------------------ */

/** 验证码哈希盐（仓内常量，内测口径——生产应迁 env 并随真实短信通道一并评审） */
const VCODE_SALT = 'philia-beta-vcode-salt';
/** 验证码有效期：10 分钟（ms） */
const VCODE_TTL_MS = 10 * 60_000;
/** 最大验证尝试次数 */
const VCODE_MAX_ATTEMPTS = 5;
/** 同 phone+purpose 60s 一码 */
const VCODE_RESEND_INTERVAL_MS = 60_000;
/** 同 phone+purpose 日发送上限 */
const VCODE_DAILY_LIMIT = 10;

type VcodePurpose = 'change_bind_old' | 'change_bind_new';

function hashVcode(code: string, phone: string, purpose: string): string {
  return createHash('sha256').update(`${code}:${phone}:${purpose}:${VCODE_SALT}`).digest('hex');
}

interface VcodeRateState {
  /** 最近一次发送时间（ms epoch） */
  lastSentAt: number;
  /** 当日日期键（门店规范时区 +8，'YYYY-MM-DD'） */
  day: string;
  /** 当日已发次数 */
  dayCount: number;
}

/**
 * 单实例内存实现：进程内按 phone+purpose 计数。
 * 边界说明同核销防爆破（appointment.ts）：多实例部署需替换为共享实现（Redis 等）；
 * 当前服务端单实例满足内测需求。
 */
const vcodeRateMap = new Map<string, VcodeRateState>();

function vcodeDayKey(now: Date): string {
  const w = storeWallclock(now);
  return `${w.y}-${pad2(w.m)}-${pad2(w.day)}`;
}

function assertVcodeRateAllowed(phone: string, purpose: string): void {
  const now = Date.now();
  const key = `${phone}:${purpose}`;
  const st = vcodeRateMap.get(key);
  const day = vcodeDayKey(new Date(now));
  if (st && now - st.lastSentAt < VCODE_RESEND_INTERVAL_MS) {
    tooMany('发送过于频繁，请 60 秒后再试');
  }
  if (st && st.day === day && st.dayCount >= VCODE_DAILY_LIMIT) {
    tooMany('今日验证码发送次数已达上限（10 次），请明日再试');
  }
}

function recordVcodeSent(phone: string, purpose: string): void {
  const now = Date.now();
  const key = `${phone}:${purpose}`;
  const day = vcodeDayKey(new Date(now));
  const st = vcodeRateMap.get(key);
  vcodeRateMap.set(key, {
    lastSentAt: now,
    day,
    dayCount: st && st.day === day ? st.dayCount + 1 : 1,
  });
}

/** 仅供测试：清空验证码限流状态（e2e 场景隔离用，照 resetCheckinRateLimitForTest 工艺） */
export function resetVcodeRateLimitForTest(): void {
  vcodeRateMap.clear();
}

/**
 * 消费验证码（不公端，仅供 changePhone 等内部调用；可在事务内传 tx）：
 * 取该 phone+purpose 最新一条未使用码 → 过期/超限/错误逐一拦截（错误码计
 * attempts+1）→ 通过置 used_at（一次性）。
 */
async function consumeVerificationCode(
  d: DbHandle,
  phone: string,
  purpose: VcodePurpose,
  code: string,
): Promise<void> {
  const row = await d
    .select()
    .from(schema.verificationCodes)
    .where(
      and(
        eq(schema.verificationCodes.phone, phone),
        eq(schema.verificationCodes.purpose, purpose),
        isNull(schema.verificationCodes.usedAt),
      ),
    )
    .orderBy(desc(schema.verificationCodes.createdAt), desc(schema.verificationCodes.id))
    .limit(1)
    .then((r) => r[0]);
  if (!row) badRequest('验证码不存在或已使用，请重新获取');
  if (row.expiry <= Date.now()) badRequest('验证码已过期，请重新获取');
  if (row.attempts >= VCODE_MAX_ATTEMPTS) badRequest('验证码错误次数过多，请重新获取');
  const expected = Buffer.from(row.codeHash, 'utf8');
  const actual = Buffer.from(hashVcode(code, phone, purpose), 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await d
      .update(schema.verificationCodes)
      .set({ attempts: row.attempts + 1, updatedAt: new Date() })
      .where(eq(schema.verificationCodes.id, row.id));
    badRequest('验证码错误');
  }
  await d
    .update(schema.verificationCodes)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.verificationCodes.id, row.id));
}

/* ------------------------------------------------------------------ */
/* 共用闸                                                                */
/* ------------------------------------------------------------------ */

/** 新号撞号闸：不得与其他未注销用户的 phone 撞（已注销释放的 `_deact_` 后缀天然不算） */
async function assertNewPhoneAvailable(d: DbHandle, newPhone: string, selfUserId: string): Promise<void> {
  const clash = await d
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.phone, newPhone),
        isNull(schema.users.deactivatedAt),
        ne(schema.users.id, selfUserId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (clash) badRequest('该手机号已被其他账号使用');
}

/** 申诉单号日序发生器：PC-yyyymmdd-NNN（门店规范时区 +8 当日窗口 count+1；照 genBillNo/genRefundNo 模式） */
async function genPhoneChangeRequestNo(d: DbHandle, now: Date): Promise<string> {
  const w = storeWallclock(now);
  const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const row = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.phoneChangeRequests)
    .where(
      and(
        gte(schema.phoneChangeRequests.createdAt, dayStart),
        lt(schema.phoneChangeRequests.createdAt, dayEnd),
      ),
    )
    .get();
  const seq = Number(row?.n ?? 0) + 1;
  return `PC-${w.y}${pad2(w.m)}${pad2(w.day)}-${String(seq).padStart(3, '0')}`;
}

/** 注销阻断校验（deactivationPrecheck 与 requestDeactivation 共用） */
async function runDeactivationPrecheck(
  d: DbHandle,
  userId: string,
): Promise<Array<{ kind: 'appointment' | 'order' | 'refund'; label: string; count: number }>> {
  const items: Array<{ kind: 'appointment' | 'order' | 'refund'; label: string; count: number }> = [];
  const apptRow = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.customerId, userId),
        inArray(schema.appointments.status, [
          'pending',
          'confirmed',
          'in_service',
          'in_boarding',
          'cancel_requested',
        ]),
      ),
    )
    .get();
  const apptN = Number(apptRow?.n ?? 0);
  if (apptN > 0) items.push({ kind: 'appointment', label: '有未完成的预约', count: apptN });

  const orderRow = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.customerId, userId),
        inArray(schema.orders.status, ['pending', 'paid', 'shipped', 'refunding']),
      ),
    )
    .get();
  const orderN = Number(orderRow?.n ?? 0);
  if (orderN > 0) items.push({ kind: 'order', label: '有未完成的订单', count: orderN });

  /* 在途退款校验——表存在性守卫（报备①：refund_requests 为片1分支表，本基线 main
     无此表；sqlite_master 查表存在才查在途，不存在=跳过。集中合并后两片共存时
     守卫自然生效。原生 SQL 查询（schema 无该表定义），走 db 底层 client 只读。 */
  const tbl = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='refund_requests'",
  );
  if (tbl.rows.length > 0) {
    const r = await client.execute({
      sql: "SELECT COUNT(*) AS n FROM refund_requests WHERE customer_id = ? AND status IN ('submitted','processing','approved')",
      args: [userId],
    });
    const refundN = Number((r.rows[0] as { n?: number } | undefined)?.n ?? 0);
    if (refundN > 0) items.push({ kind: 'refund', label: '有在途的退款申请', count: refundN });
  }

  return items;
}

const IMPACTS_REQUIRED = ['rebate', 'member', 'pets'] as const;

export const authSecurityRouter = router({
  /* ---------------------------------------------------------------- */
  /* 换绑验证码                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * 发送换绑验证码（customer）：purpose=change_bind_old 时 phone 须=当前账号绑定号；
   * change_bind_new 时 phone 不得与其他未注销账号撞。限流：同 phone+purpose 60s
   * 一码、日 10 码。6 位数字码，sha256(code+phone+purpose+salt) 落表，10 分钟有效。
   * 内测（NODE_ENV≠production）响应回显 devCode；生产禁回显。
   */
  sendCode: customerProcedure
    .input(
      z.object({
        purpose: z.enum(['change_bind_old', 'change_bind_new']),
        phone: phoneSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await ctx.db
        .select({ phone: schema.users.phone })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .limit(1)
        .then((r) => r[0]);
      if (input.purpose === 'change_bind_old') {
        if (!me?.phone) badRequest('当前账号未绑定手机号，请走换绑申诉通道');
        if (input.phone !== me.phone) badRequest('手机号与当前账号绑定手机号不一致');
      } else {
        await assertNewPhoneAvailable(ctx.db, input.phone, ctx.user.id);
      }

      assertVcodeRateAllowed(input.phone, input.purpose);

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await ctx.db.insert(schema.verificationCodes).values({
        phone: input.phone,
        purpose: input.purpose,
        codeHash: hashVcode(code, input.phone, input.purpose),
        expiry: Date.now() + VCODE_TTL_MS,
      });
      recordVcodeSent(input.phone, input.purpose);

      const { devEcho } = await smsProvider.send(input.phone, input.purpose, code);
      return { ok: true as const, ttlSec: VCODE_TTL_MS / 1000, ...(devEcho ? { devCode: code } : {}) };
    }),

  /**
   * 本人双码自助换绑（customer）：oldCode（原号 change_bind_old）+ newCode（新号
   * change_bind_new）双码一次性验证 → 事务：users.phone=newPhone +
   * phone_change_logs('self') 留痕（脱敏）。返回 auth.me 同构结构——会话 cookie
   * 载荷 {uid,kimiId,iat,exp} 无 phone 字段，换绑后原会话自然延续零丢失。
   */
  changePhone: customerProcedure
    .input(
      z.object({
        oldCode: z.string().regex(/^\d{6}$/, '验证码应为 6 位数字'),
        newPhone: phoneSchema,
        newCode: z.string().regex(/^\d{6}$/, '验证码应为 6 位数字'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await ctx.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .limit(1)
        .then((r) => r[0]);
      if (!me?.phone) badRequest('当前账号未绑定手机号，请走换绑申诉通道');
      if (input.newPhone === me.phone) badRequest('新手机号不得与当前绑定手机号相同');
      await assertNewPhoneAvailable(ctx.db, input.newPhone, ctx.user.id);

      const oldPhone = me.phone;
      await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        const now = new Date();
        await consumeVerificationCode(t, oldPhone, 'change_bind_old', input.oldCode);
        await consumeVerificationCode(t, input.newPhone, 'change_bind_new', input.newCode);
        await t
          .update(schema.users)
          .set({ phone: input.newPhone, updatedAt: now })
          .where(eq(schema.users.id, ctx.user.id));
        await t.insert(schema.phoneChangeLogs).values({
          userId: ctx.user.id,
          oldPhoneMasked: maskPhone(oldPhone),
          newPhoneMasked: maskPhone(input.newPhone),
          channel: 'self',
          operatorId: null,
          at: now,
        });
      });

      /* auth.me 同构返回（user + roles + staff + store） */
      const user = await ctx.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .limit(1)
        .then((r) => r[0]);
      const staffRow = ctx.user.staffId
        ? await ctx.db
            .select()
            .from(schema.staff)
            .where(eq(schema.staff.id, ctx.user.staffId))
            .limit(1)
            .then((r) => r[0])
        : undefined;
      const storeId = ctx.user.storeId ?? staffRow?.storeId;
      const storeRow = storeId
        ? await ctx.db
            .select()
            .from(schema.stores)
            .where(eq(schema.stores.id, storeId))
            .limit(1)
            .then((r) => r[0])
        : undefined;
      return { user, roles: ctx.user.roles, staff: staffRow ?? null, store: storeRow ?? null };
    }),

  /* ---------------------------------------------------------------- */
  /* 注销流                                                             */
  /* ---------------------------------------------------------------- */

  /** 注销前置校验（customer）：返回阻断清单；可注销=清单空 */
  deactivationPrecheck: customerProcedure.query(async ({ ctx }) => {
    const blockers = await runDeactivationPrecheck(ctx.db, ctx.user.id);
    return { blockers, deactivatable: blockers.length === 0 };
  }),

  /**
   * 提交注销申请（customer）：三项影响勾选（rebate/member/pets）缺一不可（服务端
   * 强校验）→ 重跑 precheck 闸（有阻断拒绝）→ 写申请单（checklist/impacts 快照）。
   * 本人已有在途（submitted）=幂等返回现状，不重复建行。
   */
  requestDeactivation: customerProcedure
    .input(z.object({ impacts: z.array(z.enum(IMPACTS_REQUIRED)).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const impacts = [...new Set(input.impacts)].sort();
      if (impacts.length !== IMPACTS_REQUIRED.length || ![...IMPACTS_REQUIRED].sort().every((k, i) => impacts[i] === k)) {
        badRequest('请完整勾选三项影响确认（回馈金清零 / 会员终止 / 宠物档案删除）后再提交');
      }
      const blockers = await runDeactivationPrecheck(ctx.db, ctx.user.id);
      if (blockers.length > 0) {
        badRequest(`存在注销阻断项：${blockers.map((b) => `${b.label}（${b.count}）`).join('、')}，请先处理后再申请`);
      }
      const existing = await ctx.db
        .select()
        .from(schema.deactivationRequests)
        .where(
          and(
            eq(schema.deactivationRequests.userId, ctx.user.id),
            eq(schema.deactivationRequests.status, 'submitted'),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (existing) return { request: existing, idempotent: true as const };
      const inserted = await ctx.db
        .insert(schema.deactivationRequests)
        .values({
          userId: ctx.user.id,
          checklistJson: blockers, // 阻断校验快照（放行时恒为空清单）
          impactsJson: impacts,
        })
        .returning()
        .then((r) => r[0]!);
      return { request: inserted, idempotent: false as const };
    }),

  /** 撤销注销申请（customer）：仅 submitted 可撤（幂等——非在途单如实报错） */
  cancelDeactivation: customerProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db
      .select()
      .from(schema.deactivationRequests)
      .where(
        and(
          eq(schema.deactivationRequests.userId, ctx.user.id),
          eq(schema.deactivationRequests.status, 'submitted'),
        ),
      )
      .limit(1)
      .then((r) => r[0]);
    if (!existing) badRequest('当前无在途注销申请');
    const now = new Date();
    const updated = await ctx.db
      .update(schema.deactivationRequests)
      .set({ status: 'cancelled', decidedAt: now, updatedAt: now })
      .where(eq(schema.deactivationRequests.id, existing.id))
      .returning()
      .then((r) => r[0]!);
    return { request: updated };
  }),

  /** 本人注销申请状态（customer）：在途优先，否则最近一条（decideNote 客户端可见） */
  deactivationStatus: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.deactivationRequests)
      .where(eq(schema.deactivationRequests.userId, ctx.user.id))
      .orderBy(desc(schema.deactivationRequests.createdAt), desc(schema.deactivationRequests.id));
    const inflight = rows.find((r) => r.status === 'submitted') ?? null;
    return { inflight, latest: rows[0] ?? null };
  }),

  /**
   * 门店审批注销（manager|owner · 内测=门店复核口径，报备④）：
   * approve 事务：①users.deactivated_at=now + reason=note ②phone 释放
   * `_deact_<userId>_<原phone>`（如有）③回馈金清零（余额>0 才调 clearRebateAccount，
   * clear 行前后值留痕）④memberships active/frozen→cancelled（不走折算退款——
   * 注销≠退会，报备口径）⑤pets 软删标记（deleted_at + 原因「账号注销」）⑥申请单
   * approved 留痕。reject=note 必填（客户端可见）。
   */
  reviewDeactivation: merchantManagerProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        approve: z.boolean(),
        note: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.approve && !input.note?.trim()) {
        badRequest('驳回原因必填（客户端可见）');
      }
      const req = await ctx.db
        .select()
        .from(schema.deactivationRequests)
        .where(eq(schema.deactivationRequests.id, input.requestId))
        .limit(1)
        .then((r) => r[0]);
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '注销申请不存在' });
      if (req.status !== 'submitted') badRequest('该申请已处理，不可重复审批');
      const now = new Date();

      if (!input.approve) {
        const updated = await ctx.db
          .update(schema.deactivationRequests)
          .set({
            status: 'rejected',
            approverId: ctx.user.id,
            decidedAt: now,
            decideNote: input.note!.trim(),
            updatedAt: now,
          })
          .where(eq(schema.deactivationRequests.id, req.id))
          .returning()
          .then((r) => r[0]!);
        return { request: updated };
      }

      const target = await ctx.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, req.userId))
        .limit(1)
        .then((r) => r[0]);
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: '申请用户不存在' });

      const result = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        // ① 软注销置位 + ② phone 释放（同号可重新注册建档，与原账号互不可见）；
        //    D-16 自助开户渠道以 kimi_id=`phone:<手机号>` 为唯一键，phone: 前缀
        //    账号的 kimiId 同步释放（否则同号重新注册撞 kimi_id UNIQUE——e2e 实证；
        //    报备⑤）。wx 渠道 wx_openid 不释放（wechat-mini 登录须命中原档明文拒）。
        await t
          .update(schema.users)
          .set({
            deactivatedAt: now,
            deactivateReason: input.note?.trim() || null,
            ...(target.phone ? { phone: `_deact_${target.id}_${target.phone}` } : {}),
            ...(target.kimiId.startsWith('phone:') ? { kimiId: `_deact_${target.id}_${target.kimiId}` } : {}),
            updatedAt: now,
          })
          .where(eq(schema.users.id, target.id));
        // ③ 回馈金清零（余额>0 才调；clear 行前后值留痕，sourceId=申请单 id）
        const acc = await t
          .select({ balanceFen: schema.rebateAccounts.balanceFen })
          .from(schema.rebateAccounts)
          .where(eq(schema.rebateAccounts.userId, target.id))
          .limit(1)
          .then((r) => r[0]);
        let clearedRebateFen = 0;
        if (acc && acc.balanceFen > 0) {
          const cleared = await clearRebateAccount(t, {
            userId: target.id,
            sourceId: req.id,
            now,
            note: '账号注销清零（回馈金余额清零——注销≠退会，不走折算退款）',
          });
          clearedRebateFen = cleared.clearedFen;
        }
        // ④ 会员终止（active/frozen→cancelled；不退折算款——注销≠退会报备口径）
        await t
          .update(schema.memberships)
          .set({
            status: 'cancelled',
            cancelledAt: now,
            cancelReason: '账号注销（注销≠退会，不走折算退款）',
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.memberships.userId, target.id),
              inArray(schema.memberships.status, ['active', 'frozen']),
            ),
          );
        // ⑤ pets 软删标记（本批新增 deleted_at/delete_reason 列；读侧不过滤报备③）
        await t
          .update(schema.pets)
          .set({ deletedAt: now, deleteReason: '账号注销', updatedAt: now })
          .where(and(eq(schema.pets.ownerId, target.id), isNull(schema.pets.deletedAt)));
        // ⑥ 申请单 approved 留痕
        const updated = await t
          .update(schema.deactivationRequests)
          .set({
            status: 'approved',
            approverId: ctx.user.id,
            decidedAt: now,
            decideNote: input.note?.trim() || null,
            updatedAt: now,
          })
          .where(eq(schema.deactivationRequests.id, req.id))
          .returning()
          .then((r) => r[0]!);
        return { request: updated, clearedRebateFen };
      });
      return result;
    }),

  /* ---------------------------------------------------------------- */
  /* 换绑申诉                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * 提交换绑申诉（customer）：原号=当前账号 phone 一致闸；新号撞号闸；masked 落表
   * + 时间线（submitted）。本人在途（submitted）申诉=幂等返回现状。
   */
  submitPhoneAppeal: customerProcedure
    .input(
      z.object({
        oldPhone: phoneSchema,
        newPhone: phoneSchema,
        photoUrls: z.array(z.string().min(1)).max(9).optional(),
        note: z.string().min(1, '申诉说明必填').max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await ctx.db
        .select({ phone: schema.users.phone })
        .from(schema.users)
        .where(eq(schema.users.id, ctx.user.id))
        .limit(1)
        .then((r) => r[0]);
      if (!me?.phone || input.oldPhone !== me.phone) {
        badRequest('原手机号与当前账号绑定手机号不一致');
      }
      if (input.newPhone === me.phone) badRequest('新手机号不得与当前绑定手机号相同');
      await assertNewPhoneAvailable(ctx.db, input.newPhone, ctx.user.id);

      const existing = await ctx.db
        .select()
        .from(schema.phoneChangeRequests)
        .where(
          and(
            eq(schema.phoneChangeRequests.userId, ctx.user.id),
            eq(schema.phoneChangeRequests.status, 'submitted'),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (existing) return { request: existing, idempotent: true as const };

      const now = new Date();
      const requestNo = await genPhoneChangeRequestNo(ctx.db, now);
      const inserted = await ctx.db
        .insert(schema.phoneChangeRequests)
        .values({
          requestNo,
          userId: ctx.user.id,
          oldPhoneMasked: maskPhone(input.oldPhone),
          newPhoneMasked: maskPhone(input.newPhone),
          newPhone: input.newPhone, // 审批执行载荷（报备②；透出侧 masked）
          photoUrls: input.photoUrls ?? [],
          note: input.note,
          timelineJson: [{ at: now.toISOString(), action: 'submitted', by: ctx.user.id, note: input.note }],
        })
        .returning()
        .then((r) => r[0]!);
      return { request: inserted, idempotent: false as const };
    }),

  /** 本人申诉列表（customer；createdAt 倒序，decideNote 客户端可见） */
  appealStatus: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.phoneChangeRequests)
      .where(eq(schema.phoneChangeRequests.userId, ctx.user.id))
      .orderBy(desc(schema.phoneChangeRequests.createdAt), desc(schema.phoneChangeRequests.id));
    return { items: rows };
  }),

  /**
   * 待审申诉队列（manager|owner）：submitted 升序（先提先审）+ SLA 超期标记
   * （createdAt 距今 >24h → slaBreached=true；照 refund.pendingActual 工艺）。
   */
  listPhoneAppeals: merchantManagerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.phoneChangeRequests)
      .where(eq(schema.phoneChangeRequests.status, 'submitted'))
      .orderBy(schema.phoneChangeRequests.createdAt);
    const now = Date.now();
    return {
      items: rows.map((r) => {
        const { newPhone: _omitPlain, ...rest } = r; // 明文列不透出（报备②；masked 列已足够展示）
        void _omitPlain;
        return { ...rest, slaBreached: now - r.createdAt.getTime() > 24 * 3600 * 1000 };
      }),
    };
  }),

  /**
   * 门店审批申诉（manager|owner）：approve=强制 note（留痕）+ 事务①users.phone=
   * newPhone（原号此时失效无需验证码——申诉通道即为此而设）②phone_change_logs
   * ('assisted', operatorId=审批人) ③申请单 approved+时间线。reject=note 必填
   * 客户端可见。
   */
  reviewPhoneAppeal: merchantManagerProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        approve: z.boolean(),
        note: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.note?.trim()) {
        badRequest(input.approve ? '通过审批须填写备注（留痕）' : '驳回原因必填（客户端可见）');
      }
      const req = await ctx.db
        .select()
        .from(schema.phoneChangeRequests)
        .where(eq(schema.phoneChangeRequests.id, input.requestId))
        .limit(1)
        .then((r) => r[0]);
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '申诉单不存在' });
      if (req.status !== 'submitted') badRequest('该申诉已处理，不可重复审批');
      const now = new Date();
      const note = input.note!.trim();

      if (!input.approve) {
        const updated = await ctx.db
          .update(schema.phoneChangeRequests)
          .set({
            status: 'rejected',
            approverId: ctx.user.id,
            decidedAt: now,
            decideNote: note,
            timelineJson: [...req.timelineJson, { at: now.toISOString(), action: 'rejected', by: ctx.user.id, note }],
            updatedAt: now,
          })
          .where(eq(schema.phoneChangeRequests.id, req.id))
          .returning()
          .then((r) => r[0]!);
        return { request: updated };
      }

      // 审批时点重跑撞号闸（提交后新号可能已被其他账号占用）
      await assertNewPhoneAvailable(ctx.db, req.newPhone, req.userId);

      const result = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        await t
          .update(schema.users)
          .set({ phone: req.newPhone, updatedAt: now })
          .where(eq(schema.users.id, req.userId));
        await t.insert(schema.phoneChangeLogs).values({
          userId: req.userId,
          oldPhoneMasked: req.oldPhoneMasked,
          newPhoneMasked: req.newPhoneMasked,
          channel: 'assisted',
          operatorId: ctx.user.id,
          at: now,
        });
        const updated = await t
          .update(schema.phoneChangeRequests)
          .set({
            status: 'approved',
            approverId: ctx.user.id,
            decidedAt: now,
            decideNote: note,
            timelineJson: [...req.timelineJson, { at: now.toISOString(), action: 'approved', by: ctx.user.id, note }],
            updatedAt: now,
          })
          .where(eq(schema.phoneChangeRequests.id, req.id))
          .returning()
          .then((r) => r[0]!);
        return { request: updated };
      });
      return result;
    }),

  /* ---------------------------------------------------------------- */
  /* 设备登记                                                           */
  /* ---------------------------------------------------------------- */

  /** 设备登记（customer）：(user_id, device_id) 唯一 upsert，lastSeenAt=now；客户端登录后静默调一次。
   *  片 1 异常登录提醒：首见设备（插入新行）→ event_outbox 落 security.newDevice 事件（user 频道，
   *  提交后 broadcastNow）+ notifications 落行（type='security.new_device'，link='/settings/devices'，
   *  「新设备登录提醒」）。同设备重登记=零新增零通知（既有幂等语义不动）。
   *  注：事件类型枚举（security.newDevice）与站内信 type（security.new_device）两族口径不同，
   *  emitEvent 的通知 type 恒=eventType 无法表达异构，故照 announce.ts 手动落行工艺同事务手写两步。 */
  registerDevice: customerProcedure
    .input(z.object({ deviceId: z.string().min(1).max(128), label: z.string().max(64).optional() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const existing = await ctx.db
        .select()
        .from(schema.userDevices)
        .where(
          and(
            eq(schema.userDevices.userId, ctx.user.id),
            eq(schema.userDevices.deviceId, input.deviceId),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (existing) {
        const updated = await ctx.db
          .update(schema.userDevices)
          .set({
            lastSeenAt: now,
            ...(input.label !== undefined ? { label: input.label } : {}),
            updatedAt: now,
          })
          .where(eq(schema.userDevices.id, existing.id))
          .returning()
          .then((r) => r[0]!);
        return { device: updated, created: false as const };
      }
      let outboxId = '';
      const inserted = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .insert(schema.userDevices)
          .values({
            userId: ctx.user.id,
            deviceId: input.deviceId,
            label: input.label ?? null,
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .returning()
          .then((r) => r[0]!);
        // 首见设备=异常登录提醒（片 1）：outbox 事件 + 站内信同事务落行
        const ob = await tx
          .insert(schema.eventOutbox)
          .values({
            channel: `user:${ctx.user.id}`,
            eventType: EventType.SecurityNewDevice,
            payload: { userId: ctx.user.id, deviceId: input.deviceId, label: input.label ?? null },
          })
          .returning({ id: schema.eventOutbox.id });
        outboxId = ob[0]!.id;
        await tx.insert(schema.notifications).values({
          userId: ctx.user.id,
          type: 'security.new_device',
          category: 'account',
          title: '新设备登录提醒',
          body: `您的账号在新设备${input.label ? `「${input.label}」` : ''}上登录，如非本人操作请及时修改密码或联系门店`,
          link: '/settings/devices',
        });
        return row;
      });
      broadcastNow(outboxId);
      return { device: inserted, created: true as const };
    }),

  /** 本人设备倒序（lastSeenAt desc）+ 换绑留痕记录（at desc）——设备页数据源 */
  listDevices: customerProcedure.query(async ({ ctx }) => {
    const devices = await ctx.db
      .select()
      .from(schema.userDevices)
      .where(eq(schema.userDevices.userId, ctx.user.id))
      .orderBy(desc(schema.userDevices.lastSeenAt));
    const phoneChangeLogs = await ctx.db
      .select({
        id: schema.phoneChangeLogs.id,
        oldPhoneMasked: schema.phoneChangeLogs.oldPhoneMasked,
        newPhoneMasked: schema.phoneChangeLogs.newPhoneMasked,
        channel: schema.phoneChangeLogs.channel,
        at: schema.phoneChangeLogs.at,
      })
      .from(schema.phoneChangeLogs)
      .where(eq(schema.phoneChangeLogs.userId, ctx.user.id))
      .orderBy(desc(schema.phoneChangeLogs.at));
    return { devices, phoneChangeLogs };
  }),
});

export type AuthSecurityRouter = typeof authSecurityRouter;
