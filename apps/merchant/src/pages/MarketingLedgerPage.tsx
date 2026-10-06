/**
 * 营销台账 /marketing-ledger（商家端大批片 5 · 批内末片）
 * u3-panel 竖排四区（工艺照 InventoryPage / MarketingPage）：
 * ①支出台账（expenseCreate 弹层 + expenseList 月筛选 + summary 合计/byType +
 *   行内删除[仅 owner，server merchantOwnerProcedure 硬闸]）
 * ②换货差价补退（exchangeCreate 弹层[原商品名/换新名/差价元±] + exchangeList 状态徽
 *   + 行内[确认][了结] exchangeAdvance 状态机 applied→confirmed→settled）
 * ③退货待检（inspectionCreate 弹层[商品/数量] + inspectionList +
 *   行内[合格][不合格] → 质检弹层 qcNote → inspectionReview）
 * ④报表快照（snapshotList 月筛选 + [生成快照]钮[仅 owner：选月+选 d1/member，
 *   payload 现取 report.d1Revenue / report.d3MemberGrowth 同帧后 snapshotCreate]）。
 * 全区 owner|manager（页内 canManage 闸门引导页；server 硬闸兜底）。
 * 页顶互链「← 会员营销」/marketing（rail 十九口冻结不改=页面互链口径）。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { fmtMoney, yuanToFen } from '../components/mall-admin/format';
import { Btn, Field, inputCls, Modal, toast, ToasterMount } from '../components/staff-admin/ui';
import { storeTodayStr } from '../components/cashier/refund';
import { mk } from '../copy/marketing';
import { useMerchantRole } from '../lib/roles';

type Mkt = inferRouterOutputs<AppRouter>['marketing'];
type ExpenseRow = Mkt['expenseList']['items'][number];
type ExchangeRow = Mkt['exchangeList'][number];
type InspectionRow = Mkt['inspectionList']['items'][number];
type SnapshotRow = Mkt['snapshotList']['items'][number];

type ExpenseType = 'rent' | 'salary' | 'utility' | 'other';
const EXPENSE_TYPES: readonly ExpenseType[] = ['rent', 'salary', 'utility', 'other'];

/* ------------------------------------------------------------------ */
/* 助手                                                                */
/* ------------------------------------------------------------------ */

/** 支出类型中文签 */
function expenseTypeLabel(t: string): string {
  switch (t) {
    case 'rent': return mk('mk.exp.typeRent');
    case 'salary': return mk('mk.exp.typeSalary');
    case 'utility': return mk('mk.exp.typeUtility');
    case 'other': return mk('mk.exp.typeOther');
    default: return t;
  }
}

/** 换货状态徽（applied 黄 / confirmed 墨 / settled 描边灰） */
function exchangeStatusBadge(s: string) {
  if (s === 'settled') return <span className="u3-st done">{mk('mk.exch.stSettled')}</span>;
  if (s === 'confirmed') return <span className="u3-st live">{mk('mk.exch.stConfirmed')}</span>;
  return <span className="u3-st amber">{mk('mk.exch.stApplied')}</span>;
}

/** 待检状态徽（pending 黄 / passed 墨 / failed 赭红） */
function inspectionStatusBadge(s: string) {
  if (s === 'failed') return <span className="u3-st red">{mk('mk.insp.stFailed')}</span>;
  if (s === 'passed') return <span className="u3-st live">{mk('mk.insp.stPassed')}</span>;
  return <span className="u3-st amber">{mk('mk.insp.stPending')}</span>;
}

/** 带符号元输入 → 分（正=补收 负=退差；非法 → null） */
function signedYuanToFen(input: string): number | null {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const fen = Number(m[2]) * 100 + (m[3] ? Number(m[3].padEnd(2, '0')) : 0);
  const signed = m[1] === '-' ? -fen : fen;
  if (!Number.isSafeInteger(signed) || Math.abs(signed) > 100_000_00) return null;
  return signed;
}

/** 差价文案（正=补收 负=退差 0=无差价） */
function diffLabel(fen: number): string {
  if (fen > 0) return mk('mk.exch.diffPlus', { v: fmtMoney(fen) });
  if (fen < 0) return mk('mk.exch.diffMinus', { v: fmtMoney(-fen) });
  return mk('mk.exch.diffZero');
}

/** 面板三态体（同 MarketingPage 工艺） */
function PanelBody({
  q, empty, children,
}: {
  q: { isPending: boolean; isError: boolean; refetch: () => Promise<unknown> };
  empty: string;
  children: ReactNode;
}) {
  if (q.isPending) {
    return (
      <div className="space-y-2 px-[17px] py-3" aria-label="加载中">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
        <p className="text-body-sm text-[rgba(59,46,36,.62)]">{mk('mk.common.loadFail')}</p>
        <div className="mt-4">
          <Btn variant="subtle" size="sm" onClick={() => void q.refetch()}>
            {mk('mk.common.retry')}
          </Btn>
        </div>
      </div>
    );
  }
  if (!children) {
    return (
      <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
        {empty}
      </p>
    );
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* 区 1 支出弹层                                                        */
/* ------------------------------------------------------------------ */

function ExpenseCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const [type, setType] = useState<ExpenseType>('rent');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(() => storeTodayStr().slice(0, 7));
  const [note, setNote] = useState('');

  const amountFen = yuanToFen(amount);
  const valid = amountFen !== null && amountFen >= 1 && /^\d{4}-\d{2}$/.test(month);

  const createM = useMutation({
    mutationFn: () =>
      trpc.marketing.expenseCreate.mutate({
        type,
        amountFen: amountFen!,
        bizMonth: month,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      toast(mk('mk.exp.done'));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mk('mk.exp.modalTitle')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn variant="primary" disabled={!valid || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? mk('mk.common.submitting') : mk('mk.common.submit')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.exp.fType')}>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as ExpenseType)}>
            {EXPENSE_TYPES.map((t) => (
              <option key={t} value={t}>{expenseTypeLabel(t)}</option>
            ))}
          </select>
        </Field>
        <Field label={mk('mk.exp.fAmount')}>
          <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={mk('mk.exp.fMonth')}>
          <input className={inputCls} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field label={mk('mk.exp.fNote')}>
          <input className={inputCls} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 区 2 换货弹层                                                        */
/* ------------------------------------------------------------------ */

function ExchangeCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const [origItemName, setOrig] = useState('');
  const [newItemName, setNew] = useState('');
  const [diff, setDiff] = useState('0');
  const [note, setNote] = useState('');

  const diffFen = diff.trim() === '' ? 0 : signedYuanToFen(diff);
  const valid = origItemName.trim() !== '' && newItemName.trim() !== '' && diffFen !== null;

  const createM = useMutation({
    mutationFn: () =>
      trpc.marketing.exchangeCreate.mutate({
        origItemName: origItemName.trim(),
        newItemName: newItemName.trim(),
        diffFen: diffFen ?? 0,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      toast(mk('mk.exch.done'));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mk('mk.exch.modalTitle')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn variant="primary" disabled={!valid || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? mk('mk.common.submitting') : mk('mk.common.submit')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.exch.fOrig')}>
          <input className={inputCls} maxLength={128} value={origItemName} onChange={(e) => setOrig(e.target.value)} />
        </Field>
        <Field label={mk('mk.exch.fNew')}>
          <input className={inputCls} maxLength={128} value={newItemName} onChange={(e) => setNew(e.target.value)} />
        </Field>
        <Field label={mk('mk.exch.fDiff')}>
          <input className={inputCls} inputMode="decimal" value={diff} onChange={(e) => setDiff(e.target.value)} />
        </Field>
        <Field label={mk('mk.exch.fNote')}>
          <input className={inputCls} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 区 3 待检弹层（登记 + 质检）                                           */
/* ------------------------------------------------------------------ */

function InspectionCreateDialog({
  open, onClose, products,
}: {
  open: boolean; onClose: () => void; products: Array<{ id: string; name: string }>;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');

  const qtyNum = Number(qty);
  const valid = productId !== '' && Number.isInteger(qtyNum) && qtyNum >= 1;

  const createM = useMutation({
    mutationFn: () =>
      trpc.marketing.inspectionCreate.mutate({
        productId,
        qty: qtyNum,
        ...(note.trim() ? { qcNote: note.trim() } : {}),
      }),
    onSuccess: () => {
      toast(mk('mk.insp.done'));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mk('mk.insp.modalTitle')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn variant="primary" disabled={!valid || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? mk('mk.common.submitting') : mk('mk.common.submit')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.insp.fProduct')}>
          <select className={inputCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label={mk('mk.insp.fQty')}>
          <input className={inputCls} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label={mk('mk.insp.fNote')}>
          <input className={inputCls} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** 质检弹层（合格/不合格 + qcNote；不合格 server 侧触发报损扣减同族） */
function InspectionReviewDialog({
  target, onClose,
}: {
  target: { row: InspectionRow; pass: boolean } | null;
  onClose: () => void;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const [qcNote, setQcNote] = useState('');

  const reviewM = useMutation({
    mutationFn: () =>
      trpc.marketing.inspectionReview.mutate({
        id: target!.row.id,
        pass: target!.pass,
        ...(qcNote.trim() ? { qcNote: qcNote.trim() } : {}),
      }),
    onSuccess: () => {
      toast(mk('mk.insp.reviewed'));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={`${mk('mk.insp.reviewTitle')} · ${target?.row.productName ?? ''}`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn
            variant={target?.pass ? 'primary' : 'danger'}
            disabled={reviewM.isPending}
            onClick={() => reviewM.mutate()}
          >
            {reviewM.isPending
              ? mk('mk.common.submitting')
              : target?.pass
                ? mk('mk.insp.passCta')
                : mk('mk.insp.failCta')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.insp.fQcNote')}>
          <input className={inputCls} maxLength={200} value={qcNote} onChange={(e) => setQcNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 区 4 快照弹层（仅 owner；payload 现取对应读口同帧）                     */
/* ------------------------------------------------------------------ */

function SnapshotCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const [month, setMonth] = useState(() => storeTodayStr().slice(0, 7));
  const [kind, setKind] = useState<'d1' | 'member'>('d1');
  const [busy, setBusy] = useState(false);

  const valid = /^\d{4}-\d{2}$/.test(month);

  const submit = async () => {
    setBusy(true);
    try {
      /* payload 现取对应读口同帧（d1=d1Revenue / member=d3MemberGrowth），不手拼假数 */
      const payload =
        kind === 'd1'
          ? ((await trpc.report.d1Revenue.query({ month })) as unknown as Record<string, unknown>)
          : ((await trpc.report.d3MemberGrowth.query({ month })) as unknown as Record<string, unknown>);
      await trpc.marketing.snapshotCreate.mutate({ month, kind, payloadJson: payload });
      toast(mk('mk.snap.done'));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mk('mk.snap.modalTitle')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn variant="primary" disabled={!valid || busy} onClick={() => void submit()}>
            {busy ? mk('mk.snap.working') : mk('mk.common.submit')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.snap.fMonth')}>
          <input className={inputCls} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field label={mk('mk.snap.fKind')} hint={mk('mk.snap.hint')}>
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as 'd1' | 'member')}>
            <option value="d1">{mk('mk.snap.kindD1')}</option>
            <option value="member">{mk('mk.snap.kindMember')}</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function MarketingLedgerPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();

  /* ---- 区 1 支出 ---- */
  const [expMonth, setExpMonth] = useState(() => storeTodayStr().slice(0, 7));
  const expenseQ = useQuery({
    queryKey: ['marketing', 'expenseList', expMonth],
    queryFn: () => trpc.marketing.expenseList.query(expMonth ? { month: expMonth } : {}),
    enabled: role.canManage,
  });
  const [expOpen, setExpOpen] = useState(false);
  const [expDelBusyId, setExpDelBusyId] = useState<string | null>(null);

  /* ---- 区 2 换货 ---- */
  const exchangeQ = useQuery({
    queryKey: ['marketing', 'exchangeList'],
    queryFn: () => trpc.marketing.exchangeList.query(),
    enabled: role.canManage,
  });
  const [exchOpen, setExchOpen] = useState(false);
  const [exchBusyId, setExchBusyId] = useState<string | null>(null);

  /* ---- 区 3 退货待检 ---- */
  const inspQ = useQuery({
    queryKey: ['marketing', 'inspectionList'],
    queryFn: () => trpc.marketing.inspectionList.query(),
    enabled: role.canManage,
  });
  const productsQ = useQuery({
    queryKey: ['marketing', 'products'],
    queryFn: () => trpc.mall.listProductsForStore.query({ page: 1, pageSize: 200 }),
    enabled: role.canManage,
  });
  const [inspOpen, setInspOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ row: InspectionRow; pass: boolean } | null>(null);

  /* ---- 区 4 报表快照 ---- */
  const [snapMonth, setSnapMonth] = useState('');
  const snapQ = useQuery({
    queryKey: ['marketing', 'snapshotList', snapMonth],
    queryFn: () => trpc.marketing.snapshotList.query(snapMonth ? { month: snapMonth } : {}),
    enabled: role.canManage,
  });
  const [snapOpen, setSnapOpen] = useState(false);

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['marketing'] });

  const doExpenseDelete = async (id: string) => {
    setExpDelBusyId(id);
    try {
      await trpc.marketing.expenseDelete.mutate({ id });
      toast(mk('mk.exp.deleted'));
      invalidateAll();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setExpDelBusyId(null);
    }
  };

  const doExchangeAdvance = async (id: string, action: 'confirm' | 'settle') => {
    setExchBusyId(id);
    try {
      await trpc.marketing.exchangeAdvance.mutate({ id, action });
      toast(mk('mk.exch.advanced'));
      invalidateAll();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setExchBusyId(null);
    }
  };

  if (!role.canManage) {
    return <RoleGuidePage title={mk('mk.guide.title')} hint={mk('mk.guide.hint')} />;
  }

  const expenses = expenseQ.data?.items ?? [];
  const summary = expenseQ.data?.summary;
  const exchanges = exchangeQ.data ?? [];
  const inspections = inspQ.data?.items ?? [];
  const snapshots = snapQ.data?.items ?? [];
  const products = (productsQ.data?.items ?? []).map((p) => ({ id: p.id, name: p.name }));

  return (
    <MainScaffold title={mk('mk.ledger.pageTitle')} sub={mk('mk.ledger.pageSub')} testid="marketing-ledger-page">
      <ToasterMount />

      {/* 页面互链（rail 十九口冻结不改=页面互链口径） */}
      <p className="mb-3 text-caption-xs">
        <Link to="/marketing" className="text-brand underline underline-offset-2" data-testid="ledger-to-marketing">
          {mk('mk.ledger.backMarketing')}
        </Link>
      </p>

      {/* 区 1 支出台账 */}
      <div className="u3-panel mb-4" data-testid="ledger-expenses">
        <div className="u3-panel-head">
          <h3>{mk('mk.exp.title')}</h3>
          <span className="aside">{mk('mk.exp.aside')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5">
          <label className="flex items-center gap-2 text-caption text-[rgba(59,46,36,.62)]">
            {mk('mk.exp.monthLabel')}
            <input
              type="month"
              value={expMonth}
              onChange={(e) => setExpMonth(e.target.value)}
              data-testid="ledger-exp-month"
              className="u1-ring rounded-control bg-card px-3 py-2 font-number text-caption tabular-nums text-ink focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
            />
          </label>
          {expMonth ? (
            <Btn variant="subtle" size="sm" onClick={() => setExpMonth('')}>
              {mk('mk.exp.monthAll')}
            </Btn>
          ) : null}
          <span className="flex-1" />
          <Btn variant="primary" size="sm" onClick={() => setExpOpen(true)} data-testid="ledger-exp-create">
            {mk('mk.exp.createCta')}
          </Btn>
        </div>
        {summary ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid="ledger-exp-summary">
            <span className="u3-st live">
              {mk('mk.exp.summaryTotal')} {fmtMoney(summary.totalFen)}
            </span>
            {EXPENSE_TYPES.filter((t) => (summary.byType[t] ?? 0) > 0).map((t) => (
              <span key={t} className="u3-st wait">
                {expenseTypeLabel(t)} {fmtMoney(summary.byType[t] ?? 0)}
              </span>
            ))}
          </div>
        ) : null}
        <PanelBody q={expenseQ} empty={mk('mk.exp.empty')}>
          {expenses.length === 0 ? null : (
            <div className="u3-noscrollx overflow-x-auto">
              <table className="u3-tbl min-w-[820px]">
                <thead>
                  <tr>
                    <th>{mk('mk.exp.colType')}</th>
                    <th className="text-right">{mk('mk.exp.colAmount')}</th>
                    <th>{mk('mk.exp.colMonth')}</th>
                    <th>{mk('mk.exp.colNote')}</th>
                    <th>{mk('mk.exp.colOperator')}</th>
                    <th className="text-right">{mk('mk.campaign.colTime')}</th>
                    {role.isOwner ? <th>{mk('mk.exp.colOps')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((r: ExpenseRow) => (
                    <tr key={r.id} data-testid={`ledger-exp-${r.id}`}>
                      <td className="font-semibold">{expenseTypeLabel(r.type)}</td>
                      <td className="u1-num text-right font-bold">{fmtMoney(r.amountFen)}</td>
                      <td className="u1-num">{r.bizMonth}</td>
                      <td className="max-w-48 truncate text-caption-xs text-[rgba(59,46,36,.62)]">{r.note ?? '—'}</td>
                      <td className="text-caption-xs">{r.operatorName ?? '—'}</td>
                      <td className="u1-num text-right text-caption-xs">{fmtDateTime(r.createdAt)}</td>
                      {role.isOwner ? (
                        <td>
                          <Btn
                            variant="subtle"
                            size="sm"
                            disabled={expDelBusyId === r.id}
                            onClick={() => void doExpenseDelete(r.id)}
                            data-testid={`ledger-exp-del-${r.id}`}
                          >
                            {mk('mk.exp.deleteCta')}
                          </Btn>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
        {expenseQ.data?.note ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5 text-caption-xs text-[rgba(59,46,36,.42)]">
            {expenseQ.data.note}
          </p>
        ) : null}
      </div>

      {/* 区 2 换货差价补退 */}
      <div className="u3-panel mb-4" data-testid="ledger-exchanges">
        <div className="u3-panel-head">
          <h3>{mk('mk.exch.title')}</h3>
          <span className="aside">{mk('mk.exch.aside')}</span>
        </div>
        <div className="flex items-center justify-end border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5">
          <Btn variant="primary" size="sm" onClick={() => setExchOpen(true)} data-testid="ledger-exch-create">
            {mk('mk.exch.createCta')}
          </Btn>
        </div>
        <PanelBody q={exchangeQ} empty={mk('mk.exch.empty')}>
          {exchanges.length === 0 ? null : (
            <div className="u3-noscrollx overflow-x-auto">
              <table className="u3-tbl min-w-[860px]">
                <thead>
                  <tr>
                    <th>{mk('mk.exch.colOrig')}</th>
                    <th>{mk('mk.exch.colNew')}</th>
                    <th className="text-right">{mk('mk.exch.colDiff')}</th>
                    <th>{mk('mk.exch.colStatus')}</th>
                    <th>{mk('mk.exch.colNote')}</th>
                    <th>{mk('mk.exch.colOperator')}</th>
                    <th>{mk('mk.exch.colOps')}</th>
                  </tr>
                </thead>
                <tbody>
                  {exchanges.map((r: ExchangeRow) => (
                    <tr key={r.id} data-testid={`ledger-exch-${r.id}`}>
                      <td className="font-semibold">{r.origItemName}</td>
                      <td className="font-semibold">{r.newItemName}</td>
                      <td className="u1-num text-right font-bold">{diffLabel(r.diffFen)}</td>
                      <td>{exchangeStatusBadge(r.status)}</td>
                      <td className="max-w-40 truncate text-caption-xs text-[rgba(59,46,36,.62)]">{r.note ?? '—'}</td>
                      <td className="text-caption-xs">{r.operatorName ?? '—'}</td>
                      <td>
                        <div className="flex gap-1.5">
                          {r.status === 'applied' ? (
                            <Btn
                              variant="subtle"
                              size="sm"
                              disabled={exchBusyId === r.id}
                              onClick={() => void doExchangeAdvance(r.id, 'confirm')}
                              data-testid={`ledger-exch-confirm-${r.id}`}
                            >
                              {mk('mk.exch.confirmCta')}
                            </Btn>
                          ) : null}
                          {r.status === 'applied' || r.status === 'confirmed' ? (
                            <Btn
                              variant="subtle"
                              size="sm"
                              disabled={exchBusyId === r.id}
                              onClick={() => void doExchangeAdvance(r.id, 'settle')}
                              data-testid={`ledger-exch-settle-${r.id}`}
                            >
                              {mk('mk.exch.settleCta')}
                            </Btn>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </div>

      {/* 区 3 退货待检 */}
      <div className="u3-panel mb-4" data-testid="ledger-inspections">
        <div className="u3-panel-head">
          <h3>{mk('mk.insp.title')}</h3>
          <span className="aside">{mk('mk.insp.aside')}</span>
        </div>
        <div className="flex items-center justify-end border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5">
          <Btn variant="primary" size="sm" onClick={() => setInspOpen(true)} data-testid="ledger-insp-create">
            {mk('mk.insp.createCta')}
          </Btn>
        </div>
        <PanelBody q={inspQ} empty={mk('mk.insp.empty')}>
          {inspections.length === 0 ? null : (
            <div className="u3-noscrollx overflow-x-auto">
              <table className="u3-tbl min-w-[860px]">
                <thead>
                  <tr>
                    <th>{mk('mk.insp.colProduct')}</th>
                    <th className="text-right">{mk('mk.insp.colQty')}</th>
                    <th>{mk('mk.insp.colStatus')}</th>
                    <th>{mk('mk.insp.colQcNote')}</th>
                    <th>{mk('mk.insp.colOperator')}</th>
                    <th className="text-right">{mk('mk.insp.colTime')}</th>
                    <th>{mk('mk.insp.colOps')}</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((r) => (
                    <tr key={r.id} data-testid={`ledger-insp-${r.id}`}>
                      <td className="font-semibold">{r.productName}</td>
                      <td className="u1-num text-right">{r.qty}</td>
                      <td>{inspectionStatusBadge(r.status)}</td>
                      <td className="max-w-48 truncate text-caption-xs text-[rgba(59,46,36,.62)]">{r.qcNote ?? '—'}</td>
                      <td className="text-caption-xs">{r.operatorName ?? '—'}</td>
                      <td className="u1-num text-right text-caption-xs">{fmtDateTime(r.createdAt)}</td>
                      <td>
                        {r.status === 'pending' ? (
                          <div className="flex gap-1.5">
                            <Btn
                              variant="subtle"
                              size="sm"
                              onClick={() => {
                                setReviewTarget({ row: r, pass: true });
                              }}
                              data-testid={`ledger-insp-pass-${r.id}`}
                            >
                              {mk('mk.insp.passCta')}
                            </Btn>
                            <Btn
                              variant="subtle"
                              size="sm"
                              onClick={() => {
                                setReviewTarget({ row: r, pass: false });
                              }}
                              data-testid={`ledger-insp-fail-${r.id}`}
                            >
                              {mk('mk.insp.failCta')}
                            </Btn>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
        {inspQ.data?.note ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5 text-caption-xs text-[rgba(59,46,36,.42)]">
            {inspQ.data.note}
          </p>
        ) : null}
      </div>

      {/* 区 4 报表快照 */}
      <div className="u3-panel mb-4" data-testid="ledger-snapshots">
        <div className="u3-panel-head">
          <h3>{mk('mk.snap.title')}</h3>
          <span className="aside">{mk('mk.snap.aside')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5">
          <label className="flex items-center gap-2 text-caption text-[rgba(59,46,36,.62)]">
            {mk('mk.exp.monthLabel')}
            <input
              type="month"
              value={snapMonth}
              onChange={(e) => setSnapMonth(e.target.value)}
              data-testid="ledger-snap-month"
              className="u1-ring rounded-control bg-card px-3 py-2 font-number text-caption tabular-nums text-ink focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
            />
          </label>
          {snapMonth ? (
            <Btn variant="subtle" size="sm" onClick={() => setSnapMonth('')}>
              {mk('mk.snap.monthAll')}
            </Btn>
          ) : null}
          <span className="flex-1" />
          {/* 生成快照仅 owner（server merchantOwnerProcedure 硬闸；manager 不渲染） */}
          {role.isOwner ? (
            <Btn variant="primary" size="sm" onClick={() => setSnapOpen(true)} data-testid="ledger-snap-create">
              {mk('mk.snap.createCta')}
            </Btn>
          ) : null}
        </div>
        <PanelBody q={snapQ} empty={mk('mk.snap.empty')}>
          {snapshots.length === 0 ? null : (
            <table className="u3-tbl">
              <thead>
                <tr>
                  <th>{mk('mk.snap.colMonth')}</th>
                  <th>{mk('mk.snap.colKind')}</th>
                  <th>{mk('mk.snap.colCreator')}</th>
                  <th className="text-right">{mk('mk.snap.colTime')}</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s: SnapshotRow) => (
                  <tr key={s.id} data-testid={`ledger-snap-${s.id}`}>
                    <td className="u1-num font-bold">{s.month}</td>
                    <td className="font-semibold">{s.kind === 'd1' ? mk('mk.snap.kindD1') : mk('mk.snap.kindMember')}</td>
                    <td className="text-caption-xs">{s.creatorName ?? '—'}</td>
                    <td className="u1-num text-right text-caption-xs">{fmtDateTime(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelBody>
        {snapQ.data?.note ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5 text-caption-xs text-[rgba(59,46,36,.42)]">
            {snapQ.data.note}
          </p>
        ) : null}
      </div>

      <ExpenseCreateDialog open={expOpen} onClose={() => setExpOpen(false)} />
      <ExchangeCreateDialog open={exchOpen} onClose={() => setExchOpen(false)} />
      <InspectionCreateDialog open={inspOpen} onClose={() => setInspOpen(false)} products={products} />
      <InspectionReviewDialog
        key={reviewTarget ? `${reviewTarget.row.id}-${reviewTarget.pass ? 'p' : 'f'}` : 'none'}
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
      />
      <SnapshotCreateDialog open={snapOpen} onClose={() => setSnapOpen(false)} />
    </MainScaffold>
  );
}
