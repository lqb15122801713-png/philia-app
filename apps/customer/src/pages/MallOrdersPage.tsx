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
import { BadgeCheck, Package, Truck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CashierModal, { type CashierOrder } from '../components/mall/CashierModal';
import PageHeader from '../components/PageHeader';
import ConfirmSheet from '../components/mall/ConfirmSheet';
import { EmptyState } from '../components/home/common';
import { CartProvider, MAX_QTY, useCart } from '../components/mall/cartStore';
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
  /** 服务端 listMyOrders 经 orders 全列透传（r.order spread），U1-G 再来一单取店用 */
  storeId: string;
}

type OrderGroups = Record<string, OrderRow[]>;

/* ---------------- 展示常量 ---------------- */

const TABS = [
  /* U4-D3：补「全部」签（试样 09/12 首签=全部且默认选中；真实分组全量并集，按下单时间倒序） */
  { key: 'all', label: '全部', statuses: ['pending', 'paid', 'shipped', 'received', 'cancelled', 'refunding'] },
  { key: 'pending', label: '待支付', statuses: ['pending'] },
  { key: 'paid', label: '待发货', statuses: ['paid'] },
  { key: 'shipped', label: '待收货', statuses: ['shipped'] },
  { key: 'received', label: '已完成', statuses: ['received'] },
  { key: 'aftersale', label: '售后', statuses: ['cancelled', 'refunding'] },
] as const;

/* U4-D3 状态胶囊对齐试样 .opill：小签档 6 圆角 + 11px/600；
   待支付=柠檬底（试样 opill.pay）、进行中（待发货/待收货）=薄荷洗（opill.doing）、
   已完成/已取消=墨 6% 沉底（opill.done）、售后中=功能红洗（真实态保留） */
const STATUS_META: Record<string, { label: string; pill: string }> = {
  pending: { label: '待支付', pill: 'bg-brand-primary text-ink' },
  paid: { label: '待发货', pill: 'bg-brand-secondary-light text-ink' },
  shipped: { label: '待收货', pill: 'bg-brand-secondary-light text-ink' },
  received: { label: '已完成', pill: 'bg-[rgba(74,59,46,.06)] text-ink-secondary' },
  cancelled: { label: '已取消', pill: 'bg-[rgba(74,59,46,.06)] text-ink-placeholder' },
  refunding: { label: '售后中', pill: 'bg-danger-light text-danger-deep' },
};

/* ---------------- 订单卡 ---------------- */

function OrderCard({
  order,
  onContinuePay,
  onReceive,
  onCancel,
  onReorder,
  receiving,
}: {
  order: OrderRow;
  onContinuePay: (o: OrderRow) => void;
  onReceive: (o: OrderRow) => void;
  onCancel: (o: OrderRow) => void;
  /** U1-G 再来一单（received 态真链路：重建购物车 → /mall/cart） */
  onReorder: (o: OrderRow) => void;
  receiving: boolean;
}) {
  const meta = STATUS_META[order.status] ?? { label: order.status, pill: 'bg-sunken text-ink-secondary' };
  const qty = order.items.reduce((n, it) => n + it.quantity, 0);

  return (
    /* U1-G 换肤：订单卡=U1-B 细线卡（ring + 近零影，去 shadow-card）
       U4-D3 对齐试样 09 .order：卡 padding 14/16、缩略图 52×52、价格墨色等宽 */
    <div className="u1-card px-4 py-3.5">
      {/* 头部：门店 + 状态 */}
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-body-sm font-semibold">
          <Package className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
          {order.storeName ?? '菲丽亚门店'}
        </p>
        <span className={`rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>{meta.label}</span>
      </div>
      <p className="mt-1 font-number text-caption-xs text-ink-placeholder">
        {order.orderNo} · {fmtOrderTime(order.createdAt)}
      </p>

      {/* 商品明细 */}
      <div className="mt-3 space-y-2.5">
        {order.items.map((it, i) => (
          <div key={`${it.product_id}-${i}`} className="flex items-center gap-3">
            <ProductImage src={it.image} alt={it.name} className="h-[52px] w-[52px] shrink-0 rounded-control" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-body-sm font-semibold">{it.name}</p>
              <p className="mt-0.5 font-number text-caption-xs text-ink-placeholder">
                {fenToYuan(it.price_fen)} × {it.quantity}
              </p>
            </div>
            <p className="u1-num text-body-sm font-bold">{fenToYuan(it.price_fen * it.quantity)}</p>
          </div>
        ))}
      </div>

      {/* 合计（试样价格位=墨色 Montserrat，非柠檬字） */}
      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-line-divider pt-3 text-body-sm">
        <span className="text-ink-secondary">共 {qty} 件，合计</span>
        <span className="u1-num font-bold text-ink">{fenToYuan(order.totalFen)}</span>
      </div>

      {/* 状态专属区 */}
      {order.status === 'paid' && order.address ? (
        <div className="mt-3 rounded-control bg-sunken px-3.5 py-2.5 text-caption text-ink-secondary">
          <p>
            {order.address.receiver} · <span className="font-number">{order.address.phone}</span>
          </p>
          <p className="mt-0.5">{order.address.detail}</p>
          <p className="mt-1.5 text-ink-placeholder">门店正在备货，请耐心等待</p>
        </div>
      ) : null}

      {order.status === 'shipped' ? (
        <div className="mt-3 flex items-center gap-2 rounded-control bg-sunken px-3.5 py-2.5 text-caption text-ink-secondary">
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

      {/* 操作区（试样 .o-act：顶部 hairline 分隔 + 右对齐胶囊钮 12px/600；
          pri=柠檬底墨字 / sec=纸面细线 ring） */}
      {order.status === 'pending' ? (
        <div className="mt-3 flex justify-end gap-2 border-t border-[rgba(74,59,46,.06)] pt-[11px]">
          <button
            type="button"
            onClick={() => onCancel(order)}
            className="rounded-full bg-card px-4 py-2 text-body-sm font-semibold text-ink ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onContinuePay(order)}
            className="rounded-full bg-brand-primary px-4 py-2 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            去支付
          </button>
        </div>
      ) : null}
      {order.status === 'shipped' ? (
        <div className="mt-3 flex justify-end border-t border-[rgba(74,59,46,.06)] pt-[11px]">
          <button
            type="button"
            disabled={receiving}
            onClick={() => onReceive(order)}
            className="rounded-full bg-brand-primary px-4 py-2 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            确认收货
          </button>
        </div>
      ) : null}
      {/* U1-G 已完成态：再来一单（真链路）；「查看全程」无物流全程接口——不渲染该钮（铁则）。
          U4-D3：试样已完成卡「再来一单」=柠檬主钮 → 对齐；「申请售后」无售后申请接口——不出 */}
      {order.status === 'received' ? (
        <div className="mt-3 flex justify-end border-t border-[rgba(74,59,46,.06)] pt-[11px]">
          <button
            type="button"
            onClick={() => onReorder(order)}
            data-testid={`order-reorder-${order.id}`}
            className="rounded-full bg-brand-primary px-4 py-2 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            再来一单
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- 页面 ---------------- */

function MallOrdersInner() {
  const { trpc } = usePhiliaClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const cart = useCart();
  const { toastEl, showToast } = useMallToast();

  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const [payOrder, setPayOrder] = useState<CashierOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<OrderRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);

  const ordersQ = useQuery({
    queryKey: ['mall', 'listMyOrders'],
    queryFn: () => trpc.mall.listMyOrders.query(),
  });
  const groups = (ordersQ.data?.groups ?? {}) as unknown as OrderGroups;

  const invalidateOrders = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ['mall', 'listMyOrders'] }),
    [queryClient],
  );

  /* ---- U1-G 再来一单（真链路）：清空购物车 → 按订单明细重建 → /mall/cart 结算。
     订单单店（createOrder 服务端约束），逐项 addItem 不会触发跨店冲突。 */
  const onReorder = useCallback(
    (order: OrderRow) => {
      cart.clearAll();
      for (const it of order.items) {
        cart.addItem({
          productId: it.product_id,
          storeId: order.storeId,
          storeName: order.storeName ?? '菲丽亚门店',
          name: it.name,
          priceFen: it.price_fen,
          image: it.image ?? null,
          stock: MAX_QTY, // 库存快照以结算时服务端重算为准（与 PDP 同口径）
          qty: it.quantity,
        });
      }
      showToast('已按原单加入购物车', 'info');
      navigate('/mall/cart');
    },
    [cart, navigate, showToast],
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

  /* ---- v1.1-b1：待支付取消订单（服务端回补库存，失败原文 toast） ---- */
  const cancelM = useMutation({
    mutationFn: (orderId: string) => trpc.mall.cancelOrder.mutate({ orderId }),
    onSuccess: () => {
      showToast('订单已取消，库存已释放', 'info');
      invalidateOrders();
    },
    onError: (err) => showToast(friendlyError(err, '取消失败，请稍后再试')),
    onSettled: () => setCancelTarget(null),
  });

  const active = TABS.find((t) => t.key === tab)!;
  const items = active.statuses
    .flatMap((s) => groups[s] ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const countOf = (t: (typeof TABS)[number]) =>
    t.statuses.reduce((n, s) => n + (groups[s]?.length ?? 0), 0);
  const totalCount = TABS.reduce((n, t) => n + countOf(t), 0);

  return (
    /* U4-D3：页边距 22px（试样 .topbar/.order margin 口径） */
    <div className="px-[22px] pb-6 pt-4">
      {toastEl}
      {/* U1-A：统一返回条（←圆钮+标题）；试样 09 顶栏「订单」+dock 为主级形态，
          实现侧 /mall/orders 为商城子页（详情级无 dock，§0.4）——结构差异登记 */}
      <PageHeader title="商品订单" />

      {ordersQ.isPending ? (
        <div className="mt-5 space-y-3.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-panel bg-sunken" />
          ))}
        </div>
      ) : ordersQ.isError ? (
        <div className="mt-10 text-center">
          <p className="text-body-sm text-ink-secondary">订单加载失败，请稍后重试</p>
          <button
            type="button"
            onClick={() => void ordersQ.refetch()}
            className="mt-4 rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            重新加载
          </button>
        </div>
      ) : totalCount === 0 ? (
        /* U1-I：全域统一空态组件（U4-D3 试样 12 工艺，余白区垂直居中） */
        <div className="flex min-h-[56vh] flex-col justify-center">
          <EmptyState
            title="购物袋还空着呢"
            desc={
              <>
                philia 帮你看着货架，
                <br />
                门店同款好物都在商城里
              </>
            }
            action={
              <Link
                to="/mall"
                className="inline-flex items-center rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                去逛逛 ›
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* 状态分组签（U4-D3 对齐试样 .tabs：文字签+底部 hairline，
              选中=墨 700+柠檬 2px 下划线；计数为真值保留；横滑条隐藏 D-补2） */}
          <div className="mt-3 flex gap-[18px] overflow-x-auto border-b border-[rgba(74,59,46,.06)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const n = countOf(t);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`-mb-px shrink-0 border-b-2 py-2.5 text-body-sm transition ${
                    tab === t.key
                      ? 'border-brand-primary font-bold text-ink'
                      : 'border-transparent font-medium text-ink-placeholder'
                  }`}
                >
                  {t.label}
                  {n > 0 ? <span className="u1-num ml-1 text-caption-xs font-normal">{n}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3.5 space-y-3.5">
            {items.length === 0 ? (
              /* D-补3：签内空态不坍缩、不裸框——居中一句话 */
              <p className="py-12 text-center text-caption text-ink-placeholder">
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
                  onCancel={(order) => setCancelTarget(order)}
                  onReorder={onReorder}
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

      {/* v1.1-b1：取消订单二次确认 */}
      <ConfirmSheet
        open={!!cancelTarget}
        title="取消该订单？"
        desc="取消后库存将释放，订单不可恢复。"
        confirmText="确认取消"
        danger
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) cancelM.mutate(cancelTarget.id);
        }}
      />
    </div>
  );
}

export default function MallOrdersPage() {
  return (
    <CartProvider>
      <MallOrdersInner />
    </CartProvider>
  );
}
