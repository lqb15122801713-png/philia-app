/**
 * 退款进度详情 /refunds/:id（补缺批片 1）：
 * - 四档步进条（shared StepNode；submitted 审核中 → approved 处理中 → refunded 退款中 →
 *   settled 已到账；rejected/cancelled=终态横幅不设步进）；
 * - timeline 时间线（timelineJson 逐行 mono 时刻）+ 申请明细（原因/说明/凭证图墙
 *   PhotoWall 点开 shared PhotoViewer）+ 驳回原因卡（rejected）+ 退款单号（有则显）+
 *   撤回钮（仅 submitted，ConfirmSheet 二次确认）+ 时效公示卡（同款 RefundTimingCard）；
 * - 返回=navigate(-1) 时间序回退 + 直访 fallback=/refunds（R1）。
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ListSkeleton,
  PhotoViewer,
  PhotoWall,
  StepNode,
  friendlyError,
  getApiBase,
  usePhiliaClient,
  useToast,
  type PhotoWallPhoto,
  type StepNodeState,
} from '@philia/shared';
import PageHeader from '@/components/PageHeader';
import ConfirmSheet from '@/components/mall/ConfirmSheet';
import { ErrorState } from '@/components/home/common';
import { fenToYuan, fmtOrderTime, resolveImgSrc } from '@/components/mall/format';
import {
  RefundStatusPill,
  RefundTimingCard,
  refundStatusMeta,
  refundTimelineLabel,
  refundTypeLabel,
} from '@/components/refund/common';
import { rc } from '@/copy/refund';

/** 四档步进（主链路）：机器状态 → 档位序号 */
const STEP_FLOW = ['submitted', 'approved', 'refunded', 'settled'] as const;

export default function RefundDetailPage() {
  const { id = '' } = useParams();
  const { trpc } = usePhiliaClient();
  const queryClient = useQueryClient();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });
  const apiBase = getApiBase();

  const detailQ = useQuery({
    queryKey: ['refundRequest', 'getById', id],
    queryFn: () => trpc.refundRequest.getById.query({ requestId: id }),
    enabled: id.length > 0,
    retry: false,
  });
  const configQ = useQuery({
    queryKey: ['refundRequest', 'configView'],
    queryFn: () => trpc.refundRequest.configView.query(),
  });

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const cancelM = useMutation({
    mutationFn: () => trpc.refundRequest.cancel.mutate({ requestId: id }),
    onSuccess: () => {
      setConfirmingCancel(false);
      showToast(rc('refund.cancelDone'), 'info');
      void queryClient.invalidateQueries({ queryKey: ['refundRequest'] });
    },
    onError: (err) => showToast(friendlyError(err, '撤回失败，请稍后再试'), 'error'),
  });

  const req = detailQ.data?.request;

  return (
    <div className="px-4 py-6">
      {toastEl}
      {/* R1：返回=时间序 navigate(-1)，直访 fallback=/refunds */}
      <PageHeader
        title={rc('refund.detailTitle')}
        fallback="/refunds"
        right={req ? <RefundStatusPill status={req.status} /> : null}
      />

      {detailQ.isPending ? (
        <div className="mt-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-card bg-card p-4 shadow-card">
              <ListSkeleton rows={4} />
            </div>
          ))}
        </div>
      ) : detailQ.isError || !req ? (
        /* R8：异常态=具体子问题+出口（无效 id/越权同口径） */
        <div className="mt-4">
          <ErrorState
            message={rc('refund.notFound')}
            action={
              <Link
                to="/refunds"
                className="flex min-h-[44px] items-center rounded-full bg-ink px-5 py-2 text-caption font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {rc('refund.backToRefunds')}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4" data-testid="refund-detail">
          {/* 终态横幅（rejected/cancelled 不设步进） */}
          {req.status === 'rejected' || req.status === 'cancelled' ? (
            <p
              className={`rounded-card px-4 py-3 text-body ${
                req.status === 'rejected'
                  ? 'bg-danger-light text-danger-deep'
                  : 'bg-sunken text-ink-secondary'
              }`}
              data-testid="refund-terminal-banner"
            >
              {refundStatusMeta(req.status).label}
            </p>
          ) : (
            /* 四档步进条（shared StepNode；settled=全 done） */
            <section className="rounded-card bg-card p-4 shadow-card" data-testid="refund-stepper">
              <div className="flex items-start">
                {STEP_FLOW.map((s, i) => {
                  const cur = STEP_FLOW.indexOf(req.status as (typeof STEP_FLOW)[number]);
                  const state: StepNodeState =
                    req.status === 'settled' || i < cur ? 'done' : i === cur ? 'active' : 'future';
                  return (
                    <div key={s} className="flex min-w-0 flex-1 items-start">
                      {i > 0 ? (
                        <span
                          aria-hidden
                          className={`mx-1 mt-3 h-0.5 flex-1 ${
                            i <= cur ? 'bg-brand-primary' : 'border-t-2 border-dashed border-line-strong'
                          }`}
                        />
                      ) : null}
                      <div className="flex shrink-0 flex-col items-center gap-1.5">
                        <StepNode state={state} />
                        <span
                          className={`whitespace-nowrap text-caption ${
                            state === 'future' ? 'text-ink-placeholder' : 'text-ink'
                          }`}
                        >
                          {refundStatusMeta(s).label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 进度时间线（timelineJson 逐行 mono 时刻） */}
          <section className="rounded-card bg-card p-4 shadow-card" data-testid="refund-timeline">
            <h2 className="text-title">{rc('refund.timelineTitle')}</h2>
            <ol className="mt-2 space-y-2">
              {(req.timelineJson ?? []).map((t, i) => (
                <li key={`${t.at}-${i}`} className="flex items-baseline justify-between gap-3 text-body">
                  <span className="min-w-0">
                    <span className="font-medium">{refundTimelineLabel(t.status)}</span>
                    {t.note ? (
                      <span className="ml-2 text-caption text-ink-secondary">{t.note}</span>
                    ) : null}
                  </span>
                  <time className="shrink-0 font-number text-caption text-ink-placeholder">
                    {fmtOrderTime(t.at)}
                  </time>
                </li>
              ))}
            </ol>
          </section>

          {/* 申请明细（类型/原因/说明/金额 mono/凭证图墙） */}
          <section className="rounded-card bg-card p-4 shadow-card">
            <dl className="space-y-1.5 text-body">
              <div className="flex justify-between">
                <dt className="text-ink-secondary">{rc('refund.reasonLabel')}</dt>
                <dd>{req.reasonLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">类型</dt>
                <dd>{refundTypeLabel(req.type)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">{rc('refund.amountLabel')}</dt>
                <dd className="font-number font-semibold text-ink">{fenToYuan(req.amountFen)}</dd>
              </div>
              {req.description ? (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-secondary">说明</dt>
                  <dd className="text-right">{req.description}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-ink-secondary">{rc('refund.requestNoLabel')}</dt>
                <dd className="font-number text-caption text-ink-placeholder">{req.requestNo}</dd>
              </div>
              {req.refundBillNo ? (
                <div className="flex justify-between">
                  <dt className="text-ink-secondary">{rc('refund.refundNoLabel')}</dt>
                  <dd className="font-number">{req.refundBillNo}</dd>
                </div>
              ) : null}
            </dl>
            {req.photoUrls.length > 0 ? (
              <div className="mt-3" data-testid="refund-photos">
                <PhotoWall
                  photos={req.photoUrls.map((u): PhotoWallPhoto => {
                    const url = resolveImgSrc(u, apiBase);
                    return { id: u, url, thumbUrl: url };
                  })}
                  onPhotoClick={(_, i) => setViewerIdx(i)}
                />
              </div>
            ) : null}
          </section>

          {/* 驳回原因卡（rejected） */}
          {req.status === 'rejected' && req.rejectReason ? (
            <section className="rounded-card bg-danger-light p-4" data-testid="refund-reject-card">
              <h2 className="text-body font-semibold text-danger-deep">{rc('refund.rejectedLabel')}</h2>
              <p className="mt-1 text-body text-danger-deep">{req.rejectReason}</p>
            </section>
          ) : null}

          {/* 时效公示卡（同款） */}
          <RefundTimingCard config={configQ.data ?? null} />

          {/* 撤回（仅 submitted；二次确认） */}
          {req.status === 'submitted' ? (
            <button
              type="button"
              data-testid="refund-cancel"
              onClick={() => setConfirmingCancel(true)}
              className="h-12 w-full rounded-full bg-card text-body font-medium text-danger-deep shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {rc('refund.cancelCta')}
            </button>
          ) : null}
        </div>
      )}

      {/* 撤回二次确认 */}
      <ConfirmSheet
        open={confirmingCancel}
        title={rc('refund.cancelConfirm')}
        confirmText={rc('refund.cancelCta')}
        danger
        onCancel={() => setConfirmingCancel(false)}
        onConfirm={() => cancelM.mutate()}
      />

      {/* 凭证原图查看器（shared PhotoViewer） */}
      {viewerIdx !== null && req ? (
        <PhotoViewer
          photos={req.photoUrls.map((u) => {
            const url = resolveImgSrc(u, apiBase);
            return { id: u, url, thumbUrl: url };
          })}
          index={viewerIdx}
          onClose={() => setViewerIdx(null)}
          onNavigate={setViewerIdx}
        />
      ) : null}
    </div>
  );
}
