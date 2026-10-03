/**
 * XP 成长 /xp（批次 员工端2.0 · R10 · docs/staff2/R7-R10-DESIGN.md §一.7）
 * 骨架批片 1（S-06）：外框换骨架——SkBackBar（二级页无 dock）→ XP 卡（mono 30 +
 * 段位五段条）→ 徽章墙 4 列（未得 0.38 透明）→ S7 近期事件（SkRows）。XP 永不兑钱明面。
 * 数据流/权限零回退。
 *
 * 数据源（全部 staffProcedure 仅本人）：
 * - xp.mySummary：累计/段位/下一段位差距/今日进度(earned/cap)/月增量/保级线/考试解锁标记；
 * - xp.leaderboard：本店榜——server 查询层裁剪（前三+自己+前一名），前端拿不到全榜，原样渲染；
 * - xp.rulesView：冻结一句话 + 六来源分值 + 段位门槛保级（levels 五段，徽章墙同源）；
 *   拉新行置灰（随会员游戏化批开通，不可点）；
 * - xp.myEvents：本人事件流（复合游标翻页），dropped=1 行划线 + 「超出日上限」明示。
 */

import { ListSkeleton, Skeleton, usePhiliaClient } from '@philia/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { XP_COPY } from '@/copy/xp';
import { SkBackBar, SkBtnAction, SkNote, SkRows } from '../../components/skeleton';
import '../../styles/skeleton.css';

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

/* ---------------- 骨架内联样（.sk 作用域 token） ---------------- */

const cardSt: CSSProperties = {
  margin: '12px 22px 0',
  background: 'var(--card)',
  borderRadius: 18,
  padding: '14px 16px',
  boxShadow: '0 1px 2px rgba(42, 31, 21, .05)',
};
const monoSm: CSSProperties = { fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--muted)' };
const chipSt: CSSProperties = {
  marginLeft: 6, borderRadius: 999, padding: '1px 6px', fontSize: 9, whiteSpace: 'nowrap',
};

function SecTitle({ children }: { children: ReactNode }) {
  return <p style={{ margin: '16px 22px 0', fontSize: 12.5, fontWeight: 800 }}>{children}</p>;
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="row">
      <span className="lb" style={{ color: 'var(--muted)', fontSize: 11 }}>{text}</span>
    </div>
  );
}

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
  const levels = rulesQuery.data?.levels ?? [];

  return (
    <div className="sk">
      <SkBackBar
        title={XP_COPY['xp.title']}
        fallback="/me"
        note={s ? `${XP_COPY['xp.aside.lead']} ${s.totalXp}` : undefined}
      />

      {/* XP 卡（mono 30 累计 + 段位五段条） */}
      <section style={{ ...cardSt, borderRadius: 20, padding: '18px 20px' }} data-testid="xp-level">
        {summaryQuery.isPending ? (
          <div>
            <Skeleton className="h-6 w-24 !rounded-chip" />
            <Skeleton className="mt-3 h-3 w-full !rounded-full" />
          </div>
        ) : summaryQuery.isError || !s ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{XP_COPY['xp.load.fail']}</p>
            <div style={{ marginTop: 12 }}>
              <SkBtnAction onClick={() => void summaryQuery.refetch()} testId="sk-xp-retry">
                {XP_COPY['xp.retry']}
              </SkBtnAction>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 800 }}>
                {s.level.name}
                {s.examUnlock.unlocked ? (
                  <span style={{ ...chipSt, background: 'var(--gold-pale)', color: 'var(--ink-deep)', fontWeight: 700, verticalAlign: 'middle' }}>
                    {s.examUnlock.label}
                  </span>
                ) : null}
              </p>
              <p className="sk-mono" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '.02em' }}>{s.totalXp}</p>
            </div>
            {/* 段位五段条（已达段=淡金填；当前段=淡黄按进度；未到=发丝线） */}
            <div
              style={{ display: 'flex', gap: 4, marginTop: 12 }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              data-testid="sk-xp-segbar"
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const fill = i < s.level.index ? 1 : i === s.level.index ? progress : 0;
                return (
                  <span key={i} style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--hairline-soft)', overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block', height: '100%', borderRadius: 999,
                        width: `${Math.round(fill * 100)}%`,
                        background: i < s.level.index ? 'var(--gold)' : 'var(--gold-pale)',
                      }}
                    />
                  </span>
                );
              })}
            </div>
            <p style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
              {s.nextLevel
                ? <>{XP_COPY['xp.level.gapLead']} <b>{s.nextLevel.name}</b> {XP_COPY['xp.level.gapMid']} <b className="sk-mono">{s.nextLevel.gap}</b> {XP_COPY['xp.level.gapTail']}</>
                : XP_COPY['xp.level.max']}
            </p>
            <p style={{ ...monoSm, marginTop: 4 }}>
              {s.retention.monthlyXp > 0
                ? <>{XP_COPY['xp.retention.lead']} {s.retention.monthlyXp} {XP_COPY['xp.retention.mid']} <b style={{ color: 'var(--ink)' }}>{s.monthGained}</b></>
                : XP_COPY['xp.retention.none']}
            </p>
          </>
        )}
      </section>

      {/* 今日经验 */}
      <SkRows testId="xp-today">
        <div className="row">
          <span className="lb" style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 700 }}>{XP_COPY['xp.sec.today']}</span>
            <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
              {full ? XP_COPY['xp.today.fullHint'] : <>{XP_COPY['xp.today.capLead']} {s?.today.cap ?? '…'}{XP_COPY['xp.today.capTail']}</>}
            </span>
          </span>
          {full ? (
            <span style={{ ...chipSt, marginLeft: 0, background: 'var(--gold-pale)', color: 'var(--ink-deep)', fontWeight: 700 }}>
              {XP_COPY['xp.today.fullBadge']}
            </span>
          ) : null}
          <span className="vl" style={{ fontSize: 15 }}>{s ? `${s.today.earned}/${s.today.cap}` : '…'}</span>
        </div>
      </SkRows>

      {/* 徽章墙 4 列（段位=徽章，未得 0.38 透明；与 rulesView.levels 同源） */}
      {levels.length > 0 && s ? (
        <>
          <SecTitle>{XP_COPY['xp.sec.badges']}</SecTitle>
          <div style={{ ...cardSt, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }} data-testid="sk-xp-badges">
            {levels.map((lv) => {
              const earned = lv.level <= s.level.index;
              return (
                <div
                  key={lv.level}
                  data-testid={`sk-xp-badge-${lv.level}`}
                  style={{
                    borderRadius: 14, background: 'var(--paper)', padding: '10px 6px', textAlign: 'center',
                    opacity: earned ? 1 : 0.38,
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 800 }}>{lv.name}</div>
                  <div className="sk-mono" style={{ marginTop: 3, fontSize: 8.5, color: 'var(--muted)' }}>
                    {XP_COPY['xp.badge.thresholdLead']} {lv.threshold}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* 本店榜（server 裁剪：前三+自己+前一名，原样渲染不补全） */}
      <SecTitle>{XP_COPY['xp.sec.board']}</SecTitle>
      <SkRows testId="xp-board">
        {boardQuery.isPending ? (
          <div style={{ padding: '8px 0' }}><ListSkeleton rows={3} /></div>
        ) : boardQuery.isError ? (
          <EmptyRow text={XP_COPY['xp.board.loadFail']} />
        ) : (
          boardQuery.data.rows.map((r) => (
            <div
              key={r.staffId}
              className="row"
              data-testid={r.isSelf ? 'xp-board-self' : undefined}
              style={r.isSelf ? { background: 'rgba(242, 223, 166, .35)', borderRadius: 10, marginInline: -8, paddingInline: 8 } : undefined}
            >
              <span className="sk-mono" style={{ width: 24, flex: 'none', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>
                {r.rank}
              </span>
              <span className="lb" style={{ minWidth: 0, flex: 1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}
                {r.isSelf ? <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 400, color: 'var(--muted)' }}>{XP_COPY['xp.board.self']}</span> : null}
                <span style={{ ...chipSt, background: 'var(--paper)', color: 'var(--muted)' }}>{r.levelName}</span>
              </span>
              <span className="vl">{r.totalXp}</span>
            </div>
          ))
        )}
      </SkRows>
      <SkNote>{XP_COPY['xp.board.note']}</SkNote>

      {/* 规则一句话 + 六来源分值 */}
      <section style={cardSt} data-testid="xp-rules">
        {rulesQuery.isPending ? (
          <Skeleton className="h-16 !rounded-chip" />
        ) : rulesQuery.isError || !rulesQuery.data ? (
          <p style={{ padding: '4px 0', fontSize: 11, color: 'var(--muted)' }}>{XP_COPY['xp.rules.loadFail']}</p>
        ) : (
          <>
            <p style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.7 }}>{rulesQuery.data.oneLiner}</p>
            <div className="sk-rows" style={{ margin: '8px 0 0', background: 'transparent', boxShadow: 'none', padding: 0, borderRadius: 0 }}>
              {rulesQuery.data.sources.map((src) => {
                const disabled = 'disabled' in src && src.disabled;
                return (
                  <div
                    key={src.key}
                    className="row"
                    style={disabled ? { opacity: 0.5 } : undefined}
                    aria-disabled={disabled || undefined}
                  >
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      {src.label}
                      {'channel' in src && src.channel === 'learning' ? (
                        <span style={{ ...chipSt, background: 'var(--gold)', color: 'var(--ink-deep)' }}>{XP_COPY['xp.rules.learningTag']}</span>
                      ) : null}
                      {disabled ? (
                        <span style={{ ...chipSt, background: 'var(--paper)', color: 'var(--muted)' }}>
                          {('disabledNote' in src && src.disabledNote) || XP_COPY['xp.rules.disabledFallback']}
                        </span>
                      ) : null}
                    </span>
                    {!disabled ? (
                      <span className={`vl${src.points < 0 ? ' red' : ''}`}>
                        {src.points > 0 ? `+${src.points}` : src.points}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p style={{ ...monoSm, paddingTop: 6 }}>
              {XP_COPY['xp.rules.footCap']} {rulesQuery.data.dailyCap} · {XP_COPY['xp.rules.footReview']} {rulesQuery.data.antiFraud.reviewDailyLimitPerCustomer} {XP_COPY['xp.rules.footExamMid']} {rulesQuery.data.antiFraud.examMonthlyLimit} {XP_COPY['xp.rules.footExamTail']}
            </p>
          </>
        )}
      </section>

      {/* S7 近期事件（dropped 行划线+超出日上限） */}
      <SecTitle>{XP_COPY['xp.sec.events']}</SecTitle>
      <SkRows testId="xp-events">
        {eventsQuery.isPending ? (
          <div style={{ padding: '8px 0' }}><ListSkeleton rows={3} /></div>
        ) : eventsQuery.isError ? (
          <EmptyRow text={XP_COPY['xp.events.loadFail']} />
        ) : events.length === 0 ? (
          <EmptyRow text={XP_COPY['xp.events.empty']} />
        ) : (
          events.map((ev) => (
            <div className="row" key={ev.id}>
              <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, ...(ev.dropped ? { color: 'var(--muted)', textDecoration: 'line-through' } : {}) }}>
                  {SOURCE_LABEL[ev.source] ?? ev.source}
                  {ev.channel === 'learning' ? (
                    <span style={{ ...chipSt, background: 'var(--gold)', color: 'var(--ink-deep)' }}>{XP_COPY['xp.events.learningTag']}</span>
                  ) : null}
                </span>
                <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
                  {fmtTs(ev.createdAt)}
                  {/* A4 标注粒度：寄养晚数行区分（「完成服务 +6」=寄养 3 晚×2 不再误读） */}
                  {ev.ruleKey === 'xp_service_boarding_night' && ev.boardingNights !== null ? (
                    <span style={{ ...chipSt, background: 'var(--paper)', color: 'var(--muted)' }}>
                      {XP_COPY['xp.events.boardingLead']} {ev.boardingNights} {XP_COPY['xp.events.boardingTail']}
                    </span>
                  ) : null}
                  {/* A6 单号链接：来源单可溯（好评/差评/完成服务） */}
                  {ev.appointmentId ? (
                    <Link
                      to={`/execute/${ev.appointmentId}`}
                      className="sk-mono"
                      style={{ marginLeft: 6, color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {XP_COPY['xp.events.billLead']}{ev.appointmentId.slice(-6)}
                    </Link>
                  ) : null}
                  {ev.dropped ? (
                    <span style={{ ...chipSt, background: 'var(--paper)', color: 'var(--muted)' }}>{XP_COPY['xp.events.droppedTag']}</span>
                  ) : null}
                </span>
              </span>
              <span
                className={`vl${!ev.dropped && ev.points < 0 ? ' red' : ''}`}
                style={ev.dropped ? { color: 'var(--muted)', textDecoration: 'line-through', fontWeight: 500 } : undefined}
              >
                {ev.points > 0 ? `+${ev.points}` : ev.points}
              </span>
            </div>
          ))
        )}
      </SkRows>
      {eventsQuery.hasNextPage ? (
        <button
          type="button"
          className="sk-btn-ghost"
          style={{ width: 'calc(100% - 44px)', margin: '10px 22px 0' }}
          onClick={() => void eventsQuery.fetchNextPage()}
          disabled={eventsQuery.isFetchingNextPage}
        >
          {eventsQuery.isFetchingNextPage ? XP_COPY['xp.events.loading'] : XP_COPY['xp.events.more']}
        </button>
      ) : null}

      <p className="sk-note" style={{ textAlign: 'center', paddingBottom: 32 }}>{XP_COPY['xp.footer']}</p>
    </div>
  );
}
