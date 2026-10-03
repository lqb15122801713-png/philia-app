/**
 * 我的评价 /reviews（批次 员工端2.0 · R10 最小评价域 · docs/staff2/R7-R10-DESIGN.md §一.8）
 * 骨架批片 1（S-07）：外框换骨架——SkBackBar（二级页无 dock）→ trio（均分/条数/差评）→
 * 评价卡 ×N（score mono + 文 + mono 溯源）→ 口径注（差评 24h 回访 · 不可删改）。
 * 数据流/权限零回退。
 *
 * 仅本人页：xp.myReviews 为 staffProcedure + 仅本人硬过滤（staffId=ctx.user.staffId），
 * 出参不含任何客户身份字段——匿名行展示「匿名客户」，非匿名行也只能显示「客户」。
 * 均分/条数/差评摘要 = 已加载页面前端自算（零新接口）。
 * 复合游标翻页（createdAt+id），limit ≤ 50。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { REVIEWS_COPY } from '@/copy/reviews';
import { SkBackBar, SkBtnAction, SkEmpty, SkNote } from '../../components/skeleton';
import '../../styles/skeleton.css';

/** Date → 'YYYY-MM-DD HH:mm' */
function fmtTs(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type ReviewCursor = { createdAt: Date; id: string };

const cardSt: CSSProperties = {
  margin: '12px 22px 0',
  background: 'var(--card)',
  borderRadius: 18,
  padding: '14px 16px',
  boxShadow: '0 1px 2px rgba(42, 31, 21, .05)',
};

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
  // 摘要：基于已加载条目前端自算（零新接口）；差评=≤2 星（与 xp 扣分口径一致）
  const avg = items.length > 0 ? items.reduce((s, r) => s + r.rating, 0) / items.length : null;
  const badCount = items.filter((r) => r.rating <= 2).length;

  return (
    <div className="sk">
      <SkBackBar
        title={REVIEWS_COPY['reviews.title']}
        fallback="/me"
        note={items.length > 0 ? `${REVIEWS_COPY['reviews.aside.lead']} ${items.length} ${REVIEWS_COPY['reviews.aside.tail']}` : undefined}
      />

      {reviewsQuery.isPending ? (
        <div style={{ margin: '12px 22px 0', display: 'grid', gap: 10 }} aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <div key={i} style={cardSt}>
              <Skeleton className="h-4 w-24 !rounded-chip" />
              <Skeleton className="mt-2 h-5 w-48 !rounded-chip" />
            </div>
          ))}
        </div>
      ) : reviewsQuery.isError ? (
        <div style={{ ...cardSt, textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{REVIEWS_COPY['reviews.load.fail']}</p>
          <div style={{ marginTop: 12 }}>
            <SkBtnAction onClick={() => void reviewsQuery.refetch()} testId="sk-reviews-retry">
              {REVIEWS_COPY['reviews.retry']}
            </SkBtnAction>
          </div>
        </div>
      ) : items.length === 0 ? (
        // 空态引导
        <div data-testid="reviews-empty" style={{ paddingTop: 16 }}>
          <SkEmpty title={REVIEWS_COPY['reviews.empty']} />
        </div>
      ) : (
        <>
          {/* trio（均分/条数/差评，基于已加载页面自算） */}
          <section
            style={{ ...cardSt, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '14px 6px', textAlign: 'center' }}
            data-testid="reviews-summary"
          >
            {[
              { v: avg!.toFixed(1), k: REVIEWS_COPY['reviews.trio.avg'], red: false },
              { v: String(items.length), k: REVIEWS_COPY['reviews.trio.count'], red: false },
              { v: String(badCount), k: REVIEWS_COPY['reviews.trio.bad'], red: badCount > 0 },
            ].map((c, i) => (
              <div key={c.k} style={i > 0 ? { boxShadow: 'inset 1px 0 0 var(--hairline-soft)' } : undefined}>
                <div className="sk-mono" style={{ fontSize: 17, fontWeight: 700, color: c.red ? 'var(--danger)' : 'var(--ink)' }}>{c.v}</div>
                <div style={{ marginTop: 2, fontSize: 10, color: 'var(--muted)' }}>{c.k}</div>
              </div>
            ))}
          </section>

          {/* 评价卡 ×N（score mono + 文 + mono 溯源） */}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((r) => (
              <li key={r.id} style={cardSt} data-testid={`review-${r.id}`}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="sk-mono" style={{ fontSize: 17, fontWeight: 700, color: r.rating <= 2 ? 'var(--danger)' : 'var(--ink)' }}>
                    {r.rating.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 11, color: r.rating <= 2 ? 'var(--danger)' : 'var(--khaki)', letterSpacing: 2 }} aria-label={`${r.rating} ${REVIEWS_COPY['reviews.starUnit']}`}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </span>
                  <span className="sk-mono" style={{ marginLeft: 'auto', fontSize: 9.5, color: 'var(--muted)' }}>
                    {r.anonymous ? REVIEWS_COPY['reviews.anonymous'] : REVIEWS_COPY['reviews.customer']} · {fmtTs(r.createdAt)}
                  </span>
                </div>
                <p style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.8, color: r.text ? 'var(--ink)' : 'var(--muted)' }}>
                  {r.text ?? REVIEWS_COPY['reviews.noText']}
                </p>
              </li>
            ))}
          </ul>

          {reviewsQuery.hasNextPage ? (
            <button
              type="button"
              className="sk-btn-ghost"
              style={{ width: 'calc(100% - 44px)', margin: '12px 22px 0' }}
              onClick={() => void reviewsQuery.fetchNextPage()}
              disabled={reviewsQuery.isFetchingNextPage}
            >
              {reviewsQuery.isFetchingNextPage ? REVIEWS_COPY['reviews.loading'] : REVIEWS_COPY['reviews.more']}
            </button>
          ) : null}
        </>
      )}

      {/* 口径注：差评 24h 回访 · 不可删改 */}
      <SkNote>{REVIEWS_COPY['reviews.callbackNote']}</SkNote>
      <p className="sk-note" style={{ textAlign: 'center', paddingBottom: 32 }}>
        {REVIEWS_COPY['reviews.footer']}
      </p>
    </div>
  );
}
