/**
 * 批次 员工端2.0（R7~R10）· 店长视图 /manager
 * （任务书 V1.1 §六「店长视图」行 + docs/staff2/R7-R10-DESIGN.md §三/§四）
 * 骨架批片 1（S-11 补卡审批·店长视界）：外框换骨架——SkBackBar（二级页无 dock）→
 * 考勤异常卡 ×N（理由 + 批准 SkBtnAction / 驳回 sk-btn-ghost，左 3px 赭红）→
 * S7 留痕行（防代打只读）→ 口径注（驳回强制原因 · 全留痕）。数据流/权限零回退。
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
 *    （executed 超 24h 未登记实退 → 淡黄提醒待办）+ refund.list 本店退款单最近 20 条
 *    （类型中文/金额红字/状态签/发起与审批人）；实退登记=refund.settleActual（备注留空
 *    按「实退完成」登记，server 口径备注必填）。驳回权仅店主——店长视图不渲染驳回钮；
 *    draft（超阈值/涉储值申请）对店长只读提示须店主审批；发起入口在商家端收银台，本页不渲染；
 * 5. 盘点：inventory.assignCount（日盘≥100元 / 周盘全量 / 盲盘）→ counted 队列
 *    inventory.confirmCount（差异红绿字）/ inventory.rejectCount（备注必填）
 *    → 最近已入账 inventory.listCounts({status:'posted'})；
 * 6. 差评提示：xp.storeFlaggedReviews（≤2 星，提示 only，不建工单处理流）；
 * 7. 库存流水：inventory.listMovements({limit:20})（只读，来源中文标签 + 前后值）。
 */

import { useMe, usePhiliaClient, useToast } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { hhmm, mmdd } from '@/components/today/utils';
import { MANAGER_COPY } from '@/copy/manager';
import { SkBackBar, SkBtnAction, SkNote, SkRows } from '../../components/skeleton';
import '../../styles/skeleton.css';

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
/* 骨架内联样（.sk 作用域 token；触件 ≥44px；零新色）                      */
/* ------------------------------------------------------------------ */

const cardSt: CSSProperties = {
  margin: '12px 22px 0',
  background: 'var(--card)',
  borderRadius: 18,
  padding: '14px 16px',
  boxShadow: '0 1px 2px rgba(42, 31, 21, .05)',
};
const monoSm: CSSProperties = { fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--muted)' };

/** 淡黄主钮（页内区行动；G2 全宽主行动走 SkBtnAction） */
const GOLD_BTN: CSSProperties = {
  minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 999, background: 'var(--gold-pale)', color: 'var(--ink-deep)',
  fontSize: 12.5, fontWeight: 700, padding: '0 18px', border: 0, cursor: 'pointer', fontFamily: 'inherit',
};
/** 深棕出口钮（非授权引导页；34 号档 §4.11 空态件=深棕钮） */
const GUIDE_BTN: CSSProperties = { ...GOLD_BTN, background: 'var(--ink-deep)', color: 'var(--gold-pale)' };

function Chip({ tone = 'plain', children }: { tone?: 'plain' | 'warn' | 'danger' | 'ok'; children: ReactNode }) {
  const st: CSSProperties =
    tone === 'danger'
      ? { background: 'rgba(180, 80, 46, .12)', color: 'var(--danger)' }
      : tone === 'warn'
        ? { background: 'var(--gold-pale)', color: 'var(--ink-deep)' }
        : tone === 'ok'
          ? { background: 'var(--gold)', color: 'var(--ink-deep)' }
          : { background: 'var(--paper)', color: 'var(--muted)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '2px 8px', fontSize: 9.5, fontWeight: 700, ...st }}>
      {children}
    </span>
  );
}

/** 区题（题 12.5/800 + 右 mono 注） */
function SecTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <p style={{ margin: '18px 22px 0', display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5, fontWeight: 800 }}>
      {title}
      {aside ? <span className="sk-mono" style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 500, color: 'var(--muted)' }}>{aside}</span> : null}
    </p>
  );
}

/** 白卡区（非异常卡区通用容器） */
function Sec({ testid, children }: { testid: string; children: ReactNode }) {
  return (
    <section style={cardSt} data-testid={testid}>
      {children}
    </section>
  );
}

function QueryState({ pending, error, empty, emptyText }: { pending: boolean; error: unknown; empty: boolean; emptyText: string }) {
  if (pending) return <p style={{ padding: '8px 2px 0', ...monoSm }}>{MANAGER_COPY['manager.loading']}</p>;
  if (error) return <p style={{ padding: '8px 2px 0', ...monoSm, color: 'var(--danger)' }}>{errMsg(error)}</p>;
  if (empty) return <p style={{ padding: '8px 2px 0', ...monoSm }}>{emptyText}</p>;
  return null;
}

/** 批准（SkBtnAction 淡黄）+ 驳回（sk-btn-ghost 描边）双钮行 */
function ApproveRejectRow({
  approveText,
  rejectText,
  busy,
  onApprove,
  onReject,
  approveTestId,
  rejectTestId,
}: {
  approveText: string;
  rejectText: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  approveTestId?: string;
  rejectTestId?: string;
}) {
  return (
    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <SkBtnAction onClick={onApprove} disabled={busy} testId={approveTestId}>
          {approveText}
        </SkBtnAction>
      </div>
      <button type="button" className="sk-btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={onReject} data-testid={rejectTestId}>
        {rejectText}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 非授权引导页（RoleGuidePage 同口径：明确引导，非 403 白屏）              */
/* ------------------------------------------------------------------ */

function GuideCard() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', minHeight: '60vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 22px', textAlign: 'center' }} data-testid="manager-guide">
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 900 }}>{MANAGER_COPY['manager.guide.title']}</h1>
      <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>
        {MANAGER_COPY['manager.guide.desc']}
      </p>
      <button
        type="button"
        data-testid="manager-guide-back"
        onClick={() => navigate('/me', { replace: true })}
        style={{ ...GUIDE_BTN, marginTop: 20, minWidth: 200 }}
      >
        {MANAGER_COPY['manager.guide.back']}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. 考勤审批（S-11 主区：异常卡 ×N 左 3px 赭红 + 批准/驳回 + S7 留痕）     */
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
    <>
      <SecTitle
        title={MANAGER_COPY['manager.sec.attendance']}
        aside={approvals.length ? `${approvals.length} ${MANAGER_COPY['manager.aside.pending']}` : undefined}
      />
      <div data-testid="manager-attendance">
        <div style={{ margin: '0 22px' }}>
          <QueryState pending={q.isPending} error={q.error} empty={approvals.length === 0 && flagged.length === 0} emptyText={MANAGER_COPY['manager.attendance.empty']} />
        </div>
        {/* 异常卡 ×N（理由 + 批准/驳回，左 3px 赭红） */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {approvals.map((a) => (
            <li
              key={a.id}
              style={{ ...cardSt, borderLeft: '3px solid var(--danger)' }}
              data-testid={`manager-attendance-row-${a.id}`}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Chip tone={a.type === 'makeup' ? 'warn' : 'danger'}>{a.type === 'makeup' ? '补卡' : '异常'}</Chip>
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>{staffNameOf(a.staffId)}</span>
                <span className="sk-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{a.date}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>· {KIND_LABEL[a.kind] ?? a.kind}</span>
              </div>
              <p style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>{a.reason}</p>
              {a.type === 'makeup' && a.requestedTs ? (
                <p style={{ ...monoSm, marginTop: 2 }}>
                  申请补卡时间 {hhmm(a.requestedTs)}
                </p>
              ) : null}
              <ApproveRejectRow
                approveText={MANAGER_COPY['manager.approve']}
                rejectText={MANAGER_COPY['manager.reject']}
                busy={busy}
                onApprove={() => resolveM.mutate({ approvalId: a.id, approve: true })}
                onReject={() => reject(a.id)}
                approveTestId={`manager-attendance-approve-${a.id}`}
                rejectTestId={`manager-attendance-reject-${a.id}`}
              />
            </li>
          ))}
        </ul>
        {/* S7 留痕记录（防代打标记 · 本月 · 只读） */}
        {flagged.length > 0 ? (
          <>
            <p style={{ margin: '14px 22px 0', fontSize: 10, fontWeight: 800, color: 'var(--muted)' }}>{MANAGER_COPY['manager.sec.flagged']}</p>
            <SkRows>
              {flagged.map((r) => (
                <div className="row" key={r.id} data-testid={`manager-flagged-row-${r.id}`}>
                  <span className="lb" style={{ minWidth: 0, flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <Chip tone="danger">防代打</Chip>
                    <span style={{ fontWeight: 700 }}>{staffNameOf(r.staffId)}</span>
                    <span className="sk-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                      {r.date} · {KIND_LABEL[r.kind] ?? r.kind} · {RECORD_STATUS_LABEL[r.status] ?? r.status} · {hhmm(r.ts)}
                    </span>
                  </span>
                </div>
              ))}
            </SkRows>
          </>
        ) : null}
      </div>
      {/* 口径注：驳回强制原因 · 全留痕 */}
      <SkNote>{MANAGER_COPY['manager.attendance.note']}</SkNote>
    </>
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
    <>
      <SecTitle
        title={MANAGER_COPY['manager.sec.cancel']}
        aside={rows.length ? `${rows.length} ${MANAGER_COPY['manager.aside.pending']}` : undefined}
      />
      <div data-testid="manager-cancel">
        <div style={{ margin: '0 22px' }}>
          <QueryState pending={q.isPending} error={q.error} empty={rows.length === 0} emptyText={MANAGER_COPY['manager.cancel.empty']} />
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((a) => (
            <li key={a.id} style={{ ...cardSt, borderLeft: '3px solid var(--danger)' }} data-testid={`manager-cancel-row-${a.id}`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>{a.petName ?? '宠物'}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{a.serviceName ?? ''}</span>
                <span className="sk-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                  预约 {`${mmdd(a.scheduledStart)} ${hhmm(a.scheduledStart)}`}
                </span>
              </div>
              <p style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
                客户 {a.customerName ?? '—'}
                {a.customerPhoneTail ? `（尾号 ${a.customerPhoneTail}）` : ''} · 原因：{a.cancelReason ?? '（未填）'}
              </p>
              <ApproveRejectRow
                approveText={MANAGER_COPY['manager.cancel.approve']}
                rejectText={MANAGER_COPY['manager.reject']}
                busy={busy}
                onApprove={() => reviewM.mutate({ appointmentId: a.id, approve: true })}
                onReject={() => reviewM.mutate({ appointmentId: a.id, approve: false })}
                approveTestId={`manager-cancel-approve-${a.id}`}
                rejectTestId={`manager-cancel-reject-${a.id}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
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
  /* 本页恒走非盲交路径（不传 blind）→ stats 恒非空（server 类型=可空 union，收窄见片 3 申报） */
  const st = p?.stats ?? null;
  const bookCashFen = st?.tender.cashFen ?? 0;
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

  const dlRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' };

  return (
    <>
      <SecTitle title={MANAGER_COPY['manager.sec.dayclose']} aside={MANAGER_COPY['manager.aside.dayclose']} />
      <Sec testid="manager-dayclose">
        <QueryState pending={previewQ.isPending} error={previewQ.error} empty={false} emptyText="" />
        {p ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sk-mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{p.bizDate}</span>
              {p.existingFrozenCloseId ? <Chip tone="ok">今日已日结冻结</Chip> : <Chip tone="warn">待日结</Chip>}
            </div>
            <dl style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
              <div style={dlRow}>
                <dt>已收合计</dt>
                <dd className="sk-mono" style={{ fontWeight: 700, color: 'var(--ink)' }}>{yuan(st!.receivedTotalFen)}</dd>
              </div>
              <div style={dlRow}>
                <dt>笔数</dt>
                <dd className="sk-mono" style={{ fontWeight: 700, color: 'var(--ink)' }}>{st!.counts.paidCount}</dd>
              </div>
              <div style={dlRow}>
                <dt>现金</dt>
                <dd className="sk-mono">{yuan(st!.tender.cashFen)}</dd>
              </div>
              <div style={dlRow}>
                <dt>微信</dt>
                <dd className="sk-mono">{yuan(st!.tender.wechatFen)}</dd>
              </div>
              <div style={dlRow}>
                <dt>支付宝</dt>
                <dd className="sk-mono">{yuan(st!.tender.alipayFen)}</dd>
              </div>
            </dl>
            {p.existingFrozenCloseId ? null : (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--hairline-soft)', paddingTop: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)' }} htmlFor="manager-dayclose-cash">
                  实点现金（元）· 账面 <span className="sk-mono">{yuan(bookCashFen)}</span>
                </label>
                <input
                  id="manager-dayclose-cash"
                  data-testid="manager-dayclose-cash"
                  value={cashText}
                  onChange={(e) => setCashText(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="sk-mono"
                  style={{
                    marginTop: 6, height: 44, width: '100%', borderRadius: 14, border: '1px solid var(--hairline)',
                    background: 'var(--paper)', padding: '0 12px', fontSize: 13, color: 'var(--ink)', outline: 'none',
                  }}
                />
                {diffFen !== null ? (
                  <p className="sk-mono" style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: diffFen === 0 ? 'var(--muted)' : diffFen < 0 ? 'var(--danger)' : 'var(--ink-deep)' }}>
                    差异 {signedYuan(diffFen)}
                  </p>
                ) : null}
                <div style={{ marginTop: 10 }}>
                  <SkBtnAction onClick={submit} disabled={closeM.isPending} testId="manager-dayclose-submit">
                    {closeM.isPending ? '冻结中…' : '确认日结（冻结全日账目）'}
                  </SkBtnAction>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Sec>
    </>
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
  // R11a：server 新增退会退款类型（会员退会）
  membership_cancel: '会员退会',
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
    <>
      <SecTitle
        title={MANAGER_COPY['manager.sec.refund']}
        aside={pending.length ? `${pending.length} ${MANAGER_COPY['manager.aside.refundPending']}` : undefined}
      />
      <Sec testid="manager-refund">
        {/* 实退待办：executed 超 24h 未登记（淡黄提醒列表） */}
        <QueryState pending={pendingQ.isPending} error={pendingQ.error} empty={false} emptyText="" />
        {pending.length > 0 ? (
          <div style={{ borderRadius: 14, background: 'var(--gold-pale)', padding: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-deep)' }}>{MANAGER_COPY['manager.refund.pendingNote']}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {pending.map((r) => {
                const overdueH = Math.max(1, Math.floor((nowMs - r.createdAt.getTime()) / 3_600_000));
                return (
                  <li key={r.id} style={{ padding: '10px 0', boxShadow: 'inset 0 1px 0 rgba(59, 46, 36, .08)' }} data-testid={`manager-refund-pending-${r.id}`}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      <Chip>超 24h</Chip>
                      <span className="sk-mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{r.refundNo}</span>
                      <span style={{ fontSize: 10, color: 'var(--ink)' }}>
                        原单 <span className="sk-mono">{r.billNo}</span>
                      </span>
                    </div>
                    <p style={{ marginTop: 4, fontSize: 10, color: 'var(--ink)' }}>
                      金额 <span className="sk-mono" style={{ fontWeight: 700, color: 'var(--danger)' }}>−{yuan(r.amountFen)}</span> · 执行{' '}
                      <span className="sk-mono">{`${mmdd(r.createdAt)} ${hhmm(r.createdAt)}`}</span> · 已超时{' '}
                      <span className="sk-mono" style={{ fontWeight: 700, color: 'var(--danger)' }}>{overdueH} 小时</span>
                    </p>
                    <button
                      type="button"
                      style={{ ...GOLD_BTN, marginTop: 8, background: 'var(--card)' }}
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
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginTop: pending.length > 0 ? 12 : 0 }}>
          {MANAGER_COPY['manager.refund.listNote']}
        </p>
        <QueryState pending={listQ.isPending} error={listQ.error} empty={rows.length === 0} emptyText={MANAGER_COPY['manager.refund.empty']} />
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ padding: '10px 0', boxShadow: 'inset 0 1px 0 var(--hairline-soft)' }} data-testid={`manager-refund-row-${r.id}`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Chip>{REFUND_TYPE_LABEL[r.type] ?? r.type}</Chip>
                <span className="sk-mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{r.refundNo}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  原单 <span className="sk-mono">{r.billNo}</span>
                </span>
                <span style={{ marginLeft: 'auto' }}>
                  <Chip
                    tone={
                      r.status === 'settled' ? 'ok' : r.status === 'rejected' ? 'danger' : r.status === 'draft' ? 'warn' : 'plain'
                    }
                  >
                    {REFUND_STATUS_LABEL[r.status] ?? r.status}
                  </Chip>
                </span>
              </div>
              <p style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>
                金额 <span className="sk-mono" style={{ fontWeight: 700, color: 'var(--danger)' }}>−{yuan(r.amountFen)}</span> · 退款日{' '}
                <span className="sk-mono">{r.bizDate}</span>
                {r.settledAt ? (
                  <>
                    {' '}· 实退 <span className="sk-mono">{`${mmdd(r.settledAt)} ${hhmm(r.settledAt)}`}</span>
                  </>
                ) : null}
              </p>
              <p style={{ marginTop: 2, fontSize: 10, color: 'var(--muted)' }}>
                原因：{r.reason} · 发起 {r.operatorName ?? '—'} · 审批 {r.approverName ?? '—'}
              </p>
              {r.status === 'draft' ? (
                <p style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>
                  {MANAGER_COPY['manager.refund.draftNote']}
                </p>
              ) : null}
              {r.status === 'executed' ? (
                <button
                  type="button"
                  style={{ ...GOLD_BTN, marginTop: 8 }}
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
      </Sec>
    </>
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
    <>
      <SecTitle
        title={MANAGER_COPY['manager.sec.inventory']}
        aside={counted.length ? `${counted.length} ${MANAGER_COPY['manager.aside.counted']}` : undefined}
      />
      <Sec testid="manager-inventory">
        {/* 派任务 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {(['daily', 'weekly', 'blind'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="sk-btn-ghost"
              style={{ flexDirection: 'column', gap: 2, padding: '6px 8px', height: 'auto' }}
              disabled={assignM.isPending}
              onClick={() => assignM.mutate(t)}
              data-testid={`manager-assign-${t}`}
            >
              <span>{COUNT_TYPE_LABEL[t]}</span>
              <span className="sk-mono" style={{ fontSize: 8.5, fontWeight: 400, color: 'var(--muted)' }}>
                {t === 'daily' ? '单价≥100元' : t === 'weekly' ? '全量' : '盲盘'}
              </span>
            </button>
          ))}
        </div>

        {/* counted 确认队列 */}
        <p style={{ marginTop: 12, fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>{MANAGER_COPY['manager.inventory.countedNote']}</p>
        <QueryState pending={countedQ.isPending} error={countedQ.error} empty={counted.length === 0} emptyText={MANAGER_COPY['manager.inventory.countedEmpty']} />
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {counted.map((c) => {
            const diffs = c.items.filter((it) => it.actualStock !== null && it.actualStock !== it.systemStock);
            const unfilled = c.items.filter((it) => it.actualStock === null).length;
            return (
              <li key={c.id} style={{ padding: '12px 0', boxShadow: 'inset 0 1px 0 var(--hairline-soft)' }} data-testid={`manager-count-row-${c.id}`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <Chip tone="warn">{COUNT_TYPE_LABEL[c.type] ?? c.type}</Chip>
                  <span className="sk-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                    建单 {`${mmdd(c.createdAt)} ${hhmm(c.createdAt)}`} · 共 {c.items.length} 项 · 差异 {diffs.length} 项
                  </span>
                </div>
                {unfilled > 0 ? (
                  <p style={{ marginTop: 4, fontSize: 10, color: 'var(--danger)' }}>有 {unfilled} 项未录入实盘，确认将被 server 拒绝</p>
                ) : null}
                {diffs.length > 0 ? (
                  <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 4 }}>
                    {diffs.map((it) => {
                      const d = it.actualStock! - it.systemStock;
                      return (
                        <li key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
                          <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{it.productName ?? '（商品已删）'}</span>
                          <span className="sk-mono" style={{ flex: 'none', color: 'var(--muted)' }}>
                            {it.systemStock} → {it.actualStock}
                          </span>
                          <span className="sk-mono" style={{ flex: 'none', width: 40, textAlign: 'right', fontWeight: 700, color: d < 0 ? 'var(--danger)' : 'var(--ink-deep)' }}>
                            {d > 0 ? `+${d}` : `−${Math.abs(d)}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>账实一致，无差异</p>
                )}
                <ApproveRejectRow
                  approveText="确认入账"
                  rejectText={MANAGER_COPY['manager.reject']}
                  busy={busy}
                  onApprove={() => confirmM.mutate(c.id)}
                  onReject={() => reject(c.id)}
                  approveTestId={`manager-count-confirm-${c.id}`}
                  rejectTestId={`manager-count-reject-${c.id}`}
                />
              </li>
            );
          })}
        </ul>

        {/* 最近已入账 */}
        <p style={{ marginTop: 12, fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>{MANAGER_COPY['manager.sec.posted']}</p>
        <QueryState pending={postedQ.isPending} error={postedQ.error} empty={posted.length === 0} emptyText={MANAGER_COPY['manager.inventory.postedEmpty']} />
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {posted.map((c) => (
            <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', boxShadow: 'inset 0 1px 0 var(--hairline-soft)' }} data-testid={`manager-count-posted-${c.id}`}>
              <Chip tone="ok">{COUNT_TYPE_LABEL[c.type] ?? c.type}</Chip>
              <span className="sk-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                入账 {c.postedAt ? `${mmdd(c.postedAt)} ${hhmm(c.postedAt)}` : '—'} · 共 {c.items.length} 项
              </span>
            </li>
          ))}
        </ul>
      </Sec>
    </>
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
    <>
      <SecTitle title={MANAGER_COPY['manager.sec.reviews']} aside={MANAGER_COPY['manager.aside.reviews']} />
      <Sec testid="manager-reviews">
        <QueryState pending={q.isPending} error={q.error} empty={rows.length === 0} emptyText={MANAGER_COPY['manager.reviews.empty']} />
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ padding: '10px 0', boxShadow: 'inset 0 1px 0 var(--hairline-soft)' }} data-testid={`manager-review-row-${r.id}`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>{r.staffName ?? '—'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)' }} aria-label={`${r.rating} 星`}>
                  {'★'.repeat(r.rating)}
                </span>
                {r.anonymous ? <Chip>匿名</Chip> : null}
                <span className="sk-mono" style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--muted)' }}>
                  {`${mmdd(r.createdAt)} ${hhmm(r.createdAt)}`}
                </span>
              </div>
              <p style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>{r.text ?? '（未留文字）'}</p>
            </li>
          ))}
        </ul>
      </Sec>
    </>
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
    <>
      <SecTitle title={MANAGER_COPY['manager.sec.movements']} aside={MANAGER_COPY['manager.aside.movements']} />
      <Sec testid="manager-movements">
        <QueryState pending={q.isPending} error={q.error} empty={rows.length === 0} emptyText={MANAGER_COPY['manager.movements.empty']} />
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((m) => (
            <li key={m.id} style={{ padding: '10px 0', boxShadow: 'inset 0 1px 0 var(--hairline-soft)' }} data-testid={`manager-movement-row-${m.id}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="sk-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{`${mmdd(m.createdAt)} ${hhmm(m.createdAt)}`}</span>
                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700 }}>{m.productName ?? '（商品已删）'}</span>
                <span className="sk-mono" style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: m.delta < 0 ? 'var(--danger)' : 'var(--ink-deep)' }}>
                  {m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
                </span>
              </div>
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}>
                <Chip>{SOURCE_TYPE_LABEL[m.sourceType] ?? m.sourceType}</Chip>
                <span className="sk-mono">
                  {m.beforeStock} → {m.afterStock}
                </span>
                <span>操作人 {operatorNameOf(m.operatorId)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Sec>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                  */
/* ------------------------------------------------------------------ */

export default function ManagerPage() {
  const { trpc } = usePhiliaClient();
  const { user, loading } = useMe();
  const { showToast, toastEl } = useToast();

  // 店名（backbar mono 注；与 MePage 同 queryKey 共享缓存）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'staffDetail'],
    queryFn: () => trpc.auth.me.query(),
  });
  const storeName = meQuery.data?.store?.name ?? null;

  const isManager = (user?.roles ?? []).some((r) => r === 'merchant_manager' || r === 'merchant_owner');

  return (
    <div className="sk">
      <SkBackBar title={MANAGER_COPY['manager.title']} fallback="/me" note={storeName ?? undefined} />
      {loading ? (
        <p style={{ padding: '8px 22px 0', fontSize: 12.5, color: 'var(--muted)' }}>{MANAGER_COPY['manager.loading']}</p>
      ) : !isManager ? (
        <GuideCard />
      ) : (
        <ManagerBody userId={user!.id} userNickname={user!.nickname} showToast={showToast} />
      )}
      <div style={{ paddingBottom: 32 }} />
      {toastEl}
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
    <div>
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
