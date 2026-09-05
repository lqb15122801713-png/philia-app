/**
 * auth router（tRPC）
 *
 * - auth.me：当前登录用户 + 角色集 + staff/store 绑定信息（三端启动守卫调用）。
 * - auth.bindStaff：员工凭邀请码绑定门店。邀请码 24h 有效（expires_at）、
 *   单次使用（used_at IS NULL）；事务内创建 staff 记录 + 写 user_roles('staff')
 *   + 邀请码置 used_at，任一步失败整体回滚。
 * - auth.bindStore：创建门店（owner=当前用户）+ 写 user_roles('merchant_owner')；
 *   幂等：已有自有门店则直接返回现有门店，不重复建行。
 */

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { publicProcedure, router } from '../trpc';

export const authRouter = router({
  /** 当前登录用户：用户行 + 角色集 + staff/store 绑定信息 */
  me: publicProcedure.query(async ({ ctx }) => {
    const user = await ctx.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, ctx.user.id))
      .limit(1)
      .then((r) => r[0]);
    if (!user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: '账号不存在或已被删除' });
    }

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

    return {
      user,
      roles: ctx.user.roles,
      staff: staffRow ?? null,
      store: storeRow ?? null,
    };
  }),

  /** 员工凭邀请码绑定门店（事务：staff 记录 + staff 角色 + 邀请码置 used_at，整体回滚） */
  bindStaff: publicProcedure
    .input(z.object({ code: z.string().trim().min(1, '邀请码不能为空') }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const invite = await ctx.db
        .select()
        .from(schema.staffInvites)
        .where(eq(schema.staffInvites.code, input.code))
        .limit(1)
        .then((r) => r[0]);
      if (!invite) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '邀请码不存在' });
      }
      if (invite.usedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请码已被使用，请向店主重新索取' });
      }
      if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '邀请码已过期（24 小时有效），请向店主重新索取',
        });
      }

      const existingStaff = await ctx.db
        .select({ id: schema.staff.id })
        .from(schema.staff)
        .where(eq(schema.staff.userId, userId))
        .limit(1)
        .then((r) => r[0]);
      if (existingStaff) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '当前账号已绑定员工身份' });
      }

      const now = new Date();
      const staffRow = await ctx.db.transaction(async (tx) => {
        // 事务内复查邀请码状态，防并发双用；复查失败抛错即整体回滚
        const fresh = await tx
          .select()
          .from(schema.staffInvites)
          .where(eq(schema.staffInvites.id, invite.id))
          .limit(1)
          .then((r) => r[0]);
        if (!fresh || fresh.usedAt) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请码已被使用，请向店主重新索取' });
        }
        if (fresh.expiresAt && fresh.expiresAt.getTime() <= Date.now()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请码已过期（24 小时有效）' });
        }

        const [created] = await tx
          .insert(schema.staff)
          .values({
            storeId: invite.storeId,
            userId,
            name: invite.staffName ?? ctx.user.nickname ?? '员工',
            status: 'active',
          })
          .returning();

        await tx
          .insert(schema.userRoles)
          .values({ userId, role: 'staff' })
          .onConflictDoNothing();

        await tx
          .update(schema.staffInvites)
          .set({ usedAt: now, updatedAt: now })
          .where(eq(schema.staffInvites.id, invite.id));

        return created;
      });

      return { staff: staffRow, storeId: staffRow.storeId };
    }),

  /** 商家开店：创建门店 + owner=当前用户 + merchant_owner 角色（幂等） */
  bindStore: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, '门店名称不能为空').max(64),
        address: z.string().trim().max(255).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // 幂等：已有（自有且营业中的）门店 → 直接返回现有，不重复建行
      const existing = await ctx.db
        .select()
        .from(schema.stores)
        .where(and(eq(schema.stores.ownerId, userId), eq(schema.stores.status, 'active')))
        .limit(1)
        .then((r) => r[0]);
      if (existing) {
        return { store: existing, created: false as const };
      }

      const store = await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(schema.stores)
          .values({
            ownerId: userId,
            name: input.name,
            address: input.address ?? null,
            lat: input.lat ?? null,
            lng: input.lng ?? null,
            status: 'active',
          })
          .returning();

        await tx
          .insert(schema.userRoles)
          .values({ userId, role: 'merchant_owner' })
          .onConflictDoNothing();

        return created;
      });

      return { store, created: true as const };
    }),
});
