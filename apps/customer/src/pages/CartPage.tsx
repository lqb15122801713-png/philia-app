/**
 * 购物车 /mall/cart（T5.3 · client 状态，localStorage 持久化；换皮批片 2 落 M-03 定稿：
 * 行件=图 56 圆角 12 + 名 13/700 + 价 mono 11 muted + 步进器 stepper 26 圆 ±/mono 13 数；
 * 吸底 ctabar 渐出底 + 合计 mono 19/700 + 深棕主钮 16/700 + 回馈金返显 sub（APP-18））
 *
 * - 商品行：勾选 / 图 / 名 / 单价 / 数量步进器（上限 min(stock, 99)）/ 删除；
 * - 全选 / 单选；底部吸底结算栏（详情级无 dock，落底 safe-area）：合计（勾选口径）+「去结算」；
 * - 单店限制：车内商品必为同一门店（加车时已拦），页头展示当前门店提示；
 * - 去结算 → /mall/checkout（结算页从 localStorage 还原勾选商品，跨页一致）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CartProvider, MAX_QTY, useCart, type CartItem } from '../components/mall/cartStore';
import { EmptyState } from '../components/home/common';
import { fenToYuan } from '../components/mall/format';
import { useMallToast } from '../components/mall/MallToast';
import PageHeader from '../components/PageHeader';
import ProductImage from '../components/mall/ProductImage';
import { mc } from '../components/member/copy';

/** 圆形勾选钮：品牌色实心圆 + 深棕墨 ✓（v1.1 冻结 on-primary 语义）
 *  W1-D2 触控量化：视觉圆点 24px 不变，命中区扩至 44×44px（负边距补偿布局零视觉变化） */
function CheckDot({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
          checked ? 'bg-brand-primary' : 'border-[1.5px] border-line-strong bg-card'
        }`}
      >
        {checked ? <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.5} /> : null}
      </span>
    </button>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const cart = useCart();
  const cap = Math.max(1, Math.min(item.stock, MAX_QTY));
  /* 片 2 M-03 定稿 .cart-row：图 56 圆角 12 + 名 13/700 + 价 mono 11 muted +
     步进器 26 圆 ±（细线白卡）+ mono 13 数；勾选/删除能力保留 */
  return (
    <div className="flex gap-3 py-3.5">
      <div className="flex items-center">
        <CheckDot checked={item.checked} onToggle={() => cart.toggle(item.productId)} label={`选择 ${item.name}`} />
      </div>
      <Link to={`/mall/product/${item.productId}`} className="shrink-0">
        <ProductImage src={item.image} alt={item.name} className="h-14 w-14 rounded-[12px]" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/mall/product/${item.productId}`} className="min-w-0">
            <p className="line-clamp-2 text-[13px] font-bold leading-[18px]">{item.name}</p>
          </Link>
          <button
            type="button"
            aria-label={`删除 ${item.name}`}
            onClick={() => cart.remove(item.productId)}
            className="shrink-0 p-1 text-ink-placeholder transition hover:text-danger"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="u1-num text-[11px] text-ink-secondary">{fenToYuan(item.priceFen)}</p>
          {/* 步进器（§4.7 stepper：26 圆 ± 钮 + mono 13 数；小件例外，钮间距 10px ≥8 无冲突区） */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="减少数量"
              disabled={item.qty <= 1}
              onClick={() => cart.setQty(item.productId, item.qty - 1)}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line bg-card text-ink transition disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <span className="min-w-[18px] text-center font-number text-[13px] font-bold tabular-nums">{item.qty}</span>
            <button
              type="button"
              aria-label="增加数量"
              disabled={item.qty >= cap}
              onClick={() => cart.setQty(item.productId, item.qty + 1)}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line bg-card text-ink transition disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        {item.qty >= cap && item.stock < MAX_QTY ? (
          <p className="mt-0.5 text-right text-caption-xs text-ink-placeholder">库存 {item.stock} 件</p>
        ) : null}
      </div>
    </div>
  );
}

function CartInner() {
  const cart = useCart();
  const navigate = useNavigate();
  const { trpc } = usePhiliaClient();
  const { toastEl, showToast } = useMallToast();

  /* 回馈金返显（M-03 定稿 CTA sub「本单返 ¥x 回馈金」；口径 APP-18：
     membership.my 的 plan.rebateBp 万分比，返 Fen=round(勾选合计*rebateBp/10000)；
     非会员/免费档=0 不渲染假数——MallPage 同款） */
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
    retry: false,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  const rebateFen = rebateBp > 0 ? Math.round((cart.checkedTotalFen * rebateBp) / 10000) : 0;

  const handleCheckout = () => {
    if (cart.checkedItems.length === 0) {
      showToast('请先勾选要结算的商品');
      return;
    }
    navigate('/mall/checkout');
  };

  return (
    /* U4-D3：页边距 22px */
    <div className="px-[22px] pb-32 pt-4">
      {toastEl}
      {/* U1-A：统一返回条（←圆钮+标题），件数紧随标题保持原位 */}
      <PageHeader
        title={
          <>
            购物袋
            {cart.items.length > 0 ? (
              <span className="u1-num ml-1 text-caption font-normal text-ink-secondary">{cart.count} 件</span>
            ) : null}
          </>
        }
      />

      {cart.items.length === 0 ? (
        /* U1-I：全域统一空态组件；U4-D3 文案对齐试样 12（购物袋空态），余白区垂直居中 */
        <div className="flex min-h-[56vh] flex-col justify-center">
          <EmptyState
            title="购物袋还空着呢"
            desc={
              <>
                philia 帮你看着货架，
                <br />
                门店同款好物都在商城里
              </>
            }
            action={
              <Link
                to="/mall"
                className="inline-flex items-center rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                去逛逛 ›
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* 单店限制提示 */}
          <p className="mt-3 rounded-control bg-brand-primary-light px-3.5 py-2.5 text-caption text-ink">
            当前为「{cart.items[0]?.storeName}」的商品 · 一次下单仅支持同一门店
          </p>

          {/* 行件组（M-03 定稿：单张白卡内发丝线分隔多行） */}
          <div className="u1-card mt-3 divide-y divide-line-divider px-4">
            {cart.items.map((it) => (
              <CartRow key={it.productId} item={it} />
            ))}
          </div>

          {/* 吸底结算栏（片 2 M-03 定稿 ctabar：渐出底 + 合计 mono 19/700 +
              深棕主钮 16/700（sub mono 返显）；详情级无 dock，落底 safe-area） */}
          <div
            className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
            style={{ background: 'linear-gradient(transparent, #FAF8F2 40%)' }}
          >
            <div className="mx-auto max-w-lg px-4 pb-4 pt-3">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckDot
                    checked={cart.allChecked}
                    onToggle={() => cart.toggleAll(!cart.allChecked)}
                    label="全选"
                  />
                  <span className="text-body-sm text-ink-secondary">全选</span>
                </div>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-caption-xs text-ink-secondary">合计</span>
                  <span className="u1-num text-[19px] font-bold text-ink">{fenToYuan(cart.checkedTotalFen)}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={cart.checkedItems.length === 0}
                onClick={handleCheckout}
                className="flex w-full flex-col items-center justify-center rounded-[18px] bg-[#2E2318] py-3 text-body-lg font-bold text-[#F6EFDD] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
              >
                <span>
                  去结算{cart.checkedItems.length > 0 ? `（${cart.checkedItems.reduce((n, it) => n + it.qty, 0)}）` : ''}
                </span>
                {rebateFen > 0 ? (
                  <span className="mt-0.5 font-number text-[10.5px] font-normal text-[#C9BBA0]">
                    {mc('mall.rebateEarnCta', { amt: fenToYuan(rebateFen) })}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CartPage() {
  return (
    <CartProvider>
      <CartInner />
    </CartProvider>
  );
}
