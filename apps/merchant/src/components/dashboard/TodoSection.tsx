/**
 * 待办队列（U3 §2 右栏 · 母本 .todo-row 四行）：
 * 取消申请待审（红点）/ 待收款（柠檬点）/ 超期寄养（红点）/ 历史待确认（薄荷点）；
 * 批次 R13b 追加第五行「换绑申诉」（红点，仅 manager|owner 传入 appealCount 时渲染，
 * 点击页内锚到 #phone-appeals 待办块，不走路由）。
 *
 * - 计数 = dashboardStats.todo.cancelRequested / todo.unpaid / overdueBoardingCount /
 *   todo.pending（批次 S4：新单免确认，pending 仅计历史单与改期回退单）；
 * - 行点击进入对应筛选态：预约页 ?status= 深链 + from=todo 放开日期档（v1.1-b2 B2-1），
 *   待收款 → /finance#pending-payments 锚点，超期寄养 → /boarding；
 * - 小字给一条真实样例：取消/待收款取今日 listForStore 首条命中单，超期寄养取在店
 *   in_boarding 首条应退未退单；今日无样例时回退事由说明；
 * - 数量为 0 行保留（信息密度与位置稳定），计数 Montserrat tabular 由 u3-todo .n 承担。
 */

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { dc } from '@/copy/dashboard'
import { fenToYuanGrouped, hhmm, type DashboardStats, type TodayApptItem } from './utils'

/* 样例小字里的数据位（时间/金额/天数）：mono 轨 tabular（§八 mono 数据位加重） */
const HINT_NUM_CLS = 'font-number tabular-nums'

const DOT_RED = '#B4502E' // 警示=赭红（纯红换赭 §1.4）
const DOT_LEMON = '#F2DFA6' // 淡金点睛（柠檬黄清场，常量名沿用防扩散改）
const DOT_MINT = '#2E2318' // 服务中=livetag 同族深棕（薄荷绿清场）

interface TodoRowSpec {
  key: string
  dot: string
  label: string
  hint: ReactNode
  count: number
  to: string
}

/** 超期样例小字：应退未退 N 天（不足一天算「今日到期未退」） */
function overdueHint(item: TodayApptItem, nowTs: number): ReactNode {
  const days = Math.floor((nowTs - item.scheduledEnd.getTime()) / 86_400_000)
  return (
    <>
      {item.petName ?? '宠物'} · {item.serviceName ?? '寄养'} ·{' '}
      {days >= 1 ? (
        <>
          {dc('dash.todoOverdueLead')} <span className={HINT_NUM_CLS}>{days}</span> {dc('dash.todoOverdueUnit')}
        </>
      ) : (
        dc('dash.todoOverdueToday')
      )}
    </>
  )
}

export default function TodoSection({
  stats,
  todayItems,
  boardingItems,
  now,
  appealCount,
}: {
  stats: DashboardStats | undefined
  todayItems: TodayApptItem[] | undefined
  boardingItems: TodayApptItem[] | undefined
  /** 页面层传入的当前时间（react-hooks/purity：组件内不调 Date.now） */
  now: Date
  /** 换绑申诉在途计数（批次 R13b；manager|owner 由页面层传入，clerk/undefined=不加行——待办块同闸不渲染） */
  appealCount?: number
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
      label: dc('dash.todoCancelLabel'),
      hint: cancelSample ? (
        <>
          {cancelSample.petName ?? '宠物'} ·{' '}
          <span className={HINT_NUM_CLS}>{hhmm(cancelSample.scheduledStart)}</span>{' '}
          {cancelSample.serviceName ?? ''}
        </>
      ) : (
        dc('dash.todoCancelHint')
      ),
      count: stats?.todo.cancelRequested ?? 0,
      to: '/appointments?status=cancel_requested&from=todo',
    },
    {
      key: 'unpaid',
      dot: DOT_LEMON,
      label: dc('dash.todoUnpaidLabel'),
      hint: unpaidSample ? (
        <>
          {unpaidSample.petName ?? '宠物'} {unpaidSample.serviceName ?? ''}{' '}
          <span className={HINT_NUM_CLS}>¥{fenToYuanGrouped(unpaidSample.priceFen)}</span>
        </>
      ) : (
        dc('dash.todoUnpaidHint')
      ),
      count: stats?.todo.unpaid ?? 0,
      // 批次 M1 联动（任务书 §1.5.1）：待收款 → 收银台并自动拉入该预约；
      // 无样例时落收银台主屏（原 /finance#pending-payments 落点退役为收银链路）
      to: unpaidSample ? `/cashier?pull=${unpaidSample.id}` : '/cashier',
    },
    {
      key: 'overdue',
      dot: DOT_RED,
      label: dc('dash.todoOverdueLabel'),
      hint: overdueSample ? overdueHint(overdueSample, nowTs) : dc('dash.todoOverdueHint'),
      count: stats?.overdueBoardingCount ?? 0,
      to: '/boarding',
    },
    {
      key: 'pending',
      dot: DOT_MINT,
      label: dc('dash.todoPendingLabel'),
      hint: dc('dash.todoPendingHint'),
      count: stats?.todo.pending ?? 0,
      to: '/appointments?status=pending&from=todo',
    },
  ]

  // 批次 R13b：换绑申诉计数行（manager|owner；点击锚到本页 #phone-appeals 待办块）
  if (appealCount !== undefined) {
    rows.push({
      key: 'phoneAppeal',
      dot: DOT_RED,
      label: dc('dash.todoAppealLabel'),
      hint: dc('dash.todoAppealHint'),
      count: appealCount,
      to: '#phone-appeals',
    })
  }

  /** 行点击：# 开头=页内锚点滚动（待办块），否则路由跳转 */
  const onRowClick = (to: string) => {
    if (to.startsWith('#')) {
      document.getElementById(to.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    navigate(to)
  }

  return (
    <section className="u3-panel">
      <div className="u3-panel-head">
        <h3>{dc('dash.todoTitle')}</h3>
        <span className="aside">
          <span className={HINT_NUM_CLS}>{rows.length}</span> 项
        </span>
      </div>
      <div>
        {rows.map((r) => (
          <button key={r.key} type="button" className="u3-todo" onClick={() => onRowClick(r.to)}>
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
