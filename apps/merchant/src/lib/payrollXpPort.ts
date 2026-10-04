/**
 * 薪资/XP 管理域 · server 契约桥（员工端骨架整建批 片 4 B3 · 商家端）
 *
 * 背景：payroll 命名空间与 xp 命名空间的 listApplications/reviewApplication
 * 扩展由 coder J 并行施工（契约签名冻结于任务书），本片提交时 AppRouter 类型
 * 尚未含这些端点。故本文件以手写接口钉住契约形状、经 unknown 收窄桥接
 * （工艺照 lib/taskCollabPort.ts——server 路由落地后本桥整体退役改推导，
 * 页面调用面不变）。
 *
 * 返回形状按任务书/0033_payroll_xp_domain.sql 口径推断（集成期对齐项，
 * 页面已做防御渲染）：
 * - payroll.listRun → { run, items }（item 携 staffName 透出；markedBy=userId 原样）
 * - payroll.listAppeals → { appeals }（appeal 携 staffName/targetAmountFen/
 *   targetLabel 透出——后两个为审批默认值与目标单行渲染所需，见页内注释）
 * - payroll.listDeductions → { deductions }（罚单表读口，含 status=reverted
 *   已返还灰态；此端点为 UI 侧补充需求，集成期请 coder J 对齐签名）
 * - payroll.collabOf → { appointment, collaborators, defaultSplitBp }
 * - xp.listApplications → { applications }（携 staffName；revoke_appeal 携
 *   targetEventPoints 原负分值，透出供审批人比对）
 */

import type { usePhiliaClient } from '@philia/shared';

type Trpc = ReturnType<typeof usePhiliaClient>['trpc'];

/* ------------------------------------------------------------------ */
/* 契约形状（字段名对齐 server/drizzle/0033_payroll_xp_domain.sql）        */
/* ------------------------------------------------------------------ */

export interface PayrollRunRow {
  id: string;
  month: string; // 'YYYY-MM'
  status: string; // generated | confirmed
  generatedAt: Date | string;
  confirmedAt: Date | string | null;
}

export interface PayrollItemRow {
  id: string;
  staffId: string;
  staffName: string | null;
  commissionFen: number;
  performanceFen: number;
  deductionFen: number;
  /** 调整项（带符号：负=跨月回冲，正=补调） */
  adjustmentFen: number;
  netFen: number;
  markedAt: Date | string | null;
  markedBy: string | null;
}

export interface PayrollAppealRow {
  id: string;
  staffId: string;
  staffName: string | null;
  /** deduction（扣款/罚单）| slip_line（工资条行）| adjustment（调整项） */
  targetKind: string;
  targetId: string;
  month: string;
  reason: string;
  evidenceUrls: string[] | null;
  status: string; // pending | approved | rejected
  reviewNote: string | null;
  reviewedAt: Date | string | null;
  refundFen: number | null;
  createdAt: Date | string;
  /** 申诉目标原额（分；target=deduction 时为罚单原额，批准默认值用——透出列集成期对齐） */
  targetAmountFen?: number | null;
  /** 申诉目标单行摘要（如罚单原因；透出列集成期对齐） */
  targetLabel?: string | null;
}

export interface DeductionRow {
  id: string;
  staffId: string;
  staffName: string | null;
  month: string;
  amountFen: number;
  reason: string;
  status: string; // active | reverted
  createdBy: string;
  createdAt: Date | string;
  revertedAt: Date | string | null;
  revertNote: string | null;
}

export interface CollaboratorRow {
  id: string;
  staffId: string;
  staffName: string | null;
  /** 协作角色注记（wash|groom|assist；文案走端口） */
  role: string;
  /** 拆分比例（万分比 bp，如 4000=40%） */
  splitBp: number;
}

export interface CollabOfResult {
  appointment: { id: string; status: string; staffId: string | null };
  collaborators: CollaboratorRow[];
  /** 建议拆分比（bp；编辑态默认值来源） */
  defaultSplitBp: number;
}

export interface CollaboratorInput {
  staffId: string;
  role: string;
  splitBp: number;
}

export interface XpApplicationRow {
  id: string;
  staffId: string;
  staffName: string | null;
  /** award（积分申报）| revoke_appeal（扣分异议，挂原 penalty 事件） */
  appKind: string;
  targetEventId: string | null;
  pointsRequested: number;
  reason: string;
  status: string; // pending | approved | rejected
  reviewNote: string | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  /** revoke_appeal 原事件分值（负数；透出供审批比对——透出列集成期对齐） */
  targetEventPoints?: number | null;
}

/* ------------------------------------------------------------------ */
/* 客户端收窄桥                                                          */
/* ------------------------------------------------------------------ */

export interface PayrollClient {
  generateMonth: { mutate(input: { month: string }): Promise<{ run: PayrollRunRow; items: PayrollItemRow[] }> };
  listRun: { query(input: { month: string }): Promise<{ run: PayrollRunRow | null; items: PayrollItemRow[] }> };
  confirmRun: { mutate(input: { month: string }): Promise<unknown> };
  markDisbursed: { mutate(input: { itemId: string; methodNote?: string }): Promise<unknown> };
  listAppeals: { query(input: { status?: string }): Promise<{ appeals: PayrollAppealRow[] }> };
  reviewAppeal: {
    mutate(input: { appealId: string; result: 'approved' | 'rejected'; note: string; refundFen?: number }): Promise<unknown>;
  };
  setCollaborators: {
    mutate(input: { appointmentId: string; collaborators: CollaboratorInput[] }): Promise<unknown>;
  };
  collabOf: { query(input: { appointmentId: string }): Promise<CollabOfResult> };
  /** 罚单表读口（UI 侧补充需求：近 20 条含 reverted 灰态；集成期对齐签名） */
  listDeductions: { query(input: { month?: string }): Promise<{ deductions: DeductionRow[] }> };
}

/** payroll 命名空间客户端（server 落地前经 unknown 收窄；落地后改 inferRouterOutputs 推导） */
export function payrollOf(trpc: Trpc): PayrollClient {
  return (trpc as unknown as { payroll: PayrollClient }).payroll;
}

export interface XpAdminClient {
  listApplications: { query(input: { status?: string }): Promise<{ applications: XpApplicationRow[] }> };
  reviewApplication: {
    mutate(input: { applicationId: string; result: 'approved' | 'rejected'; note: string }): Promise<unknown>;
  };
}

/** xp 命名空间审核扩展桥（仅收窄本页用的两个端点，xp 其余端点原样走 trpc.xp） */
export function xpAdminOf(trpc: Trpc): XpAdminClient {
  return (trpc as unknown as { xp: XpAdminClient }).xp;
}
