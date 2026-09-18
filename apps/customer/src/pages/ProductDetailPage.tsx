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
import { Minus, Plus, Store } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackButton } from '../components/PageHeader';
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
      <div className="px-[22px] py-6">
        <div className="h-[300px] animate-pulse rounded-panel bg-sunken" />
        <div className="mt-4 h-5 w-2/3 animate-pulse rounded-tag bg-sunken" />
        <div className="mt-2 h-5 w-1/3 animate-pulse rounded-tag bg-sunken" />
      </div>
    );
  }
  if (productQ.isError || !product) {
    return (
      <div className="flex flex-col items-center px-[22px] py-16">
        <img src="/brand/empty-appointments-800.png" alt="商品不存在" className="w-48 max-w-full rounded-panel" />
        <p className="mt-4 text-title">
          {productQ.isError ? friendlyError(productQ.error, '商品不存在或已下架') : '商品不存在或已下架'}
        </p>
        <Link
          to="/mall"
          className="mt-6 flex items-center rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          返回商城
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-32">
      {toastEl}

      {/* 大图轮（U4-D3 对齐试样 .pdp-hero：高 300px 通栏，可横滑多图） */}
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
              <ProductImage src={u} alt={`${product.name} 图 ${i + 1}`} className="h-[300px] w-full" />
            </div>
          ))}
        </div>
        {/* 返回按钮（U1-A：统一圆钮 36px，主图通栏场景保持浮动形态；试样 .nav .back） */}
        <BackButton className="absolute left-4 top-4" />
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

      {/* 信息区（试样 .pdp-body：米白面 -22px 叠上主图，顶圆角取四档 panel 20） */}
      <div className="relative -mt-[22px] rounded-t-panel bg-canvas px-[22px] pt-5">
        <h1 className="text-title font-bold">{product.name}</h1>
        {/* 价格行（试样 .pdp-price：大价 24px 越字阶闸门→取 20 text-price，墨色非柠檬字） */}
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <p className="u1-num text-price font-bold text-ink">{fenToYuan(product.priceFen)}</p>
            {/* U1-G 会员价（诚实处理，U4-D3 登记）：无折扣引擎/会员价字段——不显示价格数字；
                试样薄荷小签位以诚实提示填充（细则上线后替换为真实会员价） */}
            <span
              data-testid="pdp-member-price-note"
              className="rounded-chip bg-brand-secondary/35 px-[7px] py-0.5 text-caption-xs font-semibold text-ink"
            >
              会员价细则即将公布
            </span>
          </div>
          {soldOut ? (
            <span className="rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">已售罄</span>
          ) : stock < 10 ? (
            <span className="rounded-chip bg-danger-light px-2 py-0.5 font-number text-caption-xs text-danger-deep">
              仅剩 {stock} 件
            </span>
          ) : null}
        </div>
        <p className="mt-2.5 flex items-center gap-1 text-caption text-ink-secondary">
          <Store className="h-3.5 w-3.5" strokeWidth={1.5} />
          {storeName} · 门店同价 · 正品保障
        </p>

        {/* 详情描述（真实字段；试样规格表/评价区无真实字段来源，不出——U4-D3 登记） */}
        {product.description ? (
          <div className="u1-card mt-4 p-4">
            <p className="text-body-sm font-semibold">商品详情</p>
            <p className="mt-2 whitespace-pre-line text-body-sm leading-relaxed text-ink-secondary">
              {product.description}
            </p>
          </div>
        ) : null}
      </div>

      {/* 底部固定栏（U1-A 起 PDP 为详情级无 dock，落底 safe-area；
          U4-D3 对齐试样 .pdp-bar：左=数量步进 pill（bg ink-06 全圆）+
          「加入购物袋」墨底米白字 +「立即购买 · ¥X」柠檬底墨字，控件档圆角 14；
          试样底栏无购物袋入口——移除（购物袋经商城页头 pill 可达，登记）） */}
      <div className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky border-t border-[rgba(74,59,46,.09)] bg-card">
        <div className="mx-auto flex max-w-lg items-center gap-2.5 px-4 pb-4 pt-3">
          {!soldOut ? (
            <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-sunken p-[3px]">
              <button
                type="button"
                aria-label="减少数量"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-ink transition disabled:opacity-40"
              >
                <Minus className="h-4 w-4" strokeWidth={2} />
              </button>
              <span className="u1-num min-w-5 text-center text-body-sm font-bold">{qty}</span>
              <button
                type="button"
                aria-label="增加数量"
                disabled={qty >= Math.min(stock, MAX_QTY)}
                onClick={() => setQty((q) => Math.min(Math.min(stock, MAX_QTY), q + 1))}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-ink transition disabled:opacity-40"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={soldOut}
            onClick={handleAddCart}
            data-testid="pdp-add-cart"
            className="flex-1 rounded-control bg-ink py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
          >
            加入购物袋
          </button>
          <button
            type="button"
            disabled={soldOut}
            onClick={handleBuyNow}
            data-testid="pdp-buy-now"
            className="flex-1 rounded-control bg-brand-primary py-[13px] text-body-sm font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
          >
            {soldOut ? '已售罄' : (
              <>
                立即购买 · <span className="u1-num">{fenToYuan(product.priceFen * qty)}</span>
              </>
            )}
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
