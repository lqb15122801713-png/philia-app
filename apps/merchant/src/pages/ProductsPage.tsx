/**
 * 商品管理页（T5.2 · coder-mall-merchant）—— 路由 /products
 *
 * - 数据：mall.listProductsForStore（merchantProcedure，本店全部商品含下架；
 *   分类筛选 + 关键词搜索在服务端过滤，搜索 300ms 防抖）。
 * - 表格：主图缩略 / 名称 / 分类 / 价格（元，tabular-nums）/ 库存（<10 红色）/
 *   状态开关（上下架即时切换，optimistic + 失败回滚）/ 编辑。
 * - 新增 / 编辑：ProductEditorDialog（多图上传 products/<storeId>，元→分转换）。
 */

import { usePhiliaClient } from '@philia/shared'
import { useQuery, type QueryKey } from '@tanstack/react-query'
import { PackageOpen, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import ProductEditorDialog from '@/components/mall-admin/ProductEditorDialog'
import {
  errMsg,
  fenToYuan,
  LOW_STOCK_THRESHOLD,
  PRODUCT_CATEGORIES,
  PRODUCTS_KEY,
  type StoreProduct,
} from '@/components/mall-admin/format'
import { Badge, Btn, Empty, inputCls, Loading, numStyle, Switch } from '@/components/mall-admin/ui'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@philia/shared'

type ProductsResult = inferRouterOutputs<AppRouter>['mall']['listProductsForStore']

export default function ProductsPage() {
  const { trpc, queryClient } = usePhiliaClient()

  const [category, setCategory] = useState('')
  const [kw, setKw] = useState('')
  const [keyword, setKeyword] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<StoreProduct | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // 搜索 300ms 防抖
  useEffect(() => {
    const t = window.setTimeout(() => setKeyword(kw.trim()), 300)
    return () => window.clearTimeout(t)
  }, [kw])

  const queryKey = useMemo<QueryKey>(
    () => [...PRODUCTS_KEY, { category: category || undefined, keyword: keyword || undefined }],
    [category, keyword],
  )

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      trpc.mall.listProductsForStore.query({
        category: category || undefined,
        keyword: keyword || undefined,
        page: 1,
        pageSize: 100,
      }),
  })

  const items = listQuery.data?.items ?? []

  /** 上下架：optimistic 改写缓存 → 提交 → 失败回滚 + 原文 toast */
  const toggleStatus = async (p: StoreProduct) => {
    const nextStatus = (p.status === 'on' ? 'off' : 'on') as 'on' | 'off'
    const snapshots = queryClient.getQueriesData<ProductsResult>({ queryKey: PRODUCTS_KEY })
    queryClient.setQueriesData<ProductsResult>({ queryKey: PRODUCTS_KEY }, (old) =>
      old
        ? { ...old, items: old.items.map((it) => (it.id === p.id ? { ...it, status: nextStatus } : it)) }
        : old,
    )
    setTogglingId(p.id)
    try {
      await trpc.mall.upsertProduct.mutate({
        productId: p.id,
        category: p.category,
        name: p.name,
        description: p.description ?? undefined,
        images: p.images ?? [],
        priceFen: p.priceFen,
        stock: p.stock,
        status: nextStatus,
      })
      toast.success(nextStatus === 'on' ? `「${p.name}」已上架` : `「${p.name}」已下架`)
    } catch (e) {
      // 回滚到操作前快照
      for (const [key, data] of snapshots) queryClient.setQueryData(key, data)
      toast.error(errMsg(e))
    } finally {
      setTogglingId(null)
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY })
    }
  }

  return (
    <div className="px-4 pb-6 lg:px-8">
      <header className="flex items-end justify-between pt-6">
        <div>
          <h1 className="text-title-lg">商品管理</h1>
          <p className="mt-0.5 text-caption text-ink-secondary">
            {listQuery.data ? `共 ${listQuery.data.total} 件商品（含下架）` : '门店商品库存、价格与上下架'}
          </p>
        </div>
        <Btn
          variant="primary"
          onClick={() => {
            setEditing(null)
            setEditorOpen(true)
          }}
        >
          <Plus size={16} strokeWidth={2} />
          新增商品
        </Btn>
      </header>

      {/* 筛选行：分类 + 搜索 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {['', ...PRODUCT_CATEGORIES].map((c) => (
            <button
              key={c || 'all'}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1.5 text-caption transition-colors duration-150 ${
                category === c
                  ? 'bg-brand-primary text-white'
                  : 'bg-card text-ink-secondary shadow-card hover:text-ink'
              }`}
            >
              {c || '全部'}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-placeholder" />
          <input
            className={`${inputCls} pl-8`}
            placeholder="搜索商品名 / 描述"
            value={kw}
            maxLength={64}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
      </div>

      {/* 商品表格 */}
      <div className="mt-3 overflow-hidden rounded-card bg-card shadow-card">
        {listQuery.isPending ? (
          <Loading />
        ) : listQuery.isError ? (
          <Empty title="加载失败" hint={errMsg(listQuery.error)} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-ink-placeholder">
            <PackageOpen size={36} strokeWidth={1.2} />
            <p className="mt-2 text-body">暂无商品</p>
            <p className="mt-1 text-caption">点击右上角「新增商品」上架第一件商品</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line-divider text-caption text-ink-secondary">
                  <th className="px-4 py-2.5 font-medium">商品</th>
                  <th className="px-3 py-2.5 font-medium">分类</th>
                  <th className="px-3 py-2.5 font-medium">价格</th>
                  <th className="px-3 py-2.5 font-medium">库存</th>
                  <th className="px-3 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const cover = p.images?.[0]
                  const low = p.stock < LOW_STOCK_THRESHOLD
                  const on = p.status === 'on'
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-line-divider text-[13px] last:border-b-0 hover:bg-canvas/60"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {cover ? (
                            <img
                              src={cover}
                              alt={p.name}
                              className="h-11 w-11 shrink-0 rounded-tag border border-line object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tag bg-sunken text-ink-placeholder">
                              <PackageOpen size={18} strokeWidth={1.5} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink">{p.name}</div>
                            {p.description ? (
                              <div className="mt-0.5 max-w-56 truncate text-caption text-ink-placeholder">
                                {p.description}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={p.category === '其他' ? 'muted' : 'brand'}>{p.category}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-number font-semibold text-ink" style={numStyle}>
                          ¥{fenToYuan(p.priceFen)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`font-number font-semibold ${low ? 'text-danger-deep' : 'text-ink'}`}
                          style={numStyle}
                        >
                          {p.stock}
                        </span>
                        {low ? <span className="ml-1 text-caption text-danger-deep">低库存</span> : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={on}
                            disabled={togglingId === p.id}
                            onChange={() => void toggleStatus(p)}
                            label={on ? '下架' : '上架'}
                          />
                          <span className={`text-caption ${on ? 'text-success-deep' : 'text-ink-placeholder'}`}>
                            {on ? '在售' : '下架'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(p)
                            setEditorOpen(true)
                          }}
                        >
                          编辑
                        </Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {listQuery.data && listQuery.data.total > listQuery.data.items.length ? (
        <p className="mt-2 text-caption text-ink-placeholder">
          结果较多，当前显示前 {listQuery.data.items.length} 条，请用分类 / 搜索缩小范围
        </p>
      ) : null}

      <ProductEditorDialog open={editorOpen} product={editing} onClose={() => setEditorOpen(false)} />
    </div>
  )
}
