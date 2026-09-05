/**
 * 商品详情 /mall/product/:id（T5.3）
 *
 * - 大图轮（多图横滑：scroll-snap + 圆点指示，无额外依赖）；
 * - 名称 / 价格 / 库存（<10 显示「仅剩 N 件」，0 显示已售罄并禁用购买）/ 详情描述 / 店铺名；
 * - 底部固定栏（TabBar 之上）：购物车入口（角标动画）+「加入购物车」+「立即购买」；
 * - 单店限制：跨店加车返回 conflict → ConfirmSheet 确认「清空原购物车」→ replaceWith
 *   （对齐服务端 createOrder 的 BAD_REQUEST 口径）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Minus, Plus, Store } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CartLink from '../components/mall/CartLink';
import { CartProvider, MAX_QTY, useCart, type AddInput } from '../components/mall/cartStore';
import ConfirmSheet from '../components/mall/ConfirmSheet';
import { fenToYuan } from '../components/mall/format';
import { friendlyError, useMallToast } from '../components/mall/MallToast';
import ProductImage from '../components/mall/ProductImage';

function DetailInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { trpc } = usePhiliaClient();
  const cart = useCart();
  const { toastEl, showToast } = useMallToast();

  const [qty, setQty] = useState(1);
  const [slide, setSlide] = useState(0);
  const [pendingAdd, setPendingAdd] = useState<AddInput | null>(null); // 跨店冲突待确认
  const trackRef = useRef<HTMLDivElement | null>(null);

  const productQ = useQuery({
    queryKey: ['mall', 'getProduct', id],
    queryFn: () => trpc.mall.getProduct.query({ productId: id! }),
    enabled: !!id,
    retry: false,
  });

  const product = productQ.data?.product;
  const storeName = productQ.data?.storeName ?? '菲丽亚门店';
  const images = (product?.images ?? []).filter((u): u is string => !!u);
  const stock = product?.stock ?? 0;
  const soldOut = stock <= 0;

  const buildAddInput = (): AddInput | null =>
    product
      ? {
          productId: product.id,
          storeId: product.storeId,
          storeName,
          name: product.name,
          priceFen: product.priceFen,
          image: images[0] ?? null,
          stock,
          qty,
        }
      : null;

  const handleAddCart = () => {
    const input = buildAddInput();
    if (!input) return;
    const result = cart.addItem(input);
    if (result === 'conflict') {
      setPendingAdd(input);
      return;
    }
    showToast('已加入购物车', 'info');
  };

  const handleBuyNow = () => {
    const input = buildAddInput();
    if (!input) return;
    navigate('/mall/checkout', { state: { buyNow: input } });
  };

  /* ---------------- 异常态 ---------------- */
  if (productQ.isPending) {
    return (
      <div className="px-4 py-6">
        <div className="aspect-square animate-pulse rounded-card bg-sunken" />
        <div className="mt-4 h-5 w-2/3 animate-pulse rounded-tag bg-sunken" />
        <div className="mt-2 h-5 w-1/3 animate-pulse rounded-tag bg-sunken" />
      </div>
    );
  }
  if (productQ.isError || !product) {
    return (
      <div className="flex flex-col items-center px-4 py-16">
        <img src="/brand/empty-appointments-800.png" alt="商品不存在" className="w-48 max-w-full rounded-card" />
        <p className="mt-4 text-title">
          {productQ.isError ? friendlyError(productQ.error, '商品不存在或已下架') : '商品不存在或已下架'}
        </p>
        <Link
          to="/mall"
          className="mt-6 flex h-11 items-center rounded-full bg-brand-primary px-8 text-body font-medium text-white transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          返回商城
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-32">
      {toastEl}

      {/* 大图轮 */}
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={() => {
            const el = trackRef.current;
            if (!el || el.clientWidth === 0) return;
            setSlide(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(images.length > 0 ? images : [null]).map((u, i) => (
            <div key={i} className="w-full shrink-0 snap-center">
              <ProductImage src={u} alt={`${product.name} 图 ${i + 1}`} className="aspect-square w-full" />
            </div>
          ))}
        </div>
        {/* 返回按钮 */}
        <button
          type="button"
          aria-label="返回"
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={1.5} />
        </button>
        {/* 圆点指示 */}
        {images.length > 1 ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === slide ? 'w-4 bg-brand-primary' : 'w-1.5 bg-card/80'
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* 信息区 */}
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-number text-price text-brand-primary">{fenToYuan(product.priceFen)}</p>
          {soldOut ? (
            <span className="rounded-full bg-sunken px-2.5 py-1 text-caption text-ink-placeholder">已售罄</span>
          ) : stock < 10 ? (
            <span className="rounded-full bg-danger-light px-2.5 py-1 font-number text-caption text-danger-deep">
              仅剩 {stock} 件
            </span>
          ) : null}
        </div>
        <h1 className="mt-2 text-title-lg">{product.name}</h1>
        <p className="mt-1.5 flex items-center gap-1 text-caption text-ink-secondary">
          <Store className="h-3.5 w-3.5" strokeWidth={1.5} />
          {storeName} · 门店同价 · 正品保障
        </p>

        {/* 数量 */}
        {!soldOut ? (
          <div className="mt-4 flex items-center justify-between rounded-card bg-card p-3.5 shadow-card">
            <span className="text-body text-ink-secondary">购买数量</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="减少数量"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken text-ink transition disabled:opacity-40"
              >
                <Minus className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <span className="w-8 text-center font-number text-body">{qty}</span>
              <button
                type="button"
                aria-label="增加数量"
                disabled={qty >= Math.min(stock, MAX_QTY)}
                onClick={() => setQty((q) => Math.min(Math.min(stock, MAX_QTY), q + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken text-ink transition disabled:opacity-40"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : null}

        {/* 详情描述 */}
        {product.description ? (
          <div className="mt-3 rounded-card bg-card p-4 shadow-card">
            <p className="text-title">商品详情</p>
            <p className="mt-2 whitespace-pre-line text-body leading-relaxed text-ink-secondary">
              {product.description}
            </p>
          </div>
        ) : null}
      </div>

      {/* 底部固定栏（TabBar 之上） */}
      <div className="fixed inset-x-0 bottom-14 z-sticky border-t border-line-divider bg-card">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <CartLink className="shadow-none" />
          <button
            type="button"
            disabled={soldOut}
            onClick={handleAddCart}
            className="h-11 flex-1 rounded-full bg-brand-secondary text-body font-medium text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
          >
            加入购物车
          </button>
          <button
            type="button"
            disabled={soldOut}
            onClick={handleBuyNow}
            className="h-11 flex-1 rounded-full bg-philia-gradient text-body font-medium text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
          >
            {soldOut ? '已售罄' : '立即购买'}
          </button>
        </div>
      </div>

      {/* 跨店加车确认 */}
      <ConfirmSheet
        open={!!pendingAdd}
        title="购物车仅限同一门店商品"
        desc={`购物车内已有「${cart.items[0]?.storeName ?? '其他门店'}」的商品，加入本商品将清空原购物车。`}
        confirmText="清空并加入"
        onCancel={() => setPendingAdd(null)}
        onConfirm={() => {
          if (pendingAdd) {
            cart.replaceWith(pendingAdd);
            showToast('已清空原购物车并加入本商品', 'info');
          }
          setPendingAdd(null);
        }}
      />
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <CartProvider>
      <DetailInner />
    </CartProvider>
  );
}
