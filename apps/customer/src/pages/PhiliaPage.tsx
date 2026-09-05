/**
 * PhiliaPage · /philia 全屏品牌页（T2.1 · 仪式感重点）
 *
 * - 进入转场：translateY(100%) → 0，300ms ease-out（rAF 触发 transition，锁定值）；
 * - 关闭：右上角 × 或顶部下滑手势（拖拽 >120px 关闭，否则回弹）；
 * - 顶部问候语：按时段（早安/午安/晚安）+ 昵称（useMe）；
 * - 当前宠物大头像横滑切换（pet.list；无宠物显示引导建档案卡）；
 * - 中部三胶囊卡：宠物档案 / 会员卡 / 服务相册 → 三个子路由；
 * - 底部「菲丽亚日记」：已完成服务的前后对比照回顾卡（不足 3 条用养宠小贴士静态卡补齐）。
 */

import { useQuery } from '@tanstack/react-query'
import { Camera, ChevronRight, IdCard, PawPrint, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PhotoWall, useMe, usePhiliaClient } from '@philia/shared'
import type { PhotoWallPhoto } from '@philia/shared'
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  formatDateCn,
} from '../components/home/common'

/** 按时段的问候语 */
function greeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return '早安'
  if (h >= 11 && h < 18) return '午安'
  return '晚安'
}

/** 日记条目：一次完成服务 + 一组前后对比照 */
interface DiaryEntry {
  appointmentId: string
  petName: string | null
  serviceName: string | null
  doneAt: Date | null
  before: PhotoWallPhoto
  after: PhotoWallPhoto
}

/** 养宠小贴士静态卡（日记不足 3 条时补齐） */
const CARE_TIPS = [
  { title: '定期驱虫', desc: '体外驱虫建议每月一次，体内驱虫每三个月一次，守护毛孩子健康。' },
  { title: '梳毛的好处', desc: '每天梳毛 5 分钟，减少浮毛打结，还能增进和毛孩子的感情。' },
  { title: '疫苗提醒', desc: '疫苗有效期临近时记得及时续种，寄养前需提供有效疫苗证明。' },
]

const SPECIES_LABEL: Record<string, string> = { dog: '狗狗', cat: '猫咪', other: '小可爱' }

/** 当前宠物大头像横滑切换 */
function PetAvatarRail() {
  const { trpc } = usePhiliaClient()
  const petsQuery = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
  })
  const railRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  if (petsQuery.isPending) return <LoadingBlock lines={1} className="h-40" />
  if (petsQuery.isError) {
    return <ErrorState message="宠物档案加载失败" onRetry={() => void petsQuery.refetch()} />
  }
  const pets = petsQuery.data

  // 无宠物：引导建档案卡
  if (pets.length === 0) {
    return (
      <Link
        to="/philia/pets"
        className="flex items-center gap-4 rounded-card bg-card p-4 shadow-card transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
      >
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary-light">
          <Plus className="h-7 w-7 text-brand-primary" strokeWidth={1.5} />
        </span>
        <span className="flex-1">
          <span className="block text-body font-semibold">建立第一份宠物档案</span>
          <span className="mt-0.5 block text-caption text-ink-secondary">
            记录 TA 的品种、生日与疫苗，开启菲丽亚之旅
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-placeholder" strokeWidth={1.5} />
      </Link>
    )
  }

  const onScroll = () => {
    const el = railRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIdx(Math.max(0, Math.min(idx, pets.length - 1)))
  }

  return (
    <div>
      <div
        ref={railRef}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {pets.map((pet) => (
          <div key={pet.id} className="flex w-full shrink-0 snap-center flex-col items-center py-1">
            {pet.avatarUrl ? (
              <img
                src={pet.avatarUrl}
                alt={pet.name}
                className="h-36 w-36 rounded-full border-4 border-card object-cover shadow-elevated"
              />
            ) : (
              <span className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-card bg-brand-secondary-light shadow-elevated">
                <PawPrint className="h-14 w-14 text-brand-primary" strokeWidth={1.5} />
              </span>
            )}
            <p className="mt-3 text-title">{pet.name}</p>
            <p className="mt-0.5 text-caption text-ink-secondary">
              {SPECIES_LABEL[pet.species] ?? '小可爱'}
              {pet.breed ? ` · ${pet.breed}` : ''}
            </p>
          </div>
        ))}
      </div>
      {pets.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {pets.map((pet, i) => (
            <span
              key={pet.id}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === activeIdx ? 'w-4 bg-brand-primary' : 'w-1.5 bg-line-strong'
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** 菲丽亚日记：已完成服务的前后对比照回顾 */
function DiaryFeed() {
  const { trpc } = usePhiliaClient()
  const diaryQuery = useQuery({
    queryKey: ['philia', 'diary'],
    queryFn: async (): Promise<DiaryEntry[]> => {
      const { groups } = await trpc.appointment.listMine.query()
      const completed = groups.completed.slice(0, 6)
      const entries: DiaryEntry[] = []
      for (const appt of completed) {
        try {
          const steps = await trpc.serviceStep.list.query({ appointmentId: appt.id })
          const ba = steps.find((s) => s.stepKey === 'before_after')
          if (!ba) continue
          const before = ba.photos.find((p) => p.tag === 'before')
          const after = [...ba.photos].reverse().find((p) => p.tag === 'after')
          if (!before || !after) continue
          entries.push({
            appointmentId: appt.id,
            petName: appt.petName,
            serviceName: appt.serviceName,
            doneAt: appt.completedAt ?? appt.scheduledStart,
            before: { id: before.id, url: before.url, thumbUrl: before.thumbUrl ?? undefined },
            after: { id: after.id, url: after.url, thumbUrl: after.thumbUrl ?? undefined },
          })
        } catch {
          // 单个预约步骤读取失败不阻断整份日记
        }
      }
      return entries
    },
  })

  if (diaryQuery.isPending) return <LoadingBlock lines={3} />
  if (diaryQuery.isError) {
    return <ErrorState message="日记加载失败" onRetry={() => void diaryQuery.refetch()} />
  }

  const entries = diaryQuery.data
  const tipsNeeded = Math.max(0, 3 - entries.length)

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 ? (
        <EmptyState
          title="日记还没有篇章"
          desc="完成第一次洗护后，这里会留下 TA 的变美瞬间"
        />
      ) : (
        entries.map((e) => (
          <article key={e.appointmentId} className="rounded-card bg-card p-3 shadow-card">
            <PhotoWall photos={[e.before, e.after]} stepKey="before_after" />
            <p className="mt-2 text-caption text-ink-secondary">
              {e.doneAt ? formatDateCn(e.doneAt) : ''}
              {e.petName ? ` · ${e.petName}` : ''}
              {e.serviceName ? ` · ${e.serviceName}` : ''}
            </p>
          </article>
        ))
      )}
      {/* 不足 3 条用养宠小贴士补齐 */}
      {Array.from({ length: tipsNeeded }).map((_, i) => {
        const tip = CARE_TIPS[i % CARE_TIPS.length]!
        return (
          <article key={`tip-${i}`} className="rounded-card bg-brand-primary-light p-4">
            <p className="text-caption text-brand-primary-pressed">养宠小贴士</p>
            <p className="mt-1 text-body font-semibold">{tip.title}</p>
            <p className="mt-1 text-caption text-ink-secondary">{tip.desc}</p>
          </article>
        )
      })}
    </div>
  )
}

const CAPSULES = [
  { to: '/philia/pets', label: '宠物档案', desc: 'TA 的小档案', icon: PawPrint },
  { to: '/philia/member', label: '会员卡', desc: '专属身份', icon: IdCard },
  { to: '/philia/moments', label: '服务相册', desc: '变美记录', icon: Camera },
]

export default function PhiliaPage() {
  const navigate = useNavigate()
  const { user } = useMe()

  // 进入转场：首帧 translateY(100%)，rAF 后归零（300ms ease-out 锁定）
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // 下滑关闭手势（仅在页面滚动到顶时启用）
  const [dragY, setDragY] = useState(0)
  const dragStartY = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const close = () => navigate('/home')

  const onTouchStart = (e: React.TouchEvent) => {
    if ((rootRef.current?.scrollTop ?? 0) > 0) return
    dragStartY.current = e.touches[0]!.clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const dy = e.touches[0]!.clientY - dragStartY.current
    if (dy > 0) setDragY(dy)
  }
  const onTouchEnd = () => {
    if (dragY > 120) {
      close()
    } else {
      setDragY(0)
    }
    dragStartY.current = null
  }

  const translateY = !entered ? '100%' : `${dragY}px`
  const withTransition = dragY === 0

  return (
    <div
      ref={rootRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 z-overlay overflow-y-auto bg-canvas"
      style={{
        transform: `translateY(${translateY})`,
        transition: withTransition ? 'transform 300ms cubic-bezier(0.33, 1, 0.68, 1)' : 'none',
      }}
      role="dialog"
      aria-label="Philia 品牌空间"
    >
      <div className="mx-auto min-h-full max-w-lg px-4 pb-10">
        {/* 顶部：问候语 + 关闭按钮 */}
        <header className="flex items-start justify-between pt-8">
          <div>
            <h1 className="text-title-lg">
              {greeting()}，{user?.nickname ?? '铲屎官'}
            </h1>
            <p className="mt-1 text-caption text-ink-secondary">
              欢迎来到 Philia 品牌空间 · 今天也要好好爱 TA
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="关闭"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <X className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
          </button>
        </header>

        {/* 当前宠物大头像横滑 */}
        <div className="mt-6">
          <PetAvatarRail />
        </div>

        {/* 三胶囊卡 */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {CAPSULES.map(({ to, label, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1.5 rounded-full bg-card px-2 py-4 shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <Icon className="h-6 w-6 text-brand-primary" strokeWidth={1.5} />
              <span className="text-body font-semibold">{label}</span>
              <span className="text-caption text-ink-placeholder">{desc}</span>
            </Link>
          ))}
        </div>

        {/* 菲丽亚日记 */}
        <section className="mt-8">
          <h2 className="mb-3 text-title">菲丽亚日记</h2>
          <DiaryFeed />
        </section>
      </div>
    </div>
  )
}
