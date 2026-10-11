/**
 * ProfileEditPage · /settings/profile 编辑资料（客户端体验大批 片 1 · 账户体系域）
 *
 * - 头像：uploadImage → 既有 /api/upload 链（relDir='profile/avatar'），拿到 url 即
 *   本地预览，保存时随 updateProfile 一并落库；
 * - 昵称（必填）/ 生日（date input）/ 性别（三选 male|female|secret）；
 * - 回显=auth.me 真值（raw 行含 birthday/gender 扩列）；保存 → auth.updateProfile
 *   → invalidate auth.me。
 * 返回=PushBar 时间序回退，直访兜底 /me/settings。文案全走 copy/profile.ts（pfc）。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域轻屏组）：三块入册（profile.head/avatar/form），
 * 块序/显隐=useCanvasLayout('profile')（published→注册表默认序尾补，空=兜底常量）；
 * 文案键挂 CK(data-copy-key) 点选反查锚；?canvasPreview=1 探针=页首水印注记行
 * （mc.canvasExampleNote）。店锚=?canvasStore= 预览店锚 > 记忆门店 > 就近首店
 * （MePage 同口径，本屏无门店概念，仅供 useCanvasLayout/Loader）。
 * 块内逻辑/查询/状态机/提交链路零改动，data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { CanvasLayoutLoader, CK, friendlyError, getApiBase, uploadImage, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { useAccountToast } from '../components/account/common'
import { PushBar } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { pfc } from '../copy/profile'
import { readLastBooking } from '@/lib/bookingPrefill'

type Gender = 'male' | 'female' | 'secret'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const PROFILE_DEFAULT_ORDER = ['profile.head', 'profile.avatar', 'profile.form'] as const

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
  const profileStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'profile')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : PROFILE_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('profile', profileStoreId, registryBlocks)

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

  /* 块渲染器（块内逻辑零改动——三块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. profile.head：PushBar 返回条 + m2-apphead 页头大题（页头裸段置顶惯例） */
    'profile.head': () => (
      <>
        <PushBar label={pfc('profile.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="profile.title">{pfc('profile.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. profile.avatar：头像区（既有 /api/upload 链；选图即本地预览，保存随表单落库） */
    'profile.avatar': () => (
      <section className="m2-card flex items-center gap-4 px-4 py-4">
        {curAvatar ? (
          <img src={curAvatar} alt={curNickname} className="h-16 w-16 rounded-full bg-sunken object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-sunken" aria-hidden="true">
            <span className="u1-serif text-[22px] font-black text-ink">{(curNickname || '铲').slice(0, 1)}</span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-ink"><CK k="profile.avatarLabel">{pfc('profile.avatarLabel')}</CK></p>
          <button
            type="button"
            data-testid="profile-avatar-btn"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="mt-1.5 rounded-full bg-card px-4 py-2 text-caption font-semibold text-ink ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            {uploading ? <CK k="profile.uploading">{pfc('profile.uploading')}</CK> : <CK k="profile.avatarChange">{pfc('profile.avatarChange')}</CK>}
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
    ),

    /* 3. profile.form：资料表单整块（昵称/生日/性别 + 错误行 + 保存钮；校验与提交链路零改动） */
    'profile.form': () => (
      <>
        <section className="m2-card px-4 py-4">
          <label className={labelCls} htmlFor="profile-nickname"><CK k="profile.nicknameLabel">{pfc('profile.nicknameLabel')}</CK></label>
          <input
            id="profile-nickname"
            className={inputCls}
            maxLength={32}
            placeholder={pfc('profile.nicknamePlaceholder')}
            value={curNickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <div className="mt-3">
            <label className={labelCls} htmlFor="profile-birthday"><CK k="profile.birthdayLabel">{pfc('profile.birthdayLabel')}</CK></label>
            <input
              id="profile-birthday"
              type="date"
              className={inputCls}
              value={curBirthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <span className={labelCls}><CK k="profile.genderLabel">{pfc('profile.genderLabel')}</CK></span>
            <div className="flex gap-2">
              <button type="button" data-testid="profile-gender-male" onClick={() => setGender('male')} className={radioCls(curGender === 'male')}>
                <CK k="profile.genderMale">{pfc('profile.genderMale')}</CK>
              </button>
              <button type="button" data-testid="profile-gender-female" onClick={() => setGender('female')} className={radioCls(curGender === 'female')}>
                <CK k="profile.genderFemale">{pfc('profile.genderFemale')}</CK>
              </button>
              <button type="button" data-testid="profile-gender-secret" onClick={() => setGender('secret')} className={radioCls(curGender === 'secret')}>
                <CK k="profile.genderSecret">{pfc('profile.genderSecret')}</CK>
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
          {saveM.isPending ? <CK k="profile.saving">{pfc('profile.saving')}</CK> : <CK k="profile.save">{pfc('profile.save')}</CK>}
        </button>
      </>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="profile" storeId={profileStoreId}>
      <div className="m2" data-testid="profile-edit-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="px-[22px]" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="profile-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：profile.head=页头裸段（原结构在 m2-pad 容器外，页头按惯例置顶不参与拖序）；
            余块在 m2-pad 容器内——默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'profile.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {user && meRawQ.isPending ? (
            <LoadingBlock lines={3} />
          ) : meRawQ.isError ? (
            <ErrorState message={pfc('profile.loadFail')} onRetry={() => void meRawQ.refetch()} />
          ) : (
            <div className="flex flex-col gap-3">
              {layout.map((b) =>
                b.visible && b.blockKey !== 'profile.head' ? (
                  <section data-block-key={b.blockKey} key={b.blockKey}>
                    {renderers[b.blockKey]?.() ?? null}
                  </section>
                ) : null,
              )}
            </div>
          )}
        </div>
        {toastEl}
      </div>
    </CanvasLayoutLoader>
  )
}
