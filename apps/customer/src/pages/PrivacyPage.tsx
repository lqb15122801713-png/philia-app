/**
 * PrivacyPage · /me/settings/privacy 权限与隐私（补缺大批片 2 · 账户安全域）
 *
 * - 通知开关：真链路 trpc.push.subscribe/unsubscribe（clientId=localStorage
 *   'philia.sseClientId' 与 SSE 共用标识；server 无订阅状态查询端点——UI 态以本地
 *   偏好 'philia_pref_notify' 镜像，切换即真调端点，已报备）+ listNotifications
 *   未读存在性提示（真数据）；关闭 hint=预约进度/退款结果请在订单页查看；
 * - 定位开关：localStorage 'philia_pref_location' 偏好（当前版本无定位功能消费点，
 *   说明文案写明「门店距离展示走门店地址，不取您的定位」）；
 * - 个保法口径注脚：拒绝不影响基本功能。
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { safeUuid, useMe, usePhiliaClient } from '@philia/shared'
import { Switch, useAccountToast } from '../components/account/common'
import { PushBar } from '../components/member/v2'
import { acc } from '../copy/account'

const CLIENT_ID_KEY = 'philia.sseClientId'
const PREF_NOTIFY_KEY = 'philia_pref_notify'
const PREF_LOCATION_KEY = 'philia_pref_location'

/** SSE/push 共用 clientId（契约 · 同 live 页口径） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = safeUuid()
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return safeUuid()
  }
}

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

/** 权限行（题+说明+开关+关闭 hint） */
function PermissionRow({
  title,
  desc,
  hint,
  note,
  on,
  busy,
  onToggle,
  testId,
}: {
  title: string
  desc: string
  hint: string
  note?: string
  on: boolean
  busy: boolean
  onToggle: () => void
  testId?: string
}) {
  return (
    <div className="border-t border-line-divider px-4 py-3.5 first:border-t-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold text-ink">{title}</div>
          <div className="mt-0.5 text-caption text-ink-secondary">{desc}</div>
        </div>
        <Switch on={on} onToggle={onToggle} disabled={busy} testId={testId} ariaLabel={title} />
      </div>
      {!on ? <p className="m2-note mt-2">{hint}</p> : null}
      {note ? <p className="m2-note mt-1.5">{note}</p> : null}
    </div>
  )
}

export default function PrivacyPage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useAccountToast()
  const [clientId] = useState(getClientId)
  const [notifyOn, setNotifyOn] = useState(() => readPref(PREF_NOTIFY_KEY, true))
  const [locationOn, setLocationOn] = useState(() => readPref(PREF_LOCATION_KEY, false))
  const [notifyBusy, setNotifyBusy] = useState(false)

  /* 未读通知存在性（真数据）：开启态下提示有未读 */
  const unreadQ = useQuery({
    queryKey: ['push', 'listNotifications', 'unreadPeek'],
    queryFn: () => trpc.push.listNotifications.query({ unreadOnly: true, limit: 20 }),
    enabled: !!user && notifyOn,
    staleTime: 30_000,
  })
  const unreadCount = unreadQ.data?.items.length ?? 0

  /* 通知开关：先真调端点，成功才翻转 UI 态并落本地镜像（R9 操作反馈） */
  const toggleNotify = async () => {
    if (notifyBusy) return
    setNotifyBusy(true)
    const next = !notifyOn
    try {
      if (next) {
        await trpc.push.subscribe.mutate({ clientId, appType: 'customer' })
      } else {
        await trpc.push.unsubscribe.mutate({ clientId })
      }
      setNotifyOn(next)
      writePref(PREF_NOTIFY_KEY, next)
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
            title={acc('privacy.notifyTitle')}
            desc={acc('privacy.notifyDesc')}
            hint={acc('privacy.notifyOffHint')}
            note={notifyOn && unreadCount > 0 ? acc('privacy.notifyUnread') : undefined}
            on={notifyOn}
            busy={notifyBusy}
            onToggle={() => void toggleNotify()}
            testId="privacy-notify-switch"
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
