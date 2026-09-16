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
 */

import { usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CartLink from '../components/mall/CartLink';
import ConfirmSheet from '../components/mall/ConfirmSheet';
import { useMallToast } from '../components/mall/MallToast';
import { CartProvider, useCart, type AddInput } from '../components/mall/cartStore';
import { fenToYuan } from '../components/mall/format';
import ProductImage from '../components/mall/ProductImage';

const CATEGORIES = ['全部', '主粮', '零食', '玩具', '清洁', '其他'] as const;
const PAGE_SIZE = 12;

type ProductItem = {
  id: string;
  storeId: string;
  name: string;
  priceFen: number;
  stock: number;
  images: string[] | null;
};

function ProductCard({
  item,
  storeName,
  onQuickAdd,
}: {
  item: ProductItem;
  storeName: string;
  /** U1-G 快加购（真加购链路 cartStore.addItem；售罄不渲染） */
  onQuickAdd: (item: ProductItem) => void;
}) {
  return (
    /* U1-G 换肤：双列大卡=U1-B 细线卡（rounded-panel 20 + ring + 近零影，去 shadow-card） */
    <div className="u1-card relative overflow-hidden">
      <Link to={`/mall/product/${item.id}`} className="block transition active:scale-[0.99]">
        <ProductImage src={item.images?.[0]} alt={item.name} className="aspect-square w-full" />
        <div className="p-3">
          <p className="line-clamp-2 min-h-11 text-body-sm">{item.name}</p>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <p className="u1-num text-title text-brand-primary">{fenToYuan(item.priceFen)}</p>
            {item.stock <= 0 ? (
              <span className="rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">已售罄</span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-caption-xs text-ink-secondary">{storeName}</p>
        </div>
      </Link>
      {/* 快加购：真链路（addItem → 角标/购物车；跨店由页面 ConfirmSheet 处理） */}
      {item.stock > 0 ? (
        <button
          type="button"
          aria-label={`快速加入购物车：${item.name}`}
          data-testid={`mall-quickadd-${item.id}`}
          onClick={(e) => {
            e.preventDefault();
            onQuickAdd(item);
          }}
          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <Plus className="h-5 w-5" strokeWidth={1.5} />
        </button>
      ) : null}
    </div>
  );
}

function MallInner() {
  const { trpc } = usePhiliaClient();
  const cart = useCart();
  const { toastEl, showToast } = useMallToast();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('全部');
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
    else showToast('已加入购物车', 'info');
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
    storesQ.data?.stores.find((s) => s.id === storeId)?.name ?? '菲丽亚门店';

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

  return (
    <div className="px-4 py-6">
      {toastEl}
      {/* 标题 + 购物车入口 */}
      <div className="flex items-center justify-between">
        <h1 className="text-title-lg">商城</h1>
        <CartLink />
      </div>

      {/* 搜索框（U1-G：细线 ring 控件档，去 shadow-card） */}
      <div className="u1-ring mt-4 flex h-11 items-center gap-2 rounded-control bg-card px-3.5">
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-placeholder" strokeWidth={1.5} />
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索主粮、零食、玩具…"
          className="h-full w-full bg-transparent text-body outline-none placeholder:text-ink-placeholder"
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

      {/* 分类 chips（选中=柠檬黄主行动位；未选中=细线 ring 去阴影） */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            data-testid={`mall-cat-${c}`}
            className={`shrink-0 rounded-full px-4 py-2 text-body-sm transition ${
              category === c
                ? 'bg-brand-primary font-semibold text-ink'
                : 'bg-card text-ink-secondary ring-1 ring-line-ring'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 商品流 */}
      {productsQ.isPending ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="overflow-hidden rounded-card bg-card shadow-card">
              <div className="aspect-square animate-pulse bg-sunken" />
              <div className="space-y-2 p-3">
                <div className="h-4 animate-pulse rounded-tag bg-sunken" />
                <div className="h-4 w-2/3 animate-pulse rounded-tag bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      ) : productsQ.isError ? (
        <div className="mt-10 text-center">
          <p className="text-body text-ink-secondary">商品加载失败，请稍后重试</p>
          <button
            type="button"
            onClick={() => void productsQ.refetch()}
            className="mt-4 rounded-full bg-brand-primary px-6 py-2.5 text-body text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            重新加载
          </button>
        </div>
      ) : items.length === 0 ? (
        /* 空态：品牌插画 */
        <div className="mt-8 flex flex-col items-center rounded-card bg-card px-4 py-10 shadow-card">
          <img src="/brand/empty-appointments-800.png" alt="暂无商品" className="w-48 max-w-full rounded-card" />
          <p className="mt-4 text-title">没有找到相关商品</p>
          <p className="mt-1 text-body text-ink-secondary">
            {keyword ? `换个关键词试试，或看看其他分类` : '这个分类暂时没有商品，看看别的吧'}
          </p>
          {keyword ? (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="mt-5 rounded-full bg-brand-primary px-6 py-2.5 text-body text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              清空搜索
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {items.map((it) => (
              <ProductCard key={it.id} item={it} storeName={storeNameOf(it.storeId)} onQuickAdd={quickAdd} />
            ))}
          </div>
          {/* 上拉加载哨兵与状态行 */}
          <div ref={sentinelRef} className="h-1" />
          <p className="mt-4 text-center text-caption text-ink-placeholder">
            {isFetchingNextPage
              ? '正在加载更多…'
              : hasNextPage
                ? '上拉加载更多'
                : `共 ${total} 件商品 · 到底啦`}
          </p>

          {/* U1-G 快加购跨店确认（与 PDP 同链路） */}
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
        </>
      )}
    </div>
  );
}

export default function MallPage() {
  return (
    <CartProvider>
      <MallInner />
    </CartProvider>
  );
}
