/**
 * 美容师任务台 · /today（批次 U2 任务 B · 时间轴台 B′ groomer 态）
 *
 * 规格书 §2 逐段：顶栏（日期 20/700 + 门店·周几·排班段 11/400 + 头像薄荷环进 /me）/
 * 周横条 6 日 chip（仅当前周不可翻页）/ 全天行（寄养打卡卡列，无寄养整行不渲染）/
 * 日轴（09:00–打烊 · 小时行高 52px · 当前时间墨线 · 三态单块 · 服务中就地展开服务卡）/
 * 底部安静统计行（无按钮）。
 * 数据：listTodayForStaff（现成）+ auth.me 原始响应（门店 openHours/排班，现成）+
 * boarding 今日 dailyLog 存在性前端聚合（规格书 §2 注，零新接口）；空档=前端按轴块推算纯展示。
 * SSE：useStaffEvents（assigned/rescheduled/cancelled/step_flagged → invalidate+toast）+ 60s 轮询兜底。
 */

import {
  EventType,
  StepKeyLabel,
  usePhiliaClient,
  type EventEnvelope,
} from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { MoonStar } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Toast, { useToast } from '@/components/today/Toast';
import { useStaffEvents } from '@/components/today/useStaffEvents';
import AllDayRow from '@/components/today/deck/AllDayRow';
import DayAxis from '@/components/today/deck/DayAxis';
import WeekStrip from '@/components/today/deck/WeekStrip';
import { firstGap, minutesOf, todayAxisRange, fmtMin } from '@/components/today/deck/deckUtils';
import { dayKeyOf, todayLabel } from '@/components/today/utils';

const TODAY_QUERY_KEY = ['appointment', 'listTodayForStaff'] as const;
const ME_RAW_KEY = ['auth', 'me', 'raw', 'staff-deck'] as const;

export default function GroomerDesk() {
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();
  const now = new Date();

  const todayQuery = useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: () => trpc.appointment.listTodayForStaff.query(),
    refetchInterval: 60_000, // 弱网 / SSE 断线兜底轮询
  });

  // auth.me 原始响应：门店名/openHours（打烊）+ 本人排班段（MePage 同口径）
  const meRawQ = useQuery({
    queryKey: ME_RAW_KEY,
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
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

  const items = useMemo(() => todayQuery.data ?? [], [todayQuery.data]);
  const boardingItems = useMemo(() => items.filter((i) => i.type === 'boarding'), [items]);
  const axisItems = useMemo(() => items.filter((i) => i.type === 'grooming'), [items]);

  const store = meRawQ.data?.store ?? null;
  const staff = meRawQ.data?.staff ?? null;
  const axis = todayAxisRange(store?.openHours as Record<string, { open: string; close: string } | null> | null, now);
  const scheduleToday = (staff?.schedule as Record<string, Array<{ start: string; end: string }> | null> | null)?.[dayKeyOf(now)];
  const scheduleText = scheduleToday?.length ? scheduleToday.map((s) => `${s.start}–${s.end}`).join(' / ') : null;

  const stats = useMemo(() => {
    const done = axisItems.filter((i) => i.status === 'completed').length;
    const gap = firstGap(
      axisItems.map((i) => ({ startMin: minutesOf(i.scheduledStart), endMin: minutesOf(i.scheduledEnd) })),
      minutesOf(now),
      axis.endMin,
    );
    return { total: axisItems.length, done, gap };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisItems, axis.endMin]);

  return (
    <div className="px-[22px] pb-6">
      {/* 1. 顶栏：日期 + 门店·周几·排班段 + 头像薄荷环进 /me（试样 30px 环=2px 纸缝+3px 薄荷） */}
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
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-sunken shadow-[0_0_0_2px_#FFFDF6,0_0_0_3px_#7FD8BE] transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          {meRawQ.data?.user?.avatarUrl ? (
            <img src={meRawQ.data.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            /* E-补1 空数据态字圈工艺：浅木底 + 衬线首字（客户端 D-补3 同口径），不用 PawPrint 占位 */
            <span className="flex h-full w-full items-center justify-center rounded-full bg-oak-light" aria-hidden>
              <span className="u1-serif text-caption-xs font-semibold text-ink">
                {(staff?.name ?? meRawQ.data?.user?.nickname ?? '员').slice(0, 1)}
              </span>
            </span>
          )}
        </Link>
      </header>

      {/* 2. 周横条（仅当前周，不可翻页） */}
      <WeekStrip today={now} />

      {todayQuery.isPending ? (
        // 加载 >300ms 骨架（禁转圈；骨架形状=内容轮廓）
        <div className="mt-3 animate-pulse" aria-label="加载中">
          <div className="h-[52px] rounded-control bg-card u1-ring" />
          <div className="mt-3 space-y-0">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[52px] border-t border-[rgba(74,59,46,.06)]" />
            ))}
          </div>
        </div>
      ) : todayQuery.isError ? (
        // 错误态：一句话 + 重试真链路
        <div className="u1-card mt-3 p-6 text-center">
          <p className="text-body-sm text-ink-secondary">今日任务加载失败，请检查网络后重试</p>
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
          {/* 3. 全天行：寄养打卡卡列（无寄养单整行不渲染） */}
          <AllDayRow items={boardingItems} today={now} />

          {/* 4. 日轴 */}
          {axisItems.length === 0 ? (
            // 空态（规格书原文文案；emoji 禁令 → lucide 墨色线图标）
            <div className="flex flex-col items-center px-6 py-14 text-center" data-testid="deck-empty">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken" aria-hidden>
                <MoonStar className="h-9 w-9 text-ink" strokeWidth={1.5} />
              </span>
              <p className="mt-4 text-body-sm text-ink-secondary">
                今天没有派给你的单——休息，或去前台看看有没有要帮忙的
              </p>
            </div>
          ) : (
            <DayAxis items={axisItems} startMin={axis.startMin} endMin={axis.endMin} now={now} />
          )}

          {/* 5. 底部安静统计行（无按钮——主行动已归服务卡） */}
          {axisItems.length > 0 ? (
            <p className="mb-4 mt-3 text-center text-caption-xs text-[rgba(74,59,46,.62)]" data-testid="deck-stats">
              今天 <b className="u1-num text-ink">{stats.total}</b> 单 · 已完成 <b className="u1-num text-ink">{stats.done}</b>
              {stats.gap ? (
                <>
                  {' '}· 当前空档 {fmtMin(stats.gap.from)}–{fmtMin(stats.gap.to)}
                </>
              ) : null}
            </p>
          ) : null}
        </>
      )}

      <Toast message={toast} />
    </div>
  );
}
