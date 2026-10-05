/**
 * AppDock · 客户端全局统一底部 dock（批次 U1 任务 A；换皮批片 2 落 v2.0 §4.1）。
 *
 * 主级页面（/home /mall /me /philia）唯一 dock，五项槽位顺序锁定：
 *   首页 / 预约 / philia 中央悬浮钮 / 商城 / 我的（序不可错）。
 * - 形态（v2.0 §4.1 案 A 悬浮胶囊）：高 64 / 左右 16 / 底 14 / 圆角 99；
 *   深棕 rgba(46,35,24,.94) + blur(18px) saturate(140%)；激活态=淡黄圆底衬深棕
 *   图标（衬底实心形状，图标不变色）；未激活=深底弱文字 #B9A98F；
 * - 中央爪钮（客户端私有实心件）：58×58 淡黄圆底凸起 translateY(-16px)
 *   + 3px 纸白描边 + 深棕墨 paw；点击=philia 页；长按 500ms=快捷弹层
 *   （会员码 / 一键预约 / 联系门店）——迁移旧 TabBar（ConvexTabBar 接线）
 *   长按交互：500ms 触发、10px 移动取消、长按后吞掉 click；
 *   W1 R-Nav-3：中位补「philia」文字标签（底栏五槽全件带文字，字号字重同槽对齐）；
 * - 详情级页面不渲染本组件（App.tsx 按路径白名单渲染）。
 *
 * 「联系门店」沿用 ContactStore 契约——stores.phone 已在仓（0042 迁移），
 * phone 缺失时该项隐藏，有值 tel: 直拨。
 */

import { useQuery } from '@tanstack/react-query'
import { Calendar, CalendarCheck, Home, Phone, QrCode, Store, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'

/** 深棕墨 paw 剪影（token text.primary #3B2E24，currentColor 继承）
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
  /* v2.0 §4.1 dock：激活态=淡黄圆底衬深棕图标（衬底实心形状，图标本身不变色）；
     未激活=深底弱文字 #B9A98F；文字标签色随深底反白系 */
  return (
    <button
      type="button"
      onClick={() => navigate(tab.path)}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
      data-testid={`app-dock-${tab.key}`}
      className="flex flex-col items-center justify-center gap-[3px] py-1 transition-transform duration-120 ease-philia-spring active:scale-92"
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          active ? 'bg-[#F2DFA6] text-[#3B2E24]' : 'text-[#B9A98F]'
        }`}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.7} />
      </span>
      <span className={`text-caption-xs leading-none ${active ? 'font-semibold text-[#F6EFDD]' : 'text-[#B9A98F]'}`}>
        {tab.label}
      </span>
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

  // 门店电话：stores.phone 已在仓（0042 迁移，getWithServices 返回行带 phone）——有则 tel: 直拨，无则该项隐藏
  const storeQuery = useQuery({
    queryKey: ['store', 'getWithServices', lastAppt?.storeId, 'dock-contact'],
    queryFn: () => trpc.store.getWithServices.query({ storeId: lastAppt!.storeId }),
    enabled: sheetOpen && !!lastAppt?.storeId,
    staleTime: 300_000,
  })
  const storePhone = storeQuery.data?.store.phone ?? null

  /* 长按 philia 中央钮（500ms，10px 移动取消）→ 快捷弹层 */
  const cancelPressTimer = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartRef.current = null
  }
  useEffect(() => cancelPressTimer, [])

  /* 快捷弹层滚动锁（§4.5 三件套：开时锁底层 body） */
  useEffect(() => {
    if (!sheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sheetOpen])

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
      <nav
        data-testid="app-dock"
        className="fixed inset-x-0 bottom-[calc(14px+env(safe-area-inset-bottom))] z-tabbar"
        aria-label="底部导航"
      >
        <div className="mx-auto max-w-lg px-4">
          {/* v2.0 §4.1 dock（案 A 悬浮胶囊）：高 64 / 圆角 99 / 深棕 rgba(46,35,24,.94)
              + blur(18px) saturate(140%) */}
          <div
            className="grid h-16 grid-cols-5 items-center rounded-full px-2"
            style={{
              background: 'rgba(46,35,24,.94)',
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            }}
          >
            {LEFT_TABS.map((tab) => (
              <DockTabButton key={tab.key} tab={tab} active={tab.isActive(pathname)} />
            ))}

            {/* philia 中央爪钮（客户端私有）：58×58 淡黄圆底凸起 translateY(-16px)
                + 3px 纸白描边 + 深棕墨爪；点击=philia 页，长按=快捷弹层。
                W1 R-Nav-3：中位补文字标签（深底口径） */}
            <span className="flex flex-col items-center justify-center gap-[3px] py-1">
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
                className="flex h-[58px] w-[58px] -translate-y-4 items-center justify-center rounded-full bg-[#F2DFA6] text-[#3B2E24] shadow-[0_0_0_3px_#FAF8F2] transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <PawMark className="h-7 w-7" />
              </button>
              <span
                className={`text-caption-xs leading-none ${
                  philiaActive ? 'font-semibold text-[#F6EFDD]' : 'text-[#B9A98F]'
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

      {/* 长按快捷弹层：会员码 / 一键预约 / 联系门店
          （§4.5 三件套：抓握手柄 grab 42×4 + 可点遮罩 + 滚动锁；顶角 26） */}
      {sheetOpen ? (
        <div
          className="fixed inset-0 z-modal flex items-end justify-center bg-ink/40"
          onClick={() => setSheetOpen(false)}
          role="dialog"
          aria-label="快捷操作"
        >
          <div
            className="w-full max-w-lg rounded-t-[26px] bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] ring-1 ring-line-ring"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-[42px] rounded-full bg-line" aria-hidden="true" />
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
                  navigate('/member')
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
