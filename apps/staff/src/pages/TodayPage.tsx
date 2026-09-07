/**
 * 今日任务页（契约 docs/STAFF-CONTRACTS.md · T3.1）—— 路由 /today
 *
 * - 顶部常驻「扫码核销」大按钮（≥64px 品牌渐变，icon+文字）→ 打开 QrScanner（契约 1，
 *   T3.2 实现），核销成功按服务端 nextRoute 跳转（grooming→/execute/:id，
 *   boarding→/boarding/:id/checkin）。
 * - 今日任务时间轴：appointment.listTodayForStaff（服务端已按 scheduledStart 升序），
 *   卡片见 components/today/TodayTaskCard；空态见 EmptyToday。
 * - 未来 7 天视图（v1.1-b3 B3-5 W-16 员工排班前瞻）：「今日 / 未来 7 天」分段切换；
 *   数据源复用 appointment.listForStaff（本店已派本人单，明天 00:00 起 7 天），
 *   按日分组、组内按 scheduledStart 升序；只读（无核销/执行按钮），已取消单不进列表。
 * - SSE（useStaffEvents：push.subscribe appType='staff' + /api/events）：
 *   appointment.assigned / rescheduled / cancelled → invalidate 今日列表 + toast；
 *   step_flagged → toast「商家要求重拍：{步骤名}」；断线重连全量对齐；60s 轮询兜底。
 */

import {
  EventType,
  StepKeyLabel,
  usePhiliaClient,
  type EventEnvelope,
} from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { ScanLine, UserRound } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyToday from '@/components/today/EmptyToday';
import Toast, { useToast } from '@/components/today/Toast';
import TodayTaskCard from '@/components/today/TodayTaskCard';
import StatusCapsule from '@/components/today/StatusCapsule';
import { useStaffEvents } from '@/components/today/useStaffEvents';
import { hhmm, mmdd, todayLabel, weekdayLabel, type HistoryItem } from '@/components/today/utils';

// 契约1：QrScanner（T3.2 components/scan/QrScanner.tsx）懒加载接入
const QrScanner = lazy(() => import('@/components/scan/QrScanner'));

const TODAY_QUERY_KEY = ['appointment', 'listTodayForStaff'] as const;
/** B3-5（W-16）：未来 7 天视图查询键 */
const WEEK_QUERY_KEY = ['appointment', 'listForStaff', 'upcoming7'] as const;

/** 本地日界 00:00 */
const dayStartOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** B3-5（W-16）：未来 7 天分组的只读卡片（无核销/执行按钮） */
function UpcomingCard({ item }: { item: HistoryItem }) {
  return (
    <li className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="font-number text-body-lg tabular-nums">{hhmm(item.scheduledStart)}</p>
        <StatusCapsule status={item.status} />
      </div>
      <p className="mt-1 text-body-lg font-semibold">
        {item.petName ?? '宠物'}
        <span className="font-normal text-ink-secondary"> · {item.serviceName ?? '服务'}</span>
      </p>
      {item.note ? (
        <p className="mt-1 rounded-tag bg-sunken px-2 py-1 text-body text-ink-secondary">
          客户备注：{item.note}
        </p>
      ) : null}
    </li>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();
  const [scanOpen, setScanOpen] = useState(false);
  // B3-5（W-16）：今日 / 未来 7 天 视图切换
  const [view, setView] = useState<'today' | 'week'>('today');

  const todayQuery = useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: () => trpc.appointment.listTodayForStaff.query(),
    refetchInterval: 60_000, // 弱网 / SSE 断线兜底轮询
  });

  // B3-5（W-16）：未来 7 天 = 明天 00:00 起 7 天（今天已由今日时间轴覆盖）；
  // 复用 listForStaff（本店已派本人单），只读展示
  const weekRange = useMemo(() => {
    const from = new Date(dayStartOf(new Date()).getTime() + 24 * 3600 * 1000);
    const to = new Date(dayStartOf(new Date()).getTime() + 8 * 24 * 3600 * 1000 - 1);
    return { from, to };
  }, []);
  const weekQuery = useQuery({
    queryKey: [...WEEK_QUERY_KEY, weekRange.from.getTime()],
    queryFn: () =>
      trpc.appointment.listForStaff.query({ from: weekRange.from, to: weekRange.to }),
    enabled: view === 'week',
    refetchInterval: 60_000,
  });
  /** 按日分组（组间日期升序、组内按 scheduledStart 升序；已取消不进前瞻列表） */
  const weekGroups = useMemo(() => {
    const rows = (weekQuery.data ?? []).filter((r) => r.status !== 'cancelled');
    const map = new Map<string, HistoryItem[]>();
    for (const r of rows) {
      const key = `${r.scheduledStart.getFullYear()}-${r.scheduledStart.getMonth()}-${r.scheduledStart.getDate()}`;
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return [...map.values()]
      .map((items) => ({
        date: items[0]!.scheduledStart,
        items: [...items].sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime()),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [weekQuery.data]);

  const invalidateToday = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY });
    // W-16：派单/改期/取消事件同样影响未来 7 天视图
    void queryClient.invalidateQueries({ queryKey: WEEK_QUERY_KEY });
  }, [queryClient]);

  // 事件去重：envelope.id Set（FIFO 500；续传补发/多端同事件会重复到达）
  const seenRef = useRef<{ set: Set<string>; queue: string[] }>({ set: new Set(), queue: [] });
  const markSeen = useCallback((id: string): boolean => {
    const s = seenRef.current;
    if (s.set.has(id)) return false;
    s.set.add(id);
    s.queue.push(id);
    if (s.queue.length > 500) {
      const oldest = s.queue.shift();
      if (oldest) s.set.delete(oldest);
    }
    return true;
  }, []);

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      if (!markSeen(envelope.id)) return;
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      switch (envelope.type) {
        case EventType.AppointmentAssigned: {
          const petName = typeof data.petName === 'string' ? data.petName : '';
          showToast(petName ? `新派单：${petName}` : '收到新派单，请查看今日任务');
          invalidateToday();
          break;
        }
        case EventType.AppointmentRescheduled:
          showToast('有预约改期，请查看最新安排');
          invalidateToday();
          break;
        case EventType.AppointmentCancelled:
          showToast('有预约已取消');
          invalidateToday();
          break;
        case EventType.StepFlagged: {
          const stepKey = typeof data.stepKey === 'string' ? data.stepKey : '';
          const stepName = StepKeyLabel[stepKey] ?? (stepKey || '步骤');
          showToast(`商家要求重拍：${stepName}`);
          invalidateToday();
          break;
        }
        default:
          break;
      }
    },
    [invalidateToday, markSeen, showToast],
  );

  useStaffEvents({ onEvent, onReconnect: invalidateToday });

  /** 打开扫码核销（QrScanner 契约 1） */
  const openScanner = () => {
    setScanOpen(true);
  };

  const items = todayQuery.data ?? [];

  return (
    <div className="px-4 pb-6">
      <header className="flex items-start justify-between pt-6">
        <div>
          <h1 className="text-title-lg">今日任务</h1>
          <p className="mt-1 text-body text-ink-secondary">
            {todayLabel(new Date())} · 共 {items.length} 单
          </p>
        </div>
        {/* /me 入口（员工端 TabBar 按方案为 3 栏，我的页从这里进） */}
        <Link
          to="/me"
          aria-label="我的"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink-secondary shadow-card active:scale-95"
        >
          <UserRound className="h-5 w-5" strokeWidth={1.5} />
        </Link>
      </header>

      {/* 顶部常驻「扫码核销」大按钮（≥64px 品牌渐变，拇指热区） */}
      <button
        type="button"
        onClick={openScanner}
        className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-full bg-philia-gradient text-body-lg font-semibold text-white shadow-philia transition active:scale-[0.98]"
      >
        <ScanLine className="h-6 w-6" strokeWidth={1.5} />
        扫码核销
      </button>

      {/* B3-5（W-16）：今日 / 未来 7 天 视图切换（员工排班前瞻，只读） */}
      <div className="mt-4 flex rounded-full bg-sunken p-1" role="tablist" aria-label="任务视图">
        {(
          [
            { key: 'today', label: '今日' },
            { key: 'week', label: '未来 7 天' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={view === t.key}
            onClick={() => setView(t.key)}
            className={`h-11 flex-1 rounded-full text-body-lg transition active:scale-[0.98] ${
              view === t.key ? 'bg-card font-semibold text-brand-primary shadow-card' : 'text-ink-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'week' ? (
        weekQuery.isPending ? (
          <div className="mt-6 space-y-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse rounded-card bg-card p-4 shadow-card">
                <div className="h-5 w-24 rounded-tag bg-sunken" />
                <div className="mt-2 h-5 w-44 rounded-tag bg-sunken" />
              </div>
            ))}
          </div>
        ) : weekQuery.isError ? (
          <div className="mt-6 rounded-card bg-card p-6 text-center shadow-card">
            <p className="text-body-lg text-ink-secondary">未来 7 天安排加载失败，请检查网络后重试</p>
            <button
              type="button"
              onClick={() => void weekQuery.refetch()}
              className="mt-4 h-14 min-w-[160px] rounded-full bg-brand-primary px-8 text-body-lg font-semibold text-white active:scale-[0.98]"
            >
              重新加载
            </button>
          </div>
        ) : weekGroups.length === 0 ? (
          <div className="mt-6 rounded-card bg-card px-6 py-10 text-center shadow-card">
            <span aria-hidden className="text-4xl">
              🗓️
            </span>
            <p className="mt-3 text-body-lg text-ink-secondary">未来 7 天暂无派单</p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {weekGroups.map((g) => (
              <section key={g.date.getTime()}>
                <h2 className="text-body-lg font-semibold text-ink">
                  {mmdd(g.date)} {weekdayLabel(g.date)}
                  <span className="ml-2 text-caption font-normal text-ink-secondary">
                    共 {g.items.length} 单
                  </span>
                </h2>
                <ul className="mt-2 space-y-3">
                  {g.items.map((item) => (
                    <UpcomingCard key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : todayQuery.isPending ? (
        // 加载态：骨架卡
        <div className="mt-6 space-y-3" aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-card bg-card p-4 shadow-card">
              <div className="h-6 w-20 rounded-tag bg-sunken" />
              <div className="mt-2 h-5 w-40 rounded-tag bg-sunken" />
              <div className="mt-3 h-14 w-full rounded-full bg-sunken" />
            </div>
          ))}
        </div>
      ) : todayQuery.isError ? (
        // 失败态：重试
        <div className="mt-6 rounded-card bg-card p-6 text-center shadow-card">
          <p className="text-body-lg text-ink-secondary">今日任务加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={() => void todayQuery.refetch()}
            className="mt-4 h-14 min-w-[160px] rounded-full bg-brand-primary px-8 text-body-lg font-semibold text-white active:scale-[0.98]"
          >
            重新加载
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyToday />
      ) : (
        // 今日任务时间轴（服务端已按 scheduledStart 升序）
        <ol className="relative mt-6 space-y-3 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-0.5 before:bg-line-divider">
          {items.map((item) => (
            <TodayTaskCard key={item.id} item={item} />
          ))}
        </ol>
      )}

      <Toast message={toast} />

      <Suspense fallback={null}>
        <QrScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onCheckedIn={(r) => {
            setScanOpen(false);
            showToast('核销成功');
            navigate(r.nextRoute);
          }}
        />
      </Suspense>
    </div>
  );
}
