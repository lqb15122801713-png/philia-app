/**
 * 路由守卫（契约 docs/CLIENT-CONTRACTS.md · T2.0）
 *
 * 包在主内容外（/dev-login 本身除外）：useMe 加载中显示等待态；
 * 未登录（user=null）跳 /dev-login，并带 from 以便登录后回跳。
 *
 * 注意：守卫只是体验层，接口归属校验全部由服务端强制（见 server/src/trpc.ts）。
 */

import { useMe } from '@philia/shared'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useMe()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-caption text-ink-secondary">加载中…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/dev-login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
