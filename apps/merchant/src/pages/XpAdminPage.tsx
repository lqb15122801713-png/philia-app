/**
 * XP 审核 /xp-admin（员工端骨架整建批 片 4 B4 · 商家端）
 *
 * 一页三竖排分区（u3-panel 竖排工艺照 OpsPage）：
 * - 区 1 积分申报审批：xp.listApplications(appKind=award 滤) 的 pending 列表
 *   （员工/分值/理由/时刻）→ 批准/驳回（note 必填走 Modal 弹层）；
 * - 区 2 扣分异议审批：revoke_appeal pending 列表（原事件分值/理由透出）→
 *   批准=对冲（原负分保留，另写正向对冲行；注记明面）；
 * - 区 3 审批历史：approved/rejected 两表（审核意见+时刻留痕）。
 *
 * server xp 命名空间审核扩展由 coder J 并行施工，契约经 lib/payrollXpPort.ts
 * 收窄桥接。权限三层照排班页：MerchantRail groupsFor 分流 + ClerkRouteGuard +
 * 页内 useMerchantRole 非 owner/manager → RoleGuidePage。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg } from '../components/staff-admin/format';
import { Badge, Btn, Modal, toast, ToasterMount } from '../components/staff-admin/ui';
import { xp } from '../copy/xpAdmin';
import { xpAdminOf, type XpApplicationRow } from '../lib/payrollXpPort';
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

function kindLabel(kind: string): string {
  if (kind === 'award') return xp('xpadmin.history.kindAward');
  if (kind === 'revoke_appeal') return xp('xpadmin.history.kindRevoke');
  return kind;
}

/** 审批弹层诉求（积分申报/扣分异议共用；note 必填） */
type ReviewAsk = { kind: 'approve' | 'reject'; app: XpApplicationRow };

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function XpAdminPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();
  const xpAdmin = useMemo(() => xpAdminOf(trpc), [trpc]);

  /* ---- 待审批（申报+异议同口取，前端按 appKind 分区） ---- */
  const pendingQ = useQuery({
    queryKey: ['xpAdmin', 'applications', 'pending'],
    queryFn: () => xpAdmin.listApplications.query({ status: 'pending' }),
  });

  /* ---- 历史（approved/rejected 各一表） ---- */
  const approvedQ = useQuery({
    queryKey: ['xpAdmin', 'applications', 'approved'],
    queryFn: () => xpAdmin.listApplications.query({ status: 'approved' }),
  });
  const rejectedQ = useQuery({
    queryKey: ['xpAdmin', 'applications', 'rejected'],
    queryFn: () => xpAdmin.listApplications.query({ status: 'rejected' }),
  });

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['xpAdmin'] });

  /* ---- 审批弹层（note 必填） ---- */
  const [ask, setAsk] = useState<ReviewAsk | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const openAsk = (a: ReviewAsk) => {
    setNote('');
    setAsk(a);
  };
  const submitAsk = async () => {
    if (!ask) return;
    if (!note.trim()) {
      toast(xp('xpadmin.review.noteRequired'), 'error');
      return;
    }
    setBusy(true);
    try {
      await xpAdmin.reviewApplication.mutate({
        applicationId: ask.app.id,
        result: ask.kind === 'approve' ? 'approved' : 'rejected',
        note: note.trim(),
      });
      toast(ask.kind === 'approve' ? xp('xpadmin.review.approved') : xp('xpadmin.review.rejected'));
      setAsk(null);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!role.canManage) {
    return <RoleGuidePage title={xp('xpadmin.guideTitle')} hint={xp('xpadmin.guideHint')} />;
  }

  const pending = pendingQ.data?.applications ?? [];
  const awardPending = pending.filter((a) => a.appKind === 'award');
  const revokePending = pending.filter((a) => a.appKind === 'revoke_appeal');
  const approved = approvedQ.data?.applications ?? [];
  const rejected = rejectedQ.data?.applications ?? [];

  const renderPendingRow = (a: XpApplicationRow, isRevoke: boolean) => (
    <div key={a.id} className="border-t border-[rgba(59,46,36,.06)]" data-testid={`xpadmin-row-${a.id}`}>
      <div className="flex flex-wrap items-center gap-2 px-[17px] py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-body-sm font-bold text-ink">{a.staffName ?? a.staffId}</span>
            <Badge tone="brand">
              {isRevoke ? xp('xpadmin.revoke.pointsLine', { n: a.pointsRequested }) : xp('xpadmin.award.pointsLine', { n: a.pointsRequested })}
            </Badge>
            {isRevoke && a.targetEventPoints != null ? (
              <Badge tone="muted">{xp('xpadmin.revoke.originalLine', { n: a.targetEventPoints })}</Badge>
            ) : null}
          </div>
          <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.62)]">
            {xp('xpadmin.review.reasonLabel')}：{a.reason}
          </div>
          <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
            {xp('xpadmin.review.appliedAt', { at: fmtAt(a.createdAt) })}
          </div>
        </div>
        <Btn
          variant="primary"
          size="sm"
          onClick={() => openAsk({ kind: 'approve', app: a })}
          data-testid={`xpadmin-approve-${a.id}`}
        >
          {xp('xpadmin.review.approveCta')}
        </Btn>
        <Btn
          variant="subtle"
          size="sm"
          onClick={() => openAsk({ kind: 'reject', app: a })}
          data-testid={`xpadmin-reject-${a.id}`}
        >
          {xp('xpadmin.review.rejectCta')}
        </Btn>
      </div>
    </div>
  );

  const renderHistory = (list: XpApplicationRow[], status: 'approved' | 'rejected') => (
    <div className="min-w-0 flex-1">
      <p className="px-[17px] pt-3 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
        {status === 'approved' ? xp('xpadmin.history.statusApproved') : xp('xpadmin.history.statusRejected')}（{list.length}）
      </p>
      {list.length === 0 ? (
        <p className="px-[17px] py-6 text-center text-caption text-[rgba(59,46,36,.62)]">{xp('xpadmin.history.empty')}</p>
      ) : (
        list.map((a) => (
          <div key={a.id} className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`xpadmin-history-row-${a.id}`}>
            <div className="flex items-center gap-1.5">
              <span className="text-body-sm font-bold text-ink">{a.staffName ?? a.staffId}</span>
              <Badge tone="muted">{kindLabel(a.appKind)}</Badge>
              <Badge tone={status === 'approved' ? 'success' : 'danger'}>
                {status === 'approved' ? xp('xpadmin.history.statusApproved') : xp('xpadmin.history.statusRejected')}
              </Badge>
              <span className="u1-num text-caption-xs text-[rgba(59,46,36,.42)]">+{a.pointsRequested}</span>
            </div>
            <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.62)]">
              {xp('xpadmin.review.reasonLabel')}：{a.reason}
            </div>
            {a.reviewNote ? (
              <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.62)]">
                {xp('xpadmin.history.reviewLine', {
                  result: status === 'approved' ? xp('xpadmin.history.statusApproved') : xp('xpadmin.history.statusRejected'),
                  note: a.reviewNote,
                })}
                {a.reviewedAt ? (
                  <span className="u1-num text-[rgba(59,46,36,.42)]"> · {xp('xpadmin.history.reviewedAt', { at: fmtAt(a.reviewedAt) })}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );

  return (
    <MainScaffold title={xp('xpadmin.pageTitle')} sub={xp('xpadmin.pageSub')} testid="xpadmin-page">
      <ToasterMount />

      {/* 区 1 积分申报审批 */}
      <div className="u3-panel mb-4" data-testid="xpadmin-award">
        <div className="u3-panel-head">
          <h3>{xp('xpadmin.award.title')}</h3>
          <span className="aside">{xp('xpadmin.award.aside')}</span>
        </div>
        {pendingQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : pendingQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{xp('xpadmin.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void pendingQ.refetch()}>
                {xp('xpadmin.common.retry')}
              </Btn>
            </div>
          </div>
        ) : awardPending.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {xp('xpadmin.award.empty')}
          </p>
        ) : (
          awardPending.map((a) => renderPendingRow(a, false))
        )}
      </div>

      {/* 区 2 扣分异议审批（批准=对冲注记明面） */}
      <div className="u3-panel mb-4" data-testid="xpadmin-revoke">
        <div className="u3-panel-head">
          <h3>{xp('xpadmin.revoke.title')}</h3>
          <span className="aside">{xp('xpadmin.revoke.aside')}</span>
        </div>
        {pendingQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            <Skeleton className="mb-2.5 h-12 !rounded-[16px]" />
          </div>
        ) : pendingQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center">
            <p className="text-caption text-[rgba(59,46,36,.62)]">{xp('xpadmin.common.loadFail')}</p>
          </div>
        ) : revokePending.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {xp('xpadmin.revoke.empty')}
          </p>
        ) : (
          <>
            {revokePending.map((a) => renderPendingRow(a, true))}
            <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2 text-caption-xs text-[rgba(59,46,36,.42)]">
              {xp('xpadmin.revoke.hedgeNote')}
            </p>
          </>
        )}
      </div>

      {/* 区 3 审批历史（approved/rejected 两表并排，窄屏自然竖排） */}
      <div className="u3-panel" data-testid="xpadmin-history">
        <div className="u3-panel-head">
          <h3>{xp('xpadmin.history.title')}</h3>
          <span className="aside">{xp('xpadmin.history.aside')}</span>
        </div>
        <div className="flex flex-col gap-3 border-t border-[rgba(59,46,36,.06)] pb-3 lg:flex-row lg:gap-0 lg:divide-x lg:divide-[rgba(59,46,36,.06)]">
          {renderHistory(approved, 'approved')}
          {renderHistory(rejected, 'rejected')}
        </div>
      </div>

      {/* 审批弹层（note 必填） */}
      <Modal
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={
          ask
            ? ask.kind === 'approve'
              ? xp('xpadmin.review.approveTitle', { name: ask.app.staffName ?? ask.app.staffId })
              : xp('xpadmin.review.rejectTitle', { name: ask.app.staffName ?? ask.app.staffId })
            : ''
        }
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAsk(null)} disabled={busy}>
              {xp('xpadmin.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitAsk()} disabled={busy} data-testid="xpadmin-note-submit">
              {busy ? xp('xpadmin.common.submitting') : xp('xpadmin.common.confirm')}
            </Btn>
          </>
        }
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder={xp('xpadmin.review.notePh')}
          data-testid="xpadmin-note-input"
          className="w-full resize-none rounded-input bg-card px-3 py-2.5 text-caption text-ink shadow-hairline ring-1 ring-line-ring placeholder:text-ink-placeholder focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
        />
      </Modal>
    </MainScaffold>
  );
}
