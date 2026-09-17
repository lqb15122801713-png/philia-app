/**
 * 经营总览数据卡行（U3 §2 · 母本 .stats 四卡）：今日预约 / 今日营业额 / 在店寄养 / 接单模式
 *
 * - 视觉全部走 index.css 注入的 u3-stat（.cap/.v/.d），26px Montserrat tabular 大字由类承担；
 * - 今日预约副行 = byStatus 今日分状态聚合：服务中=in_service+in_boarding、
 *   待到店=confirmed+pending、已完成=completed；
 * - 今日营业额：v=todayRevenueFen（paid_at 今日口径）；副行 已收=今日单中已登记收款笔数
 *   （listForStore 今日聚合），待收=todo.unpaid（全量 completed 未收款口径）；
 * - 在店寄养：listForStore(status=in_boarding) 按 serviceName（寄养服务名即房型）前端聚合，
 *   零新接口（stayBoard 行不含 serviceName，故取 listForStore）；
 * - 接单模式：批次 S4 起自动接单常驻，静态卡 + 薄荷 pill（u3 未注入 pill 类，tailwind 同值实现）；
 * - 加载中骨架块（animate-pulse，禁转圈），查询失败显示 —（错误卡由页面层给出）。
 */

import type { ReactNode } from 'react'
import { fenToYuanGrouped, type DashboardStats, type TodayApptItem } from './utils'

function StatShell({ cap, children }: { cap: string; children: ReactNode }) {
  return (
    <div className="u3-stat">
      <div className="cap">{cap}</div>
      {children}
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="u3-stat animate-pulse">
      <div className="h-3 w-14 rounded-md bg-[rgba(74,59,46,.08)]" />
      <div className="mt-3 h-6 w-20 rounded-md bg-[rgba(74,59,46,.08)]" />
      <div className="mt-3 h-2.5 w-28 rounded-md bg-[rgba(74,59,46,.06)]" />
    </div>
  )
}

export default function StatCards({
  stats,
  todayItems,
  boardingItems,
  loading,
}: {
  stats: DashboardStats | undefined
  todayItems: TodayApptItem[] | undefined
  boardingItems: TodayApptItem[] | undefined
  loading: boolean
}) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
    )
  }

  const serving = (stats?.byStatus.in_service ?? 0) + (stats?.byStatus.in_boarding ?? 0)
  const waiting = (stats?.byStatus.confirmed ?? 0) + (stats?.byStatus.pending ?? 0)
  const done = stats?.byStatus.completed ?? 0

  const paidCount = todayItems?.filter((i) => i.paidAt != null).length ?? 0
  const unpaidCount = stats?.todo.unpaid ?? 0

  const boardingCount = boardingItems?.length ?? 0
  const roomGroups = new Map<string, number>()
  for (const b of boardingItems ?? []) {
    const room = b.serviceName ?? '寄养'
    roomGroups.set(room, (roomGroups.get(room) ?? 0) + 1)
  }
  const roomText =
    [...roomGroups.entries()].map(([name, n]) => `${name} ${n}`).join(' · ') || '当前无在店寄养'

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <StatShell cap="今日预约">
        <div className="v">{stats ? stats.todayCount : '—'}</div>
        <div className="d">
          服务中 <b>{serving}</b> · 待到店 <b>{waiting}</b> · 已完成 <b>{done}</b>
        </div>
      </StatShell>

      <StatShell cap="今日营业额">
        <div className="v">{stats ? `¥${fenToYuanGrouped(stats.todayRevenueFen)}` : '—'}</div>
        <div className="d">
          已收 <b>{paidCount}</b> 笔 · 待收 <b>{unpaidCount}</b> 笔
        </div>
      </StatShell>

      <StatShell cap="在店寄养">
        <div className="v">{boardingItems ? boardingCount : '—'}</div>
        <div className="d">{roomText}</div>
      </StatShell>

      <StatShell cap="接单模式">
        <div className="v" style={{ fontSize: 17, paddingTop: 6 }}>
          自动接单
        </div>
        <span className="mt-2 inline-block rounded-md bg-[#7FD8BE] px-[7px] py-[2px] text-[11px] font-bold text-ink">
          已启用 · 新预约免确认
        </span>
      </StatShell>
    </div>
  )
}
