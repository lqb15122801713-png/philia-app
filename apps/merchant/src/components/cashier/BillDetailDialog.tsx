/**
 * 收银单详情弹层（批次 M1 · 流水屏详情 › 数据源 cashier.getBill）
 *
 * - u3-field 工艺字段行：状态/买家/开单人/优惠/备注/创建/挂单/结账/撤单轨迹；
 * - 完整行项（名+规格+数量+有效价；扣次薄荷签 / 改价划线留痕 / 库存不足红签）；
 * - 支付明细（方式四分列标签 + 金额 + 时间）；
 * - open/held 单给撤单入口（P8 弹层在父层）；settled 单无撤单入口（退款专项冻结）。
 */

import { usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { fmtDateTime } from '@/components/mall-admin/format'
import { CashierModal, SheetBtn } from './dialogs'
import {
  BILL_STATUS_CHIP,
  fenToYuan,
  BILL_DETAIL_KEY,
  PAY_METHOD_LABEL,
} from './model'

export default function BillDetailDialog({
  billNo,
  isOwner,
  onVoid,
  onClose,
}: {
  billNo: string | null
  isOwner: boolean
  /** 打开 P8 撤单弹层（父层持有 VoidDialog） */
  onVoid: (bill: { billNo: string; buyerName: string; payableFen: number; status: string }) => void
  onClose: () => void
}) {
  const { trpc } = usePhiliaClient()
  const detailQ = useQuery({
    queryKey: ['cashier', BILL_DETAIL_KEY, billNo],
    queryFn: () => trpc.cashier.getBill.query({ billNo: billNo! }),
    enabled: billNo !== null,
  })

  const d = detailQ.data
  const bill = d?.bill
  const st = bill ? (BILL_STATUS_CHIP[bill.status] ?? { cls: 'u3-st wait', label: bill.status }) : null
  const voidable = bill != null && (bill.status === 'open' || bill.status === 'held')

  return (
    <CashierModal
      open={billNo !== null}
      onClose={onClose}
      title="单据详情"
      testid="cashier-bill-detail"
      footer={
        <>
          {voidable ? (
            <span className="mr-auto flex items-center gap-2">
              <SheetBtn
                variant="danger-outline"
                data-testid="cashier-detail-void"
                disabled={!isOwner}
                title={isOwner ? '撤单（留痕）' : '仅店主可撤单'}
                onClick={() =>
                  onVoid({
                    billNo: bill!.billNo,
                    buyerName: d!.buyerName,
                    payableFen: bill!.payableFen,
                    status: bill!.status,
                  })
                }
              >
                撤单
              </SheetBtn>
              {!isOwner ? (
                <span className="text-caption-xs text-[rgba(74,59,46,.42)]">仅店主可撤单</span>
              ) : null}
            </span>
          ) : null}
          <SheetBtn onClick={onClose}>关闭</SheetBtn>
        </>
      }
    >
      {detailQ.isPending ? (
        <div className="space-y-2 py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
          ))}
        </div>
      ) : detailQ.isError || !d || !bill ? (
        <p className="py-6 text-center text-caption text-[rgba(74,59,46,.62)]">单据加载失败</p>
      ) : (
        <div>
          {/* 行项 */}
          <div className="rounded-[14px] bg-[#F6F1E3] px-3.5 py-2">
            {d.items.map((it) => {
              const eff = it.adjustedPriceFen ?? it.unitPriceFen
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-2 border-b border-dashed border-[rgba(74,59,46,.09)] py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-caption font-semibold">
                      {it.nameSnapshot}
                      {it.paidByPass ? (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-[#7FD8BE] px-2 py-[2px] text-caption-xs leading-none text-[#1E4D3D]">
                          扣次
                        </span>
                      ) : null}
                      {it.stockShort ? (
                        <span className="ml-1.5 inline-flex items-center rounded-[6px] bg-danger-light px-1.5 py-[2px] text-caption-xs leading-none text-danger-deep">
                          库存不足
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                      {it.kind === 'appointment' ? '预约行' : it.kind === 'service' ? '服务' : '商品'}
                      {it.specSnapshot ? ` · ${it.specSnapshot}` : ''} · × {it.qty}
                    </div>
                  </div>
                  <span className="font-number text-caption font-semibold tabular-nums">
                    ¥{fenToYuan(eff * it.qty)}
                    {it.adjustedPriceFen != null ? (
                      <span className="ml-1 text-caption-xs font-normal text-[rgba(74,59,46,.3)] line-through">
                        ¥{fenToYuan(it.unitPriceFen * it.qty)}
                      </span>
                    ) : null}
                  </span>
                </div>
              )
            })}
            <div className="flex justify-between py-2 text-caption text-[rgba(74,59,46,.62)]">
              <span>合计</span>
              <b className="font-number font-semibold tabular-nums text-ink">¥{fenToYuan(bill.subtotalFen)}</b>
            </div>
            {bill.discountFen > 0 ? (
              <div className="flex justify-between py-1 text-caption text-[rgba(74,59,46,.62)]">
                <span>
                  整单优惠（{bill.discountType === 'percent' ? `${bill.discountValue / 10} 折` : '立减'}）
                </span>
                <b className="font-number font-semibold tabular-nums text-ink">−¥{fenToYuan(bill.discountFen)}</b>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-dashed border-[rgba(74,59,46,.12)] py-2">
              <span className="text-body-sm font-semibold">应收</span>
              <b className="font-number text-title font-bold tabular-nums">¥{fenToYuan(bill.payableFen)}</b>
            </div>
          </div>

          {/* 支付明细 */}
          {d.payments.length > 0 ? (
            <div className="mt-3">
              <div className="mb-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">支付明细</div>
              {d.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 text-caption">
                  <span>{PAY_METHOD_LABEL[p.method] ?? p.method}</span>
                  <span className="text-[rgba(74,59,46,.42)]">
                    {fmtDateTime(p.createdAt)}
                    <b className="ml-2 font-number font-semibold tabular-nums text-ink">
                      ¥{fenToYuan(p.amountFen)}
                    </b>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {/* 字段行（u3-field 工艺） */}
          <div className="mt-3">
            <div className="u3-field">
              <span className="lb">状态</span>
              <span className="vl">
                <span className={st!.cls}>{st!.label}</span>
              </span>
            </div>
            <div className="u3-field">
              <span className="lb">买家</span>
              <span className="vl">
                {d.buyerName}
                {d.customerPhoneMasked ? (
                  <span className="ml-1.5 font-number text-caption-xs tabular-nums text-[rgba(74,59,46,.42)]">
                    {d.customerPhoneMasked}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="u3-field">
              <span className="lb">开单人</span>
              <span className="vl">{d.createdByName ?? '—'}</span>
            </div>
            <div className="u3-field">
              <span className="lb">创建</span>
              <span className="vl font-number tabular-nums">{fmtDateTime(bill.createdAt)}</span>
            </div>
            {bill.heldAt ? (
              <div className="u3-field">
                <span className="lb">挂单</span>
                <span className="vl font-number tabular-nums">{fmtDateTime(bill.heldAt)}</span>
              </div>
            ) : null}
            {bill.settledAt ? (
              <div className="u3-field">
                <span className="lb">结账</span>
                <span className="vl font-number tabular-nums">{fmtDateTime(bill.settledAt)}</span>
              </div>
            ) : null}
            {bill.voidedAt ? (
              <div className="u3-field">
                <span className="lb">撤单</span>
                <span className="vl">
                  <span className="font-number tabular-nums">{fmtDateTime(bill.voidedAt)}</span>
                  {bill.voidReason ? (
                    <span className="ml-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">原因：{bill.voidReason}</span>
                  ) : null}
                </span>
              </div>
            ) : null}
            {bill.note ? (
              <div className="u3-field">
                <span className="lb">备注</span>
                <span className="vl">{bill.note}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </CashierModal>
  )
}
