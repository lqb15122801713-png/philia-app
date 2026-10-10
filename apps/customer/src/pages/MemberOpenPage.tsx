/**
 * MemberOpenPage · /member/open 会员办理页（J-01 未购转化屏 · 批次 R11b 视觉批 ·
 * 38 号施工令 + 36 号施工示意图 §三 + 34 号设计规范 v2.0；申报锚点=「开通会员」）
 *
 * 卡即选择器（§4.8）：deck 横滑 scroll-snap 居中 + 点卡选档，三格账/权益墙/CTA 档跟随
 * （data 驱动）；对比四档权益=底部弹层（§4.5 三件套）；吸底 CTA（§4.1 页内吸底非弹窗）。
 *
 * 功能逻辑（四铁律）：注册用户→openFree 一键开档（幂等）；付费档 CTA→/member/checkout 线上
 * 确认订单（补缺批片 6 线上收单骨架；到店办理降级为旁路链接，guide 到店指引步保留）；
 * 已是会员按档分化（会员链路片 2②）：注册用户档不分流——直达选档开通流程（默认选中推荐
 * 付费档），付费档=提示条+回会员中心 CTA。数值全读 member_plans 端口（冻结值 88/85/8），
 * 文案全走文案键（copy.ts）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePerkWallCells, usePhiliaClient } from '@philia/shared'
import { friendlyError, useToast } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
import {
  CardFace,
  DeckDots,
  Ledger,
  PerksWall,
  PushBar,
  RulesBlock,
  SecH,
  Sheet,
  TipCard,
  dailyOf,
  tierClaimOf,
  tierNameOf,
  useDeckSelect,
  zheOf,
  pctOf,
  type V2Plan,
} from '../components/member/v2'

type Step = 'select' | 'guide' | 'done'

/** 档色条（对比弹层用；与 cf-t0~t3 色谱同源 §1.3；注册用户=白卡色仅作卡面） */
const TIER_SWATCH: Record<string, string> = {
  plan_nuanyang: 'linear-gradient(135deg,#433225,#2A1F15)',
  plan_zhuguang: 'linear-gradient(135deg,#B39A6E,#8F7850)',
  plan_yinghuo: 'linear-gradient(135deg,#F6E7BE,#EBD494)',
  plan_weiguang: 'var(--v2card)',
}

export default function MemberOpenPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 3200 })
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('select')
  const [doneOpened, setDoneOpened] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })

  /* 产品-1010 片 1：权益墙双屏同帧——格序/图标读会员中心 published 布局（同一行=同帧单源；
     本页无画布注册，store 解析照 MemberCenterPage 同口径：画布预览店锚 > 记忆门店 > 就近首店） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const wallStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null
  const wallCells = usePerkWallCells(wallStoreId)

  const openFreeM = useMutation({
    mutationFn: () => trpc.membership.openFree.mutate(),
    onSuccess: (r) => {
      setDoneOpened(true)
      setStep('done')
      showToast(r.idempotent ? mc('j1.toastAlready') : mc('j1.toastOpenedFree'), 'info')
      void queryClient.invalidateQueries({ queryKey: ['membership'] })
    },
    onError: (err) => showToast(friendlyError(err, '开通失败，请稍后再试'), 'error'),
  })

  const plans = (plansQ.data?.plans ?? []) as V2Plan[]
  /* deck 初始选中=暖阳（定稿默认 sel；plans 按价升序 → 末位） */
  const deck = useDeckSelect(plans.length, Math.max(plans.length - 1, 0))
  /* plans 到位后居中到默认档一次（deck 初始不自动滚动，防 onScroll 把选中冲回首卡） */
  const deckInited = useRef(false)
  useEffect(() => {
    if (!deckInited.current && plans.length > 0) {
      deckInited.current = true
      deck.pick(plans.length - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans.length])
  const selected = plans[deck.active] ?? null
  /* 会员链路片 2 入口断链修通②：注册用户档不再分流「已是会员→去会员中心」——直达选档开通
     流程（deck 默认选中末位=推荐付费档）；付费档会员才提示「已是会员」并回会员中心 */
  const memberFree = !!(myQ.data?.plan as V2Plan | null)?.free
  const alreadyMember = !!myQ.data?.membership
  const paidMember = alreadyMember && !memberFree

  return (
    <div className="m2" data-testid="member-open-page" style={{ minHeight: '100vh' }}>
      {toastEl}
      {/* 急修补一件（任务卡 9-29 P0 弹球陷阱）：PushBar 去写死 /member——非会员按返回
          →/member→无档分流弹回 /member/open=被关在 J-01。返回=时间序回退（任何来处回得来）；
          直访兜底=/home（红线：兜底不许 /member，否则再造弹球） */}
      <PushBar label={mc('j1.pushLabel')} fallback="/home" />

      {plansQ.isPending || myQ.isPending ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <LoadingBlock lines={4} />
        </div>
      ) : plansQ.isError ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <ErrorState message={mc('common.plansLoadFail')} onRetry={() => void plansQ.refetch()} />
        </div>
      ) : step === 'select' && selected ? (
        <>
          {/* 已是会员提示条（不挡流程；PR-4 PD-05 件 1：免费档不显示有效期）。
              片 2②：注册用户=信息条照常（文案=新购口径引导句），CTA 不分流——直达选档开通；
              付费档=提示条+回会员中心 CTA（升级路径句保留指升级页） */}
          {alreadyMember && myQ.data?.membership ? (
            <div className="m2-pad" style={{ marginTop: 10 }}>
              <TipCard>
                {memberFree
                  ? mc('j1.alreadyMemberFree')
                  : mc('j1.alreadyMember', {
                      date: new Date(myQ.data.membership.expiresAt).toLocaleDateString('zh-CN'),
                    })}
              </TipCard>
              {/* 补缺批片 3：升级路径句（upgradeAvailable=true 才显，→/member/upgrade）；
                  片 2②：注册用户档本页即开通流程，不再给升级页跳转（直达） */}
              {paidMember && myQ.data.upgradeAvailable ? (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button type="button" className="m2-link" data-testid="open-upgrade-entry" onClick={() => navigate('/member/upgrade')}>
                    {mc('j1.upgradeEntry')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 引导行 + 卡池 deck（卡即选择器） */}
          <div className="m2-pad" style={{ marginTop: 14 }}>
            <p className="m2-note" style={{ margin: 0 }}>
              {mc('j1.guideNote')}
            </p>
          </div>
          <div className="m2-pad">
            <div className="m2-deck" ref={deck.deckRef} onScroll={deck.onScroll}>
              {plans.map((p, i) => (
                <CardFace
                  key={p.planKey}
                  planKey={p.planKey}
                  priceText={p.free ? mc('card.freePrice') : mc('card.priceYear', { price: (p.priceFen / 100).toFixed(0) })}
                  claimText={tierClaimOf(p.planKey)}
                  height={204}
                  padding="18px 20px"
                  nameSize={25}
                  selectable
                  selected={i === deck.active}
                  onClick={() => deck.pick(i)}
                  testId={`open-pick-${p.planKey}`}
                />
              ))}
            </div>
            <DeckDots count={plans.length} active={deck.active} />
          </div>

          <div className="m2-pad" style={{ paddingBottom: 130 }}>
            {/* 三格账（档跟随） */}
            <Ledger
              cells={[
                { v: selected.free ? '—' : `¥${dailyOf(selected.priceFen)}`, k: mc('j1.ledgerDaily') },
                { v: selected.free ? '¥0' : `¥${(selected.priceFen / 100).toFixed(0)}`, k: mc('j1.ledgerYearly') },
                /* 片 3 功能闸解除：注册用户档=建档不限（不读 includedPets 数） */
                { v: selected.free ? mc('j1.petsUnlimited') : mc('j1.petsIncluded', { n: selected.includedPets }), k: mc('j1.ledgerPets') },
              ]}
            />
            {/* 测算注（CJ-0923-16③：文案键占位默认软文案） */}
            <p className="m2-note" style={{ marginTop: 10 }}>
              {mc('j1.estimateNote')}
            </p>
            {/* 对比四档权益 → 底部弹层 */}
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button type="button" className="m2-link" onClick={() => setCompareOpen(true)}>
                {mc('j1.compareLink')}
              </button>
            </div>

            {/* 权益墙（档跟随切换；片 1：格序/图标=画布布局数据，双屏同帧单源） */}
            <SecH
              title={mc('a3.perksTitle', { tier: tierNameOf(selected.planKey) })}
              more={mc('j1.perksFollow')}
            />
            <PerksWall plan={selected} cells={wallCells} />

            {/* 规则明面（红线 5 全量八条） */}
            <RulesBlock
              plan={selected}
              settlementDay={plansQ.data.rebateSettlementDay}
              validityDays={plansQ.data.membershipValidityDays}
              allPcts={plans.filter((p) => p.rebateBp > 0).map((p) => pctOf(p.rebateBp)).join('/')}
            />
          </div>

          {/* 吸底 CTA（页内形态非弹窗）：付费档会员=回会员中心；注册用户/非会员=选档开通直达 */}
          <div className="m2-ctabar">
            <div className="m2-ctabar-in">
              {paidMember ? (
                /* PR-4 UX P2-3：已是会员态 CTA=回会员中心（不再显示「开通 · 每天 ¥x」与提示条打架） */
                <button
                  type="button"
                  className="m2-btn-primary m2-press"
                  data-testid="open-already-member-cta"
                  onClick={() => navigate('/member')}
                >
                  <span>{mc('j1.ctaAlreadyMember')}</span>
                  <span className="sub">{mc('j1.ctaSub')}</span>
                </button>
              ) : (
                <>
                  {/* 片 1 C 股裁①（openFree 退位）：注册用户选免费档=「当前档」注记不动作
                      （注册即在册=零办理动作；openFree 端点留作异常面兜底）；非会员罕见路径
                      （注销重申）保留一键开档；付费档 CTA=跳线上确认订单 */}
                  {selected.free && alreadyMember ? (
                    <div className="m2-note" data-testid="open-current-free-note" style={{ textAlign: 'center', padding: '13px 0' }}>
                      {mc('j1.ctaCurrentFree')}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="m2-btn-primary m2-press"
                      disabled={openFreeM.isPending}
                      data-testid={selected.free ? 'open-free-btn' : 'open-pick-cta'}
                      onClick={() => {
                        if (selected.free) openFreeM.mutate()
                        else navigate(`/member/checkout?plan=${selected.planKey}`)
                      }}
                    >
                      <span>
                        {selected.free
                          ? mc('j1.ctaOpenFree')
                          : mc('j1.ctaOpen', { tier: tierNameOf(selected.planKey), daily: dailyOf(selected.priceFen) })}
                      </span>
                      <span className="sub">{mc('j1.ctaSub')}</span>
                    </button>
                  )}
                  {/* 到店办理旁路链接（guide 到店指引步保留给本入口；线上收单为主路径） */}
                  {!selected.free ? (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <button
                        type="button"
                        className="m2-link"
                        data-testid="open-store-bypass"
                        onClick={() => setStep('guide')}
                      >
                        {mc('j1.storeBypass')}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </>
      ) : step === 'guide' && selected ? (
        <StorePayGuide plan={selected} validityDays={plansQ.data.membershipValidityDays} onBack={() => setStep('select')} onNext={() => setStep('done')} />
      ) : (
        <DonePanel opened={doneOpened} picked={selected} validityDays={plansQ.data?.membershipValidityDays ?? 365} onBack={() => navigate('/member')} />
      )}

      {/* 对比四档权益弹层（§4.5 三件套） */}
      <Sheet open={compareOpen} onClose={() => setCompareOpen(false)} title={mc('j1.compareTitle')} note={mc('j1.compareNote')}>
        <div>
          {[...plans].reverse().map((p) => {
            const zhe = zheOf(p.serviceDiscountBp)
            return (
              <div className="m2-tierrow" key={p.planKey}>
                <span
                  className="sw"
                  style={{
                    background: TIER_SWATCH[p.planKey] ?? '#FBF6EA',
                    border: p.planKey === 'plan_weiguang' ? '1px solid rgba(59,46,36,.14)' : p.planKey === 'plan_nuanyang' ? '1px solid rgba(217,192,138,.4)' : undefined,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div className="anm">
                    {tierNameOf(p.planKey)} {p.free ? `· ${mc('card.freePrice')}` : `¥${(p.priceFen / 100).toFixed(0)}/年`}
                  </div>
                  <div className="ad">
                    {p.free
                      ? tierClaimOf(p.planKey)
                      : mc('j1.tierRowPaid', {
                          pct: pctOf(p.rebateBp),
                          zhe: zhe ?? '—',
                          pets: mc('j1.petsIncluded', { n: p.includedPets }),
                        })}
                  </div>
                </div>
                {/* 会员链路片 2③：四档对比 CTA 同口径接通——付费档→确认订单（注册用户/非会员同路径），
                    免费档=一键开通（注册用户已是=「当前档」注记）；付费档会员不画（走升级页） */}
                {!paidMember ? (
                  p.free ? (
                    alreadyMember ? (
                      <span className="m2-note" data-testid={`compare-current-${p.planKey}`} style={{ flex: 'none', fontSize: 11 }}>
                        {mc('j1.compareRowCurrent')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="m2-link"
                        data-testid={`compare-cta-${p.planKey}`}
                        style={{ flex: 'none' }}
                        disabled={openFreeM.isPending}
                        onClick={() => {
                          setCompareOpen(false)
                          openFreeM.mutate()
                        }}
                      >
                        {mc('j1.compareRowFreeCta')}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="m2-link"
                      data-testid={`compare-cta-${p.planKey}`}
                      style={{ flex: 'none' }}
                      onClick={() => {
                        setCompareOpen(false)
                        navigate(`/member/checkout?plan=${p.planKey}`)
                      }}
                    >
                      {mc('j1.compareRowCta')}
                    </button>
                  )
                ) : null}
              </div>
            )
          })}
          <p className="m2-mono" style={{ fontSize: '8.5px', color: 'var(--v2muted)', marginTop: 12, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {mc('j1.compareFooter')}
          </p>
        </div>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 付费档到店付指引（骨架版第 2 步件化）                                     */
/* ------------------------------------------------------------------ */

function StorePayGuide({
  plan,
  validityDays,
  onBack,
  onNext,
}: {
  plan: V2Plan
  validityDays: number
  onBack: () => void
  onNext: () => void
}) {
  const tier = tierNameOf(plan.planKey)
  return (
    <div className="m2-pad" data-testid="open-store-guide" style={{ marginTop: 14, paddingBottom: 40 }}>
      <CardFace
        planKey={plan.planKey}
        priceText={mc('card.priceYear', { price: (plan.priceFen / 100).toFixed(0) })}
        claimText={tierClaimOf(plan.planKey)}
        height={204}
        padding="18px 20px"
        nameSize={25}
      />
      <div className="m2-card" style={{ marginTop: 14, padding: '16px 18px' }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{mc('j1.storePayTitle')}</div>
        <ul style={{ marginTop: 10, paddingLeft: 0, listStyle: 'none', fontSize: 12, lineHeight: 1.9, color: 'var(--v2ink)' }}>
          <li>1. {mc('j1.storePayStep1', { tier })}</li>
          <li>2. {mc('j1.storePayStep2', { n: plan.includedPets + 1, fen: (plan.extraPetFen / 100).toFixed(0) })}</li>
          <li>3. {mc('j1.storePayStep3', { days: validityDays })}</li>
        </ul>
        <p className="m2-note" style={{ marginTop: 10 }}>
          {mc('j1.storePayNote')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button
          type="button"
          onClick={onBack}
          className="m2-press"
          style={{
            flex: 1, borderRadius: 18, border: '1px solid var(--v2line)', background: 'var(--v2card)',
            padding: '14px 0', fontSize: 15, fontWeight: 700, color: 'var(--v2muted)', cursor: 'pointer',
          }}
        >
          {mc('j1.storePayBack')}
        </button>
        <button
          type="button"
          data-testid="open-guide-next"
          onClick={onNext}
          className="m2-btn-primary m2-press"
          style={{ flex: 1, padding: '14px 0' }}
        >
          {mc('j1.storePayOk')}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 完成页（骨架版第 3 步件化：注册用户=已开通 / 付费档=到店办理确认）               */
/* ------------------------------------------------------------------ */

function DonePanel({
  opened,
  picked,
  validityDays,
  onBack,
}: {
  opened: boolean
  picked: V2Plan | null
  validityDays: number
  onBack: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="m2-pad" data-testid="open-done" style={{ marginTop: 14, paddingBottom: 40 }}>
      <div className="m2-card" style={{ padding: '26px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--v2serif)', fontWeight: 900, fontSize: 21 }}>
          {opened ? mc('j1.freeOpenedTitle') : mc('j1.storePayTitle')}
        </div>
        <p className="m2-note" style={{ marginTop: 10 }}>
          {opened
            ? mc('j1.freeOpenedBody', { date: '' })
            : mc('j1.storePayBody', {
                tier: picked ? tierNameOf(picked.planKey) : '',
                price: picked ? `¥${(picked.priceFen / 100).toFixed(0)}/年` : '',
                days: validityDays,
              })}
        </p>
      </div>
      <button type="button" data-testid="open-done-back" className="m2-btn-primary m2-press" style={{ marginTop: 16 }} onClick={onBack}>
        {mc('j1.backMember')}
      </button>
      {/* PR-5 UX P3-2：完成页下半屏配重——宠物档案引导（45 号档改进方向取实现净者） */}
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button type="button" className="m2-link" data-testid="open-done-goto-pets" onClick={() => navigate('/philia/pets')}>
          {mc('j1.doneGotoPets')}
        </button>
      </div>
    </div>
  )
}
