/**
 * HomePage · 客户端首页（批次 U1 任务 C · 双态重构 · v9.1 视觉语言）
 *
 * 结构六段（任务书 U1-C 逐条落地，试样版本卡 de2b644 文本口径）：
 * 1. 顶图 banner：通栏到状态栏，wordmark + 会员码浮于图上；图注标题（中文展示位
 *    衬线 u1-serif）+ 会员信息行（昵称 · 加入第 N 天，真实 auth.me）。
 *    图源取舍：复用库内既有资产 /brand/banner-home-1200.png（9a.3 下掉但资产在库），
 *    不新推二进制图片；产品侧 banner 资产包入库后替换 src 即可。img 加载失败静默
 *    隐藏留米白底（接口断开/资产缺失不破版）。
 * 2. 主入口大卡：白卡上探压 banner 下缘 26px（-mt-[26px] + u1-card 细线 ring 近零影）。
 *    横排三入口 洗护/造型美容/寄养，各带「时长·价格起」小字——数据=首店服务目录
 *    （store.getWithServices：记忆门店优先，否则 listNearby 首店；时长=服务默认
 *    durationMin 档，与 9a 引擎未输出回退默认同口径；价格=services.priceFen 真实
 *    价目 min；目录查询失败/为空 → 小字隐去，入口导航保留真实链路）。
 *    图标取舍：产品侧 photos/icons/ 四张透明底 PNG 未入库——以 lucide 线图标
 *    （墨色 24px）占位，结构留 img 插槽（见 EntryIcon），资产到位后替换。
 *    卡内细线隔出次级行：商城/会员卡真实跳转；守护市集无路由（任务书「该行隐藏」）、
 *    联系门店无 phone 字段（U1-A 疑点口径）——二者不渲染，不造假按钮。
 * 3. 会员提醒条（深棕墨条 + 柠檬礼物圆标）：schema 无守护值/会员档/到期字段
 *    （server/src/db/schema.ts users 表，全库 0 命中），禁编造到期数字与演示数字——
 *    故文案取真实次卡余额（pass.mine）：「次卡共剩 N 次 · 到店出示会员码 ›」，
 *    点击进 /philia/member（/me/card 属 U1-H 后续批，路由暂缺按任务书口径跳既有
 *    会员页）；无可用次卡 → 整条隐去。
 * 4. 守护值细线行：守护值/星芽会员档/已省均无真实来源（无积分表、无折扣引擎），
 *    只渲染可真实聚合三项：陪伴天数（user.createdAt 距今，MemberPage RealStatsCard
 *    同口径）· 服务次数（listMine completed 数）· 累计消费（completed priceFen 合计）；
 *    查询失败或无数据 → 整段隐去，禁写死演示数字。
 * 5. 我的毛孩子圆形头像行：pet.list 真实数据（avatarUrl 或 paw 占位），末位添加钮、
 *    管理入口均真实跳 /philia/pets；空档 → 真实引导行；查询失败 → 错误行可重试。
 * 6. 服务中态：存在 in_service 洗护单（listMine）时——图注标题变「洗护进行中 ·
 *    第 N 步」（serviceStep.list active 步，与 HomeBookingPanel 同 queryKey 缓存共享，
 *    零增发）；在店细线卡（InServicePanel 换肤：2px 细进度线柠檬段 + 步骤名 + 过程照
 *    缩略 + 查看全程 ›）置顶于主入口大卡之上。
 *
 * 与批次 9a HomeBookingPanel 的关系（取舍写明）：主入口大卡取代旧主区面板的「入口」
 * 职能；一键再约真实链路必须保留（老板铁则：所有按钮都是真功能）——HomeBookingPanel
 * 逻辑原样不动，常态时其 RebookPanel/降级入口卡置于主入口大卡之下（页面主行动区，
 * 全屏唯一柠檬黄 CTA 保留），服务中态时其 InServicePanel 置于大卡之上（任务书第 6 段）。
 *
 * 下掉清单（任务书，逐一断言）：无问候语（home-greeting）、无旧服务文字行
 * （home-services）、无胶囊卡阵、无 banner 轮播点。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bath, BedDouble, Gift, PawPrint, Plus, Scissors } from 'lucide-react'
import { useMe, usePhiliaClient } from '@philia/shared'
import HomeBookingPanel from '../components/home/HomeBookingPanel'
import { ErrorState } from '../components/home/common'
import { fenToYuan } from '@/components/booking/format'
import type { AppointmentListItem } from '@/components/booking/types'
import { readLastBooking } from '@/lib/bookingPrefill'

const DAY_MS = 86_400_000
const HAIRLINE = 'border-t border-[rgba(74,59,46,.09)]'

/** 服务目录行（三入口聚合用到的字段） */
interface ServiceRow {
  id: string
  type: string
  name: string
  durationMin: number | null
  priceFen: number
}

/** 入口图标插槽：产品侧 photos/icons/ 四张透明底 PNG 未入库——lucide 线图标占位；
 *  资产到位后以 <img src> 替换 Icon 即可（容器尺寸不变）。 */
function EntryIcon({ icon: Icon, label }: { icon: typeof Bath; label: string }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sunken" aria-hidden="true">
      <Icon className="h-6 w-6 text-ink" strokeWidth={1.5} aria-label={label} />
    </span>
  )
}

/** 「时长·价格起」小字聚合：分钟/价格取目录最小值；任一项缺失则该项不显示 */
function entryNote(services: ServiceRow[], unit: string): string | null {
  if (services.length === 0) return null
  const prices = services.map((s) => s.priceFen)
  const durations = services.map((s) => s.durationMin).filter((d): d is number => d !== null && d > 0)
  const parts: string[] = []
  if (durations.length > 0) parts.push(`约 ${Math.min(...durations)} 分钟起`)
  parts.push(`${fenToYuan(Math.min(...prices))} 起${unit}`)
  return parts.join(' · ')
}

export default function HomePage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const [bannerImgOk, setBannerImgOk] = useState(true)

  /* ---- 数据源（queryKey 全部复用既有键，缓存共享零增发） ---- */
  const mineQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  // 会员信息行 / 陪伴天数：auth.me 原始响应（含 createdAt，MemberPage 同 key 同口径）
  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    enabled: !!user,
  })
  // 次卡余额（会员提醒条真实文案来源；无可用次卡 → 提醒条整条隐去）
  const passQ = useQuery({
    queryKey: ['pass', 'mine'],
    queryFn: () => trpc.pass.mine.query(),
    enabled: !!user,
  })

  // 服务中洗护单（六步流；寄养无六步，不触发服务中态，与 HomeBookingPanel 同口径）
  const inServiceAppt: AppointmentListItem | null = useMemo(() => {
    const rows = mineQ.data?.groups.in_service ?? []
    return rows.find((a) => a.type === 'grooming') ?? null
  }, [mineQ.data])

  // 服务中步骤（与 HomeBookingPanel/直播页同 queryKey，缓存共享）
  const stepsQ = useQuery({
    queryKey: ['serviceStep', 'list', inServiceAppt?.id],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: inServiceAppt!.id }),
    enabled: !!user && inServiceAppt !== null,
  })
  const activeStep = (stepsQ.data ?? []).find((s) => s.status === 'active') ?? null

  // 首店解析：B4-3 记忆门店优先，否则 listNearby 首店（仅取服务目录做三入口小字）
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: !!user && memoryStoreId === null,
    staleTime: 300_000,
  })
  const homeStoreId = memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null
  const storeQ = useQuery({
    queryKey: ['store', 'getWithServices', homeStoreId],
    queryFn: () => trpc.store.getWithServices.query({ storeId: homeStoreId! }),
    enabled: !!user && homeStoreId !== null,
    staleTime: 300_000,
  })
  const services = (storeQ.data?.services ?? []) as ServiceRow[]

  // 三入口小字：洗护=grooming 非造型；造型美容=grooming 名含「造型」（目录无则小字隐去）；
  // 寄养=boarding（每晚价口径）
  const washNote = entryNote(services.filter((s) => s.type === 'grooming' && !s.name.includes('造型')), '')
  const styleNote = entryNote(services.filter((s) => s.type === 'grooming' && s.name.includes('造型')), '')
  const boardingNote = entryNote(services.filter((s) => s.type === 'boarding'), '/晚')

  // 会员信息行 + 守护值细线行真实聚合（失败/无数据 → 各段隐去）
  const joinDays = useMemo(() => {
    const createdAt = meRawQ.data?.user?.createdAt
    if (!createdAt) return null
    return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS) + 1)
  }, [meRawQ.data])
  const completed = mineQ.data?.groups.completed ?? []
  const statsReady = meRawQ.isSuccess && mineQ.isSuccess && (joinDays !== null || completed.length > 0)

  // 会员提醒条：真实次卡余额（pass.mine usable 合计）
  const usablePasses = (passQ.data ?? []).filter((p) => p.usable)
  const passRemainTotal = usablePasses.reduce((s, p) => s + p.remainTimes, 0)

  const entryCard = (
    <section data-testid="home-entry-card" className="u1-card relative z-10 -mt-[26px] p-4" aria-label="服务入口">
      {/* 横排三入口：洗护 / 造型美容 / 寄养 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { to: '/booking/grooming', testid: 'home-entry-grooming', icon: Bath, name: '洗护', note: washNote },
          { to: '/booking/grooming?tab=style', testid: 'home-entry-style', icon: Scissors, name: '造型美容', note: styleNote },
          { to: '/booking/boarding', testid: 'home-entry-boarding', icon: BedDouble, name: '寄养', note: boardingNote },
        ].map(({ to, testid, icon, name, note }) => (
          <Link
            key={testid}
            to={to}
            data-testid={testid}
            className="flex flex-col items-center gap-1.5 py-1 transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <EntryIcon icon={icon} label={name} />
            <span className="text-body-sm font-semibold leading-5">{name}</span>
            {note ? (
              <span className="u1-num text-center text-caption-xs leading-4 text-ink-secondary">{note}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {/* 细线隔出次级行：商城 / 会员卡（守护市集无路由、联系门店无 phone——不渲染） */}
      <div className={`mt-3 grid grid-cols-2 gap-2 pt-1 ${HAIRLINE}`}>
        <Link
          to="/mall"
          data-testid="home-sub-mall"
          className="flex items-center justify-between py-2.5 text-body-sm text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          商城
          <span className="text-ink-secondary" aria-hidden="true">›</span>
        </Link>
        <Link
          to="/philia/member"
          data-testid="home-sub-member"
          className="flex items-center justify-between py-2.5 text-body-sm text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          会员卡
          <span className="text-ink-secondary" aria-hidden="true">›</span>
        </Link>
      </div>
    </section>
  )

  return (
    <div className="px-4 pb-32">
      {/* 1. 顶图 banner（通栏到状态栏；wordmark + 会员码浮于图上） */}
      <section data-testid="home-banner" className="relative -mx-4" aria-label="品牌横幅">
        {bannerImgOk ? (
          <img
            src="/brand/banner-home-1200.png"
            alt="菲丽亚宠物门店"
            data-testid="home-banner-img"
            onError={() => setBannerImgOk(false)}
            className="h-44 w-full object-cover"
          />
        ) : (
          <div className="h-44 w-full bg-oak-light" aria-hidden="true" />
        )}
        <header data-testid="home-topbar" className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-6">
          <p className="font-display text-[22px] font-semibold italic leading-7 text-ink">
            philia
          </p>
          <Link
            to="/philia/member"
            data-testid="home-member-code"
            className="mt-1 rounded-full border border-[rgba(74,59,46,.3)] bg-card/80 px-3.5 py-1.5 text-caption-xs leading-4 text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            会员码
          </Link>
        </header>
        {/* 图注标题（衬线展示位）+ 会员信息行（真实数据；服务中态标题变第 N 步）。
            pb-10：为后随卡片 26px 上探预留，图注行不被压盖 */}
        <div className="px-4 pb-10 pt-3">
          <h1 data-testid="home-banner-title" className="u1-serif text-title-lg leading-7">
            {inServiceAppt
              ? `洗护进行中${activeStep?.stepOrder ? ` · 第 ${activeStep.stepOrder} 步` : ''}`
              : '守护每一次洗护'}
          </h1>
          <p data-testid="home-banner-sub" className="mt-0.5 text-caption-xs leading-4 text-ink-secondary">
            {user?.nickname ?? '宠友'}
            {joinDays !== null ? ` · 加入菲丽亚第 ${joinDays} 天` : ''}
          </p>
        </div>
      </section>

      {/* 6. 服务中态：在店细线卡置顶于大卡之上（HomeBookingPanel 逻辑原样，版式换肤） */}
      {inServiceAppt ? (
        <div className="relative z-10 -mt-[26px]">
          <HomeBookingPanel />
        </div>
      ) : null}

      {/* 2. 主入口大卡（常态压 banner 下缘 26px；服务中态跟在店卡之后） */}
      {inServiceAppt ? <div className="mt-3">{entryCard}</div> : entryCard}

      {/* 一键再约 / 降级入口卡：常态主行动区（9a 双态面板逻辑不动，全屏唯一柠檬黄 CTA） */}
      {!inServiceAppt ? (
        <div className="mt-3">
          <HomeBookingPanel />
        </div>
      ) : null}

      {/* 3. 会员提醒条（深棕墨条 + 柠檬礼物圆标；真实次卡余额，无则整条隐去） */}
      {passRemainTotal > 0 ? (
        <Link
          to="/philia/member"
          data-testid="home-member-strip"
          className="mt-4 flex items-center gap-3 rounded-panel bg-ink px-4 py-3 text-canvas transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary" aria-hidden="true">
            <Gift className="h-4 w-4 text-ink" strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1 text-body-sm leading-5">
            次卡共剩 <span className="u1-num font-semibold">{passRemainTotal}</span> 次 · 到店出示会员码
          </span>
          <span className="shrink-0 text-canvas/70" aria-hidden="true">›</span>
        </Link>
      ) : null}

      {/* 4. 守护值细线行（真实聚合三项；守护值/档名/已省无真实来源不出现） */}
      {statsReady ? (
        <section
          data-testid="home-stats-row"
          aria-label="陪伴数据"
          className={`mt-4 grid grid-cols-3 gap-2 py-3 ${HAIRLINE} border-b border-[rgba(74,59,46,.09)]`}
        >
          {[
            { label: '陪伴天数', value: joinDays !== null ? `${joinDays} 天` : null },
            { label: '服务次数', value: completed.length > 0 ? `${completed.length} 次` : null },
            {
              label: '累计消费',
              value: completed.length > 0 ? fenToYuan(completed.reduce((s, a) => s + a.priceFen, 0)) : null,
            },
          ]
            .filter((i) => i.value !== null)
            .map((i) => (
              <p key={i.label} className="text-center">
                <span className="u1-num block text-body-sm font-semibold leading-5">{i.value}</span>
                <span className="block text-caption-xs leading-4 text-ink-secondary">{i.label}</span>
              </p>
            ))}
        </section>
      ) : null}

      {/* 5. 我的毛孩子圆形头像行（pet.list 真实数据） */}
      <section data-testid="home-pets-row" className="mt-5" aria-label="我的毛孩子">
        <div className="flex items-baseline justify-between">
          <h2 className="text-title">我的毛孩子</h2>
          <Link to="/philia/pets" data-testid="home-pets-manage" className="text-caption-xs text-ink-secondary">
            管理 ›
          </Link>
        </div>
        {petsQ.isPending ? (
          <div className="mt-3 flex gap-4">
            {[1, 2].map((i) => (
              <span key={i} className="h-14 w-14 animate-pulse rounded-full bg-sunken" />
            ))}
          </div>
        ) : petsQ.isError ? (
          <div className="mt-3">
            <ErrorState message="毛孩子加载失败" onRetry={() => void petsQ.refetch()} />
          </div>
        ) : (petsQ.data ?? []).length === 0 ? (
          <Link
            to="/philia/pets"
            data-testid="home-pets-empty"
            className="mt-3 flex items-center justify-between rounded-control bg-sunken px-4 py-3 text-body-sm text-ink-secondary"
          >
            还没有毛孩子档案，去添加 TA 吧
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          <div className="mt-3 flex flex-wrap gap-4">
            {(petsQ.data ?? []).map((pet) => (
              <Link
                key={pet.id}
                to="/philia/pets"
                data-testid={`home-pet-${pet.id}`}
                className="flex w-14 flex-col items-center gap-1 transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {pet.avatarUrl ? (
                  <img
                    src={pet.avatarUrl}
                    alt={pet.name ?? '毛孩子'}
                    loading="lazy"
                    className="h-14 w-14 rounded-full bg-sunken object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sunken" aria-hidden="true">
                    <PawPrint className="h-6 w-6 text-ink-secondary" strokeWidth={1.5} />
                  </span>
                )}
                <span className="w-full truncate text-center text-caption-xs leading-4">{pet.name ?? '毛孩子'}</span>
              </Link>
            ))}
            <Link
              to="/philia/pets"
              data-testid="home-pets-add"
              aria-label="添加毛孩子"
              className="flex w-14 flex-col items-center gap-1 transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <span className="u1-ring flex h-14 w-14 items-center justify-center rounded-full bg-card">
                <Plus className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
              </span>
              <span className="text-caption-xs leading-4 text-ink-secondary">添加</span>
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
