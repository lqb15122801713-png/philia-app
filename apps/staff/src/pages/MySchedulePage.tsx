/**
 * 我的排班 /my-schedule（员工端骨架整建批 片 2 · 员工端）
 *
 * 结构：SkBackBar（fallback=/me）→ 周视图（weekView 只读，我的班次高亮 + 我的班次
 * 卡可发起换班 swapRequest）→ 可用时间维护（myAvailability + upsertAvailability
 * 编辑器：周日×时段 chips）→ 请假/调休申请（leaveRequest + myLeaves 列表）→
 * 调休余额（compOffBalance 大字 + 流水 SkRows）。
 *
 * 数据=schedule namespace（server 已落地，类型经 lib/schedulePort.ts 从 AppRouter
 * 推导）。骨架构件复用 components/skeleton（样式全在 styles/skeleton.css 的 .sk
 * 作用域）；文案键 copy/schedule.ts（SCHEDULE_COPY 族，withCopyOverrides 代理）。
 */

import { Skeleton, usePhiliaClient, useToast } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { SkBackBar, SkChips, SkEmpty, SkRow, SkRows } from '@/components/skeleton';
import { weekdayLabel } from '@/components/today/utils';
import { sdc } from '@/copy/schedule';
import {
  addDays,
  dateStr,
  hmToMin,
  minToHm,
  mondayOf,
  weekDates,
  type ShiftAssignment,
} from '@/lib/schedulePort';

/** 周日 chips 值序（schema 口径 1=周一…0=周日；label=周一~周日） */
const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((v) => ({
  key: String(v),
  label: `周${['日', '一', '二', '三', '四', '五', '六'][v]}`,
}));
/** weekday 值 → 周日名 */
const weekdayName = (v: number): string => `周${['日', '一', '二', '三', '四', '五', '六'][v] ?? v}`;

/** 调休分钟 → 小时（保留 1 位小数，整数不带尾零） */
const minToHours = (m: number): string => {
  const h = m / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

export default function MySchedulePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();

  /* ---- 本人（高亮行 + 换班发起主体） ---- */
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'staffDetail'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  });
  const myStaffId = meQuery.data?.staff?.id ?? null;

  /* ---- 周选择（周一起算） ---- */
  const [weekStart, setWeekStart] = useState(() => dateStr(mondayOf(new Date())));
  const days = useMemo(() => weekDates(weekStart), [weekStart]);

  const weekQuery = useQuery({
    queryKey: ['schedule', 'weekView', weekStart],
    queryFn: () => trpc.schedule.weekView.query({ weekStart }),
  });
  const availQuery = useQuery({
    queryKey: ['schedule', 'myAvailability'],
    queryFn: () => trpc.schedule.myAvailability.query(),
  });
  const leavesQuery = useQuery({
    queryKey: ['schedule', 'myLeaves'],
    queryFn: () => trpc.schedule.myLeaves.query(),
  });
  const compQuery = useQuery({
    queryKey: ['schedule', 'compOffBalance'],
    queryFn: () => trpc.schedule.compOffBalance.query(),
  });

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['schedule'] });

  const assignments = useMemo(() => weekQuery.data?.assignments ?? [], [weekQuery.data]);
  /** 周发布态：有 active 班且全部已发布=已发布（weekView 逐行 published 透出） */
  const weekPublished = useMemo(() => {
    const active = assignments.filter((a) => a.status !== 'cancelled');
    return active.length > 0 && active.every((a) => a.published);
  }, [assignments]);
  /** 日 → assignments（已取消不入列） */
  const dayMap = useMemo(() => {
    const m = new Map<string, ShiftAssignment[]>();
    for (const a of assignments) {
      if (a.status === 'cancelled') continue;
      m.set(a.date, [...(m.get(a.date) ?? []), a]);
    }
    return m;
  }, [assignments]);
  /** 我的有效班次（换班发起源，按日期升序） */
  const myAssignments = useMemo(
    () =>
      assignments
        .filter((a) => a.staffId === myStaffId && a.status === 'active')
        .sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1)),
    [assignments, myStaffId],
  );
  const colleagues = useMemo(
    () => (weekQuery.data?.staff ?? []).filter((s) => s.id !== myStaffId),
    [weekQuery.data, myStaffId],
  );

  /* ---- 可用时间编辑器 ---- */
  const [avWeekday, setAvWeekday] = useState('1');
  const [avStart, setAvStart] = useState('09:00');
  const [avEnd, setAvEnd] = useState('18:00');
  const [avNote, setAvNote] = useState('');
  const [avBusy, setAvBusy] = useState(false);

  const saveAvailability = async () => {
    if (hmToMin(avStart) >= hmToMin(avEnd)) {
      showToast(sdc('sched.avail.invalid'));
      return;
    }
    setAvBusy(true);
    try {
      await trpc.schedule.upsertAvailability.mutate({
        weekday: parseInt(avWeekday, 10),
        startMin: hmToMin(avStart),
        endMin: hmToMin(avEnd),
        ...(avNote.trim() ? { note: avNote.trim() } : {}),
      });
      showToast(sdc('sched.avail.saved'));
      setAvNote('');
      invalidateAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : sdc('sched.common.loadFail'));
    } finally {
      setAvBusy(false);
    }
  };

  /* ---- 请假/调休申请 ---- */
  const [lvKind, setLvKind] = useState<'leave' | 'comp_off'>('leave');
  const [lvStart, setLvStart] = useState(() => dateStr(new Date()));
  const [lvEnd, setLvEnd] = useState(() => dateStr(new Date()));
  const [lvReason, setLvReason] = useState('');
  const [lvBusy, setLvBusy] = useState(false);

  const submitLeave = async () => {
    if (!lvStart || !lvEnd || lvEnd < lvStart || !lvReason.trim()) {
      showToast(sdc('sched.leave.invalid'));
      return;
    }
    setLvBusy(true);
    try {
      await trpc.schedule.leaveRequest.mutate({ kind: lvKind, startDate: lvStart, endDate: lvEnd, reason: lvReason.trim() });
      showToast(sdc('sched.leave.submitted'));
      setLvReason('');
      invalidateAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : sdc('sched.common.loadFail'));
    } finally {
      setLvBusy(false);
    }
  };

  /* ---- 换班发起 ---- */
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapBusy, setSwapBusy] = useState(false);

  const submitSwap = async () => {
    if (!swapFor || !swapReason.trim()) {
      showToast(sdc('sched.swap.invalid'));
      return;
    }
    setSwapBusy(true);
    try {
      await trpc.schedule.swapRequest.mutate({
        assignmentId: swapFor,
        ...(swapTarget ? { toStaffId: swapTarget } : {}),
        reason: swapReason.trim(),
      });
      showToast(sdc('sched.swap.submitted'));
      setSwapFor(null);
      setSwapTarget('');
      setSwapReason('');
      invalidateAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : sdc('sched.common.loadFail'));
    } finally {
      setSwapBusy(false);
    }
  };

  const balanceMinutes = compQuery.data?.balanceMinutes ?? 0;
  const compLogs = compQuery.data?.logs ?? [];
  const availRows = availQuery.data?.availability ?? [];
  const leaveRows = leavesQuery.data?.leaves ?? [];

  return (
    <div className="sk pb-6" data-testid="mysched-page">
      <SkBackBar title={sdc('sched.title')} note={sdc('sched.no')} fallback="/me" />

      {/* 周视图（只读；我的班次高亮） */}
      <section className="mt-3" data-testid="mysched-week">
        <div className="flex items-center gap-2 px-[22px] pb-2">
          <button type="button" className="sk-btn-ghost" onClick={() => setWeekStart(dateStr(addDays(new Date(`${weekStart}T00:00:00`), -7)))}>
            {sdc('sched.myweek.prev')}
          </button>
          <button type="button" className="sk-btn-ghost" onClick={() => setWeekStart(dateStr(mondayOf(new Date())))} data-testid="mysched-week-this">
            {sdc('sched.week.this')}
          </button>
          <button type="button" className="sk-btn-ghost" onClick={() => setWeekStart(dateStr(addDays(new Date(`${weekStart}T00:00:00`), 7)))}>
            {sdc('sched.myweek.next')}
          </button>
          <span
            className={`ml-auto rounded-chip px-1.5 py-0.5 text-caption-xs font-bold ${
              weekPublished ? 'bg-success-light text-success-deep' : 'bg-brand-primary-light text-ink'
            }`}
          >
            {weekPublished ? sdc('sched.myweek.published') : sdc('sched.myweek.draft')}
          </span>
        </div>

        {weekQuery.isPending ? (
          <div className="space-y-2.5 px-[22px]" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="u1-card h-14 !rounded-panel" />
            ))}
          </div>
        ) : weekQuery.isError ? (
          <div className="px-[22px]">
            <div className="u1-card p-4 text-center">
              <p className="text-body-sm text-ink-secondary">{sdc('sched.common.loadFail')}</p>
              <button
                type="button"
                onClick={() => void weekQuery.refetch()}
                className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sdc('sched.common.retry')}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-[22px]">
            {days.map((d) => {
              const rows = (dayMap.get(d) ?? []).sort((a, b) => a.startMin - b.startMin);
              return (
                <div key={d} className="u1-card mb-2 px-4 py-3" data-testid={`mysched-day-${d}`}>
                  <div className="text-caption-xs text-[rgba(59,46,36,.62)]">
                    <span className="sk-mono">{d.slice(5)}</span> {weekdayLabel(new Date(`${d}T00:00:00`))}
                  </div>
                  {rows.length === 0 ? (
                    <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">{sdc('sched.week.rest')}</div>
                  ) : (
                    rows.map((a) => {
                      const mine = a.staffId === myStaffId;
                      return (
                        <div
                          key={a.id}
                          data-testid={mine ? `mysched-shift-${a.id}` : undefined}
                          className={`mt-1.5 flex items-center gap-2 rounded-chip px-2 py-1.5 text-caption ${
                            mine ? 'bg-brand-primary-light font-semibold text-ink' : 'text-[rgba(59,46,36,.62)]'
                          }`}
                        >
                          <span className="sk-mono">
                            {minToHm(a.startMin)}–{minToHm(a.endMin)}
                          </span>
                          <span>{mine ? `${a.staffName}（${sdc('sched.week.mine')}）` : a.staffName}</span>
                          {!a.published ? (
                            <span className="ml-auto text-caption-xs text-[rgba(59,46,36,.42)]">{sdc('sched.myweek.draft')}</span>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 换班发起（我的班次卡 → 选接手员工 + 理由） */}
      {myAssignments.length > 0 ? (
        <section className="mt-4" data-testid="mysched-swap">
          <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{sdc('sched.swap.cta')}</h2>
          <div className="px-[22px]">
            {myAssignments.map((a) => (
              <div key={a.id} className="u1-card mb-2 px-4 py-3">
                <div className="flex items-center gap-2 text-caption">
                  <span className="sk-mono font-bold text-ink">{a.date.slice(5)}</span>
                  <span>{weekdayLabel(new Date(`${a.date}T00:00:00`))}</span>
                  <span className="sk-mono text-[rgba(59,46,36,.62)]">
                    {minToHm(a.startMin)}–{minToHm(a.endMin)}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-caption font-bold text-ink"
                    data-testid={`mysched-swap-open-${a.id}`}
                    onClick={() => setSwapFor((v) => (v === a.id ? null : a.id))}
                  >
                    {swapFor === a.id ? sdc('sched.swap.cancel') : sdc('sched.swap.cta')}
                  </button>
                </div>
                {swapFor === a.id ? (
                  <div className="mt-2.5 border-t border-[rgba(59,46,36,.06)] pt-2.5">
                    <select
                      value={swapTarget}
                      onChange={(e) => setSwapTarget(e.target.value)}
                      aria-label={sdc('sched.swap.pickTarget')}
                      data-testid={`mysched-swap-target-${a.id}`}
                      className="u1-ring h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink"
                    >
                      <option value="">{sdc('sched.swap.openPool')}</option>
                      {colleagues.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={swapReason}
                      onChange={(e) => setSwapReason(e.target.value)}
                      rows={2}
                      maxLength={200}
                      placeholder={sdc('sched.swap.reasonPh')}
                      data-testid={`mysched-swap-reason-${a.id}`}
                      className="u1-ring mt-2 w-full rounded-input bg-card px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-placeholder"
                    />
                    <button
                      type="button"
                      disabled={swapBusy}
                      onClick={() => void submitSwap()}
                      data-testid={`mysched-swap-submit-${a.id}`}
                      className="mt-2 h-12 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
                    >
                      {sdc('sched.swap.submitCta')}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 可用时间维护（周日×时段 chips 编辑器 + 既有列表） */}
      <section className="mt-4" data-testid="mysched-avail">
        <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{sdc('sched.avail.title')}</h2>
        <div className="px-[22px]">
          <div className="u1-card p-4">
            <p className="text-caption-xs text-[rgba(59,46,36,.62)]">{sdc('sched.avail.aside')}</p>
            <div className="mt-2">
              <SkChips testId="mysched-avail-day" value={avWeekday} onChange={setAvWeekday} options={WEEKDAY_OPTIONS} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input type="time" value={avStart} onChange={(e) => setAvStart(e.target.value)} aria-label="开始" data-testid="mysched-avail-start"
                className="u1-ring h-12 min-h-[44px] flex-1 rounded-input bg-card px-3 text-body-sm text-ink" />
              <input type="time" value={avEnd} onChange={(e) => setAvEnd(e.target.value)} aria-label="结束" data-testid="mysched-avail-end"
                className="u1-ring h-12 min-h-[44px] flex-1 rounded-input bg-card px-3 text-body-sm text-ink" />
            </div>
            <input
              value={avNote}
              onChange={(e) => setAvNote(e.target.value)}
              placeholder={sdc('sched.avail.notePh')}
              data-testid="mysched-avail-note"
              className="u1-ring mt-2 h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink placeholder:text-ink-placeholder"
            />
            <button
              type="button"
              disabled={avBusy}
              onClick={() => void saveAvailability()}
              data-testid="mysched-avail-save"
              className="mt-2.5 h-12 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
            >
              {sdc('sched.avail.saveCta')}
            </button>
          </div>
          {availQuery.isPending ? (
            <div className="mt-2" aria-label="加载中">
              <Skeleton className="u1-card h-12 !rounded-panel" />
            </div>
          ) : availRows.length === 0 ? (
            <p className="mt-2 text-caption-xs text-[rgba(59,46,36,.42)]">{sdc('sched.avail.empty')}</p>
          ) : (
            <SkRows testId="mysched-avail-list">
              {availRows.map((r) => (
                <SkRow
                  key={r.id}
                  testId={`mysched-avail-row-${r.id}`}
                  label={`${weekdayName(r.weekday)}${r.note ? ` · ${r.note}` : ''}`}
                  value={
                    <span className="sk-mono">
                      {minToHm(r.startMin)}–{minToHm(r.endMin)}
                    </span>
                  }
                />
              ))}
            </SkRows>
          )}
        </div>
      </section>

      {/* 请假/调休申请 + 我的申请列表 */}
      <section className="mt-4" data-testid="mysched-leave">
        <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{sdc('sched.leave.title')}</h2>
        <div className="px-[22px]">
          <div className="u1-card p-4">
            <SkChips
              testId="mysched-leave-kind"
              value={lvKind}
              onChange={(k) => setLvKind(k as 'leave' | 'comp_off')}
              options={[
                { key: 'leave', label: sdc('sched.leave.kindLeave') },
                { key: 'comp_off', label: sdc('sched.leave.kindCompOff') },
              ]}
            />
            <div className="mt-2 flex items-center gap-2">
              <input type="date" value={lvStart} onChange={(e) => setLvStart(e.target.value)} aria-label={sdc('sched.leave.start')} data-testid="mysched-leave-start"
                className="u1-ring h-12 min-h-[44px] flex-1 rounded-input bg-card px-3 text-body-sm text-ink" />
              <input type="date" value={lvEnd} onChange={(e) => setLvEnd(e.target.value)} aria-label={sdc('sched.leave.end')} data-testid="mysched-leave-end"
                className="u1-ring h-12 min-h-[44px] flex-1 rounded-input bg-card px-3 text-body-sm text-ink" />
            </div>
            <textarea
              value={lvReason}
              onChange={(e) => setLvReason(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder={sdc('sched.leave.reasonPh')}
              data-testid="mysched-leave-reason"
              className="u1-ring mt-2 w-full rounded-input bg-card px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-placeholder"
            />
            <button
              type="button"
              disabled={lvBusy}
              onClick={() => void submitLeave()}
              data-testid="mysched-leave-submit"
              className="mt-2.5 h-12 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
            >
              {lvBusy ? sdc('sched.leave.submitting') : sdc('sched.leave.submitCta')}
            </button>
          </div>

          <h3 className="pb-1.5 pt-3 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{sdc('sched.leave.myList')}</h3>
          {leavesQuery.isPending ? (
            <div aria-label="加载中">
              <Skeleton className="u1-card h-12 !rounded-panel" />
            </div>
          ) : leaveRows.length === 0 ? (
            <SkEmpty title={sdc('sched.leave.empty')} />
          ) : (
            <SkRows testId="mysched-leave-list">
              {leaveRows.map((l) => (
                <SkRow
                  key={l.id}
                  testId={`mysched-leave-row-${l.id}`}
                  tone={l.status === 'rejected' ? 'red' : l.status === 'pending' ? 'mut' : undefined}
                  label={
                    <span>
                      {l.kind === 'comp_off' ? sdc('sched.leave.kindCompOff') : sdc('sched.leave.kindLeave')}
                      <small className="mt-0.5 block text-caption-xs text-[rgba(59,46,36,.42)]">
                        <span className="sk-mono">{l.startDate}</span> ~ <span className="sk-mono">{l.endDate}</span> · {l.reason}
                        {l.status === 'rejected' && l.decideNote ? ` · ${l.decideNote}` : ''}
                      </small>
                    </span>
                  }
                  value={
                    l.status === 'pending'
                      ? sdc('sched.leave.pending')
                      : l.status === 'approved'
                        ? sdc('sched.leave.approved')
                        : sdc('sched.leave.rejected')
                  }
                />
              ))}
            </SkRows>
          )}
        </div>
      </section>

      {/* 调休余额（大字 + 流水 SkRows） */}
      <section className="mt-4" data-testid="mysched-comp">
        <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{sdc('sched.comp.title')}</h2>
        <div className="px-[22px]">
          <div className="u1-card p-4 text-center">
            {compQuery.isPending ? (
              <Skeleton className="mx-auto h-9 w-28 !rounded-[16px]" />
            ) : (
              <div className="sk-mono text-[34px] font-bold leading-10 text-ink" data-testid="mysched-comp-balance">
                {sdc('sched.comp.hours', { h: minToHours(balanceMinutes) })}
              </div>
            )}
          </div>
          <h3 className="pb-1.5 pt-3 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{sdc('sched.comp.entries')}</h3>
          {compQuery.isPending ? (
            <div aria-label="加载中">
              <Skeleton className="u1-card h-12 !rounded-panel" />
            </div>
          ) : compLogs.length === 0 ? (
            <SkEmpty title={sdc('sched.comp.empty')} />
          ) : (
            <SkRows testId="mysched-comp-list">
              {compLogs.map((e) => (
                <SkRow
                  key={e.id}
                  testId={`mysched-comp-row-${e.id}`}
                  tone={e.deltaMinutes < 0 ? 'red' : undefined}
                  label={e.reason}
                  value={<span className="sk-mono">{`${e.deltaMinutes > 0 ? '+' : ''}${minToHours(e.deltaMinutes)}h`}</span>}
                />
              ))}
            </SkRows>
          )}
        </div>
      </section>

      {toastEl}
    </div>
  );
}
