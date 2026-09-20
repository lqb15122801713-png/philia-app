/**
 * 我的评价 /reviews（批次 员工端2.0 · R10 最小评价域 · docs/staff2/R7-R10-DESIGN.md §一.8）
 *
 * 仅本人页：xp.myReviews 为 staffProcedure + 仅本人硬过滤（staffId=ctx.user.staffId），
 * 出参不含任何客户身份字段——匿名行展示「匿名客户」，非匿名行也只能显示「客户」。
 * 均分/条数摘要 = 已加载页面前端自算（零新接口）。
 * 复合游标翻页（createdAt+id），limit ≤ 50。
 */

import { usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MessagesSquare } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

/** Date → 'YYYY-MM-DD HH:mm' */
function fmtTs(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 星行（1-5 实心/空心） */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="shrink-0 text-body-sm leading-5" aria-label={`${rating} 星`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'text-brand-primary-pressed' : 'text-ink-placeholder'} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

type ReviewCursor = { createdAt: Date; id: string };

export default function MyReviewsPage() {
  const { trpc } = usePhiliaClient();

  const reviewsQuery = useInfiniteQuery({
    queryKey: ['xp', 'myReviews'],
    queryFn: ({ pageParam }) =>
      trpc.xp.myReviews.query({ limit: 20, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as ReviewCursor | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const items = reviewsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  // 摘要：基于已加载条目前端自算（零新接口）
  const avg = items.length > 0 ? items.reduce((s, r) => s + r.rating, 0) / items.length : null;

  return (
    <div className="pb-6">
      <PageHeader
        title="我的评价"
        backTo="/me"
        aside={
          items.length > 0 ? (
            <span>
              已加载 <b className="u1-num">{items.length}</b> 条
            </span>
          ) : null
        }
      />

      <div className="px-[22px]">
        {reviewsQuery.isPending ? (
          <div className="mt-2 space-y-2.5" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <div key={i} className="u1-card p-4">
                <div className="h-4 w-24 animate-pulse rounded-chip bg-sunken" />
                <div className="mt-2 h-5 w-48 animate-pulse rounded-chip bg-sunken" />
              </div>
            ))}
          </div>
        ) : reviewsQuery.isError ? (
          <div className="u1-card mt-2 p-6 text-center">
            <p className="text-body-sm text-ink-secondary">评价加载失败，请检查网络后重试</p>
            <button
              type="button"
              onClick={() => void reviewsQuery.refetch()}
              className="mt-4 h-12 min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              重新加载
            </button>
          </div>
        ) : items.length === 0 ? (
          // 空态引导
          <div className="flex flex-col items-center px-6 py-14 text-center" data-testid="reviews-empty">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken" aria-hidden>
              <MessagesSquare className="h-9 w-9 text-ink" strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-body-sm text-ink-secondary">
              还没有收到客户评价——服务完成后客户可在预约详情留言，好评会同时长 XP
            </p>
          </div>
        ) : (
          <>
            {/* 摘要头（均分+条数，基于已加载页面自算） */}
            <section className="u1-card mt-2 flex items-center gap-3.5 p-4" data-testid="reviews-summary">
              <span className="u1-num text-detail-lg font-bold leading-9">{avg!.toFixed(1)}</span>
              <div className="min-w-0 flex-1">
                <Stars rating={Math.round(avg!)} />
                <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                  已加载 <span className="u1-num">{items.length}</span> 条评价的平均分
                </p>
              </div>
            </section>

            <ul className="mt-3.5 space-y-2.5">
              {items.map((r) => (
                <li key={r.id} className="u1-card px-4 py-3.5" data-testid={`review-${r.id}`}>
                  <div className="flex items-center gap-3">
                    <Stars rating={r.rating} />
                    <span className="ml-auto text-caption-xs text-[rgba(74,59,46,.42)]">
                      {r.anonymous ? '匿名客户' : '客户'} · <span className="u1-num">{fmtTs(r.createdAt)}</span>
                    </span>
                  </div>
                  <p className={`mt-2 text-body-sm leading-relaxed ${r.text ? 'text-ink' : 'text-[rgba(74,59,46,.42)]'}`}>
                    {r.text ?? '未留言'}
                  </p>
                </li>
              ))}
            </ul>

            {reviewsQuery.hasNextPage ? (
              <button
                type="button"
                onClick={() => void reviewsQuery.fetchNextPage()}
                disabled={reviewsQuery.isFetchingNextPage}
                className="mt-3.5 h-11 w-full rounded-control bg-sunken text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-60"
              >
                {reviewsQuery.isFetchingNextPage ? '加载中…' : '加载更多'}
              </button>
            ) : null}
          </>
        )}

        <p className="mb-6 mt-4 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
          仅本人可见 · 好评 +XP，≤2 星 −8（扣分不扣款）
        </p>
      </div>
    </div>
  );
}
