/**
 * 预约管理 /appointments（T4.2 · 开发方案 §2.2）
 *
 * - 视图切换：列表视图（默认）/ 日历视图（月历，日格预约数+状态点，今天高亮，
 *   点日格 → 切列表视图并按当日过滤）。
 * - 筛选：状态 chips（全部/待确认/已确认/服务中/寄养中/取消申请/已完成/已取消）
 *   + 日期范围（今天/明天/本周/自定义起止）。
 * - 列表行紧凑（时间/宠物/服务/客户/员工/状态/金额）；待确认行品牌色高亮边框
 *   + 行内「确认」一键 confirm（≤30 秒操作路径关键）。
 * - 横屏双栏（lg+）：左列表右选中详情摘要；手机点行进详情页。
 * - SSE（store 频道）：appointment.created / cancel_requested → invalidate + 红点 toast；
 *   其他预约状态事件 → invalidate；断线重连 onReconnect 全量对齐。
 */

import { EventType, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, List } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppointmentRow } from '../components/appointments/AppointmentRow';
import { buildDayStats, CalendarView } from '../components/appointments/CalendarView';
import { DetailSummary } from '../components/appointments/DetailSummary';
import { StatusChips, type StatusFilter } from '../components/appointments/StatusChips';
import { showToast, ToastHost } from '../components/appointments/Toast';
import { useMerchantEvents } from '../components/appointments/useMerchantEvents';
import {
  addDays,
  localDayKey,
  RANGE_LABEL,
  rangeToDates,
  type ApptStatus,
  type RangeKey,
} from '../components/appointments/appt-utils';

const RANGE_KEYS: RangeKey[] = ['today', 'tomorrow', 'week', 'custom'];

/** 需要列表静默 invalidate 的预约状态事件（store 频道可达） */
const QUIET_INVALIDATE = new Set<string>([
  EventType.AppointmentConfirmed,
  EventType.AppointmentAssigned,
  EventType.AppointmentCheckedIn,
  EventType.AppointmentCompleted,
  EventType.AppointmentCancelled,
  EventType.AppointmentRescheduled,
  EventType.AppointmentPaid,
  EventType.AppointmentReviewed,
]);

const todayStr = () => localDayKey(new Date());

export default function AppointmentsPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const navigate = useNavigate();

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [rangeKey, setRangeKey] = useState<RangeKey>('today');
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [month, setMonth] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ---------------- 列表查询 ---------------- */

  const range = useMemo(
    () => rangeToDates(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );

  const listQuery = useQuery({
    queryKey: [
      'appointment',
      'listForStore',
      { from: range.from.toISOString(), to: range.to.toISOString(), status },
    ],
    queryFn: () =>
      trpc.appointment.listForStore.query({
        from: range.from,
        to: range.to,
        ...(status === 'all' ? {} : { status: status as ApptStatus }),
      }),
    enabled: view === 'list',
  });

  /* ---------------- 日历查询（整月 + 前后溢出格） ---------------- */

  const monthRange = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const from = addDays(first, -((first.getDay() + 6) % 7));
    const to = new Date(addDays(from, 42).getTime() - 1);
    return { from, to };
  }, [month]);

  const calQuery = useQuery({
    queryKey: [
      'appointment',
      'listForStore',
      'calendar',
      { from: monthRange.from.toISOString(), status },
    ],
    queryFn: () =>
      trpc.appointment.listForStore.query({
        from: monthRange.from,
        to: monthRange.to,
        ...(status === 'all' ? {} : { status: status as ApptStatus }),
      }),
    enabled: view === 'calendar',
  });

  const dayStats = useMemo(() => buildDayStats(calQuery.data ?? []), [calQuery.data]);

  /* ---------------- 行内一键确认（≤30 秒操作路径） ---------------- */

  const invalidateLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'listForStore'] });
    // 仪表盘待办聚合同步刷新（T4.1 的 dashboardStats；未挂载时无副作用）
    void queryClient.invalidateQueries({ queryKey: ['store', 'dashboardStats'] });
  }, [queryClient]);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmMut = useMutation({
    mutationFn: (appointmentId: string) => trpc.appointment.confirm.mutate({ appointmentId }),
    onMutate: (appointmentId) => setConfirmingId(appointmentId),
    onSettled: () => setConfirmingId(null),
    onSuccess: () => {
      showToast('已确认预约', 'success');
      invalidateLists();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : '确认失败，请稍后再试', 'error'),
  });

  /* ---------------- SSE：store 频道 ---------------- */

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      switch (envelope.type) {
        case EventType.AppointmentCreated:
          invalidateLists();
          showToast(
            `新预约到店：${typeof data.petName === 'string' ? data.petName : '宠物'} · ${
              typeof data.serviceName === 'string' ? data.serviceName : '服务'
            }，待确认`,
            'alert',
          );
          break;
        case EventType.AppointmentCancelRequested:
          invalidateLists();
          showToast(
            `${typeof data.petName === 'string' ? data.petName : '客户'} 申请取消预约，待审核`,
            'alert',
          );
          break;
        default:
          if (QUIET_INVALIDATE.has(envelope.type)) invalidateLists();
          break;
      }
    },
    [invalidateLists],
  );

  useMerchantEvents({ onEvent, onReconnect: invalidateLists });

  /* ---------------- 交互 ---------------- */

  const isLg = () => window.matchMedia('(min-width: 1024px)').matches;

  const openItem = (id: string) => {
    if (isLg()) setSelectedId(id);
    else navigate(`/appointments/${id}`);
  };

  /** 日历点日 → 切列表视图 + 自定义范围=当日 */
  const pickDay = (d: Date) => {
    const key = localDayKey(d);
    setCustomFrom(key);
    setCustomTo(key);
    setRangeKey('custom');
    setView('list');
  };

  const items = listQuery.data ?? [];
  const selected = items.find((i) => i.id === selectedId) ?? null;

  /* ---------------- 渲染 ---------------- */

  return (
    <div className="px-4 py-4 lg:px-6">
      <ToastHost />

      {/* 页头：标题 + 视图切换 */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-title-lg">预约管理</h1>
        <div className="flex rounded-full bg-sunken p-0.5" role="tablist" aria-label="视图切换">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            onClick={() => setView('list')}
            className={`flex h-8 items-center gap-1 rounded-full px-3 text-caption transition-colors ${
              view === 'list' ? 'bg-card font-semibold text-ink shadow-card' : 'text-ink-secondary'
            }`}
          >
            <List className="h-4 w-4" strokeWidth={1.5} />
            列表
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'calendar'}
            onClick={() => setView('calendar')}
            className={`flex h-8 items-center gap-1 rounded-full px-3 text-caption transition-colors ${
              view === 'calendar' ? 'bg-card font-semibold text-ink shadow-card' : 'text-ink-secondary'
            }`}
          >
            <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
            日历
          </button>
        </div>
      </div>

      {/* 筛选：状态 chips + 日期范围 */}
      <StatusChips value={status} onChange={setStatus} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {RANGE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setRangeKey(k)}
            className={`h-8 rounded-full px-3 text-caption transition-colors ${
              rangeKey === k
                ? 'bg-brand-primary-light font-semibold text-brand-primary'
                : 'bg-card text-ink-secondary shadow-card hover:bg-sunken'
            }`}
          >
            {RANGE_LABEL[k]}
          </button>
        ))}
        {rangeKey === 'custom' ? (
          <span className="flex items-center gap-1 text-caption text-ink-secondary">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-input border border-line bg-card px-2 font-number text-caption text-ink"
              aria-label="开始日期"
            />
            至
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-input border border-line bg-card px-2 font-number text-caption text-ink"
              aria-label="结束日期"
            />
          </span>
        ) : null}
      </div>

      {/* 主体 */}
      {view === 'calendar' ? (
        <div className="mt-3">
          {calQuery.isPending ? (
            <p className="py-16 text-center text-caption text-ink-secondary">加载中…</p>
          ) : (
            <CalendarView
              month={month}
              stats={dayStats}
              onMonthChange={setMonth}
              onPickDay={pickDay}
            />
          )}
        </div>
      ) : (
        <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-4">
          {/* 左：列表 */}
          <div className="flex flex-col gap-2">
            {listQuery.isPending ? (
              <p className="py-16 text-center text-caption text-ink-secondary">加载中…</p>
            ) : listQuery.isError ? (
              <p className="py-16 text-center text-caption text-danger-deep">
                {listQuery.error instanceof Error ? listQuery.error.message : '加载失败'}
              </p>
            ) : items.length === 0 ? (
              <div className="rounded-card bg-card py-16 text-center shadow-card">
                <p className="text-body text-ink-placeholder">该条件下暂无预约</p>
                <p className="mt-1 text-caption text-ink-placeholder">可调整状态或日期范围</p>
              </div>
            ) : (
              items.map((item) => (
                <AppointmentRow
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  confirming={confirmingId === item.id}
                  onOpen={() => openItem(item.id)}
                  onConfirm={(id) => confirmMut.mutate(id)}
                />
              ))
            )}
          </div>

          {/* 右（lg+）：选中详情摘要 */}
          <aside className="sticky top-4 hidden lg:block">
            <DetailSummary
              item={selected}
              confirming={confirmingId === selected?.id}
              onConfirm={(id) => confirmMut.mutate(id)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
