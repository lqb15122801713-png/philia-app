/**
 * SettingsPage · /me/settings 设置（补缺大批片 2 · 账户安全域入口页）
 *
 * 列表组：账号安全（手机号换绑 › / 换绑申诉 ›）+ 设备与隐私（登录设备管理 › /
 * 权限与隐私 ›）+ 退出登录（LogoutConfirmDialog 既有件移用，逻辑零改动）+
 * 危险操作（注销账号 ›）。
 * 返回=PushBar 时间序回退 navigate(-1)，直访兜底 /me（R1/R20 入口=出口）。
 * 文案全走 copy/account.ts（acc），色值走 token。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域重屏批）：六块入册
 * （settings.head/groupaccount/groupgeneral/groupcommon/logout/groupdanger），
 * 块序/显隐=useCanvasLayout('settings')（published→注册表默认序尾补，空=默认序兜底常量）；
 * 文案键行内可改=CK 点选反查锚；预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。
 * PushBar 照 MemberCenterPage 惯例入 head 块（页头裸段置顶）；退出确认弹层不入块流。
 * 块内逻辑（auth.me 读态/退出登录链路）零改动，data-testid 原值全保留。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, getApiBase, logout, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import LogoutConfirmDialog from '../components/account/LogoutConfirmDialog'
import { maskPhone, useAccountToast } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { acc } from '../copy/account'
import { pfc } from '../copy/profile'
import { adc } from '../copy/addresses'
import { itc } from '../copy/invoiceTitles'
import { abc } from '../copy/about'
import { readLastBooking } from '@/lib/bookingPrefill'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const SETTINGS_DEFAULT_ORDER = [
  'settings.head',
  'settings.groupaccount',
  'settings.groupgeneral',
  'settings.groupcommon',
  'settings.logout',
  'settings.groupdanger',
] as const

/** 列表行（链接形/按钮形两用；sub=副签行）。画布批片 3：title/sub 放宽 ReactNode 供 CK 锚 */
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
  title: ReactNode
  sub?: ReactNode
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

function Group({ title, children }: { title: ReactNode; children: ReactNode }) {
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
      .filter((b) => b.pageKey === 'settings')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : SETTINGS_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('settings', canvasStoreId, registryBlocks)

  /* 块渲染器（块内逻辑零改动——六块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. settings.head：PushBar 返回条 + m2 大题页头（PushBar label 为 string prop 无 CK 锚） */
    'settings.head': () => (
      <>
        <PushBar label={acc('settings.pushLabel')} fallback="/me" />
        <div className="m2-apphead">
          <span className="tt"><CK k="settings.title">{acc('settings.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. settings.groupaccount：账号安全组（编辑资料/手机号换绑/换绑申诉） */
    'settings.groupaccount': () => (
      <Group title={<CK k="settings.groupAccount">{acc('settings.groupAccount')}</CK>}>
        {/* 客户端体验大批 片 1：编辑资料入口（账户体系域） */}
        <Row
          to="/settings/profile"
          title={<CK k="profile.meEntry">{pfc('profile.meEntry')}</CK>}
          sub={<CK k="profile.meEntrySub">{pfc('profile.meEntrySub')}</CK>}
          testId="settings-profile"
        />
        <Row
          to="/me/settings/phone"
          title={<CK k="settings.phoneBind">{acc('settings.phoneBind')}</CK>}
          sub={phoneMasked}
          testId="settings-phone-bind"
        />
        <Row
          to="/me/settings/phone/appeal"
          title={<CK k="settings.appeal">{acc('settings.appeal')}</CK>}
          sub={<CK k="settings.appealSub">{acc('settings.appealSub')}</CK>}
          testId="settings-appeal"
        />
      </Group>
    ),

    /* 3. settings.groupgeneral：设备与隐私组（登录设备管理/权限与隐私） */
    'settings.groupgeneral': () => (
      <Group title={<CK k="settings.groupGeneral">{acc('settings.groupGeneral')}</CK>}>
        <Row to="/me/settings/devices" title={<CK k="settings.devices">{acc('settings.devices')}</CK>} testId="settings-devices" />
        <Row to="/me/settings/privacy" title={<CK k="settings.privacy">{acc('settings.privacy')}</CK>} testId="settings-privacy" />
      </Group>
    ),

    /* 4. settings.groupcommon：通用组（收货地址/发票抬头/关于与协议；客户端体验大批 片 1） */
    'settings.groupcommon': () => (
      <Group title={<CK k="settings.groupCommon">{acc('settings.groupCommon')}</CK>}>
        <Row to="/settings/addresses" title={<CK k="addr.title">{adc('addr.title')}</CK>} testId="settings-addresses" />
        <Row to="/settings/invoice-titles" title={<CK k="invt.title">{itc('invt.title')}</CK>} testId="settings-invoice-titles" />
        <Row
          to="/settings/about"
          title={<CK k="about.title">{abc('about.title')}</CK>}
          sub={<CK k="about.agreementsSub">{abc('about.agreementsSub')}</CK>}
          testId="settings-about"
        />
      </Group>
    ),

    /* 5. settings.logout：退出登录卡（确认弹层 LogoutConfirmDialog 不入块流，页尾挂载） */
    'settings.logout': () => (
      <div className="m2-card mt-[26px] overflow-hidden">
        <Row
          onClick={() => setConfirmOpen(true)}
          title={<CK k="settings.logout">{acc('settings.logout')}</CK>}
          sub={<CK k="settings.logoutSub">{acc('settings.logoutSub')}</CK>}
          testId="settings-logout"
        />
      </div>
    ),

    /* 6. settings.groupdanger：危险操作组（注销账号 ›） */
    'settings.groupdanger': () => (
      <Group title={<CK k="settings.groupDanger">{acc('settings.groupDanger')}</CK>}>
        <Row
          to="/me/settings/deactivate"
          title={<CK k="settings.deactivate">{acc('settings.deactivate')}</CK>}
          sub={<CK k="settings.deactivateSub">{acc('settings.deactivateSub')}</CK>}
          testId="settings-deactivate"
          danger
        />
      </Group>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="settings" storeId={canvasStoreId}>
      <div className="m2" data-testid="settings-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="settings-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：settings.head=页头裸段置顶（PushBar+大题原在 m2-pad 外，照 MePage 惯例）；
            余块共享 m2-pad 容器内 flex gap-1（改造前组间节奏）——默认序下视觉零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'settings.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 4, paddingBottom: 60 }}>
          {user && meRawQ.isPending ? (
            <LoadingBlock lines={2} />
          ) : meRawQ.isError ? (
            <ErrorState message={acc('settings.loadFail')} onRetry={() => void meRawQ.refetch()} />
          ) : null}

          <div className="flex flex-col gap-1">
            {layout.map((b) =>
              b.visible && b.blockKey !== 'settings.head' ? (
                <section data-block-key={b.blockKey} key={b.blockKey}>
                  {renderers[b.blockKey]?.() ?? null}
                </section>
              ) : null,
            )}
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
    </CanvasLayoutLoader>
  )
}
