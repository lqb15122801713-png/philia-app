/**
 * 收款方式拆分（T4.4）：到店付 vs 次卡扣次。
 * 每行：金额 + 单数，占比条按金额占比绘制，右侧标注金额/单数双占比。
 * 两桶互斥穷尽（服务端口径：payment_mode='pass_deduct' 进次卡，其余含 NULL 进到店付）。
 */

import { Banknote, Ticket } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FinanceStats } from './utils';
import { formatYuan } from './utils';

function SplitRow({
  icon,
  label,
  count,
  totalFen,
  amountPct,
  countPct,
  barClass,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  totalFen: number;
  amountPct: number;
  countPct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-body">
        <span className="flex items-center gap-2 text-ink">
          {icon}
          {label}
        </span>
        <span className="font-number tabular-nums text-ink">¥{formatYuan(totalFen)}</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-sunken">
        <div
          className={`h-full rounded-full ${barClass} transition-[width] duration-300`}
          style={{ width: `${Math.max(amountPct, totalFen > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className="mt-1 text-caption text-ink-secondary">
        {count} 单 · 金额占比 {Math.round(amountPct)}% · 单数占比 {Math.round(countPct)}%
      </p>
    </div>
  );
}

export default function PaymentSplit({ split }: { split: FinanceStats['paymentSplit'] }) {
  const totalFen = split.payAtStore.totalFen + split.passDeduct.totalFen;
  const totalCount = split.payAtStore.count + split.passDeduct.count;

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <h2 className="text-title text-ink">收款方式</h2>
      <div className="mt-4 space-y-4">
        <SplitRow
          icon={<Banknote className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />}
          label="到店付"
          count={split.payAtStore.count}
          totalFen={split.payAtStore.totalFen}
          amountPct={totalFen > 0 ? (split.payAtStore.totalFen / totalFen) * 100 : 0}
          countPct={totalCount > 0 ? (split.payAtStore.count / totalCount) * 100 : 0}
          barClass="bg-brand-primary"
        />
        <SplitRow
          icon={<Ticket className="h-5 w-5 text-brand-secondary-deep" strokeWidth={1.5} />}
          label="次卡扣次"
          count={split.passDeduct.count}
          totalFen={split.passDeduct.totalFen}
          amountPct={totalFen > 0 ? (split.passDeduct.totalFen / totalFen) * 100 : 0}
          countPct={totalCount > 0 ? (split.passDeduct.count / totalCount) * 100 : 0}
          barClass="bg-brand-secondary-deep"
        />
      </div>
    </section>
  );
}
