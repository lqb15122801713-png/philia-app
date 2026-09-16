/**
 * 前台任务台（批次 S1 · 任务 C · 设计规格 v3 减法口径）
 *
 * 构成：
 * - 顶部常驻「扫码核销」大按钮（≥64px 品牌渐变，icon+文字）→ 打开 QrScanner
 *   （契约 1，复用 components/scan/QrScanner + ManualCodeInput 不动），核销成功按服务端
 *   nextRoute 跳转（grooming→/execute/:id，boarding→/boarding/:id/checkin）。
 * - 今日接待列表：复用 TodayPage 数据源 appointment.listTodayForStaff（本店今日
 *   未取消预约：本人单 + 未指派待承接单），按「待核销 / 已核销」分组（分组键 =
 *   checkedInAt 是否为空），只读卡片（时间 + 状态胶囊 + 宠物/服务 + 客户备注）。
 * - SSE（useStaffEvents）：assigned/rescheduled/cancelled → invalidate + toast；
 *   断线重连全量对齐；60s 轮询兜底。
 */

import {
  EventType,
  usePhiliaClient,
  type EventEnvelope,
} from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { PawPrint, ScanLine, UserRound } from 'lucide-react';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatusCapsule from '@/components/today/StatusCapsule';
import Toast, { useToast } from '@/components/today/Toast';
import { useStaffEvents } from '@/components/today/useStaffEvents';
import { hhmm, todayLabel, type TodayItem } from '@/components/today/utils';

// 契约1：QrScanner（T3.2 components/scan/QrScanner.tsx）懒加载接入（复用不动）
const QrScanner = lazy(() => import('@/components/scan/QrScanner'));

const TODAY_QUERY_KEY = ['appointment', 'listTodayForStaff'] as const;

/** 前台接待只读卡片（无执行/打卡按钮——服务执行归美容师台） */
function ReceptionCard({ item }: { item: TodayItem }) {
  return (
    <li className="rounded-card bg-card p-4 shadow-card" data-status={item.status}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-number text-body-lg tabular-nums">{hhmm(item.scheduledStart)}</p>
        <StatusCapsule status={item.status} />
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-body-lg font-semibold">
        <PawPrint className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
        {item.petName ?? '宠物'}
        <span className="font-normal text-ink-secondary">· {item.serviceName ?? '服务'}</span>
      </p>
      {item.note ? (
        <p className="mt-1 rounded-tag bg-sunken px-2 py-1 text-body text-ink-secondary">
          客户备注：{item.note}
        </p>
      ) : null}
    </li>
  );
}

export default function FrontdeskDesk() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();
  const [scanOpen, setScanOpen] = useState(false);

  const todayQuery = useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: () => trpc.appointment.listTodayForStaff.query(),
    refetchInterval: 60_000, // 弱网 / SSE 断线兜底轮询
  });

  const invalidateToday = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY });
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
      switch (envelope.type) {
        case EventType.AppointmentAssigned:
          showToast('收到新派单，请查看今日接待');
          invalidateToday();
          break;
        case EventType.AppointmentRescheduled:
          showToast('有预约改期，请查看最新安排');
          invalidateToday();
          break;
        case EventType.AppointmentCancelled:
          showToast('有预约已取消');
          invalidateToday();
          break;
        default:
          break;
      }
    },
    [invalidateToday, markSeen, showToast],
  );

  useStaffEvents({ onEvent, onReconnect: invalidateToday });

  const items = todayQuery.data ?? [];
  /** 待核销（未核销：pending/confirmed 等到店单） */
  const pendingItems = items.filter((i) => !i.checkedInAt);
  /** 已核销（checkedInAt 非空：in_service / in_boarding / completed 等） */
  const doneItems = items.filter((i) => i.checkedInAt);

  return (
    <div className="px-4 pb-6">
      <header className="flex items-start justify-between pt-6">
        <div>
          <h1 className="text-title-lg">今日任务</h1>
          <p className="mt-1 text-body text-ink-secondary">
            {todayLabel(new Date())} · 前台接待 · 共 {items.length} 单
          </p>
        </div>
        {/* /me 入口 */}
        <Link
          to="/me"
          aria-label="我的"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink-secondary shadow-card active:scale-95"
        >
          <UserRound className="h-5 w-5" strokeWidth={1.5} />
        </Link>
      </header>

      {/* 顶部常驻「扫码核销」大按钮（≥64px 纯色品牌底，拇指热区；S1-R2：规格 v3 §6 禁渐变底，
          bg-philia-gradient → bg-brand-primary；文字 on-primary 深棕墨，DESIGN.md §2.1） */}
      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-full bg-brand-primary text-body-lg font-semibold text-ink shadow-philia transition active:scale-[0.98]"
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
            </div>
          ))}
        </div>
      ) : todayQuery.isError ? (
        // 失败态：重试
        <div className="mt-6 rounded-card bg-card p-6 text-center shadow-card">
          <p className="text-body-lg text-ink-secondary">今日接待加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={() => void todayQuery.refetch()}
            className="mt-4 h-14 min-w-[160px] rounded-full bg-brand-primary px-8 text-body-lg font-semibold text-ink active:scale-[0.98]"
          >
            重新加载
          </button>
        </div>
      ) : items.length === 0 ? (
        // 空态：今日无接待
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span
            aria-hidden
            className="flex h-24 w-24 items-center justify-center rounded-full bg-philia-gradient text-5xl shadow-philia"
          >
            🐶
          </span>
          <p className="mt-5 text-title">今日暂无接待</p>
          <p className="mt-2 text-body-lg text-ink-secondary">
            客户到店出示预约码，点上方「扫码核销」即可登记到店。
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* 待核销分组 */}
          <section aria-label="待核销">
            <h2 className="text-body-lg font-semibold text-ink">
              待核销
              <span className="ml-2 text-caption font-normal text-ink-secondary">
                共 {pendingItems.length} 单
              </span>
            </h2>
            {pendingItems.length === 0 ? (
              <p className="mt-2 rounded-card bg-card px-4 py-5 text-center text-body text-ink-secondary shadow-card">
                当前没有待核销的预约
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {pendingItems.map((item) => (
                  <ReceptionCard key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>

          {/* 已核销分组 */}
          <section aria-label="已核销">
            <h2 className="text-body-lg font-semibold text-ink">
              已核销
              <span className="ml-2 text-caption font-normal text-ink-secondary">
                共 {doneItems.length} 单
              </span>
            </h2>
            {doneItems.length === 0 ? (
              <p className="mt-2 rounded-card bg-card px-4 py-5 text-center text-body text-ink-secondary shadow-card">
                今天还没有核销记录
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {doneItems.map((item) => (
                  <ReceptionCard key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        </div>
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
