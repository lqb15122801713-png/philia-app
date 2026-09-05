/**
 * 服务进度实时页 /appointments/:id/live（T2.3 · 开发方案 §8.4 + §7.4）
 *
 * 数据与实时接线：
 * - 首屏：appointment.get（归属/状态/宠物/门店/服务）→ 按 type+status 分支：
 *   grooming（in_service/completed）→ serviceStep.list 六步+未失效照片；
 *   boarding（in_boarding/completed）→ boarding.myStay 住宿单+每日打卡。
 * - SSE：先 push.subscribe 登记（clientId 持久化于 localStorage，crypto.randomUUID()），
 *   再连 GET /api/events?client_id=…&watch=aid（useEventSource）。
 *   step_updated → 对应步照片乐观 append（按 url 去重）+ invalidate；
 *   appointment.completed → 完成态 + 庆祝微动效；boarding.daily_update →
 *   invalidate myStay + 新打卡 toast；事件按 envelope.id Set 去重。
 * - 兜底（§7.4）：onReconnect 全量 refetch；connected=false 超 5s 显示
 *   「连接中…」细条并启用 30s progressSummary 轮询（数据变化时全量对齐，
 *   主查询同时挂 30s refetchInterval）；visibilitychange 回前台全量对齐一次。
 * - 异常态：非本人/不存在 → 友好错误页；pending/confirmed → 预约码引导；
 *   cancel_requested/cancelled → 取消提示。
 */

import {
  EventType,
  getApiBase,
  StepTimeline,
  useEventSource,
  useMe,
  usePhiliaClient,
  type EventEnvelope,
  type PhotoWallPhoto,
  type StepTimelineStep,
} from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarClock, ChevronLeft, CircleX, QrCode } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BoardingLive, { type BoardingLogItem, type BoardingStayInfo } from '../components/live/BoardingLive'
import CelebrationOverlay from '../components/live/CelebrationOverlay'
import ConnectionBar from '../components/live/ConnectionBar'
import ContactStore from '../components/live/ContactStore'
import LiveHeader from '../components/live/LiveHeader'
import LiveToast from '../components/live/LiveToast'
import PhotoViewer from '../components/live/PhotoViewer'
import ReviewPanel from '../components/live/ReviewPanel'

/* ------------------------------------------------------------------ */
/* 常量与工具                                                            */
/* ------------------------------------------------------------------ */

const CLIENT_ID_KEY = 'philia.sseClientId'

/** SSE clientId：localStorage 持久化（契约 · push.subscribe 与 /api/events 共用） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage 不可用（隐私模式等）：退化为页面级随机 id，SSE 仍可用
    return crypto.randomUUID()
  }
}

/** active 步操作说明（StepTimeline description 槽位） */
const ACTIVE_HINT: Record<string, string> = {
  disinfection: '工具消毒确认中，安心第一步',
  precheck: '正在做预检，确认皮肤与毛发状态',
  grooming: '正在洗护美容，新照片会实时出现在这里',
  detail: '细节精修中，快要变美啦',
  before_after: '正在拍摄前后对比照',
  confirm: '等待家长确认接回',
}

const fmtTime = (d: Date) => format(d, 'HH:mm')

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
  const { id: aid } = useParams<{ id: string }>()
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const [clientId] = useState(getClientId)

  /* ---------------- 查询 ---------------- */

  // 断线兜底（SSE 断开 >5s）时主查询挂 30s refetchInterval
  const [sseDown, setSseDown] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid! }),
    enabled: !!aid,
    refetchInterval: sseDown ? 30_000 : false,
  })
  const appt = detailQuery.data?.appointment
  const pet = detailQuery.data?.pet
  const service = detailQuery.data?.service
  const store = detailQuery.data?.store

  const isBoarding = appt?.type === 'boarding'
  const inLiveFlow =
    appt?.status === 'in_service' || appt?.status === 'in_boarding' || appt?.status === 'completed'

  const stepsQuery = useQuery({
    queryKey: ['serviceStep', 'list', aid],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && !isBoarding && inLiveFlow,
    refetchInterval: sseDown ? 30_000 : false,
  })
  const steps = stepsQuery.data as StepCache[] | undefined

  const myStayQuery = useQuery({
    queryKey: ['boarding', 'myStay', aid],
    queryFn: () => trpc.boarding.myStay.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && isBoarding && inLiveFlow,
    refetchInterval: sseDown ? 30_000 : false,
  })

  // 断线兜底轮询（§7.4）：轻量 progressSummary，数据变化时全量对齐（防事件序错乱）
  const summaryQuery = useQuery({
    queryKey: ['serviceStep', 'progressSummary', aid],
    queryFn: () => trpc.serviceStep.progressSummary.query({ appointmentId: aid! }),
    enabled: !!aid && sseDown && inLiveFlow && appt?.status !== 'completed',
    refetchInterval: 30_000,
  })

  /* ---------------- 全量对齐 ---------------- */

  const alignAll = useCallback(() => {
    if (!aid) return
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'myStay', aid] })
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
    if (!user) return
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
  }, [trpc, clientId, user])

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
          showToast(`${logDate ? `${logDate} ` : ''}打卡已更新，快看看${pet?.name ?? '宝贝'}的今天`)
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'myStay', aid] })
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
        default:
          break
      }
    },
    [aid, markSeen, queryClient, pet?.name, showToast],
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
    mutationFn: (input: { rating: number; review?: string }) =>
      trpc.appointment.review.mutate({ appointmentId: aid!, ...input }),
    onSuccess: () => {
      showToast('感谢评价，已转告门店与洗护师')
      void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
    },
    onError: (err) => showToast(err instanceof Error ? err.message : '评价提交失败，请稍后再试'),
  })

  const share = useCallback(async () => {
    const url = window.location.href
    const text = `${pet?.name ?? '宝贝'}在${store?.name ?? '菲丽亚'}完成了${service?.name ?? '服务'}，全程照片可见～`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '菲丽亚服务相册', text, url })
      } catch {
        // 用户取消分享，无需提示
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      showToast('链接已复制，快发给家人朋友吧')
    } catch {
      showToast('复制失败，请手动复制地址栏链接')
    }
  }, [pet?.name, store?.name, service?.name, showToast])

  /* ---------------- 派生展示数据 ---------------- */

  const timelineSteps: StepTimelineStep[] = useMemo(
    () =>
      (steps ?? []).map((s) => ({
        stepKey: s.stepKey,
        status: s.status,
        time:
          s.status === 'done' && s.doneAt
            ? fmtTime(s.doneAt)
            : s.status === 'active' && s.startedAt
              ? `${fmtTime(s.startedAt)} 开始`
              : undefined,
        description: s.status === 'active' ? ACTIVE_HINT[s.stepKey] : undefined,
        photos: toWallPhotos(s),
      })),
    [steps],
  )

  const activeStepOrder = useMemo(
    () => (steps ?? []).find((s) => s.status === 'active')?.stepOrder ?? null,
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

  const openStepPhotos = useCallback(
    (_photo: PhotoWallPhoto, index: number, stepKey: string) => {
      const step = timelineSteps.find((s) => s.stepKey === stepKey)
      if (!step?.photos?.length) return
      setViewer({ photos: step.photos, index: Math.min(index, step.photos.length - 1) })
    },
    [timelineSteps],
  )

  /* ---------------- 渲染分支 ---------------- */

  const backLink = (
    <Link
      to={aid ? `/appointments/${aid}` : '/appointments'}
      className="mb-3 inline-flex items-center gap-0.5 text-caption text-ink-secondary"
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
      预约详情
    </Link>
  )

  // 加载中
  if (detailQuery.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-caption text-ink-secondary">加载中…</p>
      </div>
    )
  }

  // 异常态：非本人 / 不存在预约 → 友好错误页
  if (detailQuery.isError || !appt) {
    const code = (detailQuery.error as { data?: { code?: string } } | null)?.data?.code
    return (
      <div className="px-4 pb-10 pt-6">
        {backLink}
        <div className="flex flex-col items-center rounded-card bg-card px-6 py-12 text-center shadow-card">
          <CircleX className="h-10 w-10 text-ink-placeholder" strokeWidth={1.5} />
          <h1 className="mt-3 text-title">打不开这个进度页</h1>
          <p className="mt-2 text-body text-ink-secondary">
            {code === 'FORBIDDEN'
              ? '这不是你的预约哦，请确认登录的账号是否正确。'
              : '找不到这个预约，可能链接有误或已被删除。'}
          </p>
          <Link
            to="/appointments"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-brand-primary px-6 text-body font-semibold text-white"
          >
            回到我的预约
          </Link>
        </div>
      </div>
    )
  }

  const completed = appt.status === 'completed'
  const capsule = completed
    ? '已完成'
    : appt.status === 'in_service'
      ? activeStepOrder
        ? `服务中 · 第 ${activeStepOrder} 步`
        : '服务中'
      : appt.status === 'in_boarding'
        ? `寄养中 · 第 ${boardingDayCount} 天`
        : ''

  const header = (
    <LiveHeader
      petName={pet?.name ?? '宝贝'}
      petAvatarUrl={pet?.avatarUrl}
      serviceName={service?.name ?? (isBoarding ? '寄养服务' : '洗护服务')}
      storeName={store?.name ?? ''}
      capsule={capsule}
      capsuleTone={completed ? 'done' : 'active'}
    />
  )

  // 预约 pending / confirmed / cancel_requested：服务尚未开始 → 预约码引导
  if (appt.status === 'pending' || appt.status === 'confirmed' || appt.status === 'cancel_requested') {
    const cancelRequested = appt.status === 'cancel_requested'
    return (
      <div className="px-4 pb-10 pt-4">
        {backLink}
        {header}
        <div className="mt-3 flex flex-col items-center rounded-card bg-card px-6 py-10 text-center shadow-card">
          {cancelRequested ? (
            <CircleX className="h-10 w-10 text-ink-placeholder" strokeWidth={1.5} />
          ) : (
            <CalendarClock className="h-10 w-10 text-brand-primary" strokeWidth={1.5} />
          )}
          <h2 className="mt-3 text-title">{cancelRequested ? '取消申请审核中' : '服务尚未开始'}</h2>
          <p className="mt-2 text-body text-ink-secondary">
            {cancelRequested
              ? '门店正在处理你的取消申请，结果会第一时间通知你。'
              : `预约时间 ${format(appt.scheduledStart, 'M月d日 HH:mm')}，到店后出示预约码，店员核销后即可在这里看到${isBoarding ? '寄养' : '洗护'}全程。`}
          </p>
          {!cancelRequested ? (
            <Link
              to={`/appointments/${appt.id}`}
              className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-brand-primary px-6 text-body font-semibold text-white"
            >
              <QrCode className="h-5 w-5" strokeWidth={1.5} />
              出示预约码
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  // cancelled：已取消提示
  if (appt.status === 'cancelled') {
    return (
      <div className="px-4 pb-10 pt-4">
        {backLink}
        {header}
        <div className="mt-3 flex flex-col items-center rounded-card bg-card px-6 py-10 text-center shadow-card">
          <CircleX className="h-10 w-10 text-ink-placeholder" strokeWidth={1.5} />
          <h2 className="mt-3 text-title">预约已取消</h2>
          <p className="mt-2 text-body text-ink-secondary">这次没能相见，期待下次再约。</p>
          <Link
            to="/booking"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-brand-primary px-6 text-body font-semibold text-white"
          >
            重新预约
          </Link>
        </div>
      </div>
    )
  }

  // 门店电话：schema 暂无 phone 字段，防御式读取，无则隐藏（契约口径）
  const storePhone = (store as { phone?: string | null } | null)?.phone ?? null

  // 主流程：grooming 六步流 / boarding 寄养时间线
  return (
    <div className="px-4 pb-10 pt-4">
      <ConnectionBar visible={sseDown} />
      <LiveToast message={toast} />
      <CelebrationOverlay visible={celebrating} petName={pet?.name} />
      {viewer ? (
        <PhotoViewer
          photos={viewer.photos}
          index={viewer.index}
          onClose={() => setViewer(null)}
          onNavigate={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
        />
      ) : null}

      {backLink}
      {header}

      <div className="mt-3">
        {isBoarding ? (
          <BoardingLive
            stay={stayInfo}
            logs={boardingLogs}
            onPhotoClick={(photos, index) => setViewer({ photos, index })}
          />
        ) : stepsQuery.isPending ? (
          <div className="rounded-card bg-card p-6 text-center shadow-card">
            <p className="text-caption text-ink-secondary">正在接入服务进度…</p>
          </div>
        ) : (
          <div className="rounded-card bg-card p-4 shadow-card">
            <StepTimeline steps={timelineSteps} onPhotoClick={openStepPhotos} />
          </div>
        )}
      </div>

      {completed && completedAtLine(appt.completedAt)}

      <div className="mt-3">
        {completed ? (
          <ReviewPanel
            existingRating={appt.rating}
            existingReview={appt.review}
            submitting={reviewMutation.isPending}
            onSubmit={(rating, text) =>
              reviewMutation.mutate({ rating, review: text.length > 0 ? text : undefined })
            }
            onShare={() => void share()}
          />
        ) : (
          <ContactStore phone={storePhone} />
        )}
      </div>
    </div>
  )
}

/** 完成时间行（completed 态展示） */
function completedAtLine(completedAt: Date | null) {
  if (!completedAt) return null
  return (
    <p className="mt-3 text-center text-caption text-ink-secondary">
      服务已于 {format(completedAt, 'M月d日 HH:mm')} 完成
    </p>
  )
}
