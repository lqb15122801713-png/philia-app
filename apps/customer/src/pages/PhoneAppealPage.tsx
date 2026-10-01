/**
 * PhoneAppealPage · /me/settings/phone/appeal 换绑申诉（补缺大批片 2 · 账户安全域）
 *
 * 表单：原号（只读 masked）/ 新号输入（11 位校验）/ 身份证明材料上传（≤3 张，
 * shared uploadImage → POST /api/upload relDir='appeal/apply'）/ 情况说明（必填，
 * ≤200 字）→ submitPhoneAppeal → 成功态；
 * appealStatus 列表：状态 pill 照 refund 四档色纪律不设绿——submitted 淡黄 /
 * approved 深棕✓ / rejected 赭红+decideNote（透出侧一律 masked 列，明文 newPhone
 * 列不渲染）。
 * R13「为什么要身份证明」一句入键。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiBase, uploadImage, useMe, usePhiliaClient } from '@philia/shared'
import { EmptyC } from '../components/member/v2'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { fmtDateTime, maskPhone, useAccountToast } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { acc } from '../copy/account'

const PHONE_RE = /^1\d{10}$/
const MAX_PHOTOS = 3

/** 状态 pill（四档色纪律不设绿：淡黄/深棕✓/赭红） */
function StatusPill({ status }: { status: string }) {
  const meta: Record<string, { label: string; cls: string; mark?: string }> = {
    submitted: { label: acc('appeal.statusSubmitted'), cls: 'bg-brand-primary text-ink' },
    approved: { label: acc('appeal.statusApproved'), cls: 'bg-ink text-canvas', mark: '✓' },
    rejected: { label: acc('appeal.statusRejected'), cls: 'bg-danger-light text-danger-deep' },
  }
  const m = meta[status] ?? { label: status, cls: 'bg-sunken text-ink-secondary' }
  return (
    <span className={`rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${m.cls}`}>
      {m.label}
      {m.mark ? ` ${m.mark}` : ''}
    </span>
  )
}

export default function PhoneAppealPage() {
  const navigate = useNavigate()
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useAccountToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [newPhone, setNewPhone] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<Array<{ url: string; thumbUrl: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const mePhone = meRawQ.data?.user?.phone ?? null

  const listQ = useQuery({
    queryKey: ['authSecurity', 'appealStatus'],
    queryFn: () => trpc.authSecurity.appealStatus.query(),
    enabled: !!user,
  })

  const submitM = useMutation({
    mutationFn: () =>
      trpc.authSecurity.submitPhoneAppeal.mutate({
        oldPhone: mePhone!,
        newPhone,
        photoUrls: photos.map((p) => p.url),
        note: note.trim(),
      }),
    onSuccess: () => {
      setDone(true)
      setErrMsg(null)
      void queryClient.invalidateQueries({ queryKey: ['authSecurity', 'appealStatus'] })
    },
    onError: (err) => setErrMsg(err.message || acc('appeal.submitFail')),
  })

  const onPickFile = async (file: File | null) => {
    if (!file || uploading) return
    setUploading(true)
    setErrMsg(null)
    try {
      const r = await uploadImage(getApiBase(), file, 'appeal/apply')
      setPhotos((ps) => [...ps, r])
    } catch (err) {
      showToast(err instanceof Error ? err.message : acc('appeal.uploadFail'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = () => {
    if (!PHONE_RE.test(newPhone)) {
      setErrMsg(acc('appeal.phoneInvalid'))
      return
    }
    if (!note.trim()) {
      setErrMsg(acc('appeal.noteRequired'))
      return
    }
    submitM.mutate()
  }

  const inflight = (listQ.data?.items ?? []).some((it) => it.status === 'submitted')

  return (
    <div className="m2" data-testid="phone-appeal-page" style={{ minHeight: '100vh' }}>
      <PushBar label={acc('appeal.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{acc('appeal.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        {user && meRawQ.isPending ? (
          <LoadingBlock lines={3} />
        ) : meRawQ.isError ? (
          <ErrorState message={acc('settings.loadFail')} onRetry={() => void meRawQ.refetch()} />
        ) : (
          <>
            <p className="m2-note">{acc('appeal.intro')}</p>

            {done ? (
              <div className="m2-card mt-3 p-4" data-testid="appeal-success">
                <div className="text-body font-bold text-ink">{acc('appeal.successTitle')}</div>
                <p className="mt-1 text-caption leading-[1.8] text-ink-secondary">{acc('appeal.successBody')}</p>
              </div>
            ) : inflight ? null : (
              /* 有在途申诉时收起表单（服务端幂等返回现状，表单隐藏避免重复提交误导） */
              <>
                <div className="m2-card mt-3 overflow-hidden" data-testid="appeal-form">
                  {/* 原号（只读 masked） */}
                  <div className="border-b border-line-divider px-4 py-3.5">
                    <div className="m2-mono text-[10px] text-ink-secondary">{acc('appeal.oldPhoneLabel')}</div>
                    <div className="m2-mono mt-1 text-[14px] font-bold text-ink" data-testid="appeal-old-phone">
                      {maskPhone(mePhone)}
                    </div>
                  </div>
                  {/* 新号 */}
                  <div className="border-b border-line-divider px-4 py-3.5">
                    <div className="m2-mono text-[10px] text-ink-secondary">{acc('appeal.newPhoneLabel')}</div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder={acc('appeal.newPhonePlaceholder')}
                      data-testid="appeal-new-phone"
                      className="mt-1.5 w-full rounded-input border border-line bg-card px-4 py-2.5 font-number text-body text-ink placeholder:text-ink-placeholder"
                    />
                  </div>
                  {/* 身份证明材料（≤3 张） */}
                  <div className="border-b border-line-divider px-4 py-3.5">
                    <div className="flex items-baseline justify-between">
                      <div className="m2-mono text-[10px] text-ink-secondary">{acc('appeal.photoTitle')}</div>
                      <div className="m2-mono text-[10px] text-ink-secondary">
                        {photos.length}/{MAX_PHOTOS}
                      </div>
                    </div>
                    <div className="mt-1 text-caption-xs text-ink-secondary">{acc('appeal.photoHint')}</div>
                    <div className="mt-2 flex flex-wrap gap-2.5">
                      {photos.map((p) => (
                        <div key={p.url} className="relative">
                          <img
                            src={p.thumbUrl || p.url}
                            alt={acc('appeal.photoTitle')}
                            className="h-[64px] w-[64px] rounded-tag border border-line object-cover"
                          />
                          <button
                            type="button"
                            aria-label={acc('appeal.removePhoto')}
                            onClick={() => setPhotos((ps) => ps.filter((x) => x.url !== p.url))}
                            className="absolute -right-1.5 -top-1.5 flex h-[20px] w-[20px] items-center justify-center rounded-full bg-ink text-[11px] text-canvas"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {photos.length < MAX_PHOTOS ? (
                        <button
                          type="button"
                          data-testid="appeal-add-photo"
                          disabled={uploading}
                          onClick={() => fileRef.current?.click()}
                          className="flex h-[64px] w-[64px] items-center justify-center rounded-tag border border-dashed border-line-strong text-caption-xs text-ink-secondary disabled:opacity-60"
                        >
                          {uploading ? acc('appeal.uploading') : acc('appeal.addPhoto')}
                        </button>
                      ) : null}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                    />
                    {/* R13：为什么要身份证明 */}
                    <p className="m2-note mt-2.5" data-testid="appeal-why-photo">
                      {acc('appeal.whyPhoto')}
                    </p>
                  </div>
                  {/* 情况说明（必填） */}
                  <div className="px-4 py-3.5">
                    <div className="m2-mono text-[10px] text-ink-secondary">{acc('appeal.noteLabel')}</div>
                    <textarea
                      value={note}
                      maxLength={200}
                      rows={3}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={acc('appeal.notePlaceholder')}
                      data-testid="appeal-note"
                      className="mt-1.5 w-full resize-none rounded-input border border-line bg-card px-4 py-2.5 text-body text-ink placeholder:text-ink-placeholder"
                    />
                  </div>
                </div>

                {errMsg ? (
                  <p role="alert" className="mt-3 text-caption text-danger-deep" data-testid="appeal-error">
                    {errMsg}
                  </p>
                ) : null}

                <button
                  type="button"
                  data-testid="appeal-submit"
                  disabled={submitM.isPending || uploading || !mePhone}
                  onClick={submit}
                  className="mt-4 w-full rounded-full bg-ink py-3 text-body font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
                >
                  {submitM.isPending ? acc('appeal.submitting') : acc('appeal.submit')}
                </button>
              </>
            )}

            {/* 申诉记录 */}
            <SecH title={acc('appeal.listTitle')} />
            {listQ.isPending ? (
              <LoadingBlock lines={2} />
            ) : listQ.isError ? (
              <ErrorState
                message={`${acc('appeal.loadFail')}${listQ.error instanceof Error ? `（${listQ.error.message}）` : ''}`}
                onRetry={() => void listQ.refetch()}
              />
            ) : (listQ.data?.items ?? []).length === 0 ? (
              <EmptyC
                title={acc('appeal.emptyTitle')}
                desc={acc('appeal.emptyBody')}
                ctaText={acc('appeal.emptyCta')}
                onCta={() => navigate('/me/settings/phone')}
              />
            ) : (
              <div className="m2-card" style={{ padding: '4px 16px' }}>
                {(listQ.data?.items ?? []).map((it) => (
                  <div key={it.id} className="m2-rowx" data-testid="appeal-row">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-bold text-ink">
                          {acc('appeal.linePhones', { old: it.oldPhoneMasked, new: it.newPhoneMasked })}
                        </span>
                        <StatusPill status={it.status} />
                      </div>
                      <div className="m2-mono mt-1 text-[9px] text-ink-secondary">
                        {it.requestNo} · {fmtDateTime(it.createdAt)}
                      </div>
                      {it.status === 'rejected' && it.decideNote ? (
                        <div className="mt-1 text-caption-xs leading-[1.7] text-danger-deep">
                          {acc('appeal.decidePrefix')}：{it.decideNote}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {toastEl}
    </div>
  )
}
