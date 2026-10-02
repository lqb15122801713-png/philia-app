/**
 * InvoiceListPage · /invoices 我的发票申请（补缺大批片 4）
 *
 * - 数据：serviceLoop.invoiceListMine（本人申请，创建倒序，上限 50）；
 * - 行=状态 pill（申请中/已开具）+ 申请单号 mono + 来源单号/类型 + 金额 mono + 时刻；
 * - 空态三句话（出口=我的预约 /appointments）。
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fenToYuan, fmtDateTime } from '@/components/booking/format'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

/** 状态 pill（申请中=淡金 / 已开具=卡其浅底；反馈件不设绿） */
const STATUS_META: Record<string, { key: ServiceLoopCopyKey; pill: string }> = {
  submitted: { key: 'inv.statusSubmitted', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  issued: { key: 'inv.statusIssued', pill: 'bg-brand-secondary-light text-ink' },
}

const KIND_LABEL: Record<string, ServiceLoopCopyKey> = {
  appointment: 'inv.kindAppointment',
  order: 'inv.kindOrder',
  cashier: 'inv.kindCashier',
}

export default function InvoiceListPage() {
  const { trpc } = usePhiliaClient()
  const invoicesQ = useQuery({
    queryKey: ['serviceLoop', 'invoiceListMine'],
    queryFn: () => trpc.serviceLoop.invoiceListMine.query(),
  })

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），固定返回「我的」页 */}
      <PageHeader title={sl('inv.listTitle')} fallback="/me" className="pt-6" />

      <div className="mt-4">
        {invoicesQ.isPending ? <LoadingBlock lines={3} /> : null}
        {invoicesQ.isError ? (
          <ErrorState message={sl('inv.loadFail')} onRetry={() => void invoicesQ.refetch()} />
        ) : null}
        {invoicesQ.data && invoicesQ.data.length === 0 ? (
          <EmptyState
            title={sl('inv.emptyTitle')}
            desc={sl('inv.emptyBody')}
            action={
              /* §4.11 空态出口钮=深棕墨底淡字 */
              <Link
                to="/appointments"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('inv.emptyCta')}
              </Link>
            }
          />
        ) : null}
      </div>

      {invoicesQ.data && invoicesQ.data.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3" data-testid="invoice-list">
          {invoicesQ.data.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.submitted!
            return (
              <li key={r.id}>
                <Link
                  to={`/invoices/${r.id}`}
                  data-testid={`invoice-item-${r.id}`}
                  className="u1-card block px-4 py-3.5 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold">{sl(KIND_LABEL[r.orderKind] ?? 'inv.kindOrder')}</span>
                    <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
                      {sl(meta.key)}
                    </span>
                  </span>
                  <span className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="u1-num text-caption text-ink-secondary">{r.billNo}</span>
                    <span className="u1-num text-body-sm font-bold text-ink">{fenToYuan(r.amountFen)}</span>
                  </span>
                  <span className="u1-num mt-1.5 block text-caption-xs text-ink-placeholder">
                    {r.invoiceNo} · {fmtDateTime(r.createdAt)}
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
