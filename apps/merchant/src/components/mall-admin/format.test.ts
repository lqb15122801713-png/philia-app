import assert from 'node:assert/strict'
import test from 'node:test'

const format = (await import('./format')) as unknown as {
  isDeadOrderReadOnly?: (order: { id?: string | null; orderNo?: string | null }) => boolean
}

test('PD-93 死单按单号／ULID 前缀进入只读态', () => {
  assert.equal(typeof format.isDeadOrderReadOnly, 'function')
  const readOnly = format.isDeadOrderReadOnly!
  assert.equal(readOnly({ id: '01M5H1E1XXXXXXXXXXXXXXXXXX', orderNo: 'P261022YKNXD2' }), true)
  assert.equal(readOnly({ orderNo: 'P261022YKNXD2' }), true)
  assert.equal(readOnly({ id: '01M5H1E1ABC' }), true)
})

test('PD-93 死单只读不误伤正常商城订单', () => {
  const readOnly = format.isDeadOrderReadOnly!
  assert.equal(readOnly({ id: '01M5H1E2XYZ000000000000000', orderNo: 'P261022D443WD' }), false)
  assert.equal(readOnly({ id: '01M5GQQH7EA0CDW3Z5W0MAH99Z', orderNo: 'P2610223GZ7SV' }), false)
  assert.equal(readOnly({}), false)
})
