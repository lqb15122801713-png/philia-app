/**
 * 商品详情 /mall/product/:id · U4 定稿面：全宽主图、名称／会员价信息位、
 * 回馈金条、可解析规格、成分描述、评价与收藏；吸底仅保留「加入购物车」闸口。
 * 商品仍全员同价，会员价信息位与现价同值，不虚构折扣；真图缺失走诚实缺图说明。
 * 既有画布预览、评价、收藏、跨店确认与库存闸口保留。
 */

import { CanvasLayoutLoader, CK, Skeleton, slotContentOf, resolveSlotUrl, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Plus, Star, Store } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { BackButton } from '../components/PageHeader';
import { CartProvider, useCart, type AddInput } from '../components/mall/cartStore';
import ConfirmSheet from '../components/mall/ConfirmSheet';
import { fenToYuan } from '../components/mall/format';
import { friendlyError, getApiBase, uploadImage, useToast } from '@philia/shared';
import ProductImage from '../components/mall/ProductImage';
import { Sheet } from '../components/member/v2';
import { fmtDateTime } from '../components/account/common';
import { mlc } from '../copy/mall';
import { mc } from '../components/member/copy';
import { fvc } from '../copy/favorites';
import { rvc } from '../copy/productReviews';

type Trpc = ReturnType<typeof usePhiliaClient>['trpc'];
type ReviewRow = Awaited<ReturnType<Trpc['mall']['productReviews']['query']>>['items'][number];

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const PDP_DEFAULT_ORDER = [
  'pdp.gallery',
  'pdp.info',
  'pdp.rebateCard',
  'pdp.detail',
  'pdp.reviews',
  'pdp.ctaBar',
] as const;

type ProductData = Awaited<ReturnType<Trpc['mall']['getProduct']['query']>>['product'];

/* 候裁清零批 件 6（预览兜底示例·客户端合成件）：canvasPreview=1 且 'preview' 顶替
   （listProducts 首条）查不到真商品时，用屏内合成示例商品渲染块流——假名「示例商品·
   画布预览」，价格/库存=固定示例值，图=空数组走占位图，零真数据零写库（水印注记页首
   已有；加购/立即购买两钮在示例态被拦为水印提示，不进购物车不跳结算）。真用户页零改动 */
function exampleProductOf(): ProductData {
  return {
    id: 'canvas-example-product',
    storeId: 'canvas-example-store',
    name: '示例商品·画布预览（猫咪冻干零食）',
    description: '示例描述·画布预览：冻干零食 50g，全猫龄适用。',
    images: [],
    priceFen: 19900,
    stock: 20,
  } as unknown as ProductData;
}

/* 片 3：评价星级行（只读展示件；晒单评分 1-5） */
function Stars({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${n} 分`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= n ? 'fill-brand-primary text-brand-primary' : 'text-line-ring'}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

/* 片 3：写评价弹层（仅 received 订单可评；晒图走既有 /api/upload 链 ≤3 张） */
function ReviewSheet({
  open,
  orderId,
  productId,
  showToast,
  onClose,
  onDone,
}: {
  open: boolean;
  orderId: string | null;
  productId: string;
  showToast: (msg: string, kind?: 'info' | 'error') => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const { trpc } = usePhiliaClient();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const submitM = useMutation({
    mutationFn: () =>
      trpc.mall.reviewProduct.mutate({
        orderId: orderId!,
        productId,
        rating,
        text: text.trim() || undefined,
        photoUrls: photos.length > 0 ? photos : undefined,
        anonymous: anonymous || undefined,
      }),
    onSuccess: () => {
      showToast(rvc('rev.toastOk'), 'info');
      onDone();
      onClose();
    },
    onError: (err) => showToast(friendlyError(err, rvc('rev.submitFail'), 80), 'error'),
  });

  const onPickPhoto = async (file: File) => {
    setUploading(true);
    try {
      const up = await uploadImage(getApiBase(), file, 'review/product');
      setPhotos((p) => [...p, up.url].slice(0, 3));
    } catch (e) {
      showToast(friendlyError(e, rvc('rev.photoUploadFail'), 80), 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={rvc('rev.sheetTitle')}>
      <div className="mt-3">
        <p className="mb-1.5 font-number text-v2-trace text-ink-secondary"><CK k="rev.ratingLabel">{rvc('rev.ratingLabel')}</CK></p>
        <div className="flex gap-1.5" data-testid="review-rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" aria-label={`${i} 分`} onClick={() => setRating(i)} className="p-1">
              <Star
                className={`h-6 w-6 ${i <= rating ? 'fill-brand-primary text-brand-primary' : 'text-line-ring'}`}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={rvc('rev.textPlaceholder')}
          maxLength={500}
          rows={3}
          className="mt-3 w-full resize-none rounded-input border border-line bg-canvas px-3.5 py-2.5 text-body outline-none transition placeholder:text-ink-placeholder focus:border-ink"
        />
        {/* 晒图（≤3 张，既有 /api/upload 链 relDir='review/product'） */}
        <div className="mt-3 flex items-center gap-2">
          {photos.map((u, i) => (
            <button
              key={u}
              type="button"
              aria-label={`删除晒图 ${i + 1}`}
              onClick={() => setPhotos((p) => p.filter((x) => x !== u))}
              className="relative"
            >
              <ProductImage src={u} alt="" className="h-14 w-14 rounded-control" />
            </button>
          ))}
          {photos.length < 3 ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              data-testid="review-photo-add"
              className="u1-ring flex h-14 w-14 flex-col items-center justify-center rounded-control bg-card text-caption-xs text-ink-secondary"
            >
              <Plus className="h-4 w-4" strokeWidth={1.8} />
              <CK k="rev.photoAdd">{rvc('rev.photoAdd')}</CK>
            </button>
          ) : null}
          <span className="ml-auto font-number text-[9.5px] text-ink-placeholder"><CK k="rev.photoLimit">{rvc('rev.photoLimit')}</CK></span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickPhoto(f);
            }}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-caption text-ink-secondary">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          <CK k="rev.anonymous">{rvc('rev.anonymous')}</CK>
        </label>
        <button
          type="button"
          disabled={!orderId || submitM.isPending || uploading}
          onClick={() => submitM.mutate()}
          data-testid="review-submit"
          className="mt-4 flex w-full items-center justify-center rounded-[18px] bg-brand-cta py-3 text-body font-bold text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
        >
          {submitM.isPending ? <CK k="rev.submitting">{rvc('rev.submitting')}</CK> : <CK k="rev.submit">{rvc('rev.submit')}</CK>}
        </button>
      </div>
    </Sheet>
  );
}

function DetailInner() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { trpc } = usePhiliaClient();
  const queryClient = useQueryClient();
  const cart = useCart();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

  const [slide, setSlide] = useState(0);
  const [pendingAdd, setPendingAdd] = useState<AddInput | null>(null); // 跨店冲突待确认
  /* 片 3：写评价弹层（订单列表「写评价」入口带 reviewOrderId 直入——初始即开，免 effect 级联） */
  const reviewEntryOrderId = (location.state as { reviewOrderId?: string } | null)?.reviewOrderId ?? null;
  const [reviewOpen, setReviewOpen] = useState(() => reviewEntryOrderId !== null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  /* ---- 画布全屏批 片 3 画布化入册：探针参 + 预览顶替 + 店锚 + 注册表块序/有效布局 ---- */
  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  );
  /* 画布布局店锚（?canvasStore= 预览店锚 > 商品所在店 product.storeId 既有透出，零新增查询） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), []);
  /* 带参路由预览顶替：canvasPreview=1 且 params.id==='preview'（预览 URL=/mall/product/preview）
     时，取商品列表首条顶替——片 3 复走补修：原缓存读取（getQueriesData）冷启动顶签/iframe
     直开时缓存为空恒落空，换真查询（listProducts 公开读同端点，店锚随参，preview 态才启用，
     页外零影响）；查不到=件 6 合成示例商品顶替（零真数据零写库），不再落空态 */
  const previewFirstQ = useQuery({
    queryKey: ['mall', 'listProducts', 'canvasPreviewFirst', previewStoreId ?? ''],
    queryFn: () => trpc.mall.listProducts.query({ storeId: previewStoreId ?? undefined, page: 1, pageSize: 1 }),
    enabled: isCanvasPreview && id === 'preview',
    staleTime: 60_000,
    retry: false,
  });
  const previewProductId = isCanvasPreview && id === 'preview' ? (previewFirstQ.data?.items?.[0]?.id ?? null) : null;
  /* 件 6：预览顶替未命中（首条查询已完成/失败但无商品）→ 合成示例商品 */
  const previewMiss = isCanvasPreview && id === 'preview' && !previewFirstQ.isPending && previewProductId === null;
  const pid = previewProductId ?? id;

  const productQ = useQuery({
    queryKey: ['mall', 'getProduct', pid],
    queryFn: () => trpc.mall.getProduct.query({ productId: pid! }),
    enabled: !!pid,
    retry: false,
  });

  /* 片 3：收藏钮（favCheck 初态 + favToggle 幂等；已收藏实色）。
     件 6：合成示例态（previewMiss）不拉收藏/评价真查询（pid='preview' 假 id，零增发） */
  const favQ = useQuery({
    queryKey: ['mall', 'favCheck', pid],
    queryFn: () => trpc.mall.favCheck.query({ productId: pid! }),
    enabled: !!pid && !previewMiss,
    retry: false,
  });
  const faved = favQ.data?.fav ?? false;
  const favM = useMutation({
    mutationFn: () => trpc.mall.favToggle.mutate({ productId: pid! }),
    onSuccess: (r) => {
      showToast(r.fav ? fvc('fav.addToast') : fvc('fav.removeToast'), 'info');
      void queryClient.invalidateQueries({ queryKey: ['mall', 'favCheck', pid] });
      void queryClient.invalidateQueries({ queryKey: ['mall', 'favList'] });
    },
    onError: (err) => showToast(friendlyError(err, fvc('fav.toggleFail'), 80), 'error'),
  });

  /* 片 3：商品评价区（productReviews 列表+均分+晒单图墙；page 分页加载更多） */
  const reviewsQ = useInfiniteQuery({
    queryKey: ['mall', 'productReviews', pid],
    queryFn: ({ pageParam }) => trpc.mall.productReviews.query({ productId: pid!, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: !!pid && !previewMiss,
    retry: false,
  });
  const reviewRows: ReviewRow[] = reviewsQ.data?.pages.flatMap((p) => p.items) ?? [];
  const reviewAvg = reviewsQ.data?.pages[0]?.avgRating ?? null;
  const reviewCount = reviewsQ.data?.pages[0]?.total ?? 0;

  /* 片 3：写评价闸=仅 received 订单可评（一单一件一评；listMyOrders 同源找可评单） */
  const ordersQ = useQuery({
    queryKey: ['mall', 'listMyOrders'],
    queryFn: () => trpc.mall.listMyOrders.query(),
    retry: false,
  });
  const eligibleOrder = (
    (ordersQ.data?.groups as Record<string, Array<{ id: string; items: Array<{ product_id: string }> }>> | undefined)
      ?.received ?? []
  ).find((o) => o.items.some((it) => it.product_id === pid));
  const reviewOrderId = reviewEntryOrderId ?? eligibleOrder?.id ?? null;

  const product = previewMiss ? exampleProductOf() : productQ.data?.product;
  const storeName = previewMiss ? '示例门店·画布预览' : (productQ.data?.storeName ?? mlc('mall.storeFallback'));
  const images = (product?.images ?? []).filter((u): u is string => !!u);
  const stock = product?.stock ?? 0;
  const soldOut = stock <= 0;
  /* 件 6：合成示例商品的假店 id 不进布局锚（预览店锚缺省=null 走全局布局） */
  const pdpStoreId = previewStoreId ?? (previewMiss ? null : product?.storeId) ?? null;

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
    retry: false,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  const rebateFen = product && rebateBp > 0 ? Math.round((product.priceFen * rebateBp) / 10000) : 0;

  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  });
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'pdp')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return items.length > 0 ? items : PDP_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));
  }, [blocksQ.data]);
  const layout = useCanvasLayout('pdp', pdpStoreId, registryBlocks);

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
          qty: 1,
        }
      : null;

  const handleAddCart = () => {
    if (previewMiss) {
      showToast(mc('mc.canvasExampleNote'), 'info');
      return;
    }
    const input = buildAddInput();
    if (!input) return;
    const result = cart.addItem(input);
    if (result === 'conflict') {
      setPendingAdd(input);
      return;
    }
    showToast(mlc('mall.quickAddToast'), 'info');
  };

  /* ---------------- 异常态（块流外；Loader 照常挂载保布局拉取） ---------------- */
  /* 件 6：previewMiss 合成示例态跳过骨架/空态早退——productQ 对假 id 'preview'
     恒 pending→error，示例商品直接接管渲染 */
  if (productQ.isPending && !previewMiss) {
    return (
      <CanvasLayoutLoader pageKey="pdp" storeId={pdpStoreId}>
        <div className="px-[22px] py-6">
          <Skeleton className="h-[270px] rounded-panel" />
          <Skeleton className="mt-4 h-5 w-2/3 rounded-tag" />
          <Skeleton className="mt-2 h-5 w-1/3 rounded-tag" />
        </div>
      </CanvasLayoutLoader>
    );
  }
  if (!previewMiss && (productQ.isError || !product)) {
    return (
      <CanvasLayoutLoader pageKey="pdp" storeId={pdpStoreId}>
        <div className="flex flex-col items-center px-[22px] py-16">
          <img src={resolveSlotUrl(slotContentOf('pets.emptyIllustration')?.url) ?? '/brand/empty-appointments-800.png'} alt={slotContentOf('pets.emptyIllustration')?.alt ?? mlc('mall.pdpNotFoundAlt')} className="w-48 max-w-full rounded-panel" />
          <p className="mt-4 text-title">
            {productQ.isError ? friendlyError(productQ.error, mlc('mall.pdpNotFound'), 80) : mlc('mall.pdpNotFound')}
          </p>
          <Link
            to="/mall"
            className="mt-6 flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {mlc('mall.pdpBackMall')}
          </Link>
        </div>
      </CanvasLayoutLoader>
    );
  }
  /* 件 6 类型闸：previewMiss 时 product 恒为合成示例（非空）；真用户页 product 为空已在
     上方空态早退——本行仅收窄类型，运行期不触发 */
  if (!product) return null;

  /* 块渲染器（块内逻辑零改动——六块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    'pdp.gallery': () => (
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
              <ProductImage src={u} alt={`${product.name} 图 ${i + 1}`} className="pdp-gallery-media w-full" />
            </div>
          ))}
        </div>
        <div className="absolute left-3 top-3 flex items-center rounded-full bg-card/95 ring-1 ring-line-ring">
          <BackButton className="shadow-none ring-0" />
          <span className="-ml-1 pr-3 text-[12px] font-medium" data-u4-secondary>{mlc('mall.pdpBack')}</span>
        </div>
        <button
          type="button"
          aria-label={faved ? fvc('fav.pdpAdded') : fvc('fav.pdpAdd')}
          aria-pressed={faved}
          disabled={favM.isPending}
          onClick={() => (previewMiss ? showToast(mc('mc.canvasExampleNote'), 'info') : favM.mutate())}
          data-testid="pdp-fav"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/95 ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-90"
        >
          <Heart className={`h-[18px] w-[18px] ${faved ? 'fill-brand-primary text-brand-primary' : 'text-ink'}`} strokeWidth={1.6} />
        </button>
        {images.length > 1 ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-4 bg-brand-primary' : 'w-1.5 bg-card/80'}`} />
            ))}
          </div>
        ) : null}
      </div>
    ),

    'pdp.info': () => (
      <>
        <h1 className="mt-4 text-[18px] font-extrabold leading-6">{product.name}</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary" data-u4-secondary>
          {product.description ?? mlc('mall.pdpStoreLine', { store: storeName })}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <p className="u1-num text-[19px] font-bold text-ink">{fenToYuan(product.priceFen)}</p>
          <span className="font-number text-[12px] tabular-nums text-ink-secondary" data-u4-secondary>
            {mlc('mall.pdpMemberPrice', { amt: fenToYuan(product.priceFen) })}
          </span>
          {soldOut ? (
            <span className="rounded-chip bg-sunken px-2 py-0.5 text-[12px] text-ink-placeholder" data-u4-secondary><CK k="mall.soldOut">{mlc('mall.soldOut')}</CK></span>
          ) : stock < 10 ? (
            <span className="rounded-chip bg-danger-light px-2 py-0.5 font-number text-[12px] text-danger-deep" data-u4-secondary>
              <CK k="mall.pdpStockLeft">{mlc('mall.pdpStockLeft', { n: stock })}</CK>
            </span>
          ) : null}
        </div>
        <p className="mt-2 flex items-center gap-1 font-number text-[12px] text-ink-secondary" data-u4-secondary>
          <Store className="h-3.5 w-3.5" strokeWidth={1.5} />
          <CK k="mall.pdpStoreLine">{mlc('mall.pdpStoreLine', { store: storeName })}</CK>
        </p>
      </>
    ),

    'pdp.rebateCard': () =>
      rebateFen > 0 ? (
        <div className="mt-3 rounded-control bg-brand-secondary-light px-3.5 py-2.5" data-testid="pdp-rebate-strip">
          <p className="text-[12px] font-medium text-ink-secondary" data-u4-secondary>
            {mlc('mall.rebateEarnStrip', { amt: fenToYuan(rebateFen), pct: (rebateBp / 100).toFixed(0) })}
          </p>
        </div>
      ) : null,

    'pdp.detail': () => {
      const spec = `${product.name} ${product.description ?? ''}`.match(/\d+(?:\.\d+)?\s*(?:kg|g|ml|L|支|枚)/i)?.[0]?.replace(/\s+/g, '') ?? null;
      return (
        <>
          <div className="mt-5" data-testid="pdp-specs">
            <h2 className="text-body-sm font-extrabold"><CK k="mall.pdpSpecs">{mlc('mall.pdpSpecs')}</CK></h2>
            {spec ? (
              <div className="mt-2 flex gap-2">
                <span className="rounded-full bg-brand-cta px-3 py-1.5 text-[12px] font-semibold text-brand-cta-on">{spec}</span>
              </div>
            ) : null}
          </div>
          {product.description ? (
            <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary" data-u4-secondary>
              <span className="font-semibold text-ink">{mlc('mall.pdpDescriptionLabel')}：</span>
              {product.description}
            </p>
          ) : null}
        </>
      );
    },

    /* 5. pdp.reviews：商品评价区（片 3：描述卡后；productReviews 列表+均分+晒单图墙+
          写评价入口——写评价闸=仅 received 订单可评，无可评单=诚实注记不画假入口；
          写评价弹层 ReviewSheet 不入块流，照改造前位置挂载于块流外） */
    'pdp.reviews': () => (
      <>
        <div className="mb-3 mt-6 flex items-baseline justify-between">
          <h2 className="text-v2-section"><CK k="rev.title">{rvc('rev.title')}</CK></h2>
          {reviewCount > 0 && reviewAvg !== null ? (
            <span className="flex items-center gap-1.5 font-number text-[10px] text-ink-secondary">
              <Stars n={Math.round(reviewAvg)} />
              <CK k="rev.summary">{rvc('rev.summary', { avg: reviewAvg.toFixed(1), count: reviewCount })}</CK>
            </span>
          ) : null}
        </div>
        <div className="u1-card p-4" data-testid="pdp-reviews">
          {reviewsQ.isPending && !previewMiss ? (
            <Skeleton className="h-16 rounded-control" />
          ) : reviewsQ.isError ? (
            <button type="button" className="text-caption text-ink-secondary" onClick={() => void reviewsQ.refetch()}>
              <CK k="rev.loadFail">{rvc('rev.loadFail')}</CK>
            </button>
          ) : reviewRows.length === 0 ? (
            <p className="text-caption text-ink-placeholder"><CK k="rev.empty">{rvc('rev.empty')}</CK></p>
          ) : (
            <div className="space-y-3.5">
              {reviewRows.map((r) => (
                <div key={r.id} data-testid={`review-${r.id}`}>
                  <div className="flex items-center gap-2">
                    <Stars n={r.rating} />
                    <span className="text-caption-xs font-semibold text-ink">
                      {/* server 匿名录名口径：anonymous=「匿名用户」，昵称不透出 */}
                      {r.nickname}
                    </span>
                    <span className="ml-auto font-number text-[9.5px] text-ink-placeholder">
                      {fmtDateTime(r.createdAt)}
                    </span>
                  </div>
                  {r.text ? (
                    <p className="mt-1 whitespace-pre-line text-body-sm leading-relaxed text-ink-secondary">{r.text}</p>
                  ) : null}
                  {/* 晒单图墙 */}
                  {r.photoUrls.length > 0 ? (
                    <div className="mt-1.5 flex gap-1.5">
                      {r.photoUrls.map((u) => (
                        <ProductImage key={u} src={u} alt="" className="h-14 w-14 rounded-control" />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {reviewsQ.hasNextPage ? (
                <button
                  type="button"
                  disabled={reviewsQ.isFetchingNextPage}
                  onClick={() => void reviewsQ.fetchNextPage()}
                  className="w-full text-center text-caption font-medium text-ink-secondary"
                >
                  <CK k="rev.more">{rvc('rev.more')}</CK>
                </button>
              ) : null}
            </div>
          )}
          {/* 写评价入口（仅 received 订单可评；无单=注记） */}
          <div className="mt-3 border-t border-line-divider pt-3">
            {reviewOrderId ? (
              <button
                type="button"
                onClick={() => setReviewOpen(true)}
                data-testid="pdp-review-entry"
                className="rounded-full bg-brand-primary px-4 py-2 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="rev.writeCta">{rvc('rev.writeCta')}</CK>
              </button>
            ) : (
              <p className="text-caption text-ink-placeholder" data-testid="pdp-review-need">
                <CK k="rev.needReceived">{rvc('rev.needReceived')}</CK>
              </p>
            )}
          </div>
        </div>
      </>
    ),

    'pdp.ctaBar': () => (
      <div
        className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
        style={{ background: 'linear-gradient(transparent, #FAF7F0 40%)' }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-4 pt-3">
          <div className="min-w-0">
            <p className="font-number text-body-sm font-bold tabular-nums">
              {soldOut ? <CK k="mall.soldOut">{mlc('mall.soldOut')}</CK> : mlc('mall.pdpMemberCta', { amt: fenToYuan(product.priceFen) })}
            </p>
            {!soldOut && rebateFen > 0 ? (
              <p className="mt-0.5 font-number text-[12px] tabular-nums text-ink-secondary" data-u4-secondary>
                {mlc('mall.pdpAddRebate', { amt: fenToYuan(rebateFen) })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={soldOut}
            onClick={handleAddCart}
            data-testid="pdp-add-cart"
            className="shrink-0 rounded-full bg-brand-cta px-6 py-3 text-body-sm font-bold text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
          >
            {soldOut ? mlc('mall.soldOut') : mlc('mall.pdpAddCartU4')}
          </button>
        </div>
      </div>
    ),
  };

  return (
    <CanvasLayoutLoader pageKey="pdp" storeId={pdpStoreId}>
      <div className="pb-32">
        {toastEl}
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="px-[22px]" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="pdp-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：pdp.gallery=自带 px 容器裸段（原结构在共享 padding 容器外）；
            info/rebateCard/detail/reviews 共享 px-[22px] 容器（mt 节奏照改造前逐字搬）；
            pdp.ctaBar=fixed 吸底条（包无样式 section 不影响落位）——默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'pdp.gallery' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="px-[22px]">
          {layout.map((b) =>
            b.visible && b.blockKey !== 'pdp.gallery' && b.blockKey !== 'pdp.ctaBar' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
        {layout.map((b) =>
          b.visible && b.blockKey === 'pdp.ctaBar' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}

        {/* 跨店加车确认（弹层不入块流，照改造前位置挂载） */}
        <ConfirmSheet
          open={!!pendingAdd}
          title={mlc('mall.conflictTitle')}
          desc={mlc('mall.conflictBody', { store: cart.items[0]?.storeName ?? mlc('mall.otherStore') })}
          confirmText={mlc('mall.conflictOk')}
          onCancel={() => setPendingAdd(null)}
          onConfirm={() => {
            if (pendingAdd) {
              cart.replaceWith(pendingAdd);
              showToast(mlc('mall.replacedToast'), 'info');
            }
            setPendingAdd(null);
          }}
        />

        {/* 片 3：写评价弹层（仅 received 订单可评，一单一件一评；弹层不入块流） */}
        <ReviewSheet
          open={reviewOpen}
          orderId={reviewOrderId}
          productId={product.id}
          showToast={showToast}
          onClose={() => setReviewOpen(false)}
          onDone={() => void reviewsQ.refetch()}
        />
      </div>
    </CanvasLayoutLoader>
  );
}

export default function ProductDetailPage() {
  return (
    <CartProvider>
      <DetailInner />
    </CartProvider>
  );
}
