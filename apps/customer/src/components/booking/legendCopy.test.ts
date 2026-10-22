import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SlotPicker from './SlotPicker'
import TimeGridBlock from './single/TimeGridBlock'
import type { StoreWithHours } from './types'

const staleLegend = ['灰色为已约满或', '1 小时内的临近时段'].join(' ')
const currentLegend = ['灰 = 已满或', '1 小时内临近'].join(' ')

test('PD-67：预约时段图例只保留一处现行口径', () => {
  const store = { openHours: {} } as StoreWithHours
  const gridDate = new Date(Date.now() + 2 * 60 * 60_000)
  const legacyHtml = renderToStaticMarkup(createElement(SlotPicker, {
    store,
    slots: [],
    selected: null,
    onSelect: () => {},
  }))
  const currentHtml = renderToStaticMarkup(createElement(TimeGridBlock, {
    day: { date: gridDate, grid: [gridDate], closed: false, hasAvailable: false },
    slots: [],
    selected: null,
    onSelect: () => {},
  }))
  const html = legacyHtml + currentHtml

  assert.equal(html.includes(staleLegend), false, '旧向导不得渲染残留旧图例')
  assert.equal(html.split(currentLegend).length - 1, 1, '现行图例只能由新单屏组件渲染一处')
})
