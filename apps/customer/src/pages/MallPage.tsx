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
import { EmptyState } from '../components/home/common';
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
  onQuickAdd,
}: {
  item: ProductItem;
  /** U1-G 快加购（真加购链路 cartStore.addItem；售罄不渲染） */
  onQuickAdd: (item: ProductItem) => void;
}) {
  return (
    /* U1-G 换肤：双列大卡=U1-B 细线卡（rounded-panel 20 + ring + 近零影，去 shadow-card）
       U4-D3 对齐试样 07：图 4:3（试样 pr-photo 120px/卡宽 167px）·名 12/600 两行·
       价 u1-num 14/700 墨色（试样非柠檬字）·右下 26px 柠檬圆底墨「＋」快加购（试样 .pr-add） */
    <div className="u1-card relative overflow-hidden">
      <Link to={`/mall/product/${item.id}`} className="block transition active:scale-[0.99]">
        <ProductImage src={item.images?.[0]} alt={item.name} className="aspect-[4/3] w-full" />
        <div className="px-3 pb-3 pt-2.5">
          <p className="line-clamp-2 min-h-8 text-caption font-semibold">{item.name}</p>
          <div className="mt-[7px] flex items-center pr-8">
            <p className="u1-num text-body-sm font-bold text-ink">{fenToYuan(item.priceFen)}</p>
            {item.stock <= 0 ? (
              <span className="ml-2 rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">已售罄</span>
            ) : null}
          </div>
        </div>
      </Link>
      {/* 快加购：真链路（addItem → 角标/购物袋；跨店由页面 ConfirmSheet 处理）。
          U4-D3：对齐试样 .pr-add——26px 柠檬圆底 + 墨「＋」，位于价格行右位（绝对定位保持
          与 Link 同级，避免交互元素嵌套） */}
      {item.stock > 0 ? (
        <button
          type="button"
          aria-label={`快速加入购物袋：${item.name}`}
          data-testid={`mall-quickadd-${item.id}`}
          onClick={(e) => {
            e.preventDefault();
            onQuickAdd(item);
          }}
          className="absolute bottom-3 right-3 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-brand-primary text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
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
    /* U4-D3：页边距 22px（试样 .topbar/.prod-grid padding 口径） */
    <div className="px-[22px] pb-6 pt-4">
      {toastEl}
      {/* 标题 + 购物袋入口（试样 07：wordmark 17 + 右上细线 pill「购物袋 · N」） */}
      <div className="flex items-center justify-between">
        <h1 className="text-title">商城</h1>
        <CartLink />
      </div>

      {/* 搜索框（U1-G：细线 ring 控件档，去 shadow-card；真实服务端模糊搜索，试样未画——保留） */}
      <div className="u1-ring mt-4 flex h-11 items-center gap-2 rounded-control bg-card px-3.5">
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-placeholder" strokeWidth={1.5} />
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索主粮、零食、玩具…"
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

      {/* 分类 chips（U4-D3 对齐试样 .cat：选中=深棕墨底米白字；未选=纸面细线 ring 墨 60%；
          12px/500，padding 8px 14px；横滑条隐藏 D-补2） */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            data-testid={`mall-cat-${c}`}
            className={`shrink-0 rounded-full px-3.5 py-2 text-caption transition ${
              category === c
                ? 'bg-ink font-semibold text-canvas'
                : 'bg-card font-medium text-ink-secondary ring-1 ring-line-ring'
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
            <div key={i} className="u1-card overflow-hidden">
              <div className="aspect-[4/3] animate-pulse bg-sunken" />
              <div className="space-y-2 px-3 pb-3 pt-2.5">
                <div className="h-4 animate-pulse rounded-tag bg-sunken" />
                <div className="h-4 w-2/3 animate-pulse rounded-tag bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      ) : productsQ.isError ? (
        <div className="mt-10 text-center">
          <p className="text-body-sm text-ink-secondary">商品加载失败，请稍后重试</p>
          <button
            type="button"
            onClick={() => void productsQ.refetch()}
            className="mt-4 rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            重新加载
          </button>
        </div>
      ) : items.length === 0 ? (
        /* 空态：U1-I 全域统一组件（philia 精灵 + 一句话 + 一行动）；U4-D3 试样 12 工艺 */
        <EmptyState
          title="没有找到相关商品"
          desc={keyword ? '换个关键词试试，或看看其他分类' : '这个分类暂时没有商品，看看别的吧'}
          action={
            keyword ? (
              <button
                type="button"
                onClick={() => setSearchText('')}
                className="rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                清空搜索
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {items.map((it) => (
              <ProductCard key={it.id} item={it} onQuickAdd={quickAdd} />
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
