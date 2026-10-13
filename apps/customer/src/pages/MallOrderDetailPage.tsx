/**
 * 商城订单详情 /mall/orders/:id（PD-21 D-46 · 老板 10-13 签）：
 * - 列表卡/深链共用真详情页：订单号/状态/门店/配送/地址/商品行/金额/时间 最小充分；
 * - 数据=trpc.mall.orderDetail（仅本人；不存在/跨人=NOT_FOUND 不透存在性）；
 * - 异常态=人话卡+「返回订单列表」出口（导航闭环规范②，禁裸 404/白屏）；
 * - 退款入口与列表卡同口径：shipped/received→申请页；refunding→进度列表；维护态=注记；
 * - 非目标照令：不做履约物流真链路（trackingNote 半程注记照卡口径）、不判美。
 */

import { CK, Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Package, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { fenToYuan, fmtOrderTime } from '../components/mall/format';
import ProductImage from '../components/mall/ProductImage';
import { mlc, type MallCopyKey } from '../copy/mall';

/** 状态签文案键（与列表卡 STATUS_META 同源键族；样式=既有 pill 档不另造） */
const STATUS_LABEL_KEY: Record<string, MallCopyKey> = {
  pending: 'mall.tabPending',
  paid: 'mall.tabPaid',
  shipped: 'mall.tabShipped',
  received: 'mall.tabReceived',
  cancelled: 'mall.statusCancelled',
  refunding: 'mall.statusRefunding',
};

const DELIVERY_LABEL: Record<string, string> = {
  express: mlc('mall.deliveryExpress'),
  same_city: mlc('mall.deliverySameCity'),
  pickup: mlc('mall.deliveryPickup'),
};

/** 订单行商品条目（orders.items JSON 列；server 推导类型未含 image——列表页同口径本地补型） */
interface DetailItemRow {
  product_id: string;
  name: string;
  quantity: number;
  price_fen: number;
  image?: string | null;
}

export default function MallOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { trpc } = usePhiliaClient();
  const detailQ = useQuery({
    queryKey: ['mall', 'orderDetail', id],
    queryFn: () => trpc.mall.orderDetail.query({ orderId: id! }),
    enabled: !!id,
    retry: 1,
  });

  const order = detailQ.data?.order ?? null;
  const storeName = detailQ.data?.storeName ?? null;

  return (
    <div className="px-4 pb-10 pt-4" data-testid="mall-order-detail-page">
      <PageHeader title={mlc('mall.orderDetailTitle')} fallback="/mall/orders" />

      {detailQ.isPending ? (
        <div className="mt-4 space-y-3" aria-label="加载中">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      ) : detailQ.isError || !order ? (
        /* 异常态=人话+出口（D-46 口径：深链不得甩回 /home 裸奔） */
        <section className="u1-card mt-4 p-5 text-center" data-testid="mall-order-detail-notfound">
          <p className="text-body-sm text-ink">{mlc('mall.orderDetailNotFound')}</p>
          <Link
            to="/mall/orders"
            data-testid="mall-order-detail-back"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-control bg-ink px-6 text-body-sm font-semibold text-brand-primary"
          >
            {mlc('mall.orderDetailBack')}
          </Link>
        </section>
      ) : (
        <>
          {/* 头部状态卡 */}
          <section className="u1-card mt-4 p-4" data-testid="mall-order-detail-head">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-body-sm font-semibold">
                <Package className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
                {storeName ?? mlc('mall.storeFallback')}
              </p>
              <span className="rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink" data-testid="mall-order-detail-status">
                <CK k={STATUS_LABEL_KEY[order.status] ?? 'mall.tabAll'}>
                  {STATUS_LABEL_KEY[order.status] ? mlc(STATUS_LABEL_KEY[order.status]!) : order.status}
                </CK>
              </span>
            </div>
            <p className="mt-1.5 font-number text-caption-xs text-ink-placeholder" data-testid="mall-order-detail-no">
              {order.orderNo} · {fmtOrderTime(order.createdAt)}
            </p>
            {order.deliveryMethod ? (
              <p className="mt-1 text-caption-xs text-ink-secondary">
                {DELIVERY_LABEL[order.deliveryMethod] ?? order.deliveryMethod}
              </p>
            ) : null}
          </section>

          {/* 商品明细 */}
          <section className="u1-card mt-3 p-4" data-testid="mall-order-detail-items">
            <h2 className="text-body-sm font-semibold">{mlc('mall.orderDetailItems')}</h2>
            <div className="mt-3 space-y-2.5">
              {(order.items as DetailItemRow[]).map((it, i) => (
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
            <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-line-divider pt-3 text-body-sm">
              <span className="text-ink-secondary">
                {mlc('mall.orderSumLine', { qty: order.items.reduce((n, it) => n + it.quantity, 0) })}
              </span>
              <span className="u1-num font-bold text-ink" data-testid="mall-order-detail-total">
                {fenToYuan(order.totalFen)}
              </span>
            </div>
          </section>

          {/* 订单信息（地址/物流/收货时刻，按态透出与列表卡同口径） */}
          <section className="u1-card mt-3 p-4" data-testid="mall-order-detail-info">
            <h2 className="text-body-sm font-semibold">{mlc('mall.orderDetailInfo')}</h2>
            {order.address ? (
              <p className="mt-2 text-caption text-ink-secondary">
                {order.address.receiver} · <span className="font-number">{order.address.phone}</span>
                <br />
                {order.address.detail}
              </p>
            ) : null}
            {order.status === 'shipped' ? (
              <p className="mt-2 flex items-center gap-2 text-caption text-ink-secondary">
                <Truck className="h-4 w-4 shrink-0 text-brand-primary" strokeWidth={1.5} />
                {mlc('mall.trackingLabel')} <span className="font-number text-ink">{order.trackingNo ?? '—'}</span>
              </p>
            ) : null}
            {order.status === 'received' ? (
              <p className="mt-2 flex items-center gap-1.5 text-caption text-success-deep">
                <BadgeCheck className="h-4 w-4" strokeWidth={1.5} />
                {mlc('mall.orderReceived', { time: fmtOrderTime(order.updatedAt) })}
              </p>
            ) : null}
          </section>

          {/* 退款入口（与列表卡同口径：shipped/received→申请页；refunding→进度列表） */}
          {order.status === 'shipped' || order.status === 'received' ? (
            <div className="mt-4 flex justify-end">
              <Link
                to={`/mall/orders/${order.id}/refund`}
                data-testid="mall-order-detail-refund"
                className="text-body-sm font-semibold text-ink"
              >
                {mlc('mall.orderDetailRefund')}
              </Link>
            </div>
          ) : null}
          {order.status === 'refunding' ? (
            <div className="mt-4 flex justify-end">
              <Link to="/refunds" data-testid="mall-order-detail-refund" className="text-body-sm font-semibold text-ink">
                {mlc('mall.orderDetailRefund')}
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
