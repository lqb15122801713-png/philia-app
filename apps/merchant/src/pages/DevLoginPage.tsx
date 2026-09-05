/**
 * 商家端开发登录页（契约 docs/MERCHANT-CONTRACTS.md · T4.1）—— 路由 /dev-login
 *
 * ⚠️ 仅开发环境：Kimi 登录是线上平台能力，本地用 dev-login 适配
 * （服务端仅允许种子用户，见 server/src/auth/devLogin.ts）。
 *
 * 照搬 apps/staff/src/pages/DevLoginPage.tsx 改造：
 * - 只列店主种子用户（客户/员工请去对应端登录；ID 抄自当前 server/data/philia.db
 *   种子数据，重跑 db:seed 后 ULID 会重新生成，届时用底部「手动输入 userId」）。
 * - 点击调 devLogin(baseUrl, userId) → 失效全部查询缓存 → 跳回 from 或 /dashboard。
 */

import { devLogin, getApiBase, logout, useMe, usePhiliaClient } from '@philia/shared'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SeedUser {
  userId: string
  nickname: string
  roleLabel: string
}

// 店主种子用户（与 server/src/db/seed.ts 对应；ID 为当前开发库实际值，重跑 seed 后会变）
const SEED_USERS: SeedUser[] = [
  { userId: '01M1RH3FFM815Q3QJNRZ4MD1NH', nickname: '菲丽亚店主', roleLabel: '店主 · merchant_owner' },
]

export default function DevLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const { queryClient } = usePhiliaClient()
  const { user, refetch } = useMe()

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [manualId, setManualId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const doLogin = async (userId: string) => {
    setPendingId(userId)
    setError(null)
    try {
      await devLogin(getApiBase(), userId)
      await queryClient.invalidateQueries()
      navigate(from && from !== '/dev-login' ? from : '/dashboard', { replace: true })
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
        <ul className="mt-3 space-y-2">
          {SEED_USERS.map((u) => (
            <li key={u.userId}>
              <button
                type="button"
                disabled={pendingId !== null}
                onClick={() => void doLogin(u.userId)}
                className="flex min-h-14 w-full items-center justify-between rounded-card bg-card px-4 py-3 text-left shadow-card transition active:scale-[0.99] disabled:opacity-60"
              >
                <span>
                  <span className="block text-body font-semibold">{u.nickname}</span>
                  <span className="block text-caption text-ink-secondary">{u.roleLabel}</span>
                </span>
                <span className="text-body text-ink-secondary">
                  {pendingId === u.userId ? '登录中…' : '登录 →'}
                </span>
              </button>
            </li>
          ))}
        </ul>
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
