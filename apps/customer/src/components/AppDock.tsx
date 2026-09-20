/**
 * AppDock · 客户端全局统一底部 dock（批次 U1 任务 A，v9.1 视觉语言）。
 *
 * 主级页面（/home /mall /me /philia）唯一 dock，五项槽位顺序锁定：
 *   首页 / 预约 / philia 中央悬浮钮 / 商城 / 我的（序不可错）。
 * - 形态：悬浮白 pill（全圆档）+ 细线 ring + 近零影（深度策略，无凸起无投影）；
 * - 中央钮：60px 柠檬黄平圆 + 深棕墨 paw；点击=philia 页；
 *   长按 500ms=快捷弹层（会员码 / 一键预约 / 联系门店）——迁移旧 TabBar
 *   （ConvexTabBar 接线）长按交互：500ms 触发、10px 移动取消、长按后吞掉 click；
 *   W1 R-Nav-3：中位补「philia」文字标签（底栏五槽全件带文字，字号字重同槽对齐）；
 * - 路由感知 active：文字 600 深棕墨 + 24px 线图标墨色；未选中 ink-secondary；
 * - 详情级页面不渲染本组件（App.tsx 按路径白名单渲染）。
 *
 * 服务端缺口（记 PR 描述，不动手）：stores 表暂无 phone 字段，「联系门店」
 * 沿用 ContactStore 契约——phone 缺失时该项隐藏，schema 补电话后自动生效。
 */

import { useQuery } from '@tanstack/react-query'
import { Calendar, CalendarCheck, Home, Phone, QrCode, Store, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'

/** 深棕墨 paw 剪影（token text.primary #4A3B2E，currentColor 继承）
 *  U4-D3：导出复用——全域空态组件（home/common EmptyState）同用此 VI 爪印。 */
export function PawMark({ className = '' }: { className?: string }) {
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

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10

/** listMine 列表项结构（本组件只用到的字段） */
interface MineItem {
  id: string
  serviceId: string
  storeId: string
  type: string
  status: string
  scheduledStart: Date
  petName: string | null
  serviceName: string | null
}

interface DockTab {
  key: string
  label: string
  icon: typeof Home
  path: string
  isActive: (pathname: string) => boolean
}

// 槽位顺序锁定：首页 / 预约 / [philia 中央钮] / 商城 / 我的
const LEFT_TABS: DockTab[] = [
  {
    key: 'home',
    label: '首页',
    icon: Home,
    path: '/home',
    isActive: (p) => p === '/home' || p === '/',
  },
  {
    key: 'booking',
    label: '预约',
    icon: Calendar,
    path: '/booking/grooming',
    isActive: (p) => p.startsWith('/booking') || p.startsWith('/appointments'),
  },
]
const RIGHT_TABS: DockTab[] = [
  {
    key: 'mall',
    label: '商城',
    icon: Store,
    path: '/mall',
    isActive: (p) => p.startsWith('/mall'),
  },
  {
    key: 'me',
    label: '我的',
    icon: User,
    path: '/me',
    isActive: (p) => p === '/me',
  },
]

function DockTabButton({ tab, active }: { tab: DockTab; active: boolean }) {
  const navigate = useNavigate()
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={() => navigate(tab.path)}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
      data-testid={`app-dock-${tab.key}`}
      className={`flex flex-col items-center justify-center gap-0.5 py-1.5 transition-transform duration-120 ease-philia-spring active:scale-92 ${
        active ? 'font-semibold text-ink' : 'text-ink-secondary'
      }`}
    >
      <Icon className="h-6 w-6" strokeWidth={1.5} />
      <span className="text-caption-xs leading-none">{tab.label}</span>
    </button>
  )
}

export default function AppDock() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useMe()
  const { trpc } = usePhiliaClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  /** 长按已触发时吞掉紧随的 click，避免误导航 */
  const suppressClickRef = useRef(false)
  const pressTimerRef = useRef<number | null>(null)
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)

  const mineQuery = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user, // 未登录（守卫跳转前）不打受保护接口
    staleTime: 60_000,
  })

  // 最近一次非取消预约（一键复购预填 + 联系门店取门店用）
  const lastAppt: MineItem | null = (() => {
    const groups = mineQuery.data?.groups
    if (!groups) return null
    const all = Object.values(groups).flat() as MineItem[]
    const valid = all.filter((a) => a.status !== 'cancelled' && a.status !== 'cancel_requested')
    if (valid.length === 0) return null
    valid.sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime())
    return valid[0]!
  })()

  // 门店电话：stores 表暂无 phone 字段（服务端缺口，见头注释）——有则 tel: 直拨，无则该项隐藏
  const storeQuery = useQuery({
    queryKey: ['store', 'getWithServices', lastAppt?.storeId, 'dock-contact'],
    queryFn: () => trpc.store.getWithServices.query({ storeId: lastAppt!.storeId }),
    enabled: sheetOpen && !!lastAppt?.storeId,
    staleTime: 300_000,
  })
  const storePhone =
    (storeQuery.data?.store as { phone?: string | null } | undefined)?.phone ?? null

  /* 长按 philia 中央钮（500ms，10px 移动取消）→ 快捷弹层 */
  const cancelPressTimer = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartRef.current = null
  }
  useEffect(() => cancelPressTimer, [])

  const onPhiliaPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    cancelPressTimer()
    pressStartRef.current = { x: e.clientX, y: e.clientY }
    pressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true
      setSheetOpen(true)
    }, LONG_PRESS_MS)
  }
  const onPhiliaPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = pressStartRef.current
    if (pressTimerRef.current === null || !start) return
    if (Math.abs(e.clientX - start.x) > MOVE_CANCEL_PX || Math.abs(e.clientY - start.y) > MOVE_CANCEL_PX) {
      cancelPressTimer()
    }
  }
  const onPhiliaClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    navigate('/philia')
  }

  // 一键预约最近一次服务：复用上次的 serviceId/storeId 预填（迁移旧 TabBar 行为）
  const rebook = () => {
    setSheetOpen(false)
    if (!lastAppt) {
      navigate('/booking/grooming')
      return
    }
    const base = lastAppt.type === 'boarding' ? '/booking/boarding' : '/booking/grooming'
    navigate(`${base}?serviceId=${lastAppt.serviceId}&storeId=${lastAppt.storeId}`)
  }

  const philiaActive = pathname === '/philia' || pathname.startsWith('/philia/')

  return (
    <>
      <nav data-testid="app-dock" className="fixed inset-x-0 bottom-4 z-tabbar" aria-label="底部导航">
        <div className="mx-auto max-w-lg px-4">
          <div className="u1-ring grid grid-cols-5 items-center rounded-full bg-card px-2 py-2">
            {LEFT_TABS.map((tab) => (
              <DockTabButton key={tab.key} tab={tab} active={tab.isActive(pathname)} />
            ))}

            {/* philia 中央钮：60px 柠檬黄平圆 + 深棕墨 paw（不凸起无投影）；
                点击=philia 页，长按=快捷弹层。
                W1 R-Nav-3：中位补文字标签（与其他槽位同字号字重口径，
                active=600 深棕墨 / 未选中 ink-secondary）——底栏图标全部带文字 */}
            <span className="flex flex-col items-center justify-center gap-0.5 py-1.5">
              <button
                type="button"
                onClick={onPhiliaClick}
                onPointerDown={onPhiliaPointerDown}
                onPointerMove={onPhiliaPointerMove}
                onPointerUp={cancelPressTimer}
                onPointerCancel={cancelPressTimer}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="Philia"
                aria-current={philiaActive ? 'page' : undefined}
                data-testid="app-dock-philia"
                className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-brand-primary text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <PawMark className="h-7 w-7" />
              </button>
              <span
                className={`text-caption-xs leading-none ${
                  philiaActive ? 'font-semibold text-ink' : 'text-ink-secondary'
                }`}
              >
                philia
              </span>
            </span>

            {RIGHT_TABS.map((tab) => (
              <DockTabButton key={tab.key} tab={tab} active={tab.isActive(pathname)} />
            ))}
          </div>
        </div>
      </nav>

      {/* 长按快捷弹层：会员码 / 一键预约 / 联系门店 */}
      {sheetOpen ? (
        <div
          className="fixed inset-0 z-modal flex items-end justify-center bg-ink/40"
          onClick={() => setSheetOpen(false)}
          role="dialog"
          aria-label="快捷操作"
        >
          <div
            className="w-full max-w-lg rounded-t-sheet bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] ring-1 ring-line-ring"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-title">快捷操作</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="关闭"
                className="u1-ring flex h-9 w-9 items-center justify-center rounded-full bg-card"
              >
                <X className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
              </button>
            </div>

            <div className="mt-3 divide-y divide-line-divider">
              <button
                type="button"
                data-testid="app-dock-sheet-member"
                onClick={() => {
                  setSheetOpen(false)
                  navigate('/philia/member')
                }}
                className="flex w-full items-center gap-3 py-3.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
              >
                <QrCode className="h-6 w-6 shrink-0 text-ink" strokeWidth={1.5} />
                <span className="flex-1">
                  <span className="block text-body font-semibold">会员码</span>
                  <span className="block text-caption text-ink-secondary">到店出示，核销享会员权益</span>
                </span>
                <span className="text-ink-secondary" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                data-testid="app-dock-sheet-rebook"
                onClick={rebook}
                className="flex w-full items-center gap-3 py-3.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
              >
                <CalendarCheck className="h-6 w-6 shrink-0 text-ink" strokeWidth={1.5} />
                <span className="flex-1">
                  <span className="block text-body font-semibold">一键预约</span>
                  <span className="block text-caption text-ink-secondary">
                    {lastAppt
                      ? `上次服务：${lastAppt.serviceName ?? '洗护'}${lastAppt.petName ? ` · ${lastAppt.petName}` : ''}`
                      : '还没有历史预约，去挑一个服务开始吧'}
                  </span>
                </span>
                <span className="text-ink-secondary" aria-hidden="true">›</span>
              </button>

              {/* 联系门店：stores 表暂无 phone 字段，缺失时该项隐藏（不造假按钮） */}
              {storePhone ? (
                <a
                  href={`tel:${storePhone}`}
                  data-testid="app-dock-sheet-contact"
                  onClick={() => setSheetOpen(false)}
                  className="flex w-full items-center gap-3 py-3.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
                >
                  <Phone className="h-6 w-6 shrink-0 text-ink" strokeWidth={1.5} />
                  <span className="flex-1">
                    <span className="block text-body font-semibold">联系门店</span>
                    <span className="u1-num block text-caption text-ink-secondary">{storePhone}</span>
                  </span>
                  <span className="text-ink-secondary" aria-hidden="true">›</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
