import test from 'node:test'
import assert from 'node:assert/strict'
import { buildServiceProcessModel } from '../apps/customer/src/components/live/serviceProcessModel.ts'

const createdAt = new Date('2026-10-17T21:06:00')
const checkedInAt = new Date('2026-10-18T14:02:00')
const completedAt = new Date('2026-10-18T16:08:00')

function appointment(overrides = {}) {
  return {
    status: 'confirmed',
    createdAt,
    checkedInAt: null,
    completedAt: null,
    ...overrides,
  }
}

function step(stepKey, status, overrides = {}) {
  return {
    stepKey,
    status,
    startedAt: status === 'locked' ? null : checkedInAt,
    doneAt: status === 'done' ? new Date('2026-10-18T14:40:00') : null,
    requiredPhotos: 0,
    photos: [],
    ...overrides,
  }
}

function statuses(model) {
  return model.nodes.map((node) => node.status)
}

test('confirmed order renders the six customer nodes in the not-started state', () => {
  const model = buildServiceProcessModel({ appointment: appointment(), steps: [] })

  assert.equal(model.viewState, 'not-started')
  assert.equal(model.nodeCount, 1)
  assert.deepEqual(model.nodes.map((node) => node.name), ['已下单', '已到店', '洗护中', '美容造型', '待接回', '已完成'])
  assert.deepEqual(statuses(model), ['active', 'locked', 'locked', 'locked', 'locked', 'locked'])
  assert.equal(model.currentNodeKey, 'ordered')
})

test('active grooming aggregates the internal wash steps into one customer node', () => {
  const model = buildServiceProcessModel({
    appointment: appointment({ status: 'in_service', checkedInAt }),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done', {
        photos: [{ id: 'photo-1', url: '/precheck.jpg', thumbUrl: null, tag: 'normal' }],
      }),
      step('grooming', 'active', {
        requiredPhotos: 2,
        photos: [{ id: 'photo-2', url: '/wash.jpg', thumbUrl: '/wash-thumb.jpg', tag: 'normal' }],
      }),
      step('detail', 'locked'),
      step('before_after', 'locked'),
      step('confirm', 'locked'),
    ],
  })

  assert.equal(model.viewState, 'in-progress')
  assert.equal(model.nodeCount, 3)
  assert.equal(model.currentNodeKey, 'wash')
  assert.equal(model.currentInternalStepKey, 'grooming')
  assert.deepEqual(statuses(model), ['done', 'done', 'active', 'locked', 'locked', 'locked'])
  assert.deepEqual(model.nodes[2].photos.map((photo) => photo.id), ['photo-1', 'photo-2'])
  assert.equal(model.nodes[2].requiredPhotos, 2)
})

test('active detail advances to the styling node and exposes its honest empty state', () => {
  const model = buildServiceProcessModel({
    appointment: appointment({ status: 'in_service', checkedInAt }),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done'),
      step('grooming', 'done'),
      step('detail', 'active'),
      step('before_after', 'locked'),
      step('confirm', 'locked'),
    ],
  })

  assert.equal(model.nodeCount, 4)
  assert.equal(model.currentNodeKey, 'styling')
  assert.equal(model.currentInternalStepKey, 'detail')
  assert.deepEqual(statuses(model), ['done', 'done', 'done', 'active', 'locked', 'locked'])
  assert.equal(model.nodes[3].photos.length, 0)
})

test('delivery checks map to the pickup node rather than a seventh step', () => {
  const model = buildServiceProcessModel({
    appointment: appointment({ status: 'in_service', checkedInAt }),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done'),
      step('grooming', 'done'),
      step('detail', 'done'),
      step('before_after', 'active', { requiredPhotos: 2 }),
      step('confirm', 'locked'),
    ],
  })

  assert.equal(model.nodeCount, 5)
  assert.equal(model.currentNodeKey, 'pickup')
  assert.deepEqual(statuses(model), ['done', 'done', 'done', 'done', 'active', 'locked'])
})

test('completed appointment closes all six nodes without a current cream target', () => {
  const model = buildServiceProcessModel({
    appointment: appointment({ status: 'completed', checkedInAt, completedAt }),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done'),
      step('grooming', 'done'),
      step('detail', 'done'),
      step('before_after', 'done'),
      step('confirm', 'done'),
    ],
  })

  assert.equal(model.viewState, 'completed')
  assert.equal(model.nodeCount, 6)
  assert.equal(model.currentNodeKey, null)
  assert.equal(model.currentInternalStepKey, null)
  assert.deepEqual(statuses(model), ['done', 'done', 'done', 'done', 'done', 'done'])
  assert.equal(model.nodes[5].time, completedAt)
})

test('final step done before the completed event keeps the six-of-six count', () => {
  const model = buildServiceProcessModel({
    appointment: appointment({ status: 'in_service', checkedInAt }),
    steps: [
      step('disinfection', 'done'),
      step('precheck', 'done'),
      step('grooming', 'done'),
      step('detail', 'done'),
      step('before_after', 'done'),
      step('confirm', 'done'),
    ],
  })

  assert.equal(model.viewState, 'in-progress')
  assert.equal(model.currentNodeKey, null)
  assert.equal(model.nodeCount, 6)
})
