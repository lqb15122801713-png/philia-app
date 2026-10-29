import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { StaticRouter } from 'react-router-dom/server'
import { createPhiliaClient, PhiliaClientContext } from '@philia/shared'
import PetPicker from './booking/PetPicker'
import PetCardBlock from './booking/single/PetCardBlock'
import BoardingConfirmBar from './booking/single/BoardingConfirmBar'
import LiveHeader from './live/LiveHeader'
import CelebrationOverlay from './live/CelebrationOverlay'
import RebookPanel from './home/RebookPanel'
import InServicePanel from './home/InServicePanel'
import GroomingServiceProcess from './live/GroomingServiceProcess'
import { serviceProcessPreviewAppointment, serviceProcessPreviewSteps } from './live/serviceProcessPreview'
import type { PetItem } from './booking/types'

const testWindow = {
  location: new URL('http://test.local/'),
  localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  sessionStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}
Object.defineProperty(globalThis, 'window', { value: testWindow, configurable: true, writable: true })
Object.defineProperty(globalThis, 'React', { value: React, configurable: true, writable: true })

const pets = [
  { id: 'pet-1', name: 'QA夹具豆豆', species: 'dog', breed: '比熊', weightKg: 8, avatarUrl: null, vaccineValidUntil: null },
] as PetItem[]

function render(element: React.ReactNode) {
  const client = createPhiliaClient('http://127.0.0.1:9')
  client.queryClient.setQueryData(['auth', 'me'], { id: 'customer-1', activePetId: 'pet-1', roles: ['customer'] })
  return renderToStaticMarkup(
    <PhiliaClientContext.Provider value={client}>
      <QueryClientProvider client={client.queryClient}>
        <StaticRouter location="/">{element}</StaticRouter>
      </QueryClientProvider>
    </PhiliaClientContext.Provider>,
  )
}

function assertClean(html: string) {
  assert.match(html, /豆豆/)
  assert.doesNotMatch(html, /QA夹具/)
}

test('PD-109：共享选宠列表收敛宠名', () => {
  assertClean(render(<PetPicker variant="flat" pets={pets} selectedId="pet-1" onSelect={() => undefined} />))
})

test('PD-109：共享宠物卡收敛宠名', () => {
  assertClean(render(<PetCardBlock pets={pets} selectedId="pet-1" onSelect={() => undefined} />))
})

test('PD-109：寄养疫苗提示收敛宠名', () => {
  assertClean(render(<BoardingConfirmBar nights={1} totalFen={100} missingLabel={null} vaccineBlock={{ petName: 'QA夹具豆豆', until: null }} submitting={false} onConfirm={() => undefined} />))
})

test('PD-109：服务过程摘要收敛宠名', () => {
  assertClean(render(<LiveHeader petName="QA夹具豆豆" serviceName="洗护" state="plain" />))
})

test('PD-109：服务完成提示收敛宠名', () => {
  assertClean(render(<CelebrationOverlay visible petName="QA夹具豆豆" />))
})

test('PD-109：再次预约摘要收敛宠名', () => {
  assertClean(render(<RebookPanel storeId="store-1" storeName="门店" serviceId="service-1" serviceName="洗护" durationMin={60} petId="pet-1" petName="QA夹具豆豆" slot={new Date('2026-10-30T14:00:00')} paymentMode="pay_at_store" passRemainTimes={null} />))
})

test('PD-109：首页服务中面板收敛宠名', () => {
  assertClean(render(<InServicePanel appointmentId="appt-1" petName="QA夹具豆豆" stepName={null} stepOrder={null} totalSteps={6} doneCount={0} photos={[]} sseConnected={false} staffName={null} etaEnd={null} />))
})

test('PD-109：完整洗护过程收敛宠名', () => {
  assertClean(render(
    <GroomingServiceProcess
      appointment={serviceProcessPreviewAppointment('in-progress')}
      petName="QA夹具豆豆"
      serviceName="洗护"
      storeName="门店"
      steps={serviceProcessPreviewSteps('in-progress')}
      stepsLoading={false}
      fallbackPath="/appointments"
      onOpenPhotos={() => undefined}
    />,
  ))
})
