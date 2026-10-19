import { useQuery } from '@tanstack/react-query'
import { BookOpen, Calendar, CalendarCheck, Home, Phone, QrCode, Store, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'

export function PawMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="5.6" cy="7.6" rx="1.7" ry="2.2" />
      <ellipse cx="9.8" cy="5.2" rx="1.8" ry="2.3" />
      <ellipse cx="14.2" cy="5.2" rx="1.8" ry="2.3" />
      <ellipse cx="18.4" cy="7.6" rx="1.7" ry="2.2" />
      <path d="M12 10.8c-3.1 0-5.6 2.7-5.6 5.1 0 1.7 1.3 3 3 3 1 0 1.7-.5 2.6-.5s1.6.5 2.6.5c1.7 0 3-1.3 3-3 0-2.4-2.5-5.1-5.6-5.1z" />
    </svg>
  )
}

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10

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

const TABS: DockTab[] = [
  { key: 'home', label: '首页', icon: Home, path: '/home', isActive: (path) => path === '/home' || path === '/' },
  { key: 'booking', label: '预约', icon: Calendar, path: '/booking/grooming', isActive: (path) => path.startsWith('/booking') || path.startsWith('/appointments') },
  { key: 'philia', label: 'PHILIA', icon: BookOpen, path: '/philia', isActive: (path) => path === '/philia' || path.startsWith('/philia/') },
  { key: 'mall', label: '商城', icon: Store, path: '/mall', isActive: (path) => path.startsWith('/mall') },
  { key: 'me', label: '我的', icon: User, path: '/me', isActive: (path) => path === '/me' },
]

interface DockTabButtonProps {
  tab: DockTab
  active: boolean
  onClick: () => void
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerMove?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerUp?: () => void
  onPointerCancel?: () => void
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

function DockTabButton({ tab, active, onClick, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu }: DockTabButtonProps) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
      data-testid={`app-dock-${tab.key}`}
      className="relative flex h-16 min-w-0 flex-col items-center justify-center gap-[4px] rounded-2xl transition-transform duration-120 ease-philia-spring active:scale-92"
    >
      <span
        data-testid={`app-dock-${tab.key}-indicator`}
        className={`absolute top-1.5 h-[3px] w-5 rounded-full ${active ? 'bg-brand-primary' : 'bg-transparent'}`}
        aria-hidden="true"
      />
      <Icon className={`h-[21px] w-[21px] ${active ? 'text-brand-cta' : 'text-ink-secondary'}`} strokeWidth={1.7} aria-hidden="true" />
      <span className={`text-[12px] leading-none ${active ? 'font-semibold text-brand-cta' : 'text-ink-secondary'}`}>{tab.label}</span>
    </button>
  )
}

export default function AppDock() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useMe()
  const { trpc } = usePhiliaClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const suppressClickRef = useRef(false)
  const pressTimerRef = useRef<number | null>(null)
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)

  const mineQuery = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const lastAppt: MineItem | null = (() => {
    const groups = mineQuery.data?.groups
    if (!groups) return null
    const all = Object.values(groups).flat() as MineItem[]
    const valid = all.filter((appointment) => appointment.status !== 'cancelled' && appointment.status !== 'cancel_requested')
    if (valid.length === 0) return null
    valid.sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime())
    return valid[0]!
  })()
  const storeQuery = useQuery({
    queryKey: ['store', 'getWithServices', lastAppt?.storeId, 'dock-contact'],
    queryFn: () => trpc.store.getWithServices.query({ storeId: lastAppt!.storeId }),
    enabled: sheetOpen && !!lastAppt?.storeId,
    staleTime: 300_000,
  })
  const storePhone = storeQuery.data?.store.phone ?? null

  const cancelPressTimer = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartRef.current = null
  }
  useEffect(() => cancelPressTimer, [])
  useEffect(() => {
    if (!sheetOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [sheetOpen])

  const onPhiliaPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    cancelPressTimer()
    pressStartRef.current = { x: event.clientX, y: event.clientY }
    pressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true
      setSheetOpen(true)
    }, LONG_PRESS_MS)
  }
  const onPhiliaPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = pressStartRef.current
    if (pressTimerRef.current === null || !start) return
    if (Math.abs(event.clientX - start.x) > MOVE_CANCEL_PX || Math.abs(event.clientY - start.y) > MOVE_CANCEL_PX) cancelPressTimer()
  }
  const onPhiliaClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    navigate('/philia')
  }
  const rebook = () => {
    setSheetOpen(false)
    if (!lastAppt) {
      navigate('/booking/grooming')
      return
    }
    const base = lastAppt.type === 'boarding' ? '/booking/boarding' : '/booking/grooming'
    navigate(`${base}?serviceId=${lastAppt.serviceId}&storeId=${lastAppt.storeId}`)
  }

  return (
    <>
      <nav data-testid="app-dock" className="fixed inset-x-0 bottom-[calc(14px+env(safe-area-inset-bottom))] z-tabbar" aria-label="底部导航">
        <div className="mx-auto max-w-lg px-4">
          <div
            className="grid h-16 grid-cols-5 items-center rounded-full border border-line-divider bg-canvas/[.96] px-2 shadow-[0_12px_32px_-16px_rgba(44,40,34,.38)]"
            style={{ backdropFilter: 'blur(18px) saturate(120%)', WebkitBackdropFilter: 'blur(18px) saturate(120%)' }}
          >
            {TABS.map((tab) => (
              <DockTabButton
                key={tab.key}
                tab={tab}
                active={tab.isActive(pathname)}
                onClick={tab.key === 'philia' ? onPhiliaClick : () => navigate(tab.path)}
                onPointerDown={tab.key === 'philia' ? onPhiliaPointerDown : undefined}
                onPointerMove={tab.key === 'philia' ? onPhiliaPointerMove : undefined}
                onPointerUp={tab.key === 'philia' ? cancelPressTimer : undefined}
                onPointerCancel={tab.key === 'philia' ? cancelPressTimer : undefined}
                onContextMenu={tab.key === 'philia' ? (event) => event.preventDefault() : undefined}
              />
            ))}
          </div>
        </div>
      </nav>

      {sheetOpen ? (
        <div className="fixed inset-0 z-modal flex items-end justify-center bg-ink/40" onClick={() => setSheetOpen(false)} role="dialog" aria-label="快捷操作">
          <div className="w-full max-w-lg rounded-t-[26px] bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] ring-1 ring-line-ring" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-[42px] rounded-full bg-line" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <p className="text-title">快捷操作</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="关闭" className="u1-ring flex h-9 w-9 items-center justify-center rounded-full bg-card">
                <X className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
              </button>
            </div>
            <div className="mt-3 divide-y divide-line-divider">
              <button
                type="button"
                data-testid="app-dock-sheet-member"
                onClick={() => { setSheetOpen(false); navigate('/me/card') }}
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
                  <span className="block text-caption text-ink-secondary">{lastAppt ? `上次服务：${lastAppt.serviceName ?? '洗护'}${lastAppt.petName ? ` · ${lastAppt.petName}` : ''}` : '还没有历史预约，去挑一个服务开始吧'}</span>
                </span>
                <span className="text-ink-secondary" aria-hidden="true">›</span>
              </button>
              {storePhone ? (
                <a href={`tel:${storePhone}`} data-testid="app-dock-sheet-contact" onClick={() => setSheetOpen(false)} className="flex w-full items-center gap-3 py-3.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.99]">
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
