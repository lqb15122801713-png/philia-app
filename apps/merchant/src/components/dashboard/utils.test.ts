import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTodoAlertRows,
  todoAlertCountedTotal,
  todoGrandTotal,
  type DashboardStats,
} from './utils'

const stats: DashboardStats = {
  date: new Date('2026-10-21T00:00:00+08:00'),
  todayTender: {
    date: new Date('2026-10-21T00:00:00+08:00'),
    tender: {
      cashFen: 0,
      wechatFen: 0,
      alipayFen: 0,
      passFen: 0,
      storedValueFen: 0,
      rebateFen: 0,
    },
    receivedTotalFen: 0,
    referenceTotalFen: 0,
    legacyPayAtStoreFen: 0,
    counts: { cashierPaidCount: 0, appointmentPaidCount: 0, paidCount: 0 },
  },
  todayCount: 0,
  byStatus: {
    pending: 0,
    confirmed: 0,
    in_service: 0,
    in_boarding: 0,
    completed: 0,
    cancel_requested: 0,
    cancelled: 0,
  },
  inServiceCount: 0,
  todayRevenueFen: 0,
  todo: { pending: 0, unassigned: 0, cancelRequested: 0, unpaid: 0, total: 82 },
  overdueBoardingCount: 3,
}

test('PD-56 晨报待办与待办 KPI 同口径，超期寄养单列不双计', () => {
  assert.equal(todoGrandTotal(stats), 82)
})

test('PD-61 首页顶部待办行与待办合计同源同构：超期寄养≠0 单列不双计，计入合计之和=todo.total', () => {
  /* 构造超期寄养≠0（3）、独立域≠0（退款1/工单1/发票2/申诉4）、待派单≠0（5）的种子：
     todo.total = pending3 + unassigned5 + cancelRequested0 + unpaid74 = 82 */
  const seeded: DashboardStats = {
    ...stats,
    todo: { pending: 3, unassigned: 5, cancelRequested: 0, unpaid: 74, total: 82 },
    overdueBoardingCount: 3,
  }
  const rows = buildTodoAlertRows(seeded, { refund: 1, ticket: 1, invoice: 2, phoneAppeal: 4 })

  /* 计入待办合计的行与 todo 字段一一对应（不多不少，无缺无混） */
  assert.deepEqual(
    rows
      .filter((r) => r.countsTowardTodoTotal)
      .map((r) => r.key)
      .sort(),
    ['cancelRequested', 'pending', 'unassigned', 'unpaid'],
  )
  /* 五行（含单列/独立域全部行）计入合计之和 = todo.total = 晨报待办合计 */
  assert.equal(todoAlertCountedTotal(rows), seeded.todo.total)
  assert.equal(todoAlertCountedTotal(rows), todoGrandTotal(seeded))
  /* 超期寄养行单列显示（在列、计数 3）但不计入待办合计——不双计（合计为 82 而非 85） */
  const overdue = rows.find((r) => r.key === 'overdue')
  assert.equal(overdue?.count, 3)
  assert.equal(overdue?.countsTowardTodoTotal, false)
  assert.notEqual(todoAlertCountedTotal(rows), seeded.todo.total + 3)
  /* 退款/工单/发票/申诉独立域行不混入待办合计 */
  for (const key of ['refund', 'ticket', 'invoice', 'phoneAppeal'] as const) {
    assert.equal(rows.find((r) => r.key === key)?.countsTowardTodoTotal, false, key)
  }
})

test('PD-69 附加行与计入合计四件口径分离：六行朴素和 88 的差额全部来自不计入行', () => {
  /* 缺陷种子形：todo 四件合计 83（cancel2+unassigned5+unpaid74+pending2），
     附加行退款2＋超期3＝5；六行（count>0）朴素和=88≠todo.total 83 */
  const seeded: DashboardStats = {
    ...stats,
    todo: { pending: 2, unassigned: 5, cancelRequested: 2, unpaid: 74, total: 83 },
    overdueBoardingCount: 3,
  }
  const rows = buildTodoAlertRows(seeded, { refund: 2, ticket: 0, invoice: 0, phoneAppeal: 0 })
  const visible = rows.filter((r) => r.count > 0)
  assert.equal(visible.length, 6)
  const naiveSum = visible.reduce((n, r) => n + r.count, 0)
  assert.equal(naiveSum, 88)
  /* PD-61 回归：计入合计之和＝todo.total＝晨报待办合计，不被本修改坏 */
  assert.equal(todoAlertCountedTotal(rows), 83)
  assert.equal(todoAlertCountedTotal(rows), todoGrandTotal(seeded))
  /* 朴素和与待办合计的差额＝附加行（countsTowardTodoTotal=false）之和——
     渲染层据此给附加行挂「不计入待办合计」行内注记（DashboardPage/C-69） */
  const extraSum = visible.filter((r) => !r.countsTowardTodoTotal).reduce((n, r) => n + r.count, 0)
  assert.equal(extraSum, 5)
  assert.equal(naiveSum - todoAlertCountedTotal(rows), extraSum)
  /* 附加行键集钉死（本种子下工单/发票/申诉为 0 不显行，附加行=超期单列＋退款独立域） */
  assert.deepEqual(
    visible
      .filter((r) => !r.countsTowardTodoTotal)
      .map((r) => r.key)
      .sort(),
    ['overdue', 'refund'],
  )
})
