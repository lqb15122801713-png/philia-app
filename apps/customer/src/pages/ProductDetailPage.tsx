/**
 * 商品详情 /mall/product/:id（T5.3；换皮批片 2 落 M-02 定稿：图 270 圆角 20 /
 * 名 18/800 + 价 mono 19/700 / 回馈金返显卡（APP-18 按档返，rebateBp=0 不渲染）/
 * 吸底 ctabar 渐出底 + 深棕主钮）
 *
 * - 大图轮（多图横滑：scroll-snap + 圆点指示，无额外依赖）；
 * - 名称 / 价格 / 库存（<10 显示「仅剩 N 件」，0 显示已售罄并禁用购买）/ 详情描述 / 店铺名；
 * - 底部吸底栏（详情级无 dock，落底 safe-area）：数量步进 +「加入购物袋」+「立即购买」；
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
import { mc } from '../components/member/copy';

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

  /* 回馈金返显（M-02 定稿；口径 APP-18：membership.my 的 plan.rebateBp 万分比，
     返 Fen=round(priceFen*qty*rebateBp/10000)；非会员/免费档=0 不渲染假数。
     到账日读 membership.plans 全局键 rebateSettlementDay，缺省不带到账段） */
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
    retry: false,
  });
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 300_000,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  const settleDay = plansQ.data?.rebateSettlementDay;
  const rebateFen = product && rebateBp > 0 ? Math.round((product.priceFen * qty * rebateBp) / 10000) : 0;

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
        <div className="h-[270px] animate-pulse rounded-panel bg-sunken" />
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

      {/* 大图轮（片 2 M-02 定稿：图 270 高、圆角 20 卡内横滑 scroll-snap + 圆点指示，
          多图能力保留；返回钮浮于图上左上角） */}
      <div className="px-[22px] pt-3">
        <div className="relative overflow-hidden rounded-panel">
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
                <ProductImage src={u} alt={`${product.name} 图 ${i + 1}`} className="h-[270px] w-full" />
              </div>
            ))}
          </div>
          {/* 返回按钮（U1-A：统一圆钮 36px，主图场景保持浮动形态） */}
          <BackButton className="absolute left-3 top-3" />
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
      </div>

      {/* 信息区（片 2 M-02 定稿：名 18/800 + 价 mono 19/700 基线两端；mono 10 灰注记行） */}
      <div className="px-[22px]">
        <div className="mt-3.5 flex items-baseline justify-between gap-3">
          <h1 className="text-[18px] font-extrabold leading-6">{product.name}</h1>
          <p className="u1-num shrink-0 text-[19px] font-bold text-ink">{fenToYuan(product.priceFen)}</p>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          {/* U1-G 会员价槽位（诚实处理，U4-D3 登记）：无折扣引擎/会员价字段——不显示价格数字；
              片 2 红线 3：槽位置灰注记统一「即将点亮」 */}
          <span
            data-testid="pdp-member-price-note"
            aria-disabled="true"
            className="rounded-chip bg-brand-secondary/35 px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary opacity-60"
          >
            会员价 · 即将点亮
          </span>
          {soldOut ? (
            <span className="rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">已售罄</span>
          ) : stock < 10 ? (
            <span className="rounded-chip bg-danger-light px-2 py-0.5 font-number text-caption-xs text-danger-deep">
              仅剩 {stock} 件
            </span>
          ) : null}
        </div>
        {/* 溯源行（mono 10 muted；M-02 定稿「全员同价」注记位，文案口径保留既有） */}
        <p className="mt-2 flex items-center gap-1 font-number text-[10px] text-ink-secondary">
          <Store className="h-3.5 w-3.5" strokeWidth={1.5} />
          {storeName} · 门店同价 · 正品保障
        </p>

        {/* 回馈金返显卡（M-02 定稿：白卡 + 淡黄点睛圆点 8 + 12/600；rebateBp=0 不渲染） */}
        {rebateFen > 0 ? (
          <div className="u1-card mt-3 flex items-center gap-2.5 px-3.5 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />
            <p className="text-caption font-semibold">
              {settleDay
                ? mc('mall.rebateEarnCard', { amt: fenToYuan(rebateFen), day: settleDay })
                : mc('mall.rebateEarnCardNoDay', { amt: fenToYuan(rebateFen) })}
            </p>
          </div>
        ) : null}

        {/* 详情描述（真实字段；试样规格表/评价区无真实字段来源，不出——U4-D3 登记；
            片 2 M-02：截面题 16/800） */}
        {product.description ? (
          <>
            <div className="mb-3 mt-6 flex items-baseline justify-between">
              <h2 className="text-v2-section">商品详情</h2>
            </div>
            <div className="u1-card p-4">
              <p className="whitespace-pre-line text-body-sm leading-relaxed text-ink-secondary">
                {product.description}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* 吸底 CTA（片 2 M-02 定稿 ctabar：渐出底 linear-gradient(transparent→纸白 40%)、
          去顶描边；左=数量步进 pill（bg 卡其浅底 #F1E9D6 全圆）+「加入购物袋」白卡细线次钮
          +「立即购买」深棕底 16/700 主钮（sub mono 10.5 总价）；控件档圆角 18；
          详情级无 dock，落底 safe-area） */}
      <div
        className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
        style={{ background: 'linear-gradient(transparent, #FAF8F2 40%)' }}
      >
        <div className="mx-auto flex max-w-lg items-stretch gap-2.5 px-4 pb-4 pt-3">
          {!soldOut ? (
            <div className="flex shrink-0 items-center gap-0.5 self-center rounded-full bg-brand-secondary-light p-[3px]">
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
            className="u1-ring flex-1 rounded-[18px] bg-card py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
          >
            加入购物袋
          </button>
          <button
            type="button"
            disabled={soldOut}
            onClick={handleBuyNow}
            data-testid="pdp-buy-now"
            className="flex flex-[1.4] flex-col items-center justify-center rounded-[18px] bg-[#2E2318] py-3 text-body-lg font-bold text-[#F6EFDD] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
          >
            <span>{soldOut ? '已售罄' : '立即购买'}</span>
            {!soldOut ? (
              <span className="mt-0.5 font-number text-[10.5px] font-normal text-[#C9BBA0]">
                共 {fenToYuan(product.priceFen * qty)}
              </span>
            ) : null}
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
