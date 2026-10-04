/**
 * 员工端登录页 /dev-login（批次 U2 任务 H · 试样屏 1 换肤；骨架批片 1 S-00 重排）
 *
 * S-00 骨架（UX 语言包 V1.1 §三）：主视觉槽 → wordmark → serif 宣言（刷底强调=淡黄，
 * inline linear-gradient(transparent 62%, #F2DFA6 62%)）→ G2 主钮（SkBtnAction 淡黄）→
 * 账号行 ×2 → 口令行 → 协议小字。淡黄=宣言刷底+主钮=2 处封顶；无 dock。
 * ⚠️ 内测现实：登录链路=dev-login 种子用户（服务端仅允许 seed_ 前缀）——淡黄主钮
 * 落到真实账号选择区（手机号登录上线前等价物，不造假）；口令钮展开内测口令门
 * （批次 6 B2 真实链路）。dev-login 种子登录链路不回归（种子钮/内测口令/userId 兜底/登出全保）。
 */

import { devLogin, getApiBase, logout, Skeleton, useMe, usePhiliaClient, resolveSlotUrl, slotContentOf } from '@philia/shared'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { SkBtnAction } from '@/components/skeleton'
import { LOGIN_COPY } from '@/copy/login'

interface SeedUser {
  id: string
  nickname: string
  roles: string[]
}

const ROLE_LABEL: Record<string, string> = {
  merchant_owner: '店主',
  staff: '员工',
  customer: '客户',
}
const roleLabel = (roles: string[]) => roles.map((r) => ROLE_LABEL[r] ?? r).join(' / ')

export default function DevLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const { queryClient } = usePhiliaClient()
  const { user, refetch } = useMe()

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [manualId, setManualId] = useState('')
  const [error, setError] = useState<string | null>(null)

  /* ---- 动态拉取种子用户（仅员工角色） ---- */
  const [seeds, setSeeds] = useState<SeedUser[] | null>(null)
  const [seedsError, setSeedsError] = useState<string | null>(null)
  /* ---- 内测口令门（服务端 BETA_GATE_CODE 设置后须带口令） ---- */
  const [gateRequired, setGateRequired] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)
  const [gateCode, setGateCode] = useState('')
  const [gateError, setGateError] = useState<string | null>(null)
  const accountsRef = useRef<HTMLDivElement>(null)

  const loadSeeds = (code?: string) => {
    const qs = code ? `?code=${encodeURIComponent(code)}` : ''
    fetch(`${getApiBase()}/api/auth/dev-seed-users${qs}`)
      .then(async (r) => {
        if (r.status === 401) {
          setGateRequired(true)
          setGateError(null)
          return null
        }
        if (r.status === 403) {
          setGateRequired(true)
          setGateError('内测口令错误，请重新输入')
          return null
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as { users?: SeedUser[] }
      })
      .then((d) => {
        if (d) {
          setSeeds(d.users ?? [])
          setSeedsError(null)
          setGateError(null)
        }
      })
      .catch((e) => {
        setSeedsError(e instanceof Error ? e.message : '拉取失败')
      })
  }

  useEffect(() => {
    loadSeeds()
    // 仅首挂载拉一次；口令提交由 submitGate 显式触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitGate = () => {
    const code = gateCode.trim()
    if (!code) return
    loadSeeds(code)
  }
  const staffSeeds = (seeds ?? []).filter((u) => u.roles.includes('staff'))

  const doLogin = async (userId: string) => {
    setPendingId(userId)
    setError(null)
    try {
      await devLogin(getApiBase(), userId, gateCode.trim() || undefined)
      await queryClient.invalidateQueries()
      navigate(from && from !== '/dev-login' ? from : '/today', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败'
      if (msg.includes('口令')) setGateRequired(true)
      setError(msg)
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

      {/* 2. wordmark + serif 宣言（刷底强调=淡黄，S-00 淡黄预算第 1 处）+ 门店行 + 角色签（仅展示——
             角色由商家端员工管理分配，不可自选） */}
      <div className="px-[30px] pt-[26px] text-center">
        <p className="font-number text-body-sm font-bold tracking-[.3em] text-[rgba(59,46,36,.42)]">
          {LOGIN_COPY['login.wordmark']}
        </p>
        <h1 className="u1-serif mt-3 text-v2-screen">
          {LOGIN_COPY['login.manifesto.line1']}
          <br />
          <span style={{ background: 'linear-gradient(transparent 62%, #F2DFA6 62%)' }}>
            {LOGIN_COPY['login.manifesto.line2']}
          </span>
        </h1>
        <p className="mt-2 text-caption text-[rgba(59,46,36,.62)]">
          {LOGIN_COPY['login.storeLine']}
        </p>
        <div className="mt-[18px] flex justify-center gap-2">
          <span className="u1-ring rounded-full bg-card px-3 py-1.5 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">{LOGIN_COPY['login.role.frontdesk']}</span>
          <span className="u1-ring rounded-full bg-card px-3 py-1.5 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">{LOGIN_COPY['login.role.groomer']}</span>
        </div>
      </div>

      {/* 3. G2 淡黄主钮（S-00 淡黄预算第 2 处；真实落点=账号选择区，不造假） */}
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
          <p className="mt-1 text-caption-xs text-ink-secondary">角色：{user.roles.join(' / ')}</p>
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

      {/* 4. 账号行（内测登录真链路：种子账号 + userId 手动兜底） */}
      <div ref={accountsRef} className="mx-8 mt-5 scroll-mt-4">
        <h2 className="text-body-sm font-bold">{LOGIN_COPY['login.accounts.title']}</h2>
        {gateRequired && seeds === null ? (
          <p className="mt-2 rounded-control bg-danger-light px-4 py-3 text-caption text-danger-deep">
            {LOGIN_COPY['login.gate.required']}
          </p>
        ) : seeds === null && seedsError === null ? (
          <ul className="mt-2.5 space-y-2">
            {[1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-14 !rounded-control" />
              </li>
            ))}
          </ul>
        ) : staffSeeds.length > 0 ? (
          <ul className="mt-2.5 space-y-2">
            {staffSeeds.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={pendingId !== null}
                  onClick={() => void doLogin(u.id)}
                  className="u1-card flex min-h-14 w-full items-center justify-between px-4 py-3 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-60"
                >
                  <span>
                    <span className="block text-body-sm font-semibold">{u.nickname}</span>
                    <span className="block text-caption-xs text-ink-secondary">{roleLabel(u.roles)}</span>
                  </span>
                  <span className="text-caption text-ink-secondary">
                    {pendingId === u.id ? '登录中…' : '登录 ›'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2.5 rounded-control bg-danger-light px-4 py-3 text-caption-xs text-danger-deep">
            {seedsError
              ? LOGIN_COPY['login.seed.loadFailed'].replace('{error}', seedsError)
              : LOGIN_COPY['login.seed.empty']}
          </p>
        )}

        {/* 手动输入兜底 */}
        <div className="mt-4 flex gap-2">
          <Input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder={LOGIN_COPY['login.manual.placeholder']}
            className="h-12 bg-card text-body-sm"
          />
          <button
            type="button"
            disabled={pendingId !== null || manualId.trim().length === 0}
            onClick={() => void doLogin(manualId.trim())}
            className="u1-ring h-12 shrink-0 rounded-control bg-card px-4 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
          >
            登录
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-control bg-danger-light px-4 py-3 text-caption text-danger-deep">{error}</p>
        ) : null}

        <p className="mt-5 text-caption-xs leading-relaxed text-[rgba(59,46,36,.42)]">
          {LOGIN_COPY['login.seed.tip']}
        </p>
      </div>

      {/* 5. 口令行（次级钮展开口令门；服务端要求口令时强制显示） */}
      <div className="px-[30px] pt-4">
        <button
          type="button"
          data-testid="login-gate"
          onClick={() => setGateOpen((v) => !v)}
          className="u1-ring flex h-11 min-h-[44px] w-full items-center justify-center rounded-control bg-card text-caption font-semibold text-[rgba(59,46,36,.62)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          {LOGIN_COPY['login.gateEntry']}
        </button>
      </div>
      {gateOpen || (gateRequired && seeds === null) ? (
        <div className="u1-card mx-8 mt-4 p-4" data-testid="gate-panel">
          <p className="text-body-sm font-semibold">{LOGIN_COPY['login.gate.title']}</p>
          <p className="mt-1 text-caption-xs text-ink-secondary">{LOGIN_COPY['login.gate.hint']}</p>
          <div className="mt-2.5 flex gap-2">
            <Input
              type="password"
              value={gateCode}
              onChange={(e) => setGateCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitGate()
              }}
              placeholder={LOGIN_COPY['login.gate.placeholder']}
              className="h-12 bg-card text-body-sm"
            />
            <button
              type="button"
              disabled={gateCode.trim().length === 0}
              onClick={submitGate}
              className="u1-ring h-12 shrink-0 rounded-control bg-card px-5 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
            >
              确认
            </button>
          </div>
          {gateError ? <p className="mt-2 text-caption-xs text-danger-deep">{gateError}</p> : null}
        </div>
      ) : null}

      {/* 6. 协议小字 */}
      <p className="mt-4 text-center text-caption-xs leading-relaxed text-[rgba(59,46,36,.42)]">
        {LOGIN_COPY['login.agreement']}
      </p>
    </div>
  )
}
