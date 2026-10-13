/**
 * 商品订单 /mall/orders（T5.3）
 *
 * - 状态分组 Tab：待支付(pending) / 待发货(paid) / 待收货(shipped) / 已完成(received)
 *   / 售后(cancelled + refunding)，数据 trpc.mall.listMyOrders（带 storeName）；
 * - 待支付卡：「继续支付」重开 mock 收银台（CashierModal 内重走新链 pay.createOrder →
 *   /api/pay/orders/mock-callback 三步演示流）；
 * - 待发货卡：商品明细 + 收货地址快照；
 * - 待收货卡：物流单号展示 +「确认收货」（ConfirmSheet 二次确认 → receiveOrder）；
 * - 已完成：已收货时间（updatedAt）；
 * - SSE：order.paid / order.shipped → toast + invalidate（useOrderEvents，
 *   断线重连后 onSync 全量对齐）。
 *
 * 画布化（产品-1010 画布全屏批 片 3 末片 · 商城域，工艺照 MePage/MallPage）：
 * 五块入册（mallOrders.head/tabs/cardList/empty/sheets），块序/显隐=
 * useCanvasLayout('mallOrders')（published→注册表默认序尾补，空=MALL_ORDERS_DEFAULT_ORDER
 * 兜底）；店锚=?canvasStore= 预览店锚 > 记忆门店 > listNearby 首店（MemberCenterPage 口径，
 * 同 queryKey 缓存共享零增发）；?canvasPreview=1=页首水印注记（mallorders-canvas-preview-note）
 * + 候裁清零批件 6 预览兜底：订单列空/拉取失败时喂一条屏内合成示例单（假名「示例单·
 * 画布预览」，零真数据零写库，真用户页零改动）；
 * 文案键挂 CK 点选反查锚（状态胶囊/按钮字=键已建本片接通，六签+已取消/售后中新抽键）；
 * 继续支付 CashierModal 不入块流（照改造前位置挂载）；骨架/异常页级状态不入块流；
 * 块内逻辑/查询/SSE/滚动记忆/提交链路零改动，data-testid 原值全保留。
 */

import { CanvasLayoutLoader, CK, Skeleton, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Package, Truck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CashierModal, { type CashierOrder } from '../components/mall/CashierModal';
import PageHeader from '../components/PageHeader';
import ConfirmSheet from '../components/mall/ConfirmSheet';
import { EmptyState } from '../components/home/common';
import { CartProvider, MAX_QTY, useCart } from '../components/mall/cartStore';
import { fenToYuan, fmtOrderTime } from '../components/mall/format';
import { friendlyError, useToast } from '@philia/shared';
import ProductImage from '../components/mall/ProductImage';
import { useOrderEvents } from '../components/mall/useOrderEvents';
import { MALL_COPY, mlc, type MallCopyKey } from '../copy/mall';
import { mc } from '../components/member/copy';
import { rc, type RefundCopyKey } from '../copy/refund';
import { rvc } from '../copy/productReviews';
import { sl } from '@/copy/serviceloop';
import { readLastBooking } from '@/lib/bookingPrefill';

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
  /** 片 3：orders 扩列配送方式（express|same_city|pickup，存量默认 express） */
  deliveryMethod?: string;
}

type OrderGroups = Record<string, OrderRow[]>;

/* ---------------- 展示常量 ---------------- */

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const MALL_ORDERS_DEFAULT_ORDER = [
  'mallOrders.head',
  'mallOrders.tabs',
  'mallOrders.cardList',
  'mallOrders.empty',
  'mallOrders.sheets',
] as const;

/* 候裁清零批 件 6（预览兜底示例·客户端合成件）：canvasPreview=1 且订单列表为空时
   喂一条合成示例单——假名「示例单·画布预览」，金额/时刻/单号=固定示例值，零真数据
   零写库（水印注记页首已有；卡上「确认收货」等动作钮对合成 id 提交会被服务端拒，
   仅预览框内可点，不落库）。真用户页零改动（非探针模式永不触发） */
const EXAMPLE_ORDER_GROUPS: OrderGroups = {
  shipped: [
    {
      id: 'canvas-example-order',
      orderNo: 'SO-EXAMPLE-001',
      totalFen: 19900,
      status: 'shipped',
      trackingNo: 'EXAMPLE000001',
      items: [
        {
          product_id: 'canvas-example-product',
          name: '示例商品·画布预览',
          quantity: 1,
          price_fen: 19900,
          image: null,
        },
      ],
      address: { receiver: '示例客户·画布预览', phone: '13800000000', detail: '示例地址·画布预览' },
      createdAt: '2026-10-01T14:30:00',
      updatedAt: '2026-10-02T10:00:00',
      storeName: '示例门店·画布预览',
      storeId: 'canvas-example-store',
      deliveryMethod: 'express',
    },
  ],
};

const TABS = [
  /* U4-D3：补「全部」签（试样 09/12 首签=全部且默认选中；真实分组全量并集，按下单时间倒序）
     画布批片 3：六签写死文案抽键（labelKey 取 mall.tab* 键） */
  { key: 'all', labelKey: 'mall.tabAll', statuses: ['pending', 'paid', 'shipped', 'received', 'cancelled', 'refunding'] },
  { key: 'pending', labelKey: 'mall.tabPending', statuses: ['pending'] },
  { key: 'paid', labelKey: 'mall.tabPaid', statuses: ['paid'] },
  { key: 'shipped', labelKey: 'mall.tabShipped', statuses: ['shipped'] },
  { key: 'received', labelKey: 'mall.tabReceived', statuses: ['received'] },
  { key: 'aftersale', labelKey: 'mall.tabAftersale', statuses: ['cancelled', 'refunding'] },
] as const;

const TAB_KEYS = new Set<string>(TABS.map((t) => t.key));
/** W1 R-Nav-2：滚动位置会话级记忆 key（sessionStorage，会话结束自清） */
const SCROLL_KEY = 'w1.scroll.mall-orders';

/* 片 3：配送方式徽文案（orders.delivery_method 枚举） */
const DELIVERY_LABEL: Record<string, string> = {
  express: MALL_COPY['mall.deliveryExpress'],
  same_city: MALL_COPY['mall.deliverySameCity'],
  pickup: MALL_COPY['mall.deliveryPickup'],
};

/* U4-D3 状态胶囊对齐试样 .opill：小签档 6 圆角 + 11px/600；
   待支付=柠檬底（试样 opill.pay）、进行中（待发货/待收货）=薄荷洗（opill.doing）、
   已完成/已取消=墨 6% 沉底（opill.done）、售后中=功能红洗（真实态保留）；
   画布批片 3：胶囊字抽键（pending/paid/shipped/received 与同文签键复用，
   cancelled/refunding 新键 mall.statusCancelled/mall.statusRefunding） */
const STATUS_META: Record<string, { labelKey: MallCopyKey; pill: string }> = {
  pending: { labelKey: 'mall.tabPending', pill: 'bg-brand-primary text-ink' },
  paid: { labelKey: 'mall.tabPaid', pill: 'bg-brand-secondary-light text-ink' },
  shipped: { labelKey: 'mall.tabShipped', pill: 'bg-brand-secondary-light text-ink' },
  received: { labelKey: 'mall.tabReceived', pill: 'bg-[rgba(59,46,36,.06)] text-ink-secondary' },
  cancelled: { labelKey: 'mall.statusCancelled', pill: 'bg-[rgba(59,46,36,.06)] text-ink-placeholder' },
  refunding: { labelKey: 'mall.statusRefunding', pill: 'bg-danger-light text-danger-deep' },
};

/* ---------------- 订单卡 ---------------- */

function OrderCard({
  order,
  onContinuePay,
  onReceive,
  onCancel,
  onReorder,
  receiving,
  refundSlot,
  invoice,
}: {
  order: OrderRow;
  onContinuePay: (o: OrderRow) => void;
  onReceive: (o: OrderRow) => void;
  onCancel: (o: OrderRow) => void;
  /** U1-G 再来一单（received 态真链路：重建购物车 → /mall/cart） */
  onReorder: (o: OrderRow) => void;
  receiving: boolean;
  /** 补缺批片 1：退款/售后入口位（shipped/received/refunding；开关关=维护态明文） */
  refundSlot?: ReactNode;
  /** 补缺大批片 4：本单发票申请（在途/已开具）→「发票进度 ›」；null=未申请 →「申请发票 ›」 */
  invoice: { id: string } | null;
}) {
  const meta = STATUS_META[order.status];
  const qty = order.items.reduce((n, it) => n + it.quantity, 0);
  /* 补缺大批片 4：发票入口显态=paid/shipped/received（server invoiceCreate 同口径已付闸） */
  const invoiceEntry = ['paid', 'shipped', 'received'].includes(order.status) ? (
    <Link
      to={invoice ? `/invoices/${invoice.id}` : `/invoice/apply/order/${order.id}`}
      data-testid={`order-invoice-${order.id}`}
      className="rounded-full bg-card px-4 py-2 text-body-sm font-semibold text-ink ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92"
    >
      {invoice ? <CK k="inv.progressEntry">{sl('inv.progressEntry')}</CK> : <CK k="inv.applyEntry">{sl('inv.applyEntry')}</CK>}
    </Link>
  ) : null;

  return (
    /* U1-G 换肤：订单卡=U1-B 细线卡（ring + 近零影，去 shadow-card）
       U4-D3 对齐试样 09 .order：卡 padding 14/16、缩略图 52×52、价格墨色等宽 */
    <div className="u1-card px-4 py-3.5">
      {/* PD-21 D-46：卡主体=详情链接（头部/单号/商品/合计/状态区入 Link；操作钮留 Link 外不套嵌） */}
      <Link
        to={`/mall/orders/${order.id}`}
        data-testid={`order-detail-link-${order.id}`}
        className="block transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
      >
      {/* 头部：门店 + 状态（片 3：配送方式徽并显） */}
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-body-sm font-semibold">
          <Package className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
          {order.storeName ?? mlc('mall.storeFallback')}
          {order.deliveryMethod ? (
            <span className="rounded-chip bg-sunken px-[7px] py-0.5 font-number text-[9px] text-ink-secondary" data-testid={`order-delivery-${order.id}`}>
              {DELIVERY_LABEL[order.deliveryMethod] ?? order.deliveryMethod}
            </span>
          ) : null}
        </p>
        <span className={`rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta?.pill ?? 'bg-sunken text-ink-secondary'}`}>
          {meta ? <CK k={meta.labelKey}>{mlc(meta.labelKey)}</CK> : order.status}
        </span>
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
        <span className="text-ink-secondary"><CK k="mall.orderSumLine">{mlc('mall.orderSumLine', { qty })}</CK></span>
        <span className="u1-num font-bold text-ink">{fenToYuan(order.totalFen)}</span>
      </div>

      {/* 状态专属区 */}
      {order.status === 'paid' && order.address ? (
        <div className="mt-3 rounded-control bg-sunken px-3.5 py-2.5 text-caption text-ink-secondary">
          <p>
            {order.address.receiver} · <span className="font-number">{order.address.phone}</span>
          </p>
          <p className="mt-0.5">{order.address.detail}</p>
          <p className="mt-1.5 text-ink-placeholder"><CK k="mall.orderPreparing">{mlc('mall.orderPreparing')}</CK></p>
        </div>
      ) : null}

      {order.status === 'shipped' ? (
        <div className="mt-3 rounded-control bg-sunken px-3.5 py-2.5 text-caption text-ink-secondary">
          <p className="flex items-center gap-2">
            <Truck className="h-4 w-4 shrink-0 text-brand-primary" strokeWidth={1.5} />
            <CK k="mall.trackingLabel">{mlc('mall.trackingLabel')}</CK> <span className="font-number text-ink">{order.trackingNo ?? '—'}</span>
          </p>
          {/* 片 3：物流注记（不接真轨迹接口，口径明面） */}
          <p className="mt-1 pl-6 text-ink-placeholder"><CK k="mall.trackingNote">{mlc('mall.trackingNote')}</CK></p>
        </div>
      ) : null}

      {order.status === 'received' ? (
        <p className="mt-3 flex items-center gap-1.5 text-caption text-success-deep">
          <BadgeCheck className="h-4 w-4" strokeWidth={1.5} />
          <CK k="mall.orderReceived">{mlc('mall.orderReceived', { time: fmtOrderTime(order.updatedAt) })}</CK>
        </p>
      ) : null}
      </Link>

      {/* 操作区（试样 .o-act：顶部 hairline 分隔 + 右对齐胶囊钮 12px/600；
          pri=柠檬底墨字 / sec=纸面细线 ring；D-46：操作钮留详情 Link 外，点击不进详情） */}
      {order.status === 'pending' ? (
        <div className="mt-3 flex justify-end gap-2 border-t border-[rgba(59,46,36,.06)] pt-[11px]">
          <button
            type="button"
            onClick={() => onCancel(order)}
            className="rounded-full bg-card px-4 py-2 text-body-sm font-semibold text-ink ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <CK k="mall.cancelCta">{mlc('mall.cancelCta')}</CK>
          </button>
          <button
            type="button"
            onClick={() => onContinuePay(order)}
            className="rounded-full bg-brand-primary px-4 py-2 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <CK k="mall.goPay">{mlc('mall.goPay')}</CK>
          </button>
        </div>
      ) : null}
      {order.status === 'paid' ? (
        <div className="mt-3 flex justify-end border-t border-[rgba(59,46,36,.06)] pt-[11px]">
          {invoiceEntry}
        </div>
      ) : null}
      {order.status === 'shipped' ? (
        <div className="mt-3 flex justify-end gap-2 border-t border-[rgba(59,46,36,.06)] pt-[11px]">
          {invoiceEntry}
          <button
            type="button"
            disabled={receiving}
            onClick={() => onReceive(order)}
            className="rounded-full bg-brand-primary px-4 py-2 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            <CK k="mall.confirmReceive">{mlc('mall.confirmReceive')}</CK>
          </button>
        </div>
      ) : null}
      {/* U1-G 已完成态：再来一单（真链路）；「查看全程」无物流全程接口——不渲染该钮（铁则）。
          U4-D3：试样已完成卡「再来一单」=柠檬主钮 → 对齐；「申请售后」已由补缺批片 1 落地
          （refundRequest.create），入口位见卡底 refundSlot */}
      {order.status === 'received' ? (
        <div className="mt-3 flex justify-end gap-2 border-t border-[rgba(59,46,36,.06)] pt-[11px]">
          {invoiceEntry}
          {/* 片 3：写评价入口（received 态；带 reviewOrderId 直入 PDP 评价弹层，一单一件一评） */}
          {order.items[0] ? (
            <Link
              to={`/mall/product/${order.items[0].product_id}`}
              state={{ reviewOrderId: order.id }}
              data-testid={`order-review-${order.id}`}
              className="rounded-full bg-card px-4 py-2 text-body-sm font-semibold text-ink ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <CK k="rev.orderEntry">{rvc('rev.orderEntry')}</CK>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => onReorder(order)}
            data-testid={`order-reorder-${order.id}`}
            className="rounded-full bg-brand-primary px-4 py-2 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <CK k="mall.reorder">{mlc('mall.reorder')}</CK>
          </button>
        </div>
      ) : null}

      {/* 补缺批片 1：退款/售后入口位（shipped/received→申请或进度；refunding→查看进度；
          configView.enabled=false → 维护态明文，不隐藏不报错） */}
      {refundSlot}
    </div>
  );
}

/* ---------------- 页面 ---------------- */

function MallOrdersInner() {
  const { trpc } = usePhiliaClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const cart = useCart();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

  /* W1 R-Nav-2 返回保状态（淘宝订单列表同规范）：
     - 筛选 tab 入 URL（?tab=，replace 写入不污染历史栈——后退不会逐 tab 回放）；
     - 滚动位置会话级记忆（sessionStorage + rAF 节流），数据就绪后恢复一次；
     从购物车/结算等子页返回后 tab 与滚动位置一并保住；与浏览器/系统后退手势不冲突。 */
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') ?? 'all';
  const tab = (TAB_KEYS.has(rawTab) ? rawTab : 'all') as (typeof TABS)[number]['key'];
  const setTab = (key: (typeof TABS)[number]['key']) => setSearchParams({ tab: key }, { replace: true });
  const [payOrder, setPayOrder] = useState<CashierOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<OrderRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);

  const ordersQ = useQuery({
    queryKey: ['mall', 'listMyOrders'],
    queryFn: () => trpc.mall.listMyOrders.query(),
  });

  /* ---- 补缺批片 1：退款/售后入口数据源（开关端口 + 本人申请单） ---- */
  const refundConfigQ = useQuery({
    queryKey: ['refundRequest', 'configView'],
    queryFn: () => trpc.refundRequest.configView.query(),
  });
  const refundsQ = useQuery({
    queryKey: ['refundRequest', 'listMine'],
    queryFn: () => trpc.refundRequest.listMine.query(),
  });
  const refundRows = refundsQ.data ?? [];

  /** 订单卡退款入口位：shipped/received→申请（在途→进度）；refunding→查看进度；
      开关关=维护态明文（PD-12：不隐藏不报错） */
  const refundSlotOf = (order: OrderRow): ReactNode => {
    const refundable = order.status === 'shipped' || order.status === 'received';
    const isRefunding = order.status === 'refunding';
    if (!refundable && !isRefunding) return null;
    if (refundConfigQ.data?.enabled === false) {
      return (
        <p
          data-testid={`refund-maintain-${order.id}`}
          className="mt-3 border-t border-[rgba(59,46,36,.06)] pt-[11px] text-caption text-ink-secondary"
        >
          <CK k="refund.maintainNotice">{rc('refund.maintainNotice')}</CK>
        </p>
      );
    }
    /* 在途申请（幂等闸同口径：submitted/approved/refunded）→ 入口变进度 */
    const open = refundRows.find(
      (r) => r.billId === order.id && ['submitted', 'approved', 'refunded'].includes(r.status),
    );
    const latest = refundRows.find((r) => r.billId === order.id);
    const cta: { key: RefundCopyKey; to: string } = open
      ? { key: 'refund.progressCta', to: `/refunds/${open.id}` }
      : isRefunding
        ? latest
          ? { key: 'refund.viewProgressCta', to: `/refunds/${latest.id}` }
          : { key: 'refund.viewProgressCta', to: '/refunds' }
        : { key: 'refund.entryCta', to: `/mall/orders/${order.id}/refund` };
    return (
      <div className="mt-3 flex justify-end border-t border-[rgba(59,46,36,.06)] pt-[11px]">
        <Link
          to={cta.to}
          data-testid={`refund-entry-${order.id}`}
          className="text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <CK k={cta.key}>{rc(cta.key)}</CK>
        </Link>
      </div>
    );
  };
  /* 补缺大批片 4：本人发票申请（订单卡「申请发票 › / 发票进度 ›」匹配 billId） */
  const invoicesQ = useQuery({
    queryKey: ['serviceLoop', 'invoiceListMine'],
    queryFn: () => trpc.serviceLoop.invoiceListMine.query(),
  });
  const invoiceByBill = new Map(
    (invoicesQ.data ?? [])
      .filter((r) => r.orderKind === 'order')
      .map((r) => [r.billId, { id: r.id }]),
  );

  /* ---- 画布全屏批 片 3 画布化入册：探针参 + 店锚 + 注册表块序/有效布局（同 MePage 工艺） ---- */
  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  );
  /* 画布布局店锚（MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     listNearby 与 MePage/MallPage 同 queryKey 缓存共享，零增发新种查询） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), []);
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, []);
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  });
  const mallOrdersStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null;

  /* 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  });
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'mallOrders')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return items.length > 0 ? items : MALL_ORDERS_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));
  }, [blocksQ.data]);
  const layout = useCanvasLayout('mallOrders', mallOrdersStoreId, registryBlocks);

  // 滚动位置：持续记忆（rAF 节流）
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        } catch {
          /* 隐私模式忽略 */
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // 数据就绪后恢复一次滚动位置
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || ordersQ.isPending || ordersQ.isError) return;
    restoredRef.current = true;
    let y = 0;
    try {
      y = Number(window.sessionStorage.getItem(SCROLL_KEY) ?? 0) || 0;
    } catch {
      /* 隐私模式忽略 */
    }
    if (y > 0) window.scrollTo(0, y);
  }, [ordersQ.isPending, ordersQ.isError]);
  const groups = (ordersQ.data?.groups ?? {}) as unknown as OrderGroups;
  /* 件 6：预览态订单列空（或预览拉取失败=店主无客户端会话）→ 合成示例单一条顶替
     空态/失败态（「全部」签可见；空态块与页级失败态随之让位；真用户页零改动） */
  const exampleActive =
    isCanvasPreview &&
    !ordersQ.isPending &&
    (ordersQ.isError || Object.values(groups).every((g) => (g ?? []).length === 0));
  const effGroups = exampleActive ? EXAMPLE_ORDER_GROUPS : groups;

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
          storeName: order.storeName ?? mlc('mall.storeFallback'),
          name: it.name,
          priceFen: it.price_fen,
          image: it.image ?? null,
          stock: MAX_QTY, // 库存快照以结算时服务端重算为准（与 PDP 同口径）
          qty: it.quantity,
        });
      }
      showToast(mlc('mall.reorderToast'), 'info');
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
          showToast(mlc('mall.toastPaid'), 'info');
        } else if (ev.type === 'order.shipped') {
          const no = typeof ev.data.trackingNo === 'string' ? `（单号 ${ev.data.trackingNo}）` : '';
          showToast(mlc('mall.toastShipped', { no }), 'info');
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
      showToast(mlc('mall.receiveOk'), 'info');
      invalidateOrders();
    },
    onError: (err) => showToast(friendlyError(err, mlc('mall.receiveFail'), 80), 'error'),
    onSettled: () => setReceiveTarget(null),
  });

  /* ---- v1.1-b1：待支付取消订单（服务端回补库存，失败原文 toast） ---- */
  const cancelM = useMutation({
    mutationFn: (orderId: string) => trpc.mall.cancelOrder.mutate({ orderId }),
    onSuccess: () => {
      showToast(mlc('mall.cancelOk'), 'info');
      invalidateOrders();
    },
    onError: (err) => showToast(friendlyError(err, mlc('mall.cancelFail'), 80), 'error'),
    onSettled: () => setCancelTarget(null),
  });

  const active = TABS.find((t) => t.key === tab)!;
  const items = active.statuses
    .flatMap((s) => effGroups[s] ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const countOf = (t: (typeof TABS)[number]) =>
    t.statuses.reduce((n, s) => n + (effGroups[s]?.length ?? 0), 0);
  const totalCount = TABS.reduce((n, t) => n + countOf(t), 0);
  const ordersReady = (!ordersQ.isPending && !ordersQ.isError) || exampleActive;

  /* 块渲染器（块内逻辑零改动——五块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. mallOrders.head：页头（U1-A 统一返回条 ←圆钮+标题；试样 09 顶栏「订单」+dock 为主级
          形态，实现侧 /mall/orders 为商城子页（详情级无 dock，§0.4）——结构差异登记） */
    'mallOrders.head': () => (
      <PageHeader title={<CK k="mall.ordersTitle">{mlc('mall.ordersTitle')}</CK>} />
    ),

    /* 2. mallOrders.tabs：状态分组签（U4-D3 对齐试样 .tabs：文字签+底部 hairline，
          选中=墨 700+柠檬 2px 下划线；计数为真值保留；横滑条隐藏 D-补2）+
          签内空态行（D-补3：不坍缩不裸框，居中一句话；仅当前签无单时出件） */
    'mallOrders.tabs': () =>
      ordersReady && totalCount > 0 ? (
        <>
          <div className="mt-3 flex gap-[18px] overflow-x-auto border-b border-[rgba(59,46,36,.06)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  <CK k={t.labelKey}>{mlc(t.labelKey)}</CK>
                  {n > 0 ? <span className="u1-num ml-1 text-caption-xs font-normal">{n}</span> : null}
                </button>
              );
            })}
          </div>
          {items.length === 0 ? (
            <div className="mt-3.5 space-y-3.5">
              <p className="py-12 text-center text-caption text-ink-placeholder">
                <CK k="mall.ordersTabEmpty">{mlc('mall.ordersTabEmpty', { tab: mlc(active.labelKey) })}</CK>
              </p>
            </div>
          ) : null}
        </>
      ) : null,

    /* 3. mallOrders.cardList：订单卡流（当前签分组并集按下单时间倒序；卡=U1-B 细线卡，
          状态专属区/操作区/退款入口位/发票入口照改造前逐字） */
    'mallOrders.cardList': () =>
      ordersReady && totalCount > 0 && items.length > 0 ? (
        <div className="mt-3.5 space-y-3.5">
          {items.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              receiving={receiveM.isPending}
              refundSlot={refundSlotOf(o)}
              invoice={invoiceByBill.get(o.id) ?? null}
              onContinuePay={(order) =>
                setPayOrder({ id: order.id, orderNo: order.orderNo, totalFen: order.totalFen })
              }
              onReceive={(order) => setReceiveTarget(order)}
              onCancel={(order) => setCancelTarget(order)}
              onReorder={onReorder}
            />
          ))}
        </div>
      ) : null,

    /* 4. mallOrders.empty：空态（U1-I 全域统一空态组件（余白区垂直居中）；批片 5 P2：
          订单系三句话经 MALL_COPY 取值，出口钮=深棕墨底淡字（§4.11 空态件），
          落点=服务预约入口 /booking；EmptyState title 为 string 位挂不上 CK，desc/action 挂 CK） */
    'mallOrders.empty': () =>
      ordersReady && totalCount === 0 ? (
        <div className="flex min-h-[56vh] flex-col justify-center">
          <EmptyState
            title={MALL_COPY['mall.orders.emptyTitle']}
            desc={<CK k="mall.orders.emptyBody">{MALL_COPY['mall.orders.emptyBody']}</CK>}
            action={
              <Link
                to="/booking"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="mall.orders.emptyCta">{MALL_COPY['mall.orders.emptyCta']}</CK>
              </Link>
            }
          />
        </div>
      ) : null,

    /* 5. mallOrders.sheets：二次确认弹层×2（确认收货 / 取消订单；ConfirmSheet=共享件，
          props 为 string 位挂不上 CK——键如实列入 copyKeys，组件内无 CK 锚） */
    'mallOrders.sheets': () => (
      <>
        {/* 确认收货二次确认 */}
        <ConfirmSheet
          open={!!receiveTarget}
          title={mlc('mall.receiveConfirmTitle')}
          desc={mlc('mall.receiveConfirmBody')}
          confirmText={mlc('mall.confirmReceive')}
          onCancel={() => setReceiveTarget(null)}
          onConfirm={() => {
            if (receiveTarget) receiveM.mutate(receiveTarget.id);
          }}
        />

        {/* v1.1-b1：取消订单二次确认 */}
        <ConfirmSheet
          open={!!cancelTarget}
          title={mlc('mall.cancelConfirmTitle')}
          desc={mlc('mall.cancelConfirmBody')}
          confirmText={mlc('mall.cancelConfirmCta')}
          danger
          onCancel={() => setCancelTarget(null)}
          onConfirm={() => {
            if (cancelTarget) cancelM.mutate(cancelTarget.id);
          }}
        />
      </>
    ),
  };

  return (
    /* U4-D3：页边距 22px（试样 .topbar/.order margin 口径） */
    <CanvasLayoutLoader pageKey="mallOrders" storeId={mallOrdersStoreId}>
      <div className="px-[22px] pb-6 pt-4">
        {toastEl}
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="mallorders-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：五块按有效布局渲染（隐藏块整段不渲染）；tabs/cardList/empty 块内互斥门控
            照改造前（pending/error 页级状态不入块流，挂载于块流后=改造前头下位置，
            此时余块自空不抢位）——默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}

        {/* 骨架/异常页级状态（不入块流；此时 tabs/cardList/empty 块自空）。
            件 6：exampleActive 合成示例态让位（失败页不压示例卡流） */}
        {ordersQ.isPending ? (
          <div className="mt-5 space-y-3.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-panel" />
            ))}
          </div>
        ) : ordersQ.isError && !exampleActive ? (
          <div className="mt-10 text-center">
            <p className="text-body-sm text-ink-secondary"><CK k="mall.ordersLoadFail">{mlc('mall.ordersLoadFail')}</CK></p>
            <button
              type="button"
              onClick={() => void ordersQ.refetch()}
              className="mt-4 rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <CK k="mall.reload">{mlc('mall.reload')}</CK>
            </button>
          </div>
        ) : null}

        {/* 继续支付：重走 mock 收银台（弹层不入块流，照改造前位置挂载） */}
        {payOrder ? (
          <CashierModal
            order={payOrder}
            showToast={showToast}
            onPaid={() => {
              setPayOrder(null);
              showToast(mlc('mall.toastPaid'), 'info');
              invalidateOrders();
            }}
            onGiveUp={() => setPayOrder(null)}
          />
        ) : null}
      </div>
    </CanvasLayoutLoader>
  );
}

export default function MallOrdersPage() {
  return (
    <CartProvider>
      <MallOrdersInner />
    </CartProvider>
  );
}
