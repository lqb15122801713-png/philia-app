/**
 * 历史 /history（批次 U2 任务 F · 试样 .hi-* 重做）
 *
 * 规格书 §6：标题「历史」（20/700）+ 右摘要（近 30 天·N 单）→ 按月分组行
 * （12/700 墨 40% 宽距）→ 单条卡：日/周（Montserrat）+ 宠物·服务 +
 * 时间·时长·状态（取消单带来源小签）+ 右好评 ★N.N + 金额 Montserrat（取消=—）。
 * 数据：listForStaff 近 30 天（现成）+ appointment.rating（行内现成字段）。
 * 明确不做：筛选/搜索（v1 量小）、导出、绩效图、提成。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { useMemo } from 'react';
import { fenToYuan, hhmm, type HistoryItem } from '@/components/today/utils';

const STATUS_TEXT: Record<string, string> = {
  completed: '已完成',
  cancelled: '已取消',
  in_service: '服务中',
  in_boarding: '寄养中',
  confirmed: '待到店',
  pending: '待确认',
  cancel_requested: '取消审核中',
};

/** 取消来源小签（schema cancelSource） */
const CANCEL_SOURCE: Record<string, string> = {
  customer: '客户取消',
  merchant: '商家取消',
};

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function HistoryRow({ item }: { item: HistoryItem }) {
  const cancelled = item.status === 'cancelled';
  const durationMin = Math.max(0, Math.round((item.scheduledEnd.getTime() - item.scheduledStart.getTime()) / 60_000));
  return (
    <li className="u1-card mb-2.5 flex items-center gap-3.5 px-4 py-3.5" data-testid={`history-${item.id}`}>
      <div className="w-[52px] shrink-0 text-center">
        <div className="u1-num text-body font-bold">{item.scheduledStart.getDate()}</div>
        <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">{WEEK[item.scheduledStart.getDay()]}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-bold">
          {item.petName ?? '宠物'} · {item.serviceName ?? '服务'}
        </p>
        <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
          {hhmm(item.scheduledStart)} · {item.type === 'boarding' ? `${Math.max(1, Math.round(durationMin / 1440))} 晚` : `${durationMin} 分钟`} · {STATUS_TEXT[item.status] ?? item.status}
          {cancelled && item.cancelSource && CANCEL_SOURCE[item.cancelSource] ? (
            <span className="ml-1 text-[rgba(74,59,46,.42)]">{CANCEL_SOURCE[item.cancelSource]}</span>
          ) : null}
        </p>
      </div>
      {!cancelled && item.rating !== null ? (
        <span className="shrink-0 text-caption-xs text-[rgba(74,59,46,.62)]">★ {item.rating.toFixed(1)}</span>
      ) : null}
      <span className={`u1-num shrink-0 text-body-sm font-bold ${cancelled ? 'text-[rgba(74,59,46,.42)]' : 'text-ink'}`}>
        {cancelled ? '—' : fenToYuan(item.priceFen)}
      </span>
    </li>
  );
}

export default function HistoryPage() {
  const { trpc } = usePhiliaClient();
  // 近 30 天（规格书 §6 口径）
  const from = useMemo(() => new Date(Date.now() - 30 * 86_400_000), []);

  const listQuery = useQuery({
    queryKey: ['appointment', 'listForStaff', { from: from.getTime() }],
    queryFn: () => trpc.appointment.listForStaff.query({ from }),
    refetchInterval: 60_000,
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  /** 按月分组（组间按 scheduledStart 倒序保持） */
  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const it of items) {
      const key = `${it.scheduledStart.getFullYear()}-${it.scheduledStart.getMonth()}`;
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    return [...map.entries()].map(([key, rows]) => ({ key, label: `${rows[0]!.scheduledStart.getMonth() + 1} 月`, rows }));
  }, [items]);

  return (
    <div className="px-4 pb-6">
      <header className="flex h-12 items-center" data-testid="history-header">
        <h1 className="text-title-lg font-bold">历史</h1>
        <span className="ml-auto text-caption-xs text-[rgba(74,59,46,.42)]">
          近 30 天 · <b className="u1-num">{items.length}</b> 单
        </span>
      </header>

      {listQuery.isPending ? (
        <div className="mt-2 space-y-2.5" aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <div key={i} className="u1-card flex items-center gap-3.5 px-4 py-3.5">
              <div className="h-8 w-[52px] animate-pulse rounded-tag bg-sunken" />
              <div className="flex-1">
                <div className="h-5 w-32 animate-pulse rounded-tag bg-sunken" />
                <div className="mt-1.5 h-4 w-44 animate-pulse rounded-tag bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="u1-card mt-2 p-6 text-center">
          <p className="text-body-sm text-ink-secondary">历史记录加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            className="mt-4 h-12 min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            重新加载
          </button>
        </div>
      ) : items.length === 0 ? (
        // 空态（规格书原文）
        <div className="flex flex-col items-center px-6 py-14 text-center" data-testid="history-empty">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken" aria-hidden>
            <ClipboardList className="h-9 w-9 text-ink" strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-body-sm text-ink-secondary">还没有历史单——第一单完成后会出现在这里</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <h2 className="px-0 pb-1.5 pt-4 text-caption font-extrabold tracking-[.08em] text-[rgba(74,59,46,.42)]">
              {g.label}
            </h2>
            <ul>
              {g.rows.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
