/**
 * 小票版式页 /cashier/receipt/:billNo（片 3 · 打印+补打同路由）
 * 数据源 cashier.getBill；门店名 auth.me（既有模式）；打印=window.print()，
 * @media print 内联（隐藏按钮/页壳，窄版 80mm 风）；PaySheet 成交态与
 * BillDetailDialog「补打」均跳本页。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { fenToYuan, fmtDateTime } from '@/components/mall-admin/format'
import { cc } from '@/copy/cashier'
import { BILL_DETAIL_KEY, PAY_METHOD_LABEL } from '@/components/cashier/model'

export default function ReceiptPage() {
  const { trpc } = usePhiliaClient()
  const { billNo } = useParams<{ billNo: string }>()

  const detailQ = useQuery({
    queryKey: ['cashier', BILL_DETAIL_KEY, billNo],
    queryFn: () => trpc.cashier.getBill.query({ billNo: billNo! }),
    enabled: !!billNo,
  })
  /** 门店名（auth.me 完整行，照 BoardingPage/SettingsPage 既有模式） */
  const meQ = useQuery({ queryKey: ['auth', 'me', 'full'], queryFn: () => trpc.auth.me.query() })

  const d = detailQ.data
  const bill = d?.bill
  const storeName = meQ.data?.store?.name ?? ''

  return (
    <div className="flex min-h-full flex-col items-center px-4 py-6" data-testid="receipt-page">
      {/* 打印样式内联（不加新 css 文件）：屏外全隐、仅小票可见，窄版 80mm 风 */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-sheet, #receipt-sheet * { visibility: visible; }
          #receipt-sheet {
            position: absolute; left: 0; top: 0;
            width: 72mm; margin: 0; padding: 0;
            box-shadow: none !important; border-radius: 0 !important;
            font-size: 11px;
          }
        }
      `}</style>

      <div className="receipt-no-print mb-3 flex items-center gap-2">
        <button
          type="button"
          data-testid="receipt-print-btn"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          <Printer size={14} strokeWidth={2} aria-hidden />
          {cc('cashier.receiptPrint')}
        </button>
      </div>

      {detailQ.isPending ? (
        <div className="w-full max-w-[320px] space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : detailQ.isError || !d || !bill ? (
        <p className="py-10 text-center text-caption text-[rgba(59,46,36,.62)]">单据加载失败</p>
      ) : (
        <div
          id="receipt-sheet"
          className="w-full max-w-[320px] rounded-[16px] bg-[#FFFDF6] px-4 py-5 shadow-[0_0_0_1px_rgba(59,46,36,.09)]"
        >
          {/* 头：门店名 / 小票题 / 单号 / 时刻 / 开单人 / 买家 */}
          <div className="text-center">
            <div className="text-body-sm font-bold">{storeName}</div>
            <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">{cc('cashier.receiptTitle')}</div>
          </div>
          <div className="mt-3 border-t border-dashed border-[rgba(59,46,36,.18)] pt-2 text-caption-xs text-[rgba(59,46,36,.62)]">
            <div className="flex justify-between">
              <span>单号</span>
              <span className="font-number tabular-nums text-ink">{bill.billNo}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>时刻</span>
              <span className="font-number tabular-nums text-ink">{fmtDateTime(bill.settledAt ?? bill.createdAt)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>开单人</span>
              <span className="text-ink">{d.createdByName ?? '—'}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>买家</span>
              <span className="text-ink">{d.buyerName}</span>
            </div>
          </div>

          {/* 行项：名+规格+数量+单价+改价划线+单品备注+寄养按晚明细 */}
          <div className="mt-2 border-t border-dashed border-[rgba(59,46,36,.18)] pt-2">
            {d.items.map((it) => {
              const eff = it.adjustedPriceFen ?? it.unitPriceFen
              /* 寄养（boarding）预约行附按晚明细（server 仅该变体透出 nightBreakdown） */
              const nb = 'nightBreakdown' in it ? it.nightBreakdown : null
              return (
                <div key={it.id} className="py-1.5 text-caption-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 flex-1 font-semibold text-ink">{it.nameSnapshot}</span>
                    <span className="shrink-0 font-number font-semibold tabular-nums text-ink">
                      ¥{fenToYuan(eff * it.qty)}
                      {it.adjustedPriceFen != null ? (
                        <span className="ml-1 font-normal text-[rgba(59,46,36,.3)] line-through">
                          ¥{fenToYuan(it.unitPriceFen * it.qty)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-0.5 font-number tabular-nums text-[rgba(59,46,36,.42)]">
                    {it.specSnapshot ? `${it.specSnapshot} · ` : ''}× {it.qty} · 单价 ¥{fenToYuan(eff)}
                  </div>
                  {nb ? (
                    <div className="mt-0.5 font-number tabular-nums text-[rgba(59,46,36,.42)]">
                      {cc('cashier.receiptNightLine', {
                        total: nb.totalNights,
                        occ: nb.occurredNights,
                        rem: nb.remainingNights,
                        per: fenToYuan(nb.perNightFen),
                      })}
                    </div>
                  ) : null}
                  {it.note ? (
                    <div className="mt-0.5 text-[rgba(59,46,36,.55)]">备注：{it.note}</div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* 金额：合计 / 单级优惠 / 抹零 / 应收 */}
          <div className="mt-2 border-t border-dashed border-[rgba(59,46,36,.18)] pt-2 text-caption-xs">
            <div className="flex justify-between py-0.5 text-[rgba(59,46,36,.62)]">
              <span>合计</span>
              <b className="font-number tabular-nums text-ink">¥{fenToYuan(bill.subtotalFen)}</b>
            </div>
            {bill.discountFen !== 0 ? (
              <div className="flex justify-between py-0.5 text-[rgba(59,46,36,.62)]">
                <span>整单优惠</span>
                <b className="font-number tabular-nums text-ink">−¥{fenToYuan(bill.discountFen)}</b>
              </div>
            ) : null}
            {bill.roundingFen > 0 ? (
              <div className="flex justify-between py-0.5 text-[rgba(59,46,36,.62)]">
                <span>{cc('cashier.roundingLabel')}</span>
                <b className="font-number tabular-nums text-ink">−¥{fenToYuan(bill.roundingFen)}</b>
              </div>
            ) : null}
            <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-[rgba(59,46,36,.18)] pt-1.5">
              <span className="text-caption font-semibold">应收</span>
              <b className="font-number text-title font-bold tabular-nums">¥{fenToYuan(bill.payableFen)}</b>
            </div>
          </div>

          {/* 支付段分列 */}
          {d.payments.length > 0 ? (
            <div className="mt-2 border-t border-dashed border-[rgba(59,46,36,.18)] pt-2 text-caption-xs">
              {d.payments.map((p) => (
                <div key={p.id} className="flex justify-between py-0.5 text-[rgba(59,46,36,.62)]">
                  <span>{PAY_METHOD_LABEL[p.method] ?? p.method}</span>
                  <b className="font-number tabular-nums text-ink">¥{fenToYuan(p.amountFen)}</b>
                </div>
              ))}
            </div>
          ) : null}

          {/* 单级备注 + 尾注 */}
          {bill.note ? (
            <div className="mt-2 border-t border-dashed border-[rgba(59,46,36,.18)] pt-2 text-caption-xs text-[rgba(59,46,36,.62)]">
              备注：{bill.note}
            </div>
          ) : null}
          <div className="mt-3 text-center text-caption-xs text-[rgba(59,46,36,.42)]">
            {cc('cashier.receiptThanks')}
          </div>
        </div>
      )}
    </div>
  )
}
