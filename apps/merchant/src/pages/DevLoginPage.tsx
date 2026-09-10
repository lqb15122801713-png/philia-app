/**
 * 商家端开发登录页（契约 docs/MERCHANT-CONTRACTS.md · T4.1）—— 路由 /dev-login
 *
 * ⚠️ 仅开发环境：Kimi 登录是线上平台能力，本地用 dev-login 适配
 * （服务端仅允许种子用户，见 server/src/auth/devLogin.ts）。
 *
 * - 种子用户列表：启动时 fetch GET /api/auth/dev-seed-users 动态渲染（v1.1-b1，
 *   不再硬编码 ULID——重跑 db:seed 后 ID 变化也能直接登录）；仅列店主角色；
 *   fetch 失败/为空 → 错误提示 + 手动输入兜底。
 * - 内测口令门（批次 6 任务 B2）：服务端设置 BETA_GATE_CODE 后，dev-seed-users
 *   无口令返回 401 → 页面显示口令输入框；登录请求 body 携带 code。
 * - 点击调 devLogin(baseUrl, userId, code?) → 失效全部查询缓存 → 跳回 from 或 /dashboard。
 */

import { devLogin, getApiBase, logout, useMe, usePhiliaClient } from '@philia/shared'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SeedUser {
  id: string
  nickname: string
  roles: string[]
}

const ROLE_LABEL: Record<string, string> = {
  merchant_owner: '店主 · merchant_owner',
  merchant_admin: '店员管理 · merchant_admin',
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

  /* ---- v1.1-b1：动态拉取种子用户（仅店主角色） ---- */
  const [seeds, setSeeds] = useState<SeedUser[] | null>(null)
  const [seedsError, setSeedsError] = useState<string | null>(null)
  /* ---- 批次 6 任务 B2：内测口令门（服务端 BETA_GATE_CODE 设置后须带口令） ---- */
  const [gateRequired, setGateRequired] = useState(false)
  const [gateCode, setGateCode] = useState('')
  const [gateError, setGateError] = useState<string | null>(null)

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
  const merchantSeeds = (seeds ?? []).filter((u) => u.roles.includes('merchant_owner'))

  const doLogin = async (userId: string) => {
    setPendingId(userId)
    setError(null)
    try {
      await devLogin(getApiBase(), userId, gateCode.trim() || undefined)
      await queryClient.invalidateQueries()
      navigate(from && from !== '/dev-login' ? from : '/dashboard', { replace: true })
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
    <div className="mx-auto max-w-lg px-4 pb-10">
      <header className="pt-8">
        <h1 className="text-title-lg">商家端 · 开发登录</h1>
        <p className="mt-1 inline-block rounded-full bg-brand-primary-light px-3 py-1 text-caption text-brand-primary-pressed">
          仅开发环境 · 生产环境请移除
        </p>
      </header>

      {user ? (
        <div className="mt-4 rounded-card bg-card p-4 shadow-card">
          <p className="text-body">
            当前已登录：<span className="font-semibold">{user.nickname ?? user.id}</span>
          </p>
          <p className="mt-1 text-caption text-ink-secondary">角色：{user.roles.join(' / ')}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              进入仪表盘
            </Button>
            <Button variant="outline" size="sm" onClick={doLogout}>
              退出登录
            </Button>
          </div>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="text-title">选择商家账号登录</h2>
        {gateRequired && seeds === null ? (
          <div className="mt-3 rounded-card bg-card p-4 shadow-card">
            <p className="text-body font-semibold">内测环境需要口令</p>
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
                className="h-12 bg-card text-body"
              />
              <Button
                disabled={gateCode.trim().length === 0}
                onClick={submitGate}
                className="h-12 bg-brand-primary text-body text-white hover:bg-brand-primary-hover"
              >
                确认
              </Button>
            </div>
            {gateError ? <p className="mt-2 text-caption text-danger-deep">{gateError}</p> : null}
          </div>
        ) : seeds === null && seedsError === null ? (
          <ul className="mt-3 space-y-2">
            {[1].map((i) => (
              <li key={i} className="h-14 animate-pulse rounded-card bg-sunken" />
            ))}
          </ul>
        ) : merchantSeeds.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {merchantSeeds.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={pendingId !== null}
                  onClick={() => void doLogin(u.id)}
                  className="flex min-h-14 w-full items-center justify-between rounded-card bg-card px-4 py-3 text-left shadow-card transition active:scale-[0.99] disabled:opacity-60"
                >
                  <span>
                    <span className="block text-body font-semibold">{u.nickname}</span>
                    <span className="block text-caption text-ink-secondary">{roleLabel(u.roles)}</span>
                  </span>
                  <span className="text-body text-ink-secondary">
                    {pendingId === u.id ? '登录中…' : '登录 →'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-card bg-danger-light px-4 py-3 text-caption text-danger-deep">
            {seedsError
              ? `种子用户拉取失败（${seedsError}），请确认 server 已启动，或手动输入 userId`
              : '未拉到店主种子用户，请重跑 server 的 db:seed，或手动输入 userId'}
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
            className="h-12 bg-card text-body"
          />
          <Button
            disabled={pendingId !== null || manualId.trim().length === 0}
            onClick={() => void doLogin(manualId.trim())}
            className="h-12 bg-brand-primary text-body text-white hover:bg-brand-primary-hover"
          >
            登录
          </Button>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-card bg-danger-light px-4 py-3 text-body text-danger-deep">{error}</p>
      ) : null}

      <p className="mt-8 text-caption text-ink-secondary">
        提示：dev-login 仅允许种子用户（kimi_id 以 seed_ 前缀），会话 cookie 有效期 7 天。
        非商家账号登录后会被引导回本页切换。
      </p>
    </div>
  )
}
