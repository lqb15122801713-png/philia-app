/**
 * HomePage · B4-5 复购提醒卡（P2）
 *
 * 触发条件（任务书 B4-5）：存在 completed 洗护单，且最近一次完成距今 ≥14 天 →
 * 在「推荐服务」模块上方渲染「{宠物名}该洗澡啦 ▸ 一键预约」；不满足条件不渲染
 * （含未登录 / 查询中 / 查询失败 / 无 completed 洗护单 / 最近完成 <14 天）。
 *
 * 数据源复用 appointment.listMine（queryKey 与 TabBar/预约列表页同源，命中缓存
 * 不增发请求），不新增接口、服务端零改动。
 *
 * 「最近完成」口径：优先 completedAt（服务真实完成时间）；历史 completed 单
 * completedAt 可能为 NULL，退回 scheduledEnd（预约结束时间，仍代表那次洗护的
 * 完成时点），避免漏提醒。
 *
 * 点击落点：/booking/grooming?serviceId=&storeId=&petId=（该完成单三元组），
 * URL 预填参数在 B4-3 预填体系中优先级最高，进单屏即预填。
 */

import { useQuery } from '@tanstack/react-query'
import { ShowerHead } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'
import type { AppointmentListItem } from '@/components/booking/types'

/** 触发阈值：14 天（毫秒） */
export const REMIND_AFTER_MS = 14 * 24 * 3600 * 1000

/** 该单的「完成时点」：completedAt 优先，NULL（历史数据）退回 scheduledEnd */
function completedTimeOf(a: AppointmentListItem): number {
  return (a.completedAt ?? a.scheduledEnd).getTime()
}

export interface GroomingReminderData {
  appt: AppointmentListItem
  /** 距今天数（向下取整，≥14） */
  days: number
}

/**
 * 纯函数判定：completed 组里取「完成时点最近」的洗护单，距今 ≥14 天则返回提醒数据；
 * 否则 null。多宠物场景按任务书字面口径——锚定全量最近完成的一单（该单宠物即提醒对象）。
 */
export function resolveGroomingReminder(
  completed: AppointmentListItem[] | undefined,
  now: number,
): GroomingReminderData | null {
  const grooming = (completed ?? []).filter((a) => a.type === 'grooming')
  if (grooming.length === 0) return null
  const latest = grooming.reduce((m, a) => (completedTimeOf(a) > completedTimeOf(m) ? a : m))
  const elapsed = now - completedTimeOf(latest)
  if (elapsed < REMIND_AFTER_MS) return null
  return { appt: latest, days: Math.floor(elapsed / 86_400_000) }
}

export default function GroomingReminder() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()

  const mineQuery = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user, // 未登录不打受保护接口（同 TabBar 口径）
    staleTime: 60_000,
  })

  const reminder = useMemo(
    () => resolveGroomingReminder(mineQuery.data?.groups.completed, Date.now()),
    [mineQuery.data],
  )

  // 不满足条件 / 数据未就绪 / 查询失败：一律不渲染（条件卡无三态占位）
  if (!reminder) return null

  const { appt, days } = reminder
  const target = `/booking/grooming?serviceId=${appt.serviceId}&storeId=${appt.storeId}&petId=${appt.petId}`

  return (
    <Link
      data-testid="grooming-reminder"
      to={target}
      className="mt-6 flex items-center gap-3 rounded-card bg-card p-4 shadow-card transition-transform duration-120 ease-philia-spring active:scale-[0.97]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary-light">
        <ShowerHead className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption text-ink-secondary">距上次洗护已 {days} 天</p>
        <p className="truncate text-body font-semibold">{appt.petName ?? '爱宠'}该洗澡啦</p>
      </div>
      <span className="shrink-0 text-caption font-medium text-brand-primary">{' ▸ 一键预约'}</span>
    </Link>
  )
}
