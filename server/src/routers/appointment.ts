/**
 * appointment router（T1.3a · coder-appt 名下文件，见 CONTRACTS.md）
 *
 * 预约全生命周期，服务端强校验（前端只做引导）：
 *   create → confirm → assign → checkin（二维码 / 6 位人工码）→ 六步流 / 寄养（T1.3b/c）
 *   → completed → markPaid（到店付收款登记）/ review（评价）
 *   取消：开始前 >4h 直接取消并回减槽位；≤4h 转 cancel_requested 由商家 reviewCancel 审批。
 *   批次 S4（任务 A · 免商家确认）：create 落库直接 confirmed（grooming/boarding 同口径，
 *   既有校验全保留：宠物归属/服务有效/营业时间/+1h 缓冲/次卡扣次/占槽事务）；
 *   pending 仅兼容历史单与客户改期回退单（不迁移不改写）；confirm 保留且幂等
 *   （对 confirmed 单 = 幂等成功，零副作用）；create 事务内增发 appointment.confirmed
 *   （user+store 双频道，by='auto'）。reject 仍仅 pending 可拒（历史/改期回退单）。
 *   改期（reschedule）：商家（本店）改期保持状态/指派；客户（本人，v1.1-b2 B2-6）仅 >4h 可自助改，
 *   与取消同阈值，事务内回退 pending + 清空 staffId + 旧槽释放/新槽校验；
 *   B3-4 起对 boarding 开放（scheduledEnd 必传，逐晚释放/占用走 B3-2 函数，不退次不动卡表）。
 *   次卡（v1.1-b2 B2-7 资损红标）：paymentMode=pass_deduct 时 create 事务内先校验
 *   （本人名下该店 active + remain_times>0 + 未过期，否则「暂无可用次卡」）并扣 -1、
 *   写 -1 流水，占槽/建单失败整体回滚；所有置 cancelled 路径（cancel >4h 直消、
 *   reviewCancel 批准、B3-3 商家拒单 reject）同事务回补 +1 并写 +1 流水（幂等）；改期不退次。
 *   拒单（v1.1-b3 B3-3）：reject 仅 pending 可拒，同事务 置 cancelled + 释放槽位
 *   + 次卡回补 + 记 cancel_reason/cancel_source=merchant_reject + 双频道 rejected 事件。
 *
 * 关键规则落点：
 * - 占座防超卖（§3.1 序 1）：create 事务内 UPSERT store_slots 行并校验
 *   booked_count < capacity 后 +1。SQLite 单写者模型下事务即行锁（等价
 *   SELECT ... FOR UPDATE），保留事务结构，未来切 MySQL 语义直接成立。
 * - B3-2（A-P1-11 红标）：寄养容量按「晚」占用——boarding 改走 boarding_slots
 *   （房型 service_id × 住宿晚 night_date，本地日界，入住日到退房日前一日），
 *   create 事务内逐晚校验占用（任一晚满员 CONFLICT 整体回滚）；取消/拒单/改期
 *   经 releaseAppointmentSlots → releaseBoardingSlots 释放全部晚（幂等）。
 *   grooming 维持 store_slots 30min 时段槽不变。
 * - 预约码（§3.3）：二维码 payload { v:2, aid, tw, exp, sig }，
 *   sig = HMAC_SHA256(`${aid}|${tw}|${exp}`, BOOKING_CODE_SECRET)；tw 为 5min 滚动
 *   时间窗编号，验签接受当前窗口与上一窗口；exp = scheduled_start + 4h（覆盖迟到）。
 * - 核销（§3.3）：状态 confirmed + 门店归属 + 幂等（checked_in_at 已存在直接
 *   返回当前进度）+ 防爆破限流（每员工每分钟失败 ≤5 次，超限锁 10 分钟；内存 Map
 *   单实例实现——多实例部署时需替换为 Redis 等共享存储，P1 单实例边界见下）。
 *   批次 S1（任务 B + R1 返工）：仅 role=frontdesk 可核销；前台核销=到店登记——
 *   归属校验豁免（本店任意到店单，不论指派给谁）、不改写 staff_id、不补发
 *   appointment.assigned（认领规则自 S1-R1 起废止，归属由派单/S4 决定）。
 * - type 分支（§3.1 序 5）：grooming → in_service + 事务内初始化 6 条
 *   appointment_steps（step1 disinfection=active，2-6=locked，required_photos
 *   快照 min 值 1/2/3/2/2/0）；boarding → in_boarding + 建 boarding_stays
 *   （room_no 可空待登记，不初始化六步）。
 * - B9a 任务 C（时长引擎）：grooming 时长由「猫犬/体型/毛长」引擎驱动
 *   （config/durationEngine，规则表占位待老板供给）——create/reschedule 的
 *   scheduledEnd 一律以引擎输出为准（客户端传入值对 grooming 不生效）；
 *   占槽/释放按引擎输出时长覆盖的连续 30min 槽逐槽进行（占 release 对称幂等）；
 *   取不到宠物物种/体重/品种字段时回退服务默认 durationMin，不阻断下单。
 *   boarding 不涉引擎：按晚计费/占晚、boardingNightDates 口径不动。
 * - 事件（契约 2）：业务写库与 emitEvent 同事务，事务提交后 broadcastNow。
 */

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import {
  DURATION_SLOT_MIN,
  resolveServiceDuration,
  type ServiceDuration,
} from '../config/durationEngine';
import {
  assertAppointmentAccess,
  assertFrontdeskStaff,
  customerProcedure,
  merchantProcedure,
  publicProcedure,
  router,
  staffProcedure,
  type AppointmentRow,
} from '../trpc';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { StepLabel, type StepKey } from './serviceStep';

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
export const DEFAULT_SLOT_CAPACITY = 2;

/**
 * 可约时段前瞻缓冲（v1.1-b3 B3-5 W-2 产品裁定：允许当天预约）：
 * 仅可约「当前时间 +1h 缓冲」之后的时段——create / reschedule（洗护+寄养）统一
 * 走 assertBookableTime 强校验；getWithServices 可约槽查询与三端栅格置灰同口径。
 */
export const BOOKING_LEAD_BUFFER_MS = 60 * 60 * 1000;

/** boarding_slots 新行默认容量：services.room_count 为空时按 1 间（防超卖兜底） */
export const DEFAULT_BOARDING_ROOM_COUNT = 1;

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

/* ------------------------------------------------------------------ */
/* 预约建单写路径应用层串行化（进程内 async mutex · 单实例边界）             */
/* ------------------------------------------------------------------ */

/**
 * 批次 S4（任务 C）：appointment.create 写事务串行锁，口径同 mall.withOrderWriteLock。
 * @libsql/client 单连接上两个并发 db.transaction 会交错执行——败者 SQLITE_BUSY 且
 * 连接可能进入中毒态；串行进入后，后到的 create 读到的是前一事务已提交的占用，
 * 由 groomer 空闲闸给出干净的 CONFLICT（并发双击不产生双占，败者按原文案报错）。
 * 边界：单实例内存实现；多实例部署需替换为共享锁（同 mall 注释口径）。
 */
let appointmentCreateQueue: Promise<unknown> = Promise.resolve();

/** 串行执行 fn（前序失败不阻塞后续队列） */
export function withAppointmentCreateLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = appointmentCreateQueue.then(fn);
  appointmentCreateQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

type StoreRow = typeof schema.stores.$inferSelect;
type StaffRow = typeof schema.staff.$inferSelect;
type StepRow = typeof schema.appointmentSteps.$inferSelect;
type BoardingStayRow = typeof schema.boardingStays.$inferSelect;

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const pad2 = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* 门店规范时区（B8-B4）：openHours / 员工排班 / 寄养晚界的墙钟统一按      */
/* Asia/Shanghai（固定 +8，中国无夏令时）。此前一律用「服务器本地时区」    */
/* 解释墙钟：VPS 容器为 UTC 时槽位栅格整体偏移 8h，客户端（手机 CST）     */
/* 本地栅格与服务端可约集错位——上午/下午大面积灰死、点击无响应，仅错位   */
/* 后碰巧对齐的 17:00-19:30 可点（走查「预约时段首次点击无响应需点两次」  */
/* 根因；走查单落在 18:00 正因此）。改为固定 +8 后与客户端栅格同帧；      */
/* +1h 缓冲 / 容量 / 时长连续 / 幂等 等槽位规则不变（仅矫正墙钟参照系）。 */
const STORE_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** instant → 门店规范时区（+8）墙钟部件（位移后用 UTC getter 读取） */
export function storeWallclock(d: Date): { y: number; m: number; day: number; dow: number; minutes: number } {
  const s = new Date(d.getTime() + STORE_TZ_OFFSET_MS);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    dow: s.getUTCDay(),
    minutes: s.getUTCHours() * 60 + s.getUTCMinutes(),
  };
}

/** 门店规范时区某日 00:00 的 epoch（槽位栅格合成基准） */
export function storeDayStartMs(y: number, m1: number, day: number): number {
  return Date.UTC(y, m1 - 1, day) - STORE_TZ_OFFSET_MS;
}

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

/**
 * B9a 任务 C：洗护占容量——从预约开始时刻起，按【时长引擎输出时长】覆盖的连续
 * 30min 槽逐个 UPSERT（booked_count +1）。
 * 批次 S4（任务 B/C）：store_slots 降级为占用记录——不再以 booked_count < capacity
 * 作防超卖闸门（固定 capacity 与动态人力脱节，继续拦截会破坏「能约=能约上」）；
 * 可约/冲突判定统一由 groomer 空闲引擎承担（getWithServices 栅格 + create 事务内
 * 自动派单选员同根同源，派单与占槽同一事务，冲突整体回滚）。booked_count 继续
 * 维护供报表与防回归比对，允许超过历史固定 capacity（仅作占用计数）。
 */
async function occupyGroomingSlots(
  tx: DbHandle,
  args: { storeId: string; start: Date; slots: number },
): Promise<void> {
  for (let i = 0; i < args.slots; i++) {
    const t = new Date(args.start.getTime() + i * DURATION_SLOT_MIN * 60_000);
    const slot = await tx
      .select()
      .from(schema.storeSlots)
      .where(and(eq(schema.storeSlots.storeId, args.storeId), eq(schema.storeSlots.slotStart, t)))
      .get();
    if (slot) {
      // S4：占用记录口径——不再校验 capacity 闸，只累加占用计数
      await tx
        .update(schema.storeSlots)
        .set({ bookedCount: slot.bookedCount + 1, updatedAt: new Date() })
        .where(eq(schema.storeSlots.id, slot.id));
    } else {
      await tx.insert(schema.storeSlots).values({
        storeId: args.storeId,
        slotStart: t,
        capacity: DEFAULT_SLOT_CAPACITY,
        bookedCount: 1,
      });
    }
  }
}

/* ---- B3-2（A-P1-11 红标）：寄养容量按「晚」占用（房型 × 本地日界） ---- */

/**
 * 住宿区间 → 占用晚列表（本地日界 'YYYY-MM-DD'，入住日到退房日前一日）。
 * 例：9/14 入住、9/17 退房 → ['2026-09-14','2026-09-15','2026-09-16']。
 * 与 priceFen 的 ceil((end-start)/24h) 晚数口径在「住退同一时刻」下天然一致；
 * 同一本地日内的日间寄存（0 晚）由 assertBookableTime 拒绝（寄养须 ≥1 晚）。
 */
export function boardingNightDates(start: Date, end: Date): string[] {
  const dates: string[] = [];
  // B8-B4：晚界按门店规范时区（+8）取日（原服务器本地日，UTC 宿主下晚界错位一天）
  const s = storeWallclock(start);
  const e = storeWallclock(end);
  let curMs = storeDayStartMs(s.y, s.m, s.day);
  const endMs = storeDayStartMs(e.y, e.m, e.day);
  while (curMs < endMs) {
    const w = storeWallclock(new Date(curMs));
    dates.push(`${w.y}-${pad2(w.m)}-${pad2(w.day)}`);
    curMs += 24 * 3600 * 1000;
  }
  return dates;
}

/**
 * B3-2：寄养占容量——对住宿区间每一晚各占 1 格（调用方保证在同一事务内）。
 * 行按需创建（capacity 快照自 services.room_count，空则默认 1 间）；任一晚满员抛
 * CONFLICT，事务整体回滚（已占晚随之撤销，不产生部分占用）。
 * B3-4 寄养改期复用：释放全部旧晚（releaseBoardingSlots）+ 占用全部新晚（本函数）。
 */
async function occupyBoardingSlots(
  tx: DbHandle,
  args: { storeId: string; serviceId: string; roomCount: number | null; start: Date; end: Date },
): Promise<void> {
  const capacity = args.roomCount ?? DEFAULT_BOARDING_ROOM_COUNT;
  for (const night of boardingNightDates(args.start, args.end)) {
    const row = await tx
      .select()
      .from(schema.boardingSlots)
      .where(
        and(
          eq(schema.boardingSlots.storeId, args.storeId),
          eq(schema.boardingSlots.serviceId, args.serviceId),
          eq(schema.boardingSlots.nightDate, night),
        ),
      )
      .get();
    if (row) {
      if (row.bookedCount >= row.capacity) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `该房型 ${night} 晚已订满，请调整入住/退房日期`,
        });
      }
      await tx
        .update(schema.boardingSlots)
        .set({ bookedCount: row.bookedCount + 1, updatedAt: new Date() })
        .where(eq(schema.boardingSlots.id, row.id));
    } else {
      await tx.insert(schema.boardingSlots).values({
        storeId: args.storeId,
        serviceId: args.serviceId,
        nightDate: night,
        capacity,
        bookedCount: 1,
      });
    }
  }
}

/**
 * B3-2：寄养释放——释放住宿区间全部晚的占用（各晚 -1；调用方保证在同一事务内）。
 * 幂等安全（槽位行不存在或已为 0 则不动）。客户 >4h 直消、reviewCancel 批准、
 * B3-3 商家拒单、B3-4 寄养改期统一复用本函数。
 */
async function releaseBoardingSlots(
  tx: DbHandle,
  args: { storeId: string; serviceId: string; start: Date; end: Date },
): Promise<void> {
  for (const night of boardingNightDates(args.start, args.end)) {
    const row = await tx
      .select()
      .from(schema.boardingSlots)
      .where(
        and(
          eq(schema.boardingSlots.storeId, args.storeId),
          eq(schema.boardingSlots.serviceId, args.serviceId),
          eq(schema.boardingSlots.nightDate, night),
        ),
      )
      .get();
    if (row && row.bookedCount > 0) {
      await tx
        .update(schema.boardingSlots)
        .set({ bookedCount: row.bookedCount - 1, updatedAt: new Date() })
        .where(eq(schema.boardingSlots.id, row.id));
    }
  }
}

/** 取消/改期释放槽位统一入口：grooming 释放时长覆盖的连续 30min 槽；boarding 释放住宿区间全部晚（B3-2） */
async function releaseAppointmentSlots(tx: DbHandle, appt: AppointmentRow): Promise<void> {
  if (appt.type === 'boarding') {
    await releaseBoardingSlots(tx, {
      storeId: appt.storeId,
      serviceId: appt.serviceId,
      start: appt.scheduledStart,
      end: appt.scheduledEnd,
    });
  } else {
    // B9a 任务 C：与 occupyGroomingSlots 对称——释放 [scheduledStart, scheduledEnd)
    // 覆盖的全部连续 30min 槽（幂等：槽行不存在或已为 0 不动）
    const count = Math.max(
      1,
      Math.ceil(
        (appt.scheduledEnd.getTime() - appt.scheduledStart.getTime()) / (DURATION_SLOT_MIN * 60_000),
      ),
    );
    for (let i = 0; i < count; i++) {
      await releaseSlot(
        tx,
        appt.storeId,
        new Date(appt.scheduledStart.getTime() + i * DURATION_SLOT_MIN * 60_000),
      );
    }
  }
}

/**
 * B2-7 资损红标：取消回补次卡（必须与「状态置 cancelled」同一事务，调用方保证）。
 * 该单若走过扣次（存在 delta=-1 流水）且尚未回补，则 remain_times +1 并写 +1 回补流水；
 * 幂等：已有 +1 回补流水则跳过，重复取消不会重复回补。
 * 注意：改期（reschedule）不退次——扣次随单走，仅最终取消才回补。
 */
async function refundPassIfDeducted(tx: DbHandle, appt: AppointmentRow): Promise<void> {
  if (appt.paymentMode !== 'pass_deduct') return;
  const deductLog = await tx
    .select()
    .from(schema.passDeductLogs)
    .where(and(eq(schema.passDeductLogs.appointmentId, appt.id), eq(schema.passDeductLogs.delta, -1)))
    .get();
  if (!deductLog) return; // 未扣过次（历史单/数据缺失），无需回补
  const already = await tx
    .select({ id: schema.passDeductLogs.id })
    .from(schema.passDeductLogs)
    .where(and(eq(schema.passDeductLogs.appointmentId, appt.id), eq(schema.passDeductLogs.delta, 1)))
    .get();
  if (already) return; // 幂等：已回补过
  const pass = await tx
    .select()
    .from(schema.memberPasses)
    .where(eq(schema.memberPasses.id, deductLog.passId))
    .get();
  if (!pass) return; // 外键保证不会发生，防御性跳过
  await tx
    .update(schema.memberPasses)
    .set({ remainTimes: pass.remainTimes + 1, updatedAt: new Date() })
    .where(eq(schema.memberPasses.id, pass.id));
  await tx.insert(schema.passDeductLogs).values({ passId: pass.id, appointmentId: appt.id, delta: 1 });
}

/** 营业时间校验：开始时间须超过「当前时间 +1h 缓冲」（B3-5 W-2）、按 30min 粒度对齐、落在当日营业区间内；grooming 还要求当日打烊前服务得完 */
function assertBookableTime(
  store: StoreRow,
  type: 'grooming' | 'boarding',
  start: Date,
  end: Date,
): void {
  // B3-5（W-2 产品裁定：允许当天预约）：统一「当前时间 +1h 缓冲」口径——
  // 过期与临近（+1h 内）时段前后端同拦；该检查置于营业时间之前，报错文案不被覆盖
  if (start.getTime() < Date.now() + BOOKING_LEAD_BUFFER_MS) {
    badRequest('仅可预约 1 小时之后的时段，请改约稍晚时间');
  }
  if (end.getTime() <= start.getTime()) badRequest('结束时间必须晚于开始时间');
  if (start.getSeconds() !== 0 || start.getMilliseconds() !== 0 || start.getMinutes() % 30 !== 0) {
    badRequest('预约开始时间须按 30 分钟粒度对齐（如 10:00 / 10:30）');
  }
  const startWc = storeWallclock(start); // B8-B4：营业时间判定按门店规范时区
  const day = DAY_KEYS[startWc.dow]!;
  const hours = store.openHours?.[day];
  if (!hours) badRequest('门店当日休息，不可预约');
  const startMin = startWc.minutes;
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
  } else {
    // B3-2（A-P1-11）：寄养校验全住宿区间——按日界须 ≥1 晚（退房日晚于入住日），
    // 且每一晚都落在门店营业日（休息日照看不可承接，与容量按晚占用同口径）
    const nights = boardingNightDates(start, end);
    if (nights.length === 0) badRequest('寄养必须选择退房日期且晚于入住日期');
    for (const night of nights) {
      const [y = 0, m = 1, d = 1] = night.split('-').map(Number);
      const nightDay = DAY_KEYS[new Date(y, m - 1, d).getDay()]!;
      if (!store.openHours?.[nightDay]) {
        badRequest(`住宿区间包含门店休息日（${night}），请调整入住/退房日期`);
      }
    }
  }
}

/** 排班校验：预约开始时间须落在员工当日排班区间内 */
function assertWithinSchedule(staffRow: StaffRow, start: Date): void {
  // B8-B4：排班墙钟同属门店规范时区（UTC 宿主下本地时区会错判时段）
  const wc = storeWallclock(start);
  const day = DAY_KEYS[wc.dow]!;
  const ranges = staffRow.schedule?.[day];
  if (!ranges || ranges.length === 0) badRequest('该员工在预约当日无排班');
  const t = `${pad2(Math.floor(wc.minutes / 60))}:${pad2(wc.minutes % 60)}`;
  if (!ranges.some((r) => r.start <= t && t < r.end)) {
    badRequest('预约时间不在该员工排班时段内');
  }
}

/* ------------------------------------------------------------------ */
/* 批次 S4（任务 B/C）：groomer 空闲判定——可用性引擎（getWithServices      */
/* 栅格）与自动派单（create 事务内）同根同源，查询时计算，不做缓存表。       */
/* ------------------------------------------------------------------ */

/**
 * 排班覆盖判定（S4 任务 B）：目标区间 [startMs, endMs) 覆盖的每个 30min tick 的
 * 墙钟（门店规范时区）均落在当日某段排班 [start, end) 内；同日多段排班按并集计。
 */
export function scheduleCoversInterval(
  schedule: schema.StaffSchedule | null,
  startMs: number,
  endMs: number,
): boolean {
  for (let t = startMs; t < endMs; t += DURATION_SLOT_MIN * 60_000) {
    const wc = storeWallclock(new Date(t));
    const ranges = schedule?.[DAY_KEYS[wc.dow]!];
    if (!ranges || ranges.length === 0) return false;
    const tt = `${pad2(Math.floor(wc.minutes / 60))}:${pad2(wc.minutes % 60)}`;
    if (!ranges.some((r) => r.start <= tt && tt < r.end)) return false;
  }
  return true;
}

/** 窗口内 groomer 占用快照（空闲判定的输入） */
export interface GroomerOccupancy {
  /** 本店全部 role='groomer' + status='active' 员工（含排班） */
  groomers: StaffRow[];
  /** 窗口内与本店 groomer 相关的非 cancelled 预约区间（占用=冲突） */
  appts: Array<{ staffId: string | null; scheduledStart: Date; scheduledEnd: Date }>;
}

/**
 * 取窗口 [windowStartMs, windowEndMs) 内的 groomer 占用快照：
 * 非 cancelled 预约（含 confirmed/in_service/in_boarding/cancel_requested/completed 等
 * 一切未取消态——取消申请尚未释放槽位，与 releaseAppointmentSlots 口径一致）且
 * 时间区间与窗口重叠（apptStart < windowEnd && apptEnd > windowStart）即计入。
 */
export async function loadGroomerOccupancy(
  d: DbHandle,
  storeId: string,
  windowStartMs: number,
  windowEndMs: number,
): Promise<GroomerOccupancy> {
  const groomers = await d
    .select()
    .from(schema.staff)
    .where(
      and(
        eq(schema.staff.storeId, storeId),
        eq(schema.staff.role, 'groomer'),
        eq(schema.staff.status, 'active'),
      ),
    )
    .orderBy(asc(schema.staff.createdAt));
  if (groomers.length === 0) return { groomers: [], appts: [] };
  const appts = await d
    .select({
      staffId: schema.appointments.staffId,
      scheduledStart: schema.appointments.scheduledStart,
      scheduledEnd: schema.appointments.scheduledEnd,
    })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.storeId, storeId),
        inArray(
          schema.appointments.staffId,
          groomers.map((g) => g.id),
        ),
        ne(schema.appointments.status, 'cancelled'),
        lt(schema.appointments.scheduledStart, new Date(windowEndMs)),
        gt(schema.appointments.scheduledEnd, new Date(windowStartMs)),
      ),
    );
  return { groomers, appts };
}

/**
 * 目标区间 [startMs, endMs) 的空闲 groomer（纯函数，与 loadGroomerOccupancy 配套）：
 * 空闲 = 排班覆盖目标区间（scheduleCoversInterval）+ 无冲突预约
 * （其任一预约区间与目标区间重叠即冲突，含 9a 引擎时长占用的连续区间）。
 */
export function freeGroomersInInterval(
  occ: GroomerOccupancy,
  startMs: number,
  endMs: number,
): StaffRow[] {
  const busy = new Set(
    occ.appts
      .filter((a) => a.scheduledStart.getTime() < endMs && a.scheduledEnd.getTime() > startMs)
      .map((a) => a.staffId),
  );
  return occ.groomers.filter((g) => !busy.has(g.id) && scheduleCoversInterval(g.schedule, startMs, endMs));
}

/**
 * 批次 S4（任务 C）：自动派单选员——从空闲 groomer 中选负荷最轻者：
 * 负荷 = 预约当日（scheduledStart 所在门店规范时区自然日）已完成 + 在单数，
 * 在单 = confirmed / in_service / in_boarding / cancel_requested（未取消且未完成，
 * 取消申请尚未释放人力），已完成 = completed；并列按 staff.createdAt 先入职
 * （loadGroomerOccupancy 按 createdAt 升序返回，取首个最小值即天然满足）。
 */
export async function pickLightestGroomer(
  d: DbHandle,
  storeId: string,
  free: StaffRow[],
  scheduledStartMs: number,
): Promise<StaffRow | null> {
  if (free.length === 0) return null;
  const wc = storeWallclock(new Date(scheduledStartMs));
  const dayStart = storeDayStartMs(wc.y, wc.m, wc.day);
  const dayEnd = dayStart + 24 * 3600 * 1000;
  const rows = await d
    .select({ staffId: schema.appointments.staffId })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.storeId, storeId),
        inArray(
          schema.appointments.staffId,
          free.map((g) => g.id),
        ),
        gte(schema.appointments.scheduledStart, new Date(dayStart)),
        lt(schema.appointments.scheduledStart, new Date(dayEnd)),
        inArray(schema.appointments.status, [
          'confirmed',
          'in_service',
          'in_boarding',
          'cancel_requested',
          'completed',
        ]),
      ),
    );
  const load = new Map<string, number>();
  for (const r of rows) {
    if (r.staffId) load.set(r.staffId, (load.get(r.staffId) ?? 0) + 1);
  }
  let best: StaffRow | null = null;
  let bestLoad = Number.POSITIVE_INFINITY;
  for (const g of free) {
    const l = load.get(g.id) ?? 0;
    if (l < bestLoad) {
      best = g;
      bestLoad = l;
    }
  }
  return best;
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
  /** B3-5 W-4：客户标识（仅本店订单可见）——昵称 + 手机号后 4 位 */
  customerName?: string | null;
  customerPhoneTail?: string | null;
};

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

export const appointmentRouter = router({
  /**
   * 1. create（customer）：宠物归属 / 服务项有效且 type 一致 / 门店营业时间内 /
   * payment_mode 快照；事务内占槽（防超卖）+ 建预约（生成 6 位人工核销码）
   * + emitEvent(store, appointment.created)。占槽按 type 分路：grooming 按 B9a 任务 C
   * 时长引擎输出 UPSERT 连续 store_slots（30min 时段槽）；boarding（B3-2）逐晚 UPSERT
   * boarding_slots（房型×晚），任一晚满员 CONFLICT 整体回滚。
   * 批次 S4（任务 A · 免商家确认）：落库状态直接 confirmed（不再经 pending 待商家确认），
   * 同事务增发 appointment.confirmed（user:{customerId} + store:{storeId} 双频道，
   * payload.by='auto' 标识自动确认）；历史 pending 单不迁移，confirm 幂等兼容。
   * 批次 S4（任务 C · 自动派单与客户指定）：入参新增可选 staffId（仅 grooming；
   * 不传 = 自动派单）。未指定 → 事务内指派「预约当日已完成+在单数最少」的空闲
   * groomer（并列按 createdAt 先入职；无可空 → CONFLICT「该时段已约满，请换个时间」，
   * 与任务 B 可用性引擎同根双保险）；指定 → 校验同店 + role=groomer + active +
   * 当时有空（无空 → CONFLICT「该美容师此时段已约满，请换时间或换美容师」）。
   * 派单写 staff_id + assignSource='auto' + emit assigned（staff+user 双频道，
   * by='auto'）；派单与占槽同一事务（占槽写先持锁串行化并发，选员失败整体回滚）。
   * boarding 按晚占房无需美容师：不自动派单、传 staffId 直接 BAD_REQUEST。
   * paymentMode=pass_deduct（B2-7）：同事务内先校验本人名下该店次卡
   * （active + remain_times>0 + 未过期，否则 BAD_REQUEST「暂无可用次卡」）并
   * remain_times-1、写 -1 扣次流水——扣次先于占槽，占槽 CONFLICT/建单失败时
   * 事务整体回滚，扣次随之还原（资损红标验收④）。
   * B2-7R（产品裁定A）：次卡仅洗护可用——boarding + pass_deduct 在查卡前
   * 直接 BAD_REQUEST（拒绝路径对 member_pass / pass_deduct_log 零副作用）。
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
        /**
         * 批次 S4（任务 C）：可选指定美容师（staff.id；向后兼容——不传 = 自动派单）。
         * 仅 grooming 生效：指定则校验同店 + role=groomer + active + 当时有空
         * （无空 → CONFLICT「该美容师此时段已约满，请换时间或换美容师」）；
         * 不传则事务内自动指派负荷最轻的空闲 groomer（无可空 → CONFLICT
         * 「该时段已约满，请换个时间」）。boarding 按晚占房无需美容师，传了直接拒绝。
         */
        staffId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      // S4（任务 C）：建单写路径应用层串行化——并发双击/并发建单排队进入，
      // 后到者以前一事务已提交占用为准，CONFLICT 干净返回，不产生双占
      withAppointmentCreateLock(async () => {
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
      // v1.1 A-P0-10：寄养按晚计费——scheduledEnd（退房时间）必填且必须晚于入住时间，
      // 否则无法计算晚数（缺省时旧逻辑默认 +24h 会导致少收/错收）
      if (
        input.type === 'boarding' &&
        (!input.scheduledEnd || input.scheduledEnd.getTime() <= start.getTime())
      ) {
        badRequest('寄养必须选择退房日期且晚于入住日期');
      }
      // B9a 任务 C（时长引擎）：grooming 的 scheduledEnd 一律以时长引擎输出为准——
      // 引擎从 petId 查宠物档案的物种/体型/毛长推导（取不到字段时回退服务默认
      // durationMin，不阻断下单）；客户端传入的 scheduledEnd 对 grooming 不再生效
      // （此前口径 input.scheduledEnd ?? start+durationMin，现引擎覆盖）。boarding
      // 不受影响：仍上面强制必传 scheduledEnd，按晚计费/占晚口径不动。
      const groomingDuration: ServiceDuration | null =
        input.type === 'grooming' ? resolveServiceDuration(service, pet) : null;
      const end =
        input.type === 'boarding'
          ? input.scheduledEnd! // boarding 上面已强制非空且晚于开始
          : new Date(start.getTime() + (groomingDuration?.durationMin ?? 60) * 60_000);
      assertBookableTime(store, input.type, start, end);

      // 批次 S4（任务 C）：boarding 按晚占房无需美容师——staffId 仅 grooming 可用
      if (input.type === 'boarding' && input.staffId) {
        badRequest('寄养由门店统一安排，无需指定美容师');
      }

      // v1.1 A-P0-10：寄养金额 = 单晚价 × 晚数（晚数 = ceil((end−start)/24h)，快照入 price_fen）；
      // grooming 保持单次服务价不变
      const nights =
        input.type === 'boarding'
          ? Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000))
          : 1;
      const priceFen = service.priceFen * nights;

      /* ---- 事务占位 + 建单（人工码撞唯一索引时整体重试） ---- */
      const MAX_CODE_RETRIES = 5;
      let lastErr: unknown;
      for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
        const code = genManualCode();
        try {
          const outboxIds: string[] = [];
          const created = await ctx.db.transaction(async (tx) => {
            // B2-7 资损红标：次卡扣次——先校验并扣减（同一事务），后续占槽/建单
            // 任一步失败（如该时段已约满 CONFLICT）整体回滚，remain_times 随之还原。
            let deductedPassId: string | null = null;
            if (input.paymentMode === 'pass_deduct') {
              // B2-7R（产品裁定A）：次卡仅洗护可用——寄养+次卡最前置硬拒绝；
              // 拒绝路径不查卡、不写流水，member_pass / pass_deduct_log 零触碰
              if (input.type === 'boarding') {
                badRequest('寄养订单暂不支持次卡支付，请选择到店支付');
              }
              const pass = await tx
                .select()
                .from(schema.memberPasses)
                .where(
                  and(
                    eq(schema.memberPasses.userId, ctx.user.id),
                    eq(schema.memberPasses.storeId, input.storeId),
                  ),
                )
                .get();
              if (
                !pass ||
                pass.status !== 'active' ||
                pass.remainTimes <= 0 ||
                (pass.expiresAt !== null && pass.expiresAt.getTime() <= Date.now())
              ) {
                badRequest('暂无可用次卡：请改选到店支付，或联系门店充次后再预约');
              }
              await tx
                .update(schema.memberPasses)
                .set({ remainTimes: pass.remainTimes - 1, updatedAt: new Date() })
                .where(eq(schema.memberPasses.id, pass.id));
              deductedPassId = pass.id;
            }
            // SQLite 单写者：事务即行锁（等价 SELECT ... FOR UPDATE），杜绝同槽并发超卖
            if (input.type === 'boarding') {
              // B3-2（A-P1-11 红标）：寄养按「晚」占容量——住宿区间每一晚各占 1 格
              // （boarding_slots：房型 × 本地日界）；任一晚满员抛 CONFLICT，事务整体回滚，
              // 不产生部分占用。寄养不再占用洗护 30min 时段槽（store_slots）。
              await occupyBoardingSlots(txDb(tx), {
                storeId: input.storeId,
                serviceId: input.serviceId,
                roomCount: service.roomCount,
                start,
                end,
              });
            } else {
              // B9a 任务 C：洗护按时长引擎输出占用连续 30min 槽（occupyGroomingSlots；
              // S4 起降级为占用记录，不再作 capacity 闸——与 getWithServices 栅格同根）
              await occupyGroomingSlots(txDb(tx), {
                storeId: input.storeId,
                start,
                slots: groomingDuration?.slotsNeeded ?? 1,
              });
            }
            /* ---- 批次 S4（任务 C）：自动派单 / 客户指定（仅 grooming；与占槽同一事务） ----
             * 选员在占槽写之后：SQLite 单写者下事务已持写锁，并发 create 在此串行，
             * 后进入者读到的是前一事务已提交的占用——冲突判定可靠，不产生双占；
             * 选员失败（无可空 / 指定无空）抛 CONFLICT，占槽与扣次同事务整体回滚。 */
            let assignedStaff: StaffRow | null = null;
            if (input.type === 'grooming') {
              const occ = await loadGroomerOccupancy(txDb(tx), input.storeId, start.getTime(), end.getTime());
              if (input.staffId) {
                const staffRow = await tx
                  .select()
                  .from(schema.staff)
                  .where(eq(schema.staff.id, input.staffId))
                  .get();
                if (!staffRow || staffRow.storeId !== input.storeId) {
                  badRequest('员工不存在或不属于本店');
                }
                if (staffRow.role !== 'groomer') badRequest('仅可指定美容师（groomer）接单');
                if (staffRow.status !== 'active') badRequest('该美容师已停职，不可指定');
                const freeNow = freeGroomersInInterval(occ, start.getTime(), end.getTime());
                if (!freeNow.some((g) => g.id === staffRow.id)) {
                  throw new TRPCError({
                    code: 'CONFLICT',
                    message: '该美容师此时段已约满，请换时间或换美容师',
                  });
                }
                assignedStaff = staffRow;
              } else {
                assignedStaff = await pickLightestGroomer(
                  txDb(tx),
                  input.storeId,
                  freeGroomersInInterval(occ, start.getTime(), end.getTime()),
                  start.getTime(),
                );
                if (!assignedStaff) {
                  throw new TRPCError({ code: 'CONFLICT', message: '该时段已约满，请换个时间' });
                }
              }
            }
            const appt = await tx
              .insert(schema.appointments)
              .values({
                code,
                customerId: ctx.user.id,
                storeId: input.storeId,
                petId: input.petId,
                serviceId: input.serviceId,
                // S4（任务 C）：grooming 下单即指派（自动派单 / 客户指定同写 staff_id +
                // assignSource='auto'；boarding 不指派留 NULL，商家可后续 assign 改派）
                staffId: assignedStaff?.id ?? null,
                assignSource: assignedStaff ? 'auto' : null,
                type: input.type,
                scheduledStart: start,
                scheduledEnd: end,
                // 批次 S4（任务 A）：免商家确认——落库直接 confirmed（grooming/boarding 同口径）；
                // pending 仅保留给历史单与客户改期回退单（不迁移）
                status: 'confirmed',
                priceFen, // 金额快照（A-P0-10：寄养=单晚价×晚数，grooming=单次价）
                paymentMode: input.paymentMode, // 收款方式快照（§3.1 结算规则）
                note: input.note ?? null,
              })
              .returning()
              .then((r) => r[0]!);
            // B2-7：扣次流水（同事务；若上面占槽已抛 CONFLICT，此处不会执行且扣减已回滚）
            if (deductedPassId) {
              await tx.insert(schema.passDeductLogs).values({
                passId: deductedPassId,
                appointmentId: appt.id,
                delta: -1,
              });
            }
            outboxIds.push(
              await emitEvent(txDb(tx), `store:${input.storeId}`, EventType.AppointmentCreated, {
                appointmentId: appt.id,
                storeId: input.storeId,
                petName: pet.name,
                serviceName: service.name,
              }),
            );
            // 批次 S4（任务 A）：免确认——create 同事务发 appointment.confirmed 双频道
            //（user=客户端状态刷新 / store=商家端列表刷新；payload.by='auto' 标识自动确认）
            const confirmedPayload = { appointmentId: appt.id, petName: pet.name, by: 'auto' as const };
            outboxIds.push(
              await emitEvent(txDb(tx), `user:${ctx.user.id}`, EventType.AppointmentConfirmed, confirmedPayload),
            );
            outboxIds.push(
              await emitEvent(txDb(tx), `store:${input.storeId}`, EventType.AppointmentConfirmed, confirmedPayload),
            );
            // 批次 S4（任务 C）：下单即指派 → appointment.assigned（staff+user 双频道，
            // payload.by='auto'；与商家 assign 改派的 by='merchant' 共同构成轨迹，不做审计表；
            // 事件序按生命周期 created → confirmed → assigned 落库）
            if (assignedStaff) {
              const assignedPayload = {
                appointmentId: appt.id,
                staffId: assignedStaff.id,
                staffName: assignedStaff.name,
                petName: pet.name,
                by: 'auto' as const,
              };
              outboxIds.push(
                await emitEvent(txDb(tx), `staff:${assignedStaff.id}`, EventType.AppointmentAssigned, assignedPayload),
              );
              outboxIds.push(
                await emitEvent(txDb(tx), `user:${ctx.user.id}`, EventType.AppointmentAssigned, assignedPayload),
              );
            }
            return appt;
          });
          outboxIds.forEach(broadcastNow);
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
    ),

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

  /** 3. get（customer/staff/merchant）：详情（归属校验由 assertAppointmentAccess 强制；
   *  B3-5 W-4：附 customer{ nickname, phoneTail }——仅本人/本店员工/本店商家可达本接口，
   *  手机号只回后 4 位） */
  get: publicProcedure.input(z.object({ appointmentId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const appt = await assertAppointmentAccess(ctx, input.appointmentId);
    const pet = await ctx.db.select().from(schema.pets).where(eq(schema.pets.id, appt.petId)).get();
    const service = await ctx.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, appt.serviceId))
      .get();
    const store = await ctx.db.select().from(schema.stores).where(eq(schema.stores.id, appt.storeId)).get();
    const customerRow = await ctx.db
      .select({ nickname: schema.users.nickname, phone: schema.users.phone })
      .from(schema.users)
      .where(eq(schema.users.id, appt.customerId))
      .get();
    const { steps, boardingStay } = await progressOf(ctx.db, appt);
    return {
      appointment: appt,
      pet: pet ?? null,
      service: service ?? null,
      store: store ?? null,
      steps,
      boardingStay,
      customer: {
        nickname: customerRow?.nickname ?? null,
        phoneTail: customerRow?.phone ? customerRow.phone.slice(-4) : null,
      },
    };
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

  /**
   * 5. confirm（merchant 本店）：pending → confirmed。
   * 批次 S4（任务 A）：create 已直接落 confirmed，本接口主要为历史 pending 单 /
   * 客户改期回退 pending 单保留；对 confirmed 单调用 = 幂等成功（直接返回现状，
   * 零写库、零事件——防旧链路/旧测试重复调用断裂）。
   */
  confirm: merchantProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const appt = await getAppointmentOrThrow(ctx.db, input.appointmentId);
      if (appt.storeId !== ctx.user.storeId) forbidden('非本店预约，无权操作');
      // S4 幂等：已 confirmed → 直接返回现状（不重写 updated_at、不重复发 confirmed 事件）
      if (appt.status === 'confirmed') return appt;
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
   * 5.5 reject（merchant 本店 · v1.1-b3 B3-3 P1-1）：商家拒单。
   * 仅 status='pending' 可拒（已确认/服务中/已取消等一律 BAD_REQUEST，零副作用）。
   * 同一事务：status→cancelled + 释放槽位（releaseAppointmentSlots；寄养走 B3-2
   * 全晚释放 releaseBoardingSlots，幂等）+ B2-7 联动：paymentMode=pass_deduct 且已
   * 扣次时 refundPassIfDeducted 同事务回补（幂等，重复拒单不会重复回补）+
   * 记 cancelReason/cancelSource='merchant_reject'（列由 0004 迁移落地，B3-5 W-14 复用）。
   * 事件 appointment.rejected 双频道：user:{customerId}（客户端详情页文案）+
   * store:{storeId}（商家端列表刷新），payload 含 reason。
   */
  reject: merchantProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        reason: z
          .string()
          .trim()
          .min(1, '请填写婉拒原因')
          .max(100, '婉拒原因不能超过 100 字'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appt = await getAppointmentOrThrow(ctx.db, input.appointmentId);
      if (appt.storeId !== ctx.user.storeId) forbidden('非本店预约，无权操作');
      if (appt.status !== 'pending') badRequest(`当前状态（${appt.status}）不可拒单，仅待确认（pending）可婉拒`);
      const petName = await petNameOf(ctx.db, appt.petId);
      const outboxIds: string[] = [];
      const updated = await ctx.db.transaction(async (tx) => {
        // B3-2：寄养拒单释放住宿区间全部晚；grooming 释放 30min 时段槽（均幂等）
        await releaseAppointmentSlots(txDb(tx), appt);
        // B2-7 联动（验收门禁 3）：已扣次单同事务回补，幂等不重复回补
        await refundPassIfDeducted(txDb(tx), appt);
        const row = await tx
          .update(schema.appointments)
          .set({
            status: 'cancelled',
            cancelReason: input.reason,
            cancelSource: 'merchant_reject',
            updatedAt: new Date(),
          })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        const payload = { appointmentId: appt.id, petName, reason: input.reason };
        outboxIds.push(
          await emitEvent(txDb(tx), `user:${appt.customerId}`, EventType.AppointmentRejected, payload),
        );
        outboxIds.push(
          await emitEvent(txDb(tx), `store:${appt.storeId}`, EventType.AppointmentRejected, payload),
        );
        return row;
      });
      outboxIds.forEach(broadcastNow);
      return updated;
    }),

  /**
   * 6. assign（merchant 本店）：派单/改派。校验员工属本店、在职、技能匹配服务 type、
   * 排班覆盖预约时间、同 staff 同 scheduled_start 无 confirmed/in_service 冲突单。
   * 批次 S4（任务 D）：商家保留改派不回归——覆盖写 assignSource='merchant'（列表/详情
   * 来源标记「商家改派」），assigned 事件 payload.by='merchant'（与下单自动派单的
   * by='auto' 共同构成轨迹，不做独立审计表）。
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
        // 批次 S4（任务 D）：商家改派保留——assign 覆盖来源标记为 merchant
        //（assigned 事件 payload.by 与 assignSource 共同构成轨迹，不做独立审计表）
        const row = await tx
          .update(schema.appointments)
          .set({ staffId: staffRow.id, assignSource: 'merchant', updatedAt: new Date() })
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        const payload = { appointmentId: appt.id, staffId: staffRow.id, staffName: staffRow.name, petName, by: 'merchant' as const };
        // → 员工端 + 客户端
        outboxIds.push(await emitEvent(txDb(tx), `staff:${staffRow.id}`, EventType.AppointmentAssigned, payload));
        outboxIds.push(await emitEvent(txDb(tx), `user:${appt.customerId}`, EventType.AppointmentAssigned, payload));
        return row;
      });
      outboxIds.forEach(broadcastNow);
      return updated;
    }),

  /**
   * 7. cancel（customer 本人）：开始前 >4h 直接 cancelled（事务内回减槽位 +
   * B2-7 同事务回补次卡扣次）；≤4h 转 cancel_requested 待商家审核；
   * in_service / in_boarding 服务中锁定拒绝。
   * B3-5（W-14）：入参加选填 reason（客户端原因 chips+自由文本合成，≤100 字）；
   * 两分支均落 cancelReason + cancelSource='customer'（客户侧口径），商家端
   * 取消审核/已取消列表透出；reviewCancel 批准不改写原因/来源（审核动作由
   * appointment.cancelled 事件 payload.by='merchant_review' 承载）。
   */
  cancel: customerProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        // B3-5 W-14：取消原因（选填；chips 标签 + 自由文本由客户端合成后传入）
        reason: z.string().trim().max(100, '取消原因不能超过 100 字').optional(),
      }),
    )
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
        // >4h：直接取消 + 事务内回减槽位（B3-2：寄养释放住宿区间全部晚；
        // B2-7：同事务回补次卡扣次；B3-5 W-14：落客户取消原因/来源）
        let outboxId = '';
        const updated = await ctx.db.transaction(async (tx) => {
          await releaseAppointmentSlots(txDb(tx), appt);
          await refundPassIfDeducted(txDb(tx), appt);
          const row = await tx
            .update(schema.appointments)
            .set({
              status: 'cancelled',
              cancelReason: input.reason?.trim() || null,
              cancelSource: 'customer',
              updatedAt: now,
            })
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

      // ≤4h：转商家审核（槽位待 reviewCancel 批准时才回减；
      // B3-5 W-14：取消原因/来源随申请落库，批准时保留透出）
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.appointments)
          .set({
            status: 'cancel_requested',
            cancelReason: input.reason?.trim() || null,
            cancelSource: 'customer',
            updatedAt: now,
          })
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
   * 8. reviewCancel（merchant 本店）：批准 → cancelled + 回减槽位 +
   * B2-7 同事务回补次卡扣次 + 事件；
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
        if (input.approve) {
          // B3-2：寄养批准取消释放住宿区间全部晚（releaseBoardingSlots，幂等）
          await releaseAppointmentSlots(txDb(tx), appt);
          await refundPassIfDeducted(txDb(tx), appt); // B2-7：批准取消同事务回补次卡
        }
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
   * 8.5 reschedule（改期 · 登录后按角色分派）：
   * - 商家（本店 · P4 T4.2 授权追加，契约 docs/MERCHANT-CONTRACTS.md）：
   *   校验本店 + 状态 pending/confirmed；新时间复用 assertBookableTime（未来 / 30min 对齐 /
   *   营业时间内 / grooming 不超打烊）。事务内：旧槽位回减 booked_count → 新槽位校验
   *   （booked_count < capacity，无行则按默认容量建行）并 +1 → 写新时间；新槽已满抛
   *   CONFLICT，事务整体回滚（旧槽回减一并撤销）。改到原时段为净零操作，安全幂等。
   *   emitEvent appointment.rescheduled → user:{customerId} + staff:{staffId}（若已指派）。
   * - 客户（本人 · v1.1-b2 B2-6）：状态 pending/confirmed 且距原开始 >4h
   *   （与取消同阈值 CANCEL_FREE_BEFORE_SEC，不足 4 小时明确报错；寄养以入住日首晚
   *   即 scheduledStart 计，B3-4）才可自助改期。
   *   与商家分支同一事务结构：旧槽位回减 → 新槽位校验并 +1 → 写新时间，
   *   且 status 回退 pending + staffId 置空（重新走商家确认流）；新槽已满抛 CONFLICT，
   *   事务整体回滚（状态回退、staffId 清空、旧槽回减一并撤销，三者与槽位校验同生共死）。
   *   emitEvent appointment.rescheduled → appointment:{aid} + store:{storeId}（by:'customer'）。
   * - B3-4（寄养改期）：type=boarding 放开客户自助改期——scheduledEnd 必传且须晚于
   *   scheduledStart（重选退房日，拒绝静默 24h 缺省）；事务内 releaseAppointmentSlots
   *   释放全部旧晚 + occupyBoardingSlots 逐晚校验占用全部新晚（B3-2 函数，任一新晚
   *   满员 CONFLICT 整体回滚）。寄养本无次卡路径（B2-7R 裁定A），改期不触碰卡表、不退次。
   */
  reschedule: publicProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        scheduledStart: z.date(),
        scheduledEnd: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appt = await getAppointmentOrThrow(ctx.db, input.appointmentId);
      const isMerchant =
        (ctx.user.roles.includes('merchant_owner') || ctx.user.roles.includes('merchant_manager')) &&
        ctx.user.storeId === appt.storeId;
      const isOwnerCustomer = ctx.user.roles.includes('customer') && appt.customerId === ctx.user.id;
      if (!isMerchant && !isOwnerCustomer) forbidden('无权改期该预约');
      if (appt.status !== 'pending' && appt.status !== 'confirmed') {
        badRequest(`当前状态（${appt.status}）不可改期，仅 pending/confirmed 可改期`);
      }
      // B2-6：客户自助改期与取消同规则——距原开始 >4h；商家代客改期不受此限
      if (isOwnerCustomer && !isMerchant) {
        const secondsToStart = Math.floor((appt.scheduledStart.getTime() - Date.now()) / 1000);
        if (secondsToStart <= CANCEL_FREE_BEFORE_SEC) {
          badRequest('距预约开始不足 4 小时，不可自助改期，如需调整请联系门店');
        }
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
      const start = input.scheduledStart;
      // B3-4（寄养改期）：boarding 必传 scheduledEnd（重选退房日）且须晚于入住时间——
      // 缺省 24h 会把多晚单静默压成 1 晚而金额快照不变（晚数/金额错位，见 B3-4 复现记录）；
      // B9a 任务 C：grooming 改期的 scheduledEnd 与 create 同口径——一律以时长引擎输出
      // 为准（宠物档案随单走），客户端传入的 grooming scheduledEnd 不再生效
      if (
        appt.type === 'boarding' &&
        (!input.scheduledEnd || input.scheduledEnd.getTime() <= start.getTime())
      ) {
        badRequest('寄养改期必须选择新的退房日期且晚于入住日期');
      }
      const pet =
        appt.type === 'grooming'
          ? await ctx.db.select().from(schema.pets).where(eq(schema.pets.id, appt.petId)).get()
          : null;
      const groomingDuration: ServiceDuration | null =
        appt.type === 'grooming'
          ? // 服务行缺失（防御）时以空名占位 → 引擎回退默认 60min
            resolveServiceDuration(service ?? { type: 'grooming', name: '', durationMin: null }, pet)
          : null;
      const end =
        appt.type === 'boarding'
          ? input.scheduledEnd! // boarding 上面已强制非空且晚于开始
          : new Date(start.getTime() + (groomingDuration?.durationMin ?? 60) * 60_000);
      assertBookableTime(store, appt.type as 'grooming' | 'boarding', start, end);

      const petName = await petNameOf(ctx.db, appt.petId);
      const outboxIds: string[] = [];
      const updated = await ctx.db.transaction(async (tx) => {
        // 旧槽位回减（幂等安全）→ 新槽位校验并 +1 —— 同一事务，冲突整体回滚。
        // B3-2：boarding 走「释放全部旧晚 + 逐晚校验占用全部新晚」（boarding_slots），
        // grooming 维持 30min 时段槽（store_slots）。
        await releaseAppointmentSlots(txDb(tx), appt);
        if (appt.type === 'boarding') {
          await occupyBoardingSlots(txDb(tx), {
            storeId: appt.storeId,
            serviceId: appt.serviceId,
            roomCount: service?.roomCount ?? null,
            start,
            end,
          });
        } else {
          // B9a 任务 C：洗护改期新槽按引擎时长占用连续 30min 槽（与 create 同函数同口径）
          await occupyGroomingSlots(txDb(tx), {
            storeId: appt.storeId,
            start,
            slots: groomingDuration?.slotsNeeded ?? 1,
          });
        }
        // B2-6：客户改期同事务内 status 回退 pending + staffId 置空（重新走商家确认流）；
        // 商家改期保持状态与指派不变。新槽满槽抛 CONFLICT 时此处一并回滚。
        const row = await tx
          .update(schema.appointments)
          .set(
            isMerchant
              ? { scheduledStart: start, scheduledEnd: end, updatedAt: new Date() }
              : {
                  scheduledStart: start,
                  scheduledEnd: end,
                  status: 'pending',
                  staffId: null,
                  updatedAt: new Date(),
                },
          )
          .where(eq(schema.appointments.id, appt.id))
          .returning()
          .then((r) => r[0]!);
        const payload = {
          appointmentId: appt.id,
          petName,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
        };
        if (isMerchant) {
          // 商家改期 → 客户端 + 员工端（若已指派）
          outboxIds.push(
            await emitEvent(txDb(tx), `user:${appt.customerId}`, EventType.AppointmentRescheduled, payload),
          );
          if (appt.staffId) {
            outboxIds.push(
              await emitEvent(txDb(tx), `staff:${appt.staffId}`, EventType.AppointmentRescheduled, payload),
            );
          }
        } else {
          // B2-6 客户改期 → appointment 频道（客户/商家/原员工可见）+ store 频道（商家待办刷新）
          outboxIds.push(
            await emitEvent(txDb(tx), `appointment:${appt.id}`, EventType.AppointmentRescheduled, {
              ...payload,
              by: 'customer',
            }),
          );
          outboxIds.push(
            await emitEvent(txDb(tx), `store:${appt.storeId}`, EventType.AppointmentRescheduled, {
              ...payload,
              by: 'customer',
            }),
          );
        }
        return row;
      });
      outboxIds.forEach(broadcastNow);
      return updated;
    }),

  /**
   * 9. checkin（staff）★ 扫码 / 人工码核销：
   * 前台角色（批次 S1：仅 role=frontdesk，先于限流与凭据校验，角色拒绝不计失败次数）
   * → 限流 → 验签（滚动时间窗 HMAC）→ 状态 confirmed → 门店归属 → 幂等 → type 分支事务。
   * S1-R1：核销=到店登记——归属校验豁免（本店任意单）、不改写 staff_id、不补发 assigned。
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
      // 批次 S1 任务 B：核销权限收口——仅前台可核销（groomer → FORBIDDEN 原文案）
      await assertFrontdeskStaff(ctx);
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

      /* ---- 2. 门店归属（S1-R1：核销=到店登记，归属校验豁免——前台可核销本店任意到店单） ---- */
      if (appt.storeId !== staffStoreId) fail('FORBIDDEN', '非本店预约，无权核销');

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
        const nextStatus = appt.type === 'grooming' ? 'in_service' : 'in_boarding';
        // S1-R1：前台核销=到店登记，不改写 staff_id——已指派保留原指派，未指派保持 NULL，
        // 归属由商家派单 / S4 决定；不再补发 appointment.assigned。
        const row = await tx
          .update(schema.appointments)
          .set({
            status: nextStatus,
            checkedInAt: now,
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

        // B2-8（A-P1-12）：checkedin 增发 store:{storeId} 频道，payload 与 appointment 频道一致，
        // 商家不逐个打开详情页（watch appointment 频道）也能感知到店签到。
        const checkedInPayload = {
          appointmentId: appt.id,
          petName,
          type: appt.type,
          staffId: row.staffId,
        };
        outboxIds.push(
          await emitEvent(txDb(tx), `appointment:${appt.id}`, EventType.AppointmentCheckedIn, checkedInPayload),
        );
        outboxIds.push(
          await emitEvent(txDb(tx), `store:${appt.storeId}`, EventType.AppointmentCheckedIn, checkedInPayload),
        );
        // S1-R1：claimed 恒 false（核销不认领；字段保留仅为响应形状兼容）
        return { appointment: row, steps, boardingStay, claimed: false };
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

  /** 12. listForStore（merchant 本店）：按日期范围 / 状态过滤（日历 / 列表视图数据源）。
   *  B3-5 W-4：联 users 补 customerName（昵称）/customerPhoneTail（手机号后 4 位）——
   *  查询条件恒含 storeId=当前商家门店，客户标识只随本店订单出参，手机号仅回尾号。 */
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
        .innerJoin(schema.users, eq(schema.users.id, schema.appointments.customerId))
        .leftJoin(schema.staff, eq(schema.staff.id, schema.appointments.staffId))
        .where(and(...conds))
        .orderBy(asc(schema.appointments.scheduledStart));
      return rows.map(
        (r): ListItem => ({
          ...r.appointments,
          petName: r.pets.name,
          serviceName: r.services.name,
          staffName: r.staff?.name ?? null,
          customerName: r.users.nickname,
          customerPhoneTail: r.users.phone ? r.users.phone.slice(-4) : null,
        }),
      );
    }),

  /**
   * 15. serviceAlbum（customer 本人 · v1.1-b2 B2-4）：服务相册。
   * 返回洗护六步 stepKey/stepName/status/photos[{url,tag}]（仅未失效照片，
   * 张数口径与 serviceStep 一致：invalidated_at IS NULL，按 taken_at 升序）；
   * 寄养单无六步流 → steps 为空数组。
   * 越权红线：严格本人校验——不回落 staff/merchant 归属分支，预约非本人
   * 一律 FORBIDDEN，不存在 NOT_FOUND，杜绝泄漏其他客户数据。
   */
  serviceAlbum: customerProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const appt = await ctx.db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.id, input.appointmentId))
        .get();
      if (!appt) throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
      if (appt.customerId !== ctx.user.id) forbidden('无权查看该预约的服务相册');

      const steps = await ctx.db
        .select()
        .from(schema.appointmentSteps)
        .where(eq(schema.appointmentSteps.appointmentId, appt.id))
        .orderBy(asc(schema.appointmentSteps.stepOrder));
      const stepIds = steps.map((s) => s.id);
      const photos =
        stepIds.length === 0
          ? []
          : await ctx.db
              .select({
                stepId: schema.stepPhotos.stepId,
                url: schema.stepPhotos.url,
                tag: schema.stepPhotos.tag,
              })
              .from(schema.stepPhotos)
              .where(
                and(
                  inArray(schema.stepPhotos.stepId, stepIds),
                  isNull(schema.stepPhotos.invalidatedAt), // 仅未失效照片
                ),
              )
              .orderBy(asc(schema.stepPhotos.takenAt), asc(schema.stepPhotos.id));

      const byStep = new Map<string, typeof photos>();
      for (const p of photos) {
        const arr = byStep.get(p.stepId);
        if (arr) arr.push(p);
        else byStep.set(p.stepId, [p]);
      }
      return {
        appointmentId: appt.id,
        status: appt.status,
        steps: steps.map((s) => ({
          stepKey: s.stepKey as StepKey,
          stepName: StepLabel[s.stepKey as StepKey] ?? s.stepKey,
          status: s.status,
          photos: (byStep.get(s.id) ?? []).map((p) => ({ url: p.url, tag: p.tag })),
        })),
      };
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
   * 范围 = 本店且（指派给本人 或 本人执行过）的预约：指派（assign）落 staff_id
   * （S1-R1 起核销不再认领/不改写 staff_id，历史「核销认领」单保留原值不影响本查询）；
   * 按 scheduled_start 倒序，联 pet/service/store 名称直显。
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
