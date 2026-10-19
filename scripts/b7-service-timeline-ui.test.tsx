import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter as MemoryRouter } from 'react-router-dom/server'
import { buildServiceProcessModel } from '../apps/customer/src/components/live/serviceProcessModel.ts'
import ServiceProcessHeader from '../apps/customer/src/components/live/ServiceProcessHeader.tsx'
import ServiceProcessTimeline from '../apps/customer/src/components/live/ServiceProcessTimeline.tsx'
import ClientTabBar from '../apps/customer/src/components/live/ClientTabBar.tsx'
import ReviewPanel from '../apps/customer/src/components/live/ReviewPanel.tsx'

const createdAt = new Date('2026-10-17T21:06:00')
const checkedInAt = new Date('2026-10-18T14:02:00')
const completedAt = new Date('2026-10-18T16:08:00')

function appointment(status: string) {
  return {
    status,
    createdAt,
    checkedInAt: status === 'confirmed' ? null : checkedInAt,
    completedAt: status === 'completed' ? completedAt : null,
  }
}

function step(stepKey: string, status: 'locked' | 'active' | 'done', requiredPhotos = 0) {
  return {
    stepKey,
    status,
    startedAt: status === 'locked' ? null : checkedInAt,
    doneAt: status === 'done' ? checkedInAt : null,
    requiredPhotos,
    photos: [],
  }
}

function inProgressModel(activeStep: 'grooming' | 'detail') {
  return buildServiceProcessModel({
    appointment: appointment('in_service'),
    steps: [
      step('disinfection', 'done', 1),
      step('precheck', 'done', 2),
      step('grooming', activeStep === 'grooming' ? 'active' : 'done', 3),
      step('detail', activeStep === 'detail' ? 'active' : 'locked', 2),
      step('before_after', 'locked', 2),
      step('confirm', 'locked'),
    ],
  })
}

test('not-started summary exposes the first current node and one cream chip', () => {
  const model = buildServiceProcessModel({ appointment: appointment('confirmed'), steps: [] })
  const html = renderToStaticMarkup(
    <ServiceProcessHeader
      petName="豆豆"
      serviceName="标准洗护"
      meta="今天 14:00 · 静安寺店"
      model={model}
      nowLabel="此刻 已下单 · 候场"
    />,
  )

  assert.match(html, /未开始/)
  assert.match(html, /节点 1\/6/)
  assert.match(html, /豆豆 · 标准洗护/)
  assert.match(html, /此刻 已下单 · 候场/)
  assert.equal((html.match(/data-cream="now"/g) ?? []).length, 1)
})

test('expanded wash state shows step guidance and three honest photo placeholders', () => {
  const html = renderToStaticMarkup(
    <ServiceProcessTimeline
      model={inProgressModel('grooming')}
      initialExpandedKey="wash"
      previewState="expanded"
      onOpenPhotos={() => undefined}
    />,
  )

  assert.match(html, /本步说明：完成洗澡后进入吹干，毛发分区定型。/)
  assert.match(html, /吹干 ①/)
  assert.match(html, /吹干 ②/)
  assert.match(html, /细节/)
  assert.match(html, /\+3/)
  assert.match(html, /待换/)
  assert.doesNotMatch(html, /本步照片尚未齐/)
  assert.match(html, /data-testid="service-process-photo-grid"/)
})

test('expanded styling without photos renders the honest empty card', () => {
  const html = renderToStaticMarkup(
    <ServiceProcessTimeline
      model={inProgressModel('detail')}
      initialExpandedKey="styling"
      previewState="step-empty"
      onOpenPhotos={() => undefined}
    />,
  )

  assert.match(html, /本步照片尚未齐/)
  assert.match(html, /洗护师补拍后会在这里出现/)
  assert.match(html, /稍后再看/)
  assert.doesNotMatch(html, /吹干 ①/)
})

test('completed summary and timeline have no current cream target', () => {
  const model = buildServiceProcessModel({
    appointment: appointment('completed'),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done'),
      step('grooming', 'done'),
      step('detail', 'done'),
      step('before_after', 'done'),
      step('confirm', 'done'),
    ],
  })
  const html = renderToStaticMarkup(
    <>
      <ServiceProcessHeader
        petName="豆豆"
        serviceName="标准洗护"
        meta="静安寺店 · 今天 16:08 结束"
        model={model}
        nowLabel={null}
      />
      <ServiceProcessTimeline model={model} onOpenPhotos={() => undefined} />
    </>,
  )

  assert.match(html, /节点 6\/6/)
  assert.match(html, /六节点全完成/)
  assert.equal((html.match(/data-cream=/g) ?? []).length, 0)
})

test('light ClientTabBar exposes five ordered links with booking active and no paw control', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter location="/appointments/preview/live">
      <ClientTabBar />
    </MemoryRouter>,
  )

  const labels = ['首页', '预约', 'PHILIA', '商城', '我的']
  const positions = labels.map((label) => html.indexOf(`>${label}<`))
  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
  for (const href of ['/home', '/booking/grooming', '/philia', '/mall', '/me']) {
    assert.match(html, new RegExp(`href="${href.replace('/', '\\/')}"`))
  }
  assert.match(html, /data-testid="client-tab-bar"/)
  assert.match(html, /aria-current="page"/)
  assert.doesNotMatch(html, /app-dock-philia|PawMark|bg-brand-cta-pressed/)
})

test('completed wash photos remain expandable after styling starts', () => {
  const model = inProgressModel('detail')
  model.nodes[2].photos = [{ id: 'wash-photo', url: '/wash.jpg' }]
  model.nodes[2].requiredPhotos = 1

  const collapsed = renderToStaticMarkup(<ServiceProcessTimeline model={model} onOpenPhotos={() => undefined} />)
  assert.match(collapsed, /data-step-key="wash"[\s\S]*aria-expanded="false"/)
  assert.doesNotMatch(collapsed, /src="\/wash.jpg"/)

  const expanded = renderToStaticMarkup(
    <ServiceProcessTimeline model={model} initialExpandedKey="wash" onOpenPhotos={() => undefined} />,
  )
  assert.match(expanded, /data-step-key="wash"[\s\S]*aria-expanded="true"/)
  assert.match(expanded, /src="\/wash.jpg"/)
})

test('completed before and after photos remain available in the finished journey', () => {
  const model = buildServiceProcessModel({
    appointment: appointment('completed'),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done'),
      step('grooming', 'done'),
      step('detail', 'done'),
      step('before_after', 'done', 2),
      step('confirm', 'done'),
    ],
  })
  model.nodes[4].photos = [
    { id: 'before', url: '/before.jpg', tag: 'before' },
    { id: 'after', url: '/after.jpg', tag: 'after' },
  ]

  const html = renderToStaticMarkup(
    <ServiceProcessTimeline model={model} initialExpandedKey="pickup" onOpenPhotos={() => undefined} />,
  )

  assert.match(html, /data-step-key="pickup"[\s\S]*aria-expanded="true"/)
  assert.match(html, /src="\/before.jpg"/)
  assert.match(html, /src="\/after.jpg"/)
})

test('missing after photo renders an honest placeholder instead of duplicating the before photo', () => {
  const model = buildServiceProcessModel({
    appointment: appointment('in_service'),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done'),
      step('grooming', 'done'),
      step('detail', 'done'),
      {
        ...step('before_after', 'active', 2),
        photos: [{ id: 'before', url: '/before.jpg', thumbUrl: null, tag: 'before' }],
      },
      step('confirm', 'locked'),
    ],
  })

  const html = renderToStaticMarkup(
    <ServiceProcessTimeline model={model} initialExpandedKey="pickup" onOpenPhotos={() => undefined} />,
  )

  assert.match(html, /服务后/)
  assert.match(html, /待换/)
  assert.equal((html.match(/src="\/before.jpg"/g) ?? []).length, 1)
  assert.doesNotMatch(html, /吹干 ①/)
})

test('B7 review uses neutral accents while the default review keeps cream', () => {
  const props = {
    existingRating: 5,
    submitting: false,
    onSubmit: () => undefined,
    onShare: () => undefined,
  }
  const neutral = renderToStaticMarkup(<ReviewPanel {...props} accent="neutral" />)
  const fallback = renderToStaticMarkup(<ReviewPanel {...props} />)

  assert.match(neutral, /fill-brand-cta/)
  assert.doesNotMatch(neutral, /fill-brand-primary/)
  assert.match(fallback, /fill-brand-primary/)
})

test('only after photo stays in the after slot while the before slot stays empty', () => {
  const model = buildServiceProcessModel({
    appointment: appointment('in_service'),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done'),
      step('grooming', 'done'),
      step('detail', 'done'),
      {
        ...step('before_after', 'active', 2),
        photos: [{ id: 'after', url: '/after.jpg', thumbUrl: null, tag: 'after' }],
      },
      step('confirm', 'locked'),
    ],
  })

  const html = renderToStaticMarkup(
    <ServiceProcessTimeline model={model} initialExpandedKey="pickup" onOpenPhotos={() => undefined} />,
  )

  assert.match(html, /服务前[\s\S]*待换/)
  assert.match(html, /服务后[\s\S]*src="\/after.jpg"/)
  assert.doesNotMatch(html, /alt="服务前"[\s\S]*after.jpg/)
  assert.equal((html.match(/src="\/after.jpg"/g) ?? []).length, 1)
})
