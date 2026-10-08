/**
 * 调拨要货 /transfers（商家端大批片 4 · 调拨要货页）
 * u3-panel 竖排三区（工艺照 OpsPage）：①调拨发起+列表（transferCreate/List
 * direction=out|in，发货/接收成对确认）②在途视图（transferInTransit 超时红签）
 * ③要货（replenishSuggest 建议量预填 + Create/List + 履约）；全区 canManage 闸。
 */

import { Skeleton, useMe, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg } from '../components/mall-admin/format';
import { Badge, Btn, Field, inputCls, Modal, toast, ToasterMount } from '../components/staff-admin/ui';
import { iv } from '../copy/inventory';
import { useMerchantRole } from '../lib/roles';

/* ------------------------------------------------------------------ */
/* 助手                                                                */
/* ------------------------------------------------------------------ */

function fmtAt(at: Date | string | null | undefined): string {
  if (!at) return '—';
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 调拨单状态键 → 中文口径（未知键原样透出） */
function transferStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return iv('trf.move.statusPending');
    case 'approved':
      return iv('trf.move.statusApproved');
    case 'rejected':
      return iv('trf.move.statusRejected');
    case 'in_transit':
      return iv('trf.move.statusInTransit');
    case 'received':
      return iv('trf.move.statusReceived');
    default:
      return status;
  }
}
function transferStatusTone(status: string): 'brand' | 'success' | 'danger' | 'muted' {
  if (status === 'received') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'brand';
  return 'muted';
}

/** 要货单状态键 → 中文口径（未知键原样透出） */
function replenishStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return iv('trf.rep.statusPending');
    case 'approved':
      return iv('trf.rep.statusApproved');
    case 'rejected':
      return iv('trf.rep.statusRejected');
    case 'fulfilled':
      return iv('trf.rep.statusFulfilled');
    default:
      return status;
  }
}

/** 正整数解析（1~1000000；非法 → null 不提交） */
function parseQty(s: string): number | null {
  const t = s.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 1_000_000 ? n : null;
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function TransfersPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();
  const { user } = useMe();
  const storeId = user?.storeId;

  /* ---- 店集合（调拨目标店=listMine 内他店；在途视图店名映射同用） ---- */
  const storesQ = useQuery({
    queryKey: ['transfers', 'listMine'],
    queryFn: () => trpc.store.listMine.query(),
    enabled: role.canManage,
  });
  const otherStores = useMemo(
    () => (storesQ.data?.stores ?? []).filter((s) => s.id !== storeId),
    [storesQ.data, storeId],
  );
  const storeNameOf = useMemo(() => {
    const m = new Map((storesQ.data?.stores ?? []).map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? id;
  }, [storesQ.data]);

  /* ---- 商品集合（调拨行/要货品选择共用；OP-03 P2-2：安心包独立库存域只读件——
     与收银台选购同闸 care_package 全排除，普通要货调拨不出现） ---- */
  const productsQ = useQuery({
    queryKey: ['transfers', 'products'],
    queryFn: () => trpc.mall.listProductsForStore.query({ page: 1, pageSize: 200 }),
    enabled: role.canManage,
  });
  const products = useMemo(() => productsQ.data?.items ?? [], [productsQ.data]);

  /* ---- 区 1 调拨（发起弹层 + out/in 列表） ---- */
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const transferQ = useQuery({
    queryKey: ['transfers', 'transferList', direction],
    queryFn: () => trpc.stock2.transferList.query({ direction }),
    enabled: role.canManage,
  });
  const [trOpen, setTrOpen] = useState(false);
  const [trToStoreId, setTrToStoreId] = useState('');
  const [trProductId, setTrProductId] = useState('');
  const [trQty, setTrQty] = useState('');
  const [trNote, setTrNote] = useState('');
  const [trBusy, setTrBusy] = useState(false);
  const [shipBusyId, setShipBusyId] = useState<string | null>(null);
  const [receiveBusyId, setReceiveBusyId] = useState<string | null>(null);

  /* ---- 区 2 在途视图 ---- */
  const transitQ = useQuery({
    queryKey: ['transfers', 'inTransit'],
    queryFn: () => trpc.stock2.transferInTransit.query(),
    enabled: role.canManage,
  });

  /* ---- 区 3 要货（按品建议量预填 + 申请 + 列表 + 履约） ---- */
  const [repProductId, setRepProductId] = useState('');
  const [repQty, setRepQty] = useState('');
  const [repBusy, setRepBusy] = useState(false);
  const suggestQ = useQuery({
    queryKey: ['transfers', 'replenishSuggest', repProductId],
    queryFn: () => trpc.stock2.replenishSuggest.query({ productId: repProductId }),
    enabled: role.canManage && repProductId.length > 0,
  });
  /* 建议量预填：选品后建议量回填数量框（手改不覆写——随选品变化才回填） */
  useEffect(() => {
    if (suggestQ.data) setRepQty(String(suggestQ.data.suggestQty));
  }, [suggestQ.data]);
  const replenishQ = useQuery({
    queryKey: ['transfers', 'replenishList'],
    queryFn: () => trpc.stock2.replenishList.query(),
    enabled: role.canManage,
  });
  const [fulfillBusyId, setFulfillBusyId] = useState<string | null>(null);

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['transfers'] });

  const openTransferCreate = () => {
    setTrToStoreId(otherStores[0]?.id || '');
    setTrProductId(products[0]?.id || '');
    setTrQty('');
    setTrNote('');
    setTrOpen(true);
  };
  const submitTransferCreate = async () => {
    if (!trToStoreId || !trProductId) return;
    const qty = parseQty(trQty);
    if (qty === null) {
      toast(iv('inv.batch.qtyInvalid'), 'error');
      return;
    }
    setTrBusy(true);
    try {
      await trpc.stock2.transferCreate.mutate({
        toStoreId: trToStoreId,
        items: [{ productId: trProductId, qty }],
        ...(trNote.trim() ? { note: trNote.trim() } : {}),
      });
      toast(iv('trf.move.createDone'));
      setTrOpen(false);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setTrBusy(false);
    }
  };

  const doShip = async (orderId: string) => {
    setShipBusyId(orderId);
    try {
      await trpc.stock2.transferShip.mutate({ orderId });
      toast(iv('trf.move.shipDone'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setShipBusyId(null);
    }
  };

  const doReceive = async (orderId: string) => {
    setReceiveBusyId(orderId);
    try {
      await trpc.stock2.transferReceive.mutate({ orderId });
      toast(iv('trf.move.receiveDone'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setReceiveBusyId(null);
    }
  };

  const submitReplenish = async () => {
    if (!repProductId) return;
    const qty = parseQty(repQty);
    if (qty === null) {
      toast(iv('inv.batch.qtyInvalid'), 'error');
      return;
    }
    setRepBusy(true);
    try {
      await trpc.stock2.replenishCreate.mutate({ productId: repProductId, qty });
      toast(iv('trf.rep.createDone'));
      setRepQty('');
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setRepBusy(false);
    }
  };

  const doFulfill = async (requestId: string) => {
    setFulfillBusyId(requestId);
    try {
      await trpc.stock2.replenishFulfill.mutate({ requestId });
      toast(iv('trf.rep.fulfillDone'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setFulfillBusyId(null);
    }
  };

  if (!role.canManage) {
    return <RoleGuidePage title={iv('trf.guideTitle')} hint={iv('trf.guideHint')} />;
  }

  const transfers = transferQ.data ?? [];
  const transitItems = transitQ.data?.items ?? [];
  const replenishes = replenishQ.data ?? [];

  return (
    <MainScaffold title={iv('trf.pageTitle')} sub={iv('trf.pageSub')} testid="transfers-page">
      <ToasterMount />

      {/* 页面互链（rail 冻结不改；调拨⇄库存互链） */}
      <p className="mb-3 text-caption-xs">
        <Link to="/inventory" className="text-brand underline underline-offset-2" data-testid="transfers-to-inventory">← {iv('inv.pageTitle')}</Link>
      </p>

      {/* 区 1 调拨（发起 + 调出/调入列表 + 发货/接收成对确认） */}
      <div className="u3-panel mb-4" data-testid="transfers-move">
        <div className="u3-panel-head">
          <h3>{iv('trf.move.title')}</h3>
          <span className="aside">{iv('trf.move.aside')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          {(['out', 'in'] as const).map((d) => {
            const on = direction === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDirection(d)}
                data-testid={`transfers-dir-${d}`}
                className={`min-h-[36px] rounded-chip px-3 text-caption font-semibold transition-transform duration-120 ease-philia-spring active:scale-92 ${
                  on ? 'bg-ink text-[#F2DFA6]' : 'bg-sunken text-ink-secondary'
                }`}
              >
                {d === 'out' ? iv('trf.move.dirOut') : iv('trf.move.dirIn')}
              </button>
            );
          })}
          <Btn variant="primary" size="sm" onClick={openTransferCreate} data-testid="transfers-create">
            {iv('trf.move.createCta')}
          </Btn>
        </div>
        {transferQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : transferQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{iv('inv.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void transferQ.refetch()}>
                {iv('inv.common.retry')}
              </Btn>
            </div>
          </div>
        ) : transfers.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {iv('trf.move.empty')}
          </p>
        ) : (
          transfers.map((t) => {
            const totalQty = t.itemsJson.reduce((s, it) => s + it.qty, 0);
            return (
              <div key={t.id} className="border-t border-[rgba(59,46,36,.06)]" data-testid={`transfers-row-${t.id}`}>
                <div className="flex flex-wrap items-center gap-2 px-[17px] py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="u1-num text-body-sm font-bold text-ink">{t.orderNo}</span>
                      <Badge tone={transferStatusTone(t.status)}>{transferStatusLabel(t.status)}</Badge>
                      <span className="text-caption text-[rgba(59,46,36,.62)]">
                        {direction === 'out'
                          ? iv('trf.move.toLabel', { name: t.toStoreName ?? storeNameOf(t.toStoreId) })
                          : iv('trf.move.fromLabel', { name: t.fromStoreName ?? storeNameOf(t.fromStoreId) })}
                      </span>
                    </div>
                    <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                      {iv('trf.move.itemsSummary', { n: t.itemsJson.length, q: totalQty })} · {fmtAt(t.createdAt)}
                    </div>
                    <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.62)]">
                      {t.itemsJson.map((it) => `${it.name} ×${it.qty}`).join('、')}
                    </div>
                  </div>
                  {direction === 'out' && t.status === 'approved' ? (
                    <Btn
                      variant="primary"
                      size="sm"
                      disabled={shipBusyId === t.id}
                      onClick={() => void doShip(t.id)}
                      data-testid={`transfers-ship-${t.id}`}
                    >
                      {iv('trf.move.shipCta')}
                    </Btn>
                  ) : null}
                  {direction === 'in' && t.status === 'in_transit' ? (
                    <Btn
                      variant="primary"
                      size="sm"
                      disabled={receiveBusyId === t.id}
                      onClick={() => void doReceive(t.id)}
                      data-testid={`transfers-receive-${t.id}`}
                    >
                      {iv('trf.move.receiveCta')}
                    </Btn>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 区 2 在途视图（inTransitHours + 超时红签） */}
      <div className="u3-panel mb-4" data-testid="transfers-transit">
        <div className="u3-panel-head">
          <h3>{iv('trf.transit.title')}</h3>
          <span className="aside">{iv('trf.transit.aside', { h: transitQ.data?.warnHours ?? 24 })}</span>
        </div>
        {transitQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : transitQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{iv('inv.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void transitQ.refetch()}>
                {iv('inv.common.retry')}
              </Btn>
            </div>
          </div>
        ) : transitItems.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {iv('trf.transit.empty')}
          </p>
        ) : (
          transitItems.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`transfers-transit-row-${t.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="u1-num text-body-sm font-bold text-ink">{t.orderNo}</span>
                  {t.overdue ? <span className="u3-st red">{iv('trf.transit.overdue')}</span> : null}
                </div>
                <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {storeNameOf(t.fromStoreId)} → {storeNameOf(t.toStoreId)} ·{' '}
                  {t.inTransitHours !== null ? iv('trf.transit.hours', { h: t.inTransitHours }) : iv('trf.transit.hoursUnknown')}
                </div>
                <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.62)]">
                  {t.itemsJson.map((it) => `${it.name} ×${it.qty}`).join('、')}
                </div>
              </div>
              {t.toStoreId === storeId ? (
                <Btn
                  variant="primary"
                  size="sm"
                  disabled={receiveBusyId === t.id}
                  onClick={() => void doReceive(t.id)}
                  data-testid={`transfers-transit-receive-${t.id}`}
                >
                  {iv('trf.move.receiveCta')}
                </Btn>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* 区 3 要货（按品建议量预填 + 申请 + 状态徽列表 + 履约） */}
      <div className="u3-panel" data-testid="transfers-replenish">
        <div className="u3-panel-head">
          <h3>{iv('trf.rep.title')}</h3>
          <span className="aside">{iv('trf.rep.aside')}</span>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <Field label={iv('trf.move.productLabel')}>
            <select
              className={inputCls}
              style={{ width: 'auto' }}
              value={repProductId}
              onChange={(e) => setRepProductId(e.target.value)}
              data-testid="transfers-rep-product"
            >
              <option value="">{iv('trf.move.productLabel')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={iv('trf.move.qtyLabel')}>
            <input
              className={inputCls}
              style={{ width: 110 }}
              value={repQty}
              inputMode="numeric"
              placeholder="0"
              onChange={(e) => setRepQty(e.target.value)}
              data-testid="transfers-rep-qty"
            />
          </Field>
          <Btn
            variant="primary"
            size="sm"
            disabled={repBusy || !repProductId}
            onClick={() => void submitReplenish()}
            data-testid="transfers-rep-create"
          >
            {repBusy ? iv('inv.common.submitting') : iv('trf.rep.createCta')}
          </Btn>
          {suggestQ.data ? (
            <Badge tone="brand">{iv('trf.rep.suggest', { n: suggestQ.data.suggestQty })}</Badge>
          ) : null}
        </div>
        {replenishQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : replenishQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{iv('inv.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void replenishQ.refetch()}>
                {iv('inv.common.retry')}
              </Btn>
            </div>
          </div>
        ) : replenishes.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {iv('trf.rep.empty')}
          </p>
        ) : (
          replenishes.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`transfers-rep-row-${r.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-body-sm font-bold text-ink">{r.productName}</span>
                  <span className="u1-num text-caption text-ink">{iv('inv.batch.qtyUnit', { n: r.qty })}</span>
                  <Badge tone={r.status === 'fulfilled' ? 'success' : r.status === 'rejected' ? 'danger' : r.status === 'pending' ? 'brand' : 'muted'}>
                    {replenishStatusLabel(r.status)}
                  </Badge>
                </div>
                <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">{fmtAt(r.createdAt)}</div>
              </div>
              {r.status === 'approved' ? (
                <Btn
                  variant="primary"
                  size="sm"
                  disabled={fulfillBusyId === r.id}
                  onClick={() => void doFulfill(r.id)}
                  data-testid={`transfers-rep-fulfill-${r.id}`}
                >
                  {iv('trf.rep.fulfillCta')}
                </Btn>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* 调拨发起弹层（目标店=listMine 内他店 / 商品行 / 数量） */}
      <Modal
        open={trOpen}
        onClose={() => setTrOpen(false)}
        title={iv('trf.move.createTitle')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setTrOpen(false)} disabled={trBusy}>
              {iv('inv.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitTransferCreate()} disabled={trBusy} data-testid="transfers-create-submit">
              {trBusy ? iv('inv.common.submitting') : iv('inv.common.confirm')}
            </Btn>
          </>
        }
      >
        <div className="grid gap-3">
          {otherStores.length === 0 ? (
            <p className="text-caption text-[rgba(59,46,36,.62)]">{iv('trf.move.noStore')}</p>
          ) : (
            <Field label={iv('trf.move.toStoreLabel')}>
              <select className={inputCls} value={trToStoreId} onChange={(e) => setTrToStoreId(e.target.value)} data-testid="transfers-create-store">
                {otherStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={iv('trf.move.productLabel')}>
            <select className={inputCls} value={trProductId} onChange={(e) => setTrProductId(e.target.value)} data-testid="transfers-create-product">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={iv('trf.move.qtyLabel')}>
            <input className={inputCls} value={trQty} inputMode="numeric" placeholder="0" onChange={(e) => setTrQty(e.target.value)} data-testid="transfers-create-qty" />
          </Field>
          <Field label={iv('trf.move.notePh')}>
            <input className={inputCls} value={trNote} maxLength={200} onChange={(e) => setTrNote(e.target.value)} data-testid="transfers-create-note" />
          </Field>
        </div>
      </Modal>
    </MainScaffold>
  );
}
