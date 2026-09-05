/**
 * 横屏双栏右侧：选中预约的详情摘要（T4.2）。
 * 字段：时间 / 宠物 / 服务 / 客户 / 员工 / 状态 / 金额 / 收款方式 / 备注；
 * 操作：查看详情（进详情页）；待确认 → 行内确认；服务中/寄养中/已完成 → 服务监视入口。
 */

import { Check, ChevronRight, MonitorPlay } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  fenToYuan,
  fmtDateWeek,
  fmtTime,
  paymentModeLabel,
  statusBadge,
  statusLabel,
  type ListForStoreItem,
} from './appt-utils';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-caption text-ink-secondary">{label}</span>
      <span className="text-right text-body text-ink">{value}</span>
    </div>
  );
}

export function DetailSummary({
  item,
  confirming = false,
  onConfirm,
}: {
  item: ListForStoreItem | null;
  confirming?: boolean;
  onConfirm: (id: string) => void;
}) {
  if (!item) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-card border border-dashed border-line-strong p-6 text-center">
        <p className="text-body text-ink-placeholder">选择左侧一条预约查看摘要</p>
        <p className="mt-1 text-caption text-ink-placeholder">手机端点行直接进入详情页</p>
      </div>
    );
  }

  const monitorable =
    item.status === 'in_service' || item.status === 'in_boarding' || item.status === 'completed';

  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className={`rounded-tag px-1.5 py-0.5 text-caption ${statusBadge(item.status)}`}>
          {statusLabel(item.status)}
        </span>
        <span className="font-number text-price text-ink">{fenToYuan(item.priceFen)}</span>
      </div>

      <div className="mt-2 divide-y divide-line-divider">
        <Field
          label="时间"
          value={`${fmtDateWeek(item.scheduledStart)} ${fmtTime(item.scheduledStart)}`}
        />
        <Field label="宠物" value={item.petName ?? '—'} />
        <Field label="服务" value={`${item.serviceName ?? '—'}（${item.type === 'boarding' ? '寄养' : '洗护'}）`} />
        <Field label="客户" value={`客户·${item.customerId.slice(-4)}`} />
        <Field label="员工" value={item.staffName ?? '未指派'} />
        <Field label="收款方式" value={paymentModeLabel(item.paymentMode)} />
        {item.note ? <Field label="备注" value={item.note} /> : null}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {item.status === 'pending' ? (
          <button
            type="button"
            disabled={confirming}
            onClick={() => onConfirm(item.id)}
            className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-brand-primary text-body font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
          >
            <Check className="h-5 w-5" strokeWidth={1.5} />
            {confirming ? '确认中…' : '确认预约'}
          </button>
        ) : null}
        {monitorable ? (
          <Link
            to={`/appointments/${item.id}/monitor`}
            className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-brand-primary text-body font-semibold text-brand-primary transition-colors hover:bg-brand-primary-light"
          >
            <MonitorPlay className="h-5 w-5" strokeWidth={1.5} />
            服务监视
          </Link>
        ) : null}
        <Link
          to={`/appointments/${item.id}`}
          className="flex h-11 items-center justify-center gap-0.5 rounded-full border border-line text-body text-ink transition-colors hover:bg-sunken"
        >
          查看详情
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}
