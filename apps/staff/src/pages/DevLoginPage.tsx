/**
 * 员工端登录页 /login：员工账号与内测口令直接提交，不枚举账号清单。
 */

import { devLogin, getApiBase, logout, useMe, usePhiliaClient, resolveSlotUrl, slotContentOf } from '@philia/shared'
import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { SkBtnAction } from '@/components/skeleton'
import { LOGIN_COPY } from '@/copy/login'

const ROLE_LABEL: Record<string, string> = {
  merchant_owner: '店主',
  merchant_manager: '店长',
  merchant_clerk: '店员',
  staff: '员工',
  customer: '客户',
}
const roleLabel = (roles: string[]) => roles.map((role) => ROLE_LABEL[role] ?? '账号').join(' / ')

export default function DevLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const { queryClient } = usePhiliaClient()
  const { user, refetch } = useMe()

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [manualId, setManualId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [gateRequired, setGateRequired] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)
  const [gateCode, setGateCode] = useState('')
  const accountsRef = useRef<HTMLDivElement>(null)

  const doLogin = async (accountId: string) => {
    setPendingId(accountId)
    setError(null)
    try {
      await devLogin(getApiBase(), accountId, gateCode.trim() || undefined)
      await queryClient.invalidateQueries()
      navigate(from && from !== '/login' && from !== '/dev-login' ? from : '/today', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败'
      const needsGate = msg.includes('口令')
      if (needsGate) setGateRequired(true)
      setError(needsGate ? '账号或内测口令不正确，请核对后重试' : '账号无法登录，请核对员工账号后重试')
    } finally {
      setPendingId(null)
    }
  }

  const doLogout = async () => {
    setError(null)
    try {
      await logout(getApiBase())
      await queryClient.invalidateQueries()
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登出失败')
    }
  }

  return (
    <div className="sk pb-10">
      {/* 1. 主视觉槽（340 高；端口批片 C：读槽位 login.hero.staff live 值，无=码内默认品牌资产；
             UX-06 P3-2 素材通道登记：门店晨间实拍替换排期中——到位后端口页换图零代码；槽位逻辑不动） */}
      <div className="u1-card mx-[22px] mt-2.5 flex h-[340px] items-center justify-center overflow-hidden">
        <img
          src={resolveSlotUrl(slotContentOf('login.hero.staff')?.url) ?? '/brand/banner-home-1200.png'}
          alt={slotContentOf('login.hero.staff')?.alt ?? '菲丽亚宠物门店'}
          className="h-full w-full rounded-panel object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
      </div>

      {/* 2. wordmark + serif 宣言（刷底强调=cream，S-00 cream 预算第 1 处）+ 门店行 + 角色签（仅展示——
             角色由商家端员工管理分配，不可自选） */}
      <div className="px-[30px] pt-[26px] text-center">
        <p className="font-number text-body-sm font-bold tracking-[.3em] text-ink-placeholder">
          {LOGIN_COPY['login.wordmark']}
        </p>
        <h1 className="u1-serif mt-3 text-v2-screen">
          {LOGIN_COPY['login.manifesto.line1']}
          <br />
          <span style={{ background: 'linear-gradient(transparent 62%, var(--gold-pale) 62%)' }}>
            {LOGIN_COPY['login.manifesto.line2']}
          </span>
        </h1>
        <p className="mt-2 text-caption text-ink-secondary">
          {LOGIN_COPY['login.storeLine']}
        </p>
        <div className="mt-[18px] flex justify-center gap-2">
          <span className="u1-ring rounded-full bg-card px-3 py-1.5 text-caption font-semibold text-ink-secondary">{LOGIN_COPY['login.role.frontdesk']}</span>
          <span className="u1-ring rounded-full bg-card px-3 py-1.5 text-caption font-semibold text-ink-secondary">{LOGIN_COPY['login.role.groomer']}</span>
        </div>
      </div>

      {/* 3. G2 cream 主钮（S-00 cream 预算第 2 处；真实落点=账号选择区，不造假） */}
      <div className="px-[30px] pt-[22px]">
        <SkBtnAction
          testId="login-primary"
          onClick={() => accountsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {LOGIN_COPY['login.primaryCta']}
        </SkBtnAction>
      </div>

      {/* 已登录态（真 logout / 进任务台；中性工艺不占淡黄预算） */}
      {user ? (
        <div className="u1-card mx-8 mt-4 p-4">
          <p className="text-body-sm">
            {LOGIN_COPY['login.loggedIn.lead']}：<span className="font-semibold">{user.nickname ?? user.id}</span>
          </p>
          <p className="mt-1 text-caption text-ink-secondary">角色：{roleLabel(user.roles)}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/today')}
              className="u1-ring h-11 flex-1 rounded-control bg-card text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {LOGIN_COPY['login.loggedIn.enter']}
            </button>
            <button
              type="button"
              onClick={doLogout}
              className="u1-ring h-11 flex-1 rounded-control bg-card text-body-sm text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {LOGIN_COPY['login.loggedIn.logout']}
            </button>
          </div>
        </div>
      ) : null}

      <div ref={accountsRef} className="mx-8 mt-5 scroll-mt-4">
        <h2 className="text-body-sm font-bold">{LOGIN_COPY['login.accounts.title']}</h2>
        <p id="staff-account-hint" className="mt-2 text-caption leading-relaxed text-ink-secondary">
          {LOGIN_COPY['login.account.tip']}
        </p>
        {gateRequired ? (
          <p className="mt-2 rounded-control bg-danger-light px-4 py-3 text-caption text-danger-deep">
            {LOGIN_COPY['login.gate.required']}
          </p>
        ) : null}
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (manualId.trim()) void doLogin(manualId.trim())
          }}
        >
          <label htmlFor="staff-account" className="mb-2 block text-caption font-semibold text-ink">
            {LOGIN_COPY['login.manual.label']}
          </label>
          <div className="flex gap-2">
            <Input
              id="staff-account"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder={LOGIN_COPY['login.manual.placeholder']}
              autoComplete="username"
              aria-describedby="staff-account-hint"
              required
              className="h-12 bg-card text-body-sm"
            />
            <button
              type="submit"
              disabled={pendingId !== null || manualId.trim().length === 0}
              className="u1-ring h-12 shrink-0 rounded-control bg-card px-4 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
            >
              {pendingId !== null ? '登录中…' : '登录'}
            </button>
          </div>
        </form>
        {error ? (
          <p role="alert" className="mt-3 rounded-control bg-danger-light px-4 py-3 text-caption text-danger-deep">{error}</p>
        ) : null}
      </div>

      <div className="px-[30px] pt-4">
        <button
          type="button"
          data-testid="login-gate"
          aria-expanded={gateOpen || gateRequired}
          aria-controls="gate-panel"
          onClick={() => setGateOpen((v) => !v)}
          className="u1-ring flex h-11 min-h-[44px] w-full items-center justify-center rounded-control bg-card text-caption font-semibold text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          {LOGIN_COPY['login.gateEntry']}
        </button>
      </div>
      {gateOpen || gateRequired ? (
        <div id="gate-panel" className="u1-card mx-8 mt-4 p-4" data-testid="gate-panel">
          <label htmlFor="staff-gate-code" className="block text-body-sm font-semibold">
            {LOGIN_COPY['login.gate.title']}
          </label>
          <p id="staff-gate-hint" className="mt-1 text-caption text-ink-secondary">{LOGIN_COPY['login.gate.hint']}</p>
          <Input
            id="staff-gate-code"
            type="password"
            value={gateCode}
            onChange={(e) => setGateCode(e.target.value)}
            aria-describedby="staff-gate-hint"
            autoComplete="current-password"
            placeholder={LOGIN_COPY['login.gate.placeholder']}
            className="mt-2.5 h-12 bg-card text-body-sm"
          />
        </div>
      ) : null}

      {/* 6. 协议小字 */}
      <p className="mt-4 text-center text-caption leading-relaxed text-ink-placeholder">
        {LOGIN_COPY['login.agreement']}
      </p>
    </div>
  )
}
