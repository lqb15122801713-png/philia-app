/**
 * 商城首页 /mall（T5.3）
 *
 * - 分类导航 chips（全部/主粮/零食/玩具/清洁/其他，对齐种子数据应用层枚举）；
 * - 搜索框 350ms 防抖，keyword 命中 name/description（服务端模糊）；
 * - 商品瀑布双列卡（图/名/价格元/店铺名）：店铺名来自公开接口 store.listNearby 映射
 *   （listProducts 不返回店名，卡片规格要求展示）；
 * - 上拉加载更多：IntersectionObserver 哨兵 + page 递增（useInfiniteQuery）；
 * - 空态沿用品牌插画；右上购物车入口 + 角标（CartProvider 页面级挂载，
 *   localStorage 为跨页事实源）。
 *
 * 画布化（产品-1010 片 2 · 画布全屏批片 2）：七块入册（mall.head/deliverySlot/entries/
 * search/categories/productGrid/feedTail），块序/显隐=useCanvasLayout('mall')
 * （published→注册表默认序尾补，空=默认序兜底常量）；文案键行内可改=画布端口（CK 反查锚）；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记；块内逻辑零改动
 * （搜索防抖/无限流/快加购链路/跨店确认一字不动），data-testid 原值全保留。
 */

import { BoardSkeleton, CanvasLayoutLoader, CK, resolveSlotUrl, slotContentOf, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { readLastBooking } from '@/lib/bookingPrefill';
import CartLink from '../components/mall/CartLink';
import { mc } from '../components/member/copy';
import ConfirmSheet from '../components/mall/ConfirmSheet';
import { EmptyState } from '../components/home/common';
import { useToast } from '@philia/shared';
import { CartProvider, useCart, type AddInput } from '../components/mall/cartStore';
import { fenToYuan } from '../components/mall/format';
import { mlc } from '../copy/mall';
import { fvc } from '../copy/favorites';
import ProductImage from '../components/mall/ProductImage';

/* 类目 chip（片4 · 核对表行 9）：展示名=copy 键 A4 端口（mall.cat.*）；
   查询值=码内枚举写死不抽键（对齐种子数据应用层枚举，label 改动不动查询契约） */
const CATEGORIES = [
  { value: '全部', labelKey: 'mall.cat.all' },
  { value: '主粮', labelKey: 'mall.cat.staple' },
  { value: '零食', labelKey: 'mall.cat.snack' },
  { value: '玩具', labelKey: 'mall.cat.toy' },
  { value: '清洁', labelKey: 'mall.cat.clean' },
  { value: '其他', labelKey: 'mall.cat.other' },
] as const;
type CategoryValue = (typeof CATEGORIES)[number]['value'];
const PAGE_SIZE = 12;

/** 新品角标视窗（批D 商品角标 · 不含真券）：createdAt 距今 ≤14 天自动签；
    violet 活动角标 ≤10% 纪律——每屏最多 NEW_BADGE_CAP 签（列表=server createdAt 倒序，取最新两件） */
const NEW_PRODUCT_DAYS = 14;
const NEW_BADGE_CAP = 2;

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const MALL_DEFAULT_ORDER = [
  'mall.head',
  'mall.deliverySlot',
  'mall.entries',
  'mall.search',
  'mall.categories',
  'mall.productGrid',
  'mall.feedTail',
] as const;

type ProductItem = {
  id: string;
  storeId: string;
  name: string;
  priceFen: number;
  stock: number;
  images: string[] | null;
  /** 上架时刻（listProducts 全列直出；批D 新品角标判据） */
  createdAt?: string | Date | null;
};

function ProductCard({
  item,
  onQuickAdd,
  rebateBp,
  showNewBadge,
}: {
  item: ProductItem;
  /** U1-G 快加购（真加购链路 cartStore.addItem；售罄不渲染） */
  onQuickAdd: (item: ProductItem) => void;
  /** 回馈金返显（APP-18：全员同价+按档返；非会员/免费档=0 不渲染假数） */
  rebateBp: number;
  /** 批D 新品角标（父级按序位+视窗双闸下发，守 ≤10% 帽） */
  showNewBadge: boolean;
}) {
  /* 片 2 M-01 定稿（§4.7）：图 4:3 + 名 12.5/700 两行 + 价 mono 14/700 + 右 mono 8.5
     「返 ¥x 回馈金」（APP-18 口径）+ qadd 30 圆深棕「＋」（:active scale .9） */
  const rebateFen = rebateBp > 0 ? Math.round((item.priceFen * rebateBp) / 10000) : 0;
  return (
    <div className="u1-card relative overflow-hidden">
      <Link to={`/mall/product/${item.id}`} className="block transition active:scale-[0.99]">
        <ProductImage src={item.images?.[0]} alt={item.name} className="mall-product-image aspect-[4/3] w-full" />
        {showNewBadge ? (
          /* violet 活动角标（READY §2.1：≤10% 禁 CTA/Tab；不含真券） */
          <span
            data-testid={`mall-badge-new-${item.id}`}
            className="absolute left-2 top-2 rounded-chip bg-violet px-1.5 py-0.5 text-[10px] font-bold text-violet-on"
          >
            {mlc('mall.badgeNew')}
          </span>
        ) : null}
        <div className="px-3 pb-3 pt-2.5">
          <p className="line-clamp-2 min-h-8 text-[12.5px] font-bold leading-4">{item.name}</p>
          <div className="mt-[7px] flex items-baseline pr-8">
            <p className="u1-num text-body-sm font-bold text-ink">{fenToYuan(item.priceFen)}</p>
            {rebateFen > 0 ? (
              <span className="ml-auto font-number text-[8.5px] tabular-nums text-ink-secondary">
                {mlc('mall.rebateLine', { amt: fenToYuan(rebateFen) })}
              </span>
            ) : null}
          </div>
          {item.stock <= 0 ? (
            <span className="mt-1 inline-block rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">{mlc('mall.soldOut')}</span>
          ) : null}
        </div>
      </Link>
      {/* 快加购：真链路（addItem → 角标/购物袋；跨店由页面 ConfirmSheet 处理）。
          片 2 M-01：qadd=30px 深棕圆底「＋」（定稿 §4.7，:active scale(.9)） */}
      {item.stock > 0 ? (
        <button
          type="button"
          aria-label={`快速加入购物袋：${item.name}`}
          data-testid={`mall-quickadd-${item.id}`}
          onClick={(e) => {
            e.preventDefault();
            onQuickAdd(item);
          }}
          className="absolute bottom-3 right-3 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-cta text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-90"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}

/** 批D 商城促销横幅（mall.hero 槽位 · A5 发布流：图/主副题/CTA 运营可调；
    壳写死内容端口化；不含真券核销——CTA=平滑滚动到商品流，真动作不挂假链） */
function MallHero() {
  const slot = slotContentOf('mall.hero');
  const title = slot?.title_main ?? mlc('mall.heroTitle');
  const sub = slot?.title_sub ?? mlc('mall.heroSub');
  const cta = slot?.cta_text ?? mlc('mall.heroCta');
  const src = resolveSlotUrl(slot?.url ?? null);
  const [imgOk, setImgOk] = useState(true);
  return (
    <section className="mt-3 overflow-hidden rounded-card bg-card shadow-card" data-testid="mall-hero">
      <div className="relative">
        {src && imgOk ? (
          <img
            src={src}
            alt={slot?.alt ?? title}
            onError={() => setImgOk(false)}
            className="mall-hero-media aspect-[21/9] w-full object-cover"
          />
        ) : (
          /* url=null=品牌渐变占位（真图终摄非目标，R10 不落假图） */
          <div role="img" aria-label={slot?.alt ?? title} className="mall-hero-media aspect-[21/9] w-full bg-philia-gradient" />
        )}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[rgba(44,40,34,.55)] to-transparent px-4 pb-3 pt-8">
          <p className="u1-serif text-[19px] font-black leading-snug text-canvas">{title}</p>
          <p className="mt-0.5 font-number text-[9.5px] tracking-wide text-canvas/80">{sub}</p>
        </div>
        {cta ? (
          <button
            type="button"
            data-testid="mall-hero-cta"
            onClick={() =>
              document.querySelector('[data-block-key="mall.productGrid"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="absolute bottom-3 right-3 rounded-full bg-brand-primary px-3 py-1.5 text-caption-xs font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {cta}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function MallInner() {
  const { trpc } = usePhiliaClient();
  const cart = useCart();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });
  const [category, setCategory] = useState<CategoryValue>('全部');
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  /** U1-G 快加购跨店冲突待确认（与 PDP 同链路） */
  const [pendingAdd, setPendingAdd] = useState<AddInput | null>(null);

  // U1-G 快加购（真链路）：成功 → toast；跨店 → ConfirmSheet 确认后 replaceWith
  const quickAdd = (item: ProductItem) => {
    const input: AddInput = {
      productId: item.id,
      storeId: item.storeId,
      storeName: storeNameOf(item.storeId),
      name: item.name,
      priceFen: item.priceFen,
      image: item.images?.[0] ?? null,
      stock: item.stock,
    };
    const result = cart.addItem(input);
    if (result === 'conflict') setPendingAdd(input);
    else showToast(mlc('mall.quickAddToast'), 'info');
  };

  // 搜索防抖：350ms
  useEffect(() => {
    const t = window.setTimeout(() => setKeyword(searchText.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const productsQ = useInfiniteQuery({
    queryKey: ['mall', 'listProducts', { category, keyword }],
    queryFn: ({ pageParam }) =>
      trpc.mall.listProducts.query({
        category: category === '全部' ? undefined : category,
        keyword: keyword || undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });

  // 店铺名映射（公开接口，一次拉取缓存 5 分钟）
  const storesQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    staleTime: 5 * 60_000,
  });
  const storeNameOf = (storeId: string) =>
    storesQ.data?.stores.find((s) => s.id === storeId)?.name ?? mlc('mall.storeFallback');

  // 会员档回馈金比例（返显口径 APP-18：按档返；非会员/免费档=0 不渲染假数）
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  const items = productsQ.data?.pages.flatMap((p) => p.items) ?? [];
  const total = productsQ.data?.pages[0]?.total ?? 0;

  // 上拉加载哨兵
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = productsQ;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '240px' },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* ---- 产品-1010 片 2 画布化入册：探针参 + 店锚 + 注册表块序/有效布局（同 MePage 工艺） ---- */
  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  );
  /* 画布布局店锚（MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > listNearby 首店——
     复用本屏既有 storesQ 缓存，零增发查询） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), []);
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, []);
  const mallStoreId = previewStoreId ?? memoryStoreId ?? storesQ.data?.stores?.[0]?.id ?? null;

  /* 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  });
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'mall')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return items.length > 0 ? items : MALL_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));
  }, [blocksQ.data]);
  const layout = useCanvasLayout('mall', mallStoreId, registryBlocks);

  /* 块渲染器（块内逻辑零改动——七块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. mall.head：apphead（serif 27 大题 + mono 注记，M-01 定稿） */
    'mall.head': () => (
      <div className="m2-apphead">
        <span className="tt"><CK k="mall.headTitle">{mlc('mall.headTitle')}</CK></span>
        <span className="no"><CK k="mall.headSub">{mlc('mall.headSub')}</CK></span>
      </div>
    ),

    /* 2. mall.deliverySlot：配送条槽位（PD-15 V1.1 槽位 13：配送时效=运营后期端口；
          置灰不上假时效，留口注记；testid slot-delivery 原值保留） */
    'mall.deliverySlot': () => (
      <div className="mt-3">
        <div
          className="flex items-center gap-3 rounded-[14px] bg-card px-4 py-3 ring-1 ring-line-ring opacity-60"
          data-testid="slot-delivery"
          aria-disabled="true"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-secondary" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
          <div className="min-w-0 flex-1">
            <p className="text-caption font-bold text-ink"><CK k="mall.deliveryTitle">{mlc('mall.deliveryTitle')}</CK></p>
            <p className="mt-0.5 font-number text-[9.5px] text-ink-placeholder"><CK k="mall.deliverySub">{mlc('mall.deliverySub')}</CK></p>
          </div>
          <span className="text-caption-xs text-ink-placeholder" aria-hidden="true">›</span>
        </div>
      </div>
    ),

    /* 3. mall.entries：购物袋入口（头部右上，试样 07 细线 pill）+ 片 3 心愿单入口链（→/me/coupons?tab=favs） */
    'mall.entries': () => (
      <div className="pt-1">
        <div className="mt-3 flex items-center justify-end gap-2">
          <Link
            to="/me/coupons?tab=favs"
            data-testid="mall-fav-entry"
            className="u1-ring flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-primary" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20s-7-4.3-9-9a5 5 0 019-4 5 5 0 019 4c-2 4.7-9 9-9 9z" />
            </svg>
            {fvc('fav.mallEntry')}
          </Link>
          <CartLink />
        </div>
      </div>
    ),

    /* 4. mall.search：搜索框（U1-G：细线 ring 控件档，去 shadow-card；真实服务端模糊搜索，
          试样未画——保留；350ms 防抖逻辑在块外零改动） */
    'mall.search': () => (
      <div className="u1-ring mt-4 flex h-11 items-center gap-2 rounded-control bg-card px-3.5">
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-placeholder" strokeWidth={1.5} />
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={mlc('mall.searchPlaceholder')}
          className="h-full w-full bg-transparent text-body-sm outline-none placeholder:text-ink-placeholder"
        />
        {searchText ? (
          <button
            type="button"
            aria-label="清空搜索"
            onClick={() => setSearchText('')}
            className="shrink-0 text-ink-placeholder"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    ),

    /* 5. mall.categories：分类 chips（U4-D3 对齐试样 .cat：选中=深棕墨底米白字；未选=纸面细线
          ring 墨 60%；12px/500，padding 8px 14px；横滑条隐藏 D-补2；枚举值对齐种子数据不抽键） */
    'mall.categories': () => (
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            data-testid={`mall-cat-${c.value}`}
            className={`shrink-0 rounded-full px-3.5 py-2 text-caption transition ${
              category === c.value
                ? 'bg-ink font-semibold text-canvas'
                : 'bg-card font-medium text-ink-secondary ring-1 ring-line-ring'
            }`}
          >
            {mlc(c.labelKey)}
          </button>
        ))}
      </div>
    ),

    /* 6. mall.productGrid：商品流（骨架/失败重试/空态三句话/瀑布双列卡 + 上拉哨兵；
          无限流与快加购链路零改动） */
    'mall.productGrid': () =>
      productsQ.isPending ? (
        /* 换皮批片 5 B 块：瀑布卡占位归并 BoardSkeleton 成件（卡片网格型） */
        <BoardSkeleton cards={4} className="mt-4" />
      ) : productsQ.isError ? (
        <div className="mt-10 text-center">
          <p className="text-body-sm text-ink-secondary"><CK k="mall.loadFail">{mlc('mall.loadFail')}</CK></p>
          <button
            type="button"
            onClick={() => void productsQ.refetch()}
            className="mt-4 rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <CK k="mall.reload">{mlc('mall.reload')}</CK>
          </button>
        </div>
      ) : items.length === 0 ? (
        /* 空态：U1-I 全域统一组件（philia 精灵 + 一句话 + 一行动）；U4-D3 试样 12 工艺 */
        <EmptyState
          title={mlc('mall.emptyTitle')}
          desc={keyword ? mlc('mall.emptyBodyKeyword') : mlc('mall.emptyBodyCategory')}
          action={
            keyword ? (
              <button
                type="button"
                onClick={() => setSearchText('')}
                className="rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="mall.emptyClearSearch">{mlc('mall.emptyClearSearch')}</CK>
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {items.map((it, idx) => (
              <ProductCard
                key={it.id}
                item={it}
                onQuickAdd={quickAdd}
                rebateBp={rebateBp}
                /* 批D 新品角标双闸：视窗内 + 序位帽（列表=server createdAt 倒序） */
                showNewBadge={
                  idx < NEW_BADGE_CAP &&
                  !!it.createdAt &&
                  Date.now() - new Date(it.createdAt).getTime() < NEW_PRODUCT_DAYS * 86_400_000
                }
              />
            ))}
          </div>
          {/* 上拉加载哨兵 */}
          <div ref={sentinelRef} className="h-1" />
        </>
      ),

    /* 7. mall.feedTail：加载状态行（加载中/上拉加载更多/到底啦；仅商品流非空成功态出件） */
    'mall.feedTail': () =>
      !productsQ.isPending && !productsQ.isError && items.length > 0 ? (
        <p className="mt-4 text-center text-caption text-ink-placeholder">
          {isFetchingNextPage ? (
            <CK k="mall.loadingMore">{mlc('mall.loadingMore')}</CK>
          ) : hasNextPage ? (
            <CK k="mall.pullMore">{mlc('mall.pullMore')}</CK>
          ) : (
            <CK k="mall.endLine">{mlc('mall.endLine', { total })}</CK>
          )}
        </p>
      ) : null,
  };

  return (
    /* 片 2 M-01：apphead（serif 27 大题+mono 注记）+ delbar 槽位置灰（PD-15 V1.1 槽位 13） */
    <CanvasLayoutLoader pageKey="mall" storeId={mallStoreId}>
      <div className="pb-28">
        {toastEl}
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="px-[22px]" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="mall-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：mall.head=页头裸段（原结构在 padding 容器外，页头按惯例置顶不参与拖序）；
            余块共享 px 容器（各块 mt 节奏照改造前逐字搬）——默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'mall.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="px-[22px]">
          {/* 批D mall.hero 促销横幅（槽位驱动；紧随页头，不入画布块流——
              mall 块序现不在画布端口三屏页签内，内容发布走 A5 槽流已足） */}
          <MallHero />
          {layout.map((b) =>
            b.visible && b.blockKey !== 'mall.head' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
        {/* U1-G 快加购跨店确认（与 PDP 同链路；弹层不入块流，挂载条件照改造前=商品流非空成功态） */}
        {!productsQ.isPending && !productsQ.isError && items.length > 0 ? (
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
        ) : null}
      </div>
    </CanvasLayoutLoader>
  );
}

export default function MallPage() {
  return (
    <CartProvider>
      <MallInner />
    </CartProvider>
  );
}
