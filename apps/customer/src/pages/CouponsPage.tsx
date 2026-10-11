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
 *
 * 画布化（产品-1010 画布全屏批 片 3 · 会员域扫尾）：五块入册（cpn.tabs/cpn.center/
 * cpn.mine/cpn.stackRule/fav.list），块序/显隐=useCanvasLayout('coupons')（published→
 * 注册表默认序尾补，空=CPN_DEFAULT_ORDER 兜底）；cpn.tabs=双签条钉在页头容器（照
 * MePage 页头裸段惯例），券三块仅 coupons tab 渲染、fav.list 仅 favs tab 渲染（原
 * tab 分流零改动）；文案键挂 CK(data-copy-key) 点选反查锚（EmptyState/ErrorState 的
 * string props 与 toast 挂不上锚，如实入册注记）；?canvasPreview=1 探针=水印注记行
 * （mc.canvasExampleNote）；店锚=?canvasStore= 预览店锚 > 记忆门店 > 就近首店（MePage
 * 同口径）。PushBar/AppHead 页头不入块册置块流外；块内查询/领取/移除链路零改动
 * （三段拆件后 queryKey 同源缓存共享，toastEl 为 fixed 件随块挂载），data-testid 原值全保留。
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, Ticket } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, useMe, usePhiliaClient, useToast, friendlyError } from '@philia/shared'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { AppHead, PushBar, SecH } from '../components/member/v2'
import { fmtDateTime } from '../components/account/common'
import ProductImage from '../components/mall/ProductImage'
import { fenToYuan } from '../components/mall/format'
import { cpc, type CouponsCopyKey } from '../copy/coupons'
import { fvc } from '../copy/favorites'
import { mc } from '../components/member/copy'
import { readLastBooking } from '@/lib/bookingPrefill'

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']
type CouponTemplate = Awaited<ReturnType<Trpc['mall']['couponTemplates']['query']>>['items'][number]
type MyCoupon = Awaited<ReturnType<Trpc['mall']['myCoupons']['query']>>['items'][number]
type FavItem = Awaited<ReturnType<Trpc['mall']['favList']['query']>>['items'][number]

/* 三态徽配色（照 MallOrdersPage opill 口径：待使用=柠檬底 / 已核销=墨沉底 / 已过期=浅灰） */
const STATUS_PILL: Record<string, { k: CouponsCopyKey; label: string; pill: string }> = {
  claimed: { k: 'cpn.statusClaimed', label: cpc('cpn.statusClaimed'), pill: 'bg-brand-primary text-ink' },
  used: { k: 'cpn.statusUsed', label: cpc('cpn.statusUsed'), pill: 'bg-[rgba(59,46,36,.06)] text-ink-secondary' },
  expired: { k: 'cpn.statusExpired', label: cpc('cpn.statusExpired'), pill: 'bg-sunken text-ink-placeholder' },
  voided: { k: 'cpn.statusVoided', label: cpc('cpn.statusVoided'), pill: 'bg-sunken text-ink-placeholder' },
}

/** 门槛文案+键位（满 {amt} 可用 / 无门槛；数值读 server 透出插值） */
function thresholdOf(thresholdFen: number): { k: CouponsCopyKey; text: string } {
  return thresholdFen > 0
    ? { k: 'cpn.threshold', text: cpc('cpn.threshold', { amt: fenToYuan(thresholdFen) }) }
    : { k: 'cpn.thresholdNone', text: cpc('cpn.thresholdNone') }
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const CPN_DEFAULT_ORDER = ['cpn.tabs', 'cpn.center', 'cpn.mine', 'cpn.stackRule', 'fav.list'] as const

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
  const th = thresholdOf(t.thresholdFen)
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
          <CK k={th.k}>{th.text}</CK>
          {' · '}
          <CK k="cpn.validDays">{cpc('cpn.validDays', { days: t.validDays })}</CK>
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onClaim(t.id)}
        data-testid={`coupon-claim-${t.id}`}
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-caption font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92 disabled:bg-sunken disabled:text-ink-placeholder"
      >
        {soldOut ? (
          <CK k="cpn.soldOutCta">{cpc('cpn.soldOutCta')}</CK>
        ) : claimed ? (
          <CK k="cpn.claimedCta">{cpc('cpn.claimedCta')}</CK>
        ) : (
          <CK k="cpn.claimCta">{cpc('cpn.claimCta')}</CK>
        )}
      </button>
    </div>
  )
}

/* ---------------- 我的券 ---------------- */

function MyCouponRow({ c }: { c: MyCoupon }) {
  const meta = STATUS_PILL[c.status] ?? STATUS_PILL.expired
  const th = thresholdOf(c.coupon.thresholdFen)
  return (
    <div className="u1-card px-4 py-3.5" data-testid={`my-coupon-${c.id}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink">
          {c.coupon.title} <span className="u1-num font-bold">{fenToYuan(c.coupon.amountFen)}</span>
        </p>
        <span className={`rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
          <CK k={meta.k}>{meta.label}</CK>
        </span>
      </div>
      <p className="m2-mono mt-1 text-[9px] text-ink-secondary">
        <CK k={th.k}>{th.text}</CK>
        {c.claimedAt ? (
          <>
            {' · '}
            <CK k="cpn.claimedAt">{cpc('cpn.claimedAt', { time: fmtDateTime(c.claimedAt) })}</CK>
          </>
        ) : null}
        {c.status === 'used' && c.usedAt ? (
          <>
            {' · '}
            <CK k="cpn.usedAt">{cpc('cpn.usedAt', { time: fmtDateTime(c.usedAt) })}</CK>
          </>
        ) : null}
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

/* ---------------- 领用中心区块（在售券模板 + 领取钮，每模板限领 1 张幂等） ---------------- */

function CouponCenterSec() {
  const { trpc } = usePhiliaClient()
  const queryClient = useQueryClient()
  const { toastEl, showToast } = useToast({ durationMs: 2600 })

  const templatesQ = useQuery({
    queryKey: ['mall', 'couponTemplates'],
    queryFn: () => trpc.mall.couponTemplates.query(),
  })
  /* 已领集合（模板行「已领取」徽态；领取本身幂等由 server 唯一锚兜底）——
     与我的券区块同 queryKey 缓存共享，零增发请求 */
  const mineQ = useQuery({
    queryKey: ['mall', 'myCoupons'],
    queryFn: () => trpc.mall.myCoupons.query(),
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
  const claimedIds = new Set(mine.map((c) => c.couponId))

  return (
    <div style={{ marginTop: 14 }}>
      {toastEl}
      <SecH title={<CK k="cpn.centerTitle">{cpc('cpn.centerTitle')}</CK>} />
      {templatesQ.isPending ? (
        <LoadingBlock lines={2} />
      ) : templatesQ.isError ? (
        <ErrorState message={cpc('cpn.loadFail')} onRetry={() => void templatesQ.refetch()} />
      ) : templates.length === 0 ? (
        <p className="m2-note px-1" data-testid="coupon-center-empty"><CK k="cpn.centerEmpty">{cpc('cpn.centerEmpty')}</CK></p>
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
    </div>
  )
}

/* ---------------- 我的券区块（三态徽）+ 核销口径注记 ---------------- */

function CouponMineSec() {
  const { trpc } = usePhiliaClient()
  const mineQ = useQuery({
    queryKey: ['mall', 'myCoupons'],
    queryFn: () => trpc.mall.myCoupons.query(),
  })
  const mine = mineQ.data?.items ?? []

  return (
    <>
      <div style={{ marginTop: 18 }}>
        <SecH title={<CK k="cpn.mineTitle">{cpc('cpn.mineTitle')}</CK>} />
      </div>
      {mineQ.isPending ? (
        <LoadingBlock lines={2} />
      ) : mineQ.isError ? (
        <ErrorState message={cpc('cpn.loadFail')} onRetry={() => void mineQ.refetch()} />
      ) : mine.length === 0 ? (
        <p className="m2-note px-1" data-testid="coupon-mine-empty"><CK k="cpn.mineEmpty">{cpc('cpn.mineEmpty')}</CK></p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {mine.map((c) => (
            <MyCouponRow key={c.id} c={c} />
          ))}
        </div>
      )}
      {/* 核销口径注记（开口项 1 裁：登记抵扣、线下结算时出示） */}
      <p className="m2-note mt-2 px-1" data-testid="coupon-use-note"><CK k="cpn.useNote">{cpc('cpn.useNote')}</CK></p>
    </>
  )
}

/* ---------------- 叠加规则公示卡（值读 couponStackRule 端口，公示=只读展示） ---------------- */

function CouponStackSec() {
  const { trpc } = usePhiliaClient()
  const stackQ = useQuery({
    queryKey: ['mall', 'couponStackRule'],
    queryFn: () => trpc.mall.couponStackRule.query(),
    staleTime: 300_000,
  })
  return (
    <div className="u1-card mt-4 px-4 py-3.5" data-testid="coupon-stack-rule">
      <p className="text-caption font-bold text-ink"><CK k="cpn.stackTitle">{cpc('cpn.stackTitle')}</CK></p>
      <p className="mt-1 text-caption text-ink-secondary">
        {stackQ.data?.note ?? (stackQ.isPending ? '…' : '—')}
      </p>
    </div>
  )
}

export default function CouponsPage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  /* tab 入 URL（商城「心愿单」入口深链 ?tab=favs；replace 写入不污染历史栈） */
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'favs' ? 'favs' : 'coupons'
  const setTab = (key: 'coupons' | 'favs') => setSearchParams(key === 'coupons' ? {} : { tab: key }, { replace: true })

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
  const cpnStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'coupons')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : CPN_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('coupons', cpnStoreId, registryBlocks)

  /* ---- 五块渲染器（tab 分流/查询/领取链路零改动；文案键挂 CK 点选反查锚） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. cpn.tabs：双 tab 签条（心愿单并入本页取少路由；文字签+柠檬下划线照
          MallOrdersPage 工艺；钉页头容器不参与拖排换位） */
    'cpn.tabs': () => (
      <div className="flex gap-[18px] border-b border-[rgba(59,46,36,.06)]">
        {(
          [
            ['coupons', 'cpn.tabMine', cpc('cpn.tabMine')],
            ['favs', 'fav.title', fvc('fav.title')],
          ] as const
        ).map(([key, k, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            data-testid={`coupons-tab-${key}`}
            className={`-mb-px shrink-0 border-b-2 py-2.5 text-body-sm transition ${
              tab === key ? 'border-brand-primary font-bold text-ink' : 'border-transparent font-medium text-ink-placeholder'
            }`}
          >
            <CK k={k}>{label}</CK>
          </button>
        ))}
      </div>
    ),

    /* 2. cpn.center：领用中心（仅 coupons tab 渲染；toastEl 为 fixed 件随块挂载） */
    'cpn.center': () => (user && tab === 'coupons' ? <CouponCenterSec /> : null),

    /* 3. cpn.mine：我的券（三态徽）+ 核销口径注记（仅 coupons tab 渲染） */
    'cpn.mine': () => (user && tab === 'coupons' ? <CouponMineSec /> : null),

    /* 4. cpn.stackRule：叠加规则公示卡（仅 coupons tab 渲染；正文读端口不抽键） */
    'cpn.stackRule': () => (user && tab === 'coupons' ? <CouponStackSec /> : null),

    /* 5. fav.list：心愿单列（仅 favs tab 渲染；fav. 前缀键 EmptyState/ErrorState/toast
          为 string props 挂不上 CK 锚，如实入册） */
    'fav.list': () => (user && tab === 'favs' ? <FavList /> : null),
  }

  return (
    <CanvasLayoutLoader pageKey="coupons" storeId={cpnStoreId}>
      <div className="m2" data-testid="coupons-page" style={{ minHeight: '100vh' }}>
        <PushBar label={cpc('cpn.pushLabel')} fallback="/me" />
        <AppHead title={cpc('cpn.title')} />

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="coupons-canvas-preview-note">
              {mc('mc.canvasExampleNote')}
            </p>
          </div>
        ) : null}

        {/* 块流：cpn.tabs=页头签条裸段（照 MePage 页头惯例置顶不参与块序换位）；
            余块共享 m2-pad 容器——默认序下 DOM 结构零差异 */}
        <div className="m2-pad" style={{ marginTop: 10 }}>
          {layout.map((b) =>
            b.visible && b.blockKey === 'cpn.tabs' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>

        <div className="m2-pad" style={{ paddingBottom: 60 }}>
          {layout.map((b) =>
            b.visible && b.blockKey !== 'cpn.tabs' ? (
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
