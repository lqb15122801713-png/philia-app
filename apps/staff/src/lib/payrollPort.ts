/**
 * 薪资/XP 申诉域 · 端口接口与类型锚点（员工端 薪资/XP 面扩 · coder K）
 *
 * server 侧 payroll namespace（工资条/扣减异议/申诉复核）与 xp 申报口
 * （raiseApplication/myApplications）由 coder J 并行施工（施工单冻结签名）；
 * AppRouter 尚未含这些口，故本文件按冻结契约定义结构接口，trpc 经一次结构
 * 断言接入（payrollOf）——类型锚点集中在本文，集成期 server 落地后若签名漂移
 * 只改本文件对齐。调用纪律同 lib/collabPort.ts：query 走 useQuery，
 * mutation 后 invalidateQueries。
 *
 * 冻结契约（施工单）：
 * - payroll.mySlip.query({month:'YYYY-MM'}) → {item: SlipItem|null}；
 * - payroll.raiseAppeal.mutate({targetKind, targetId, month, reason, evidenceUrls?})；
 * - payroll.myAppeals.query() → 申诉列表（状态/复核注/返还额透出）；
 * - payroll.appealSlaHours.query() → {hours}（service_rules 口径，缺省回落 24）；
 * - xp.raiseApplication.mutate({appKind:'award'|'revoke_appeal', targetEventId?,
 *   pointsRequested, reason}) / xp.myApplications.query()。
 *
 * 待 J 对齐点（集成期核对）：
 * 1. myAppeals / myApplications 返回形——本文件按 {appeals}|{applications} 包裹或
 *    裸数组两形都收（listAppeals/listApplications 归一），落地后定一形可收紧；
 * 2. slip_line 申诉 targetId——契约未给 slip 行 id，暂取 item.id ?? item.month；
 * 3. PayAppeal.refundFen / XpApplication.resolvedEventId 字段名（返还额/落分回链）。
 */

import type { usePhiliaClient } from '@philia/shared';

type Trpc = ReturnType<typeof usePhiliaClient>['trpc'];

/* ------------------------------------------------------------------ */
/* payroll：工资条 + 扣减/工资条/调整项异议                                 */
/* ------------------------------------------------------------------ */

export interface PaySlipItem {
  /** 契约未列 id；slip_line 申诉 targetId 缺省回落 month（见文件头待对齐点 2） */
  id?: string;
  month: string;
  commissionFen: number;
  performanceFen: number;
  deductionFen: number;
  adjustmentFen: number;
  netFen: number;
  /** 发放标记留痕时刻（非 null=已发放标记；不碰真钱口径） */
  markedAt: Date | string | null;
  payloadJson?: unknown;
}

export type AppealTargetKind = 'deduction' | 'slip_line' | 'adjustment';

export interface PayAppeal {
  id: string;
  targetKind: AppealTargetKind | string;
  targetId: string;
  month: string;
  reason: string;
  evidenceUrls: string[];
  /** pending | approved | rejected（未知值按 pending 透出） */
  status: string;
  reviewNote: string | null;
  /** 复核通过后的返还额（分）；无=null */
  refundFen: number | null;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
}

/* ------------------------------------------------------------------ */
/* xp：积分申报 / 扣分异议                                                */
/* ------------------------------------------------------------------ */

export type XpAppKind = 'award' | 'revoke_appeal';

export interface XpApplication {
  id: string;
  appKind: XpAppKind | string;
  targetEventId: string | null;
  pointsRequested: number;
  reason: string;
  /** pending | approved | rejected（未知值按 pending 透出） */
  status: string;
  reviewNote: string | null;
  /** approved 落分后生成的事件 id（回链注记用）；无=null */
  resolvedEventId?: string | null;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
}

/* ------------------------------------------------------------------ */
/* 端口结构（冻结契约签名；payrollOf 一次断言接入）                        */
/* ------------------------------------------------------------------ */

export interface PayrollPort {
  payroll: {
    mySlip: { query(input: { month: string }): Promise<{ item: PaySlipItem | null }> };
    raiseAppeal: {
      mutate(input: {
        targetKind: AppealTargetKind;
        targetId: string;
        month: string;
        reason: string;
        evidenceUrls?: string[];
      }): Promise<unknown>;
    };
    myAppeals: { query(): Promise<{ appeals: PayAppeal[] } | PayAppeal[]> };
    appealSlaHours: { query(): Promise<{ hours: number }> };
  };
  xpApps: {
    raiseApplication: {
      mutate(input: {
        appKind: XpAppKind;
        targetEventId?: string;
        pointsRequested: number;
        reason: string;
      }): Promise<unknown>;
    };
    myApplications: { query(): Promise<{ applications: XpApplication[] } | XpApplication[]> };
  };
}

/** trpc → 薪资/XP 申诉域端口（结构断言；server 侧 namespace 落地后等价直读） */
export function payrollOf(trpc: Trpc): PayrollPort {
  const raw = trpc as unknown as {
    payroll: PayrollPort['payroll'];
    xp: {
      raiseApplication: unknown;
      myApplications: unknown;
    };
  };
  return {
    payroll: raw.payroll,
    xpApps: {
      raiseApplication: raw.xp.raiseApplication as PayrollPort['xpApps']['raiseApplication'],
      myApplications: raw.xp.myApplications as PayrollPort['xpApps']['myApplications'],
    },
  };
}

/* ------------------------------------------------------------------ */
/* 返回形归一（包裹/裸数组两形都收，集成期定形后可删）                      */
/* ------------------------------------------------------------------ */

export function listAppeals(data: { appeals?: PayAppeal[]; items?: PayAppeal[] } | PayAppeal[] | undefined): PayAppeal[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.appeals ?? data.items ?? []);
}

export function listApplications(
  data: { applications?: XpApplication[]; items?: XpApplication[] } | XpApplication[] | undefined,
): XpApplication[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.applications ?? data.items ?? []);
}

/* ------------------------------------------------------------------ */
/* service_rules 端口值读取（读失败/坏值一律回落缺省，页面不因此报错）      */
/* ------------------------------------------------------------------ */

/** 申诉复核时限（小时）：payroll.appealSlaHours（server 读 service_rules）；读失败缺省 24 */
export async function readAppealSlaHours(port: PayrollPort): Promise<number> {
  try {
    const r = await port.payroll.appealSlaHours.query();
    return Number.isFinite(r.hours) && r.hours > 0 ? r.hours : 24;
  } catch {
    return 24;
  }
}
