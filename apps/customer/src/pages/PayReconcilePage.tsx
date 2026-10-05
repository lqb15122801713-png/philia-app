/**
 * PayReconcilePage · /pay/reconcile?payNo= 掉单自助查询页
 * （补缺大批片 6 · J-01 收银台页面流第三屏；申报锚点=「付了没开」）
 *
 * 组成：说明卡（reconcileTitle/reconcileHint）+ 本人最近 pay_orders 列表
 * （pay.listMine：单号/档位/金额 mono/状态签/时刻）+ 在途（created/paying）行
 * 「对账补开」钮 → pay.reconcile → 成功 toast「已补开成功」+ 列表/会员域缓存失效刷新。
 * URL 带 payNo 参数时高亮该行（金色描边，掉单页「付了没开」入口直达定位）。
 * 空态三句话（无支付单）；返回=时间序回退 navigate(-1)，直访兜底 /me。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { friendlyError, usePhiliaClient, useToast } from '@philia/shared'
import { ErrorState, LoadingBlock, formatFen } from '../components/home/common'
import { AppHead, PushBar, TipCard } from '../components/member/v2'
import { pc, type PayCopyKey } from '../copy/pay'

/** 状态签 → copy 键 + 色组（全走 preset token：success=深棕墨 / danger=赭红 / sunken=素底） */
const STATUS_CHIP: Record<string, { key: PayCopyKey; cls: string }> = {
  created: { key: 'payStatus.created', cls: 'bg-brand-secondary-light text-ink' },
  paying: { key: 'payStatus.paying', cls: 'bg-brand-secondary-light text-ink' },
  paid: { key: 'payStatus.paid', cls: 'bg-success-light text-success-deep' },
  failed: { key: 'payStatus.failed', cls: 'bg-danger-light text-danger-deep' },
  closed: { key: 'payStatus.closed', cls: 'bg-sunken text-ink-secondary' },
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PayReconcilePage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 3200 })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlight = searchParams.get('payNo') ?? ''

  const listQ = useQuery({
    queryKey: ['pay', 'listMine'],
    queryFn: () => trpc.pay.listMine.query(),
  })
  const items = listQ.data?.items ?? []

  const reconcileM = useMutation({
    mutationFn: (payNo: string) => trpc.pay.reconcile.mutate({ payNo }),
    onSuccess: (r) => {
      showToast(r.reconciled ? pc('reconcile.success') : r.message, 'info')
      void queryClient.invalidateQueries({ queryKey: ['pay'] })
      void queryClient.invalidateQueries({ queryKey: ['membership'] })
    },
    onError: (err) => showToast(friendlyError(err, pc('reconcile.fail')), 'error'),
  })

  return (
    <div className="m2" data-testid="pay-reconcile-page" style={{ minHeight: '100vh' }}>
      {toastEl}
      {/* 返回=时间序回退；直访无栈兜底=/me */}
      <PushBar label={pc('reconcile.pushLabel')} fallback="/me" />
      <AppHead title={pc('reconcile.title')} no="PHILIA PAY" />

      {/* 说明卡 */}
      <div className="m2-pad" style={{ marginTop: 12 }}>
        <TipCard>{pc('reconcile.hint')}</TipCard>
      </div>

      <div className="m2-pad" style={{ marginTop: 18, paddingBottom: 40 }}>
        <div className="m2-sec-h" style={{ margin: '0 0 10px' }}>
          <h3>{pc('reconcile.listTitle')}</h3>
        </div>

        {listQ.isPending ? (
          <LoadingBlock lines={4} />
        ) : listQ.isError ? (
          <ErrorState message={pc('reconcile.loadFail')} onRetry={() => void listQ.refetch()} />
        ) : items.length === 0 ? (
          /* 空态三句话（§4.11 三句话结构：题 + 三行说明 + 出口钮） */
          <div className="m2-emptyc m2-card" data-testid="reconcile-empty">
            <div className="t">{pc('reconcile.emptyTitle')}</div>
            <div className="d">
              <p style={{ margin: 0 }}>{pc('reconcile.empty1')}</p>
              <p style={{ margin: '4px 0 0' }}>{pc('reconcile.empty2')}</p>
              <p style={{ margin: '4px 0 0' }}>{pc('reconcile.empty3')}</p>
            </div>
            <button type="button" className="m2-btn-primary m2-press" onClick={() => navigate('/member/open')}>
              {pc('reconcile.emptyCta')}
            </button>
          </div>
        ) : (
          <div className="m2-card" style={{ padding: '4px 18px' }}>
            {items.map(({ order, biz }) => {
              const chip = STATUS_CHIP[order.status] ?? STATUS_CHIP.closed!
              const inflight = order.status === 'created' || order.status === 'paying'
              const hl = highlight !== '' && order.payNo === highlight
              return (
                <div
                  className="m2-rowx"
                  key={order.id}
                  data-testid={`reconcile-row-${order.payNo}`}
                  style={
                    hl
                      ? {
                          margin: '0 -18px', padding: '13px 18px', borderRadius: 14,
                          boxShadow: '0 0 0 2px var(--gold)', background: 'var(--v2card)',
                        }
                      : undefined
                  }
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {biz && 'planLabel' in biz ? (biz.planLabel ?? '') : ''}
                    </div>
                    <div className="m2-mono" style={{ fontSize: 9.5, color: 'var(--v2muted)', marginTop: 3, letterSpacing: '0.06em' }}>
                      {order.payNo}
                    </div>
                    <div className="m2-mono" style={{ fontSize: 9, color: 'var(--v2muted)', marginTop: 2 }}>
                      {fmtTime(order.createdAt)}
                    </div>
                  </div>
                  <span className="m2-mono" style={{ fontSize: 14, fontWeight: 700, flex: 'none' }}>
                    ¥{formatFen(order.amountFen)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${chip.cls}`}
                    style={{ flex: 'none' }}
                  >
                    {pc(chip.key)}
                  </span>
                  {inflight ? (
                    <button
                      type="button"
                      className="m2-press"
                      data-testid={`reconcile-btn-${order.payNo}`}
                      disabled={reconcileM.isPending}
                      onClick={() => reconcileM.mutate(order.payNo)}
                      style={{
                        flex: 'none', borderRadius: 12, border: '1px solid var(--v2line)',
                        background: 'var(--ink-deep)', color: 'var(--gold)', padding: '8px 12px',
                        fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {reconcileM.isPending && reconcileM.variables === order.payNo
                        ? pc('reconcile.doing')
                        : pc('reconcile.btn')}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
