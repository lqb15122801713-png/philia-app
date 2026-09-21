/**
 * 批次 员工端2.0（R7~R10）· 店长视图 /manager
 * （任务书 V1.1 §六「店长视图」行 + docs/staff2/R7-R10-DESIGN.md §三/§四）
 *
 * 闸门（双闸口径）：页内角色校验——roles 含 merchant_manager / merchant_owner 才渲染数据面；
 * 非授权渲染明确引导页（商家端 RoleGuidePage 同口径，非 403 白屏）。server 端点一律
 * merchantManagerProcedure / merchantProcedure，本店归属由 ctx.storeId 硬强制（限本店）。
 *
 * 区块（全部复用既有端点，零新接口）：
 * 1. 考勤审批：attendance.exceptionQueue（pending 异常/补卡双流 + 本月防代打 flagged 只读）
 *    → attendance.resolveApproval（驳回备注必填，prompt 收集）；
 * 2. 取消审批：appointment.listForStore({status:'cancel_requested'})（商家端待办同查询）
 *    → appointment.reviewCancel（商家端同 mutation，批准/驳回）；
 * 3. 日结确认（手机通道）：cashier.dayClosePreview（预览=冻结同源同值，UI 只展示不自算）
 *    → cashier.dayClose({actualCashFen})（一日一结 CONFLICT 由 server 硬拒，原文透出）；
 * 4. 退款（批次 R12 真功能，替换原补丁②拦截卡——任务书兑现承诺）：refund.pendingActual
 *    （executed 超 24h 未登记实退 → 黄色提醒待办）+ refund.list 本店退款单最近 20 条
 *    （类型中文/金额红字/状态签/发起与审批人）；实退登记=refund.settleActual（备注留空
 *    按「实退完成」登记，server 口径备注必填）。驳回权仅店主——店长视图不渲染驳回钮；
 *    draft（超阈值/涉储值申请）对店长只读提示须店主审批；发起入口在商家端收银台，本页不渲染；
 * 5. 盘点：inventory.assignCount（日盘≥100元 / 周盘全量 / 盲盘）→ counted 队列
 *    inventory.confirmCount（差异红绿字）/ inventory.rejectCount（备注必填）
 *    → 最近已入账 inventory.listCounts({status:'posted'})；
 * 6. 差评提示：xp.storeFlaggedReviews（≤2 星，提示 only，不建工单处理流）；
 * 7. 库存流水：inventory.listMovements({limit:20})（只读，来源中文标签 + 前后值）。
 */

import { useMe, usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { ShieldCheck } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Toast, { useToast } from '@/components/today/Toast';
import { hhmm, mmdd } from '@/components/today/utils';

/* ------------------------------------------------------------------ */
/* 文案映射                                                              */
/* ------------------------------------------------------------------ */

const KIND_LABEL: Record<string, string> = { in: '上班', out: '下班' };
const RECORD_STATUS_LABEL: Record<string, string> = { normal: '正常', late: '迟到', early: '早退' };
const COUNT_TYPE_LABEL: Record<string, string> = { daily: '日盘', weekly: '周盘', blind: '盲盘' };
const SOURCE_TYPE_LABEL: Record<string, string> = {
  cashier: '收银扣减',
  reversal: '反结账回补',
  count: '盘点',
  disinfection: '消毒耗材',
  manual: '人工调整',
  refund: '退款回补', // R12
};

/** 服务端错误原文透出（tRPC v11：err.message 即服务端 message） */
function errMsg(e: unknown): string {
  if (e instanceof TRPCClientError && typeof e.message === 'string' && e.message) return e.message;
  return '操作失败，请重试';
}

const yuan = (fen: number): string => `¥${(fen / 100).toFixed(2)}`;

/** 带符号金额：0 → ¥0.00；正 → +¥x；负 → −¥x（商家端日结 toast 同口径） */
const signedYuan = (fen: number): string =>
  fen === 0 ? '¥0.00' : `${fen > 0 ? '+' : '−'}${yuan(Math.abs(fen))}`;

/** 元文本 → 分（两位小数口径；非法输入返回 null） */
function parseYuanToFen(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/* ------------------------------------------------------------------ */
/* 样式零件（≥44px 触达目标；遵守批次禁令色/字口径）                          */
/* ------------------------------------------------------------------ */

const BTN_PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-primary px-5 text-body-sm font-semibold text-ink transition duration-120 active:scale-92 disabled:opacity-50';
const BTN_DANGER =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-danger-light px-5 text-body-sm font-semibold text-danger-deep transition duration-120 active:scale-92 disabled:opacity-50';
const BTN_PLAIN =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-sunken px-4 text-body-sm font-semibold text-ink transition duration-120 active:scale-92 disabled:opacity-50';

function Chip({ tone = 'plain', children }: { tone?: 'plain' | 'warn' | 'danger' | 'ok'; children: ReactNode }) {
  const cls =
    tone === 'danger'
      ? 'bg-danger-light text-danger-deep'
      : tone === 'warn'
        ? 'bg-brand-primary-light text-ink'
        : tone === 'ok'
          ? 'bg-success-light text-success-deep'
          : 'bg-sunken text-[rgba(74,59,46,.62)]';
  return <span className={`inline-flex items-center rounded-chip px-1.5 py-0.5 text-caption-xs font-bold ${cls}`}>{children}</span>;
}

function Section({
  title,
  aside,
  testid,
  children,
}: {
  title: string;
  aside?: ReactNode;
  testid: string;
  children: ReactNode;
}) {
  return (
    <section className="u1-card mt-3.5 p-4" data-testid={testid}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-title font-bold">{title}</h2>
        {aside ? <div className="text-caption-xs text-[rgba(74,59,46,.42)]">{aside}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function QueryState({ pending, error, empty, emptyText }: { pending: boolean; error: unknown; empty: boolean; emptyText: string }) {
  if (pending) return <p className="py-2 text-caption-xs text-[rgba(74,59,46,.42)]">加载中…</p>;
  if (error) return <p className="py-2 text-caption-xs text-danger">{errMsg(error)}</p>;
  if (empty) return <p className="py-2 text-caption-xs text-[rgba(74,59,46,.42)]">{emptyText}</p>;
  return null;
}

/* ------------------------------------------------------------------ */
/* 非授权引导页（RoleGuidePage 同口径：明确引导，非 403 白屏）              */
/* ------------------------------------------------------------------ */

function GuideCard() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center" data-testid="manager-guide">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-oak-light">
        <ShieldCheck className="h-7 w-7 text-ink" strokeWidth={1.6} />
      </span>
      <h1 className="mt-4 text-title-lg">店长视图仅店长与老板可用</h1>
      <p className="mt-2 text-body-sm text-ink-secondary">
        当前账号暂无店长权限。考勤/取消/盘点审批与日结确认请改用商家端，或联系店主开通店长角色。
      </p>
      <button
        type="button"
        data-testid="manager-guide-back"
        onClick={() => navigate('/me', { replace: true })}
        className={`${BTN_PRIMARY} mt-6 min-w-[200px]`}
      >
        返回我的
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. 考勤审批（exceptionQueue + resolveApproval）                        */
/* ------------------------------------------------------------------ */

function AttendanceSection({
  showToast,
  staffNameOf,
}: {
  showToast: (m: string) => void;
  staffNameOf: (staffId: string) => string;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const q = useQuery({
    queryKey: ['attendance', 'exceptionQueue'],
    queryFn: () => trpc.attendance.exceptionQueue.query(),
  });
  const resolveM = useMutation({
    mutationFn: (v: { approvalId: string; approve: boolean; note?: string }) =>
      trpc.attendance.resolveApproval.mutate(v),
    onSuccess: (_r, v) => {
      showToast(v.approve ? '已通过审批' : '已驳回');
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (e) => showToast(errMsg(e)),
  });

  const reject = (approvalId: string) => {
    const note = window.prompt('请填写驳回备注（必填）');
    if (note === null) return;
    if (!note.trim()) {
      showToast('驳回需填写备注');
      return;
    }
    resolveM.mutate({ approvalId, approve: false, note: note.trim() });
  };

  const approvals = q.data?.approvals ?? [];
  const flagged = q.data?.flaggedRecords ?? [];
  const busy = resolveM.isPending;

  return (
    <Section
      title="考勤审批"
      aside={approvals.length ? `${approvals.length} 条待审` : undefined}
      testid="manager-attendance"
    >
      <QueryState pending={q.isPending} error={q.error} empty={approvals.length === 0 && flagged.length === 0} emptyText="暂无待审批与防代打标记" />
      {approvals.length > 0 ? (
        <ul className="divide-y divide-[rgba(74,59,46,.06)]">
          {approvals.map((a) => (
            <li key={a.id} className="py-3" data-testid={`manager-attendance-row-${a.id}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone={a.type === 'makeup' ? 'warn' : 'danger'}>{a.type === 'makeup' ? '补卡' : '异常'}</Chip>
                <span className="text-body-sm font-bold text-ink">{staffNameOf(a.staffId)}</span>
                <span className="text-caption-xs text-[rgba(74,59,46,.62)]">
                  {a.date} · {KIND_LABEL[a.kind] ?? a.kind}
                </span>
              </div>
              <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">{a.reason}</p>
              {a.type === 'makeup' && a.requestedTs ? (
                <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                  申请补卡时间 <span className="u1-num">{hhmm(a.requestedTs)}</span>
                </p>
              ) : null}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={busy}
                  onClick={() => resolveM.mutate({ approvalId: a.id, approve: true })}
                  data-testid={`manager-attendance-approve-${a.id}`}
                >
                  通过
                </button>
                <button
                  type="button"
                  className={BTN_DANGER}
                  disabled={busy}
                  onClick={() => reject(a.id)}
                  data-testid={`manager-attendance-reject-${a.id}`}
                >
                  驳回
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {flagged.length > 0 ? (
        <div className={approvals.length > 0 ? 'mt-3 border-t border-[rgba(74,59,46,.06)] pt-3' : ''}>
          <p className="text-caption-xs font-bold text-[rgba(74,59,46,.42)]">防代打标记（本月 · 只读）</p>
          <ul className="mt-1 divide-y divide-[rgba(74,59,46,.06)]">
            {flagged.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-1.5 py-2" data-testid={`manager-flagged-row-${r.id}`}>
                <Chip tone="danger">防代打</Chip>
                <span className="text-body-sm font-bold text-ink">{staffNameOf(r.staffId)}</span>
                <span className="text-caption-xs text-[rgba(74,59,46,.62)]">
                  {r.date} · {KIND_LABEL[r.kind] ?? r.kind} · {RECORD_STATUS_LABEL[r.status] ?? r.status} ·{' '}
                  <span className="u1-num">{hhmm(r.ts)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 取消审批（listForStore cancel_requested + reviewCancel，商家端同端点） */
/* ------------------------------------------------------------------ */

function CancelSection({ showToast }: { showToast: (m: string) => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const q = useQuery({
    queryKey: ['appointment', 'cancelQueue'],
    queryFn: () => trpc.appointment.listForStore.query({ status: 'cancel_requested' }),
  });
  const reviewM = useMutation({
    mutationFn: (v: { appointmentId: string; approve: boolean }) => trpc.appointment.reviewCancel.mutate(v),
    onSuccess: (_r, v) => {
      showToast(v.approve ? '已批准取消' : '已驳回取消申请');
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
    },
    onError: (e) => showToast(errMsg(e)),
  });

  const rows = q.data ?? [];
  const busy = reviewM.isPending;

  return (
    <Section title="取消审批" aside={rows.length ? `${rows.length} 条待审` : undefined} testid="manager-cancel">
      <QueryState pending={q.isPending} error={q.error} empty={rows.length === 0} emptyText="暂无待审核的取消申请" />
      {rows.length > 0 ? (
        <ul className="divide-y divide-[rgba(74,59,46,.06)]">
          {rows.map((a) => (
            <li key={a.id} className="py-3" data-testid={`manager-cancel-row-${a.id}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-body-sm font-bold text-ink">{a.petName ?? '宠物'}</span>
                <span className="text-caption-xs text-[rgba(74,59,46,.62)]">{a.serviceName ?? ''}</span>
                <span className="text-caption-xs text-[rgba(74,59,46,.62)]">
                  预约 <span className="u1-num">{`${mmdd(a.scheduledStart)} ${hhmm(a.scheduledStart)}`}</span>
                </span>
              </div>
              <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
                客户 {a.customerName ?? '—'}
                {a.customerPhoneTail ? `（尾号 ${a.customerPhoneTail}）` : ''} · 原因：{a.cancelReason ?? '（未填）'}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={busy}
                  onClick={() => reviewM.mutate({ appointmentId: a.id, approve: true })}
                  data-testid={`manager-cancel-approve-${a.id}`}
                >
                  批准取消
                </button>
                <button
                  type="button"
                  className={BTN_DANGER}
                  disabled={busy}
                  onClick={() => reviewM.mutate({ appointmentId: a.id, approve: false })}
                  data-testid={`manager-cancel-reject-${a.id}`}
                >
                  驳回
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. 日结确认（dayClosePreview + dayClose，本店 · 一日一结）               */
/* ------------------------------------------------------------------ */

function DayCloseSection({ showToast }: { showToast: (m: string) => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const previewQ = useQuery({
    queryKey: ['cashier', 'dayClosePreview'],
    queryFn: () => trpc.cashier.dayClosePreview.query(),
  });
  const [cashText, setCashText] = useState('');
  const closeM = useMutation({
    mutationFn: (v: { actualCashFen: number }) => trpc.cashier.dayClose.mutate(v),
    onSuccess: (r) => {
      const c = r.close;
      showToast(
        `日结已冻结（${c.bizDate}）：账面 ${yuan(c.bookCashFen ?? 0)} · 实点 ${yuan(c.actualCashFen ?? 0)} · 差异 ${signedYuan(c.diffFen ?? 0)}`,
      );
      setCashText('');
      void queryClient.invalidateQueries({ queryKey: ['cashier'] });
    },
    onError: (e) => showToast(errMsg(e)),
  });

  const p = previewQ.data;
  const bookCashFen = p?.stats.tender.cashFen ?? 0;
  const actualFen = parseYuanToFen(cashText);
  const diffFen = actualFen !== null ? actualFen - bookCashFen : null;

  const submit = () => {
    if (!p) return;
    if (actualFen === null) {
      showToast('请输入正确的实点现金金额（元，最多两位小数）');
      return;
    }
    const ok = window.confirm(
      `确认冻结 ${p.bizDate} 全日账目？\n账面现金 ${yuan(bookCashFen)} · 实点 ${yuan(actualFen)} · 差异 ${signedYuan(actualFen - bookCashFen)}\n冻结后仅店主可反结账拆箱。`,
    );
    if (!ok) return;
    closeM.mutate({ actualCashFen: actualFen });
  };

  return (
    <Section title="日结确认" aside="限本店 · 一日一结" testid="manager-dayclose">
      <QueryState pending={previewQ.isPending} error={previewQ.error} empty={false} emptyText="" />
      {p ? (
        <div>
          <div className="flex items-center gap-2">
            <span className="u1-num text-body-sm font-bold text-ink">{p.bizDate}</span>
            {p.existingFrozenCloseId ? <Chip tone="ok">今日已日结冻结</Chip> : <Chip tone="warn">待日结</Chip>}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-caption-xs text-[rgba(74,59,46,.62)]">
            <div className="flex justify-between">
              <dt>已收合计</dt>
              <dd className="u1-num font-bold text-ink">{yuan(p.stats.receivedTotalFen)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>笔数</dt>
              <dd className="u1-num font-bold text-ink">{p.stats.counts.paidCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt>现金</dt>
              <dd className="u1-num">{yuan(p.stats.tender.cashFen)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>微信</dt>
              <dd className="u1-num">{yuan(p.stats.tender.wechatFen)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>支付宝</dt>
              <dd className="u1-num">{yuan(p.stats.tender.alipayFen)}</dd>
            </div>
          </dl>
          {p.existingFrozenCloseId ? null : (
            <div className="mt-3 border-t border-[rgba(74,59,46,.06)] pt-3">
              <label className="block text-caption-xs font-bold text-[rgba(74,59,46,.62)]" htmlFor="manager-dayclose-cash">
                实点现金（元）· 账面 {yuan(bookCashFen)}
              </label>
              <input
                id="manager-dayclose-cash"
                data-testid="manager-dayclose-cash"
                value={cashText}
                onChange={(e) => setCashText(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="u1-num mt-1 h-11 w-full rounded-input bg-sunken px-3 text-body-sm text-ink outline-none placeholder:text-ink-placeholder"
              />
              {diffFen !== null ? (
                <p className={`mt-1 text-caption-xs font-bold ${diffFen === 0 ? 'text-[rgba(74,59,46,.62)]' : diffFen < 0 ? 'text-danger' : 'text-success-deep'}`}>
                  差异 {signedYuan(diffFen)}
                </p>
              ) : null}
              <button
                type="button"
                className={`${BTN_PRIMARY} mt-2 w-full`}
                disabled={closeM.isPending}
                onClick={submit}
                data-testid="manager-dayclose-submit"
              >
                {closeM.isPending ? '冻结中…' : '确认日结（冻结全日账目）'}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. 退款（批次 R12 真功能：pendingActual 实退待办 + list 本店退款单 + settleActual 登记） */
/* ------------------------------------------------------------------ */

const REFUND_TYPE_LABEL: Record<string, string> = {
  full: '全额退',
  partial_items: '按行退',
  partial_amount: '按金额退',
  boarding_nights: '寄养剩余晚',
  pass_cancel: '次卡退卡',
};
const REFUND_STATUS_LABEL: Record<string, string> = {
  draft: 'draft',
  executed: '已执行',
  settled: '已实退',
  rejected: '已驳回',
};

function RefundSection({ showToast }: { showToast: (m: string) => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const pendingQ = useQuery({
    queryKey: ['refund', 'pendingActual'],
    queryFn: () => trpc.refund.pendingActual.query(),
  });
  const listQ = useQuery({
    queryKey: ['refund', 'list'],
    queryFn: () => trpc.refund.list.query(),
  });
  const settleM = useMutation({
    mutationFn: (v: { refundId: string; note: string }) => trpc.refund.settleActual.mutate(v),
    onSuccess: (r) => {
      showToast(r.idempotent ? '该单此前已登记实退' : `实退已登记（${r.refund.refundNo}）`);
      void queryClient.invalidateQueries({ queryKey: ['refund'] });
    },
    onError: (e) => showToast(errMsg(e)),
  });

  /** 实退登记：备注可填（留空按「实退完成」登记——server settleActual 口径备注必填） */
  const settle = (refundId: string) => {
    const note = window.prompt('实退登记备注（可填，留空按「实退完成」登记）');
    if (note === null) return;
    settleM.mutate({ refundId, note: note.trim() || '实退完成' });
  };

  const pending = pendingQ.data ?? [];
  const rows = (listQ.data ?? []).slice(0, 20);
  const busy = settleM.isPending;
  const nowMs = Date.now();

  return (
    <Section
      title="退款"
      aside={pending.length ? `${pending.length} 单实退待办` : undefined}
      testid="manager-refund"
    >
      {/* 实退待办：executed 超 24h 未登记（黄色提醒列表） */}
      <QueryState pending={pendingQ.isPending} error={pendingQ.error} empty={false} emptyText="" />
      {pending.length > 0 ? (
        <div className="rounded-control bg-brand-primary-light p-3">
          <p className="text-caption-xs font-bold text-ink">实退待办（执行超 24 小时未登记）</p>
          <ul className="mt-1.5 divide-y divide-[rgba(74,59,46,.08)]">
            {pending.map((r) => {
              const overdueH = Math.max(1, Math.floor((nowMs - r.createdAt.getTime()) / 3_600_000));
              return (
                <li key={r.id} className="py-2.5" data-testid={`manager-refund-pending-${r.id}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="warn">超 24h</Chip>
                    <span className="u1-num text-body-sm font-bold text-ink">{r.refundNo}</span>
                    <span className="text-caption-xs text-[rgba(74,59,46,.62)]">原单 {r.billNo}</span>
                  </div>
                  <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
                    金额 <span className="u1-num font-bold text-danger">−{yuan(r.amountFen)}</span> · 执行{' '}
                    <span className="u1-num">{`${mmdd(r.createdAt)} ${hhmm(r.createdAt)}`}</span> · 已超时{' '}
                    <span className="u1-num font-bold text-danger">{overdueH} 小时</span>
                  </p>
                  <button
                    type="button"
                    className={`${BTN_PRIMARY} mt-2`}
                    disabled={busy}
                    onClick={() => settle(r.id)}
                    data-testid={`manager-refund-settle-${r.id}`}
                  >
                    实退完成
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* 本店退款单（最近 20 条）：店长可办 executed 实退登记；draft 只读提示须店主（驳回权仅店主，不渲染驳回钮） */}
      <p className={`text-caption-xs font-bold text-[rgba(74,59,46,.42)] ${pending.length > 0 ? 'mt-3' : ''}`}>
        本店退款单（最近 20 条）· 发起入口在商家端收银台
      </p>
      <QueryState pending={listQ.isPending} error={listQ.error} empty={rows.length === 0} emptyText="暂无退款单" />
      {rows.length > 0 ? (
        <ul className="divide-y divide-[rgba(74,59,46,.06)]">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5" data-testid={`manager-refund-row-${r.id}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip>{REFUND_TYPE_LABEL[r.type] ?? r.type}</Chip>
                <span className="u1-num text-body-sm font-bold text-ink">{r.refundNo}</span>
                <span className="text-caption-xs text-[rgba(74,59,46,.62)]">原单 {r.billNo}</span>
                <span className="ml-auto">
                  <Chip
                    tone={
                      r.status === 'settled' ? 'ok' : r.status === 'rejected' ? 'danger' : r.status === 'draft' ? 'warn' : 'plain'
                    }
                  >
                    {REFUND_STATUS_LABEL[r.status] ?? r.status}
                  </Chip>
                </span>
              </div>
              <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
                金额 <span className="u1-num font-bold text-danger">−{yuan(r.amountFen)}</span> · 退款日{' '}
                <span className="u1-num">{r.bizDate}</span>
                {r.settledAt ? (
                  <>
                    {' '}
                    · 实退 <span className="u1-num">{`${mmdd(r.settledAt)} ${hhmm(r.settledAt)}`}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                原因：{r.reason} · 发起 {r.operatorName ?? '—'} · 审批 {r.approverName ?? '—'}
              </p>
              {r.status === 'draft' ? (
                <p className="mt-1 text-caption-xs font-bold text-[rgba(74,59,46,.62)]">
                  超阈值/涉储值申请须店主审批（驳回权仅店主）
                </p>
              ) : null}
              {r.status === 'executed' ? (
                <button
                  type="button"
                  className={`${BTN_PRIMARY} mt-2`}
                  disabled={busy}
                  onClick={() => settle(r.id)}
                  data-testid={`manager-refund-settle-${r.id}`}
                >
                  实退完成
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. 盘点（assignCount / counted 队列 confirm+reject / 最近已入账）        */
/* ------------------------------------------------------------------ */

function InventorySection({ showToast }: { showToast: (m: string) => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const countedQ = useQuery({
    queryKey: ['inventory', 'counts', 'counted'],
    queryFn: () => trpc.inventory.listCounts.query({ status: 'counted' }),
  });
  const postedQ = useQuery({
    queryKey: ['inventory', 'counts', 'posted'],
    queryFn: () => trpc.inventory.listCounts.query({ status: 'posted' }),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['inventory'] });

  const assignM = useMutation({
    mutationFn: (type: 'daily' | 'weekly' | 'blind') => trpc.inventory.assignCount.mutate({ type }),
    onSuccess: (r, type) => {
      showToast(`已派${COUNT_TYPE_LABEL[type]}任务，共 ${r.itemCount} 项`);
      invalidate();
    },
    onError: (e) => showToast(errMsg(e)),
  });
  const confirmM = useMutation({
    mutationFn: (countId: string) => trpc.inventory.confirmCount.mutate({ countId }),
    onSuccess: (r) => {
      showToast(`已确认入账（差异 ${r.diffs} 项）`);
      invalidate();
    },
    onError: (e) => showToast(errMsg(e)),
  });
  const rejectM = useMutation({
    mutationFn: (v: { countId: string; note: string }) => trpc.inventory.rejectCount.mutate(v),
    onSuccess: () => {
      showToast('已驳回，退回重盘');
      invalidate();
    },
    onError: (e) => showToast(errMsg(e)),
  });

  const reject = (countId: string) => {
    const note = window.prompt('驳回必须填写说明（退回重盘）');
    if (note === null) return;
    if (!note.trim()) {
      showToast('驳回必须填写说明');
      return;
    }
    rejectM.mutate({ countId, note: note.trim() });
  };

  const counted = countedQ.data ?? [];
  const posted = (postedQ.data ?? []).slice(0, 5);
  const busy = confirmM.isPending || rejectM.isPending;

  return (
    <Section title="盘点" aside={counted.length ? `${counted.length} 单待确认` : undefined} testid="manager-inventory">
      {/* 派任务 */}
      <div className="grid grid-cols-3 gap-2">
        {(['daily', 'weekly', 'blind'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`${BTN_PLAIN} flex-col gap-0.5 px-2`}
            disabled={assignM.isPending}
            onClick={() => assignM.mutate(t)}
            data-testid={`manager-assign-${t}`}
          >
            <span>{COUNT_TYPE_LABEL[t]}</span>
            <span className="text-caption-xs font-normal text-[rgba(74,59,46,.62)]">
              {t === 'daily' ? '单价≥100元' : t === 'weekly' ? '全量' : '盲盘'}
            </span>
          </button>
        ))}
      </div>

      {/* counted 确认队列 */}
      <p className="mt-3 text-caption-xs font-bold text-[rgba(74,59,46,.42)]">待确认（店员已录入实盘）</p>
      <QueryState pending={countedQ.isPending} error={countedQ.error} empty={counted.length === 0} emptyText="暂无待确认盘点单" />
      {counted.length > 0 ? (
        <ul className="divide-y divide-[rgba(74,59,46,.06)]">
          {counted.map((c) => {
            const diffs = c.items.filter((it) => it.actualStock !== null && it.actualStock !== it.systemStock);
            const unfilled = c.items.filter((it) => it.actualStock === null).length;
            return (
              <li key={c.id} className="py-3" data-testid={`manager-count-row-${c.id}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="warn">{COUNT_TYPE_LABEL[c.type] ?? c.type}</Chip>
                  <span className="text-caption-xs text-[rgba(74,59,46,.62)]">
                    建单 <span className="u1-num">{`${mmdd(c.createdAt)} ${hhmm(c.createdAt)}`}</span> · 共 {c.items.length} 项 · 差异 {diffs.length} 项
                  </span>
                </div>
                {unfilled > 0 ? (
                  <p className="mt-1 text-caption-xs text-danger">有 {unfilled} 项未录入实盘，确认将被 server 拒绝</p>
                ) : null}
                {diffs.length > 0 ? (
                  <ul className="mt-1.5 space-y-1">
                    {diffs.map((it) => {
                      const d = it.actualStock! - it.systemStock;
                      return (
                        <li key={it.id} className="flex items-center justify-between text-caption-xs">
                          <span className="min-w-0 flex-1 truncate text-[rgba(74,59,46,.62)]">{it.productName ?? '（商品已删）'}</span>
                          <span className="u1-num shrink-0 text-[rgba(74,59,46,.62)]">
                            {it.systemStock} → {it.actualStock}
                          </span>
                          <span className={`u1-num w-10 shrink-0 text-right font-bold ${d < 0 ? 'text-danger' : 'text-success-deep'}`}>
                            {d > 0 ? `+${d}` : `−${Math.abs(d)}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">账实一致，无差异</p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={busy}
                    onClick={() => confirmM.mutate(c.id)}
                    data-testid={`manager-count-confirm-${c.id}`}
                  >
                    确认入账
                  </button>
                  <button
                    type="button"
                    className={BTN_DANGER}
                    disabled={busy}
                    onClick={() => reject(c.id)}
                    data-testid={`manager-count-reject-${c.id}`}
                  >
                    驳回
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* 最近已入账 */}
      <p className="mt-3 text-caption-xs font-bold text-[rgba(74,59,46,.42)]">最近已入账</p>
      <QueryState pending={postedQ.isPending} error={postedQ.error} empty={posted.length === 0} emptyText="暂无已入账盘点单" />
      {posted.length > 0 ? (
        <ul className="divide-y divide-[rgba(74,59,46,.06)]">
          {posted.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5 py-2" data-testid={`manager-count-posted-${c.id}`}>
              <Chip tone="ok">{COUNT_TYPE_LABEL[c.type] ?? c.type}</Chip>
              <span className="text-caption-xs text-[rgba(74,59,46,.62)]">
                入账 <span className="u1-num">{c.postedAt ? `${mmdd(c.postedAt)} ${hhmm(c.postedAt)}` : '—'}</span> · 共 {c.items.length} 项
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. 差评提示（storeFlaggedReviews · 提示 only 不建工单）                  */
/* ------------------------------------------------------------------ */

function ReviewsSection() {
  const { trpc } = usePhiliaClient();
  const q = useQuery({
    queryKey: ['xp', 'storeFlaggedReviews'],
    queryFn: () => trpc.xp.storeFlaggedReviews.query({ limit: 20 }),
  });
  const rows = q.data?.items ?? [];

  return (
    <Section title="差评提示" aside="仅提示 · 不构成工单" testid="manager-reviews">
      <QueryState pending={q.isPending} error={q.error} empty={rows.length === 0} emptyText="暂无 ≤2 星差评" />
      {rows.length > 0 ? (
        <ul className="divide-y divide-[rgba(74,59,46,.06)]">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5" data-testid={`manager-review-row-${r.id}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-body-sm font-bold text-ink">{r.staffName ?? '—'}</span>
                <span className="text-caption-xs font-bold text-danger" aria-label={`${r.rating} 星`}>
                  {'★'.repeat(r.rating)}
                </span>
                {r.anonymous ? <Chip>匿名</Chip> : null}
                <span className="u1-num ml-auto text-caption-xs text-[rgba(74,59,46,.42)]">
                  {`${mmdd(r.createdAt)} ${hhmm(r.createdAt)}`}
                </span>
              </div>
              <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">{r.text ?? '（未留文字）'}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. 库存流水（listMovements 最新 20 · 只读）                              */
/* ------------------------------------------------------------------ */

function MovementsSection({ operatorNameOf }: { operatorNameOf: (userId: string) => string }) {
  const { trpc } = usePhiliaClient();
  const q = useQuery({
    queryKey: ['inventory', 'movements'],
    queryFn: () => trpc.inventory.listMovements.query({ limit: 20 }),
  });
  const rows = q.data ?? [];

  return (
    <Section title="库存流水" aside="最新 20 条 · 只读" testid="manager-movements">
      <QueryState pending={q.isPending} error={q.error} empty={rows.length === 0} emptyText="暂无库存流水" />
      {rows.length > 0 ? (
        <ul className="divide-y divide-[rgba(74,59,46,.06)]">
          {rows.map((m) => (
            <li key={m.id} className="py-2.5" data-testid={`manager-movement-row-${m.id}`}>
              <div className="flex items-center gap-1.5">
                <span className="u1-num text-caption-xs text-[rgba(74,59,46,.42)]">{`${mmdd(m.createdAt)} ${hhmm(m.createdAt)}`}</span>
                <span className="min-w-0 flex-1 truncate text-body-sm font-bold text-ink">{m.productName ?? '（商品已删）'}</span>
                <span className={`u1-num shrink-0 text-body-sm font-bold ${m.delta < 0 ? 'text-danger' : 'text-success-deep'}`}>
                  {m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                <Chip>{SOURCE_TYPE_LABEL[m.sourceType] ?? m.sourceType}</Chip>
                <span className="u1-num">
                  {m.beforeStock} → {m.afterStock}
                </span>
                <span>操作人 {operatorNameOf(m.operatorId)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                  */
/* ------------------------------------------------------------------ */

export default function ManagerPage() {
  const { trpc } = usePhiliaClient();
  const { user, loading } = useMe();
  const [toast, showToast] = useToast();

  // 店名（header aside；与 MePage 同 queryKey 共享缓存）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'staffDetail'],
    queryFn: () => trpc.auth.me.query(),
  });
  const storeName = meQuery.data?.store?.name ?? null;

  const isManager = (user?.roles ?? []).some((r) => r === 'merchant_manager' || r === 'merchant_owner');

  return (
    <div className="pb-6">
      <PageHeader title="店长视图" backTo="/me" aside={storeName ?? undefined} />
      {loading ? (
        <p className="px-[22px] text-body-sm text-[rgba(74,59,46,.62)]">加载中…</p>
      ) : !isManager ? (
        <GuideCard />
      ) : (
        <ManagerBody userId={user!.id} userNickname={user!.nickname} showToast={showToast} />
      )}
      <Toast message={toast} />
    </div>
  );
}

function ManagerBody({
  userId,
  userNickname,
  showToast,
}: {
  userId: string;
  userNickname: string | null;
  showToast: (m: string) => void;
}) {
  const { trpc } = usePhiliaClient();

  // 员工花名册（merchantManager 本店）：审批/流水的姓名映射（staffId→名、userId→名）
  const staffQ = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
    staleTime: 60_000,
  });
  const staffNameById = useMemo(
    () => new Map((staffQ.data?.staff ?? []).map((s) => [s.id, s.name] as const)),
    [staffQ.data],
  );
  const staffNameByUserId = useMemo(
    () => new Map((staffQ.data?.staff ?? []).map((s) => [s.userId, s.name] as const)),
    [staffQ.data],
  );
  const staffNameOf = (staffId: string) => staffNameById.get(staffId) ?? '员工';
  const operatorNameOf = (opId: string) =>
    staffNameByUserId.get(opId) ?? (opId === userId ? (userNickname ?? '本人') : '—');

  return (
    <div className="px-[22px]">
      <AttendanceSection showToast={showToast} staffNameOf={staffNameOf} />
      <CancelSection showToast={showToast} />
      <DayCloseSection showToast={showToast} />
      <RefundSection showToast={showToast} />
      <InventorySection showToast={showToast} />
      <ReviewsSection />
      <MovementsSection operatorNameOf={operatorNameOf} />
    </div>
  );
}
