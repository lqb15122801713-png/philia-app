/**
 * NotifyCenterPage · /notifications 站内信消息中心（补缺大批片 5 片 5 · 新路由已申报
 * check-nav-closure/smoke-routes，锚点=「消息」）
 *
 * 数据源=trpc.push.*（真事件真数据，R10 零假件）：
 * - listNotifications（id 游标降序分页，unreadOnly/category 过滤）；
 * - unreadCount（markAllRead 可点口径：total>0）；
 * - markRead（点行即读，幂等）/ markAllRead（按当前分类 chip 过滤）/ deleteNotification。
 * 帧：分类 chips（全部/未读/交易/服务/账户/活动）+ 右上「全部已读」+ 订阅管理入口钮；
 * 列表行=分类签+标题+正文截断+时刻 mono+未读点（淡金 bg-brand-primary）+删除钮
 * （二次确认=同钮两击，3s 未二击自动复位）；点行→markRead+link 非空跳 link；
 * 分页=nextCursor「加载更多」（useInfiniteQuery）；骨架 LoadingBlock（ListSkeleton 成件）；
 * 错误 ErrorState+重试；空态三句话+emptyCta→/home；返回=navigate(-1)+fallback=/me。
 */

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Settings2, Trash2 } from 'lucide-react'
import { useMe, usePhiliaClient, useToast } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/home/common'
import { fmtHM, fmtMD } from '@/components/booking/format'
import { ntf, type NtfCopyKey } from '@/copy/notify'

type ChipKey = 'all' | 'unread' | 'trade' | 'service' | 'account' | 'marketing'

const CHIPS: Array<{ key: ChipKey; labelKey: NtfCopyKey }> = [
  { key: 'all', labelKey: 'ntf.allTab' },
  { key: 'unread', labelKey: 'ntf.unreadTab' },
  { key: 'trade', labelKey: 'ntf.catTrade' },
  { key: 'service', labelKey: 'ntf.catService' },
  { key: 'account', labelKey: 'ntf.catAccount' },
  { key: 'marketing', labelKey: 'ntf.catMarketing' },
]

const CAT_LABEL: Record<string, NtfCopyKey> = {
  trade: 'ntf.catTrade',
  service: 'ntf.catService',
  account: 'ntf.catAccount',
  marketing: 'ntf.catMarketing',
}

interface NotifyItem {
  id: string
  type: string
  category: string
  title: string
  body: string
  link: string | null
  readAt: Date | string | null
  createdAt: Date | string
}

/** 时刻 mono：当日 HH:MM，跨日 M月D日 */
function fmtAt(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  return sameDay ? fmtHM(d) : fmtMD(d)
}

/** 删除钮二次确认态的自动复位毫秒数 */
const CONFIRM_RESET_MS = 3000

export default function NotifyCenterPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const navigate = useNavigate()
  const { toastEl, showToast } = useToast({ durationMs: 2500 })
  const [chip, setChip] = useState<ChipKey>('all')
  /* 删除二次确认：首击进入待确认态（记录 id + 复位计时），二击执行 */
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const unreadOnly = chip === 'unread'
  const category = chip === 'all' || chip === 'unread' ? undefined : chip

  const listQ = useInfiniteQuery({
    queryKey: ['push', 'listNotifications', chip],
    queryFn: ({ pageParam }) =>
      trpc.push.listNotifications.query({
        cursor: pageParam,
        limit: 20,
        unreadOnly,
        ...(category ? { category } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!user,
  })
  const unreadQ = useQuery({
    queryKey: ['push', 'unreadCount'],
    queryFn: () => trpc.push.unreadCount.query(),
    enabled: !!user,
  })

  const invalidatePush = () => void queryClient.invalidateQueries({ queryKey: ['push'] })

  const markReadM = useMutation({
    mutationFn: (id: string) => trpc.push.markRead.mutate({ ids: [id] }),
    onSuccess: invalidatePush,
  })
  const markAllReadM = useMutation({
    mutationFn: () => trpc.push.markAllRead.mutate(category ? { category } : {}),
    onSuccess: invalidatePush,
  })
  const deleteM = useMutation({
    mutationFn: (id: string) => trpc.push.deleteNotification.mutate({ id }),
    onSuccess: () => {
      invalidatePush()
      showToast(ntf('ntf.deleted'))
    },
  })

  const items = (listQ.data?.pages.flatMap((p) => p.items) ?? []) as NotifyItem[]
  const unreadTotal = unreadQ.data?.total ?? 0

  const onOpenItem = (item: NotifyItem) => {
    if (!item.readAt) markReadM.mutate(item.id)
    if (item.link) navigate(item.link)
  }

  const onDelete = (id: string) => {
    if (confirmId === id) {
      setConfirmId(null)
      deleteM.mutate(id)
      return
    }
    setConfirmId(id)
    window.setTimeout(() => setConfirmId((cur) => (cur === id ? null : cur)), CONFIRM_RESET_MS)
  }

  return (
    <div className="px-4 py-6" data-testid="notify-center-page">
      <PageHeader
        title={ntf('ntf.title')}
        fallback="/me"
        right={
          <div className="flex items-center gap-2">
            <Link
              to="/notifications/prefs"
              aria-label={ntf('ntf.prefsTitle')}
              data-testid="notify-prefs-entry"
              className="grid h-9 w-9 place-items-center rounded-full bg-card text-ink-secondary shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.5} />
            </Link>
            <button
              type="button"
              data-testid="notify-mark-all"
              disabled={unreadTotal === 0 || markAllReadM.isPending}
              onClick={() => markAllReadM.mutate()}
              className="rounded-full bg-brand-primary px-3.5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
            >
              {ntf('ntf.markAllRead')}
            </button>
          </div>
        }
      />

      {/* 分类 chips（横滑条隐藏，同 AppointmentsPage 口径） */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            data-testid={`notify-chip-${c.key}`}
            onClick={() => setChip(c.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-body transition ${
              chip === c.key
                ? 'bg-brand-primary font-semibold text-ink'
                : 'bg-card text-ink-secondary shadow-card'
            }`}
          >
            {ntf(c.labelKey)}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {listQ.isPending ? (
          <LoadingBlock lines={4} />
        ) : listQ.isError ? (
          <div data-testid="notify-error">
            <ErrorState message={ntf('ntf.loadFail')} onRetry={() => void listQ.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div data-testid="notify-empty">
            <EmptyState
              icon={<Bell className="h-[26px] w-[26px]" strokeWidth={1.6} />}
              title={ntf('ntf.emptyTitle')}
              desc={ntf('ntf.emptyBody')}
              action={
                /* E 系空态深棕钮（§4.11：深棕墨底淡字，色值走 token bg-ink/text-canvas） */
                <Link
                  to="/home"
                  className="inline-flex items-center rounded-control bg-ink px-[22px] py-3 text-[13px] font-bold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  {ntf('ntf.emptyCta')}
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <ul className="space-y-2.5">
              {items.map((item) => (
                <li key={item.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    data-testid={`notify-item-${item.id}`}
                    onClick={() => onOpenItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onOpenItem(item)
                    }}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-card bg-card p-4 text-left shadow-card transition active:scale-[0.99]"
                  >
                    {/* 未读点（淡金；已读让位保持标题对齐） */}
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-brand-primary'}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-caption-xs text-ink-secondary">
                          {ntf(CAT_LABEL[item.category] ?? 'ntf.title')}
                        </span>
                        <p
                          className={`min-w-0 flex-1 truncate text-body ${
                            item.readAt ? 'text-ink-secondary' : 'font-semibold text-ink'
                          }`}
                        >
                          {item.title}
                        </p>
                        <span className="shrink-0 font-number text-caption-xs text-ink-placeholder">
                          {fmtAt(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-caption leading-5 text-ink-secondary">{item.body}</p>
                    </div>
                    <button
                      type="button"
                      data-testid={`notify-delete-${item.id}`}
                      aria-label={confirmId === item.id ? ntf('ntf.deleteConfirm') : ntf('ntf.delete')}
                      disabled={deleteM.isPending}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(item.id)
                      }}
                      className={`shrink-0 p-1 transition ${
                        confirmId === item.id
                          ? 'text-caption-xs font-semibold text-danger'
                          : 'text-ink-placeholder hover:text-danger'
                      }`}
                    >
                      {confirmId === item.id ? (
                        ntf('ntf.deleteConfirm')
                      ) : (
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {listQ.hasNextPage ? (
              <button
                type="button"
                data-testid="notify-load-more"
                disabled={listQ.isFetchingNextPage}
                onClick={() => void listQ.fetchNextPage()}
                className="mt-3 w-full rounded-card bg-card py-3 text-body-sm text-ink-secondary shadow-card transition-transform duration-120 ease-philia-spring active:scale-[0.99] disabled:opacity-60"
              >
                {ntf('ntf.loadMore')}
              </button>
            ) : null}
          </>
        )}
      </div>
      {toastEl}
    </div>
  )
}
