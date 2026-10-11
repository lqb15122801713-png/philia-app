/**
 * NotifyPrefsPage · /notifications/prefs 订阅管理（补缺大批片 5 片 5 · 新路由已申报
 * check-nav-closure/smoke-routes，锚点=「订阅管理」）
 *
 * 数据源=trpc.push.notifyPrefs / setNotifyPref（真链路，R10 零假开关）：
 * - 营销卡（活动与优惠）=唯一可关类：Switch 直写 setNotifyPref，off/onToast 真回执；
 * - 不可关组（交易/服务/账户）=描述行+锁态图标+「不可关闭」注记——不给假开关
 *   （server 硬口径：写 0 硬拒「交易/服务/账户通知为保障服务履约不可关闭」）；
 * - prefsHint 明示文案卡置顶；返回=navigate(-1)+fallback=/notifications。
 *
 * 画布化（产品-1010 画布全屏批 片 3 · 会员域扫尾）：三块入册（ntp.hint/ntp.marketing/
 * ntp.mandatory），块序/显隐=useCanvasLayout('notifyPrefs')（published→注册表默认序
 * 尾补，空=NTP_DEFAULT_ORDER 兜底）；文案键挂 CK(data-copy-key) 点选反查锚
 * （PageHeader 页题/aria-label 与 toast 为 string props 挂不上锚，如实入册注记）；
 * ?canvasPreview=1 探针=水印注记行（mc.canvasExampleNote）；店锚=?canvasStore= 预览店锚 >
 * 记忆门店 > 就近首店（MePage 同口径）。加载/错误态随 ntp.marketing 块位渲染（改造前
 * 骨架/重试即在双卡位）；块内逻辑/开关链路零改动，data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { Bell, Lock } from 'lucide-react'
import { CanvasLayoutLoader, CK, useCanvasLayout, useMe, usePhiliaClient, useToast } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { ErrorState, LoadingBlock } from '@/components/home/common'
import { Switch } from '@/components/ui/switch'
import { mc } from '../components/member/copy'
import { ntf } from '@/copy/notify'
import { readLastBooking } from '@/lib/bookingPrefill'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const NTP_DEFAULT_ORDER = ['ntp.hint', 'ntp.marketing', 'ntp.mandatory'] as const

export default function NotifyPrefsPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useToast({ durationMs: 2500 })

  const prefsQ = useQuery({
    queryKey: ['push', 'notifyPrefs'],
    queryFn: () => trpc.push.notifyPrefs.query(),
    enabled: !!user,
  })

  const setPrefM = useMutation({
    mutationFn: (enabled: boolean) => trpc.push.setNotifyPref.mutate({ category: 'marketing', enabled }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['push', 'notifyPrefs'] })
      showToast(r.enabled ? ntf('ntf.onToast') : ntf('ntf.offToast'))
    },
  })

  const marketing = prefsQ.data?.prefs.find((p) => p.category === 'marketing')

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（MePage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const ntpStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'notifyPrefs')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : NTP_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('notifyPrefs', ntpStoreId, registryBlocks)

  /* ---- 三块渲染器（块内逻辑与改造前逐字一致；文案键挂 CK 点选反查锚） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. ntp.hint：明示文案卡置顶（硬口径上墙：营销可关，交易/服务/账户为履约保障不可关） */
    'ntp.hint': () => (
      <p className="mt-4 rounded-card bg-sunken px-4 py-3 text-caption leading-5 text-ink-secondary">
        <CK k="ntf.prefsHint">{ntf('ntf.prefsHint')}</CK>
      </p>
    ),

    /* 2. ntp.marketing：营销卡=唯一可关类（真链路 Switch）；加载/错误态随本块位渲染 */
    'ntp.marketing': () =>
      prefsQ.isPending ? (
        <div className="mt-3">
          <LoadingBlock lines={2} />
        </div>
      ) : prefsQ.isError ? (
        <div className="mt-3">
          <ErrorState message={ntf('ntf.loadFail')} onRetry={() => void prefsQ.refetch()} />
        </div>
      ) : (
        <div
          className="mt-3 flex items-center gap-3 rounded-card bg-card p-4 shadow-card"
          data-testid="notify-pref-marketing"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-brand-secondary" aria-hidden="true">
            <Bell className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold"><CK k="ntf.marketingLabel">{ntf('ntf.marketingLabel')}</CK></p>
            <p className="mt-0.5 text-caption text-ink-secondary"><CK k="ntf.marketingDesc">{ntf('ntf.marketingDesc')}</CK></p>
          </div>
          <Switch
            data-testid="notify-pref-marketing-switch"
            checked={marketing?.enabled ?? true}
            disabled={setPrefM.isPending}
            onCheckedChange={(checked) => setPrefM.mutate(checked)}
            aria-label={ntf('ntf.marketingLabel')}
          />
        </div>
      ),

    /* 3. ntp.mandatory：不可关组=交易/服务/账户——描述行+锁态+注记，不给假开关（R10） */
    'ntp.mandatory': () =>
      prefsQ.isPending || prefsQ.isError ? null : (
        <div
          className="mt-2.5 flex items-center gap-3 rounded-card bg-card p-4 shadow-card"
          data-testid="notify-pref-mandatory"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-secondary" aria-hidden="true">
            <Lock className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-body font-semibold"><CK k="ntf.mandatoryLabel">{ntf('ntf.mandatoryLabel')}</CK></p>
              <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-caption-xs text-ink-secondary">
                <CK k="ntf.mandatoryNote">{ntf('ntf.mandatoryNote')}</CK>
              </span>
            </div>
            <p className="mt-0.5 text-caption text-ink-secondary"><CK k="ntf.mandatoryDesc">{ntf('ntf.mandatoryDesc')}</CK></p>
          </div>
        </div>
      ),
  }

  return (
    <CanvasLayoutLoader pageKey="notifyPrefs" storeId={ntpStoreId}>
      <div className="px-4 py-6" data-testid="notify-prefs-page">
        {/* 返回=时间序回退，fallback=/notifications；页头不入块册置块流外 */}
        <PageHeader title={ntf('ntf.prefsTitle')} fallback="/notifications" />

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p
            className="mt-2 text-center text-caption-xs text-ink-secondary"
            data-testid="notify-prefs-canvas-preview-note"
          >
            {mc('mc.canvasExampleNote')}
          </p>
        ) : null}

        {/* 块流：三块按有效布局渲染（published 覆盖∪默认序尾补）；默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        {toastEl}
      </div>
    </CanvasLayoutLoader>
  )
}
