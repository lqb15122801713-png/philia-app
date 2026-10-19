import type { PhotoWallPhoto } from '@philia/shared'

export type ServiceProcessViewState = 'not-started' | 'in-progress' | 'completed'
export type ServiceProcessNodeStatus = 'locked' | 'active' | 'done'
export type ServiceProcessNodeKey = 'ordered' | 'arrived' | 'wash' | 'styling' | 'pickup' | 'completed'

export interface ServiceProcessAppointment {
  status: string
  createdAt: Date
  checkedInAt: Date | null
  completedAt: Date | null
}

export interface ServiceProcessStepPhoto {
  id: string
  url: string
  thumbUrl: string | null
  tag: string
}

export interface ServiceProcessStep {
  stepKey: string
  status: ServiceProcessNodeStatus
  startedAt: Date | null
  doneAt: Date | null
  requiredPhotos: number
  photos: ServiceProcessStepPhoto[]
}

export interface ServiceProcessNode {
  key: ServiceProcessNodeKey
  name: string
  status: ServiceProcessNodeStatus
  description: string
  time: Date | null
  photos: PhotoWallPhoto[]
  requiredPhotos: number
}

export interface ServiceProcessModel {
  viewState: ServiceProcessViewState
  nodeCount: number
  currentNodeKey: ServiceProcessNodeKey | null
  currentInternalStepKey: string | null
  nodes: ServiceProcessNode[]
}

export interface ServiceProcessInput {
  appointment: ServiceProcessAppointment
  steps: ServiceProcessStep[]
}

const WASH_STEPS = ['disinfection', 'precheck', 'grooming']
const STYLING_STEPS = ['detail']
const PICKUP_STEPS = ['before_after', 'confirm']

function selectSteps(steps: ServiceProcessStep[], keys: string[]) {
  return steps.filter((step) => keys.includes(step.stepKey))
}

function hasProgress(steps: ServiceProcessStep[], keys: string[]) {
  return selectSteps(steps, keys).some((step) => step.status !== 'locked')
}

function isGroupDone(steps: ServiceProcessStep[], keys: string[]) {
  const finalStep = steps.find((step) => step.stepKey === keys[keys.length - 1])
  return finalStep?.status === 'done'
}

function groupStatus(
  steps: ServiceProcessStep[],
  keys: string[],
  laterKeys: string[],
  notStarted: boolean,
  completed: boolean,
): ServiceProcessNodeStatus {
  if (completed) return 'done'
  if (notStarted) return 'locked'
  if (isGroupDone(steps, keys) || hasProgress(steps, laterKeys)) return 'done'
  if (hasProgress(steps, keys)) return 'active'
  return 'locked'
}

function photosOf(steps: ServiceProcessStep[], keys: string[]): PhotoWallPhoto[] {
  return selectSteps(steps, keys).flatMap((step) => {
    const photos = step.stepKey === 'before_after'
      ? [...step.photos].sort((a, b) => {
          const rank = (tag: string) => (tag === 'before' ? 0 : tag === 'after' ? 1 : 2)
          return rank(a.tag) - rank(b.tag)
        })
      : step.photos
    return photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      thumbUrl: photo.thumbUrl ?? undefined,
      tag: photo.tag,
    }))
  })
}

function requiredPhotosOf(steps: ServiceProcessStep[], keys: string[]) {
  return selectSteps(steps, keys).reduce((total, step) => total + step.requiredPhotos, 0)
}

function doneTimeOf(steps: ServiceProcessStep[], key: string) {
  return steps.find((step) => step.stepKey === key)?.doneAt ?? null
}

export function buildServiceProcessModel({ appointment, steps }: ServiceProcessInput): ServiceProcessModel {
  const notStarted = !appointment.checkedInAt && (appointment.status === 'pending' || appointment.status === 'confirmed')
  const completed = appointment.status === 'completed'
  const viewState: ServiceProcessViewState = completed ? 'completed' : notStarted ? 'not-started' : 'in-progress'
  const currentInternalStepKey = completed ? null : steps.find((step) => step.status === 'active')?.stepKey ?? null

  const orderedStatus: ServiceProcessNodeStatus = notStarted ? 'active' : 'done'
  const washStatus = groupStatus(steps, WASH_STEPS, [...STYLING_STEPS, ...PICKUP_STEPS], notStarted, completed)
  const stylingStatus = groupStatus(steps, STYLING_STEPS, PICKUP_STEPS, notStarted, completed)
  const pickupStatus = groupStatus(steps, PICKUP_STEPS, [], notStarted, completed)

  const nodes: ServiceProcessNode[] = [
    {
      key: 'ordered',
      name: '已下单',
      status: orderedStatus,
      description: notStarted ? '预约已确认 · 等待到店' : '预约已确认',
      time: appointment.createdAt,
      photos: [],
      requiredPhotos: 0,
    },
    {
      key: 'arrived',
      name: '已到店',
      status: notStarted ? 'locked' : 'done',
      description: notStarted ? '到店后前台核销' : '前台已核销到店',
      time: notStarted ? null : appointment.checkedInAt,
      photos: [],
      requiredPhotos: 0,
    },
    {
      key: 'wash',
      name: '洗护中',
      status: washStatus,
      description: washStatus === 'done' ? '洗澡 · 吹干完成' : washStatus === 'active' ? '洗澡 · 吹干进行中' : '洗澡 · 吹干',
      time: washStatus === 'done' ? doneTimeOf(steps, 'grooming') : null,
      photos: photosOf(steps, WASH_STEPS),
      requiredPhotos: requiredPhotosOf(steps, WASH_STEPS),
    },
    {
      key: 'styling',
      name: '美容造型',
      status: stylingStatus,
      description: stylingStatus === 'done' ? '精修完成' : '精修剪裁与造型',
      time: stylingStatus === 'done' ? doneTimeOf(steps, 'detail') : null,
      photos: photosOf(steps, STYLING_STEPS),
      requiredPhotos: requiredPhotosOf(steps, STYLING_STEPS),
    },
    {
      key: 'pickup',
      name: '待接回',
      status: pickupStatus,
      description: pickupStatus === 'done' ? '已到店领取' : '可到店领取',
      time: pickupStatus === 'done' ? doneTimeOf(steps, 'confirm') : null,
      photos: photosOf(steps, PICKUP_STEPS),
      requiredPhotos: requiredPhotosOf(steps, PICKUP_STEPS),
    },
    {
      key: 'completed',
      name: '已完成',
      status: completed ? 'done' : 'locked',
      description: completed ? '服务已结束' : '服务结束',
      time: completed ? appointment.completedAt : null,
      photos: [],
      requiredPhotos: 0,
    },
  ]

  const currentNodeKey = completed ? null : nodes.find((node) => node.status === 'active')?.key ?? null
  const currentIndex = currentNodeKey ? nodes.findIndex((node) => node.key === currentNodeKey) : -1
  const lastDoneIndex = nodes.reduce((last, node, index) => (node.status === 'done' ? index : last), -1)
  const nodeCount = completed ? 6 : currentIndex >= 0 ? currentIndex + 1 : Math.min(6, lastDoneIndex + 2)

  return {
    viewState,
    nodeCount,
    currentNodeKey,
    currentInternalStepKey,
    nodes,
  }
}
