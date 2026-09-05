/**
 * 开发登录页（契约 docs/CLIENT-CONTRACTS.md · T2.0）—— 路由 /dev-login
 *
 * ⚠️ 仅开发环境：Kimi 登录是线上平台能力，本地用 dev-login 适配
 * （服务端仅允许种子用户，见 server/src/auth/devLogin.ts）。
 *
 * - 种子用户列表：启动时 fetch GET /api/auth/dev-seed-users 动态渲染（v1.1-b1，
 *   不再硬编码 ULID——重跑 db:seed 后 ID 变化也能直接登录）；
 *   fetch 失败/为空 → 错误提示 + 手动输入兜底。
 * - 点击调 devLogin(baseUrl, userId) → 失效全部查询缓存 → 跳回 from 或 /home。
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
  useEffect(() => {
    let cancelled = false
    fetch(`${getApiBase()}/api/auth/dev-seed-users`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ users?: SeedUser[] }>
      })
      .then((d) => {
        if (!cancelled) setSeeds(d.users ?? [])
      })
      .catch((e) => {
        if (!cancelled) setSeedsError(e instanceof Error ? e.message : '拉取失败')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const doLogin = async (userId: string) => {
    setPendingId(userId)
    setError(null)
    try {
      await devLogin(getApiBase(), userId)
      await queryClient.invalidateQueries()
      navigate(from && from !== '/dev-login' ? from : '/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
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
    <div className="px-4 pb-10">
      <header className="pt-8">
        <h1 className="text-title-lg">开发登录</h1>
        <p className="mt-1 inline-block rounded-full bg-[#F5E9E1] px-3 py-1 text-caption text-[#C7692F]">
          仅开发环境 · 生产环境请移除
        </p>
      </header>

      {user ? (
        <div className="mt-4 rounded-card bg-white p-4 shadow-card">
          <p className="text-body">
            当前已登录：<span className="font-semibold">{user.nickname ?? user.id}</span>
          </p>
          <p className="mt-1 text-caption text-ink-secondary">角色：{user.roles.join(' / ')}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/home')}>
              进入首页
            </Button>
            <Button variant="outline" size="sm" onClick={doLogout}>
              退出登录
            </Button>
          </div>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="text-title">选择种子用户登录</h2>
        {seeds === null && seedsError === null ? (
          <ul className="mt-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-14 animate-pulse rounded-card bg-sunken" />
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
                  className="flex w-full items-center justify-between rounded-card bg-white px-4 py-3 text-left shadow-card transition active:scale-[0.99] disabled:opacity-60"
                >
                  <span>
                    <span className="block text-body font-semibold">{u.nickname}</span>
                    <span className="block text-caption text-ink-secondary">{roleLabel(u.roles)}</span>
                  </span>
                  <span className="text-caption text-ink-secondary">
                    {pendingId === u.id ? '登录中…' : '登录 →'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-card bg-red-50 px-4 py-3 text-caption text-red-600">
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
            className="bg-white"
          />
          <Button
            disabled={pendingId !== null || manualId.trim().length === 0}
            onClick={() => void doLogin(manualId.trim())}
            className="bg-[#D98E5F] text-white hover:bg-[#D37D46]"
          >
            登录
          </Button>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-card bg-red-50 px-4 py-3 text-caption text-red-600">{error}</p>
      ) : null}

      <p className="mt-8 text-caption text-ink-secondary">
        提示：dev-login 仅允许种子用户（kimi_id 以 seed_ 前缀），会话 cookie 有效期 7 天。
      </p>
    </div>
  )
}
