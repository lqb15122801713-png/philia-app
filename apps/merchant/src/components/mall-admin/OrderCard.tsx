/**
 * 商城订单表行（U3 任务 H · OrdersPage 订单表，规格书 §7）
 *
 * 沿革：T5.2 的三队列订单卡片在 U3 退役，本文件默认导出改为 u3-tbl
 * 表格行 <tr> 渲染器（OrderRow）。
 *
 * 列：单号（Montserrat）｜客户（昵称，副行下单时间——listStoreOrders 行无
 * 手机号/尾号字段，只显示真值不编造）｜商品（首件名×数量，副行「另 N 种 ·
 * 共 M 件」）｜金额（Montserrat tabular）｜支付（已支付 live）｜状态
 * （待发货 amber / 已发货 wait / 售后中 amber）｜操作：
 * - 待发货：「发货 ›」主行动 → 开 ShipOrderDialog（mall.shipOrder 现成）；
 * - 已发货：直接展示物流单号真值（商家端无订单详情页可跳，不做假链接）；
 * - 售后：只读，行末无动作（退款操作=冻结项，规格书 §7 明确不做）。
 *
 * 原卡片的收货地址快照不再入行内——发货弹层（ShipOrderDialog）内仍展示，
 * 发货场景核地址不受影响。
 */

import { fmtDateTime, fmtMoney, type StoreOrder } from './format'

/** 订单明细行（createOrder 快照在 schema OrderItem 之上多写 image，运行时存在） */
type OrderLine = {
  product_id: string
  name: string
  quantity: number
  price_fen: number
  image?: string | null
}

const lineOf = (order: StoreOrder): OrderLine[] => (order.items ?? []) as OrderLine[]

function StatusPill({ status }: { status: string }) {
  switch (status) {
    case 'paid':
      return <span className="u3-st amber">待发货</span>
    case 'shipped':
      return <span className="u3-st wait">已发货</span>
    case 'refunding':
      return <span className="u3-st amber">售后中</span>
    default:
      return <span className="u3-st wait">{status}</span>
  }
}

export default function OrderRow({
  order,
  onShip,
}: {
  order: StoreOrder
  /** 待发货行的发货入口；其他队列不传 */
  onShip?: (order: StoreOrder) => void
}) {
  const lines = lineOf(order)
  const first = lines[0]
  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <tr data-testid={`order-${order.id}`}>
      <td className="font-number font-semibold tabular-nums">{order.orderNo}</td>
      <td>
        <div className="font-semibold text-ink">{order.customerNickname ?? '客户'}</div>
        <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
          下单 {fmtDateTime(order.createdAt)}
        </div>
      </td>
      <td>
        {first ? (
          <>
            <div className="text-ink">
              {first.name} ×{first.quantity}
            </div>
            {lines.length > 1 ? (
              <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                另 {lines.length - 1} 种 · 共 {totalQty} 件
              </div>
            ) : null}
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="font-number font-semibold tabular-nums">{fmtMoney(order.totalFen)}</td>
      <td>
        <span className="u3-st live">已支付</span>
      </td>
      <td>
        <StatusPill status={order.status} />
      </td>
      <td>
        {order.status === 'paid' && onShip ? (
          <button
            type="button"
            onClick={() => onShip(order)}
            data-testid={`ship-${order.id}`}
            className="rounded-chip px-2 py-1 text-caption font-bold text-ink transition-transform duration-120 ease-philia-spring hover:bg-[rgba(74,59,46,.05)] active:scale-92"
          >
            发货 ›
          </button>
        ) : order.status === 'shipped' ? (
          <span className="font-number text-caption-xs tabular-nums text-[rgba(74,59,46,.42)]">
            单号 {order.trackingNo ?? '—'}
          </span>
        ) : null}
      </td>
    </tr>
  )
}
