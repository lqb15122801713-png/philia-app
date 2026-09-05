/**
 * 历史记录页（契约 docs/STAFF-CONTRACTS.md · T3.1）—— 路由 /history
 *
 * 数据源：appointment.listForStaff（T3.1 服务端追加，staffProcedure）——
 * 本店且指派给本人/本人执行过的预约，按 scheduledStart 倒序。
 * 默认本月（from=当月 1 日 00:00），可切状态过滤。
 * 头部统计：本月完成单数 + 平均评分；提成字段服务端暂无，按契约做占位说明。
 * 卡片：时间 / 宠物 / 服务 / 状态 / 评分（无评分显示「待评价」）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import StatusCapsule from '@/components/today/StatusCapsule';
import { Stars } from '@/components/today/TodayTaskCard';
import { fenToYuan, hhmm, mmdd, monthStart, type HistoryItem } from '@/components/today/utils';

type StatusFilter = 'all' | 'completed' | 'in_service' | 'in_boarding' | 'cancelled';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'completed', label: '已完成' },
  { value: 'in_service', label: '服务中' },
  { value: 'in_boarding', label: '寄养中' },
  { value: 'cancelled', label: '已取消' },
];

function HistoryCard({ item }: { item: HistoryItem }) {
  const isDone = item.status === 'completed' || item.status === 'cancelled';
  return (
    <li className={`rounded-card bg-card p-4 shadow-card ${isDone ? 'opacity-80' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-number text-body-lg tabular-nums">
          {mmdd(item.scheduledStart)} {hhmm(item.scheduledStart)}
        </p>
        <StatusCapsule status={item.status} />
      </div>
      <p className="mt-1 text-body-lg font-semibold">
        {item.petName ?? '宠物'}
        <span className="font-normal text-ink-secondary"> · {item.serviceName ?? '服务'}</span>
      </p>
      <div className="mt-2 flex items-center justify-between border-t border-line-divider pt-2">
        {item.status === 'completed' ? (
          <Stars rating={item.rating} />
        ) : (
          <span className="text-body text-ink-placeholder">
            {item.type === 'boarding' ? '寄养单' : '洗护单'}
          </span>
        )}
        <span className="font-number text-body text-ink-secondary tabular-nums">
          {fenToYuan(item.priceFen)}
        </span>
      </div>
      {item.review ? (
        <p className="mt-2 rounded-tag bg-sunken px-2 py-1 text-body text-ink-secondary">
          客户评价:{item.review}
        </p>
      ) : null}
    </li>
  );
}

export default function HistoryPage() {
  const { trpc } = usePhiliaClient();
  const [status, setStatus] = useState<StatusFilter>('all');
  const from = useMemo(monthStart, []);

  // 列表（按状态过滤）
  const listQuery = useQuery({
    queryKey: ['appointment', 'listForStaff', { from: from.getTime(), status }],
    queryFn: () =>
      trpc.appointment.listForStaff.query({
        from,
        ...(status === 'all' ? {} : { status }),
      }),
  });

  // 头部统计（恒为「全部状态」口径，不随筛选变化）
  const statsQuery = useQuery({
    queryKey: ['appointment', 'listForStaff', { from: from.getTime(), status: 'all' }],
    queryFn: () => trpc.appointment.listForStaff.query({ from }),
  });

  const items = listQuery.data ?? [];
  const stats = useMemo(() => {
    const all = statsQuery.data ?? [];
    const done = all.filter((a) => a.status === 'completed');
    const rated = done.filter((a) => a.rating !== null);
    const avg =
      rated.length > 0
        ? rated.reduce((sum, a) => sum + (a.rating ?? 0), 0) / rated.length
        : null;
    return { doneCount: done.length, avgRating: avg };
  }, [statsQuery.data]);

  return (
    <div className="px-4 pb-6">
      <header className="pt-6">
        <h1 className="text-title-lg">历史记录</h1>
        <p className="mt-1 text-body text-ink-secondary">
          {from.getMonth() + 1} 月起 · 我承接的服务单
        </p>
      </header>

      {/* 统计头部（提成字段服务端暂无 → 占位，契约口径） */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-card bg-card p-4 shadow-card">
          <p className="font-number text-price tabular-nums">{stats.doneCount}</p>
          <p className="mt-1 text-caption text-ink-secondary">本月完成单数</p>
        </div>
        <div className="rounded-card bg-card p-4 shadow-card">
          <p className="font-number text-price tabular-nums">
            {stats.avgRating !== null ? stats.avgRating.toFixed(1) : '—'}
          </p>
          <p className="mt-1 text-caption text-ink-secondary">本月平均评分</p>
        </div>
      </section>
      <p className="mt-2 text-caption text-ink-placeholder">
        提成明细以门店结算为准（提成统计功能建设中）
      </p>

      {/* 状态筛选 */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`h-11 shrink-0 rounded-full px-4 text-body transition active:scale-92 duration-120 ${
              status === f.value
                ? 'bg-brand-primary font-semibold text-white'
                : 'bg-card text-ink-secondary shadow-card'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {listQuery.isPending ? (
        <div className="mt-4 space-y-3" aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-card bg-card p-4 shadow-card">
              <div className="h-5 w-28 rounded-tag bg-sunken" />
              <div className="mt-2 h-5 w-44 rounded-tag bg-sunken" />
            </div>
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="mt-4 rounded-card bg-card p-6 text-center shadow-card">
          <p className="text-body-lg text-ink-secondary">历史记录加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            className="mt-4 h-14 min-w-[160px] rounded-full bg-brand-primary px-8 text-body-lg font-semibold text-white active:scale-[0.98]"
          >
            重新加载
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-card bg-card px-6 py-10 text-center shadow-card">
          <span aria-hidden className="text-4xl">
            📋
          </span>
          <p className="mt-3 text-body-lg text-ink-secondary">
            {status === 'all' ? '本月还没有承接的服务单' : '该状态下暂无记录'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <HistoryCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
