/**
 * 商品 /products（U3 批次 · 任务 I · 规格书 §8；片 5 段 2 W-10 校形：卡墙→M5 台账）
 *
 * - 数据：mall.listProductsForStore（merchantProcedure，本店全部商品含下架；
 *   分类筛选 + 关键词搜索在服务端过滤，搜索 300ms 防抖沿用）。
 * - 结构（W-10 序位）：wtop（CSV 导入钮 + G2 新增 + 搜索）→ G1 类目 chips
 *   → M5 台账（商品/类目/价/成本（canManage 视界）/库存（低库存红字）/状态/日盘档；
 *   日盘档=单价 ≥¥100 每日盘点门槛，S-08 同口径）。
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
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import MainScaffold, { LemonButton, QuietButton, SearchInput } from '@/components/MainScaffold'
import ProductEditorDialog from '@/components/mall-admin/ProductEditorDialog'
import { pd } from '@/copy/products'
import { iv } from '@/copy/inventory'
import { useMerchantRole } from '@/lib/roles'
import {
  errMsg,
  fenToYuan,
  fmtMoney,
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
  const navigate = useNavigate()

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

  /* ---- 端口批收尾片 2 · 批量编辑模式（网格白名单=库存/价（分）/描述/下限/上限；
     成本列保持只读=涉账不进网格；价签仅店主 manager 禁编+title 提示） ---- */
  type BulkField = 'stock' | 'priceFen' | 'description' | 'minStock' | 'maxStock'
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, Partial<Record<BulkField, string>>>>({})
  const [bulkSaving, setBulkSaving] = useState(false)

  /** 行原值 → 文本（null 上下限/描述=空串） */
  const bulkOriginal = (p: StoreProduct, f: BulkField): string => {
    const v = p[f]
    return v === null || v === undefined ? '' : String(v)
  }
  const setBulk = (id: string, f: BulkField, text: string) =>
    setBulkDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [f]: text } }))
  const bulkText = (p: StoreProduct, f: BulkField): string => bulkDrafts[p.id]?.[f] ?? bulkOriginal(p, f)
  const isDirtyRow = (p: StoreProduct): boolean =>
    (['stock', 'priceFen', 'description', 'minStock', 'maxStock'] as BulkField[]).some(
      (f) => bulkText(p, f) !== bulkOriginal(p, f),
    )
  const dirtyRows = useMemo(() => items.filter(isDirtyRow), [items, bulkDrafts]) // eslint-disable-line react-hooks/exhaustive-deps

  const exitBulk = () => {
    setBulkMode(false)
    setBulkDrafts({})
  }

  /** 数值字段文本 → 非负整数（空串=不合法，调用方先判 dirty 才收集） */
  const parseIntField = (t: string): number | null => {
    const v = Number(t.trim())
    if (t.trim() === '' || !Number.isInteger(v) || v < 0) return null
    return v
  }

  const bulkSave = async () => {
    const payload: Array<{ productId: string; fields: Record<string, unknown> }> = []
    for (const p of dirtyRows) {
      if (p.category === 'care_package') continue // 安心包独立库存域只读（server 同硬拒）
      const fields: Record<string, unknown> = {}
      let bad = false
      const putNum = (f: 'stock' | 'priceFen', key: string) => {
        if (bulkText(p, f) === bulkOriginal(p, f)) return
        const v = parseIntField(bulkText(p, f))
        if (v === null) bad = true
        else fields[key] = v
      }
      const putNullableNum = (f: 'minStock' | 'maxStock', key: string) => {
        if (bulkText(p, f) === bulkOriginal(p, f)) return
        if (bulkText(p, f).trim() === '') {
          fields[key] = null
          return
        }
        const v = parseIntField(bulkText(p, f))
        if (v === null) bad = true
        else fields[key] = v
      }
      putNum('stock', 'stock')
      putNum('priceFen', 'priceFen')
      putNullableNum('minStock', 'minStock')
      putNullableNum('maxStock', 'maxStock')
      if (bulkText(p, 'description') !== bulkOriginal(p, 'description')) {
        const t = bulkText(p, 'description').trim()
        fields.description = t === '' ? null : t
      }
      if (bad) {
        toast.error(pd('prod.bulkInvalid'))
        return
      }
      if (Object.keys(fields).length > 0) payload.push({ productId: p.id, fields })
    }
    if (payload.length === 0) {
      exitBulk()
      return
    }
    setBulkSaving(true)
    try {
      const r = await trpc.mall.bulkUpdateProducts.mutate({ items: payload.slice(0, 50) })
      toast.success(pd('prod.bulkDone', { n: r.updated }))
      exitBulk()
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY })
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBulkSaving(false)
    }
  }

  /* ---- 行内删除（owner；回收站软删 → 控制台 D5 可恢复） ---- */
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleteProduct = async (p: StoreProduct) => {
    if (!window.confirm(pd('prod.deleteConfirm', { name: p.name }))) return
    setDeletingId(p.id)
    try {
      await trpc.mall.deleteProduct.mutate({ productId: p.id })
      toast.success(pd('prod.deleteDone'))
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY })
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setDeletingId(null)
    }
  }

  /** 删除小钮（owner 才显；安心包行硬拒不显——独立库存域只读 v1） */
  const deleteBtn = (p: StoreProduct) =>
    role.isOwner && p.category !== 'care_package' ? (
      <button
        type="button"
        data-testid={`products-delete-${p.id}`}
        disabled={deletingId === p.id}
        onClick={(e) => {
          e.stopPropagation()
          void deleteProduct(p)
        }}
        className="u1-ring rounded-chip bg-card px-2 py-1 text-caption-xs font-semibold text-danger-deep transition-transform duration-120 ease-philia-spring active:scale-[0.96]"
      >
        {pd('prod.deleteCta')}
      </button>
    ) : null

  /** 批量网格数值输入（等宽数字；manager 价签禁编+title 提示） */
  const bulkNumInput = (p: StoreProduct, f: BulkField, testid: string, ownerOnly = false) => {
    const disabled = ownerOnly && !role.isOwner
    return (
      <input
        type="number"
        min={0}
        step={1}
        data-testid={`${testid}-${p.id}`}
        disabled={disabled}
        title={disabled ? pd('prod.bulkPriceOwnerOnly') : undefined}
        value={bulkText(p, f)}
        onChange={(e) => setBulk(p.id, f, e.target.value)}
        className={`w-20 rounded-control bg-card px-2 py-1.5 text-caption tabular-nums text-ink shadow-hairline ring-1 ring-line-ring focus:outline-none focus:ring-[rgba(59,46,36,.25)] ${disabled ? 'opacity-50' : ''}`}
      />
    )
  }

  return (
    <MainScaffold
      testid="products-page"
      title={pd('prod.title')}
      sub={sub}
      actions={
        <>
          <SearchInput placeholder="搜索商品…" value={kw} onChange={setKw} testid="products-search" />
          {/* 片 4：库存域入口链（rail 冻结不改=页面互链口径） */}
          {role.canManage ? (
            <QuietButton testid="products-to-inventory" onClick={() => navigate('/inventory')}>
              {iv('inv.pageTitle')} →
            </QuietButton>
          ) : null}
          {/* W-10 wtop CSV 入口（片 5 段 4 点亮）：owner|manager 可用（clerk 隐藏，
              server merchantManagerProcedure 硬闸）→ 展开导入区块 */}
          {role.canManage ? (
            <QuietButton testid="products-csv" onClick={() => setImportOpen((v) => !v)}>
              {pd('prod.csvCta')}
            </QuietButton>
          ) : null}
          {/* 端口批收尾片 2：批量编辑模式 toggle（owner|manager；网格内再分流价签 owner-only） */}
          {role.canManage ? (
            <QuietButton
              testid="products-bulk-toggle"
              onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
            >
              {bulkMode ? pd('prod.bulkCancel') : pd('prod.bulkToggle')}
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
            {/* 大批片 4 导入说明：可选尾列 进价(元)/库存下限/库存上限（server 已扩列兼容） */}
            <p className="mt-2 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="csv-opt-cols-note">
              {pd('prod.csvOptColsNote')}
            </p>
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
      ) : bulkMode ? (
        /* 端口批收尾片 2 · 批量编辑网格（五列可编辑：库存/价（分）/描述/下限/上限；
           成本列保持只读=涉账不进网格；脏行高亮+浮动条计数；安心包行只读跳编） */
        <div className="u3-panel" data-testid="products-bulk-grid">
          <div className="u3-noscrollx overflow-x-auto">
            <table className="u3-tbl min-w-[980px]">
              <thead>
                <tr>
                  <th>商品</th>
                  <th>类目</th>
                  <th className="!text-right">库存</th>
                  <th className="!text-right">价（分）</th>
                  <th>{pd('prod.bulkDescCol')}</th>
                  <th className="!text-right">{pd('prod.bulkMinCol')}</th>
                  <th className="!text-right">{pd('prod.bulkMaxCol')}</th>
                  <th className="!text-right">{pd('prod.costCol')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const careRo = p.category === 'care_package'
                  const dirty = isDirtyRow(p)
                  return (
                    <tr
                      key={p.id}
                      className={dirty ? 'bg-brand-primary-light' : ''}
                      data-testid={`product-card-${p.id}`}
                    >
                      <td>
                        <span className="font-bold text-ink">{p.name}</span>
                        {careRo ? (
                          <span className="ml-1.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                            {pd('prod.bulkCarePackageRo')}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-[rgba(59,46,36,.62)]">{p.category}</td>
                      {careRo ? (
                        <td colSpan={5} className="text-caption-xs text-[rgba(59,46,36,.42)]">
                          {pd('prod.bulkCarePackageRo')}
                        </td>
                      ) : (
                        <>
                          <td className="text-right">{bulkNumInput(p, 'stock', 'bulk-stock')}</td>
                          <td className="text-right">{bulkNumInput(p, 'priceFen', 'bulk-price', true)}</td>
                          <td>
                            <input
                              type="text"
                              data-testid={`bulk-desc-${p.id}`}
                              value={bulkText(p, 'description')}
                              maxLength={2000}
                              onChange={(e) => setBulk(p.id, 'description', e.target.value)}
                              className="w-56 rounded-control bg-card px-2 py-1.5 text-caption text-ink shadow-hairline ring-1 ring-line-ring focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
                            />
                          </td>
                          <td className="text-right">{bulkNumInput(p, 'minStock', 'bulk-min')}</td>
                          <td className="text-right">{bulkNumInput(p, 'maxStock', 'bulk-max')}</td>
                        </>
                      )}
                      {/* 成本列保持只读（涉账不进网格；clerk 视界 server 已置 null） */}
                      <td className="whitespace-nowrap text-right font-number tabular-nums text-[rgba(59,46,36,.62)]">
                        {role.canManage ? fmtMoney(p.costFen) : pd('prod.costClerkMask')}
                      </td>
                      <td className="text-right">{deleteBtn(p)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* 脏行浮动条（计数+保存/取消） */}
          {dirtyRows.length > 0 ? (
            <div
              className="u1-ring sticky bottom-4 z-10 mt-3.5 flex items-center justify-between gap-3 rounded-panel bg-card px-4 py-3 shadow-elevated"
              data-testid="products-bulk-bar"
            >
              <span className="text-caption text-ink">
                <b className="tabular-nums">{pd('prod.bulkPendingBar', { n: dirtyRows.length })}</b>
              </span>
              <div className="flex shrink-0 gap-2">
                <QuietButton testid="products-bulk-cancel" onClick={exitBulk} disabled={bulkSaving}>
                  {pd('prod.bulkCancel')}
                </QuietButton>
                <LemonButton testid="products-bulk-save" disabled={bulkSaving} onClick={() => void bulkSave()}>
                  {pd('prod.bulkSave')}
                </LemonButton>
              </div>
            </div>
          ) : null}
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
                  <th className="!text-right">{pd('prod.costCol')}</th>
                  <th className="!text-right">库存</th>
                  <th>状态</th>
                  <th>{pd('prod.dailyCountCol')}</th>
                  <th></th>
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
                      {/* 大批片 4 成本列：毛利视界=canManage 才有值（server 双层闸 clerk 零透出），clerk=「—」 */}
                      <td
                        className="whitespace-nowrap text-right font-number tabular-nums text-[rgba(59,46,36,.62)]"
                        data-testid={`product-cost-${p.id}`}
                      >
                        {role.canManage ? fmtMoney(p.costFen) : pd('prod.costClerkMask')}
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
                      {/* 行内删除（owner；回收站软删；stopPropagation 不触发行点编辑弹层） */}
                      <td className="text-right">{deleteBtn(p)}</td>
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
