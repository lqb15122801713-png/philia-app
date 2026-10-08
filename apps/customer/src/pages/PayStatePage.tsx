/**
 * PayStatePage · /pay/:payNo 支付态页
 * （补缺大批片 6 · J-01 收银台页面流第二屏；申报锚点=「付了没开」）
 *
 * 轮询 pay.status（2s interval，终态 paid/failed/closed 停轮）+ 五态渲染：
 * - created/paying：等待句 + Mock 水印 + 内测演示控制区（「模拟支付成功」主钮
 *   → POST /api/pay/orders/mock-callback {orderId, scenario:'success'}；次级链
 *   模拟失败/模拟超时/模拟掉单——标注「内测演示控制」，仅 mock 通道可用）；
 * - paid：墨色成功卡（✓ + 会员已开通 + planLabel/有效期天数读端口）+「看看会员页 ›」→ /member；
 * - failed：赭红失败卡 + 重试（重新 createOrder 同档同宠——同人同档当日幂等，
 *   终结单新尝试序号由 server 分配）→ 跳新 /pay/:payNo；
 * - closed：超时关单卡 + 重新下单链（同重试路径）。
 *
 * 「付了没开」入口条（→/pay/reconcile?payNo=）全态常显；Mock 水印页顶常显（R10 第三位）。
 * 返回=时间序回退 navigate(-1)，直访兜底 /member/checkout。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { friendlyError, getApiBase, usePhiliaClient, useToast } from '@philia/shared'
import { ErrorState, LoadingBlock, formatFen } from '../components/home/common'
import { PushBar, TipCard } from '../components/member/v2'
import { PAY_AGREEMENTS, pc } from '../copy/pay'

type MockScenario = 'success' | 'fail' | 'timeout' | 'drop'

export default function PayStatePage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 3200 })
  const navigate = useNavigate()
  const { payNo = '' } = useParams()
  const [mockBusy, setMockBusy] = useState<MockScenario | null>(null)

  const statusQ = useQuery({
    queryKey: ['pay', 'status', payNo],
    queryFn: () => trpc.pay.status.query({ payNo }),
    retry: false,
    refetchInterval: (q) => {
      const s = q.state.data?.order.status
      return s === 'paid' || s === 'failed' || s === 'closed' ? false : 2000
    },
  })
  const order = statusQ.data?.order ?? null
  const biz = statusQ.data?.biz ?? null

  /* paid 态有效期天数读 member_plans 端口（60s stale，非硬编码口径值） */
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
    enabled: order?.status === 'paid',
  })

  /* 支付成功 → 会员域缓存失效（会员中心/开通页即时反映已开通） */
  useEffect(() => {
    if (order?.status === 'paid') {
      void queryClient.invalidateQueries({ queryKey: ['membership'] })
    }
  }, [order?.status, queryClient])

  /* Mock 客户端驱动（内测演示控制）：四态场景 → 服务端按平台口径走验签/业务路径 */
  const mockCall = async (scenario: MockScenario) => {
    if (!order || mockBusy) return
    setMockBusy(scenario)
    try {
      const res = await fetch(`${getApiBase()}/api/pay/orders/mock-callback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, scenario }),
      })
      const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null
      if (!res.ok || body?.code !== 'SUCCESS') {
        showToast(body?.message ?? pc('state.mockFailToast'), 'error')
      }
      await statusQ.refetch()
    } catch {
      showToast(pc('state.mockFailToast'), 'error')
    } finally {
      setMockBusy(null)
    }
  }

  /* 重试/重新下单：同档同域重新 createOrder（幂等口径见 server；三协议沿用本次快照） */
  const retryM = useMutation({
    mutationFn: () => {
      if (!biz?.planKey || typeof biz.petCount !== 'number') {
        return Promise.reject(new Error('biz missing'))
      }
      return trpc.pay.createOrder.mutate({
        bizDomain: biz.bizDomain === 'membership_upgrade' ? 'membership_upgrade' : 'membership_open',
        planKey: biz.planKey,
        petCount: biz.petCount,
        agreements: PAY_AGREEMENTS.map((a) => ({
          agreementKey: a.agreementKey,
          version: a.version,
          content: a.content,
        })),
      })
    },
    onSuccess: (r) => navigate(`/pay/${r.order.payNo}`, { replace: true }),
    onError: (err) => showToast(friendlyError(err, pc('checkout.createFail')), 'error'),
  })

  const validityDays = plansQ.data?.membershipValidityDays ?? 365

  return (
    <div className="m2" data-testid="pay-state-page" style={{ minHeight: '100vh' }}>
      {toastEl}
      {/* 返回=时间序回退；直访无栈兜底=/member/checkout（确认订单页） */}
      <PushBar label={pc('state.pushLabel')} fallback="/member/checkout" />

      {/* Mock 水印页顶常显（R10 最高水位第三位：支付结果页） */}
      <div className="m2-pad" style={{ marginTop: 12 }}>
        <TipCard testId="mock-watermark-state">{pc('mock.watermark')}</TipCard>
      </div>

      {statusQ.isPending ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <LoadingBlock lines={4} />
        </div>
      ) : statusQ.isError || !order ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <ErrorState message={pc('state.loadFail')} onRetry={() => void statusQ.refetch()} />
        </div>
      ) : (
        <>
          {/* 订单元信息（单号/档位/金额 mono 全读 server） */}
          <div className="m2-pad" style={{ marginTop: 14 }}>
            <div className="m2-card" style={{ padding: '16px 18px' }}>
              <div className="m2-mono" style={{ fontSize: 10, color: 'var(--v2muted)', letterSpacing: '0.08em' }}>
                {pc('state.orderNo', { payNo: order.payNo })}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {pc('state.planLine', { planLabel: biz?.planLabel ?? '', n: biz?.petCount ?? 0 })}
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--v2muted)' }}>{pc('state.amountLabel')}</span>
                  <span className="m2-mono" data-testid="pay-amount" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    ¥{formatFen(order.amountFen)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* 五态状态卡 */}
          <div className="m2-pad" style={{ marginTop: 12 }}>
            {order.status === 'created' || order.status === 'paying' ? (
              <div className="m2-card" style={{ padding: '20px 18px' }} data-testid="pay-state-paying">
                <div style={{ fontFamily: 'var(--v2serif)', fontWeight: 900, fontSize: 19 }}>
                  {order.status === 'created' ? pc('state.createdTitle') : pc('state.payingTitle')}
                </div>
                <p className="m2-note" style={{ margin: '8px 0 0' }}>
                  {order.status === 'created' ? pc('state.createdBody') : pc('state.payingBody')}
                </p>
                {order.paymentId ? (
                  <div style={{ marginTop: 16 }}>
                    <div
                      className="m2-mono"
                      style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--v2muted)', textTransform: 'uppercase' }}
                    >
                      {pc('state.mockDemoLabel')}
                    </div>
                    <button
                      type="button"
                      className="m2-btn-primary m2-press"
                      data-testid="mock-success-btn"
                      disabled={mockBusy !== null}
                      onClick={() => void mockCall('success')}
                      style={{ marginTop: 10, padding: '14px 22px', fontSize: 15 }}
                    >
                      <span>{mockBusy === 'success' ? pc('state.mockWorking') : pc('state.mockSuccess')}</span>
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 12 }}>
                      <button
                        type="button"
                        className="m2-link"
                        data-testid="mock-fail-btn"
                        disabled={mockBusy !== null}
                        onClick={() => void mockCall('fail')}
                      >
                        {pc('state.mockFail')}
                      </button>
                      <button
                        type="button"
                        className="m2-link"
                        data-testid="mock-timeout-btn"
                        disabled={mockBusy !== null}
                        onClick={() => void mockCall('timeout')}
                      >
                        {pc('state.mockTimeout')}
                      </button>
                      <button
                        type="button"
                        className="m2-link"
                        data-testid="mock-drop-btn"
                        disabled={mockBusy !== null}
                        onClick={() => void mockCall('drop')}
                      >
                        {pc('state.mockDrop')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : order.status === 'paid' ? (
              /* 墨色成功卡（✓ + 会员已开通；色值全走 m2 token） */
              <div
                className="m2-card"
                data-testid="pay-state-paid"
                style={{ padding: '24px 20px', textAlign: 'center', background: 'var(--ink-deep)', border: 'none', color: 'var(--gold)' }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 46, height: 46, borderRadius: '50%', margin: '0 auto',
                    border: '1.5px solid var(--gold-deep)', display: 'grid', placeItems: 'center',
                    fontSize: 22, color: 'var(--gold-deep)',
                  }}
                >
                  ✓
                </div>
                <div style={{ fontFamily: 'var(--v2serif)', fontWeight: 900, fontSize: 21, marginTop: 12, color: 'var(--gold)' }}>
                  {biz?.bizDomain === 'membership_upgrade' ? pc('state.paidTitleUpgrade') : pc('state.paidTitle')}
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.8, margin: '8px 0 0', color: 'var(--gold-deep)', opacity: 0.85 }}>
                  {biz?.bizDomain === 'membership_upgrade'
                    ? pc('state.paidBodyUpgrade', { planLabel: biz?.planLabel ?? '' })
                    : pc('state.paidBody', { planLabel: biz?.planLabel ?? '', days: validityDays })}
                </p>
                <button
                  type="button"
                  className="m2-press"
                  data-testid="pay-goto-member"
                  onClick={() => navigate('/member')}
                  style={{
                    marginTop: 16, borderRadius: 18, border: '1px solid var(--gold-deep)',
                    background: 'transparent', color: 'var(--gold-deep)', padding: '12px 26px',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {pc('state.paidCta')}
                </button>
              </div>
            ) : order.status === 'failed' ? (
              /* 赭红失败卡（色值走全局 destructive token）+ 重试 */
              <div
                className="m2-card"
                data-testid="pay-state-failed"
                style={{
                  padding: '20px 18px', textAlign: 'center',
                  border: '1px solid hsl(var(--destructive) / 0.35)',
                  background: 'hsl(var(--destructive) / 0.06)',
                }}
              >
                <div style={{ fontFamily: 'var(--v2serif)', fontWeight: 900, fontSize: 19, color: 'hsl(var(--destructive))' }}>
                  {pc('state.failedTitle')}
                </div>
                <p className="m2-note" style={{ margin: '8px 0 0' }}>
                  {pc('state.failHint')}
                </p>
                <button
                  type="button"
                  className="m2-btn-primary m2-press"
                  data-testid="pay-retry-btn"
                  disabled={retryM.isPending}
                  onClick={() => retryM.mutate()}
                  style={{ marginTop: 14, padding: '13px 22px', fontSize: 14 }}
                >
                  <span>{retryM.isPending ? pc('state.retrying') : pc('state.retry')}</span>
                </button>
              </div>
            ) : (
              /* closed：超时关单卡 + 重新下单链 */
              <div className="m2-card" data-testid="pay-state-closed" style={{ padding: '20px 18px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--v2serif)', fontWeight: 900, fontSize: 19 }}>
                  {pc('state.closedTitle')}
                </div>
                <p className="m2-note" style={{ margin: '8px 0 0' }}>
                  {pc('state.closedHint')}
                </p>
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="m2-link"
                    data-testid="pay-reorder-link"
                    disabled={retryM.isPending}
                    onClick={() => retryM.mutate()}
                    style={{ fontSize: 13 }}
                  >
                    {retryM.isPending ? pc('state.retrying') : pc('state.reorder')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 「付了没开」入口条（全态常显 → /pay/reconcile?payNo=） */}
      <div className="m2-pad" style={{ marginTop: 12, paddingBottom: 40 }}>
        <button
          type="button"
          className="m2-card m2-press"
          data-testid="pay-reconcile-entry"
          onClick={() => navigate(`/pay/reconcile?payNo=${encodeURIComponent(payNo)}`)}
          style={{
            width: '100%', padding: '14px 18px', textAlign: 'center', cursor: 'pointer',
            fontSize: 12.5, color: 'var(--v2muted)',
          }}
        >
          {pc('state.reconcileEntry')}
        </button>
      </div>
    </div>
  )
}
