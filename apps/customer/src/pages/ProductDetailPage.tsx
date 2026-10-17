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
 *
 * 客户端体验大批 片 3：图区右上角收藏钮（favToggle 幂等，已收藏实色）+ 描述卡后
 * 「商品评价」区（productReviews 列表+均分+晒单图墙+写评价弹层——仅 received 订单
 * 可评，订单列表「写评价」入口带 reviewOrderId 直入；晒图走既有 /api/upload 链
 * relDir='review/product' ≤3 张）。
 *
 * 画布化（产品-1010 画布全屏批 片 3 末片 · 商城域，工艺照 MePage/MallPage/MemberOpenPage）：
 * 六块入册（pdp.gallery/info/rebateCard/detail/reviews/ctaBar），块序/显隐=
 * useCanvasLayout('pdp')（published→注册表默认序尾补，空=PDP_DEFAULT_ORDER 兜底）；
 * 店锚=?canvasStore= 预览店锚 > 商品所在店（product.storeId 既有透出，零新增查询）；
 * ?canvasPreview=1=页首水印注记（pdp-canvas-preview-note）；带参路由预览：预览 URL=
 * /mall/product/preview，canvasPreview=1 且 params.id==='preview' 时取商品列表既有查询
 * 缓存（mall.listProducts 同 queryKey 共享，零新增查询）首条商品顶替，查不到=候裁清零
 * 批件 6 屏内合成示例商品顶替渲染（预览专属，零真数据零写库，不再落空态）；
 * 文案键挂 CK(data-copy-key) 点选反查锚；写评价弹层/跨店确认弹层不入块流（照改造前位置
 * 挂载）；块内逻辑/查询/状态机/提交链路零改动，data-testid 原值全保留。
 */

import { CanvasLayoutLoader, CK, Skeleton, slotContentOf, resolveSlotUrl, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Minus, Plus, Star, Store } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BackButton } from '../components/PageHeader';
import { CartProvider, MAX_QTY, useCart, type AddInput } from '../components/mall/cartStore';
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
  const navigate = useNavigate();
  const location = useLocation();
  const { trpc } = usePhiliaClient();
  const queryClient = useQueryClient();
  const cart = useCart();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

  const [qty, setQty] = useState(1);
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

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
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
          qty,
        }
      : null;

  const handleAddCart = () => {
    /* 件 6：合成示例商品不进购物袋（本地购物车也不落假行） */
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

  const handleBuyNow = () => {
    if (previewMiss) {
      showToast(mc('mc.canvasExampleNote'), 'info');
      return;
    }
    const input = buildAddInput();
    if (!input) return;
    navigate('/mall/checkout', { state: { buyNow: input } });
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
    /* 1. pdp.gallery：大图轮（片 2 M-02 定稿：图 270 高、圆角 20 卡内横滑 scroll-snap +
          圆点指示，多图能力保留；返回钮浮于图上左上角；片 3 收藏钮图区右上角） */
    'pdp.gallery': () => (
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
                <ProductImage src={u} alt={`${product.name} 图 ${i + 1}`} className="pdp-gallery-media w-full" />
              </div>
            ))}
          </div>
          {/* 返回按钮（U1-A：统一圆钮 36px，主图场景保持浮动形态） */}
          <BackButton className="absolute left-3 top-3" />
          {/* 片 3：收藏钮（图区右上角 36 圆白卡；favToggle 幂等，已收藏实色；
              aria-label 属性位挂不上 CK，键 fav.pdpAdd/fav.pdpAdded 如实列入 copyKeys） */}
          <button
            type="button"
            aria-label={faved ? fvc('fav.pdpAdded') : fvc('fav.pdpAdd')}
            aria-pressed={faved}
            disabled={favM.isPending}
            onClick={() => (previewMiss ? showToast(mc('mc.canvasExampleNote'), 'info') : favM.mutate())}
            data-testid="pdp-fav"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/95 ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-90"
          >
            <Heart
              className={`h-[18px] w-[18px] ${faved ? 'fill-brand-primary text-brand-primary' : 'text-ink'}`}
              strokeWidth={1.6}
            />
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
      </div>
    ),

    /* 2. pdp.info：信息区（片 2 M-02 定稿：名 18/800 + 价 mono 19/700 基线两端；
          售罄/仅剩签 + mono 10 灰溯源行） */
    'pdp.info': () => (
      <>
        <div className="mt-3.5 flex items-baseline justify-between gap-3">
          <h1 className="text-[18px] font-extrabold leading-6">{product.name}</h1>
          <p className="u1-num shrink-0 text-[19px] font-bold text-ink">{fenToYuan(product.priceFen)}</p>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          {/* 「会员价」小签已摘除（任务卡 9-29 附①：全员同价无会员价=冻结红线 rules.r8，
              错误口径不是未建功能，摘除即净——不留置灰） */}
          {soldOut ? (
            <span className="rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder"><CK k="mall.soldOut">{mlc('mall.soldOut')}</CK></span>
          ) : stock < 10 ? (
            <span className="rounded-chip bg-danger-light px-2 py-0.5 font-number text-caption-xs text-danger-deep">
              <CK k="mall.pdpStockLeft">{mlc('mall.pdpStockLeft', { n: stock })}</CK>
            </span>
          ) : null}
        </div>
        {/* 溯源行（mono 10 muted；M-02 定稿「全员同价」注记位，文案口径保留既有） */}
        <p className="mt-2 flex items-center gap-1 font-number text-[10px] text-ink-secondary">
          <Store className="h-3.5 w-3.5" strokeWidth={1.5} />
          <CK k="mall.pdpStoreLine">{mlc('mall.pdpStoreLine', { store: storeName })}</CK>
        </p>
      </>
    ),

    /* 3. pdp.rebateCard：回馈金返显卡（rebateBp=0 不渲染；O9 规则主钩只留购物袋结算侧） */
    'pdp.rebateCard': () =>
      rebateFen > 0 ? (
        <div className="u1-card mt-3 flex items-center gap-2.5 px-3.5 py-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />
          <p className="text-caption font-semibold">
            {settleDay ? (
              <CK k="mall.rebateEarnCard">{mc('mall.rebateEarnCard', { amt: fenToYuan(rebateFen), day: settleDay })}</CK>
            ) : (
              <CK k="mall.rebateEarnCardNoDay">{mc('mall.rebateEarnCardNoDay', { amt: fenToYuan(rebateFen) })}</CK>
            )}
          </p>
        </div>
      ) : null,

    /* 4. pdp.detail：详情描述（真实字段；试样规格表无真实字段来源，不出——U4-D3 登记；
          片 2 M-02：截面题 16/800；正文=商品数据不抽键） */
    'pdp.detail': () =>
      product.description ? (
        <>
          <div className="mb-3 mt-6 flex items-baseline justify-between">
            <h2 className="text-v2-section"><CK k="mall.pdpDetailTitle">{mlc('mall.pdpDetailTitle')}</CK></h2>
          </div>
          <div className="u1-card p-4">
            <p className="whitespace-pre-line text-body-sm leading-relaxed text-ink-secondary">
              {product.description}
            </p>
          </div>
        </>
      ) : null,

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

    /* 6. pdp.ctaBar：吸底 CTA（片 2 M-02 定稿 ctabar：渐出底 linear-gradient(transparent→纸白 40%)、
          去顶描边；左=数量步进 pill（bg 卡其浅底 #F1E9D6 全圆）+「加入购物袋」白卡细线次钮
          +「立即购买」深棕底 16/700 主钮（sub mono 10.5 总价）；控件档圆角 18；
          详情级无 dock，落底 safe-area；fixed 条包无样式 section 不影响落位） */
    'pdp.ctaBar': () => (
      <div
        className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
        style={{ background: 'linear-gradient(transparent, #FAF7F0 40%)' }}
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
            <CK k="mall.pdpAddCart">{mlc('mall.pdpAddCart')}</CK>
          </button>
          <button
            type="button"
            disabled={soldOut}
            onClick={handleBuyNow}
            data-testid="pdp-buy-now"
            className="flex flex-[1.4] flex-col items-center justify-center rounded-[18px] bg-brand-cta py-3 text-body-lg font-bold text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
          >
            <span>{soldOut ? <CK k="mall.soldOut">{mlc('mall.soldOut')}</CK> : <CK k="mall.pdpBuyNow">{mlc('mall.pdpBuyNow')}</CK>}</span>
            {!soldOut ? (
              <span className="mt-0.5 font-number text-[10.5px] font-normal text-[#C9BBA0]">
                共 {fenToYuan(product.priceFen * qty)}
              </span>
            ) : null}
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
