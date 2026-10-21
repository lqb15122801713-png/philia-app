import assert from 'node:assert/strict'
import test from 'node:test'
import { todoGrandTotal, type DashboardStats } from './utils'

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
