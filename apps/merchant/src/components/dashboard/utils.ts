/**
 * 仪表盘共享类型与格式化工具（T4.1 · components/dashboard）
 */

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@philia/shared'

type RouterOutputs = inferRouterOutputs<AppRouter>

/** store.dashboardStats 返回体（T4.1 服务端新增） */
export type DashboardStats = RouterOutputs['store']['dashboardStats']
/** appointment.listForStore 返回行（今日时间轴用） */
export type TodayApptItem = RouterOutputs['appointment']['listForStore'][number]

/** React Query 键（TabBar 红点与 DashboardPage 共用，invalidate 互通） */
export const STATS_QUERY_KEY = ['store', 'dashboardStats'] as const
export const TODAY_QUERY_KEY = ['appointment', 'listForStore', 'today'] as const

/** 待办合计（四项待办 + 异常超期寄养；TabBar 红点与「待办合计」卡同口径） */
export const todoGrandTotal = (s: DashboardStats): number => s.todo.total + s.overdueBoardingCount

export const pad2 = (n: number): string => String(n).padStart(2, '0')

/** HH:mm（24 小时制） */
export const hhmm = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/** 头部日期：M月D日 周X */
export const todayLabel = (d: Date): string =>
  `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_LABELS[d.getDay()]}`

/** 今日 [0点, 次日0点) 区间（listForStore 入参） */
export function todayRange(): { from: Date; to: Date } {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  return { from, to: new Date(from.getTime() + 24 * 3600 * 1000) }
}

/** 分 → 元字符串（两位小数，配合 font-number + tabular-nums 纵向对齐） */
export const fenToYuan = (fen: number): string => (fen / 100).toFixed(2)
