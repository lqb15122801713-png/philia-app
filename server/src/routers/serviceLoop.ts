/**
 * serviceLoop tRPC router（补缺大批片 4 · server 侧）—— 服务闭环读口与配套流：
 *
 * - 服务相册聚合 albumFeed：本人 completed + in_service 预约一次查询批拉六步+有效
 *   照片（替掉客户端 N+1）；进行中单仅透出 status='done' 步的照片（进行中口径）。
 * - 安心证书 / 美容报告：生成链在 serviceStep.confirmStep 末步同事务（见该文件
 *   头注）；本路由为读口——certificateFor/reportFor 首读幂等置 delivered_at；
 *   R10 无数据不生成：无证书行 → 404 明文「该服务未生成证书（无前后对比照）」。
 * - 客服工单：ticketCreate（客户，联系方式缺省回显 users.phone，ticketNo 日序
 *   TK-yyyymmdd-NNN）→ ticketListPending/ticketReply（本店 owner|manager，回复
 *   必填 → replied + timeline 留痕 + SSE user 频道 ticket.replied）。
 * - 发票申请：invoiceCreate（客户；本人单闸 + 已付闸——appointment.paid_fen>0 /
 *   cashier settled 且未冲正 / orders paid 及之后；金额=服务端实付重算不信任入参；
 *   business 抬头必填税号、personal 置空；email 交付校验邮箱格式；同单在途幂等）
 *   → invoiceListPending/invoiceRegister（本店 owner|manager 登记实际发票号 →
 *   issued + SSE user 频道 invoice.issued）。
 * - serviceHours：客服服务时间公示读口（service_rules.service_hours，配置端口
 *   domain='service' 可调，保存即生效）。
 *
 * 权限闸：客户只见本人数据（ticketGet/invoiceGet/certificateFor/reportFor 严格
 * 本人校验，他人 403）；证书/报告另放行本店 staff/merchant（读口径与
 * assertAppointmentAccess 同族）；商家端待办/登记走 merchantManagerProcedure 本店。
 */

import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  customerProcedure,
  merchantManagerProcedure,
  publicProcedure,
  router,
  type Context,
} from '../trpc';
import { storeDayStartMs, storeWallclock } from './appointment';
import { StepLabel, type StepKey } from './serviceStep';

/* ------------------------------------------------------------------ */
/* 常量与类型                                                            */
/* ------------------------------------------------------------------ */

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言，同 cashier.ts 惯例） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

const pad2 = (n: number) => String(n).padStart(2, '0');

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function forbidden(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* 写路径应用层串行化（进程内 async mutex · 单实例边界，口径同                 */
/* cashier.withCashierWriteLock）：ticketNo/invoiceNo 当日序号分配的并发语义   */
/* 由此成立（SQLite 单写者下事务即行锁，UNIQUE 索引兜底）。                    */
/* ------------------------------------------------------------------ */

let serviceLoopWriteQueue: Promise<unknown> = Promise.resolve();

/** 串行执行 fn（前序失败不阻塞后续队列） */
function withServiceLoopWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = serviceLoopWriteQueue.then(fn);
  serviceLoopWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** 日序单号：TK/IN-{yyyymmdd}-{当日 3 位序号}（+8 门店规范时区取「当日」，同 genBillNo 口径） */
async function genDailyNo(
  d: DbHandle,
  prefix: 'TK' | 'IN',
  table: typeof schema.supportTickets | typeof schema.invoiceRequests,
  now: Date,
): Promise<string> {
  const w = storeWallclock(now);
  const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const row = await d
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .where(and(gte(table.createdAt, dayStart), lt(table.createdAt, dayEnd)))
    .get();
  const seq = Number(row?.n ?? 0) + 1;
  return `${prefix}-${w.y}${pad2(w.m)}${pad2(w.day)}-${String(seq).padStart(3, '0')}`;
}

/* ------------------------------------------------------------------ */
/* 内部工具                                                              */
/* ------------------------------------------------------------------ */

type AppointmentRow = typeof schema.appointments.$inferSelect;

/**
 * 证书/报告读权限：本人客户 或 本店 staff 或 本店商家（owner|manager）。
 * 他人一律 FORBIDDEN（杜绝泄漏其他客户数据），预约不存在 NOT_FOUND。
 */
async function assertArtifactAccess(ctx: Context, appointmentId: string): Promise<AppointmentRow> {
  const appt = await ctx.db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, appointmentId))
    .get();
  if (!appt) throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
  const user = ctx.user!;
  if (user.roles.includes('customer') && appt.customerId === user.id) return appt;
  if (user.staffId && user.storeId === appt.storeId) return appt;
  const isMerchant =
    user.roles.includes('merchant_owner') || user.roles.includes('merchant_manager');
  if (isMerchant && user.storeId === appt.storeId) return appt;
  forbidden('无权查看该预约的证书/报告');
}

/** 首读幂等置 delivered_at（仅当 NULL 时写 now；并发双读由 WHERE 条件保证只置一次）。
 *  now 截断到秒：timestamp 列=Unix 秒精度，返回值与库内复读值同帧（幂等可比）。 */
async function markDelivered(
  d: DbHandle,
  table: typeof schema.serviceCertificates | typeof schema.serviceReports,
  id: string,
): Promise<Date> {
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  await d
    .update(table)
    .set({ deliveredAt: now, updatedAt: now })
    .where(and(eq(table.id, id), isNull(table.deliveredAt)));
  return now;
}

/* ------------------------------------------------------------------ */
/* router                                                               */
/* ------------------------------------------------------------------ */

export const serviceLoopRouter = router({
  /**
   * albumFeed（customer）：服务相册聚合——本人 completed + in_service 预约，
   * 每单六步分组 + 有效照片（invalidated_at IS NULL），三次查询批拉（预约/步骤/
   * 照片各一次，替掉客户端按单 N+1）。进行中（in_service）单仅透出 status='done'
   * 步的照片（「进行中仅显示已确认步骤」口径）；寄养单无六步 → steps 空数组。
   * 排序：按 coalesce(completed_at, created_at) 倒序（完成单按完成时间、
   * 进行中单按建单时间并入同一倒序帧）。
   */
  albumFeed: customerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          appointment: schema.appointments,
          petName: schema.pets.name,
          serviceName: schema.services.name,
          storeName: schema.stores.name,
        })
        .from(schema.appointments)
        .innerJoin(schema.pets, eq(schema.pets.id, schema.appointments.petId))
        .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
        .innerJoin(schema.stores, eq(schema.stores.id, schema.appointments.storeId))
        .where(
          and(
            eq(schema.appointments.customerId, ctx.user.id),
            inArray(schema.appointments.status, ['completed', 'in_service']),
          ),
        )
        .orderBy(
          // 完成时间倒序；进行中（completed_at NULL）按建单时间并入同一倒序帧
          desc(sql`coalesce(${schema.appointments.completedAt}, ${schema.appointments.createdAt})`),
        )
        .limit(input?.limit ?? 12);

      const apptIds = rows.map((r) => r.appointment.id);
      const steps =
        apptIds.length === 0
          ? []
          : await ctx.db
              .select()
              .from(schema.appointmentSteps)
              .where(inArray(schema.appointmentSteps.appointmentId, apptIds))
              .orderBy(asc(schema.appointmentSteps.stepOrder));
      const stepIds = steps.map((s) => s.id);
      const photos =
        stepIds.length === 0
          ? []
          : await ctx.db
              .select()
              .from(schema.stepPhotos)
              .where(and(inArray(schema.stepPhotos.stepId, stepIds), isNull(schema.stepPhotos.invalidatedAt)))
              .orderBy(asc(schema.stepPhotos.takenAt), asc(schema.stepPhotos.id));

      const photosByStep = new Map<string, typeof photos>();
      for (const p of photos) {
        const arr = photosByStep.get(p.stepId);
        if (arr) arr.push(p);
        else photosByStep.set(p.stepId, [p]);
      }
      const stepsByAppt = new Map<string, typeof steps>();
      for (const s of steps) {
        const arr = stepsByAppt.get(s.appointmentId);
        if (arr) arr.push(s);
        else stepsByAppt.set(s.appointmentId, [s]);
      }

      return rows.map((r) => ({
        appointmentId: r.appointment.id,
        petName: r.petName,
        serviceName: r.serviceName,
        storeName: r.storeName,
        status: r.appointment.status,
        completedAt: r.appointment.completedAt,
        steps: (stepsByAppt.get(r.appointment.id) ?? []).map((s) => ({
          stepKey: s.stepKey,
          label: StepLabel[s.stepKey as StepKey] ?? s.stepKey,
          status: s.status,
          // 进行中口径：in_service 单仅透出 done 步的照片
          photos:
            r.appointment.status === 'in_service' && s.status !== 'done'
              ? []
              : (photosByStep.get(s.id) ?? []).map((p) => ({
                  url: p.url,
                  thumbUrl: p.thumbUrl,
                  tag: p.tag,
                })),
        })),
      }));
    }),

  /**
   * certificateFor（本人/本店）：单预约安心证书。R10 无数据不生成——无证书行
   * （交付检查步无有效 before/after 图）→ 404 明文「该服务未生成证书（无前后对比照）」。
   * 首读幂等置 delivered_at。
   */
  certificateFor: publicProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertArtifactAccess(ctx, input.appointmentId);
      const cert = await ctx.db
        .select()
        .from(schema.serviceCertificates)
        .where(eq(schema.serviceCertificates.appointmentId, input.appointmentId))
        .get();
      if (!cert) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '该服务未生成证书（无前后对比照）',
        });
      }
      const deliveredAt = cert.deliveredAt ?? (await markDelivered(ctx.db, schema.serviceCertificates, cert.id));
      return { certificate: { ...cert, deliveredAt } };
    }),

  /** reportFor（本人/本店）：单预约美容报告。无报告行 → 404 明文；首读幂等置 delivered_at。 */
  reportFor: publicProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertArtifactAccess(ctx, input.appointmentId);
      const report = await ctx.db
        .select()
        .from(schema.serviceReports)
        .where(eq(schema.serviceReports.appointmentId, input.appointmentId))
        .get();
      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '该服务未生成美容报告' });
      }
      const deliveredAt = report.deliveredAt ?? (await markDelivered(ctx.db, schema.serviceReports, report.id));
      return { report: { ...report, deliveredAt } };
    }),

  /** myCertificates（customer）：本人证书列表（生成时间倒序，上限 50） */
  myCertificates: customerProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.serviceCertificates)
      .where(eq(schema.serviceCertificates.userId, ctx.user.id))
      .orderBy(desc(schema.serviceCertificates.createdAt))
      .limit(50);
  }),

  /** myReports（customer）：本人报告列表（生成时间倒序，上限 50） */
  myReports: customerProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.serviceReports)
      .where(eq(schema.serviceReports.userId, ctx.user.id))
      .orderBy(desc(schema.serviceReports.createdAt))
      .limit(50);
  }),

  /**
   * ticketCreate（customer）：客服工单提单。联系方式缺省回显=users.phone；
   * ticketNo=TK-yyyymmdd-NNN 日序（串行锁+UNIQUE 双保险）；timeline 初始 submitted。
   */
  ticketCreate: customerProcedure
    .input(
      z.object({
        /** 关联门店（工单按本店分派给店长待办） */
        storeId: z.string().min(1),
        type: z.enum(['suggest', 'complaint', 'praise', 'other']),
        description: z.string().trim().min(1, '请填写问题描述').max(1000, '描述不能超过 1000 字'),
        photoUrls: z.array(z.string().min(1).max(1024)).max(9, '附图最多 9 张').default([]),
        /** 联系方式（缺省回显=users.phone，可改） */
        contactPhone: z.string().trim().min(3).max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      withServiceLoopWriteLock(async () => {
        const store = await ctx.db
          .select({ id: schema.stores.id })
          .from(schema.stores)
          .where(eq(schema.stores.id, input.storeId))
          .get();
        if (!store) throw new TRPCError({ code: 'NOT_FOUND', message: '门店不存在' });
        const me = await ctx.db
          .select({ phone: schema.users.phone })
          .from(schema.users)
          .where(eq(schema.users.id, ctx.user.id))
          .get();
        const now = new Date();
        return ctx.db.transaction(async (tx) => {
          const ticketNo = await genDailyNo(txDb(tx), 'TK', schema.supportTickets, now);
          const timeline: schema.TicketTimelineItem[] = [
            { action: 'submitted', at: now.toISOString(), by: ctx.user.id },
          ];
          const row = await tx
            .insert(schema.supportTickets)
            .values({
              ticketNo,
              userId: ctx.user.id,
              storeId: input.storeId,
              type: input.type,
              description: input.description,
              photoUrls: input.photoUrls,
              contactPhone: input.contactPhone ?? me?.phone ?? null, // 回显默认=users.phone
              status: 'submitted',
              timelineJson: timeline,
            })
            .returning()
            .then((r) => r[0]!);
          return { ticket: row, idempotent: false as const };
        });
      }),
    ),

  /** ticketListMine（customer）：本人工单列表（创建倒序，上限 50） */
  ticketListMine: customerProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.userId, ctx.user.id))
      .orderBy(desc(schema.supportTickets.createdAt))
      .limit(50);
  }),

  /** ticketGet（customer）：本人工单详情（含回复与时间线；他人 403） */
  ticketGet: customerProcedure
    .input(z.object({ ticketId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db
        .select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, input.ticketId))
        .get();
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: '工单不存在' });
      if (ticket.userId !== ctx.user.id) forbidden('无权查看该工单');
      return { ticket };
    }),

  /** ticketListPending（merchant 本店 owner|manager）：待回复工单（submitted，创建升序） */
  ticketListPending: merchantManagerProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.supportTickets)
      .where(
        and(
          eq(schema.supportTickets.storeId, ctx.user.storeId!),
          eq(schema.supportTickets.status, 'submitted'),
        ),
      )
      .orderBy(asc(schema.supportTickets.createdAt))
      .limit(100);
  }),

  /**
   * ticketReply（merchant 本店 owner|manager）：回复工单——reply 必填 →
   * status=replied + repliedBy/At + timeline 追加 + SSE user 频道 ticket.replied。
   * 已关闭工单拒绝回复。重复回复允许（追加时间线，回复内容覆盖为最新）。
   */
  ticketReply: merchantManagerProcedure
    .input(
      z.object({
        ticketId: z.string().min(1),
        reply: z.string().trim().min(1, '回复内容不能为空').max(1000, '回复不能超过 1000 字'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db
        .select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, input.ticketId))
        .get();
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: '工单不存在' });
      if (ticket.storeId !== ctx.user.storeId) forbidden('非本店工单，无权操作');
      if (ticket.status === 'closed') badRequest('工单已关闭，不可回复');
      const now = new Date();
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        const timeline: schema.TicketTimelineItem[] = [
          ...(ticket.timelineJson ?? []),
          { action: 'replied', at: now.toISOString(), by: ctx.user.id, note: input.reply },
        ];
        const row = await tx
          .update(schema.supportTickets)
          .set({
            status: 'replied',
            replyText: input.reply,
            repliedBy: ctx.user.id,
            repliedAt: now,
            timelineJson: timeline,
            updatedAt: now,
          })
          .where(eq(schema.supportTickets.id, ticket.id))
          .returning()
          .then((r) => r[0]!);
        outboxId = await emitEvent(txDb(tx), `user:${ticket.userId}`, EventType.TicketReplied, {
          ticketId: ticket.id,
          ticketNo: ticket.ticketNo,
          by: ctx.user.id,
        });
        return row;
      });
      broadcastNow(outboxId);
      return { ticket: updated };
    }),

  /**
   * invoiceCreate（customer）：发票申请。
   * - 本人单闸：来源单非本人一律 FORBIDDEN；
   * - 已付闸：appointment 须 paid_fen>0；cashier 须 settled 且未冲正；order 须 paid 及之后；
   * - 金额=来源单实付，服务端重算（入参 amountFen 兼容字段一律忽略，不信任前端）；
   * - titleType='business' 必填税号；personal 税号置空；delivery='email' 校验邮箱格式；
   * - 同单在途幂等：同（本人×orderKind×billId）已有 submitted 申请 → 返回原单
   *   idempotent=true；已 issued → BAD_REQUEST 明文拒。
   */
  invoiceCreate: customerProcedure
    .input(
      z.object({
        orderKind: z.enum(['appointment', 'order', 'cashier']),
        billId: z.string().min(1),
        /** 兼容入参位（客户端旧版可能带金额）：一律忽略，金额以服务端实付重算为准 */
        amountFen: z.number().int().min(0).optional(),
        titleType: z.enum(['personal', 'business']),
        title: z.string().trim().min(1, '请填写发票抬头').max(100, '抬头不能超过 100 字'),
        taxNo: z.string().trim().max(30).optional(),
        delivery: z.enum(['email', 'pickup']),
        email: z.string().trim().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      withServiceLoopWriteLock(async () => {
        /* ---- 形状校验（先于单据闸门：抬头/税号/邮箱为纯入参校验） ---- */
        if (input.titleType === 'business' && !input.taxNo) {
          badRequest('企业抬头必须填写税号');
        }
        if (input.delivery === 'email') {
          if (!input.email || !EMAIL_RE.test(input.email)) badRequest('邮箱格式不正确');
        }

        /* ---- 来源单解析：本人闸 + 已付闸 + 金额服务端重算 ---- */
        let storeId = '';
        let billNo = '';
        let amountFen = 0;
        if (input.orderKind === 'appointment') {
          const appt = await ctx.db
            .select()
            .from(schema.appointments)
            .where(eq(schema.appointments.id, input.billId))
            .get();
          if (!appt) throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
          if (appt.customerId !== ctx.user.id) forbidden('仅可为本人单据申请开票');
          if (!(appt.paidFen !== null && appt.paidFen > 0)) {
            badRequest('该预约尚未完成收款，暂不可开票');
          }
          storeId = appt.storeId;
          billNo = appt.code;
          amountFen = appt.paidFen;
        } else if (input.orderKind === 'cashier') {
          const bill = await ctx.db
            .select()
            .from(schema.cashierBills)
            .where(eq(schema.cashierBills.id, input.billId))
            .get();
          if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: '收银单不存在' });
          if (bill.customerId !== ctx.user.id) forbidden('仅可为本人单据申请开票');
          if (bill.status !== 'settled') badRequest('仅已结账的收银单可申请开票');
          if (bill.reversedAt) badRequest('该收银单已冲正，不可开票');
          storeId = bill.storeId;
          billNo = bill.billNo;
          amountFen = bill.paidFen;
        } else {
          const order = await ctx.db
            .select()
            .from(schema.orders)
            .where(eq(schema.orders.id, input.billId))
            .get();
          if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
          if (order.customerId !== ctx.user.id) forbidden('仅可为本人单据申请开票');
          if (!['paid', 'shipped', 'received'].includes(order.status)) {
            badRequest('订单未完成支付，暂不可开票');
          }
          storeId = order.storeId;
          billNo = order.orderNo;
          amountFen = order.totalFen;
        }

        /* ---- 同单幂等：在途返回原单；已开票明文拒 ---- */
        const existing = await ctx.db
          .select()
          .from(schema.invoiceRequests)
          .where(
            and(
              eq(schema.invoiceRequests.userId, ctx.user.id),
              eq(schema.invoiceRequests.orderKind, input.orderKind),
              eq(schema.invoiceRequests.billId, input.billId),
            ),
          )
          .orderBy(desc(schema.invoiceRequests.createdAt))
          .limit(1)
          .then((r) => r[0]);
        if (existing) {
          if (existing.status === 'submitted') return { request: existing, idempotent: true as const };
          badRequest(`该单据已开票（${existing.issuedInvoiceNo ?? existing.invoiceNo}），请勿重复申请`);
        }

        const now = new Date();
        return ctx.db.transaction(async (tx) => {
          const invoiceNo = await genDailyNo(txDb(tx), 'IN', schema.invoiceRequests, now);
          const row = await tx
            .insert(schema.invoiceRequests)
            .values({
              invoiceNo,
              userId: ctx.user.id,
              storeId,
              orderKind: input.orderKind,
              billId: input.billId,
              billNo,
              amountFen, // 服务端实付重算（入参金额不信任）
              titleType: input.titleType,
              title: input.title,
              taxNo: input.titleType === 'business' ? (input.taxNo ?? null) : null, // personal 税号置空
              delivery: input.delivery,
              email: input.delivery === 'email' ? (input.email ?? null) : null, // pickup 邮箱置空
              status: 'submitted',
            })
            .returning()
            .then((r) => r[0]!);
          return { request: row, idempotent: false as const };
        });
      }),
    ),

  /** invoiceListMine（customer）：本人发票申请列表（创建倒序，上限 50） */
  invoiceListMine: customerProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.invoiceRequests)
      .where(eq(schema.invoiceRequests.userId, ctx.user.id))
      .orderBy(desc(schema.invoiceRequests.createdAt))
      .limit(50);
  }),

  /** invoiceGet（customer）：本人发票申请详情（他人 403） */
  invoiceGet: customerProcedure
    .input(z.object({ requestId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const req = await ctx.db
        .select()
        .from(schema.invoiceRequests)
        .where(eq(schema.invoiceRequests.id, input.requestId))
        .get();
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '发票申请不存在' });
      if (req.userId !== ctx.user.id) forbidden('无权查看该发票申请');
      return { request: req };
    }),

  /** invoiceListPending（merchant 本店 owner|manager）：待开票申请（submitted，创建升序） */
  invoiceListPending: merchantManagerProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.invoiceRequests)
      .where(
        and(
          eq(schema.invoiceRequests.storeId, ctx.user.storeId!),
          eq(schema.invoiceRequests.status, 'submitted'),
        ),
      )
      .orderBy(asc(schema.invoiceRequests.createdAt))
      .limit(100);
  }),

  /**
   * invoiceRegister（merchant 本店 owner|manager）：登记实际发票号——invoiceNo 必填 →
   * status=issued + issuedAt/By + SSE user 频道 invoice.issued。仅 submitted 可登记。
   */
  invoiceRegister: merchantManagerProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        invoiceNo: z.string().trim().min(1, '请填写实际发票号').max(50, '发票号过长'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db
        .select()
        .from(schema.invoiceRequests)
        .where(eq(schema.invoiceRequests.id, input.requestId))
        .get();
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '发票申请不存在' });
      if (req.storeId !== ctx.user.storeId) forbidden('非本店申请，无权操作');
      if (req.status !== 'submitted') badRequest('该申请已登记开票，请勿重复操作');
      const now = new Date();
      let outboxId = '';
      const updated = await ctx.db.transaction(async (tx) => {
        const row = await tx
          .update(schema.invoiceRequests)
          .set({
            status: 'issued',
            issuedInvoiceNo: input.invoiceNo,
            issuedAt: now,
            issuedBy: ctx.user.id,
            updatedAt: now,
          })
          .where(eq(schema.invoiceRequests.id, req.id))
          .returning()
          .then((r) => r[0]!);
        outboxId = await emitEvent(txDb(tx), `user:${req.userId}`, EventType.InvoiceIssued, {
          requestId: req.id,
          invoiceNo: req.invoiceNo,
          issuedInvoiceNo: input.invoiceNo,
          by: ctx.user.id,
        });
        return row;
      });
      broadcastNow(outboxId);
      return { request: updated };
    }),

  /** serviceHours（登录即可读）：客服服务时间公示（service_rules.service_hours 生效行） */
  serviceHours: publicProcedure.query(async ({ ctx }) => {
    const row = await ctx.db
      .select({ valueJson: schema.serviceRules.valueJson })
      .from(schema.serviceRules)
      .where(and(eq(schema.serviceRules.ruleKey, 'service_hours'), eq(schema.serviceRules.active, true)))
      .orderBy(desc(schema.serviceRules.version))
      .limit(1)
      .then((r) => r[0]);
    const text = typeof row?.valueJson?.text === 'string' ? row.valueJson.text : null;
    return { text };
  }),
});

export type ServiceLoopRouter = typeof serviceLoopRouter;
