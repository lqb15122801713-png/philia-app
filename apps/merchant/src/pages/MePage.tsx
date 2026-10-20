/**
 * W-我的 店主 /me（PD46 U7 · 商家手机五槽壳第五槽 · 对照 `203:5480`）
 *
 * 结构（figma bro 审计口径＝身份＋经营/账本/系统入口齐）：
 *   身份卡（店名+角色签+登录账号；mono 注行保持 ≥12px）
 *   → 经营 wlist（员工/运营审批/公告/任务模板/排班；canManage）
 *   → 账本 wlist（收银台账/营销台账/薪资/XP 审核；canManage）
 *   → 系统 wlist（权限矩阵/门店设置；运营后台端+三端口 owner-only）
 *
 *  Dock 映射（B10b）：W-12 员工、W-14 权限矩阵、W-16 运营后台激活「我的」槽；
 *  /settings（W-15）激活「门店」槽——本页只是聚合入口，dock 高亮随路由口径。
 *  clerk 直达被 ClerkRouteGuard 拦截给引导页（矩阵总规则②，本片不动权限面）。
 *  零新迁移、零服务端改动；入口全部指向既有路由。
 */

import { useMe, usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import MainScaffold from '@/components/MainScaffold'
import { WList, WPill } from '@/components/skeleton'
import { cc } from '@/copy/console'
import { fullDateLabel, openHoursLabel } from '@/components/dashboard/utils'
import { roleLabelCn, useMerchantRole } from '@/lib/roles'

export default function MePage() {
  const { trpc } = usePhiliaClient()
  const role = useMerchantRole()
  const { user } = useMe()
  const now = new Date()

  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'full'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  })
  const store = meQuery.data?.store

  const opsItems = [
    {
      key: 'staff',
      title: cc('wnav.staff'),
      sub: cc('wme.subStaff'),
      to: '/staff',
    },
    {
      key: 'ops',
      title: cc('wnav.ops'),
      sub: cc('wme.subOps'),
      to: '/ops',
    },
    {
      key: 'announcements',
      title: cc('wme.announcements'),
      sub: cc('wme.subAnnouncements'),
      to: '/settings/announcements',
    },
    {
      key: 'tasks',
      title: cc('wme.tasks'),
      sub: cc('wme.subTasks'),
      to: '/settings/tasks',
    },
    {
      key: 'schedules',
      title: cc('wnav.schedules'),
      sub: cc('wme.subSchedules'),
      to: '/settings/schedules',
    },
  ]

  const bookItems = [
    {
      key: 'ledger',
      title: cc('wme.ledger'),
      sub: cc('wme.subLedger'),
      to: '/ledger',
    },
    {
      key: 'marketing-ledger',
      title: cc('wme.marketingLedger'),
      sub: cc('wme.subMarketingLedger'),
      to: '/marketing-ledger',
    },
    {
      key: 'payroll',
      title: cc('wnav.payroll'),
      sub: cc('wme.subPayroll'),
      to: '/payroll',
    },
    {
      key: 'xp-admin',
      title: cc('wnav.xpAdmin'),
      sub: cc('wme.subXpAdmin'),
      to: '/xp-admin',
    },
  ]

  const systemItems = [
    {
      key: 'matrix',
      title: cc('wnav.matrix'),
      sub: cc('wme.subMatrix'),
      to: '/matrix',
    },
    {
      key: 'settings',
      title: cc('wnav.settings'),
      sub: cc('wme.subSettings'),
      to: '/settings',
    },
    ...(role.isOwner
      ? [
          {
            key: 'console',
            title: cc('wnav.footConsole'),
            sub: cc('wme.subConsole'),
            to: '/console',
          },
          {
            key: 'rules',
            title: cc('wnav.footRules'),
            sub: cc('wme.subPort'),
            to: '/settings/rules',
          },
          {
            key: 'copy',
            title: cc('wme.copyPort'),
            sub: cc('wme.subPort'),
            to: '/settings/copy',
          },
          {
            key: 'slots',
            title: cc('wme.slotPort'),
            sub: cc('wme.subPort'),
            to: '/settings/slots',
          },
        ]
      : []),
  ]

  return (
    <MainScaffold
      title={cc('wme.title')}
      sub={
        <>
          {fullDateLabel(now)} ·{' '}
          <span className="font-number tabular-nums">{openHoursLabel(store?.openHours, now)}</span>
        </>
      }
      testid="me-page"
    >
      <div className="wsk">
        {/* 身份卡：店名 serif + 角色签 + 登录账号（对照 `203:5480` 身份区） */}
        <section className="wsk-card" data-testid="me-identity">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-serif-cn text-[17px] font-bold" data-testid="me-store-name">
                {store?.name ?? '—'}
              </div>
              <div className="mt-1 text-[12px] text-ink-secondary">
                {cc('wme.identityAccount')}：{role.nickname ?? '—'}
              </div>
            </div>
            <WPill tone="hot" testId="me-role-pill">
              {roleLabelCn(user?.roles)}
            </WPill>
          </div>
        </section>

        {role.canManage ? (
          <>
            <div className="mt-3.5">
              <div className="wsk-hd">
                <span className="t">{cc('wme.groupOps')}</span>
                <span className="a">{opsItems.length} 项</span>
              </div>
              <WList items={opsItems} testId="me-ops-list" />
            </div>
            <div className="mt-3.5">
              <div className="wsk-hd">
                <span className="t">{cc('wme.groupBooks')}</span>
                <span className="a">{bookItems.length} 项</span>
              </div>
              <WList items={bookItems} testId="me-books-list" />
            </div>
            <div className="mt-3.5">
              <div className="wsk-hd">
                <span className="t">{cc('wme.groupSystem')}</span>
                <span className="a">{systemItems.length} 项</span>
              </div>
              <WList items={systemItems} testId="me-system-list" />
            </div>
          </>
        ) : null}
      </div>
    </MainScaffold>
  )
}
