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
/** authSecurity.listPhoneAppeals 返回行（批次 R13b 换绑申诉待办块用） */
export type PhoneAppealItem = RouterOutputs['authSecurity']['listPhoneAppeals']['items'][number]

/** React Query 键（TabBar 红点与 DashboardPage 共用，invalidate 互通） */
export const STATS_QUERY_KEY = ['store', 'dashboardStats'] as const
export const TODAY_QUERY_KEY = ['appointment', 'listForStore', 'today'] as const
/** 在店寄养（listForStore status=in_boarding 无日期档，房型分组用；U3 总览新增） */
export const IN_BOARDING_QUERY_KEY = ['appointment', 'listForStore', 'in-boarding'] as const
/* 补缺大批片 4：客服工单 / 发票申请待办（serviceLoop 读口，页面层与两待办块共用键） */
export const TICKET_PENDING_QUERY_KEY = ['serviceLoop', 'ticketListPending'] as const
export const INVOICE_PENDING_QUERY_KEY = ['serviceLoop', 'invoiceListPending'] as const
/** TodoSection 新增两行计数的滚动锚点（同页下方面板块 id） */
export const TICKET_SECTION_ID = 'dash-todo-tickets'
export const INVOICE_SECTION_ID = 'dash-todo-invoices'

/** serviceLoop.ticketListPending 返回行（本店 submitted 工单） */
export type TicketPendingItem = RouterOutputs['serviceLoop']['ticketListPending'][number]
/** serviceLoop.invoiceListPending 返回行（本店 submitted 发票申请） */
export type InvoicePendingItem = RouterOutputs['serviceLoop']['invoiceListPending'][number]
/** 换绑申诉待审队列（manager|owner；DashboardPage 待办块 + TodoSection 计数行共用） */
export const PHONE_APPEALS_QUERY_KEY = ['authSecurity', 'listPhoneAppeals'] as const
/* 商家端大批片 2 · 老板端驾驶舱：owner 连锁视图两查询键（listMine 店集合 / chainDashboard 六项） */
export const STORE_LIST_MINE_KEY = ['store', 'listMine'] as const
export const CHAIN_DASH_QUERY_KEY = ['store', 'chainDashboard'] as const
/** store.chainDashboard 返回体（owner；total 在店域为空时为 null） */
export type ChainDashboardData = RouterOutputs['store']['chainDashboard']
/** chainDashboard 六项合计行（total 非空形） */
export type ChainSix = NonNullable<ChainDashboardData['total']>

/** 晨报待办合计（四项待办；与 chainDashboard 同口径，超期寄养单列不双计） */
export const todoGrandTotal = (s: DashboardStats): number => s.todo.total

/* ------------------------------------------------------------------ */
/* PD-61：首页顶部待办行与「待办合计」同源同构                              */
/* ------------------------------------------------------------------ */

/** 首页顶部待办/异常行键 */
export type TodoAlertRowKey =
  /* todo 四件：计入「待办合计」（与 dashboardStats.todo.total 同一构成） */
  | 'cancelRequested'
  | 'unassigned'
  | 'unpaid'
  | 'pending'
  /* 超期寄养：单列显示、不计入待办合计（PD-56「超期单列不双计」） */
  | 'overdue'
  /* 独立域行（各有专属待办块/页面）：不计入待办合计 */
  | 'refund'
  | 'ticket'
  | 'invoice'
  | 'phoneAppeal'

export interface TodoAlertRow {
  key: TodoAlertRowKey
  count: number
  /** true＝计入「待办合计」（todo 四件，与 todo.total 同源同构）；false＝单列/独立域不计入 */
  countsTowardTodoTotal: boolean
}

/**
 * 首页顶部待办行唯一取数口（PD-61）：
 * - todo 四件一一对应成行：cancelRequested / unassigned / unpaid / pending ——计入待办合计，
 *   其和经 todoAlertCountedTotal 派生，任意种子下等于 dashboardStats.todo.total；
 * - 超期寄养单列显示、不计入待办合计（PD-56 口径不双计）；
 * - 退款申请 / 客服工单 / 发票申请 / 换绑申诉为独立域行，不混入待办合计。
 * 渲染层按 count>0 过滤展示；行序即首页顶部行序。
 */
export function buildTodoAlertRows(
  stats: DashboardStats,
  extras: { refund?: number; ticket?: number; invoice?: number; phoneAppeal?: number } = {},
): TodoAlertRow[] {
  return [
    { key: 'cancelRequested', count: stats.todo.cancelRequested, countsTowardTodoTotal: true },
    { key: 'refund', count: extras.refund ?? 0, countsTowardTodoTotal: false },
    { key: 'unpaid', count: stats.todo.unpaid, countsTowardTodoTotal: true },
    { key: 'unassigned', count: stats.todo.unassigned, countsTowardTodoTotal: true },
    { key: 'overdue', count: stats.overdueBoardingCount, countsTowardTodoTotal: false },
    { key: 'pending', count: stats.todo.pending, countsTowardTodoTotal: true },
    { key: 'ticket', count: extras.ticket ?? 0, countsTowardTodoTotal: false },
    { key: 'invoice', count: extras.invoice ?? 0, countsTowardTodoTotal: false },
    { key: 'phoneAppeal', count: extras.phoneAppeal ?? 0, countsTowardTodoTotal: false },
  ]
}

/** 待办行计入合计之和（＝todo 四件合计；任意种子下等于 todo.total，超期寄养不双计） */
export const todoAlertCountedTotal = (rows: TodoAlertRow[]): number =>
  rows.reduce((n, r) => (r.countsTowardTodoTotal ? n + r.count : n), 0)

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

/** 分 → 元（千分位、至多两位小数；统计卡 26px Montserrat 大字用，如 2,368）。
    片 5 归并：权威实现迁至 mall-admin/format（zh-CN 口径：千分分组+整数去 .00+
    带零头两位小数），此处仅 re-export 保持既有导入路径；归并转发，勿再加新实现 */
export { fenToYuanGrouped } from '../mall-admin/format'
