/**
 * 服务进度实时页 /appointments/:id/live（T2.3 · 开发方案 §8.4 + §7.4）
 *
 * 数据与实时接线：
 * - 首屏：appointment.get（归属/状态/宠物/门店/服务）→ 按 type+status 分支：
 *   grooming（in_service/completed）→ serviceStep.list 六步+未失效照片；
 *   boarding（in_boarding/completed）→ boarding.myStay 住宿单+每日打卡。
 * - SSE：先 push.subscribe 登记（clientId 持久化于 localStorage，safeUuid()），
 *   再连 GET /api/events?client_id=…&watch=aid（useEventSource）。
 *   step_updated → 对应步照片乐观 append（按 url 去重）+ invalidate；
 *   appointment.completed → 完成态 + 庆祝微动效；boarding.daily_update →
 *   invalidate myStay + 新打卡 toast；事件按 envelope.id Set 去重。
 * - 兜底（§7.4）：onReconnect 全量 refetch；connected=false 超 5s 显示
 *   「连接中…」细条并启用 30s progressSummary 轮询（数据变化时全量对齐，
 *   主查询同时挂 30s refetchInterval）；visibilitychange 回前台全量对齐一次。
 * - 异常态：非本人/不存在 → 友好错误页；寄养 pending/confirmed 与取消两态保留原提示；
 *   洗护 pending/confirmed/in_service/completed → B7 客户六节点五态。
 *
 * B7（PD-40）与寄养既有模块：
 * - 洗护：内部六步聚合为已下单/已到店/洗护中/美容造型/待接回/已完成；
 *   支持未开始/进行中/展开/步骤空态/已完成，照片可展开查看，页内浅浮岛五栏。
 * - 寄养：保留 PageHeader、LiveHeader、BoardingLive 与每日打卡；联系门店有电话才显示。
 * - 异常通报：incident.listForAppointment 拉取本单异常，未处置=赭红卡，全部已处置=暖底细条；
 *   SSE incident.reported/incident.handled/boarding.unsealed → toast + 精确 invalidate。
 *
 * 画布化（产品-1010 画布全屏批片 3 · 预约域三重屏之三 · 特别裁 §五.2 实时页）：
 * 六块入册（apptLive.header/incident/stepper/boardingStay/review/contact），
 * 块序/显隐=useCanvasLayout('apptLive')（published→注册表默认序尾补，空=APPT_LIVE_DEFAULT_ORDER
 * 兜底）；洗护 B7 与寄养均接入该块流，实时数据与状态机不接区块 props，SSE/轮询不改；
 * 加载/错误/寄养未开始/已取消分支不入块流。
 * 带参路由预览特例：显式 b7State 直接使用五态只读夹具并强制隔离真实预约缓存；
 * 未显式给态时沿用预约列表首条，查不到再以洗护中合成单顶替（零写库，水印注记已有）。
 * 店锚=?canvasStore= 预览店锚 > 本单门店（appointment.get 透出 store.id，零新增查询）。
 */

import {
  CanvasLayoutLoader,
  CK,
  EventType,
  getApiBase,
  safeUuid,
  useCanvasLayout,
  useEventSource,
  useMe,
  usePhiliaClient,
  type EventEnvelope,
  type PhotoWallPhoto,
} from '@philia/shared'
import { customerPetName } from '@/lib/customerPresentation'
import LiveStepper, { type LiveStepperStep } from '../components/live/LiveStepper'
import GroomingServiceProcess from '../components/live/GroomingServiceProcess'
import {
  parseServiceProcessPreviewState,
  resolveServiceProcessRouteAid,
  serviceProcessPreviewAppointment,
  serviceProcessPreviewSteps,
  type ServiceProcessPreviewState,
} from '../components/live/serviceProcessPreview'
import type { ServiceProcessStep } from '../components/live/serviceProcessModel'
import type { AppointmentDetail } from '@/components/booking/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarClock, CircleX, QrCode, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apc, type AppointmentsCopyKey } from '../copy/appointments'
import { mc } from '../components/member/copy'
import BoardingLive, { type BoardingAssuranceInfo, type BoardingLogItem, type BoardingStayInfo } from '../components/live/BoardingLive'
import CelebrationOverlay from '../components/live/CelebrationOverlay'
import ConnectionBar from '../components/live/ConnectionBar'
import ContactStore from '../components/live/ContactStore'
import LiveHeader from '../components/live/LiveHeader'
import PageHeader, { BackButton } from '../components/PageHeader'
import LiveToast from '../components/live/LiveToast'
import { PhotoViewer } from '@philia/shared'
import ReviewPanel from '../components/live/ReviewPanel'
import '../styles/live-v2.css'

/* ------------------------------------------------------------------ */
/* 常量与工具                                                            */
/* ------------------------------------------------------------------ */

const CLIENT_ID_KEY = 'philia.sseClientId'

/** 画布注册表默认序兜底（=改造前 JSX 块序；canvas.blocks 失败/空时用） */
const APPT_LIVE_DEFAULT_ORDER = [
  'apptLive.header',
  'apptLive.incident',
  'apptLive.stepper',
  'apptLive.boardingStay',
  'apptLive.review',
  'apptLive.contact',
] as const

/* 预览合成单：B7 显式 b7State 时使用五态只读夹具；未显式给态时保持洗护中。
   查询带 id 闸不拉取，零真数据零写库；真用户页不使用该夹具。 */
function exampleApptLiveOf(state: ServiceProcessPreviewState): AppointmentDetail {
  const preview = serviceProcessPreviewAppointment(state)
  return {
    appointment: {
      id: preview.id,
      code: 'EXAMPL',
      customerId: 'canvas-example-customer',
      storeId: 'canvas-example-store',
      staffId: null,
      assignSource: null,
      petId: 'canvas-example-pet',
      serviceId: 'canvas-example-service',
      type: 'grooming',
      scheduledStart: preview.scheduledStart,
      scheduledEnd: preview.scheduledEnd,
      status: preview.status,
      priceFen: 12800,
      paymentMode: 'pay_at_store',
      paidAt: null,
      paidFen: null,
      note: null,
      cancelReason: null,
      cancelSource: null,
      emergencyContactJson: null,
      medicalAuthJson: null,
      walkTimesPerDay: null,
      checkedInAt: preview.checkedInAt,
      completedAt: preview.completedAt,
      rating: null,
      review: null,
      receptionistId: null,
      createdAt: preview.createdAt,
      updatedAt: preview.checkedInAt ?? preview.createdAt,
    },
    pet: { id: 'canvas-example-pet', name: '豆豆', avatarUrl: null },
    service: { id: 'canvas-example-service', name: '标准洗护' },
    store: {
      id: 'canvas-example-store',
      name: '静安寺店',
      address: '示例路 1 号·画布预览',
      lat: null,
      lng: null,
      phone: null,
    },
    steps: [],
    boardingStay: null,
    customer: { nickname: '示例客户·画布预览', phoneTail: null },
    cashierBillId: null,
    addons: [],
    rescheduleLogs: [],
  } as unknown as AppointmentDetail
}

/* 件 6：合成示例六步流（消毒/预检已完成 → 洗护进行中 → 余步锁定；空照片位=虚线补位框） */
const EXAMPLE_LIVE_STEPS: StepCache[] = (() => {
  const t1 = new Date('2026-10-12T14:05:00')
  const t2 = new Date('2026-10-12T14:20:00')
  const mk = (
    stepKey: string,
    stepOrder: number,
    status: StepCache['status'],
    requiredPhotos: number,
    startedAt: Date | null,
    doneAt: Date | null,
  ): StepCache => ({
    id: `canvas-example-step-${stepKey}`,
    appointmentId: 'canvas-example-appt',
    stepKey,
    stepOrder,
    status,
    requiredPhotos,
    flagged: false,
    startedAt,
    doneAt,
    createdAt: t1,
    updatedAt: doneAt ?? startedAt ?? t1,
    photos: [],
  })
  return [
    mk('disinfection', 1, 'done', 0, t1, t1),
    mk('precheck', 2, 'done', 1, t1, t2),
    mk('grooming', 3, 'active', 2, t2, null),
    mk('detail', 4, 'locked', 0, null, null),
    mk('before_after', 5, 'locked', 2, null, null),
    mk('confirm', 6, 'locked', 0, null, null),
  ]
})()

/** SSE clientId：localStorage 持久化（契约 · push.subscribe 与 /api/events 共用） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = safeUuid()
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage 不可用（隐私模式等）：退化为页面级随机 id，SSE 仍可用
    return safeUuid()
  }
}

/** active 步操作说明键表（LiveStepper description 槽位；画布批片 3 抽键，原写死文案逐字落默认值） */
const ACTIVE_HINT_KEYS: Record<string, AppointmentsCopyKey> = {
  disinfection: 'appointments.hintDisinfection',
  precheck: 'appointments.hintPrecheck',
  grooming: 'appointments.hintGrooming',
  detail: 'appointments.hintDetail',
  before_after: 'appointments.hintBeforeAfter',
  // v1.1-b3 B3-5（A-P2-13）：确认步由洗护师完成核销确认，删除「等待家长确认接回」歧义表述
  confirm: 'appointments.hintConfirm',
}

const fmtTime = (d: Date) => format(d, 'HH:mm')

/** 异常类型 → apc 文案键（未知类型兜底=应激，不画假类型名） */
const INCIDENT_TYPE_KEY: Record<string, AppointmentsCopyKey> = {
  injury: 'appointments.incidentTypeInjury',
  stress: 'appointments.incidentTypeStress',
  vet_visit: 'appointments.incidentTypeVetVisit',
}

/** 异常通报条行件（incident.listForAppointment 透出列） */
interface IncidentRow {
  id: string
  type: string
  description: string
  occurredAt: Date
  handledAt: Date | null
  handledNote: string | null
}

/** 日历日差（同一天=0） */
function calendarDayDiff(a: Date, b: Date): number {
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((dayStart(a) - dayStart(b)) / 86_400_000)
}

/* ---------------- serviceStep.list 缓存结构（乐观更新用，与服务端返回同构） ---------------- */

interface StepPhotoCache {
  id: string
  stepId: string
  url: string
  thumbUrl: string | null
  tag: string
  takenBy: string | null
  takenAt: Date | null
  invalidatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface StepCache {
  id: string
  appointmentId: string
  stepKey: string
  stepOrder: number
  status: 'locked' | 'active' | 'done'
  requiredPhotos: number
  flagged: boolean
  startedAt: Date | null
  doneAt: Date | null
  createdAt: Date
  updatedAt: Date
  photos: StepPhotoCache[]
}

/** step_updated 乐观合并：对应步 append 新照片（按 url 去重）并推进状态；下一步 locked→active */
function mergeStepUpdate(
  old: StepCache[] | undefined,
  data: { stepKey?: string; status?: string; photos?: Array<{ url?: string; thumbUrl?: string | null }>; nextStepKey?: string | null },
): StepCache[] | undefined {
  if (!Array.isArray(old)) return old
  const payloadPhotos = Array.isArray(data.photos) ? data.photos : []
  const now = new Date()
  return old.map((step) => {
    if (step.stepKey === data.stepKey) {
      const existing = new Set(step.photos.map((p) => p.url))
      const appended: StepPhotoCache[] = payloadPhotos
        .filter((p): p is { url: string; thumbUrl?: string | null } => !!p?.url && !existing.has(p.url))
        .map((p) => ({
          id: `live-${p.url}`,
          stepId: step.id,
          url: p.url,
          thumbUrl: p.thumbUrl ?? null,
          tag: 'normal',
          takenBy: null,
          takenAt: now,
          invalidatedAt: null,
          createdAt: now,
          updatedAt: now,
        }))
      return {
        ...step,
        status: data.status === 'done' ? 'done' : step.status,
        doneAt: data.status === 'done' ? step.doneAt ?? now : step.doneAt,
        photos: [...step.photos, ...appended],
      }
    }
    if (data.nextStepKey && step.stepKey === data.nextStepKey && step.status === 'locked') {
      return { ...step, status: 'active' as const, startedAt: step.startedAt ?? now }
    }
    return step
  })
}

/** 步骤照片 → PhotoWallPhoto；before_after 步强制 before 左 / after 右（哇塞时刻） */
function toWallPhotos(step: StepCache): PhotoWallPhoto[] {
  const mapOne = (p: StepPhotoCache): PhotoWallPhoto => ({
    id: p.id,
    url: p.url,
    thumbUrl: p.thumbUrl ?? undefined,
  })
  if (step.stepKey === 'before_after') {
    const before = step.photos.find((p) => p.tag === 'before') ?? step.photos[0]
    const after = step.photos.find((p) => p.tag === 'after')
    return [before, after].filter((p): p is StepPhotoCache => !!p).map(mapOne)
  }
  return step.photos.map(mapOne)
}

/* ------------------------------------------------------------------ */
/* 页面                                                                  */
/* ------------------------------------------------------------------ */

export default function AppointmentLivePage() {
  const { id: routeAid } = useParams<{ id: string }>()
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const [clientId] = useState(getClientId)

  /* 画布预览探针参识别（?canvasPreview=1）+ 预览店锚（?canvasStore=） */
  const isCanvasPreview = useMemo(() => new URLSearchParams(window.location.search).get('canvasPreview') === '1', [])
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const b7PreviewState = useMemo(
    () => parseServiceProcessPreviewState(new URLSearchParams(window.location.search).get('b7State')),
    [],
  )
  const explicitB7Preview = isCanvasPreview && routeAid === 'preview' && b7PreviewState !== null

  /* canvasPreview=1 且 id='preview'：显式 b7State 直接用五态夹具；否则沿用预约列表首条，
     查不到再以洗护中合成单顶替。各带 id 查询在 previewMiss 下不拉取。 */
  const previewListQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: isCanvasPreview && routeAid === 'preview' && !explicitB7Preview,
  })
  const previewFirstId = useMemo(() => {
    const g = previewListQ.data?.groups
    return g ? (Object.values(g).flat()[0]?.id ?? null) : null
  }, [previewListQ.data])
  const aid = resolveServiceProcessRouteAid({ explicitB7Preview, isCanvasPreview, routeAid, previewFirstId })
  const previewMiss = explicitB7Preview || (isCanvasPreview && routeAid === 'preview' && !previewListQ.isPending && aid === '')
  const exampleD = useMemo(
    () => (previewMiss ? exampleApptLiveOf(b7PreviewState ?? 'in-progress') : null),
    [previewMiss, b7PreviewState],
  )

  /* ---------------- 查询 ---------------- */

  // 断线兜底（SSE 断开 >5s）时主查询挂 30s refetchInterval
  const [sseDown, setSseDown] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid! }),
    enabled: !!aid,
    refetchInterval: sseDown ? 30_000 : false,
  })
  const detailData = exampleD ?? detailQuery.data
  const appt = detailData?.appointment
  const pet = detailData?.pet
  const displayPetName = customerPetName(pet?.name, apc('appointments.livePetFallback'))
  const service = detailData?.service
  const store = detailData?.store

  const isBoarding = appt?.type === 'boarding'
  const inLiveFlow =
    appt?.status === 'in_service' || appt?.status === 'in_boarding' || appt?.status === 'completed'

  const stepsQuery = useQuery({
    queryKey: ['serviceStep', 'list', aid],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && !isBoarding && inLiveFlow,
    refetchInterval: sseDown ? 30_000 : false,
  })
  const steps = (exampleD ? EXAMPLE_LIVE_STEPS : stepsQuery.data) as StepCache[] | undefined
  const processSteps = (exampleD ? serviceProcessPreviewSteps(b7PreviewState ?? 'in-progress') : stepsQuery.data) as ServiceProcessStep[] | undefined

  const myStayQuery = useQuery({
    queryKey: ['boarding', 'myStay', aid],
    queryFn: () => trpc.boarding.myStay.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && isBoarding && inLiveFlow,
    refetchInterval: sseDown ? 30_000 : false,
  })

  // 寄养安心卡（体验批片 4 B17）：stay+最新打卡+拆封留痕聚合读口
  const assuranceQuery = useQuery({
    queryKey: ['boarding', 'assurance', aid],
    queryFn: () => trpc.boarding.assuranceCard.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && isBoarding && inLiveFlow,
    refetchInterval: sseDown ? 30_000 : false,
  })

  // 异常通报条数据源（体验批片 4）：当事人可读，洗护/寄养 live 态都挂
  const incidentQuery = useQuery({
    queryKey: ['incident', 'list', aid],
    queryFn: () => trpc.incident.listForAppointment.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && inLiveFlow,
    refetchInterval: sseDown ? 30_000 : false,
  })

  // 断线兜底轮询（§7.4）：轻量 progressSummary，数据变化时全量对齐（防事件序错乱）
  const summaryQuery = useQuery({
    queryKey: ['serviceStep', 'progressSummary', aid],
    queryFn: () => trpc.serviceStep.progressSummary.query({ appointmentId: aid! }),
    enabled: !!aid && sseDown && inLiveFlow && appt?.status !== 'completed',
    refetchInterval: 30_000,
  })

  // U4-D2 美容师行：指派员工名=store.listStaffPublic 现成接口按 staffId 解析
  // （U4-B 同口径，零新接口）；未指派/查询失败 → staffName=null，摘要卡该段隐去不造假
  // 件 6：合成示例单（previewMiss）不拉员工真查询（零增发）
  const staffQ = useQuery({
    queryKey: ['store', 'listStaffPublic', appt?.storeId],
    queryFn: () => trpc.store.listStaffPublic.query({ storeId: appt!.storeId }),
    enabled: !!user && !!appt?.storeId && !previewMiss,
    staleTime: 300_000,
  })
  const staffName = useMemo(() => {
    if (!appt?.staffId) return null
    return staffQ.data?.staff.find((s) => s.id === appt.staffId)?.name ?? null
  }, [appt, staffQ.data])

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  /* 店锚=?canvasStore= 预览店锚 > 本单门店（appointment.get 透出 store.id，零新增查询）；
     件 6：合成示例单的假店 id 不进布局锚（预览店锚缺省=null 走全局布局） */
  const liveStoreId = previewStoreId ?? (previewMiss ? null : store?.id) ?? null
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'apptLive')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : APPT_LIVE_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('apptLive', liveStoreId, registryBlocks)

  /* ---------------- 全量对齐 ---------------- */

  const alignAll = useCallback(() => {
    if (!aid) return
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'myStay', aid] })
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'assurance', aid] })
    void queryClient.invalidateQueries({ queryKey: ['incident', 'list', aid] })
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'progressSummary', aid] })
  }, [queryClient, aid])

  // progressSummary 轮询结果变化 → 全量对齐（按数据签名比对，避免失效-重取循环）
  const lastSummarySigRef = useRef('')
  useEffect(() => {
    const d = summaryQuery.data
    if (!d) return
    const sig = JSON.stringify(d)
    if (lastSummarySigRef.current && lastSummarySigRef.current !== sig) alignAll()
    lastSummarySigRef.current = sig
  }, [summaryQuery.data, alignAll])

  /* ---------------- toast / 庆祝 / 查看器 ---------------- */

  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  const [celebrating, setCelebrating] = useState(false)
  useEffect(() => {
    if (!celebrating) return
    const t = window.setTimeout(() => setCelebrating(false), 2600)
    return () => window.clearTimeout(t)
  }, [celebrating])

  const [viewer, setViewer] = useState<{ photos: PhotoWallPhoto[]; index: number } | null>(null)

  /* ---------------- SSE：先 subscribe 登记，再连 /api/events ---------------- */

  const [subscribed, setSubscribed] = useState(false)
  useEffect(() => {
    if (!user || explicitB7Preview) return
    let cancelled = false
    let timer: number | undefined
    const attempt = () => {
      trpc.push.subscribe
        .mutate({ clientId, appType: 'customer' })
        .then(() => {
          if (!cancelled) setSubscribed(true)
        })
        .catch(() => {
          // 登记失败（弱网等）：5s 后重试，直到成功或离开页面
          if (!cancelled) timer = window.setTimeout(attempt, 5000)
        })
    }
    attempt()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [trpc, clientId, user, explicitB7Preview])

  const sseUrl =
    subscribed && aid
      ? `${getApiBase()}/api/events?client_id=${encodeURIComponent(clientId)}&watch=${encodeURIComponent(aid)}`
      : null

  // 事件去重：envelope.id Set（FIFO 500 条上限防膨胀；重连补发/多端同事件会重复到达）
  const seenRef = useRef<{ set: Set<string>; queue: string[] }>({ set: new Set(), queue: [] })
  const markSeen = useCallback((id: string): boolean => {
    const s = seenRef.current
    if (s.set.has(id)) return false
    s.set.add(id)
    s.queue.push(id)
    if (s.queue.length > 500) {
      const oldest = s.queue.shift()
      if (oldest) s.set.delete(oldest)
    }
    return true
  }, [])

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      if (!markSeen(envelope.id)) return
      const data = (envelope.data ?? {}) as Record<string, unknown>
      // user 频道会混进其他预约的事件，只处理本预约
      if (typeof data.appointmentId === 'string' && data.appointmentId !== aid) return

      switch (envelope.type) {
        case EventType.StepUpdated:
          // 乐观 append 照片（新照片淡入由 PhotoWall onLoad 过渡完成）+ 精确 invalidate
          queryClient.setQueryData<StepCache[] | undefined>(['serviceStep', 'list', aid], (old) =>
            mergeStepUpdate(old, data),
          )
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
          if (data.stepKey === 'confirm' && data.status === 'done') {
            void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
          }
          break
        case EventType.StepFlagged:
          // 打标重拍：旧照片服务端已作废，必须全量对齐
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
          break
        case EventType.AppointmentCompleted:
          setCelebrating(true)
          void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
          break
        case EventType.BoardingDailyUpdate: {
          const logDate = typeof data.logDate === 'string' ? data.logDate : ''
          showToast(apc('appointments.liveToastCheckin', { date: logDate ? `${logDate} ` : '', pet: displayPetName }))
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'myStay', aid] })
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'assurance', aid] })
          break
        }
        case EventType.IncidentReported:
          showToast(apc('appointments.incidentToastReported', { pet: displayPetName }))
          void queryClient.invalidateQueries({ queryKey: ['incident', 'list', aid] })
          break
        case EventType.IncidentHandled:
          showToast(apc('appointments.incidentToastHandled'))
          void queryClient.invalidateQueries({ queryKey: ['incident', 'list', aid] })
          break
        case EventType.BoardingUnsealed: {
          const itemName = typeof data.itemName === 'string' ? data.itemName : ''
          showToast(apc('appointments.unsealToast', { pet: displayPetName, item: itemName }))
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'myStay', aid] })
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'assurance', aid] })
          break
        }
        case EventType.BoardingCompleted:
          setCelebrating(true)
          void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'myStay', aid] })
          break
        case EventType.AppointmentCheckedIn:
        case EventType.AppointmentAssigned:
        case EventType.AppointmentConfirmed:
        case EventType.AppointmentCancelled:
          void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
          break
        case EventType.AppointmentReopened:
          // v1.1-b3 B3-1：completed 单打标重开 → 从完成态回退到服务中，全量对齐
          setCelebrating(false)
          showToast(apc('appointments.liveToastReopen'))
          alignAll()
          break
        default:
          break
      }
    },
    [aid, markSeen, queryClient, displayPetName, showToast, alignAll],
  )

  const { connected } = useEventSource({ url: sseUrl, onEvent, onReconnect: alignAll })

  // connected=false 超 5s → 断线态（连接中细条 + 30s 轮询兜底）
  useEffect(() => {
    if (connected || !sseUrl) {
      setSseDown(false)
      return
    }
    const t = window.setTimeout(() => setSseDown(true), 5000)
    return () => window.clearTimeout(t)
  }, [connected, sseUrl])

  // 页面回前台：静默全量对齐一次（§7.4 锁屏断 SSE 的补偿）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') alignAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [alignAll])

  /* ---------------- 评价 / 分享 ---------------- */

  const reviewMutation = useMutation({
    mutationFn: (input: { rating: number; review?: string; anonymous?: boolean }) =>
      trpc.appointment.review.mutate({ appointmentId: aid!, ...input }),
    onSuccess: () => {
      showToast(apc('appointments.liveReviewThanks'))
      void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
    },
    onError: (err) => showToast(err instanceof Error ? err.message : apc('appointments.liveReviewFail')),
  })

  const share = useCallback(async () => {
    const url = window.location.href
    const text = apc('appointments.liveShareText', {
      pet: displayPetName,
      store: store?.name ?? apc('appointments.liveShareStoreFallback'),
      service: service?.name ?? apc('appointments.fallbackService'),
    })
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: apc('appointments.shareTitle'), text, url })
      } catch {
        // 用户取消分享，无需提示
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      showToast(apc('appointments.shareCopied'))
    } catch {
      showToast(apc('appointments.shareCopyFail'))
    }
  }, [displayPetName, store?.name, service?.name, showToast])

  /* ---------------- 派生展示数据 ---------------- */

  // U4-D2：时间戳口径——done 步出完成时刻（右侧 mono 状态签）；active 步
  // description=操作说明（落 wnote mono 9 工作注，S-01 stepx 逐格）；
  // requiredPhotos=serviceStep.list 既有字段透传（空位虚线框补位依据，不新取数）
  const timelineSteps: LiveStepperStep[] = useMemo(
    () =>
      (steps ?? []).map((s) => {
        const hintKey = ACTIVE_HINT_KEYS[s.stepKey] as AppointmentsCopyKey | undefined
        return {
          stepKey: s.stepKey,
          status: s.status,
          time: s.status === 'done' && s.doneAt ? fmtTime(s.doneAt) : undefined,
          description: s.status === 'active' && hintKey ? apc(hintKey) : undefined,
          photos: toWallPhotos(s),
          requiredPhotos: s.requiredPhotos,
        }
      }),
    [steps],
  )

  const boardingDayCount = useMemo(() => {
    if (!appt || !isBoarding) return 1
    const base = appt.checkedInAt ?? appt.scheduledStart
    return Math.max(1, calendarDayDiff(new Date(), base) + 1)
  }, [appt, isBoarding])

  const stayInfo: BoardingStayInfo | null = useMemo(() => {
    const stay = myStayQuery.data?.stay
    if (!stay) return null
    return {
      roomNo: stay.roomNo,
      checkinWeightKg: stay.checkinWeightKg,
      belongings: stay.belongings ?? null,
      checkoutAt: stay.checkoutAt,
    }
  }, [myStayQuery.data])

  const boardingLogs: BoardingLogItem[] = useMemo(
    () =>
      (myStayQuery.data?.logs ?? []).map((l) => ({
        id: l.id,
        logDate: l.logDate,
        meals: l.meals ?? null,
        walks: l.walks,
        note: l.note,
        photos: l.photos ?? null,
      })),
    [myStayQuery.data],
  )

  // 安心卡数据（assuranceCard 聚合读口 → BoardingLive 安心卡槽位；未取到=undefined 不渲染）
  const assuranceInfo: BoardingAssuranceInfo | undefined = useMemo(() => {
    const a = assuranceQuery.data
    if (!a) return undefined
    return {
      stay: a.stay
        ? {
            roomNo: a.stay.roomNo,
            checkinWeightKg: a.stay.checkinWeightKg,
            belongings: a.stay.belongings ?? null,
            checkoutAt: a.stay.checkoutAt,
          }
        : null,
      latestLog: a.latestLog ? { logDate: a.latestLog.logDate, note: a.latestLog.note } : null,
      unsealLogs: a.unsealLogs.map((u) => ({
        id: u.id,
        itemName: u.itemName,
        note: u.note ?? null,
        createdAt: u.createdAt,
      })),
    }
  }, [assuranceQuery.data])

  const incidents: IncidentRow[] = useMemo(
    () => incidentQuery.data?.incidents ?? [],
    [incidentQuery.data],
  )

  const openStepPhotos = useCallback(
    (_photo: PhotoWallPhoto, index: number, stepKey: string) => {
      const step = timelineSteps.find((s) => s.stepKey === stepKey)
      if (!step?.photos?.length) return
      setViewer({ photos: step.photos, index: Math.min(index, step.photos.length - 1) })
    },
    [timelineSteps],
  )

  /* ---------------- 渲染分支 ---------------- */

  // U1-A：统一返回圆钮（←圆钮）；标题语境由 LiveHeader（宠物+服务名胶囊）承担
  /* 体验急修批 A1：返回=时间序回退 navigate(-1)（原固定 Link 压栈致全程↔详情死循环）；
     直访无栈兜底=预约详情父页 */
  const backLink = (
    <BackButton fallback={aid ? `/appointments/${aid}` : '/appointments'} className="mb-3" ariaLabel="返回预约详情" />
  )

  // 加载中（previewMiss=预览顶替未命中：跳过加载态，直走件 6 合成示例单）
  if (detailQuery.isPending && !previewMiss) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-caption text-ink-secondary"><CK k="appointments.liveLoading">{apc('appointments.liveLoading')}</CK></p>
      </div>
    )
  }

  // 异常态：非本人 / 不存在预约 → 友好错误页（状态机分支不入块流，照改造前位置早退）
  if (detailQuery.isError || !appt) {
    const code = (detailQuery.error as { data?: { code?: string } } | null)?.data?.code
    return (
      <div className="px-4 pb-10 pt-6">
        {backLink}
        <div className="u1-card flex flex-col items-center px-6 py-12 text-center">
          <CircleX className="h-10 w-10 text-ink-placeholder" strokeWidth={1.5} />
          <h1 className="mt-3 text-title"><CK k="appointments.liveErrTitle">{apc('appointments.liveErrTitle')}</CK></h1>
          <p className="mt-2 text-body text-ink-secondary">
            {code === 'FORBIDDEN' ? (
              <CK k="appointments.liveErrForbidden">{apc('appointments.liveErrForbidden')}</CK>
            ) : (
              <CK k="appointments.liveErrNotFound">{apc('appointments.liveErrNotFound')}</CK>
            )}
          </p>
          <Link
            to="/appointments"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-philia-gradient px-6 text-body font-semibold text-[#F6EFDD] shadow-philia"
          >
            <CK k="appointments.liveErrBackCta">{apc('appointments.liveErrBackCta')}</CK>
          </Link>
        </div>
      </div>
    )
  }

  const completed = appt.status === 'completed'

  // U4-D2 摘要卡美容师行：「{员工}服务中 · 预计 HH:MM 完成」（缺真值段隐去）；
  // 寄养态=「寄养中 · 第 N 天」（scheduledEnd 为离店日，不出 ETA 免歧义）
  const headerMeta = (() => {
    if (appt.status === 'in_service') {
      const parts: string[] = []
      if (staffName) parts.push(apc('appointments.liveMetaStaff', { staff: staffName }))
      if (appt.scheduledEnd) parts.push(apc('appointments.liveMetaEta', { time: fmtTime(appt.scheduledEnd) }))
      return parts.length > 0 ? parts.join(' · ') : null
    }
    if (appt.status === 'in_boarding') return apc('appointments.liveMetaBoarding', { n: boardingDayCount })
    return null
  })()

  const header = (
    <LiveHeader
      petName={displayPetName}
      petAvatarUrl={pet?.avatarUrl}
      serviceName={service?.name ?? apc(isBoarding ? 'appointments.liveServiceBoarding' : 'appointments.liveServiceGrooming')}
      meta={headerMeta}
      state={completed ? 'done' : inLiveFlow ? 'live' : 'plain'}
      sseConnected={connected}
    />
  )

  // U4-D2：统一返回条补题（试样 05 nav：←圆钮 +「洗护全程」）
  const nav = (
    <PageHeader
      title={
        <CK k={isBoarding ? 'appointments.liveTitleBoarding' : 'appointments.liveTitleGrooming'}>
          {isBoarding ? apc('appointments.liveTitleBoarding') : apc('appointments.liveTitleGrooming')}
        </CK>
      }
      fallback={aid ? `/appointments/${aid}` : '/appointments'}
      className="mb-3"
    />
  )

  if (!isBoarding && appt.status !== 'cancel_requested' && appt.status !== 'cancelled') {
    return (
      <>
        <ConnectionBar visible={sseDown} />
        <LiveToast message={toast} />
        <CelebrationOverlay visible={celebrating} petName={pet?.name} />
        {viewer ? (
          <PhotoViewer
            photos={viewer.photos}
            index={viewer.index}
            onClose={() => setViewer(null)}
            onNavigate={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
            keyboard={false}
          />
        ) : null}
        <CanvasLayoutLoader pageKey="apptLive" storeId={liveStoreId}>
          <GroomingServiceProcess
            layout={layout}
            appointment={appt}
          petName={displayPetName}
          serviceName={service?.name ?? apc('appointments.liveServiceGrooming')}
          storeName={store?.name ?? apc('appointments.liveShareStoreFallback')}
          steps={processSteps ?? []}
          stepsLoading={stepsQuery.isPending && !previewMiss && (appt.status === 'in_service' || completed)}
          stepsError={stepsQuery.isError && !previewMiss && (appt.status === 'in_service' || completed)}
          onRetrySteps={() => void stepsQuery.refetch()}
          previewState={explicitB7Preview ? (b7PreviewState ?? undefined) : undefined}
          isPreview={isCanvasPreview}
          fallbackPath={aid ? `/appointments/${aid}` : '/appointments'}
          previewNote={isCanvasPreview ? (
            <p className="mb-2 text-center text-caption-xs text-ink-secondary" data-testid="appt-live-canvas-preview-note">
              {mc('mc.canvasExampleNote')}
            </p>
          ) : undefined}
          incident={<IncidentBanner incidents={incidents} largeText />}
          review={completed ? (
            <div className="mt-4">
              <ReviewPanel
                accent="neutral"
                existingRating={appt.rating}
                existingReview={appt.review}
                submitting={reviewMutation.isPending}
                onSubmit={(rating, text, anonymous) =>
                  reviewMutation.mutate({ rating, review: text.length > 0 ? text : undefined, anonymous })
                }
                onShare={() => void share()}
              />
            </div>
          ) : null}
          contact={!completed ? (
            <div className="mt-3">
              <ContactStore phone={store?.phone ?? null} />
            </div>
          ) : null}
          onOpenPhotos={(photos, index) => setViewer({ photos, index })}
          />
        </CanvasLayoutLoader>
      </>
    )
  }

  // 寄养 pending / confirmed 与取消审核：保留原预约码引导；洗护正常五态已在上行进入 B7。
  if (appt.status === 'pending' || appt.status === 'confirmed' || appt.status === 'cancel_requested') {
    const cancelRequested = appt.status === 'cancel_requested'
    return (
      <div className="px-4 pb-10 pt-4">
        {nav}
        {header}
        <div className="u1-card mt-3 flex flex-col items-center px-6 py-10 text-center">
          {cancelRequested ? (
            <CircleX className="h-10 w-10 text-ink-placeholder" strokeWidth={1.5} />
          ) : (
            <CalendarClock className="h-10 w-10 text-brand-primary" strokeWidth={1.5} />
          )}
          <h2 className="mt-3 text-title">
            <CK k={cancelRequested ? 'appointments.liveCancelReviewTitle' : 'appointments.livePendingTitle'}>
              {cancelRequested ? apc('appointments.liveCancelReviewTitle') : apc('appointments.livePendingTitle')}
            </CK>
          </h2>
          <p className="mt-2 text-body text-ink-secondary">
            {cancelRequested ? (
              <CK k="appointments.liveCancelReviewBody">{apc('appointments.liveCancelReviewBody')}</CK>
            ) : (
              <CK k="appointments.livePendingBody">
                {apc('appointments.livePendingBody', {
                  time: format(appt.scheduledStart, 'M月d日 HH:mm'),
                  kind: apc(isBoarding ? 'appointments.liveKindBoarding' : 'appointments.liveKindGrooming'),
                })}
              </CK>
            )}
          </p>
          {!cancelRequested ? (
            <Link
              to={`/appointments/${appt.id}`}
              className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-philia-gradient px-6 text-body font-semibold text-[#F6EFDD] shadow-philia"
            >
              <QrCode className="h-5 w-5" strokeWidth={1.5} />
              <CK k="appointments.liveShowCode">{apc('appointments.liveShowCode')}</CK>
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  // cancelled：已取消提示（状态机分支不入块流）
  if (appt.status === 'cancelled') {
    return (
      <div className="px-4 pb-10 pt-4">
        {nav}
        {header}
        <div className="u1-card mt-3 flex flex-col items-center px-6 py-10 text-center">
          <CircleX className="h-10 w-10 text-ink-placeholder" strokeWidth={1.5} />
          <h2 className="mt-3 text-title"><CK k="appointments.liveCancelledTitle">{apc('appointments.liveCancelledTitle')}</CK></h2>
          <p className="mt-2 text-body text-ink-secondary"><CK k="appointments.liveCancelledBody">{apc('appointments.liveCancelledBody')}</CK></p>
          <Link
            to="/booking"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-philia-gradient px-6 text-body font-semibold text-[#F6EFDD] shadow-philia"
          >
            <CK k="appointments.liveRebook">{apc('appointments.liveRebook')}</CK>
          </Link>
        </div>
      </div>
    )
  }

  // 门店电话：stores.phone 已在仓（0042 迁移），无值隐藏（契约口径）
  const storePhone = store?.phone ?? null

  /* 块渲染器（特别裁 §五.2：画布只控区块壳——块内实时数据/状态机/查询逐字搬，不接区块 props） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. apptLive.header：统一返回条（洗护全程/寄养全程）+ 宠物摘要卡（LiveHeader props
          组装段；组件内状态签「已完成/实时同步/重连中」无 CK 锚——见 NOTES） */
    'apptLive.header': () => (
      <>
        {nav}
        {header}
      </>
    ),

    /* 2. apptLive.incident：异常通报条（LiveHeader 之后、主体之前；零异常不渲染） */
    'apptLive.incident': () => <IncidentBanner incidents={incidents} />,

    /* 3. apptLive.stepper：洗护六步进度流（去卡壳直上画布；boarding 态本块不渲染，
          与 boardingStay 块互斥——原三分支 ternary 拆块逐字搬） */
    'apptLive.stepper': () =>
      !isBoarding ? (
        <div className="mt-3.5">
          {stepsQuery.isPending && !previewMiss ? (
            <div className="u1-card p-6 text-center">
              <p className="text-caption text-ink-secondary"><CK k="appointments.liveStepsLoading">{apc('appointments.liveStepsLoading')}</CK></p>
            </div>
          ) : (
            /* U4-D2：stepper 去卡壳直上画布（试样 05 .steps 无卡），工艺取齐见 LiveStepper 头注 */
            <LiveStepper steps={timelineSteps} onPhotoClick={openStepPhotos} />
          )}
        </div>
      ) : null,

    /* 4. apptLive.boardingStay：寄养安心卡+每日打卡（BoardingLive 整件；组件内文案
          assurance 系键已走 apc 端口但无 CK 锚；入住信息卡等写死段见 NOTES） */
    'apptLive.boardingStay': () =>
      isBoarding ? (
        <div className="mt-3.5">
          <BoardingLive
            stay={stayInfo}
            logs={boardingLogs}
            assurance={assuranceInfo}
            onPhotoClick={(photos, index) => setViewer({ photos, index })}
          />
        </div>
      ) : null,

    /* 5. apptLive.review：完成态评价区（完成时刻行 + ReviewPanel 合规件；ReviewPanel
          组件内文案无 CK 锚；完成时刻行含 mono 样式插值不抽键——见 NOTES） */
    'apptLive.review': () =>
      completed ? (
        <>
          {completedAtLine(appt.completedAt)}
          <div className="mt-3">
            <ReviewPanel
              existingRating={appt.rating}
              existingReview={appt.review}
              submitting={reviewMutation.isPending}
              onSubmit={(rating, text, anonymous) =>
                reviewMutation.mutate({ rating, review: text.length > 0 ? text : undefined, anonymous })
              }
              onShare={() => void share()}
            />
          </div>
        </>
      ) : null,

    /* 6. apptLive.contact：联系门店条（完成前；ContactStore 共享件内写死文案无 CK 锚——见 NOTES） */
    'apptLive.contact': () =>
      !completed ? (
        <div className="mt-3">
          <ContactStore phone={storePhone} />
        </div>
      ) : null,
  }

  // 主流程：grooming 六步流 / boarding 寄养时间线
  return (
    <CanvasLayoutLoader pageKey="apptLive" storeId={liveStoreId}>
      <div className="px-4 pb-10 pt-4">
        {/* 弹层/浮件不入块流（照改造前位置挂载）：断线细条/即时 toast/庆祝微动效/照片查看器 */}
        <ConnectionBar visible={sseDown} />
        <LiveToast message={toast} />
        <CelebrationOverlay visible={celebrating} petName={pet?.name} />
        {viewer ? (
          <PhotoViewer
            photos={viewer.photos}
            index={viewer.index}
            onClose={() => setViewer(null)}
            onNavigate={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
            keyboard={false}
          />
        ) : null}

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="mb-3 text-center text-caption-xs text-ink-secondary" data-testid="appt-live-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
        ) : null}

        {/* 块流：六块按有效布局渲染（published 覆盖∪默认序尾补）；stepper/boardingStay
            与 review/contact 两组互斥块自带渲染闸，默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
      </div>
    </CanvasLayoutLoader>
  )
}

/** 完成时间行（completed 态展示；时刻落 mono 轨） */
function completedAtLine(completedAt: Date | null) {
  if (!completedAt) return null
  return (
    <p className="mt-3 text-center text-caption text-ink-secondary">
      服务已于 <span className="u1-num">{format(completedAt, 'M月d日 HH:mm')}</span> 完成
    </p>
  )
}

/**
 * 异常通报条（体验批片 4）：未处置=赭红高亮卡（类型+描述+发生时刻+「门店处理中」签）；
 * 全部已处置=暖底细条（最近一条处置说明，缺说明兜底描述原文）；零异常不渲染。
 */
function IncidentBanner({ incidents, largeText = false }: { incidents: IncidentRow[]; largeText?: boolean }) {
  if (incidents.length === 0) return null
  const captionClass = largeText ? 'text-caption' : 'text-caption-xs'
  const open = incidents.filter((i) => !i.handledAt)
  if (open.length > 0) {
    return (
      <section data-testid="incident-banner" className="mt-3 rounded-card bg-danger-light p-4">
        <h2 className="flex items-center gap-1.5 text-title text-danger-deep">
          <TriangleAlert className="h-5 w-5" strokeWidth={1.5} />
          <CK k="appointments.incidentTitle">{apc('appointments.incidentTitle')}</CK>
        </h2>
        <ul className="mt-2 space-y-2.5">
          {open.map((i) => (
            <li key={i.id}>
              <p className="flex items-center gap-2 text-body font-medium text-ink">
                <CK k={INCIDENT_TYPE_KEY[i.type] ?? 'appointments.incidentTypeStress'}>
                  {apc(INCIDENT_TYPE_KEY[i.type] ?? 'appointments.incidentTypeStress')}
                </CK>
                <span className={`rounded-chip bg-danger px-1.5 py-0.5 ${captionClass} font-semibold text-destructive-foreground`}>
                  <CK k="appointments.incidentHandling">{apc('appointments.incidentHandling')}</CK>
                </span>
              </p>
              <p className="mt-0.5 text-body-sm text-ink">{i.description}</p>
              <p className={`u1-num mt-0.5 ${captionClass} text-ink-secondary`}>
                <CK k="appointments.incidentOccurredAt">{apc('appointments.incidentOccurredAt', { time: format(i.occurredAt, 'M月d日 HH:mm') })}</CK>
              </p>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  // 全部已处置：listForAppointment 创建倒序，首个 handledAt 非空即最近处置
  const latest = incidents.find((i) => i.handledAt)
  const note = latest?.handledNote ?? latest?.description ?? ''
  return (
    <p
      data-testid="incident-banner"
      className="mt-3 rounded-tag bg-brand-secondary-light px-3 py-2 text-caption text-ink-secondary"
    >
      <CK k="appointments.incidentHandledLine">{apc('appointments.incidentHandledLine', { note })}</CK>
    </p>
  )
}
