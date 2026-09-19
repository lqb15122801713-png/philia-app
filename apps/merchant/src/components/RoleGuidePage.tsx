/**
 * 非授权角色引导页（批次 M1-补2 · 矩阵总规则：非授权角色进入=明确引导页，非 403 白屏）
 *
 * 用途：clerk 直达收银台以外的路由时渲染（App.tsx ClerkRouteGuard 统一分流）；
 * 文案由 clerkGuideText(pathname) 按页定制（日结/流水/总览/财务各有专属说法）。
 */

import { PawPrint, Calculator } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function RoleGuidePage({ title, hint }: { title: string; hint: string }) {
  const navigate = useNavigate()
  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center"
      data-testid="role-guide-page"
    >
      {/* emoji 禁令口径（RequireMerchant 先例）：lucide 墨色线图标 + 沉底暖圆 */}
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-oak-light">
        <PawPrint className="h-7 w-7 text-ink" strokeWidth={1.6} />
      </span>
      <h1 className="mt-4 text-title-lg">{title}</h1>
      <p className="mt-2 text-body-sm text-ink-secondary">{hint}</p>
      <button
        type="button"
        data-testid="role-guide-back-cashier"
        onClick={() => navigate('/cashier', { replace: true })}
        className="mt-6 inline-flex h-12 min-w-[200px] items-center justify-center gap-1.5 rounded-full bg-brand-primary px-8 text-body-sm font-semibold text-ink transition active:scale-92 duration-120"
      >
        <Calculator size={15} strokeWidth={1.8} aria-hidden />
        回到收银台
      </button>
    </div>
  )
}
