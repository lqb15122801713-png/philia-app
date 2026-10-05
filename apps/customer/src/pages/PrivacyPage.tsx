/**
 * PrivacyPage · /me/settings/privacy 权限与隐私（补缺大批片 2 · 账户安全域；
 * 客户端体验大批 片 1 修两截）
 *
 * - 通知开关（修截①）：改读 trpc.push.notifyPrefs 真值（去本地镜像 'philia_pref_notify'），
 *   写走 setNotifyPref——仅 marketing 可关；交易/服务/账户三行置灰 +「不可关闭」注记
 *   （写死口径与 e2e 54.4 断言同源：交易/服务/账户通知为保障服务履约不可关闭）；
 *   未读存在性提示保留（listNotifications 真数据）。
 * - 定位开关（修截②）：localStorage 'philia_pref_location' client 偏好持久化保留；
 *   消费点诚实注记=「当前定位消费点=附近门店距离展示」（客户端现无距离行消费点，
 *   门店展示走门店地址不取定位——开关先行落偏好，点亮即生效，不造假）。
 * - 个保法口径注脚：拒绝不影响基本功能。
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useMe, usePhiliaClient } from '@philia/shared'
import { Switch, useAccountToast } from '../components/account/common'
import { PushBar } from '../components/member/v2'
import { acc } from '../copy/account'

const PREF_LOCATION_KEY = 'philia_pref_location'

function readPref(key: string, dft: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key)
    return v === null ? dft : v === '1'
  } catch {
    return dft
  }
}
function writePref(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* 隐私模式等写失败：UI 态仍生效，下次进页回默认 */
  }
}

/** 权限行（题+说明+开关+关闭 hint/注记） */
function PermissionRow({
  title,
  desc,
  hint,
  note,
  on,
  busy,
  locked = false,
  onToggle,
  testId,
}: {
  title: string
  desc: string
  hint?: string
  note?: string
  on: boolean
  busy: boolean
  /** 置灰锁定行（不可关闭类）：开关恒开 + 锁态注记，不给假开关写路 */
  locked?: boolean
  onToggle?: () => void
  testId?: string
}) {
  return (
    <div className="border-t border-line-divider px-4 py-3.5 first:border-t-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold text-ink">{title}</span>
            {locked ? (
              <span className="shrink-0 rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary">
                {acc('privacy.lockedNote')}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-caption text-ink-secondary">{desc}</div>
        </div>
        <Switch
          on={locked ? true : on}
          onToggle={onToggle ?? (() => {})}
          disabled={busy || locked}
          testId={testId}
          ariaLabel={title}
        />
      </div>
      {!locked && !on && hint ? <p className="m2-note mt-2">{hint}</p> : null}
      {locked ? <p className="m2-note mt-2">{acc('privacy.lockedWhy')}</p> : null}
      {note ? <p className="m2-note mt-1.5">{note}</p> : null}
    </div>
  )
}

export default function PrivacyPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useAccountToast()
  const [locationOn, setLocationOn] = useState(() => readPref(PREF_LOCATION_KEY, false))
  const [notifyBusy, setNotifyBusy] = useState(false)

  /* 通知四类真值（server 缺省全 1；mutable 仅 marketing=true） */
  const prefsQ = useQuery({
    queryKey: ['push', 'notifyPrefs'],
    queryFn: () => trpc.push.notifyPrefs.query(),
    enabled: !!user,
  })
  const prefOf = (cat: string) => prefsQ.data?.prefs.find((p) => p.category === cat)
  const marketingOn = prefOf('marketing')?.enabled ?? true

  /* 未读通知存在性（真数据）：营销开启态下提示有未读 */
  const unreadQ = useQuery({
    queryKey: ['push', 'listNotifications', 'unreadPeek'],
    queryFn: () => trpc.push.listNotifications.query({ unreadOnly: true, limit: 20 }),
    enabled: !!user && marketingOn,
    staleTime: 30_000,
  })
  const unreadCount = unreadQ.data?.items.length ?? 0

  /* 营销开关：先真调端点，成功才翻转（失败原文 toast——含 54.4 硬拒明文同源口径） */
  const toggleMarketing = async () => {
    if (notifyBusy) return
    setNotifyBusy(true)
    try {
      await trpc.push.setNotifyPref.mutate({ category: 'marketing', enabled: !marketingOn })
      await queryClient.invalidateQueries({ queryKey: ['push', 'notifyPrefs'] })
    } catch (err) {
      showToast(err instanceof Error ? err.message : acc('privacy.toggleFail'))
    } finally {
      setNotifyBusy(false)
    }
  }

  const toggleLocation = () => {
    const next = !locationOn
    setLocationOn(next)
    writePref(PREF_LOCATION_KEY, next)
  }

  return (
    <div className="m2" data-testid="privacy-page" style={{ minHeight: '100vh' }}>
      <PushBar label={acc('privacy.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{acc('privacy.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        <div className="m2-card overflow-hidden">
          <PermissionRow
            title={acc('privacy.marketingLabel')}
            desc={acc('privacy.marketingDesc')}
            hint={acc('privacy.marketingOffHint')}
            note={marketingOn && unreadCount > 0 ? acc('privacy.notifyUnread') : undefined}
            on={marketingOn}
            busy={notifyBusy || prefsQ.isPending}
            onToggle={() => void toggleMarketing()}
            testId="privacy-notify-switch"
          />
          {/* 交易/服务/账户=不可关组（置灰 + 锁态注记，不给假开关） */}
          <PermissionRow
            title={acc('privacy.tradeLabel')}
            desc={acc('privacy.tradeDesc')}
            on
            busy={false}
            locked
            testId="privacy-trade-switch"
          />
          <PermissionRow
            title={acc('privacy.serviceLabel')}
            desc={acc('privacy.serviceDesc')}
            on
            busy={false}
            locked
            testId="privacy-service-switch"
          />
          <PermissionRow
            title={acc('privacy.accountLabel')}
            desc={acc('privacy.accountDesc')}
            on
            busy={false}
            locked
            testId="privacy-account-switch"
          />
          <PermissionRow
            title={acc('privacy.locationTitle')}
            desc={acc('privacy.locationDesc')}
            hint={acc('privacy.locationOffHint')}
            note={acc('privacy.locationNote')}
            on={locationOn}
            busy={false}
            onToggle={toggleLocation}
            testId="privacy-location-switch"
          />
        </div>

        <p className="m2-note mt-4 text-center" data-testid="privacy-footnote">
          {acc('privacy.footnote')}
        </p>
      </div>
      {toastEl}
    </div>
  )
}
