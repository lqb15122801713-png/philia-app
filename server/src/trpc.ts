/**
 * tRPC 基座（CONTRACTS.md 契约 1 —— 所有业务 router 从这里 import）
 *
 * 导出（契约固定签名，其他子代理按此引用）：
 * - SessionUser / Context / Db 类型
 * - router / publicProcedure / customerProcedure / staffProcedure
 * - merchantProcedure（owner|manager|clerk）/ merchantManagerProcedure（owner|manager，
 *   M1-补2 R2 新增）/ merchantOwnerProcedure（owner）
 * - assertMerchantOwner / assertMerchantManager（M1-补2 R2 新增）/ assertAppointmentAccess
 *
 * 约定：
 * - transformer 用 superjson（Date 等类型端到端保鲜）。
 * - publicProcedure 按契约要求「已登录」即可（无会话抛 UNAUTHORIZED）；
 *   customer/staff/merchant 在其上叠加角色与归属校验（不满足抛 FORBIDDEN）。
 * - 归属校验全部在服务端 procedure 内强制，前端路由守卫只是体验层。
 */

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { eq } from 'drizzle-orm';
import { db, schema } from './db';

/** drizzle 实例类型（事务内请用 tx 自身的类型） */
export type Db = typeof db;

export interface SessionUser {
  id: string;
  nickname: string | null;
  /** M1-补2 R2：新增 merchant_clerk（店员，收银执行层）——商家端三级账号：owner/manager/clerk */
  roles: Array<'customer' | 'merchant_owner' | 'merchant_manager' | 'merchant_clerk' | 'staff'>;
  staffId?: string; // 若为 staff，其 staff 记录 id
  storeId?: string; // staff 所属门店 / merchant 管理门店
}

export interface Context {
  db: Db;
  user: SessionUser | null;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;

/** 会话存在性校验：无 user 即 UNAUTHORIZED，通过后 ctx.user 收窄为非空 */
const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '未登录或会话已过期' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** 登录即可访问（auth.me 等） */
export const publicProcedure = t.procedure.use(requireUser);

/** 客户：publicProcedure + roles 含 customer */
export const customerProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user.roles.includes('customer')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要 customer 角色' });
  }
  return next();
});

/**
 * 员工：publicProcedure + staffId 存在（staffId/storeId 由会话中间件组装时已填）
 * + 每请求校验在职状态（v1.1 P1-2）：staff.status 必须为 active——
 * 每请求都查库，保证停职即时生效（不等 7 天会话过期）；
 * suspended 或 staff 记录被删一律 FORBIDDEN。
 */
export const staffProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user.staffId || !ctx.user.storeId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要员工身份（未绑定 staff 记录）' });
  }
  const staffRow = await ctx.db
    .select({ status: schema.staff.status })
    .from(schema.staff)
    .where(eq(schema.staff.id, ctx.user.staffId))
    .get();
  if (staffRow?.status !== 'active') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '员工已停职，操作权限已即时冻结，请联系门店负责人',
    });
  }
  return next();
});

/**
 * 商家三级（M1-补2 R2 · 补丁①/矩阵会签稿冻结表）：
 * - merchantProcedure        = owner | manager | clerk（收银执行层：开单/挂单/取单/结账/撤未支付单）
 * - merchantManagerProcedure = owner | manager（审批/管理层：改价·折扣/财务流水/看板/日结闸门预留）
 * - merchantOwnerProcedure   = owner（反结账/导出/CSV 储值导入闸门预留）
 * 归属校验全部在服务端 procedure 内强制，前端置灰只是体验层（双闸口径）。
 */

/** 商家（收银执行层）：publicProcedure + roles 含 owner|manager|clerk + storeId 存在 */
export const merchantProcedure = publicProcedure.use(({ ctx, next }) => {
  const isMerchant =
    ctx.user.roles.includes('merchant_owner') ||
    ctx.user.roles.includes('merchant_manager') ||
    ctx.user.roles.includes('merchant_clerk');
  if (!isMerchant || !ctx.user.storeId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '需要商家身份（merchant_owner / merchant_manager / merchant_clerk）且已绑定门店',
    });
  }
  return next();
});

/**
 * 商家管理层（M1-补2 R2 新增）：publicProcedure + roles 含 owner|manager + storeId 存在。
 * 用途（矩阵会签稿）：退款/改价/免单（ cashier 路由内 assertMerchantManager 同档）、
 * 财务流水查看（financeStats）、看板（dashboardStats）——店员不看营业额（总规则②）；
 * 日结/交接班确认端点（S1b 批次落端点）的预留闸门函数即本过程。
 */
export const merchantManagerProcedure = publicProcedure.use(({ ctx, next }) => {
  const isManager =
    ctx.user.roles.includes('merchant_owner') || ctx.user.roles.includes('merchant_manager');
  if (!isManager || !ctx.user.storeId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '需要店主或店长身份（merchant_owner / merchant_manager）且已绑定门店',
    });
  }
  return next();
});

/**
 * 店主：publicProcedure + roles 含 merchant_owner + storeId 存在。
 * M1-补2 闸门冻结表（补丁①+矩阵会签稿）：反结账（收银台已支付单冲正/日结拆封箱）、
 * 数据导出、储值台账 CSV 导入 仅店主——上述端点（S1b/R5b 批次落）一律走本过程。
 * 路由内局部店主硬校验用 assertMerchantOwner。
 */
export const merchantOwnerProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user.roles.includes('merchant_owner') || !ctx.user.storeId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '需要店主身份（merchant_owner）且已绑定门店',
    });
  }
  return next();
});

/**
 * 路由内店主硬校验：非 merchant_owner 抛 FORBIDDEN。
 * M1-补2 后用途：仅店主档动作（反结账原因校验、CSV 导入、导出等）路由内复核。
 */
export function assertMerchantOwner(ctx: Context): void {
  if (!ctx.user?.roles.includes('merchant_owner')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '该操作仅店主（merchant_owner）可操作' });
  }
}

/**
 * 路由内店主/店长硬校验（M1-补2 R2 · 补丁①+矩阵会签稿）：非 owner|manager 抛 FORBIDDEN。
 * 用途：收银台改价/折扣闸门（M1 的 owner-only 放宽一档至 manager，留痕含操作人不变）、
 * 退款/免单闸门骨架同档（功能本体后续批次，本批先落闸门口径）。
 */
export function assertMerchantManager(ctx: Context): void {
  const ok =
    ctx.user?.roles.includes('merchant_owner') || ctx.user?.roles.includes('merchant_manager');
  if (!ok) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '改价/折扣/退款仅店主或店长（owner / manager）可操作' });
  }
}

/**
 * 批次 S1（任务 B）核销权限收口：仅前台（staff.role='frontdesk'）可核销。
 * 每请求直查 staff 行（与 staffProcedure 在职校验同模式），角色改动即时生效；
 * groomer / 无 staff 记录 → FORBIDDEN 原文案「核销需前台账号操作」。
 * 用于 appointment.checkin / boarding.checkinStay，须在限流/凭据校验之前调用
 * （角色拒绝不计入防爆破失败次数）。
 */
export async function assertFrontdeskStaff(ctx: Context): Promise<void> {
  const staffId = ctx.user?.staffId;
  const row = staffId
    ? await ctx.db
        .select({ role: schema.staff.role })
        .from(schema.staff)
        .where(eq(schema.staff.id, staffId))
        .get()
    : undefined;
  if (row?.role !== 'frontdesk') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '核销需前台账号操作' });
  }
}

export type AppointmentRow = typeof schema.appointments.$inferSelect;

/**
 * 预约归属校验，返回预约行：
 * - customer：仅本人预约
 * - staff：本店且（未指派或指派给自己）
 * - merchant（owner/manager）：本店
 * 预约不存在抛 NOT_FOUND；未登录抛 UNAUTHORIZED；归属不通过抛 FORBIDDEN。
 */
export async function assertAppointmentAccess(
  ctx: Context,
  appointmentId: string,
): Promise<AppointmentRow> {
  const appt = await ctx.db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, appointmentId))
    .limit(1)
    .then((r) => r[0]);
  if (!appt) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
  }
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '未登录或会话已过期' });
  }
  if (user.roles.includes('customer') && appt.customerId === user.id) {
    return appt;
  }
  if (
    user.staffId &&
    user.storeId === appt.storeId &&
    (appt.staffId === null || appt.staffId === user.staffId)
  ) {
    return appt;
  }
  const isMerchant =
    user.roles.includes('merchant_owner') || user.roles.includes('merchant_manager');
  if (isMerchant && user.storeId === appt.storeId) {
    return appt;
  }
  throw new TRPCError({ code: 'FORBIDDEN', message: '无权访问该预约' });
}
