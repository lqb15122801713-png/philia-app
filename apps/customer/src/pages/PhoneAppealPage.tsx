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
 *
 * 画布化（产品-1010 片 3 末片 · 账户域重屏批）：四块入册
 * （appeal.head/form/result/list），块序/显隐=useCanvasLayout('phoneAppeal')
 * （published→注册表默认序尾补，空=默认序兜底常量）；文案键行内可改=CK 点选反查锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。提交链路/在途收表单语义零改动，
 * data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, getApiBase, uploadImage, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { EmptyC } from '../components/member/v2'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { fmtDateTime, maskPhone, useAccountToast } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { acc } from '../copy/account'
import { readLastBooking } from '@/lib/bookingPrefill'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const APPEAL_DEFAULT_ORDER = ['appeal.head', 'appeal.form', 'appeal.result', 'appeal.list'] as const

const PHONE_RE = /^1\d{10}$/
const MAX_PHOTOS = 3

/** 状态 pill（四档色纪律不设绿：淡黄/深棕✓/赭红）。画布批片 3：键渲染期取值 + CK 锚 */
function StatusPill({ status }: { status: string }) {
  const meta: Record<string, { copyKey: 'appeal.statusSubmitted' | 'appeal.statusApproved' | 'appeal.statusRejected'; cls: string; mark?: string }> = {
    submitted: { copyKey: 'appeal.statusSubmitted', cls: 'bg-brand-primary text-ink' },
    approved: { copyKey: 'appeal.statusApproved', cls: 'bg-ink text-canvas', mark: '✓' },
    rejected: { copyKey: 'appeal.statusRejected', cls: 'bg-danger-light text-danger-deep' },
  }
  const m = meta[status]
  return (
    <span className={`rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${m?.cls ?? 'bg-sunken text-ink-secondary'}`}>
      {m ? <CK k={m.copyKey}>{acc(m.copyKey)}</CK> : status}
      {m?.mark ? ` ${m.mark}` : ''}
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

  /* 画布批片 3：预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（MePage/MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，nearbyQ 带 enabled 闸仅作布局锚解析，零增发常态查询） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const canvasStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'phoneAppeal')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : APPEAL_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('phoneAppeal', canvasStoreId, registryBlocks)

  /* 读态口径（照改造前三分支语义）：me 读态行页级挂载，内容块=加载成功后才渲染 */
  const meLoading = !!(user && meRawQ.isPending)
  const loaded = !meLoading && !meRawQ.isError

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. appeal.head：PushBar 返回条 + m2 大题页头（PushBar label 为 string prop 无 CK 锚；
          导语 appeal.intro 随 m2-pad 读态挂载在块流顶部，归属本块键） */
    'appeal.head': () => (
      <>
        <PushBar label={acc('appeal.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="appeal.title">{acc('appeal.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. appeal.form：申诉表单整块（原号只读 masked/新号/证明材料≤3/情况说明+提交）；
          有在途申诉时收起表单（服务端幂等返回现状，表单隐藏避免重复提交误导） */
    'appeal.form': () =>
      loaded && !done && !inflight ? (
        <>
          <div className="m2-card mt-3 overflow-hidden" data-testid="appeal-form">
            {/* 原号（只读 masked） */}
            <div className="border-b border-line-divider px-4 py-3.5">
              <div className="m2-mono text-[10px] text-ink-secondary"><CK k="appeal.oldPhoneLabel">{acc('appeal.oldPhoneLabel')}</CK></div>
              <div className="m2-mono mt-1 text-[14px] font-bold text-ink" data-testid="appeal-old-phone">
                {maskPhone(mePhone)}
              </div>
            </div>
            {/* 新号 */}
            <div className="border-b border-line-divider px-4 py-3.5">
              <div className="m2-mono text-[10px] text-ink-secondary"><CK k="appeal.newPhoneLabel">{acc('appeal.newPhoneLabel')}</CK></div>
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
                <div className="m2-mono text-[10px] text-ink-secondary"><CK k="appeal.photoTitle">{acc('appeal.photoTitle')}</CK></div>
                <div className="m2-mono text-[10px] text-ink-secondary">
                  {photos.length}/{MAX_PHOTOS}
                </div>
              </div>
              <div className="mt-1 text-caption-xs text-ink-secondary"><CK k="appeal.photoHint">{acc('appeal.photoHint')}</CK></div>
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
                    {uploading ? (
                      <CK k="appeal.uploading">{acc('appeal.uploading')}</CK>
                    ) : (
                      <CK k="appeal.addPhoto">{acc('appeal.addPhoto')}</CK>
                    )}
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
                <CK k="appeal.whyPhoto">{acc('appeal.whyPhoto')}</CK>
              </p>
            </div>
            {/* 情况说明（必填） */}
            <div className="px-4 py-3.5">
              <div className="m2-mono text-[10px] text-ink-secondary"><CK k="appeal.noteLabel">{acc('appeal.noteLabel')}</CK></div>
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
            {submitM.isPending ? (
              <CK k="appeal.submitting">{acc('appeal.submitting')}</CK>
            ) : (
              <CK k="appeal.submit">{acc('appeal.submit')}</CK>
            )}
          </button>
        </>
      ) : null,

    /* 3. appeal.result：提交成功卡（done 态与表单互斥） */
    'appeal.result': () =>
      loaded && done ? (
        <div className="m2-card mt-3 p-4" data-testid="appeal-success">
          <div className="text-body font-bold text-ink"><CK k="appeal.successTitle">{acc('appeal.successTitle')}</CK></div>
          <p className="mt-1 text-caption leading-[1.8] text-ink-secondary"><CK k="appeal.successBody">{acc('appeal.successBody')}</CK></p>
        </div>
      ) : null,

    /* 4. appeal.list：申诉记录列表（状态 pill 四档色纪律不设绿；EmptyC 三句话为 string
          prop 组件内无 CK 锚；透出侧一律 masked 列） */
    'appeal.list': () =>
      loaded ? (
        <>
          {/* 申诉记录 */}
          <SecH title={<CK k="appeal.listTitle">{acc('appeal.listTitle')}</CK>} />
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
                        <CK k="appeal.linePhones">{acc('appeal.linePhones', { old: it.oldPhoneMasked, new: it.newPhoneMasked })}</CK>
                      </span>
                      <StatusPill status={it.status} />
                    </div>
                    <div className="m2-mono mt-1 text-[9px] text-ink-secondary">
                      {it.requestNo} · {fmtDateTime(it.createdAt)}
                    </div>
                    {it.status === 'rejected' && it.decideNote ? (
                      <div className="mt-1 text-caption-xs leading-[1.7] text-danger-deep">
                        <CK k="appeal.decidePrefix">{acc('appeal.decidePrefix')}</CK>：{it.decideNote}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="phoneAppeal" storeId={canvasStoreId}>
      <div className="m2" data-testid="phone-appeal-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="appeal-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：appeal.head=页头裸段置顶（PushBar+大题原在 m2-pad 外，照 MePage 惯例）；
            余块共享 m2-pad 容器——默认序下视觉零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'appeal.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {user && meRawQ.isPending ? (
            <LoadingBlock lines={3} />
          ) : meRawQ.isError ? (
            <ErrorState message={acc('settings.loadFail')} onRetry={() => void meRawQ.refetch()} />
          ) : null}
          {/* 导语（归 appeal.head 键；随读态挂载在块流顶部，原 DOM 位逐字保留） */}
          {loaded ? (
            <p className="m2-note"><CK k="appeal.intro">{acc('appeal.intro')}</CK></p>
          ) : null}
          {layout.map((b) =>
            b.visible && b.blockKey !== 'appeal.head' ? (
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
