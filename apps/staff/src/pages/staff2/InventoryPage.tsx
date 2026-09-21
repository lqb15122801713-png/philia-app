/**
 * 盘点任务 /inventory（批次 员工端2.0 · R8，docs/staff2/R7-R10-DESIGN.md §一.3/§三）
 *
 * 两区结构：
 * 1. 待办盘点单（inventory.myCountTasks：draft 待盘 / counted 待确认 / rejected 退回重盘）——
 *    类型 chip（日盘/周盘/盲盘）+ 建单时间 + 行项数 + 状态签；点按进 /inventory/:id 执行；
 * 2. 安心包效期（inventory.carePackageExpiryStaff，只读）：≤7 天红色强调、已过期标「已过期」，
 *    处置走既有回收登记流程（本批只读展示，设计底稿 §六.2 在案）。
 */

import { usePhiliaClient } from '@philia/shared';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ClipboardCheck, PackageOpen } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { pad2 } from '@/components/today/utils';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type CountTask = RouterOutputs['inventory']['myCountTasks'][number];
type ExpiryItem = RouterOutputs['inventory']['carePackageExpiryStaff'][number];

const TYPE_LABEL: Record<string, string> = { daily: '日盘', weekly: '周盘', blind: '盲盘' };

/** Date → YYYY-MM-DD */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function TypeChip({ type }: { type: string }) {
  const cls =
    type === 'blind'
      ? 'bg-ink text-card'
      : type === 'daily'
        ? 'bg-brand-primary-light text-ink'
        : 'bg-brand-secondary-light text-ink';
  return <b className={`rounded-chip px-1.5 py-0.5 text-caption-xs font-bold ${cls}`}>{TYPE_LABEL[type] ?? type}</b>;
}

function StatusSign({ status }: { status: string }) {
  if (status === 'rejected') {
    return <b className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-bold text-danger-deep">退回重盘</b>;
  }
  if (status === 'counted') {
    return <b className="rounded-chip bg-success-light px-1.5 py-0.5 text-caption-xs font-bold text-success-deep">待店长确认</b>;
  }
  return <b className="rounded-chip bg-sunken px-1.5 py-0.5 text-caption-xs font-bold text-ink">待盘点</b>;
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const { trpc } = usePhiliaClient();

  const tasksQuery = useQuery({
    queryKey: ['inventory', 'myCountTasks'],
    queryFn: () => trpc.inventory.myCountTasks.query(),
  });
  const expiryQuery = useQuery({
    queryKey: ['inventory', 'carePackageExpiryStaff'],
    queryFn: () => trpc.inventory.carePackageExpiryStaff.query(),
  });

  const tasks: CountTask[] = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const expiry: ExpiryItem[] = useMemo(() => expiryQuery.data ?? [], [expiryQuery.data]);

  return (
    <div className="pb-6">
      <PageHeader title="盘点任务" backTo="/me" aside={tasks.length ? `${tasks.length} 单待办` : undefined} />

      <div className="px-[22px]">
        {/* 待办盘点单 */}
        <section className="mt-2.5" data-testid="inv-tasks">
          {tasksQuery.isPending ? (
            <div className="space-y-2.5" aria-label="加载中">
              {[0, 1, 2].map((i) => (
                <div key={i} className="u1-card h-16 animate-pulse bg-sunken" />
              ))}
            </div>
          ) : tasksQuery.isError ? (
            <div className="u1-card p-6 text-center">
              <p className="text-body-sm text-ink-secondary">盘点任务加载失败，请检查网络后重试</p>
              <button
                type="button"
                onClick={() => void tasksQuery.refetch()}
                className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                重新加载
              </button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center" data-testid="inv-tasks-empty">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken" aria-hidden>
                <ClipboardCheck className="h-9 w-9 text-ink" strokeWidth={1.5} />
              </span>
              <p className="mt-4 text-body-sm text-ink-secondary">暂无待办盘点单——店长派单后会出现在这里</p>
            </div>
          ) : (
            <ul>
              {tasks.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/inventory/${c.id}`)}
                    className="u1-card mb-2.5 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                    data-testid={`inv-task-${c.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5">
                        <TypeChip type={c.type} />
                        <StatusSign status={c.status} />
                      </p>
                      <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                        建单 <span className="u1-num">{ymd(c.createdAt)}</span> · 共{' '}
                        <span className="u1-num">{c.items.length}</span> 项
                        {c.status === 'rejected' ? ' · 可重新录入' : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[rgba(74,59,46,.42)]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 安心包效期（只读 · 处置走回收登记流程） */}
        <section className="mt-5" data-testid="inv-expiry">
          <h2 className="pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(74,59,46,.42)]">
            安心包效期（30 天内到期）
          </h2>
          {expiryQuery.isPending ? (
            <div className="u1-card h-16 animate-pulse bg-sunken" aria-label="加载中" />
          ) : expiryQuery.isError ? (
            <div className="u1-card p-6 text-center">
              <p className="text-body-sm text-ink-secondary">效期信息加载失败，请检查网络后重试</p>
              <button
                type="button"
                onClick={() => void expiryQuery.refetch()}
                className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                重新加载
              </button>
            </div>
          ) : expiry.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center" data-testid="inv-expiry-empty">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sunken" aria-hidden>
                <PackageOpen className="h-7 w-7 text-ink" strokeWidth={1.5} />
              </span>
              <p className="mt-3 text-body-sm text-ink-secondary">30 天内没有临期安心包，继续保持</p>
            </div>
          ) : (
            <>
              <ul>
                {expiry.map((p) => {
                  const expired = p.daysLeft < 0;
                  const urgent = !expired && p.daysLeft <= 7;
                  return (
                    <li key={p.id} className="u1-card mb-2.5 flex items-center gap-3 px-4 py-3.5" data-testid={`inv-expiry-${p.id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm font-bold">{p.name}</p>
                        <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                          效期至 <span className="u1-num">{ymd(p.expiresAt)}</span> · 库存{' '}
                          <span className="u1-num">{p.stock}</span>
                        </p>
                      </div>
                      <b
                        className={`u1-num shrink-0 text-body-sm font-bold ${
                          expired || urgent ? 'text-danger' : 'text-ink'
                        }`}
                      >
                        {expired ? '已过期' : `剩 ${p.daysLeft} 天`}
                      </b>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 px-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                临期/过期安心包请走回收登记流程处置，本页仅作提醒（只读）。
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
