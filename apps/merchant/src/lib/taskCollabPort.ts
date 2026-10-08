/**
 * 任务协同域 · server 契约桥（员工端骨架整建批 片 3 · 商家端）
 *
 * 背景：taskExec / pdca / selfCheck / announce / staffExit 五个命名空间与
 * cashier 系 handover 扩展由 coder G 并行施工（契约签名冻结于任务书），
 * 本片提交时 AppRouter 类型尚未含这些命名空间。故本文件以手写接口钉住契约
 * 形状、经 unknown 收窄桥接（与 lib/schedulePort.ts 的 inferRouterOutputs
 * 推导同位——server 路由落地后本桥整体退役改推导，页面调用面不变）。
 *
 * 返回形状按任务书口径推断（集成期对齐项，页面已做防御渲染）：
 * - taskExec.templates → { templates }；taskExec.listRuns → { runs }（runs 携模板名/完成人名）
 * - pdca.list → { issues }（issue 携 raisedByName/timeline 透出）；pdca.summary → { byStatus, byCategory, closed30d }
 * - selfCheck.listPending → { runs }（run 携 items 快照+score+filledByName）
 * - announce.list → { announcements }（manager 视界含 archived+readCount，targetTotal 可选透出作 x/y 分母）
 * - announce.reads → { read: [{staffId,name,readAt}], unread: [{staffId,name}] }
 * - cashier.handoverOf → { handover | null }（washing=server 闭班自动快照的在洗清单）
 * - staffExit.listHandoffs → { handoffs }（前后值留痕，仿 reception_logs 口径）
 */

import type { usePhiliaClient } from '@philia/shared';

type Trpc = ReturnType<typeof usePhiliaClient>['trpc'];

/* ------------------------------------------------------------------ */
/* 契约形状（字段名对齐 server/drizzle/0031_task_collab_domain.sql）        */
/* ------------------------------------------------------------------ */

export interface TaskTemplateRow {
  id: string;
  title: string;
  detail: string | null;
  assignScope: 'role' | 'staff';
  assignRole: string | null;
  assignStaffId: string | null;
  freq: 'daily' | 'weekly';
  /** schema 口径 1=周一…0=周日（daily 为空数组） */
  weekdays: number[];
  /** 截止时刻=当日起算分钟数 */
  dueMin: number;
  remindMin: number | null;
  active: boolean;
}

export interface TaskRunRow {
  id: string;
  bizDate: string;
  templateId: string;
  templateTitle: string;
  /** 落实人名（staffId→staff.name 透出；role 指派无人认领为 null） */
  staffName: string | null;
  status: string;
  doneByName: string | null;
  doneAt: Date | string | null;
}

export interface UpsertTaskTemplateInput {
  id?: string;
  title: string;
  detail?: string;
  assignScope: 'role' | 'staff';
  assignRole?: string;
  assignStaffId?: string;
  freq: 'daily' | 'weekly';
  weekdays: number[];
  dueMin: number;
  remindMin?: number;
}

export interface PdcaTimelineEntry {
  at: Date | string;
  action: string;
  by?: string | null;
  note?: string | null;
}

export interface PdcaIssueRow {
  id: string;
  title: string;
  detail: string | null;
  category: string | null;
  photoUrls: string[] | null;
  raisedByName: string | null;
  assignStaffId: string | null;
  status: string;
  fixNote: string | null;
  fixedAt: Date | string | null;
  recheckNote: string | null;
  recheckAt: Date | string | null;
  recheckResult: string | null;
  timeline: PdcaTimelineEntry[];
  createdAt: Date | string;
}

export interface PdcaSummary {
  byStatus: Record<string, number>;
  byCategory: Array<{ category: string; count: number }>;
  closedLast30d: number;
  total: number;
}

export interface SelfCheckItem {
  key: string;
  label: string;
  score: number;
  passed?: boolean;
  note?: string | null;
  photoUrl?: string | null;
}

export interface SelfCheckRunRow {
  id: string;
  bizDate: string;
  items: SelfCheckItem[];
  score: number;
  filledByName: string | null;
  status: string;
  createdAt: Date | string;
}

export type AnnounceTargetRole = 'all' | 'frontdesk' | 'groomer';

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  targetRole: AnnounceTargetRole;
  pinned: boolean;
  status: string; // draft | published | archived（片 2 两步流新增 draft）
  publishedAt: Date | string;
  readCount: number;
  /** x/y 分母（定向应读人数）；server 未透出时缺省，页面降级只显分子 */
  targetTotal?: number | null;
  /** 片 2 起止窗口（NULL=不限；staff 读口懒算过滤，管理端透出展示） */
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}

export interface AnnounceReads {
  read: Array<{ staffId: string; name: string; readAt: Date | string }>;
  unread: Array<{ staffId: string; name: string }>;
}

export interface HandoverInput {
  keysNote?: string;
  cashNote?: string;
  complaintsNote?: string;
  toUserId?: string;
}

export interface HandoverLog {
  id: string;
  shiftId: string;
  /** 在洗清单（server 闭班时自动快照；形状防御渲染） */
  washing: Array<Record<string, unknown>> | null;
  keysNote: string | null;
  cashNote: string | null;
  complaintsNote: string | null;
  fromUserName: string | null;
  toUserName: string | null;
  createdAt: Date | string;
}

export interface ExitHandoffRow {
  id: string;
  kind: string;
  refId: string;
  fromStaffId: string;
  toStaffId: string | null;
  toStaffName?: string | null;
  prevValue: string | null;
  newValue: string | null;
  note: string | null;
  changedByName?: string | null;
  createdAt: Date | string;
}

/* ------------------------------------------------------------------ */
/* 客户端收窄桥                                                          */
/* ------------------------------------------------------------------ */

export interface TaskCollabClient {
  taskExec: {
    templates: { query(): Promise<{ templates: TaskTemplateRow[] }> };
    upsertTemplate: { mutate(input: UpsertTaskTemplateInput): Promise<unknown> };
    deactivateTemplate: { mutate(input: { id: string }): Promise<unknown> };
    listRuns: { query(input: { from: string; to: string }): Promise<{ runs: TaskRunRow[] }> };
  };
  pdca: {
    list: { query(input: { status?: string }): Promise<{ issues: PdcaIssueRow[] }> };
    recheck: { mutate(input: { issueId: string; result: 'pass' | 'fail'; note: string }): Promise<unknown> };
    summary: { query(): Promise<PdcaSummary> };
  };
  selfCheck: {
    listPending: { query(): Promise<{ runs: SelfCheckRunRow[] }> };
    review: { mutate(input: { runId: string; note: string }): Promise<unknown> };
  };
  announce: {
    publish: {
      mutate(input: { title: string; body: string; targetRole: AnnounceTargetRole; pinned?: boolean }): Promise<unknown>;
    };
    list: { query(): Promise<{ announcements: AnnouncementRow[] }> };
    reads: { query(input: { announcementId: string }): Promise<AnnounceReads> };
    archive: { mutate(input: { id: string }): Promise<unknown> };
    /* 端口批收尾片 2：两步流（saveDraft→publishDraft）+ 回收站软删（remove） */
    saveDraft: {
      mutate(input: {
        id?: string;
        title: string;
        body: string;
        targetRole: AnnounceTargetRole;
        pinned: boolean;
      }): Promise<{ created: boolean }>;
    };
    publishDraft: { mutate(input: { id: string; startsAt?: string; endsAt?: string }): Promise<unknown> };
    remove: { mutate(input: { announcementId: string }): Promise<unknown> };
  };
  staffExit: {
    reassignAppointments: {
      mutate(input: { fromStaffId: string; toStaffId: string; note?: string }): Promise<{ moved: number }>;
    };
    listHandoffs: { query(input: { staffId: string }): Promise<{ handoffs: ExitHandoffRow[] }> };
  };
}

/** 任务协同域客户端（server 落地前经 unknown 收窄；落地后改 inferRouterOutputs 推导） */
export function collabOf(trpc: Trpc): TaskCollabClient {
  return trpc as unknown as TaskCollabClient;
}

/** cashier 系 handover 扩展桥（closeShift 加可选 handover 入参 + handoverOf 读口） */
export interface CashierHandoverBridge {
  closeShift: { mutate(input?: { handover?: HandoverInput }): Promise<unknown> };
  handoverOf: { query(input: { shiftId: string }): Promise<{ handover: HandoverLog | null }> };
}

export function cashierHandoverOf(trpc: Trpc): CashierHandoverBridge {
  return trpc.cashier as unknown as CashierHandoverBridge;
}
