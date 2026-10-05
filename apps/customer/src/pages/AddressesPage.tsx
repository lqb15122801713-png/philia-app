/**
 * AddressesPage · /settings/addresses 收货地址（客户端体验大批 片 1 · 账户体系域）
 *
 * - 列表：收货人+手机号（mono）+ 地区/详细地址 + 默认徽 + 编辑/删除；
 * - 新增/编辑弹层（BottomSheet 既有件）：收货人 / 手机号（11 位校验）/ 地区 /
 *   详细地址 / 设为默认 → address.create/update；
 * - 删除二次确认（ConfirmDialog 既有件）；删默认地址时注记透出「最早添加的自动升为默认」
 *   （契约口径）→ address.remove。
 * 返回=PushBar 时间序回退，直访兜底 /me/settings。文案全走 copy/addresses.ts（adc）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { friendlyError, useMe, usePhiliaClient } from '@philia/shared'
import BottomSheet from '../components/booking/single/BottomSheet'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { ConfirmDialog, useAccountToast } from '../components/account/common'
import { EmptyC, PushBar } from '../components/member/v2'
import { adc } from '../copy/addresses'

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

  return (
    <div className="m2" data-testid="addresses-page" style={{ minHeight: '100vh' }}>
      <PushBar label={adc('addr.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{adc('addr.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        {listQ.isPending ? (
          <LoadingBlock lines={3} />
        ) : listQ.isError ? (
          <ErrorState message={adc('addr.loadFail')} onRetry={() => void listQ.refetch()} />
        ) : rows.length === 0 ? (
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
                        {adc('addr.defaultBadge')}
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
                    {adc('addr.edit')}
                  </button>
                  <button
                    type="button"
                    data-testid={`address-del-${a.id}`}
                    onClick={() => setDelTarget(a)}
                    className="text-caption text-ink-secondary"
                  >
                    {adc('addr.delete')}
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
            {adc('addr.add')}
          </button>
        ) : null}
      </div>

      {/* 新增/编辑弹层 */}
      {form ? (
        <BottomSheet
          title={form.id ? adc('addr.editTitle') : adc('addr.addTitle')}
          onClose={() => setForm(null)}
          testId="address-form-sheet"
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls} htmlFor="addr-receiver">{adc('addr.receiverLabel')}</label>
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
              <label className={labelCls} htmlFor="addr-phone">{adc('addr.phoneLabel')}</label>
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
              <label className={labelCls} htmlFor="addr-region">{adc('addr.regionLabel')}</label>
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
              <label className={labelCls} htmlFor="addr-detail">{adc('addr.detailLabel')}</label>
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
              {adc('addr.setDefault')}
            </label>
            {formError ? <p className="text-caption text-danger-deep">{formError}</p> : null}
            <button
              type="button"
              data-testid="addr-save"
              disabled={saveM.isPending}
              onClick={onSubmit}
              className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
            >
              {saveM.isPending ? adc('addr.saving') : adc('addr.save')}
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {/* 删除二次确认（删默认注记透出） */}
      {delTarget ? (
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
      ) : null}
      {toastEl}
    </div>
  )
}
