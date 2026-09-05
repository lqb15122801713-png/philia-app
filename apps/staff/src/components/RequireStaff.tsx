/**
 * 员工端路由守卫（契约 docs/STAFF-CONTRACTS.md · T3.1，参照 apps/customer RequireAuth 改造）
 *
 * 包在主内容外（/dev-login 本身除外）：
 * - useMe 加载中显示等待态；
 * - 未登录（user=null）跳 /dev-login，并带 from 以便登录后回跳；
 * - 已登录但 roles 不含 staff → 员工身份引导页（提示换用员工账号登录，非报错页）。
 *
 * 注意：守卫只是体验层，接口归属校验全部由服务端强制（staffProcedure，见 server/src/trpc.ts）。
 */

import { useMe } from '@philia/shared'
import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

export default function RequireStaff({ children }: { children: ReactNode }) {
  const { user, loading } = useMe()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-body-lg text-ink-secondary">加载中…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/dev-login" replace state={{ from: location.pathname }} />
  }

  if (!user.roles.includes('staff')) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary-light text-3xl">
          🐾
        </span>
        <h1 className="mt-4 text-title-lg">需要员工账号</h1>
        <p className="mt-2 text-body-lg text-ink-secondary">
          当前账号「{user.nickname ?? user.id}」不是员工身份。
          <br />
          员工端仅供门店洗护师 / 美容师使用，请改用员工账号登录。
        </p>
        <button
          type="button"
          onClick={() => navigate('/dev-login', { replace: true })}
          className="mt-6 h-14 min-w-[200px] rounded-full bg-brand-primary px-8 text-body-lg font-semibold text-white transition active:scale-92 duration-120"
        >
          去切换账号
        </button>
      </div>
    )
  }

  return <>{children}</>
}
