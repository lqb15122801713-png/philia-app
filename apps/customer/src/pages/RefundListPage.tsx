/**
 * 退款/售后列表 /refunds（补缺批片 1）：
 * - listMine 本人申请倒序；卡=类型签 + 原单 billNo + 店名 + 状态 pill（四档色纪律不设绿）
 *   + 金额 mono + 时间；点卡 → /refunds/:id；
 * - 空态三句话（题/说明/出口→/mall/orders，深棕墨底出口钮）；
 * - 骨架 ListSkeleton / 异常 ErrorState+重试（R8）。
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ListSkeleton, usePhiliaClient } from '@philia/shared';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState } from '@/components/home/common';
import { fenToYuan, fmtOrderTime } from '@/components/mall/format';
import { RefundStatusPill, refundTypeLabel } from '@/components/refund/common';
import { REFUND_COPY, rc } from '@/copy/refund';

export default function RefundListPage() {
  const { trpc } = usePhiliaClient();
  const navigate = useNavigate();

  const listQ = useQuery({
    queryKey: ['refundRequest', 'listMine'],
    queryFn: () => trpc.refundRequest.listMine.query(),
  });
  const rows = listQ.data ?? [];

  return (
    <div className="px-4 py-6">
      {/* R1：返回=时间序 navigate(-1)，直访 fallback 默认 /home */}
      <PageHeader title={rc('refund.listTitle')} />

      {listQ.isPending ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-card bg-card p-4 shadow-card">
              <ListSkeleton rows={3} />
            </div>
          ))}
        </div>
      ) : listQ.isError ? (
        /* R8：异常态=具体子问题+重试 */
        <div className="mt-4">
          <ErrorState message={rc('refund.loadFail')} onRetry={() => void listQ.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        /* R6：空态三句话 + 深棕出口钮 → /mall/orders */
        <div className="flex min-h-[56vh] flex-col justify-center">
          <EmptyState
            title={REFUND_COPY['refund.emptyTitle']}
            desc={REFUND_COPY['refund.emptyBody']}
            action={
              <Link
                to="/mall/orders"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {REFUND_COPY['refund.emptyCta']}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              data-testid={`refund-item-${r.id}`}
              onClick={() => navigate(`/refunds/${r.id}`)}
              className="block w-full rounded-card bg-card p-4 text-left shadow-card transition-transform duration-120 ease-philia-spring active:scale-[.99]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-body-sm font-semibold">
                  <span className="shrink-0 rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary">
                    {refundTypeLabel(r.type)}
                  </span>
                  <span className="truncate">{r.storeName ?? '菲丽亚门店'}</span>
                </p>
                <RefundStatusPill status={r.status} />
              </div>
              <p className="mt-1 font-number text-caption-xs text-ink-placeholder">
                {r.billNo} · {fmtOrderTime(r.createdAt)}
              </p>
              <p className="mt-2 text-right font-number text-body-sm font-bold text-ink">
                {fenToYuan(r.amountFen)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
