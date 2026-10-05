/**
 * 盘点任务 /inventory（批次 员工端2.0 · R8，docs/staff2/R7-R10-DESIGN.md §一.3/§三）
 * 骨架批片 1（S-08）：外框换骨架——SkAppHead → 今日胶囊（SkClockRow）→ appt 卡列
 * （草稿=淡金左条 / 待确认=done 淡化 / 退回=赭红左条）→ 口径注（SkNote）。
 * 二级页无 dock；数据流/权限零回退。
 *
 * 两区结构：
 * 1. 待办盘点单（inventory.myCountTasks：draft 待盘 / counted 待确认 / rejected 退回重盘）——
 *    类型 chip（日盘/周盘/盲盘）+ 建单时间 + 行项数 + 状态签；点按进 /inventory/:id 执行；
 * 2. 安心包效期（inventory.carePackageExpiryStaff，只读）：≤7 天红色强调、已过期标「已过期」，
 *    处置走既有回收登记流程（本批只读展示，设计底稿 §六.2 在案）。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { pad2, weekdayLabel } from '@/components/today/utils';
import { INVENTORY_COPY } from '@/copy/inventory';
import { skc } from '@/copy/skeleton';
import { SkBackBar, SkBtnAction, SkClockRow, SkEmpty, SkNote, SkRows } from '../../components/skeleton';
import '../../styles/skeleton.css';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type CountTask = RouterOutputs['inventory']['myCountTasks'][number];
type ExpiryItem = RouterOutputs['inventory']['carePackageExpiryStaff'][number];

const TYPE_LABEL: Record<string, string> = { daily: '日盘', weekly: '周盘', blind: '盲盘' };

/** Date → YYYY-MM-DD */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const cardSt: CSSProperties = {
  margin: '12px 22px 0',
  background: 'var(--card)',
  borderRadius: 18,
  padding: '14px 16px',
  boxShadow: '0 1px 2px rgba(42, 31, 21, .05)',
};

function TypeChip({ type }: { type: string }) {
  const st: CSSProperties =
    type === 'blind'
      ? { background: 'var(--ink)', color: 'var(--paper)' }
      : type === 'daily'
        ? { background: 'var(--gold-pale)', color: 'var(--ink-deep)' }
        : { background: 'var(--gold)', color: 'var(--ink-deep)' };
  return <b style={{ borderRadius: 999, padding: '2px 8px', fontSize: 9.5, ...st }}>{TYPE_LABEL[type] ?? type}</b>;
}

function StatusSign({ status }: { status: string }) {
  if (status === 'rejected') {
    return <b style={{ borderRadius: 999, padding: '2px 8px', fontSize: 9.5, background: 'rgba(180, 80, 46, .12)', color: 'var(--danger)' }}>{INVENTORY_COPY['inventory.status.rejected']}</b>;
  }
  if (status === 'counted') {
    return <b style={{ borderRadius: 999, padding: '2px 8px', fontSize: 9.5, background: 'var(--paper)', color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.status.counted']}</b>;
  }
  return <b style={{ borderRadius: 999, padding: '2px 8px', fontSize: 9.5, background: 'var(--paper)', color: 'var(--ink)' }}>{INVENTORY_COPY['inventory.status.draft']}</b>;
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

  const now = new Date();
  const clockText = `${skc('sk.today')} ${ymd(now)} ${weekdayLabel(now)}${tasks.length ? ` · ${tasks.length} ${INVENTORY_COPY['inventory.aside.pending']}` : ''}`;

  return (
    <div className="sk">
      {/* S-08 属二级页组（dock 四槽冻结不含盘点）——二级页制=SkBackBar（nav 铁律四要素），
          语言包 apphead 位由 backbar 题注同帧承接 */}
      <SkBackBar title={INVENTORY_COPY['inventory.title']} note={INVENTORY_COPY['inventory.no']} fallback="/me" />
      <SkClockRow text={clockText} />

      {/* 待办盘点单（appt 卡列：草稿 gold 左条 / counted done 淡化 / rejected 赭红左条） */}
      <section data-testid="inv-tasks">
        {tasksQuery.isPending ? (
          <div style={{ margin: '12px 22px 0', display: 'grid', gap: 10 }} aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="u1-card h-16 !rounded-panel" />
            ))}
          </div>
        ) : tasksQuery.isError ? (
          <div style={{ ...cardSt, textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.load.fail']}</p>
            <div style={{ marginTop: 12 }}>
              <SkBtnAction onClick={() => void tasksQuery.refetch()} testId="sk-inv-retry">
                {INVENTORY_COPY['inventory.retry']}
              </SkBtnAction>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div data-testid="inv-tasks-empty" style={{ paddingTop: 16 }}>
            <SkEmpty title={INVENTORY_COPY['inventory.tasks.empty']} />
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tasks.map((c) => {
              const bar =
                c.status === 'rejected' ? 'var(--danger)' : c.status === 'draft' ? 'var(--gold)' : 'var(--hairline)';
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/inventory/${c.id}`)}
                    style={{
                      ...cardSt,
                      display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 44px)',
                      border: 0, borderLeft: `3px solid ${bar}`, textAlign: 'left', cursor: 'pointer',
                      font: 'inherit', color: 'inherit',
                      opacity: c.status === 'counted' ? 0.62 : 1,
                    }}
                    data-testid={`inv-task-${c.id}`}
                  >
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TypeChip type={c.type} />
                        <StatusSign status={c.status} />
                      </span>
                      <span style={{ display: 'block', marginTop: 6, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--muted)' }}>
                        {INVENTORY_COPY['inventory.task.created']} {ymd(c.createdAt)} · {INVENTORY_COPY['inventory.task.countLead']}{' '}
                        {c.items.length} {INVENTORY_COPY['inventory.task.countTail']}
                        {c.status === 'rejected' ? ` · ${INVENTORY_COPY['inventory.task.rejectedEditable']}` : ''}
                      </span>
                    </span>
                    <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink)', flex: 'none' }}>›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 口径注：日盘门槛 ≥¥100 · 盲盘不显系统库存 */}
      <SkNote>{INVENTORY_COPY['inventory.list.note']}</SkNote>

      {/* 安心包效期（只读 · 处置走回收登记流程） */}
      <p style={{ margin: '20px 22px 0', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--muted)' }}>
        {INVENTORY_COPY['inventory.expiry.title']}
      </p>
      <section data-testid="inv-expiry">
        {expiryQuery.isPending ? (
          <div style={{ margin: '12px 22px 0' }} aria-label="加载中">
            <Skeleton className="u1-card h-16 !rounded-panel" />
          </div>
        ) : expiryQuery.isError ? (
          <div style={{ ...cardSt, textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.expiry.loadFail']}</p>
            <div style={{ marginTop: 12 }}>
              <SkBtnAction onClick={() => void expiryQuery.refetch()} testId="sk-inv-expiry-retry">
                {INVENTORY_COPY['inventory.retry']}
              </SkBtnAction>
            </div>
          </div>
        ) : expiry.length === 0 ? (
          <div data-testid="inv-expiry-empty" style={{ paddingTop: 8 }}>
            <SkEmpty title={INVENTORY_COPY['inventory.expiry.empty']} />
          </div>
        ) : (
          <>
            <SkRows>
              {expiry.map((p) => {
                const expired = p.daysLeft < 0;
                const urgent = !expired && p.daysLeft <= 7;
                return (
                  <div className="row" key={p.id} data-testid={`inv-expiry-${p.id}`}>
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700 }}>{p.name}</span>
                      <span style={{ display: 'block', marginTop: 2, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--muted)' }}>
                        {INVENTORY_COPY['inventory.expiry.until']} {ymd(p.expiresAt)} · {INVENTORY_COPY['inventory.expiry.stock']} {p.stock}
                      </span>
                    </span>
                    <span className={`vl${expired || urgent ? ' red' : ''}`}>
                      {expired ? INVENTORY_COPY['inventory.expiry.expired'] : `${INVENTORY_COPY['inventory.expiry.leftLead']} ${p.daysLeft} ${INVENTORY_COPY['inventory.expiry.leftTail']}`}
                    </span>
                  </div>
                );
              })}
            </SkRows>
            <SkNote>{INVENTORY_COPY['inventory.expiry.note']}</SkNote>
          </>
        )}
      </section>

      <div style={{ paddingBottom: 32 }} />
    </div>
  );
}
