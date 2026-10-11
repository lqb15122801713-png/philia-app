/**
 * MePage · /me 「我的」页（A-4 定稿山姆骨架 · 换皮批片 2；产品-1010 片 2 画布化入册）
 *
 * 骨架冻结（34 号档 §4.9）：身份大卡置顶（深棕渐变 150deg 圆角 24，min-height 312）
 * + 订单五格（白卡五列）+ 功能网格一层（4 列×2，禁多层卡片堆叠）。
 *
 * 画布化（产品-1010 片 2 · 高频五屏入册）：六块入册（apphead/hero/notify/entries/orderrow/grid），
 * 块序/显隐=useCanvasLayout('me')（published→注册表默认序尾补）；文案键行内可改=画布端口；
 * 点选反查=data-block-key/CK；预览=CanvasLayoutLoader+?canvasPreview=1 水印注记（零真会话零写库）。
 *
 * 槽位置灰（PD-15 V1.1 三规：不上数不上假件 + 注记 + data-testid）：
 * - 今年已省：补缺批片 3 已点亮（mySavings 真值 + 构成明面弹层，testid me-saved-slot 保留）；
 * - 退款售后（orderrow）=置灰槽位；优惠券=片 3 点亮（→/me/coupons 券+心愿单双 tab，
 *   testid slot-coupons 原值保留）；
 * - 客户端体验大批 片 1 点亮：常用地址（→/settings/addresses，testid slot-address 原值保留），
 *   新增「编辑资料」（→/settings/profile，me-profile-entry）/「消费记录」（→/records，
 *   me-records-entry）双行入口卡；
 * - 补缺大批片 4 点亮：服务相册（→/philia/moments）/ 小棉花客服（→/support/new），
 *   testid 原值保留（slot-gallery / slot-concierge）；退款售后=片 1 挂接口，本片不动；
 * 落地件：档章/回馈金余额/续费倒计时（membership.my 真值）/会员码 qrrow/订单五态入口/
 * 宠物档案/寄养预约/设置（补缺大批片 2：设置钮改导航 /me/settings 独立设置页，
 * 退出登录收进设置页——LogoutConfirmDialog 移用 components/account，逻辑零改动）。
 *
 * 功能入口保全：商城订单=商城域 /mall/orders 入口在案（M-01）；旧 EntryList 六行
 * 已由 orderrow+grid8 全量承接（预约/会员中心/会员卡/宠物/相册槽位）。
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { fenToYuan } from '@/components/booking/format'
import { sl } from '@/copy/serviceloop'
import { mc } from '../components/member/copy'
import { SavingsSheet, yuanOf, type SavingsData } from '../components/member/v2'
import { ntf } from '@/copy/notify'
import { pfc } from '@/copy/profile'
import { rcc } from '@/copy/records'
import { adc } from '@/copy/addresses'
import { readLastBooking } from '@/lib/bookingPrefill'

const DAY_MS = 86_400_000

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const ME_DEFAULT_ORDER = ['me.apphead', 'me.hero', 'me.notify', 'me.entries', 'me.orderrow', 'me.grid'] as const

/* 定稿线图标（§五：24 网格 stroke 1.55 round；同屏同宽） */
const I = {
  calendar: <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>,
  clock: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></svg>,
  star: <svg viewBox="0 0 24 24"><path d="M12 4l2.2 4.6 5 .6-3.7 3.4 1 4.9-4.5-2.5-4.5 2.5 1-4.9L4.8 9.2l5-.6z" /></svg>,
  refund: <svg viewBox="0 0 24 24"><path d="M4 9V7a2 2 0 012-2h12a2 2 0 012 2v2M4 9h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 9v8" /></svg>,
  all: <svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h14" /></svg>,
  petDoc: <svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>,
  album: <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4 4 3 3-2 4 3" /></svg>,
  rebate: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></svg>,
  home: <svg viewBox="0 0 24 24"><path d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z" /></svg>,
  coupon: <svg viewBox="0 0 24 24"><path d="M5 5h14v6a2 2 0 000 4v4H5v-4a2 2 0 000-4z" /><path d="M12 8v8" strokeDasharray="2.5 2.5" /></svg>,
  pin: <svg viewBox="0 0 24 24"><path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>,
  cotton: <svg viewBox="0 0 24 24"><path d="M5 18a7 7 0 0114 0" /><circle cx="12" cy="7" r="3" /></svg>,
  gear: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 01-.2 1.6l2 1.5-2 3.4-2.3-1a7 7 0 01-2.8 1.7L13.4 21h-2.8l-.3-2.5a7 7 0 01-2.8-1.6l-2.3 1-2-3.4 2-1.5A7 7 0 015 12c0-.6.1-1.1.2-1.6l-2-1.5 2-3.4 2.3 1a7 7 0 012.8-1.7L10.6 3h2.8l.3 2.5a7 7 0 012.8 1.6l2.3-1 2 3.4-2 1.5c.1.5.2 1 .2 1.6z" /></svg>,
  bell: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 004 0" /></svg>,
}

export default function MePage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  /* 补缺批片 3：me-saved-slot 点亮——今年已省真值（mySavings）+ 构成明面弹层 */
  const [savedOpen, setSavedOpen] = useState(false)

  /* 产品-1010 片 2：画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（同 MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const meStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    enabled: !!user,
  })
  /* 补缺批片 3：今年已省双源聚合（customer 本人；非会员返回零值口径） */
  const savingsQ = useQuery({
    queryKey: ['membership', 'mySavings'],
    queryFn: () => trpc.membership.mySavings.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const savings = (savingsQ.data ?? null) as SavingsData | null
  /* 未读角标（补缺批片 5 站内信）：push.unreadCount，30s 轮询兜底（与首页同 queryKey 缓存共享） */
  const unreadQ = useQuery({
    queryKey: ['push', 'unreadCount'],
    queryFn: () => trpc.push.unreadCount.query(),
    enabled: !!user,
    refetchInterval: 30_000,
  })
  const unreadTotal = unreadQ.data?.total ?? 0

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'me')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : ME_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('me', meStoreId, registryBlocks)

  const nickname = meRawQ.data?.user?.nickname ?? '铲屎官'
  const avatarUrl = meRawQ.data?.user?.avatarUrl ?? null
  const membership = myQ.data?.membership ?? null
  const plan = myQ.data?.plan ?? null
  /* 补缺修复小批 P1-3：免费档永久有效（数据层 expiresAt=2099 同帧），倒计时格不上数字 */
  const isFreePlan = !!plan?.free
  const tierLabel = plan ? plan.label.replace(/^会员档·/, '').replace(/：.*$/, '') : '菲丽亚宠友'
  const rebateBalance = myQ.data?.rebate?.balanceFen ?? 0
  /* 续费倒计时（PD-15：落地件=纯展示，membership.expiresAt 真值；非会员不上数；免费档=永久有效豁免） */
  const renewDaysLeft = membership
    ? Math.max(0, Math.ceil((new Date(membership.expiresAt).getTime() - Date.now()) / DAY_MS))
    : null
  const petCount = (petsQ.data ?? []).length
  const firstPetName = (petsQ.data ?? [])[0]?.name ?? null

  /* 块渲染器（块内逻辑零改动——六块照改造前 JSX 逐字搬，文案走 copy 键） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. apphead：serif 27/900 大题 + mono 注记（§4.1） */
    'me.apphead': () => (
      <div className="m2-apphead">
        <span className="tt"><CK k="me.appTitle">{mc('me.appTitle')}</CK></span>
        <span className="no"><CK k="me.appNo">{mc('me.appNo')}</CK></span>
      </div>
    ),

    /* 2. 身份大卡 mehero（置顶约 40%；骨架冻结件） */
    'me.hero': () => (
      <section className="me2-hero" data-testid="me-hero" aria-label="会员身份">
        <div className="r1">
          {avatarUrl ? (
            <img className="av" src={avatarUrl} alt={nickname} />
          ) : (
            <span className="av" style={{ display: 'grid', placeItems: 'center', background: '#F4EDDC' }} aria-hidden="true">
              <span style={{ fontFamily: 'var(--v2serif)', fontSize: 20, fontWeight: 900, color: '#3B2E24' }}>
                {nickname.slice(0, 1)}
              </span>
            </span>
          )}
          <div>
            <div className="nm">{nickname}</div>
            <span className="tier">{tierLabel}</span>
          </div>
          {membership ? (
            /* 会员链路片 2 入口断链修通①：卡面入口按档分化——注册用户=「开通 ›」指开通页
               （注册即注册用户后全端购卡入口在此接通）；付费档=「续费 ›」指会员中心不变 */
            <Link to={isFreePlan ? '/member/open' : '/member'} className="renew" data-testid="me-renew-link">
              {isFreePlan ? mc('me.cardOpenCta') : mc('me.cardRenewCta')}
            </Link>
          ) : null}
        </div>
        <div className="nums">
          {/* 补缺批片 3：今年已省槽位点亮——「——」换 mySavings.totalFen 真值，注记换
              「构成明面」，点按=构成弹层；testid me-saved-slot 原值保留 */}
          <div
            className="dim"
            data-testid="me-saved-slot"
            role="button"
            style={{ cursor: 'pointer' }}
            onClick={() => setSavedOpen(true)}
          >
            <div className="v">{savings ? `¥${yuanOf(savings.totalFen)}` : '——'}</div>
            <div className="k">{mc('saved.slotTitle')} · {mc('saved.meSlotNote')}</div>
          </div>
          <div data-testid="me-rebate-cell">
            <div className="v">{fenToYuan(rebateBalance)}</div>
            <div className="k"><CK k="me.rebateLabel">{mc('me.rebateLabel')}</CK></div>
          </div>
          <div data-testid="me-renew-countdown">
            {membership && isFreePlan ? (
              <>
                {/* P1-3 免费档永久豁免 + 片 3 正名：「永久在册 / 账号在即在册 · 永不冻结」（端口键） */}
                <div className="v" style={{ fontSize: 15 }}>{mc('me.freeValidityValue')}</div>
                <div className="k">{mc('me.freeValidityNote')}</div>
              </>
            ) : renewDaysLeft !== null ? (
              <>
                <div className="v">{renewDaysLeft} <em>天</em></div>
                <div className="k"><CK k="me.renewCountdown">{mc('me.renewCountdown')}</CK></div>
              </>
            ) : (
              <>
                <div className="v">——</div>
                <div className="k"><CK k="me.openUnlock">{mc('me.openUnlock')}</CK></div>
              </>
            )}
          </div>
        </div>
        <Link to={membership ? '/me/card' : '/member/open'} className="me2-qrrow" data-testid="me-qrrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><path d="M14 14h2.5v2.5H14zM20 14v6M14 20h6" /></svg>
          <CK k="me.qrTitle">{mc('me.qrTitle')}</CK>
          <span className="c"><CK k="me.qrSub">{mc('me.qrSub')}</CK></span>
        </Link>
      </section>
    ),

    /* 3. 消息行（补缺批片 5 站内信：身份卡区下，带未读点→/notifications） */
    'me.notify': () => (
      <Link
        to="/notifications"
        data-testid="me-notify-entry"
        className="mt-3 flex items-center gap-3 rounded-card bg-card px-4 py-3.5 text-body-sm shadow-card transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunken text-brand-secondary" aria-hidden="true">
          {I.bell}
          {unreadTotal > 0 ? (
            <span data-testid="me-notify-dot" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand-primary" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 font-semibold text-ink">{ntf('ntf.title')}</span>
        <span className="shrink-0 text-ink-secondary" aria-hidden="true">›</span>
      </Link>
    ),

    /* 4. 编辑资料 / 消费记录双行入口卡（客户端体验大批 片 1） */
    'me.entries': () => (
      <div className="mt-3 overflow-hidden rounded-card bg-card shadow-card">
        <Link
          to="/settings/profile"
          data-testid="me-profile-entry"
          className="flex items-center gap-3 px-4 py-3.5 text-body-sm transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{pfc('profile.meEntry')}</span>
            <span className="mt-0.5 block text-caption-xs text-ink-secondary">{pfc('profile.meEntrySub')}</span>
          </span>
          <span className="shrink-0 text-ink-secondary" aria-hidden="true">›</span>
        </Link>
        <Link
          to="/records"
          data-testid="me-records-entry"
          className="flex items-center gap-3 border-t border-line-divider px-4 py-3.5 text-body-sm transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{rcc('rec.meEntry')}</span>
            <span className="mt-0.5 block text-caption-xs text-ink-secondary">{rcc('rec.meEntrySub')}</span>
          </span>
          <span className="shrink-0 text-ink-secondary" aria-hidden="true">›</span>
        </Link>
      </div>
    ),

    /* 5. 订单五格（五态入口；退款售后=槽位置灰 PD-15 V1.1 槽位 10） */
    'me.orderrow': () => (
      <nav className="me2-orderrow" data-testid="me-orderrow" aria-label="订单五态">
        <Link to="/appointments?tab=confirmed" className="o">{I.calendar}<CK k="me.orderConfirmed">{mc('me.orderConfirmed')}</CK></Link>
        <Link to="/appointments?tab=serving" className="o">{I.clock}<CK k="me.orderServing">{mc('me.orderServing')}</CK></Link>
        <Link to="/appointments?tab=history" className="o">{I.star}<CK k="me.orderHistory">{mc('me.orderHistory')}</CK></Link>
        <span className="o slot" data-testid="slot-refund" aria-disabled="true">
          {I.refund}<CK k="me.orderRefund">{mc('me.orderRefund')}</CK>
          <span className="sk"><CK k="me.slotSoon">{mc('me.slotSoon')}</CK></span>
        </span>
        <Link to="/appointments?tab=history" className="o">{I.all}<CK k="me.orderAll">{mc('me.orderAll')}</CK></Link>
      </nav>
    ),

    /* 6. 功能网格（4 列×2 一层；置灰四件=PD-15 V1.1 槽位 2/3/4/11） */
    'me.grid': () => (
      <nav className="me2-grid8" data-testid="me-grid8" aria-label="功能网格">
        <Link to="/philia/pets" className="g">{I.petDoc}<div className="t"><CK k="me.gridPets">{mc('me.gridPets')}</CK><small>{firstPetName ?? (petCount > 0 ? mc('me.gridPetsCount', { n: petCount }) : mc('me.gridPetsGo'))}</small></div></Link>
        {/* 补缺大批片 4：服务相册点亮（testid 原值保留，置灰样式+「即将点亮」注记摘除） */}
        <Link to="/philia/moments" className="g" data-testid="slot-gallery">{I.album}<div className="t">{sl('album.meEntryTitle')}<small>{sl('album.meEntrySub')}</small></div></Link>
        <Link to="/member/rebate" className="g">{I.rebate}<div className="t"><CK k="me.gridRebate">{mc('me.gridRebate')}</CK><small>{fenToYuan(rebateBalance)}</small></div></Link>
        <Link to="/booking/boarding" className="g">{I.home}<div className="t"><CK k="me.gridBoarding">{mc('me.gridBoarding')}</CK><small><CK k="me.gridBoardingSub">{mc('me.gridBoardingSub')}</CK></small></div></Link>
        {/* 客户端体验大批 片 3：优惠券点亮 → /me/coupons（券+心愿单双 tab；testid 原值保留） */}
        <Link to="/me/coupons" className="g" data-testid="slot-coupons">{I.coupon}<div className="t"><CK k="me.gridCoupons">{mc('me.gridCoupons')}</CK><small><CK k="me.gridCouponsSub">{mc('me.gridCouponsSub')}</CK></small></div></Link>
        {/* 客户端体验大批 片 1：常用地址点亮 → /settings/addresses（testid 原值保留） */}
        <Link to="/settings/addresses" className="g" data-testid="slot-address">{I.pin}<div className="t">{adc('addr.title')}<small>{adc('addr.title')}</small></div></Link>
        {/* 补缺大批片 4：小棉花客服点亮（testid 原值保留） */}
        <Link to="/support/new" className="g" data-testid="slot-concierge">{I.cotton}<div className="t">{sl('ticket.meEntryTitle')}<small>{sl('ticket.meEntrySub')}</small></div></Link>
        <Link to="/me/settings" className="g" data-testid="me-settings">
          {I.gear}<div className="t"><CK k="me.gridSettings">{mc('me.gridSettings')}</CK><small><CK k="me.gridSettingsSub">{mc('me.gridSettingsSub')}</CK></small></div>
        </Link>
      </nav>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="me" storeId={meStoreId}>
      <div className="pb-28">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="px-[22px]" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="me-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：apphead=页头裸段（原结构在 padding 容器外，页头按惯例置顶不参与拖序）；
            余块共享 px 容器（marginTop 14=改造前节奏）——默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'me.apphead' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="px-[22px]" style={{ marginTop: 14 }}>
          {layout.map((b) =>
            b.visible && b.blockKey !== 'me.apphead' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
        {/* 补缺批片 3：今年已省构成明面弹层（与 A-3 账区行同件 SavingsSheet） */}
        <SavingsSheet open={savedOpen} onClose={() => setSavedOpen(false)} savings={savings} />
      </div>
    </CanvasLayoutLoader>
  )
}
