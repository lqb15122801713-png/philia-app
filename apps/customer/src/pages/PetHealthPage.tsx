/**
 * PetHealthPage · /philia/pets/:id/health 宠物健康档案（客户端体验大批片 4）
 *
 * - 数据源：trpc.petHealth.overview 一次拉取（档案 + 健康记录降序 + 体重升序）；
 *   三态惯例 LoadingBlock / ErrorState / EmptyState（components/home/common）。
 * - 区块一「体重趋势」：SVG 手绘折线（零图表库铁律——viewBox 自适应、折线+数据点
 *   圆点+首末点数值标注；空数据=EmptyState 三句话），下方「记体重」小表单
 *   （日期默认今天、体重 kg 数字输入、备注可选）调 weightAdd，成功后 invalidate overview。
 * - 区块二「健康记录」：四类 tab（疫苗/驱虫/用药/就医）+ 记录时间线
 *   （recordDate 标题 备注；nextDueDate 有值显示「下次到期 {date}」，临期 30 天内暖底、
 *   过期赭红——照 PetsPage 疫苗徽章视觉惯例）+「记一笔」表单（healthAdd）+
 *   每条删除钮（healthRemove，同钮两击二次确认，3s 未二击自动复位）。
 * - 全部文案走 copy 域 health.ts（hc 访问器）。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域重屏批）：五块入册
 * （health.header/weight/weightform/records/recordform），块序/显隐=
 * useCanvasLayout('petHealth')（published→注册表默认序尾补，空=默认序兜底常量）；
 * 文案键行内可改=CK 点选反查锚；预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。
 * 预览特例：?canvasPreview=1 且路由 id='preview' 时，用宠物列表既有查询首只顶替
 * （零新增查询；无宠时=候裁清零批件 6 屏内合成示例档案顶替渲染，零真数据零写库）。
 * 块内逻辑（overview 一次拉取/
 * weightAdd/healthAdd/healthRemove 二次确认）零改动，data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { z } from 'zod'
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient, useToast, type PhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { hc } from '@/copy/health'
import { readLastBooking } from '@/lib/bookingPrefill'
import { customerPetName } from '@/lib/customerPresentation'
import { mc } from '../components/member/copy'
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  SectionShell,
  daysUntil,
  formatDateCn,
  todayIso,
} from '../components/home/common'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const HEALTH_DEFAULT_ORDER = [
  'health.header',
  'health.weight',
  'health.weightform',
  'health.records',
  'health.recordform',
] as const

/* ------------------------------------------------------------------ */
/* 类型（从 tRPC 客户端推导，端到端类型不手写——同 booking/types.ts 口径）      */
/* ------------------------------------------------------------------ */

type Trpc = PhiliaClient['trpc']
type OverviewResult = Awaited<ReturnType<Trpc['petHealth']['overview']['query']>>
type WeightLog = OverviewResult['weights'][number]

/* 候裁清零批 件 6（预览兜底示例·客户端合成件）：canvasPreview=1 且路由 id='preview'
   顶替查不到真宠物时，用屏内合成示例档案渲染块流（假名「示例宠物·画布预览」，体重/
   记录=固定示例值；零真数据零写库——两表单对合成 petId（空串）提交会被服务端拒，
   仅预览框内可点，不落库；水印注记页首已有）。真用户页零改动 */
function exampleOverviewOf(): OverviewResult {
  return {
    pet: { id: 'canvas-example-pet', name: '示例宠物·画布预览' },
    records: [
      {
        id: 'canvas-example-health-1',
        petId: 'canvas-example-pet',
        type: 'vaccine',
        title: '示例疫苗·画布预览（猫三联）',
        recordDate: '2026-09-01',
        nextDueDate: '2027-09-01',
        note: null,
      },
    ],
    weights: [
      { id: 'canvas-example-weight-1', petId: 'canvas-example-pet', weightKg: 4.0, measuredAt: '2026-08-01', note: null },
      { id: 'canvas-example-weight-2', petId: 'canvas-example-pet', weightKg: 4.2, measuredAt: '2026-09-01', note: null },
      { id: 'canvas-example-weight-3', petId: 'canvas-example-pet', weightKg: 4.3, measuredAt: '2026-10-01', note: null },
    ],
  } as OverviewResult
}

type RecordType = 'vaccine' | 'deworm' | 'medication' | 'vet_visit'

/* 四类签（值+文案键；键渲染期取值——画布文案 patch 实时生效，不做模块级冻结） */
const RECORD_TABS: Array<{
  value: RecordType
  copyKey: 'health.tabVaccine' | 'health.tabDeworm' | 'health.tabMedication' | 'health.tabVetVisit'
}> = [
  { value: 'vaccine', copyKey: 'health.tabVaccine' },
  { value: 'deworm', copyKey: 'health.tabDeworm' },
  { value: 'medication', copyKey: 'health.tabMedication' },
  { value: 'vet_visit', copyKey: 'health.tabVetVisit' },
]

/** 删除钮二次确认态的自动复位毫秒数（同 NotifyCenterPage 口径） */
const CONFIRM_RESET_MS = 3000

/* ------------------------------------------------------------------ */
/* 表单 zod 校验（镜像 server petHealth 规则）                              */
/* ------------------------------------------------------------------ */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), '日期不合法')

const weightFormSchema = z.object({
  measuredAt: isoDate,
  weightKg: z
    .number({ message: '体重须为数字' })
    .positive('体重须大于 0')
    .max(500, '体重超出合理范围'),
  note: z.string().trim().max(255, '备注最长 255 字').optional(),
})

const recordFormSchema = z.object({
  type: z.enum(['vaccine', 'deworm', 'medication', 'vet_visit']),
  title: z.string().trim().min(1, '标题不能为空').max(64, '标题最长 64 字'),
  recordDate: isoDate,
  nextDueDate: isoDate.optional(),
  note: z.string().trim().max(255, '备注最长 255 字').optional(),
})

/* ------------------------------------------------------------------ */
/* 体重趋势 SVG 手绘折线（零图表库铁律）                                    */
/* ------------------------------------------------------------------ */

function WeightTrendChart({ weights }: { weights: WeightLog[] }) {
  /* viewBox 固定逻辑坐标系，CSS 宽度 100% 自适应；高宽比恒定保证圆点不变形 */
  const W = 320
  const H = 132
  const PAD_X = 30
  const PAD_Y = 18

  const vals = weights.map((w) => w.weightKg)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  /* 平线兜底：全部同值时按 ±0.5kg 拉开纵向区间 */
  const lo = min === max ? min - 0.5 : min
  const hi = min === max ? max + 0.5 : max

  const xOf = (i: number) =>
    weights.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (weights.length - 1)
  const yOf = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (H - PAD_Y * 2)

  const points = weights.map((w, i) => `${xOf(i)},${yOf(w.weightKg)}`).join(' ')
  const first = weights[0]
  const last = weights[weights.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-36 w-full"
      role="img"
      aria-label={hc('health.weightTrend')}
      data-testid="weight-trend-chart"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand-primary"
      />
      {weights.map((w, i) => (
        <circle
          key={w.id}
          cx={xOf(i)}
          cy={yOf(w.weightKg)}
          r="3"
          className="fill-brand-primary stroke-card"
          strokeWidth="1.5"
        />
      ))}
      {/* 首末点数值标注 */}
      <text
        x={xOf(0)}
        y={yOf(first.weightKg) - 8}
        textAnchor={weights.length === 1 ? 'middle' : 'start'}
        fontSize="10"
        className="fill-ink-secondary"
      >
        {first.weightKg} {hc('health.weightUnit')}
      </text>
      {weights.length > 1 ? (
        <text
          x={xOf(weights.length - 1)}
          y={yOf(last.weightKg) - 8}
          textAnchor="end"
          fontSize="10"
          className="fill-ink-secondary"
        >
          {last.weightKg} {hc('health.weightUnit')}
        </text>
      ) : null}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* 记体重小表单                                                          */
/* ------------------------------------------------------------------ */

function WeightAddForm({ petId }: { petId: string }) {
  const { trpc, queryClient } = usePhiliaClient()
  const [date, setDate] = useState(todayIso())
  const [kg, setKg] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addM = useMutation({
    mutationFn: (values: z.infer<typeof weightFormSchema>) =>
      trpc.petHealth.weightAdd.mutate({ petId, ...values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['petHealth', 'overview', petId] })
      /* weightAdd 同事务回写 pets.weight_kg 快照——宠物列表一并刷新 */
      void queryClient.invalidateQueries({ queryKey: ['pet'] })
      setKg('')
      setNote('')
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : hc('health.saveFail')),
  })

  const onSubmit = () => {
    setError(null)
    const parsed = weightFormSchema.safeParse({
      measuredAt: date,
      weightKg: kg.trim() === '' ? Number.NaN : Number(kg),
      note: note.trim() || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? hc('health.saveFail'))
      return
    }
    addM.mutate(parsed.data)
  }

  const inputCls =
    'w-full rounded-control border border-line bg-card px-3 py-2.5 text-body-sm outline-none transition-colors focus:border-brand-primary'
  const labelCls = 'mb-1 block text-caption text-ink-secondary'
  const errCls = 'mt-1 text-caption text-danger-deep'

  return (
    <div className="u1-card p-4" data-testid="weight-add-form">
      <p className="text-body-sm font-semibold"><CK k="health.weightAddTitle">{hc('health.weightAddTitle')}</CK></p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="weight-date"><CK k="health.weightDateLabel">{hc('health.weightDateLabel')}</CK></label>
          <input
            id="weight-date"
            type="date"
            className={inputCls}
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="weight-kg"><CK k="health.weightKgLabel">{hc('health.weightKgLabel')}</CK></label>
          <input
            id="weight-kg"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            className={inputCls}
            value={kg}
            placeholder={hc('health.weightKgPlaceholder')}
            onChange={(e) => setKg(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls} htmlFor="weight-note"><CK k="health.weightNoteLabel">{hc('health.weightNoteLabel')}</CK></label>
        <input
          id="weight-note"
          className={inputCls}
          value={note}
          maxLength={255}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error ? <p className={errCls}>{error}</p> : null}
      <button
        type="button"
        disabled={addM.isPending}
        onClick={onSubmit}
        className="mt-3 w-full rounded-full bg-brand-primary py-2.5 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
      >
        {addM.isPending ? (
          <CK k="health.saving">{hc('health.saving')}</CK>
        ) : (
          <CK k="health.weightSubmit">{hc('health.weightSubmit')}</CK>
        )}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 到期徽章（照 PetsPage VaccineBadge 视觉惯例：临期暖底 / 过期赭红）          */
/* ------------------------------------------------------------------ */

function NextDueBadge({ date }: { date: string }) {
  const days = daysUntil(date)
  if (days < 0) {
    return (
      <span className="rounded-chip bg-danger-light px-2 py-1 text-caption-xs text-danger-deep">
        <CK k="health.dueExpired">{hc('health.dueExpired', { date })}</CK>
      </span>
    )
  }
  if (days < 30) {
    return (
      <span className="rounded-chip bg-brand-primary-light px-2 py-1 text-caption-xs text-ink">
        <CK k="health.dueSoon">{hc('health.dueSoon', { date, days })}</CK>
      </span>
    )
  }
  return (
    <span className="rounded-chip bg-brand-secondary-light px-2 py-1 text-caption-xs text-ink">
      <CK k="health.dueOk">{hc('health.dueOk', { date })}</CK>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* 记一笔表单                                                            */
/* ------------------------------------------------------------------ */

function RecordAddForm({ petId, defaultType }: { petId: string; defaultType: RecordType }) {
  const { trpc, queryClient } = usePhiliaClient()
  const [type, setType] = useState<RecordType>(defaultType)
  const [title, setTitle] = useState('')
  const [recordDate, setRecordDate] = useState(todayIso())
  const [nextDueDate, setNextDueDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addM = useMutation({
    mutationFn: (values: z.infer<typeof recordFormSchema>) =>
      trpc.petHealth.healthAdd.mutate({ petId, ...values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['petHealth', 'overview', petId] })
      setTitle('')
      setNextDueDate('')
      setNote('')
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : hc('health.saveFail')),
  })

  const onSubmit = () => {
    setError(null)
    const parsed = recordFormSchema.safeParse({
      type,
      title,
      recordDate,
      nextDueDate: nextDueDate || undefined,
      note: note.trim() || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? hc('health.saveFail'))
      return
    }
    addM.mutate(parsed.data)
  }

  const inputCls =
    'w-full rounded-control border border-line bg-card px-3 py-2.5 text-body-sm outline-none transition-colors focus:border-brand-primary'
  const labelCls = 'mb-1 block text-caption text-ink-secondary'
  const errCls = 'mt-1 text-caption text-danger-deep'

  return (
    <div className="u1-card p-4" data-testid="record-add-form">
      <p className="text-body-sm font-semibold"><CK k="health.recordAddTitle">{hc('health.recordAddTitle')}</CK></p>
      <div className="mt-3">
        <span className={labelCls}><CK k="health.recordTypeLabel">{hc('health.recordTypeLabel')}</CK></span>
        {/* W1-D2 触控量化：整钮可点 + 目标高 ≥44px，相邻间距 8px（gap-2） */}
        <div className="flex gap-2">
          {RECORD_TABS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`min-h-[44px] flex-1 rounded-full border px-3 py-2 text-body-sm transition-colors ${
                type === opt.value
                  ? 'border-brand-primary bg-brand-primary-light text-brand-primary-pressed'
                  : 'border-line bg-card text-ink-secondary'
              }`}
            >
              <CK k={opt.copyKey}>{hc(opt.copyKey)}</CK>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls} htmlFor="record-title"><CK k="health.recordTitleLabel">{hc('health.recordTitleLabel')}</CK></label>
        <input
          id="record-title"
          className={inputCls}
          value={title}
          maxLength={64}
          placeholder={hc('health.recordTitlePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="record-date"><CK k="health.recordDateLabel">{hc('health.recordDateLabel')}</CK></label>
          <input
            id="record-date"
            type="date"
            className={inputCls}
            value={recordDate}
            max={todayIso()}
            onChange={(e) => setRecordDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="record-next-due"><CK k="health.recordNextDueLabel">{hc('health.recordNextDueLabel')}</CK></label>
          <input
            id="record-next-due"
            type="date"
            className={inputCls}
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls} htmlFor="record-note"><CK k="health.recordNoteLabel">{hc('health.recordNoteLabel')}</CK></label>
        <input
          id="record-note"
          className={inputCls}
          value={note}
          maxLength={255}
          placeholder={hc('health.recordNotePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error ? <p className={errCls}>{error}</p> : null}
      <button
        type="button"
        disabled={addM.isPending}
        onClick={onSubmit}
        className="mt-3 w-full rounded-full bg-brand-primary py-2.5 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
      >
        {addM.isPending ? (
          <CK k="health.saving">{hc('health.saving')}</CK>
        ) : (
          <CK k="health.recordSubmit">{hc('health.recordSubmit')}</CK>
        )}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 页面                                                                 */
/* ------------------------------------------------------------------ */

export default function PetHealthPage() {
  const { id: routeId = '' } = useParams<{ id: string }>()
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 2500 })
  const [tab, setTab] = useState<RecordType>('vaccine')
  /* 删除二次确认：首击进入待确认态（记录 id + 复位计时），二击执行 */
  const [confirmId, setConfirmId] = useState<string | null>(null)

  /* 画布批片 3：预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布预览特例：预览 URL='/philia/pets/preview/health'——canvasPreview=1 且路由
     id='preview' 时，用宠物列表既有查询首只顶替（pet.list 既有查询共享缓存，零新增查询；
     无宠时=件 6 合成示例档案顶替，overview 闸关不拉取） */
  const isPreviewPet = isCanvasPreview && routeId === 'preview'
  const previewPetsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    enabled: isPreviewPet,
  })
  const petId = isPreviewPet ? (previewPetsQ.data?.[0]?.id ?? '') : routeId
  /* 件 6：预览顶替未命中（宠物列表查询已完成但无宠）→ 合成示例档案（零真数据零写库） */
  const previewMiss = isPreviewPet && !previewPetsQ.isPending && petId === ''
  const exampleOverview = useMemo(() => (previewMiss ? exampleOverviewOf() : null), [previewMiss])

  /* 画布布局店锚（MePage/MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，nearbyQ 带 enabled 闸仅作布局锚解析，零增发常态查询） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const canvasStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'petHealth')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : HEALTH_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('petHealth', canvasStoreId, registryBlocks)

  const overviewQ = useQuery({
    queryKey: ['petHealth', 'overview', petId],
    queryFn: () => trpc.petHealth.overview.query({ petId }),
    enabled: petId.length > 0,
  })

  const removeM = useMutation({
    mutationFn: (recordId: string) => trpc.petHealth.healthRemove.mutate({ id: recordId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['petHealth', 'overview', petId] })
      showToast(hc('health.recordDeleted'))
    },
  })

  const onDelete = (recordId: string) => {
    if (confirmId === recordId) {
      setConfirmId(null)
      removeM.mutate(recordId)
      return
    }
    setConfirmId(recordId)
    window.setTimeout(() => setConfirmId((cur) => (cur === recordId ? null : cur)), CONFIRM_RESET_MS)
  }

  const overviewData = exampleOverview ?? overviewQ.data
  const pet = overviewData?.pet
  const records = overviewData?.records ?? []
  const weights = overviewData?.weights ?? []
  const tabRecords = records.filter((r) => r.type === tab)
  const activeTabKey = RECORD_TABS.find((t) => t.value === tab)?.copyKey
  const activeTabLabel = activeTabKey ? hc(activeTabKey) : ''

  /* 块渲染器（块内逻辑零改动——五块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. health.header：统一返回条（标题=宠名 · 健康档案）+ 页级读态（骨架/失败重试） */
    'health.header': () => (
      <>
        <PageHeader
          title={
            pet ? (
              <>
                {customerPetName(pet.name)} · <CK k="health.title">{hc('health.title')}</CK>
              </>
            ) : (
              <CK k="health.title">{hc('health.title')}</CK>
            )
          }
          fallback="/philia/pets"
          className="pt-4"
        />
        {overviewQ.isPending && !previewMiss ? <LoadingBlock lines={3} className="mt-4" /> : null}
        {overviewQ.isError ? (
          <div className="mt-4">
            <ErrorState message={hc('health.loadFail')} onRetry={() => void overviewQ.refetch()} />
          </div>
        ) : null}
      </>
    ),

    /* 2. health.weight：体重趋势区（SVG 手绘折线零图表库；空数据=EmptyState 三句话。
          SectionShell 题为 string prop 无 CK 锚；weightUnit 在 SVG text 内挂不了 CK，NOTES 报备） */
    'health.weight': () =>
      overviewData ? (
        <SectionShell title={hc('health.weightTrend')}>
          {weights.length === 0 ? (
            <EmptyState
              title={hc('health.weightEmptyTitle')}
              desc={hc('health.weightEmptyBody')}
            />
          ) : (
            <div className="u1-ring rounded-card bg-card p-4">
              <WeightTrendChart weights={weights} />
            </div>
          )}
        </SectionShell>
      ) : null,

    /* 3. health.weightform：记体重小表单整块（改造前嵌在体重 SectionShell 内，拆块后
          mt-3 节奏随行——块间间距零差异） */
    'health.weightform': () =>
      overviewData ? (
        <div className="mt-3">
          <WeightAddForm petId={petId} />
        </div>
      ) : null,

    /* 4. health.records：健康记录区四类签+时间线（删除钮两击二次确认零改动） */
    'health.records': () =>
      overviewData ? (
        <SectionShell title={hc('health.recordsTitle')}>
          {/* 四类签（文字签+底部 hairline，选中=墨 700+主色 2px 下划线，同 MallOrdersPage） */}
          <div className="flex gap-[18px] overflow-x-auto border-b border-[rgba(59,46,36,.06)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RECORD_TABS.map((t) => {
              const n = records.filter((r) => r.type === t.value).length
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  data-testid={`health-tab-${t.value}`}
                  className={`-mb-px shrink-0 border-b-2 py-2.5 text-body-sm transition ${
                    tab === t.value
                      ? 'border-brand-primary font-bold text-ink'
                      : 'border-transparent font-medium text-ink-placeholder'
                  }`}
                >
                  <CK k={t.copyKey}>{hc(t.copyKey)}</CK>
                  {n > 0 ? <span className="u1-num ml-1 text-caption-xs font-normal">{n}</span> : null}
                </button>
              )
            })}
          </div>

          {/* 记录时间线（recordDate 标题 备注 + 到期徽章 + 删除钮） */}
          {tabRecords.length === 0 ? (
            <p className="py-12 text-center text-caption text-ink-placeholder">
              <CK k="health.recordsTabEmpty">{hc('health.recordsTabEmpty', { type: activeTabLabel })}</CK>
            </p>
          ) : (
            <ul className="mt-3.5 flex flex-col gap-2.5">
              {tabRecords.map((r) => (
                <li key={r.id} className="u1-ring rounded-card bg-card p-3.5" data-testid={`health-record-${r.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="u1-num text-caption-xs text-ink-placeholder">
                        {formatDateCn(`${r.recordDate}T00:00:00`)}
                      </p>
                      <p className="mt-0.5 text-body-sm font-semibold">{r.title}</p>
                      {r.note ? (
                        <p className="mt-0.5 text-caption text-ink-secondary">{r.note}</p>
                      ) : null}
                      {r.nextDueDate ? (
                        <div className="mt-1.5">
                          <NextDueBadge date={r.nextDueDate} />
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      disabled={removeM.isPending}
                      aria-label={hc('health.recordDelete')}
                      data-testid={`health-record-delete-${r.id}`}
                      className={`flex min-h-[44px] shrink-0 items-center gap-1 rounded-full px-2 text-caption-xs transition-colors disabled:opacity-60 ${
                        confirmId === r.id
                          ? 'bg-danger-light font-semibold text-danger-deep'
                          : 'text-ink-placeholder'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {confirmId === r.id ? (
                        <CK k="health.recordDeleteConfirm">{hc('health.recordDeleteConfirm')}</CK>
                      ) : (
                        <CK k="health.recordDelete">{hc('health.recordDelete')}</CK>
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionShell>
      ) : null,

    /* 5. health.recordform：记一笔表单整块（改造前嵌在记录 SectionShell 内，拆块后
          mt-3 节奏随行；key=tab 随签重置表单态零改动） */
    'health.recordform': () =>
      overviewData ? (
        <div className="mt-3">
          <RecordAddForm key={tab} petId={petId} defaultType={tab} />
        </div>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="petHealth" storeId={canvasStoreId}>
      <div className="px-[22px] pb-6" data-testid="pet-health-page">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-4 text-center text-caption-xs text-ink-secondary" data-testid="pethealth-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
        ) : null}
        {/* 块流：五块按有效布局渲染（published 覆盖∪默认序尾补）；默认序下块内 JSX
            与改造前逐字一致（两表单自 SectionShell 拆出为独立块，mt-3 节奏随行） */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        {toastEl}
      </div>
    </CanvasLayoutLoader>
  )
}
