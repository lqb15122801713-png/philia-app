/**
 * 财务报表页（T4.4 · coder-finance）—— 路由 /finance
 *
 * 数据源：store.financeStats（merchantProcedure，入参 {from,to}）：
 * - 周期：日 / 周（周一起）/ 月，前后翻页；区间 [from,to) 本地时区口径，与服务端一致。
 * - 汇总卡：服务收入 / 商城收入（v1 恒 0，标注 P5）/ 合计 / 完成单数 / 待收款金额（红点）。
 * - 趋势图：按日堆叠柱（服务+商城，纯 CSS 手绘）；空周期显示空态插画。
 * - 收款方式：到店付 vs 次卡扣次（金额+单数占比）。
 * - 员工明细：完成单数 / 服务金额 / 平均评分 / 好评率 / 提成（规则待配置占位）。
 * - 待收款：completed 未 paid 明细，行内「确认收款」→ appointment.markPaid →
 *   toast + invalidate（财务待办闭环）。
 * - SSE（store 频道）：appointment.paid / completed / reviewed / cancelled → invalidate；
 *   断线重连全量对齐；60s 轮询兜底。
 */

import { EventType, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import EmptyState from '@/components/finance/EmptyState';
import PaymentSplit from '@/components/finance/PaymentSplit';
import PendingPayments from '@/components/finance/PendingPayments';
import PeriodSwitcher from '@/components/finance/PeriodSwitcher';
import StaffTable from '@/components/finance/StaffTable';
import SummaryCards from '@/components/finance/SummaryCards';
import Toast, { useToast } from '@/components/finance/Toast';
import TrendChart from '@/components/finance/TrendChart';
import { useMerchantEvents } from '@/components/finance/useMerchantEvents';
import { periodRange, shiftAnchor, type PeriodMode } from '@/components/finance/utils';

const FINANCE_QUERY_ROOT = ['store', 'financeStats'] as const;

export default function FinancePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();
  const [mode, setMode] = useState<PeriodMode>('day');
  const [anchor, setAnchor] = useState(() => new Date());

  const { from, to } = useMemo(() => periodRange(mode, anchor), [mode, anchor]);

  const statsQuery = useQuery({
    queryKey: [...FINANCE_QUERY_ROOT, mode, from.getTime(), to.getTime()],
    queryFn: () => trpc.store.financeStats.query({ from, to }),
    refetchInterval: 60_000, // SSE 断线兜底轮询
  });

  const invalidateFinance = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_ROOT }),
    [queryClient],
  );

  // 事件去重（续传补发 / 多端同事件会重复到达）
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
        case EventType.AppointmentPaid:
          showToast('有一笔收款到账');
          invalidateFinance();
          break;
        case EventType.AppointmentCompleted:
        case EventType.AppointmentReviewed:
        case EventType.AppointmentCancelled:
          invalidateFinance();
          break;
        default:
          break;
      }
    },
    [invalidateFinance, markSeen, showToast],
  );

  useMerchantEvents({ onEvent, onReconnect: invalidateFinance });

  const data = statsQuery.data;
  /** 空周期：区间内无收款（待收款为时点待办，不影响空态判定） */
  const isEmptyPeriod = data !== undefined && data.totals.paidCount === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-6 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">财务</h1>
          <p className="mt-1 text-caption text-ink-secondary">
            日 / 周 / 月报表 · 服务收入 · 员工绩效 · 待收款
          </p>
        </div>
        <PeriodSwitcher
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            setAnchor(new Date()); // 切周期回到当前（今日/本周/本月）
          }}
          onShift={(dir) => setAnchor((a) => shiftAnchor(mode, a, dir))}
          from={from}
          to={to}
        />
      </header>

      {statsQuery.isPending ? (
        // 加载态：骨架卡
        <div className="mt-6 space-y-3" aria-label="加载中">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-card bg-card p-4 shadow-card">
                <div className="h-4 w-16 rounded-tag bg-sunken" />
                <div className="mt-3 h-7 w-24 rounded-tag bg-sunken" />
              </div>
            ))}
          </div>
          <div className="animate-pulse rounded-card bg-card p-4 shadow-card">
            <div className="h-5 w-24 rounded-tag bg-sunken" />
            <div className="mt-4 h-40 w-full rounded-tag bg-sunken" />
          </div>
        </div>
      ) : statsQuery.isError ? (
        // 失败态：重试
        <div className="mt-6 rounded-card bg-card p-6 text-center shadow-card">
          <p className="text-body text-ink-secondary">财务报表加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={() => void statsQuery.refetch()}
            className="mt-4 h-11 min-w-[160px] rounded-full bg-brand-primary px-8 text-body font-semibold text-white active:scale-[0.98]"
          >
            重新加载
          </button>
        </div>
      ) : data ? (
        <div className="mt-6 space-y-4">
          <SummaryCards totals={data.totals} />

          {isEmptyPeriod ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                <TrendChart data={data.byDay} mode={mode} />
                <PaymentSplit split={data.paymentSplit} />
              </div>
              <div className="lg:col-span-2">
                <StaffTable rows={data.byStaff} />
              </div>
            </div>
          )}

          {/* 待收款为时点待办（与周期无关），空周期也展示——财务待办闭环 */}
          <PendingPayments
            items={data.pendingPayments}
            totalFen={data.totals.pendingPaymentFen}
            onToast={showToast}
            onSettled={invalidateFinance}
          />
        </div>
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
