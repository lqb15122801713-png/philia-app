/**
 * ChangePhonePage · /me/settings/phone 手机号换绑（补缺大批片 2 · 账户安全域）
 *
 * 两步一单页：①原号收码（当前号 masked 展示，auth.me.phone 前端脱敏）→
 * sendCode(change_bind_old) → beta devCode 回显区（内测模拟码明文+通道说明文案）
 * → 输码；②新号输入（11 位校验）→ sendCode(change_bind_new) → 输码 →
 * changePhone（双码一次性验证，会话零丢失）→ 成功卡（数据全保留明示）→ 返回设置。
 * R13「为什么要验证码」一句入键；60s 重发倒计时；未绑定手机号→申诉通道引导。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { maskPhone, useAccountToast, useCountdown } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { acc } from '../copy/account'

const PHONE_RE = /^1\d{10}$/
const CODE_RE = /^\d{6}$/

/** 验证码输入行（收码钮 + devCode 回显区 + 输码框） */
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
  phoneLine: string
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
            {sending ? acc('bind.sending') : countdownSec > 0 ? acc('bind.resendIn', { sec: countdownSec }) : acc('bind.sendCode')}
          </button>
        </div>
        {devCode ? (
          <div className="mt-2.5 rounded-input bg-brand-primary-light px-3.5 py-2.5" data-testid="bind-dev-echo">
            <div className="m2-mono text-[13px] font-bold tracking-[.2em] text-ink">
              {acc('bind.devEcho', { code: devCode })}
            </div>
            <div className="mt-1 text-caption-xs leading-[1.7] text-ink-secondary">{acc('bind.devEchoNote')}</div>
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

  return (
    <div className="m2" data-testid="change-phone-page" style={{ minHeight: '100vh' }}>
      <PushBar label={acc('bind.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{acc('bind.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        {user && meRawQ.isPending ? (
          <LoadingBlock lines={3} />
        ) : meRawQ.isError ? (
          <ErrorState message={acc('settings.loadFail')} onRetry={() => void meRawQ.refetch()} />
        ) : done ? (
          /* 成功卡（数据全保留明示）+ 返回设置出口 */
          <div className="m2-card p-5 text-center" data-testid="bind-success">
            <div className="u1-serif text-[21px] font-black text-ink">{acc('bind.successTitle')}</div>
            <p className="mt-2 text-caption leading-[1.9] text-ink-secondary">{acc('bind.successBody')}</p>
            <Link
              to="/me/settings"
              className="mt-[18px] inline-block rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas"
            >
              {acc('bind.backSettings')}
            </Link>
          </div>
        ) : !mePhone ? (
          /* 未绑定手机号 → 申诉通道引导（三句话） */
          <div className="m2-card p-5 text-center" data-testid="bind-no-phone">
            <div className="u1-serif text-[21px] font-black text-ink">{acc('bind.noPhoneTitle')}</div>
            <p className="mt-2 text-caption leading-[1.9] text-ink-secondary">{acc('bind.noPhoneBody')}</p>
            <Link
              to="/me/settings/phone/appeal"
              className="mt-[18px] inline-block rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas"
            >
              {acc('bind.noPhoneCta')}
            </Link>
          </div>
        ) : (
          <>
            {/* ① 原号收码 */}
            <SecH title={acc('bind.step1Title')} />
            <CodeBlock
              phoneLine={`${acc('bind.currentPhone')} ${maskPhone(mePhone)}`}
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
              {acc('bind.whyCode')}
            </p>

            {/* ② 新号收码 */}
            <SecH title={acc('bind.step2Title')} />
            <div className="m2-card mb-2.5 px-4 py-3.5">
              <div className="m2-mono text-[10px] text-ink-secondary">{acc('bind.newPhoneLabel')}</div>
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
              phoneLine={newPhone ? maskPhone(newPhone) : acc('bind.newPhonePlaceholder')}
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
              {changeM.isPending ? acc('bind.submitting') : acc('bind.submit')}
            </button>
          </>
        )}
      </div>
      {toastEl}
    </div>
  )
}
