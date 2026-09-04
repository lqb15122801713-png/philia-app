import { NavLink } from 'react-router-dom'
import { CalendarCheck, History, PlayCircle } from 'lucide-react'

// 最简底部 TabBar 占位（手机竖屏单手优先）
// 「执行」暂指向 /execute/demo 占位，待任务流接入后由今日任务列表进入
const tabs = [
  { to: '/today', label: '今日', icon: CalendarCheck },
  { to: '/execute/demo', label: '执行', icon: PlayCircle },
  { to: '/history', label: '记录', icon: History },
]

export default function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid w-full max-w-lg grid-cols-3">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                isActive ? 'font-medium text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="h-6 w-6" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
