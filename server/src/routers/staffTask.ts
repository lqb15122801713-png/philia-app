/**
 * 任务总线骨架 router（员工端骨架整建批 · 片 1 · 冻结版 §二.B5 底座先行）
 *
 * staff_tasks 只读投影：聚合既有域在途件（预约执行/审批待办/盘点/寄养照护）——
 * **不建第二口径不写业务表**（零新表零写入，全部读既有表直出）；
 * 新任务类型=注册表留口（TASK_KIND 族扩展即入，槽位/文案端口同族工艺）。
 *
 * 端点：listMy（staffProcedure）——本人（美容师=指派我的；前台=本店今日）在途任务列表。
 * 权限：审批待办仅 manager/owner 视界（merchant_manager/merchant_owner 角色判定）；
 * 盘点/寄养照护=本店全员可见（提示位，执行页自带权限闸）。
 */
import { and, desc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { schema } from '../db';
import { staffProcedure, router } from '../trpc';
import { storeDayStartMs, storeWallclock } from './appointment';

/** 任务类型注册表（留口：新类型=此处加行 + 聚合段加源） */
export type StaffTaskKind = 'appointment' | 'approval' | 'inventory' | 'boarding';

export interface StaffTask {
  kind: StaffTaskKind;
  refId: string;
  /** 标题（如「旺财 · 基础洗护（小型犬）」） */
  title: string;
  /** mono 副行（时刻/状态） */
  sub: string;
  /** 跳转（前端路由） */
  link: string;
  /** 异常强调（赭红语义：待审批/待过账/超期） */
  alert: boolean;
}

export const staffTaskRouter = router({
  listMy: staffProcedure.query(async ({ ctx }) => {
    const staffId = ctx.user.staffId!;
    const storeId = ctx.user.storeId!;
    const isManager = ctx.user.roles.includes('merchant_owner') || ctx.user.roles.includes('merchant_manager');
    /* 岗位读 staff.role（frontdesk=前台/groomer=美容师；SessionUser 不带此字段，每请求直查） */
    const staffRow = await ctx.db
      .select({ role: schema.staff.role })
      .from(schema.staff)
      .where(eq(schema.staff.id, staffId))
      .get();
    const isFrontdesk = staffRow?.role === 'frontdesk';
    const now = new Date();
    const w = storeWallclock(now);
    const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const tasks: StaffTask[] = [];

    /* ---- 预约执行（既有域）：今日 confirmed/in_service——美容师=指派我的，前台=本店今日 ---- */
    const apptConds = [
      eq(schema.appointments.storeId, storeId),
      inArray(schema.appointments.status, ['confirmed', 'in_service']),
      gte(schema.appointments.scheduledStart, dayStart),
      lt(schema.appointments.scheduledStart, dayEnd),
    ];
    if (!isFrontdesk) apptConds.push(eq(schema.appointments.staffId, staffId));
    const appts = await ctx.db
      .select({
        id: schema.appointments.id,
        status: schema.appointments.status,
        scheduledStart: schema.appointments.scheduledStart,
        petName: schema.pets.name,
        serviceName: schema.services.name,
        staffId: schema.appointments.staffId,
      })
      .from(schema.appointments)
      .leftJoin(schema.pets, eq(schema.pets.id, schema.appointments.petId))
      .leftJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
      .where(and(...apptConds))
      .orderBy(schema.appointments.scheduledStart);
    const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    for (const a of appts) {
      tasks.push({
        kind: 'appointment',
        refId: a.id,
        title: `${a.petName ?? '宠物'} · ${a.serviceName ?? '服务'}`,
        sub: `${hm(a.scheduledStart)} · ${a.status === 'in_service' ? '服务中' : '已确认待开始'}`,
        link: a.status === 'in_service' ? `/execute/${a.id}` : '/schedule',
        alert: a.status === 'in_service',
      });
    }

    /* ---- 审批待办（店长/店主视界）：本店 pending 补卡/异常申诉 ---- */
    if (isManager) {
      const approvals = await ctx.db
        .select({
          id: schema.attendanceApprovals.id,
          type: schema.attendanceApprovals.type,
          date: schema.attendanceApprovals.date,
          staffName: schema.users.nickname,
        })
        .from(schema.attendanceApprovals)
        .leftJoin(schema.staff, eq(schema.staff.id, schema.attendanceApprovals.staffId))
        .leftJoin(schema.users, eq(schema.users.id, schema.staff.userId))
        .where(and(eq(schema.attendanceApprovals.storeId, storeId), eq(schema.attendanceApprovals.status, 'pending')))
        .orderBy(schema.attendanceApprovals.createdAt);
      for (const a of approvals) {
        tasks.push({
          kind: 'approval',
          refId: a.id,
          title: `${a.staffName ?? '员工'} · ${a.type === 'makeup' ? '补卡申请' : '考勤异常申诉'}`,
          sub: `${a.date} · 待审批`,
          link: '/manager',
          alert: true,
        });
      }
    }

    /* ---- 盘点（既有域）：本店 draft=待录入 / counted=待过账 ---- */
    const counts = await ctx.db
      .select({ id: schema.inventoryCounts.id, status: schema.inventoryCounts.status })
      .from(schema.inventoryCounts)
      .where(and(eq(schema.inventoryCounts.storeId, storeId), inArray(schema.inventoryCounts.status, ['draft', 'counted'])))
      .orderBy(desc(schema.inventoryCounts.createdAt))
      .limit(5);
    for (const c of counts) {
      tasks.push({
        kind: 'inventory',
        refId: c.id,
        title: c.status === 'draft' ? '盘点单待录入' : '盘点单待过账',
        sub: c.status === 'draft' ? '草稿 · 行项录入中' : '已实盘 · 待店长过账',
        link: c.status === 'draft' ? `/inventory/${c.id}` : '/inventory',
        alert: c.status === 'counted',
      });
    }

    /* ---- 寄养照护（既有域）：本店在住且今日日志缺 ---- */
    const todayStr = `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
    const stays = await ctx.db
      .select({
        id: schema.boardingStays.id,
        appointmentId: schema.boardingStays.appointmentId,
        petName: schema.pets.name,
      })
      .from(schema.boardingStays)
      .leftJoin(schema.appointments, eq(schema.appointments.id, schema.boardingStays.appointmentId))
      .leftJoin(schema.pets, eq(schema.pets.id, schema.appointments.petId))
      .where(and(eq(schema.appointments.storeId, storeId), isNull(schema.boardingStays.checkoutAt)));
    for (const s of stays) {
      const log = await ctx.db
        .select({ id: schema.boardingDailyLogs.id })
        .from(schema.boardingDailyLogs)
        .where(and(eq(schema.boardingDailyLogs.stayId, s.id), eq(schema.boardingDailyLogs.logDate, todayStr)))
        .get();
      if (!log) {
        tasks.push({
          kind: 'boarding',
          refId: s.id,
          title: `${s.petName ?? '宠物'} · 今日寄养照护`,
          sub: '在住 · 今日照护未打卡',
          link: `/boarding/${s.appointmentId}/checkin`,
          alert: true,
        });
      }
    }

    return { tasks, generatedAt: now };
  }),
});
