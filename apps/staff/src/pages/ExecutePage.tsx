/**
 * 员工端六步执行页（/execute/:appointmentId · T3.3）
 *
 * - 数据：serviceStep.list（首屏六步+未失效照片）+ appointment.get（顶部信息条常显）
 * - 一步一屏横滑卡片；底部唯一主按钮「确认本步完成」（禁用链：上传中 → 还差 N 张 → 可确认）
 * - 弱网：拍照先入 IndexedDB 队列（offlineQueue，契约 2）+ 本地预览"上传中"角标；
 *   startQueueFlusher 在线即冲/'online' 即冲/失败退避；冲完 invalidate 换成服务端真图
 * - step_flagged：SSE + list flagged=1 → 顶部横幅，旧照片服务端已失效，以 list 口径重拍
 * - SSE：push.subscribe(appType='staff') + useEventSource(watch=aid)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { format } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Loader2,
  PawPrint,
  ShieldBan,
} from 'lucide-react'
import {
  EventType,
  SERVICE_STEPS,
  getApiBase,
  getStepDef,
  uploadImage,
  useEventSource,
  useMe,
  usePhiliaClient,
  type EventEnvelope,
  type ServiceStepKey,
} from '@philia/shared'
import {
  enqueuePhotoWithTag,
  pendingPhotos,
  photoTagOf,
  startQueueFlusher,
  type PhotoTag,
  type QueuedPhoto,
} from '../lib/offlineQueue'
import AppointmentBar from '../components/execute/AppointmentBar'
import CelebrationOverlay from '../components/execute/CelebrationOverlay'
import ExecuteToast from '../components/execute/ExecuteToast'
import FlaggedBanner from '../components/execute/FlaggedBanner'
import GuidePage from '../components/execute/GuidePage'
import StepProgressBar from '../components/execute/StepProgressBar'
import StepScreen from '../components/execute/StepScreen'
import type { GridPhoto } from '../components/execute/PhotoGrid'
import type { SlotPhoto } from '../components/execute/BeforeAfterSlots'

const CLIENT_ID_KEY = 'philia.sseClientId'

/** SSE clientId：localStorage 持久化（与 push.subscribe / /api/events 共用） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

type StepStatus = 'locked' | 'active' | 'done'

function ExecutePageCore({ appointmentId }: { appointmentId: string }) {
  const aid = appointmentId
  const navigate = useNavigate()
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const clientId = useMemo(getClientId, [])

  /* ---------------- toast ---------------- */
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  /* ---------------- 数据 ---------------- */
  const stepsQuery = useQuery({
    queryKey: ['serviceStep', 'list', aid],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: aid }),
    enabled: !!aid,
  })
  const apptQuery = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid }),
    enabled: !!aid,
  })
  const steps = stepsQuery.data
  const appt = apptQuery.data

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] })
  }, [queryClient, aid])

  /* ---------------- 弱网队列：待上传照片 + blob 预览 ---------------- */
  const [pending, setPending] = useState<QueuedPhoto[]>([])
  const refreshPending = useCallback(async () => {
    if (!aid) return
    try {
      setPending(await pendingPhotos(aid))
    } catch {
      // IndexedDB 不可用（隐私模式等）：队列降级为不可用，直接拍照上传由 flusher 也无法工作，
      // 这里静默降级，主流程仍可走（拍照入队会 catch 并 toast）
    }
  }, [aid])

  const previewRef = useRef<Record<string, string>>({})
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const cur = previewRef.current
    const next: Record<string, string> = {}
    for (const p of pending) next[p.id] = cur[p.id] ?? URL.createObjectURL(p.blob)
    for (const id of Object.keys(cur)) {
      if (!next[id]) URL.revokeObjectURL(cur[id]!)
    }
    previewRef.current = next
    setPreviewUrls(next)
  }, [pending])
  useEffect(
    () => () => {
      for (const u of Object.values(previewRef.current)) URL.revokeObjectURL(u)
      previewRef.current = {}
    },
    [],
  )

  /* ---------------- 冲队列 flusher（全局挂着；冲一条=upload→addPhotos→删记录） ---------------- */
  useEffect(() => {
    if (!aid) return
    const stop = startQueueFlusher({
      upload: (blob, relDir) => uploadImage(getApiBase(), blob, relDir),
      register: (raid, stepKey, photo) =>
        trpc.serviceStep.addPhotos
          .mutate({
            appointmentId: raid,
            stepKey: stepKey as ServiceStepKey,
            photos: [
              {
                url: photo.url,
                thumbUrl: photo.thumbUrl,
                // before_after 步 tag 由入队时透传（契约兼容扩展）
                tag: (photo as { tag?: PhotoTag }).tag ?? 'normal',
              },
            ],
          })
          .then(() => {}),
      onChange: () => {
        void refreshPending()
        void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
      },
      onDropped: (_rec, err) => {
        showToast(
          `有照片未上传：${err instanceof Error ? err.message : '步骤状态已变化，被服务端拒绝'}`,
        )
        invalidateAll()
      },
    })
    void refreshPending()
    return stop
  }, [aid, trpc, queryClient, refreshPending, showToast, invalidateAll])

  /* ---------------- 在线状态芯片 ---------------- */
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  /* ---------------- SSE：push.subscribe → /api/events ---------------- */
  const [subscribed, setSubscribed] = useState(false)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    let timer: number | undefined
    const attempt = () => {
      trpc.push.subscribe
        .mutate({ clientId, appType: 'staff' })
        .then(() => {
          if (!cancelled) setSubscribed(true)
        })
        .catch(() => {
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

  // 事件去重（重连补发 / 多频道重复到达）
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
      // staff/user 频道混有其他预约事件，只处理本预约
      if (typeof data.appointmentId === 'string' && data.appointmentId !== aid) return
      switch (envelope.type) {
        case EventType.StepUpdated:
          // 他人设备 / 商家监视触发的推进：以服务端 list 为准
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
          break
        case EventType.StepFlagged: {
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
          const key = typeof data.stepKey === 'string' ? data.stepKey : ''
          showToast(`商家要求重拍：${getStepDef(key)?.name ?? '某步骤'}`)
          break
        }
        case EventType.AppointmentCancelled:
          showToast('该预约已取消')
          window.setTimeout(() => navigate('/today'), 1200)
          break
        case EventType.AppointmentCompleted:
          invalidateAll()
          break
        default:
          break
      }
    },
    [aid, markSeen, queryClient, showToast, navigate, invalidateAll],
  )

  useEventSource({
    url: sseUrl,
    onEvent,
    onReconnect: () => {
      // 断线重连：全量对齐（可能漏帧之外的变更）
      invalidateAll()
      void refreshPending()
    },
  })

  // 页面回前台：静默对齐一次（锁屏断 SSE 的补偿）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        invalidateAll()
        void refreshPending()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [invalidateAll, refreshPending])

  /* ---------------- 步屏横滑 ---------------- */
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [viewOrder, setViewOrder] = useState(1)
  const goToStep = useCallback((order: number, smooth = true) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: (order - 1) * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
  }, [])
  const onScrollerScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el || el.clientWidth === 0) return
    setViewOrder(Math.min(6, Math.max(1, Math.round(el.scrollLeft / el.clientWidth) + 1)))
  }, [])

  const activeOrder = useMemo(() => {
    const active = (steps ?? []).find((s) => s.status === 'active')
    return active ? (getStepDef(active.stepKey)?.stepOrder ?? null) : null
  }, [steps])

  // 自动滚到 active 步（首屏 instant；打标回退 / confirm 推进后 smooth）
  const lastAutoOrderRef = useRef<number | null>(null)
  useEffect(() => {
    if (!activeOrder || lastAutoOrderRef.current === activeOrder) return
    const first = lastAutoOrderRef.current === null
    lastAutoOrderRef.current = activeOrder
    const id = requestAnimationFrame(() => goToStep(activeOrder, !first))
    return () => cancelAnimationFrame(id)
  }, [activeOrder, goToStep])

  /* ---------------- 拍照入队（IndexedDB，先本地预览后冲） ---------------- */
  const enqueueFiles = useCallback(
    async (stepKey: string, tag: PhotoTag | undefined, files: FileList) => {
      if (!aid || files.length === 0) return
      try {
        for (const f of Array.from(files)) {
          await enqueuePhotoWithTag({ aid, stepKey, blob: f }, tag)
        }
        await refreshPending()
      } catch {
        showToast('照片本地暂存失败，请检查浏览器存储空间后重试')
      }
    },
    [aid, refreshPending, showToast],
  )

  /* ---------------- confirm ---------------- */
  const [celebrating, setCelebrating] = useState(false)
  const confirmMutation = useMutation({
    mutationFn: (stepKey: string) =>
      trpc.serviceStep.confirmStep.mutate({
        appointmentId: aid,
        stepKey: stepKey as ServiceStepKey,
      }),
    onSuccess: (res) => {
      invalidateAll()
      if (res.appointmentCompleted) {
        // 第 6 步：庆祝页 → 2s 后自动回 /today
        setCelebrating(true)
      }
      // 非末步：invalidate 后 activeStepKey 前移，activeOrder effect 自动滚到下一步屏
    },
    onError: (err) => {
      // 双口径第二道：服务端校验原文 toast
      showToast(err instanceof Error ? err.message : '确认失败，请稍后重试')
      void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
    },
  })

  const photoTapHint = useCallback(() => {
    showToast('v1 暂不支持删除照片，如需重拍请联系商家在监视页打标')
  }, [showToast])

  /* ================= 渲染分支 ================= */

  const queryError = apptQuery.error ?? stepsQuery.error
  if (queryError) {
    const code =
      queryError instanceof TRPCClientError
        ? (queryError.data as { code?: string } | undefined)?.code
        : undefined
    if (code === 'FORBIDDEN') {
      return (
        <GuidePage
          icon={ShieldBan}
          title="无法执行该预约"
          description="该预约未指派给你，或不属于本店（非本人单）"
          actionText="返回今日任务"
          onAction={() => navigate('/today')}
        />
      )
    }
    if (code === 'NOT_FOUND') {
      return (
        <GuidePage
          icon={CircleSlash}
          title="预约不存在"
          description="可能已被取消或删除"
          actionText="返回今日任务"
          onAction={() => navigate('/today')}
        />
      )
    }
    return (
      <GuidePage
        icon={AlertTriangle}
        title="加载失败"
        description={queryError instanceof Error ? queryError.message : '网络异常，请稍后重试'}
        actionText="重试"
        onAction={() => {
          void apptQuery.refetch()
          void stepsQuery.refetch()
        }}
      />
    )
  }

  if (!appt || !steps) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-secondary">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" strokeWidth={1.8} />
        <span className="text-body-lg">加载服务信息…</span>
      </div>
    )
  }

  const { appointment, pet, service } = appt

  // 寄养单走错入口
  if (appointment.type === 'boarding') {
    return (
      <GuidePage
        icon={PawPrint}
        title="这是寄养预约"
        description="寄养服务请走入住登记流程"
        actionText="前往入住登记"
        onAction={() => navigate(`/boarding/${aid}/checkin`)}
      />
    )
  }

  // 非 in_service 引导页（庆祝页优先于 completed 引导）
  if (appointment.status !== 'in_service' && !celebrating) {
    if (appointment.status === 'pending' || appointment.status === 'confirmed') {
      return (
        <GuidePage
          icon={Clock3}
          title="该预约尚未核销"
          description="请先在今日任务页扫码或手动核销，再开始服务"
          actionText="返回今日任务"
          onAction={() => navigate('/today')}
        />
      )
    }
    if (appointment.status === 'completed') {
      return (
        <GuidePage
          icon={CheckCircle2}
          title="服务已完成"
          description="该预约的六步服务已全部完成"
          actionText="返回今日任务"
          onAction={() => navigate('/today')}
        />
      )
    }
    return (
      <GuidePage
        icon={CircleSlash}
        title={appointment.status === 'cancel_requested' ? '取消审核中' : '预约已取消'}
        description="如有疑问请联系商家"
        actionText="返回今日任务"
        onAction={() => navigate('/today')}
      />
    )
  }

  if (steps.length === 0) {
    return (
      <GuidePage
        icon={AlertTriangle}
        title="六步服务流未初始化"
        description="请重新核销或联系商家处理"
        actionText="返回今日任务"
        onAction={() => navigate('/today')}
      />
    )
  }

  /* ---------------- 派生展示数据 ---------------- */
  const statusByKey: Record<string, StepStatus> = {}
  const flaggedKeys = new Set<string>()
  for (const s of steps) {
    statusByKey[s.stepKey] = s.status as StepStatus
    if (s.flagged) flaggedKeys.add(s.stepKey)
  }
  const flaggedNames = [...flaggedKeys].map((k) => getStepDef(k)?.name ?? k)

  const pendingAllCount = pending.length
  const pendingByStep = new Map<string, QueuedPhoto[]>()
  for (const p of pending) {
    const arr = pendingByStep.get(p.stepKey)
    if (arr) arr.push(p)
    else pendingByStep.set(p.stepKey, [p])
  }

  const petMeta =
    pet && (pet.breed || pet.weightKg)
      ? [pet.breed, pet.weightKg ? `${pet.weightKg}kg` : null].filter(Boolean).join(' · ')
      : null

  return (
    <div className="flex h-[calc(100dvh_-_5rem)] flex-col bg-canvas">
      <AppointmentBar
        petName={pet?.name ?? '宠物'}
        petMeta={petMeta}
        temperamentTags={pet?.temperamentTags ?? null}
        serviceName={service?.name ?? null}
        timeText={format(appointment.scheduledStart, 'HH:mm')}
        note={appointment.note ?? null}
        pendingCount={pendingAllCount}
        offline={!online}
      />

      {flaggedNames.length > 0 && <FlaggedBanner stepNames={flaggedNames} />}

      <StepProgressBar
        statusByKey={statusByKey}
        flaggedKeys={flaggedKeys}
        viewingOrder={viewOrder}
        onSelect={(order) => goToStep(order)}
      />

      {/* 一步一屏横滑 */}
      <div
        ref={scrollerRef}
        onScroll={onScrollerScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto"
      >
        {SERVICE_STEPS.map((def) => {
          const row = steps.find((s) => s.stepKey === def.stepKey)
          const status = (row?.status ?? 'locked') as StepStatus
          const serverPhotos: GridPhoto[] = (row?.photos ?? []).map((p) => ({
            key: p.id,
            url: p.thumbUrl ?? p.url,
            tagLabel: p.tag === 'before' ? '服务前' : p.tag === 'after' ? '服务后' : undefined,
          }))
          const queued = pendingByStep.get(def.stepKey) ?? []
          const queuedPhotos: GridPhoto[] = queued
            .filter((p) => previewUrls[p.id])
            .map((p) => ({
              key: `q-${p.id}`,
              url: previewUrls[p.id]!,
              uploading: true,
              tagLabel:
                photoTagOf(p) === 'before' ? '服务前' : photoTagOf(p) === 'after' ? '服务后' : undefined,
            }))
          const serverBefore = (row?.photos ?? []).find((p) => p.tag === 'before')
          const serverAfter = (row?.photos ?? []).find((p) => p.tag === 'after')
          const queuedBefore = queued.find((p) => photoTagOf(p) === 'before')
          const queuedAfter = queued.find((p) => photoTagOf(p) === 'after')
          const beforeSlot: SlotPhoto | null = serverBefore
            ? { url: serverBefore.thumbUrl ?? serverBefore.url }
            : queuedBefore && previewUrls[queuedBefore.id]
              ? { url: previewUrls[queuedBefore.id]!, uploading: true }
              : null
          const afterSlot: SlotPhoto | null = serverAfter
            ? { url: serverAfter.thumbUrl ?? serverAfter.url }
            : queuedAfter && previewUrls[queuedAfter.id]
              ? { url: previewUrls[queuedAfter.id]!, uploading: true }
              : null

          return (
            <div key={def.stepKey} className="h-full w-full shrink-0 snap-center">
              <StepScreen
                def={def}
                status={status}
                flagged={flaggedKeys.has(def.stepKey)}
                serverPhotos={serverPhotos}
                queuedPhotos={queuedPhotos}
                beforeSlot={beforeSlot}
                afterSlot={afterSlot}
                serverCount={serverPhotos.length}
                beforeCount={serverBefore ? 1 : 0}
                afterCount={serverAfter ? 1 : 0}
                pendingAllCount={pendingAllCount}
                confirming={confirmMutation.isPending}
                onFiles={(files) => void enqueueFiles(def.stepKey, undefined, files)}
                onSlotFiles={(tag, files) => void enqueueFiles(def.stepKey, tag, files)}
                onPhotoTap={photoTapHint}
                onConfirm={() => confirmMutation.mutate(def.stepKey)}
              />
            </div>
          )
        })}
      </div>

      <ExecuteToast message={toast} />
      {celebrating && (
        <CelebrationOverlay petName={pet?.name ?? undefined} onDone={() => navigate('/today')} />
      )}
    </div>
  )
}

/** TabBar「执行」入口解析：/execute/current → 今日首个 in_service 单；无则引导页 */
function ResolveCurrentExecute() {
  const { trpc } = usePhiliaClient()
  const navigate = useNavigate()
  const todayQuery = useQuery({
    queryKey: ['appointment', 'listTodayForStaff'],
    queryFn: () => trpc.appointment.listTodayForStaff.query(),
  })

  if (todayQuery.isPending) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-secondary">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-body-lg">正在查找进行中的服务…</p>
      </div>
    )
  }

  const current = (todayQuery.data ?? []).find((item) => item.status === 'in_service')

  if (current) {
    return <Navigate to={`/execute/${current.id}`} replace />
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <PawPrint className="h-12 w-12 text-brand-primary" strokeWidth={1.5} />
      <p className="text-title">当前没有进行中的服务</p>
      <p className="text-body text-ink-secondary">到「今日」扫码核销客户预约码后，即可开始服务执行</p>
      <button
        type="button"
        onClick={() => navigate('/today')}
        className="mt-2 h-14 min-w-[200px] rounded-full bg-philia-gradient text-body-lg font-semibold text-white shadow-philia active:scale-[0.98]"
      >
        回到今日任务
      </button>
    </div>
  )
}

export default function ExecutePage() {
  const { appointmentId } = useParams()
  if ((appointmentId ?? '') === 'current') return <ResolveCurrentExecute />
  return <ExecutePageCore appointmentId={appointmentId ?? ''} />
}
