/**
 * 员工维度明细表（T4.4）：员工 / 完成单数 / 服务金额 / 平均评分 / 好评率 / 提成明细。
 *
 * 口径：与服务收入同源（区间内已收款预约按 staff_id 聚合），故本表服务金额
 * 合计恒等于汇总卡服务收入；「未指派」行为收款时未指派员工的单。
 *
 * 提成明细：开发方案当前无提成规则字段（schema 亦无），占位「规则待配置」，
 * 待方案补充提成规则后在此接入计算（届时扩展 financeStats 返回即可）。
 */

import type { FinanceStaffRow } from './utils';
import { formatRate, formatYuan } from './utils';

export default function StaffTable({ rows }: { rows: FinanceStaffRow[] }) {
  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <h2 className="text-title text-ink">员工维度明细</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[13px] leading-5">
          <thead>
            <tr className="border-b border-line text-left text-caption text-ink-secondary">
              <th className="py-2 pr-3 font-normal">员工</th>
              <th className="py-2 pr-3 text-right font-normal">完成单数</th>
              <th className="py-2 pr-3 text-right font-normal">服务金额</th>
              <th className="py-2 pr-3 text-right font-normal">平均评分</th>
              <th className="py-2 pr-3 text-right font-normal">好评率</th>
              <th className="py-2 text-right font-normal">提成明细</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-divider">
            {rows.map((row) => (
              <tr key={row.staffId ?? '__unassigned__'}>
                <td className="py-2.5 pr-3 font-semibold text-ink">{row.staffName}</td>
                <td className="py-2.5 pr-3 text-right font-number tabular-nums text-ink">
                  {row.completedCount}
                </td>
                <td className="py-2.5 pr-3 text-right font-number tabular-nums text-ink">
                  ¥{formatYuan(row.serviceFen)}
                </td>
                <td className="py-2.5 pr-3 text-right font-number tabular-nums text-ink">
                  {row.avgRating === null ? '—' : row.avgRating.toFixed(1)}
                </td>
                <td className="py-2.5 pr-3 text-right font-number tabular-nums text-ink">
                  {formatRate(row.goodRate)}
                </td>
                <td className="py-2.5 text-right">
                  <span
                    className="rounded-tag bg-sunken px-1.5 py-0.5 text-caption text-ink-placeholder"
                    title="提成规则字段待开发方案补充后接入"
                  >
                    规则待配置
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-caption text-ink-placeholder">
        口径：本周期内完成并收款的服务单；金额合计与服务收入一致。
      </p>
    </section>
  );
}
