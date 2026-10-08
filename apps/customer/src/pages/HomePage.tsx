/**
 * HomePage · 客户端首页（A-1 常态 / A-2 服务中态 · 换皮批片 2 · 定稿 V2.3 层叠件）
 *
 * 层叠秩序（定稿 §4.2 冻结结构）：BANNER 槽 → 身份带压 BANNER 下沿（-98px）→
 * 浮动大卡压身份带下沿（-16px，上向影不可省）→ 案例流（双列不等高）→ dock。
 * 服务中态（A-2）：LIVE 卡压 BANNER 下沿，身份带降级为窄行 idline；备台行=消毒备台态。
 *
 * 四铁律执行：功能逻辑/数据源零改动（listMine/me/pet.list/pass.mine/serviceStep.list
 * 全部沿用）；入口不丢——会员码=idband/idlive qr 钮（/me/card）、一键再约=HomeBookingPanel
 * （RebookPanel 逻辑原样）、商城入口=保留件（见次级行）、我的毛孩子/统计行保留件后置。
 *
 * BANNER=槽位（§4.2/§七）：内容=A5 端口平面物料，现态=库内既有照片资产优先、
 * 加载失败回退占位渐变（§1.4 口径）；不在码上定稿内容。
 * 案例流=MomentsPage 域真实数据（自己的服务故事，最多 4 卡）；无数据整段隐去
 * （内容层只做有口不做定稿，不画假案例）。
 *
 * 端口批收尾片 3（画布端口 B 股）：九区块数组化——块内逻辑/条件一字不动
 * （live 渲染器自带「仅 inServiceAppt 出件」、idband/megacard 自带「仅非 inServiceAppt
 * 出件」、cases/passStrip/stats 内条件同留）；块序/显隐=useCanvasLayout 有效布局
 * （published 布局覆盖∪注册表默认序尾补，DEFAULT_ORDER=改造前 JSX 序兜底）；
 * data-block-key 锚 + CK(data-copy-key) 挂注册表 copyKeys 键位（画布点选反查用；
 * home.entryNote 注册表有声明但码内无此 copy 键[副题=动态聚合串]——不挂注记）。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Plus } from 'lucide-react'
import { CanvasLayoutLoader, CK, Skeleton, useCanvasLayout, useMe, usePhiliaClient, getStepDef, resolveSlotUrl, slotContentOf } from '@philia/shared'
import HomeBookingPanel from '../components/home/HomeBookingPanel'
import { ErrorState } from '../components/home/common'
import { fenToYuan, fmtHM } from '@/components/booking/format'
import type { AppointmentListItem } from '@/components/booking/types'
import { readLastBooking } from '@/lib/bookingPrefill'
import { hc } from '@/copy/home'
import { ntf } from '@/copy/notify'

const DAY_MS = 86_400_000
const HAIRLINE = 'border-t border-[rgba(59,46,36,.09)]'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const DEFAULT_ORDER = [
  'home.banner',
  'home.live',
  'home.idband',
  'home.megacard',
  'home.cases',
  'home.bookingPanel',
  'home.passStrip',
  'home.stats',
  'home.pets',
] as const

/** 内容区左右垫块（原 .px-[22px] 聚合容器拆进各块包层，默认序下 DOM 级等价） */
const PX_BLOCKS: ReadonlySet<string> = new Set([
  'home.cases',
  'home.bookingPanel',
  'home.passStrip',
  'home.stats',
  'home.pets',
])

/** 服务目录行（双入口聚合用到的字段） */
interface ServiceRow {
  id: string
  type: string
  name: string
  durationMin: number | null
  priceFen: number
}

/** 「时长·价格起」mono 副题聚合：分钟/价格取目录最小值；任一项缺失则该项不显示 */
function entryNote(services: ServiceRow[], unit: string): string | null {
  if (services.length === 0) return null
  const prices = services.map((s) => s.priceFen)
  const durations = services.map((s) => s.durationMin).filter((d): d is number => d !== null && d > 0)
  const parts: string[] = []
  if (durations.length > 0) parts.push(`约 ${Math.min(...durations)} 分钟起`)
  parts.push(`${fenToYuan(Math.min(...prices))} 起${unit}`)
  return parts.join(' · ')
}

/** 回馈金期次窗口（冻结口径：上月 26 日~本月 25 日为一期；到账日=次月 settlementDay）
 *  片 2 补修（任务卡 9-29 P1）：26~31 日窗口进下一期——start=本月 26/end=次月 25；
 *  到账月=end 次月（9-29 → 周期 9.26–10.25 · 11 月 settlementDay 日到账）。 */
function periodWindow(now: Date) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const inNext = now.getDate() >= 26
  const start = inNext ? new Date(y, m, 26) : new Date(y, m - 1, 26)
  const end = inNext ? new Date(y, m + 1, 25) : new Date(y, m, 25)
  const arrive = new Date(end.getFullYear(), end.getMonth() + 1, 1)
  return { start, end, arrive }
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
  const passQ = useQuery({
    queryKey: ['pass', 'mine'],
    queryFn: () => trpc.pass.mine.query(),
    enabled: !!user,
  })
  /* 未读角标（补缺批片 5 站内信）：push.unreadCount，30s 轮询兜底（SSE 通知增量另议） */
  const unreadQ = useQuery({
    queryKey: ['push', 'unreadCount'],
    queryFn: () => trpc.push.unreadCount.query(),
    enabled: !!user,
    refetchInterval: 30_000,
  })
  const unreadTotal = unreadQ.data?.total ?? 0
  /* 会员域（身份带档名/回馈金/环行）：membership.my + plans（settlementDay/rebateBp 读表） */
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    enabled: !!user,
    staleTime: 300_000,
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
  const steps = stepsQ.data ?? []
  const activeStep = steps.find((s) => s.status === 'active') ?? null
  const doneStep1 = steps.find((s) => s.stepOrder === 1 && s.status === 'done') ?? null
  // LIVE 卡过程照=当前步最近一张照片（无则纯深棕卡，不画假图）
  const livePhoto = useMemo(() => {
    const photos = (activeStep?.photos ?? []) as Array<{ url: string }>
    return photos.length > 0 ? photos[photos.length - 1]!.url : null
  }, [activeStep])

  // 首店解析：画布预览店锚（?canvasStore=）> B4-3 记忆门店 > listNearby 首店（仅取服务目录做双入口小字）
  const previewStoreId = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasStore'),
    [],
  )
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: !!user && previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const homeStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null
  const storeQ = useQuery({
    queryKey: ['store', 'getWithServices', homeStoreId],
    queryFn: () => trpc.store.getWithServices.query({ storeId: homeStoreId! }),
    enabled: !!user && homeStoreId !== null,
    staleTime: 300_000,
  })
  const services = (storeQ.data?.services ?? []) as ServiceRow[]
  // 洗澡美容=grooming 全族（含造型）；寄养=boarding（每晚价口径）
  const groomNote = entryNote(services.filter((s) => s.type === 'grooming'), '')
  const boardingNote = entryNote(services.filter((s) => s.type === 'boarding'), '/晚')

  // 会员信息：档名/回馈金余额/期次环
  const membership = myQ.data?.membership ?? null
  const plan = useMemo(() => {
    const plans = (plansQ.data?.plans ?? []) as Array<{ planKey: string; label: string; free: boolean; rebateBp: number }>
    return plans.find((p) => p.planKey === membership?.planKey) ?? null
  }, [plansQ.data, membership])
  const tierName = plan ? plan.label.replace(/^会员档·/, '').replace(/：.*$/, '') : null
  const rebateBalance = myQ.data?.rebate?.balanceFen ?? 0
  const periodLogs = (myQ.data?.periodLogs ?? []) as Array<{ type: string; deltaFen: number }>
  const grantedThisPeriod = periodLogs.filter((l) => l.type === 'grant').reduce((s, l) => s + l.deltaFen, 0)
  const settlementDay = plansQ.data?.rebateSettlementDay ?? 5
  const rebatePct = plan && plan.rebateBp > 0 ? plan.rebateBp / 100 : 0
  const pw = periodWindow(new Date())
  const periodPct = Math.min(
    100,
    Math.max(0, Math.round(((Date.now() - pw.start.getTime()) / (pw.end.getTime() - pw.start.getTime())) * 100)),
  )
  const fmtMD = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`

  // 陪伴统计（真实聚合三项；失败/无数据 → 各段隐去）
  const joinDays = useMemo(() => {
    const createdAt = meRawQ.data?.user?.createdAt
    if (!createdAt) return null
    return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS) + 1)
  }, [meRawQ.data])
  const completed = mineQ.data?.groups.completed ?? []
  const statsReady = meRawQ.isSuccess && mineQ.isSuccess && (joinDays !== null || completed.length > 0)

  // 会员提醒条：真实次卡余额（pass.mine usable 合计；无则整条隐去）
  const usablePasses = (passQ.data ?? []).filter((p) => p.usable)
  const passRemainTotal = usablePasses.reduce((s, p) => s + p.remainTimes, 0)

  // 案例流（「店里今天的故事」）：MomentsPage 域真实数据——最近完成服务的前后对比照 after 封面，最多 4 卡
  const casesQ = useQuery({
    queryKey: ['home', 'cases'],
    queryFn: async () => {
      const { groups } = await trpc.appointment.listMine.query()
      const done = groups.completed.slice(0, 8)
      const cards: Array<{ id: string; petName: string | null; serviceName: string | null; storeName: string | null; url: string; at: Date }> = []
      for (const appt of done) {
        try {
          const stepList = await trpc.serviceStep.list.query({ appointmentId: appt.id })
          const ba = stepList.find((s) => s.stepKey === 'before_after')
          const after = ba ? [...ba.photos].reverse().find((p) => p.tag === 'after') : null
          if (!after) continue
          cards.push({
            id: appt.id,
            petName: appt.petName,
            serviceName: appt.serviceName,
            storeName: appt.storeName ?? null,
            url: after.url,
            at: appt.completedAt ?? appt.scheduledStart,
          })
        } catch {
          // 单册读取失败不阻断整流
        }
      }
      return cards.slice(0, 4)
    },
    enabled: !!user,
    staleTime: 300_000,
  })
  const cases = casesQ.data ?? []

  /* ---- 画布端口（端口批收尾片 3）：注册表块序 + 有效布局 ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    enabled: !!user,
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'home')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('home', homeStoreId, registryBlocks)

  /* ---- 九块渲染器（块内逻辑/条件与改造前逐字一致；条件内收进渲染器） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. BANNER 槽（§4.2：高 190+底垫 96；内容=A5 端口槽位；既有照片资产优先，加载失败回退占位渐变；
           端口批片 C：读槽位 home.banner live 值，无=码内默认 /brand/banner-home-1200.png） */
    'home.banner': () => (
      <section className="hv2-banner" data-testid="home-banner" aria-label="品牌横幅">
        {bannerImgOk ? (
          <img
            src={resolveSlotUrl(slotContentOf('home.banner')?.url) ?? '/brand/banner-home-1200.png'}
            alt={slotContentOf('home.banner')?.alt ?? '菲丽亚宠物门店'}
            data-testid="home-banner-img"
            onError={() => setBannerImgOk(false)}
            className="hv2-banner-img"
          />
        ) : null}
        <header className="hv2-banner-top" data-testid="home-topbar">
          <p className="hv2-wordmark">PHILIA</p>
          {/* 补缺批片 5 站内信：头部右侧铃铛入口（unreadCount.total>0 显数字点，>99 显 99+） */}
          <Link
            to="/notifications"
            aria-label={ntf('ntf.title')}
            data-testid="home-notify-entry"
            className="relative grid h-9 w-9 place-items-center rounded-full bg-card/80 text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.6} />
            {unreadTotal > 0 ? (
              <span
                data-testid="home-notify-badge"
                className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-primary px-1 font-number text-[9px] font-bold leading-none text-ink"
              >
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            ) : null}
          </Link>
        </header>
        <div className="hv2-banner-space" />
      </section>
    ),

    /* 2. LIVE 卡（A-2 服务中态：压 BANNER 下沿，仅服务中态出现，CJ-0921-13） */
    'home.live': () =>
      inServiceAppt ? (
        <div className="hv2-livewrap">
          <Link
            to={`/appointments/${inServiceAppt.id}/live`}
            className="hv2-livecard"
            data-testid="home-live-card"
          >
            <div className="top">
              <span className="hv2-livetag"><i /><CK k="home.liveTag">{hc('home.liveTag')}</CK></span>
              <span style={{ fontFamily: 'var(--v2mono)', fontSize: 10.5, color: '#C9BBA0' }}>
                节点 {activeStep?.stepOrder ?? '—'} / {steps.length || 6}
              </span>
            </div>
            <div className="ph">
              {livePhoto ? (
                <img src={livePhoto} alt="" />
              ) : (
                /* 无过程照时信息不消失（不画假图）：纯文字态呈现 caption 内容 */
                <div style={{ padding: '14px 12px', fontSize: 12, fontWeight: 600, color: '#F6EFDD' }}>
                  {inServiceAppt.petName ?? '爱宠'} · {inServiceAppt.serviceName ?? '洗护'} · {activeStep ? (getStepDef(activeStep.stepKey)?.name ?? '') : ''}
                </div>
              )}
              {livePhoto ? (
                <div className="cap">
                  {inServiceAppt.petName ?? '爱宠'} · {inServiceAppt.serviceName ?? '洗护'} · {activeStep ? (getStepDef(activeStep.stepKey)?.name ?? '') : ''}
                </div>
              ) : null}
            </div>
            <div className="bot">
              <span className="av">{(inServiceAppt.petName ?? '宠').slice(0, 1)}</span>
              <span>{inServiceAppt.petName ?? '爱宠'}</span>
              <span className="eta"><CK k="home.liveEta">{hc('home.liveEta', { time: fmtHM(new Date(inServiceAppt.scheduledEnd)) })}</CK></span>
              <span className="go">{hc('home.liveViewAll')}</span>
            </div>
          </Link>
          {/* 备台行：消毒备台态（七节点步 1 完成时刻真实值，无则隐去） */}
          {doneStep1 ? (
            <div className="hv2-preprow" style={{ marginTop: 10 }} data-testid="home-preprow">
              <div>
                <div className="t">{hc('home.preprowTitle')}</div>
                <div className="s">{doneStep1.doneAt ? hc('home.preprowDoneAt', { time: fmtHM(new Date(doneStep1.doneAt)) }) : hc('home.preprowDone')}</div>
              </div>
            </div>
          ) : null}
          {/* 窄行身份条（服务中态降级件） */}
          <div className="hv2-idline" style={{ marginTop: 10 }} data-testid="home-idline">
            <span className="dot" />
            <b>{tierName ?? hc('home.idFallback')}</b>
            <span className="ac">{hc('home.rebateLabel')} {fenToYuan(rebateBalance)}</span>
            <Link to="/me/card" className="qr" data-testid="home-member-code">{hc('home.memberCode')}</Link>
          </div>
        </div>
      ) : null,

    /* 3. 身份带 idband（深棕渐变 135deg；-98px 压 BANNER；仅非服务中态） */
    'home.idband': () =>
      !inServiceAppt ? (
        <div className="hv2-bandwrap">
          <div className="hv2-idband" data-testid="home-idband">
            <div className="mini">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 13.5c-2.8 0-5 2-5 4.2 0 1.4 1 2.3 2.4 2.3 1 0 1.7-.5 2.6-.5s1.6.5 2.6.5c1.4 0 2.4-.9 2.4-2.3 0-2.2-2.2-4.2-5-4.2z" /><circle cx="6.5" cy="10" r="1.6" /><circle cx="10" cy="7.5" r="1.7" /><circle cx="14" cy="7.5" r="1.7" /><circle cx="17.5" cy="10" r="1.6" /></svg>
            </div>
            <div>
              <div className="nm">{tierName ?? hc('home.idFallback')}</div>
              <div className="ac">{membership ? <><CK k="home.rebateLabel">{hc('home.rebateLabel')}</CK> <b>{fenToYuan(rebateBalance)}</b></> : <CK k="home.idJoin">{hc('home.idJoin')}</CK>}</div>
            </div>
            <Link
              to={membership ? '/me/card' : '/member/open'}
              className="qr"
              aria-label="会员码"
              data-testid="home-member-code"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><path d="M14 14h2.5v2.5H14zM20 14v6M14 20h6" /></svg>
            </Link>
          </div>
        </div>
      ) : null,

    /* 4. 浮动大卡 megacard（-16px 压身份带下沿；上向影不可省；仅非服务中态） */
    'home.megacard': () =>
      !inServiceAppt ? (
        <section className="hv2-megacard" data-testid="home-entry-card" aria-label="服务入口">
          <div className="hv2-mc-cols">
            <Link to="/booking/grooming" className="hv2-mc-col" data-testid="home-entry-grooming">
              <svg viewBox="0 0 24 24"><circle cx="6.5" cy="7" r="2.4" /><circle cx="6.5" cy="17" r="2.4" /><path d="M8.5 8.8L19.5 19M8.5 15.2L19.5 5" /></svg>
              <div className="t"><CK k="home.entryGrooming">{hc('home.entryGrooming')}</CK></div>
              {groomNote ? <div className="s">{groomNote}</div> : null}
            </Link>
            <Link to="/booking/boarding" className="hv2-mc-col" data-testid="home-entry-boarding">
              <svg viewBox="0 0 24 24"><path d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z" /></svg>
              <div className="t"><CK k="home.entryBoarding">{hc('home.entryBoarding')}</CK></div>
              <div className="s">{boardingNote ?? hc('home.entryBoardingNote')}</div>
            </Link>
          </div>
          <div className="hv2-mc-div" />
          {/* 回馈金结算环行（付费档；免费档/非会员=开通引导行，不画假环） */}
          {membership && plan && !plan.free ? (
            <Link to="/member/rebate" className="hv2-mc-row hv2-mc-ring" data-testid="home-rebate-ring">
              <svg width="68" height="68" viewBox="0 0 76 76" style={{ flex: 'none' }} aria-hidden="true">
                <circle cx="38" cy="38" r="30" fill="none" stroke="#EDE4CE" strokeWidth="8" />
                <circle cx="38" cy="38" r="30" fill="none" stroke="#F2DFA6" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray="188.5" strokeDashoffset={188.5 * (1 - periodPct / 100)} transform="rotate(-90 38 38)" />
                <text x="38" y="36" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="15" fontWeight="700" fill="#3B2E24">{periodPct}%</text>
                <text x="38" y="49" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="7.5" fill="#8A7D6B">本周期</text>
              </svg>
              <div>
                <div className="big">{fenToYuan(grantedThisPeriod)}</div>
                <div className="cap">{hc('home.ringPeriod', { start: fmtMD(pw.start), end: fmtMD(pw.end) })}<br />{hc('home.ringArrive', { month: pw.arrive.getMonth() + 1, day: settlementDay })}</div>
                <div className="rule1">{hc('home.ringRule', { pct: rebatePct })}</div>
              </div>
            </Link>
          ) : (
            <Link to={membership ? '/member/rebate' : '/member/open'} className="hv2-mc-row" data-testid="home-rebate-guide" style={{ textDecoration: 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3B2E24' }}>
                  {membership ? hc('home.rebateLedger') : hc('home.openMemberClaim')}
                </div>
                <div className="cap" style={{ fontSize: 11, color: '#8A7D6B', marginTop: 3 }}>
                  {membership ? hc('home.rebateBalanceLine', { amt: fenToYuan(rebateBalance), day: settlementDay }) : hc('home.openMemberSub', { pcts: [2, 5, 10].join('/') })}
                </div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#8A7D6B' }} aria-hidden="true">›</span>
            </Link>
          )}
        </section>
      ) : null,

    /* 5. 案例流（「店里今天的故事」=MomentsPage 域真实数据；无数据整段隐去） */
    'home.cases': () =>
      cases.length > 0 ? (
        <section data-testid="home-cases" aria-label="店里今天的故事" style={{ marginTop: 26 }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#3B2E24' }}><CK k="home.casesTitle">{hc('home.casesTitle')}</CK></h3>
            <Link to="/philia/moments" data-testid="home-cases-more" style={{ fontFamily: 'var(--v2mono)', fontSize: 11, color: '#8A7D6B' }}>
              <CK k="home.casesMore">{hc('home.casesMore')}</CK>
            </Link>
          </div>
          <div className="hv2-cases">
            {cases.map((c, i) => (
              <Link key={c.id} to="/philia/moments" className="hv2-case" data-testid={`home-case-${i}`}>
                <img src={c.url} alt="" style={{ height: 132 + ((i * 37) % 65) }} loading="lazy" />
                <div className="tt">{hc('home.caseTitle', { pet: c.petName ?? '毛孩子', service: c.serviceName ?? '洗护' })}</div>
                <div className="src">{c.storeName ?? '门店'} · {c.serviceName ?? '服务'} · {fmtHM(new Date(c.at))}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null,

    /* 6. 一键再约 / 降级入口卡（常态主行动区；服务中态已由 LIVE 卡承载） */
    'home.bookingPanel': () =>
      !inServiceAppt ? (
        <div className="mt-3">
          <HomeBookingPanel />
        </div>
      ) : null,

    /* 7. 会员提醒条（真实次卡余额，无则整条隐去） */
    'home.passStrip': () =>
      passRemainTotal > 0 ? (
        <Link
          to="/member"
          data-testid="home-member-strip"
          className="mt-4 flex items-center gap-3 rounded-panel bg-ink px-4 py-3 text-canvas transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3B2E24" strokeWidth="1.5" className="h-4 w-4"><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M8 8c-2-2-1-5 1-5s3 2 3 5M16 8c2-2 1-5-1-5s-3 2-3 5" /></svg>
          </span>
          <span className="min-w-0 flex-1 text-body-sm leading-5">
            <CK k="home.passStripPre">{hc('home.passStripPre')}</CK><span className="u1-num font-semibold">{passRemainTotal}</span><CK k="home.passStripPost">{hc('home.passStripPost')}</CK>
          </span>
          <span className="shrink-0 text-canvas/70" aria-hidden="true">›</span>
        </Link>
      ) : null,

    /* 8. 守护值细线行（真实聚合三项；守护值/档名/已省无真实来源不出现） */
    'home.stats': () =>
      statsReady ? (
        <section
          data-testid="home-stats-row"
          aria-label="陪伴数据"
          className={`mt-4 grid grid-cols-3 gap-2 py-3 ${HAIRLINE} border-b border-[rgba(59,46,36,.09)]`}
        >
          {[
            { key: 'home.statsDays', label: hc('home.statsDays'), value: joinDays !== null ? `${joinDays} 天` : null },
            { key: 'home.statsServices', label: hc('home.statsServices'), value: completed.length > 0 ? `${completed.length} 次` : null },
            {
              key: 'home.statsSpend',
              label: hc('home.statsSpend'),
              value: completed.length > 0 ? fenToYuan(completed.reduce((s, a) => s + a.priceFen, 0)) : null,
            },
          ]
            .filter((i) => i.value !== null)
            .map((i) => (
              <p key={i.key} className="text-center">
                <span className="u1-num block text-body-sm font-semibold leading-5">{i.value}</span>
                <span className="block text-caption-xs leading-4 text-ink-secondary"><CK k={i.key}>{i.label}</CK></span>
              </p>
            ))}
        </section>
      ) : null,

    /* 9. 我的毛孩子圆形头像行（pet.list 真实数据） */
    'home.pets': () => (
      <section data-testid="home-pets-row" className="mt-5" aria-label="我的毛孩子">
        <div className="flex items-baseline justify-between">
          <h2 className="text-title"><CK k="home.petsTitle">{hc('home.petsTitle')}</CK></h2>
          <Link to="/philia/pets" data-testid="home-pets-manage" className="text-caption-xs text-ink-secondary">
            管理 ›
          </Link>
        </div>
        {petsQ.isPending ? (
          <div className="mt-3 flex gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-14 rounded-full" />
            ))}
          </div>
        ) : petsQ.isError ? (
          <div className="mt-3">
            <ErrorState message={hc('home.petsLoadFail')} onRetry={() => void petsQ.refetch()} />
          </div>
        ) : (petsQ.data ?? []).length === 0 ? (
          <Link
            to="/philia/pets"
            data-testid="home-pets-empty"
            className="mt-3 flex items-center justify-between rounded-control bg-sunken px-4 py-3 text-body-sm text-ink-secondary"
          >
            <CK k="home.petsEmpty">{hc('home.petsEmpty')}</CK>
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
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-oak-light ring-1 ring-line-ring" aria-hidden="true">
                    <span className="u1-serif text-title font-semibold text-ink">{(pet.name ?? '毛孩子').slice(0, 1)}</span>
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
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="home" storeId={homeStoreId}>
      <div className="pb-32">
        {layout.map((b) => (
          <section
            data-block-key={b.blockKey}
            key={b.blockKey}
            className={PX_BLOCKS.has(b.blockKey) ? 'px-[22px]' : undefined}
          >
            {b.visible ? (renderers[b.blockKey]?.() ?? null) : null}
          </section>
        ))}
      </div>
    </CanvasLayoutLoader>
  )
}
