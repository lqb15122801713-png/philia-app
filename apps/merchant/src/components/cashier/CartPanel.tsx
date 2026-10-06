/**
 * 购物车栏（批次 M1 · 中栏）：P3 购物车行 + 整单优惠行 + P6 金额面板 + 吸底双钮
 *
 * - P3 行：36px 圆角 10 浅木图标档 + 名 13 + 规格小字 11 + 右价 Montserrat +
 *   商品行数量器（−/+ 22px 环钮）+ 行尾 × 墨 30% 安静删行；服务/预约行数量恒 1；
 * - 扣次行（试样 P3 扣次工艺）：薄荷「扣次」签 + 金额划线（从展示应收扣减）；
 *   行级「扣次」钮仅在 会员有可用次卡 且 行为 grooming 服务 时出现
 *   （B2-7R：次卡仅洗护可用；余额不足时钮禁用，原因挂支付面板胶囊行）；
 * - 点行价 = 改价小弹层（owner-only；manager 置灰 + 原因行「仅店主可改价」）；
 *   已改价行价下挂「原 ¥X」划线留痕；
 * - 商品行库存快照不足（qty > stock）→ 红警示条「库存不足」（任务书 §1.5.4：
 *   不足不阻塞但须明示；服务端结账兜底 MAX(0,stock-qty) 并留痕 stock_short）；
 * - P6 金额面板：kv 行 14（合计/次卡抵扣/整单优惠）+ 行间 1px dashed +
 *   应收 Montserrat 28 墨粗（展示口径=应付现金部分，次卡抵扣已扣）；
 * - 吸底双钮 [挂单] 白底墨边 + [结账] 柠檬（grid 1 : 1.4）。
 */

import { useState } from 'react'
import { Check, Minus, Pause, Percent, Plus, Sparkles, X } from 'lucide-react'
import { cc } from '@/copy/cashier'
import {
  fenToYuan,
  lineIcon,
  lineTotal,
  memberDiscountLineTotal,
  type CartAmounts,
  type CartLine,
  type DiscountType,
} from './model'
import { serviceDiscountLabel } from './membership'

function QtyStepper({
  qty,
  onDelta,
  testid,
}: {
  qty: number
  onDelta: (d: 1 | -1) => void
  testid?: string
}) {
  const btn =
    'flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(59,46,36,.09)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40'
  return (
    <div className="flex items-center gap-2" data-testid={testid}>
      <button type="button" aria-label="减一件" className={btn} disabled={qty <= 1} onClick={() => onDelta(-1)}>
        <Minus size={12} strokeWidth={2} aria-hidden />
      </button>
      <span className="min-w-[14px] text-center font-number text-caption font-semibold tabular-nums">{qty}</span>
      <button type="button" aria-label="加一件" className={btn} disabled={qty >= 99} onClick={() => onDelta(1)}>
        <Plus size={12} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}

export default function CartPanel({
  lines,
  memberBound,
  canUsePass,
  passRemainTimes,
  amounts,
  discountType,
  discountValue,
  billNo,
  creatorLabel,
  canEditPrice,
  holding,
  svcDiscount,
  memberDiscountUnknown,
  savings,
  onQty,
  onRemove,
  onOpenPrice,
  onOpenDiscount,
  onClearDiscount,
  onTogglePassLine,
  onLineNote,
  billNote,
  onBillNote,
  onHold,
  onCheckout,
  onOpenSell,
  onDismissSavings,
}: {
  lines: CartLine[]
  /** 整单已绑会员（散客 false → 不出现扣次钮） */
  memberBound: boolean
  /** 会员有可用次卡（active + 余量 + 未过期） */
  canUsePass: boolean
  passRemainTimes: number
  amounts: CartAmounts
  discountType: DiscountType
  discountValue: number
  billNo: string | null
  creatorLabel: string
  /** M1-补2 R2：改价/整单优惠闸门放宽至 owner|manager（server assertPriceEditAllowed 同档） */
  canEditPrice: boolean
  holding: boolean
  /** R11a：会员服务折扣镜像（已知档位：bp + 档位短名；null=无折扣或微光） */
  svcDiscount: { bp: number; planLabel: string } | null
  /** R11a：会员已绑但档位未在本端读出（读路径缺口——折扣由 server 结账实算，折后价以成交为准） */
  memberDiscountUnknown: boolean
  /** R11a 立省钩子（非会员当单 savingsPreview 实时算；null=不展示） */
  savings: { fen: number; text: string } | null
  onQty: (refId: string, d: 1 | -1) => void
  onRemove: (refId: string) => void
  onOpenPrice: (line: CartLine) => void
  onOpenDiscount: () => void
  onClearDiscount: () => void
  onTogglePassLine: (refId: string) => void
  /** 片 3：行内单品备注编辑（随 hold/settle 入参 note） */
  onLineNote: (refId: string, note: string) => void
  /** 片 3：整单备注（随 hold/settle 快照 note 落库） */
  billNote: string
  onBillNote: (note: string) => void
  onHold: () => void
  onCheckout: () => void
  /** 立省钩子「开通萤火」快捷入口（售卡面板萤火档预选） */
  onOpenSell: () => void
  /** 立省钩子关闭（本单不再弹——localStorage 行签名标记） */
  onDismissSavings: () => void
}) {
  const empty = lines.length === 0
  const markedPassCount = lines.filter((l) => l.paidByPass).length
  const adjustedCount = lines.filter((l) => l.adjustedPriceFen != null).length
  /** 片 3：行内备注编辑中行的 refId（一次一行，失焦即收） */
  const [noteEditId, setNoteEditId] = useState<string | null>(null)
  /** R11a：会员折扣合计（展示预估口径，服务/预约行未人工改价的部分） */
  const memberDiscFen =
    svcDiscount === null
      ? 0
      : lines.reduce((s, l) => {
          const disc = memberDiscountLineTotal(l, svcDiscount.bp)
          return disc === null ? s : s + (lineTotal(l) - disc)
        }, 0)
  const svcDiscLabel = svcDiscount ? serviceDiscountLabel(svcDiscount.bp) : null

  return (
    <div className="flex flex-1 flex-col" data-testid="cashier-cart">
      <div className="flex items-baseline justify-between">
        <b className="text-body-sm">当前单</b>
        <span className="text-caption-xs text-[rgba(59,46,36,.42)]">
          {billNo ? (
            <>
              <span className="font-number tabular-nums">{billNo}</span>
              {' · '}
            </>
          ) : null}
          开单人：{creatorLabel}
        </span>
      </div>

      {empty ? (
        <p
          className="py-10 text-center text-caption-xs text-[rgba(59,46,36,.42)]"
          data-testid="cashier-cart-empty"
        >
          {cc('cashier.cartEmpty')}
        </p>
      ) : (
        <div className="mt-1.5">
          {lines.map((l) => {
            const Icon = lineIcon(l)
            const groomLine = l.kind === 'service' && l.serviceType === 'grooming'
            const passToggleable =
              groomLine && memberBound && canUsePass && (l.paidByPass || passRemainTimes > markedPassCount)
            const stockShort = l.kind === 'product' && l.stock != null && l.qty > l.stock
            // R11a：会员折扣镜像行（人工改价行不走折扣——server 同口径；展示=折后价+门市价划线）
            const mDisc = svcDiscount ? memberDiscountLineTotal(l, svcDiscount.bp) : null
            return (
              <div
                key={l.refId}
                data-testid={`cashier-cart-row-${l.refId}`}
                className="border-b border-dashed border-[rgba(59,46,36,.09)] py-3 last:border-b-0"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F1E8D4] text-[rgba(59,46,36,.6)]">
                    <Icon size={17} strokeWidth={1.6} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-caption font-medium leading-tight">
                      {l.name}
                      {l.paidByPass ? (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-[#2E2318] px-2 py-[2px] text-caption-xs leading-none text-[#F2DFA6]">
                          扣次
                        </span>
                      ) : null}
                      {/* R11a：档位签（会员折扣行；88/85/8 折） */}
                      {mDisc !== null && svcDiscount ? (
                        <span
                          className="ml-1.5 inline-flex items-center rounded-full bg-brand-primary px-2 py-[2px] text-caption-xs leading-none text-ink"
                          data-testid={`cashier-member-disc-${l.refId}`}
                        >
                          {svcDiscount.planLabel} · {svcDiscLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-caption-xs text-[rgba(59,46,36,.42)]">
                      {l.kind === 'appointment' ? `预约行 · ${l.spec ?? ''}` : (l.spec ?? '')}
                    </div>
                  </div>
                  {l.kind === 'product' ? (
                    <QtyStepper qty={l.qty} testid={`cashier-qty-${l.refId}`} onDelta={(d) => onQty(l.refId, d)} />
                  ) : null}
                  {/* 点行价 = 改价弹层入口（M1-补2：owner|manager 可用，clerk 置灰） */}
                  <button
                    type="button"
                    data-testid={`cashier-price-${l.refId}`}
                    disabled={!canEditPrice}
                    title={canEditPrice ? '点按改价 / 折扣' : '仅店主/店长可改价'}
                    onClick={() => onOpenPrice(l)}
                    className={`w-[56px] text-right font-number text-caption font-semibold tabular-nums ${
                      l.paidByPass ? 'text-[rgba(59,46,36,.3)] line-through' : 'text-ink'
                    } ${canEditPrice ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    ¥{fenToYuan(mDisc ?? lineTotal(l))}
                    {l.adjustedPriceFen != null ? (
                      <span className="block text-caption-xs font-normal text-[rgba(59,46,36,.3)] line-through">
                        ¥{fenToYuan(l.unitPriceFen * l.qty)}
                      </span>
                    ) : mDisc !== null ? (
                      /* R11a：门市价划线对照（服务允许划线价——红线 6 商品全员同价不划线） */
                      <span
                        className="block text-caption-xs font-normal text-[rgba(59,46,36,.3)] line-through"
                        data-testid={`cashier-member-strike-${l.refId}`}
                      >
                        门市 ¥{fenToYuan(lineTotal(l))}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label="删除该行"
                    data-testid={`cashier-rm-${l.refId}`}
                    onClick={() => onRemove(l.refId)}
                    className="p-1 text-[rgba(59,46,36,.3)] transition-colors hover:text-[rgba(59,46,36,.6)]"
                  >
                    <X size={14} strokeWidth={1.8} aria-hidden />
                  </button>
                </div>
                {/* 行级次卡扣次钮（仅洗护服务行 + 会员有可用次卡时出现） */}
                {groomLine && memberBound && canUsePass ? (
                  <div className="mt-1.5 pl-[46px]">
                    <button
                      type="button"
                      data-testid={`cashier-pass-toggle-${l.refId}`}
                      disabled={!passToggleable}
                      onClick={() => onTogglePassLine(l.refId)}
                      className={`rounded-full px-2.5 py-[3px] text-caption-xs font-semibold transition-transform duration-120 ease-philia-spring active:scale-92 disabled:cursor-not-allowed disabled:opacity-40 ${
                        l.paidByPass
                          ? 'bg-[#2E2318] text-[#F2DFA6]'
                          : 'bg-[#FFFDF6] text-[rgba(59,46,36,.62)] shadow-[0_0_0_1px_rgba(59,46,36,.12)]'
                      }`}
                    >
                      {l.paidByPass ? '已扣次 · 点按取消' : '次卡扣次'}
                    </button>
                  </div>
                ) : null}
                {/* 库存不足警示条（不阻塞，须明示） */}
                {stockShort ? (
                  <div className="mt-1.5 ml-[46px] rounded-[6px] bg-danger-light px-2 py-1 text-caption-xs font-semibold text-danger-deep">
                    {cc('cashier.stockShort', { n: l.stock ?? '' })}
                  </div>
                ) : null}
                {/* 片 3：行内单品备注（随 hold/settle 入参 note，小票透出） */}
                <div className="mt-1.5 pl-[46px]">
                  {noteEditId === l.refId ? (
                    <input
                      autoFocus
                      data-testid={`cashier-line-note-input-${l.refId}`}
                      maxLength={200}
                      placeholder={cc('cashier.lineNotePh')}
                      value={l.note ?? ''}
                      onChange={(e) => onLineNote(l.refId, e.target.value)}
                      onBlur={() => setNoteEditId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                      className="w-full rounded-[8px] bg-[#FFFDF6] px-2.5 py-1.5 text-caption-xs text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
                    />
                  ) : (
                    <button
                      type="button"
                      data-testid={`cashier-line-note-${l.refId}`}
                      onClick={() => setNoteEditId(l.refId)}
                      className={`max-w-full truncate rounded-full px-2.5 py-[3px] text-caption-xs transition-transform duration-120 ease-philia-spring active:scale-92 ${
                        l.note
                          ? 'bg-[#F1E8D4] font-semibold text-[rgba(59,46,36,.62)]'
                          : 'bg-[#FFFDF6] text-[rgba(59,46,36,.42)] shadow-[0_0_0_1px_rgba(59,46,36,.09)]'
                      }`}
                      title={l.note ?? cc('cashier.lineNotePh')}
                    >
                      {l.note ? `备注：${l.note}` : cc('cashier.lineNoteCta')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 整单优惠行 */}
      {!empty ? (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            data-testid="cashier-discount-btn"
            disabled={!canEditPrice}
            title={canEditPrice ? '整单折扣或立减' : '仅店主/店长可整单优惠'}
            onClick={onOpenDiscount}
            className="inline-flex items-center gap-1 rounded-full bg-[#FFFDF6] px-3 py-1.5 text-caption-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(59,46,36,.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Percent size={13} strokeWidth={1.8} aria-hidden />
            整单优惠
          </button>
          {discountType !== 'none' && amounts.discountFen > 0 ? (
            <span className="inline-flex items-center gap-1 font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.62)]">
              {discountType === 'percent' ? `${discountValue / 10} 折` : `立减 ¥${fenToYuan(discountValue)}`}
              {' · '}−¥{fenToYuan(amounts.discountFen)}
              <button
                type="button"
                aria-label="清除整单优惠"
                disabled={!canEditPrice}
                onClick={onClearDiscount}
                className="text-[rgba(59,46,36,.3)] hover:text-[rgba(59,46,36,.6)] disabled:opacity-40"
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            </span>
          ) : null}
          {adjustedCount > 0 ? (
            <span className="font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.42)]">已改价 {adjustedCount} 行 · 留痕</span>
          ) : null}
        </div>
      ) : null}
      {!canEditPrice ? (
        <p className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="cashier-owner-hint">
          改价 / 整单优惠仅店主/店长可操作
        </p>
      ) : null}

      {/* 片 3：整单备注（随 hold/settle 快照 note 落库，挂单卡/详情/小票透出） */}
      {!empty ? (
        <input
          data-testid="cashier-bill-note"
          maxLength={500}
          placeholder={cc('cashier.billNotePh')}
          value={billNote}
          onChange={(e) => onBillNote(e.target.value)}
          className="mt-2 w-full rounded-[10px] bg-[#FFFDF6] px-3 py-2 text-caption text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
        />
      ) : null}

      {/* R11a 立省钩子（APP-47）：非会员当单「开通萤火立省 ¥X」一屏一次不打扰；
          关闭后本单不再弹（localStorage 行签名标记） */}
      {savings && !empty ? (
        <div
          className="mt-2 flex items-center gap-2 rounded-[14px] bg-brand-primary-light px-3 py-2.5"
          data-testid="cashier-savings-hook"
        >
          <Sparkles size={14} strokeWidth={1.8} className="shrink-0 text-ink" aria-hidden />
          <span className="min-w-0 flex-1 text-caption-xs font-semibold text-ink">{savings.text}</span>
          <button
            type="button"
            data-testid="cashier-savings-open"
            onClick={onOpenSell}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-brand-primary px-3 py-1.5 text-caption-xs font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            {cc('cashier.savingsCta')}
          </button>
          <button
            type="button"
            aria-label="关闭本单立省提示"
            data-testid="cashier-savings-dismiss"
            onClick={onDismissSavings}
            className="shrink-0 p-1.5 text-[rgba(59,46,36,.42)] transition-colors hover:text-[rgba(59,46,36,.7)]"
          >
            <X size={13} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      ) : null}

      {/* P6 金额面板（吸底） */}
      <div className="mt-auto pt-2.5">
        <div className="flex justify-between py-1 text-caption text-[rgba(59,46,36,.6)]">
          <span>合计（<span className="font-number tabular-nums">{lines.length}</span> 项）</span>
          <b className="font-number font-semibold tabular-nums text-ink">¥{fenToYuan(amounts.subtotalFen)}</b>
        </div>
        {/* R11a：会员折扣行（服务/预约行按档折扣预估；商品全员同价不打折——红线 6/7） */}
        {svcDiscount && memberDiscFen > 0 ? (
          <div className="flex justify-between py-1 text-caption text-[rgba(59,46,36,.6)]" data-testid="cashier-member-discount-row">
            <span>
              会员折扣（{svcDiscount.planLabel} · {svcDiscLabel}）
            </span>
            <b className="font-number font-semibold tabular-nums text-ink">−¥{fenToYuan(memberDiscFen)}</b>
          </div>
        ) : null}
        {memberDiscountUnknown ? (
          <p className="py-1 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="cashier-member-discount-unknown">
            {cc('cashier.memberDiscountUnknown')}
          </p>
        ) : null}
        {amounts.passCoveredFen > 0 ? (
          <div className="flex justify-between py-1 text-caption text-[rgba(59,46,36,.6)]">
            <span>次卡抵扣（<span className="font-number tabular-nums">{markedPassCount}</span> 行）</span>
            <b className="font-number font-semibold tabular-nums text-ink">−¥{fenToYuan(amounts.passCoveredFen)}</b>
          </div>
        ) : null}
        <div className="flex justify-between py-1 text-caption text-[rgba(59,46,36,.6)]">
          <span>整单优惠</span>
          <b className="font-number font-semibold tabular-nums text-ink">−¥{fenToYuan(amounts.discountFen)}</b>
        </div>
        {/* 片 3：抹零透出（前端 0 占位——真值以 server 重算为准，单上 roundingFen>0 才显示） */}
        {amounts.roundingFen > 0 ? (
          <div className="flex justify-between py-1 text-caption text-[rgba(59,46,36,.6)]" data-testid="cashier-rounding-row">
            <span>{cc('cashier.roundingLabel')}</span>
            <b className="font-number font-semibold tabular-nums text-ink">−¥{fenToYuan(amounts.roundingFen)}</b>
          </div>
        ) : null}
        <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-[rgba(59,46,36,.09)] pt-2.5">
          <span className="text-body-sm font-semibold">应收</span>
          <span className="whitespace-nowrap font-number text-detail font-bold tabular-nums" data-testid="cashier-due">
            ¥{fenToYuan(amounts.dueFen)}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-[1fr_1.4fr] gap-2">
          <button
            type="button"
            data-testid="cashier-hold-btn"
            disabled={empty || holding}
            onClick={onHold}
            className="inline-flex items-center justify-center gap-1.5 rounded-[14px] bg-[#FFFDF6] py-3 text-body-sm font-semibold text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
          >
            <Pause size={15} strokeWidth={1.8} aria-hidden />
            {holding ? '挂单中…' : '挂单'}
          </button>
          <button
            type="button"
            data-testid="cashier-checkout-btn"
            disabled={empty || holding}
            onClick={onCheckout}
            className="inline-flex items-center justify-center gap-1.5 rounded-[14px] bg-brand-primary py-3 text-body-sm font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
          >
            <Check size={15} strokeWidth={2} aria-hidden />
            结账
          </button>
        </div>
      </div>
    </div>
  )
}
