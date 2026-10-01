/**
 * NotifyPrefsPage · /notifications/prefs 订阅管理（补缺大批片 5 片 5 · 新路由已申报
 * check-nav-closure/smoke-routes，锚点=「订阅管理」）
 *
 * 数据源=trpc.push.notifyPrefs / setNotifyPref（真链路，R10 零假开关）：
 * - 营销卡（活动与优惠）=唯一可关类：Switch 直写 setNotifyPref，off/onToast 真回执；
 * - 不可关组（交易/服务/账户）=描述行+锁态图标+「不可关闭」注记——不给假开关
 *   （server 硬口径：写 0 硬拒「交易/服务/账户通知为保障服务履约不可关闭」）；
 * - prefsHint 明示文案卡置顶；返回=navigate(-1)+fallback=/notifications。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { Bell, Lock } from 'lucide-react'
import { useMe, usePhiliaClient, useToast } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { ErrorState, LoadingBlock } from '@/components/home/common'
import { Switch } from '@/components/ui/switch'
import { ntf } from '@/copy/notify'

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

  return (
    <div className="px-4 py-6" data-testid="notify-prefs-page">
      <PageHeader title={ntf('ntf.prefsTitle')} fallback="/notifications" />

      {/* 明示文案卡（硬口径上墙：营销可关，交易/服务/账户为履约保障不可关） */}
      <p className="mt-4 rounded-card bg-sunken px-4 py-3 text-caption leading-5 text-ink-secondary">
        {ntf('ntf.prefsHint')}
      </p>

      <div className="mt-3">
        {prefsQ.isPending ? (
          <LoadingBlock lines={2} />
        ) : prefsQ.isError ? (
          <ErrorState message={ntf('ntf.loadFail')} onRetry={() => void prefsQ.refetch()} />
        ) : (
          <>
            {/* 营销卡：唯一可关类（真链路 Switch） */}
            <div
              className="flex items-center gap-3 rounded-card bg-card p-4 shadow-card"
              data-testid="notify-pref-marketing"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-brand-secondary" aria-hidden="true">
                <Bell className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold">{ntf('ntf.marketingLabel')}</p>
                <p className="mt-0.5 text-caption text-ink-secondary">{ntf('ntf.marketingDesc')}</p>
              </div>
              <Switch
                data-testid="notify-pref-marketing-switch"
                checked={marketing?.enabled ?? true}
                disabled={setPrefM.isPending}
                onCheckedChange={(checked) => setPrefM.mutate(checked)}
                aria-label={ntf('ntf.marketingLabel')}
              />
            </div>

            {/* 不可关组：交易/服务/账户——描述行+锁态+注记，不给假开关（R10） */}
            <div
              className="mt-2.5 flex items-center gap-3 rounded-card bg-card p-4 shadow-card"
              data-testid="notify-pref-mandatory"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-secondary" aria-hidden="true">
                <Lock className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-body font-semibold">{ntf('ntf.mandatoryLabel')}</p>
                  <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-caption-xs text-ink-secondary">
                    {ntf('ntf.mandatoryNote')}
                  </span>
                </div>
                <p className="mt-0.5 text-caption text-ink-secondary">{ntf('ntf.mandatoryDesc')}</p>
              </div>
            </div>
          </>
        )}
      </div>
      {toastEl}
    </div>
  )
}
