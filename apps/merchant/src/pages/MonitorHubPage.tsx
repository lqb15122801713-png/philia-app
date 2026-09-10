/**
 * 服务监视目录 /monitor（B8-B2 补建 · P4 既有实现接通）
 *
 * 背景：商家端监视页（P4 · AppointmentMonitorPage：MonitorTimeline 共享 StepTimeline
 * 视觉规范 + PhotoWall 只读照片墙）此前只有 /appointments/:id/monitor 深链，
 * /monitor、/live 无路由，命中 App.tsx 兜底 path="*" 被 Navigate 回 /dashboard
 * （走查「监视页无独立路由，302 回仪表盘」的元凶——路由缺失回退，非显式 redirect）。
 *
 * 本页只做「目录接通」，不重设计：
 * - 数据源复用现有 appointment.listForStore（status=in_service / in_boarding），无新接口；
 * - 列表行原样复用 AppointmentRow（T4.2 既有组件），点行进入既有监视页
 *   /appointments/:id/monitor（StepTimeline+PhotoWall 只读视图本体，一行未改）；
 * - /monitor/:id 为同一监视页的别名深链；/live、/live/:id 重定向到 /monitor 系。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppointmentRow } from '../components/appointments/AppointmentRow';
import type { ListForStoreItem } from '../components/appointments/appt-utils';

export default function MonitorHubPage() {
  const { trpc } = usePhiliaClient();
  const navigate = useNavigate();

  const inServiceQ = useQuery({
    queryKey: ['appointment', 'listForStore', 'monitor', 'in_service'],
    queryFn: () => trpc.appointment.listForStore.query({ status: 'in_service' }),
  });
  const inBoardingQ = useQuery({
    queryKey: ['appointment', 'listForStore', 'monitor', 'in_boarding'],
    queryFn: () => trpc.appointment.listForStore.query({ status: 'in_boarding' }),
  });

  const items: ListForStoreItem[] = useMemo(
    () =>
      [...(inServiceQ.data ?? []), ...(inBoardingQ.data ?? [])].sort(
        (a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime(),
      ),
    [inServiceQ.data, inBoardingQ.data],
  );

  const pending = inServiceQ.isPending || inBoardingQ.isPending;
  const failed = inServiceQ.isError || inBoardingQ.isError;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-title-lg">服务监视</h1>
      <p className="mt-1 text-body text-ink-secondary">
        进行中的服务 {items.length} 单 · 点单进入实时监视（步骤时间轴 + 照片墙）
      </p>

      {pending ? (
        <div className="mt-4 space-y-3" aria-label="加载中">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-card bg-card p-4 shadow-card">
              <div className="h-5 w-32 rounded-tag bg-sunken" />
              <div className="mt-2 h-4 w-48 rounded-tag bg-sunken" />
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className="mt-4 rounded-card bg-card p-6 text-center shadow-card">
          <p className="text-body text-ink-secondary">监视列表加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={() => {
              void inServiceQ.refetch();
              void inBoardingQ.refetch();
            }}
            className="mt-4 h-11 min-w-[140px] rounded-full bg-brand-primary px-6 text-body font-semibold text-white active:scale-[0.98]"
          >
            重新加载
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-card bg-card px-6 py-10 text-center shadow-card">
          <p className="text-title">当前没有进行中的服务</p>
          <p className="mt-2 text-body text-ink-secondary">
            客户到店核销后，这里会列出可实时监视的预约。
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <AppointmentRow
              key={item.id}
              item={item}
              onOpen={() => navigate(`/appointments/${item.id}/monitor`)}
              onConfirm={() => {}}
              onReject={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
