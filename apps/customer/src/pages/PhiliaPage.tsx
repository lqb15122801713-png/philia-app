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
 * - 成长三格：陪伴天数（user.createdAt 距今）· 服务次数（listMine completed 数）；
 *   守护值位不造假维持不出（裁定 #23 豁免）；
 *   大数字 u1-num 20/700（试样 800 字重 → 自托管 Montserrat 仅至 700）；grid-cols-3；
 * 换皮批片 2（F-01 定稿落地，2026-09-29）：
 * - 第三格改「照片数」（定稿 F-01=陪伴/服务/照片三数；逐单 serviceStep.list 照片合计，
 *   复用 listMine 缓存；原「累计消费」格退役——F-01 是纯情感件，不摆钱）；
 * - 页首加 F-01 情感文案层（mono eyebrow + serif 24/900 宣言，文案入 copy 键）；
 * - 陪伴段位/徽章区、生日特辑=置灰槽位（PD-15 三规：不上数不上假件+注记
 *   「即将点亮」+data-testid=slot-badges / slot-birthday）；
 * - 三胶囊卡阵退役 → 试样 q-row 细线列表行工艺（U4-A 首页次级行同工艺：oak-light
 *   圆角 14 图标芯片 + 名 14/600 + 述 11 + ›），成长护照预告行并入同组；
 * - 形象位宠物名换 u1-serif 衬线展示位（试样 .q-name）；日记卡圆角 16 越四档
 *   → panel 20 + 细线 ring；text-body(15) 越字阶处取 14；
 * - 维持不动（登记）：顶部问候语+关闭钮（试样为 serif wordmark+守护值，守护值无真值）；
 *   LV/进度条/喂食玩耍打扮拍照四钮无真实字段/接口（U1-F 禁做假互动在案）。
 *
 * 画布化（产品-1010 画布全屏批 片 3 · 特别裁 §五.2：本屏=只做文案+整块显隐，不做拖排
 * ——全屏手势冲突；页面侧 layout.map 照模板渲染）：九块入册（philia.header/manifesto/
 * petrail/tristats/booking/links/growthslot/birthdayslot/diary），块序/显隐=
 * useCanvasLayout('philia')（published→注册表默认序尾补，空=F1_DEFAULT_ORDER 兜底）；
 * 写死文案全抽 f1. 前缀新键（默认值=现写死文案逐字）并挂 CK(data-copy-key) 点选反查锚
 * （aria 属性/ErrorState/EmptyState 的 string props 挂不上锚，如实入册注记）；
 * philia.booking=复用 home 域共享件 HomeBookingPanel，键归 home 域引用不重复注册；
 * ?canvasPreview=1 探针=水印注记行（mc.canvasExampleNote）；店锚=?canvasStore= 预览店锚 >
 * 记忆门店 > 就近首店（MePage 同口径）。转场/下滑关闭手势/三数聚合/日记聚合零改动，
 * data-testid 原值全保留。
 */

import { useQuery } from '@tanstack/react-query'
import { BookOpen, Camera, ChevronRight, IdCard, PawPrint, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, PhotoWall, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import type { PhotoWallPhoto } from '@philia/shared'
import HomeBookingPanel from '../components/home/HomeBookingPanel'
import { mc, type MemberCopyKey } from '../components/member/copy'
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  formatDateCn,
} from '../components/home/common'
import { readLastBooking } from '@/lib/bookingPrefill'

const HAIRLINE = 'border-t border-line-ring'

/** 按时段的问候语键位（早安/午安/晚安，文案=copy 键 f1.greet 三枚） */
function greetingKey(): MemberCopyKey {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return 'f1.greetMorning'
  if (h >= 11 && h < 18) return 'f1.greetNoon'
  return 'f1.greetNight'
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

/** 养宠小贴士静态卡键位（日记不足 3 条时补齐；文案=copy 键 f1.tip 三对） */
const CARE_TIPS: ReadonlyArray<{ titleKey: MemberCopyKey; descKey: MemberCopyKey }> = [
  { titleKey: 'f1.tip1Title', descKey: 'f1.tip1Desc' },
  { titleKey: 'f1.tip2Title', descKey: 'f1.tip2Desc' },
  { titleKey: 'f1.tip3Title', descKey: 'f1.tip3Desc' },
]

/** 物种展示键位（狗狗/猫咪/小可爱，文案=copy 键 f1.species 三枚） */
const SPECIES_LABEL_KEY: Record<string, MemberCopyKey> = {
  dog: 'f1.speciesDog',
  cat: 'f1.speciesCat',
  other: 'f1.speciesOther',
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const F1_DEFAULT_ORDER = [
  'philia.header',
  'philia.manifesto',
  'philia.petrail',
  'philia.tristats',
  'philia.booking',
  'philia.links',
  'philia.growthslot',
  'philia.birthdayslot',
  'philia.diary',
] as const

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
    return <ErrorState message={mc('f1.petLoadFail')} onRetry={() => void petsQuery.refetch()} />
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
          <span className="block text-body-sm font-semibold"><CK k="f1.petEmptyTitle">{mc('f1.petEmptyTitle')}</CK></span>
          <span className="mt-0.5 block text-caption text-ink-secondary">
            <CK k="f1.petEmptyDesc">{mc('f1.petEmptyDesc')}</CK>
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
              <CK k={SPECIES_LABEL_KEY[pet.species] ?? 'f1.speciesOther'}>
                {mc(SPECIES_LABEL_KEY[pet.species] ?? 'f1.speciesOther')}
              </CK>
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
    return <ErrorState message={mc('f1.diaryLoadFail')} onRetry={() => void diaryQuery.refetch()} />
  }

  const entries = diaryQuery.data
  const tipsNeeded = Math.max(0, 3 - entries.length)

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 ? (
        <EmptyState
          title={mc('f1.diaryEmptyTitle')}
          desc={mc('f1.diaryEmptyDesc')}
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
            <p className="text-caption text-brand-primary-pressed"><CK k="f1.tipTag">{mc('f1.tipTag')}</CK></p>
            <p className="mt-1 text-body-sm font-semibold"><CK k={tip.titleKey}>{mc(tip.titleKey)}</CK></p>
            <p className="mt-1 text-caption text-ink-secondary"><CK k={tip.descKey}>{mc(tip.descKey)}</CK></p>
          </article>
        )
      })}
    </div>
  )
}

/** 入口行组键位（宠物档案/会员卡/服务相册，真实链路保留；文案=copy 键 f1.link 三对） */
const CAPSULES: ReadonlyArray<{ to: string; labelKey: MemberCopyKey; descKey: MemberCopyKey; icon: typeof PawPrint }> = [
  { to: '/philia/pets', labelKey: 'f1.linkPets', descKey: 'f1.linkPetsDesc', icon: PawPrint },
  { to: '/member', labelKey: 'f1.linkCard', descKey: 'f1.linkCardDesc', icon: IdCard },
  { to: '/philia/moments', labelKey: 'f1.linkMoments', descKey: 'f1.linkMomentsDesc', icon: Camera },
]

const DAY_MS = 86_400_000

/** F-01 落地三数（定稿 F-01：陪伴天数 · 服务次数 · 照片数；片 2 杂项组换皮）：
 *  陪伴天数（user.createdAt 距今）· 服务次数（listMine completed 数）· 照片数
 *  （completed 逐单 serviceStep.list 照片数合计，复用已缓存的 listMine，失败项不计入）；
 *  守护值无真实来源不出（裁定 #23 豁免，守护值已废止不建第四本账）。
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
  /* 照片数：复用 listMine 缓存逐单聚合（内测量级；单预约读取失败不阻断合计） */
  const photoCountQ = useQuery({
    queryKey: ['philia', 'photo-count'],
    queryFn: async (): Promise<number> => {
      let n = 0
      for (const appt of mineQ.data?.groups.completed ?? []) {
        try {
          const steps = await trpc.serviceStep.list.query({ appointmentId: appt.id })
          for (const s of steps) n += s.photos.length
        } catch {
          // 单个预约步骤读取失败不计入合计
        }
      }
      return n
    },
    enabled: !!user && !!mineQ.data,
    staleTime: 60_000,
  })
  if (meRawQ.isError || mineQ.isError) return null
  const createdAt = meRawQ.data?.user?.createdAt
  const joinDays = createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS) + 1)
    : null
  const completedList = mineQ.data?.groups.completed ?? []
  const photoCount = photoCountQ.data ?? null
  const itemsAll: Array<{ k: MemberCopyKey; label: string; value: string | null }> = [
    { k: 'f1.statDays', label: mc('f1.statDays'), value: joinDays !== null ? `${joinDays} 天` : null },
    { k: 'f1.statServices', label: mc('f1.statServices'), value: completedList.length > 0 ? `${completedList.length} 次` : null },
    { k: 'f1.statPhotos', label: mc('f1.statPhotos'), value: photoCount !== null && photoCount > 0 ? `${photoCount} 张` : null },
  ]
  const items = itemsAll.filter((i) => i.value !== null)
  if (items.length === 0) return null
  return (
    <section
      data-testid="philia-tri-stats"
      aria-label="陪伴数据"
      className="mt-5 grid grid-cols-3 gap-2 border-y border-line-ring py-3"
    >
      {items.map((i) => (
        <p key={i.k} className="text-center">
          <span className="u1-num block text-title-lg font-bold leading-7">{i.value}</span>
          <span className="mt-0.5 block text-caption-xs leading-4 text-ink-secondary"><CK k={i.k}>{i.label}</CK></span>
        </p>
      ))}
    </section>
  )
}

export default function PhiliaPage() {
  const navigate = useNavigate()
  const { trpc } = usePhiliaClient()
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

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（MePage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const f1StoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'philia')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : F1_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('philia', f1StoreId, registryBlocks)

  const greetKey = greetingKey()

  /* ---- 九块渲染器（块内逻辑与改造前逐字一致；文案键挂 CK 点选反查锚） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. philia.header：问候页头（按时段问候语 + 昵称 + 欢迎行 + 关闭钮） */
    'philia.header': () => (
      <header className="flex items-start justify-between pt-8">
        <div>
          <h1 className="text-title-lg">
            <CK k={greetKey}>{mc(greetKey)}</CK>，{user?.nickname ?? mc('f1.greetFallback')}
          </h1>
          <p className="mt-1 text-caption text-ink-secondary">
            <CK k="f1.welcome">{mc('f1.welcome')}</CK>
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={mc('f1.closeAria')}
          className="u1-ring flex h-11 w-11 items-center justify-center rounded-full bg-card transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <X className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
        </button>
      </header>
    ),

    /* 2. philia.manifesto：F-01 情感文案层（定稿 F-01 页首工艺）：mono eyebrow 9.5/.24em +
          serif 宣言 24/900 lh1.55（片 2 落地；文案入 copy 键） */
    'philia.manifesto': () => (
      <div className="mt-6">
        <p className="u1-num text-v2-trace uppercase tracking-[.24em] text-ink-secondary">
          <CK k="f1.eyebrow">{mc('f1.eyebrow')}</CK>
        </p>
        <p className="u1-serif mt-2.5 whitespace-pre-line text-[24px] font-black leading-[1.55]">
          <CK k="f1.manifesto">{mc('f1.manifesto')}</CK>
        </p>
      </div>
    ),

    /* 3. philia.petrail：当前宠物大头像横滑（U1-F 形象位：圆形双细线环） */
    'philia.petrail': () => (
      <div className="mt-6">
        <PetAvatarRail />
      </div>
    ),

    /* 4. philia.tristats：F-01 落地三数：陪伴天数 · 服务次数 · 照片数
          （守护值无真实来源不出；失败隐去） */
    'philia.tristats': () => <TriStats />,

    /* 5. philia.booking：U1-F 一键预约卡：内嵌现成一键再约链路（9a HomeBookingPanel
          逻辑原样；键归 home 域共享件，本屏引用不重复注册） */
    'philia.booking': () => (
      <div className="mt-5" data-testid="philia-booking-card">
        <HomeBookingPanel />
      </div>
    ),

    /* 6. philia.links：U4-D2 试样 q-row 细线列表行工艺（U4-A 首页次级行同工艺：
          oak-light 圆角 14 图标芯片 + 名 14/600 + 述 11 + › 墨 30%）；真实链路保留。
          成长护照预告行并入同组（置灰静态「9c 解锁」，非按钮不挂链）；
          守护市集行无路由隐藏（任务书口径）。 */
    'philia.links': () => (
      <div className="mt-6">
        {CAPSULES.map(({ to, labelKey, descKey, icon: Icon }, i) => (
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
              <span className="block text-body-sm font-semibold leading-5"><CK k={labelKey}>{mc(labelKey)}</CK></span>
              <span className="mt-0.5 block text-caption-xs text-ink-secondary"><CK k={descKey}>{mc(descKey)}</CK></span>
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
            <span className="block text-body-sm font-semibold leading-5"><CK k="f1.passportTitle">{mc('f1.passportTitle')}</CK></span>
            <span className="mt-0.5 block text-caption-xs text-ink-secondary"><CK k="f1.passportDesc">{mc('f1.passportDesc')}</CK></span>
          </span>
          <span className="shrink-0 rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">
            <CK k="f1.passportBadge">{mc('f1.passportBadge')}</CK>
          </span>
        </div>
      </div>
    ),

    /* 7. philia.growthslot：F-01 槽位（PD-15 V1.1 三规：置灰不上数不上假件 + 注记 +
          data-testid）：陪伴段位/徽章区无真实数据源（schema 无段位/徽章表）——置灰留口 */
    'philia.growthslot': () => (
      <section className="mt-6" data-testid="slot-badges" aria-disabled="true">
        <div className="flex items-baseline justify-between">
          <h2 className="text-v2-section"><CK k="f1.growthTitle">{mc('f1.growthTitle')}</CK></h2>
          <span className="rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">
            <CK k="slot.soon">{mc('slot.soon')}</CK>
          </span>
        </div>
        <div className="mt-3 rounded-card border border-dashed border-line bg-card px-4 py-8 text-center opacity-60">
          <p className="text-caption text-ink-secondary"><CK k="f1.growthSlotDesc">{mc('f1.growthSlotDesc')}</CK></p>
        </div>
      </section>
    ),

    /* 8. philia.birthdayslot：生日特辑=预留位（定稿 F-01 生日周自动生成功能未开工），同规置灰 */
    'philia.birthdayslot': () => (
      <section className="mt-3" data-testid="slot-birthday" aria-disabled="true">
        <div className="rounded-card border border-dashed border-line bg-card p-4 opacity-60">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body-sm font-semibold"><CK k="f1.birthdayTitle">{mc('f1.birthdayTitle')}</CK></p>
            <span className="shrink-0 rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">
              <CK k="slot.soon">{mc('slot.soon')}</CK>
            </span>
          </div>
          <p className="mt-1 text-caption text-ink-secondary"><CK k="f1.birthdayDesc">{mc('f1.birthdayDesc')}</CK></p>
        </div>
      </section>
    ),

    /* 9. philia.diary：菲丽亚日记（已完成服务前后对比照回顾；不足 3 条养宠小贴士补齐） */
    'philia.diary': () => (
      <section className="mt-8">
        <h2 className="mb-3 text-title"><CK k="f1.diaryTitle">{mc('f1.diaryTitle')}</CK></h2>
        <DiaryFeed />
      </section>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="philia" storeId={f1StoreId}>
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
        aria-label={mc('f1.spaceAria')}
      >
        <div className="mx-auto min-h-full max-w-lg px-4 pb-28">
          {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
          {isCanvasPreview ? (
            <p
              className="pt-2 text-center text-caption-xs text-ink-secondary"
              data-testid="philia-canvas-preview-note"
            >
              {mc('mc.canvasExampleNote')}
            </p>
          ) : null}
          {/* 块流：九块按有效布局渲染（published 覆盖∪默认序尾补；特别裁 §五.2=只做文案+
              整块显隐，不做拖排）；默认序下 DOM 结构零差异 */}
          {layout.map((b) =>
            b.visible ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
      </div>
    </CanvasLayoutLoader>
  )
}
