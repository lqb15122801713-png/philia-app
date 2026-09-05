/**
 * 仪表盘四张核心数字卡（T4.1）：今日预约 / 服务中 / 今日营业额 / 待办合计
 *
 * - 数字一律 font-number + tabular-nums（设计手册 §3.1 数字字族）；
 * - 待办合计 > 0 时用陶红强调（商家端品牌色只给关键操作与状态）；
 * - 加载中显示骨架（-- 占位），空数据真实显示 0。
 */

import { CalendarDays, CircleAlert, ClipboardList, Wallet } from 'lucide-react'
import { fenToYuan, todoGrandTotal, type DashboardStats } from './utils'

function StatCard(props: {
  icon: typeof CalendarDays
  label: string
  value: string
  sub?: string
  danger?: boolean
}) {
  const { icon: Icon, label, value, sub, danger } = props
  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-caption text-ink-secondary">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
        {label}
      </p>
      <p
        className={`mt-2 font-number text-[28px] font-semibold leading-8 tabular-nums ${
          danger ? 'text-danger-deep' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-caption text-ink-secondary">{sub}</p> : null}
    </div>
  )
}

export default function StatCards({
  stats,
  loading,
}: {
  stats: DashboardStats | undefined
  loading: boolean
}) {
  const todoTotal = stats ? todoGrandTotal(stats) : 0
  const placeholder = loading ? '—' : '0'

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={CalendarDays}
        label="今日预约"
        value={stats ? String(stats.todayCount) : placeholder}
        sub={
          stats && stats.byStatus.pending > 0 ? `其中待确认 ${stats.byStatus.pending}` : undefined
        }
      />
      <StatCard
        icon={ClipboardList}
        label="服务中"
        value={stats ? String(stats.inServiceCount) : placeholder}
        sub={stats ? `洗护/寄养在店服务` : undefined}
      />
      <StatCard
        icon={Wallet}
        label="今日营业额（元）"
        value={stats ? `¥${fenToYuan(stats.todayRevenueFen)}` : loading ? '—' : '¥0.00'}
        sub="按今日收款登记合计"
      />
      <StatCard
        icon={CircleAlert}
        label="待办合计"
        value={stats ? String(todoTotal) : placeholder}
        sub={stats && stats.overdueBoardingCount > 0 ? `含超期寄养 ${stats.overdueBoardingCount}` : undefined}
        danger={todoTotal > 0}
      />
    </div>
  )
}
