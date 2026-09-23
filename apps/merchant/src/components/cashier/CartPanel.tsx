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

import { Check, Minus, Pause, Percent, Plus, Sparkles, X } from 'lucide-react'
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
    'flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40'
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
        <span className="text-caption-xs text-[rgba(74,59,46,.42)]">
          {billNo ? `${billNo} · ` : ''}开单人：{creatorLabel}
        </span>
      </div>

      {empty ? (
        <p
          className="py-12 text-center text-caption-xs text-[rgba(74,59,46,.42)]"
          data-testid="cashier-cart-empty"
        >
          点左侧商品或服务开单
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
                className="border-b border-dashed border-[rgba(74,59,46,.09)] py-3 last:border-b-0"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F1E8D4] text-[rgba(74,59,46,.6)]">
                    <Icon size={17} strokeWidth={1.6} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-caption font-medium leading-tight">
                      {l.name}
                      {l.paidByPass ? (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-[#7FD8BE] px-2 py-[2px] text-caption-xs leading-none text-[#1E4D3D]">
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
                    <div className="mt-0.5 truncate text-caption-xs text-[rgba(74,59,46,.42)]">
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
                      l.paidByPass ? 'text-[rgba(74,59,46,.3)] line-through' : 'text-ink'
                    } ${canEditPrice ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    ¥{fenToYuan(mDisc ?? lineTotal(l))}
                    {l.adjustedPriceFen != null ? (
                      <span className="block text-caption-xs font-normal text-[rgba(74,59,46,.3)] line-through">
                        ¥{fenToYuan(l.unitPriceFen * l.qty)}
                      </span>
                    ) : mDisc !== null ? (
                      /* R11a：门市价划线对照（服务允许划线价——红线 6 商品全员同价不划线） */
                      <span
                        className="block text-caption-xs font-normal text-[rgba(74,59,46,.3)] line-through"
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
                    className="p-1 text-[rgba(74,59,46,.3)] transition-colors hover:text-[rgba(74,59,46,.6)]"
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
                          ? 'bg-[#7FD8BE] text-[#1E4D3D]'
                          : 'bg-[#FFFDF6] text-[rgba(74,59,46,.62)] shadow-[0_0_0_1px_rgba(74,59,46,.12)]'
                      }`}
                    >
                      {l.paidByPass ? '已扣次 · 点按取消' : '次卡扣次'}
                    </button>
                  </div>
                ) : null}
                {/* 库存不足警示条（不阻塞，须明示） */}
                {stockShort ? (
                  <div className="mt-1.5 ml-[46px] rounded-[6px] bg-danger-light px-2 py-1 text-caption-xs font-semibold text-danger-deep">
                    库存不足：余 {l.stock} 件，结账将按实际库存扣减
                  </div>
                ) : null}
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
            className="inline-flex items-center gap-1 rounded-full bg-[#FFFDF6] px-3 py-1.5 text-caption-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Percent size={13} strokeWidth={1.8} aria-hidden />
            整单优惠
          </button>
          {discountType !== 'none' && amounts.discountFen > 0 ? (
            <span className="inline-flex items-center gap-1 text-caption-xs text-[rgba(74,59,46,.62)]">
              {discountType === 'percent' ? `${discountValue / 10} 折` : `立减 ¥${fenToYuan(discountValue)}`}
              {' · '}−¥{fenToYuan(amounts.discountFen)}
              <button
                type="button"
                aria-label="清除整单优惠"
                disabled={!canEditPrice}
                onClick={onClearDiscount}
                className="text-[rgba(74,59,46,.3)] hover:text-[rgba(74,59,46,.6)] disabled:opacity-40"
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            </span>
          ) : null}
          {adjustedCount > 0 ? (
            <span className="text-caption-xs text-[rgba(74,59,46,.42)]">已改价 {adjustedCount} 行 · 留痕</span>
          ) : null}
        </div>
      ) : null}
      {!canEditPrice ? (
        <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]" data-testid="cashier-owner-hint">
          改价 / 整单优惠仅店主/店长可操作
        </p>
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
            开通萤火 ›
          </button>
          <button
            type="button"
            aria-label="关闭本单立省提示"
            data-testid="cashier-savings-dismiss"
            onClick={onDismissSavings}
            className="shrink-0 p-1.5 text-[rgba(74,59,46,.42)] transition-colors hover:text-[rgba(74,59,46,.7)]"
          >
            <X size={13} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      ) : null}

      {/* P6 金额面板（吸底） */}
      <div className="mt-auto pt-2.5">
        <div className="flex justify-between py-1 text-caption text-[rgba(74,59,46,.6)]">
          <span>合计（{lines.length} 项）</span>
          <b className="font-number font-semibold tabular-nums text-ink">¥{fenToYuan(amounts.subtotalFen)}</b>
        </div>
        {/* R11a：会员折扣行（服务/预约行按档折扣预估；商品全员同价不打折——红线 6/7） */}
        {svcDiscount && memberDiscFen > 0 ? (
          <div className="flex justify-between py-1 text-caption text-[rgba(74,59,46,.6)]" data-testid="cashier-member-discount-row">
            <span>
              会员折扣（{svcDiscount.planLabel} · {svcDiscLabel}）
            </span>
            <b className="font-number font-semibold tabular-nums text-ink">−¥{fenToYuan(memberDiscFen)}</b>
          </div>
        ) : null}
        {memberDiscountUnknown ? (
          <p className="py-1 text-caption-xs text-[rgba(74,59,46,.42)]" data-testid="cashier-member-discount-unknown">
            会员折扣由服务端结账时按档自动计算，折后价以成交为准（内测期档位读路径缺口）
          </p>
        ) : null}
        {amounts.passCoveredFen > 0 ? (
          <div className="flex justify-between py-1 text-caption text-[rgba(74,59,46,.6)]">
            <span>次卡抵扣（{markedPassCount} 行）</span>
            <b className="font-number font-semibold tabular-nums text-ink">−¥{fenToYuan(amounts.passCoveredFen)}</b>
          </div>
        ) : null}
        <div className="flex justify-between py-1 text-caption text-[rgba(74,59,46,.6)]">
          <span>整单优惠</span>
          <b className="font-number font-semibold tabular-nums text-ink">−¥{fenToYuan(amounts.discountFen)}</b>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-[rgba(74,59,46,.09)] pt-2.5">
          <span className="text-body-sm font-semibold">应收</span>
          <span className="font-number text-detail font-bold tabular-nums" data-testid="cashier-due">
            ¥{fenToYuan(amounts.dueFen)}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-[1fr_1.4fr] gap-2">
          <button
            type="button"
            data-testid="cashier-hold-btn"
            disabled={empty || holding}
            onClick={onHold}
            className="inline-flex items-center justify-center gap-1.5 rounded-[14px] bg-[#FFFDF6] py-3 text-body-sm font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
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
