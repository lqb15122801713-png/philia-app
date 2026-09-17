/**
 * 经营总览（U3 §2 · 路由 /dashboard）—— 母本「2 · 总览」屏
 *
 * - MainScaffold 外包：title「经营总览」，sub=「YYYY年M月d日 周X · 营业中 HH:MM–HH:MM」
 *   （auth.me store.openHours 当天真值；当天无时段/店休 → 「今日店休」）；
 *   actions = 搜索框（点击即跳 /appointments——预约页暂无搜索聚焦深链，取最简真实落点）
 *   + 柠檬钮「＋ 新增预约」（/appointments 列表页，新建入口在预约流程内）；
 * - 数据卡 4 张（u3-stat）+ 两栏（1.7fr : 1fr，gap 14）：左今日预约表、右待办队列；
 * - 数据：store.dashboardStats + appointment.listForStore（今日区间 / in_boarding 全量，
 *   在店寄养按 serviceName=房型前端聚合，零新接口）；
 * - SSE 沿用 MerchantEventsProvider 全域单连接：appointment.* / boarding.* →
 *   invalidate 三查询；appointment.created → toast「新预约：{宠物} {服务}」；
 * - 断线兜底：SSE 离线时三查询 30s 轮询，重连全量对齐；
 * - 加载骨架（禁转圈）；任一查询失败 = 错误卡 + 重试钮（真 refetch）。
 */

import { EventType, usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import MainScaffold, { LemonButton, QuietButton, SearchInput } from '@/components/MainScaffold'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import StatCards from '@/components/dashboard/StatCards'
import TodayTimeline from '@/components/dashboard/TodayTimeline'
import TodoSection from '@/components/dashboard/TodoSection'
import {
  IN_BOARDING_QUERY_KEY,
  STATS_QUERY_KEY,
  TODAY_QUERY_KEY,
  fullDateLabel,
  openHoursLabel,
  todayRange,
} from '@/components/dashboard/utils'

/** SSE 断线时的兜底轮询间隔 */
const POLL_FALLBACK_MS = 30_000

export default function DashboardPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()
  const navigate = useNavigate()
  const now = new Date()

  const statsQuery = useQuery({
    queryKey: STATS_QUERY_KEY,
    queryFn: () => trpc.store.dashboardStats.query(),
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  })

  const todayQuery = useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: () => trpc.appointment.listForStore.query(todayRange()),
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  })

  // 在店寄养（status=in_boarding 全量，不限日期；统计卡按房型分组 + 待办超期样例）
  const boardingQuery = useQuery({
    queryKey: IN_BOARDING_QUERY_KEY,
    queryFn: () => trpc.appointment.listForStore.query({ status: 'in_boarding' }),
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  })

  // 门店营业时段（auth.me 返回完整 store 行；独立键，不与 useMe 的镜像结构互相覆盖）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'full'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  })
  const openHours = meQuery.data?.store?.openHours

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: IN_BOARDING_QUERY_KEY })
  }, [queryClient])

  // SSE：预约生命周期事件 → 联动刷新；新预约到达 toast
  useEffect(
    () =>
      events.onEvent((envelope) => {
        switch (envelope.type) {
          case EventType.AppointmentCreated: {
            const data = (envelope.data ?? {}) as Record<string, unknown>
            const petName = typeof data.petName === 'string' ? data.petName : ''
            const serviceName = typeof data.serviceName === 'string' ? data.serviceName : ''
            const detail = [petName, serviceName].filter(Boolean).join(' ')
            toast(detail ? `新预约：${detail}` : '收到新预约')
            invalidateAll()
            break
          }
          case EventType.AppointmentCheckedIn:
          case EventType.AppointmentCompleted:
          case EventType.AppointmentCancelRequested:
          case EventType.AppointmentCancelled:
          case EventType.AppointmentRescheduled:
          case EventType.AppointmentPaid:
          case EventType.BoardingOverdue:
          case EventType.BoardingCompleted:
            invalidateAll()
            break
          default:
            break
        }
      }),
    [events, invalidateAll],
  )

  // 断线重连全量对齐（续传补发之外的变更也能追上）
  useEffect(() => events.onReconnect(invalidateAll), [events, invalidateAll])

  const hasError = statsQuery.isError || todayQuery.isError || boardingQuery.isError
  const refetchAll = () => {
    void statsQuery.refetch()
    void todayQuery.refetch()
    void boardingQuery.refetch()
  }

  return (
    <MainScaffold
      title="经营总览"
      sub={`${fullDateLabel(now)} · ${openHoursLabel(openHours, now)}`}
      actions={
        <>
          {/* 预约页暂无搜索聚焦深链：点击输入框即跳 /appointments（最简真实落点） */}
          <div
            role="button"
            tabIndex={0}
            title="到预约页查找"
            className="cursor-pointer"
            onClick={() => navigate('/appointments')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/appointments')
            }}
          >
            <div className="pointer-events-none">
              <SearchInput placeholder="搜索预约 / 客户 / 宠物…" testid="dashboard-search" />
            </div>
          </div>
          <LemonButton testid="dashboard-create" onClick={() => navigate('/appointments')}>
            ＋ 新增预约
          </LemonButton>
        </>
      }
    >
      <StatCards
        stats={statsQuery.data}
        todayItems={todayQuery.data}
        boardingItems={boardingQuery.data}
        loading={statsQuery.isPending}
      />

      {hasError && (
        <div className="u3-panel mt-3.5 flex items-center justify-between px-[17px] py-3">
          <p className="text-[12px] text-[rgba(74,59,46,.62)]">数据加载失败，请检查网络后重试</p>
          <QuietButton testid="dashboard-retry" onClick={refetchAll}>
            重新加载
          </QuietButton>
        </div>
      )}

      {/* 两栏：左今日预约表（1.7fr）右待办队列（1fr），gap 14 */}
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        <TodayTimeline items={todayQuery.data ?? []} loading={todayQuery.isPending} />
        <TodoSection
          stats={statsQuery.data}
          todayItems={todayQuery.data}
          boardingItems={boardingQuery.data}
          now={now}
        />
      </div>
    </MainScaffold>
  )
}
