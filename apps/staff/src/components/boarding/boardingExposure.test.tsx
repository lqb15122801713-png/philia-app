import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BoardingPetCard from './BoardingPetCard'
import StayInfoCard from './StayInfoCard'
import type { BoardingStayRow } from './types'

const stay: BoardingStayRow = {
  id: 'stay-pd95',
  appointmentId: 'appointment-pd95',
  roomNo: null,
  checkinWeightKg: 6.4,
  belongings: [{ name: '食盆', note: '家用蓝色食盆' }],
  checkoutAt: null,
}

function renderPetCard(avatarUrl: string | null) {
  return renderToStaticMarkup(createElement(BoardingPetCard, {
    pet: { name: '豆豆', breed: '比熊', weightKg: 6.4, avatarUrl },
    roomLabel: '标准间寄养',
    scheduledStart: new Date('2026-10-25T09:00:00+08:00'),
    scheduledEnd: new Date('2026-10-27T18:00:00+08:00'),
    overdue: false,
  }))
}

test('PD-95：无宠物照片时使用紧凑档案布局，不渲染待换假照片框', () => {
  const html = renderPetCard(null)

  assert.equal(html.includes('待换'), false)
  assert.match(html, /data-testid="boarding-pet-compact"/)
  assert.equal(html.includes('aspect-[16/10]'), false)
  assert.match(html, /豆豆/)
  assert.match(html, /在店寄养 · 标准间寄养/)
})

test('PD-95：已有宠物照片仍渲染真实头像与 16:10 照片框', () => {
  const html = renderPetCard('/api/img/pets/doudou.jpg')

  assert.match(html, /<img src="\/api\/img\/pets\/doudou\.jpg" alt="豆豆"/)
  assert.match(html, /aspect-\[16\/10\]/)
  assert.equal(html.includes('boarding-pet-compact'), false)
  assert.equal(html.includes('待换'), false)
})

test('PD-95：在住房间未登记时提供登记入口，不显示待分配', () => {
  const html = renderToStaticMarkup(createElement(StayInfoCard, {
    stay,
    onEdit: () => {},
  }))

  assert.equal(html.includes('待分配'), false)
  assert.match(html, /data-testid="boarding-room-register"/)
  assert.match(html, />登记房间</)
})

test('PD-95：只读历史单保留未登记事实，不显示待分配或伪造编辑入口', () => {
  const html = renderToStaticMarkup(createElement(StayInfoCard, {
    stay: { ...stay, checkoutAt: new Date('2026-10-27T10:00:00.000Z') },
  }))

  assert.equal(html.includes('待分配'), false)
  assert.match(html, /未登记/)
  assert.equal(html.includes('boarding-room-register'), false)
})

test('PD-95：已登记房间继续显示原房号', () => {
  const html = renderToStaticMarkup(createElement(StayInfoCard, {
    stay: { ...stay, roomNo: 'A-03' },
    onEdit: () => {},
  }))

  assert.match(html, /A-03/)
  assert.equal(html.includes('boarding-room-register'), false)
})
