/**
 * 我的预约（T2.2）：listMine 按状态分组 Tab：
 *   待确认(pending) / 已确认(confirmed + cancel_requested) / 服务中(in_service + in_boarding)
 *   / 已完成(completed) / 已取消(cancelled)。五 Tab 过滤互斥无交叉。
 * 卡片：门店 / 服务 / 宠物 / 时间 / 状态胶囊 / 价格；服务中卡片带呼吸光环角标；点进详情。
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState } from '@/components/home/common';
import {
  APPT_STATUS_META,
  APPT_TYPE_LABEL,
  fenToYuan,
  fmtDateTime,
  fmtRange,
  statusLabel,
} from '@/components/booking/format';
import type { AppointmentGroups, AppointmentListItem, AppointmentStatus } from '@/components/booking/types';

interface TabDef {
  key: string;
  label: string;
  statuses: AppointmentStatus[];
}

const TABS: TabDef[] = [
  { key: 'pending', label: '待确认', statuses: ['pending'] },
  { key: 'confirmed', label: '已确认', statuses: ['confirmed', 'cancel_requested'] },
  { key: 'serving', label: '服务中', statuses: ['in_service', 'in_boarding'] },
  { key: 'history', label: '已完成', statuses: ['completed'] },
  { key: 'cancelled', label: '已取消', statuses: ['cancelled'] },
];

const SERVING = new Set(['in_service', 'in_boarding']);

const TAB_KEYS = new Set(TABS.map((t) => t.key));
/** W1 R-Nav-2：滚动位置会话级记忆 key（sessionStorage，会话结束自清） */
const SCROLL_KEY = 'w1.scroll.appointments';

function AppointmentCard({ item }: { item: AppointmentListItem }) {
  const meta = APPT_STATUS_META[item.status] ?? { label: item.status, pill: 'bg-sunken text-ink-secondary' };
  const serving = SERVING.has(item.status);
  return (
    <Link
      to={`/appointments/${item.id}`}
      className="relative block rounded-card bg-card p-4 shadow-card transition active:scale-[0.99]"
    >
      {/* 服务中呼吸光环角标 */}
      {serving ? (
        <span className="absolute -right-1.5 -top-1.5 flex items-center gap-1 rounded-full bg-brand-primary px-2.5 py-1 text-caption font-medium text-ink animate-halo">
          ● 进行中
        </span>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-body font-semibold">{item.serviceName ?? APPT_TYPE_LABEL[item.type]}</p>
        <span className={`rounded-full px-2.5 py-1 text-caption ${meta.pill}`}>{meta.label}</span>
      </div>
      <p className="mt-1 text-caption text-ink-secondary">
        {item.storeName ?? '门店'} · {item.petName ?? '毛孩子'}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <p className="font-number text-caption text-ink">
          {item.type === 'boarding'
            ? fmtRange(item.scheduledStart, item.scheduledEnd)
            : fmtDateTime(item.scheduledStart)}
        </p>
        <p className="font-number text-body font-semibold text-brand-primary">{fenToYuan(item.priceFen)}</p>
      </div>
    </Link>
  );
}

export default function AppointmentsPage() {
  const { trpc } = usePhiliaClient();
  // 批次 S4：免确认后新单落库即 confirmed，默认 Tab 由「待确认」改「已确认」
  //（待确认 Tab 保留：历史 pending 单与客户改期回退单仍在此分组）
  /* W1 R-Nav-2 返回保状态（淘宝订单列表同规范）：
     - 筛选 tab 入 URL（?tab=，replace 写入不污染历史栈——后退不会逐 tab 回放）；
     - 滚动位置会话级记忆（sessionStorage + rAF 节流），数据就绪后恢复一次；
     详情页返回列表后 tab 与滚动位置一并保住；与浏览器/系统后退手势不冲突
     （只读 URL/会话存储，不拦截 popstate）。 */
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') ?? 'confirmed';
  const tab = TAB_KEYS.has(rawTab) ? rawTab : 'confirmed';
  const setTab = (key: string) => setSearchParams({ tab: key }, { replace: true });

  const listQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
  });

  // 滚动位置：持续记忆（rAF 节流）
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        } catch {
          /* 隐私模式忽略 */
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // 数据就绪后恢复一次滚动位置（列表有内容才恢复，避免空页乱跳）
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || listQ.isPending || listQ.isError) return;
    restoredRef.current = true;
    let y = 0;
    try {
      y = Number(window.sessionStorage.getItem(SCROLL_KEY) ?? 0) || 0;
    } catch {
      /* 隐私模式忽略 */
    }
    if (y > 0) window.scrollTo(0, y);
  }, [listQ.isPending, listQ.isError]);
  const groups: AppointmentGroups | undefined = listQ.data?.groups;

  const active = TABS.find((t) => t.key === tab)!;
  const items = active.statuses.flatMap((s) => groups?.[s] ?? []);
  const totalCount = groups ? Object.values(groups).reduce((n, g) => n + g.length, 0) : 0;
  const countOf = (t: TabDef) => t.statuses.reduce((n, s) => n + (groups?.[s].length ?? 0), 0);

  return (
    <div className="px-4 py-6">
      {/* U1-A：详情级页面不渲染 dock，统一返回条（←圆钮+标题） */}
      <PageHeader title="我的预约" />

      {listQ.isPending ? (
        <div className="mt-5 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-sunken" />
          ))}
        </div>
      ) : listQ.isError ? (
        /* W1 退回修：裸错误文本升 ErrorState（重试=柠檬主；页头返回条已是出口件） */
        <div className="mt-5">
          <ErrorState message="预约列表加载失败，请检查网络后重试" onRetry={() => void listQ.refetch()} />
        </div>
      ) : totalCount === 0 ? (
        /* U1-I：全域统一空态组件（U4-D3 试样 12 工艺；行动钮统一柠檬控件档） */
        <EmptyState
          title="还没有预约"
          desc="给毛孩子安排一次舒服的洗护吧"
          action={
            <Link
              to="/booking"
              className="inline-flex items-center rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              立即预约
            </Link>
          }
        />
      ) : (
        <>
          {/* 状态分组 Tab（D-补2：横滑条隐藏） */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const n = countOf(t);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-body transition ${
                    tab === t.key
                      ? 'bg-brand-primary font-semibold text-ink'
                      : 'bg-card text-ink-secondary shadow-card'
                  }`}
                >
                  {t.label}
                  {n > 0 ? <span className="ml-1 font-number text-caption">{n}</span> : null}
                </button>
              );
            })}
          </div>

          {/* 分组卡片 */}
          <div className="mt-3 space-y-2.5">
            {items.length === 0 ? (
              <p className="rounded-card bg-sunken px-4 py-10 text-center text-caption text-ink-secondary">
                暂无{statusLabel(active.statuses[0] ?? '')}的预约
              </p>
            ) : (
              items.map((it) => <AppointmentCard key={it.id} item={it} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
