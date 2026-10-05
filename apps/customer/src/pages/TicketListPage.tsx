/**
 * TicketListPage · /support 我的工单（补缺大批片 4 · 小棉花）
 *
 * - 数据：serviceLoop.ticketListMine（本人工单，创建倒序，上限 50）；
 * - 行=状态 pill（已提交/已回复/已关闭/已升级店长介入）+ 类型 + 描述截断 + 时刻 mono + 工单号；
 * - 空态三句话（出口=写一封给小棉花 /support/new）。
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { sl } from '@/copy/serviceloop'

/** 状态 pill（提交=淡金 / 已回复=卡其浅底 / 已关闭=沉底 / 已升级=赭红浅底；反馈件不设绿） */
const STATUS_META: Record<string, { key: 'ticket.statusSubmitted' | 'ticket.statusReplied' | 'ticket.statusClosed' | 'ticket.statusEscalated'; pill: string }> = {
  submitted: { key: 'ticket.statusSubmitted', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  replied: { key: 'ticket.statusReplied', pill: 'bg-brand-secondary-light text-ink' },
  closed: { key: 'ticket.statusClosed', pill: 'bg-sunken text-ink-placeholder' },
  escalated: { key: 'ticket.statusEscalated', pill: 'bg-danger-light text-danger-deep' },
}

const TYPE_LABEL: Record<string, 'ticket.typeSuggest' | 'ticket.typeComplaint' | 'ticket.typePraise' | 'ticket.typeOther'> = {
  suggest: 'ticket.typeSuggest',
  complaint: 'ticket.typeComplaint',
  praise: 'ticket.typePraise',
  other: 'ticket.typeOther',
}

export default function TicketListPage() {
  const { trpc } = usePhiliaClient()
  const ticketsQ = useQuery({
    queryKey: ['serviceLoop', 'ticketListMine'],
    queryFn: () => trpc.serviceLoop.ticketListMine.query(),
  })

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），固定返回「我的」页 */}
      <PageHeader title={sl('ticket.listTitle')} fallback="/me" className="pt-6" />

      <div className="mt-4">
        {ticketsQ.isPending ? <LoadingBlock lines={3} /> : null}
        {ticketsQ.isError ? (
          <ErrorState message={sl('ticket.loadFail')} onRetry={() => void ticketsQ.refetch()} />
        ) : null}
        {ticketsQ.data && ticketsQ.data.length === 0 ? (
          <EmptyState
            title={sl('ticket.emptyTitle')}
            desc={sl('ticket.emptyBody')}
            action={
              /* §4.11 空态出口钮=深棕墨底淡字 */
              <Link
                to="/support/new"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('ticket.emptyCta')}
              </Link>
            }
          />
        ) : null}
      </div>

      {ticketsQ.data && ticketsQ.data.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3" data-testid="ticket-list">
          {ticketsQ.data.map((t) => {
            const meta = STATUS_META[t.status] ?? STATUS_META.submitted!
            return (
              <li key={t.id}>
                <Link
                  to={`/support/${t.id}`}
                  data-testid={`ticket-item-${t.id}`}
                  className="u1-card block px-4 py-3.5 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold">{sl(TYPE_LABEL[t.type] ?? 'ticket.typeOther')}</span>
                    <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
                      {sl(meta.key)}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-caption text-ink-secondary">{t.description}</span>
                  <span className="u1-num mt-1.5 block text-caption-xs text-ink-placeholder">
                    {t.ticketNo} · {fmtDateTime(t.createdAt)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
