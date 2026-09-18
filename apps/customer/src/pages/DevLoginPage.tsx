/**
 * 开发登录页（契约 docs/CLIENT-CONTRACTS.md · T2.0）—— 路由 /dev-login
 *
 * ⚠️ 仅开发环境：Kimi 登录是线上平台能力，本地用 dev-login 适配
 * （服务端仅允许种子用户，见 server/src/auth/devLogin.ts）。
 *
 * - 种子用户列表：启动时 fetch GET /api/auth/dev-seed-users 动态渲染（v1.1-b1，
 *   不再硬编码 ULID——重跑 db:seed 后 ID 变化也能直接登录）；
 *   fetch 失败/为空 → 错误提示 + 手动输入兜底。
 * - 内测口令门（批次 6 任务 B2）：服务端设置 BETA_GATE_CODE 后，dev-seed-users
 *   无口令返回 401 → 页面显示口令输入框；登录请求 body 携带 code。
 * - 点击调 devLogin(baseUrl, userId, code?) → 失效全部查询缓存 → 跳回 from 或 /home。
 *
 * U4-D2（试样 01 逐格收口 · 拍板 2 内测口径）：视觉骨架向试样靠拢——
 * 左对齐 hero（54px 细线爪印圆标 + 衬线宣言「守护每一次/被照顾的时刻」
 * 20/700〔试样 30px 越字阶闸门，取字阶内 20；规格书 §10 同口径〕+
 * 「PHILIA · 洗护 / 美容 / 寄养」宽距小字 + 柠檬短分隔线 44×1.5）+
 * 柠檬主钮「手机号一键登录」+「口令入内测 ›」+ 底部协议小字。
 * 无真接口不造假：主钮真实落点=锚滚至种子账号区（员工端 U3 同口径），
 * 「口令入内测 ›」= 口令门卡显隐开关；口令门卡/种子用户列表真实交互全保留。
 */

import { devLogin, getApiBase, logout, useMe, usePhiliaClient } from '@philia/shared'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SeedUser {
  id: string
  nickname: string
  roles: string[]
}

const ROLE_LABEL: Record<string, string> = {
  merchant_owner: '店主',
  merchant_admin: '店员管理',
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

  /* ---- v1.1-b1：动态拉取种子用户（客户端展示全部角色，便于切换身份调试） ---- */
  const [seeds, setSeeds] = useState<SeedUser[] | null>(null)
  const [seedsError, setSeedsError] = useState<string | null>(null)
  /* ---- 批次 6 任务 B2：内测口令门（服务端 BETA_GATE_CODE 设置后须带口令） ---- */
  const [gateRequired, setGateRequired] = useState(false)
  const [gateCode, setGateCode] = useState('')
  const [gateError, setGateError] = useState<string | null>(null)
  /* ---- U4-D2：口令门卡显隐开关（「口令入内测 ›」真实交互）+ 账号区锚滚 ---- */
  const [gateOpen, setGateOpen] = useState(false)
  const accountsRef = useRef<HTMLElement>(null)

  const loadSeeds = (code?: string) => {
    const qs = code ? `?code=${encodeURIComponent(code)}` : ''
    fetch(`${getApiBase()}/api/auth/dev-seed-users${qs}`)
      .then(async (r) => {
        if (r.status === 401) {
          // 服务端要求内测口令 → 显示口令输入框
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

  const doLogin = async (userId: string) => {
    setPendingId(userId)
    setError(null)
    try {
      await devLogin(getApiBase(), userId, gateCode.trim() || undefined)
      await queryClient.invalidateQueries()
      navigate(from && from !== '/dev-login' ? from : '/home', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败'
      // 口令缺失/错误 → 强制显示口令输入框
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
    <div className="flex min-h-screen flex-col pb-8">
      {/* U4-D2 hero：试样 01 左对齐工艺——细线爪印圆标 + 衬线宣言 + 宽距小字 + 柠檬短分隔线 */}
      <header className="px-8 pt-14">
        <span
          className="u1-ring flex h-[54px] w-[54px] items-center justify-center rounded-full bg-card"
          aria-hidden="true"
        >
          {/* 实心爪印（VI 同 dock 中央钮，试样 01 同枚 SVG） */}
          <svg width="26" height="26" viewBox="0 0 32 32" fill="#4A3B2E">
            <circle cx="10.4" cy="11" r="3.1" />
            <circle cx="21.6" cy="11" r="3.1" />
            <circle cx="6.9" cy="17.2" r="2.7" />
            <circle cx="25.1" cy="17.2" r="2.7" />
            <path d="M16 15.5c-3.9 0-7 2.9-7 6 0 2 1.5 3.4 3.3 3.4 1.3 0 2.4-.7 3.7-.7s2.4.7 3.7.7c1.8 0 3.3-1.4 3.3-3.4 0-3.1-3.1-6-7-6z" />
          </svg>
        </span>
        {/* 衬线宣言：试样 30px 越字阶闸门 → 取 20/700（规格书 §10 同口径） */}
        <h1 className="u1-serif mt-[30px] text-title-lg font-bold leading-[1.5] tracking-[.04em]">
          守护每一次
          <br />
          被照顾的时刻
        </h1>
        <p className="mt-[14px] text-caption-xs font-medium tracking-[.14em] text-ink-secondary">
          PHILIA · 洗护 / 美容 / 寄养
        </p>
        <span className="mt-[22px] block h-[1.5px] w-11 bg-brand-primary" aria-hidden="true" />
      </header>

      {/* 主行动区：柠檬主钮真实落点=锚滚至种子账号区（拍板 2：无真接口不造假，
          员工端 U3 同口径）；「口令入内测 ›」= 口令门卡显隐开关（真实交互） */}
      <div className="mt-9 flex flex-col px-8">
        <button
          type="button"
          data-testid="login-primary"
          onClick={() => accountsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex w-full items-center justify-center rounded-control bg-brand-primary py-[15px] text-body-sm font-semibold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          手机号一键登录
        </button>
        <button
          type="button"
          data-testid="login-gate"
          aria-expanded={gateRequired || gateOpen}
          onClick={() => setGateOpen((v) => !v)}
          className="mt-4 self-center text-caption font-semibold text-ink-secondary"
        >
          口令入内测 ›
        </button>
      </div>

      <main className="mt-8 flex-1 px-4">
        {user ? (
          <div className="u1-card p-4">
            <p className="text-body-sm">
              当前已登录：<span className="font-semibold">{user.nickname ?? user.id}</span>
            </p>
            <p className="mt-1 text-caption text-ink-secondary">角色：{user.roles.join(' / ')}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="rounded-control" onClick={() => navigate('/home')}>
                进入首页
              </Button>
              <Button variant="outline" size="sm" className="rounded-control" onClick={doLogout}>
                退出登录
              </Button>
            </div>
          </div>
        ) : null}

        {/* 口令门卡：服务端 401/403 强制显示，或「口令入内测 ›」手动展开 */}
        {gateRequired || gateOpen ? (
          <section className="u1-card mt-4 p-4" aria-label="内测口令">
            <p className="text-body-sm font-semibold">内测环境需要口令</p>
            <p className="mt-1 text-caption text-ink-secondary">
              请输入内测口令后加载可登录账号；无口令或口令错误将无法登录。
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                type="password"
                value={gateCode}
                onChange={(e) => setGateCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitGate()
                }}
                placeholder="内测口令"
                className="rounded-control bg-card text-body-sm"
              />
              <Button
                disabled={gateCode.trim().length === 0}
                onClick={submitGate}
                className="rounded-control bg-brand-primary text-ink hover:bg-brand-primary-hover"
              >
                确认
              </Button>
            </div>
            {gateError ? <p className="mt-2 text-caption text-danger-deep">{gateError}</p> : null}
          </section>
        ) : null}

        <section ref={accountsRef} className="mt-6 scroll-mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-title">选择种子用户登录</h2>
            <span className="shrink-0 text-caption-xs text-ink-placeholder">仅开发环境 · 生产环境请移除</span>
          </div>
          {seeds === null && seedsError === null && !gateRequired ? (
            <ul className="mt-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <li key={i} className="h-14 animate-pulse rounded-panel bg-sunken" />
              ))}
            </ul>
          ) : seeds && seeds.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {seeds.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={pendingId !== null}
                    onClick={() => void doLogin(u.id)}
                    className="u1-card flex w-full items-center justify-between px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-body-sm font-semibold">{u.nickname}</span>
                      <span className="block text-caption-xs text-ink-secondary">{roleLabel(u.roles)}</span>
                    </span>
                    <span className="text-caption text-ink-secondary">
                      {pendingId === u.id ? '登录中…' : '登录 →'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : gateRequired && seeds === null ? (
            <p className="mt-3 text-caption text-ink-secondary">口令通过后在上方选择账号一键登录。</p>
          ) : (
            <p className="mt-3 rounded-panel bg-danger-light px-4 py-3 text-caption text-danger-deep">
              {seedsError
                ? `种子用户拉取失败（${seedsError}），请确认 server 已启动，或手动输入 userId`
                : '未拉到种子用户，请重跑 server 的 db:seed，或手动输入 userId'}
            </p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-title">手动输入 userId</h2>
          <p className="mt-1 text-caption text-ink-secondary">
            重跑 server 的 db:seed 后用户 ID 会变化，可在 server 库中查 users 表后粘贴到这里。
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="users.id（ULID）"
              className="rounded-control bg-card text-body-sm"
            />
            <Button
              disabled={pendingId !== null || manualId.trim().length === 0}
              onClick={() => void doLogin(manualId.trim())}
              className="rounded-control bg-brand-primary text-ink hover:bg-brand-primary-hover"
            >
              登录
            </Button>
          </div>
        </section>

        {error ? (
          <p className="mt-4 rounded-panel bg-danger-light px-4 py-3 text-caption text-danger-deep">{error}</p>
        ) : null}

        <p className="mt-8 text-caption-xs text-ink-placeholder">
          提示：dev-login 仅允许种子用户（kimi_id 以 seed_ 前缀），会话 cookie 有效期 7 天。
        </p>
      </main>

      {/* 底部协议小字（试样工艺：10px → 字阶取 11 caption-xs） */}
      <footer className="mt-10 px-10 text-center text-caption-xs leading-[1.8] text-ink-placeholder">
        登录即同意《用户协议》与《隐私政策》
        <br />
        内测期间口令由门店发放
      </footer>
    </div>
  )
}
