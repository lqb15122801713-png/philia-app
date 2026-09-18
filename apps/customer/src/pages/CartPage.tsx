/**
 * 购物车 /mall/cart（T5.3 · client 状态，localStorage 持久化）
 *
 * - 商品行：勾选 / 图 / 名 / 单价 / 数量步进器（上限 min(stock, 99)）/ 删除；
 * - 全选 / 单选；底部固定结算栏（TabBar 之上）：合计（勾选口径）+「去结算」；
 * - 单店限制：车内商品必为同一门店（加车时已拦），页头展示当前门店提示；
 * - 去结算 → /mall/checkout（结算页从 localStorage 还原勾选商品，跨页一致）。
 */

import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CartProvider, MAX_QTY, useCart, type CartItem } from '../components/mall/cartStore';
import { EmptyState } from '../components/home/common';
import { fenToYuan } from '../components/mall/format';
import { useMallToast } from '../components/mall/MallToast';
import PageHeader from '../components/PageHeader';
import ProductImage from '../components/mall/ProductImage';

/** 圆形勾选钮：品牌色实心圆 + 深棕墨 ✓（v1.1 冻结 on-primary 语义） */
function CheckDot({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
        checked ? 'bg-brand-primary' : 'border-[1.5px] border-line-strong bg-card'
      }`}
    >
      {checked ? <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.5} /> : null}
    </button>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const cart = useCart();
  const cap = Math.max(1, Math.min(item.stock, MAX_QTY));
  /* U4-D3：行卡→u1-card（panel 20+细线 ring）；价格墨色等宽（试样价格非柠檬字） */
  return (
    <div className="u1-card flex gap-3 p-3">
      <div className="flex items-center">
        <CheckDot checked={item.checked} onToggle={() => cart.toggle(item.productId)} label={`选择 ${item.name}`} />
      </div>
      <Link to={`/mall/product/${item.productId}`} className="shrink-0">
        <ProductImage src={item.image} alt={item.name} className="h-20 w-20 rounded-control" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/mall/product/${item.productId}`} className="min-w-0">
            <p className="line-clamp-2 text-body-sm">{item.name}</p>
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
          <p className="u1-num text-body-sm font-bold text-ink">{fenToYuan(item.priceFen)}</p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="减少数量"
              disabled={item.qty <= 1}
              onClick={() => cart.setQty(item.productId, item.qty - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-ink transition disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <span className="w-6 text-center font-number text-body-sm">{item.qty}</span>
            <button
              type="button"
              aria-label="增加数量"
              disabled={item.qty >= cap}
              onClick={() => cart.setQty(item.productId, item.qty + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-ink transition disabled:opacity-40"
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
  const { toastEl, showToast } = useMallToast();

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

          <div className="mt-3 space-y-3">
            {cart.items.map((it) => (
              <CartRow key={it.productId} item={it} />
            ))}
          </div>

          {/* 底部结算栏（详情级无 dock，落底 safe-area——U4-D3 修 bottom-14 悬空；
              去渐变（禁令），柠檬实底） */}
          <div className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky border-t border-[rgba(74,59,46,.09)] bg-card">
            <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckDot
                  checked={cart.allChecked}
                  onToggle={() => cart.toggleAll(!cart.allChecked)}
                  label="全选"
                />
                <span className="text-body-sm text-ink-secondary">全选</span>
              </div>
              <div className="ml-auto text-right">
                <p className="text-caption-xs text-ink-secondary">合计</p>
                <p className="u1-num text-title font-bold text-ink">{fenToYuan(cart.checkedTotalFen)}</p>
              </div>
              <button
                type="button"
                disabled={cart.checkedItems.length === 0}
                onClick={handleCheckout}
                className="rounded-control bg-brand-primary px-7 py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
              >
                去结算{cart.checkedItems.length > 0 ? `（${cart.checkedItems.reduce((n, it) => n + it.qty, 0)}）` : ''}
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
