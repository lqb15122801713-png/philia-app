/**
 * 待办队列（U3 §2 右栏 · 母本 .todo-row 四行）：
 * 取消申请待审（红点）/ 待收款（柠檬点）/ 超期寄养（红点）/ 历史待确认（薄荷点）。
 *
 * - 计数 = dashboardStats.todo.cancelRequested / todo.unpaid / overdueBoardingCount /
 *   todo.pending（批次 S4：新单免确认，pending 仅计历史单与改期回退单）；
 * - 行点击进入对应筛选态：预约页 ?status= 深链 + from=todo 放开日期档（v1.1-b2 B2-1），
 *   待收款 → /finance#pending-payments 锚点，超期寄养 → /boarding；
 * - 小字给一条真实样例：取消/待收款取今日 listForStore 首条命中单，超期寄养取在店
 *   in_boarding 首条应退未退单；今日无样例时回退事由说明；
 * - 数量为 0 行保留（信息密度与位置稳定），计数 Montserrat tabular 由 u3-todo .n 承担。
 */

import { useNavigate } from 'react-router-dom'
import { fenToYuanGrouped, hhmm, type DashboardStats, type TodayApptItem } from './utils'

const DOT_RED = '#D92D20'
const DOT_LEMON = '#FDC830'
const DOT_MINT = '#7FD8BE'

interface TodoRowSpec {
  key: string
  dot: string
  label: string
  hint: string
  count: number
  to: string
}

/** 超期样例小字：应退未退 N 天（不足一天算「今日到期未退」） */
function overdueHint(item: TodayApptItem, nowTs: number): string {
  const days = Math.floor((nowTs - item.scheduledEnd.getTime()) / 86_400_000)
  const overdueText = days >= 1 ? `应退未退 ${days} 天` : '今日到期未退'
  return `${item.petName ?? '宠物'} · ${item.serviceName ?? '寄养'} · ${overdueText}`
}

export default function TodoSection({
  stats,
  todayItems,
  boardingItems,
  now,
}: {
  stats: DashboardStats | undefined
  todayItems: TodayApptItem[] | undefined
  boardingItems: TodayApptItem[] | undefined
  /** 页面层传入的当前时间（react-hooks/purity：组件内不调 Date.now） */
  now: Date
}) {
  const navigate = useNavigate()
  const nowTs = now.getTime()

  const cancelSample = todayItems?.find((i) => i.status === 'cancel_requested')
  const unpaidSample = todayItems?.find((i) => i.status === 'completed' && i.paidAt == null)
  const overdueSample = boardingItems?.find((i) => i.scheduledEnd.getTime() < nowTs)

  const rows: TodoRowSpec[] = [
    {
      key: 'cancelRequested',
      dot: DOT_RED,
      label: '取消申请待审',
      hint: cancelSample
        ? `${cancelSample.petName ?? '宠物'} · ${hhmm(cancelSample.scheduledStart)} ${cancelSample.serviceName ?? ''}`
        : '客户申请取消，待审批',
      count: stats?.todo.cancelRequested ?? 0,
      to: '/appointments?status=cancel_requested&from=todo',
    },
    {
      key: 'unpaid',
      dot: DOT_LEMON,
      label: '待收款',
      hint: unpaidSample
        ? `${unpaidSample.petName ?? '宠物'} ${unpaidSample.serviceName ?? ''} ¥${fenToYuanGrouped(unpaidSample.priceFen)}`
        : '服务已完成，未登记收款',
      count: stats?.todo.unpaid ?? 0,
      // 批次 M1 联动（任务书 §1.5.1）：待收款 → 收银台并自动拉入该预约；
      // 无样例时落收银台主屏（原 /finance#pending-payments 落点退役为收银链路）
      to: unpaidSample ? `/cashier?pull=${unpaidSample.id}` : '/cashier',
    },
    {
      key: 'overdue',
      dot: DOT_RED,
      label: '超期寄养',
      hint: overdueSample ? overdueHint(overdueSample, nowTs) : '超过预计退房时间仍在店',
      count: stats?.overdueBoardingCount ?? 0,
      to: '/boarding',
    },
    {
      key: 'pending',
      dot: DOT_MINT,
      label: '历史待确认单',
      hint: '自动接单已启用 · 仅旧单与改期回退单在此',
      count: stats?.todo.pending ?? 0,
      to: '/appointments?status=pending&from=todo',
    },
  ]

  return (
    <section className="u3-panel">
      <div className="u3-panel-head">
        <h3>待办</h3>
        <span className="aside">{rows.length} 项</span>
      </div>
      <div>
        {rows.map((r) => (
          <button key={r.key} type="button" className="u3-todo" onClick={() => navigate(r.to)}>
            <i className="dot" style={{ background: r.dot }} />
            <span className="tx">
              {r.label}
              <small>{r.hint}</small>
            </span>
            <span className="n">{r.count}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
