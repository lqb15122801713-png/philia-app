/**
 * RecordsPage · /records 消费记录（客户端体验大批 片 1 · 支付售后面统一入口）
 *
 * - 押金进度区置顶：deposit.listMine——三态徽（held 在押 / refunding 退还在途 /
 *   refunded 已退还）+ 三时点（收取/申请退还/退还完成，有才显）+ 金额（mono）+
 *   门店名 + 留痕口径注记「押金收退=门店登记留痕，进度以此为准」；
 * - 消费记录列表：pay.recordsMine 三源聚合（kind 徽 pay/order/invoice + 标题 +
 *   金额 + 状态 + mono 时刻，点跳 server 透出 link）；空态三句话照既有工艺。
 * 返回=PushBar 时间序回退，直访兜底 /me。文案全走 copy/records.ts（rcc）。
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'
import { fenToYuan } from '@/components/booking/format'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { fmtDateTime } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { rcc } from '../copy/records'

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']
type DepositItem = Awaited<ReturnType<Trpc['deposit']['listMine']['query']>>['items'][number]
type RecordItem = Awaited<ReturnType<Trpc['pay']['recordsMine']['query']>>['items'][number]

/* 三态徽配色：在押=淡金底 / 退还在途=薄荷洗 / 已退还=墨沉底（照 MallOrdersPage opill 口径） */
const DEP_STATUS_PILL: Record<string, string> = {
  held: 'bg-brand-primary text-ink',
  refunding: 'bg-brand-secondary-light text-ink',
  refunded: 'bg-[rgba(59,46,36,.06)] text-ink-secondary',
}

function DepositCard({ d }: { d: DepositItem }) {
  const pill = DEP_STATUS_PILL[d.status] ?? DEP_STATUS_PILL.refunded
  const statusLabel =
    d.status === 'held' ? rcc('rec.depHeld') : d.status === 'refunding' ? rcc('rec.depRefunding') : rcc('rec.depRefunded')
  return (
    <div className="u1-card px-4 py-3.5" data-testid={`deposit-row-${d.id}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink">{d.storeName ?? '—'}</p>
        <span className={`rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${pill}`}>{statusLabel}</span>
      </div>
      <p className="u1-num mt-1 text-body-sm font-bold text-ink">{fenToYuan(d.amountFen)}</p>
      <div className="m2-mono mt-1 space-y-0.5 text-[9px] text-ink-secondary">
        {d.heldAt ? <p>{rcc('rec.depHeldAt', { time: fmtDateTime(d.heldAt) })}</p> : null}
        {d.refundRequestedAt ? <p>{rcc('rec.depRefundReqAt', { time: fmtDateTime(d.refundRequestedAt) })}</p> : null}
        {d.refundedAt ? <p>{rcc('rec.depRefundedAt', { time: fmtDateTime(d.refundedAt) })}</p> : null}
      </div>
    </div>
  )
}

function RecordRow({ r }: { r: RecordItem }) {
  const kindLabel =
    r.kind === 'pay' ? rcc('rec.kindPay') : r.kind === 'order' ? rcc('rec.kindOrder') : rcc('rec.kindInvoice')
  return (
    <Link
      to={r.link}
      data-testid={`record-row-${r.kind}-${r.id}`}
      className="u1-card flex items-center gap-3 px-4 py-3.5 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
    >
      <span className="flex-none rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary">
        {kindLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-semibold text-ink">{r.title}</p>
        <p className="m2-mono mt-0.5 text-[9px] text-ink-secondary">{fmtDateTime(r.createdAt)}</p>
      </div>
      <div className="flex flex-none flex-col items-end gap-0.5">
        {r.amountFen != null ? <span className="u1-num text-body-sm font-bold text-ink">{fenToYuan(r.amountFen)}</span> : null}
        <span className="text-caption-xs text-ink-placeholder">{r.status}</span>
      </div>
      <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
    </Link>
  )
}

export default function RecordsPage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()

  const depositsQ = useQuery({
    queryKey: ['deposit', 'listMine'],
    queryFn: () => trpc.deposit.listMine.query(),
    enabled: !!user,
  })
  const recordsQ = useQuery({
    queryKey: ['pay', 'recordsMine'],
    queryFn: () => trpc.pay.recordsMine.query(),
    enabled: !!user,
  })

  const deposits = depositsQ.data?.items ?? []
  const records = recordsQ.data?.items ?? []

  return (
    <div className="m2" data-testid="records-page" style={{ minHeight: '100vh' }}>
      <PushBar label={rcc('rec.pushLabel')} fallback="/me" />
      <div className="m2-apphead">
        <span className="tt">{rcc('rec.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        {/* 押金进度区（留痕口径注记明面） */}
        <SecH title={rcc('rec.depositTitle')} />
        {depositsQ.isPending ? (
          <LoadingBlock lines={2} />
        ) : depositsQ.isError ? (
          <ErrorState message={rcc('rec.loadFail')} onRetry={() => void depositsQ.refetch()} />
        ) : deposits.length === 0 ? (
          <p className="m2-note px-1" data-testid="deposit-empty">{rcc('rec.depositEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {deposits.map((d) => (
              <DepositCard key={d.id} d={d} />
            ))}
          </div>
        )}
        <p className="m2-note mt-2 px-1" data-testid="deposit-note">{rcc('rec.depositNote')}</p>

        {/* 消费记录三源聚合列表 */}
        <div style={{ marginTop: 18 }}>
          <SecH title={rcc('rec.title')} />
        </div>
        {recordsQ.isPending ? (
          <LoadingBlock lines={3} />
        ) : recordsQ.isError ? (
          <ErrorState message={rcc('rec.loadFail')} onRetry={() => void recordsQ.refetch()} />
        ) : records.length === 0 ? (
          /* 空态三句话（是什么 / 为什么 / 去哪），出口=商城 */
          <EmptyState
            title={rcc('rec.emptyTitle')}
            desc={rcc('rec.emptyBody')}
            action={
              <Link
                to="/mall"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {rcc('rec.emptyCta')}
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {records.map((r) => (
              <RecordRow key={`${r.kind}-${r.id}`} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
