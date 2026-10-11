/**
 * ChangePhonePage · /me/settings/phone 手机号换绑（补缺大批片 2 · 账户安全域）
 *
 * 两步一单页：①原号收码（当前号 masked 展示，auth.me.phone 前端脱敏）→
 * sendCode(change_bind_old) → beta devCode 回显区（内测模拟码明文+通道说明文案）
 * → 输码；②新号输入（11 位校验）→ sendCode(change_bind_new) → 输码 →
 * changePhone（双码一次性验证，会话零丢失）→ 成功卡（数据全保留明示）→ 返回设置。
 * R13「为什么要验证码」一句入键；60s 重发倒计时；未绑定手机号→申诉通道引导。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域重屏批）：四块入册
 * （bind.head/step1/step2/bind.result），块序/显隐=useCanvasLayout('changePhone')
 * （published→注册表默认序尾补，空=默认序兜底常量）；文案键行内可改=CK 点选反查锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。两步状态机/双码提交链路零改动，
 * data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { maskPhone, useAccountToast, useCountdown } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { acc } from '../copy/account'
import { readLastBooking } from '@/lib/bookingPrefill'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const BIND_DEFAULT_ORDER = ['bind.head', 'bind.step1', 'bind.step2', 'bind.result'] as const

const PHONE_RE = /^1\d{10}$/
const CODE_RE = /^\d{6}$/

/** 验证码输入行（收码钮 + devCode 回显区 + 输码框）。画布批片 3：phoneLine 放宽 ReactNode 供 CK 锚 */
function CodeBlock({
  phoneLine,
  code,
  onCodeChange,
  onSend,
  sending,
  countdownSec,
  devCode,
  sendTestId,
  inputTestId,
}: {
  phoneLine: ReactNode
  code: string
  onCodeChange: (v: string) => void
  onSend: () => void
  sending: boolean
  countdownSec: number
  devCode: string | null
  sendTestId?: string
  inputTestId?: string
}) {
  return (
    <div className="m2-card overflow-hidden">
      <div className="px-4 py-3.5">
        <div className="m2-mono text-[10px] text-ink-secondary">{phoneLine}</div>
        <div className="mt-2.5 flex gap-2.5">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={acc('bind.codePlaceholder')}
            data-testid={inputTestId}
            className="min-w-0 flex-1 rounded-input border border-line bg-card px-4 py-2.5 font-number text-body text-ink placeholder:text-ink-placeholder"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={sending || countdownSec > 0}
            data-testid={sendTestId}
            className="flex-none rounded-full bg-ink px-4 py-2.5 text-caption text-canvas transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
          >
            {sending ? (
              <CK k="bind.sending">{acc('bind.sending')}</CK>
            ) : countdownSec > 0 ? (
              <CK k="bind.resendIn">{acc('bind.resendIn', { sec: countdownSec })}</CK>
            ) : (
              <CK k="bind.sendCode">{acc('bind.sendCode')}</CK>
            )}
          </button>
        </div>
        {devCode ? (
          <div className="mt-2.5 rounded-input bg-brand-primary-light px-3.5 py-2.5" data-testid="bind-dev-echo">
            <div className="m2-mono text-[13px] font-bold tracking-[.2em] text-ink">
              <CK k="bind.devEcho">{acc('bind.devEcho', { code: devCode })}</CK>
            </div>
            <div className="mt-1 text-caption-xs leading-[1.7] text-ink-secondary"><CK k="bind.devEchoNote">{acc('bind.devEchoNote')}</CK></div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ChangePhonePage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useAccountToast()
  const [oldCode, setOldCode] = useState('')
  const [oldDevCode, setOldDevCode] = useState<string | null>(null)
  const [newPhone, setNewPhone] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newDevCode, setNewDevCode] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const oldCd = useCountdown()
  const newCd = useCountdown()

  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const mePhone = meRawQ.data?.user?.phone ?? null

  const sendOldM = useMutation({
    mutationFn: () => trpc.authSecurity.sendCode.mutate({ purpose: 'change_bind_old', phone: mePhone! }),
    onSuccess: (r) => {
      setOldDevCode(r.devCode ?? null)
      oldCd.start(60)
      showToast(acc('bind.sentOk'))
      setErrMsg(null)
    },
    onError: (err) => setErrMsg(err.message || acc('bind.sendFail')),
  })
  const sendNewM = useMutation({
    mutationFn: () => trpc.authSecurity.sendCode.mutate({ purpose: 'change_bind_new', phone: newPhone }),
    onSuccess: (r) => {
      setNewDevCode(r.devCode ?? null)
      newCd.start(60)
      showToast(acc('bind.sentOk'))
      setErrMsg(null)
    },
    onError: (err) => setErrMsg(err.message || acc('bind.sendFail')),
  })
  const changeM = useMutation({
    mutationFn: () =>
      trpc.authSecurity.changePhone.mutate({ oldCode, newPhone, newCode }),
    onSuccess: () => {
      setDone(true)
      setErrMsg(null)
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
    onError: (err) => setErrMsg(err.message || acc('bind.submitFail')),
  })

  const trySendNew = () => {
    if (!PHONE_RE.test(newPhone)) {
      setErrMsg(acc('bind.phoneInvalid'))
      return
    }
    sendNewM.mutate()
  }
  const submit = () => {
    if (!CODE_RE.test(oldCode)) {
      setErrMsg(acc('bind.needOldCode'))
      return
    }
    if (!PHONE_RE.test(newPhone)) {
      setErrMsg(acc('bind.phoneInvalid'))
      return
    }
    if (!CODE_RE.test(newCode)) {
      setErrMsg(acc('bind.codeInvalid'))
      return
    }
    changeM.mutate()
  }

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
      .filter((b) => b.pageKey === 'changePhone')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : BIND_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('changePhone', canvasStoreId, registryBlocks)

  /* 两步状态机互斥口径（照改造前四分支语义）：读态行页级挂载；表单步=非读态非成功且已绑号 */
  const meLoading = !!(user && meRawQ.isPending)
  const meFailed = meRawQ.isError
  const formVisible = !meLoading && !meFailed && !done && !!mePhone

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. bind.head：PushBar 返回条 + m2 大题页头（PushBar label 为 string prop 无 CK 锚） */
    'bind.head': () => (
      <>
        <PushBar label={acc('bind.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="bind.title">{acc('bind.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. bind.step1：第一步原号收码（当前号 masked + CodeBlock + R13 为什么要验证码） */
    'bind.step1': () =>
      formVisible ? (
        <>
          {/* ① 原号收码 */}
          <SecH title={<CK k="bind.step1Title">{acc('bind.step1Title')}</CK>} />
          <CodeBlock
            phoneLine={<><CK k="bind.currentPhone">{acc('bind.currentPhone')}</CK> {maskPhone(mePhone)}</>}
            code={oldCode}
            onCodeChange={setOldCode}
            onSend={() => sendOldM.mutate()}
            sending={sendOldM.isPending}
            countdownSec={oldCd.sec}
            devCode={oldDevCode}
            sendTestId="bind-send-old"
            inputTestId="bind-old-code"
          />
          <p className="m2-note mt-2.5" data-testid="bind-why-code">
            <CK k="bind.whyCode">{acc('bind.whyCode')}</CK>
          </p>
        </>
      ) : null,

    /* 3. bind.step2：第二步新号收码 + 提交（收码行键共享 step1 CodeBlock 件） */
    'bind.step2': () =>
      formVisible ? (
        <>
          {/* ② 新号收码 */}
          <SecH title={<CK k="bind.step2Title">{acc('bind.step2Title')}</CK>} />
          <div className="m2-card mb-2.5 px-4 py-3.5">
            <div className="m2-mono text-[10px] text-ink-secondary"><CK k="bind.newPhoneLabel">{acc('bind.newPhoneLabel')}</CK></div>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder={acc('bind.newPhonePlaceholder')}
              data-testid="bind-new-phone"
              className="mt-1.5 w-full rounded-input border border-line bg-card px-4 py-2.5 font-number text-body text-ink placeholder:text-ink-placeholder"
            />
          </div>
          <CodeBlock
            phoneLine={newPhone ? maskPhone(newPhone) : <CK k="bind.newPhonePlaceholder">{acc('bind.newPhonePlaceholder')}</CK>}
            code={newCode}
            onCodeChange={setNewCode}
            onSend={trySendNew}
            sending={sendNewM.isPending}
            countdownSec={newCd.sec}
            devCode={newDevCode}
            sendTestId="bind-send-new"
            inputTestId="bind-new-code"
          />

          {errMsg ? (
            <p role="alert" className="mt-3 text-caption text-danger-deep" data-testid="bind-error">
              {errMsg}
            </p>
          ) : null}

          <button
            type="button"
            data-testid="bind-submit"
            disabled={changeM.isPending}
            onClick={submit}
            className="mt-4 w-full rounded-full bg-ink py-3 text-body font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            {changeM.isPending ? (
              <CK k="bind.submitting">{acc('bind.submitting')}</CK>
            ) : (
              <CK k="bind.submit">{acc('bind.submit')}</CK>
            )}
          </button>
        </>
      ) : null,

    /* 4. bind.result：成功卡（数据全保留明示）/ 未绑定引导卡（申诉通道三句话），互斥两态 */
    'bind.result': () =>
      !meLoading && !meFailed && done ? (
        /* 成功卡（数据全保留明示）+ 返回设置出口 */
        <div className="m2-card p-5 text-center" data-testid="bind-success">
          <div className="u1-serif text-[21px] font-black text-ink"><CK k="bind.successTitle">{acc('bind.successTitle')}</CK></div>
          <p className="mt-2 text-caption leading-[1.9] text-ink-secondary"><CK k="bind.successBody">{acc('bind.successBody')}</CK></p>
          <Link
            to="/me/settings"
            className="mt-[18px] inline-block rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas"
          >
            <CK k="bind.backSettings">{acc('bind.backSettings')}</CK>
          </Link>
        </div>
      ) : !meLoading && !meFailed && !mePhone ? (
        /* 未绑定手机号 → 申诉通道引导（三句话） */
        <div className="m2-card p-5 text-center" data-testid="bind-no-phone">
          <div className="u1-serif text-[21px] font-black text-ink"><CK k="bind.noPhoneTitle">{acc('bind.noPhoneTitle')}</CK></div>
          <p className="mt-2 text-caption leading-[1.9] text-ink-secondary"><CK k="bind.noPhoneBody">{acc('bind.noPhoneBody')}</CK></p>
          <Link
            to="/me/settings/phone/appeal"
            className="mt-[18px] inline-block rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas"
          >
            <CK k="bind.noPhoneCta">{acc('bind.noPhoneCta')}</CK>
          </Link>
        </div>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="changePhone" storeId={canvasStoreId}>
      <div className="m2" data-testid="change-phone-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="bind-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：bind.head=页头裸段置顶（PushBar+大题原在 m2-pad 外，照 MePage 惯例）；
            余块共享 m2-pad 容器——默认序下视觉零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'bind.head' ? (
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
          {layout.map((b) =>
            b.visible && b.blockKey !== 'bind.head' ? (
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
