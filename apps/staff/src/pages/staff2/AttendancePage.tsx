/**
 * 打卡考勤 /attendance（S-03 · 员工端骨架整建批片 1 结构组；原批次 员工端2.0 · R7）
 *
 * S-03 骨架（UX 语言包 V1.1 §三）：apphead → S6 打卡卡（SkPunchCard：mono 大钟 34/700
 * 真实时钟 + 班次 mono 9.5 + 围栏胶囊 + btn-action 上下文主钮）→ S7 周记录（SkRows/SkRow，
 * 异常=赭红 tone）→ 补卡口径注（SkNote sk.punchFixNote）。升主级入 dock（App.tsx DOCK_TABS），
 * 返回条摘除；打卡/围栏/补卡申请全部 trpc 调用与逻辑零回退（attendance.mark ≤2 击、
 * geolocation 前置分支、requestMakeup 限当月 ≤3 次/月、myRecords/myApprovals 原样）。
 */

import { Skeleton, usePhiliaClient, useToast } from '@philia/shared';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { SkAppHead, SkNote, SkPunchCard, SkRow, SkRows } from '@/components/skeleton';
import { dayKeyOf, hhmm, pad2, weekdayLabel } from '@/components/today/utils';
import { INSECURE_CONTEXT_GEO_MESSAGE, isSecureContextOk } from '@/lib/secureContext';
import { ATTENDANCE_COPY } from '@/copy/attendance';
import { skc } from '@/copy/skeleton';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AttRecord = RouterOutputs['attendance']['myRecords']['records'][number];
type Approval = RouterOutputs['attendance']['myApprovals'][number];
type Schedule = Partial<Record<string, Array<{ start: string; end: string }> | null>>;

/** 补卡每人每月上限（与 server attendance.MAKEUP_MONTHLY_LIMIT 同值；任务书冻结 3 次/月） */
const MAKEUP_MONTHLY_LIMIT = 3;

const pad = pad2;

/** Date → 本地 YYYY-MM-DD（与 server 月表文本口径一致） */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 惰性设备标识：localStorage 'philia-device-id'，无则 UUID 落库（防代打维度） */
function deviceId(): string {
  const KEY = 'philia-device-id';
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return 'unknown-device';
  }
}

/** 打卡记录状态签（补卡优先于 normal 展示；异常=赭红） */
function StatusChip({ r }: { r: AttRecord }) {
  if (r.makeup) {
    return (
      <b className="rounded-chip bg-brand-secondary-light px-1.5 py-0.5 text-caption-xs font-bold text-ink">
        {ATTENDANCE_COPY['attendance.status.makeup']}
      </b>
    );
  }
  if (r.status === 'late') {
    return <b className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">{ATTENDANCE_COPY['attendance.status.late']}</b>;
  }
  if (r.status === 'early') {
    return <b className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">{ATTENDANCE_COPY['attendance.status.early']}</b>;
  }
  return <b className="rounded-chip bg-success-light px-1.5 py-0.5 text-caption-xs font-bold text-success-deep">{ATTENDANCE_COPY['attendance.status.normal']}</b>;
}

/** attendance 域 copy 取值 + {var} 插值 */
const ac = (key: keyof typeof ATTENDANCE_COPY, vars?: Record<string, string | number>): string => {
  const tpl: string = ATTENDANCE_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
};

export default function AttendancePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();
  const now = useMemo(() => new Date(), []);
  const todayStr = localDateStr(now);
  const monthStr = todayStr.slice(0, 7);

  // 员工详情（staff.schedule 周模板 + 门店坐标，围栏状态展示用）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'staffDetail'],
    queryFn: () => trpc.auth.me.query(),
  });
  const staff = meQuery.data?.staff ?? null;
  const store = meQuery.data?.store ?? null;
  const schedule = staff?.schedule as Schedule | null | undefined;
  const todayShifts = schedule?.[dayKeyOf(now)] ?? [];

  // 本月考勤记录（含缺卡日）
  const recordsQuery = useQuery({
    queryKey: ['attendance', 'myRecords', monthStr],
    queryFn: () => trpc.attendance.myRecords.query({ month: monthStr }),
  });
  // 本人审批（补卡额度 + 结果列表）
  const approvalsQuery = useQuery({
    queryKey: ['attendance', 'myApprovals'],
    queryFn: () => trpc.attendance.myApprovals.query(),
  });

  const records = useMemo(() => recordsQuery.data?.records ?? [], [recordsQuery.data]);
  const missingDays = useMemo(() => recordsQuery.data?.missingDays ?? [], [recordsQuery.data]);
  const approvals = useMemo(() => approvalsQuery.data ?? [], [approvalsQuery.data]);

  const todayIn = records.find((r) => r.date === todayStr && r.kind === 'in') ?? null;
  const todayOut = records.find((r) => r.date === todayStr && r.kind === 'out') ?? null;

  /** 本月补卡额度：pending+approved 的 makeup 申请计入（与 server 同口径） */
  const makeupUsed = approvals.filter(
    (a) => a.type === 'makeup' && (a.status === 'pending' || a.status === 'approved') && a.date.startsWith(monthStr),
  ).length;
  const makeupLeft = Math.max(0, MAKEUP_MONTHLY_LIMIT - makeupUsed);

  /** 按日聚合（新日在前；records 服务端按 date/ts 升序，这里倒序展示） */
  const dayRows = useMemo(() => {
    const map = new Map<string, { date: string; in?: AttRecord; out?: AttRecord }>();
    for (const r of records) {
      const cell = map.get(r.date) ?? { date: r.date };
      if (r.kind === 'in') cell.in = cell.in ?? r;
      else cell.out = cell.out ?? r;
      map.set(r.date, cell);
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [records]);

  /* ---- S6 mono 大钟：真实时钟 1s 自刷 ---- */
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);
  const clockText = `${hhmm(clockNow)}:${pad(clockNow.getSeconds())}`;

  /* ---- S7 周记录：语言包冻结「本周」口径——本周段（周一起）前端过滤，myRecords 接口不动 ---- */
  const weekStartStr = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return localDateStr(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const weekRows = useMemo(() => dayRows.filter((d) => d.date >= weekStartStr), [dayRows, weekStartStr]);
  const weekMissing = useMemo(() => missingDays.filter((ds) => ds >= weekStartStr), [missingDays, weekStartStr]);

  /* ---------------- 打卡（≤2 击） ---------------- */
  const [busy, setBusy] = useState<'in' | 'out' | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<'in' | 'out' | null>(null);

  const markMut = useMutation({
    mutationFn: (input: { kind: 'in' | 'out'; lat: number; lng: number; deviceId: string }) =>
      trpc.attendance.mark.mutate(input),
    onSuccess: (r) => {
      showToast(r.duplicated ? '今日已打过卡，无需重复操作' : '已打卡，辛苦了');
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err) => {
      // server 拒写文案原样透出（如「不在门店范围，无法打卡」），附重试钮不转死圈
      setGeoError(err.message);
    },
    onSettled: () => setBusy(null),
  });

  const punch = (kind: 'in' | 'out') => {
    setGeoError(null);
    setPendingKind(kind);
    // 非安全源前置分支：HTTP 下 geolocation 调用恒回 PERMISSION_DENIED，真因是环境而非权限
    if (!isSecureContextOk()) {
      setGeoError(INSECURE_CONTEXT_GEO_MESSAGE);
      return;
    }
    if (!('geolocation' in navigator)) {
      setGeoError(ATTENDANCE_COPY['attendance.geo.unsupported']);
      return;
    }
    setBusy(kind);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        markMut.mutate({ kind, lat: pos.coords.latitude, lng: pos.coords.longitude, deviceId: deviceId() });
      },
      (err) => {
        setBusy(null);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? ATTENDANCE_COPY['attendance.geo.denied']
            : err.code === err.TIMEOUT
              ? ATTENDANCE_COPY['attendance.geo.timeout']
              : ATTENDANCE_COPY['attendance.geo.failed'],
        );
      },
      { timeout: 10_000, maximumAge: 30_000 },
    );
  };

  /* ---------------- 补卡申请 ---------------- */
  const [mkDate, setMkDate] = useState(todayStr);
  const [mkKind, setMkKind] = useState<'in' | 'out'>('in');
  const [mkTime, setMkTime] = useState('09:00');
  const [mkReason, setMkReason] = useState('');

  const makeupMut = useMutation({
    mutationFn: (input: { date: string; kind: 'in' | 'out'; requestedTs: Date; reason: string }) =>
      trpc.attendance.requestMakeup.mutate(input),
    onSuccess: () => {
      showToast('补卡申请已提交，待店长审批');
      setMkReason('');
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err) => showToast(err.message),
  });

  const submitMakeup = () => {
    if (!mkReason.trim()) {
      showToast('请填写补卡原因');
      return;
    }
    const [h, m] = mkTime.split(':').map((s) => parseInt(s, 10));
    const ts = new Date(`${mkDate}T00:00:00`);
    ts.setHours(h || 0, m || 0, 0, 0);
    makeupMut.mutate({ date: mkDate, kind: mkKind, requestedTs: ts, reason: mkReason.trim() });
  };

  const fenceText =
    store && store.lat !== null && store.lng !== null
      ? ATTENDANCE_COPY['attendance.fence.range']
      : ATTENDANCE_COPY['attendance.fence.noCoord'];

  /* ---- S6 打卡卡上下文主钮（两击确认：点按 → 定位 → 打卡；已打卡种自动轮到下一种） ---- */
  const nextKind: 'in' | 'out' | null = !todayIn ? 'in' : !todayOut ? 'out' : null;
  const shiftParts: string[] = [
    todayShifts.length
      ? ac('attendance.shift.line', { range: todayShifts.map((s) => `${s.start}–${s.end}`).join(' / ') })
      : ac('attendance.shift.none'),
  ];
  if (todayIn) shiftParts.push(ac('attendance.punch.doneIn', { time: hhmm(todayIn.ts) }));
  if (todayOut) shiftParts.push(ac('attendance.punch.doneOut', { time: hhmm(todayOut.ts) }));
  const ctaText = busy
    ? ac('attendance.punch.busy')
    : nextKind === 'in'
      ? skc('sk.punchIn')
      : nextKind === 'out'
        ? skc('sk.punchOut')
        : ac('attendance.punch.allDone');

  /** 行内状态签：仅异常/补卡透出（正常不铺 chip 噪音） */
  const chipOf = (r?: AttRecord) => (r && (r.makeup || r.status !== 'normal') ? <StatusChip r={r} /> : null);

  return (
    <div className="sk pb-6">
      <SkAppHead title={skc('sk.punchTitle')} no={skc('sk.punchNo')} />

      {/* S6 打卡卡（mono 大钟 34/700 + 班次 mono 9.5 + 围栏胶囊 + btn-action；wrapper 保留 att-today/att-actions 既有 testid 锚点） */}
      <div data-testid="att-today">
        <div data-testid="att-actions">
          <SkPunchCard
            clock={clockText}
            shiftLine={shiftParts.join(' · ')}
            fence={{ text: `${fenceText} · ${store?.name ?? '门店'}`, ok: !!(store && store.lat !== null && store.lng !== null) }}
            cta={ctaText}
            onCta={nextKind ? () => punch(nextKind) : undefined}
            ctaDisabled={busy !== null || nextKind === null}
            ctaTestId={nextKind === 'in' ? 'att-punch-in' : nextKind === 'out' ? 'att-punch-out' : 'att-punch-done'}
          />
        </div>
      </div>

      {/* 定位/围栏失败：错误文案原样透出（赭红仅异常）+ 重试钮（不转死圈） */}
      {geoError ? (
        <div className="px-[22px]">
          <div className="u1-card mt-3 p-4 text-center" role="alert">
            <p className="text-body-sm font-semibold text-danger-deep">{geoError}</p>
            <button
              type="button"
              onClick={() => punch(pendingKind ?? 'in')}
              className="mt-3 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              重试打卡
            </button>
          </div>
        </div>
      ) : null}

      {/* S7 周记录（SkRows/SkRow；异常标红；缺卡日透出） */}
      <section className="mt-5" data-testid="att-records">
        <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{skc('sk.punchWeek')}</h2>
        {recordsQuery.isPending ? (
          <div className="space-y-2.5 px-[22px]" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="u1-card h-16 !rounded-panel" />
            ))}
          </div>
        ) : recordsQuery.isError ? (
          <div className="px-[22px]">
            <div className="u1-card p-4 text-center">
              <p className="text-body-sm text-ink-secondary">考勤记录加载失败，请检查网络后重试</p>
              <button
                type="button"
                onClick={() => void recordsQuery.refetch()}
                className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                重新加载
              </button>
            </div>
          </div>
        ) : weekRows.length === 0 && weekMissing.length === 0 ? (
          <div className="px-[22px]">
            <div className="u1-card p-4 text-center">
              <p className="text-body-sm text-ink-secondary">{ATTENDANCE_COPY['attendance.week.empty']}</p>
            </div>
          </div>
        ) : (
          <SkRows>
            {weekRows.map((d) => {
              const dateObj = new Date(`${d.date}T00:00:00`);
              const flagged = d.in?.flagged || d.out?.flagged;
              const makeup = d.in?.makeup || d.out?.makeup;
              const abnormal = !!(flagged || d.in?.status === 'late' || d.out?.status === 'early');
              return (
                <SkRow
                  key={d.date}
                  testId={`att-day-${d.date}`}
                  tone={abnormal ? 'red' : undefined}
                  label={
                    <>
                      <span className="sk-mono">{d.date.slice(5)}</span> {weekdayLabel(dateObj)}
                      {flagged ? (
                        <b className="ml-1.5 rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">
                          {ATTENDANCE_COPY['attendance.records.flagged']}
                        </b>
                      ) : null}
                      {makeup ? (
                        <span className="ml-1.5 text-caption-xs text-[rgba(59,46,36,.42)]">{ATTENDANCE_COPY['attendance.records.makeupPassed']}</span>
                      ) : null}
                    </>
                  }
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      {d.in ? <>{hhmm(d.in.ts)}{chipOf(d.in)}</> : '—'}
                      {' / '}
                      {d.out ? <>{hhmm(d.out.ts)}{chipOf(d.out)}</> : '—'}
                    </span>
                  }
                />
              );
            })}
            {weekMissing.map((ds) => (
              <SkRow
                key={ds}
                testId={`att-missing-${ds}`}
                tone="red"
                label={
                  <>
                    <span className="sk-mono">{ds.slice(5)}</span> {weekdayLabel(new Date(`${ds}T00:00:00`))}
                    <span className="ml-1.5 text-caption-xs font-normal text-[rgba(59,46,36,.42)]">{ATTENDANCE_COPY['attendance.records.missingHint']}</span>
                  </>
                }
                value={ATTENDANCE_COPY['attendance.records.missing']}
              />
            ))}
          </SkRows>
        )}
      </section>

      {/* 补卡口径注（SkNote；补卡申请真功能保留在下方） */}
      <SkNote>{skc('sk.punchFixNote')}</SkNote>

      <div className="px-[22px]">
        <section className="mt-5" data-testid="att-makeup">
          <h2 className="pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">
            补卡申请 · 本月还可补 <span className="u1-num">{makeupLeft}</span> 次（每月限 <span className="u1-num">{MAKEUP_MONTHLY_LIMIT}</span> 次）
          </h2>
          <div className="u1-card p-4">
            <label className="block text-caption-xs font-semibold text-[rgba(59,46,36,.62)]" htmlFor="mk-date">
              补卡日期（限当月）
            </label>
            <input
              id="mk-date"
              type="date"
              value={mkDate}
              min={`${monthStr}-01`}
              max={todayStr}
              onChange={(e) => setMkDate(e.target.value)}
              className="u1-ring mt-1.5 h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink"
            />
            <label className="mt-3 block text-caption-xs font-semibold text-[rgba(59,46,36,.62)]" htmlFor="mk-kind">
              班次
            </label>
            <select
              id="mk-kind"
              value={mkKind}
              onChange={(e) => setMkKind(e.target.value as 'in' | 'out')}
              className="u1-ring mt-1.5 h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink"
            >
              <option value="in">上班卡</option>
              <option value="out">下班卡</option>
            </select>
            <label className="mt-3 block text-caption-xs font-semibold text-[rgba(59,46,36,.62)]" htmlFor="mk-time">
              实际{mkKind === 'in' ? '上班' : '下班'}时间
            </label>
            <input
              id="mk-time"
              type="time"
              value={mkTime}
              onChange={(e) => setMkTime(e.target.value)}
              className="u1-ring mt-1.5 h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink"
            />
            <label className="mt-3 block text-caption-xs font-semibold text-[rgba(59,46,36,.62)]" htmlFor="mk-reason">
              补卡原因（必填）
            </label>
            <textarea
              id="mk-reason"
              value={mkReason}
              onChange={(e) => setMkReason(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="例如：到店后忙于接待忘记打卡"
              className="u1-ring mt-1.5 w-full rounded-input bg-card px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-placeholder"
            />
            <button
              type="button"
              disabled={makeupMut.isPending || makeupLeft <= 0}
              onClick={submitMakeup}
              className={`mt-3 h-14 min-h-[56px] w-full rounded-control text-body-lg font-bold transition-transform duration-120 ease-philia-spring ${
                makeupMut.isPending || makeupLeft <= 0
                  ? 'bg-sunken text-ink-placeholder'
                  : 'bg-brand-primary text-ink active:scale-92'
              }`}
              data-testid="att-makeup-submit"
            >
              {makeupMut.isPending ? '提交中…' : makeupLeft <= 0 ? '本月补卡次数已用完' : '提交补卡申请'}
            </button>
          </div>

          {/* 申请结果（审批状态 + 备注） */}
          {approvals.length > 0 ? (
            <ul className="mt-2.5">
              {approvals.map((a) => (
                <ApprovalRow key={a.id} a={a} />
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      {toastEl}
    </div>
  );
}

function ApprovalRow({ a }: { a: Approval }) {
  const statusChip =
    a.status === 'pending' ? (
      <b className="rounded-chip bg-brand-primary-light px-1.5 py-0.5 text-caption-xs font-bold text-ink">待审批</b>
    ) : a.status === 'approved' ? (
      <b className="rounded-chip bg-success-light px-1.5 py-0.5 text-caption-xs font-bold text-success-deep">已通过</b>
    ) : (
      <b className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">已驳回</b>
    );
  return (
    <li className="u1-card mb-2.5 px-4 py-3.5" data-testid={`att-approval-${a.id}`}>
      <div className="flex items-center gap-2">
        <b className="rounded-chip bg-sunken px-1.5 py-0.5 text-caption-xs font-bold text-ink">
          {a.type === 'makeup' ? '补卡' : '异常'}
        </b>
        <span className="u1-num text-body-sm font-bold">{a.date}</span>
        <span className="text-caption-xs text-[rgba(59,46,36,.62)]">{a.kind === 'in' ? '上班卡' : '下班卡'}</span>
        {a.type === 'makeup' && a.requestedTs ? (
          <span className="u1-num text-caption-xs text-[rgba(59,46,36,.62)]">{hhmm(a.requestedTs)}</span>
        ) : null}
        <span className="ml-auto">{statusChip}</span>
      </div>
      <p className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.62)]">原因：{a.reason}</p>
      {a.status === 'rejected' && a.reviewNote ? (
        <p className="mt-1 text-caption-xs text-danger-deep">驳回备注：{a.reviewNote}</p>
      ) : null}
    </li>
  );
}
