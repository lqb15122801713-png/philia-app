/**
 * InvoiceApplyPage · /invoice/apply/:kind/:id 发票申请（补缺大批片 4）
 *
 * - kind=appointment|order|cashier；原单摘要读页面既有数据源：
 *   appointment → appointment.get（单号 code / 店 d.store.name / 实付 paidFen）；
 *   order → mall.listMyOrders 全组按 id 匹配（orderNo / storeName / totalFen）；
 *   cashier → 客户端无收银单读口（R10 诚实口径：不画假摘要，明示到店办理+出口）；
 * - 表单：抬头类型（个人/企业）+ 抬头 + 税号（企业才显+必填+R13 解释句）+ 送达方式
 *   （邮箱 input email 校验 / 到店自取）；
 * - R15 金额明面句「开票金额=订单实付 {amount}」（金额=来源单实付，server 重算为准）
 *   + 诚实口径「提交后门店为您开具」；
 * - 提交 → serviceLoop.invoiceCreate（同单在途幂等返回原单）→ /invoices/:id。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { friendlyError, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fenToYuan } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { sl } from '@/copy/serviceloop'

/** 与 server invoiceCreate 同款的邮箱格式校验（提交前客户端先拦一次） */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type OrderKind = 'appointment' | 'order' | 'cashier'

interface BillSummary {
  billNo: string
  storeName: string | null
  amountFen: number
}

export default function InvoiceApplyPage() {
  const { kind = '', id = '' } = useParams()
  const navigate = useNavigate()
  const { trpc, queryClient } = usePhiliaClient()

  const orderKind: OrderKind | null =
    kind === 'appointment' || kind === 'order' || kind === 'cashier' ? kind : null

  /* ---- 原单摘要：读页面既有数据源（不另造读口） ---- */
  const apptQ = useQuery({
    queryKey: ['appointment', 'get', id],
    queryFn: () => trpc.appointment.get.query({ appointmentId: id }),
    enabled: orderKind === 'appointment' && id.length > 0,
  })
  const ordersQ = useQuery({
    queryKey: ['mall', 'listMyOrders'],
    queryFn: () => trpc.mall.listMyOrders.query(),
    enabled: orderKind === 'order',
  })

  const [titleType, setTitleType] = useState<'personal' | 'business'>('personal')
  const [title, setTitle] = useState('')
  const [taxNo, setTaxNo] = useState('')
  const [delivery, setDelivery] = useState<'email' | 'pickup'>('email')
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const summaryQ = orderKind === 'appointment' ? apptQ : orderKind === 'order' ? ordersQ : null
  let summary: BillSummary | null = null
  if (orderKind === 'appointment' && apptQ.data) {
    const appt = apptQ.data.appointment
    summary = {
      billNo: appt.code,
      storeName: apptQ.data.store?.name ?? null,
      amountFen: appt.paidFen ?? 0,
    }
  } else if (orderKind === 'order' && ordersQ.data) {
    const groups = ordersQ.data.groups as unknown as Record<string, Array<{
      id: string
      orderNo: string
      totalFen: number
      storeName: string | null
    }>>
    const order = Object.values(groups).flat().find((o) => o.id === id)
    if (order) summary = { billNo: order.orderNo, storeName: order.storeName ?? null, amountFen: order.totalFen }
  }

  const createM = useMutation({
    mutationFn: () =>
      trpc.serviceLoop.invoiceCreate.mutate({
        orderKind: orderKind!,
        billId: id,
        titleType,
        title: title.trim(),
        taxNo: titleType === 'business' ? taxNo.trim() : undefined,
        delivery,
        email: delivery === 'email' ? email.trim() : undefined,
      }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['serviceLoop', 'invoiceListMine'] })
      navigate(`/invoices/${r.request.id}`, { replace: true })
    },
    onError: (err) => {
      setFormError(friendlyError(err, sl('inv.submitFail')))
    },
  })

  const onSubmit = () => {
    setFormError(null)
    if (!title.trim()) {
      setFormError(sl('inv.titleRequired'))
      return
    }
    if (titleType === 'business' && !taxNo.trim()) {
      // R13 解释句：企业抬头按税务规定须填税号
      setFormError(sl('inv.taxNoRequired'))
      return
    }
    if (delivery === 'email' && !EMAIL_RE.test(email.trim())) {
      setFormError(sl('inv.emailInvalid'))
      return
    }
    createM.mutate()
  }

  const inputCls =
    'w-full rounded-control border border-line bg-card px-3 py-2.5 text-body-sm outline-none transition-colors focus:border-brand-primary'
  const labelCls = 'mb-1 block text-caption text-ink-secondary'
  const radioCls = (on: boolean) =>
    `min-h-[44px] flex-1 rounded-full border px-3 py-2 text-body-sm transition-colors ${
      on
        ? 'border-brand-primary bg-brand-primary-light font-semibold text-brand-primary-pressed'
        : 'border-line bg-card text-ink-secondary'
    }`

  const kindLabel =
    orderKind === 'appointment'
      ? sl('inv.kindAppointment')
      : orderKind === 'order'
        ? sl('inv.kindOrder')
        : sl('inv.kindCashier')

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），固定返回发票列表 */}
      <PageHeader title={sl('inv.applyTitle')} fallback="/invoices" className="pt-6" />

      <div className="mt-4">
        {orderKind === null || orderKind === 'cashier' ? (
          /* R10 诚实口径：cashier 单客户端无读口（退款详情页入口=片 1 未合），不画假摘要 */
          <ErrorState
            message={sl('inv.cashierUnsupported')}
            action={
              <Link
                to="/invoices"
                className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('inv.backList')}
              </Link>
            }
          />
        ) : summaryQ?.isPending ? (
          <LoadingBlock lines={3} />
        ) : summaryQ?.isError || !summary ? (
          <ErrorState
            message={sl('inv.billNotFound')}
            onRetry={() => void summaryQ?.refetch()}
            action={
              <Link
                to="/invoices"
                className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('inv.backList')}
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-3" data-testid="invoice-form">
            {/* 原单摘要（单号/店/实付金额 mono——读页面既有数据） */}
            <section className="u1-card p-4">
              <p className="text-body-sm font-semibold">{sl('inv.billSummaryTitle')} · {kindLabel}</p>
              <dl className="mt-2 space-y-1.5 text-body-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-secondary">{sl('inv.billNo')}</dt>
                  <dd className="font-number">{summary.billNo}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-secondary">{sl('inv.store')}</dt>
                  <dd>{summary.storeName ?? '—'}</dd>
                </div>
              </dl>
              {/* R15 金额明面句 */}
              <p className="u1-num mt-2 rounded-tag bg-sunken px-3 py-2 text-caption text-ink" data-testid="invoice-amount-line">
                {sl('inv.amountLine', { amount: fenToYuan(summary.amountFen) })}
              </p>
            </section>

            {/* 抬头类型 + 抬头 + 税号（企业条件必填） */}
            <section className="u1-card p-4">
              <span className={labelCls}>{sl('inv.titleTypeLabel')}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="invoice-title-personal"
                  onClick={() => setTitleType('personal')}
                  className={radioCls(titleType === 'personal')}
                >
                  {sl('inv.titlePersonal')}
                </button>
                <button
                  type="button"
                  data-testid="invoice-title-business"
                  onClick={() => setTitleType('business')}
                  className={radioCls(titleType === 'business')}
                >
                  {sl('inv.titleBusiness')}
                </button>
              </div>
              <div className="mt-3">
                <label className={labelCls} htmlFor="invoice-title">{sl('inv.titleLabel')}</label>
                <input
                  id="invoice-title"
                  className={inputCls}
                  maxLength={100}
                  placeholder={titleType === 'business' ? sl('inv.titlePlaceholderBusiness') : sl('inv.titlePlaceholderPersonal')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              {titleType === 'business' ? (
                <div className="mt-3">
                  <label className={labelCls} htmlFor="invoice-taxno">{sl('inv.taxNoLabel')}</label>
                  <input
                    id="invoice-taxno"
                    className={inputCls}
                    maxLength={30}
                    placeholder={sl('inv.taxNoPlaceholder')}
                    value={taxNo}
                    onChange={(e) => setTaxNo(e.target.value)}
                  />
                  {/* R13 解释句 */}
                  <p className="mt-1 text-caption-xs text-ink-placeholder">{sl('inv.taxNoRequired')}</p>
                </div>
              ) : null}
            </section>

            {/* 送达方式（邮箱 / 到店自取） */}
            <section className="u1-card p-4">
              <span className={labelCls}>{sl('inv.deliveryLabel')}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="invoice-delivery-email"
                  onClick={() => setDelivery('email')}
                  className={radioCls(delivery === 'email')}
                >
                  {sl('inv.deliveryEmail')}
                </button>
                <button
                  type="button"
                  data-testid="invoice-delivery-pickup"
                  onClick={() => setDelivery('pickup')}
                  className={radioCls(delivery === 'pickup')}
                >
                  {sl('inv.deliveryPickup')}
                </button>
              </div>
              {delivery === 'email' ? (
                <div className="mt-3">
                  <label className={labelCls} htmlFor="invoice-email">{sl('inv.emailLabel')}</label>
                  <input
                    id="invoice-email"
                    type="email"
                    className={inputCls}
                    maxLength={100}
                    placeholder={sl('inv.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              ) : null}
            </section>

            {formError ? <p className="text-caption text-danger-deep">{formError}</p> : null}

            {/* 诚实口径 + 提交 */}
            <p className="text-center text-caption text-ink-secondary">{sl('inv.honestLine')}</p>
            <button
              type="button"
              data-testid="invoice-submit"
              disabled={createM.isPending}
              onClick={onSubmit}
              className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
            >
              {createM.isPending ? sl('inv.submitting') : sl('inv.submit')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
