/**
 * ProfileEditPage · /settings/profile 编辑资料（客户端体验大批 片 1 · 账户体系域）
 *
 * - 头像：uploadImage → 既有 /api/upload 链（relDir='profile/avatar'），拿到 url 即
 *   本地预览，保存时随 updateProfile 一并落库；
 * - 昵称（必填）/ 生日（date input）/ 性别（三选 male|female|secret）；
 * - 回显=auth.me 真值（raw 行含 birthday/gender 扩列）；保存 → auth.updateProfile
 *   → invalidate auth.me。
 * 返回=PushBar 时间序回退，直访兜底 /me/settings。文案全走 copy/profile.ts（pfc）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { friendlyError, getApiBase, uploadImage, useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { useAccountToast } from '../components/account/common'
import { PushBar } from '../components/member/v2'
import { pfc } from '../copy/profile'

type Gender = 'male' | 'female' | 'secret'

export default function ProfileEditPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useAccountToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const me = meRawQ.data?.user

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [birthday, setBirthday] = useState<string | null>(null)
  const [gender, setGender] = useState<Gender | null>(null)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  /* 回显真值（本地未改=读 server 值） */
  const curAvatar = avatarUrl ?? me?.avatarUrl ?? null
  const curNickname = nickname ?? me?.nickname ?? ''
  const curBirthday = birthday ?? me?.birthday ?? ''
  const curGender: Gender = gender ?? (me?.gender === 'male' || me?.gender === 'female' || me?.gender === 'secret' ? me.gender : 'secret')

  const saveM = useMutation({
    mutationFn: () =>
      trpc.auth.updateProfile.mutate({
        nickname: curNickname.trim(),
        avatarUrl: curAvatar ?? undefined,
        birthday: curBirthday || undefined,
        gender: curGender,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      showToast(pfc('profile.saveOk'))
    },
    onError: (err) => setFormError(friendlyError(err, pfc('profile.saveFail'))),
  })

  const onPickAvatar = async (file: File | undefined) => {
    if (!file || uploading) return
    setUploading(true)
    setFormError(null)
    try {
      const r = await uploadImage(getApiBase(), file, 'profile/avatar')
      setAvatarUrl(r.url)
    } catch (err) {
      showToast(err instanceof Error ? err.message : pfc('profile.uploadFail'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onSave = () => {
    setFormError(null)
    if (!curNickname.trim()) {
      setFormError(pfc('profile.nicknameRequired'))
      return
    }
    saveM.mutate()
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
    <div className="m2" data-testid="profile-edit-page" style={{ minHeight: '100vh' }}>
      <PushBar label={pfc('profile.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{pfc('profile.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        {user && meRawQ.isPending ? (
          <LoadingBlock lines={3} />
        ) : meRawQ.isError ? (
          <ErrorState message={pfc('profile.loadFail')} onRetry={() => void meRawQ.refetch()} />
        ) : (
          <div className="flex flex-col gap-3">
            {/* 头像（既有 /api/upload 链；选图即本地预览，保存随表单落库） */}
            <section className="m2-card flex items-center gap-4 px-4 py-4">
              {curAvatar ? (
                <img src={curAvatar} alt={curNickname} className="h-16 w-16 rounded-full bg-sunken object-cover" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full bg-sunken" aria-hidden="true">
                  <span className="u1-serif text-[22px] font-black text-ink">{(curNickname || '铲').slice(0, 1)}</span>
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-ink">{pfc('profile.avatarLabel')}</p>
                <button
                  type="button"
                  data-testid="profile-avatar-btn"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="mt-1.5 rounded-full bg-card px-4 py-2 text-caption font-semibold text-ink ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
                >
                  {uploading ? pfc('profile.uploading') : pfc('profile.avatarChange')}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="profile-avatar-input"
                  onChange={(e) => void onPickAvatar(e.target.files?.[0])}
                />
              </div>
            </section>

            {/* 昵称 / 生日 / 性别 */}
            <section className="m2-card px-4 py-4">
              <label className={labelCls} htmlFor="profile-nickname">{pfc('profile.nicknameLabel')}</label>
              <input
                id="profile-nickname"
                className={inputCls}
                maxLength={32}
                placeholder={pfc('profile.nicknamePlaceholder')}
                value={curNickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <div className="mt-3">
                <label className={labelCls} htmlFor="profile-birthday">{pfc('profile.birthdayLabel')}</label>
                <input
                  id="profile-birthday"
                  type="date"
                  className={inputCls}
                  value={curBirthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
              <div className="mt-3">
                <span className={labelCls}>{pfc('profile.genderLabel')}</span>
                <div className="flex gap-2">
                  <button type="button" data-testid="profile-gender-male" onClick={() => setGender('male')} className={radioCls(curGender === 'male')}>
                    {pfc('profile.genderMale')}
                  </button>
                  <button type="button" data-testid="profile-gender-female" onClick={() => setGender('female')} className={radioCls(curGender === 'female')}>
                    {pfc('profile.genderFemale')}
                  </button>
                  <button type="button" data-testid="profile-gender-secret" onClick={() => setGender('secret')} className={radioCls(curGender === 'secret')}>
                    {pfc('profile.genderSecret')}
                  </button>
                </div>
              </div>
            </section>

            {formError ? <p className="text-caption text-danger-deep">{formError}</p> : null}

            <button
              type="button"
              data-testid="profile-save"
              disabled={saveM.isPending || uploading}
              onClick={onSave}
              className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
            >
              {saveM.isPending ? pfc('profile.saving') : pfc('profile.save')}
            </button>
          </div>
        )}
      </div>
      {toastEl}
    </div>
  )
}
