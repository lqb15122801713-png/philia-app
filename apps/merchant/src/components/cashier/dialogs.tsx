/**
 * 收银台弹层组（批次 M1）
 *
 * - CashierModal：居中 420px + 20 圆角 + 墨 28% 遮罩（试样 P8 工艺），Esc 关闭；
 * - PriceDialog（点行价）：改价 或 折扣% 二选一，留痕 adjustedPriceFen；
 *   owner 才可提交，manager 全置灰 + 原因行「仅店主可改价」；
 * - DiscountDialog（整单优惠）：折扣%（90=九折）或立减金额二选一 →
 *   discountType/discountValue；优惠 ≤ 非预约行合计（服务端口径，输入期拦截）；
 * - VoidDialog（P8 撤单弹层）：原因 textarea（选填）+ [取消] 白底 +
 *   [确认撤单] 红描边功能胶囊；owner-only（manager 确认钮置灰 + 原因行）；
 *   settled 单不进本弹层（R12 退款专项已落地，settled 走退款真链路）。
 *
 * R12：补丁② RefundBlockDialog「退款功能随专项批开通」拦截弹层已随真退款
 * （RefundDialog 六联动真链路）退役删除——任务书兑现承诺：替换站岗拦截文案。
 */

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { fenToYuan, yuanToFen } from '@/components/mall-admin/format'
import type { CartLine, DiscountType } from './model'

/* ------------------------------------------------------------------ */
/* 基础弹层                                                             */
/* ------------------------------------------------------------------ */

export function CashierModal({
  open,
  onClose,
  title,
  children,
  footer,
  testid,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  testid?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(74,59,46,.28)]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        data-testid={testid}
        className="relative flex max-h-[85vh] w-full max-w-[420px] flex-col overflow-hidden rounded-[20px] bg-[#FFFDF6] shadow-[0_8px_40px_rgba(74,59,46,.18)]"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="text-title font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1 text-[rgba(74,59,46,.42)] transition-colors hover:bg-[rgba(74,59,46,.06)]"
          >
            <X size={18} strokeWidth={1.6} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-2">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/** 弹层按钮（白底 ghost / 柠檬 primary / 红描边 danger-outline） */
export function SheetBtn({
  variant = 'ghost',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'primary' | 'danger-outline'
}) {
  const v = {
    ghost: 'bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)]',
    primary: 'bg-brand-primary text-ink shadow-hairline font-bold',
    'danger-outline': 'bg-[#FFFDF6] text-danger shadow-[0_0_0_1px_#D92D20] font-semibold',
  }[variant]
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-caption transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}
      {...rest}
    />
  )
}

const sheetInputCls =
  'w-full rounded-[14px] bg-[#FFFDF6] px-3 py-2 font-number text-body-sm font-semibold tabular-nums text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] placeholder:font-sans placeholder:font-normal placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)] disabled:opacity-50'

const modeTabCls = (on: boolean) =>
  `rounded-full px-3.5 py-[7px] text-caption ${on ? 'bg-[#4A3B2E] font-semibold text-[#F6F1E3]' : 'text-[rgba(74,59,46,.6)]'}`

/* ------------------------------------------------------------------ */
/* 改价弹层（点行价）                                                    */
/* ------------------------------------------------------------------ */

export function PriceDialog({
  line,
  canEdit,
  onApply,
  onClose,
}: {
  line: CartLine | null
  /** M1-补2 R2：改价闸门 owner|manager（server assertPriceEditAllowed 同档硬校验） */
  canEdit: boolean
  /** adjusted=null 表示恢复原价 */
  onApply: (refId: string, adjustedPriceFen: number | null) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'price' | 'percent'>('price')
  const [priceInput, setPriceInput] = useState('')
  const [percentInput, setPercentInput] = useState('')

  // 每次换行重置输入（保留上次的改价值便于二次调整）
  const [lastRef, setLastRef] = useState<string | null>(null)
  if (line && line.refId !== lastRef) {
    setLastRef(line.refId)
    setMode('price')
    setPriceInput(line.adjustedPriceFen != null ? String(line.adjustedPriceFen / 100) : '')
    setPercentInput('')
  }
  if (!line && lastRef !== null) setLastRef(null)

  if (!line) return null

  const unit = line.unitPriceFen
  const parsedPrice = yuanToFen(priceInput)
  const pct = Number(percentInput)
  const pctValid = Number.isInteger(pct) && pct >= 1 && pct <= 100
  const nextFen = mode === 'price' ? parsedPrice : pctValid ? Math.round((unit * pct) / 100) : null
  const valid = nextFen !== null && nextFen >= 0

  return (
    <CashierModal
      open={line !== null}
      onClose={onClose}
      title="改价"
      testid="cashier-price-dialog"
      footer={
        <>
          {line.adjustedPriceFen != null ? (
            <SheetBtn
              data-testid="cashier-price-reset"
              disabled={!canEdit}
              onClick={() => {
                onApply(line.refId, null)
                onClose()
              }}
            >
              恢复原价
            </SheetBtn>
          ) : null}
          <SheetBtn onClick={onClose}>取消</SheetBtn>
          <SheetBtn
            variant="primary"
            data-testid="cashier-price-confirm"
            disabled={!canEdit || !valid}
            onClick={() => {
              if (nextFen === null) return
              onApply(line.refId, nextFen)
              onClose()
            }}
          >
            确定
          </SheetBtn>
        </>
      }
    >
      <div className="text-body-sm font-semibold">{line.name}</div>
      <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
        原价 <span className="font-number tabular-nums">¥{fenToYuan(unit)}</span>
        {line.qty > 1 ? ` × ${line.qty}` : ''}
      </div>

      <div className="mt-3 flex gap-1.5">
        <button type="button" className={modeTabCls(mode === 'price')} onClick={() => setMode('price')}>
          改价
        </button>
        <button type="button" className={modeTabCls(mode === 'percent')} onClick={() => setMode('percent')}>
          折扣 %
        </button>
      </div>

      <div className="mt-3">
        {mode === 'price' ? (
          <input
            className={sheetInputCls}
            data-testid="cashier-price-input"
            inputMode="decimal"
            placeholder={`新价（元），如 ${(unit / 100).toString()}`}
            value={priceInput}
            disabled={!canEdit}
            onChange={(e) => setPriceInput(e.target.value)}
          />
        ) : (
          <input
            className={sheetInputCls}
            data-testid="cashier-price-percent"
            inputMode="numeric"
            placeholder="折扣 %（90 = 九折）"
            value={percentInput}
            disabled={!canEdit}
            onChange={(e) => setPercentInput(e.target.value)}
          />
        )}
        <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">
          {valid && nextFen !== null
            ? `新价 ¥${fenToYuan(nextFen)}（改价留痕，随单可查）`
            : mode === 'price'
              ? '输入新单价（元，最多两位小数）'
              : '1-100 的整数，如 90 = 九折'}
        </p>
      </div>

      {!canEdit ? (
        <p className="mt-2 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]" data-testid="cashier-price-owner-hint">
          仅店主/店长可改价
        </p>
      ) : null}
    </CashierModal>
  )
}

/* ------------------------------------------------------------------ */
/* 整单优惠弹层                                                          */
/* ------------------------------------------------------------------ */

export function DiscountDialog({
  open,
  discountType,
  discountValue,
  nonApptSubtotalFen,
  canEdit,
  onApply,
  onClose,
}: {
  open: boolean
  discountType: DiscountType
  discountValue: number
  /** 非预约行合计（优惠上限；预约行金额不参与优惠，服务端同口径拒绝超限） */
  nonApptSubtotalFen: number
  /** M1-补2 R2：整单优惠闸门 owner|manager（server 同档硬校验） */
  canEdit: boolean
  onApply: (type: DiscountType, value: number) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'percent' | 'amount'>('percent')
  const [pctInput, setPctInput] = useState('')
  const [amtInput, setAmtInput] = useState('')
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setMode(discountType === 'amount' ? 'amount' : 'percent')
      setPctInput(discountType === 'percent' && discountValue > 0 ? String(discountValue) : '')
      setAmtInput(discountType === 'amount' && discountValue > 0 ? String(discountValue / 100) : '')
    }
  }

  const pct = Number(pctInput)
  const pctValid = Number.isInteger(pct) && pct >= 1 && pct <= 100
  // percent 预览按「非预约行合计」估（服务端按全量 subtotal 计后再封顶，上限一致）
  const amtFen = yuanToFen(amtInput)
  const discountFen = mode === 'percent' ? (pctValid ? Math.round((nonApptSubtotalFen * (100 - pct)) / 100) : null) : amtFen
  const overLimit = discountFen !== null && discountFen > nonApptSubtotalFen
  const valid = discountFen !== null && discountFen >= 0 && !overLimit

  return (
    <CashierModal
      open={open}
      onClose={onClose}
      title="整单优惠"
      testid="cashier-discount-dialog"
      footer={
        <>
          {discountType !== 'none' ? (
            <SheetBtn
              data-testid="cashier-discount-clear"
              disabled={!canEdit}
              onClick={() => {
                onApply('none', 0)
                onClose()
              }}
            >
              清除优惠
            </SheetBtn>
          ) : null}
          <SheetBtn onClick={onClose}>取消</SheetBtn>
          <SheetBtn
            variant="primary"
            data-testid="cashier-discount-confirm"
            disabled={!canEdit || !valid}
            onClick={() => {
              if (discountFen === null) return
              onApply(mode, mode === 'percent' ? pct : (amtFen ?? 0))
              onClose()
            }}
          >
            确定
          </SheetBtn>
        </>
      }
    >
      <div className="flex gap-1.5">
        <button type="button" className={modeTabCls(mode === 'percent')} onClick={() => setMode('percent')}>
          折扣 %
        </button>
        <button type="button" className={modeTabCls(mode === 'amount')} onClick={() => setMode('amount')}>
          立减金额
        </button>
      </div>
      <div className="mt-3">
        {mode === 'percent' ? (
          <input
            className={sheetInputCls}
            data-testid="cashier-discount-pct"
            inputMode="numeric"
            placeholder="折扣 %（90 = 九折）"
            value={pctInput}
            disabled={!canEdit}
            onChange={(e) => setPctInput(e.target.value)}
          />
        ) : (
          <input
            className={sheetInputCls}
            data-testid="cashier-discount-amt"
            inputMode="decimal"
            placeholder="立减金额（元）"
            value={amtInput}
            disabled={!canEdit}
            onChange={(e) => setAmtInput(e.target.value)}
          />
        )}
        <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">
          {overLimit
            ? '优惠不能超过服务/商品行合计（预约行金额不参与优惠）'
            : valid && discountFen !== null && discountFen > 0
              ? `整单优惠 −¥${fenToYuan(discountFen)}`
              : mode === 'percent'
                ? '1-100 的整数，如 90 = 九折'
                : '单位元，最多两位小数'}
        </p>
      </div>
      {!canEdit ? (
        <p className="mt-2 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">仅店主/店长可整单优惠</p>
      ) : null}
    </CashierModal>
  )
}

/* ------------------------------------------------------------------ */
/* P8 撤单弹层                                                          */
/* ------------------------------------------------------------------ */

export function VoidDialog({
  bill,
  pending,
  onConfirm,
  onClose,
}: {
  /** 目标单（open/held；settled 不可撤——入口不渲染，这里仅防御）
      M1-补2 补丁①1：撤单三级全开（owner|manager|clerk），边界仍锁「仅未支付单」 */
  bill: { billNo: string; buyerName?: string; payableFen?: number; status?: string } | null
  pending: boolean
  onConfirm: (reason: string | undefined) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [lastNo, setLastNo] = useState<string | null>(null)
  if (bill && bill.billNo !== lastNo) {
    setLastNo(bill.billNo)
    setReason('')
  }
  if (!bill && lastNo !== null) setLastNo(null)

  if (!bill) return null
  const settled = bill.status === 'settled'

  return (
    <CashierModal
      open={bill !== null}
      onClose={onClose}
      title="撤单"
      testid="cashier-void-dialog"
      footer={
        <>
          <SheetBtn onClick={onClose}>取消</SheetBtn>
          <SheetBtn
            variant="danger-outline"
            data-testid="cashier-void-confirm"
            disabled={pending || settled}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            {pending ? '撤单中…' : '确认撤单'}
          </SheetBtn>
        </>
      }
    >
      <div className="rounded-[14px] bg-[#F6F1E3] px-3.5 py-3">
        <div className="font-number text-caption font-semibold tabular-nums">{bill.billNo}</div>
        <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
          {bill.buyerName ?? '—'}
          {bill.payableFen != null ? (
            <>
              {' · '}
              <span className="font-number tabular-nums">¥{fenToYuan(bill.payableFen)}</span>
            </>
          ) : null}
        </div>
      </div>
      <textarea
        className="mt-3 min-h-[76px] w-full resize-none rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)]"
        data-testid="cashier-void-reason"
        placeholder="撤单原因（选填，留痕在流水）"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">
        撤单后单据留痕为「已撤单」，不会物理删除；仅未支付单可撤（已结账请店主用反结账）
      </p>
      {settled ? (
        <p className="mt-2 text-caption-xs font-semibold text-danger-deep">
          已结账单不可撤单（退款专项冻结中）
        </p>
      ) : null}
    </CashierModal>
  )
}

/* ------------------------------------------------------------------ */
/* M1-补2 D：反结账单弹层（已支付单冲正 · 仅店主 · 强制原因）                */
/* ------------------------------------------------------------------ */

export function ReverseDialog({
  bill,
  pending,
  onConfirm,
  onClose,
}: {
  /** 目标单（settled 且未被冲正；入口由调用方按角色/状态把控） */
  bill: { billNo: string; buyerName?: string; payableFen?: number } | null
  pending: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [lastNo, setLastNo] = useState<string | null>(null)
  if (bill && bill.billNo !== lastNo) {
    setLastNo(bill.billNo)
    setReason('')
  }
  if (!bill && lastNo !== null) setLastNo(null)

  if (!bill) return null
  const valid = reason.trim().length > 0

  return (
    <CashierModal
      open={bill !== null}
      onClose={onClose}
      title="反结账（已支付单冲正）"
      testid="cashier-reverse-dialog"
      footer={
        <>
          <SheetBtn onClick={onClose}>取消</SheetBtn>
          <SheetBtn
            variant="danger-outline"
            data-testid="cashier-reverse-confirm"
            disabled={!valid || pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? '冲正中…' : '确认冲正'}
          </SheetBtn>
        </>
      }
    >
      <div className="rounded-[14px] bg-[#F6F1E3] px-3.5 py-3">
        <div className="font-number text-caption font-semibold tabular-nums" data-testid="cashier-reverse-billno">
          {bill.billNo}
        </div>
        <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
          {bill.buyerName ?? '—'}
          {bill.payableFen != null ? (
            <>
              {' · '}
              <span className="font-number tabular-nums">¥{fenToYuan(bill.payableFen)}</span>
            </>
          ) : null}
        </div>
      </div>
      <textarea
        className="mt-3 min-h-[76px] w-full resize-none rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.3)]"
        data-testid="cashier-reverse-reason"
        placeholder="冲正原因（必填，留痕）"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <p className="mt-1.5 text-caption-xs leading-relaxed text-[rgba(74,59,46,.42)]">
        冲正将自动生成关联冲正单（金额镜像负值，不计当日已收）：库存回补、预约回到待收款、
        次卡/储值按原路回补；原单永存不涂改，仅挂「已冲正」灰签（双向可查）。
      </p>
      {!valid ? (
        <p className="mt-2 text-caption-xs font-semibold text-danger-deep">反结账必须填写原因</p>
      ) : null}
    </CashierModal>
  )
}
