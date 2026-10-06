/**
 * 经营总览 /dashboard（W-01 驾驶舱 · 片 5 段 1 校形重建）
 *
 * 区块序（UX-02 语言包 §四 W-01）：
 *   M2 异常卡（WAlert，待办/超期寄养/退款/申诉/工单/发票聚合，空态「当前没有异常」）
 *   → M3 单店口径一栏卡（原四 stat 重排；多店三栏=连锁预留开口项，注记明面；
 *     大批片 2：owner 且 listMine.stores>=1 时换连锁视图卡=合计条六项+逐店分栏，
 *     读口 store.chainDashboard 真值；manager/clerk 单店卡零回归）
 *   → M4 合计条（WTotal：今日营业额大数+已收/待收分列+近 14 日 spark 槽——
 *     逐日营收序列无读口，槽位空态置灰不造假）
 *   → 双列 [今日预约 wlist + 审批 wlist ｜ M6 晨报卡（WPostcard：今日营收大数+
 *     在店/待办/超期三行；昨日营收无读口不虚造，取 stats 真值）]
 *   → 快捷/系统状态双列收尾（既有 PhoneAppealSection/TicketTodoSection/
 *     InvoiceTodoSection 原位保留，role.canManage 闸不变）。
 *
 * 数据接线/SSE 全保留（stats/今日/寄养/待办 七查询 + MerchantEventsProvider
 * 全域单连接 + 断线 30s 轮询兜底 + 重连全量对齐）；原 TodoSection 行跳转口径
 * 全部迁进 M2 异常卡与审批 wlist（含 /cashier?pull= 与页内锚点滚动），零回退。
 * u3 旧件零改：StatCards/TodayTimeline/TodoSection 文件不动（本页不再装配）。
 */

import { EventType, Skeleton, usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import MainScaffold, { LemonButton, QuietButton, SearchInput } from '@/components/MainScaffold'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import PhoneAppealSection from '@/components/dashboard/PhoneAppealSection'
import TicketTodoSection from '@/components/dashboard/TicketTodoSection'
import InvoiceTodoSection from '@/components/dashboard/InvoiceTodoSection'
import { WAlert, WList, WPostcard, WTotal, type WAlertItem } from '@/components/skeleton'
import { useStepProgress } from '@/components/appointments/useStepProgress'
import { REFUND_REQUEST_PENDING_KEY } from '@/components/cashier/refund'
import { AmortizationDashNote } from '@/components/member/amortization'
import { dc, type DashCopyKey } from '@/copy/dashboard'
import { useMerchantRole } from '@/lib/roles'
import {
  CHAIN_DASH_QUERY_KEY,
  INVOICE_SECTION_ID,
  IN_BOARDING_QUERY_KEY,
  INVOICE_PENDING_QUERY_KEY,
  PHONE_APPEALS_QUERY_KEY,
  STATS_QUERY_KEY,
  STORE_LIST_MINE_KEY,
  TICKET_PENDING_QUERY_KEY,
  TICKET_SECTION_ID,
  TODAY_QUERY_KEY,
  fenToYuanGrouped,
  fullDateLabel,
  hhmm,
  openHoursLabel,
  todoGrandTotal,
  todayRange,
  type ChainSix,
} from '@/components/dashboard/utils'

/** SSE 断线时的兜底轮询间隔 */
const POLL_FALLBACK_MS = 30_000

/* ---------------- 大批片 2 · 连锁视图（store.chainDashboard 真值直连） ---------------- */

/** 连锁六项签（cap=既有 copy 键复用，零新增标签键；red>0=红字口径） */
const CHAIN_CAPS: Array<{ key: keyof ChainSix; cap: DashCopyKey; red?: boolean; yuan?: boolean }> = [
  { key: 'revenueFen', cap: 'dash.statCapRevenue', yuan: true },
  { key: 'todayCount', cap: 'dash.statCapAppt' },
  { key: 'inBoardingCount', cap: 'dash.statCapBoarding' },
  { key: 'todoTotal', cap: 'dash.postcardRowTodo' },
  { key: 'abnormalCount', cap: 'dash.postcardRowOverdue', red: true },
  { key: 'refundPendingCount', cap: 'dash.todoRefundRequestLabel', red: true },
]

/** 今日预约 wlist 状态签（原 TodayTimeline 胶囊口径的文字化） */
const STATUS_LABEL: Record<string, string> = {
  pending: '待确认',
  confirmed: '待到店',
  in_service: '服务中',
  in_boarding: '寄养中',
  completed: '已完成',
  cancel_requested: '取消申请',
  cancelled: '已取消',
}

/** 页内锚点滚动（原 TodoSection 行点击口径：# 开头=同页待办块锚点） */
const scrollToAnchor = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function DashboardPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()
  const role = useMerchantRole()
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

  // 客户退款申请待办角标（批次 C5：listPending 独立查询挂 TodoSection 行；
  // stats 聚合不含此项——报备口径内独立查询方案；clerk 无读口不查）
  const refundRequestQ = useQuery({
    queryKey: REFUND_REQUEST_PENDING_KEY,
    queryFn: () => trpc.refundRequest.listPending.query(),
    enabled: role.canManage,
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  })

  // 换绑申诉待审队列（批次 R13b；merchantManagerProcedure 硬闸——clerk enabled 关闸不发查询，
  // 待办块同 role.canManage 不渲染；SSE 无申诉事件类型，断线 30s 轮询兜底照既有三查询模式）
  const appealQuery = useQuery({
    queryKey: PHONE_APPEALS_QUERY_KEY,
    queryFn: () => trpc.authSecurity.listPhoneAppeals.query(),
    enabled: role.canManage,
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  })

  // 门店营业时段（auth.me 返回完整 store 行；独立键，不与 useMe 的镜像结构互相覆盖）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'full'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  })
  const openHours = meQuery.data?.store?.openHours

  // 补缺大批片 4：客服工单 / 发票申请待办（本店 owner|manager 读口，clerk 不发起）
  const ticketQuery = useQuery({
    queryKey: TICKET_PENDING_QUERY_KEY,
    queryFn: () => trpc.serviceLoop.ticketListPending.query(),
    enabled: role.canManage,
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  })
  const invoiceQuery = useQuery({
    queryKey: INVOICE_PENDING_QUERY_KEY,
    queryFn: () => trpc.serviceLoop.invoiceListPending.query(),
    enabled: role.canManage,
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  })

  // 大批片 2 · 老板端驾驶舱：owner 连锁视图两查询（listMine 店集合 + chainDashboard 六项真值；
  // manager/clerk 关闸不发查询，M3 卡仍单店口径零回归）
  const listMineQuery = useQuery({
    queryKey: STORE_LIST_MINE_KEY,
    queryFn: () => trpc.store.listMine.query(),
    enabled: role.isOwner,
    staleTime: 300_000,
  })
  const chainQuery = useQuery({
    queryKey: CHAIN_DASH_QUERY_KEY,
    queryFn: () => trpc.store.chainDashboard.query(),
    enabled: role.isOwner,
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  })

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: IN_BOARDING_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: REFUND_REQUEST_PENDING_KEY })
    // 补缺大批片 4：重连全量对齐覆盖两待办块（无 store 频道事件，靠此追上）
    void queryClient.invalidateQueries({ queryKey: TICKET_PENDING_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: INVOICE_PENDING_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: PHONE_APPEALS_QUERY_KEY })
    // 大批片 2：连锁视图随全域事件对齐（owner 才挂查询，无效化空键无害）
    void queryClient.invalidateQueries({ queryKey: CHAIN_DASH_QUERY_KEY })
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
          // 批次 M1：收银台事件 → 总览联动（结账翻预约待收 −1 / todayRevenueFen 含收银；
          // 挂单/撤单影响收银台自身口径，统一全量对齐）
          // falls through —— 批次 M1 收银台事件统一全量对齐（故意贯穿，见上方 M1 注释）
          case EventType.CashierBillHeld:
          case EventType.CashierBillSettled:
          case EventType.CashierBillVoided:
          // 批次 C5：客户退款申请批准 → 待办角标对齐（shared EventType 常量同步属跨包改动，
          // 本批范围=apps/merchant 暂以字面值对齐，已报备）
          case 'refundRequest.approved':
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

  const hasError =
    statsQuery.isError ||
    todayQuery.isError ||
    boardingQuery.isError ||
    (role.isOwner && chainQuery.isError)
  const refetchAll = () => {
    void statsQuery.refetch()
    void todayQuery.refetch()
    void boardingQuery.refetch()
    if (role.isOwner) void chainQuery.refetch()
  }

  /* 今日表服务中行六步进度（胶囊「服务中 N/6」，试样 §2；现成接口共享缓存） */
  const stepProgress = useStepProgress(todayQuery.data ?? [])

  /* ---------------- M2 异常卡聚合（原 TodoSection 行口径全迁：路由+锚点零回退） ---------------- */

  const stats = statsQuery.data
  const todayItems = todayQuery.data
  const boardingItems = boardingQuery.data
  const refundRequests = role.canManage ? (refundRequestQ.data ?? []) : undefined
  const ticketCount = role.canManage ? ticketQuery.data?.length : undefined
  const invoiceCount = role.canManage ? invoiceQuery.data?.length : undefined
  const appealCount = role.canManage ? (appealQuery.data?.items.length ?? 0) : undefined

  const unpaidSample = todayItems?.find((i) => i.status === 'completed' && i.paidAt == null)

  const alertItems: WAlertItem[] = []
  if (stats) {
    if (stats.todo.cancelRequested > 0) {
      alertItems.push({
        key: 'cancel',
        text: dc('dash.todoCancelLabel'),
        count: stats.todo.cancelRequested,
        to: '/appointments?status=cancel_requested&from=todo',
      })
    }
    if (refundRequests && refundRequests.length > 0) {
      alertItems.push({
        key: 'refund',
        text: dc('dash.todoRefundRequestLabel'),
        count: refundRequests.length,
        to: '/cashier/refunds',
      })
    }
    if (stats.todo.unpaid > 0) {
      alertItems.push({
        key: 'unpaid',
        text: dc('dash.todoUnpaidLabel'),
        count: stats.todo.unpaid,
        // 批次 M1 联动口径沿用：有样例单 → 收银台自动拉入该预约
        to: unpaidSample ? `/cashier?pull=${unpaidSample.id}` : '/cashier',
      })
    }
    if (stats.overdueBoardingCount > 0) {
      alertItems.push({
        key: 'overdue',
        text: dc('dash.todoOverdueLabel'),
        count: stats.overdueBoardingCount,
        to: '/boarding',
      })
    }
    if (stats.todo.pending > 0) {
      alertItems.push({
        key: 'pending',
        text: dc('dash.todoPendingLabel'),
        count: stats.todo.pending,
        to: '/appointments?status=pending&from=todo',
      })
    }
    if (ticketCount !== undefined && ticketCount > 0) {
      alertItems.push({
        key: 'ticket',
        text: dc('dash.todoTicketLabel'),
        count: ticketCount,
        onClick: () => scrollToAnchor(TICKET_SECTION_ID),
      })
    }
    if (invoiceCount !== undefined && invoiceCount > 0) {
      alertItems.push({
        key: 'invoice',
        text: dc('dash.todoInvoiceLabel'),
        count: invoiceCount,
        onClick: () => scrollToAnchor(INVOICE_SECTION_ID),
      })
    }
    if (appealCount !== undefined && appealCount > 0) {
      alertItems.push({
        key: 'phoneAppeal',
        text: dc('dash.todoAppealLabel'),
        count: appealCount,
        onClick: () => scrollToAnchor('phone-appeals'),
      })
    }
  }

  /* ---------------- M3 单店口径一栏（原 StatCards 四 stat 重排，派生口径不变） ---------------- */

  const serving = (stats?.byStatus.in_service ?? 0) + (stats?.byStatus.in_boarding ?? 0)
  const waiting = (stats?.byStatus.confirmed ?? 0) + (stats?.byStatus.pending ?? 0)
  const doneCount = stats?.byStatus.completed ?? 0
  const boardingCount = boardingItems?.length ?? 0
  const roomGroups = new Map<string, number>()
  for (const b of boardingItems ?? []) {
    const room = b.serviceName ?? '寄养'
    roomGroups.set(room, (roomGroups.get(room) ?? 0) + 1)
  }
  const roomText =
    [...roomGroups.entries()].map(([name, n]) => `${name} ${n}`).join(' · ') ||
    dc('dash.statBoardingEmpty')
  /* M1-补2 R1 同源口径沿用：今日营业额=todayTender.receivedTotalFen（已收=现金类三分列） */
  const tender = stats?.todayTender
  const tenderPaidCount = tender?.counts.paidCount ?? 0

  /* ---------------- wlist 双列数据 ---------------- */

  const todayListItems = (todayItems ?? []).map((item) => {
    const prog = stepProgress.get(item.id)
    const statusText =
      item.status === 'in_service' && prog
        ? `服务中 ${prog.done}/${prog.total}`
        : item.status === 'completed' && item.paidAt == null
          ? '已完成 · 待收款'
          : (STATUS_LABEL[item.status] ?? item.status)
    return {
      key: item.id,
      title: `${hhmm(item.scheduledStart)} ${item.petName ?? '宠物'} · ${item.serviceName ?? '服务'}`,
      sub: `${statusText} · ${item.staffName ?? '未指派'}`,
      to: `/appointments/${item.id}`,
      dot: item.status === 'cancel_requested',
    }
  })

  const approvalItems = [
    ...(todayItems ?? [])
      .filter((i) => i.status === 'cancel_requested')
      .map((i) => ({
        key: `cancel-${i.id}`,
        title: `${i.petName ?? '宠物'} · ${dc('dash.todoCancelLabel')}`,
        sub: `${hhmm(i.scheduledStart)} ${i.serviceName ?? ''}`,
        to: `/appointments/${i.id}`,
        dot: true,
      })),
    ...(refundRequests ?? []).map((r) => ({
      key: `refund-${r.requestNo}`,
      title: `${dc('dash.todoRefundRequestLabel')} ${r.requestNo}`,
      sub: `¥${fenToYuanGrouped(r.amountFen)}`,
      to: '/cashier/refunds',
      dot: true,
    })),
    ...(appealCount !== undefined && appealCount > 0
      ? [
          {
            key: 'appeals',
            title: dc('dash.todoAppealLabel'),
            sub: dc('dash.todoAppealHint'),
            onClick: () => scrollToAnchor('phone-appeals'),
            dot: true,
          },
        ]
      : []),
  ]

  /* ---------------- M3 连锁视图闸（owner 且 listMine.stores>=1 → 连锁卡；manager/clerk 单店卡零回归） ---------------- */
  const chainView = role.isOwner && (listMineQuery.data?.stores.length ?? 1) >= 1
  const chain = chainView ? chainQuery.data : undefined

  return (
    <MainScaffold
      title={dc('dash.title')}
      sub={
        <>
          {fullDateLabel(now)} ·{' '}
          <span className="font-number tabular-nums">{openHoursLabel(openHours, now)}</span>
        </>
      }
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
      <div className="wsk">
        {/* M2 异常卡：永远第一屏第一位（加载中给骨架，不抢「当前没有异常」空态） */}
        {statsQuery.isPending ? (
          <section className="wsk-alert" aria-label="加载中">
            {[0, 1].map((i) => (
              <div className="row" key={i}>
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="ml-auto h-3.5 w-6" />
              </div>
            ))}
          </section>
        ) : (
          <WAlert items={alertItems} testId="dash-alert" />
        )}

        {hasError && (
          <div className="u3-panel mt-3.5 flex items-center justify-between px-[17px] py-3">
            <p className="text-[12px] text-[rgba(59,46,36,.62)]">数据加载失败，请检查网络后重试</p>
            <QuietButton testid="dashboard-retry" onClick={refetchAll}>
              重新加载
            </QuietButton>
          </div>
        )}

        {/* M3：owner=连锁视图卡（合计条六项+逐店分栏，chainDashboard 真值）；manager/clerk=单店口径一栏卡（零回归） */}
        {chainView ? (
          <section className="wsk-card mt-3.5" data-testid="dash-m3-chain">
            <div className="wsk-hd">
              <span className="t">{dc('dash.m3ChainTitle')}</span>
              <span className="a">{dc('dash.m3ChainNote')}</span>
            </div>
            {chainQuery.isPending && !chain ? (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="mt-2.5 h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : !chain?.total ? null : (
              <>
                {/* 合计条：六项合计（营收 ¥ 格式化照既有 fenToYuanGrouped） */}
                <div
                  className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6"
                  data-testid="dash-m3-chain-total"
                >
                  {CHAIN_CAPS.map((c) => (
                    <div key={c.key}>
                      <div className="text-[11px] font-semibold text-[rgba(59,46,36,.42)]">
                        {dc(c.cap)}
                      </div>
                      <div
                        className={`mt-1 whitespace-nowrap font-number text-[20px] font-bold tabular-nums${
                          c.red && chain.total[c.key] > 0 ? ' text-danger-deep' : ''
                        }`}
                      >
                        {c.yuan ? `¥${fenToYuanGrouped(chain.total[c.key])}` : chain.total[c.key]}
                      </div>
                    </div>
                  ))}
                </div>
                {/* 分栏：每店一栏（店名+六项数） */}
                <div
                  className="mt-3.5 grid items-start gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
                  data-testid="dash-m3-chain-stores"
                >
                  {chain.stores.map((s) => (
                    <div
                      key={s.storeId}
                      className="rounded-control bg-[rgba(59,46,36,.04)] p-3.5"
                      data-testid={`dash-m3-chain-store-${s.storeId}`}
                    >
                      <div className="text-caption font-bold text-ink">
                        {s.name}
                        {s.groupName ? (
                          <span className="ml-1.5 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
                            {s.groupName}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1">
                        {CHAIN_CAPS.map((c) => (
                          <div key={c.key} className="flex items-center justify-between text-caption-xs">
                            <span className="text-[rgba(59,46,36,.62)]">{dc(c.cap)}</span>
                            <span
                              className={`font-number font-bold tabular-nums${
                                c.red && s[c.key] > 0 ? ' text-danger-deep' : ''
                              }`}
                            >
                              {c.yuan ? `¥${fenToYuanGrouped(s[c.key])}` : s[c.key]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : (
        /* M3 单店口径一栏卡（四 stat 重排；多店三栏=连锁预留开口项注记） */
        <section className="wsk-card mt-3.5" data-testid="dash-m3">
          <div className="wsk-hd">
            <span className="t">{dc('dash.m3Title')}</span>
            <span className="a">{dc('dash.m3SingleNote')}</span>
          </div>
          {statsQuery.isPending && !stats ? (
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="mt-2.5 h-6 w-20" />
                  <Skeleton className="mt-2.5 h-2.5 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              <div>
                <div className="text-[11px] font-semibold text-[rgba(59,46,36,.42)]">
                  {dc('dash.statCapAppt')}
                </div>
                <div className="mt-1 font-number text-[24px] font-bold tabular-nums">
                  {stats ? stats.todayCount : '—'}
                </div>
                <div className="mt-0.5 text-[11px] text-[rgba(59,46,36,.62)]">
                  服务中 <b className="font-number tabular-nums">{serving}</b> · 待到店{' '}
                  <b className="font-number tabular-nums">{waiting}</b> · 已完成{' '}
                  <b className="font-number tabular-nums">{doneCount}</b>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[rgba(59,46,36,.42)]">
                  {dc('dash.statCapRevenue')}
                </div>
                <div
                  className="mt-1 whitespace-nowrap font-number text-[24px] font-bold tabular-nums"
                  data-testid="dashboard-today-revenue"
                >
                  {tender ? `¥${fenToYuanGrouped(tender.receivedTotalFen)}` : '—'}
                </div>
                <div className="mt-0.5 text-[11px] text-[rgba(59,46,36,.62)]">
                  已收 <b className="font-number tabular-nums">{tenderPaidCount}</b> 笔 · 待收{' '}
                  <b className="font-number tabular-nums">{stats?.todo.unpaid ?? 0}</b> 笔
                </div>
                {/* QA40-D1（PD-03 件 2）：分摊口径注原位保留 */}
                <AmortizationDashNote />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[rgba(59,46,36,.42)]">
                  {dc('dash.statCapBoarding')}
                </div>
                <div className="mt-1 font-number text-[24px] font-bold tabular-nums">
                  {boardingItems ? boardingCount : '—'}
                </div>
                <div className="mt-0.5 text-[11px] text-[rgba(59,46,36,.62)]">{roomText}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[rgba(59,46,36,.42)]">
                  {dc('dash.statCapMode')}
                </div>
                <div className="mt-1 text-[17px] font-semibold leading-8">
                  {dc('dash.statModeValue')}
                </div>
                <span className="mt-1 inline-block rounded-md bg-[#F2DFA6] px-[7px] py-[2px] text-[11px] font-bold text-[#3B2E24]">
                  {dc('dash.statModePill')}
                </span>
              </div>
            </div>
          )}
        </section>
        )}

        {/* M4 合计条（今日营业额大数+已收/待收分列+近 14 日 spark 槽：无逐日读口，置灰不造假） */}
        <div className="mt-3.5">
          <WTotal
            cap={dc('dash.totalCap')}
            value={tender ? `¥${fenToYuanGrouped(tender.receivedTotalFen)}` : '—'}
            cells={[
              { k: dc('dash.totalPaidCell'), v: String(tenderPaidCount) },
              { k: dc('dash.totalUnpaidCell'), v: String(stats?.todo.unpaid ?? 0) },
            ]}
            spark={
              <div
                className="flex items-end gap-[3px] opacity-40"
                title={dc('dash.sparkEmpty')}
                aria-label={dc('dash.sparkEmpty')}
              >
                {Array.from({ length: 14 }).map((_, i) => (
                  <i key={i} className="h-[10px] w-[4px] rounded-sm bg-[hsl(var(--background)/.5)]" />
                ))}
              </div>
            }
          />
        </div>

        {/* 双列：今日预约 wlist + 审批 wlist ｜ M6 晨报卡右栏 */}
        <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.7fr_1fr]">
          <div className="flex min-w-0 flex-col gap-3.5">
            <div>
              <div className="wsk-hd">
                <span className="t">{dc('dash.todayListTitle')}</span>
                <span className="a">
                  按时间 · <span className="font-number tabular-nums">{todayItems?.length ?? 0}</span> 单
                </span>
              </div>
              {todayQuery.isPending ? (
                <section className="wsk-list" aria-label="加载中">
                  {[0, 1, 2, 3].map((i) => (
                    <div className="it" key={i}>
                      <Skeleton className="h-3.5 w-44" />
                      <Skeleton className="ml-auto h-3 w-16" />
                    </div>
                  ))}
                </section>
              ) : (
                <WList
                  items={todayListItems}
                  emptyText={dc('dash.timelineEmpty')}
                  testId="dash-today-list"
                />
              )}
            </div>
            <div>
              <div className="wsk-hd">
                <span className="t">{dc('dash.approvalListTitle')}</span>
                <span className="a">
                  <span className="font-number tabular-nums">{approvalItems.length}</span> 项
                </span>
              </div>
              <WList
                items={approvalItems}
                emptyText={dc('dash.approvalEmpty')}
                testId="dash-approval-list"
              />
            </div>
          </div>
          <WPostcard
            figure={tender ? `¥${fenToYuanGrouped(tender.receivedTotalFen)}` : '—'}
            figureCap={dc('dash.postcardFigCap')}
            rows={[
              {
                key: 'boarding',
                label: dc('dash.postcardRowBoarding'),
                value: String(boardingCount),
              },
              {
                key: 'todo',
                label: dc('dash.postcardRowTodo'),
                value: stats ? String(todoGrandTotal(stats)) : '—',
              },
              {
                key: 'overdue',
                label: dc('dash.postcardRowOverdue'),
                value: String(stats?.overdueBoardingCount ?? 0),
                tone: (stats?.overdueBoardingCount ?? 0) > 0 ? 'red' : undefined,
              },
            ]}
            testId="dash-postcard"
          />
        </div>

        {/* 快捷/系统状态双列收尾（既有待办块原位保留；clerk 不渲染同原口径） */}
        {role.canManage && (
          <div className="mt-3.5 grid items-start gap-3.5 lg:grid-cols-2">
            <div className="flex flex-col gap-3.5">
              <TicketTodoSection
                items={ticketQuery.data}
                loading={ticketQuery.isPending}
                error={ticketQuery.isError}
                onRetry={() => void ticketQuery.refetch()}
              />
              <InvoiceTodoSection
                items={invoiceQuery.data}
                loading={invoiceQuery.isPending}
                error={invoiceQuery.isError}
                onRetry={() => void invoiceQuery.refetch()}
              />
            </div>
            <PhoneAppealSection items={appealQuery.data?.items ?? []} />
          </div>
        )}
      </div>
    </MainScaffold>
  )
}
