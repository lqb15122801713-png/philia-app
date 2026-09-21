/**
 * 收银单详情弹层（批次 M1 · 流水屏详情 › 数据源 cashier.getBill）
 *
 * - u3-field 工艺字段行：状态/买家/开单人/优惠/备注/创建/挂单/结账/撤单轨迹；
 * - 完整行项（名+规格+数量+有效价；扣次薄荷签 / 改价划线留痕 / 库存不足红签）；
 * - 支付明细（方式五分列标签 + 金额 + 时间；次卡/储值单列不计已收口径小字）；
 * - M1-补2 D（反结账双件之一 · 收银台反结账单）：
 *   - open/held 单：撤单入口（补丁①1 三级全开，边界=仅未支付单）；
 *   - settled 未被冲正：owner 见「反结账」钮（强制原因弹层在父层）；
 *   - R12：settled 未冲正未撤且 refundStatus!=='refunded' + owner|manager 见「退款」钮 →
 *     真退款弹层（RefundDialog 六联动预览+重确认 D 套，在父层）；已全额退款单不渲染（V5 终态禁退 UI 层）；
 *   - 退款标记：refundStatus 单显灰签+「退款 ¥X」红字标签+关联退款单号（双向可查，
 *     点开见 refund_bills 详情——RefundDetailDialog 在父层）；
 *   - settled 已冲正（reversedAt）：灰签「已冲正」+ 冲正单号（双向可查）；
 *   - reversal 冲正单：签 + 关联原单号 + 「不计入已收」口径行；永驻流水无动作。
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
import { sumPostedRefunds, type RefundListRow } from './refund'

export default function BillDetailDialog({
  billNo,
  isOwner,
  canManage,
  refundRows,
  onVoid,
  onReverse,
  onRefund,
  onShowRefund,
  onClose,
}: {
  billNo: string | null
  /** 仅店主：反结账入口（收银台已支付单冲正） */
  isOwner: boolean
  /** owner|manager：退款入口可见（R12 真退款；clerk 无该入口） */
  canManage: boolean
  /** R12：本单的已落账退款行（refund.list 按 billId 归并，父层传入；空窗期为空数组） */
  refundRows: RefundListRow[]
  /** 打开撤单弹层（父层持有 VoidDialog） */
  onVoid: (bill: { billNo: string; buyerName: string; payableFen: number; status: string }) => void
  /** 打开反结账原因弹层（父层持有 ReverseDialog） */
  onReverse: (bill: { billNo: string; buyerName: string; payableFen: number }) => void
  /** 打开退款弹层（父层持有 RefundDialog；R12 真链路六联动） */
  onRefund: (billNo: string) => void
  /** 点开退款单号看 refund_bills 详情（父层持有 RefundDetailDialog） */
  onShowRefund: (row: RefundListRow) => void
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
  const isReversal = bill?.status === 'reversal'
  const reversed = bill?.reversedAt != null
  const st = bill
    ? reversed && bill.status === 'settled'
      ? { cls: 'u3-st done', label: '已冲正' }
      : (BILL_STATUS_CHIP[bill.status] ?? { cls: 'u3-st wait', label: bill.status })
    : null
  const voidable = bill != null && (bill.status === 'open' || bill.status === 'held')
  /** 反结账入口：settled 且未被冲正 + 仅店主（矩阵；manager/clerk 无入口） */
  const reversible = bill != null && bill.status === 'settled' && !reversed && isOwner
  /** R12 退款入口：settled 且未冲正未撤 + refundStatus!=='refunded'（V5 终态禁退 UI 层）+
      owner|manager（clerk 不渲染）；阈值/涉储值由 server preview/execute 明文闸 */
  const refundVisible =
    bill != null && bill.status === 'settled' && !reversed && bill.refundStatus !== 'refunded' && canManage
  /** 已落账退款聚合（展示侧；金额真值以 refund_bills 为准） */
  const posted = bill ? sumPostedRefunds(refundRows, bill.id) : { totalFen: 0, rows: [] }

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
                title="撤单（留痕，仅未支付单）"
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
            </span>
          ) : null}
          {reversible ? (
            <SheetBtn
              variant="danger-outline"
              data-testid="cashier-detail-reverse"
              title="反结账（仅店主 · 强制原因留痕 · 生成冲正单）"
              onClick={() =>
                onReverse({ billNo: bill!.billNo, buyerName: d!.buyerName, payableFen: bill!.payableFen })
              }
            >
              反结账
            </SheetBtn>
          ) : null}
          {refundVisible ? (
            <SheetBtn
              data-testid="cashier-detail-refund"
              title="退款（R12：选类型→原因必填→六联动预览→重确认）"
              onClick={() => onRefund(bill!.billNo)}
            >
              退款
            </SheetBtn>
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
          {/* 冲正/被冲正横幅（双向可查 + 不计已收口径） */}
          {isReversal ? (
            <div className="mb-3 rounded-[10px] bg-[#F1E8D4] px-3 py-2 text-caption-xs text-[rgba(74,59,46,.62)]" data-testid="cashier-detail-reversal-banner">
              本单为冲正单 · 关联原单{' '}
              <b className="font-number tabular-nums text-ink">{bill.reversalOfBillNo ?? '—'}</b>
              {' · 金额镜像负值，不计入已收'}
            </div>
          ) : null}
          {reversed ? (
            <div className="mb-3 rounded-[10px] bg-[rgba(74,59,46,.06)] px-3 py-2 text-caption-xs text-[rgba(74,59,46,.62)]" data-testid="cashier-detail-reversed-banner">
              本单已被反结账冲正 · 冲正单{' '}
              <b className="font-number tabular-nums text-ink">{bill.reversalBillNo ?? '—'}</b>
              {' · 不再计入已收（原单永存不涂改）'}
            </div>
          ) : null}

          {/* R12 退款横幅：灰签+「退款 ¥X」红字标签+关联退款单号（双向可查，点开见 refund_bills 详情） */}
          {bill.refundStatus ? (
            <div className="mb-3 rounded-[10px] bg-[rgba(74,59,46,.06)] px-3 py-2 text-caption-xs" data-testid="cashier-detail-refund-banner">
              <span className="u3-st done">{bill.refundStatus === 'refunded' ? '已退款' : '部分退款'}</span>
              {posted.rows.length > 0 ? (
                <>
                  <b className="ml-2 font-number tabular-nums text-danger-deep">
                    退款 ¥{fenToYuan(posted.totalFen)}
                  </b>
                  <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 align-middle">
                    {posted.rows.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        data-testid={`cashier-detail-refund-link-${r.refundNo}`}
                        title="查看退款单详情（refund_bills）"
                        onClick={() => onShowRefund(r)}
                        className="inline-flex min-h-[28px] items-center rounded-full bg-[#FFFDF6] px-2.5 font-number font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.95]"
                      >
                        {r.refundNo}
                      </button>
                    ))}
                  </span>
                </>
              ) : (
                <span className="ml-2 text-[rgba(74,59,46,.62)]">
                  退款单 <b className="font-number tabular-nums text-ink">{bill.refundBillNo ?? '—'}</b>
                  （详情见「退款」列表页）
                </span>
              )}
            </div>
          ) : null}

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
            {bill.discountFen !== 0 ? (
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

          {/* 支付明细（R6-1 五分列全显；次卡/储值单列不计已收） */}
          {d.payments.length > 0 ? (
            <div className="mt-3">
              <div className="mb-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">支付明细</div>
              {d.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 text-caption">
                  <span>
                    {PAY_METHOD_LABEL[p.method] ?? p.method}
                    {p.method === 'pass' || p.method === 'stored_value' ? (
                      <small className="ml-1 text-caption-xs text-[rgba(74,59,46,.42)]">（不计入已收）</small>
                    ) : null}
                  </span>
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
