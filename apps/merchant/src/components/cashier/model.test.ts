import assert from 'node:assert/strict'
import test from 'node:test'

const model = (await import('./model')) as unknown as {
  shiftCrossDays?: (openedAt: Date | string, now: Date) => number
  hasDisplayFixtureMarker?: (...values: Array<string | null | undefined>) => boolean
  hasBillDisplayFixtureMarker?: (bill: {
    billNo?: string | null
    buyerName?: string | null
    note?: string | null
    summary?: string | null
  }) => boolean
}

test('PD-74 跨日班次按门店自然日计，不按 24 小时时长自动日切', () => {
  assert.equal(typeof model.shiftCrossDays, 'function')
  const shiftCrossDays = model.shiftCrossDays!
  const now = new Date('2026-10-22T00:01:00+08:00')
  assert.equal(shiftCrossDays(new Date('2026-10-21T23:59:00+08:00'), now), 1)
  assert.equal(shiftCrossDays(new Date('2026-10-22T00:00:00+08:00'), now), 0)
  assert.equal(shiftCrossDays('2026-10-19T12:00:00+08:00', now), 3)
  assert.equal(shiftCrossDays('2026-10-23T00:00:00+08:00', now), 0)
})

test('PD-74 经营面仅隐藏明确测试标记，不误伤正常收银单', () => {
  assert.equal(typeof model.hasDisplayFixtureMarker, 'function')
  const hasDisplayFixtureMarker = model.hasDisplayFixtureMarker!
  assert.equal(hasDisplayFixtureMarker('INJECT-门店-A'), true)
  assert.equal(hasDisplayFixtureMarker('INJECT_门店_A'), true)
  assert.equal(hasDisplayFixtureMarker('INJECT'), true)
  assert.equal(hasDisplayFixtureMarker('QA-挂单-01'), true)
  assert.equal(hasDisplayFixtureMarker('QA_挂单_01'), true)
  assert.equal(hasDisplayFixtureMarker('QA夹具'), true)
  assert.equal(hasDisplayFixtureMarker('常规挂单', '测试件勿动'), true)
  assert.equal(hasDisplayFixtureMarker('请忽略这条经营记录'), true)
  assert.equal(hasDisplayFixtureMarker('洗护服务', 'HD-20261022-001'), false)
  assert.equal(hasDisplayFixtureMarker('QAB123'), false)
  assert.equal(hasDisplayFixtureMarker('qa'), false)
})

test('PD-74 流水内容摘要命中测试标记也隐藏，买家叫 qa 不误伤', () => {
  assert.equal(typeof model.hasBillDisplayFixtureMarker, 'function')
  const hasBillDisplayFixtureMarker = model.hasBillDisplayFixtureMarker!
  assert.equal(hasBillDisplayFixtureMarker({ billNo: 'HD-001', summary: 'QA-洗护服务' }), true)
  assert.equal(hasBillDisplayFixtureMarker({ billNo: 'HD-002', summary: 'INJECT_测试商品' }), true)
  assert.equal(hasBillDisplayFixtureMarker({ billNo: 'HD-003', summary: '测试件勿动' }), true)
  assert.equal(hasBillDisplayFixtureMarker({ billNo: 'HD-004', buyerName: 'qa', summary: '基础洗护' }), false)
})
