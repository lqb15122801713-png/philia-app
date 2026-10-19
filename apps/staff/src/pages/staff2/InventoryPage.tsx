/**
 * 盘点任务 /inventory（批次 员工端2.0 · R8，docs/staff2/R7-R10-DESIGN.md §一.3/§三）
 * 骨架批片 1（S-08）：外框换骨架——SkAppHead → 今日胶囊（SkClockRow）→ appt 卡列 → 口径注（SkNote）。
 * PD-44 U5 升档：卡面统一 SkRows/SkPanel + sk-label/sk-input，TypeChip/StatusSign token 化，
 * 可读文字全量 ≥12px；段题走 SkSec。二级页无 dock；数据流/权限零回退。
 *
 * 两区结构：
 * 1. 待办盘点单（inventory.myCountTasks：draft 待盘 / counted 待确认 / rejected 退回重盘）——
 *    类型 chip（日盘/周盘/盲盘）+ 建单时间 + 行项数 + 状态签；点按进 /inventory/:id 执行；
 * 2. 安心包效期（inventory.carePackageExpiryStaff，只读）：≤7 天红色强调、已过期标「已过期」，
 *    处置走既有回收登记流程（本批只读展示，设计底稿 §六.2 在案）。
 */

import { Skeleton, usePhiliaClient, useToast } from '@philia/shared';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { pad2, weekdayLabel } from '@/components/today/utils';
import { INVENTORY_COPY } from '@/copy/inventory';
import { skc } from '@/copy/skeleton';
import { SkBackBar, SkBtnAction, SkClockRow, SkEmpty, SkNote, SkPanel, SkRows, SkSec } from '../../components/skeleton';
import '../../styles/skeleton.css';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type CountTask = RouterOutputs['inventory']['myCountTasks'][number];
type ExpiryItem = RouterOutputs['inventory']['carePackageExpiryStaff'][number];

const TYPE_LABEL: Record<string, string> = { daily: '日盘', weekly: '周盘', blind: '盲盘' };

/** Date → YYYY-MM-DD */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const panelCenter: CSSProperties = { textAlign: 'center' };

/** 类型 chip（日盘/周盘/盲盘）：色走 .sk 变量（var(--gold) 存量合规），字档 12 */
function TypeChip({ type }: { type: string }) {
  const st: CSSProperties =
    type === 'blind'
      ? { background: 'var(--ink)', color: 'var(--paper)' }
      : type === 'daily'
        ? { background: 'var(--gold-pale)', color: 'var(--ink)' }
        : { background: 'var(--gold)', color: 'var(--ink)' };
  return <b style={{ borderRadius: 999, padding: '3px 9px', fontSize: 12, ...st }}>{TYPE_LABEL[type] ?? type}</b>;
}

/** 状态签：rejected=赭红族 / counted= sunken 弱化 / draft=sunken 墨字（全走 token 类） */
function StatusSign({ status }: { status: string }) {
  const cls =
    status === 'rejected'
      ? 'bg-danger-light text-danger-deep'
      : status === 'counted'
        ? 'bg-sunken text-ink-secondary'
        : 'bg-sunken text-ink';
  const label =
    status === 'rejected'
      ? INVENTORY_COPY['inventory.status.rejected']
      : status === 'counted'
        ? INVENTORY_COPY['inventory.status.counted']
        : INVENTORY_COPY['inventory.status.draft'];
  return <b className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${cls}`}>{label}</b>;
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast({ durationMs: 2500 });

  const tasksQuery = useQuery({
    queryKey: ['inventory', 'myCountTasks'],
    queryFn: () => trpc.inventory.myCountTasks.query(),
  });
  const expiryQuery = useQuery({
    queryKey: ['inventory', 'carePackageExpiryStaff'],
    queryFn: () => trpc.inventory.carePackageExpiryStaff.query(),
  });

  /* ---- CJ-1015-02 A2：安心包到店发放（不绑 App · 可先发+店日库存记账+身份后补） ---- */
  const stockQuery = useQuery({
    queryKey: ['inventory', 'carePackageStockStaff'],
    queryFn: () => trpc.inventory.carePackageStockStaff.query(),
  });
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [issueQty, setIssueQty] = useState(1);
  const [issuePhone, setIssuePhone] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const issueM = useMutation({
    mutationFn: (input: { productId: string; qty: number; phone?: string; note?: string }) =>
      trpc.inventory.issueCarePack.mutate(input),
    onSuccess: (r) => {
      showToast(r.attachedUser ? INVENTORY_COPY['inventory.issue.successAttached'] : INVENTORY_COPY['inventory.issue.success']);
      setIssuingId(null);
      setIssueQty(1);
      setIssuePhone('');
      setIssueNote('');
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'carePackageStockStaff'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'carePackageExpiryStaff'] });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : '发放失败，请稍后再试'),
  });

  const tasks: CountTask[] = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const expiry: ExpiryItem[] = useMemo(() => expiryQuery.data ?? [], [expiryQuery.data]);
  const stockRows = useMemo(() => stockQuery.data ?? [], [stockQuery.data]);

  const now = new Date();
  const clockText = `${skc('sk.today')} ${ymd(now)} ${weekdayLabel(now)}${tasks.length ? ` · ${tasks.length} ${INVENTORY_COPY['inventory.aside.pending']}` : ''}`;

  return (
    <div className="sk">
      {/* S-08 属二级页组（dock 四槽冻结不含盘点）——二级页制=SkBackBar（nav 铁律四要素），
          语言包 apphead 位由 backbar 题注同帧承接 */}
      <SkBackBar title={INVENTORY_COPY['inventory.title']} note={INVENTORY_COPY['inventory.no']} fallback="/me" />
      <SkClockRow text={clockText} />

      {/* 待办盘点单（SkRows 行列：类型 chip + 状态签；counted 淡化 0.62；rejected 签走赭红族） */}
      <section data-testid="inv-tasks">
        {tasksQuery.isPending ? (
          <div style={{ margin: '12px 22px 0', display: 'grid', gap: 10 }} aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="u1-card h-16 !rounded-panel" />
            ))}
          </div>
        ) : tasksQuery.isError ? (
          <SkPanel testId="inv-tasks-error">
            <div style={panelCenter}>
              <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.load.fail']}</p>
              <div style={{ marginTop: 12 }}>
                <SkBtnAction onClick={() => void tasksQuery.refetch()} testId="sk-inv-retry">
                  {INVENTORY_COPY['inventory.retry']}
                </SkBtnAction>
              </div>
            </div>
          </SkPanel>
        ) : tasks.length === 0 ? (
          <div data-testid="inv-tasks-empty" style={{ paddingTop: 16 }}>
            <SkEmpty title={INVENTORY_COPY['inventory.tasks.empty']} />
          </div>
        ) : (
          <SkRows>
            {tasks.map((c) => (
              <button
                type="button"
                key={c.id}
                className="row"
                onClick={() => navigate(`/inventory/${c.id}`)}
                style={{
                  width: '100%', background: 'none', border: 0, cursor: 'pointer',
                  font: 'inherit', textAlign: 'left',
                  opacity: c.status === 'counted' ? 0.62 : 1,
                }}
                data-testid={`inv-task-${c.id}`}
              >
                <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TypeChip type={c.type} />
                    <StatusSign status={c.status} />
                  </span>
                  <span className="sk-mono" style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                    {INVENTORY_COPY['inventory.task.created']} {ymd(c.createdAt)} · {INVENTORY_COPY['inventory.task.countLead']}{' '}
                    {c.items.length} {INVENTORY_COPY['inventory.task.countTail']}
                    {c.status === 'rejected' ? ` · ${INVENTORY_COPY['inventory.task.rejectedEditable']}` : ''}
                  </span>
                </span>
                <span className="vl" aria-hidden>›</span>
              </button>
            ))}
          </SkRows>
        )}
      </section>

      {/* CJ-1015-02 A2：安心包发放（到店全员可发·不绑 App · 可先发+店日库存记账+身份后补） */}
      <SkSec>{INVENTORY_COPY['inventory.issue.title']}</SkSec>
      <section data-testid="inv-issue">
        {stockQuery.isPending ? (
          <div style={{ margin: '12px 22px 0' }} aria-label="加载中">
            <Skeleton className="u1-card h-16 !rounded-panel" />
          </div>
        ) : stockQuery.isError ? (
          <SkPanel testId="inv-issue-error">
            <div style={panelCenter}>
              <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.issue.loadFail']}</p>
              <div style={{ marginTop: 12 }}>
                <SkBtnAction onClick={() => void stockQuery.refetch()} testId="sk-inv-issue-retry">
                  {INVENTORY_COPY['inventory.retry']}
                </SkBtnAction>
              </div>
            </div>
          </SkPanel>
        ) : stockRows.length === 0 ? (
          <div data-testid="inv-issue-empty" style={{ paddingTop: 8 }}>
            <SkEmpty title={INVENTORY_COPY['inventory.issue.empty']} />
          </div>
        ) : (
          <>
            <SkRows>
              {stockRows.map((p) => (
                <div className="row" key={p.id} data-testid={`inv-issue-row-${p.id}`}>
                  <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 700 }}>{p.name}</span>
                    <span className="sk-mono" style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>
                      {INVENTORY_COPY['inventory.expiry.stock']} {p.stock}
                    </span>
                  </span>
                  <span className="vl">
                    <button
                      type="button"
                      className="sk-btn-ghost"
                      data-testid={`inv-issue-cta-${p.id}`}
                      onClick={() => {
                        setIssuingId(issuingId === p.id ? null : p.id);
                        setIssueQty(1);
                      }}
                    >
                      {INVENTORY_COPY['inventory.issue.cta']}
                    </button>
                  </span>
                </div>
              ))}
            </SkRows>
            {issuingId ? (
              <SkPanel testId="inv-issue-form">
                <span className="sk-label" style={{ marginTop: 0 }}>{INVENTORY_COPY['inventory.issue.qtyLabel']}</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={issueQty}
                  onChange={(e) => setIssueQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                  data-testid="inv-issue-qty"
                  className="sk-input"
                />
                <span className="sk-label">{INVENTORY_COPY['inventory.issue.phoneLabel']}</span>
                <input
                  type="tel"
                  value={issuePhone}
                  onChange={(e) => setIssuePhone(e.target.value)}
                  data-testid="inv-issue-phone"
                  className="sk-input"
                />
                <span className="sk-label">{INVENTORY_COPY['inventory.issue.noteLabel']}</span>
                <input
                  type="text"
                  value={issueNote}
                  onChange={(e) => setIssueNote(e.target.value)}
                  data-testid="inv-issue-note"
                  className="sk-input"
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <span style={{ flex: 1 }}>
                    <button
                      type="button"
                      className="sk-btn-ghost"
                      style={{ width: '100%' }}
                      data-testid="inv-issue-cancel"
                      onClick={() => {
                        setIssuingId(null);
                        setIssuePhone('');
                        setIssueNote('');
                      }}
                    >
                      {INVENTORY_COPY['inventory.issue.cancel']}
                    </button>
                  </span>
                  <span style={{ flex: 1 }}>
                    <SkBtnAction
                      testId="inv-issue-confirm"
                      disabled={issueM.isPending}
                      onClick={() =>
                        issueM.mutate({
                          productId: issuingId,
                          qty: issueQty,
                          ...(issuePhone.trim() ? { phone: issuePhone.trim() } : {}),
                          ...(issueNote.trim() ? { note: issueNote.trim() } : {}),
                        })
                      }
                    >
                      {issueM.isPending ? INVENTORY_COPY['inventory.issue.confirming'] : INVENTORY_COPY['inventory.issue.confirm']}
                    </SkBtnAction>
                  </span>
                </div>
              </SkPanel>
            ) : null}
            <SkNote>{INVENTORY_COPY['inventory.issue.note']}</SkNote>
          </>
        )}
      </section>

      {/* 口径注：日盘门槛 ≥¥100 · 盲盘不显系统库存 */}
      <SkNote>{INVENTORY_COPY['inventory.list.note']}</SkNote>

      {/* 安心包效期（只读 · 处置走回收登记流程） */}
      <SkSec>{INVENTORY_COPY['inventory.expiry.title']}</SkSec>
      <section data-testid="inv-expiry">
        {expiryQuery.isPending ? (
          <div style={{ margin: '12px 22px 0' }} aria-label="加载中">
            <Skeleton className="u1-card h-16 !rounded-panel" />
          </div>
        ) : expiryQuery.isError ? (
          <SkPanel testId="inv-expiry-error">
            <div style={panelCenter}>
              <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.expiry.loadFail']}</p>
              <div style={{ marginTop: 12 }}>
                <SkBtnAction onClick={() => void expiryQuery.refetch()} testId="sk-inv-expiry-retry">
                  {INVENTORY_COPY['inventory.retry']}
                </SkBtnAction>
              </div>
            </div>
          </SkPanel>
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
                      <span className="sk-mono" style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>
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
      {toastEl}
    </div>
  );
}
