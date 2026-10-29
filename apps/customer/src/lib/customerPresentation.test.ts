import assert from 'node:assert/strict'
import test from 'node:test'
import { customerPetName } from './customerPresentation'

test('PD-109：客读宠名去除裸前缀与括号夹具前缀', () => {
  assert.equal(customerPetName('  QA夹具豆豆  '), '豆豆')
  assert.equal(customerPetName('【QA夹具豆豆】'), '豆豆')
})

test('PD-109：普通宠名原样保留', () => {
  assert.equal(customerPetName('  豆豆  '), '豆豆')
})

test('PD-109：空宠名使用客读回退', () => {
  assert.equal(customerPetName('   '), '爱宠')
  assert.equal(customerPetName(null, '毛孩子'), '毛孩子')
  assert.equal(customerPetName(undefined), '爱宠')
})
