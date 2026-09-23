/**
 * PhiliaPage · /philia 全屏品牌页（T2.1 · 仪式感重点）
 *
 * - 进入转场：translateY(100%) → 0，300ms ease-out（rAF 触发 transition，锁定值）；
 * - 关闭：右上角 × 或顶部下滑手势（拖拽 >120px 关闭，否则回弹）；
 * - 顶部问候语：按时段（早安/午安/晚安）+ 昵称（useMe）；
 * - 中部三胶囊卡：宠物档案 / 会员卡 / 服务相册 → 三个子路由（真实链路保留）；
 * - 底部「菲丽亚日记」：已完成服务的前后对比照回顾卡（不足 3 条用养宠小贴士静态卡补齐）。
 *
 * U1-F 本期上（v9.1，任务书逐项口径）：
 * 1. 形象位：宠物照片圆形「双细线环」（外环 + 内环 1px 暖墨细线，深度策略去 shadow-elevated）；
 * 2. 真实三数：陪伴天数（auth.me user.createdAt 距今，原 MemberPage 同口径，该页 R11a 已退役）· 服务次数
 *    （listMine completed 数）；守护值无真实来源（schema 无积分表，U1-C 已上报）——
 *    按任务书口径两项显示，不出守护值；
 * 3. 一键预约卡：接现成一键再约链路——内嵌 HomeBookingPanel（9a 双态面板逻辑原样，
 *    rebook/entry/in-service 全真，零新逻辑）；
 * 4. 成长护照预告行：置灰「9c 解锁」（静态预告行，非按钮不挂链，不造假互动）；
 * 5. 守护市集入口行：无市集路由（App.tsx 路由表无）——该行隐藏（任务书口径）；
 * 禁做假互动：喂食/玩耍/打扮/拍照四钮不做；「定制我的崽」入口隐藏（AI 生成接口待拍板）。
 *
 * U4-D2（试样 06 逐格收口）：
 * - 成长三格补齐真实可聚合第三项「累计消费」（listMine completed priceFen 合计
 *   fenToYuan，HomePage stats 行同口径）；守护值位不造假维持不出（裁定 #23 豁免）；
 *   大数字 u1-num 20/700（试样 800 字重 → 自托管 Montserrat 仅至 700）；grid-cols-3；
 * - 三胶囊卡阵退役 → 试样 q-row 细线列表行工艺（U4-A 首页次级行同工艺：oak-light
 *   圆角 14 图标芯片 + 名 14/600 + 述 11 + ›），成长护照预告行并入同组；
 * - 形象位宠物名换 u1-serif 衬线展示位（试样 .q-name）；日记卡圆角 16 越四档
 *   → panel 20 + 细线 ring；text-body(15) 越字阶处取 14；
 * - 维持不动（登记）：顶部问候语+关闭钮（试样为 serif wordmark+守护值，守护值无真值）；
 *   LV/进度条/喂食玩耍打扮拍照四钮无真实字段/接口（U1-F 禁做假互动在案）。
 */

import { useQuery } from '@tanstack/react-query'
import { BookOpen, Camera, ChevronRight, IdCard, PawPrint, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PhotoWall, useMe, usePhiliaClient } from '@philia/shared'
import type { PhotoWallPhoto } from '@philia/shared'
import HomeBookingPanel from '../components/home/HomeBookingPanel'
import { fenToYuan } from '@/components/booking/format'
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  formatDateCn,
} from '../components/home/common'

const HAIRLINE = 'border-t border-[rgba(74,59,46,.09)]'

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
        className="u1-card flex items-center gap-4 p-4 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
      >
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary-light">
          <Plus className="h-7 w-7 text-brand-primary" strokeWidth={1.5} />
        </span>
        <span className="flex-1">
          <span className="block text-body-sm font-semibold">建立第一份宠物档案</span>
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
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pets.map((pet) => (
          <div key={pet.id} className="flex w-full shrink-0 snap-center flex-col items-center py-1">
            {/* U1-F 形象位：圆形双细线环（外环 p-2 + 内环，1px 暖墨细线；去 shadow-elevated） */}
            <span className="rounded-full p-2 ring-1 ring-line-ring">
              {pet.avatarUrl ? (
                <img
                  src={pet.avatarUrl}
                  alt={pet.name}
                  className="h-36 w-36 rounded-full object-cover ring-1 ring-line-ring"
                />
              ) : (
                /* D-补3 字圈工艺：浅木底 + 衬线首字（D1 洗护师字圈同口径），不再用 PawPrint 图标占位 */
                <span className="flex h-36 w-36 items-center justify-center rounded-full bg-oak-light ring-1 ring-line-ring">
                  <span className="u1-serif text-detail-lg font-semibold text-ink">{pet.name.slice(0, 1)}</span>
                </span>
              )}
            </span>
            {/* U4-D2：宠物名衬线展示位（试样 .q-name）；物种·品种行取 11（试样 10px 越阶） */}
            <p className="u1-serif mt-3 text-title">{pet.name}</p>
            <p className="mt-0.5 text-caption-xs text-ink-secondary">
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
          <article key={e.appointmentId} className="u1-card p-3">
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
          <article key={`tip-${i}`} className="rounded-panel bg-brand-primary-light p-4">
            <p className="text-caption text-brand-primary-pressed">养宠小贴士</p>
            <p className="mt-1 text-body-sm font-semibold">{tip.title}</p>
            <p className="mt-1 text-caption text-ink-secondary">{tip.desc}</p>
          </article>
        )
      })}
    </div>
  )
}

const CAPSULES = [
  { to: '/philia/pets', label: '宠物档案', desc: 'TA 的小档案', icon: PawPrint },
  { to: '/member', label: '会员卡', desc: '专属身份', icon: IdCard },
  { to: '/philia/moments', label: '服务相册', desc: '变美记录', icon: Camera },
]

const DAY_MS = 86_400_000

/** U4-D2 成长三格（规格书 §4：Montserrat 大数字；守护值无真实来源不出，裁定 #23 豁免）：
 *  陪伴天数（user.createdAt 距今）· 服务次数（listMine completed 数）· 累计消费
 *  （completed priceFen 合计 fenToYuan）——HomePage stats 行同口径；
 *  queryKey 与首页/会员页同源缓存共享；查询失败整行隐去。
 *  大数字 20/700（试样 800 字重 → 自托管 Montserrat 仅至 700，登记）。 */
function TriStats() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const mineQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  if (meRawQ.isError || mineQ.isError) return null
  const createdAt = meRawQ.data?.user?.createdAt
  const joinDays = createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS) + 1)
    : null
  const completedList = mineQ.data?.groups.completed ?? []
  const totalFen = completedList.reduce((s, a) => s + a.priceFen, 0)
  const items = [
    { label: '陪伴天数', value: joinDays !== null ? `${joinDays} 天` : null },
    { label: '服务次数', value: completedList.length > 0 ? `${completedList.length} 次` : null },
    { label: '累计消费', value: completedList.length > 0 ? fenToYuan(totalFen) : null },
  ].filter((i) => i.value !== null)
  if (items.length === 0) return null
  return (
    <section
      data-testid="philia-tri-stats"
      aria-label="陪伴数据"
      className="mt-5 grid grid-cols-3 gap-2 border-y border-[rgba(74,59,46,.09)] py-3"
    >
      {items.map((i) => (
        <p key={i.label} className="text-center">
          <span className="u1-num block text-title-lg font-bold leading-7">{i.value}</span>
          <span className="mt-0.5 block text-caption-xs leading-4 text-ink-secondary">{i.label}</span>
        </p>
      ))}
    </section>
  )
}

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
      className="fixed inset-0 z-sticky overflow-y-auto bg-canvas"
      style={{
        transform: `translateY(${translateY})`,
        transition: withTransition ? 'transform 300ms cubic-bezier(0.33, 1, 0.68, 1)' : 'none',
      }}
      role="dialog"
      aria-label="Philia 品牌空间"
    >
      <div className="mx-auto min-h-full max-w-lg px-4 pb-28">
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
            className="u1-ring flex h-11 w-11 items-center justify-center rounded-full bg-card transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <X className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
          </button>
        </header>

        {/* 当前宠物大头像横滑（U1-F 形象位：圆形双细线环） */}
        <div className="mt-6">
          <PetAvatarRail />
        </div>

        {/* U1-F 真实三数：陪伴天数 · 服务次数（守护值无真实来源不出；失败隐去） */}
        <TriStats />

        {/* U1-F 一键预约卡：内嵌现成一键再约链路（9a HomeBookingPanel 逻辑原样） */}
        <div className="mt-5" data-testid="philia-booking-card">
          <HomeBookingPanel />
        </div>

        {/* U4-D2：三胶囊卡阵 → 试样 q-row 细线列表行工艺（U4-A 首页次级行同工艺：
            oak-light 圆角 14 图标芯片 + 名 14/600 + 述 11 + › 墨 30%）；真实链路保留。
            成长护照预告行并入同组（置灰静态「9c 解锁」，非按钮不挂链）；
            守护市集行无路由隐藏（任务书口径）。 */}
        <div className="mt-6">
          {CAPSULES.map(({ to, label, desc, icon: Icon }, i) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 py-4 transition-transform duration-120 ease-philia-spring active:scale-[0.98] ${i > 0 ? HAIRLINE : ''}`}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-oak-light"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5 text-ink/60" strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold leading-5">{label}</span>
                <span className="mt-0.5 block text-caption-xs text-ink-secondary">{desc}</span>
              </span>
              <span className="shrink-0 text-ink/30" aria-hidden="true">
                ›
              </span>
            </Link>
          ))}
          <div
            data-testid="philia-passport-teaser"
            aria-disabled="true"
            className={`flex items-center gap-3 py-4 opacity-60 ${HAIRLINE}`}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-oak-light"
              aria-hidden="true"
            >
              <BookOpen className="h-5 w-5 text-ink/60" strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-semibold leading-5">成长护照</span>
              <span className="mt-0.5 block text-caption-xs text-ink-secondary">护照盖章预告</span>
            </span>
            <span className="shrink-0 rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">
              9c 解锁
            </span>
          </div>
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
