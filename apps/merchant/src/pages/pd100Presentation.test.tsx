import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PhiliaClientContext, setCopyOverrides, type PhiliaClient } from '@philia/shared'
import React, { type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import MerchantEventsProvider from '../components/dashboard/MerchantEventsProvider'
import OrderRow from '../components/mall-admin/OrderCard'
import type { StoreOrder } from '../components/mall-admin/format'
import MonitorHubPage from './MonitorHubPage'
import OrdersPage from './OrdersPage'
import SlotPortPage, { SlotPortBody } from './SlotPortPage'
import CopyConfigPage, { CopyConfigBody } from './CopyConfigPage'
import MatrixPage from './MatrixPage'

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

test('PD-100 旧覆盖不得复活订单读口待补脚注', () => {
  setCopyOverrides([
    { key: 'order.rebatePendingNote', text: '回馈金列读口待补——订单域未透出回馈金字段，待 server 开口' },
  ])
  const html = renderPage(<OrdersPage />)
  assert.doesNotMatch(html, /orders-rebate-note|读口待补/)
})

test('PD-100 YKNXD2 专帧只读章与加深禁点同屏', () => {
  const order = {
    id: 'pd100-dead',
    orderNo: 'P261022YKNXD2',
    customerNickname: '合成客户',
    createdAt: new Date('2026-10-22T05:30:00Z'),
    items: [{ product_id: 'pd100-product', name: '合成玩具', quantity: 1, price_fen: 1900 }],
    totalFen: 1900,
    rebateFen: 0,
    status: 'paid',
  } as StoreOrder
  const html = renderToStaticMarkup(
    <table>
      <tbody>
        <OrderRow order={order} readOnly />
      </tbody>
    </table>,
  )
  assert.match(html, /P261022YKNXD2/)
  assert.match(html, /dead-order-readonly-pd100-dead/)
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2)
  assert.doesNotMatch(html, /发货 ›|退款 ›|disabled:opacity-35/)
  assert.match(html, /disabled:opacity-100/)
  assert.match(html, /line-through/)
})

test('PD-100 旧覆盖下双端口页题仍显示人话', () => {
  setCopyOverrides([
    { key: 'copyport.pageTitle', text: '文案端口' },
    { key: 'slotport.pageTitle', text: '槽位端口' },
  ])
  const copyQuery = newQueryClient()
  copyQuery.setQueryData(['auth', 'me'], {
    id: 'pd100-owner',
    nickname: '店主',
    roles: ['merchant_owner'],
    storeId: 'pd100-store',
  })
  const slotQuery = newQueryClient()
  slotQuery.setQueryData(['auth', 'me'], {
    id: 'pd100-owner',
    nickname: '店主',
    roles: ['merchant_owner'],
    storeId: 'pd100-store',
  })
  const copyHtml = renderPage(<CopyConfigPage />, copyQuery)
  const slotHtml = renderPage(<SlotPortPage />, slotQuery)
  assert.match(copyHtml, />界面文案</)
  assert.match(slotHtml, />展示素材</)
})

test('PD-100 矩阵不暴露端口工程列与源码脚注', () => {
  setCopyOverrides([
    { key: 'mtx.colCopy', text: '文案端口' },
    { key: 'mtx.colSlots', text: '槽位' },
  ])
  const html = renderPage(<MatrixPage />)
  assert.match(html, /界面文案/)
  assert.match(html, /展示素材/)
  assert.doesNotMatch(html, /lib\/roles\.ts/)
})
