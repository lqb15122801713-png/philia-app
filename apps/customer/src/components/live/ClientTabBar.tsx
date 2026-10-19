import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { key: 'home', label: '首页', path: '/home' },
  { key: 'booking', label: '预约', path: '/booking/grooming' },
  { key: 'philia', label: 'PHILIA', path: '/philia' },
  { key: 'mall', label: '商城', path: '/mall' },
  { key: 'me', label: '我的', path: '/me' },
] as const

function tabIsActive(key: string, pathname: string) {
  if (key === 'home') return pathname === '/' || pathname === '/home'
  if (key === 'booking') return pathname.startsWith('/booking') || pathname.startsWith('/appointments')
  if (key === 'me') return pathname === '/me'
  return pathname === `/${key}` || pathname.startsWith(`/${key}/`)
}

export default function ClientTabBar() {
  const { pathname } = useLocation()

  return (
    <nav
      data-testid="client-tab-bar"
      aria-label="底部导航"
      className="fixed inset-x-0 bottom-[calc(14px+env(safe-area-inset-bottom))] z-tabbar"
    >
      <div className="mx-auto max-w-lg px-4">
        <div className="grid h-14 grid-cols-5 items-center rounded-full bg-card px-2 shadow-elevated ring-1 ring-line-ring">
          {TABS.map((tab) => {
            const active = tabIsActive(tab.key, pathname)
            return (
              <Link
                key={tab.key}
                to={tab.path}
                data-testid={`client-tab-${tab.key}`}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-full text-caption transition-colors ${
                  active ? 'font-semibold text-ink' : 'text-ink-secondary'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-brand-cta' : 'bg-transparent'}`}
                />
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
