/**
 * 汇总卡（T4.4）：服务收入 / 商城收入（v1 恒 0，标注 P5）/ 合计 / 完成单数 / 待收款金额。
 * 待收款 > 0 时红点心跳提示（财务待办入口，与下方待收款列表闭环）。
 * 金额统一 font-number tabular-nums + 2 位小数（对账友好）。
 */

import type { FinanceStats } from './utils';
import { formatYuan } from './utils';

function Card({
  label,
  value,
  unit,
  badge,
  alert,
}: {
  label: string;
  value: string;
  unit?: string;
  badge?: string;
  alert?: boolean;
}) {
  return (
    <div className="relative rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <p className="text-caption text-ink-secondary">{label}</p>
        {badge ? (
          <span className="rounded-tag bg-brand-secondary-light px-1.5 py-0.5 text-[11px] leading-4 text-ink-secondary">
            {badge}
          </span>
        ) : null}
        {alert ? (
          <span className="relative flex h-2 w-2" aria-label="有待收款">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
          </span>
        ) : null}
      </div>
      <p
        className={`mt-2 font-number text-price tabular-nums ${
          alert ? 'text-danger-deep' : 'text-ink'
        }`}
      >
        {unit ? <span className="mr-0.5 text-body">¥</span> : null}
        {value}
      </p>
    </div>
  );
}

export default function SummaryCards({ totals }: { totals: FinanceStats['totals'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card label="服务收入" unit="¥" value={formatYuan(totals.serviceFen)} />
      {/* 商城 v1 未上线（P5），恒 0；卡片明示避免误读为漏数 */}
      <Card label="商城收入" unit="¥" value={formatYuan(totals.shopFen)} badge="商城报表随 P5 上线" />
      <Card label="合计" unit="¥" value={formatYuan(totals.totalFen)} />
      <Card label="完成单数" value={String(totals.paidCount)} />
      <Card
        label="待收款金额"
        unit="¥"
        value={formatYuan(totals.pendingPaymentFen)}
        alert={totals.pendingPaymentCount > 0}
      />
    </div>
  );
}
