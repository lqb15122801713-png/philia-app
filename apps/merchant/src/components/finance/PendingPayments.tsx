/**
 * 待收款列表（T4.4）：completed 未 paid 的预约明细（财务待办闭环）。
 *
 * 行内「确认收款」→ appointment.markPaid（幂等，缺省按订单金额）→
 * toast + invalidate（由父级回调刷新 financeStats）。失败原文 toast。
 * 每行：预约时间 / 宠物 / 服务 / 金额 / 完成时间 / 收款方式。
 */

import { useMutation } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { usePhiliaClient } from '@philia/shared';
import { useState } from 'react';
import type { PendingPaymentItem } from './utils';
import { formatDateTime, formatYuan } from './utils';

const PAYMENT_MODE_LABEL: Record<string, string> = {
  pay_at_store: '到店付',
  pass_deduct: '次卡扣次',
};

export default function PendingPayments({
  items,
  totalFen,
  onToast,
  onSettled,
}: {
  items: PendingPaymentItem[];
  totalFen: number;
  onToast: (msg: string) => void;
  onSettled: () => void;
}) {
  const { trpc } = usePhiliaClient();
  /** 正在收款中的行（行级 loading，避免重复点击） */
  const [pendingId, setPendingId] = useState<string | null>(null);

  const markPaid = useMutation({
    mutationFn: (appointmentId: string) => trpc.appointment.markPaid.mutate({ appointmentId }),
    onSuccess: (_r, appointmentId) => {
      setPendingId(null);
      const item = items.find((i) => i.id === appointmentId);
      onToast(item ? `已确认收款 ¥${formatYuan(item.priceFen)}` : '已确认收款');
      onSettled();
    },
    onError: (err) => {
      setPendingId(null);
      onToast(err instanceof TRPCClientError ? err.message : '收款失败，请重试');
    },
  });

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-title text-ink">
          待收款
          {items.length > 0 ? (
            <span className="rounded-full bg-danger-light px-2 py-0.5 text-caption text-danger-deep">
              {items.length} 单
            </span>
          ) : null}
        </h2>
        {items.length > 0 ? (
          <p className="font-number text-body tabular-nums text-danger-deep">
            合计 ¥{formatYuan(totalFen)}
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-body text-ink-secondary">暂无待收款，所有已完成服务均已结清。</p>
      ) : (
        <ul className="mt-3 divide-y divide-line-divider">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-body font-semibold text-ink">
                    {item.petName} · {item.serviceName}
                  </p>
                  <span className="shrink-0 rounded-tag bg-brand-secondary-light px-1.5 py-0.5 text-caption text-ink-secondary">
                    {PAYMENT_MODE_LABEL[item.paymentMode ?? ''] ?? '到店付'}
                  </span>
                </div>
                <p className="mt-0.5 text-caption text-ink-secondary">
                  预约 {formatDateTime(item.scheduledStart)} · 完成{' '}
                  {item.completedAt ? formatDateTime(item.completedAt) : '—'}
                </p>
              </div>
              <p className="shrink-0 font-number text-body-lg font-semibold tabular-nums text-ink">
                ¥{formatYuan(item.priceFen)}
              </p>
              <button
                type="button"
                disabled={pendingId === item.id}
                onClick={() => {
                  setPendingId(item.id);
                  markPaid.mutate(item.id);
                }}
                className="h-10 shrink-0 rounded-full bg-brand-primary px-4 text-body font-semibold text-white transition active:scale-95 disabled:opacity-50"
              >
                {pendingId === item.id ? '收款中…' : '确认收款'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
