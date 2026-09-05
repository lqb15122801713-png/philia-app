/**
 * tRPC 基座（CONTRACTS.md 契约 1 —— 所有业务 router 从这里 import）
 *
 * 导出（契约固定签名，其他子代理按此引用）：
 * - SessionUser / Context / Db 类型
 * - router / publicProcedure / customerProcedure / staffProcedure / merchantProcedure
 * - assertAppointmentAccess(ctx, appointmentId)
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
  roles: Array<'customer' | 'merchant_owner' | 'merchant_manager' | 'staff'>;
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

/** 员工：publicProcedure + staffId 存在（staffId/storeId 由会话中间件组装时已填） */
export const staffProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user.staffId || !ctx.user.storeId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要员工身份（未绑定 staff 记录）' });
  }
  return next();
});

/** 商家：publicProcedure + roles 含 merchant_owner|merchant_manager + storeId 存在 */
export const merchantProcedure = publicProcedure.use(({ ctx, next }) => {
  const isMerchant =
    ctx.user.roles.includes('merchant_owner') || ctx.user.roles.includes('merchant_manager');
  if (!isMerchant || !ctx.user.storeId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '需要商家身份（merchant_owner / merchant_manager）且已绑定门店',
    });
  }
  return next();
});

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
