/**
 * 今日任务页（契约 docs/STAFF-CONTRACTS.md · T3.1）—— 路由 /today
 *
 * - 顶部常驻「扫码核销」大按钮（≥64px 品牌渐变，icon+文字）→ 打开 QrScanner（契约 1，
 *   T3.2 实现），核销成功按服务端 nextRoute 跳转（grooming→/execute/:id，
 *   boarding→/boarding/:id/checkin）。
 * - 今日任务时间轴：appointment.listTodayForStaff（服务端已按 scheduledStart 升序），
 *   卡片见 components/today/TodayTaskCard；空态见 EmptyToday。
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
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyToday from '@/components/today/EmptyToday';
import Toast, { useToast } from '@/components/today/Toast';
import TodayTaskCard from '@/components/today/TodayTaskCard';
import { useStaffEvents } from '@/components/today/useStaffEvents';
import { todayLabel } from '@/components/today/utils';

// 契约1：QrScanner（T3.2 components/scan/QrScanner.tsx）懒加载接入
const QrScanner = lazy(() => import('@/components/scan/QrScanner'));

const TODAY_QUERY_KEY = ['appointment', 'listTodayForStaff'] as const;

export default function TodayPage() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();
  const [scanOpen, setScanOpen] = useState(false);

  const todayQuery = useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: () => trpc.appointment.listTodayForStaff.query(),
    refetchInterval: 60_000, // 弱网 / SSE 断线兜底轮询
  });

  const invalidateToday = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY }),
    [queryClient],
  );

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

      {todayQuery.isPending ? (
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
