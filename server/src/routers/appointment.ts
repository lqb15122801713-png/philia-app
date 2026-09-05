/**
 * appointment router（T1.3a · coder-appt 名下文件，见 CONTRACTS.md）
 *
 * 预约全生命周期，服务端强校验（前端只做引导）：
 *   create → confirm → assign → checkin（二维码 / 6 位人工码）→ 六步流 / 寄养（T1.3b/c）
 *   → completed → markPaid（到店付收款登记）/ review（评价）
 *   取消：开始前 >4h 直接取消并回减槽位；≤4h 转 cancel_requested 由商家 reviewCancel 审批。
 *
 * 关键规则落点：
 * - 占座防超卖（§3.1 序 1）：create 事务内 UPSERT store_slots 行并校验
 *   booked_count < capacity 后 +1。SQLite 单写者模型下事务即行锁（等价
 *   SELECT ... FOR UPDATE），保留事务结构，未来切 MySQL 语义直接成立。
 * - 预约码（§3.3）：二维码 payload { v:2, aid, tw, exp, sig }，
 *   sig = HMAC_SHA256(`${aid}|${tw}|${exp}`, BOOKING_CODE_SECRET)；tw 为 5min 滚动
 *   时间窗编号，验签接受当前窗口与上一窗口；exp = scheduled_start + 4h（覆盖迟到）。
 * - 核销（§3.3）：状态 confirmed + 门店归属 + 核销归属（已指派仅本人；未指派同事务
 *   认领写入 staff_id 并补发 appointment.assigned）+ 幂等（checked_in_at 已存在直接
 *   返回当前进度）+ 防爆破限流（每员工每分钟失败 ≤5 次，超限锁 10 分钟；内存 Map
 *   单实例实现——多实例部署时需替换为 Redis 等共享存储，P1 单实例边界见下）。
 * - type 分支（§3.1 序 5）：grooming → in_service + 事务内初始化 6 条
 *   appointment_steps（step1 disinfection=active，2-6=locked，required_photos
 *   快照 min 值 1/2/3/2/2/0）；boarding → in_boarding + 建 boarding_stays
 *   （room_no 可空待登记，不初始化六步）。
 * - 事件（契约 2）：业务写库与 emitEvent 同事务，事务提交后 broadcastNow。
 */

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import {
  assertAppointmentAccess,
  customerProcedure,
  merchantProcedure,
  publicProcedure,
  router,
  staffProcedure,
  type AppointmentRow,
} from '../trpc';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';

/* ------------------------------------------------------------------ */
/* 常量与类型                                                            */
/* ------------------------------------------------------------------ */

/** 预约状态取值（schema text 列的应用层枚举） */
const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'in_service',
  'in_boarding',
  'completed',
  'cancel_requested',
  'cancelled',
] as const;
type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** 6 位人工核销码字符集：去除易混淆字符 0/O/1/I/L */
const MANUAL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const MANUAL_CODE_RE = /^[2-9A-HJKMNP-Z]{6}$/;

/** 二维码滚动时间窗粒度（秒）：5 分钟（§3.3） */
export const CODE_WINDOW_SEC = 300;
/** 二维码过期：预约开始 + 4h（覆盖迟到场景） */
const CODE_EXP_AFTER_START_SEC = 4 * 3600;
/**
 * HMAC 密钥：生产环境必须经 BOOKING_CODE_SECRET 注入；
 * 缺省值仅供本地开发/冒烟，绝不用于生产。
 */
const BOOKING_CODE_SECRET = process.env.BOOKING_CODE_SECRET ?? 'philia-dev-booking-code-secret';

/** 客户免费取消阈值：开始前 4 小时（§3.1 取消/改期规则） */
const CANCEL_FREE_BEFORE_SEC = 4 * 3600;

/** 洗护六步定义（§3.2：step_key 固定枚举、顺序不可变；required_photos 快照 min 值） */
const GROOMING_STEPS = [
  { stepKey: 'disinfection', stepOrder: 1, requiredPhotos: 1 },
  { stepKey: 'precheck', stepOrder: 2, requiredPhotos: 2 },
  { stepKey: 'grooming', stepOrder: 3, requiredPhotos: 3 },
  { stepKey: 'detail', stepOrder: 4, requiredPhotos: 2 },
  { stepKey: 'before_after', stepOrder: 5, requiredPhotos: 2 },
  { stepKey: 'confirm', stepOrder: 6, requiredPhotos: 0 },
] as const;

/**
 * 服务大类 → 可承接的技能标签（满足其一即可）。
 * 技能词表见种子数据：wash / groom / boarding。
 * grooming 单 wash 或 groom 任一即可；boarding 单必须持 boarding 技能。
 */
const TYPE_ACCEPT_SKILLS: Record<'grooming' | 'boarding', string[]> = {
  grooming: ['wash', 'groom'],
  boarding: ['boarding'],
};

/** store_slots UPSERT 新行时的默认容量（与种子数据 capacity=2 对齐） */
const DEFAULT_SLOT_CAPACITY = 2;

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

type StoreRow = typeof schema.stores.$inferSelect;
type StaffRow = typeof schema.staff.$inferSelect;
type StepRow = typeof schema.appointmentSteps.$inferSelect;
type BoardingStayRow = typeof schema.boardingStays.$inferSelect;

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const pad2 = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// 注意：必须用 function 声明（而非箭头函数常量），TS 才会把「返回 never 的调用」
// 当作控制流终止点，从而在 if (!x) badRequest(...) 之后正确收窄 x 为非空。
function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

/* ------------------------------------------------------------------ */
/* 预约码（§3.3）：签名 / 验签（纯函数，供 checkin 与冒烟复用）            */
/* ------------------------------------------------------------------ */

/** 二维码 payload（v2 滚动时间窗版） */
export interface BookingCodePayload {
  v: 2;
  /** 预约 ID */
  aid: string;
  /** 滚动时间窗编号 = floor(unix秒 / 300) */
  tw: number;
  /** 过期时间（Unix 秒）= 预约开始 + 4h */
  exp: number;
  /** HMAC-SHA256(`${aid}|${tw}|${exp}`) hex */
  sig: string;
}

/** 计算预约码签名（hex） */
export function signCode(aid: string, tw: number, exp: number): string {
  return createHmac('sha256', BOOKING_CODE_SECRET).update(`${aid}|${tw}|${exp}`).digest('hex');
}

/**
 * 验签（纯函数）：
 * - 结构校验（v=2，aid/tw/exp/sig 形态合法）；
 * - exp 未过（nowSec <= exp）；
 * - 滚动时间窗：payload.tw 必须为当前窗口或上一窗口（floor(nowSec/300) 与其 -1），
 *   并以 payload.tw 重算 sig 做常量时间比对——截图转发最快 5 分钟后必然失效。
 */
export function verifyCode(payload: unknown, nowSec: number): payload is BookingCodePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (p.v !== 2) return false;
  if (typeof p.aid !== 'string' || p.aid.length === 0) return false;
  if (typeof p.tw !== 'number' || !Number.isInteger(p.tw)) return false;
  if (typeof p.exp !== 'number' || !Number.isInteger(p.exp)) return false;
  if (typeof p.sig !== 'string' || !/^[0-9a-f]{64}$/.test(p.sig)) return false;
  if (p.exp < nowSec) return false; // 已过期
  const cur = Math.floor(nowSec / CODE_WINDOW_SEC);
  if (p.tw !== cur && p.tw !== cur - 1) return false; // 仅接受当前 / 上一窗口
  const expected = Buffer.from(signCode(p.aid, p.tw, p.exp), 'utf8');
  const actual = Buffer.from(p.sig, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** 生成 6 位人工核销码（去混淆字符集） */
function genManualCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += MANUAL_CODE_ALPHABET[randomInt(MANUAL_CODE_ALPHABET.length)];
  return s;
}

/* ------------------------------------------------------------------ */
/* 核销防爆破限流（内存 Map · 单实例边界）                                 */
/* ------------------------------------------------------------------ */

const CHECKIN_FAIL_LIMIT = 5; // 每员工每分钟失败上限
const CHECKIN_FAIL_WINDOW_MS = 60_000;
const CHECKIN_LOCK_MS = 10 * 60_000;

interface CheckinFailState {
  /** 最近一分钟内的失败时间戳（ms） */
  fails: number[];
  /** 锁定截止（ms epoch）；0 = 未锁定 */
  lockedUntil: number;
}

/**
 * 单实例内存实现：进程内按 staffId 计数。
 * 边界说明：多实例/多进程部署时各实例计数互不可见，需替换为 Redis INCR+EXPIRE
 * 之类的共享实现；P1 阶段服务端为单实例（见开发方案部署章），此处满足需求。
 */
const checkinFailMap = new Map<string, CheckinFailState>();

function assertCheckinNotLocked(staffId: string): void {
  const st = checkinFailMap.get(staffId);
  if (st && st.lockedUntil > Date.now()) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: '核销失败次数过多，已锁定 10 分钟，请稍后再试',
    });
  }
}

function recordCheckinFailure(staffId: string): void {
  const now = Date.now();
  const st = checkinFailMap.get(staffId) ?? { fails: [], lockedUntil: 0 };
  st.fails = st.fails.filter((t) => now - t < CHECKIN_FAIL_WINDOW_MS);
  st.fails.push(now);
  if (st.fails.length >= CHECKIN_FAIL_LIMIT) st.lockedUntil = now + CHECKIN_LOCK_MS;
  checkinFailMap.set(staffId, st);
}

function clearCheckinFailures(staffId: string): void {
  checkinFailMap.delete(staffId);
}

/** 仅供测试：清空限流状态（冒烟脚本用于场景隔离） */
export function resetCheckinRateLimitForTest(): void {
  checkinFailMap.clear();
}

/* ------------------------------------------------------------------ */
/* 内部工具                                                              */
/* ------------------------------------------------------------------ */

async function getAppointmentOrThrow(d: DbHandle, id: string): Promise<AppointmentRow> {
  const row = await d
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
  return row;
}

async function petNameOf(d: DbHandle, petId: string): Promise<string | undefined> {
  const r = await d
    .select({ name: schema.pets.name })
    .from(schema.pets)
    .where(eq(schema.pets.id, petId))
    .get();
  return r?.name;
}

/** 取消时回减槽位占用（槽位行不存在或已为 0 则不动，幂等安全） */
async function releaseSlot(tx: DbHandle, storeId: string, slotStart: Date): Promise<void> {
  const slot = await tx
    .select()
    .from(schema.storeSlots)
    .where(and(eq(schema.storeSlots.storeId, storeId), eq(schema.storeSlots.slotStart, slotStart)))
    .get();
  if (slot && slot.bookedCount > 0) {
    await tx
      .update(schema.storeSlots)
      .set({ bookedCount: slot.bookedCount - 1, updatedAt: new Date() })
      .where(eq(schema.storeSlots.id, slot.id));
  }
}

/** 营业时间校验：开始时间须在未来、按 30min 粒度对齐、落在当日营业区间内；grooming 还要求当日打烊前服务得完 */
function assertBookableTime(
  store: StoreRow,
  type: 'grooming' | 'boarding',
  start: Date,
  end: Date,
): void {
  if (start.getTime() <= Date.now()) badRequest('预约时间必须晚于当前时间');
  if (end.getTime() <= start.getTime()) badRequest('结束时间必须晚于开始时间');
  if (start.getSeconds() !== 0 || start.getMilliseconds() !== 0 || start.getMinutes() % 30 !== 0) {
    badRequest('预约开始时间须按 30 分钟粒度对齐（如 10:00 / 10:30）');
  }
  const day = DAY_KEYS[start.getDay()]!;
  const hours = store.openHours?.[day];
  if (!hours) badRequest('门店当日休息，不可预约');
  const startMin = start.getHours() * 60 + start.getMinutes();
  const [oh = 0, om = 0] = hours.open.split(':').map(Number);
  const [ch = 0, cm = 0] = hours.close.split(':').map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (startMin < openMin || startMin >= closeMin) {
    badRequest(`预约时间不在门店营业时间（${hours.open}-${hours.close}）内`);
  }
  if (type === 'grooming') {
    const durMin = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (startMin + durMin > closeMin) badRequest('服务时长超出当日打烊时间，请改约更早时段');
  }
}

/** 排班校验：预约开始时间须落在员工当日排班区间内 */
function assertWithinSchedule(staffRow: StaffRow, start: Date): void {
  const day = DAY_KEYS[start.getDay()]!;
  const ranges = staffRow.schedule?.[day];
  if (!ranges || ranges.length === 0) badRequest('该员工在预约当日无排班');
  const t = hhmm(start);
  if (!ranges.some((r) => r.start <= t && t < r.end)) {
    badRequest('预约时间不在该员工排班时段内');
  }
}

/** 核销后的当前进度（幂等重扫与正常核销返回同构数据） */
async function progressOf(
  d: DbHandle,
  appt: AppointmentRow,
): Promise<{ steps: StepRow[]; boardingStay: BoardingStayRow | null }> {
  const steps =
    appt.type === 'grooming'
      ? await d
          .select()
          .from(schema.appointmentSteps)
          .where(eq(schema.appointmentSteps.appointmentId, appt.id))
          .orderBy(asc(schema.appointmentSteps.stepOrder))
      : [];
  const boardingStay =
    appt.type === 'boarding'
      ? ((await d
          .select()
          .from(schema.boardingStays)
          .where(eq(schema.boardingStays.appointmentId, appt.id))
          .get()) ?? null)
      : null;
  return { steps, boardingStay };
}

/** 核销后员工端跳转路由（§3.1 序 5） */
const nextRouteOf = (appt: AppointmentRow): string =>
  appt.type === 'grooming' ? `/execute/${appt.id}` : `/boarding/${appt.id}/checkin`;

/** 列表项：预约行 + 关联名称（客户端列表直显用） */
type ListItem = AppointmentRow & {
  petName: string | null;
  serviceName: string | null;
  storeName?: string | null;
  staffName?: string | null;
};

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

export const appointmentRouter = router({
  /**
   * 1. create（customer）：宠物归属 / 服务项有效且 type 一致 / 门店营业时间内 /
   * payment_mode 快照；事务内 UPSERT store_slots 占位（防超卖）+ 建 pending 预约
   * （生成 6 位人工核销码）+ emitEvent(store, appointment.created)。
   */
  create: customerProcedure
    .input(
      z.object({
        storeId: z.string().min(1),
        petId: z.string().min(1),
        serviceId: z.string().min(1),
        type: z.enum(['grooming', 'boarding']),
        scheduledStart: z.date(),
        scheduledEnd: z.date().optional(),
        paymentMode: z.enum(['pay_at_store', 'pass_deduct']),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      /* ---- 校验 1：宠物归属本人 ---- */
      const pet = await ctx.db
        .select()
        .from(schema.pets)
        .where(eq(schema.pets.id, input.petId))
        .get();
      if (!pet) throw new TRPCError({ code: 'NOT_FOUND', message: '宠物不存在' });
      if (pet.ownerId !== ctx.user.id) forbidden('只能为本人名下的宠物预约');

      /* ---- 校验 2：门店有效且在营 ---- */
      const store = await ctx.db
        .select()
        .from(schema.stores)
        .where(eq(schema.stores.id, input.storeId))
        .get();
      if (!store) throw new TRPCError({ code: 'NOT_FOUND', message: '门店不存在' });
      if (store.status !== 'active') badRequest('门店已关闭，暂不可预约');

      /* ---- 校验 3：服务项有效（上架、属该店、type 一致） ---- */
      const service = await ctx.db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, input.serviceId))
        .get();
      if (!service || service.storeId !== input.storeId || !service.active) {
        badRequest('服务项无效或已下架');
      }
      if (service.type !== input.type) badRequest('服务项与业务类型（type）不一致');

      /* ---- 校验 4：时间（未来 / 30min 对齐 / 营业时间内） ---- */
      const start = input.scheduledStart;
      const end =
        input.scheduledEnd ??
        new Date(
          start.getTime() +
            (input.type === 'grooming' ? (service.durationMin ?? 60) : 24 * 60) * 60_000,
        );
      assertBookableTime(store, input.type, start, end);

      /* ---- 事务占位 + 建单（人工码撞唯一索引时整体重试） ---- */
      const MAX_CODE_RETRIES = 5;
      let lastErr: unknown;
      for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
        const code = genManualCode();
        try {
          let outboxId = '';
          const created = await ctx.db.transaction(async (tx) => {
            // SQLite 单写者：事务即行锁（等价 SELECT ... FOR UPDATE），杜绝同槽并发超卖
            const slot = await tx
              .select()
              .from(schema.storeSlots)
              .where(
                and(
                  eq(schema.storeSlots.storeId, input.storeId),
                  eq(schema.storeSlots.slotStart, start),
                ),
              )
              .get();
            if (slot) {
              if (slot.bookedCount >= slot.capacity) {
                throw new TRPCError({ code: 'CONFLICT', message: '该时段已约满，请换个时间' });
              }
              await tx
                .update(schema.storeSlots)
                .set({ bookedCount: slot.bookedCount + 1, updatedAt: new Date() })
                .where(eq(schema.storeSlots.id, slot.id));
            } else {
              await tx.insert(schema.storeSlots).values({
                storeId: input.storeId,
                slotStart: start,
                capacity: DEFAULT_SLOT_CAPACITY,
                bookedCount: 1,
              });
            }
            const appt = await tx
              .insert(schema.appointments)
              .values({
                code,
                customerId: ctx.user.id,
                storeId: input.storeId,
                petId: input.petId,
                serviceId: input.serviceId,
                type: input.type,
                scheduledStart: start,
                scheduledEnd: end,
                status: 'pending',
                priceFen: service.priceFen,
                paymentMode: input.paymentMode, // 收款方式快照（§3.1 结算规则）
                note: input.note ?? null,
              })
              .returning()
              .then((r) => r[0]!);
            outboxId = await emitEvent(txDb(tx), `store:${input.storeId}`, EventType.AppointmentCreated, {
              appointmentId: appt.id,
              storeId: input.storeId,
              petName: pet.name,
              serviceName: service.name,
            });
            return appt;
          });
          broadcastNow(outboxId);
          return created;
        } catch (err) {
          // 6 位人工码撞唯一索引：换码重试整个事务；其他错误直接抛出
          if (err instanceof Error && /UNIQUE constraint failed: appointments\.code/.test(err.message)) {
            lastErr = err;
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    }),

  /** 2. listMine（customer）：我的预约按状态分组 */
  listMine: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.appointments)
      .innerJoin(schema.pets, eq(schema.pets.id, schema.appointments.petId))
      .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
      .innerJoin(schema.stores, eq(schema.stores.id, schema.appointments.storeId))
      .where(eq(schema.appointments.customerId, ctx.user.id))
      .orderBy(desc(schema.appointments.scheduledStart));
    const groups = Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [s, [] as ListItem[]])) as Record<
      AppointmentStatus,
      ListItem[]
    >;
    for (const r of rows) {
      const item: ListItem = {
        ...r.appointments,
        petName: r.pets.name,
        serviceName: r.services.name,
        storeName: r.stores.name,
      };
      const bucket = groups[r.appointments.status as AppointmentStatus];
      if (bucket) bucket.push(item);
    }
    return { groups };
  }),

  /** 3. get（customer/staff/merchant）：详情（归属校验由 assertAppointmentAccess 强制） */
  get: publicProcedure.input(z.object({ appointmentId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const appt = await assertAppointmentAccess(ctx, input.appointmentId);
    const pet = await ctx.db.select().from(schema.pets).where(eq(schema.pets.id, appt.petId)).get();
    const service = await ctx.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, appt.serviceId))
      .get();
    const store = await ctx.db.select().from(schema.stores).where(eq(schema.stores.id, appt.storeId)).get();
    const { steps, boardingStay } = await progressOf(ctx.db, appt);
    return { appointment: appt, pet: pet ?? null, service: service ?? null, store: store ?? null, steps, boardingStay };
  }),

  /**
   * 4. getCode（customer 本人）：返回二维码 payload（v2 滚动时间窗 + HMAC 签名）
   * 与 6 位人工核销码。仅 pending/confirmed 可出示（checkin 另行强校验 confirmed）。
   */
  getCode: customerProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const appt = await assertAppointmentAccess(ctx, input.appointmentId);
      if (appt.status !== 'pending' && appt.status !== 'confirmed') {
        badRequest(`当前状态（${appt.status}）不可出示预约码`);
      }
      const nowSec = Math.floor(Date.now() / 1000);
      const tw = Math.floor(nowSec / CODE_WINDOW_SEC);
      const exp = Math.floor(appt.scheduledStart.getTime() / 1000) + CODE_EXP_AFTER_START_SEC;
      const payload: BookingCodePayload = { v: 2, aid: appt.id, tw, exp, sig: signCode(appt.id, tw, exp) };
      return { payload, raw: JSON.stringify(payload), code: appt.code };
    }),

  /** 5. confirm（merchant 本店）：pending → confirmed */
  confirm: merchantProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const appt = await getAppointmentOrThrow(ctx.db, input.appointmentId);
      if (appt.storeId !== ctx.user.storeId) forbidden('非本店预约，无权操作');
      if (appt.status !== 'pending') badRequest(`当前状态（${appt.status}）不可确认，仅 pending 可确认`);
      const petName = await petNameOf(ctx.db, appt.petId);
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.appointments)
          .set({ status: 'confirmed', updatedAt: new Date() })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        outboxId = await emitEvent(txDb(tx), `user:${appt.customerId}`, EventType.AppointmentConfirmed, {
          appointmentId: appt.id,
          petName,
        });
        return row;
      });
      broadcastNow(outboxId);
      return updated;
    }),

  /**
   * 6. assign（merchant 本店）：派单。校验员工属本店、在职、技能匹配服务 type、
   * 排班覆盖预约时间、同 staff 同 scheduled_start 无 confirmed/in_service 冲突单。
   */
  assign: merchantProcedure
    .input(z.object({ appointmentId: z.string().min(1), staffId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const appt = await getAppointmentOrThrow(ctx.db, input.appointmentId);
      if (appt.storeId !== ctx.user.storeId) forbidden('非本店预约，无权操作');
      if (appt.status !== 'pending' && appt.status !== 'confirmed') {
        badRequest(`当前状态（${appt.status}）不可指派，仅 pending/confirmed 可指派`);
      }
      const staffRow = await ctx.db
        .select()
        .from(schema.staff)
        .where(eq(schema.staff.id, input.staffId))
        .get();
      if (!staffRow || staffRow.storeId !== ctx.user.storeId) badRequest('员工不存在或不属于本店');
      if (staffRow.status !== 'active') badRequest('该员工已停职，不可指派');
      // 技能匹配：服务大类 → 可承接技能（满足其一）
      const accept = TYPE_ACCEPT_SKILLS[appt.type as 'grooming' | 'boarding'] ?? [];
      const skills = staffRow.skills ?? [];
      if (!accept.some((s) => skills.includes(s))) {
        badRequest(`员工技能（${skills.join('/') || '无'}）不匹配该服务类型（${appt.type}）`);
      }
      // 排班覆盖
      assertWithinSchedule(staffRow, appt.scheduledStart);
      // 时间冲突：同员工同 scheduled_start 已有 confirmed / in_service 单
      const clash = await ctx.db
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.staffId, staffRow.id),
            eq(schema.appointments.scheduledStart, appt.scheduledStart),
            inArray(schema.appointments.status, ['confirmed', 'in_service']),
            ne(schema.appointments.id, appt.id),
          ),
        )
        .get();
      if (clash) {
        throw new TRPCError({ code: 'CONFLICT', message: '该员工此时段已有服务单，时间冲突' });
      }
      const petName = await petNameOf(ctx.db, appt.petId);
      const outboxIds: string[] = [];
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.appointments)
          .set({ staffId: staffRow.id, updatedAt: new Date() })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        const payload = { appointmentId: appt.id, staffId: staffRow.id, staffName: staffRow.name, petName };
        // → 员工端 + 客户端
        outboxIds.push(await emitEvent(txDb(tx), `staff:${staffRow.id}`, EventType.AppointmentAssigned, payload));
        outboxIds.push(await emitEvent(txDb(tx), `user:${appt.customerId}`, EventType.AppointmentAssigned, payload));
        return row;
      });
      outboxIds.forEach(broadcastNow);
      return updated;
    }),

  /**
   * 7. cancel（customer 本人）：开始前 >4h 直接 cancelled（事务内回减槽位）；
   * ≤4h 转 cancel_requested 待商家审核；in_service / in_boarding 服务中锁定拒绝。
   */
  cancel: customerProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const appt = await assertAppointmentAccess(ctx, input.appointmentId); // customer 分支已保证本人
      if (appt.status === 'in_service' || appt.status === 'in_boarding') {
        badRequest('服务进行中，不可自助取消，请联系门店处理'); // 服务中锁定（§3.1）
      }
      if (appt.status === 'cancel_requested') badRequest('取消申请审核中，请等待门店处理');
      if (appt.status === 'cancelled') badRequest('预约已取消');
      if (appt.status === 'completed') badRequest('服务已完成，不可取消');
      // pending | confirmed
      const now = new Date();
      const secondsToStart = Math.floor((appt.scheduledStart.getTime() - now.getTime()) / 1000);
      const petName = await petNameOf(ctx.db, appt.petId);

      if (secondsToStart > CANCEL_FREE_BEFORE_SEC) {
        // >4h：直接取消 + 事务内回减槽位
        let outboxId = '';
        const updated = await ctx.db.transaction(async (tx) => {
          await releaseSlot(txDb(tx), appt.storeId, appt.scheduledStart);
          const row = await tx
            .update(schema.appointments)
            .set({ status: 'cancelled', updatedAt: now })
            .where(eq(schema.appointments.id, appt.id))
            .returning()
            .then((r) => r[0]!);
          outboxId = await emitEvent(txDb(tx), `store:${appt.storeId}`, EventType.AppointmentCancelled, {
            appointmentId: appt.id,
            petName,
            by: 'customer',
          });
          return row;
        });
        broadcastNow(outboxId);
        return { appointment: updated, outcome: 'cancelled' as const };
      }

      // ≤4h：转商家审核（槽位待 reviewCancel 批准时才回减）
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.appointments)
          .set({ status: 'cancel_requested', updatedAt: now })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        outboxId = await emitEvent(txDb(tx), `store:${appt.storeId}`, EventType.AppointmentCancelRequested, {
          appointmentId: appt.id,
          petName,
        });
        return row;
      });
      broadcastNow(outboxId);
      return { appointment: updated, outcome: 'cancel_requested' as const };
    }),

  /**
   * 8. reviewCancel（merchant 本店）：批准 → cancelled + 回减槽位 + 事件；
   * 拒绝 → 回 confirmed + 事件（沿用 appointment.confirmed 语义「预约维持有效」，
   * payload.cancelRejected=true 供端上区分话术）。
   */
  reviewCancel: merchantProcedure
    .input(z.object({ appointmentId: z.string().min(1), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const appt = await getAppointmentOrThrow(ctx.db, input.appointmentId);
      if (appt.storeId !== ctx.user.storeId) forbidden('非本店预约，无权操作');
      if (appt.status !== 'cancel_requested') badRequest(`当前状态（${appt.status}）无待审核的取消申请`);
      const petName = await petNameOf(ctx.db, appt.petId);
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        if (input.approve) await releaseSlot(txDb(tx), appt.storeId, appt.scheduledStart);
        const row = await tx
          .update(schema.appointments)
          .set({ status: input.approve ? 'cancelled' : 'confirmed', updatedAt: new Date() })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        outboxId = await emitEvent(
          txDb(tx),
          `user:${appt.customerId}`,
          input.approve ? EventType.AppointmentCancelled : EventType.AppointmentConfirmed,
          input.approve
            ? { appointmentId: appt.id, petName, by: 'merchant_review' }
            : { appointmentId: appt.id, petName, cancelRejected: true },
        );
        return row;
      });
      broadcastNow(outboxId);
      return { appointment: updated, approved: input.approve };
    }),

  /**
   * 8.5 reschedule（merchant 本店 · P4 T4.2 授权追加，契约 docs/MERCHANT-CONTRACTS.md）：改期。
   * 校验本店 + 状态 pending/confirmed；新时间复用 assertBookableTime（未来 / 30min 对齐 /
   * 营业时间内 / grooming 不超打烊）。事务内：旧槽位回减 booked_count → 新槽位校验
   * （booked_count < capacity，无行则按默认容量建行）并 +1 → 写新时间；新槽已满抛
   * CONFLICT，事务整体回滚（旧槽回减一并撤销）。改到原时段为净零操作，安全幂等。
   * emitEvent appointment.rescheduled → user:{customerId} + staff:{staffId}（若已指派）。
   */
  reschedule: merchantProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        scheduledStart: z.date(),
        scheduledEnd: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appt = await getAppointmentOrThrow(ctx.db, input.appointmentId);
      if (appt.storeId !== ctx.user.storeId) forbidden('非本店预约，无权操作');
      if (appt.status !== 'pending' && appt.status !== 'confirmed') {
        badRequest(`当前状态（${appt.status}）不可改期，仅 pending/confirmed 可改期`);
      }
      const store = await ctx.db
        .select()
        .from(schema.stores)
        .where(eq(schema.stores.id, appt.storeId))
        .get();
      if (!store) throw new TRPCError({ code: 'NOT_FOUND', message: '门店不存在' });
      const service = await ctx.db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, appt.serviceId))
        .get();
      // 缺省结束时间：与 create 同口径（grooming=服务时长，boarding=24h）
      const start = input.scheduledStart;
      const end =
        input.scheduledEnd ??
        new Date(
          start.getTime() +
            (appt.type === 'grooming' ? (service?.durationMin ?? 60) : 24 * 60) * 60_000,
        );
      assertBookableTime(store, appt.type as 'grooming' | 'boarding', start, end);

      const petName = await petNameOf(ctx.db, appt.petId);
      const outboxIds: string[] = [];
      const updated = await ctx.db.transaction(async (tx) => {
        // 旧槽位回减（幂等安全）→ 新槽位校验并 +1 —— 同一事务，冲突整体回滚
        await releaseSlot(txDb(tx), appt.storeId, appt.scheduledStart);
        const slot = await tx
          .select()
          .from(schema.storeSlots)
          .where(
            and(eq(schema.storeSlots.storeId, appt.storeId), eq(schema.storeSlots.slotStart, start)),
          )
          .get();
        if (slot) {
          if (slot.bookedCount >= slot.capacity) {
            throw new TRPCError({ code: 'CONFLICT', message: '该时段已约满，请换个时间' });
          }
          await tx
            .update(schema.storeSlots)
            .set({ bookedCount: slot.bookedCount + 1, updatedAt: new Date() })
            .where(eq(schema.storeSlots.id, slot.id));
        } else {
          await tx.insert(schema.storeSlots).values({
            storeId: appt.storeId,
            slotStart: start,
            capacity: DEFAULT_SLOT_CAPACITY,
            bookedCount: 1,
          });
        }
        const row = await tx
          .update(schema.appointments)
          .set({ scheduledStart: start, scheduledEnd: end, updatedAt: new Date() })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        const payload = {
          appointmentId: appt.id,
          petName,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
        };
        // → 客户端 + 员工端（若已指派）
        outboxIds.push(
          await emitEvent(txDb(tx), `user:${appt.customerId}`, EventType.AppointmentRescheduled, payload),
        );
        if (appt.staffId) {
          outboxIds.push(
            await emitEvent(txDb(tx), `staff:${appt.staffId}`, EventType.AppointmentRescheduled, payload),
          );
        }
        return row;
      });
      outboxIds.forEach(broadcastNow);
      return updated;
    }),

  /**
   * 9. checkin（staff）★ 扫码 / 人工码核销：
   * 限流 → 验签（滚动时间窗 HMAC）→ 状态 confirmed → 门店归属 → 核销归属
   * （已指派仅本人；未指派事务内认领并补发 assigned）→ 幂等 → type 分支事务。
   */
  checkin: staffProcedure
    .input(
      z.union([
        z.object({ qr: z.string().min(1) }), // 二维码原文 JSON
        z.object({ code: z.string().regex(MANUAL_CODE_RE, '人工核销码格式不正确') }), // 6 位人工码
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const staffId = ctx.user.staffId!;
      const staffStoreId = ctx.user.storeId!;
      // 防爆破限流：锁定中直接 429（不再校验凭据，不给爆破者任何区分信号）
      assertCheckinNotLocked(staffId);
      /** 核销失败统一入口：计一次失败（达限即锁 10 分钟）后抛出（function 声明以便 TS 收窄） */
      function fail(code: 'BAD_REQUEST' | 'NOT_FOUND' | 'FORBIDDEN', message: string): never {
        recordCheckinFailure(staffId);
        throw new TRPCError({ code, message });
      }

      /* ---- 1. 解析核销凭据 ---- */
      const now = new Date();
      const nowSec = Math.floor(now.getTime() / 1000);
      let appt: AppointmentRow | undefined;
      if ('qr' in input) {
        let payload: unknown;
        try {
          payload = JSON.parse(input.qr);
        } catch {
          fail('BAD_REQUEST', '二维码内容无法解析');
        }
        if (!verifyCode(payload, nowSec)) fail('BAD_REQUEST', '二维码无效或已过期');
        appt = await ctx.db
          .select()
          .from(schema.appointments)
          .where(eq(schema.appointments.id, payload.aid))
          .get();
        if (!appt) fail('NOT_FOUND', '预约不存在');
      } else {
        appt = await ctx.db
          .select()
          .from(schema.appointments)
          .where(eq(schema.appointments.code, input.code))
          .get();
        if (!appt) fail('NOT_FOUND', '核销码不存在或已失效');
      }

      /* ---- 2. 门店归属 / 核销归属 ---- */
      if (appt.storeId !== staffStoreId) fail('FORBIDDEN', '非本店预约，无权核销');
      if (appt.staffId !== null && appt.staffId !== staffId) {
        fail('FORBIDDEN', '该预约已指派给其他员工，仅被指派人可核销');
      }

      /* ---- 3. 幂等：已核销 → 直接返回当前进度，不产生重复记录/事件（防重放，§3.3） ---- */
      if (appt.checkedInAt) {
        clearCheckinFailures(staffId);
        const { steps, boardingStay } = await progressOf(ctx.db, appt);
        return { appointment: appt, steps, boardingStay, nextRoute: nextRouteOf(appt), claimed: false, idempotent: true };
      }

      /* ---- 4. 状态校验 ---- */
      if (appt.status !== 'confirmed') {
        fail('BAD_REQUEST', `当前状态（${appt.status}）不可核销，仅 confirmed 可核销`);
      }

      /* ---- 5. type 分支事务（grooming 六步初始化 / boarding 住宿单） ---- */
      const petName = await petNameOf(ctx.db, appt.petId);
      const outboxIds: string[] = [];
      const result = await ctx.db.transaction(async (tx) => {
        const willClaim = appt.staffId === null;
        const nextStatus = appt.type === 'grooming' ? 'in_service' : 'in_boarding';
        const row = await tx
          .update(schema.appointments)
          .set({
            status: nextStatus,
            checkedInAt: now,
            staffId: willClaim ? staffId : appt.staffId, // 未指派 → 核销即认领
            updatedAt: now,
          })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);

        let steps: StepRow[] = [];
        let boardingStay: BoardingStayRow | null = null;
        if (appt.type === 'grooming') {
          // 初始化六步：step1 active（已开始），2-6 locked；required_photos 快照 min 值
          steps = await tx
            .insert(schema.appointmentSteps)
            .values(
              GROOMING_STEPS.map((s) => ({
                appointmentId: appt.id,
                stepKey: s.stepKey,
                stepOrder: s.stepOrder,
                status: s.stepOrder === 1 ? 'active' : 'locked',
                requiredPhotos: s.requiredPhotos,
                ...(s.stepOrder === 1 ? { startedAt: now } : {}),
              })),
            )
            .returning();
        } else {
          // 寄养：建 boarding_stays（room_no 可空待入住登记），不初始化六步
          boardingStay = await tx
            .insert(schema.boardingStays)
            .values({ appointmentId: appt.id })
            .returning()
            .then((r) => r[0]!);
        }

        if (willClaim) {
          // 认领补推 appointment.assigned（员工端 + 客户端，§3.3 核销归属规则）
          const payload = { appointmentId: appt.id, staffId, staffName: ctx.user.nickname, petName, by: 'checkin_claim' };
          outboxIds.push(await emitEvent(txDb(tx), `staff:${staffId}`, EventType.AppointmentAssigned, payload));
          outboxIds.push(await emitEvent(txDb(tx), `user:${appt.customerId}`, EventType.AppointmentAssigned, payload));
        }
        outboxIds.push(
          await emitEvent(txDb(tx), `appointment:${appt.id}`, EventType.AppointmentCheckedIn, {
            appointmentId: appt.id,
            petName,
            type: appt.type,
            staffId: row.staffId,
          }),
        );
        return { appointment: row, steps, boardingStay, claimed: willClaim };
      });
      outboxIds.forEach(broadcastNow);
      clearCheckinFailures(staffId);
      return { ...result, nextRoute: nextRouteOf(result.appointment), idempotent: false };
    }),

  /**
   * 10. markPaid（merchant 本店）：到店付收款登记。服务已完成（completed）且未 paid
   * → 写 paid_at / paid_fen + 事件；已 paid 直接返回现状（幂等）。
   */
  markPaid: merchantProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        paidFen: z.number().int().min(0).optional(), // 缺省 = 订单金额
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appt = await getAppointmentOrThrow(ctx.db, input.appointmentId);
      if (appt.storeId !== ctx.user.storeId) forbidden('非本店预约，无权操作');
      if (appt.status !== 'completed') badRequest(`当前状态（${appt.status}）不可收款，仅 completed 可收款登记`);
      if (appt.paidAt) return { appointment: appt, idempotent: true }; // 幂等：已收款返回现状
      const now = new Date();
      const paidFen = input.paidFen ?? appt.priceFen;
      const petName = await petNameOf(ctx.db, appt.petId);
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.appointments)
          .set({ paidAt: now, paidFen, updatedAt: now })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        // §7.3 EventType 常量：到店付收款登记（商家端财务台账用）
        outboxId = await emitEvent(txDb(tx), `store:${appt.storeId}`, EventType.AppointmentPaid, {
          appointmentId: appt.id,
          petName,
          paidFen,
        });
        return row;
      });
      broadcastNow(outboxId);
      return { appointment: updated, idempotent: false };
    }),

  /** 11. review（customer 本人）：completed 后写 rating(1-5)/review；事件发 store + staff */
  review: customerProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        rating: z.number().int().min(1).max(5),
        review: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appt = await assertAppointmentAccess(ctx, input.appointmentId);
      if (appt.status !== 'completed') badRequest('服务完成后才能评价');
      if (appt.rating !== null) badRequest('该预约已评价，不可重复评价');
      const petName = await petNameOf(ctx.db, appt.petId);
      const outboxIds: string[] = [];
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.appointments)
          .set({ rating: input.rating, review: input.review ?? null, updatedAt: new Date() })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        const payload = { appointmentId: appt.id, petName, rating: input.rating };
        // → 商家端 + 员工端（未指派时仅商家端）
        outboxIds.push(await emitEvent(txDb(tx), `store:${appt.storeId}`, EventType.AppointmentReviewed, payload));
        if (appt.staffId) {
          outboxIds.push(await emitEvent(txDb(tx), `staff:${appt.staffId}`, EventType.AppointmentReviewed, payload));
        }
        return row;
      });
      outboxIds.forEach(broadcastNow);
      return updated;
    }),

  /** 12. listForStore（merchant 本店）：按日期范围 / 状态过滤（日历 / 列表视图数据源） */
  listForStore: merchantProcedure
    .input(
      z
        .object({
          from: z.date().optional(), // scheduledStart >= from
          to: z.date().optional(), // scheduledStart <= to
          status: z.enum(APPOINTMENT_STATUSES).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [eq(schema.appointments.storeId, ctx.user.storeId!)];
      if (input?.from) conds.push(gte(schema.appointments.scheduledStart, input.from));
      if (input?.to) conds.push(lte(schema.appointments.scheduledStart, input.to));
      if (input?.status) conds.push(eq(schema.appointments.status, input.status));
      const rows = await ctx.db
        .select()
        .from(schema.appointments)
        .innerJoin(schema.pets, eq(schema.pets.id, schema.appointments.petId))
        .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
        .leftJoin(schema.staff, eq(schema.staff.id, schema.appointments.staffId))
        .where(and(...conds))
        .orderBy(asc(schema.appointments.scheduledStart));
      return rows.map(
        (r): ListItem => ({
          ...r.appointments,
          petName: r.pets.name,
          serviceName: r.services.name,
          staffName: r.staff?.name ?? null,
        }),
      );
    }),

  /**
   * 13. listTodayForStaff（staff）：今日时间轴，按 scheduled_start 升序。
   * 范围 = 本人被指派的单 + 本店未指派的待承接单（pending/confirmed）；已取消不进时间轴。
   */
  listTodayForStaff: staffProcedure.query(async ({ ctx }) => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const rows = await ctx.db
      .select()
      .from(schema.appointments)
      .innerJoin(schema.pets, eq(schema.pets.id, schema.appointments.petId))
      .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
      .where(
        and(
          eq(schema.appointments.storeId, ctx.user.storeId!),
          gte(schema.appointments.scheduledStart, dayStart),
          lt(schema.appointments.scheduledStart, dayEnd),
          ne(schema.appointments.status, 'cancelled'),
          or(
            eq(schema.appointments.staffId, ctx.user.staffId!),
            and(
              isNull(schema.appointments.staffId),
              inArray(schema.appointments.status, ['pending', 'confirmed']),
            ),
          ),
        ),
      )
      .orderBy(asc(schema.appointments.scheduledStart));
    return rows.map(
      (r): ListItem => ({
        ...r.appointments,
        petName: r.pets.name,
        serviceName: r.services.name,
      }),
    );
  }),

  /**
   * 14. listForStaff（staff）：员工端历史页数据源（T3.1 追加，唯一一处服务端小改授权）。
   * 范围 = 本店且（指派给本人 或 本人执行过）的预约：指派（assign）与核销认领
   * （checkin 未指派单事务内写 staff_id）都会落 staff_id，故两种情形统一收敛为
   * staff_id = 本人；按 scheduled_start 倒序，联 pet/service/store 名称直显。
   * 入参 from/to 过滤 scheduledStart 闭区间，status 精确过滤。
   */
  listForStaff: staffProcedure
    .input(
      z
        .object({
          from: z.date().optional(), // scheduledStart >= from
          to: z.date().optional(), // scheduledStart <= to
          status: z.enum(APPOINTMENT_STATUSES).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conds = [
        eq(schema.appointments.storeId, ctx.user.storeId!),
        eq(schema.appointments.staffId, ctx.user.staffId!),
      ];
      if (input?.from) conds.push(gte(schema.appointments.scheduledStart, input.from));
      if (input?.to) conds.push(lte(schema.appointments.scheduledStart, input.to));
      if (input?.status) conds.push(eq(schema.appointments.status, input.status));
      const rows = await ctx.db
        .select()
        .from(schema.appointments)
        .innerJoin(schema.pets, eq(schema.pets.id, schema.appointments.petId))
        .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
        .innerJoin(schema.stores, eq(schema.stores.id, schema.appointments.storeId))
        .where(and(...conds))
        .orderBy(desc(schema.appointments.scheduledStart));
      return rows.map(
        (r): ListItem => ({
          ...r.appointments,
          petName: r.pets.name,
          serviceName: r.services.name,
          storeName: r.stores.name,
        }),
      );
    }),
});

export type AppointmentRouter = typeof appointmentRouter;
