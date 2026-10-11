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
 *
 * 画布化（产品-1010 片 3 末片 · 账户域重屏批）：三块入册
 * （privacy.head/switches/footnote），块序/显隐=useCanvasLayout('privacy')
 * （published→注册表默认序尾补，空=默认序兜底常量）；文案键行内可改=CK 点选反查锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。开关写路（setNotifyPref 真调端点
 * 成功才翻转 / 定位 localStorage 偏好）零改动，data-testid 原值全保留。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { CanvasLayoutLoader, CK, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { Switch, useAccountToast } from '../components/account/common'
import { PushBar } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { acc } from '../copy/account'
import { readLastBooking } from '@/lib/bookingPrefill'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const PRIVACY_DEFAULT_ORDER = ['privacy.head', 'privacy.switches', 'privacy.footnote'] as const

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

/** 权限行（题+说明+开关+关闭 hint/注记）。画布批片 3：title/desc/hint/note 放宽
    ReactNode 供 CK 锚；ariaLabel 单列 string（Switch 无障碍标签仍要纯文本） */
function PermissionRow({
  title,
  ariaLabel,
  desc,
  hint,
  note,
  on,
  busy,
  locked = false,
  onToggle,
  testId,
}: {
  title: ReactNode
  /** Switch aria-label 纯文本（=题面 copy 键原值，调用方随行传入） */
  ariaLabel: string
  desc: ReactNode
  hint?: ReactNode
  note?: ReactNode
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
                <CK k="privacy.lockedNote">{acc('privacy.lockedNote')}</CK>
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
          ariaLabel={ariaLabel}
        />
      </div>
      {!locked && !on && hint ? <p className="m2-note mt-2">{hint}</p> : null}
      {locked ? <p className="m2-note mt-2"><CK k="privacy.lockedWhy">{acc('privacy.lockedWhy')}</CK></p> : null}
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
      .filter((b) => b.pageKey === 'privacy')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : PRIVACY_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('privacy', canvasStoreId, registryBlocks)

  /* 块渲染器（块内逻辑零改动——三块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. privacy.head：PushBar 返回条 + m2 大题页头（PushBar label 为 string prop 无 CK 锚） */
    'privacy.head': () => (
      <>
        <PushBar label={acc('privacy.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="privacy.title">{acc('privacy.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. privacy.switches：权限开关组整块（营销可关真写路 + 交易/服务/账户置灰锁态
          + 定位偏好先行；五行原序逐字搬） */
    'privacy.switches': () => (
      <div className="m2-card overflow-hidden">
        <PermissionRow
          title={<CK k="privacy.marketingLabel">{acc('privacy.marketingLabel')}</CK>}
          ariaLabel={acc('privacy.marketingLabel')}
          desc={<CK k="privacy.marketingDesc">{acc('privacy.marketingDesc')}</CK>}
          hint={<CK k="privacy.marketingOffHint">{acc('privacy.marketingOffHint')}</CK>}
          note={marketingOn && unreadCount > 0 ? <CK k="privacy.notifyUnread">{acc('privacy.notifyUnread')}</CK> : undefined}
          on={marketingOn}
          busy={notifyBusy || prefsQ.isPending}
          onToggle={() => void toggleMarketing()}
          testId="privacy-notify-switch"
        />
        {/* 交易/服务/账户=不可关组（置灰 + 锁态注记，不给假开关） */}
        <PermissionRow
          title={<CK k="privacy.tradeLabel">{acc('privacy.tradeLabel')}</CK>}
          ariaLabel={acc('privacy.tradeLabel')}
          desc={<CK k="privacy.tradeDesc">{acc('privacy.tradeDesc')}</CK>}
          on
          busy={false}
          locked
          testId="privacy-trade-switch"
        />
        <PermissionRow
          title={<CK k="privacy.serviceLabel">{acc('privacy.serviceLabel')}</CK>}
          ariaLabel={acc('privacy.serviceLabel')}
          desc={<CK k="privacy.serviceDesc">{acc('privacy.serviceDesc')}</CK>}
          on
          busy={false}
          locked
          testId="privacy-service-switch"
        />
        <PermissionRow
          title={<CK k="privacy.accountLabel">{acc('privacy.accountLabel')}</CK>}
          ariaLabel={acc('privacy.accountLabel')}
          desc={<CK k="privacy.accountDesc">{acc('privacy.accountDesc')}</CK>}
          on
          busy={false}
          locked
          testId="privacy-account-switch"
        />
        <PermissionRow
          title={<CK k="privacy.locationTitle">{acc('privacy.locationTitle')}</CK>}
          ariaLabel={acc('privacy.locationTitle')}
          desc={<CK k="privacy.locationDesc">{acc('privacy.locationDesc')}</CK>}
          hint={<CK k="privacy.locationOffHint">{acc('privacy.locationOffHint')}</CK>}
          note={<CK k="privacy.locationNote">{acc('privacy.locationNote')}</CK>}
          on={locationOn}
          busy={false}
          onToggle={toggleLocation}
          testId="privacy-location-switch"
        />
      </div>
    ),

    /* 3. privacy.footnote：页脚合规注记（个保法最小必要口径） */
    'privacy.footnote': () => (
      <p className="m2-note mt-4 text-center" data-testid="privacy-footnote">
        <CK k="privacy.footnote">{acc('privacy.footnote')}</CK>
      </p>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="privacy" storeId={canvasStoreId}>
      <div className="m2" data-testid="privacy-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="privacy-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：privacy.head=页头裸段置顶（PushBar+大题原在 m2-pad 外，照 MePage 惯例）；
            余块共享 m2-pad 容器——默认序下视觉零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'privacy.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {layout.map((b) =>
            b.visible && b.blockKey !== 'privacy.head' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
        {toastEl}
      </div>
    </CanvasLayoutLoader>
  )
}
