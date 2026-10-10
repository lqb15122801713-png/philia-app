/**
 * MemberRenewPage · /member/renew 线上续费确认页（产品-1010 片 2 · B 股件 2）
 *
 * 组成（自上而下）：
 * - PushBar（返回=时间序回退，直访兜底 /member）+ AppHead「续费」+ Mock 水印条（R10 双位第一位=卡顶）；
 * - 当前档卡：planLabel + 含宠数 + 当前到期日（全读 membership.my / pay.quote server 值）；
 * - 金额明面：续费金额=pay.quote(bizDomain='membership_renew') server 实算值
 *   （membership.renew 同算式：当前档价+既有宠物附加；预约换档=预约档全价——前端零自算）；
 *   顺延至=quote.renewInfo.nextExpiresAt（冻结后自今日顺延口径同 server 内核）；
 *   预约换档注记（scheduledChange=true 时明面）；
 * - 吸底 CTA「去支付 ¥{amount}」→ pay.createOrder({bizDomain:'membership_renew'}) → 跳 /pay/:payNo；
 *   钮下 Mock 水印第二位（R10 双位）；
 * - 分流卡（全给明示出口，不弹球）：无会员档案 → 去选档开通（/member/open）；
 *   免费档（amountFen=0）→ 免费档续期无须缴费；channelEnabled=false → 维护态「请到店办理续费」。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { friendlyError, usePhiliaClient, useToast } from '@philia/shared'
import { ErrorState, LoadingBlock, formatFen } from '../components/home/common'
import { AppHead, EmptyC, PushBar, TipCard } from '../components/member/v2'
import { pc } from '../copy/pay'

export default function MemberRenewPage() {
  const { trpc } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 3200 })
  const navigate = useNavigate()

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })

  /* 金额/顺延唯一可信源：pay.quote(membership_renew) server 实算（涉钱戒律：前端零自算） */
  const quoteQ = useQuery({
    queryKey: ['pay', 'quote', 'membership_renew'],
    queryFn: () => trpc.pay.quote.query({ bizDomain: 'membership_renew' }),
    enabled: !!myQ.data?.membership,
  })
  const quote = quoteQ.data ?? null
  const renewInfo = quote && 'renewInfo' in quote ? quote.renewInfo : null

  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })
  const validityDays = plansQ.data?.membershipValidityDays ?? 365

  const createM = useMutation({
    mutationFn: () => trpc.pay.createOrder.mutate({ bizDomain: 'membership_renew' }),
    onSuccess: (r) => navigate(`/pay/${r.order.payNo}`),
    onError: (err) => showToast(friendlyError(err, pc('renew.createFail')), 'error'),
  })

  const membership = myQ.data?.membership ?? null
  const toExpiryText = renewInfo?.nextExpiresAt
    ? new Date(renewInfo.nextExpiresAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div className="m2" data-testid="member-renew-page" style={{ minHeight: '100vh' }}>
      {toastEl}
      {/* 返回=时间序回退；直访无栈兜底=/member（会员中心） */}
      <PushBar label={pc('renew.pushLabel')} fallback="/member" />
      <AppHead title={pc('renew.title')} no={pc('renew.headNo')} />

      {/* Mock 水印条第一位（R10 双位：卡顶，淡金底墨字） */}
      <div className="m2-pad" style={{ marginTop: 12 }}>
        <TipCard testId="mock-watermark-top">{pc('mock.watermark')}</TipCard>
      </div>

      {myQ.isPending || (membership && quoteQ.isPending) ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <LoadingBlock lines={4} />
        </div>
      ) : myQ.isError || quoteQ.isError ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <ErrorState message={pc('checkout.quoteFail')} onRetry={() => void quoteQ.refetch()} />
        </div>
      ) : !membership ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <EmptyC
            title={pc('renew.noMemberTitle')}
            desc={pc('renew.noMemberBody')}
            ctaText={pc('renew.noMemberBody')}
            onCta={() => navigate('/member/open')}
          />
        </div>
      ) : quote && quote.amountFen === 0 ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <EmptyC
            title={pc('renew.freePlanTitle')}
            desc={pc('renew.freePlanBody')}
            ctaText={pc('renew.pushLabel')}
            onCta={() => navigate('/member')}
          />
        </div>
      ) : quote && !quote.channelEnabled ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <EmptyC
            title={pc('renew.title')}
            desc={pc('renew.channelOff')}
            ctaText={pc('renew.pushLabel')}
            onCta={() => navigate('/member')}
          />
        </div>
      ) : quote ? (
        <>
          {/* 当前档卡 + 金额明面（全 server 值） */}
          <div className="m2-pad" style={{ marginTop: 14 }}>
            <div className="m2-card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--v2muted)' }}>{pc('renew.currentPlan')}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }} data-testid="renew-plan-label">{quote.planLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--v2muted)' }}>{pc('renew.petLine', { n: quote.petCount })}</span>
                <span style={{ fontSize: 12, color: 'var(--v2muted)' }}>
                  {pc('renew.toExpiry')} <span className="m2-mono" data-testid="renew-next-expiry">{toExpiryText}</span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, borderTop: '1px dashed var(--v2line)', paddingTop: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--v2muted)' }}>{pc('renew.amountLabel')}</span>
                <span className="m2-mono" data-testid="renew-amount" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  ¥{formatFen(quote.amountFen)}
                </span>
              </div>
              {renewInfo?.scheduledChange ? (
                <p className="m2-note" data-testid="renew-scheduled-note" style={{ margin: '10px 0 0' }}>
                  {pc('renew.scheduledChange', { planLabel: quote.planLabel })}
                </p>
              ) : null}
              <p className="m2-note" style={{ margin: '10px 0 0' }}>
                {pc('renew.noteLine', { days: validityDays })}
              </p>
            </div>
          </div>

          {/* 吸底 CTA + Mock 水印第二位 + 超时关单注 */}
          <div className="m2-cta">
            <button
              type="button"
              className="m2-btn-primary m2-press"
              data-testid="renew-pay-btn"
              disabled={createM.isPending}
              onClick={() => createM.mutate()}
            >
              {pc('renew.ctaPay', { amount: formatFen(quote.amountFen) })}
            </button>
            <p className="m2-note" data-testid="mock-watermark-cta" style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 11 }}>
              {pc('mock.watermark')}
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
