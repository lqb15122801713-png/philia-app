import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { StaticRouter } from 'react-router-dom/server'
import { createPhiliaClient, PhiliaClientContext } from '@philia/shared'
import NotifyCenterPage from './NotifyCenterPage'

const testWindow = {
  location: new URL('http://test.local/notifications?canvasStore=store-1'),
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}
Object.defineProperty(globalThis, 'window', { value: testWindow, configurable: true, writable: true })
Object.defineProperty(globalThis, 'React', { value: React, configurable: true, writable: true })

function notification(id: string, title: string, body: string) {
  return {
    id,
    type: 'service',
    category: 'service',
    title,
    body,
    link: null,
    readAt: null,
    createdAt: new Date('2026-10-27T08:00:00+08:00'),
  }
}

test('PD-107：消息中心历史服务通知去 QA 夹具名并保留服务进度', () => {
  const path = '/notifications?canvasStore=store-1'
  const client = createPhiliaClient('http://127.0.0.1:9')
  const items = [
    notification('rescheduled', '预约改期成功', '【QA夹具豆豆】的基础洗护已改至明日 14:00。'),
    notification('assigned', 'QA夹具豆豆派单成功', '店员已为【QA夹具豆豆】派单，服务前会再次确认。'),
    notification('checked-in', '到店签到成功', '【QA夹具豆豆】已到店签到，服务即将开始。'),
  ]
  client.queryClient.setQueryData(['auth', 'me'], { id: 'customer-1', nickname: '客户', roles: ['customer'] })
  client.queryClient.setQueryData(['push', 'listNotifications', 'all'], {
    pages: [{ items, nextCursor: null }],
    pageParams: [undefined],
  })
  client.queryClient.setQueryData(['push', 'unreadCount'], { total: 3 })
  client.queryClient.setQueryData(['canvas', 'blocks'], { items: [] })
  client.queryClient.setQueryData(['canvas', 'liveLayout', 'notifications', 'store-1'], { blocks: [] })

  const html = renderToStaticMarkup(
    <PhiliaClientContext.Provider value={client}>
      <QueryClientProvider client={client.queryClient}>
        <StaticRouter location={path}><NotifyCenterPage /></StaticRouter>
      </QueryClientProvider>
    </PhiliaClientContext.Provider>,
  )

  assert.match(html, /data-testid="notify-center-page"/)
  assert.match(html, /豆豆的基础洗护已改至明日 14:00。/)
  assert.match(html, /豆豆派单成功/)
  assert.match(html, /店员已为豆豆派单，服务前会再次确认。/)
  assert.match(html, /豆豆已到店签到，服务即将开始。/)
  assert.doesNotMatch(html, /QA夹具/)
})
