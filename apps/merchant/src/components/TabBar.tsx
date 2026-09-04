import { NavLink } from 'react-router-dom'
import { Briefcase, CalendarDays, LayoutDashboard, Wallet } from 'lucide-react'

// 最简底部 TabBar 占位（平板横屏优先，后续任务可调整为侧边导航）
const tabs = [
  { to: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { to: '/appointments', label: '预约', icon: CalendarDays },
  { to: '/boarding', label: '管理', icon: Briefcase },
  { to: '/finance', label: '财务', icon: Wallet },
]

export default function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
                isActive ? 'font-medium text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
