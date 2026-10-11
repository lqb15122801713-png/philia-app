/**
 * AddressesPage · /settings/addresses 收货地址（客户端体验大批 片 1 · 账户体系域）
 *
 * - 列表：收货人+手机号（mono）+ 地区/详细地址 + 默认徽 + 编辑/删除；
 * - 新增/编辑弹层（BottomSheet 既有件）：收货人 / 手机号（11 位校验）/ 地区 /
 *   详细地址 / 设为默认 → address.create/update；
 * - 删除二次确认（ConfirmDialog 既有件）；删默认地址时注记透出「最早添加的自动升为默认」
 *   （契约口径）→ address.remove。
 * 返回=PushBar 时间序回退，直访兜底 /me/settings。文案全走 copy/addresses.ts（adc）。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域轻屏组）：四块入册（addr.head/list/form/del），
 * 块序/显隐=useCanvasLayout('addresses')（published→注册表默认序尾补，空=兜底常量）；
 * 文案键挂 CK(data-copy-key) 点选反查锚；?canvasPreview=1 探针=页首水印注记行
 * （mc.canvasExampleNote）。店锚=?canvasStore= 预览店锚 > 记忆门店 > 就近首店
 * （MePage 同口径，本屏无门店概念，仅供 useCanvasLayout/Loader）。
 * addr.form/addr.del=弹层块（BottomSheet/ConfirmDialog fixed 遮罩件），入块流但关闭态
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
import { adc } from '../copy/addresses'
import { readLastBooking } from '@/lib/bookingPrefill'

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']
type AddressItem = Awaited<ReturnType<Trpc['address']['list']['query']>>['items'][number]

const PHONE_RE = /^1\d{10}$/

interface FormState {
  id: string | null
  receiver: string
  phone: string
  region: string
  detail: string
  isDefault: boolean
}

const EMPTY_FORM: FormState = { id: null, receiver: '', phone: '', region: '', detail: '', isDefault: false }

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const ADDR_DEFAULT_ORDER = ['addr.head', 'addr.list', 'addr.form', 'addr.del'] as const

export default function AddressesPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useAccountToast()

  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [delTarget, setDelTarget] = useState<AddressItem | null>(null)

  const listQ = useQuery({
    queryKey: ['address', 'list'],
    queryFn: () => trpc.address.list.query(),
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
  const addrStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'addresses')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : ADDR_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('addresses', addrStoreId, registryBlocks)

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['address', 'list'] })

  const saveM = useMutation({
    mutationFn: (f: FormState) => {
      const payload = {
        receiver: f.receiver.trim(),
        phone: f.phone.trim(),
        region: f.region.trim(),
        detail: f.detail.trim(),
        isDefault: f.isDefault,
      }
      return f.id ? trpc.address.update.mutate({ id: f.id, ...payload }) : trpc.address.create.mutate(payload)
    },
    onSuccess: () => {
      invalidate()
      setForm(null)
      showToast(adc('addr.saveOk'))
    },
    onError: (err) => setFormError(friendlyError(err, adc('addr.saveFail'))),
  })

  const delM = useMutation({
    mutationFn: (id: string) => trpc.address.remove.mutate({ id }),
    onSuccess: () => {
      invalidate()
      setDelTarget(null)
      showToast(adc('addr.delOk'))
    },
    onError: (err) => {
      setDelTarget(null)
      showToast(friendlyError(err, adc('addr.delFail')))
    },
  })

  const onSubmit = () => {
    if (!form) return
    setFormError(null)
    if (!form.receiver.trim()) return setFormError(adc('addr.receiverRequired'))
    if (!PHONE_RE.test(form.phone.trim())) return setFormError(adc('addr.phoneInvalid'))
    if (!form.region.trim()) return setFormError(adc('addr.regionRequired'))
    if (!form.detail.trim()) return setFormError(adc('addr.detailRequired'))
    saveM.mutate(form)
  }

  const inputCls =
    'w-full rounded-control border border-line bg-card px-3 py-2.5 text-body-sm outline-none transition-colors focus:border-brand-primary'
  const labelCls = 'mb-1 block text-caption text-ink-secondary'

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. addr.head：PushBar 返回条 + m2-apphead 页头大题（页头裸段置顶惯例） */
    'addr.head': () => (
      <>
        <PushBar label={adc('addr.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="addr.title">{adc('addr.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. addr.list：地址列表+空态（骨架/失败重试/空态三句话/行卡+默认徽+编辑删除+新增钮；
          加载与错误门控照改造前逐字收进本块） */
    'addr.list': () =>
      listQ.isPending ? (
        <LoadingBlock lines={3} />
      ) : listQ.isError ? (
        <ErrorState message={adc('addr.loadFail')} onRetry={() => void listQ.refetch()} />
      ) : (
        <>
          {rows.length === 0 ? (
            /* 空态三句话：是什么 / 为什么 / 去哪 */
            <EmptyC
              title={adc('addr.emptyTitle')}
              desc={adc('addr.emptyBody')}
              ctaText={adc('addr.emptyCta')}
              onCta={() => setForm({ ...EMPTY_FORM })}
            />
          ) : (
            <div className="m2-card" style={{ padding: '4px 16px' }}>
              {rows.map((a) => (
                <div key={a.id} className="m2-rowx" data-testid={`address-row-${a.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-bold text-ink">{a.receiver}</span>
                      <span className="m2-mono text-[12px] text-ink">{a.phone}</span>
                      {a.isDefault ? (
                        <span className="rounded-chip bg-brand-primary px-[7px] py-0.5 text-caption-xs font-semibold text-ink">
                          <CK k="addr.defaultBadge">{adc('addr.defaultBadge')}</CK>
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] text-ink-secondary">
                      {a.region} {a.detail}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5">
                    <button
                      type="button"
                      data-testid={`address-edit-${a.id}`}
                      onClick={() =>
                        setForm({
                          id: a.id,
                          receiver: a.receiver,
                          phone: a.phone,
                          region: a.region,
                          detail: a.detail,
                          isDefault: a.isDefault,
                        })
                      }
                      className="text-caption font-semibold text-ink"
                    >
                      <CK k="addr.edit">{adc('addr.edit')}</CK>
                    </button>
                    <button
                      type="button"
                      data-testid={`address-del-${a.id}`}
                      onClick={() => setDelTarget(a)}
                      className="text-caption text-ink-secondary"
                    >
                      <CK k="addr.delete">{adc('addr.delete')}</CK>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rows.length > 0 ? (
            <button
              type="button"
              data-testid="address-add"
              onClick={() => setForm({ ...EMPTY_FORM })}
              className="mt-4 h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <CK k="addr.add">{adc('addr.add')}</CK>
            </button>
          ) : null}
        </>
      ),

    /* 3. addr.form：地址表单弹层整块（BottomSheet fixed 遮罩件；关闭态渲染 null，
          挂载条件照改造前=form 状态驱动；校验/提交链路零改动） */
    'addr.form': () =>
      form ? (
        <BottomSheet
          title={form.id ? adc('addr.editTitle') : adc('addr.addTitle')}
          onClose={() => setForm(null)}
          testId="address-form-sheet"
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls} htmlFor="addr-receiver"><CK k="addr.receiverLabel">{adc('addr.receiverLabel')}</CK></label>
              <input
                id="addr-receiver"
                className={inputCls}
                maxLength={32}
                placeholder={adc('addr.receiverPlaceholder')}
                value={form.receiver}
                onChange={(e) => setForm({ ...form, receiver: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="addr-phone"><CK k="addr.phoneLabel">{adc('addr.phoneLabel')}</CK></label>
              <input
                id="addr-phone"
                inputMode="tel"
                className={inputCls}
                maxLength={11}
                placeholder={adc('addr.phonePlaceholder')}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="addr-region"><CK k="addr.regionLabel">{adc('addr.regionLabel')}</CK></label>
              <input
                id="addr-region"
                className={inputCls}
                maxLength={64}
                placeholder={adc('addr.regionPlaceholder')}
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="addr-detail"><CK k="addr.detailLabel">{adc('addr.detailLabel')}</CK></label>
              <input
                id="addr-detail"
                className={inputCls}
                maxLength={128}
                placeholder={adc('addr.detailPlaceholder')}
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                data-testid="addr-set-default"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 accent-brand-primary"
              />
              <CK k="addr.setDefault">{adc('addr.setDefault')}</CK>
            </label>
            {formError ? <p className="text-caption text-danger-deep">{formError}</p> : null}
            <button
              type="button"
              data-testid="addr-save"
              disabled={saveM.isPending}
              onClick={onSubmit}
              className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
            >
              {saveM.isPending ? <CK k="addr.saving">{adc('addr.saving')}</CK> : <CK k="addr.save">{adc('addr.save')}</CK>}
            </button>
          </div>
        </BottomSheet>
      ) : null,

    /* 4. addr.del：删除确认弹层（ConfirmDialog fixed 遮罩件；删默认注记透出，
          挂载条件照改造前=delTarget 状态驱动） */
    'addr.del': () =>
      delTarget ? (
        <ConfirmDialog
          title={adc('addr.delConfirmTitle')}
          body={
            <>
              {adc('addr.delConfirmBody')}
              {delTarget.isDefault ? <p className="mt-1.5 text-ink">{adc('addr.delDefaultNote')}</p> : null}
            </>
          }
          okText={adc('addr.delete')}
          cancelText={adc('addr.delCancel')}
          pending={delM.isPending}
          onCancel={() => setDelTarget(null)}
          onConfirm={() => delM.mutate(delTarget.id)}
          okTestId="address-del-confirm"
        />
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="addresses" storeId={addrStoreId}>
      <div className="m2" data-testid="addresses-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="px-[22px]" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="addresses-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：addr.head=页头裸段（原结构在 m2-pad 容器外，页头按惯例置顶不参与拖序）；
            余块在 m2-pad 容器内统一块流（隐藏块整段不渲染；弹层块关闭态渲染 null）——
            默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'addr.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {layout.map((b) =>
            b.visible && b.blockKey !== 'addr.head' ? (
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
