/**
 * MemberOpenPage · /member/open 会员办理页（J-01 未购转化屏 · 批次 R11b 视觉批 ·
 * 38 号施工令 + 36 号施工示意图 §三 + 34 号设计规范 v2.0；申报锚点=「开通会员」）
 *
 * 卡即选择器（§4.8）：deck 横滑 scroll-snap 居中 + 点卡选档，三格账/权益墙/CTA 档跟随
 * （data 驱动）；对比四档权益=底部弹层（§4.5 三件套）；吸底 CTA（§4.1 页内吸底非弹窗）。
 *
 * 功能逻辑零改动（四铁律）：微光→openFree 一键开档（幂等）；付费档→到店付开通确认流
 * （骨架版现有 select→guide→done 三步，本批仅件化视觉）；已是会员→提示条不挡流程。
 * 数值全读 member_plans 端口（冻结值 88/85/8），文案全走文案键（copy.ts）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import { friendlyError, useToast } from '@/components/booking/Toast'
import { ErrorState, LoadingBlock } from '../components/home/common'
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

/** 档色条（对比弹层用；与 cf-t0~t3 色谱同源 §1.3；微光=白卡色仅作卡面） */
const TIER_SWATCH: Record<string, string> = {
  plan_nuanyang: 'linear-gradient(135deg,#433225,#2A1F15)',
  plan_zhuguang: 'linear-gradient(135deg,#B39A6E,#8F7850)',
  plan_yinghuo: 'linear-gradient(135deg,#F6E7BE,#EBD494)',
  plan_weiguang: 'var(--v2card)',
}

export default function MemberOpenPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast()
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

  const openFreeM = useMutation({
    mutationFn: () => trpc.membership.openFree.mutate(),
    onSuccess: (r) => {
      setDoneOpened(true)
      setStep('done')
      showToast(r.idempotent ? '你已是会员' : '微光会员已开通，欢迎加入', 'info')
      void queryClient.invalidateQueries({ queryKey: ['membership'] })
    },
    onError: (err) => showToast(friendlyError(err, '开通失败，请稍后再试')),
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
  const alreadyMember = !!myQ.data?.membership

  return (
    <div className="m2" data-testid="member-open-page" style={{ minHeight: '100vh' }}>
      {toastEl}
      <PushBar label={mc('j1.pushLabel')} to="/member" />

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
          {/* 已是会员提示条（不挡流程） */}
          {alreadyMember && myQ.data?.membership ? (
            <div className="m2-pad" style={{ marginTop: 10 }}>
              <TipCard>
                {mc('j1.alreadyMember', {
                  date: new Date(myQ.data.membership.expiresAt).toLocaleDateString('zh-CN'),
                })}
              </TipCard>
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
                { v: mc('j1.petsIncluded', { n: selected.includedPets }), k: mc('j1.ledgerPets') },
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

            {/* 权益墙（档跟随切换） */}
            <SecH
              title={mc('a3.perksTitle', { tier: tierNameOf(selected.planKey) })}
              more={mc('j1.perksFollow')}
            />
            <PerksWall plan={selected} />

            {/* 规则明面（红线 5 全量八条） */}
            <RulesBlock
              plan={selected}
              settlementDay={plansQ.data.rebateSettlementDay}
              validityDays={plansQ.data.membershipValidityDays}
              allPcts={plans.filter((p) => p.rebateBp > 0).map((p) => pctOf(p.rebateBp)).join('/')}
            />
          </div>

          {/* 吸底 CTA（页内形态非弹窗） */}
          <div className="m2-ctabar">
            <div className="m2-ctabar-in">
              <button
                type="button"
                className="m2-btn-primary m2-press"
                disabled={openFreeM.isPending}
                data-testid={selected.free ? 'open-free-btn' : 'open-pick-cta'}
                onClick={() => {
                  if (selected.free) openFreeM.mutate()
                  else setStep('guide')
                }}
              >
                <span>
                  {selected.free
                    ? mc('j1.ctaOpenFree')
                    : mc('j1.ctaOpen', { tier: tierNameOf(selected.planKey), daily: dailyOf(selected.priceFen) })}
                </span>
                <span className="sub">{mc('j1.ctaSub')}</span>
              </button>
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
                <div>
                  <div className="anm">
                    {tierNameOf(p.planKey)} {p.free ? '· 免费注册' : `¥${(p.priceFen / 100).toFixed(0)}/年`}
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
/* 完成页（骨架版第 3 步件化：微光=已开通 / 付费档=到店办理确认）               */
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
    </div>
  )
}
