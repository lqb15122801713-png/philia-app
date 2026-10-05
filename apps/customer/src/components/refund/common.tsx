/**
 * 退款/售后域共享小件（补缺批片 1）：
 * - REFUND_STATUS_META：状态机（submitted/approved/refunded/settled/rejected/cancelled）
 *   → 展示签映射（approved=处理中 / refunded=退款中）+ pill 四档色纪律（不设绿：
 *   submitted=淡黄 / processing=卡其 / refunding=墨 / settled=深棕+✓ / rejected=赭红 /
 *   cancelled=灰），色值全走 token；
 * - RefundTimingCard：时效公示卡（表单页/详情页同款），数值=configView 端口插值；
 * - refundTypeLabel：refund_only/return_refund → copy 签。
 */

import { Check } from 'lucide-react';
import { rc, type RefundCopyKey } from '@/copy/refund';

/* ------------------------------------------------------------------ */
/* 状态签                                                                */
/* ------------------------------------------------------------------ */

export interface RefundStatusMeta {
  label: string;
  pill: string;
  /** settled 签带 ✓（深棕墨族成功呈现，不设绿） */
  check?: boolean;
}

/** 状态机 → 展示签（label 经 copy 键取值，pill 类名全 token） */
export const REFUND_STATUS_META: Record<string, RefundStatusMeta> = {
  submitted: { label: rc('refund.status.submitted'), pill: 'bg-brand-primary text-ink' },
  approved: { label: rc('refund.status.processing'), pill: 'bg-brand-secondary-light text-ink' },
  refunded: { label: rc('refund.status.refunding'), pill: 'bg-ink text-canvas' },
  settled: { label: rc('refund.status.settled'), pill: 'bg-success-deep text-canvas', check: true },
  rejected: { label: rc('refund.status.rejected'), pill: 'bg-danger-light text-danger-deep' },
  cancelled: { label: rc('refund.status.cancelled'), pill: 'bg-[rgba(59,46,36,.06)] text-ink-placeholder' },
};

export function refundStatusMeta(status: string): RefundStatusMeta {
  return REFUND_STATUS_META[status] ?? { label: status, pill: 'bg-sunken text-ink-secondary' };
}

/** 状态 pill（列表卡/详情头部共用） */
export function RefundStatusPill({ status }: { status: string }) {
  const meta = refundStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
      {meta.check ? <Check className="h-3 w-3" strokeWidth={2.2} /> : null}
      {meta.label}
    </span>
  );
}

/** timeline 条目 status → 展示文案（机器码映射 copy 键；未知码原样透出） */
const TIMELINE_LABEL_KEY: Record<string, RefundCopyKey> = {
  submitted: 'refund.status.submitted',
  approved: 'refund.status.processing',
  refunded: 'refund.status.refunding',
  settled: 'refund.status.settled',
  rejected: 'refund.status.rejected',
  cancelled: 'refund.status.cancelled',
};

export function refundTimelineLabel(status: string): string {
  const key = TIMELINE_LABEL_KEY[status];
  return key ? rc(key) : status;
}

/** 退款类型签（refund_only=仅退款 / return_refund=退货退款） */
export function refundTypeLabel(type: string): string {
  return type === 'return_refund' ? rc('refund.typeReturnRefund') : rc('refund.typeRefundOnly');
}

/* ------------------------------------------------------------------ */
/* 时效公示卡（表单/详情同款）                                             */
/* ------------------------------------------------------------------ */

/** configView 端口值子集（本卡消费的三键） */
export interface RefundTimingConfig {
  freeRegretHours: number;
  slaHours: number;
}

/**
 * 时效公示卡：timingTitle/timingBody + freeRegretNotice + partialNotice + slaNotice。
 * timingBody 的 {d1}/{d2}（到账工作日区间）端口无此两键——按任务书先以 1/5 常量
 * 插值（已报备），端口补键后改读端口。
 */
export function RefundTimingCard({ config }: { config: RefundTimingConfig | null }) {
  const hours = config?.freeRegretHours ?? 24;
  const sla = config?.slaHours ?? 24;
  return (
    <section className="rounded-card bg-card p-4 shadow-card" data-testid="refund-timing-card">
      <h2 className="text-title">{rc('refund.timingTitle')}</h2>
      <ul className="mt-2 space-y-1.5 text-caption text-ink-secondary">
        <li>{rc('refund.timingBody', { d1: 1, d2: 5 })}</li>
        <li>{rc('refund.freeRegretNotice', { hours })}</li>
        <li>{rc('refund.partialNotice')}</li>
        <li>{rc('refund.slaNotice', { hours: sla })}</li>
      </ul>
    </section>
  );
}
