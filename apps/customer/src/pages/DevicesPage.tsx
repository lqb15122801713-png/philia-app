/**
 * DevicesPage · /me/settings/devices 登录设备管理（补缺大批片 2 · 账户安全域）
 *
 * 进入页后静默 registerDevice 一次（deviceId=localStorage 'philia_device_id' 持久
 * 指纹，无则 safeUuid() 生成；label=UA 摘要截取 ≤64）→ listDevices 渲染：
 * 当前设备卡（命中本机 deviceId 的标「当前设备」，兜底=lastSeenAt 最新行）+
 * 设备列表 + 换绑记录时间线（phoneChangeLogs：masked 原号→新号 + 渠道签
 * 自助/门店协助 + mono 时刻）；无换绑记录=空态三句话。
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { safeUuid, useMe, usePhiliaClient } from '@philia/shared'
import { EmptyC } from '../components/member/v2'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { fmtDateTime } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { acc } from '../copy/account'

const DEVICE_ID_KEY = 'philia_device_id'

/** 本机设备指纹：localStorage 持久（无则生成） */
function getDeviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = safeUuid()
      window.localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return safeUuid()
  }
}

/** UA 摘要 → 设备备注名（≤64 字符，如「Chrome · Windows」） */
function uaLabel(): string {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Safari\//.test(ua)
        ? 'Safari'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : 'WebView'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return `${browser}${os ? ` · ${os}` : ''}`.slice(0, 64)
}

export default function DevicesPage() {
  const navigate = useNavigate()
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const [deviceId] = useState(getDeviceId)
  const registeredRef = useRef(false)

  const listQ = useQuery({
    queryKey: ['authSecurity', 'listDevices'],
    queryFn: () => trpc.authSecurity.listDevices.query(),
    enabled: !!user,
  })

  /* 登录后静默登记一次（成功后刷新列表把 lastSeenAt 顶到最新） */
  useEffect(() => {
    if (!user || registeredRef.current) return
    registeredRef.current = true
    trpc.authSecurity.registerDevice
      .mutate({ deviceId, label: uaLabel() })
      .then(() => void listQ.refetch())
      .catch(() => {
        /* 登记失败不阻断查看（列表仍可读），下回进页重试 */
        registeredRef.current = false
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trpc, deviceId, user])

  const devices = listQ.data?.devices ?? []
  const logs = listQ.data?.phoneChangeLogs ?? []
  const currentId = devices.find((d) => d.deviceId === deviceId)?.id ?? devices[0]?.id ?? null

  return (
    <div className="m2" data-testid="devices-page" style={{ minHeight: '100vh' }}>
      <PushBar label={acc('device.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{acc('device.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        <SecH title={acc('device.listTitle')} />
        {listQ.isPending ? (
          <LoadingBlock lines={3} />
        ) : listQ.isError ? (
          <ErrorState
            message={`${acc('device.loadFail')}${listQ.error instanceof Error ? `（${listQ.error.message}）` : ''}`}
            onRetry={() => void listQ.refetch()}
          />
        ) : (
          <div className="m2-card" style={{ padding: '4px 16px' }}>
            {devices.map((d) => {
              const isCurrent = d.id === currentId
              return (
                <div key={d.id} className="m2-rowx" data-testid={isCurrent ? 'device-current' : 'device-row'}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-bold text-ink">
                        {d.label ?? acc('device.unnamed')}
                      </span>
                      {isCurrent ? (
                        <span className="rounded-chip bg-brand-primary px-[7px] py-0.5 text-caption-xs font-semibold text-ink">
                          {acc('device.current')}
                        </span>
                      ) : null}
                    </div>
                    <div className="m2-mono mt-1 text-[9px] text-ink-secondary">
                      {acc('device.lastSeen', { time: fmtDateTime(d.lastSeenAt) })} ·{' '}
                      {acc('device.firstSeen', { time: fmtDateTime(d.firstSeenAt) })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <SecH title={acc('device.logsTitle')} />
        {listQ.isPending ? null : logs.length === 0 ? (
          /* 空态三句话：题（是什么）/ 说明（为什么）/ 出口（去哪） */
          <EmptyC
            title={acc('device.emptyTitle')}
            desc={acc('device.emptyBody')}
            ctaText={acc('device.emptyCta')}
            onCta={() => navigate('/me/settings')}
          />
        ) : (
          <div className="m2-card" style={{ padding: '4px 16px' }}>
            {logs.map((l) => (
              <div key={l.id} className="m2-rowx" data-testid="device-log-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="m2-mono text-[12px] font-bold text-ink">
                      {acc('device.logLine', { old: l.oldPhoneMasked, new: l.newPhoneMasked })}
                    </span>
                    <span className="rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary">
                      {l.channel === 'assisted' ? acc('device.channelAssisted') : acc('device.channelSelf')}
                    </span>
                  </div>
                  <div className="m2-mono mt-1 text-[9px] text-ink-secondary">{fmtDateTime(l.at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
