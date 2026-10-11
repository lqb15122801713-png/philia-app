/**
 * DevicesPage · /me/settings/devices 登录设备管理（补缺大批片 2 · 账户安全域）
 *
 * 进入页后静默 registerDevice 一次（deviceId=localStorage 'philia_device_id' 持久
 * 指纹，无则 safeUuid() 生成；label=UA 摘要截取 ≤64）→ listDevices 渲染：
 * 当前设备卡（命中本机 deviceId 的标「当前设备」，兜底=lastSeenAt 最新行）+
 * 设备列表 + 换绑记录时间线（phoneChangeLogs：masked 原号→新号 + 渠道签
 * 自助/门店协助 + mono 时刻）；无换绑记录=空态三句话。
 * 客户端体验大批 片 1：顶部加「新设备登录提醒」说明行（security.new_device
 * 事件落消息中心，本页只加说明+链 → /notifications）。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域重屏批）：四块入册
 * （device.head/note/list/logs），块序/显隐=useCanvasLayout('devices')
 * （published→注册表默认序尾补，空=默认序兜底常量）；文案键行内可改=CK 点选反查锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。静默 registerDevice/listDevices
 * 链路零改动，data-testid 原值全保留。
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, safeUuid, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { EmptyC } from '../components/member/v2'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { fmtDateTime } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { acc } from '../copy/account'
import { readLastBooking } from '@/lib/bookingPrefill'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const DEVICE_DEFAULT_ORDER = ['device.head', 'device.note', 'device.list', 'device.logs'] as const

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

  /* 画布批片 3：预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（MePage/MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，nearbyQ 带 enabled 闸仅作布局锚解析，零增发常态查询） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const canvasStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'devices')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : DEVICE_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('devices', canvasStoreId, registryBlocks)

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. device.head：PushBar 返回条 + m2 大题页头（PushBar label 为 string prop 无 CK 锚；
          列表失败重试态文案 device.loadFail 渲染位在 list 块，键归本块草案口径） */
    'device.head': () => (
      <>
        <PushBar label={acc('device.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="device.title">{acc('device.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. device.note：新设备登录提醒条（异常登录透出=security.new_device 事件落消息中心，
          本页只加说明+链 → /notifications） */
    'device.note': () => (
      <div className="m2-card mb-3 flex items-center gap-3 px-4 py-3" data-testid="device-newdevice-note">
        <p className="min-w-0 flex-1 text-caption leading-5 text-ink-secondary"><CK k="device.newDeviceNote">{acc('device.newDeviceNote')}</CK></p>
        <Link to="/notifications" className="flex-none text-caption font-semibold text-ink">
          <CK k="device.newDeviceLink">{acc('device.newDeviceLink')}</CK>
        </Link>
      </div>
    ),

    /* 3. device.list：设备列表（命中本机 deviceId 标「当前设备」，兜底=lastSeenAt 最新行） */
    'device.list': () => (
      <>
        <SecH title={<CK k="device.listTitle">{acc('device.listTitle')}</CK>} />
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
                        {d.label ?? <CK k="device.unnamed">{acc('device.unnamed')}</CK>}
                      </span>
                      {isCurrent ? (
                        <span className="rounded-chip bg-brand-primary px-[7px] py-0.5 text-caption-xs font-semibold text-ink">
                          <CK k="device.current">{acc('device.current')}</CK>
                        </span>
                      ) : null}
                    </div>
                    <div className="m2-mono mt-1 text-[9px] text-ink-secondary">
                      <CK k="device.lastSeen">{acc('device.lastSeen', { time: fmtDateTime(d.lastSeenAt) })}</CK>
                      {' · '}
                      <CK k="device.firstSeen">{acc('device.firstSeen', { time: fmtDateTime(d.firstSeenAt) })}</CK>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>
    ),

    /* 4. device.logs：换绑记录区（masked 原号→新号 + 渠道签 + mono 时刻；无记录=空态
          三句话 EmptyC，string prop 组件内无 CK 锚） */
    'device.logs': () => (
      <>
        <SecH title={<CK k="device.logsTitle">{acc('device.logsTitle')}</CK>} />
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
                      <CK k="device.logLine">{acc('device.logLine', { old: l.oldPhoneMasked, new: l.newPhoneMasked })}</CK>
                    </span>
                    <span className="rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary">
                      {l.channel === 'assisted' ? (
                        <CK k="device.channelAssisted">{acc('device.channelAssisted')}</CK>
                      ) : (
                        <CK k="device.channelSelf">{acc('device.channelSelf')}</CK>
                      )}
                    </span>
                  </div>
                  <div className="m2-mono mt-1 text-[9px] text-ink-secondary">{fmtDateTime(l.at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="devices" storeId={canvasStoreId}>
      <div className="m2" data-testid="devices-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="device-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：device.head=页头裸段置顶（PushBar+大题原在 m2-pad 外，照 MePage 惯例）；
            余块共享 m2-pad 容器——默认序下视觉零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'device.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {layout.map((b) =>
            b.visible && b.blockKey !== 'device.head' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
      </div>
    </CanvasLayoutLoader>
  )
}
