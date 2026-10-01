/**
 * 发票申请待办块（补缺大批片 4 · DashboardPage 右栏 TodoSection 下方）
 *
 * - 数据：serviceLoop.invoiceListPending（本店 owner|manager，submitted 创建升序），
 *   查询/断线轮询兜底/重连全量在页面层统一（DashboardPage），本块纯渲染+操作；
 *   invoice.issued 为 user 频道（客户侧）事件，商家端无 store 频道推送——
 *   刷新靠重连全量 + 断线轮询兜底 + 本块操作后失效（不新增订阅，已报备）；
 * - 行：申请号（mono）+ 原单号 + 金额（mono）+ 抬头（类型签）+ 送达方式
 *   （邮箱地址 / 到店自取）+ 申请时刻；「登记开票」弹层（实际发票号 input 必填
 *   + R15 明面句「开票金额=订单实付 ¥{amount}」复述）→ invoiceRegister → toast + 失效；
 * - 空态不渲染区块；加载中骨架行（禁转圈）；失败给错误行 + 真重试。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/appointments/Modal'
import { errMsg, fmtDateTime, fenToYuanGrouped } from '@/components/mall-admin/format'
import { dc } from '@/copy/dashboard'
import { INVOICE_PENDING_QUERY_KEY, INVOICE_SECTION_ID, type InvoicePendingItem } from './utils'

/** 类型签 chip（u3 面板浅底工艺：sunken 底墨色字） */
const CHIP_CLS = 'rounded-md bg-sunken px-[7px] py-[2px] text-[11px] font-semibold text-ink'
/** 行内操作钮（QuietButton 同族缩小档） */
const ROW_BTN_CLS =
  'u1-ring shrink-0 rounded-full bg-card px-3.5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50'
/* 弹层按钮（ghost / 柠檬 primary，与 cashier SheetBtn 同工艺） */
const DIALOG_BTN_GHOST =
  'rounded-full bg-[#FFFDF6] px-4 py-2.5 text-caption text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50'
const DIALOG_BTN_PRIMARY =
  'rounded-full bg-brand-primary px-4 py-2.5 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50'

const titleTypeLabel = (t: string): string =>
  t === 'business' ? dc('dash.invoiceTitleBusiness') : dc('dash.invoiceTitlePersonal')

export default function InvoiceTodoSection({
  items,
  loading,
  error,
  onRetry,
}: {
  items: InvoicePendingItem[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  const [registerTarget, setRegisterTarget] = useState<InvoicePendingItem | null>(null)

  if (error) {
    return (
      <section className="u3-panel" id={INVOICE_SECTION_ID}>
        <div className="u3-panel-head">
          <h3>{dc('dash.invoiceBlockTitle')}</h3>
        </div>
        <div className="flex items-center justify-between px-[17px] py-3">
          <p className="text-[12px] text-[rgba(59,46,36,.62)]">{dc('dash.invoiceLoadFailed')}</p>
          <button type="button" className={ROW_BTN_CLS} onClick={onRetry} data-testid="invoice-todo-retry">
            {dc('dash.retry')}
          </button>
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="u3-panel" id={INVOICE_SECTION_ID}>
        <div className="u3-panel-head">
          <h3>{dc('dash.invoiceBlockTitle')}</h3>
        </div>
        <div className="space-y-2 px-[17px] pb-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </section>
    )
  }

  /* 空态不渲染区块 */
  if (!items || items.length === 0) return null

  return (
    <section className="u3-panel" id={INVOICE_SECTION_ID} data-testid="dash-invoice-section">
      <div className="u3-panel-head">
        <h3>{dc('dash.invoiceBlockTitle')}</h3>
        <span className="aside">
          <span className="font-number tabular-nums">{items.length}</span> 笔
        </span>
      </div>
      <div>
        {items.map((r) => (
          <div
            key={r.id}
            className="flex items-start gap-3 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3"
            data-testid={`invoice-todo-row-${r.invoiceNo}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-number text-caption font-semibold tabular-nums">{r.invoiceNo}</span>
                <span className={CHIP_CLS}>{titleTypeLabel(r.titleType)}</span>
                <span className="ml-auto font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.42)]">
                  {fmtDateTime(r.createdAt)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2 text-caption-xs text-[rgba(59,46,36,.62)]">
                <span className="truncate">
                  {dc('dash.invoiceBillLead')} <span className="font-number tabular-nums">{r.billNo}</span>
                  {' · '}
                  {dc('dash.invoiceTitleLead')} {r.title}
                </span>
                <span className="ml-auto shrink-0 font-number text-caption font-bold tabular-nums text-ink">
                  ¥{fenToYuanGrouped(r.amountFen)}
                </span>
              </div>
              <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">
                {r.delivery === 'email'
                  ? `${dc('dash.invoiceDeliveryEmail')} ${r.email ?? ''}`
                  : dc('dash.invoiceDeliveryPickup')}
              </div>
            </div>
            <button
              type="button"
              className={ROW_BTN_CLS}
              data-testid={`invoice-register-open-${r.invoiceNo}`}
              onClick={() => setRegisterTarget(r)}
            >
              {dc('dash.invoiceRegisterCta')}
            </button>
          </div>
        ))}
      </div>
      <InvoiceRegisterDialog request={registerTarget} onClose={() => setRegisterTarget(null)} />
    </section>
  )
}

/** 登记开票弹层：实际发票号必填 + R15 明面句复述 → invoiceRegister → toast + 失效 */
function InvoiceRegisterDialog({
  request,
  onClose,
}: {
  request: InvoicePendingItem | null
  onClose: () => void
}) {
  const { trpc, queryClient } = usePhiliaClient()
  const [invoiceNo, setInvoiceNo] = useState('')

  const [lastId, setLastId] = useState<string | null>(null)
  if ((request?.id ?? null) !== lastId) {
    setLastId(request?.id ?? null)
    setInvoiceNo('')
  }

  const registerM = useMutation({
    mutationFn: (input: { requestId: string; invoiceNo: string }) =>
      trpc.serviceLoop.invoiceRegister.mutate(input),
    onSuccess: () => {
      if (request) toast.success(dc('dash.invoiceRegisterSuccess', { no: request.invoiceNo }))
      void queryClient.invalidateQueries({ queryKey: INVOICE_PENDING_QUERY_KEY })
      onClose()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const valid = invoiceNo.trim().length > 0

  return (
    <Modal
      open={request !== null}
      title={request ? dc('dash.invoiceRegisterTitle', { no: request.invoiceNo }) : ''}
      onClose={onClose}
    >
      {request ? (
        <div>
          {/* 申请摘要卡 */}
          <div className="rounded-[14px] bg-[#FAF8F2] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="font-number text-caption font-semibold tabular-nums">{request.invoiceNo}</span>
              <span className={CHIP_CLS}>{titleTypeLabel(request.titleType)}</span>
              <span className="ml-auto font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.42)]">
                {fmtDateTime(request.createdAt)}
              </span>
            </div>
            <div className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.62)]">
              {dc('dash.invoiceBillLead')} <span className="font-number tabular-nums">{request.billNo}</span>
              {' · '}
              {dc('dash.invoiceTitleLead')} {request.title}
              {request.taxNo ? (
                <>
                  {' · '}
                  {dc('dash.invoiceTaxNoLead')} <span className="font-number tabular-nums">{request.taxNo}</span>
                </>
              ) : null}
            </div>
            <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">
              {request.delivery === 'email'
                ? `${dc('dash.invoiceDeliveryEmail')} ${request.email ?? ''}`
                : dc('dash.invoiceDeliveryPickup')}
            </div>
          </div>

          {/* R15 明面句复述：开票金额=订单实付（金额=服务端按来源单实付重算） */}
          <p className="mt-3 rounded-[10px] bg-[#F1E8D4] px-3 py-2 text-caption-xs font-semibold text-[rgba(59,46,36,.75)]">
            {dc('dash.invoiceAmountNote', { amount: fenToYuanGrouped(request.amountFen) })}
          </p>

          <div className="mt-3 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
            {dc('dash.invoiceNoLabel')}
          </div>
          <input
            className="mt-1.5 w-full rounded-[14px] bg-[#FFFDF6] px-3 py-2 font-number text-body-sm font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:font-sans placeholder:font-normal placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)] disabled:opacity-50"
            data-testid="invoice-no-input"
            placeholder={dc('dash.invoiceNoPlaceholder')}
            maxLength={50}
            value={invoiceNo}
            disabled={registerM.isPending}
            onChange={(e) => setInvoiceNo(e.target.value)}
          />
          {!valid ? (
            <p className="mt-2 text-caption-xs font-semibold text-danger-deep">{dc('dash.invoiceNoRequired')}</p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={DIALOG_BTN_GHOST} disabled={registerM.isPending} onClick={onClose}>
              {dc('dash.cancel')}
            </button>
            <button
              type="button"
              className={DIALOG_BTN_PRIMARY}
              data-testid="invoice-register-submit"
              disabled={!valid || registerM.isPending}
              onClick={() => registerM.mutate({ requestId: request.id, invoiceNo: invoiceNo.trim() })}
            >
              {registerM.isPending ? dc('dash.invoiceRegistering') : dc('dash.invoiceRegisterSubmit')}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
