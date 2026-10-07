/**
 * 薪资管理 /payroll（员工端骨架整建批 片 4 B3 · 商家端）
 *
 * 一页三竖排分区（u3-panel 竖排工艺照 OpsPage）：
 * - 区 1 工资条：月份选择 → 生成工资条（payroll.generateMonth）→ run 两态徽
 *   （generated 待确认 / confirmed 已定稿）+ 老板确认钮（confirmRun）→ 员工行表
 *   （提成/绩效/扣减/调整项/净额 + 发放标记态）→ 行内标记发放（methodNote 选填
 *   走 Modal；已标记灰态 + 标记人/时刻透出）。注记明面：发放=标记留痕不碰真钱。
 * - 区 2 薪资申诉审批：payroll.listAppeals（状态滤签）→ 行内展开（目标单/理由/
 *   附图）→ 批准（refundFen 默认原额可改）/驳回（note 必填走 Modal）→ 历史留痕。
 * - 区 3 罚单录入：commission.createDeduction 表单（员工/月份/金额/原因）+
 *   近 20 条罚单表（payroll.listDeductions；reverted 灰态「已返还」）。
 *
 * server payroll 命名空间由 coder J 并行施工，契约经 lib/payrollXpPort.ts 收窄
 * 桥接。权限三层照排班页：MerchantRail groupsFor 分流 + ClerkRouteGuard +
 * 页内 useMerchantRole 非 owner/manager → RoleGuidePage。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg, fmtMoney } from '../components/staff-admin/format';
import type { StaffRow } from '../components/staff-admin/types';
import { Badge, Btn, Field, inputCls, Modal, toast, ToasterMount } from '../components/staff-admin/ui';
import { py } from '../copy/payroll';
import { payrollOf, type PayrollAppealRow, type PayrollItemRow } from '../lib/payrollXpPort';
import { useMerchantRole } from '../lib/roles';

/* ------------------------------------------------------------------ */
/* 助手                                                                */
/* ------------------------------------------------------------------ */

function fmtAt(at: Date | string | null | undefined): string {
  if (!at) return '—';
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 当前月份 'YYYY-MM'（本地口径） */
function nowMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 元串 → 分（两位小数硬校验；非法返回 null） */
function yuanToFen(raw: string, allowZero: boolean): number | null {
  const s = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const fen = Math.round(Number(s) * 100);
  if (!Number.isFinite(fen)) return null;
  if (allowZero ? fen < 0 : fen <= 0) return null;
  return fen;
}

const APPEAL_STATUS_KEYS = ['pending', 'approved', 'rejected'] as const;

function appealStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return py('payroll.appeal.statusPending');
    case 'approved':
      return py('payroll.appeal.statusApproved');
    case 'rejected':
      return py('payroll.appeal.statusRejected');
    default:
      return status;
  }
}

function appealStatusTone(status: string): 'brand' | 'success' | 'danger' | 'muted' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'muted';
  if (status === 'pending') return 'brand';
  return 'muted';
}

function appealKindLabel(kind: string): string {
  switch (kind) {
    case 'deduction':
      return py('payroll.appeal.kindDeduction');
    case 'slip_line':
      return py('payroll.appeal.kindSlipLine');
    case 'adjustment':
      return py('payroll.appeal.kindAdjustment');
    default:
      return kind;
  }
}

/** 审批弹层诉求（批准=返还额可改+意见选填；驳回=意见必填） */
type AppealAsk = { kind: 'approve' | 'reject'; appeal: PayrollAppealRow };

/** 标记发放弹层诉求 */
type MarkAsk = { item: PayrollItemRow };

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function PayrollPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();
  const payroll = useMemo(() => payrollOf(trpc), [trpc]);

  /* ---- 区 1 工资条 ---- */
  const [month, setMonth] = useState(nowMonth());
  const runQ = useQuery({
    queryKey: ['payroll', 'run', month],
    queryFn: () => payroll.listRun.query({ month }),
  });
  const [genBusy, setGenBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  /* ---- 区 2 申诉审批 ---- */
  const [appealFilter, setAppealFilter] = useState<string>('pending');
  const appealsQ = useQuery({
    queryKey: ['payroll', 'appeals', appealFilter],
    queryFn: () => payroll.listAppeals.query(appealFilter === 'all' ? {} : { status: appealFilter }),
  });
  const [expandAppeal, setExpandAppeal] = useState<string | null>(null);

  /* ---- 区 3 罚单 ---- */
  const staffQ = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
  });
  const staffRows = useMemo(
    () => ((staffQ.data?.staff ?? []) as StaffRow[]).filter((s) => s.status === 'active'),
    [staffQ.data],
  );
  const deductionsQ = useQuery({
    queryKey: ['payroll', 'deductions', month],
    queryFn: () => payroll.listDeductions.query({ month }),
  });
  const [dStaffId, setDStaffId] = useState('');
  const [dMonth, setDMonth] = useState(nowMonth());
  const [dAmount, setDAmount] = useState('');
  const [dReason, setDReason] = useState('');
  const [dedBusy, setDedBusy] = useState(false);

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['payroll'] });

  /* ---- 弹层（标记发放 / 申诉审批） ---- */
  const [markAsk, setMarkAsk] = useState<MarkAsk | null>(null);
  const [methodNote, setMethodNote] = useState('');
  const [markBusy, setMarkBusy] = useState(false);
  const openMark = (item: PayrollItemRow) => {
    setMethodNote('');
    setMarkAsk({ item });
  };
  const submitMark = async () => {
    if (!markAsk) return;
    setMarkBusy(true);
    try {
      await payroll.markDisbursed.mutate({
        itemId: markAsk.item.id,
        ...(methodNote.trim() ? { methodNote: methodNote.trim() } : {}),
      });
      toast(py('payroll.slip.markDone'));
      setMarkAsk(null);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setMarkBusy(false);
    }
  };

  const [appealAsk, setAppealAsk] = useState<AppealAsk | null>(null);
  const [appealNote, setAppealNote] = useState('');
  const [refundYuan, setRefundYuan] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);
  const openAppealAsk = (a: AppealAsk) => {
    setAppealNote('');
    // 返还额默认原额（targetAmountFen 透出列集成期对齐；未透出时留空待手填）
    const base = a.appeal.targetAmountFen;
    setRefundYuan(base != null ? (base / 100).toFixed(2) : '');
    setAppealAsk(a);
  };
  const submitAppealAsk = async () => {
    if (!appealAsk) return;
    if (appealAsk.kind === 'reject' && !appealNote.trim()) {
      toast(py('payroll.appeal.noteRequired'), 'error');
      return;
    }
    let refundFen: number | undefined;
    if (appealAsk.kind === 'approve' && appealAsk.appeal.targetKind === 'deduction' && refundYuan.trim()) {
      const fen = yuanToFen(refundYuan, true);
      if (fen === null) {
        toast(py('payroll.appeal.refundInvalid'), 'error');
        return;
      }
      refundFen = fen;
    }
    setAppealBusy(true);
    try {
      await payroll.reviewAppeal.mutate({
        appealId: appealAsk.appeal.id,
        result: appealAsk.kind === 'approve' ? 'approved' : 'rejected',
        note: appealNote.trim(),
        ...(refundFen !== undefined ? { refundFen } : {}),
      });
      toast(appealAsk.kind === 'approve' ? py('payroll.appeal.approved') : py('payroll.appeal.rejected'));
      setAppealAsk(null);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setAppealBusy(false);
    }
  };

  const generate = async () => {
    setGenBusy(true);
    try {
      await payroll.generateMonth.mutate({ month });
      toast(py('payroll.slip.generated'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setGenBusy(false);
    }
  };

  const confirmRun = async () => {
    setConfirmBusy(true);
    try {
      await payroll.confirmRun.mutate({ month });
      toast(py('payroll.slip.confirmed'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setConfirmBusy(false);
    }
  };

  const createDeduction = async () => {
    const amountFen = yuanToFen(dAmount, false);
    if (!dStaffId || !dReason.trim()) {
      toast(py('payroll.ded.invalid'), 'error');
      return;
    }
    if (amountFen === null) {
      toast(py('payroll.ded.amountInvalid'), 'error');
      return;
    }
    setDedBusy(true);
    try {
      await trpc.commission.createDeduction.mutate({
        staffId: dStaffId,
        month: dMonth,
        amountFen,
        reason: dReason.trim(),
      });
      toast(py('payroll.ded.created'));
      setDAmount('');
      setDReason('');
      setDMonth(month);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setDedBusy(false);
    }
  };

  /* ---- 端口批收尾片 3 · 区 4 提成试算器（owner；simulateCommission 只读不落库） ---- */
  const [simMonth, setSimMonth] = useState(nowMonth());
  const [simRows, setSimRows] = useState<Array<{ ruleKey: string; values: Record<string, string> }>>([]);
  const [simBusy, setSimBusy] = useState(false);
  type SimOut = Awaited<ReturnType<typeof trpc.payroll.simulateCommission.query>>;
  /* server items 为 Record<string,unknown> 透出（契约字段逐字，见 routers/payroll.ts） */
  type SimItem = {
    staffId: string;
    name: string;
    baseline: { commissionTotalFen: number; netFen: number };
    simulated: { commissionTotalFen: number; netFen: number };
    deltaCommissionFen: number;
    deltaNetFen: number;
  };
  const [simResult, setSimResult] = useState<SimOut | null>(null);

  /* 覆盖键下拉宇宙=commission 域 active 行（label 显名；数值字段取 valueJson 数字项） */
  const commissionQ = useQuery({
    queryKey: ['config', 'list', 'commission'],
    queryFn: () => trpc.config.list.query({ domain: 'commission' }),
    enabled: role.isOwner,
    staleTime: 60_000,
  });
  const commissionRules = useMemo(
    () => (commissionQ.data?.rules ?? []).filter((r) => r.active),
    [commissionQ.data],
  );
  const numericFieldsOf = (ruleKey: string): Array<{ field: string; current: number }> => {
    const r = commissionRules.find((x) => x.ruleKey === ruleKey);
    if (!r) return [];
    return Object.entries(r.valueJson as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'number')
      .map(([field, v]) => ({ field, current: v as number }));
  };

  const addSimRow = () => {
    const first = commissionRules.find((r) => !simRows.some((x) => x.ruleKey === r.ruleKey));
    if (!first) return;
    const values: Record<string, string> = {};
    for (const f of numericFieldsOf(first.ruleKey)) values[f.field] = String(f.current);
    setSimRows((prev) => [...prev, { ruleKey: first.ruleKey, values }]);
  };

  const runSim = async () => {
    const overrides: Array<{ ruleKey: string; valueJson: Record<string, unknown> }> = [];
    for (const row of simRows) {
      const valueJson: Record<string, unknown> = {};
      for (const [field, text] of Object.entries(row.values)) {
        const v = Number(text.trim());
        if (text.trim() === '' || !Number.isFinite(v) || v < 0) {
          toast(py('payroll.sim.invalid'), 'error');
          return;
        }
        valueJson[field] = v;
      }
      if (Object.keys(valueJson).length > 0) overrides.push({ ruleKey: row.ruleKey, valueJson });
    }
    if (overrides.length === 0) {
      toast(py('payroll.sim.invalid'), 'error');
      return;
    }
    setSimBusy(true);
    try {
      const r = await trpc.payroll.simulateCommission.query({ month: simMonth, overrides });
      setSimResult(r);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSimBusy(false);
    }
  };

  /* ---- 端口批收尾片 3 · 区 5 手工调整（owner 发起；owner/manager 复核） ---- */
  const adjustQ = useQuery({
    queryKey: ['payroll', 'adjustments'],
    queryFn: () => trpc.payroll.adjustmentList.query({}),
  });
  const [aStaffId, setAStaffId] = useState('');
  const [aKind, setAKind] = useState<'commission' | 'work_hours'>('commission');
  const [aMonth, setAMonth] = useState(nowMonth());
  const [aAmount, setAAmount] = useState('');
  const [aHours, setAHours] = useState('');
  const [aReason, setAReason] = useState('');
  const [aBusy, setABusy] = useState(false);

  /** 带符号元串 → 非零分（两位小数硬校验；非法/零返回 null） */
  const signedYuanToFen = (raw: string): number | null => {
    const s = raw.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
    const fen = Math.round(Number(s) * 100);
    if (!Number.isFinite(fen) || fen === 0) return null;
    return fen;
  };

  const proposeAdjustment = async () => {
    const amountFen = signedYuanToFen(aAmount);
    if (!aStaffId || amountFen === null || aReason.trim() === '') {
      toast(py('payroll.adjust.invalid'), 'error');
      return;
    }
    let meta: Record<string, unknown> | undefined;
    if (aKind === 'work_hours') {
      const hours = Number(aHours.trim());
      if (aHours.trim() === '' || !Number.isFinite(hours) || hours <= 0) {
        toast(py('payroll.adjust.invalid'), 'error');
        return;
      }
      meta = { hours };
    }
    setABusy(true);
    try {
      await trpc.payroll.proposeAdjustment.mutate({
        kind: aKind,
        staffId: aStaffId,
        month: aMonth,
        amountFen,
        reason: aReason.trim(),
        ...(meta ? { meta } : {}),
      });
      toast(py('payroll.adjust.proposed'));
      setAStaffId('');
      setAAmount('');
      setAHours('');
      setAReason('');
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setABusy(false);
    }
  };

  const reviewAdjustment = async (approvalId: string, approve: boolean) => {
    let reviewNote: string | undefined;
    if (approve) {
      if (!window.confirm(py('payroll.adjust.approveConfirm'))) return;
    } else {
      const input = window.prompt(py('payroll.adjust.rejectNotePrompt'));
      if (input === null) return;
      if (input.trim() === '') {
        toast(py('payroll.adjust.rejectNoteRequired'), 'error');
        return;
      }
      reviewNote = input.trim();
    }
    try {
      await trpc.payroll.reviewAdjustment.mutate({
        requestId: approvalId,
        approve,
        ...(reviewNote ? { note: reviewNote } : {}),
      });
      toast(approve ? py('payroll.adjust.approved') : py('payroll.adjust.rejected'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const adjustItems = useMemo(() => {
    const all = [...(adjustQ.data?.items ?? [])];
    return all.sort((a, b) => {
      if ((a.proposal.status === 'pending') !== (b.proposal.status === 'pending'))
        return a.proposal.status === 'pending' ? -1 : 1;
      return new Date(b.proposal.createdAt).getTime() - new Date(a.proposal.createdAt).getTime();
    });
  }, [adjustQ.data]);

  if (!role.canManage) {
    return <RoleGuidePage title={py('payroll.guideTitle')} hint={py('payroll.guideHint')} />;
  }

  const run = runQ.data?.run ?? null;
  const items = runQ.data?.items ?? [];
  const appeals = appealsQ.data?.appeals ?? [];
  const deductions = (deductionsQ.data?.deductions ?? []).slice(0, 20);

  return (
    <MainScaffold title={py('payroll.pageTitle')} sub={py('payroll.pageSub')} testid="payroll-page">
      <ToasterMount />

      {/* 区 1 工资条 */}
      <div className="u3-panel mb-4" data-testid="payroll-slip">
        <div className="u3-panel-head">
          <h3>{py('payroll.slip.title')}</h3>
          <span className="aside">{py('payroll.slip.aside')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <label className="flex items-center gap-2 text-caption text-ink-secondary">
            {py('payroll.slip.monthLabel')}
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              data-testid="payroll-month"
              className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
            />
          </label>
          {run ? (
            <Badge tone={run.status === 'confirmed' ? 'success' : 'brand'}>
              {run.status === 'confirmed' ? py('payroll.slip.statusConfirmed') : py('payroll.slip.statusGenerated')}
            </Badge>
          ) : null}
          <span className="ml-auto flex items-center gap-2">
            <Btn variant="primary" size="sm" disabled={genBusy} onClick={() => void generate()} data-testid="payroll-generate">
              {genBusy ? py('payroll.slip.generating') : py('payroll.slip.generateCta')}
            </Btn>
            {run && run.status === 'generated' ? (
              <Btn variant="subtle" size="sm" disabled={confirmBusy} onClick={() => void confirmRun()} data-testid="payroll-confirm">
                {confirmBusy ? py('payroll.slip.confirming') : py('payroll.slip.confirmCta')}
              </Btn>
            ) : null}
          </span>
        </div>
        {runQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : runQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{py('payroll.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void runQ.refetch()}>
                {py('payroll.common.retry')}
              </Btn>
            </div>
          </div>
        ) : !run || items.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {py('payroll.slip.empty')}
          </p>
        ) : (
          <>
            <table className="w-full border-collapse text-caption" data-testid="payroll-items-table">
              <thead>
                <tr>
                  {[
                    py('payroll.slip.colStaff'),
                    py('payroll.slip.colCommission'),
                    py('payroll.slip.colPerformance'),
                    py('payroll.slip.colDeduction'),
                    py('payroll.slip.colAdjustment'),
                    py('payroll.slip.colNet'),
                    py('payroll.slip.colDisburse'),
                    py('payroll.slip.colAction'),
                  ].map((h) => (
                    <th key={h} className="border-b border-[rgba(59,46,36,.08)] px-[17px] py-2 text-left text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const marked = it.markedAt !== null && it.markedAt !== undefined;
                  return (
                    <tr key={it.id} className={marked ? 'opacity-55' : ''} data-testid={`payroll-item-${it.id}`}>
                      <td className="border-b border-[rgba(59,46,36,.06)] px-[17px] py-2 font-semibold text-ink">
                        {it.staffName ?? it.staffId}
                      </td>
                      <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-[17px] py-2">{fmtMoney(it.commissionFen)}</td>
                      <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-[17px] py-2">{fmtMoney(it.performanceFen)}</td>
                      <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-[17px] py-2">{fmtMoney(it.deductionFen)}</td>
                      <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-[17px] py-2">{fmtMoney(it.adjustmentFen)}</td>
                      <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-[17px] py-2 font-bold text-ink">{fmtMoney(it.netFen)}</td>
                      <td className="border-b border-[rgba(59,46,36,.06)] px-[17px] py-2">
                        {marked ? (
                          <div>
                            <Badge tone="success">{py('payroll.slip.markedBadge')}</Badge>
                            <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                              {py('payroll.slip.markedByLine', { by: it.markedBy ?? '—', at: fmtAt(it.markedAt) })}
                            </div>
                          </div>
                        ) : (
                          <Badge tone="muted">—</Badge>
                        )}
                      </td>
                      <td className="border-b border-[rgba(59,46,36,.06)] px-[17px] py-2">
                        {!marked ? (
                          <Btn variant="subtle" size="sm" onClick={() => openMark(it)} data-testid={`payroll-mark-${it.id}`}>
                            {py('payroll.slip.markCta')}
                          </Btn>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-[17px] py-2 text-caption-xs text-[rgba(59,46,36,.42)]">{py('payroll.slip.disbursedNote')}</p>
          </>
        )}
      </div>

      {/* 区 2 薪资申诉审批 */}
      <div className="u3-panel mb-4" data-testid="payroll-appeals">
        <div className="u3-panel-head">
          <h3>{py('payroll.appeal.title')}</h3>
          <span className="aside">{py('payroll.appeal.aside')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3" data-testid="payroll-appeal-filters">
          {['all', ...APPEAL_STATUS_KEYS].map((k) => {
            const on = appealFilter === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setAppealFilter(k)}
                data-testid={`payroll-appeal-filter-${k}`}
                className={`min-h-[36px] rounded-chip px-3 text-caption font-semibold transition-transform duration-120 ease-philia-spring active:scale-92 ${
                  on ? 'bg-ink text-[#F2DFA6]' : 'bg-sunken text-ink-secondary'
                }`}
              >
                {k === 'all' ? py('payroll.appeal.filterAll') : appealStatusLabel(k)}
              </button>
            );
          })}
        </div>
        {appealsQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : appealsQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{py('payroll.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void appealsQ.refetch()}>
                {py('payroll.common.retry')}
              </Btn>
            </div>
          </div>
        ) : appeals.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {py('payroll.appeal.empty')}
          </p>
        ) : (
          appeals.map((a) => (
            <div key={a.id} className="border-t border-[rgba(59,46,36,.06)]" data-testid={`payroll-appeal-row-${a.id}`}>
              <div className="flex flex-wrap items-center gap-2 px-[17px] py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-body-sm font-bold text-ink">{a.staffName ?? a.staffId}</span>
                    <Badge tone="muted">{appealKindLabel(a.targetKind)}</Badge>
                    <Badge tone={appealStatusTone(a.status)}>{appealStatusLabel(a.status)}</Badge>
                  </div>
                  <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                    {py('payroll.appeal.monthLine', { month: a.month })} · {fmtAt(a.createdAt)}
                    {a.targetAmountFen != null ? ` · ${py('payroll.appeal.targetAmountLine', { amount: fmtMoney(a.targetAmountFen) })}` : ''}
                  </div>
                </div>
                <Btn
                  variant="subtle"
                  size="sm"
                  onClick={() => setExpandAppeal((cur) => (cur === a.id ? null : a.id))}
                  data-testid={`payroll-appeal-expand-${a.id}`}
                >
                  {expandAppeal === a.id ? py('payroll.appeal.collapseCta') : py('payroll.appeal.expandCta')}
                </Btn>
                {a.status === 'pending' ? (
                  <>
                    <Btn
                      variant="primary"
                      size="sm"
                      onClick={() => openAppealAsk({ kind: 'approve', appeal: a })}
                      data-testid={`payroll-appeal-approve-${a.id}`}
                    >
                      {py('payroll.appeal.approveCta')}
                    </Btn>
                    <Btn
                      variant="subtle"
                      size="sm"
                      onClick={() => openAppealAsk({ kind: 'reject', appeal: a })}
                      data-testid={`payroll-appeal-reject-${a.id}`}
                    >
                      {py('payroll.appeal.rejectCta')}
                    </Btn>
                  </>
                ) : null}
              </div>
              {expandAppeal === a.id ? (
                <div className="border-t border-[rgba(59,46,36,.06)] bg-canvas px-[17px] py-3" data-testid={`payroll-appeal-detail-${a.id}`}>
                  {a.targetLabel ? <p className="mb-1 text-caption text-ink">{a.targetLabel}</p> : null}
                  <p className="mb-1 text-caption-xs text-[rgba(59,46,36,.62)]">
                    {py('payroll.appeal.reasonLabel')}：{a.reason}
                  </p>
                  {a.evidenceUrls && a.evidenceUrls.length > 0 ? (
                    <div className="mb-1 flex flex-wrap gap-1.5">
                      <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{py('payroll.appeal.evidenceLabel')}：</span>
                      {a.evidenceUrls.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-caption-xs text-ink underline decoration-[rgba(59,46,36,.3)] underline-offset-2"
                        >
                          {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {a.status !== 'pending' && a.reviewNote ? (
                    <p className="mb-1 text-caption-xs text-[rgba(59,46,36,.62)]">
                      {py('payroll.appeal.reviewLine', { result: appealStatusLabel(a.status), note: a.reviewNote })}
                      {a.reviewedAt ? <span className="u1-num">（{fmtAt(a.reviewedAt)}）</span> : null}
                    </p>
                  ) : null}
                  {a.status === 'approved' && a.refundFen != null ? (
                    <p className="text-caption-xs text-[rgba(59,46,36,.62)]">
                      {py('payroll.appeal.refundLine', { amount: fmtMoney(a.refundFen) })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* 区 3 罚单录入 + 近 20 条罚单表 */}
      <div className="u3-panel" data-testid="payroll-deductions">
        <div className="u3-panel-head">
          <h3>{py('payroll.ded.title')}</h3>
          <span className="aside">{py('payroll.ded.aside')}</span>
        </div>
        <div className="space-y-3 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3" data-testid="payroll-ded-form">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={py('payroll.ded.staffLabel')}>
              <select
                value={dStaffId}
                onChange={(e) => setDStaffId(e.target.value)}
                aria-label={py('payroll.ded.staffLabel')}
                data-testid="payroll-ded-staff"
                className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
              >
                <option value="">{py('payroll.ded.staffPh')}</option>
                {staffRows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={py('payroll.ded.monthLabel')}>
              <input
                type="month"
                value={dMonth}
                onChange={(e) => e.target.value && setDMonth(e.target.value)}
                data-testid="payroll-ded-month"
                className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
              />
            </Field>
            <Field label={py('payroll.ded.amountLabel')}>
              <input
                value={dAmount}
                onChange={(e) => setDAmount(e.target.value)}
                inputMode="decimal"
                placeholder={py('payroll.ded.amountPh')}
                data-testid="payroll-ded-amount"
                className="u1-ring w-32 rounded-control bg-card px-3 py-2 text-caption text-ink placeholder:text-[rgba(59,46,36,.42)] focus:outline-none"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <Field label={py('payroll.ded.reasonLabel')}>
                <input
                  value={dReason}
                  onChange={(e) => setDReason(e.target.value)}
                  placeholder={py('payroll.ded.reasonPh')}
                  maxLength={255}
                  data-testid="payroll-ded-reason"
                  className={inputCls}
                />
              </Field>
            </div>
            <Btn variant="primary" size="sm" disabled={dedBusy} onClick={() => void createDeduction()} data-testid="payroll-ded-submit">
              {dedBusy ? py('payroll.ded.submitting') : py('payroll.ded.submitCta')}
            </Btn>
          </div>
        </div>
        <div className="border-t border-[rgba(59,46,36,.06)]">
          <p className="px-[17px] pt-3 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">{py('payroll.ded.listTitle')}</p>
          {deductionsQ.isPending ? (
            <div className="px-[17px] py-3" aria-label="加载中">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="mb-2.5 h-10 !rounded-[16px]" />
              ))}
            </div>
          ) : deductionsQ.isError ? (
            <div className="px-[17px] py-8 text-center">
              <p className="text-caption text-[rgba(59,46,36,.62)]">{py('payroll.common.loadFail')}</p>
              <div className="mt-3">
                <Btn variant="subtle" size="sm" onClick={() => void deductionsQ.refetch()}>
                  {py('payroll.common.retry')}
                </Btn>
              </div>
            </div>
          ) : deductions.length === 0 ? (
            <p className="px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">{py('payroll.ded.empty')}</p>
          ) : (
            deductions.map((d) => {
              const reverted = d.status === 'reverted';
              return (
                <div
                  key={d.id}
                  className={`flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5 ${reverted ? 'opacity-55' : ''}`}
                  data-testid={`payroll-ded-row-${d.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-body-sm font-bold text-ink">{d.staffName ?? d.staffId}</span>
                      <span className="u1-num text-body-sm font-bold text-ink">{fmtMoney(d.amountFen)}</span>
                      {reverted ? <Badge tone="muted">{py('payroll.ded.revertedBadge')}</Badge> : null}
                    </div>
                    <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.62)]">
                      {d.reason}
                      <span className="u1-num text-[rgba(59,46,36,.42)]"> · {d.month} · {fmtAt(d.createdAt)}</span>
                    </div>
                    {reverted && d.revertedAt ? (
                      <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                        {py('payroll.ded.revertLine', { at: fmtAt(d.revertedAt) })}
                        {d.revertNote ? ` · ${d.revertNote}` : ''}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 区 4 提成试算器（端口批收尾片 3 · owner；只读不落库） */}
      {role.isOwner ? (
        <div className="u3-panel mt-4" data-testid="pay-sim">
          <div className="u3-panel-head">
            <h3>{py('payroll.sim.title')}</h3>
            <span className="aside">{py('payroll.sim.aside')}</span>
          </div>
          <div className="space-y-3 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label={py('payroll.sim.monthLabel')}>
                <input
                  type="month"
                  value={simMonth}
                  onChange={(e) => e.target.value && setSimMonth(e.target.value)}
                  data-testid="pay-sim-month"
                  className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
                />
              </Field>
              <Btn variant="subtle" size="sm" data-testid="pay-sim-add" onClick={addSimRow} disabled={simRows.length >= commissionRules.length}>
                {py('payroll.sim.addRow')}
              </Btn>
              <Btn variant="primary" size="sm" data-testid="pay-sim-run" disabled={simBusy || simRows.length === 0} onClick={() => void runSim()}>
                {simBusy ? py('payroll.sim.running') : py('payroll.sim.runCta')}
              </Btn>
            </div>
            {simRows.map((row, idx) => {
              const fields = numericFieldsOf(row.ruleKey);
              const rule = commissionRules.find((r) => r.ruleKey === row.ruleKey);
              return (
                <div key={row.ruleKey} className="rounded-control bg-canvas px-3 py-2" data-testid={`pay-sim-row-${idx}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={row.ruleKey}
                      aria-label={py('payroll.sim.rulePick')}
                      data-testid={`pay-sim-rule-${idx}`}
                      onChange={(e) => {
                        const rk = e.target.value;
                        const values: Record<string, string> = {};
                        for (const f of numericFieldsOf(rk)) values[f.field] = String(f.current);
                        setSimRows((prev) => prev.map((x, i) => (i === idx ? { ruleKey: rk, values } : x)));
                      }}
                      className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
                    >
                      {commissionRules.map((r) => (
                        <option key={r.ruleKey} value={r.ruleKey} disabled={simRows.some((x, i) => i !== idx && x.ruleKey === r.ruleKey)}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="text-caption-xs font-bold text-[rgba(59,46,36,.62)] underline underline-offset-2"
                      onClick={() => setSimRows((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      {py('payroll.sim.removeRow')}
                    </button>
                  </div>
                  {fields.length === 0 ? (
                    <p className="mt-2 text-caption-xs text-[rgba(59,46,36,.42)]">{py('payroll.sim.noNumeric')}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      {fields.map((f) => (
                        <Field key={f.field} label={`${py('payroll.sim.valueLabel')} · ${f.field}（${rule ? rule.label : row.ruleKey}）`}>
                          <input
                            type="number"
                            min={0}
                            value={row.values[f.field] ?? ''}
                            data-testid={`pay-sim-value-${idx}-${f.field}`}
                            onChange={(e) =>
                              setSimRows((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, values: { ...x.values, [f.field]: e.target.value } } : x)),
                              )
                            }
                            className="u1-ring w-28 rounded-control bg-card px-3 py-2 text-caption tabular-nums text-ink focus:outline-none"
                          />
                        </Field>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {simResult ? (
              <div data-testid="pay-sim-result">
                <div className="u3-noscrollx overflow-x-auto">
                  <table className="u3-tbl min-w-[640px]">
                    <thead>
                      <tr>
                        <th>{py('payroll.sim.colStaff')}</th>
                        <th className="!text-right">{py('payroll.sim.colBaseline')}</th>
                        <th className="!text-right">{py('payroll.sim.colSimulated')}</th>
                        <th className="!text-right">{py('payroll.sim.colDelta')}</th>
                        <th className="!text-right">{py('payroll.sim.colDeltaNet')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(simResult.items as unknown as SimItem[]).map((it) => (
                        <tr key={it.staffId} data-testid={`pay-sim-staff-${it.staffId}`}>
                          <td className="font-semibold text-ink">{it.name}</td>
                          <td className="text-right font-number tabular-nums">{fmtMoney(it.baseline.commissionTotalFen)}</td>
                          <td className="text-right font-number tabular-nums">{fmtMoney(it.simulated.commissionTotalFen)}</td>
                          <td className={`text-right font-number tabular-nums ${it.deltaCommissionFen !== 0 ? 'font-bold text-ink' : 'text-[rgba(59,46,36,.42)]'}`}>
                            {it.deltaCommissionFen > 0 ? '+' : ''}
                            {fmtMoney(it.deltaCommissionFen)}
                          </td>
                          <td className={`text-right font-number tabular-nums ${it.deltaNetFen !== 0 ? 'font-bold text-ink' : 'text-[rgba(59,46,36,.42)]'}`}>
                            {it.deltaNetFen > 0 ? '+' : ''}
                            {fmtMoney(it.deltaNetFen)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {py('payroll.sim.readonlyNote')} · {simResult.note}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 区 5 手工调整（端口批收尾片 3 · owner 发起/审批通过才生效） */}
      <div className="u3-panel mt-4" data-testid="pay-adjust">
        <div className="u3-panel-head">
          <h3>{py('payroll.adjust.title')}</h3>
          <span className="aside">{py('payroll.adjust.aside')}</span>
        </div>
        <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <p className="mb-3 rounded-input bg-brand-primary-light px-3 py-2 text-caption text-ink" data-testid="pay-adjust-threshold-note">
            {py('payroll.adjust.thresholdNote')}
          </p>
          {role.isOwner ? (
            <div className="mb-3 space-y-3" data-testid="pay-adjust-form">
              <div className="flex flex-wrap items-end gap-3">
                <Field label={py('payroll.adjust.staffLabel')}>
                  <select
                    value={aStaffId}
                    onChange={(e) => setAStaffId(e.target.value)}
                    aria-label={py('payroll.adjust.staffLabel')}
                    data-testid="pay-adjust-staff"
                    className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
                  >
                    <option value="">—</option>
                    {staffRows.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={py('payroll.adjust.kindLabel')}>
                  <select
                    value={aKind}
                    onChange={(e) => setAKind(e.target.value as 'commission' | 'work_hours')}
                    aria-label={py('payroll.adjust.kindLabel')}
                    data-testid="pay-adjust-kind"
                    className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
                  >
                    <option value="commission">{py('payroll.adjust.kindCommission')}</option>
                    <option value="work_hours">{py('payroll.adjust.kindWorkHours')}</option>
                  </select>
                </Field>
                <Field label={py('payroll.adjust.monthLabel')}>
                  <input
                    type="month"
                    value={aMonth}
                    onChange={(e) => e.target.value && setAMonth(e.target.value)}
                    data-testid="pay-adjust-month"
                    className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
                  />
                </Field>
                <Field label={py('payroll.adjust.amountLabel')}>
                  <input
                    value={aAmount}
                    onChange={(e) => setAAmount(e.target.value)}
                    inputMode="decimal"
                    data-testid="pay-adjust-amount"
                    className="u1-ring w-32 rounded-control bg-card px-3 py-2 text-caption tabular-nums text-ink focus:outline-none"
                  />
                </Field>
                {aKind === 'work_hours' ? (
                  <Field label={py('payroll.adjust.hoursLabel')}>
                    <input
                      value={aHours}
                      onChange={(e) => setAHours(e.target.value)}
                      inputMode="decimal"
                      data-testid="pay-adjust-hours"
                      className="u1-ring w-24 rounded-control bg-card px-3 py-2 text-caption tabular-nums text-ink focus:outline-none"
                    />
                  </Field>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <Field label={py('payroll.adjust.reasonLabel')}>
                    <input
                      value={aReason}
                      onChange={(e) => setAReason(e.target.value)}
                      placeholder={py('payroll.adjust.reasonPh')}
                      maxLength={500}
                      data-testid="pay-adjust-reason"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Btn variant="primary" size="sm" disabled={aBusy} onClick={() => void proposeAdjustment()} data-testid="pay-adjust-submit">
                  {py('payroll.adjust.submitCta')}
                </Btn>
              </div>
            </div>
          ) : null}

          {/* 调整单队列（pending 在前） */}
          <p className="text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">{py('payroll.adjust.queueTitle')}</p>
          <div data-testid="pay-adjust-queue">
            {adjustQ.isPending ? (
              <div className="py-3" aria-label="加载中">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="mb-2.5 h-10 !rounded-[16px]" />
                ))}
              </div>
            ) : adjustQ.isError ? (
              <p className="py-3 text-caption-xs text-danger-deep">
                {py('payroll.adjust.loadFail')}：{errMsg(adjustQ.error)}
              </p>
            ) : adjustItems.length === 0 ? (
              <p className="py-4 text-center text-caption-xs text-[rgba(59,46,36,.42)]">{py('payroll.adjust.queueEmpty')}</p>
            ) : (
              adjustItems.map((it) => (
                <div key={it.proposal.id} className="border-t border-[rgba(59,46,36,.06)] py-2.5 first:border-t-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge tone="brand">
                          {it.proposal.kind === 'commission' ? py('payroll.adjust.kindCommission') : py('payroll.adjust.kindWorkHours')}
                        </Badge>
                        <span className="text-caption font-semibold text-ink">{it.staffName ?? it.proposal.staffId}</span>
                        <span className="u1-num text-caption-xs text-[rgba(59,46,36,.42)]">{it.proposal.month}</span>
                      </div>
                      <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.62)]">
                        <span className="font-number font-bold tabular-nums text-ink">
                          {it.proposal.amountFen > 0 ? '+' : ''}
                          {fmtMoney(it.proposal.amountFen)}
                        </span>
                        {' · '}
                        {it.proposal.reason}
                      </div>
                      <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.42)]">
                        {it.proposerNickname ?? '—'} · {fmtAt(it.proposal.createdAt)}
                        {it.reviewNote ? ` · ${it.reviewNote}` : ''}
                      </div>
                    </div>
                    <Badge tone={it.approvalStatus === 'approved' ? 'success' : it.approvalStatus === 'rejected' ? 'danger' : 'warn'}>
                      {it.approvalStatus === 'approved'
                        ? py('payroll.adjust.statusApproved')
                        : it.approvalStatus === 'rejected'
                          ? py('payroll.adjust.statusRejected')
                          : py('payroll.adjust.statusPending')}
                    </Badge>
                  </div>
                  {it.approvalStatus === 'pending' && it.approvalId ? (
                    <div className="mt-2 flex gap-2">
                      <Btn variant="primary" size="sm" data-testid={`pay-adjust-approve-${it.approvalId}`} onClick={() => void reviewAdjustment(it.approvalId!, true)}>
                        {py('payroll.adjust.approveCta')}
                      </Btn>
                      <Btn variant="danger" size="sm" data-testid={`pay-adjust-reject-${it.approvalId}`} onClick={() => void reviewAdjustment(it.approvalId!, false)}>
                        {py('payroll.adjust.rejectCta')}
                      </Btn>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 标记发放弹层（methodNote 选填） */}
      <Modal
        open={markAsk !== null}
        onClose={() => setMarkAsk(null)}
        title={markAsk ? py('payroll.slip.markTitle', { name: markAsk.item.staffName ?? markAsk.item.staffId }) : ''}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setMarkAsk(null)} disabled={markBusy}>
              {py('payroll.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitMark()} disabled={markBusy} data-testid="payroll-mark-submit">
              {markBusy ? py('payroll.common.submitting') : py('payroll.common.confirm')}
            </Btn>
          </>
        }
      >
        <p className="mb-3 text-caption-xs text-[rgba(59,46,36,.62)]">{py('payroll.slip.markNote')}</p>
        <input
          value={methodNote}
          onChange={(e) => setMethodNote(e.target.value)}
          maxLength={100}
          placeholder={py('payroll.slip.methodNotePh')}
          data-testid="payroll-mark-note"
          className={inputCls}
        />
      </Modal>

      {/* 申诉审批弹层（批准=返还额可改+意见选填；驳回=意见必填） */}
      <Modal
        open={appealAsk !== null}
        onClose={() => setAppealAsk(null)}
        title={
          appealAsk
            ? appealAsk.kind === 'approve'
              ? py('payroll.appeal.approveTitle', { name: appealAsk.appeal.staffName ?? appealAsk.appeal.staffId })
              : py('payroll.appeal.rejectTitle', { name: appealAsk.appeal.staffName ?? appealAsk.appeal.staffId })
            : ''
        }
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAppealAsk(null)} disabled={appealBusy}>
              {py('payroll.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitAppealAsk()} disabled={appealBusy} data-testid="payroll-appeal-submit">
              {appealBusy ? py('payroll.common.submitting') : py('payroll.common.confirm')}
            </Btn>
          </>
        }
      >
        {appealAsk?.kind === 'approve' && appealAsk.appeal.targetKind === 'deduction' ? (
          <div className="mb-3">
            <Field label={py('payroll.appeal.refundLabel')}>
              <input
                value={refundYuan}
                onChange={(e) => setRefundYuan(e.target.value)}
                inputMode="decimal"
                placeholder={py('payroll.appeal.refundPh')}
                data-testid="payroll-appeal-refund"
                className={inputCls}
              />
            </Field>
          </div>
        ) : null}
        <textarea
          value={appealNote}
          onChange={(e) => setAppealNote(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder={appealAsk?.kind === 'reject' ? py('payroll.appeal.notePh') : py('payroll.appeal.approveNotePh')}
          data-testid="payroll-appeal-note"
          className="w-full resize-none rounded-input bg-card px-3 py-2.5 text-caption text-ink shadow-hairline ring-1 ring-line-ring placeholder:text-ink-placeholder focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
        />
      </Modal>
    </MainScaffold>
  );
}
