import assert from 'node:assert/strict'
import test from 'node:test'

const format = (await import('./format')) as unknown as {
  isDeadOrderDisplayHidden?: (order: { id?: string | null; orderNo?: string | null }) => boolean
}

test('PD-81 死单显示层隐藏：名单单号／ULID 前缀命中即隐', () => {
  assert.equal(typeof format.isDeadOrderDisplayHidden, 'function')
  const hide = format.isDeadOrderDisplayHidden!
  assert.equal(hide({ id: '01M5H1E1XXXXXXXXXXXXXXXXXX', orderNo: 'P261022YKNXD2' }), true)
  assert.equal(hide({ orderNo: 'P261022YKNXD2' }), true)
  assert.equal(hide({ id: '01M5H1E1ABC' }), true)
})

test('PD-81 死单隐藏不误伤正常商城订单', () => {
  const hide = format.isDeadOrderDisplayHidden!
  assert.equal(hide({ id: '01M5H1E2XYZ000000000000000', orderNo: 'P261022D443WD' }), false)
  assert.equal(hide({ id: '01M5GQQH7EA0CDW3Z5W0MAH99Z', orderNo: 'P2610223GZ7SV' }), false)
  assert.equal(hide({}), false)
})
