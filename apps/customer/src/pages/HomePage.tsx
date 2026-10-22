import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  CircleDollarSign,
  Clock3,
  Home,
  Infinity as InfinityIcon,
  MapPin,
  QrCode,
  ShoppingBag,
  Store,
  Ticket,
} from 'lucide-react'
import { CK, getStepDef, resolveSlotUrl, slotContentOf, slotPreviewState, useMe, usePhiliaClient } from '@philia/shared'
import { fenToYuan, fmtHM } from '@/components/booking/format'
import type { AppointmentListItem } from '@/components/booking/types'
import { readLastBooking } from '@/lib/bookingPrefill'
import { hc } from '@/copy/home'
import { ntf } from '@/copy/notify'

interface ServiceRow {
  id: string
  type: string
  name: string
  durationMin: number | null
  priceFen: number
}

function entryNote(services: ServiceRow[], unit: string): string | null {
  if (services.length === 0) return null
  const prices = services.map((service) => service.priceFen)
  const durations = services.map((service) => service.durationMin).filter((value): value is number => value !== null && value > 0)
  const parts: string[] = []
  if (durations.length > 0) parts.push(`约 ${Math.min(...durations)} 分钟起`)
  parts.push(`${fenToYuan(Math.min(...prices))} 起${unit}`)
  return parts.join(' · ')
}

function HomeImage({ src, alt, className, testId }: { src: string | null; alt: string; className: string; testId?: string }) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  if (!src || brokenSrc === src) {
    return <div className={`${className} hv2-image-fallback`} data-testid={testId} role="img" aria-label={`${alt}，待换`}>待换</div>
  }
  return <img src={src} alt={alt} className={className} data-testid={testId} loading="lazy" onError={() => setBrokenSrc(src)} />
}

function ServiceProgress({ appointment, steps }: { appointment: AppointmentListItem; steps: Array<{ stepKey: string; stepOrder: number; status: string }> }) {
  const activeStep = steps.find((step) => step.status === 'active') ?? null
  const doneCount = steps.filter((step) => step.status === 'done').length
  const stepsReady = steps.length > 0
  const currentStep = activeStep?.stepOrder ?? doneCount
  const totalSteps = steps.length || 6
  const stepName = activeStep ? getStepDef(activeStep.stepKey)?.name ?? null : null
  return (
    <section className="hv2-progress-wrap" data-block-key="home.live">
      <div className="hv2-progress-card" data-testid="home-service-progress" aria-label="服务进行中">
        <div className="hv2-progress-top">
          <span className="hv2-live-label"><i aria-hidden="true" /><CK k="home.serviceLiveTag">{hc('home.serviceLiveTag')}</CK></span>
          <span className="hv2-step-count">{stepsReady ? `步骤 ${currentStep} / ${totalSteps}` : hc('home.serviceSyncing')}</span>
        </div>
        <div className="hv2-progress-title-row">
          <h2>{appointment.petName ?? hc('home.petFallback')} · {appointment.serviceName ?? hc('home.serviceFallback')}</h2>
          <Link to={`/appointments/${appointment.id}`} className="hv2-pickup" data-testid="home-service-pickup">{hc('home.pickup')}</Link>
        </div>
        <p className="hv2-sub">
          {stepName ? hc('home.currentStep', { step: stepName }) : hc('home.serviceSyncing')}
          {' · '}
          <CK k="home.liveEta">{hc('home.liveEta', { time: fmtHM(new Date(appointment.scheduledEnd)) })}</CK>
        </p>
        {stepsReady ? (
          <div className="hv2-progress-dots" role="progressbar" aria-valuemin={0} aria-valuemax={totalSteps} aria-valuenow={currentStep} aria-label="服务步骤进度">
            {Array.from({ length: totalSteps }, (_, index) => {
              const step = steps[index]
              const state = step?.status ?? 'locked'
              return <i key={step?.stepKey ?? index} className={`hv2-progress-dot ${state}`} aria-hidden="true" />
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default function HomePage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const mineQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
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
  const couponsQ = useQuery({
    queryKey: ['mall', 'myCoupons', 'claimed'],
    queryFn: () => trpc.mall.myCoupons.query({ status: 'claimed' }),
    enabled: !!user,
    staleTime: 60_000,
  })
  /* PD-82 消息主入口（补缺批片 5 原设计回补）：头部铃铛→/notifications，
     未读角标=push.unreadCount 30s 轮询（与 /me 同 queryKey 缓存共享） */
  const unreadQ = useQuery({
    queryKey: ['push', 'unreadCount'],
    queryFn: () => trpc.push.unreadCount.query(),
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
  const unreadTotal = unreadQ.data?.total ?? 0
  const inServiceAppt: AppointmentListItem | null = useMemo(() => {
    const rows = mineQ.data?.groups.in_service ?? []
    /* PD-75（P-CLIENT-01）：预约未开始（提前核销未来单）不出「服务进行中」；
       已取消/翻转会随 30s 轮询出桶，双保险再核 status 原值 */
    const now = Date.now()
    return (
      rows.find(
        (appointment) =>
          appointment.type === 'grooming' &&
          appointment.status === 'in_service' &&
          new Date(appointment.scheduledStart).getTime() <= now,
      ) ?? null
    )
  }, [mineQ.data])
  const stepsQ = useQuery({
    queryKey: ['serviceStep', 'list', inServiceAppt?.id],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: inServiceAppt!.id }),
    enabled: !!user && inServiceAppt !== null,
    refetchInterval: inServiceAppt ? 15_000 : false,
  })
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
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
  const membership = myQ.data?.membership ?? null
  const plan = useMemo(() => {
    const plans = (plansQ.data?.plans ?? []) as Array<{ planKey: string; label: string; free: boolean; rebateBp: number }>
    return plans.find((item) => item.planKey === membership?.planKey) ?? null
  }, [plansQ.data, membership])
  const tierName = plan ? plan.label.replace(/^会员档·/, '').replace(/：.*$/, '') : hc('home.memberTierFallback')
  const rebateBalance = myQ.data?.rebate?.balanceFen ?? 0
  const couponCount = couponsQ.data?.items?.length ?? 0
  const storeName = storeQ.data?.store.name ?? nearbyQ.data?.stores?.[0]?.name ?? hc('home.storeFallback')
  const storePath = homeStoreId ? `/booking/grooming?storeId=${homeStoreId}` : '/booking/grooming'
  const bannerSlotRaw = slotContentOf('home.banner')
  const bannerAudience = bannerSlotRaw?.audience ?? 'all'
  const bannerIsGuest = !user || !membership
  const bannerAudienceHit = bannerAudience === 'all'
    ? true
    : bannerAudience === 'anon'
      ? bannerIsGuest
      : bannerAudience === 'free'
        ? !!user && plan?.free === true
        : bannerIsGuest || plan?.free === true
  const bannerSlot = bannerAudienceHit ? bannerSlotRaw : undefined
  const bannerImage = resolveSlotUrl(bannerSlot?.url ?? null)
  const magazineImages: Array<string | null> = [null, null, null]
  const groomingServices = services.filter((service) => service.type === 'grooming')
  const boardingServices = services.filter((service) => service.type === 'boarding')
  const extraService = groomingServices[1] ?? boardingServices[1] ?? null
  const featured = [
    { key: 'grooming', title: hc('home.featuredGrooming'), sub: hc('home.featuredGroomingSub'), path: '/booking/grooming', image: magazineImages[0] },
    { key: 'boarding', title: hc('home.featuredBoarding'), sub: hc('home.featuredBoardingSub'), path: '/booking/boarding', image: magazineImages[1] },
    ...(extraService ? [{ key: extraService.id, title: extraService.name, sub: entryNote([extraService], extraService.type === 'boarding' ? '/晚' : '') ?? hc('home.featuredServiceGeneric'), path: extraService.type === 'boarding' ? '/booking/boarding' : '/booking/grooming', image: magazineImages[2] }] : []),
  ]
  const steps = stepsQ.data ?? []

  return (
    <div className="hv2-home" data-testid="home-page">
      <section className="hv2-banner" data-testid="home-banner" data-block-key="home.banner" aria-label="品牌横幅">
        <HomeImage src={bannerImage} alt={bannerSlot?.alt ?? hc('home.bannerAlt')} className="hv2-banner-img" testId="home-banner-img" />
        <div className="hv2-banner-shade" aria-hidden="true" />
        <Link to={storePath} className="hv2-store-chip" data-testid="home-store-chip">
          <MapPin className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
          <span>{storeName}</span>
        </Link>
        {/* PD-82 消息主入口（补缺批片 5 原设计回补）：banner 右上铃铛（门店 chip 正下，
            不占预览角标位）→/notifications；unreadTotal>0 显数字点，>99 显 99+ */}
        <Link to="/notifications" className="hv2-notify-bell" data-testid="home-notify-entry" aria-label={ntf('ntf.title')}>
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden="true" />
          {unreadTotal > 0 ? (
            <span className="hv2-notify-badge" data-testid="home-notify-badge">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          ) : null}
        </Link>
        <div className="hv2-banner-content" data-testid="home-banner-copy">
          <p className="hv2-banner-eyebrow">PHILIA CARE</p>
          <h1 data-testid="home-banner-title">{bannerSlot?.title_main ?? hc('home.bannerSeason')}</h1>
          <p className="hv2-banner-sub" data-testid="home-banner-sub">{bannerSlot?.title_sub ?? hc('home.bannerSub', { store: storeName })}</p>
          <Link to="/booking/grooming" className={`hv2-banner-cta${inServiceAppt ? ' hv2-banner-cta-secondary' : ''}`} data-testid="home-banner-cta">
          {bannerSlot?.cta_text ?? hc('home.bannerCta')}<span aria-hidden="true">›</span>
          </Link>
        </div>
        {slotPreviewState().active ? <span className="hv2-preview-badge" data-testid="home-banner-preview-badge">{hc('home.slotPreviewBadge')}</span> : null}
      </section>

      {inServiceAppt ? <ServiceProgress appointment={inServiceAppt} steps={steps} /> : null}

      <section className="hv2-primary-actions" data-testid="home-primary-actions" aria-label="主要服务">
        <Link to="/booking/grooming" className="hv2-primary-card" data-testid="home-primary-grooming">
          <span className="hv2-primary-icon"><Clock3 strokeWidth={1.6} aria-hidden="true" /></span>
          <span className="hv2-primary-title"><CK k="home.primaryGrooming">{hc('home.primaryGrooming')}</CK></span>
          <span className="hv2-sub">{hc('home.primaryGroomingSub')}</span>
        </Link>
        <Link to="/booking/boarding" className="hv2-primary-card" data-testid="home-primary-boarding">
          <span className="hv2-primary-icon"><Home strokeWidth={1.6} aria-hidden="true" /></span>
          <span className="hv2-primary-title"><CK k="home.primaryBoarding">{hc('home.primaryBoarding')}</CK></span>
          <span className="hv2-sub">{hc('home.primaryBoardingSub')}</span>
        </Link>
        <Link to="/mall" className="hv2-primary-card" data-testid="home-primary-mall">
          <span className="hv2-primary-icon"><ShoppingBag strokeWidth={1.6} aria-hidden="true" /></span>
          <span className="hv2-primary-title"><CK k="home.primaryMall">{hc('home.primaryMall')}</CK></span>
          <span className="hv2-sub">{hc('home.primaryMallSub')}</span>
        </Link>
      </section>

      <nav className="hv2-secondary-actions" data-testid="home-secondary-actions" aria-label="会员与门店快捷入口">
        <Link to="/member/rebate" className="hv2-secondary-link" data-testid="home-secondary-rebate">
          <CircleDollarSign strokeWidth={1.6} aria-hidden="true" /><span>{hc('home.rebateLabel')}</span>
        </Link>
        <Link to="/me/coupons" className="hv2-secondary-link" data-testid="home-secondary-coupons">
          <span className="hv2-new-badge">New</span><Ticket strokeWidth={1.6} aria-hidden="true" /><span>{hc('home.coupons')}</span>
        </Link>
        <Link to="/mall?channel=groupbuy" className="hv2-secondary-link" data-testid="home-secondary-groupbuy">
          <InfinityIcon strokeWidth={1.6} aria-hidden="true" /><span>{hc('home.groupbuy')}</span>
        </Link>
        <Link to={storePath} className="hv2-secondary-link" data-testid="home-secondary-store">
          <Store strokeWidth={1.6} aria-hidden="true" /><span>{hc('home.store')}</span>
        </Link>
      </nav>

      <section className="hv2-member-strip" data-testid="home-member-strip" aria-label="会员摘要">
        <Link to="/member/rebate" className="hv2-member-summary" data-testid="home-member-summary" aria-label="查看会员与回馈金">
          <span>{tierName}</span><i aria-hidden="true" /><span>{hc('home.rebateLabel')} {fenToYuan(rebateBalance)}</span><i aria-hidden="true" /><span>{hc('home.coupons')} ×{couponCount}</span>
        </Link>
        <Link to="/me/card" className="hv2-member-code" data-testid="home-member-code" aria-label="打开会员码">
          <QrCode className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />{hc('home.memberCodeAction')}
        </Link>
      </section>

      <section className="hv2-section" data-testid="home-featured" aria-labelledby="home-featured-title">
        <h2 id="home-featured-title"><CK k="home.featuredTitle">{hc('home.featuredTitle')}</CK></h2>
        <div className="hv2-featured-scroll">
          {featured.map((item, index) => (
            <Link to={item.path} className="hv2-featured-card" data-testid="home-featured-card" key={item.key}>
              <div className="hv2-featured-media">
                <HomeImage src={item.image} alt={item.title} className="hv2-featured-img" />
                <span className="hv2-image-label">PHILIA CARE</span>
                <span className="hv2-featured-cta">{hc('home.bannerCta')}</span>
              </div>
              <div className="hv2-featured-body">
                <h3>{item.title}</h3>
                <p className="hv2-sub">{item.sub}</p>
                <span className="hv2-book-link">{hc('home.goBooking')}<span aria-hidden="true">→</span></span>
              </div>
              <span className="sr-only">精选 {index + 1}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="hv2-section" data-testid="home-activities" aria-label="限时活动">
        <div className="hv2-activity-shell">
          <Link to="/member/rebate" className="hv2-activity-lead" data-testid="home-activity-lead">
            <span className="hv2-activity-mark" aria-hidden="true" />
            <span className="hv2-activity-lead-title">{hc('home.activityLead')}</span>
            <span className="hv2-activity-tag">{hc('home.activityLimited')}</span>
            <span className="hv2-activity-more">{hc('home.activityView')}<span aria-hidden="true">→</span></span>
          </Link>
          <div className="hv2-activity-grid">
            <Link to="/me/coupons" className="hv2-activity-card" data-testid="home-activity-card">
              <h3>{hc('home.activityStore')}</h3><p className="hv2-sub">{hc('home.activityStoreSub')}</p><span>{hc('home.activityClaim')}<span aria-hidden="true">→</span></span>
            </Link>
            <Link to="/member/lottery" className="hv2-activity-card" data-testid="home-activity-card">
              <h3>{hc('home.activityDraw')}</h3><p className="hv2-sub">{hc('home.activityDrawSub')}</p>
            </Link>
            <Link to="/me/coupons" className="hv2-activity-card" data-testid="home-activity-card">
              <h3>{hc('home.activityCoupons')}</h3><p className="hv2-sub">{hc('home.activityCouponsSub')}</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="hv2-section" data-testid="home-stories" aria-labelledby="home-stories-title">
        <h2 id="home-stories-title"><CK k="home.storiesTitle">{hc('home.storiesTitle')}</CK></h2>
        <div className="hv2-story-list">
          <Link to="/member" className="hv2-story-card" data-testid="home-story-card">
            <HomeImage src={magazineImages[0]} alt={hc('home.storyMember')} className="hv2-story-img" />
            <span className="hv2-story-shade" aria-hidden="true" />
            <span className="hv2-story-copy"><small>PHILIA CARE</small><strong>{hc('home.storyMember')}</strong><span>{hc('home.storyMemberSub')}</span></span>
          </Link>
          <Link to="/philia/moments" className="hv2-story-card" data-testid="home-story-card">
            <HomeImage src={magazineImages[1]} alt={hc('home.storyCare')} className="hv2-story-img" />
            <span className="hv2-story-shade" aria-hidden="true" />
            <span className="hv2-story-copy"><small>PHILIA CARE</small><strong>{hc('home.storyCare')}</strong><span>{hc('home.storyCareSub')}</span></span>
          </Link>
        </div>
      </section>
    </div>
  )
}
