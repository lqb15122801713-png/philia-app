/**
 * 商品 /products（U3 批次 · 任务 I · 规格书 §8 · 母本试样 519-556 行 + .prod CSS 124-132 行）
 *
 * - 数据：mall.listProductsForStore（merchantProcedure，本店全部商品含下架；
 *   分类筛选 + 关键词搜索在服务端过滤，搜索 300ms 防抖沿用）。
 * - 结构：MainScaffold（title 商品 / sub 在售·已下架·低库存真值 / 搜索 + 柠檬钮新增）
 *   → u3-chipf 分类 chips（当前墨底）→ 4 列商品卡（纸面 ring 20 圆角 overflow hidden）。
 * - 卡片：图区 110px 定高（试样 .prod .ph 落值；规格书 §8「4:3 图」为裁切意图，
 *   试样为落地数值——从试样，货架密度优先；images[0]，无图=浅木色块 #D4B896）+ 名 +
 *   价 Montserrat tabular（¥/件）+ 库存 + 状态（在售 live / 低库存 amber（库存<5） /
 *   已下架 done 半透明）。点击卡→编辑弹层。
 * - 上下架：不新造开关——ProductEditorDialog 内「上架销售」Switch 走 upsertProduct
 *   真实链路（失败原文 toast + invalidate 回拉），越店写 FORBIDDEN 由服务端强制。
 */

import { usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { PackageOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import MainScaffold, { LemonButton, QuietButton, SearchInput } from '@/components/MainScaffold'
import ProductEditorDialog from '@/components/mall-admin/ProductEditorDialog'
import {
  errMsg,
  fenToYuan,
  PRODUCT_CATEGORIES,
  PRODUCTS_KEY,
  type StoreProduct,
} from '@/components/mall-admin/format'

/** U3 低库存口径（规格书 §8 真值）：库存 < 5 */
const LOW_STOCK = 5

/** 卡片状态胶囊：已下架 done / 低库存 amber / 在售 live */
function prodStatus(p: StoreProduct): { cls: string; label: string } {
  if (p.status !== 'on') return { cls: 'u3-st done', label: '已下架' }
  if (p.stock < LOW_STOCK) return { cls: 'u3-st amber', label: '低库存' }
  return { cls: 'u3-st live', label: '在售' }
}

export default function ProductsPage() {
  const { trpc } = usePhiliaClient()

  const [category, setCategory] = useState('')
  const [kw, setKw] = useState('')
  const [keyword, setKeyword] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<StoreProduct | null>(null)

  // 搜索 300ms 防抖（沿用现有口径）
  useEffect(() => {
    const t = window.setTimeout(() => setKeyword(kw.trim()), 300)
    return () => window.clearTimeout(t)
  }, [kw])

  const listQuery = useQuery({
    queryKey: [...PRODUCTS_KEY, { category: category || undefined, keyword: keyword || undefined }],
    queryFn: () =>
      trpc.mall.listProductsForStore.query({
        category: category || undefined,
        keyword: keyword || undefined,
        page: 1,
        pageSize: 100,
      }),
  })

  // 副行计数真值：不带筛选的全量查询（同接口同缓存前缀，不新增接口）
  const statsQuery = useQuery({
    queryKey: [...PRODUCTS_KEY, 'u3-stats'],
    queryFn: () => trpc.mall.listProductsForStore.query({ page: 1, pageSize: 100 }),
  })

  const items = listQuery.data?.items ?? []

  const sub = useMemo(() => {
    const all = statsQuery.data?.items
    if (!all) return '门店商品库存、价格与上下架'
    const on = all.filter((p) => p.status === 'on').length
    const off = all.length - on
    const low = all.filter((p) => p.status === 'on' && p.stock < LOW_STOCK).length
    return `在售 ${on} · 已下架 ${off} · 低库存 ${low}`
  }, [statsQuery.data])

  const openEditor = (p: StoreProduct | null) => {
    setEditing(p)
    setEditorOpen(true)
  }

  return (
    <MainScaffold
      testid="products-page"
      title="商品"
      sub={sub}
      actions={
        <>
          <SearchInput placeholder="搜索商品…" value={kw} onChange={setKw} testid="products-search" />
          <LemonButton testid="products-create" onClick={() => openEditor(null)}>
            ＋ 新增商品
          </LemonButton>
        </>
      }
    >
      {/* 分类 chips（当前墨底；映射服务端 category 查询参数） */}
      <div className="mb-[14px] flex flex-wrap gap-2">
        {['', ...PRODUCT_CATEGORIES].map((c) => (
          <button
            key={c || 'all'}
            type="button"
            data-testid={`products-chip-${c || 'all'}`}
            onClick={() => setCategory(c)}
            className={`u3-chipf ${category === c ? 'on' : ''}`}
          >
            {c || '全部'}
          </button>
        ))}
      </div>

      {listQuery.isPending ? (
        /* 骨架（禁转圈）：纸面卡轮廓 pulse */
        <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[20px] bg-[#FFFDF6] shadow-[0_0_0_1px_rgba(74,59,46,.09)]"
            >
              <div className="h-[110px] w-full animate-pulse bg-[rgba(74,59,46,.06)]" />
              <div className="space-y-2 px-[13px] py-[11px]">
                <div className="h-3 w-3/4 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
                <div className="h-3.5 w-1/3 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
              </div>
            </div>
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="u3-panel px-[17px] py-10 text-center">
          <p className="text-sm font-bold text-ink">加载失败</p>
          <p className="mt-1 text-xs text-[rgba(74,59,46,.62)]">{errMsg(listQuery.error)}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="u3-panel flex flex-col items-center px-[17px] py-14">
          <PackageOpen size={34} strokeWidth={1.2} className="text-[rgba(74,59,46,.42)]" />
          <p className="mt-3 text-sm font-bold text-ink">货架空空，去上架第一件商品</p>
          <div className="mt-4">
            <QuietButton testid="products-empty-create" onClick={() => openEditor(null)}>
              ＋ 新增商品
            </QuietButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => {
            const cover = p.images?.[0]
            const st = prodStatus(p)
            const off = p.status !== 'on'
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`product-card-${p.id}`}
                onClick={() => openEditor(p)}
                className={`overflow-hidden rounded-[20px] bg-[#FFFDF6] text-left shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] ${
                  off ? 'opacity-60' : ''
                }`}
              >
                {cover ? (
                  <img src={cover} alt={p.name} className="h-[110px] w-full object-cover" />
                ) : (
                  <div className="h-[110px] w-full bg-[#D4B896]" />
                )}
                <div className="px-[13px] py-[11px]">
                  <div className="truncate text-xs font-bold text-ink">{p.name}</div>
                  <div className="mt-[5px] font-number text-sm font-bold tabular-nums text-ink">
                    ¥{fenToYuan(p.priceFen)}
                    <small className="ml-1 text-[11px] font-medium text-[rgba(74,59,46,.42)]">/ 件</small>
                  </div>
                  <div className="mt-[3px] flex items-center gap-1.5 text-[11px] text-[rgba(74,59,46,.62)]">
                    <span className="font-number tabular-nums">库存 {p.stock}</span>
                    <span aria-hidden>·</span>
                    <span className={st.cls}>{st.label}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {listQuery.data && listQuery.data.total > listQuery.data.items.length ? (
        <p className="mt-2 text-[11px] text-[rgba(74,59,46,.42)]">
          结果较多，当前显示前 {listQuery.data.items.length} 条，请用分类 / 搜索缩小范围
        </p>
      ) : null}

      <ProductEditorDialog open={editorOpen} product={editing} onClose={() => setEditorOpen(false)} />
    </MainScaffold>
  )
}
