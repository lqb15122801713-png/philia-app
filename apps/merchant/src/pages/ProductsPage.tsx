/**
 * 商品 /products（U3 批次 · 任务 I · 规格书 §8；片 5 段 2 W-10 校形：卡墙→M5 台账）
 *
 * - 数据：mall.listProductsForStore（merchantProcedure，本店全部商品含下架；
 *   分类筛选 + 关键词搜索在服务端过滤，搜索 300ms 防抖沿用）。
 * - 结构（W-10 序位）：wtop（CSV 导入钮 + G2 新增 + 搜索）→ G1 类目 chips
 *   → M5 台账（商品/类目/价/库存（低库存红字）/状态/日盘档；日盘档=单价 ≥¥100
 *   每日盘点门槛，S-08 同口径）。
 * - CSV 导入（片 5 段 4 点亮）：owner|manager 可用（clerk 隐藏，server
 *   merchantManagerProcedure 硬闸）——导入区块四步：①模板下载（productImportTemplate
 *   →Blob）②文件选择读文本 ③预览校验（productImportPreview dry-run，失败行逐行
 *   红字回显）④全部合法才亮「确认导入」（productImportExecute → toast+invalidate）。
 * - 上下架：不新造开关——ProductEditorDialog 内「上架销售」Switch 走 upsertProduct
 *   真实链路（失败原文 toast + invalidate 回拉），越店写 FORBIDDEN 由服务端强制。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PackageOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import MainScaffold, { LemonButton, QuietButton, SearchInput } from '@/components/MainScaffold'
import ProductEditorDialog from '@/components/mall-admin/ProductEditorDialog'
import { pd } from '@/copy/products'
import { useMerchantRole } from '@/lib/roles'
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
  const { trpc, queryClient } = usePhiliaClient()
  const role = useMerchantRole()

  const [category, setCategory] = useState('')
  const [kw, setKw] = useState('')
  const [keyword, setKeyword] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<StoreProduct | null>(null)

  /* ---- CSV 导入（片 5 段 4 点亮 · owner|manager） ---- */
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvName, setCsvName] = useState('')

  /** ①模板下载：productImportTemplate → Blob 浏览器下载（照 CashierRefundsPage 工艺） */
  const downloadTemplate = async () => {
    try {
      const t = await trpc.mall.productImportTemplate.query()
      const blob = new Blob([t.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = t.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  /** ③预览校验（dry-run 零写入；失败行逐行红字回显） */
  const previewM = useMutation({
    mutationFn: () => trpc.mall.productImportPreview.mutate({ csvText, filename: csvName || undefined }),
    onError: (e) => toast.error(errMsg(e)),
  })

  /** ④确认导入（全量或零：仅预览全合法时亮钮；成功 → toast+invalidate 商品列表） */
  const executeM = useMutation({
    mutationFn: () => trpc.mall.productImportExecute.mutate({ csvText, filename: csvName || undefined }),
    onSuccess: (r) => {
      toast.success(pd('prod.csvDone', { n: r.okRows }))
      setImportOpen(false)
      setCsvText('')
      setCsvName('')
      previewM.reset()
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY })
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const previewReport = previewM.data?.report as
    | { totalRows?: number; okRows?: number; failRows?: number; headerError?: string; templateHint?: string }
    | undefined
  const previewRows = previewM.data?.rows ?? []
  const failedRows = previewRows.filter((r) => !r.ok)
  const canExecute =
    !!previewM.data && !previewReport?.headerError && failedRows.length === 0 && previewRows.length > 0

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
        // QA40-D2：管理端显式含安心包类目（售卖侧默认排除，管理可见性保留）
        includeCarePackage: true,
        page: 1,
        pageSize: 100,
      }),
  })

  // 副行计数真值：不带筛选的全量查询（同接口同缓存前缀，不新增接口）
  const statsQuery = useQuery({
    queryKey: [...PRODUCTS_KEY, 'u3-stats'],
    queryFn: () => trpc.mall.listProductsForStore.query({ includeCarePackage: true, page: 1, pageSize: 100 }),
  })

  const items = listQuery.data?.items ?? []

  const sub = useMemo(() => {
    const all = statsQuery.data?.items
    if (!all) return pd('prod.subFallback')
    const on = all.filter((p) => p.status === 'on').length
    const off = all.length - on
    const low = all.filter((p) => p.status === 'on' && p.stock < LOW_STOCK).length
    return pd('prod.sub', { on, off, low })
  }, [statsQuery.data])

  const openEditor = (p: StoreProduct | null) => {
    setEditing(p)
    setEditorOpen(true)
  }

  return (
    <MainScaffold
      testid="products-page"
      title={pd('prod.title')}
      sub={sub}
      actions={
        <>
          <SearchInput placeholder="搜索商品…" value={kw} onChange={setKw} testid="products-search" />
          {/* W-10 wtop CSV 入口（片 5 段 4 点亮）：owner|manager 可用（clerk 隐藏，
              server merchantManagerProcedure 硬闸）→ 展开导入区块 */}
          {role.canManage ? (
            <QuietButton testid="products-csv" onClick={() => setImportOpen((v) => !v)}>
              {pd('prod.csvCta')}
            </QuietButton>
          ) : null}
          <LemonButton testid="products-create" onClick={() => openEditor(null)}>
            {pd('prod.createCta')}
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

      {/* CSV 导入区块（片 5 段 4）：模板下载 → 文件选择 → 预览校验（失败行红字回显）
          → 全部合法才亮「确认导入」；owner|manager（wtop 入口同闸） */}
      {importOpen && role.canManage ? (
        <div className="u3-panel mb-[14px]" data-testid="products-import">
          <div className="u3-panel-head">
            <h3>{pd('prod.csvImportTitle')}</h3>
            <button
              type="button"
              className="text-caption-xs font-bold text-[rgba(59,46,36,.62)]"
              data-testid="csv-close"
              onClick={() => setImportOpen(false)}
            >
              {pd('prod.csvClose')}
            </button>
          </div>
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-4">
            <div className="flex flex-wrap items-center gap-2">
              <QuietButton testid="csv-template" onClick={() => void downloadTemplate()}>
                {pd('prod.csvTemplateCta')}
              </QuietButton>
              <label className="u1-ring cursor-pointer rounded-control bg-card px-4 py-3.5 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]">
                {pd('prod.csvFileCta')}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  data-testid="csv-file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setCsvName(f.name)
                    setCsvText(await f.text())
                    previewM.reset()
                  }}
                />
              </label>
              {csvName ? (
                <span className="u1-num text-caption-xs text-[rgba(59,46,36,.62)]" data-testid="csv-filename">
                  {csvName}
                </span>
              ) : null}
              <QuietButton
                testid="csv-preview"
                disabled={!csvText || previewM.isPending}
                onClick={() => {
                  if (!csvText) {
                    toast.error(pd('prod.csvNoFile'))
                    return
                  }
                  previewM.mutate()
                }}
              >
                {pd('prod.csvPreviewCta')}
              </QuietButton>
              {canExecute ? (
                <LemonButton
                  testid="csv-execute"
                  disabled={executeM.isPending}
                  onClick={() => executeM.mutate()}
                >
                  {pd('prod.csvExecuteCta')}
                </LemonButton>
              ) : null}
            </div>
            {previewM.data ? (
              <div className="mt-3" data-testid="csv-preview-result">
                {previewReport?.headerError ? (
                  <p className="text-caption font-semibold text-danger-deep">
                    {previewReport.headerError}
                    {previewReport.templateHint ? `（${previewReport.templateHint}）` : ''}
                  </p>
                ) : (
                  <p className="text-caption">
                    {pd('prod.csvSummary', {
                      t: previewReport?.totalRows ?? previewRows.length,
                      ok: previewReport?.okRows ?? previewRows.length - failedRows.length,
                      f: previewReport?.failRows ?? failedRows.length,
                    })}
                    {canExecute ? (
                      <span className="u3-st live ml-2">{pd('prod.csvAllOk')}</span>
                    ) : null}
                  </p>
                )}
                {failedRows.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {failedRows.map((r) => (
                      <li
                        key={r.line}
                        className="text-caption-xs font-semibold text-danger-deep"
                        data-testid={`csv-fail-${r.line}`}
                      >
                        行{r.line}
                        {r.name ? `（${r.name}）` : ''}：{r.error}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {listQuery.isPending ? (
        /* 加载中骨架块（animate-pulse，禁转圈）：台账行 = shared Skeleton 组合 */
        <div className="u3-panel space-y-2 px-[17px] py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="u3-panel px-[17px] py-10 text-center">
          <p className="text-sm font-bold text-ink">加载失败</p>
          <p className="mt-1 text-xs text-[rgba(59,46,36,.62)]">{errMsg(listQuery.error)}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="u3-panel flex flex-col items-center px-[17px] py-14">
          <PackageOpen size={34} strokeWidth={1.2} className="text-[rgba(59,46,36,.42)]" />
          <p className="mt-3 text-sm font-bold text-ink">{pd('prod.emptyTitle')}</p>
          <div className="mt-4">
            <QuietButton testid="products-empty-create" onClick={() => openEditor(null)}>
              {pd('prod.createCta')}
            </QuietButton>
          </div>
        </div>
      ) : (
        /* W-10 M5 台账（商品/类目/价/库存低库存红字/状态/日盘档）；行点→编辑弹层（真实链路保留） */
        <div className="u3-panel">
          <div className="u3-noscrollx overflow-x-auto">
            <table className="u3-tbl min-w-[760px]">
              <thead>
                <tr>
                  <th>商品</th>
                  <th>类目</th>
                  <th className="!text-right">价</th>
                  <th className="!text-right">库存</th>
                  <th>状态</th>
                  <th>{pd('prod.dailyCountCol')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const st = prodStatus(p)
                  const off = p.status !== 'on'
                  const low = !off && p.stock < LOW_STOCK
                  const dailyCount = p.priceFen >= 10000
                  return (
                    <tr
                      key={p.id}
                      className={`rowlink ${off ? 'opacity-60' : ''}`}
                      data-testid={`product-card-${p.id}`}
                      onClick={() => openEditor(p)}
                    >
                      <td>
                        <span className="font-bold text-ink">{p.name}</span>
                      </td>
                      <td className="text-[rgba(59,46,36,.62)]">{p.category}</td>
                      <td className="whitespace-nowrap text-right">
                        <span className="font-number font-bold tabular-nums text-ink">¥{fenToYuan(p.priceFen)}</span>
                        <span className="ml-1 text-caption-xs text-[rgba(59,46,36,.42)]">/ 件</span>
                      </td>
                      <td
                        className={`whitespace-nowrap text-right font-number tabular-nums ${
                          low ? 'font-bold text-danger-deep' : 'text-ink'
                        }`}
                        data-testid={`product-stock-${p.id}`}
                      >
                        {p.stock}
                      </td>
                      <td>
                        <span className={st.cls}>{st.label}</span>
                      </td>
                      <td>
                        {dailyCount ? (
                          <span className="u3-st amber">{pd('prod.dailyCountYes')}</span>
                        ) : (
                          <span className="text-caption-xs text-[rgba(59,46,36,.3)]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="products-daily-count-note">
            {pd('prod.dailyCountNote')}
          </p>
        </div>
      )}

      {listQuery.data && listQuery.data.total > listQuery.data.items.length ? (
        <p className="mt-2 text-[11px] text-[rgba(59,46,36,.42)]">
          结果较多，当前显示前 {listQuery.data.items.length} 条，请用分类 / 搜索缩小范围
        </p>
      ) : null}

      <ProductEditorDialog open={editorOpen} product={editing} onClose={() => setEditorOpen(false)} />
    </MainScaffold>
  )
}
