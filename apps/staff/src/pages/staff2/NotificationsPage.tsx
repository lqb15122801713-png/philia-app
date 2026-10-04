/**
 * 通知中心 /notifications（员工端骨架整建批 片 3 · 员工端，coder H）
 *
 * 结构：SkBackBar（fallback=/me）→ 未读计数行 +「全部已读」→ 通知列表
 * （push.listNotifications 游标分页首屏 50 条；未读高亮=淡金底+红点；
 * 点条=markRead+跳 link（无 link 纯已读））。空态/错误态照 MySchedulePage 工艺。
 * 文案键 copy/notifications.ts（NOTIFICATIONS_COPY 族，withCopyOverrides 代理）。
 */

import { Skeleton, usePhiliaClient, useToast } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkBackBar, SkEmpty, SkNote } from '@/components/skeleton';
import { nfc } from '@/copy/notifications';
import { fmtMdHm } from '@/lib/collabPort';

const LIST_KEY = ['push', 'listNotifications', 'staff-center'] as const;
const UNREAD_KEY = ['push', 'unreadCount'] as const;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allBusy, setAllBusy] = useState(false);

  const listQ = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => trpc.push.listNotifications.query({ limit: 50 }),
  });

  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data]);
  const unreadCount = useMemo(() => items.filter((n) => n.readAt === null).length, [items]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
  };

  /** 点条：未读先 markRead（幂等），再按 link 跳转（站内深链） */
  const onTap = async (n: { id: string; readAt: Date | null; link: string | null }) => {
    if (busyId) return;
    setBusyId(n.id);
    try {
      if (n.readAt === null) {
        await trpc.push.markRead.mutate({ ids: [n.id] });
        invalidate();
      }
      if (n.link) navigate(n.link);
    } catch (e) {
      showToast(e instanceof Error ? e.message : nfc('snt.loadFail'));
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    if (allBusy || unreadCount === 0) return;
    setAllBusy(true);
    try {
      await trpc.push.markAllRead.mutate({});
      showToast(nfc('snt.markAllDone'));
      invalidate();
    } catch (e) {
      showToast(e instanceof Error ? e.message : nfc('snt.loadFail'));
    } finally {
      setAllBusy(false);
    }
  };

  return (
    <div className="sk pb-6" data-testid="notifications-page">
      <SkBackBar title={nfc('snt.title')} note={nfc('snt.no')} fallback="/me" />

      {/* 未读计数 + 全部已读 */}
      <div className="flex items-center gap-2 px-[22px] pt-3">
        <span className="text-caption-xs text-[rgba(59,46,36,.62)]" data-testid="ntf-unread-count">
          {nfc('snt.unreadLead', { n: unreadCount })}
        </span>
        <button
          type="button"
          disabled={allBusy || unreadCount === 0}
          onClick={() => void markAll()}
          data-testid="ntf-mark-all"
          className="ml-auto h-9 rounded-control bg-sunken px-3 text-caption font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
        >
          {nfc('snt.markAll')}
        </button>
      </div>

      <section className="mt-3 px-[22px]" data-testid="ntf-list">
        {listQ.isPending ? (
          <div className="space-y-2.5" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="u1-card h-14 !rounded-panel" />
            ))}
          </div>
        ) : listQ.isError ? (
          <div className="u1-card p-4 text-center">
            <p className="text-body-sm text-ink-secondary">{nfc('snt.loadFail')}</p>
            <button
              type="button"
              onClick={() => void listQ.refetch()}
              className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {nfc('snt.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <SkEmpty title={nfc('snt.empty')} body={nfc('snt.emptyBody')} />
        ) : (
          items.map((n) => {
            const unread = n.readAt === null;
            return (
              <button
                key={n.id}
                type="button"
                disabled={busyId !== null}
                onClick={() => void onTap(n)}
                data-testid={`ntf-row-${n.id}`}
                className={`mb-2 block w-full rounded-panel px-4 py-3 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-60 ${
                  unread ? 'bg-brand-primary-light' : 'u1-card'
                }`}
              >
                <div className="flex items-center gap-2">
                  {unread ? (
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                  ) : null}
                  <span className={`min-w-0 flex-1 truncate text-body-sm ${unread ? 'font-bold text-ink' : 'text-[rgba(59,46,36,.62)]'}`}>
                    {n.title}
                  </span>
                  <span className="sk-mono shrink-0 text-caption-xs text-[rgba(59,46,36,.42)]">{fmtMdHm(n.createdAt)}</span>
                </div>
                <p className={`mt-1 line-clamp-2 text-caption-xs ${unread ? 'text-ink' : 'text-[rgba(59,46,36,.42)]'}`}>{n.body}</p>
              </button>
            );
          })
        )}
      </section>

      <SkNote>{nfc('snt.emptyBody')}</SkNote>

      {toastEl}
    </div>
  );
}
