/**
 * 门店公告 /notices（员工端骨架整建批 片 3 · 员工端，coder H）
 *
 * 结构：SkBackBar（fallback=/me）→ 未读徽数行 → 公告列表（announce.list，
 * pinned 在前）→ 点开详情即 markRead（已读回执=进详情就落，幂等）+ 已读灰态。
 * 数据口=collabPort（server 侧 announce namespace 由 coder G 并行施工，签名冻结）。
 * 文案键 copy/notices.ts（NOTICES_COPY 族，withCopyOverrides 代理）。
 */

import { Skeleton, usePhiliaClient, useToast } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { SkBackBar, SkEmpty } from '@/components/skeleton';
import { ncc } from '@/copy/notices';
import { collabOf, fmtMdHm } from '@/lib/collabPort';

const LIST_KEY = ['announce', 'list'] as const;

export default function NoticesPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();
  const port = useMemo(() => collabOf(trpc), [trpc]);
  const [openId, setOpenId] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => port.announce.list.query(),
  });

  /** pinned 在前（同 pinned 内保持服务端序） */
  const rows = useMemo(() => {
    const list = [...(listQ.data?.announcements ?? [])];
    return list.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [listQ.data]);
  const unreadCount = useMemo(() => rows.filter((r) => r.readAt === null).length, [rows]);

  /** 点开详情即 markRead（已读回执=进详情就落；已读再点=收起/展开幂等） */
  const onToggle = async (id: string, readAt: Date | string | null) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next !== null && readAt === null) {
      try {
        await port.announce.markRead.mutate({ announcementId: id });
        void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      } catch (e) {
        showToast(e instanceof Error ? e.message : ncc('ntc.loadFail'));
      }
    }
  };

  return (
    <div className="sk pb-6" data-testid="notices-page">
      <SkBackBar title={ncc('ntc.title')} note={ncc('ntc.no')} fallback="/me" />

      <div className="px-[22px] pt-3">
        <span className="text-caption-xs text-[rgba(59,46,36,.62)]" data-testid="ntc-unread-count">
          {ncc('ntc.unreadLead', { n: unreadCount })}
        </span>
      </div>

      <section className="mt-3 px-[22px]" data-testid="ntc-list">
        {listQ.isPending ? (
          <div className="space-y-2.5" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="u1-card h-14 !rounded-panel" />
            ))}
          </div>
        ) : listQ.isError ? (
          <div className="u1-card p-4 text-center">
            <p className="text-body-sm text-ink-secondary">{ncc('ntc.loadFail')}</p>
            <button
              type="button"
              onClick={() => void listQ.refetch()}
              className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {ncc('ntc.retry')}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <SkEmpty title={ncc('ntc.empty')} body={ncc('ntc.emptyBody')} />
        ) : (
          rows.map((r) => {
            const unread = r.readAt === null;
            const open = openId === r.id;
            return (
              <div
                key={r.id}
                className={`u1-card mb-2 px-4 py-3 ${unread ? '' : 'opacity-70'}`}
                data-testid={`ntc-row-${r.id}`}
              >
                <button
                  type="button"
                  onClick={() => void onToggle(r.id, r.readAt)}
                  data-testid={`ntc-toggle-${r.id}`}
                  className="block w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    {r.pinned ? (
                      <span className="shrink-0 rounded-chip bg-brand-primary-light px-1.5 py-px text-caption-xs font-bold text-ink">
                        {ncc('ntc.pinned')}
                      </span>
                    ) : null}
                    <span className={`min-w-0 flex-1 truncate text-body-sm ${unread ? 'font-bold text-ink' : 'text-[rgba(59,46,36,.62)]'}`}>
                      {r.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-chip px-1.5 py-px text-caption-xs font-bold ${
                        unread ? 'bg-danger-light text-danger-deep' : 'bg-sunken text-[rgba(59,46,36,.42)]'
                      }`}
                    >
                      {unread ? ncc('ntc.badgeUnread') : ncc('ntc.badgeRead')}
                    </span>
                  </div>
                  <div className="sk-mono mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">{fmtMdHm(r.publishedAt)}</div>
                </button>
                {open ? (
                  <p className="mt-2 whitespace-pre-wrap border-t border-[rgba(59,46,36,.06)] pt-2 text-body-sm text-ink" data-testid={`ntc-body-${r.id}`}>
                    {r.body}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      {toastEl}
    </div>
  );
}
