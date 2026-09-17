/**
 * U2 任务 A · 全域 StaffDock（员工端唯一底部导航）
 *
 * 规格书 §0 冻结口径：3 栏「任务台 / 历史 / 我的」，无中央悬浮钮（员工端不是
 * 客户旅程，无 philia 养成入口）；高 78px + 安全区；frontdesk 态首栏文案改
 * 「核销台」、图标改扫码——同一组件，props 仅 active + role。
 * 详情级页面（执行/打卡）不渲染 dock（统一走 PageHeader 返回条）。
 *
 * 工艺：纸面卡底 + 顶部 1px 暖墨 hairline（试样 .sdock）；当前栏墨色 600，
 * 非当前 rgba(74,59,46,.42)；按下 scale 0.92 + duration-120 + ease-philia-spring
 * （动效纲领 §三）；lucide 墨色线图标，禁彩色图标。
 */

import { Link } from 'react-router-dom'
import { CalendarDays, Clock3, ScanLine, UserRound } from 'lucide-react'

export type StaffDockActive = 'today' | 'history' | 'me'
export type StaffDockRole = 'groomer' | 'frontdesk'

export default function StaffDock({ active, role }: { active: StaffDockActive; role: StaffDockRole }) {
  const first =
    role === 'frontdesk'
      ? { to: '/today', label: '核销台', icon: ScanLine, testid: 'dock-checkin' }
      : { to: '/today', label: '任务台', icon: CalendarDays, testid: 'dock-today' }
  const tabs = [
    { ...first, key: 'today' as const },
    { to: '/history', label: '历史', icon: Clock3, key: 'history' as const, testid: 'dock-history' },
    { to: '/me', label: '我的', icon: UserRound, key: 'me' as const, testid: 'dock-me' },
  ]
  return (
    <nav
      data-testid="staff-dock"
      className="fixed inset-x-0 bottom-0 z-tabbar bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgba(74,59,46,.06)]"
    >
      <div className="mx-auto grid h-[78px] w-full max-w-lg grid-cols-3 px-2.5 pb-2.5">
        {tabs.map(({ key, to, label, icon: Icon, testid }) => {
          const on = active === key
          return (
            <Link
              key={key}
              to={to}
              data-testid={testid}
              aria-current={on ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-caption-xs transition-transform duration-120 ease-philia-spring active:scale-92 ${
                on ? 'font-semibold text-ink' : 'font-medium text-[rgba(74,59,46,.42)]'
              }`}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.6} aria-hidden />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
