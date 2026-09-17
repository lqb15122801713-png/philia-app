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
/** 在店寄养（listForStore status=in_boarding 无日期档，房型分组用；U3 总览新增） */
export const IN_BOARDING_QUERY_KEY = ['appointment', 'listForStore', 'in-boarding'] as const

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

/* ------------------------------------------------------------------ */
/* U3 总览新增（§2 母本副行 / 统计卡大字）                                */
/* ------------------------------------------------------------------ */

/** auth.me 门店行的 openHours 类型（{ mon: {open,close} | null, ... }，null=当日休息） */
type MeOpenHours = NonNullable<RouterOutputs['auth']['me']['store']>['openHours']

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** 头部副行日期：YYYY年M月d日 周X */
export const fullDateLabel = (d: Date): string =>
  `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_LABELS[d.getDay()]}`

/** 当日营业时段：openHours 有当天档 → 营业中 HH:MM–HH:MM；缺档 / null → 今日店休 */
export const openHoursLabel = (openHours: MeOpenHours | null | undefined, d: Date): string => {
  const today = openHours?.[DAY_KEYS[d.getDay()]]
  return today ? `营业中 ${today.open}–${today.close}` : '今日店休'
}

/** 分 → 元（千分位、至多两位小数；统计卡 26px Montserrat 大字用，如 2,368） */
export const fenToYuanGrouped = (fen: number): string =>
  (fen / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })
