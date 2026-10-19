import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CartProvider, MAX_QTY, readRebatePreference, useCart, writeRebatePreference, type CartItem } from '../components/mall/cartStore';
import { EmptyState } from '../components/home/common';
import { fenToYuan } from '../components/mall/format';
import { mlc } from '../copy/mall';
import { useToast } from '@philia/shared';
import PageHeader from '../components/PageHeader';
import ProductImage from '../components/mall/ProductImage';
import { mc } from '../components/member/copy';
import { readLastBooking } from '@/lib/bookingPrefill';

const CART_DEFAULT_ORDER = ['cart.head', 'cart.empty', 'cart.storeNote', 'cart.rows', 'cart.ctaBar'] as const;

function CheckDot({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle} className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full transition ${checked ? 'bg-brand-primary' : 'border-[1.5px] border-line-strong bg-card'}`}>
        {checked ? <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.5} /> : null}
      </span>
    </button>
  );
}

function CartRow({ item, managing }: { item: CartItem; managing: boolean }) {
  const cart = useCart();
  const cap = Math.max(1, Math.min(item.stock, MAX_QTY));
  return (
    <article className="flex gap-3 py-3.5" data-testid={`cart-row-${item.productId}`}>
      {managing ? (
        <div className="flex items-center">
          <CheckDot checked={item.checked} onToggle={() => cart.toggle(item.productId)} label={`选择 ${item.name}`} />
        </div>
      ) : null}
      <Link to={`/mall/product/${item.productId}`} className="shrink-0">
        <ProductImage src={item.image} alt={item.name} className="h-14 w-14 rounded-[12px]" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/mall/product/${item.productId}`} className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-bold leading-[18px]">{item.name}</p>
            <p className="mt-0.5 text-[12px] text-ink-secondary" data-u4-secondary>{mlc('mall.cartMemberMeta')}</p>
          </Link>
          {managing ? (
            <button type="button" aria-label={`删除 ${item.name}`} onClick={() => cart.remove(item.productId)} className="shrink-0 p-1 text-ink-placeholder transition hover:text-danger">
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="u1-num text-body-sm font-bold text-ink">{fenToYuan(item.priceFen)}</p>
          <div className="flex items-center gap-2.5">
            <button type="button" aria-label="减少数量" disabled={item.qty <= 1} onClick={() => cart.setQty(item.productId, item.qty - 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand-secondary-light text-ink transition disabled:opacity-40">
              <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <span className="min-w-[18px] text-center font-number text-[13px] font-bold tabular-nums">{item.qty}</span>
            <button type="button" aria-label="增加数量" disabled={item.qty >= cap} onClick={() => cart.setQty(item.productId, item.qty + 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand-secondary-light text-ink transition disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        {item.qty >= cap && item.stock < MAX_QTY ? (
          <p className="mt-0.5 text-right text-[12px] text-ink-placeholder" data-u4-secondary>
            <CK k="mall.cartStockNote">{mlc('mall.cartStockNote', { n: item.stock })}</CK>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function CartInner() {
  const cart = useCart();
  const navigate = useNavigate();
  const { trpc } = usePhiliaClient();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });
  const [managing, setManaging] = useState(false);
  const [useRebate, setUseRebate] = useState(() => readRebatePreference());

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
    retry: false,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  const balanceFen = myQ.data?.rebate?.balanceFen ?? 0;
  const rebateFen = rebateBp > 0 ? Math.round((cart.checkedTotalFen * rebateBp) / 10000) : 0;
  const deductionFen = useRebate ? Math.min(balanceFen, cart.checkedTotalFen) : 0;
  const payableFen = Math.max(0, cart.checkedTotalFen - deductionFen);

  const isCanvasPreview = useMemo(() => new URLSearchParams(window.location.search).get('canvasPreview') === '1', []);
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), []);
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, []);
  const cartStoreId = previewStoreId ?? cart.items[0]?.storeId ?? memoryStoreId ?? null;
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  });
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? []).filter((b) => b.pageKey === 'cart').sort((a, b) => a.sortOrder - b.sortOrder);
    return items.length > 0 ? items : CART_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));
  }, [blocksQ.data]);
  const layout = useCanvasLayout('cart', cartStoreId, registryBlocks);

  const handleCheckout = () => {
    if (cart.checkedItems.length === 0) {
      showToast(mlc('mall.cartNeedCheck'), 'error');
      return;
    }
    navigate('/mall/checkout');
  };

  const renderers: Record<string, () => ReactNode> = {
    'cart.head': () => (
      <PageHeader
        title={<CK k="mall.cartTitle">{mlc('mall.cartTitle')}</CK>}
        right={cart.items.length > 0 ? (
          <button type="button" data-testid="cart-manage" onClick={() => setManaging((v) => !v)} className="text-[12px] font-medium text-ink-secondary" data-u4-secondary>
            {managing ? mlc('mall.cartManageClose') : mlc('mall.cartManage')}
          </button>
        ) : null}
      />
    ),
    'cart.empty': () =>
      cart.items.length === 0 ? (
        <div className="flex min-h-[56vh] flex-col justify-center">
          <EmptyState
            title={mlc('mall.cartEmptyTitle')}
            desc={<CK k="mall.cartEmptyBody">{mlc('mall.cartEmptyBody').split('\n').map((line, i, arr) => <Fragment key={i}>{line}{i < arr.length - 1 ? <br /> : null}</Fragment>)}</CK>}
            action={<Link to="/mall" className="inline-flex items-center rounded-control bg-brand-cta px-[30px] py-[13px] text-body-sm font-semibold text-brand-cta-on"><CK k="mall.cartEmptyCta">{mlc('mall.cartEmptyCta')}</CK></Link>}
          />
        </div>
      ) : null,
    'cart.storeNote': () =>
      cart.items.length > 0 ? (
        <p className="mt-2 text-[12px] text-ink-secondary" data-testid="cart-store-note" data-u4-secondary>
          <CK k="mall.cartStoreNote">{mlc('mall.cartStoreNote', { store: cart.items[0]?.storeName ?? '' })}</CK>
        </p>
      ) : null,
    'cart.rows': () =>
      cart.items.length > 0 ? (
        <>
          <div className="u1-card mt-3 divide-y divide-line-divider px-4">
            {cart.items.map((it) => <CartRow key={it.productId} item={it} managing={managing} />)}
          </div>
          <section className="u1-card mt-3 p-4" data-testid="cart-rebate-card">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-sm font-bold">{mlc('mall.rebateUse')}</p>
                <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>
                  {mlc('mall.rebateBalanceLimit', { balance: fenToYuan(balanceFen), amt: fenToYuan(deductionFen) })}
                </p>
                <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>
                  {mlc('mall.rebateDeduct')} <span data-testid="cart-deduction" className="font-number tabular-nums">-{fenToYuan(deductionFen)}</span>
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useRebate}
                aria-label={mlc('mall.rebateUse')}
                data-testid="cart-rebate-switch"
                onClick={() => {
                  const next = !useRebate;
                  writeRebatePreference(next);
                  setUseRebate(next);
                }}
                className={`relative h-8 w-14 shrink-0 rounded-full transition ${useRebate ? 'bg-brand-cta' : 'bg-brand-secondary-light'}`}
              >
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-card transition ${useRebate ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </section>
          {rebateFen > 0 ? (
            <p className="mt-2 text-[12px] text-ink-secondary" data-u4-secondary>{mlc('mall.cartEarnAfter', { amt: fenToYuan(rebateFen) })}</p>
          ) : null}
        </>
      ) : null,
    'cart.ctaBar': () =>
      cart.items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky" style={{ background: 'linear-gradient(transparent, #FAF7F0 40%)' }}>
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-4 pt-3">
            <div className="min-w-0">
              <p className="text-[12px] text-ink-secondary" data-u4-secondary><CK k="mall.cartTotalLabel">{mlc('mall.cartTotalLabel')}</CK></p>
              <p className="flex items-baseline gap-2">
                <span data-testid="cart-payable" className="u1-num text-[19px] font-bold text-ink">{fenToYuan(payableFen)}</span>
                {deductionFen > 0 ? <span className="text-[12px] text-ink-secondary" data-u4-secondary>{mlc('mall.cartRebateSaved', { amt: fenToYuan(deductionFen) })}</span> : null}
              </p>
            </div>
            <button type="button" disabled={cart.checkedItems.length === 0} onClick={handleCheckout} data-testid="cart-checkout" className="shrink-0 rounded-full bg-brand-cta px-6 py-3 text-body-sm font-bold text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40">
              <CK k="mall.cartCheckout">{mlc('mall.cartCheckout')}</CK>
            </button>
          </div>
        </div>
      ) : null,
  };

  return (
    <CanvasLayoutLoader pageKey="cart" storeId={cartStoreId}>
      <div className="px-[22px] pb-32 pt-4">
        {toastEl}
        {isCanvasPreview ? <p className="mb-2 text-center text-[12px] text-ink-secondary" data-testid="cart-canvas-preview-note">{mc('mc.canvasExampleNote')}</p> : null}
        {layout.map((b) => b.visible ? <section data-block-key={b.blockKey} key={b.blockKey}>{renderers[b.blockKey]?.() ?? null}</section> : null)}
      </div>
    </CanvasLayoutLoader>
  );
}

export default function CartPage() {
  return <CartProvider><CartInner /></CartProvider>;
}
