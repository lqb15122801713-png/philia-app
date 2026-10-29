import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route, Routes } from 'react-router-dom'
import { StaticRouter } from 'react-router-dom/server'
import { createPhiliaClient, PhiliaClientContext, type PhiliaClient } from '@philia/shared'
import HomePage from './HomePage'
import MomentsPage from './MomentsPage'
import AppointmentsPage from './AppointmentsPage'
import AppointmentDetailPage from './AppointmentDetailPage'
import GroomingSinglePage from './GroomingSinglePage'
import BookingSuccessPage from './BookingSuccessPage'
import ActivePetSwitcher from '@/components/pets/ActivePetSwitcher'

const testWindow = {
  location: new URL('http://test.local/'),
  localStorage: {
    getItem: (key: string) => key === 'philia.sseClientId' ? 'test-client' : null,
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

function renderAt(path: string, element: React.ReactNode, seed: (queryClient: QueryClient) => void) {
  testWindow.location = new URL(path, 'http://test.local')
  const client = createPhiliaClient('http://127.0.0.1:9')
  seed(client.queryClient)
  return renderToStaticMarkup(
    <PhiliaClientContext.Provider value={client}>
      <QueryClientProvider client={client.queryClient}>
        <StaticRouter location={path}>{element}</StaticRouter>
      </QueryClientProvider>
    </PhiliaClientContext.Provider>,
  )
}

function album(appointmentId: string, petName: string, photoUrl: string) {
  return {
    appointmentId,
    petName,
    serviceName: '基础洗护（小型犬）',
    storeName: '菲丽亚宠物·示例店',
    completedAt: new Date('2026-10-22T10:00:00'),
    status: 'completed',
    steps: [
      {
        stepKey: 'before_after',
        status: 'done',
        photos: [{ url: photoUrl, thumbUrl: null, tag: 'after' }],
      },
    ],
  }
}

async function renderMoments(items: ReturnType<typeof album>[]) {
  testWindow.location = new URL('/philia/moments', 'http://test.local')
  const queryClient = new QueryClient()
  const client = {
    queryClient,
    trpc: {
      serviceLoop: { albumFeed: { query: async () => items } },
      canvas: {
        blocks: { query: async () => ({ items: [] }) },
        liveLayout: { query: async () => ({ blocks: [] }) },
      },
      store: { listNearby: { query: async () => ({ stores: [] }) } },
    } as unknown as PhiliaClient['trpc'],
  }
  queryClient.setQueryData(['canvas', 'blocks'], { items: [] })
  const ui = (
    <PhiliaClientContext.Provider value={client}>
      <QueryClientProvider client={queryClient}>
        <StaticRouter location="/philia/moments"><MomentsPage /></StaticRouter>
      </QueryClientProvider>
    </PhiliaClientContext.Provider>
  )
  renderToStaticMarkup(ui)
  const registered = queryClient.getQueryCache().find({ queryKey: ['philia', 'moments'], exact: true })
  if (!registered?.options.queryFn) throw new Error('MomentsPage queryFn was not registered')
  await queryClient.fetchQuery({ queryKey: ['philia', 'moments'], queryFn: registered.options.queryFn })
  return renderToStaticMarkup(ui)
}

function appointment(id: string, status = 'in_service') {
  const start = status === 'confirmed' ? '2026-10-30T14:00:00' : '2026-10-01T14:00:00'
  return {
    id,
    type: 'grooming',
    status,
    serviceName: '基础洗护（小型犬）',
    storeName: '菲丽亚宠物·示例店',
    petName: 'QA夹具豆豆',
    scheduledStart: new Date(start),
    scheduledEnd: new Date(status === 'confirmed' ? '2026-10-30T15:30:00' : '2026-10-01T15:30:00'),
    priceFen: 12800,
  }
}

function groups(key: string, items: ReturnType<typeof appointment>[]) {
  return {
    pending: [],
    confirmed: [],
    cancel_requested: [],
    in_service: [],
    in_boarding: [],
    completed: [],
    cancelled: [],
    [key]: items,
  }
}

test('PD-99：QA 夹具相册不成册，普通真实相册仍保留', async () => {
  const html = await renderMoments([
    album('qa-album', 'QA夹具豆豆', '/qa-blue-step.jpg'),
    album('real-album', '豆豆', '/real-service-after.jpg'),
  ])

  assert.match(html, /data-testid="album-card-real-album"/)
  assert.match(html, /src="\/real-service-after\.jpg"/)
  assert.doesNotMatch(html, /data-testid="album-card-qa-album"/)
  assert.doesNotMatch(html, /QA夹具豆豆|qa-blue-step\.jpg/)
})

test('PD-99：只有 QA 夹具相册时显示诚实空态而非蓝色步骤半壳', async () => {
  const html = await renderMoments([album('qa-only', 'QA夹具豆豆', '/qa-blue-step.jpg')])

  assert.doesNotMatch(html, /data-testid="album-feed"/)
  assert.doesNotMatch(html, /QA夹具豆豆|qa-blue-step\.jpg/)
  assert.match(html, /相册还是空的/)
})

test('PD-99：首页服务中条同源收敛 QA 夹具名', () => {
  const current = appointment('qa-home')
  const html = renderAt('/home', <HomePage />, (queryClient) => {
    queryClient.setQueryData(['auth', 'me'], { id: 'customer-1', nickname: '客户', roles: ['customer'] })
    queryClient.setQueryData(['appointment', 'listMine'], { groups: groups('in_service', [current]) })
    queryClient.setQueryData(['serviceStep', 'list', current.id], [
      { stepKey: 'disinfection', stepOrder: 1, status: 'active', photos: [] },
    ])
  })

  assert.match(html, /data-testid="home-service-progress"/)
  assert.match(html, /豆豆 · 基础洗护（小型犬）/)
  assert.doesNotMatch(html, /QA夹具豆豆/)
})

test('PD-99：预约列表同源收敛 QA 夹具名', () => {
  const current = appointment('qa-list', 'confirmed')
  const html = renderAt('/appointments?tab=confirmed', <AppointmentsPage />, (queryClient) => {
    queryClient.setQueryData(['appointment', 'listMine'], { groups: groups('confirmed', [current]) })
    queryClient.setQueryData(['canvas', 'blocks'], { items: [] })
  })

  assert.match(html, /豆豆/)
  assert.doesNotMatch(html, /QA夹具豆豆/)
})

test('PD-99：预约详情与取消入口同源收敛 QA 夹具名', () => {
  const current = appointment('qa-detail', 'confirmed')
  const detail = {
    appointment: {
      ...current,
      code: 'QA0001',
      customerId: 'customer-1',
      storeId: 'store-1',
      staffId: null,
      assignSource: null,
      petId: 'pet-1',
      serviceId: 'service-1',
      paymentMode: 'pay_at_store',
      paidAt: null,
      paidFen: null,
      note: null,
      cancelReason: null,
      cancelSource: null,
      emergencyContactJson: null,
      medicalAuthJson: null,
      walkTimesPerDay: null,
      checkedInAt: null,
      completedAt: null,
      rating: null,
      review: null,
      receptionistId: null,
      createdAt: new Date('2026-10-26T10:00:00'),
      updatedAt: new Date('2026-10-26T10:00:00'),
    },
    pet: { id: 'pet-1', name: 'QA夹具豆豆', avatarUrl: null },
    service: { id: 'service-1', name: '基础洗护（小型犬）' },
    store: { id: 'store-1', name: '菲丽亚宠物·示例店', address: '示例路 1 号', lat: null, lng: null, phone: null },
    steps: [],
    boardingStay: null,
    customer: { nickname: '客户', phoneTail: null },
    cashierBillId: null,
    addons: [],
    rescheduleLogs: [],
  }
  const html = renderAt(
    '/appointments/qa-detail',
    <Routes><Route path="/appointments/:id" element={<AppointmentDetailPage />} /></Routes>,
    (queryClient) => {
      queryClient.setQueryData(['appointment', 'get', 'qa-detail'], detail)
      queryClient.setQueryData(['canvas', 'blocks'], { items: [] })
    },
  )

  assert.match(html, /豆豆/)
  assert.doesNotMatch(html, /QA夹具豆豆/)
})

function completedAlbumDetail(id: string, petName: string) {
  const current = appointment(id, 'completed')
  return {
    appointment: {
      ...current,
      code: 'TEST01',
      customerId: 'customer-1',
      storeId: 'store-1',
      staffId: null,
      assignSource: null,
      petId: 'pet-1',
      serviceId: 'service-1',
      paymentMode: 'pay_at_store',
      paidAt: null,
      paidFen: null,
      note: null,
      cancelReason: null,
      cancelSource: null,
      emergencyContactJson: null,
      medicalAuthJson: null,
      walkTimesPerDay: null,
      checkedInAt: new Date('2026-10-22T09:00:00'),
      completedAt: new Date('2026-10-22T10:30:00'),
      rating: null,
      review: null,
      receptionistId: null,
      createdAt: new Date('2026-10-22T08:00:00'),
      updatedAt: new Date('2026-10-22T10:30:00'),
    },
    pet: { id: 'pet-1', name: petName, avatarUrl: null },
    service: { id: 'service-1', name: '基础洗护（小型犬）' },
    store: { id: 'store-1', name: '菲丽亚宠物·示例店', address: '示例路 1 号', lat: null, lng: null, phone: null },
    steps: [],
    boardingStay: null,
    customer: { nickname: '客户', phoneTail: null },
    cashierBillId: null,
    addons: [],
    rescheduleLogs: [],
  }
}

function renderCompletedAlbum(id: string, petName: string, photoUrl: string) {
  return renderAt(
    `/appointments/${id}`,
    <Routes><Route path="/appointments/:id" element={<AppointmentDetailPage />} /></Routes>,
    (queryClient) => {
      queryClient.setQueryData(['appointment', 'get', id], completedAlbumDetail(id, petName))
      queryClient.setQueryData(['appointment', 'serviceAlbum', id], {
        steps: [
          { stepKey: 'disinfection', stepName: '消毒工具确认', status: 'done', photos: [] },
          { stepKey: 'precheck', stepName: '预检', status: 'done', photos: [] },
          { stepKey: 'grooming', stepName: '洗护', status: 'done', photos: [] },
          { stepKey: 'detail', stepName: '精修', status: 'done', photos: [] },
          {
            stepKey: 'before_after',
            stepName: '交付检查',
            status: 'done',
            photos: [{ url: photoUrl, thumbUrl: null, tag: 'after' }],
          },
          { stepKey: 'confirm', stepName: '完成确认', status: 'done', photos: [] },
        ],
      })
      queryClient.setQueryData(['canvas', 'blocks'], { items: [] })
    },
  )
}

test('PD-99 BLOCK1：完成态详情 QA 相册显示诚实空态', () => {
  const html = renderCompletedAlbum('qa-complete', 'QA夹具豆豆', '/qa-blue-step.jpg')

  assert.match(html, /data-block-key="apptDetail.album"/)
  assert.match(html, /无需照片/)
  assert.doesNotMatch(html, /qa-blue-step\.jpg/)
})

test('PD-99 BLOCK1：完成态详情保留普通真实服务照片', () => {
  const html = renderCompletedAlbum('real-complete', '豆豆', '/real-service-after.jpg')

  assert.match(html, /data-block-key="apptDetail.album"/)
  assert.match(html, /src="\/real-service-after\.jpg"/)
})

const qaPets = [
  { id: 'pet-1', name: 'QA夹具豆豆', species: 'dog', breed: '比熊', weightKg: 8, avatarUrl: null, vaccineValidUntil: null },
  { id: 'pet-2', name: '团团', species: 'cat', breed: '英短', weightKg: 5, avatarUrl: null, vaccineValidUntil: null },
]

test('PD-109：默认洗护预约 pill 使用统一客读宠名', () => {
  const html = renderAt('/booking/grooming', <GroomingSinglePage />, (queryClient) => {
    queryClient.setQueryData(['auth', 'me'], { id: 'customer-1', nickname: '客户', roles: ['customer'] })
    queryClient.setQueryData(['store', 'listNearby'], { stores: [] })
    queryClient.setQueryData(['pet', 'list'], qaPets)
    queryClient.setQueryData(['canvas', 'blocks'], { items: [] })
  })

  assert.match(html, /data-testid="u2-chip-pet"[^>]*title="豆豆"/)
  assert.doesNotMatch(html, /QA夹具/)
})

test('PD-109：预约成功回显使用统一客读宠名', () => {
  const current = appointment('qa-success', 'confirmed')
  const detail = {
    appointment: { ...current, note: null, medicalAuthJson: null },
    pet: { id: 'pet-1', name: 'QA夹具豆豆', avatarUrl: null },
    service: { id: 'service-1', name: '基础洗护（小型犬）' },
    store: { id: 'store-1', name: '菲丽亚宠物·示例店' },
  }
  const html = renderAt('/booking/success?aid=qa-success', <BookingSuccessPage />, (queryClient) => {
    queryClient.setQueryData(['appointment', 'get', 'qa-success'], detail)
  })

  assert.match(html, /已为豆豆锁定档期/)
  assert.match(html, /豆豆 · 基础洗护（小型犬）/)
  assert.doesNotMatch(html, /QA夹具/)
})

test('PD-109：共享宠物切换器使用统一客读宠名', () => {
  const html = renderAt('/philia/pets', <ActivePetSwitcher />, (queryClient) => {
    queryClient.setQueryData(['auth', 'me'], { id: 'customer-1', activePetId: 'pet-1', roles: ['customer'] })
    queryClient.setQueryData(['pet', 'list'], qaPets)
  })

  assert.match(html, /data-testid="active-pet-switcher"/)
  assert.match(html, /豆豆/)
  assert.doesNotMatch(html, /QA夹具/)
})
