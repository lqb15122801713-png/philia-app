/**
 * SettingsPage · /me/settings 设置（补缺大批片 2 · 账户安全域入口页）
 *
 * 列表组：账号安全（手机号换绑 › / 换绑申诉 ›）+ 设备与隐私（登录设备管理 › /
 * 权限与隐私 ›）+ 退出登录（LogoutConfirmDialog 既有件移用，逻辑零改动）+
 * 危险操作（注销账号 ›）。
 * 返回=PushBar 时间序回退 navigate(-1)，直访兜底 /me（R1/R20 入口=出口）。
 * 文案全走 copy/account.ts（acc），色值走 token。
 */

import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getApiBase, logout, useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import LogoutConfirmDialog from '../components/account/LogoutConfirmDialog'
import { maskPhone, useAccountToast } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { acc } from '../copy/account'
import { pfc } from '../copy/profile'
import { adc } from '../copy/addresses'
import { itc } from '../copy/invoiceTitles'
import { abc } from '../copy/about'

/** 列表行（链接形/按钮形两用；sub=副签行） */
function Row({
  to,
  onClick,
  title,
  sub,
  testId,
  danger = false,
}: {
  to?: string
  onClick?: () => void
  title: string
  sub?: string
  testId?: string
  danger?: boolean
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className={`text-body font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>{title}</div>
        {sub ? <div className="m2-mono mt-0.5 truncate text-[10px] text-ink-secondary">{sub}</div> : null}
      </div>
      <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
    </>
  )
  const cls = 'flex w-full items-center gap-3 border-t border-line-divider px-4 py-3.5 text-left first:border-t-0'
  if (to) {
    return (
      <Link to={to} className={cls} data-testid={testId}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} data-testid={testId}>
      {inner}
    </button>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <SecH title={title} />
      <div className="m2-card overflow-hidden">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useAccountToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)

  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const phoneMasked = maskPhone(meRawQ.data?.user?.phone ?? null)

  /* 退出登录（自 MePage 移用，逻辑零改动） */
  const doLogout = async () => {
    setLogoutPending(true)
    try {
      await logout(getApiBase())
      queryClient.clear()
      navigate('/dev-login', { replace: true })
    } catch (err) {
      setLogoutPending(false)
      setConfirmOpen(false)
      showToast(err instanceof Error ? err.message : acc('settings.logoutFail'))
    }
  }

  return (
    <div className="m2" data-testid="settings-page" style={{ minHeight: '100vh' }}>
      <PushBar label={acc('settings.pushLabel')} fallback="/me" />
      <div className="m2-apphead">
        <span className="tt">{acc('settings.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 4, paddingBottom: 60 }}>
        {user && meRawQ.isPending ? (
          <LoadingBlock lines={2} />
        ) : meRawQ.isError ? (
          <ErrorState message={acc('settings.loadFail')} onRetry={() => void meRawQ.refetch()} />
        ) : null}

        <div className="flex flex-col gap-1">
          <Group title={acc('settings.groupAccount')}>
            {/* 客户端体验大批 片 1：编辑资料入口（账户体系域） */}
            <Row to="/settings/profile" title={pfc('profile.meEntry')} sub={pfc('profile.meEntrySub')} testId="settings-profile" />
            <Row to="/me/settings/phone" title={acc('settings.phoneBind')} sub={phoneMasked} testId="settings-phone-bind" />
            <Row to="/me/settings/phone/appeal" title={acc('settings.appeal')} sub={acc('settings.appealSub')} testId="settings-appeal" />
          </Group>

          <Group title={acc('settings.groupGeneral')}>
            <Row to="/me/settings/devices" title={acc('settings.devices')} testId="settings-devices" />
            <Row to="/me/settings/privacy" title={acc('settings.privacy')} testId="settings-privacy" />
          </Group>

          {/* 客户端体验大批 片 1：通用组（收货地址 / 发票抬头 / 关于与协议） */}
          <Group title={acc('settings.groupCommon')}>
            <Row to="/settings/addresses" title={adc('addr.title')} testId="settings-addresses" />
            <Row to="/settings/invoice-titles" title={itc('invt.title')} testId="settings-invoice-titles" />
            <Row to="/settings/about" title={abc('about.title')} sub={abc('about.agreementsSub')} testId="settings-about" />
          </Group>

          <div className="m2-card mt-[26px] overflow-hidden">
            <Row
              onClick={() => setConfirmOpen(true)}
              title={acc('settings.logout')}
              sub={acc('settings.logoutSub')}
              testId="settings-logout"
            />
          </div>

          <Group title={acc('settings.groupDanger')}>
            <Row
              to="/me/settings/deactivate"
              title={acc('settings.deactivate')}
              sub={acc('settings.deactivateSub')}
              testId="settings-deactivate"
              danger
            />
          </Group>
        </div>
      </div>

      {confirmOpen ? (
        <LogoutConfirmDialog
          pending={logoutPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void doLogout()}
        />
      ) : null}
      {toastEl}
    </div>
  )
}
