/**
 * TabBar · 客户端底部导航接线（T2.1）
 *
 * - activeService：listMine 查询是否存在 in_service / in_boarding 预约 →
 *   ConvexTabBar `activeService={true}`（呼吸光环）；
 * - 有进行中预约时点击 philia 按钮直达最近一个进行中预约的
 *   /appointments/:id/live（无进行中预约才进 /philia）——经 onNavigate 拦截实现；
 * - 长按 philia 按钮（500ms）弹底部弹层「一键预约最近一次服务」：
 *   复用最近一次非取消预约的 serviceId/storeId 预填跳 /booking/grooming
 *   （boarding 类跳 /booking/boarding）；长按通过 document 级 pointer 事件
 *   捕获 philia 按钮（aria-label="Philia"）实现，不改动共享组件。
 */

import { useQuery } from '@tanstack/react-query'
import { Calendar, Home, Store, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConvexTabBar, useMe, usePhiliaClient } from '@philia/shared'
import type { ConvexTabBarItem } from '@philia/shared'

// 客户端五栏凸起 TabBar：左 2 + philia 凸起按钮 + 右 2（规格见 docs/DESIGN.md §6.1）
const items: ConvexTabBarItem[] = [
  { key: 'home', label: '首页', icon: Home, path: '/home' },
  { key: 'mall', label: '商城', icon: Store, path: '/mall' },
  { key: 'booking', label: '预约', icon: Calendar, path: '/booking' },
  { key: 'me', label: '我的', icon: User, path: '/me' },
]

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

export default function TabBar() {
  const navigate = useNavigate()
  const { user } = useMe()
  const { trpc } = usePhiliaClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  /** 长按已触发时吞掉紧随的 click，避免误导航 */
  const suppressClickRef = useRef(false)

  const mineQuery = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user, // 未登录（守卫跳转前）不打受保护接口
    refetchInterval: 60_000, // 光环状态的轮询兜底（SSE 由 live 页负责）
  })

  const groups = mineQuery.data?.groups
  // 进行中预约：in_service / in_boarding，取 scheduledStart 最近一个（组内已按倒序）
  const activeAppt: MineItem | null = (() => {
    if (!groups) return null
    const ongoing = [...groups.in_service, ...groups.in_boarding] as MineItem[]
    if (ongoing.length === 0) return null
    ongoing.sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime())
    return ongoing[0]!
  })()

  // 最近一次非取消预约（一键复购预填用）
  const lastAppt: MineItem | null = (() => {
    if (!groups) return null
    const all = Object.values(groups).flat() as MineItem[]
    const valid = all.filter((a) => a.status !== 'cancelled' && a.status !== 'cancel_requested')
    if (valid.length === 0) return null
    valid.sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime())
    return valid[0]!
  })()

  /* 长按 philia 按钮 → 底部弹层（document 级捕获，不动 ConvexTabBar） */
  useEffect(() => {
    let timer: number | null = null
    let startX = 0
    let startY = 0

    const isPhilia = (target: EventTarget | null) =>
      target instanceof HTMLElement && !!target.closest('button[aria-label="Philia"]')

    const cancelTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!isPhilia(e.target)) return
      startX = e.clientX
      startY = e.clientY
      cancelTimer()
      timer = window.setTimeout(() => {
        suppressClickRef.current = true
        setSheetOpen(true)
      }, LONG_PRESS_MS)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (timer === null) return
      if (Math.abs(e.clientX - startX) > MOVE_CANCEL_PX || Math.abs(e.clientY - startY) > MOVE_CANCEL_PX) {
        cancelTimer()
      }
    }
    const onPointerEnd = () => cancelTimer()
    // 捕获阶段吞掉长按后的那次 click（阻止 ConvexTabBar 内部的 philia 导航）
    const onClickCapture = (e: MouseEvent) => {
      if (isPhilia(e.target) && suppressClickRef.current) {
        e.preventDefault()
        e.stopPropagation()
        suppressClickRef.current = false
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerEnd)
    document.addEventListener('pointercancel', onPointerEnd)
    document.addEventListener('click', onClickCapture, true)
    return () => {
      cancelTimer()
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerEnd)
      document.removeEventListener('pointercancel', onPointerEnd)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  // philia 点击导航拦截：有进行中预约直达 live 页
  const handleNavigate = (path: string) => {
    if (path === '/philia' && activeAppt) {
      navigate(`/appointments/${activeAppt.id}/live`)
      return
    }
    navigate(path)
  }

  // 一键预约最近一次服务：复用上次的 serviceId/storeId 预填
  const rebook = () => {
    setSheetOpen(false)
    if (!lastAppt) return
    const base = lastAppt.type === 'boarding' ? '/booking/boarding' : '/booking/grooming'
    navigate(`${base}?serviceId=${lastAppt.serviceId}&storeId=${lastAppt.storeId}`)
  }

  return (
    <>
      <ConvexTabBar
        items={items}
        philiaPath="/philia"
        activeService={activeAppt !== null}
        onNavigate={handleNavigate}
      />

      {/* 长按弹层：一键预约最近一次服务 */}
      {sheetOpen ? (
        <div
          className="fixed inset-0 z-modal flex items-end justify-center bg-[rgba(61,50,41,0.4)]"
          onClick={() => setSheetOpen(false)}
          role="dialog"
          aria-label="快捷预约"
        >
          <div
            className="w-full max-w-lg rounded-t-sheet bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-title">一键预约</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="关闭"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-sunken"
              >
                <X className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
              </button>
            </div>
            {lastAppt ? (
              <>
                <p className="mt-2 text-body text-ink-secondary">
                  上次服务：{lastAppt.serviceName ?? '洗护'}
                  {lastAppt.petName ? ` · ${lastAppt.petName}` : ''}
                </p>
                <button
                  type="button"
                  onClick={rebook}
                  className="mt-4 w-full rounded-full bg-philia-gradient py-3 text-body font-semibold text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  再次预约同款服务
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-body text-ink-secondary">
                  还没有历史预约，去挑一个服务开始第一次菲丽亚体验吧
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false)
                    navigate('/booking')
                  }}
                  className="mt-4 w-full rounded-full bg-philia-gradient py-3 text-body font-semibold text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  去预约
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
