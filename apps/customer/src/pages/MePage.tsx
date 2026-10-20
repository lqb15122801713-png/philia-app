import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CanvasLayoutLoader, CK, ME_PAGE_BLOCK_RANK, ME_PAGE_DEFAULT_ORDER, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { fenToYuan } from '@/components/booking/format'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
import { MemberBarcode } from '../components/member/MemberCodeVisual'
import { useMemberCardToken } from '../components/member/useMemberCardToken'

const I = {
  order: <svg viewBox="0 0 24 24"><path d="M6 4h12v16l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 20z" /><path d="M9 8h6M9 12h6" /></svg>,
  booking: <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>,
  pet: <svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="2" /><circle cx="16" cy="8" r="2" /><path d="M12 11c-3 0-5 2.4-5 4.6 0 1.6 1.2 2.4 2.6 1.9 1-.4 3.8-.4 4.8 0 1.4.5 2.6-.3 2.6-1.9 0-2.2-2-4.6-5-4.6z" /></svg>,
  address: <svg viewBox="0 0 24 24"><path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>,
}

const LIST_BLOCK_KEYS = new Set(['me.orderrow', 'me.entries', 'me.grid'])

function QuickLink({ to, icon, children, testId }: { to: string; icon: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <Link to={to} className="q" data-testid={testId}>
      <span className="ic" aria-hidden="true">{icon}</span>
      <span className="t" data-u3-secondary>{children}</span>
    </Link>
  )
}

function ListLink({ to, title, sub, testId, lead = false }: { to: string; title: ReactNode; sub?: ReactNode; testId?: string; lead?: boolean }) {
  return (
    <Link to={to} className={lead ? 'me2-listrow me2-listrow--lead' : 'me2-listrow'} data-testid={testId}>
      <span className="tx">
        <span className="tt">{title}</span>
        {sub ? <span className="sub" data-u3-secondary>{sub}</span> : null}
      </span>
      <span className="chev" aria-hidden="true">›</span>
    </Link>
  )
}

export default function MePage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()

  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: !!user,
    staleTime: 300_000,
  })
  const meStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null
  const storeName = nearbyQ.data?.stores?.find((store) => store.id === meStoreId)?.name ?? nearbyQ.data?.stores?.[0]?.name ?? null

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
  const couponsQ = useQuery({
    queryKey: ['mall', 'myCoupons'],
    queryFn: () => trpc.mall.myCoupons.query(),
    enabled: !!user,
    staleTime: 60_000,
  })

  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((block) => block.pageKey === 'me')
      .sort((a, b) => (ME_PAGE_BLOCK_RANK.get(a.blockKey) ?? a.sortOrder) - (ME_PAGE_BLOCK_RANK.get(b.blockKey) ?? b.sortOrder))
    return items.length > 0 ? items : ME_PAGE_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('me', meStoreId, registryBlocks)

  const nickname = meRawQ.data?.user?.nickname ?? '铲屎官'
  const avatarUrl = meRawQ.data?.user?.avatarUrl ?? null
  const membership = myQ.data?.membership ?? null
  const plan = myQ.data?.plan ?? null
  const tierLabel = plan ? plan.label.replace(/^会员档·/, '').replace(/：.*$/, '') : mc('me.tagGuest')
  const identitySub = [tierLabel, storeName].filter(Boolean).join(' · ')
  const rebateBalance = myQ.data?.rebate?.balanceFen ?? 0
  const petCount = petsQ.data?.length ?? null
  const couponCount = couponsQ.data?.items.filter((coupon) => coupon.status === 'claimed').length ?? null
  const cardToken = useMemberCardToken(!!user && !!membership)

  const renderers: Record<string, () => ReactNode> = {
    'me.apphead': () => (
      <div className="m2-apphead me2-apphead">
        <h1 className="tt"><CK k="me.appTitle">{mc('me.appTitle')}</CK></h1>
      </div>
    ),

    'me.hero': () => (
      <section className="me2-hero" data-testid="me-hero" aria-label="会员身份">
        <div className="r1">
          {avatarUrl ? (
            <img className="av" src={avatarUrl} alt={`${nickname}的头像`} />
          ) : (
            <span className="av av--empty" aria-hidden="true">{nickname.slice(0, 1)}</span>
          )}
          <div className="who">
            <div className="nm">{nickname}</div>
            <div className="tier" data-u3-secondary>{identitySub}</div>
          </div>
          <Link to={membership ? '/me/card' : '/member/open'} className="codepill" data-testid="me-code-pill">
            <CK k="me.memberCodePill">{mc('me.memberCodePill')}</CK>
          </Link>
        </div>

        <Link to={membership ? '/me/card' : '/member/open'} className="me2-qrrow" data-testid="me-qrrow" aria-label={mc('me.barcodeHint')}>
          <span className="bars">
            {membership && cardToken.token ? (
              <MemberBarcode token={cardToken.token} className="barcode" testId="me-barcode" />
            ) : (
              <span className="pending" data-u3-secondary>
                {membership ? (cardToken.isError ? mc('me.cardCodeUnavailable') : mc('me.cardCodePending')) : mc('me.nonMemberCodeHint')}
              </span>
            )}
          </span>
          <span className="hint" data-u3-secondary><CK k="me.barcodeHint">{mc('me.barcodeHint')}</CK></span>
        </Link>

        <div className="nums">
          <div data-testid="me-rebate-cell">
            <div className="k" data-u3-secondary><CK k="me.rebateLabel">{mc('me.rebateLabel')}</CK></div>
            <div className="v">{myQ.isPending || myQ.isError ? '—' : fenToYuan(rebateBalance)}</div>
            <Link to="/member/rebate" className="more" data-u3-secondary><CK k="me.rebateDetail">{mc('me.rebateDetail')}</CK></Link>
          </div>
          <div data-testid="me-coupon-cell">
            <div className="k" data-u3-secondary><CK k="me.statCoupons">{mc('me.statCoupons')}</CK></div>
            <div className="v">{couponCount === null ? '—' : `x${couponCount}`}</div>
          </div>
          <div data-testid="me-pet-cell">
            <div className="k" data-u3-secondary><CK k="me.statPets">{mc('me.statPets')}</CK></div>
            <div className="v">{petCount === null ? '—' : petCount}</div>
          </div>
        </div>
      </section>
    ),

    'me.notify': () => (
      <nav className="me2-quick" data-testid="me-orderrow" aria-label="快捷入口">
        <QuickLink to="/appointments?tab=all" icon={I.order}><CK k="me.quickOrders">{mc('me.quickOrders')}</CK></QuickLink>
        <QuickLink to="/booking/grooming" icon={I.booking}><CK k="me.quickBooking">{mc('me.quickBooking')}</CK></QuickLink>
        <QuickLink to="/philia/pets" icon={I.pet}><CK k="me.quickPets">{mc('me.quickPets')}</CK></QuickLink>
        <QuickLink to="/settings/addresses" icon={I.address} testId="slot-address"><CK k="me.quickAddress">{mc('me.quickAddress')}</CK></QuickLink>
      </nav>
    ),

    'me.orderrow': () => (
      <ListLink
        to="/member/rebate"
        lead
        title={<CK k="me.listRebate">{mc('me.listRebate')}</CK>}
        sub={<CK k="me.listRebateSub">{mc('me.listRebateSub')}</CK>}
      />
    ),

    'me.entries': () => (
      <>
        <ListLink to="/me/coupons" title={<CK k="me.gridCoupons">{mc('me.gridCoupons')}</CK>} testId="slot-coupons" />
        <ListLink to="/me/coupons?tab=favs" title={<CK k="me.listFavorite">{mc('me.listFavorite')}</CK>} testId="me-favorites-entry" />
      </>
    ),

    'me.grid': () => (
      <>
        <ListLink to="/support/new" title={<CK k="me.listSupport">{mc('me.listSupport')}</CK>} testId="slot-concierge" />
        <ListLink to="/me/settings" title={<CK k="me.gridSettings">{mc('me.gridSettings')}</CK>} testId="me-settings" />
      </>
    ),
  }

  const visibleListBlocks = layout.filter((block) => block.visible && LIST_BLOCK_KEYS.has(block.blockKey))
  const firstVisibleListKey = visibleListBlocks[0]?.blockKey ?? null

  return (
    <CanvasLayoutLoader pageKey="me" storeId={meStoreId}>
      <div className="pb-28">
        {isCanvasPreview ? (
          <div className="px-4" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="me-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {layout.map((block) =>
          block.visible && block.blockKey === 'me.apphead' ? (
            <section data-block-key={block.blockKey} key={block.blockKey}>
              {renderers[block.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="px-4" style={{ marginTop: 14 }}>
          {layout.map((block) => {
            if (!block.visible || block.blockKey === 'me.apphead') return null
            if (LIST_BLOCK_KEYS.has(block.blockKey)) {
              if (block.blockKey !== firstVisibleListKey) return null
              return (
                <div className="me2-linklist" data-testid="me-grid8" key="me-list">
                  {visibleListBlocks.map((item) => (
                    <section data-block-key={item.blockKey} key={item.blockKey}>
                      {renderers[item.blockKey]?.() ?? null}
                    </section>
                  ))}
                </div>
              )
            }
            return (
              <section data-block-key={block.blockKey} key={block.blockKey}>
                {renderers[block.blockKey]?.() ?? null}
              </section>
            )
          })}
        </div>
      </div>
    </CanvasLayoutLoader>
  )
}
