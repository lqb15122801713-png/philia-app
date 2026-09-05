/**
 * 我的预约（T2.2）：listMine 按状态分组 Tab：
 *   待确认(pending) / 已确认(confirmed + cancel_requested) / 服务中(in_service + in_boarding)
 *   / 已完成(completed + cancelled 合并展示)。
 * 卡片：门店 / 服务 / 宠物 / 时间 / 状态胶囊 / 价格；服务中卡片带呼吸光环角标；点进详情。
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
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
  { key: 'history', label: '已完成', statuses: ['completed', 'cancelled'] },
];

const SERVING = new Set(['in_service', 'in_boarding']);

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
        <span className="absolute -right-1.5 -top-1.5 flex items-center gap-1 rounded-full bg-brand-primary px-2.5 py-1 text-caption font-medium text-white animate-halo">
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
  const [tab, setTab] = useState(TABS[0]!.key);

  const listQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
  });
  const groups: AppointmentGroups | undefined = listQ.data?.groups;

  const active = TABS.find((t) => t.key === tab)!;
  const items = active.statuses.flatMap((s) => groups?.[s] ?? []);
  const totalCount = groups ? Object.values(groups).reduce((n, g) => n + g.length, 0) : 0;
  const countOf = (t: TabDef) => t.statuses.reduce((n, s) => n + (groups?.[s].length ?? 0), 0);

  return (
    <div className="px-4 py-6">
      <h1 className="text-title-lg">我的预约</h1>

      {listQ.isPending ? (
        <div className="mt-5 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-sunken" />
          ))}
        </div>
      ) : listQ.isError ? (
        <p className="mt-10 text-center text-body text-ink-secondary">加载失败，请下拉重试</p>
      ) : totalCount === 0 ? (
        /* 全局空状态（品牌插画） */
        <div className="mt-10 flex flex-col items-center">
          <img src="./brand/empty-appointments-800.png" alt="暂无预约" className="w-56 max-w-full rounded-card" />
          <p className="mt-4 text-title">还没有预约</p>
          <p className="mt-1 text-body text-ink-secondary">给毛孩子安排一次舒服的洗护吧</p>
          <Link
            to="/booking"
            className="mt-6 flex h-11 items-center rounded-full bg-brand-primary px-8 text-body font-medium text-white shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            立即预约
          </Link>
        </div>
      ) : (
        <>
          {/* 状态分组 Tab */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const n = countOf(t);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-body transition ${
                    tab === t.key
                      ? 'bg-brand-primary font-semibold text-white'
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
