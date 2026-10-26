import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PhiliaClientContext, setCopyOverrides, type PhiliaClient } from '@philia/shared'
import React, { type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import MerchantEventsProvider from '../components/dashboard/MerchantEventsProvider'
import MonitorHubPage from './MonitorHubPage'
import OrdersPage from './OrdersPage'
import { SlotPortBody } from './SlotPortPage'
import { CopyConfigBody } from './CopyConfigPage'

Object.assign(globalThis, { React })

afterEach(() => setCopyOverrides([]))

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderPage(ui: ReactNode, queryClient = newQueryClient()) {
  const client: PhiliaClient = {
    trpc: {} as PhiliaClient['trpc'],
    queryClient,
  }
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalConsoleError = console.error
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => 'pd100-test-client',
        setItem: () => undefined,
      },
    },
  })
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('Warning: useLayoutEffect does nothing on the server')) return
    originalConsoleError(...args)
  }
  try {
    return renderToStaticMarkup(
      <MemoryRouter>
        <PhiliaClientContext.Provider value={client}>
          <QueryClientProvider client={queryClient}>
            <MerchantEventsProvider>{ui}</MerchantEventsProvider>
          </QueryClientProvider>
        </PhiliaClientContext.Provider>
      </MemoryRouter>,
    )
  } finally {
    console.error = originalConsoleError
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
}

function seedPartialMonitor(queryClient: QueryClient) {
  const scheduledStart = new Date()
  const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000)
  queryClient.setQueryData(['appointment', 'listForStore', 'monitor', 'in_service'], [
    {
      id: 'pd100-live',
      status: 'in_service',
      type: 'grooming',
      scheduledStart,
      scheduledEnd,
      checkedInAt: scheduledStart,
      petName: '旺财',
      serviceName: '基础洗护',
      staffName: '小周',
    },
  ])
  queryClient.setQueryData(['boarding', 'stayBoard'], { board: [] })
}

test('PD-100 监控部分查询等待时已到达卡片不消失', () => {
  const queryClient = newQueryClient()
  seedPartialMonitor(queryClient)
  const html = renderPage(<MonitorHubPage />, queryClient)
  assert.match(html, /data-testid="monitor-card-pd100-live"/)
  assert.match(html, /部分监控仍在读取/)
  assert.doesNotMatch(html, /animate-pulse/)
})

test('PD-100 监控全等待显示可读状态而非整页骨架', () => {
  const html = renderPage(<MonitorHubPage />)
  assert.match(html, /正在读取在店情况/)
  assert.doesNotMatch(html, /animate-pulse/)
})

test('PD-100 展示素材等待显示真实状态而非灰骨架', () => {
  const html = renderPage(<SlotPortBody />)
  assert.match(html, /正在读取展示素材/)
  assert.doesNotMatch(html, /animate-pulse/)
})

test('PD-100 界面文案等待显示真实状态而非灰骨架', () => {
  const html = renderPage(<CopyConfigBody />)
  assert.match(html, /正在读取界面文案/)
  assert.doesNotMatch(html, /animate-pulse/)
})

test('PD-100 商城订单等待显示真实状态而非灰骨架', () => {
  const html = renderPage(<OrdersPage />)
  assert.match(html, /正在读取商城订单/)
  assert.doesNotMatch(html, /animate-pulse/)
})
