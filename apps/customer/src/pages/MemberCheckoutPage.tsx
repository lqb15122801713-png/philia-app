/**
 * MemberCheckoutPage · /member/checkout?plan=<planKey> 确认订单页
 * （补缺大批片 6 · J-01 收银台页面流第一屏；申报锚点=「确认订单」）
 *
 * 组成（自上而下）：
 * - PushBar（返回=时间序回退 navigate(-1)，直访兜底 /member/open）+ AppHead「确认订单」
 *   + Mock 水印条（R10 最高水位：淡金底墨字，卡顶一位）；
 * - 档位卡：planLabel + 档价 mono + 有效期天数（全读 member_plans / membership_validity_days）；
 * - 多宠 ±（区间 0 ~ max_pets−included，联动 pay.quote 重算；extraCount>0 显
 *   「多宠附加 ¥x/只/年 ×n」行）；
 * - 金额明面：档价 ¥a + 多宠附加 ¥b = 应付 ¥{amount}——金额全读 pay.quote server 试算值
 *   （涉钱戒律：前端零自算；¥b=quote.amountFen−quote.priceFen 两 server 值之明面分解，报备）；
 * - 协议三勾选（缺一不可提交）：每行勾选框 + 协议名链接 → 底部弹层展示协议全文
 *   （v1.0 版本注记 +「知道了」次级钮）；
 * - 吸底 CTA「去支付 ¥{amount}」→ pay.createOrder（agreements 带 version/content 全文快照）
 *   → 跳 /pay/:payNo；钮下 Mock 水印第二位 + 超时关单注。
 *
 * 分流说明卡（不弹球，全给明示出口）：无档/缺参 → 去选档；免费档 → 去一键开通；
 * channelEnabled=false → 维护态「线上支付通道维护中，请到店办理」。
 * 会员链路片 2：已是会员不再分流去会员中心——微光档=新购口径直通（bizDomain=
 * membership_upgrade 全价重算）；付费档=期内升档补差同域（只升不降由 server 硬闸）；
 * 纯非会员照旧 membership_open。升级域不画多宠 ±（升档不改动宠物数，按档案现值计）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { friendlyError, usePhiliaClient, useToast } from '@philia/shared'
import { ErrorState, LoadingBlock, formatFen } from '../components/home/common'
import { AppHead, EmptyC, PushBar, Sheet, TipCard, type V2Plan } from '../components/member/v2'
import { PAY_AGREEMENTS, pc, type PayAgreementKey } from '../copy/pay'

export default function MemberCheckoutPage() {
  const { trpc } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 3200 })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planKey = searchParams.get('plan') ?? ''

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })

  const plans = (plansQ.data?.plans ?? []) as V2Plan[]
  const plan = plans.find((p) => p.planKey === planKey) ?? null
  const validityDays = plansQ.data?.membershipValidityDays ?? 365

  /* 多宠附加只数（0 ~ max_pets−included）；petCount=included+extraN（quote 联动重算）。
     升级域不画多宠 ±：升档不改动宠物数，server 按现会员档案 petCount 重算附加 */
  const maxExtra = plan ? Math.max(plan.maxPets - plan.includedPets, 0) : 0
  const [extraN, setExtraN] = useState(0)

  /* 会员链路片 2：已是会员=升级域收单（微光=新购口径全价；付费档=期内补差），
     纯非会员=开通域；不再分流「已是会员→去会员中心」（入口断链修通②） */
  const alreadyMember = !!myQ.data?.membership
  const bizDomain = alreadyMember ? ('membership_upgrade' as const) : ('membership_open' as const)
  const petCount = alreadyMember
    ? (myQ.data?.membership?.petCount ?? 0)
    : plan
      ? plan.includedPets + Math.min(extraN, maxExtra)
      : 0

  /* 金额唯一可信源：pay.quote server 试算值（涉钱戒律：前端零自算） */
  const quoteQ = useQuery({
    queryKey: ['pay', 'quote', bizDomain, planKey, petCount],
    queryFn: () =>
      trpc.pay.quote.query({ bizDomain, planKey, petCount }),
    enabled: !!plan && !plan.free,
    placeholderData: (prev) => prev,
  })
  const quote = quoteQ.data ?? null
  /* 升级域试算明细（newPurchase=微光新购口径全价句明面；否则=期内补差句） */
  const upgradeQuote = quote && 'upgrade' in quote ? quote.upgrade : null

  /* 协议三勾选（缺一不可提交） */
  const [agreed, setAgreed] = useState<Record<PayAgreementKey, boolean>>({
    member_service: false,
    not_prepaid: false,
    no_auto_renew: false,
  })
  const allAgreed = PAY_AGREEMENTS.every((a) => agreed[a.agreementKey])
  const [sheetKey, setSheetKey] = useState<PayAgreementKey | null>(null)
  const sheetAgreement = PAY_AGREEMENTS.find((a) => a.agreementKey === sheetKey) ?? null

  const createM = useMutation({
    mutationFn: () =>
      trpc.pay.createOrder.mutate({
        bizDomain,
        planKey,
        petCount,
        /* 三协议全文快照（version/content）随单留痕 */
        agreements: PAY_AGREEMENTS.map((a) => ({
          agreementKey: a.agreementKey,
          version: a.version,
          content: a.content,
        })),
      }),
    onSuccess: (r) => navigate(`/pay/${r.order.payNo}`),
    onError: (err) => showToast(friendlyError(err, pc('checkout.createFail')), 'error'),
  })

  return (
    <div className="m2" data-testid="member-checkout-page" style={{ minHeight: '100vh' }}>
      {toastEl}
      {/* 返回=时间序回退；直访无栈兜底=/member/open（选档页，非 /member 防弹球） */}
      <PushBar label={pc('checkout.pushLabel')} fallback="/member/open" />
      <AppHead title={pc('checkout.title')} no={pc('checkout.headNo')} />

      {/* Mock 水印条第一位（R10：卡顶，淡金底墨字） */}
      <div className="m2-pad" style={{ marginTop: 12 }}>
        <TipCard testId="mock-watermark-top">{pc('mock.watermark')}</TipCard>
      </div>

      {plansQ.isPending || myQ.isPending ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <LoadingBlock lines={4} />
        </div>
      ) : plansQ.isError ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <ErrorState message={pc('checkout.quoteFail')} onRetry={() => void plansQ.refetch()} />
        </div>
      ) : !plan ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <EmptyC
            title={pc('checkout.missingPlanTitle')}
            desc={pc('checkout.missingPlanBody')}
            ctaText={pc('checkout.missingPlanCta')}
            onCta={() => navigate('/member/open')}
          />
        </div>
      ) : plan.free ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <EmptyC
            title={pc('checkout.freePlanTitle')}
            desc={pc('checkout.freePlanBody')}
            ctaText={pc('checkout.freePlanCta')}
            onCta={() => navigate('/member/open')}
          />
        </div>
      ) : quote && !quote.channelEnabled ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <EmptyC
            title={pc('checkout.channelOffTitle')}
            desc={pc('checkout.channelOffBody')}
            ctaText={pc('checkout.channelOffCta')}
            onCta={() => navigate('/member/open')}
          />
        </div>
      ) : (
        <>
          {/* 档位卡（planLabel + 档价 mono + 有效期天数，全读端口） */}
          <div className="m2-pad" style={{ marginTop: 14 }}>
            <div className="m2-card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--v2muted)' }}>
                {alreadyMember ? pc('checkout.planLabelUpgrade') : pc('checkout.planLabel')}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontFamily: 'var(--v2serif)', fontWeight: 900, fontSize: 20 }}>
                  {quote?.planLabel ?? plan.label}
                </span>
                <span className="m2-mono" style={{ fontSize: 17, fontWeight: 700 }}>
                  {pc('checkout.planPriceYear', { price: formatFen(plan.priceFen) })}
                </span>
              </div>
              <p className="m2-note" style={{ margin: '8px 0 0' }}>
                {/* 升级域口径句明面：微光=新购口径（全价+有效期重起算）；付费档=期内补差（到期日不变） */}
                {alreadyMember
                  ? upgradeQuote?.newPurchase
                    ? pc('checkout.upgradeNoteNewPurchase')
                    : pc('checkout.upgradeNoteDiff')
                  : pc('checkout.validity', { days: validityDays })}
              </p>
            </div>
          </div>

          {/* 多宠 ±（0 ~ max_pets−included；quote 重算联动）。升级域不画（升档不改动宠物数） */}
          {!alreadyMember && maxExtra > 0 ? (
            <div className="m2-pad" style={{ marginTop: 12 }}>
              <div className="m2-card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{pc('checkout.petCountLabel')}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button
                      type="button"
                      aria-label={pc('checkout.petMinus')}
                      data-testid="checkout-pet-minus"
                      className="m2-press"
                      disabled={extraN <= 0}
                      onClick={() => setExtraN((n) => Math.max(n - 1, 0))}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--v2line)',
                        background: 'var(--v2card)', color: 'var(--v2ink)', fontSize: 17, cursor: 'pointer',
                        opacity: extraN <= 0 ? 0.4 : 1,
                      }}
                    >
                      −
                    </button>
                    <span className="m2-mono" data-testid="checkout-pet-count" style={{ fontSize: 14, fontWeight: 700, minWidth: 44, textAlign: 'center' }}>
                      {pc('checkout.petCountValue', { n: petCount })}
                    </span>
                    <button
                      type="button"
                      aria-label={pc('checkout.petPlus')}
                      data-testid="checkout-pet-plus"
                      className="m2-press"
                      disabled={extraN >= maxExtra}
                      onClick={() => setExtraN((n) => Math.min(n + 1, maxExtra))}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--v2line)',
                        background: 'var(--v2card)', color: 'var(--v2ink)', fontSize: 17, cursor: 'pointer',
                        opacity: extraN >= maxExtra ? 0.4 : 1,
                      }}
                    >
                      +
                    </button>
                  </span>
                </div>
                <p className="m2-note" style={{ margin: '8px 0 0' }}>
                  {pc('checkout.petIncludedNote', {
                    n: plan.includedPets,
                    from: plan.includedPets + 1,
                    price: formatFen(plan.extraPetFen),
                  })}
                </p>
              </div>
            </div>
          ) : null}

          {/* 金额明面（档价 ¥a + 多宠附加 ¥b = 应付 ¥{amount}；全读 quote 零自算） */}
          <div className="m2-pad" style={{ marginTop: 12 }}>
            <div className="m2-card" style={{ padding: '6px 18px' }} data-testid="checkout-amount-card">
              {quoteQ.isError ? (
                <div style={{ padding: '12px 0' }}>
                  <ErrorState message={pc('checkout.quoteFail')} onRetry={() => void quoteQ.refetch()} />
                </div>
              ) : (
                <>
                  <div className="m2-rowx" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>{pc('checkout.amountPlan')}</span>
                    <span className="m2-mono" data-testid="checkout-amount-plan" style={{ fontSize: 13, fontWeight: 700 }}>
                      ¥{quote ? formatFen(quote.priceFen) : '—'}
                    </span>
                  </div>
                  {quote && quote.extraCount > 0 ? (
                    <div className="m2-rowx" style={{ justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13 }}>
                        {pc('checkout.petExtra', { price: formatFen(plan.extraPetFen), n: quote.extraCount })}
                      </span>
                      {/* ¥b=quote.amountFen−quote.priceFen（两 server 试算值明面分解，报备） */}
                      <span className="m2-mono" data-testid="checkout-amount-extra" style={{ fontSize: 13, fontWeight: 700 }}>
                        ¥{formatFen(quote.amountFen - quote.priceFen)}
                      </span>
                    </div>
                  ) : null}
                  <div className="m2-rowx" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{pc('checkout.amountTotal')}</span>
                    <span
                      className="m2-mono"
                      data-testid="checkout-amount-total"
                      style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}
                    >
                      ¥{quote ? formatFen(quote.amountFen) : '—'}
                    </span>
                  </div>
                </>
              )}
            </div>
            {quote ? (
              <p className="m2-note" style={{ margin: '8px 2px 0' }}>
                {pc('checkout.timeoutNotice', { minutes: quote.timeoutMinutes })}
              </p>
            ) : null}
          </div>

          {/* 协议三勾选（缺一不可提交；协议名=链接 → 弹层全文） */}
          <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 150 }}>
            <div className="m2-sec-h" style={{ margin: '0 0 10px' }}>
              <h3>{pc('checkout.agreeTitle')}</h3>
            </div>
            <div className="m2-card" style={{ padding: '4px 18px' }}>
              {PAY_AGREEMENTS.map((a) => (
                <div className="m2-rowx" key={a.agreementKey} data-testid={`checkout-agree-${a.agreementKey}`}>
                  <input
                    type="checkbox"
                    aria-label={pc(a.titleKey)}
                    checked={agreed[a.agreementKey]}
                    onChange={(e) => setAgreed((s) => ({ ...s, [a.agreementKey]: e.target.checked }))}
                    style={{ width: 17, height: 17, accentColor: 'var(--ink-deep)', flex: 'none', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--v2muted)', flex: 'none' }}>{pc('checkout.agreeLabel')}</span>
                  <button
                    type="button"
                    className="m2-link"
                    style={{ fontSize: 12.5 }}
                    onClick={() => setSheetKey(a.agreementKey)}
                  >
                    {pc(a.titleKey)}
                  </button>
                </div>
              ))}
            </div>
            {!allAgreed ? (
              <p className="m2-note" style={{ margin: '8px 2px 0' }}>
                {pc('checkout.agreeMissing')}
              </p>
            ) : null}
          </div>

          {/* 吸底 CTA（页内吸底非弹窗）：去支付 ¥{amount} → createOrder → /pay/:payNo */}
          <div className="m2-ctabar">
            <div className="m2-ctabar-in">
              <button
                type="button"
                className="m2-btn-primary m2-press"
                data-testid="checkout-submit"
                disabled={!allAgreed || !quote || quoteQ.isError || createM.isPending}
                onClick={() => createM.mutate()}
              >
                <span>
                  {createM.isPending
                    ? pc('checkout.submitting')
                    : pc('checkout.payCta', { amount: quote ? formatFen(quote.amountFen) : '—' })}
                </span>
              </button>
              {/* Mock 水印条第二位（R10：提交钮下） */}
              <p
                className="m2-note"
                data-testid="mock-watermark-cta"
                style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 11 }}
              >
                {pc('mock.watermark')}
              </p>
            </div>
          </div>
        </>
      )}

      {/* 协议全文弹层（§4.5 三件套；v1.0 版本注记 +「知道了」次级钮） */}
      <Sheet
        open={sheetAgreement !== null}
        onClose={() => setSheetKey(null)}
        title={sheetAgreement ? pc(sheetAgreement.titleKey) : ''}
        note={sheetAgreement ? pc('checkout.agreementSheetNote', { version: sheetAgreement.version }) : undefined}
      >
        <p
          data-testid="agreement-sheet-body"
          style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--v2ink)', whiteSpace: 'pre-line', margin: 0 }}
        >
          {sheetAgreement?.content}
        </p>
        <button
          type="button"
          data-testid="agreement-sheet-gotit"
          className="m2-press"
          onClick={() => setSheetKey(null)}
          style={{
            width: '100%', marginTop: 16, borderRadius: 18, border: '1px solid var(--v2line)',
            background: 'var(--v2card)', padding: '13px 0', fontSize: 14, fontWeight: 700,
            color: 'var(--v2muted)', cursor: 'pointer',
          }}
        >
          {pc('checkout.agreementGotIt')}
        </button>
      </Sheet>
    </div>
  )
}
