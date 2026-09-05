/**
 * 仪表盘待办区（T4.1 · 红点聚合）
 *
 * 五行：待确认（pending）/ 待派单（confirmed 无员工）/ 取消审核（cancel_requested）/
 * 待收款（completed 未 paid）/ 异常（超期寄养）。
 * 每行 = 图标 + 文案 + 数量红点 + 「去处理」，整行可点跳转对应页；
 * 数量为 0 时灰显 0、不出红点（行保留，信息密度优先且位置稳定）。
 */

import {
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  TriangleAlert,
  UserRoundPlus,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { todoGrandTotal, type DashboardStats } from './utils'

interface TodoRow {
  key: string
  icon: typeof CalendarClock
  label: string
  desc: string
  count: number
  to: string
}

export default function TodoSection({ stats }: { stats: DashboardStats | undefined }) {
  const navigate = useNavigate()

  const rows: TodoRow[] = [
    {
      key: 'pending',
      icon: ClipboardCheck,
      label: '待确认',
      desc: '新预约等待门店确认',
      count: stats?.todo.pending ?? 0,
      to: '/appointments?status=pending',
    },
    {
      key: 'unassigned',
      icon: UserRoundPlus,
      label: '待派单',
      desc: '已确认但尚未指派员工',
      count: stats?.todo.unassigned ?? 0,
      to: '/appointments?status=confirmed',
    },
    {
      key: 'cancelRequested',
      icon: CircleAlert,
      label: '取消审核',
      desc: '客户申请取消，待审批',
      count: stats?.todo.cancelRequested ?? 0,
      to: '/appointments?status=cancel_requested',
    },
    {
      key: 'unpaid',
      icon: CalendarClock,
      label: '待收款',
      desc: '服务已完成，未登记收款',
      count: stats?.todo.unpaid ?? 0,
      to: '/appointments?status=completed',
    },
    {
      key: 'overdue',
      icon: TriangleAlert,
      label: '异常 · 超期寄养',
      desc: '超过预计退房时间仍在店',
      count: stats?.overdueBoardingCount ?? 0,
      to: '/boarding',
    },
  ]

  const total = stats ? todoGrandTotal(stats) : 0

  return (
    <section className="rounded-card bg-card shadow-card">
      <header className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-title">待办</h2>
        {total > 0 ? (
          <span className="rounded-full bg-danger px-2.5 py-0.5 font-number text-caption font-semibold text-white tabular-nums">
            {total > 99 ? '99+' : total}
          </span>
        ) : (
          <span className="text-caption text-ink-placeholder">全部处理完</span>
        )}
      </header>
      <ul className="mt-2 divide-y divide-line-divider pb-2">
        {rows.map(({ key, icon: Icon, label, desc, count, to }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => navigate(to)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken/60"
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${count > 0 ? 'text-brand-primary' : 'text-ink-placeholder'}`}
                strokeWidth={1.5}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium">{label}</span>
                <span className="block text-caption text-ink-secondary">{desc}</span>
              </span>
              {count > 0 ? (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 font-number text-caption font-semibold text-white tabular-nums">
                  {count > 99 ? '99+' : count}
                </span>
              ) : (
                <span className="shrink-0 font-number text-body text-ink-placeholder tabular-nums">0</span>
              )}
              <span
                className={`shrink-0 text-caption ${
                  count > 0 ? 'font-medium text-brand-primary' : 'text-ink-placeholder'
                }`}
              >
                去处理 →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
