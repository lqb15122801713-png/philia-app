/**
 * 打卡考勤 /attendance（批次 员工端2.0 · R7，docs/staff2/R7-R10-DESIGN.md §一.1/§三）
 *
 * 三区结构（mobile-first，单手可达）：
 * 1. 今日班次（auth.me → staff.schedule 周模板，只读）+ 围栏状态（门店坐标 300m，
 *    未配置坐标时明示不校验）；
 * 2. 两大打卡钮（≥56px 全宽，「≤2 击」：点按 → navigator.geolocation 浏览器原生定位
 *    → attendance.mark → toast「已打卡，辛苦了」）；定位失败给明确文案+重试钮（不转死圈）；
 *    围栏外 server 拒写，错误文案原样透出（「不在门店范围，无法打卡」）；当日已打的卡种置灰；
 *    deviceId = localStorage 'philia-device-id' 惰性 UUID；
 * 3. 本月记录（myRecords：按日聚合 上/下班 + 状态签 正常/迟到/早退/补卡；缺卡日由
 *    endpoint missingDays 给出；补卡行视觉区分；flagged=防代打「标记」chip 只标记不阻断）；
 * 4. 补卡申请（requestMakeup：限当月 date min/max、班次 kind、实际时间 time、原因必填；
 *    剩余额度 3 次/月由 myApprovals 前端计算；结果列表透出审批状态与备注）。
 */

import { usePhiliaClient } from '@philia/shared';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarClock, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import Toast, { useToast } from '@/components/today/Toast';
import { dayKeyOf, hhmm, pad2, weekdayLabel } from '@/components/today/utils';

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

/** 打卡记录状态签（补卡优先于 normal 展示） */
function StatusChip({ r }: { r: AttRecord }) {
  if (r.makeup) {
    return (
      <b className="rounded-chip bg-brand-secondary-light px-1.5 py-0.5 text-caption-xs font-bold text-ink">
        补卡
      </b>
    );
  }
  if (r.status === 'late') {
    return <b className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">迟到</b>;
  }
  if (r.status === 'early') {
    return <b className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">早退</b>;
  }
  return <b className="rounded-chip bg-success-light px-1.5 py-0.5 text-caption-xs font-bold text-success-deep">正常</b>;
}

export default function AttendancePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();
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
    if (!('geolocation' in navigator)) {
      setGeoError('当前设备不支持定位，请更换设备或联系店长');
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
            ? '定位权限被拒绝：请在浏览器设置中允许定位后重试'
            : err.code === err.TIMEOUT
              ? '定位超时，请到开阔处重试'
              : '定位失败，请检查定位开关后重试',
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
      ? '打卡范围：门店 300 米内'
      : '门店未配置坐标，本次打卡不校验距离';

  const punchBtnCls = (disabled: boolean) =>
    `flex h-14 min-h-[56px] w-full items-center justify-center rounded-control text-body-lg font-bold transition-transform duration-120 ease-philia-spring ${
      disabled ? 'bg-sunken text-ink-placeholder' : 'active:scale-92'
    }`;

  return (
    <div className="pb-6">
      <PageHeader title="打卡考勤" backTo="/me" aside={`${now.getMonth() + 1}月`} />

      <div className="px-[22px]">
        {/* 今日班次 + 围栏状态 */}
        <section className="u1-card mt-2.5 p-4" data-testid="att-today">
          <p className="flex items-center gap-1.5 text-body-sm font-bold">
            <CalendarClock className="h-4 w-4 text-[rgba(74,59,46,.62)]" strokeWidth={1.8} aria-hidden />
            今日班次
            <span className="u1-num ml-auto font-bold text-ink">
              {todayShifts.length ? todayShifts.map((s) => `${s.start}–${s.end}`).join(' / ') : '今日无排班'}
            </span>
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            {fenceText} · {store?.name ?? '门店'}
          </p>
        </section>

        {/* 两大打卡钮（≤2 击：点按 → 定位 → 打卡 → toast） */}
        <section className="mt-3.5 grid gap-3" data-testid="att-actions">
          <button
            type="button"
            disabled={busy !== null || !!todayIn}
            onClick={() => punch('in')}
            className={`${punchBtnCls(busy !== null || !!todayIn)} ${todayIn ? '' : 'bg-brand-primary text-ink'}`}
            data-testid="att-punch-in"
          >
            {busy === 'in' ? '定位打卡中…' : todayIn ? `已打上班卡 ${hhmm(todayIn.ts)}` : '上班打卡'}
          </button>
          <button
            type="button"
            disabled={busy !== null || !!todayOut}
            onClick={() => punch('out')}
            className={`${punchBtnCls(busy !== null || !!todayOut)} ${todayOut ? '' : 'bg-brand-secondary text-ink'}`}
            data-testid="att-punch-out"
          >
            {busy === 'out' ? '定位打卡中…' : todayOut ? `已打下班卡 ${hhmm(todayOut.ts)}` : '下班打卡'}
          </button>
          {geoError ? (
            <div className="u1-card p-4 text-center" role="alert">
              <p className="text-body-sm font-semibold text-danger-deep">{geoError}</p>
              <button
                type="button"
                onClick={() => punch(pendingKind ?? 'in')}
                className="mt-3 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                重试打卡
              </button>
            </div>
          ) : null}
        </section>

        {/* 本月记录 */}
        <section className="mt-5" data-testid="att-records">
          <h2 className="pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(74,59,46,.42)]">本月记录</h2>
          {recordsQuery.isPending ? (
            <div className="space-y-2.5" aria-label="加载中">
              {[0, 1, 2].map((i) => (
                <div key={i} className="u1-card h-16 animate-pulse bg-sunken" />
              ))}
            </div>
          ) : recordsQuery.isError ? (
            <div className="u1-card p-6 text-center">
              <p className="text-body-sm text-ink-secondary">考勤记录加载失败，请检查网络后重试</p>
              <button
                type="button"
                onClick={() => void recordsQuery.refetch()}
                className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                重新加载
              </button>
            </div>
          ) : dayRows.length === 0 && missingDays.length === 0 ? (
            <div className="u1-card p-6 text-center">
              <p className="text-body-sm text-ink-secondary">本月还没有考勤记录——到店后点上方按钮打卡</p>
            </div>
          ) : (
            <ul>
              {dayRows.map((d) => {
                const dateObj = new Date(`${d.date}T00:00:00`);
                const flagged = d.in?.flagged || d.out?.flagged;
                const makeup = d.in?.makeup || d.out?.makeup;
                return (
                  <li
                    key={d.date}
                    className={`u1-card mb-2.5 px-4 py-3.5 ${makeup ? 'bg-oak-light' : ''}`}
                    data-testid={`att-day-${d.date}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="u1-num text-body-sm font-bold">{d.date.slice(5)}</span>
                      <span className="text-caption-xs text-[rgba(74,59,46,.42)]">{weekdayLabel(dateObj)}</span>
                      {flagged ? (
                        <b className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">
                          标记
                        </b>
                      ) : null}
                      {makeup ? (
                        <span className="text-caption-xs text-[rgba(74,59,46,.42)]">补卡已通过</span>
                      ) : null}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-caption-xs text-[rgba(74,59,46,.42)]">上班</span>
                        {d.in ? (
                          <>
                            <span className="u1-num text-body-sm font-bold">{hhmm(d.in.ts)}</span>
                            <StatusChip r={d.in} />
                          </>
                        ) : (
                          <span className="text-body-sm text-ink-placeholder">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-caption-xs text-[rgba(74,59,46,.42)]">下班</span>
                        {d.out ? (
                          <>
                            <span className="u1-num text-body-sm font-bold">{hhmm(d.out.ts)}</span>
                            <StatusChip r={d.out} />
                          </>
                        ) : (
                          <span className="text-body-sm text-ink-placeholder">—</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
              {missingDays.map((ds) => (
                <li key={ds} className="u1-card mb-2.5 flex items-center gap-2 px-4 py-3.5" data-testid={`att-missing-${ds}`}>
                  <span className="u1-num text-body-sm font-bold">{ds.slice(5)}</span>
                  <span className="text-caption-xs text-[rgba(74,59,46,.42)]">
                    {weekdayLabel(new Date(`${ds}T00:00:00`))}
                  </span>
                  <b className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">缺卡</b>
                  <span className="ml-auto text-caption-xs text-[rgba(74,59,46,.42)]">可在下方申请补卡</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 补卡申请（限当月，每月 ≤3 次） */}
        <section className="mt-5" data-testid="att-makeup">
          <h2 className="pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(74,59,46,.42)]">
            补卡申请 · 本月还可补 {makeupLeft} 次（每月限 {MAKEUP_MONTHLY_LIMIT} 次）
          </h2>
          <div className="u1-card p-4">
            <label className="block text-caption-xs font-semibold text-[rgba(74,59,46,.62)]" htmlFor="mk-date">
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
            <label className="mt-3 block text-caption-xs font-semibold text-[rgba(74,59,46,.62)]" htmlFor="mk-kind">
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
            <label className="mt-3 block text-caption-xs font-semibold text-[rgba(74,59,46,.62)]" htmlFor="mk-time">
              实际{mkKind === 'in' ? '上班' : '下班'}时间
            </label>
            <input
              id="mk-time"
              type="time"
              value={mkTime}
              onChange={(e) => setMkTime(e.target.value)}
              className="u1-ring mt-1.5 h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink"
            />
            <label className="mt-3 block text-caption-xs font-semibold text-[rgba(74,59,46,.62)]" htmlFor="mk-reason">
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

      <Toast message={toast} />
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
        <span className="text-caption-xs text-[rgba(74,59,46,.62)]">{a.kind === 'in' ? '上班卡' : '下班卡'}</span>
        {a.type === 'makeup' && a.requestedTs ? (
          <span className="u1-num text-caption-xs text-[rgba(74,59,46,.62)]">{hhmm(a.requestedTs)}</span>
        ) : null}
        <span className="ml-auto">{statusChip}</span>
      </div>
      <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">原因：{a.reason}</p>
      {a.status === 'rejected' && a.reviewNote ? (
        <p className="mt-1 text-caption-xs text-danger-deep">驳回备注：{a.reviewNote}</p>
      ) : null}
    </li>
  );
}
