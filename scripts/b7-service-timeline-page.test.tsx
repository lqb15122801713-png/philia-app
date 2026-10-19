import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import GroomingServiceProcess from '../apps/customer/src/components/live/GroomingServiceProcess.tsx'

const createdAt = new Date('2026-10-17T21:06:00')
const checkedInAt = new Date('2026-10-18T14:02:00')
const completedAt = new Date('2026-10-18T16:08:00')
const scheduledStart = new Date('2026-10-18T14:00:00')
const scheduledEnd = new Date('2026-10-18T16:20:00')

function appointment(status: string) {
  return {
    id: 'canvas-example-appt',
    status,
    createdAt,
    checkedInAt: status === 'confirmed' ? null : checkedInAt,
    completedAt: status === 'completed' ? completedAt : null,
    scheduledStart,
    scheduledEnd,
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

function stepsFor(state: 'in-progress' | 'step-empty' | 'completed') {
  const detailStatus = state === 'step-empty' ? 'active' : state === 'completed' ? 'done' : 'locked'
  return [
    step('disinfection', 'done', 1),
    step('precheck', 'done', 2),
    step('grooming', state === 'in-progress' ? 'active' : 'done', 3),
    step('detail', detailStatus, 2),
    step('before_after', state === 'completed' ? 'done' : 'locked', 2),
    step('confirm', state === 'completed' ? 'done' : 'locked'),
  ]
}

function renderPage(
  state: 'not-started' | 'expanded' | 'step-empty' | 'completed',
  stepsOverride?: ReturnType<typeof stepsFor>,
  stepsError = false,
  layout?: { blockKey: string; visible: boolean }[],
) {
  const status = state === 'not-started' ? 'confirmed' : state === 'completed' ? 'completed' : 'in_service'
  return renderToStaticMarkup(
    <StaticRouter location="/appointments/preview/live">
      <GroomingServiceProcess
        appointment={appointment(status)}
        petName="豆豆"
        serviceName="标准洗护"
        storeName="静安寺店"
        steps={stepsOverride ?? (state === 'not-started' ? [] : stepsFor(state === 'expanded' ? 'in-progress' : state))}
        stepsLoading={false}
        stepsError={stepsError}
        onRetrySteps={() => undefined}
        previewState={state}
        layout={layout}
        isPreview
        fallbackPath="/appointments"
        onOpenPhotos={() => undefined}
      />
    </StaticRouter>,
  )
}

test('full not-started page has the arrival notice, two cream accents and the light five-tab shell', () => {
  const html = renderPage('not-started')

  assert.match(html, /豆豆 · 洗护过程/)
  assert.match(html, /到店后会自动推进/)
  assert.match(html, /入口来自预约成功「查看服务过程」/)
  assert.equal((html.match(/data-cream="now"/g) ?? []).length, 2)
  for (const label of ['首页', '预约', 'PHILIA', '商城', '我的']) assert.match(html, new RegExp(label))
  assert.doesNotMatch(html, /app-dock-philia|PawMark|bg-brand-cta-pressed/)
})

test('expanded preview uses the delivery-photo summary language', () => {
  const html = renderPage('expanded')

  assert.match(html, /静安寺店 · 展开查看交付照/)
  assert.match(html, /此刻 洗护中 · 过程照已出/)
  assert.match(html, /吹干 ①/)
  assert.doesNotMatch(html, /本步照片尚未齐/)
})

test('step-empty preview explains that styling photos are pending', () => {
  const html = renderPage('step-empty')

  assert.match(html, /静安寺店 · 造型步照片待齐/)
  assert.match(html, /此刻 美容造型 · 图未齐/)
  assert.match(html, /本步照片尚未齐/)
})

test('completed page includes the done strip and beauty report without cream accents', () => {
  const html = renderPage('completed')

  assert.match(html, /洗护完成，感谢信任/)
  assert.match(html, /美容报告/)
  assert.match(html, /查看美容报告/)
  assert.match(html, /href="\/philia\/reports\/canvas-example-appt"/)
  assert.equal((html.match(/data-cream=/g) ?? []).length, 0)
})

test('styling summary stops saying photos are missing once the requirement is met', () => {
  const steps = stepsFor('step-empty')
  steps[3].photos = [
    { id: 'style-1', url: '/style-1.jpg', thumbUrl: null, tag: 'normal' },
    { id: 'style-2', url: '/style-2.jpg', thumbUrl: null, tag: 'normal' },
  ]
  const html = renderPage('step-empty', steps)

  assert.match(html, /此刻 美容造型 · 过程照已出/)
  assert.doesNotMatch(html, /此刻 美容造型 · 图未齐/)
  assert.doesNotMatch(html, /造型步照片待齐|还在补拍/)
  assert.match(html, /src="\/style-1.jpg"/)
})

test('step query failure renders an honest retry state instead of fake locked progress', () => {
  const html = renderPage('expanded', undefined, true)

  assert.match(html, /服务进度暂时没有同步/)
  assert.match(html, /重新加载/)
  assert.doesNotMatch(html, /服务进度 · 六节点/)
})

test('published canvas layout still controls B7 block order and visibility', () => {
  const html = renderPage('completed', undefined, false, [
    { blockKey: 'apptLive.stepper', visible: true },
    { blockKey: 'apptLive.header', visible: true },
    { blockKey: 'apptLive.review', visible: false },
  ])

  const stepperIndex = html.indexOf('data-block-key="apptLive.stepper"')
  const headerIndex = html.indexOf('data-block-key="apptLive.header"')
  assert.ok(stepperIndex >= 0 && headerIndex >= 0 && stepperIndex < headerIndex)
  assert.doesNotMatch(html, /美容报告/)
})
