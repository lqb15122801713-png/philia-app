/**
 * 运营 /ops（员工端骨架整建批 片 3 B5 · 商家端）
 *
 * 一页三竖排分区（u3-panel 竖排工艺照 ScheduleManagePage）：
 * - 区 1 PDCA 问题闭环：pdca.list（状态滤签 全部/待整改/整改中/待复检/已闭环）+
 *   待复检行出复检动作（recheck pass/fail，note 必填走 Modal 弹层）+ 行内展开
 *   timeline 透出（只增留痕）；
 * - 区 2 自检审核：selfCheck.listPending 列表 → 行内展开自检快照逐项（打点态/
 *   分值）+ score → review（note 必填同弹层）；
 * - 区 3 巡检汇总：pdca.summary 卡（byStatus 计数 chips / byCategory 排行 top5 /
 *   closed30d）+ 单店口径注记（跨店排行=开口项 5 候连锁合批）。
 *
 * server 命名空间由 coder G 并行施工，契约经 lib/taskCollabPort.ts 收窄桥接。
 * 权限三层照排班页：MerchantRail groupsFor 分流 + ClerkRouteGuard + 页内
 * useMerchantRole 非 owner/manager → RoleGuidePage。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg } from '../components/staff-admin/format';
import { Badge, Btn, Modal, toast, ToasterMount } from '../components/staff-admin/ui';
import { op } from '../copy/ops';
import { collabOf, type SelfCheckRunRow } from '../lib/taskCollabPort';
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

/** PDCA 状态键 → 滤签/徽章口径（未知键原样透出） */
const PDCA_STATUS_KEYS = ['open', 'fixing', 'recheck', 'closed'] as const;
function pdcaStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return op('ops.pdca.statusOpen');
    case 'fixing':
      return op('ops.pdca.statusFixing');
    case 'recheck':
      return op('ops.pdca.statusRecheck');
    case 'closed':
      return op('ops.pdca.statusClosed');
    default:
      return status;
  }
}
function pdcaStatusTone(status: string): 'brand' | 'success' | 'danger' | 'muted' {
  if (status === 'closed') return 'success';
  if (status === 'recheck') return 'brand';
  if (status === 'open') return 'danger';
  return 'muted';
}

/** note 必填弹层诉求（复检 pass/fail 与自检审核共用） */
type NoteAsk =
  | { kind: 'recheck'; id: string; result: 'pass' | 'fail'; title: string }
  | { kind: 'selfReview'; runId: string; title: string };

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function OpsPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();
  const collab = useMemo(() => collabOf(trpc), [trpc]);

  /* ---- 区 1 PDCA ---- */
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const pdcaQ = useQuery({
    queryKey: ['ops', 'pdca', statusFilter],
    queryFn: () => collab.pdca.list.query(statusFilter === 'all' ? {} : { status: statusFilter }),
  });
  const [expandIssue, setExpandIssue] = useState<string | null>(null);

  /* ---- 区 2 自检审核 ---- */
  const selfQ = useQuery({
    queryKey: ['ops', 'selfCheck'],
    queryFn: () => collab.selfCheck.listPending.query(),
  });
  const [expandRun, setExpandRun] = useState<string | null>(null);

  /* ---- 区 3 汇总 ---- */
  const summaryQ = useQuery({
    queryKey: ['ops', 'summary'],
    queryFn: () => collab.pdca.summary.query(),
  });

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['ops'] });

  /* ---- note 必填弹层（复检/自检审核共用） ---- */
  const [ask, setAsk] = useState<NoteAsk | null>(null);
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const openAsk = (a: NoteAsk) => {
    setNote('');
    setAsk(a);
  };
  const submitAsk = async () => {
    if (!ask) return;
    if (!note.trim()) {
      toast(ask.kind === 'recheck' ? op('ops.pdca.noteRequired') : op('ops.self.noteRequired'), 'error');
      return;
    }
    setNoteBusy(true);
    try {
      if (ask.kind === 'recheck') {
        await collab.pdca.recheck.mutate({ issueId: ask.id, result: ask.result, note: note.trim() });
        toast(op('ops.pdca.recheckDone'));
      } else {
        await collab.selfCheck.review.mutate({ runId: ask.runId, note: note.trim() });
        toast(op('ops.self.reviewDone'));
      }
      setAsk(null);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setNoteBusy(false);
    }
  };

  if (!role.canManage) {
    return <RoleGuidePage title={op('ops.guideTitle')} hint={op('ops.guideHint')} />;
  }

  const issues = pdcaQ.data?.issues ?? [];
  const runs = selfQ.data?.runs ?? [];
  const summary = summaryQ.data;
  const topCategories = useMemo(
    () => [...(summary?.byCategory ?? [])].sort((a, b) => b.count - a.count).slice(0, 5),
    [summary],
  );

  return (
    <MainScaffold title={op('ops.pageTitle')} sub={op('ops.pageSub')} testid="ops-page">
      <ToasterMount />

      {/* 区 1 PDCA 问题闭环 */}
      <div className="u3-panel mb-4" data-testid="ops-pdca">
        <div className="u3-panel-head">
          <h3>{op('ops.pdca.title')}</h3>
          <span className="aside">{op('ops.pdca.aside')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3" data-testid="ops-pdca-filters">
          {['all', ...PDCA_STATUS_KEYS].map((k) => {
            const on = statusFilter === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setStatusFilter(k)}
                data-testid={`ops-pdca-filter-${k}`}
                className={`min-h-[36px] rounded-chip px-3 text-caption font-semibold transition-transform duration-120 ease-philia-spring active:scale-92 ${
                  on ? 'bg-ink text-[#F2DFA6]' : 'bg-sunken text-ink-secondary'
                }`}
              >
                {k === 'all' ? op('ops.pdca.filterAll') : pdcaStatusLabel(k)}
              </button>
            );
          })}
        </div>
        {pdcaQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : pdcaQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{op('ops.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void pdcaQ.refetch()}>
                {op('ops.common.retry')}
              </Btn>
            </div>
          </div>
        ) : issues.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {op('ops.pdca.empty')}
          </p>
        ) : (
          issues.map((it) => (
            <div key={it.id} className="border-t border-[rgba(59,46,36,.06)]" data-testid={`ops-pdca-row-${it.id}`}>
              <div className="flex flex-wrap items-center gap-2 px-[17px] py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-body-sm font-bold text-ink">{it.title}</span>
                    <Badge tone={pdcaStatusTone(it.status)}>{pdcaStatusLabel(it.status)}</Badge>
                    {it.category ? <Badge tone="muted">{it.category}</Badge> : null}
                  </div>
                  <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                    {fmtAt(it.createdAt)}
                    {it.raisedByName ? ` · ${it.raisedByName}` : ''}
                  </div>
                </div>
                {it.status === 'recheck' ? (
                  <>
                    <Btn
                      variant="primary"
                      size="sm"
                      onClick={() => openAsk({ kind: 'recheck', id: it.id, result: 'pass', title: `${op('ops.pdca.recheckPass')} · ${it.title}` })}
                      data-testid={`ops-pdca-pass-${it.id}`}
                    >
                      {op('ops.pdca.recheckPass')}
                    </Btn>
                    <Btn
                      variant="subtle"
                      size="sm"
                      onClick={() => openAsk({ kind: 'recheck', id: it.id, result: 'fail', title: `${op('ops.pdca.recheckFail')} · ${it.title}` })}
                      data-testid={`ops-pdca-fail-${it.id}`}
                    >
                      {op('ops.pdca.recheckFail')}
                    </Btn>
                  </>
                ) : null}
                <Btn
                  variant="subtle"
                  size="sm"
                  onClick={() => setExpandIssue((cur) => (cur === it.id ? null : it.id))}
                  data-testid={`ops-pdca-expand-${it.id}`}
                >
                  {expandIssue === it.id ? op('ops.pdca.collapseCta') : op('ops.pdca.expandCta')}
                </Btn>
              </div>
              {expandIssue === it.id ? (
                <div className="border-t border-[rgba(59,46,36,.06)] bg-canvas px-[17px] py-3" data-testid={`ops-pdca-detail-${it.id}`}>
                  {it.detail ? <p className="mb-2 text-caption text-ink">{it.detail}</p> : null}
                  {it.fixNote ? (
                    <p className="mb-1 text-caption-xs text-[rgba(59,46,36,.62)]">
                      {op('ops.pdca.fixNoteLabel')}：{it.fixNote}
                      {it.fixedAt ? <span className="u1-num">（{fmtAt(it.fixedAt)}）</span> : null}
                    </p>
                  ) : null}
                  {it.recheckNote ? (
                    <p className="mb-1 text-caption-xs text-[rgba(59,46,36,.62)]">
                      {op('ops.pdca.recheckNoteLabel')}：{it.recheckNote}
                      {it.recheckAt ? <span className="u1-num">（{fmtAt(it.recheckAt)}）</span> : null}
                    </p>
                  ) : null}
                  {it.timeline.length > 0 ? (
                    <div className="mt-2">
                      <p className="mb-1 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">{op('ops.pdca.timelineTitle')}</p>
                      {it.timeline.map((t, i) => (
                        <div key={i} className="flex items-baseline gap-2 py-0.5 text-caption-xs text-[rgba(59,46,36,.62)]">
                          <span className="u1-num shrink-0">{fmtAt(t.at)}</span>
                          <span className="font-semibold text-ink">{t.action}</span>
                          {t.by ? <span>{t.by}</span> : null}
                          {t.note ? <span className="min-w-0 flex-1 truncate">{t.note}</span> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* 区 2 自检审核 */}
      <div className="u3-panel mb-4" data-testid="ops-selfcheck">
        <div className="u3-panel-head">
          <h3>{op('ops.self.title')}</h3>
          <span className="aside">{op('ops.self.aside')}</span>
        </div>
        {selfQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : selfQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{op('ops.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void selfQ.refetch()}>
                {op('ops.common.retry')}
              </Btn>
            </div>
          </div>
        ) : runs.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {op('ops.self.empty')}
          </p>
        ) : (
          runs.map((r: SelfCheckRunRow) => (
            <div key={r.id} className="border-t border-[rgba(59,46,36,.06)]" data-testid={`ops-self-row-${r.id}`}>
              <div className="flex flex-wrap items-center gap-2 px-[17px] py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="u1-num text-body-sm font-bold text-ink">{r.bizDate}</span>
                    <Badge tone="brand">{op('ops.self.scoreLabel', { n: r.score })}</Badge>
                  </div>
                  <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                    {op('ops.self.filledBy', { name: r.filledByName ?? '—' })}
                  </div>
                </div>
                <Btn
                  variant="subtle"
                  size="sm"
                  onClick={() => setExpandRun((cur) => (cur === r.id ? null : r.id))}
                  data-testid={`ops-self-expand-${r.id}`}
                >
                  {expandRun === r.id ? op('ops.self.collapseCta') : op('ops.self.expandCta')}
                </Btn>
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => openAsk({ kind: 'selfReview', runId: r.id, title: `${op('ops.self.reviewCta')} · ${r.bizDate}` })}
                  data-testid={`ops-self-review-${r.id}`}
                >
                  {op('ops.self.reviewCta')}
                </Btn>
              </div>
              {expandRun === r.id ? (
                <div className="border-t border-[rgba(59,46,36,.06)] bg-canvas px-[17px] py-3" data-testid={`ops-self-detail-${r.id}`}>
                  {r.items.map((it) => (
                    <div key={it.key} className="flex items-center gap-2 py-1 text-caption">
                      <span className="min-w-0 flex-1 text-ink">{it.label}</span>
                      <span className="u1-num text-caption-xs text-[rgba(59,46,36,.42)]">{it.score}</span>
                      <Badge tone={it.passed === false ? 'danger' : 'success'}>
                        {it.passed === false ? op('ops.self.itemFailed') : op('ops.self.itemPassed')}
                      </Badge>
                      {it.note ? <span className="text-caption-xs text-[rgba(59,46,36,.62)]">{it.note}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* 区 3 巡检汇总（单店口径） */}
      <div className="u3-panel" data-testid="ops-summary">
        <div className="u3-panel-head">
          <h3>{op('ops.sum.title')}</h3>
          <span className="aside">{op('ops.sum.aside')}</span>
        </div>
        {summaryQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            <Skeleton className="h-16 !rounded-[16px]" />
          </div>
        ) : summaryQ.isError || !summary ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center">
            <p className="text-caption text-[rgba(59,46,36,.62)]">{op('ops.sum.loadFail')}</p>
            <div className="mt-3">
              <Btn variant="subtle" size="sm" onClick={() => void summaryQ.refetch()}>
                {op('ops.common.retry')}
              </Btn>
            </div>
          </div>
        ) : (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
            <div className="u3-kv !px-0">
              <div className="cell">
                <div className="cap">{op('ops.sum.closed30d')}</div>
                <div className="v u1-num" data-testid="ops-sum-closed30d">
                  {summary.closedLast30d}
                </div>
              </div>
              <div className="cell">
                <div className="cap">{op('ops.sum.byStatus')}</div>
                <div className="mt-1 flex flex-wrap gap-1.5" data-testid="ops-sum-bystatus">
                  {Object.entries(summary.byStatus).map(([k, n]) => (
                    <Badge key={k} tone={pdcaStatusTone(k)}>
                      {pdcaStatusLabel(k)} {n}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">{op('ops.sum.byCategory')}</p>
              {topCategories.length === 0 ? (
                <p className="text-caption text-[rgba(59,46,36,.42)]">{op('ops.sum.emptyCategory')}</p>
              ) : (
                <div data-testid="ops-sum-bycategory">
                  {topCategories.map((c) => (
                    <div key={c.category} className="flex items-center justify-between py-1 text-caption">
                      <span className="text-ink">{c.category}</span>
                      <span className="u1-num font-semibold text-ink">{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-3 border-t border-[rgba(59,46,36,.06)] pt-2 text-caption-xs text-[rgba(59,46,36,.42)]">
              {op('ops.sum.storeScopeNote')}
            </p>
          </div>
        )}
      </div>

      {/* note 必填弹层（复检 pass/fail / 自检审核共用） */}
      <Modal
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={ask?.title ?? ''}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAsk(null)} disabled={noteBusy}>
              {op('ops.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitAsk()} disabled={noteBusy} data-testid="ops-note-submit">
              {noteBusy ? op('ops.common.submitting') : op('ops.common.confirm')}
            </Btn>
          </>
        }
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder={ask?.kind === 'recheck' ? op('ops.pdca.notePh') : op('ops.self.notePh')}
          data-testid="ops-note-input"
          className="w-full resize-none rounded-input bg-card px-3 py-2.5 text-caption text-ink shadow-hairline ring-1 ring-line-ring placeholder:text-ink-placeholder focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
        />
      </Modal>
    </MainScaffold>
  );
}
