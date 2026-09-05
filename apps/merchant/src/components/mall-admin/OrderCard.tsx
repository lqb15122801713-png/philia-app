/**
 * 商城订单卡片（T5.2 · OrdersPage 三个队列共用）
 *
 * - 待发货（paid）：订单号 / 客户昵称 / 商品明细（图+名+数量）/ 合计 /
 *   收货地址快照 / 下单时间 + 「发货」按钮；
 * - 已发货（shipped）：+ 物流单号 / 发货时间（updatedAt 口径，发货时服务端写入）；
 *   客户确认收货后 SSE order.received → 卡片随 invalidate 移出队列；
 * - 售后（refunding）：只读展示 + 「售后中」徽章（v1 无售后操作）。
 */

import { Truck } from 'lucide-react'
import { fmtDateTime, fmtMoney, type StoreOrder } from './format'
import { Badge, Btn, numStyle } from './ui'

/** 订单明细行（createOrder 快照在 schema OrderItem 之上多写 image，运行时存在） */
type OrderLine = {
  product_id: string
  name: string
  quantity: number
  price_fen: number
  image?: string | null
}

const lineOf = (order: StoreOrder): OrderLine[] => (order.items ?? []) as OrderLine[]

const statusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return <Badge tone="danger">待发货</Badge>
    case 'shipped':
      return <Badge tone="brand">已发货</Badge>
    case 'refunding':
      return <Badge tone="warning">售后中</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function OrderCard({
  order,
  onShip,
}: {
  order: StoreOrder
  /** 待发货卡片的发货入口；其他队列不传 */
  onShip?: (order: StoreOrder) => void
}) {
  const lines = lineOf(order)
  const addr = order.address

  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      {/* 头：订单号 + 状态 / 客户 + 下单时间 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-number text-body font-semibold text-ink" style={numStyle}>
          {order.orderNo}
        </span>
        {statusBadge(order.status)}
        <span className="ml-auto text-caption text-ink-secondary">
          {order.customerNickname ?? '客户'} · 下单 {fmtDateTime(order.createdAt)}
        </span>
      </div>

      {/* 商品明细 */}
      <div className="mt-3 space-y-2">
        {lines.map((line, i) => (
          <div key={`${line.product_id}-${i}`} className="flex items-center gap-2.5">
            {line.image ? (
              <img
                src={line.image}
                alt={line.name}
                className="h-10 w-10 shrink-0 rounded-tag border border-line object-cover"
              />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-tag bg-sunken" />
            )}
            <span className="min-w-0 flex-1 truncate text-body text-ink">{line.name}</span>
            <span className="text-caption text-ink-secondary">x{line.quantity}</span>
            <span className="font-number text-caption text-ink-secondary" style={numStyle}>
              {fmtMoney(line.price_fen)}
            </span>
          </div>
        ))}
      </div>

      {/* 地址快照 + 物流信息 */}
      <div className="mt-3 space-y-1 rounded-input bg-sunken px-3 py-2 text-caption text-ink-secondary">
        {addr ? (
          <p>
            收货：{addr.receiver} {addr.phone} · {addr.detail}
          </p>
        ) : null}
        {order.status === 'shipped' ? (
          <p>
            物流单号 <span className="font-number text-ink" style={numStyle}>{order.trackingNo ?? '—'}</span>
            <span className="ml-2">发货于 {fmtDateTime(order.updatedAt)}</span>
          </p>
        ) : null}
      </div>

      {/* 合计 + 操作 */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-body text-ink">
          合计{' '}
          <span className="font-number text-title font-semibold text-brand-primary-pressed" style={numStyle}>
            {fmtMoney(order.totalFen)}
          </span>
        </span>
        {order.status === 'paid' && onShip ? (
          <Btn variant="primary" size="sm" onClick={() => onShip(order)}>
            <Truck size={14} strokeWidth={1.5} />
            发货
          </Btn>
        ) : null}
      </div>
    </div>
  )
}
