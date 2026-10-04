/**
 * InvoiceTitlesPage · /settings/invoice-titles 发票抬头（客户端体验大批 片 1 · 账户体系域）
 *
 * - 列表：类型徽（个人/企业）+ 抬头 + 税号（mono，企业）+ 默认徽 + 编辑/删除；
 * - 新增/编辑弹层（BottomSheet 既有件）：个人/企业切换 + 抬头 + 税号（企业必填）
 *   + 设为默认 → invoiceTitle.create/update；
 * - 删除二次确认（ConfirmDialog 既有件）→ invoiceTitle.remove。
 * 返回=PushBar 时间序回退，直访兜底 /me/settings。文案全走 copy/invoiceTitles.ts（itc）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { friendlyError, useMe, usePhiliaClient } from '@philia/shared'
import BottomSheet from '../components/booking/single/BottomSheet'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { ConfirmDialog, useAccountToast } from '../components/account/common'
import { EmptyC, PushBar } from '../components/member/v2'
import { itc } from '../copy/invoiceTitles'

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

  return (
    <div className="m2" data-testid="invoice-titles-page" style={{ minHeight: '100vh' }}>
      <PushBar label={itc('invt.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{itc('invt.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        {listQ.isPending ? (
          <LoadingBlock lines={3} />
        ) : listQ.isError ? (
          <ErrorState message={itc('invt.loadFail')} onRetry={() => void listQ.refetch()} />
        ) : rows.length === 0 ? (
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
                      {t.titleType === 'business' ? itc('invt.typeBusiness') : itc('invt.typePersonal')}
                    </span>
                    <span className="truncate text-[12.5px] font-bold text-ink">{t.title}</span>
                    {t.isDefault ? (
                      <span className="rounded-chip bg-brand-primary px-[7px] py-0.5 text-caption-xs font-semibold text-ink">
                        {itc('invt.defaultBadge')}
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
                    {itc('invt.edit')}
                  </button>
                  <button
                    type="button"
                    data-testid={`invoice-title-del-${t.id}`}
                    onClick={() => setDelTarget(t)}
                    className="text-caption text-ink-secondary"
                  >
                    {itc('invt.delete')}
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
            {itc('invt.add')}
          </button>
        ) : null}
      </div>

      {/* 新增/编辑弹层 */}
      {form ? (
        <BottomSheet
          title={form.id ? itc('invt.editTitle') : itc('invt.addTitle')}
          onClose={() => setForm(null)}
          testId="invoice-title-form-sheet"
        >
          <div className="flex flex-col gap-3">
            <div>
              <span className={labelCls}>{itc('invt.typeLabel')}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="invt-type-personal"
                  onClick={() => setForm({ ...form, titleType: 'personal' })}
                  className={radioCls(form.titleType === 'personal')}
                >
                  {itc('invt.typePersonal')}
                </button>
                <button
                  type="button"
                  data-testid="invt-type-business"
                  onClick={() => setForm({ ...form, titleType: 'business' })}
                  className={radioCls(form.titleType === 'business')}
                >
                  {itc('invt.typeBusiness')}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="invt-title">{itc('invt.titleLabel')}</label>
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
                <label className={labelCls} htmlFor="invt-taxno">{itc('invt.taxNoLabel')}</label>
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
              {itc('invt.setDefault')}
            </label>
            {formError ? <p className="text-caption text-danger-deep">{formError}</p> : null}
            <button
              type="button"
              data-testid="invt-save"
              disabled={saveM.isPending}
              onClick={onSubmit}
              className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
            >
              {saveM.isPending ? itc('invt.saving') : itc('invt.save')}
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {/* 删除二次确认 */}
      {delTarget ? (
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
      ) : null}
      {toastEl}
    </div>
  )
}
