/**
 * 商家端底部 TabBar（4 栏：仪表盘 / 预约 / 管理 / 财务 · T4.1 品牌化 + 待办红点）
 *
 * - 「预约」栏红点：dashboardStats 待办合计（四项待办 + 超期寄养）> 0 时显示计数徽标；
 *   数据源 = STATS_QUERY_KEY 轻量查询（60s 轮询兜底）+ SSE 预约/寄养事件联动 invalidate
 *   （与 DashboardPage 共用查询键，invalidate 互通不重复拉取）。
 * - 「管理」Tab 指 /boarding（P0 路由保留）。
 */

import { usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, CalendarDays, LayoutDashboard, Wallet } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useMerchantEvents } from './dashboard/MerchantEventsProvider'
import { STATS_QUERY_KEY, todoGrandTotal } from './dashboard/utils'

const tabs = [
  { to: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { to: '/appointments', label: '预约', icon: CalendarDays },
  { to: '/boarding', label: '管理', icon: Briefcase },
  { to: '/finance', label: '财务', icon: Wallet },
]

export default function TabBar() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()

  const statsQuery = useQuery({
    queryKey: STATS_QUERY_KEY,
    queryFn: () => trpc.store.dashboardStats.query(),
    refetchInterval: 60_000, // 轻量轮询兜底（SSE 事件到达会提前 invalidate）
  })

  // SSE 联动：预约 / 寄养事件 → 刷新统计（红点）
  useEffect(
    () =>
      events.onEvent((envelope) => {
        if (envelope.type.startsWith('appointment.') || envelope.type.startsWith('boarding.')) {
          void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
        }
      }),
    [events, queryClient],
  )

  const todoTotal = statsQuery.data ? todoGrandTotal(statsQuery.data) : 0

  return (
    <nav className="fixed inset-x-0 bottom-0 z-tabbar border-t border-line-divider bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-tabbar-h max-w-xl">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 text-caption transition-colors duration-120 active:scale-92 ${
                isActive ? 'font-medium text-brand-primary' : 'text-ink-secondary'
              }`
            }
          >
            <span className="relative">
              <Icon className="h-6 w-6" strokeWidth={1.5} />
              {to === '/appointments' && todoTotal > 0 ? (
                <span className="absolute -right-3 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-number text-[10px] font-semibold leading-none text-white tabular-nums">
                  {todoTotal > 99 ? '99+' : todoTotal}
                </span>
              ) : null}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
