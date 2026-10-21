import test from 'node:test'
import assert from 'node:assert/strict'
import { canVoidCheckin } from './appointmentDetail.utils'

test('PD-66 撤核销入口：in_service 夹具可见，其余状态不可见', () => {
  // 构造 in_service 夹具 → 断言入口可见
  assert.equal(canVoidCheckin('in_service'), true)
  // 其余状态：无入口（in_boarding 寄养另案）
  for (const s of ['pending', 'confirmed', 'in_boarding', 'completed', 'cancel_requested', 'cancelled']) {
    assert.equal(canVoidCheckin(s), false, s)
  }
})
