import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseServiceProcessPreviewState,
  serviceProcessPreviewAppointment,
  serviceProcessPreviewSteps,
  resolveServiceProcessRouteAid,
} from '../apps/customer/src/components/live/serviceProcessPreview.ts'
import { buildServiceProcessModel } from '../apps/customer/src/components/live/serviceProcessModel.ts'

test('preview parser accepts only the five deterministic B7 states', () => {
  for (const state of ['not-started', 'in-progress', 'expanded', 'step-empty', 'completed']) {
    assert.equal(parseServiceProcessPreviewState(state), state)
  }
  for (const value of [null, '', 'unknown', 'completed.html']) {
    assert.equal(parseServiceProcessPreviewState(value), null)
  }
})

test('preview fixtures resolve to the intended customer journey states', () => {
  const expectations = {
    'not-started': { status: 'confirmed', viewState: 'not-started', currentNodeKey: 'ordered' },
    'in-progress': { status: 'in_service', viewState: 'in-progress', currentNodeKey: 'wash' },
    expanded: { status: 'in_service', viewState: 'in-progress', currentNodeKey: 'wash' },
    'step-empty': { status: 'in_service', viewState: 'in-progress', currentNodeKey: 'styling' },
    completed: { status: 'completed', viewState: 'completed', currentNodeKey: null },
  }

  for (const [state, expected] of Object.entries(expectations)) {
    const model = buildServiceProcessModel({
      appointment: serviceProcessPreviewAppointment(state),
      steps: serviceProcessPreviewSteps(state),
    })
    assert.equal(model.viewState, expected.viewState, state)
    assert.equal(model.currentNodeKey, expected.currentNodeKey, state)
    assert.equal(serviceProcessPreviewAppointment(state).status, expected.status, state)
    assert.equal(model.nodes.length, 6, state)
  }
})

test('explicit B7 preview ignores a cached real appointment id', () => {
  const base = { isCanvasPreview: true, routeAid: 'preview', previewFirstId: 'real-appointment-id' }
  assert.equal(resolveServiceProcessRouteAid({ ...base, explicitB7Preview: true }), '')
  assert.equal(resolveServiceProcessRouteAid({ ...base, explicitB7Preview: false }), 'real-appointment-id')
  assert.equal(resolveServiceProcessRouteAid({
    explicitB7Preview: false,
    isCanvasPreview: false,
    routeAid: 'actual-id',
    previewFirstId: null,
  }), 'actual-id')
})

test('preview uses the real service photo requirements', () => {
  const model = buildServiceProcessModel({
    appointment: serviceProcessPreviewAppointment('expanded'),
    steps: serviceProcessPreviewSteps('expanded'),
  })
  assert.equal(model.nodes[2].requiredPhotos, 6)
  assert.equal(model.nodes[3].requiredPhotos, 2)
  assert.equal(model.nodes[4].requiredPhotos, 2)
})
