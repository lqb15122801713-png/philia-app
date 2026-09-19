/**
 * 商家端路由守卫（契约 docs/MERCHANT-CONTRACTS.md · T4.1，照搬 apps/staff RequireStaff 改造）
 *
 * 包在主内容外（/dev-login 本身除外）：
 * - useMe 加载中显示等待态；
 * - 未登录（user=null）跳 /dev-login，并带 from 以便登录后回跳；
 * - 已登录但 roles 不含 merchant_owner / merchant_manager → 商家身份引导页
 *   （提示换用商家账号登录，非报错页）。
 *
 * 注意：守卫只是体验层，接口归属校验全部由服务端强制（merchantProcedure，见 server/src/trpc.ts）。
 */

import { useMe } from '@philia/shared'
import { PawPrint } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

export default function RequireMerchant({ children }: { children: ReactNode }) {
  const { user, loading } = useMe()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-body-sm text-ink-secondary">加载中…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/dev-login" replace state={{ from: location.pathname }} />
  }

  const isMerchant =
    user.roles.includes('merchant_owner') ||
    user.roles.includes('merchant_manager') ||
    user.roles.includes('merchant_clerk')

  if (!isMerchant) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        {/* emoji 禁令口径（员工端 E-46 先例）：lucide 墨色线图标 + 沉底暖圆 */}
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-oak-light">
          <PawPrint className="h-7 w-7 text-ink" strokeWidth={1.6} />
        </span>
        <h1 className="mt-4 text-title-lg">需要商家账号</h1>
        <p className="mt-2 text-body-sm text-ink-secondary">
          当前账号「{user.nickname ?? user.id}」不是商家身份。
          <br />
          商家端仅供门店店主 / 店长 / 店员使用，请改用商家账号登录。
        </p>
        <button
          type="button"
          onClick={() => navigate('/dev-login', { replace: true })}
          className="mt-6 h-12 min-w-[200px] rounded-full bg-brand-primary px-8 text-body-sm font-semibold text-ink transition active:scale-92 duration-120"
        >
          去切换账号
        </button>
      </div>
    )
  }

  return <>{children}</>
}
