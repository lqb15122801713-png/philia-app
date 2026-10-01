/**
 * InvoiceDetailPage · /invoices/:id 发票申请详情（补缺大批片 4）
 *
 * - 数据：serviceLoop.invoiceGet（本人校验，他人 403 明文透出）；
 * - 件=表单回显（申请单号/来源单号/类型/金额 mono/抬头类型/抬头/税号/送达方式/邮箱）
 *   + 状态 pill（申请中/已开具）+ 申请时刻 mono；issued 态回显实际发票号
 *   issuedInvoiceNo + issuedAt mono（商家 register 登记真值）。
 */

import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { friendlyError, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fenToYuan, fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

const STATUS_META: Record<string, { key: ServiceLoopCopyKey; pill: string }> = {
  submitted: { key: 'inv.statusSubmitted', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  issued: { key: 'inv.statusIssued', pill: 'bg-brand-secondary-light text-ink' },
}

const KIND_LABEL: Record<string, ServiceLoopCopyKey> = {
  appointment: 'inv.kindAppointment',
  order: 'inv.kindOrder',
  cashier: 'inv.kindCashier',
}

export default function InvoiceDetailPage() {
  const { id = '' } = useParams()
  const { trpc } = usePhiliaClient()

  const invoiceQ = useQuery({
    queryKey: ['serviceLoop', 'invoiceGet', id],
    queryFn: () => trpc.serviceLoop.invoiceGet.query({ requestId: id }),
    enabled: id.length > 0,
  })

  const req = invoiceQ.data?.request ?? null
  const meta = req ? (STATUS_META[req.status] ?? STATUS_META.submitted!) : null

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），固定返回发票列表 */}
      <PageHeader title={sl('inv.detailTitle')} fallback="/invoices" className="pt-6" />

      <div className="mt-4">
        {invoiceQ.isPending ? <LoadingBlock lines={3} /> : null}
        {invoiceQ.isError ? (
          <ErrorState
            message={friendlyError(invoiceQ.error, sl('inv.loadFail'))}
            onRetry={() => void invoiceQ.refetch()}
            action={
              <Link
                to="/invoices"
                className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('inv.backList')}
              </Link>
            }
          />
        ) : null}
      </div>

      {req && meta ? (
        <section className="u1-card mt-4 p-4" data-testid="invoice-detail">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body-sm font-semibold">{sl(KIND_LABEL[req.orderKind] ?? 'inv.kindOrder')}</p>
            <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
              {sl(meta.key)}
            </span>
          </div>

          {/* 表单回显 */}
          <dl className="mt-3 space-y-1.5 border-t border-line-divider pt-3 text-body-sm">
            <div className="flex justify-between">
              <dt className="text-ink-secondary">{sl('inv.billNo')}</dt>
              <dd className="font-number">{req.billNo}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary">{sl('inv.amountLabel')}</dt>
              <dd className="font-number font-semibold text-ink">{fenToYuan(req.amountFen)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary">{sl('inv.titleTypeLabel')}</dt>
              <dd>{req.titleType === 'business' ? sl('inv.titleBusiness') : sl('inv.titlePersonal')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink-secondary">{sl('inv.titleLabel')}</dt>
              <dd className="text-right">{req.title}</dd>
            </div>
            {req.titleType === 'business' && req.taxNo ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary">{sl('inv.taxNoLabel')}</dt>
                <dd className="font-number">{req.taxNo}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-secondary">{sl('inv.deliveryLabel')}</dt>
              <dd>{req.delivery === 'email' ? sl('inv.deliveryEmail') : sl('inv.deliveryPickup')}</dd>
            </div>
            {req.delivery === 'email' && req.email ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary">{sl('inv.emailLabel')}</dt>
                <dd className="font-number">{req.email}</dd>
              </div>
            ) : null}
          </dl>

          {/* 已开具：实际发票号 + 开具时刻 mono 回显 */}
          {req.status === 'issued' && req.issuedInvoiceNo ? (
            <div className="mt-3 rounded-control bg-brand-secondary-light px-3.5 py-2.5" data-testid="invoice-issued-no">
              <p className="text-caption text-ink-secondary">{sl('inv.issuedNoLabel')}</p>
              <p className="u1-num mt-0.5 text-body-sm font-semibold text-ink">{req.issuedInvoiceNo}</p>
              {req.issuedAt ? (
                <p className="u1-num mt-1 text-caption-xs text-ink-placeholder">
                  {sl('inv.issuedAtLine', { time: fmtDateTime(req.issuedAt) })}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="u1-num mt-3 text-caption-xs text-ink-placeholder">
            {req.invoiceNo} · {sl('inv.appliedAt', { time: fmtDateTime(req.createdAt) })}
          </p>
        </section>
      ) : null}
    </div>
  )
}
