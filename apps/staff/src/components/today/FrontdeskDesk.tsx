/**
 * 前台任务台 · /today frontdesk 态（批次 U2 任务 C · 时间轴台 B′ 同骨架变体）
 *
 * 规格书 §3 三差异：
 * 1. 首栏主行动：柠檬大钮「扫码核销 · 到店登记」（15/700 高 50）+ 小字「无摄像头环境
 *    走手动输入 6 位核销码」→ checkin 链路现成（QrScanner 懒加载 + useCheckin，
 *    核销成功按服务端 nextRoute 跳转）；
 * 2. 全天行=待办列：改期回退待确认（warn 态「去确认 ›」）/ 寄养入住待登记（「入住 ›」
 *    → 入住登记页真链路）；无待办整行不渲染；
 * 3. 轴=全店今日单（口径见下），块副行=核销状态+员工名，多员工并行块对半分列；
 *    统计行=已核销 N·待到店 N·服务中 N。
 *
 * 数据口径注记（在案疑点）：规格书所印 listTodayForStore 服务端不存在，实际以
 * listTodayForStaff（本店今日未取消：本人单+未指派 pending/confirmed）承接——
 * 他人员工已指派单对员工端不可见（待裁定疑点 U2-1 已报产品侧）；
 * 员工名=store.listStaffPublic（公开过程现成）。
 */

import {
  EventType,
  usePhiliaClient,
  type EventEnvelope,
} from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, CalendarClock, PawPrint, ScanLine } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast, { useToast } from '@/components/today/Toast';
import { useStaffEvents } from '@/components/today/useStaffEvents';
import DayAxis from '@/components/today/deck/DayAxis';
import { fmtMin, minutesOf, todayAxisRange } from '@/components/today/deck/deckUtils';
import { dayKeyOf, todayLabel } from '@/components/today/utils';

// 契约1：QrScanner（T3.2 components/scan/QrScanner.tsx）懒加载接入（复用不动）
const QrScanner = lazy(() => import('@/components/scan/QrScanner'));

const TODAY_QUERY_KEY = ['appointment', 'listTodayForStaff'] as const;
const ME_RAW_KEY = ['auth', 'me', 'raw', 'staff-deck'] as const;
const STAFF_PUBLIC_KEY = ['store', 'listStaffPublic'] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: '待确认',
  confirmed: '待到店',
  in_service: '服务中',
  in_boarding: '寄养中',
  completed: '已完成',
  cancel_requested: '取消申请中',
};

export default function FrontdeskDesk() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();
  const [scanOpen, setScanOpen] = useState(false);
  const now = new Date();

  const todayQuery = useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: () => trpc.appointment.listTodayForStaff.query(),
    refetchInterval: 60_000,
  });
  const meRawQ = useQuery({ queryKey: ME_RAW_KEY, queryFn: () => trpc.auth.me.query(), staleTime: 300_000 });
  const storeId = meRawQ.data?.store?.id ?? null;
  const staffPublicQ = useQuery({
    queryKey: [...STAFF_PUBLIC_KEY, storeId],
    queryFn: () => trpc.store.listStaffPublic.query({ storeId: storeId! }),
    enabled: storeId !== null,
    staleTime: 300_000,
  });

  const invalidateToday = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY });
  }, [queryClient]);

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

  const items = useMemo(() => todayQuery.data ?? [], [todayQuery.data]);
  const staffNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staffPublicQ.data?.staff ?? []) m.set(s.id, s.name);
    return m;
  }, [staffPublicQ.data]);

  const store = meRawQ.data?.store ?? null;
  const staff = meRawQ.data?.staff ?? null;
  const axis = todayAxisRange(store?.openHours as Record<string, { open: string; close: string } | null> | null, now);
  const scheduleToday = (staff?.schedule as Record<string, Array<{ start: string; end: string }> | null> | null)?.[dayKeyOf(now)];
  const scheduleText = scheduleToday?.length ? scheduleToday.map((s) => `${s.start}–${s.end}`).join(' / ') : null;

  /** 待办：改期回退待确认（pending）+ 寄养入住待登记（boarding confirmed 今日） */
  const todos = useMemo(() => {
    const reschedulePending = items.filter((i) => i.status === 'pending');
    const boardingCheckin = items.filter((i) => i.type === 'boarding' && i.status === 'confirmed');
    return { reschedulePending, boardingCheckin };
  }, [items]);
  const hasTodos = todos.reschedulePending.length > 0 || todos.boardingCheckin.length > 0;

  const axisItems = useMemo(() => items.filter((i) => i.type === 'grooming'), [items]);
  const stats = useMemo(() => {
    const checked = axisItems.filter((i) => i.checkedInAt).length;
    const waiting = axisItems.filter((i) => !i.checkedInAt && (i.status === 'confirmed' || i.status === 'pending')).length;
    const inService = axisItems.filter((i) => i.status === 'in_service').length;
    return { checked, waiting, inService };
  }, [axisItems]);

  return (
    <div className="px-4 pb-6">
      {/* 顶栏（同骨架：日期 + 门店·周几·排班段 + 头像薄荷环进 /me） */}
      <header className="flex items-start justify-between pt-3">
        <div>
          <h1 className="text-title-lg font-bold">今天 · {todayLabel(now).split(' ')[0]}</h1>
          <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
            {store?.name ?? '门店'} · {todayLabel(now).split(' ')[1]}
            {scheduleText ? ` · 你的排班 ${scheduleText}` : ''}
          </p>
        </div>
        <Link
          to="/me"
          aria-label="我的"
          data-testid="deck-avatar"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-sunken shadow-[0_0_0_2px_#FFFDF6,0_0_0_3.5px_#7FD8BE] transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          {meRawQ.data?.user?.avatarUrl ? (
            <img src={meRawQ.data.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <PawPrint className="h-4 w-4 text-ink" strokeWidth={1.6} />
          )}
        </Link>
      </header>

      {/* 1. 柠檬大钮「扫码核销 · 到店登记」（15/700 高 50）+ 手动核销码小字 */}
      <div className="mt-3.5">
        <button
          type="button"
          data-testid="frontdesk-scan"
          onClick={() => setScanOpen(true)}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-control bg-brand-primary text-[15px] font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          <ScanLine className="h-5 w-5" strokeWidth={1.8} />
          扫码核销 · 到店登记
        </button>
        <p className="mt-2 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
          无摄像头环境走「手动输入 6 位核销码」
        </p>
      </div>

      {/* 2. 待办列（无待办整行不渲染） */}
      {hasTodos ? (
        <div className="mt-3.5 flex items-start gap-2.5" data-testid="frontdesk-todos">
          <span className="u1-num w-9 shrink-0 pt-2 text-right text-caption-xs text-[rgba(74,59,46,.42)]">待办</span>
          <div className="min-w-0 flex-1">
            {todos.reschedulePending.length > 0 ? (
              <button
                type="button"
                data-testid="todo-reschedule"
                onClick={() => showToast('改期回退单的确认在商家端审批——已为你标出，请转告店长处理')}
                className="mb-1.5 flex w-full items-center gap-2.5 rounded-control bg-card px-3 py-2.5 text-left shadow-[0_0_0_1px_rgba(217,45,32,.35)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                <CalendarClock className="h-[17px] w-[17px] shrink-0 text-[rgba(74,59,46,.62)]" strokeWidth={1.6} aria-hidden />
                <span className="min-w-0 flex-1 text-caption leading-snug text-[rgba(74,59,46,.62)]">
                  <b className="text-caption font-bold text-ink">改期回退 {todos.reschedulePending.length} 单待确认</b>
                  <span className="block text-caption-xs">
                    {todos.reschedulePending[0]!.petName ?? '宠物'} · {todos.reschedulePending[0]!.serviceName ?? '服务'} ·{' '}
                    {fmtMin(minutesOf(todos.reschedulePending[0]!.scheduledStart))} 到店
                  </span>
                </span>
                <span className="shrink-0 text-caption-xs font-bold text-danger">去确认 ›</span>
              </button>
            ) : null}
            {todos.boardingCheckin.length > 0 ? (
              <Link
                to={`/boarding/${todos.boardingCheckin[0]!.id}/checkin`}
                data-testid="todo-boarding"
                className="u1-ring mb-1.5 flex items-center gap-2.5 rounded-control bg-card px-3 py-2.5 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                <BedDouble className="h-[17px] w-[17px] shrink-0 text-[rgba(74,59,46,.62)]" strokeWidth={1.6} aria-hidden />
                <span className="min-w-0 flex-1 text-caption leading-snug text-[rgba(74,59,46,.62)]">
                  <b className="text-caption font-bold text-ink">寄养入住 {todos.boardingCheckin.length} 只待登记</b>
                  <span className="block text-caption-xs">
                    {todos.boardingCheckin[0]!.petName ?? '宠物'} · {todos.boardingCheckin[0]!.serviceName ?? '寄养'} · 预计{' '}
                    {fmtMin(minutesOf(todos.boardingCheckin[0]!.scheduledStart))} 到店
                  </span>
                </span>
                <span className="shrink-0 text-caption-xs font-bold text-ink">入住 ›</span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {todayQuery.isPending ? (
        <div className="mt-3 animate-pulse" aria-label="加载中">
          <div className="h-[52px] rounded-control bg-card u1-ring" />
          <div className="mt-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[52px] border-t border-[rgba(74,59,46,.06)]" />
            ))}
          </div>
        </div>
      ) : todayQuery.isError ? (
        <div className="u1-card mt-3 p-6 text-center">
          <p className="text-body-sm text-ink-secondary">今日接待加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={() => void todayQuery.refetch()}
            className="mt-4 h-12 min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            重新加载
          </button>
        </div>
      ) : (
        <>
          {/* 3. 轴=全店今日单（块副行=核销状态+员工名；并行对半分列） */}
          {axisItems.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center" data-testid="deck-empty">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken" aria-hidden>
                <ScanLine className="h-9 w-9 text-ink" strokeWidth={1.5} />
              </span>
              <p className="mt-4 text-body-sm text-ink-secondary">
                今天全店无预约——等自动接单，或把预约页分享给老客
              </p>
            </div>
          ) : (
            <DayAxis
              items={axisItems}
              startMin={axis.startMin}
              endMin={axis.endMin}
              now={now}
              titleSuffix={(item) =>
                item.staffId && staffNameById.get(item.staffId) ? (
                  <span className="font-normal text-[rgba(74,59,46,.62)]"> · {staffNameById.get(item.staffId)}</span>
                ) : null
              }
              subtitle={(item) => (
                <>
                  {item.checkedInAt
                    ? `已核销 ${fmtMin(minutesOf(item.checkedInAt))}`
                    : '待核销'}
                  {` · ${STATUS_LABEL[item.status] ?? item.status}`}
                  {!item.checkedInAt && item.assignSource === 'merchant' ? ' · 商家改派' : null}
                  {!item.checkedInAt && item.assignSource === 'auto' ? ' · 自动派单' : null}
                </>
              )}
            />
          )}

          {/* 统计行=已核销 N·待到店 N·服务中 N */}
          {axisItems.length > 0 ? (
            <p className="mb-4 mt-3 text-center text-caption-xs text-[rgba(74,59,46,.62)]" data-testid="deck-stats">
              已核销 <b className="u1-num text-ink">{stats.checked}</b> · 待到店 <b className="u1-num text-ink">{stats.waiting}</b> · 服务中{' '}
              <b className="u1-num text-ink">{stats.inService}</b>
            </p>
          ) : null}
        </>
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
