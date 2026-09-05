/**
 * 商品订单 /mall/orders（T5.3）
 *
 * - 状态分组 Tab：待支付(pending) / 待发货(paid) / 待收货(shipped) / 已完成(received)
 *   / 售后(cancelled + refunding)，数据 trpc.mall.listMyOrders（带 storeName）；
 * - 待支付卡：「继续支付」重开 mock 收银台（CashierModal 内重走 createPayment →
 *   mock-callback 三步演示流）；
 * - 待发货卡：商品明细 + 收货地址快照；
 * - 待收货卡：物流单号展示 +「确认收货」（ConfirmSheet 二次确认 → receiveOrder）；
 * - 已完成：已收货时间（updatedAt）；
 * - SSE：order.paid / order.shipped → toast + invalidate（useOrderEvents，
 *   断线重连后 onSync 全量对齐）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ChevronLeft, Package, Truck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CashierModal, { type CashierOrder } from '../components/mall/CashierModal';
import ConfirmSheet from '../components/mall/ConfirmSheet';
import { fenToYuan, fmtOrderTime } from '../components/mall/format';
import { friendlyError, useMallToast } from '../components/mall/MallToast';
import ProductImage from '../components/mall/ProductImage';
import { useOrderEvents } from '../components/mall/useOrderEvents';

/* ---------------- 类型（与 T5.1 listMyOrders 返回对齐） ---------------- */

interface OrderItemRow {
  product_id: string;
  name: string;
  quantity: number;
  price_fen: number;
  image?: string | null;
}

interface OrderRow {
  id: string;
  orderNo: string;
  totalFen: number;
  status: string;
  trackingNo: string | null;
  items: OrderItemRow[];
  address: { receiver: string; phone: string; detail: string } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  storeName: string | null;
}

type OrderGroups = Record<string, OrderRow[]>;

/* ---------------- 展示常量 ---------------- */

const TABS = [
  { key: 'pending', label: '待支付', statuses: ['pending'] },
  { key: 'paid', label: '待发货', statuses: ['paid'] },
  { key: 'shipped', label: '待收货', statuses: ['shipped'] },
  { key: 'received', label: '已完成', statuses: ['received'] },
  { key: 'aftersale', label: '售后', statuses: ['cancelled', 'refunding'] },
] as const;

const STATUS_META: Record<string, { label: string; pill: string }> = {
  pending: { label: '待支付', pill: 'bg-brand-secondary-light text-ink' },
  paid: { label: '待发货', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  shipped: { label: '待收货', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  received: { label: '已完成', pill: 'bg-success-light text-success-deep' },
  cancelled: { label: '已取消', pill: 'bg-sunken text-ink-placeholder' },
  refunding: { label: '售后中', pill: 'bg-danger-light text-danger-deep' },
};

/* ---------------- 订单卡 ---------------- */

function OrderCard({
  order,
  onContinuePay,
  onReceive,
  receiving,
}: {
  order: OrderRow;
  onContinuePay: (o: OrderRow) => void;
  onReceive: (o: OrderRow) => void;
  receiving: boolean;
}) {
  const meta = STATUS_META[order.status] ?? { label: order.status, pill: 'bg-sunken text-ink-secondary' };
  const qty = order.items.reduce((n, it) => n + it.quantity, 0);

  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      {/* 头部：门店 + 状态 */}
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-body font-semibold">
          <Package className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
          {order.storeName ?? '菲丽亚门店'}
        </p>
        <span className={`rounded-full px-2.5 py-1 text-caption ${meta.pill}`}>{meta.label}</span>
      </div>
      <p className="mt-1 font-number text-caption text-ink-placeholder">
        {order.orderNo} · {fmtOrderTime(order.createdAt)}
      </p>

      {/* 商品明细 */}
      <div className="mt-3 space-y-2.5">
        {order.items.map((it, i) => (
          <div key={`${it.product_id}-${i}`} className="flex items-center gap-3">
            <ProductImage src={it.image} alt={it.name} className="h-12 w-12 shrink-0 rounded-tag" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-body">{it.name}</p>
              <p className="mt-0.5 font-number text-caption text-ink-secondary">
                {fenToYuan(it.price_fen)} × {it.quantity}
              </p>
            </div>
            <p className="font-number text-body">{fenToYuan(it.price_fen * it.quantity)}</p>
          </div>
        ))}
      </div>

      {/* 合计 */}
      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-line-divider pt-3 text-body">
        <span className="text-ink-secondary">共 {qty} 件，合计</span>
        <span className="font-number font-semibold text-brand-primary">{fenToYuan(order.totalFen)}</span>
      </div>

      {/* 状态专属区 */}
      {order.status === 'paid' && order.address ? (
        <div className="mt-3 rounded-input bg-sunken px-3.5 py-2.5 text-caption text-ink-secondary">
          <p>
            {order.address.receiver} · <span className="font-number">{order.address.phone}</span>
          </p>
          <p className="mt-0.5">{order.address.detail}</p>
          <p className="mt-1.5 text-ink-placeholder">门店正在备货，请耐心等待</p>
        </div>
      ) : null}

      {order.status === 'shipped' ? (
        <div className="mt-3 flex items-center gap-2 rounded-input bg-sunken px-3.5 py-2.5 text-caption text-ink-secondary">
          <Truck className="h-4 w-4 shrink-0 text-brand-primary" strokeWidth={1.5} />
          <p>
            快递单号 <span className="font-number text-ink">{order.trackingNo ?? '—'}</span>
          </p>
        </div>
      ) : null}

      {order.status === 'received' ? (
        <p className="mt-3 flex items-center gap-1.5 text-caption text-success-deep">
          <BadgeCheck className="h-4 w-4" strokeWidth={1.5} />
          已于 {fmtOrderTime(order.updatedAt)} 确认收货
        </p>
      ) : null}

      {/* 操作区 */}
      {order.status === 'pending' ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onContinuePay(order)}
            className="h-9 rounded-full bg-philia-gradient px-6 text-body font-medium text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            继续支付
          </button>
        </div>
      ) : null}
      {order.status === 'shipped' ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={receiving}
            onClick={() => onReceive(order)}
            className="h-9 rounded-full bg-brand-primary px-6 text-body font-medium text-white transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            确认收货
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- 页面 ---------------- */

export default function MallOrdersPage() {
  const { trpc } = usePhiliaClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toastEl, showToast } = useMallToast();

  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('pending');
  const [payOrder, setPayOrder] = useState<CashierOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<OrderRow | null>(null);

  const ordersQ = useQuery({
    queryKey: ['mall', 'listMyOrders'],
    queryFn: () => trpc.mall.listMyOrders.query(),
  });
  const groups = (ordersQ.data?.groups ?? {}) as unknown as OrderGroups;

  const invalidateOrders = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ['mall', 'listMyOrders'] }),
    [queryClient],
  );

  /* ---- SSE：order.paid / order.shipped → toast + invalidate ---- */
  useOrderEvents({
    enabled: true,
    onOrderEvent: useCallback(
      (ev: { type: string; data: Record<string, unknown> }) => {
        if (ev.type === 'order.paid') {
          showToast('支付成功，门店会尽快发货', 'info');
        } else if (ev.type === 'order.shipped') {
          const no = typeof ev.data.trackingNo === 'string' ? `（单号 ${ev.data.trackingNo}）` : '';
          showToast(`订单已发货${no}`, 'info');
        }
        invalidateOrders();
      },
      [showToast, invalidateOrders],
    ),
    onSync: invalidateOrders,
  });

  const receiveM = useMutation({
    mutationFn: (orderId: string) => trpc.mall.receiveOrder.mutate({ orderId }),
    onSuccess: () => {
      showToast('已确认收货，感谢购买', 'info');
      invalidateOrders();
    },
    onError: (err) => showToast(friendlyError(err, '确认收货失败')),
    onSettled: () => setReceiveTarget(null),
  });

  const active = TABS.find((t) => t.key === tab)!;
  const items = active.statuses.flatMap((s) => groups[s] ?? []);
  const countOf = (t: (typeof TABS)[number]) =>
    t.statuses.reduce((n, s) => n + (groups[s]?.length ?? 0), 0);
  const totalCount = TABS.reduce((n, t) => n + countOf(t), 0);

  return (
    <div className="px-4 py-6">
      {toastEl}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="返回"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={1.5} />
        </button>
        <h1 className="text-title-lg">商品订单</h1>
      </div>

      {ordersQ.isPending ? (
        <div className="mt-5 space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-card bg-sunken" />
          ))}
        </div>
      ) : ordersQ.isError ? (
        <div className="mt-10 text-center">
          <p className="text-body text-ink-secondary">订单加载失败，请稍后重试</p>
          <button
            type="button"
            onClick={() => void ordersQ.refetch()}
            className="mt-4 rounded-full bg-brand-primary px-6 py-2.5 text-body text-white transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            重新加载
          </button>
        </div>
      ) : totalCount === 0 ? (
        /* 全局空态：品牌插画 */
        <div className="mt-8 flex flex-col items-center rounded-card bg-card px-4 py-10 shadow-card">
          <img src="/brand/empty-appointments-800.png" alt="暂无订单" className="w-48 max-w-full rounded-card" />
          <p className="mt-4 text-title">还没有商品订单</p>
          <p className="mt-1 text-body text-ink-secondary">去商城给毛孩子挑点好物吧</p>
          <Link
            to="/mall"
            className="mt-6 flex h-11 items-center rounded-full bg-brand-primary px-8 text-body font-medium text-white transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            去逛逛
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

          <div className="mt-3 space-y-2.5">
            {items.length === 0 ? (
              <p className="rounded-card bg-sunken px-4 py-10 text-center text-caption text-ink-secondary">
                暂无{active.label}的订单
              </p>
            ) : (
              items.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  receiving={receiveM.isPending}
                  onContinuePay={(order) =>
                    setPayOrder({ id: order.id, orderNo: order.orderNo, totalFen: order.totalFen })
                  }
                  onReceive={(order) => setReceiveTarget(order)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* 继续支付：重走 mock 收银台 */}
      {payOrder ? (
        <CashierModal
          order={payOrder}
          showToast={showToast}
          onPaid={() => {
            setPayOrder(null);
            showToast('支付成功，门店会尽快发货', 'info');
            invalidateOrders();
          }}
          onGiveUp={() => setPayOrder(null)}
        />
      ) : null}

      {/* 确认收货二次确认 */}
      <ConfirmSheet
        open={!!receiveTarget}
        title="确认已收到商品？"
        desc="确认后订单将转为已完成，请确保商品已完好送达。"
        confirmText="确认收货"
        onCancel={() => setReceiveTarget(null)}
        onConfirm={() => {
          if (receiveTarget) receiveM.mutate(receiveTarget.id);
        }}
      />
    </div>
  );
}
