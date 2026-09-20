/**
 * XP 成长 /xp（批次 员工端2.0 · R10 · docs/staff2/R7-R10-DESIGN.md §一.7）
 *
 * 数据源（全部 staffProcedure 仅本人）：
 * - xp.mySummary：累计/段位/下一段位差距/今日进度(earned/cap)/月增量/保级线/考试解锁标记；
 * - xp.leaderboard：本店榜——server 查询层裁剪（前三+自己+前一名），前端拿不到全榜，原样渲染；
 * - xp.rulesView：冻结一句话 + 六来源分值 + 段位门槛保级；拉新行置灰（随会员游戏化批开通，不可点）；
 * - xp.myEvents：本人事件流（复合游标翻页），dropped=1 行划线 + 「超出日上限」明示。
 */

import { usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

/** XP 来源中文标签（schema xp_events.source） */
const SOURCE_LABEL: Record<string, string> = {
  attendance: '出勤打卡',
  service: '完成服务',
  review: '客户好评',
  exam: '考试学习',
  referral: '拉新拓客',
  cover: '临时补位',
  penalty: '差评扣分',
};

/** Date → 'MM-DD HH:mm' */
function fmtTs(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type EventCursor = { createdAt: Date; id: string };

export default function XpPage() {
  const { trpc } = usePhiliaClient();

  const summaryQuery = useQuery({
    queryKey: ['xp', 'mySummary'],
    queryFn: () => trpc.xp.mySummary.query(),
  });
  const boardQuery = useQuery({
    queryKey: ['xp', 'leaderboard'],
    queryFn: () => trpc.xp.leaderboard.query(),
  });
  const rulesQuery = useQuery({
    queryKey: ['xp', 'rulesView'],
    queryFn: () => trpc.xp.rulesView.query(),
    staleTime: 300_000,
  });
  const eventsQuery = useInfiniteQuery({
    queryKey: ['xp', 'myEvents'],
    queryFn: ({ pageParam }) =>
      trpc.xp.myEvents.query({ limit: 20, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as EventCursor | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const s = summaryQuery.data;
  const full = s ? s.today.earned >= s.today.cap : false;
  const progress = s?.nextLevel
    ? Math.min(
        1,
        Math.max(
          0,
          (s.totalXp - s.level.threshold) / Math.max(1, s.nextLevel.threshold - s.level.threshold),
        ),
      )
    : 1;
  const events = eventsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="pb-6">
      <PageHeader
        title="XP 成长"
        backTo="/me"
        aside={s ? <span>累计 <b className="u1-num">{s.totalXp}</b></span> : null}
      />

      <div className="px-[22px]">
        {/* 段位卡 */}
        <section className="u1-card mt-2 p-4" data-testid="xp-level">
          {summaryQuery.isPending ? (
            <div>
              <div className="h-6 w-24 animate-pulse rounded-chip bg-sunken" />
              <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-sunken" />
            </div>
          ) : summaryQuery.isError || !s ? (
            <div className="text-center">
              <p className="text-body-sm text-ink-secondary">XP 档案加载失败，请检查网络后重试</p>
              <button
                type="button"
                onClick={() => void summaryQuery.refetch()}
                className="mt-4 h-12 min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                重新加载
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <p className="text-title font-bold">
                  {s.level.name}
                  {s.examUnlock.unlocked ? (
                    <span className="ml-2 rounded-chip bg-brand-secondary-light px-1.5 py-0.5 align-middle text-caption-xs font-bold text-ink">
                      {s.examUnlock.label}
                    </span>
                  ) : null}
                </p>
                <p className="u1-num text-detail font-bold leading-8">{s.totalXp}</p>
              </div>
              {/* 进度条（到下一段位） */}
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="h-full rounded-full bg-brand-secondary-deep" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-2 text-caption-xs text-[rgba(74,59,46,.62)]">
                {s.nextLevel
                  ? <>距 <b>{s.nextLevel.name}</b> 还差 <b className="u1-num">{s.nextLevel.gap}</b> 经验</>
                  : '已达最高段位'}
              </p>
              <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                {s.retention.monthlyXp > 0
                  ? <>保级线：月增量 <span className="u1-num">{s.retention.monthlyXp}</span> · 本月已增 <b className="u1-num text-ink">{s.monthGained}</b></>
                  : '当前段位无保级要求，经验累计不清零'}
              </p>
            </>
          )}
        </section>

        {/* 今日经验 */}
        <section className="u1-card mt-3.5 flex items-center gap-3.5 px-4 py-3.5" data-testid="xp-today">
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-bold">今日经验</p>
            <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
              {full ? '今日经验已满，明日 0 点重置' : `日上限 ${s?.today.cap ?? '…'}，超出部分不计分`}
            </p>
          </div>
          {full ? (
            <span className="shrink-0 rounded-chip bg-success-light px-2 py-1 text-caption-xs font-bold text-success-deep">
              今日经验已满
            </span>
          ) : null}
          <span className="u1-num shrink-0 text-title-lg font-bold">
            {s ? `${s.today.earned}/${s.today.cap}` : '…'}
          </span>
        </section>

        {/* 本店榜（server 裁剪：前三+自己+前一名，原样渲染不补全） */}
        <section className="u1-card mt-3.5 px-4 py-3.5" data-testid="xp-board">
          <h2 className="text-body-sm font-bold">本店榜</h2>
          {boardQuery.isPending ? (
            <div className="mt-2 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-chip bg-sunken" />
              ))}
            </div>
          ) : boardQuery.isError ? (
            <p className="py-3 text-caption-xs text-[rgba(74,59,46,.42)]">榜单加载失败，请稍后重试</p>
          ) : (
            <ul className="mt-1 divide-y divide-[rgba(74,59,46,.06)]">
              {boardQuery.data.rows.map((r) => (
                <li
                  key={r.staffId}
                  className={`-mx-4 flex items-center gap-3 px-4 py-2.5 ${r.isSelf ? 'bg-brand-primary-light' : ''}`}
                  data-testid={r.isSelf ? 'xp-board-self' : undefined}
                >
                  <span className="u1-num w-6 shrink-0 text-center text-body-sm font-bold text-[rgba(74,59,46,.62)]">
                    {r.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-sm font-bold text-ink">
                    {r.name}
                    {r.isSelf ? <span className="ml-1 text-caption-xs font-normal text-[rgba(74,59,46,.62)]">（我）</span> : null}
                    <span className="ml-1.5 rounded-chip bg-sunken px-1 py-0.5 text-caption-xs font-normal text-[rgba(74,59,46,.62)]">{r.levelName}</span>
                  </span>
                  <span className="u1-num shrink-0 text-body-sm font-bold text-ink">{r.totalXp}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="pt-1 text-caption-xs text-[rgba(74,59,46,.42)]">榜单只显示前三与你相邻的名次</p>
        </section>

        {/* 规则一句话 + 六来源分值 */}
        <section className="u1-card mt-3.5 px-4 py-3.5" data-testid="xp-rules">
          {rulesQuery.isPending ? (
            <div className="h-16 animate-pulse rounded-chip bg-sunken" />
          ) : rulesQuery.isError || !rulesQuery.data ? (
            <p className="py-2 text-caption-xs text-[rgba(74,59,46,.42)]">规则加载失败，请稍后重试</p>
          ) : (
            <>
              <p className="text-body-sm font-bold leading-relaxed">{rulesQuery.data.oneLiner}</p>
              <ul className="mt-2 divide-y divide-[rgba(74,59,46,.06)]">
                {rulesQuery.data.sources.map((src) => {
                  const disabled = 'disabled' in src && src.disabled;
                  return (
                    <li
                      key={src.key}
                      className={`flex items-center gap-3 py-2.5 ${disabled ? 'opacity-50' : ''}`}
                      aria-disabled={disabled || undefined}
                    >
                      <span className="min-w-0 flex-1 text-body-sm text-ink">
                        {src.label}
                        {'channel' in src && src.channel === 'learning' ? (
                          <span className="ml-1.5 rounded-chip bg-brand-secondary-light px-1 py-0.5 text-caption-xs text-ink">学习通道·不占日上限</span>
                        ) : null}
                        {disabled ? (
                          <span className="ml-1.5 rounded-chip bg-sunken px-1.5 py-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                            {('disabledNote' in src && src.disabledNote) || '暂未开通'}
                          </span>
                        ) : null}
                      </span>
                      {!disabled ? (
                        <span className={`u1-num shrink-0 text-body-sm font-bold ${src.points < 0 ? 'text-danger' : 'text-ink'}`}>
                          {src.points > 0 ? `+${src.points}` : src.points}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="pt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                日上限 <span className="u1-num">{rulesQuery.data.dailyCap}</span> · 同客户当日好评只计 <span className="u1-num">{rulesQuery.data.antiFraud.reviewDailyLimitPerCustomer}</span> 次 · 考试每级每月限 <span className="u1-num">{rulesQuery.data.antiFraud.examMonthlyLimit}</span> 次
              </p>
            </>
          )}
        </section>

        {/* 我的经验明细（dropped 行划线+超出日上限） */}
        <section className="u1-card mt-3.5 px-4 py-3.5" data-testid="xp-events">
          <h2 className="text-body-sm font-bold">我的经验明细</h2>
          {eventsQuery.isPending ? (
            <div className="mt-2 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-chip bg-sunken" />
              ))}
            </div>
          ) : eventsQuery.isError ? (
            <p className="py-3 text-caption-xs text-[rgba(74,59,46,.42)]">经验明细加载失败，请稍后重试</p>
          ) : events.length === 0 ? (
            <p className="py-3 text-caption-xs text-[rgba(74,59,46,.42)]">
              还没有经验记录——打卡、完成服务、收获好评都会长经验
            </p>
          ) : (
            <>
              <ul className="divide-y divide-[rgba(74,59,46,.06)]">
                {events.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={`text-body-sm font-bold ${ev.dropped ? 'text-[rgba(74,59,46,.42)] line-through' : 'text-ink'}`}>
                        {SOURCE_LABEL[ev.source] ?? ev.source}
                        {ev.channel === 'learning' ? (
                          <span className="ml-1.5 rounded-chip bg-brand-secondary-light px-1 py-0.5 text-caption-xs font-normal text-ink">学习</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                        <span className="u1-num">{fmtTs(ev.createdAt)}</span>
                        {ev.dropped ? (
                          <span className="ml-1.5 rounded-chip bg-sunken px-1 py-0.5">超出日上限，未计分</span>
                        ) : null}
                      </p>
                    </div>
                    <span
                      className={`u1-num shrink-0 text-body-sm font-bold ${
                        ev.dropped ? 'text-[rgba(74,59,46,.42)] line-through' : ev.points < 0 ? 'text-danger' : 'text-ink'
                      }`}
                    >
                      {ev.points > 0 ? `+${ev.points}` : ev.points}
                    </span>
                  </li>
                ))}
              </ul>
              {eventsQuery.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => void eventsQuery.fetchNextPage()}
                  disabled={eventsQuery.isFetchingNextPage}
                  className="mt-2.5 h-11 w-full rounded-control bg-sunken text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-60"
                >
                  {eventsQuery.isFetchingNextPage ? '加载中…' : '加载更多'}
                </button>
              ) : null}
            </>
          )}
        </section>

        <p className="mb-6 mt-4 flex items-center justify-center gap-1 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
          <Trophy className="h-3.5 w-3.5" aria-hidden /> 每月 1 日段位结算 · 经验累计不清零
        </p>
      </div>
    </div>
  );
}
