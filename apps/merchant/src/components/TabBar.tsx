/**
 * 商家端底部 TabBar（4 栏：仪表盘 / 预约 / 管理 / 财务 · T4.1 品牌化 + 待办红点）
 *
 * - 「预约」栏红点：dashboardStats 待办合计（四项待办 + 超期寄养）> 0 时显示计数徽标；
 *   数据源 = STATS_QUERY_KEY 轻量查询（60s 轮询兜底）+ SSE 预约/寄养事件联动 invalidate
 *   （与 DashboardPage 共用查询键，invalidate 互通不重复拉取）。
 * - 「管理」Tab（T5.2 改造）：点击弹出下拉菜单——寄养管理 /boarding、商品管理 /products、
 *   商城订单 /orders；处于三者任一路径时 Tab 高亮。
 *   红点：商城待发货订单数（listStoreOrders.groups.paid.length），
 *   数据源 = STORE_ORDERS_KEY 轻量查询（60s 轮询兜底）+ SSE order.* 事件联动 invalidate
 *   （与 OrdersPage 共用查询键，invalidate 互通不重复拉取）。
 */

import { EventType, usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import {
  Briefcase,
  CalendarDays,
  ChevronUp,
  LayoutDashboard,
  Package,
  PawPrint,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMerchantEvents } from './dashboard/MerchantEventsProvider'
import { STATS_QUERY_KEY, todoGrandTotal } from './dashboard/utils'
import { STORE_ORDERS_KEY } from './mall-admin/format'

const tabs = [
  { to: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { to: '/appointments', label: '预约', icon: CalendarDays },
  { to: '/finance', label: '财务', icon: Wallet },
]

/** 「管理」下拉菜单项（T5.2：商品管理 / 商城订单由此进入） */
const manageEntries = [
  { to: '/boarding', label: '寄养管理', icon: PawPrint },
  { to: '/products', label: '商品管理', icon: Package },
  { to: '/orders', label: '商城订单', icon: ShoppingBag },
]
const managePaths = manageEntries.map((e) => e.to)

export default function TabBar() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()
  const location = useLocation()
  const navigate = useNavigate()
  const [manageOpen, setManageOpen] = useState(false)

  const statsQuery = useQuery({
    queryKey: STATS_QUERY_KEY,
    queryFn: () => trpc.store.dashboardStats.query(),
    refetchInterval: 60_000, // 轻量轮询兜底（SSE 事件到达会提前 invalidate）
  })

  // 商城待发货计数（红点；与 OrdersPage 共用查询键）
  const storeOrdersQuery = useQuery({
    queryKey: STORE_ORDERS_KEY,
    queryFn: () => trpc.mall.listStoreOrders.query(),
    refetchInterval: 60_000,
  })

  // SSE 联动：预约 / 寄养事件 → 刷新统计（红点）；商城订单事件 → 刷新待发货计数
  useEffect(
    () =>
      events.onEvent((envelope) => {
        if (envelope.type.startsWith('appointment.') || envelope.type.startsWith('boarding.')) {
          void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
        }
        if (
          envelope.type === EventType.OrderCreated ||
          envelope.type === EventType.OrderReceived ||
          envelope.type === EventType.OrderShipped
        ) {
          void queryClient.invalidateQueries({ queryKey: STORE_ORDERS_KEY })
        }
      }),
    [events, queryClient],
  )

  // 路由变化时收起「管理」下拉
  useEffect(() => {
    setManageOpen(false)
  }, [location.pathname])

  const todoTotal = statsQuery.data ? todoGrandTotal(statsQuery.data) : 0
  const paidCount = storeOrdersQuery.data?.groups.paid.length ?? 0
  const manageActive = managePaths.some((p) => location.pathname.startsWith(p))

  const badge = (count: number) => (
    <span className="absolute -right-3 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-number text-[10px] font-semibold leading-none text-white tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  )

  return (
    <nav className="fixed inset-x-0 bottom-0 z-tabbar border-t border-line-divider bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto flex h-tabbar-h max-w-xl">
        {tabs.slice(0, 2).map(({ to, label, icon: Icon }) => (
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
              {to === '/appointments' && todoTotal > 0 ? badge(todoTotal) : null}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}

        {/* 「管理」：下拉菜单（寄养 / 商品 / 订单），带待发货红点 */}
        <button
          type="button"
          onClick={() => setManageOpen((v) => !v)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-caption transition-colors duration-120 active:scale-92 ${
            manageActive ? 'font-medium text-brand-primary' : 'text-ink-secondary'
          }`}
        >
          <span className="relative">
            <Briefcase className="h-6 w-6" strokeWidth={1.5} />
            {paidCount > 0 ? badge(paidCount) : null}
          </span>
          <span className="flex items-center gap-0.5">
            管理
            <ChevronUp
              className={`h-3 w-3 transition-transform duration-150 ${manageOpen ? '' : 'rotate-180'}`}
              strokeWidth={2}
            />
          </span>
        </button>

        {tabs.slice(2).map(({ to, label, icon: Icon }) => (
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
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* 管理下拉菜单（点遮罩或选项后收起） */}
      {manageOpen ? (
        <>
          <div className="fixed inset-0 z-modal" onClick={() => setManageOpen(false)} aria-hidden />
          <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-modal flex justify-center">
            <div className="w-56 overflow-hidden rounded-card bg-card shadow-elevated">
              {manageEntries.map(({ to, label, icon: Icon }) => {
                const active = location.pathname.startsWith(to)
                return (
                  <button
                    key={to}
                    type="button"
                    onClick={() => {
                      setManageOpen(false)
                      navigate(to)
                    }}
                    className={`flex w-full items-center gap-2.5 px-4 py-3 text-body transition-colors duration-150 ${
                      active ? 'bg-brand-primary-light font-medium text-brand-primary-pressed' : 'text-ink hover:bg-sunken'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                    {label}
                    {to === '/orders' && paidCount > 0 ? (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-number text-[10px] font-semibold leading-none text-white tabular-nums">
                        {paidCount > 99 ? '99+' : paidCount}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : null}
    </nav>
  )
}
