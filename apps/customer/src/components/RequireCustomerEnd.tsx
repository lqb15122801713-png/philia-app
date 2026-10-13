/* D-39（PD-19 home 错端加闸 · 老板 10-13 裁死）：客户端 /home 路由层角色闸——
 * staff/merchant（及等价错端角色）会话访问 /home 时不得渲染宠友业务壳；
 * 人话明示错端 + 正确出路（员工端/商家端链接，判定与端口映射=lib/endGate 单源，
 * 文案复用 D-36 出口卡 devlogin.end* 键，零新键）。customer 会话零误拦照放。
 * 入口集合摸点：/ → /home、路由表兜底 * → /home 均汇入本闸，闸 /home 一处即最小充分。
 * 非目标照令：不做全站 RBAC／菜单级／API 鉴权大改（另案）。 */

import { useMe } from '@philia/shared'
import type { ReactNode } from 'react'
import { dc } from '@/copy/devlogin'
import { endTargetUrlFor, resolveEndTarget } from '@/lib/endGate'

export default function RequireCustomerEnd({ children }: { children: ReactNode }) {
  const { user, loading } = useMe()
  /* 加载中/无会话=让位（RequireAuth 外层已兜加载态与登录跳转；本闸只管错端） */
  const wrongEnd = user ? resolveEndTarget(user.roles ?? []) : null
  if (loading || !user || !wrongEnd) return <>{children}</>

  const url = endTargetUrlFor(wrongEnd)
  return (
    <div className="px-4 py-10" data-testid="home-wrong-end-gate">
      <section className="u1-card p-5" aria-label="按角色落端提示">
        <p className="text-body font-semibold">
          {dc(wrongEnd === 'staff' ? 'devlogin.endStaffTitle' : 'devlogin.endMerchantTitle')}
        </p>
        <p className="mt-2 text-body-sm text-ink-secondary">
          {dc(wrongEnd === 'staff' ? 'devlogin.endStaffBody' : 'devlogin.endMerchantBody')}
        </p>
        <a
          href={url}
          data-testid="home-wrong-end-link"
          className="mt-3 inline-block text-body-sm font-semibold text-ink-secondary underline underline-offset-2"
        >
          {dc(wrongEnd === 'staff' ? 'devlogin.endLinkStaff' : 'devlogin.endLinkMerchant')}
        </a>
      </section>
    </div>
  )
}
