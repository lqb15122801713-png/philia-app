/**
 * 库存 /inventory（商家端大批片 4 · 库存域页）
 * u3-panel 竖排五区（工艺照 OpsPage）：①上下限预警（stockAlerts）②效期看板
 * （expiryBoard+隔离/销毁）③批次（batchList+手工入批+FEFO 先出签）④报损
 * （writeoffCreate/List）⑤估清/恢复（markSoldOut/restockProduct）；全区 canManage 闸。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg, fmtMoney } from '../components/mall-admin/format';
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
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 效期分级 → u3-st 既有类（expired 黑 / urgent 红 / warn 黄） */
function gradeCls(grade: string): string {
  if (grade === 'expired') return 'u3-st live';
  if (grade === 'urgent') return 'u3-st red';
  return 'u3-st amber';
}
function gradeLabel(grade: string): string {
  if (grade === 'expired') return iv('inv.expiry.gradeExpired');
  if (grade === 'urgent') return iv('inv.expiry.gradeUrgent');
  if (grade === 'warn') return iv('inv.expiry.gradeWarn');
  return grade;
}

/** 批次状态徽（未知键原样透出） */
function batchStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return iv('inv.batch.statusActive');
    case 'quarantined':
      return iv('inv.batch.statusQuarantined');
    case 'destroyed':
      return iv('inv.batch.statusDestroyed');
    default:
      return status;
  }
}

/** 报损状态徽（未知键原样透出） */
function writeoffStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return iv('inv.writeoff.statusPending');
    case 'approved':
      return iv('inv.writeoff.statusApproved');
    case 'rejected':
      return iv('inv.writeoff.statusRejected');
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

export default function InventoryPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();

  /* ---- 商品集合（筛选/弹层共用：本店全部含下架） ---- */
  const productsQ = useQuery({
    queryKey: ['inventory', 'products'],
    queryFn: () => trpc.mall.listProductsForStore.query({ includeCarePackage: true, page: 1, pageSize: 200 }),
    enabled: role.canManage,
  });
  const products = useMemo(() => productsQ.data?.items ?? [], [productsQ.data]);

  /* ---- 区 1 上下限预警 ---- */
  const alertsQ = useQuery({
    queryKey: ['inventory', 'stockAlerts'],
    queryFn: () => trpc.stock2.stockAlerts.query(),
    enabled: role.canManage,
  });

  /* ---- 区 2 效期看板 ---- */
  const expiryQ = useQuery({
    queryKey: ['inventory', 'expiryBoard'],
    queryFn: () => trpc.stock2.expiryBoard.query(),
    enabled: role.canManage,
  });
  const [destroyId, setDestroyId] = useState<string | null>(null);
  const [destroyNote, setDestroyNote] = useState('');
  const [destroyBusy, setDestroyBusy] = useState(false);
  const [quarantineBusyId, setQuarantineBusyId] = useState<string | null>(null);

  /* ---- 区 3 批次（按品筛选 + FEFO 建议） ---- */
  const [batchProductId, setBatchProductId] = useState('');
  const batchQ = useQuery({
    queryKey: ['inventory', 'batchList', batchProductId],
    queryFn: () => trpc.stock2.batchList.query(batchProductId ? { productId: batchProductId } : {}),
    enabled: role.canManage,
  });
  const fefoQ = useQuery({
    queryKey: ['inventory', 'fefo', batchProductId],
    queryFn: () => trpc.stock2.fefoSuggestion.query({ productId: batchProductId }),
    enabled: role.canManage && batchProductId.length > 0,
  });
  const fefoFirstId = fefoQ.data?.sequence[0]?.batchId ?? null;
  const [batchOpen, setBatchOpen] = useState(false);
  const [bProductId, setBProductId] = useState('');
  const [bNo, setBNo] = useState('');
  const [bQty, setBQty] = useState('');
  const [bProdDate, setBProdDate] = useState('');
  const [bShelfLife, setBShelfLife] = useState('');
  const [bBusy, setBBusy] = useState(false);

  /* ---- 区 4 报损 ---- */
  const writeoffQ = useQuery({
    queryKey: ['inventory', 'writeoffList'],
    queryFn: () => trpc.stock2.writeoffList.query(),
    enabled: role.canManage,
  });
  const [woOpen, setWoOpen] = useState(false);
  const [woProductId, setWoProductId] = useState('');
  const [woQty, setWoQty] = useState('');
  const [woReason, setWoReason] = useState('');
  const [woBusy, setWoBusy] = useState(false);

  /* ---- 区 5 估清 / 恢复 ---- */
  const [soldoutBusyId, setSoldoutBusyId] = useState<string | null>(null);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockBusy, setRestockBusy] = useState(false);

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['inventory'] });

  const doQuarantine = async (batchId: string) => {
    setQuarantineBusyId(batchId);
    try {
      await trpc.stock2.batchQuarantine.mutate({ batchId });
      toast(iv('inv.expiry.quarantineDone'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setQuarantineBusyId(null);
    }
  };

  const submitDestroy = async () => {
    if (!destroyId) return;
    if (!destroyNote.trim()) {
      toast(iv('inv.expiry.destroyReasonRequired'), 'error');
      return;
    }
    setDestroyBusy(true);
    try {
      await trpc.stock2.batchDestroy.mutate({ batchId: destroyId, note: destroyNote.trim() });
      toast(iv('inv.expiry.destroyDone'));
      setDestroyId(null);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setDestroyBusy(false);
    }
  };

  const openBatchCreate = () => {
    setBProductId(batchProductId || products[0]?.id || '');
    setBNo('');
    setBQty('');
    setBProdDate('');
    setBShelfLife('');
    setBatchOpen(true);
  };
  const submitBatchCreate = async () => {
    if (!bProductId) return;
    if (!bNo.trim()) {
      toast(iv('inv.batch.noRequired'), 'error');
      return;
    }
    const qty = parseQty(bQty);
    if (qty === null) {
      toast(iv('inv.batch.qtyInvalid'), 'error');
      return;
    }
    setBBusy(true);
    try {
      await trpc.stock2.batchCreate.mutate({
        productId: bProductId,
        batchNo: bNo.trim(),
        qty,
        ...(bProdDate ? { productionDate: bProdDate } : {}),
        ...(parseQty(bShelfLife) !== null ? { shelfLifeDays: parseQty(bShelfLife)! } : {}),
      });
      toast(iv('inv.batch.createDone'));
      setBatchOpen(false);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBBusy(false);
    }
  };

  const openWriteoff = () => {
    setWoProductId(products[0]?.id || '');
    setWoQty('');
    setWoReason('');
    setWoOpen(true);
  };
  const submitWriteoff = async () => {
    if (!woProductId) return;
    const qty = parseQty(woQty);
    if (qty === null) {
      toast(iv('inv.batch.qtyInvalid'), 'error');
      return;
    }
    if (!woReason.trim()) {
      toast(iv('inv.writeoff.reasonRequired'), 'error');
      return;
    }
    setWoBusy(true);
    try {
      await trpc.stock2.writeoffCreate.mutate({ productId: woProductId, qty, reason: woReason.trim() });
      toast(iv('inv.writeoff.createDone'));
      setWoOpen(false);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setWoBusy(false);
    }
  };

  const doSoldOut = async (productId: string) => {
    setSoldoutBusyId(productId);
    try {
      await trpc.stock2.markSoldOut.mutate({ productId });
      toast(iv('inv.soldout.markDone'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSoldoutBusyId(null);
    }
  };

  const submitRestock = async () => {
    if (!restockId) return;
    const qty = parseQty(restockQty);
    if (qty === null) {
      toast(iv('inv.batch.qtyInvalid'), 'error');
      return;
    }
    setRestockBusy(true);
    try {
      await trpc.stock2.restockProduct.mutate({ productId: restockId, qty });
      toast(iv('inv.soldout.restockDone', { n: qty }));
      setRestockId(null);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setRestockBusy(false);
    }
  };

  if (!role.canManage) {
    return <RoleGuidePage title={iv('inv.guideTitle')} hint={iv('inv.guideHint')} />;
  }

  const alerts = alertsQ.data;
  const expiryItems = expiryQ.data?.items ?? [];
  const batches = batchQ.data?.items ?? [];
  const writeoffs = writeoffQ.data ?? [];

  return (
    <MainScaffold title={iv('inv.pageTitle')} sub={iv('inv.pageSub')} testid="inventory-page">
      <ToasterMount />

      {/* 页面互链（rail 十九口冻结不改=新裁定；库存⇄调拨互链+商品页入口链） */}
      <p className="mb-3 text-caption-xs">
        <Link to="/transfers" className="text-brand underline underline-offset-2" data-testid="inventory-to-transfers">{iv('trf.pageTitle')} →</Link>
      </p>

      {/* 毛利视界注记（页顶：进价/成本=店主/店长视界，server 双层闸） */}
      <p className="mb-3 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="inventory-margin-note">
        {iv('inv.marginNote')}
      </p>

      {/* 区 1 上下限预警 */}
      <div className="u3-panel mb-4" data-testid="inventory-alerts">
        <div className="u3-panel-head">
          <h3>{iv('inv.alerts.title')}</h3>
          <span className="aside">{iv('inv.alerts.aside')}</span>
        </div>
        {alertsQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : alertsQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{iv('inv.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void alertsQ.refetch()}>
                {iv('inv.common.retry')}
              </Btn>
            </div>
          </div>
        ) : !alerts || (alerts.low.length === 0 && alerts.high.length === 0) ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {iv('inv.alerts.empty')}
          </p>
        ) : (
          <>
            {alerts.low.map((a) => (
              <div key={`low-${a.productId}`} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`inventory-alert-low-${a.productId}`}>
                <span className="u3-st red">{iv('inv.alerts.lowBadge')}</span>
                <span className="min-w-0 flex-1 text-body-sm font-bold text-ink">{a.name}</span>
                <span className="u1-num text-caption-xs text-[rgba(59,46,36,.42)]">
                  {iv('inv.alerts.stockNow', { stock: a.stock, min: a.minStock ?? 0 })}
                </span>
                <Badge tone="danger">{iv('inv.alerts.suggestQty', { n: a.suggestQty })}</Badge>
              </div>
            ))}
            {alerts.high.map((a) => (
              <div key={`high-${a.productId}`} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`inventory-alert-high-${a.productId}`}>
                <span className="u3-st amber">{iv('inv.alerts.highBadge')}</span>
                <span className="min-w-0 flex-1 text-body-sm font-bold text-ink">{a.name}</span>
                <span className="u1-num text-caption-xs text-[rgba(59,46,36,.42)]">
                  {iv('inv.alerts.stockHigh', { stock: a.stock, max: a.maxStock ?? 0 })}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 区 2 效期看板（临期分级徽 + 行内隔离/销毁） */}
      <div className="u3-panel mb-4" data-testid="inventory-expiry">
        <div className="u3-panel-head">
          <h3>{iv('inv.expiry.title')}</h3>
          <span className="aside">
            {iv('inv.expiry.aside', { u: expiryQ.data?.urgentDays ?? 7, w: expiryQ.data?.warnDays ?? 30 })}
          </span>
        </div>
        {expiryQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : expiryQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{iv('inv.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void expiryQ.refetch()}>
                {iv('inv.common.retry')}
              </Btn>
            </div>
          </div>
        ) : expiryItems.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {iv('inv.expiry.empty')}
          </p>
        ) : (
          expiryItems.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`inventory-expiry-row-${b.id}`}>
              <span className={gradeCls(b.grade)}>{gradeLabel(b.grade)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-body-sm font-bold text-ink">{b.productName}</div>
                <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {b.batchNo} · {iv('inv.batch.qtyUnit', { n: b.qty })} · {fmtAt(b.expiryDate)}
                  {b.daysLeft !== null
                    ? ` · ${b.daysLeft < 0 ? iv('inv.expiry.expiredDays', { n: -b.daysLeft }) : iv('inv.expiry.daysLeft', { n: b.daysLeft })}`
                    : ''}
                </div>
              </div>
              <Btn
                variant="subtle"
                size="sm"
                disabled={quarantineBusyId === b.id}
                onClick={() => void doQuarantine(b.id)}
                data-testid={`inventory-quarantine-${b.id}`}
              >
                {iv('inv.expiry.quarantineCta')}
              </Btn>
              <Btn
                variant="subtle"
                size="sm"
                onClick={() => {
                  setDestroyNote('');
                  setDestroyId(b.id);
                }}
                data-testid={`inventory-destroy-${b.id}`}
              >
                {iv('inv.expiry.destroyCta')}
              </Btn>
            </div>
          ))
        )}
      </div>

      {/* 区 3 批次（按品筛选 + 手工入批 + grade 徽 + FEFO 首行先出签） */}
      <div className="u3-panel mb-4" data-testid="inventory-batches">
        <div className="u3-panel-head">
          <h3>{iv('inv.batch.title')}</h3>
          <span className="aside">{iv('inv.batch.aside')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <select
            className={inputCls}
            style={{ width: 'auto' }}
            value={batchProductId}
            onChange={(e) => setBatchProductId(e.target.value)}
            data-testid="inventory-batch-filter"
          >
            <option value="">{iv('inv.batch.filterAll')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Btn variant="primary" size="sm" onClick={openBatchCreate} data-testid="inventory-batch-create">
            {iv('inv.batch.createCta')}
          </Btn>
        </div>
        {batchQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : batchQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{iv('inv.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void batchQ.refetch()}>
                {iv('inv.common.retry')}
              </Btn>
            </div>
          </div>
        ) : batches.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {iv('inv.batch.empty')}
          </p>
        ) : (
          batches.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`inventory-batch-row-${b.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-body-sm font-bold text-ink">{b.productName}</span>
                  {b.id === fefoFirstId ? <span className="u3-st live">{iv('inv.batch.fefoFirst')}</span> : null}
                  {b.grade !== 'ok' ? <span className={gradeCls(b.grade)}>{gradeLabel(b.grade)}</span> : null}
                  <Badge tone={b.status === 'active' ? 'muted' : b.status === 'quarantined' ? 'danger' : 'muted'}>
                    {batchStatusLabel(b.status)}
                  </Badge>
                </div>
                <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {b.batchNo} · {iv('inv.batch.qtyUnit', { n: b.qty })} ·{' '}
                  {b.expiryDate
                    ? `${fmtAt(b.expiryDate)}${b.daysLeft !== null ? ` · ${b.daysLeft < 0 ? iv('inv.expiry.expiredDays', { n: -b.daysLeft }) : iv('inv.expiry.daysLeft', { n: b.daysLeft })}` : ''}`
                    : iv('inv.batch.noExpiry')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 区 4 报损（当场录入 + 状态徽列表） */}
      <div className="u3-panel mb-4" data-testid="inventory-writeoffs">
        <div className="u3-panel-head">
          <h3>{iv('inv.writeoff.title')}</h3>
          <span className="aside">{iv('inv.writeoff.aside')}</span>
        </div>
        <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <Btn variant="primary" size="sm" onClick={openWriteoff} data-testid="inventory-writeoff-create">
            {iv('inv.writeoff.createCta')}
          </Btn>
        </div>
        {writeoffQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : writeoffQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{iv('inv.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void writeoffQ.refetch()}>
                {iv('inv.common.retry')}
              </Btn>
            </div>
          </div>
        ) : writeoffs.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {iv('inv.writeoff.empty')}
          </p>
        ) : (
          writeoffs.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`inventory-writeoff-row-${w.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-body-sm font-bold text-ink">{w.productName}</span>
                  <span className="u1-num text-caption text-ink">{iv('inv.batch.qtyUnit', { n: w.qty })}</span>
                  <Badge tone={w.status === 'approved' ? 'success' : w.status === 'rejected' ? 'danger' : 'brand'}>
                    {writeoffStatusLabel(w.status)}
                  </Badge>
                </div>
                <div className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {w.reason}
                  {w.operatorName ? ` · ${w.operatorName}` : ''}
                  <span className="u1-num"> · {fmtAt(w.createdAt)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 区 5 估清 / 恢复（商品行；成本列 canManage 才显示） */}
      <div className="u3-panel" data-testid="inventory-soldout">
        <div className="u3-panel-head">
          <h3>{iv('inv.soldout.title')}</h3>
          <span className="aside">{iv('inv.soldout.aside')}</span>
        </div>
        {productsQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : productsQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{iv('inv.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void productsQ.refetch()}>
                {iv('inv.common.retry')}
              </Btn>
            </div>
          </div>
        ) : products.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {iv('inv.soldout.empty')}
          </p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`inventory-soldout-row-${p.id}`}>
              <div className="min-w-0 flex-1">
                <div className="text-body-sm font-bold text-ink">{p.name}</div>
                <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {iv('inv.soldout.stockLabel', { n: p.stock })}
                  {role.canManage ? ` · ${iv('inv.soldout.costLabel')} ${fmtMoney(p.costFen)}` : ''}
                </div>
              </div>
              <Btn
                variant="subtle"
                size="sm"
                disabled={soldoutBusyId === p.id || p.stock === 0}
                onClick={() => void doSoldOut(p.id)}
                data-testid={`inventory-soldout-${p.id}`}
              >
                {iv('inv.soldout.markCta')}
              </Btn>
              <Btn
                variant="subtle"
                size="sm"
                onClick={() => {
                  setRestockQty('');
                  setRestockId(p.id);
                }}
                data-testid={`inventory-restock-${p.id}`}
              >
                {iv('inv.soldout.restockCta')}
              </Btn>
            </div>
          ))
        )}
      </div>

      {/* 销毁事由弹层（必填留痕） */}
      <Modal
        open={destroyId !== null}
        onClose={() => setDestroyId(null)}
        title={iv('inv.expiry.destroyTitle')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setDestroyId(null)} disabled={destroyBusy}>
              {iv('inv.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitDestroy()} disabled={destroyBusy} data-testid="inventory-destroy-submit">
              {destroyBusy ? iv('inv.common.submitting') : iv('inv.common.confirm')}
            </Btn>
          </>
        }
      >
        <textarea
          value={destroyNote}
          onChange={(e) => setDestroyNote(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder={iv('inv.expiry.destroyReasonPh')}
          data-testid="inventory-destroy-note"
          className="w-full resize-none rounded-input bg-card px-3 py-2.5 text-caption text-ink shadow-hairline ring-1 ring-line-ring placeholder:text-ink-placeholder focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
        />
      </Modal>

      {/* 手工入批弹层（品/批号/数量/生产日期/保质期天数） */}
      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title={iv('inv.batch.createTitle')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setBatchOpen(false)} disabled={bBusy}>
              {iv('inv.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitBatchCreate()} disabled={bBusy} data-testid="inventory-batch-submit">
              {bBusy ? iv('inv.common.submitting') : iv('inv.common.confirm')}
            </Btn>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label={iv('inv.batch.productLabel')}>
            <select className={inputCls} value={bProductId} onChange={(e) => setBProductId(e.target.value)} data-testid="inventory-batch-product">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={iv('inv.batch.noLabel')}>
            <input className={inputCls} value={bNo} maxLength={64} placeholder={iv('inv.batch.noPh')} onChange={(e) => setBNo(e.target.value)} data-testid="inventory-batch-no" />
          </Field>
          <Field label={iv('inv.batch.qtyLabel')}>
            <input className={inputCls} value={bQty} inputMode="numeric" placeholder="0" onChange={(e) => setBQty(e.target.value)} data-testid="inventory-batch-qty" />
          </Field>
          <Field label={iv('inv.batch.prodDateLabel')}>
            <input className={inputCls} type="date" value={bProdDate} onChange={(e) => setBProdDate(e.target.value)} data-testid="inventory-batch-proddate" />
          </Field>
          <Field label={iv('inv.batch.shelfLifeLabel')}>
            <input className={inputCls} value={bShelfLife} inputMode="numeric" placeholder="0" onChange={(e) => setBShelfLife(e.target.value)} data-testid="inventory-batch-shelflife" />
          </Field>
        </div>
      </Modal>

      {/* 报损录入弹层（品/数量/原因必填） */}
      <Modal
        open={woOpen}
        onClose={() => setWoOpen(false)}
        title={iv('inv.writeoff.createTitle')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setWoOpen(false)} disabled={woBusy}>
              {iv('inv.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitWriteoff()} disabled={woBusy} data-testid="inventory-writeoff-submit">
              {woBusy ? iv('inv.common.submitting') : iv('inv.common.confirm')}
            </Btn>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label={iv('inv.batch.productLabel')}>
            <select className={inputCls} value={woProductId} onChange={(e) => setWoProductId(e.target.value)} data-testid="inventory-writeoff-product">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={iv('inv.writeoff.qtyLabel')}>
            <input className={inputCls} value={woQty} inputMode="numeric" placeholder="0" onChange={(e) => setWoQty(e.target.value)} data-testid="inventory-writeoff-qty" />
          </Field>
          <Field label={iv('inv.writeoff.reasonLabel')}>
            <input className={inputCls} value={woReason} maxLength={200} placeholder={iv('inv.writeoff.reasonPh')} onChange={(e) => setWoReason(e.target.value)} data-testid="inventory-writeoff-reason" />
          </Field>
        </div>
      </Modal>

      {/* 恢复补货弹层（数量） */}
      <Modal
        open={restockId !== null}
        onClose={() => setRestockId(null)}
        title={iv('inv.soldout.restockTitle')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setRestockId(null)} disabled={restockBusy}>
              {iv('inv.common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={() => void submitRestock()} disabled={restockBusy} data-testid="inventory-restock-submit">
              {restockBusy ? iv('inv.common.submitting') : iv('inv.common.confirm')}
            </Btn>
          </>
        }
      >
        <Field label={iv('inv.soldout.restockQtyLabel')}>
          <input className={inputCls} value={restockQty} inputMode="numeric" placeholder="0" onChange={(e) => setRestockQty(e.target.value)} data-testid="inventory-restock-qty" />
        </Field>
      </Modal>
    </MainScaffold>
  );
}
