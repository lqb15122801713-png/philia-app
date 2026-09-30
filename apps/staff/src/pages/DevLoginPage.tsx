/**
 * 员工端登录页 /dev-login（批次 U2 任务 H · 试样屏 1 换肤）
 *
 * 规格书 §1：主视觉卡（340 高）→ wordmark「PHILIA · 员工端」→ 衬线宣言
 * 「照顾好每一个被托付的小生命」（font-serif-cn）→ 门店行 → 淡黄主钮
 * 「手机号一键登录」+ 次级「口令入内测」→ 角色签（前台/美容师，仅展示）→ 协议小字。
 * ⚠️ 内测现实：登录链路=dev-login 种子用户（服务端仅允许 seed_ 前缀）——淡黄主钮
 * 落到真实账号选择区（手机号登录上线前等价物，不造假）；口令钮展开内测口令门
 * （批次 6 B2 真实链路）。dev-login 种子登录链路不回归。
 */

import { devLogin, getApiBase, logout, Skeleton, useMe, usePhiliaClient } from '@philia/shared'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
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
    <div className="pb-10">
      {/* 1. 主视觉卡（340 高；既有品牌资产 /brand/banner-home-1200.png；试样 .lg-hero margin 10px 22px 0）
             UX-06 P3-2 素材通道登记：门店晨间实拍替换排期中（拍摄清单在 UX 侧），到位前沿用品牌资产 banner-home-1200.png */}
      <div className="u1-card mx-[22px] mt-2.5 flex h-[340px] items-center justify-center overflow-hidden">
        <img
          src="/brand/banner-home-1200.png"
          alt="菲丽亚宠物门店"
          className="h-full w-full rounded-panel object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
      </div>

      {/* 2. wordmark + 衬线宣言 + 门店行（试样 .lg-brand padding 26px 30px 0；
             换皮批片 4：wordmark=eyebrow 小签转 mono 轨（v2.0 §2.1 eyebrow=等宽+宽距大写），
             宣言转 v2 屏题档 serif 900（§4.11 宣言题=登录页专用，效率密度下只留这一处）；
             JetBrains Mono 自托管上限 700，wordmark 800→700） */}
      <div className="px-[30px] pt-[26px] text-center">
        <p className="font-number text-body-sm font-bold tracking-[.3em] text-[rgba(59,46,36,.42)]">
          {LOGIN_COPY['login.wordmark']}
        </p>
        <h1 className="u1-serif mt-3 text-v2-screen">
          {LOGIN_COPY['login.manifesto.line1']}
          <br />
          {LOGIN_COPY['login.manifesto.line2']}
        </h1>
        <p className="mt-2 text-caption text-[rgba(59,46,36,.62)]">
          {LOGIN_COPY['login.storeLine']}
        </p>
      </div>

      {/* 3. 淡黄主钮 + 次级口令（真实落点：账号选择区 / 口令门）；试样 .lg-act padding 22px 30px 0 */}
      <div className="flex flex-col gap-2.5 px-[30px] pt-[22px]">
        <button
          type="button"
          data-testid="login-primary"
          onClick={() => accountsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex h-14 min-h-[56px] w-full items-center justify-center rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          手机号一键登录
        </button>
        <button
          type="button"
          data-testid="login-gate"
          onClick={() => setGateOpen((v) => !v)}
          className="u1-ring flex h-11 min-h-[44px] w-full items-center justify-center rounded-control bg-card text-caption font-semibold text-[rgba(59,46,36,.62)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          口令入内测
        </button>
      </div>

      {/* 4. 角色签（仅展示——角色由商家端员工管理分配，不可自选）；试样 .lg-role margin-top 18px */}
      <div className="mt-[18px] flex justify-center gap-2">
        <span className="u1-ring rounded-full bg-card px-3 py-1.5 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">前台 frontdesk</span>
        <span className="u1-ring rounded-full bg-card px-3 py-1.5 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">美容师 groomer</span>
      </div>

      {/* 5. 协议小字 */}
      <p className="mt-4 text-center text-caption-xs leading-relaxed text-[rgba(59,46,36,.42)]">
        {LOGIN_COPY['login.agreement']}
      </p>

      {/* 已登录态 */}
      {user ? (
        <div className="u1-card mx-8 mt-4 p-4">
          <p className="text-body-sm">
            当前已登录：<span className="font-semibold">{user.nickname ?? user.id}</span>
          </p>
          <p className="mt-1 text-caption-xs text-ink-secondary">角色：{user.roles.join(' / ')}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/today')}
              className="h-11 flex-1 rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              进入任务台
            </button>
            <button
              type="button"
              onClick={doLogout}
              className="u1-ring h-11 flex-1 rounded-control bg-card text-body-sm text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              退出登录
            </button>
          </div>
        </div>
      ) : null}

      {/* 口令门（次级钮展开；服务端要求口令时强制显示） */}
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
              placeholder="内测口令"
              className="h-12 bg-card text-body-sm"
            />
            <button
              type="button"
              disabled={gateCode.trim().length === 0}
              onClick={submitGate}
              className="h-12 shrink-0 rounded-control bg-brand-primary px-5 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
            >
              确认
            </button>
          </div>
          {gateError ? <p className="mt-2 text-caption-xs text-danger-deep">{gateError}</p> : null}
        </div>
      ) : null}

      {/* 账号选择区（内测登录真链路） */}
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
            placeholder="手动输入 userId（ULID）"
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
    </div>
  )
}
