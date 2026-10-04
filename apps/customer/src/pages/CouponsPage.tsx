/**
 * CouponsPage · /me/coupons 优惠券+心愿单（客户端体验大批 片 3 · 商城域券面；
 * 双表申报锚点=页题「优惠券」）
 *
 * 双 tab（心愿单并入本页取少路由，免单立 /me/favorites；tab 入 URL ?tab=favs
 * 供商城头部「心愿单」入口深链）：
 * - 优惠券 tab：领用中心（mall.couponTemplates 在售券模板+已领计数；领取
 *   couponClaim 幂等，重复领=返回现状）+ 我的券（mall.myCoupons 三态徽
 *   claimed/used/expired）+ 叠加规则公示卡（mall.couponStackRule 端口值，
 *   公示=只读展示）；
 * - 心愿单 tab：mall.favList（图/名/价 →商品详情；点小心心=favToggle 幂等移除）。
 *
 * 核销口径（开口项 1 裁）：登记抵扣、线下结算时出示——不接真抵扣结算，注记明面。
 * 空态/骨架=packages/shared 件；文案全走 copy/coupons.ts（cpc）+ copy/favorites.ts（fvc）。
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, Ticket } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMe, usePhiliaClient, useToast, friendlyError } from '@philia/shared'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { AppHead, PushBar, SecH } from '../components/member/v2'
import { fmtDateTime } from '../components/account/common'
import ProductImage from '../components/mall/ProductImage'
import { fenToYuan } from '../components/mall/format'
import { cpc } from '../copy/coupons'
import { fvc } from '../copy/favorites'

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']
type CouponTemplate = Awaited<ReturnType<Trpc['mall']['couponTemplates']['query']>>['items'][number]
type MyCoupon = Awaited<ReturnType<Trpc['mall']['myCoupons']['query']>>['items'][number]
type FavItem = Awaited<ReturnType<Trpc['mall']['favList']['query']>>['items'][number]

/* 三态徽配色（照 MallOrdersPage opill 口径：待使用=柠檬底 / 已核销=墨沉底 / 已过期=浅灰） */
const STATUS_PILL: Record<string, { label: string; pill: string }> = {
  claimed: { label: cpc('cpn.statusClaimed'), pill: 'bg-brand-primary text-ink' },
  used: { label: cpc('cpn.statusUsed'), pill: 'bg-[rgba(59,46,36,.06)] text-ink-secondary' },
  expired: { label: cpc('cpn.statusExpired'), pill: 'bg-sunken text-ink-placeholder' },
  voided: { label: cpc('cpn.statusVoided'), pill: 'bg-sunken text-ink-placeholder' },
}

function thresholdText(thresholdFen: number): string {
  return thresholdFen > 0 ? cpc('cpn.threshold', { amt: fenToYuan(thresholdFen) }) : cpc('cpn.thresholdNone')
}

/* ---------------- 领用中心 ---------------- */

function TemplateRow({
  t,
  claimed,
  onClaim,
  claiming,
}: {
  t: CouponTemplate
  /** 本人已领（myCoupons couponId 交集；领取幂等，徽态仅展示） */
  claimed: boolean
  onClaim: (id: string) => void
  claiming: boolean
}) {
  const soldOut = t.totalQuota !== null && t.claimedCount >= t.totalQuota
  const disabled = claiming || claimed || soldOut
  return (
    <div className="u1-card flex items-center gap-3 px-4 py-3.5" data-testid={`coupon-template-${t.id}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-brand-secondary" aria-hidden="true">
        <Ticket className="h-4 w-4" strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-semibold text-ink">
          {t.title} <span className="u1-num font-bold">{fenToYuan(t.amountFen)}</span>
        </p>
        <p className="m2-mono mt-0.5 text-[9px] text-ink-secondary">
          {thresholdText(t.thresholdFen)} · {cpc('cpn.validDays', { days: t.validDays })}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onClaim(t.id)}
        data-testid={`coupon-claim-${t.id}`}
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-caption font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92 disabled:bg-sunken disabled:text-ink-placeholder"
      >
        {soldOut ? cpc('cpn.soldOutCta') : claimed ? cpc('cpn.claimedCta') : cpc('cpn.claimCta')}
      </button>
    </div>
  )
}

/* ---------------- 我的券 ---------------- */

function MyCouponRow({ c }: { c: MyCoupon }) {
  const meta = STATUS_PILL[c.status] ?? STATUS_PILL.expired
  return (
    <div className="u1-card px-4 py-3.5" data-testid={`my-coupon-${c.id}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink">
          {c.coupon.title} <span className="u1-num font-bold">{fenToYuan(c.coupon.amountFen)}</span>
        </p>
        <span className={`rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>{meta.label}</span>
      </div>
      <p className="m2-mono mt-1 text-[9px] text-ink-secondary">
        {thresholdText(c.coupon.thresholdFen)}
        {c.claimedAt ? ` · ${cpc('cpn.claimedAt', { time: fmtDateTime(c.claimedAt) })}` : ''}
        {c.status === 'used' && c.usedAt ? ` · ${cpc('cpn.usedAt', { time: fmtDateTime(c.usedAt) })}` : ''}
      </p>
    </div>
  )
}

/* ---------------- 心愿单 ---------------- */

function FavList() {
  const { trpc } = usePhiliaClient()
  const queryClient = useQueryClient()
  const { toastEl, showToast } = useToast({ durationMs: 2600 })
  const favQ = useQuery({ queryKey: ['mall', 'favList'], queryFn: () => trpc.mall.favList.query() })
  const toggleM = useMutation({
    mutationFn: (productId: string) => trpc.mall.favToggle.mutate({ productId }),
    onSuccess: () => {
      showToast(fvc('fav.removeToast'), 'info')
      void queryClient.invalidateQueries({ queryKey: ['mall', 'favList'] })
    },
    onError: (err) => showToast(friendlyError(err, fvc('fav.toggleFail'), 80), 'error'),
  })
  const rows: FavItem[] = favQ.data?.items ?? []

  return (
    <div style={{ marginTop: 14 }}>
      {toastEl}
      {favQ.isPending ? (
        <LoadingBlock lines={3} />
      ) : favQ.isError ? (
        <ErrorState message={fvc('fav.loadFail')} onRetry={() => void favQ.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={fvc('fav.emptyTitle')}
          desc={fvc('fav.emptyBody')}
          action={
            <Link
              to="/mall"
              className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {fvc('fav.emptyCta')}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5" data-testid="fav-list">
          {rows.map((f) => (
            <div key={f.id} className="u1-card flex items-center gap-3 px-3 py-3">
              <Link to={`/mall/product/${f.productId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <ProductImage src={f.image} alt={f.name} className="h-[52px] w-[52px] shrink-0 rounded-control" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-body-sm font-semibold text-ink">{f.name}</p>
                  <p className="u1-num mt-0.5 text-caption font-bold text-ink">{fenToYuan(f.priceFen)}</p>
                </div>
              </Link>
              <button
                type="button"
                aria-label={fvc('fav.removeToast')}
                disabled={toggleM.isPending}
                onClick={() => toggleM.mutate(f.productId)}
                data-testid={`fav-remove-${f.productId}`}
                className="shrink-0 p-1.5 text-brand-primary transition-transform duration-120 ease-philia-spring active:scale-90"
              >
                <Heart className="h-5 w-5 fill-current" strokeWidth={1.6} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- 优惠券 tab ---------------- */

function CouponTab() {
  const { trpc } = usePhiliaClient()
  const queryClient = useQueryClient()
  const { toastEl, showToast } = useToast({ durationMs: 2600 })

  const templatesQ = useQuery({
    queryKey: ['mall', 'couponTemplates'],
    queryFn: () => trpc.mall.couponTemplates.query(),
  })
  const mineQ = useQuery({
    queryKey: ['mall', 'myCoupons'],
    queryFn: () => trpc.mall.myCoupons.query(),
  })
  const stackQ = useQuery({
    queryKey: ['mall', 'couponStackRule'],
    queryFn: () => trpc.mall.couponStackRule.query(),
    staleTime: 300_000,
  })
  const claimM = useMutation({
    mutationFn: (couponId: string) => trpc.mall.couponClaim.mutate({ couponId }),
    onSuccess: () => {
      showToast(cpc('cpn.claimToast'), 'info')
      void queryClient.invalidateQueries({ queryKey: ['mall', 'couponTemplates'] })
      void queryClient.invalidateQueries({ queryKey: ['mall', 'myCoupons'] })
    },
    onError: (err) => showToast(friendlyError(err, cpc('cpn.claimFail'), 80), 'error'),
  })

  const templates = templatesQ.data?.items ?? []
  const mine = mineQ.data?.items ?? []
  /* 已领集合（模板行「已领取」徽态；领取本身幂等由 server 唯一锚兜底） */
  const claimedIds = new Set(mine.map((c) => c.couponId))

  return (
    <div style={{ marginTop: 14 }}>
      {toastEl}
      {/* 领用中心（在售券模板 + 领取钮，每模板限领 1 张幂等） */}
      <SecH title={cpc('cpn.centerTitle')} />
      {templatesQ.isPending ? (
        <LoadingBlock lines={2} />
      ) : templatesQ.isError ? (
        <ErrorState message={cpc('cpn.loadFail')} onRetry={() => void templatesQ.refetch()} />
      ) : templates.length === 0 ? (
        <p className="m2-note px-1" data-testid="coupon-center-empty">{cpc('cpn.centerEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              t={t}
              claimed={claimedIds.has(t.id)}
              claiming={claimM.isPending}
              onClaim={(id) => claimM.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* 我的券（三态徽） */}
      <div style={{ marginTop: 18 }}>
        <SecH title={cpc('cpn.mineTitle')} />
      </div>
      {mineQ.isPending ? (
        <LoadingBlock lines={2} />
      ) : mineQ.isError ? (
        <ErrorState message={cpc('cpn.loadFail')} onRetry={() => void mineQ.refetch()} />
      ) : mine.length === 0 ? (
        <p className="m2-note px-1" data-testid="coupon-mine-empty">{cpc('cpn.mineEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {mine.map((c) => (
            <MyCouponRow key={c.id} c={c} />
          ))}
        </div>
      )}
      {/* 核销口径注记（开口项 1 裁：登记抵扣、线下结算时出示） */}
      <p className="m2-note mt-2 px-1" data-testid="coupon-use-note">{cpc('cpn.useNote')}</p>

      {/* 叠加规则公示卡（值读 couponStackRule 端口，公示=只读展示） */}
      <div className="u1-card mt-4 px-4 py-3.5" data-testid="coupon-stack-rule">
        <p className="text-caption font-bold text-ink">{cpc('cpn.stackTitle')}</p>
        <p className="mt-1 text-caption text-ink-secondary">
          {stackQ.data?.note ?? (stackQ.isPending ? '…' : '—')}
        </p>
      </div>
    </div>
  )
}

export default function CouponsPage() {
  const { user } = useMe()
  /* tab 入 URL（商城「心愿单」入口深链 ?tab=favs；replace 写入不污染历史栈） */
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'favs' ? 'favs' : 'coupons'
  const setTab = (key: 'coupons' | 'favs') => setSearchParams(key === 'coupons' ? {} : { tab: key }, { replace: true })

  return (
    <div className="m2" data-testid="coupons-page" style={{ minHeight: '100vh' }}>
      <PushBar label={cpc('cpn.pushLabel')} fallback="/me" />
      <AppHead title={cpc('cpn.title')} />

      {/* 双 tab（心愿单并入本页取少路由；文字签+柠檬下划线照 MallOrdersPage 工艺） */}
      <div className="m2-pad" style={{ marginTop: 10 }}>
        <div className="flex gap-[18px] border-b border-[rgba(59,46,36,.06)]">
          {(
            [
              ['coupons', cpc('cpn.tabMine')],
              ['favs', fvc('fav.title')],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              data-testid={`coupons-tab-${key}`}
              className={`-mb-px shrink-0 border-b-2 py-2.5 text-body-sm transition ${
                tab === key ? 'border-brand-primary font-bold text-ink' : 'border-transparent font-medium text-ink-placeholder'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="m2-pad" style={{ paddingBottom: 60 }}>
        {user ? (tab === 'coupons' ? <CouponTab /> : <FavList />) : null}
      </div>
    </div>
  )
}
