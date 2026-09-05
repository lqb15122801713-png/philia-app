/**
 * 仪表盘页（契约 docs/MERCHANT-CONTRACTS.md · T4.1）—— 路由 /dashboard
 *
 * - 顶部：日期（M月D日 周X）+ 门店名 + SSE 连接状态；
 * - 四张核心数字卡：今日预约 / 服务中 / 今日营业额（元） / 待办合计（tabular-nums）；
 * - 待办区（红点聚合）：待确认 / 待派单 / 取消审核 / 待收款 / 异常（超期寄养），「去处理」跳转；
 * - 今日时间轴简表（listForStore 今日），点行进预约详情；
 * - SSE（MerchantEventsProvider 单连接，appType='merchant' → store:{storeId} 频道）：
 *   appointment.created/checkedin/completed/cancel_requested/cancelled/rescheduled
 *   → invalidate dashboardStats + 今日列表；新预约 toast「新预约：{宠物} {服务}」；
 *   paid / boarding.overdue / boarding.completed 同样联动统计；
 * - 断线兜底：SSE 离线时两查询 30s 轮询，重连后全量对齐；
 * - 布局：lg 以上数字卡 4 列 + 下方左右双栏（左待办右时间轴），手机单列。
 */

import { EventType, usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import StatCards from '@/components/dashboard/StatCards'
import TodayTimeline from '@/components/dashboard/TodayTimeline'
import TodoSection from '@/components/dashboard/TodoSection'
import {
  STATS_QUERY_KEY,
  TODAY_QUERY_KEY,
  todayLabel,
  todayRange,
} from '@/components/dashboard/utils'

/** SSE 断线时的兜底轮询间隔 */
const POLL_FALLBACK_MS = 30_000

export default function DashboardPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()

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

  // 门店名（auth.me 返回完整 store 行；独立键，不与 useMe 的镜像结构互相覆盖）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'full'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  })
  const storeName = meQuery.data?.store?.name ?? null

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY })
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

  return (
    <div className="px-4 pb-6 lg:px-8">
      <header className="flex items-end justify-between pt-6">
        <div>
          <p className="text-caption text-ink-secondary">{todayLabel(new Date())}</p>
          <h1 className="mt-0.5 text-title-lg">{storeName ?? '门店仪表盘'}</h1>
        </div>
        <span className="flex items-center gap-1.5 text-caption text-ink-secondary">
          <span
            className={`h-2 w-2 rounded-full ${events.connected ? 'bg-success' : 'bg-line-strong'}`}
          />
          {events.connected ? '实时已连接' : '实时连接中…'}
        </span>
      </header>

      <div className="mt-5">
        <StatCards stats={statsQuery.data} loading={statsQuery.isPending} />
      </div>

      {(statsQuery.isError || todayQuery.isError) && (
        <div className="mt-4 flex items-center justify-between rounded-card bg-card px-4 py-3 shadow-card">
          <p className="text-caption text-ink-secondary">数据加载失败，请检查网络</p>
          <button
            type="button"
            onClick={() => {
              void statsQuery.refetch()
              void todayQuery.refetch()
            }}
            className="text-caption font-semibold text-brand-primary"
          >
            重新加载
          </button>
        </div>
      )}

      {/* 横屏双栏：左待办右时间轴；手机单列 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TodoSection stats={statsQuery.data} />
        <TodayTimeline items={todayQuery.data ?? []} loading={todayQuery.isPending} />
      </div>
    </div>
  )
}
