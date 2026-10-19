import type { ServiceProcessAppointment, ServiceProcessStep } from './serviceProcessModel'

export type ServiceProcessPreviewState = 'not-started' | 'in-progress' | 'expanded' | 'step-empty' | 'completed'

export interface ServiceProcessPreviewAppointment extends ServiceProcessAppointment {
  id: string
  scheduledStart: Date
  scheduledEnd: Date
}

const CREATED_AT = new Date('2026-10-17T21:06:00')
const CHECKED_IN_AT = new Date('2026-10-18T14:02:00')
const COMPLETED_AT = new Date('2026-10-18T16:08:00')

export function parseServiceProcessPreviewState(value: string | null): ServiceProcessPreviewState | null {
  switch (value) {
    case 'not-started':
    case 'in-progress':
    case 'expanded':
    case 'step-empty':
    case 'completed':
      return value
    default:
      return null
  }
}

export function resolveServiceProcessRouteAid({
  explicitB7Preview,
  isCanvasPreview,
  routeAid,
  previewFirstId,
}: {
  explicitB7Preview: boolean
  isCanvasPreview: boolean
  routeAid: string | undefined
  previewFirstId: string | null
}) {
  if (explicitB7Preview) return ''
  return isCanvasPreview && routeAid === 'preview' ? (previewFirstId ?? '') : (routeAid ?? '')
}

export function serviceProcessPreviewAppointment(state: ServiceProcessPreviewState): ServiceProcessPreviewAppointment {
  const completed = state === 'completed'
  return {
    id: 'canvas-example-appt',
    status: state === 'not-started' ? 'confirmed' : completed ? 'completed' : 'in_service',
    createdAt: CREATED_AT,
    checkedInAt: state === 'not-started' ? null : CHECKED_IN_AT,
    completedAt: completed ? COMPLETED_AT : null,
    scheduledStart: new Date('2026-10-18T14:00:00'),
    scheduledEnd: new Date('2026-10-18T16:20:00'),
  }
}

function previewStep(
  stepKey: string,
  status: ServiceProcessStep['status'],
  requiredPhotos: number,
  startedAt: Date | null,
  doneAt: Date | null,
): ServiceProcessStep {
  return { stepKey, status, requiredPhotos, startedAt, doneAt, photos: [] }
}

export function serviceProcessPreviewSteps(state: ServiceProcessPreviewState): ServiceProcessStep[] {
  if (state === 'not-started') return []
  const completed = state === 'completed'
  const styling = state === 'step-empty'
  const t = (value: string) => new Date(`2026-10-18T${value}:00`)
  return [
    previewStep('disinfection', 'done', 1, CHECKED_IN_AT, t('14:05')),
    previewStep('precheck', 'done', 2, t('14:05'), t('14:20')),
    previewStep('grooming', completed || styling ? 'done' : 'active', 3, t('14:20'), completed || styling ? t('14:40') : null),
    previewStep('detail', completed ? 'done' : styling ? 'active' : 'locked', 2, completed || styling ? t('14:40') : null, completed ? t('15:40') : null),
    previewStep('before_after', completed ? 'done' : 'locked', 2, completed ? t('15:40') : null, completed ? t('16:05') : null),
    previewStep('confirm', completed ? 'done' : 'locked', 0, completed ? t('16:05') : null, completed ? COMPLETED_AT : null),
  ]
}
