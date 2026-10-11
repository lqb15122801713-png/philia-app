/**
 * InvoiceTitlesPage · /settings/invoice-titles 发票抬头（客户端体验大批 片 1 · 账户体系域）
 *
 * - 列表：类型徽（个人/企业）+ 抬头 + 税号（mono，企业）+ 默认徽 + 编辑/删除；
 * - 新增/编辑弹层（BottomSheet 既有件）：个人/企业切换 + 抬头 + 税号（企业必填）
 *   + 设为默认 → invoiceTitle.create/update；
 * - 删除二次确认（ConfirmDialog 既有件）→ invoiceTitle.remove。
 * 返回=PushBar 时间序回退，直访兜底 /me/settings。文案全走 copy/invoiceTitles.ts（itc）。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域轻屏组）：四块入册（invt.head/list/form/del），
 * 块序/显隐=useCanvasLayout('invoiceTitles')（published→注册表默认序尾补，空=兜底常量）；
 * 文案键挂 CK(data-copy-key) 点选反查锚；?canvasPreview=1 探针=页首水印注记行
 * （mc.canvasExampleNote）。店锚=?canvasStore= 预览店锚 > 记忆门店 > 就近首店
 * （MePage 同口径，本屏无门店概念，仅供 useCanvasLayout/Loader）。
 * invt.form/invt.del=弹层块（BottomSheet/ConfirmDialog fixed 遮罩件），入块流但关闭态
 * 渲染 null，挂载条件照改造前（form/delTarget 状态驱动），零视觉差。
 * 块内逻辑/查询/状态机/提交链路零改动，data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { CanvasLayoutLoader, CK, friendlyError, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import BottomSheet from '../components/booking/single/BottomSheet'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { ConfirmDialog, useAccountToast } from '../components/account/common'
import { EmptyC, PushBar } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { itc } from '../copy/invoiceTitles'
import { readLastBooking } from '@/lib/bookingPrefill'

interface FormState {
  id: string | null
  titleType: 'personal' | 'business'
  title: string
  taxNo: string
  isDefault: boolean
}

const EMPTY_FORM: FormState = { id: null, titleType: 'personal', title: '', taxNo: '', isDefault: false }

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']
type InvoiceTitleItem = Awaited<ReturnType<Trpc['invoiceTitle']['list']['query']>>['items'][number]

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const INVT_DEFAULT_ORDER = ['invt.head', 'invt.list', 'invt.form', 'invt.del'] as const

export default function InvoiceTitlesPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useAccountToast()

  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [delTarget, setDelTarget] = useState<InvoiceTitleItem | null>(null)

  const listQ = useQuery({
    queryKey: ['invoiceTitle', 'list'],
    queryFn: () => trpc.invoiceTitle.list.query(),
    enabled: !!user,
  })
  const rows = listQ.data?.items ?? []

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（MePage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，仅供 useCanvasLayout/Loader） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const invtStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'invoiceTitles')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : INVT_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('invoiceTitles', invtStoreId, registryBlocks)

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['invoiceTitle', 'list'] })

  const saveM = useMutation({
    mutationFn: (f: FormState) => {
      const payload = {
        titleType: f.titleType,
        title: f.title.trim(),
        taxNo: f.titleType === 'business' ? f.taxNo.trim() : undefined,
        isDefault: f.isDefault,
      }
      return f.id ? trpc.invoiceTitle.update.mutate({ id: f.id, ...payload }) : trpc.invoiceTitle.create.mutate(payload)
    },
    onSuccess: () => {
      invalidate()
      setForm(null)
      showToast(itc('invt.saveOk'))
    },
    onError: (err) => setFormError(friendlyError(err, itc('invt.saveFail'))),
  })

  const delM = useMutation({
    mutationFn: (id: string) => trpc.invoiceTitle.remove.mutate({ id }),
    onSuccess: () => {
      invalidate()
      setDelTarget(null)
      showToast(itc('invt.delOk'))
    },
    onError: (err) => {
      setDelTarget(null)
      showToast(friendlyError(err, itc('invt.delFail')))
    },
  })

  const onSubmit = () => {
    if (!form) return
    setFormError(null)
    if (!form.title.trim()) return setFormError(itc('invt.titleRequired'))
    if (form.titleType === 'business' && !form.taxNo.trim()) return setFormError(itc('invt.taxNoRequired'))
    saveM.mutate(form)
  }

  const inputCls =
    'w-full rounded-control border border-line bg-card px-3 py-2.5 text-body-sm outline-none transition-colors focus:border-brand-primary'
  const labelCls = 'mb-1 block text-caption text-ink-secondary'
  const radioCls = (on: boolean) =>
    `min-h-[44px] flex-1 rounded-full border px-3 py-2 text-body-sm transition-colors ${
      on
        ? 'border-brand-primary bg-brand-primary-light font-semibold text-brand-primary-pressed'
        : 'border-line bg-card text-ink-secondary'
    }`

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. invt.head：PushBar 返回条 + m2-apphead 页头大题（页头裸段置顶惯例） */
    'invt.head': () => (
      <>
        <PushBar label={itc('invt.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="invt.title">{itc('invt.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. invt.list：抬头列表+空态（骨架/失败重试/空态三句话/行卡+类型徽+默认徽+
          编辑删除+新增钮；加载与错误门控照改造前逐字收进本块） */
    'invt.list': () =>
      listQ.isPending ? (
        <LoadingBlock lines={3} />
      ) : listQ.isError ? (
        <ErrorState message={itc('invt.loadFail')} onRetry={() => void listQ.refetch()} />
      ) : (
        <>
          {rows.length === 0 ? (
            /* 空态三句话：是什么 / 为什么 / 去哪 */
            <EmptyC
              title={itc('invt.emptyTitle')}
              desc={itc('invt.emptyBody')}
              ctaText={itc('invt.emptyCta')}
              onCta={() => setForm({ ...EMPTY_FORM })}
            />
          ) : (
            <div className="m2-card" style={{ padding: '4px 16px' }}>
              {rows.map((t) => (
                <div key={t.id} className="m2-rowx" data-testid={`invoice-title-row-${t.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary">
                        {t.titleType === 'business' ? <CK k="invt.typeBusiness">{itc('invt.typeBusiness')}</CK> : <CK k="invt.typePersonal">{itc('invt.typePersonal')}</CK>}
                      </span>
                      <span className="truncate text-[12.5px] font-bold text-ink">{t.title}</span>
                      {t.isDefault ? (
                        <span className="rounded-chip bg-brand-primary px-[7px] py-0.5 text-caption-xs font-semibold text-ink">
                          <CK k="invt.defaultBadge">{itc('invt.defaultBadge')}</CK>
                        </span>
                      ) : null}
                    </div>
                    {t.titleType === 'business' && t.taxNo ? (
                      <div className="m2-mono mt-1 text-[10px] text-ink-secondary">{t.taxNo}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5">
                    <button
                      type="button"
                      data-testid={`invoice-title-edit-${t.id}`}
                      onClick={() =>
                        setForm({
                          id: t.id,
                          titleType: t.titleType === 'business' ? 'business' : 'personal',
                          title: t.title,
                          taxNo: t.taxNo ?? '',
                          isDefault: t.isDefault,
                        })
                      }
                      className="text-caption font-semibold text-ink"
                    >
                      <CK k="invt.edit">{itc('invt.edit')}</CK>
                    </button>
                    <button
                      type="button"
                      data-testid={`invoice-title-del-${t.id}`}
                      onClick={() => setDelTarget(t)}
                      className="text-caption text-ink-secondary"
                    >
                      <CK k="invt.delete">{itc('invt.delete')}</CK>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rows.length > 0 ? (
            <button
              type="button"
              data-testid="invoice-title-add"
              onClick={() => setForm({ ...EMPTY_FORM })}
              className="mt-4 h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <CK k="invt.add">{itc('invt.add')}</CK>
            </button>
          ) : null}
        </>
      ),

    /* 3. invt.form：抬头表单弹层整块（BottomSheet fixed 遮罩件；关闭态渲染 null，
          挂载条件照改造前=form 状态驱动；个人/企业切换与校验/提交链路零改动） */
    'invt.form': () =>
      form ? (
        <BottomSheet
          title={form.id ? itc('invt.editTitle') : itc('invt.addTitle')}
          onClose={() => setForm(null)}
          testId="invoice-title-form-sheet"
        >
          <div className="flex flex-col gap-3">
            <div>
              <span className={labelCls}><CK k="invt.typeLabel">{itc('invt.typeLabel')}</CK></span>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="invt-type-personal"
                  onClick={() => setForm({ ...form, titleType: 'personal' })}
                  className={radioCls(form.titleType === 'personal')}
                >
                  <CK k="invt.typePersonal">{itc('invt.typePersonal')}</CK>
                </button>
                <button
                  type="button"
                  data-testid="invt-type-business"
                  onClick={() => setForm({ ...form, titleType: 'business' })}
                  className={radioCls(form.titleType === 'business')}
                >
                  <CK k="invt.typeBusiness">{itc('invt.typeBusiness')}</CK>
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="invt-title"><CK k="invt.titleLabel">{itc('invt.titleLabel')}</CK></label>
              <input
                id="invt-title"
                className={inputCls}
                maxLength={100}
                placeholder={form.titleType === 'business' ? itc('invt.titlePlaceholderBusiness') : itc('invt.titlePlaceholderPersonal')}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            {form.titleType === 'business' ? (
              <div>
                <label className={labelCls} htmlFor="invt-taxno"><CK k="invt.taxNoLabel">{itc('invt.taxNoLabel')}</CK></label>
                <input
                  id="invt-taxno"
                  className={inputCls}
                  maxLength={30}
                  placeholder={itc('invt.taxNoPlaceholder')}
                  value={form.taxNo}
                  onChange={(e) => setForm({ ...form, taxNo: e.target.value })}
                />
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                data-testid="invt-set-default"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 accent-brand-primary"
              />
              <CK k="invt.setDefault">{itc('invt.setDefault')}</CK>
            </label>
            {formError ? <p className="text-caption text-danger-deep">{formError}</p> : null}
            <button
              type="button"
              data-testid="invt-save"
              disabled={saveM.isPending}
              onClick={onSubmit}
              className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
            >
              {saveM.isPending ? <CK k="invt.saving">{itc('invt.saving')}</CK> : <CK k="invt.save">{itc('invt.save')}</CK>}
            </button>
          </div>
        </BottomSheet>
      ) : null,

    /* 4. invt.del：删除确认弹层（ConfirmDialog fixed 遮罩件，挂载条件照改造前
          =delTarget 状态驱动） */
    'invt.del': () =>
      delTarget ? (
        <ConfirmDialog
          title={itc('invt.delConfirmTitle')}
          body={itc('invt.delConfirmBody')}
          okText={itc('invt.delete')}
          cancelText={itc('invt.delCancel')}
          pending={delM.isPending}
          onCancel={() => setDelTarget(null)}
          onConfirm={() => delM.mutate(delTarget.id)}
          okTestId="invoice-title-del-confirm"
        />
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="invoiceTitles" storeId={invtStoreId}>
      <div className="m2" data-testid="invoice-titles-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="px-[22px]" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="invoice-titles-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：invt.head=页头裸段（原结构在 m2-pad 容器外，页头按惯例置顶不参与拖序）；
            余块在 m2-pad 容器内统一块流（隐藏块整段不渲染；弹层块关闭态渲染 null）——
            默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'invt.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {layout.map((b) =>
            b.visible && b.blockKey !== 'invt.head' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
        {toastEl}
      </div>
    </CanvasLayoutLoader>
  )
}
