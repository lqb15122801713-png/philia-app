import test from 'node:test'
import assert from 'node:assert/strict'
import { canMerchantCancel, canVoidCheckin } from './appointmentDetail.utils'

test('PD-66 撤核销入口：in_service 夹具可见，其余状态不可见', () => {
  // 构造 in_service 夹具 → 断言入口可见
  assert.equal(canVoidCheckin('in_service'), true)
  // 其余状态：无入口（in_boarding 寄养另案）
  for (const s of ['pending', 'confirmed', 'in_boarding', 'completed', 'cancel_requested', 'cancelled']) {
    assert.equal(canVoidCheckin(s), false, s)
  }
})

test('PD-79 撤核销/撤单入口：in_service 且未涉钱可见；已收银（paidAt）双入口同隐', () => {
  const paid = new Date('2026-10-22T10:00:00+08:00')
  // 未收银 in_service：双入口可见
  assert.equal(canVoidCheckin('in_service', null), true)
  assert.equal(canMerchantCancel('in_service', null), true)
  // 已收银 in_service：涉钱另闸，双入口同隐（服务端 assertNoMoneyInvolved 硬闸兜底）
  assert.equal(canVoidCheckin('in_service', paid), false)
  assert.equal(canMerchantCancel('in_service', paid), false)
  // 其余状态：撤单无入口（含 confirmed——确认态单走改期/客户取消审核缝，本令不扩）
  for (const s of ['pending', 'confirmed', 'in_boarding', 'completed', 'cancel_requested', 'cancelled']) {
    assert.equal(canMerchantCancel(s), false, s)
    assert.equal(canMerchantCancel(s, paid), false, `${s} paid`)
  }
})
