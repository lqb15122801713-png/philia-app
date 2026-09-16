/**
 * HomeDock · 首页专属底部减法 dock（批次 9a.3 · v4.1 试样口径）。
 *
 * 版式：悬浮白 pill（圆角 24、一层软阴影）、三项等宽——
 *   首页 / philia（44px 柠檬黄平圆 + 深棕墨 paw，不凸起、无投影、永远彩色无文字）/ 我的；
 * active 项 ink 600，其余 muted；按下 scale 0.92 / 120ms（token 锁定）。
 *
 * 范围取舍（任务书）：仅首页渲染本 dock，其余页面保留既有 ConvexTabBar
 * （五栏凸起共享组件不动；若产品要全局替换，下批统一）。
 * philia 中央钮行为不变：点击进 /philia 品牌页（首页 dock 不拦截进行中预约直达、
 * 不做长按弹层——那是 ConvexTabBar 的既有交互，本批首页版式不含）。
 */

import { useLocation, useNavigate } from 'react-router-dom'

/** 深棕墨 paw 剪影（token text.primary #4A3B2E，currentColor 继承） */
function PawMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {/* 四趾 */}
      <ellipse cx="5.6" cy="7.6" rx="1.7" ry="2.2" />
      <ellipse cx="9.8" cy="5.2" rx="1.8" ry="2.3" />
      <ellipse cx="14.2" cy="5.2" rx="1.8" ry="2.3" />
      <ellipse cx="18.4" cy="7.6" rx="1.7" ry="2.2" />
      {/* 掌垫 */}
      <path d="M12 10.8c-3.1 0-5.6 2.7-5.6 5.1 0 1.7 1.3 3 3 3 1 0 1.7-.5 2.6-.5s1.6.5 2.6.5c1.7 0 3-1.3 3-3 0-2.4-2.5-5.1-5.6-5.1z" />
    </svg>
  )
}

export default function HomeDock() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const items = [
    { key: 'home', label: '首页', path: '/home', active: pathname === '/home' || pathname === '/' },
    { key: 'me', label: '我的', path: '/me', active: pathname === '/me' },
  ] as const

  return (
    <nav data-testid="home-dock" className="fixed inset-x-0 bottom-4 z-tabbar" aria-label="底部导航">
      <div className="mx-auto max-w-lg px-4">
        <div className="grid grid-cols-3 items-center rounded-[24px] bg-card py-2.5 shadow-elevated">
          <button
            type="button"
            onClick={() => navigate(items[0].path)}
            aria-label="首页"
            aria-current={items[0].active ? 'page' : undefined}
            data-testid="home-dock-home"
            className={`flex items-center justify-center text-caption transition-transform duration-120 ease-philia-spring active:scale-92 ${
              items[0].active ? 'font-semibold text-ink' : 'text-ink-secondary'
            }`}
          >
            首页
          </button>

          {/* philia 中央钮：44px 柠檬黄平圆 + 深棕墨 paw（不凸起无投影），行为不变进 /philia */}
          <span className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => navigate('/philia')}
              aria-label="Philia"
              data-testid="home-dock-philia"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <PawMark className="h-[22px] w-[22px]" />
            </button>
          </span>

          <button
            type="button"
            onClick={() => navigate(items[1].path)}
            aria-label="我的"
            aria-current={items[1].active ? 'page' : undefined}
            data-testid="home-dock-me"
            className={`flex items-center justify-center text-caption transition-transform duration-120 ease-philia-spring active:scale-92 ${
              items[1].active ? 'font-semibold text-ink' : 'text-ink-secondary'
            }`}
          >
            我的
          </button>
        </div>
      </div>
    </nav>
  )
}
