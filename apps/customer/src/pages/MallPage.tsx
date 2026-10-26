/**
 * 商城首页 /mall · U4 定稿面：搜索、回馈金、六类、会员礼、双列商品与商品插画。
 * `?channel=groupbuy` 沿用上游诚实待上线分支；该分支不拉取商城数据、不渲染假商品。
 */
import { BoardSkeleton, CanvasLayoutLoader, CK, resolveSlotUrl, slotContentOf, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { readLastBooking } from '@/lib/bookingPrefill';
import CartLink from '../components/mall/CartLink';
import { mc } from '../components/member/copy';
import { EmptyState } from '../components/home/common';
import { CartProvider } from '../components/mall/cartStore';
import { fenToYuan } from '../components/mall/format';
import { mlc } from '../copy/mall';
import ProductImage from '../components/mall/ProductImage';

const CATEGORIES = [
  { value: '全部', labelKey: 'mall.cat.recommend' },
  { value: '主粮', labelKey: 'mall.cat.food' },
  { value: '零食', labelKey: 'mall.cat.snack' },
  { value: '清洁', labelKey: 'mall.cat.wash' },
  { value: '玩具', labelKey: 'mall.cat.toy' },
  { value: '其他', labelKey: 'mall.cat.travel' },
] as const;
type CategoryValue = (typeof CATEGORIES)[number]['value'];
const PAGE_SIZE = 12;
const MALL_DEFAULT_ORDER = ['mall.search', 'mall.categories', 'mall.productGrid', 'mall.feedTail'] as const;

type ProductItem = {
  id: string;
  storeId: string;
  name: string;
  priceFen: number;
  stock: number;
  images: string[] | null;
  createdAt?: string | Date | null;
};

function ProductCard({ item, rebateBp }: { item: ProductItem; rebateBp: number }) {
  const rebateFen = rebateBp > 0 ? Math.round((item.priceFen * rebateBp) / 10000) : 0;
  return (
    <article className="u1-card relative overflow-hidden" data-testid={`mall-product-card-${item.id}`}>
      <Link to={`/mall/product/${item.id}`} className="block transition active:scale-[0.99]">
        <ProductImage src={item.images?.[0]} alt={item.name} className="mall-product-image aspect-[4/3] w-full" />
        <div className="px-3 pb-3 pt-2.5">
          <p className="line-clamp-2 min-h-8 text-[12px] font-bold leading-4">{item.name}</p>
          <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>
            {item.stock <= 0 ? mlc('mall.soldOut') : mlc('mall.storeSame')}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <p className="u1-num text-body-sm font-bold text-ink">{fenToYuan(item.priceFen)}</p>
            <span className="font-number text-[12px] tabular-nums text-ink-secondary" data-u4-secondary>
              {mlc('mall.memberPrice', { amt: fenToYuan(item.priceFen) })}
            </span>
          </div>
          {rebateFen > 0 ? (
            <p className="mt-1 font-number text-[12px] tabular-nums text-ink-secondary" data-u4-secondary>
              {mlc('mall.rebateLineU4', { amt: fenToYuan(rebateFen) })}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

function MallHero() {
  const slot = slotContentOf('mall.hero');
  const title = slot?.title_main ?? mlc('mall.heroTitle');
  const sub = slot?.title_sub ?? mlc('mall.heroSub');
  const slotSrc = resolveSlotUrl(slot?.url ?? null);
  const src = slotSrc ?? '/photos/icons/ic-shop.png';
  const alt = slotSrc ? (slot?.alt ?? title) : title;
  const [imgOk, setImgOk] = useState(true);
  return (
    <section className="mt-4 grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3" data-testid="mall-hero">
      <div data-testid="mall-hero-copy">
        <h2 className="u1-serif text-[19px] font-black leading-snug text-ink">{title}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary" data-u4-secondary>{sub}</p>
        <button
          type="button"
          data-testid="mall-hero-cta"
          onClick={() => document.querySelector('[data-block-key="mall.productGrid"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="mt-2.5 inline-flex min-h-[44px] items-center rounded-full bg-brand-cta px-3.5 py-1.5 text-[12px] font-bold text-brand-cta-on"
        >
          {mlc('mall.heroCtaU4')}
        </button>
      </div>
      {src && imgOk ? (
        <img
          src={src}
          alt={alt}
          fetchPriority="high"
          onError={() => setImgOk(false)}
          className={`mall-hero-media h-[102px] w-[120px] rounded-control ${slotSrc ? 'object-cover' : 'bg-[linear-gradient(135deg,#FAF7F0,#E9E1D2)] object-contain p-1.5'}`}
        />
      ) : (
        <div role="img" aria-label={alt} className="mall-hero-media flex h-[102px] w-[120px] items-center justify-center rounded-control bg-[linear-gradient(135deg,#FAF7F0,#E9E1D2)]">
          <span className="rounded-full bg-card/75 px-2 py-1 text-[12px] text-ink-secondary" data-u4-secondary>{mlc('mall.pendingImage')}</span>
        </div>
      )}
    </section>
  );
}

function MallInner() {
  const { trpc } = usePhiliaClient();
  const { search } = useLocation();
  const [category, setCategory] = useState<CategoryValue>('全部');
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const isGroupbuyPending = useMemo(
    () => new URLSearchParams(search).get('channel') === 'groupbuy',
    [search],
  );

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
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: !isGroupbuyPending,
  });
  const storesQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    staleTime: 5 * 60_000,
    enabled: !isGroupbuyPending,
  });
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
    enabled: !isGroupbuyPending,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  const balanceFen = myQ.data?.rebate?.balanceFen ?? 0;
  const items = productsQ.data?.pages.flatMap((p) => p.items) ?? [];
  const total = productsQ.data?.pages[0]?.total ?? 0;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = productsQ;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasNextPage && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '240px' },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isCanvasPreview = useMemo(() => new URLSearchParams(window.location.search).get('canvasPreview') === '1', []);
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), []);
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, []);
  const mallStoreId = previewStoreId ?? memoryStoreId ?? storesQ.data?.stores?.[0]?.id ?? null;
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
    enabled: !isGroupbuyPending,
  });
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? []).filter((b) => b.pageKey === 'mall').sort((a, b) => a.sortOrder - b.sortOrder);
    return items.length > 0 ? items : MALL_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));
  }, [blocksQ.data]);
  const layout = useCanvasLayout('mall', mallStoreId, registryBlocks);

  const renderers: Record<string, () => ReactNode> = {
    'mall.search': () => (
      <div className="flex items-center gap-2 pt-1">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-brand-secondary-light/65 px-3.5">
          <Search className="h-[18px] w-[18px] shrink-0 text-ink-placeholder" strokeWidth={1.5} />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={mlc('mall.searchPlaceholderU4')}
            className="h-full min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-ink-placeholder"
          />
          {searchText ? (
            <button type="button" aria-label="清空搜索" onClick={() => setSearchText('')} className="shrink-0 text-ink-placeholder">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </label>
        <span data-testid="mall-rebate-pill" className="shrink-0 rounded-full bg-brand-cta px-3 py-2 font-number text-[12px] text-brand-cta-on">
          {mlc('mall.rebatePill', { amt: fenToYuan(balanceFen) })}
        </span>
        <CartLink />
      </div>
    ),
    'mall.categories': () => (
      <>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              data-testid={`mall-cat-${mlc(c.labelKey)}`}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] transition ${
                category === c.value ? 'bg-brand-cta font-semibold text-brand-cta-on' : 'bg-card font-medium text-ink-secondary'
              }`}
            >
              {mlc(c.labelKey)}
            </button>
          ))}
        </div>
        <MallHero />
        <div className="mt-5 flex items-center justify-between">
          <h2 className="text-body font-extrabold">{mlc('mall.featuredTitle')}</h2>
          <button type="button" onClick={() => setCategory('全部')} className="text-[12px] text-ink-secondary" data-u4-secondary>
            {mlc('mall.all')}
          </button>
        </div>
      </>
    ),
    'mall.productGrid': () =>
      productsQ.isPending ? (
        <BoardSkeleton cards={4} className="mt-4" />
      ) : productsQ.isError ? (
        <div className="mt-10 text-center">
          <p className="text-body-sm text-ink-secondary"><CK k="mall.loadFail">{mlc('mall.loadFail')}</CK></p>
          <button type="button" onClick={() => void productsQ.refetch()} className="mt-4 rounded-control bg-brand-cta px-[30px] py-[13px] text-body-sm font-semibold text-brand-cta-on">
            <CK k="mall.reload">{mlc('mall.reload')}</CK>
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={mlc('mall.emptyTitle')}
          desc={keyword ? mlc('mall.emptyBodyKeyword') : mlc('mall.emptyBodyCategory')}
          action={keyword ? (
            <button type="button" onClick={() => setSearchText('')} className="rounded-control bg-brand-cta px-[30px] py-[13px] text-body-sm font-semibold text-brand-cta-on">
              <CK k="mall.emptyClearSearch">{mlc('mall.emptyClearSearch')}</CK>
            </button>
          ) : undefined}
        />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {items.map((it) => <ProductCard key={it.id} item={it} rebateBp={rebateBp} />)}
          </div>
          <div ref={sentinelRef} className="h-1" />
        </>
      ),
    'mall.feedTail': () =>
      !productsQ.isPending && !productsQ.isError && items.length > 0 ? (
        <p className="mt-4 text-center text-[12px] text-ink-placeholder" data-u4-secondary>
          {isFetchingNextPage ? <CK k="mall.loadingMore">{mlc('mall.loadingMore')}</CK>
            : hasNextPage ? <CK k="mall.pullMore">{mlc('mall.pullMore')}</CK>
              : <CK k="mall.endLine">{mlc('mall.endLine', { total })}</CK>}
        </p>
      ) : null,
  };
  const visibleLayout = layout.filter((b) => Object.prototype.hasOwnProperty.call(renderers, b.blockKey));

  if (isGroupbuyPending) {
    return (
      <div className="px-[22px] pb-28 pt-4" data-testid="mall-groupbuy-pending">
        <EmptyState
          title={mlc('mall.groupbuyTitle')}
          desc={mlc('mall.groupbuyBody')}
          icon={<Search className="h-[26px] w-[26px]" strokeWidth={1.6} />}
          action={
            <Link
              to="/mall"
              className="rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {mlc('mall.groupbuyCta')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <CanvasLayoutLoader pageKey="mall" storeId={mallStoreId}>
      <div className="px-[22px] pb-28 pt-2">
        {isCanvasPreview ? (
          <p className="mb-2 text-center text-[12px] text-ink-secondary" data-testid="mall-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
        ) : null}
        {visibleLayout.map((b) => b.visible ? (
          <section data-block-key={b.blockKey} key={b.blockKey}>
            {renderers[b.blockKey]?.() ?? null}
          </section>
        ) : null)}
      </div>
    </CanvasLayoutLoader>
  );
}

export default function MallPage() {
  return <CartProvider><MallInner /></CartProvider>;
}
