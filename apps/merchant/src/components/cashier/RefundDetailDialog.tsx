/**
 * R12 退款专项 · 退款单详情弹层（Phase 3）
 *
 * 数据源：refund.list 行（refund_bills 全列 + billNo/operatorName/approverName/
 * actualSettled）；六联动明细读 linkage_json 快照（execute 时落，draft 无快照）。
 * 双向可查：原单详情「退款 ¥X · RB-xxx」点开见本弹层；本弹层明示原单号。
 */

import { fmtDateTime, fenToYuan } from '@/components/mall-admin/format'
import { CashierModal, SheetBtn } from './dialogs'
import { PAY_METHOD_LABEL } from './model'
import {
  REFUND_METHOD_LABEL,
  REFUND_STATUS_CHIP,
  REFUND_TYPE_LABEL,
  SEG_CHANNEL_LABEL,
  parseLinkage,
  type RefundListRow,
  type RefundType,
} from './refund'

const bpText = (bp: number): string => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 1)}%`

export default function RefundDetailDialog({
  row,
  onClose,
}: {
  row: RefundListRow | null
  onClose: () => void
}) {
  if (!row) return null
  const st = REFUND_STATUS_CHIP[row.status] ?? { cls: 'u3-st wait', label: row.status }
  const link = parseLinkage(row.linkageJson)

  return (
    <CashierModal
      open={row !== null}
      onClose={onClose}
      title="退款单详情"
      testid="refund-detail-dialog"
      footer={<SheetBtn className="min-h-[44px]" onClick={onClose}>关闭</SheetBtn>}
    >
      <div>
        <div className="u3-field">
          <span className="lb">退款单号</span>
          <span className="vl font-number tabular-nums">{row.refundNo}</span>
        </div>
        <div className="u3-field">
          <span className="lb">原单号</span>
          <span className="vl font-number tabular-nums">{row.billNo}</span>
        </div>
        <div className="u3-field">
          <span className="lb">类型</span>
          <span className="vl">{REFUND_TYPE_LABEL[row.type as RefundType] ?? row.type}</span>
        </div>
        <div className="u3-field">
          <span className="lb">金额</span>
          <span className="vl font-number font-bold tabular-nums text-danger-deep">
            −¥{fenToYuan(row.amountFen)}
          </span>
        </div>
        <div className="u3-field">
          <span className="lb">状态</span>
          <span className="vl">
            <span className={st.cls}>{st.label}</span>
          </span>
        </div>
        <div className="u3-field">
          <span className="lb">原因</span>
          <span className="vl">{row.reason}</span>
        </div>
        {row.refundMethod ? (
          <div className="u3-field">
            <span className="lb">实退方式</span>
            <span className="vl">{REFUND_METHOD_LABEL[row.refundMethod] ?? row.refundMethod}</span>
          </div>
        ) : null}
        <div className="u3-field">
          <span className="lb">发起人</span>
          <span className="vl">{row.operatorName ?? '—'}</span>
        </div>
        <div className="u3-field">
          <span className="lb">审批人</span>
          <span className="vl">{row.approverName ?? '—'}</span>
        </div>
        <div className="u3-field">
          <span className="lb">退款日期</span>
          <span className="vl font-number tabular-nums">{row.bizDate}（计入当日日结）</span>
        </div>
        <div className="u3-field">
          <span className="lb">发起时间</span>
          <span className="vl font-number tabular-nums">{fmtDateTime(row.createdAt)}</span>
        </div>
        {row.settledAt ? (
          <div className="u3-field">
            <span className="lb">实退时间</span>
            <span className="vl font-number tabular-nums">{fmtDateTime(row.settledAt)}</span>
          </div>
        ) : null}
        {row.settleNote ? (
          <div className="u3-field">
            <span className="lb">{row.status === 'rejected' ? '驳回备注' : '实退备注'}</span>
            <span className="vl">{row.settleNote}</span>
          </div>
        ) : null}

        {/* 六联动快照（linkage_json；draft 无快照） */}
        {link ? (
          <div className="mt-3 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3" data-testid="refund-detail-linkage">
            <div className="mb-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">六联动快照</div>

            {link.segments && link.segments.length > 0 ? (
              <div className="mb-1.5">
                {link.segments.map((s, i) => (
                  <div key={s.paymentId ?? i} className="flex items-center justify-between py-0.5 text-caption-xs">
                    <span className="text-[rgba(74,59,46,.62)]">
                      {PAY_METHOD_LABEL[s.method] ?? s.method}
                      {s.ratioBp > 0 ? <span className="ml-1.5 font-number tabular-nums">占比 {bpText(s.ratioBp)}</span> : null}
                      <span className="ml-1.5">{SEG_CHANNEL_LABEL[s.channel] ?? s.channel}</span>
                    </span>
                    <b className="font-number tabular-nums text-ink">¥{fenToYuan(s.amountFen)}</b>
                  </div>
                ))}
              </div>
            ) : null}

            {link.items && link.items.length > 0 ? (
              <div className="mb-1.5 border-t border-dashed border-[rgba(74,59,46,.12)] pt-1.5">
                {link.items.map((it, i) => (
                  <div key={it.billItemId ?? i} className="flex justify-between py-0.5 text-caption-xs">
                    <span className="text-[rgba(74,59,46,.62)]">
                      {it.name}
                      {it.qty != null ? ` ×${it.qty}` : ''}
                      {it.apportioned ? '（按行分摊）' : ''}
                    </span>
                    <b className="font-number tabular-nums text-ink">¥{fenToYuan(it.amountFen)}</b>
                  </div>
                ))}
              </div>
            ) : null}

            {link.stockRestock && link.stockRestock.length > 0 ? (
              <div className="mb-1.5 border-t border-dashed border-[rgba(74,59,46,.12)] pt-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                库存回补：{link.stockRestock.map((s) => `${s.name} +${s.qty}`).join(' · ')}
              </div>
            ) : null}

            {link.appointmentReverts && link.appointmentReverts.length > 0 ? (
              <div className="mb-1.5 border-t border-dashed border-[rgba(74,59,46,.12)] pt-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                预约行回待收款：{link.appointmentReverts.map((a) => a.name).join(' · ')}
              </div>
            ) : null}

            {link.boarding ? (
              <div className="mb-1.5 border-t border-dashed border-[rgba(74,59,46,.12)] pt-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                寄养：已住 {link.boarding.occurredNights} 晚不退 / 退 {link.boarding.nights} 晚 × 晚单价 ¥
                {fenToYuan(link.boarding.perNightFen)}
              </div>
            ) : null}

            {link.passCancel ? (
              <div className="mb-1.5 border-t border-dashed border-[rgba(74,59,46,.12)] pt-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                次卡退卡：实付 ¥{fenToYuan(link.passCancel.paidFen)} ÷ {link.passCancel.paidTimes} 次 × 剩余付费{' '}
                {link.passCancel.remainingPaidTimes} 次；赠次 {link.passCancel.giftVoided} 次随退作废（不计价）；
                退卡前剩余 {link.passCancel.remainTimesBefore} 次
              </div>
            ) : null}

            <div className="border-t border-dashed border-[rgba(74,59,46,.12)] pt-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
              {(link.storedValueRestoreFen ?? 0) > 0 ? (
                <div className="flex justify-between py-0.5">
                  <span>储值余额回补</span>
                  <b className="font-number tabular-nums text-ink">+¥{fenToYuan(link.storedValueRestoreFen!)}</b>
                </div>
              ) : null}
              {(link.passTimesRestore ?? 0) > 0 ? (
                <div className="flex justify-between py-0.5">
                  <span>次卡次数回补</span>
                  <b className="font-number tabular-nums text-ink">+{link.passTimesRestore} 次</b>
                </div>
              ) : null}
              <div className="flex justify-between py-0.5">
                <span>提成冲减（预估）</span>
                <b className="font-number tabular-nums text-ink">−¥{fenToYuan(link.estimatedCommissionClawbackFen ?? 0)}</b>
              </div>
              <div className="flex justify-between py-0.5">
                <span>回馈金扣回列位（随 R11 会员批生效）</span>
                <b className="font-number tabular-nums text-ink">¥{fenToYuan(link.rebateClawbackFen ?? 0)}</b>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-caption-xs text-[rgba(74,59,46,.42)]">草稿单未执行，无六联动快照</p>
        )}
      </div>
    </CashierModal>
  )
}
