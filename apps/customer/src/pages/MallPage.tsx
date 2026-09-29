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
import { Link, useNavigate } from 'react-router-dom';
import CartLink from '../components/mall/CartLink';
import { mc } from '../components/member/copy';
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
  rebateBp,
  hookText,
}: {
  item: ProductItem;
  /** U1-G 快加购（真加购链路 cartStore.addItem；售罄不渲染） */
  onQuickAdd: (item: ProductItem) => void;
  /** 回馈金返显（APP-18：全员同价+按档返；非会员/免费档=0 不渲染假数） */
  rebateBp: number;
  /** 体验急修批 B：rebateBp=0 时的规则钩子文案（读表拼好传入；空串=不渲染） */
  hookText: string;
}) {
  /* 片 2 M-01 定稿（§4.7）：图 4:3 + 名 12.5/700 两行 + 价 mono 14/700 + 右 mono 8.5
     「返 ¥x 回馈金」（APP-18 口径）+ qadd 30 圆深棕「＋」（:active scale .9） */
  const rebateFen = rebateBp > 0 ? Math.round((item.priceFen * rebateBp) / 10000) : 0;
  const navigate = useNavigate();
  const gotoHook = (e: { preventDefault(): void; stopPropagation(): void }) => {
    e.preventDefault();
    e.stopPropagation();
    navigate('/member/open');
  };
  return (
    <div className="u1-card relative overflow-hidden">
      <Link to={`/mall/product/${item.id}`} className="block transition active:scale-[0.99]">
        <ProductImage src={item.images?.[0]} alt={item.name} className="aspect-[4/3] w-full" />
        <div className="px-3 pb-3 pt-2.5">
          <p className="line-clamp-2 min-h-8 text-[12.5px] font-bold leading-4">{item.name}</p>
          <div className="mt-[7px] flex items-baseline pr-8">
            <p className="u1-num text-body-sm font-bold text-ink">{fenToYuan(item.priceFen)}</p>
            {rebateFen > 0 ? (
              <span className="ml-auto font-number text-[8.5px] tabular-nums text-ink-secondary">
                返 {fenToYuan(rebateFen)} 回馈金
              </span>
            ) : hookText ? (
              /* 体验急修批 B：微光/非会员=规则钩子（不上假数），点击→/member/open（J-01） */
              <span
                role="link"
                tabIndex={0}
                data-testid="mall-rebate-hook"
                className="ml-auto font-number text-[8.5px] tabular-nums text-ink-secondary underline decoration-[#B9A482] underline-offset-2"
                onClick={gotoHook}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') gotoHook(e)
                }}
              >
                {hookText}
              </span>
            ) : null}
          </div>
          {item.stock <= 0 ? (
            <span className="mt-1 inline-block rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">已售罄</span>
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
          className="absolute bottom-3 right-3 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#2E2318] text-[#F6EFDD] transition-transform duration-120 ease-philia-spring active:scale-90"
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

  // 会员档回馈金比例（返显口径 APP-18：按档返；非会员/免费档=0 不渲染假数）
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  /* 返显钩子（体验急修批 B）：付费档比例读表（member_plans public）；缺省不渲染（不上假数） */
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 300_000,
  });
  const hookPcts = (plansQ.data?.plans ?? [])
    .filter((p) => p.rebateBp > 0)
    .map((p) => p.rebateBp / 100)
    .join('/');
  const hookText = hookPcts ? mc('mall.rebateHook', { pcts: hookPcts }) : '';

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
    /* 片 2 M-01：apphead（serif 27 大题+mono 注记）+ delbar 槽位置灰（PD-15 V1.1 槽位 13） */
    <div className="pb-28">
      {toastEl}
      <div className="m2-apphead">
        <span className="tt">商城</span>
        <span className="no">MALL · 给它买点好的</span>
      </div>

      {/* 配送条槽位（PD-15 V1.1 槽位 13：配送时效=运营后期端口；置灰不上假时效，留口注记） */}
      <div className="px-[22px] mt-3">
        <div
          className="flex items-center gap-3 rounded-[14px] bg-card px-4 py-3 ring-1 ring-line-ring opacity-60"
          data-testid="slot-delivery"
          aria-disabled="true"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-secondary" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
          <div className="min-w-0 flex-1">
            <p className="text-caption font-bold text-ink">配送至 · ——</p>
            <p className="mt-0.5 font-number text-[9.5px] text-ink-placeholder">配送时效 · 即将点亮</p>
          </div>
          <span className="text-caption-xs text-ink-placeholder" aria-hidden="true">›</span>
        </div>
      </div>

      <div className="px-[22px] pt-1">
      {/* 购物袋入口（头部右上，试样 07 细线 pill） */}
      <div className="mt-3 flex items-center justify-end">
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
              <ProductCard key={it.id} item={it} onQuickAdd={quickAdd} rebateBp={rebateBp} hookText={hookText} />
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
