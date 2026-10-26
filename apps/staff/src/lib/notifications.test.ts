import assert from 'node:assert/strict'
import test from 'node:test'

async function loadGrouping() {
  try {
    return await import('./notifications')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
      return { groupDuplicateNotifications: undefined }
    }
    throw error
  }
}

type Fixture = {
  id: string
  type: string
  category: string
  title: string
  body: string
  link: string | null
  readAt: Date | null
  createdAt: Date
}

function row(id: string, createdAt: string, overrides: Partial<Fixture> = {}): Fixture {
  return {
    id,
    type: 'boarding.careRemind',
    category: 'service',
    title: '照护打卡提醒',
    body: '【旺财】在住寄养已超过 4 小时未打卡，请及时完成照护记录',
    link: '/boarding/stay-1/checkin',
    readAt: null,
    createdAt: new Date(createdAt),
    ...overrides,
  }
}

test('PD-98：同类型同文同链接同秒的重复通知只展示一组且保留全部 ID', async () => {
  const { groupDuplicateNotifications } = await loadGrouping()
  assert.ok(groupDuplicateNotifications, '先提供真实的通知分组实现')
  const groups = groupDuplicateNotifications([
    row('care-1637-a', '2026-10-26T16:37:00.100+08:00'),
    row('care-1637-b', '2026-10-26T16:37:00.900+08:00'),
    row('care-1229-a', '2026-10-26T12:29:00.000+08:00'),
    row('care-1229-b', '2026-10-26T12:29:00.500+08:00'),
    row('care-0802', '2026-10-26T08:02:00.000+08:00'),
  ])

  assert.equal(groups.length, 3)
  assert.deepEqual(groups.map((group) => group.ids), [
    ['care-1637-a', 'care-1637-b'],
    ['care-1229-a', 'care-1229-b'],
    ['care-0802'],
  ])
})

test('PD-98：类型或链接不同的通知不被同文分组误合并', async () => {
  const { groupDuplicateNotifications } = await loadGrouping()
  assert.ok(groupDuplicateNotifications, '先提供真实的通知分组实现')
  const groups = groupDuplicateNotifications([
    row('care-a', '2026-10-26T16:37:00+08:00'),
    row('care-other-link', '2026-10-26T16:37:00+08:00', { link: '/boarding/stay-2/checkin' }),
    row('care-other-type', '2026-10-26T16:37:00+08:00', { type: 'boarding.other' }),
  ])

  assert.equal(groups.length, 3)
  assert.deepEqual(groups.map((group) => group.notification.id), ['care-a', 'care-other-link', 'care-other-type'])
})

test('PD-98：同组优先展示未读行且一次已读覆盖重复 ID', async () => {
  const { groupDuplicateNotifications } = await loadGrouping()
  assert.ok(groupDuplicateNotifications, '先提供真实的通知分组实现')
  const groups = groupDuplicateNotifications([
    row('care-read', '2026-10-26T16:37:00+08:00', { readAt: new Date('2026-10-26T17:00:00+08:00') }),
    row('care-unread', '2026-10-26T16:37:00+08:00'),
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.notification.id, 'care-unread')
  assert.deepEqual(groups[0]?.ids, ['care-read', 'care-unread'])
})
