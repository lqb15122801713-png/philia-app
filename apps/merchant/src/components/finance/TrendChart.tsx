/**
 * 营收趋势图（T4.4）：按日分组堆叠柱状图。
 *
 * 纯 CSS 手绘（不引图表库）：柱高按区间最大值归一，服务（brand-primary）+
 * 商城（brand-secondary）双系列堆叠；商城恒 0 时系列高度为 0 且隐藏图例，
 * 视觉只呈现服务系列。hover 原生 title 显示当日金额明细（对账友好）。
 */

import type { FinanceByDay, PeriodMode } from './utils';
import { formatYuan } from './utils';

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

/** X 轴标签：日=「今天」；周=周x；月=逢 1/5/10… 与末日显示 */
function xLabel(mode: PeriodMode, index: number, cell: FinanceByDay, total: number): string {
  if (mode === 'day') return '今天';
  if (mode === 'week') return WEEKDAY_LABELS[index] ?? '';
  const day = Number(cell.date.slice(8, 10));
  if (day === 1 || day % 5 === 0 || index === total - 1) return `${day}日`;
  return '';
}

export default function TrendChart({ data, mode }: { data: FinanceByDay[]; mode: PeriodMode }) {
  const maxTotal = Math.max(0, ...data.map((d) => d.serviceFen + d.shopFen));
  const hasShop = data.some((d) => d.shopFen > 0);
  const norm = Math.max(maxTotal, 1);

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-title text-ink">营收趋势</h2>
        <div className="flex items-center gap-3 text-caption text-ink-secondary">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand-primary" />
            服务
          </span>
          {hasShop ? (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-brand-secondary" />
              商城
            </span>
          ) : null}
        </div>
      </div>

      {/* 柱状区：CSS flex 手绘，柱高按最大值归一 */}
      <div className="mt-4 flex h-40 items-stretch gap-[3px] border-b border-line" role="img" aria-label="按日营收柱状图">
        {data.map((cell) => {
          const total = cell.serviceFen + cell.shopFen;
          const totalPct = (total / norm) * 100;
          const shopPct = total > 0 ? (cell.shopFen / norm) * 100 : 0;
          const servicePct = totalPct - shopPct;
          const label = `${cell.date}\n服务 ¥${formatYuan(cell.serviceFen)}\n商城 ¥${formatYuan(cell.shopFen)}\n合计 ¥${formatYuan(total)}`;
          return (
            <div key={cell.date} className="group relative flex min-w-0 flex-1 flex-col justify-end" title={label}>
              {total > 0 ? (
                <div
                  className="flex w-full flex-col-reverse overflow-hidden rounded-t-tag bg-transparent transition-opacity duration-150 group-hover:opacity-80"
                  style={{ height: `${Math.max(totalPct, 2)}%` }}
                >
                  {/* 堆叠：服务在下、商城在上 */}
                  <div className="w-full bg-brand-primary" style={{ height: `${(servicePct / Math.max(totalPct, 2)) * 100}%` }} />
                  {shopPct > 0 ? (
                    <div className="w-full bg-brand-secondary" style={{ height: `${(shopPct / Math.max(totalPct, 2)) * 100}%` }} />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* X 轴标签 */}
      <div className="mt-1 flex gap-[3px]">
        {data.map((cell, i) => (
          <div key={cell.date} className="min-w-0 flex-1 truncate text-center text-caption text-ink-placeholder">
            {xLabel(mode, i, cell, data.length)}
          </div>
        ))}
      </div>
    </section>
  );
}
