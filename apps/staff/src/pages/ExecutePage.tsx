/**
 * 员工端六步执行页（/execute/:appointmentId · U2 任务 D 重做）
 *
 * 规格书 §4：返回条（‹ 服务执行 + 右摘要「宠物·服务」）→ 摘要卡（头像柠檬环 +
 * 服务中薄荷签 + 服务·时间·员工 + 右 N/6 Montserrat）→ 竖向 ExecuteStepper
 * （本地副本，连接线 2px 墨 6%）→ 吸底柠檬主钮文案随态。
 * 数据：serviceStep.list/addPhotos/confirmStep + POST /api/upload（全现成）；
 * 服务端不变量（至多 1 active）不碰。
 *
 * 保留既有真链路（U2 重做只换版式）：弱网 IndexedDB 队列 + flusher（upload→addPhotos）、
 * SSE watch=aid（step_updated/flagged/reopened/completed/cancelled）、删除照片二次确认、
 * 打标重拍横幅、庆祝页、各异常态引导页。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock3,
  PawPrint,
  ShieldBan,
} from 'lucide-react'
import {
  EventType,
  SERVICE_STEPS,
  getApiBase,
  getStepDef,
  safeUuid,
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
import CelebrationOverlay from '../components/execute/CelebrationOverlay'
import ExecuteToast from '../components/execute/ExecuteToast'
import FlaggedBanner from '../components/execute/FlaggedBanner'
import GuidePage from '../components/execute/GuidePage'
import ExecuteStepper, { type ExecuteStepRow, type StepPhotoItem } from '../components/execute/ExecuteStepper'
import PageHeader from '../components/PageHeader'
import PhotoViewer from '../components/boarding/PhotoViewer'
import { STEP_NAME } from '../components/today/deck/ServiceCard'

const CLIENT_ID_KEY = 'philia.sseClientId'

/** SSE clientId：localStorage 持久化（与 push.subscribe / /api/events 共用） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = safeUuid()
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return safeUuid()
  }
}

const fmtHM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

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
      // IndexedDB 不可用（隐私模式等）：静默降级，主流程仍可走
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

  /* ---------------- 冲队列 flusher（冲一条=upload→addPhotos→删记录） ---------------- */
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

  /* ---------------- SSE：push.subscribe → /api/events（watch=aid） ---------------- */
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
      if (typeof data.appointmentId === 'string' && data.appointmentId !== aid) return
      switch (envelope.type) {
        case EventType.StepUpdated:
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
          break
        case EventType.StepFlagged: {
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
          const key = typeof data.stepKey === 'string' ? data.stepKey : ''
          const reason =
            typeof data.reason === 'string' && data.reason ? `（原因：${data.reason}）` : ''
          showToast(`商家要求重拍：${getStepDef(key)?.name ?? '某步骤'}${reason}`)
          break
        }
        case EventType.AppointmentCancelled:
          showToast('该预约已取消')
          window.setTimeout(() => navigate('/today'), 1200)
          break
        case EventType.AppointmentReopened:
          invalidateAll()
          showToast('预约已被商家重新开启，请按打标步骤重拍')
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
      invalidateAll()
      void refreshPending()
    },
  })

  // 页面回前台：静默对齐一次
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

  /* ---------------- 拍照入队 ---------------- */
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
      if (res.appointmentCompleted) setCelebrating(true)
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : '确认失败，请稍后重试')
      void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
    },
  })

  /* ---------------- 删除照片（二次确认 → deletePhoto） ---------------- */
  const [deleteTarget, setDeleteTarget] = useState<{ photoId: string; stepKey: string } | null>(null)
  const deletePhotoMutation = useMutation({
    mutationFn: (t: { photoId: string; stepKey: string }) =>
      trpc.serviceStep.deletePhoto.mutate({
        appointmentId: aid,
        stepKey: t.stepKey as ServiceStepKey,
        photoId: t.photoId,
      }),
    onSuccess: () => {
      showToast('照片已删除')
      void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] })
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : '删除失败，请稍后重试')
    },
    onSettled: () => setDeleteTarget(null),
  })

  /* ---------------- 大图查看器 ---------------- */
  const [viewer, setViewer] = useState<{ photos: { id: string; url: string; tag?: string }[]; index: number } | null>(null)

  /* ================= 渲染分支 ================= */

  const queryError = apptQuery.error ?? stepsQuery.error
  if (queryError) {
    const code =
      queryError instanceof TRPCClientError
        ? (queryError.data as { code?: string } | undefined)?.code
        : undefined
    if (code === 'FORBIDDEN') {
      return (
        <GuidePage icon={ShieldBan} title="无法执行该预约" description="该预约未指派给你，或不属于本店（非本人单）" actionText="返回任务台" onAction={() => navigate('/today')} />
      )
    }
    if (code === 'NOT_FOUND') {
      return (
        <GuidePage icon={CircleSlash} title="预约不存在" description="可能已被取消或删除" actionText="返回任务台" onAction={() => navigate('/today')} />
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
    // 加载 >300ms 骨架（禁转圈，动效纲领 §四.2）
    return (
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 animate-pulse rounded-full bg-sunken" />
          <span className="h-6 w-24 animate-pulse rounded-tag bg-sunken" />
        </div>
        <div className="u1-card mt-2 flex items-center gap-3 p-4">
          <span className="h-[52px] w-[52px] animate-pulse rounded-full bg-sunken" />
          <div className="flex-1">
            <div className="h-5 w-28 animate-pulse rounded-tag bg-sunken" />
            <div className="mt-2 h-4 w-44 animate-pulse rounded-tag bg-sunken" />
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <span className="h-7 w-7 animate-pulse rounded-full bg-sunken" />
              <div className="flex-1">
                <div className="h-5 w-24 animate-pulse rounded-tag bg-sunken" />
                <div className="mt-2 h-4 w-36 animate-pulse rounded-tag bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { appointment, pet, service } = appt

  if (appointment.type === 'boarding') {
    return (
      <GuidePage icon={PawPrint} title="这是寄养预约" description="寄养服务请走入住登记流程" actionText="前往入住登记" onAction={() => navigate(`/boarding/${aid}/checkin`)} />
    )
  }

  if (appointment.status !== 'in_service' && !celebrating) {
    if (appointment.status === 'pending' || appointment.status === 'confirmed') {
      return (
        <GuidePage icon={Clock3} title="该预约尚未核销" description="请先在任务台核销到店，再开始服务" actionText="返回任务台" onAction={() => navigate('/today')} />
      )
    }
    if (appointment.status === 'completed') {
      return (
        <GuidePage icon={CheckCircle2} title="服务已完成" description="该预约的六步服务已全部完成" actionText="返回任务台" onAction={() => navigate('/today')} />
      )
    }
    return (
      <GuidePage icon={CircleSlash} title={appointment.status === 'cancel_requested' ? '取消审核中' : '预约已取消'} description="如有疑问请联系商家" actionText="返回任务台" onAction={() => navigate('/today')} />
    )
  }

  if (steps.length === 0) {
    return (
      <GuidePage icon={AlertTriangle} title="六步服务流未初始化" description="请重新核销或联系商家处理" actionText="返回任务台" onAction={() => navigate('/today')} />
    )
  }

  /* ---------------- 派生展示数据 ---------------- */
  const flaggedKeys = new Set<string>()
  for (const s of steps) if (s.flagged) flaggedKeys.add(s.stepKey)
  const flaggedNames = [...flaggedKeys].map((k) => getStepDef(k)?.name ?? k)

  const pendingByStep = new Map<string, QueuedPhoto[]>()
  for (const p of pending) {
    const arr = pendingByStep.get(p.stepKey)
    if (arr) arr.push(p)
    else pendingByStep.set(p.stepKey, [p])
  }
  const pendingAllCount = pending.length

  const rows: ExecuteStepRow[] = SERVICE_STEPS.map((def) => {
    const row = steps.find((s) => s.stepKey === def.stepKey)
    const queued = pendingByStep.get(def.stepKey) ?? []
    const photos: StepPhotoItem[] = [
      ...(row?.photos ?? []).map((p) => ({
        key: p.id,
        serverId: p.id,
        url: p.thumbUrl ?? p.url,
        tagLabel: p.tag === 'before' ? '服务前' : p.tag === 'after' ? '服务后' : undefined,
      })),
      ...queued
        .filter((p) => previewUrls[p.id])
        .map((p) => ({
          key: `q-${p.id}`,
          url: previewUrls[p.id]!,
          uploading: true,
          tagLabel: photoTagOf(p) === 'before' ? '服务前' : photoTagOf(p) === 'after' ? '服务后' : undefined,
        })),
    ]
    const serverBefore = (row?.photos ?? []).find((p) => p.tag === 'before')
    const serverAfter = (row?.photos ?? []).find((p) => p.tag === 'after')
    const queuedBefore = queued.find((p) => photoTagOf(p) === 'before')
    const queuedAfter = queued.find((p) => photoTagOf(p) === 'after')
    const beforeSlot: StepPhotoItem | null = serverBefore
      ? { key: serverBefore.id, url: serverBefore.thumbUrl ?? serverBefore.url }
      : queuedBefore && previewUrls[queuedBefore.id]
        ? { key: `q-${queuedBefore.id}`, url: previewUrls[queuedBefore.id]!, uploading: true }
        : null
    const afterSlot: StepPhotoItem | null = serverAfter
      ? { key: serverAfter.id, url: serverAfter.thumbUrl ?? serverAfter.url }
      : queuedAfter && previewUrls[queuedAfter.id]
        ? { key: `q-${queuedAfter.id}`, url: previewUrls[queuedAfter.id]!, uploading: true }
        : null
    return {
      def,
      status: (row?.status ?? 'locked') as ExecuteStepRow['status'],
      flagged: flaggedKeys.has(def.stepKey),
      doneAt: row?.doneAt ?? null,
      photos,
      beforeSlot,
      afterSlot,
      serverCount: (row?.photos ?? []).length,
      beforeCount: serverBefore ? 1 : 0,
      afterCount: serverAfter ? 1 : 0,
    }
  })

  const activeRow = rows.find((r) => r.status === 'active') ?? null
  const nextDef = activeRow ? SERVICE_STEPS.find((d) => d.stepOrder === activeRow.def.stepOrder + 1) : null
  const nextName = nextDef ? (STEP_NAME[nextDef.stepKey] ?? nextDef.name) : ''

  /* 吸底主钮文案随态（规格书 §4） */
  let primaryText = ''
  let primarySub: string | null = null
  let primaryDisabled = false
  if (activeRow) {
    const isBA = activeRow.def.stepKey === 'before_after'
    const isConfirm = activeRow.def.stepKey === 'confirm'
    const lack = Math.max(0, activeRow.def.minPhotos - activeRow.serverCount)
    const baLack = isBA ? (activeRow.beforeCount < 1 ? 1 : 0) + (activeRow.afterCount < 1 ? 1 : 0) : 0
    if (pendingAllCount > 0) {
      primaryText = '照片上传中…'
      primaryDisabled = true
    } else if (confirmMutation.isPending) {
      primaryText = '确认中…'
      primaryDisabled = true
    } else if (isConfirm) {
      primaryText = '确认完成 · 家长将收到通知'
    } else if (isBA && baLack > 0) {
      primaryText = '传满 2 张后确认本步'
      primarySub = `还差 ${baLack} 张 · 确认后进入第 ${activeRow.def.stepOrder + 1} 步${nextName}`
    } else if (lack > 0) {
      primaryText = `传满 ${activeRow.def.minPhotos} 张后确认本步`
      primarySub = `还差 ${lack} 张 · 确认后进入第 ${activeRow.def.stepOrder + 1} 步${nextName}`
    } else {
      primaryText = `确认本步，进入${nextName}`
    }
  }

  const onPrimary = () => {
    if (!activeRow || primaryDisabled) return
    const isBA = activeRow.def.stepKey === 'before_after'
    const lack = Math.max(0, activeRow.def.minPhotos - activeRow.serverCount)
    const baLack = isBA ? (activeRow.beforeCount < 1 ? 1 : 0) + (activeRow.afterCount < 1 ? 1 : 0) : 0
    if (isBA ? baLack > 0 : lack > 0) {
      // 未满时点击给真实回响（动效纲领 §四.1），不发起确认
      showToast(`还差 ${isBA ? baLack : lack} 张过程照，拍齐后可确认本步`)
      return
    }
    confirmMutation.mutate(activeRow.def.stepKey)
  }

  const petMeta = pet && (pet.breed || pet.weightKg) ? [pet.breed, pet.weightKg ? `${pet.weightKg}kg` : null].filter(Boolean).join(' · ') : null

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <PageHeader title="服务执行" aside={`${pet?.name ?? '宠物'} · ${service?.name ?? '服务'}`} backTo="/today" />

      {/* 摘要卡：头像柠檬环 + 服务中薄荷签 + 服务·时间·员工 + 右 N/6 */}
      <section className="u1-card mx-4 mt-1.5 flex items-center gap-3.5 p-3.5" data-testid="execute-summary">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-sunken shadow-[0_0_0_2px_#FFFDF6,0_0_0_3.5px_#FDC830]">
          {pet?.avatarUrl ? (
            <img src={pet.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <PawPrint className="h-6 w-6 text-ink" strokeWidth={1.6} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-body font-extrabold">
            {pet?.name ?? '宠物'}
            <span className="rounded-chip bg-brand-secondary px-1.5 py-px text-caption-xs font-bold text-ink">服务中</span>
          </p>
          <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
            {service?.name ?? '服务'} · {fmtHM(appointment.scheduledStart)}–{fmtHM(appointment.scheduledEnd)}
            {petMeta ? ` · ${petMeta}` : ''}
          </p>
          {pendingAllCount > 0 ? (
            <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">{pendingAllCount} 张照片上传中…</p>
          ) : null}
        </div>
        <div className="shrink-0 text-center">
          <p className="u1-num text-title font-extrabold">
            {activeRow?.def.stepOrder ?? 6}
            <span className="text-caption-xs text-[rgba(74,59,46,.42)]">/6</span>
          </p>
          <p className="text-caption-xs text-[rgba(74,59,46,.42)]">当前步</p>
        </div>
      </section>

      {flaggedNames.length > 0 && <FlaggedBanner stepNames={flaggedNames} />}

      {/* 竖向 stepper（可滚动区） */}
      <div className="flex-1">
        <ExecuteStepper
          rows={rows}
          onFiles={(stepKey, files) => void enqueueFiles(stepKey, undefined, files)}
          onSlotFiles={(stepKey, tag, files) => void enqueueFiles(stepKey, tag, files)}
          onDeletePhoto={(stepKey, serverId) => setDeleteTarget({ photoId: serverId, stepKey })}
          onPhotoTap={(url) => {
            const all = rows.flatMap((r) => r.photos.map((p) => ({ id: p.key, url: p.url, tag: p.tagLabel })))
            const idx = all.findIndex((p) => p.url === url)
            setViewer({ photos: all, index: Math.max(0, idx) })
          }}
        />
      </div>

      {/* 吸底柠檬主钮（文案随态） */}
      {activeRow ? (
        <div className="sticky bottom-0 bg-card px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-1px_0_rgba(74,59,46,.06)]">
          <button
            type="button"
            data-testid="execute-primary"
            disabled={primaryDisabled}
            onClick={onPrimary}
            className={`flex w-full items-center justify-center rounded-control py-3.5 text-body-sm font-semibold transition-transform duration-120 ease-philia-spring active:scale-[0.98] ${
              primaryDisabled ? 'bg-sunken text-ink-placeholder' : 'bg-brand-primary text-ink'
            }`}
          >
            {primaryText}
          </button>
          {primarySub ? (
            <p className="mt-1.5 text-center text-caption-xs text-[rgba(74,59,46,.42)]">{primarySub}</p>
          ) : null}
        </div>
      ) : null}

      {/* 删除照片二次确认弹层（动效纲领 §四.1 危险动作二次确认） */}
      {deleteTarget && (
        <div className="fixed inset-0 z-modal flex items-center justify-center px-8" role="dialog" aria-modal="true" aria-label="删除这张照片？">
          <button type="button" aria-label="取消" className="absolute inset-0 bg-[rgba(74,59,46,.4)]" onClick={() => setDeleteTarget(null)} />
          <div className="u1-card relative w-full max-w-xs p-5">
            <p className="text-title text-ink">删除这张照片？</p>
            <p className="mt-2 text-body-sm text-ink-secondary">删除后不可恢复，如影响步骤照片数下限需补拍。</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-11 flex-1 rounded-control bg-sunken text-body-sm text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                再想想
              </button>
              <button
                type="button"
                disabled={deletePhotoMutation.isPending}
                onClick={() => deletePhotoMutation.mutate(deleteTarget)}
                className="h-11 flex-1 rounded-control bg-danger text-body-sm font-semibold text-[#F6F1E3] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
              >
                {deletePhotoMutation.isPending ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewer ? (
        <PhotoViewer state={viewer} onClose={() => setViewer(null)} onIndexChange={(i) => setViewer((v) => (v ? { ...v, index: i } : v))} />
      ) : null}

      <ExecuteToast message={toast} />
      {celebrating && <CelebrationOverlay petName={pet?.name ?? undefined} onDone={() => navigate('/today')} />}
    </div>
  )
}

/** /execute/current 兼容入口：今日首个 in_service 单；无则引导页（旧深链不 404） */
function ResolveCurrentExecute() {
  const { trpc } = usePhiliaClient()
  const navigate = useNavigate()
  const todayQuery = useQuery({
    queryKey: ['appointment', 'listTodayForStaff'],
    queryFn: () => trpc.appointment.listTodayForStaff.query(),
  })

  if (todayQuery.isPending) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 pt-20">
        <span className="h-8 w-8 animate-pulse rounded-full bg-sunken" />
        <p className="text-body-sm text-ink-secondary">正在查找进行中的服务…</p>
      </div>
    )
  }

  const current = (todayQuery.data ?? []).find((item) => item.status === 'in_service')
  if (current) return <Navigate to={`/execute/${current.id}`} replace />

  return (
    <GuidePage
      icon={PawPrint}
      title="当前没有进行中的服务"
      description="到任务台核销客户预约码后，即可开始服务执行"
      actionText="回到任务台"
      onAction={() => navigate('/today')}
    />
  )
}

export default function ExecutePage() {
  const { appointmentId } = useParams()
  if ((appointmentId ?? '') === 'current') return <ResolveCurrentExecute />
  return <ExecutePageCore appointmentId={appointmentId ?? ''} />
}
