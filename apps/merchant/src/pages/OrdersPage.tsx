/**
 * 商城订单页（T5.2 · coder-mall-merchant）—— 路由 /orders
 *
 * - 队列 Tab：待发货（paid，红点计数）/ 已发货（shipped）/ 售后（refunding）；
 *   数据 mall.listStoreOrders（60s 轮询兜底 + SSE 联动 invalidate，
 *   查询键与 TabBar 红点共用 STORE_ORDERS_KEY，invalidate 互通）。
 * - 待发货卡片「发货」→ ShipOrderDialog（物流单号必填）→ shipOrder → toast + invalidate。
 * - SSE（MerchantEventsProvider 单连接 → store:{storeId} 频道）：
 *   order.created → toast「新订单：{orderNo}」+ invalidate（待发货红点联动）；
 *   order.received → toast「客户已确认收货」+ invalidate（订单移出已发货队列）。
 *   注：order.paid 事件服务端仅投递 customer 频道（payCallback.ts），商家端收不到，
 *   支付到「待发货」出现的最坏延迟 = 60s 轮询兜底（见汇报遗留问题）。
 */

import { EventType, usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import OrderCard from '@/components/mall-admin/OrderCard'
import ShipOrderDialog from '@/components/mall-admin/ShipOrderDialog'
import { errMsg, STORE_ORDERS_KEY, type StoreOrder } from '@/components/mall-admin/format'
import { Empty, Loading } from '@/components/mall-admin/ui'

type QueueKey = 'paid' | 'shipped' | 'refunding'

const TABS: Array<{ key: QueueKey; label: string; empty: string; hint: string }> = [
  { key: 'paid', label: '待发货', empty: '没有待发货订单', hint: '客户支付成功的订单会出现在这里' },
  { key: 'shipped', label: '已发货', empty: '没有已发货订单', hint: '发货后可在这里查看物流单号' },
  { key: 'refunding', label: '售后', empty: '没有售后订单', hint: '客户发起退款的订单会出现在这里' },
]

/** 轮询兜底间隔（SSE 在线时也保留：order.paid 不到商家频道，见头注） */
const POLL_MS = 60_000

export default function OrdersPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()

  const [tab, setTab] = useState<QueueKey>('paid')
  const [shipTarget, setShipTarget] = useState<StoreOrder | null>(null)

  const ordersQuery = useQuery({
    queryKey: STORE_ORDERS_KEY,
    queryFn: () => trpc.mall.listStoreOrders.query(),
    refetchInterval: POLL_MS,
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: STORE_ORDERS_KEY }),
    [queryClient],
  )

  // SSE：新订单 toast + 红点联动；确认收货后移出已发货队列
  useEffect(
    () =>
      events.onEvent((envelope) => {
        switch (envelope.type) {
          case EventType.OrderCreated: {
            const data = (envelope.data ?? {}) as Record<string, unknown>
            const orderNo = typeof data.orderNo === 'string' ? data.orderNo : ''
            toast(orderNo ? `新订单：${orderNo}` : '收到新订单', {
              description: '客户支付后进入待发货队列',
            })
            void invalidate()
            break
          }
          case EventType.OrderReceived: {
            const data = (envelope.data ?? {}) as Record<string, unknown>
            const orderNo = typeof data.orderNo === 'string' ? data.orderNo : ''
            toast.success(orderNo ? `订单 ${orderNo} 客户已确认收货` : '客户已确认收货')
            void invalidate()
            break
          }
          default:
            break
        }
      }),
    [events, invalidate],
  )

  // 断线重连全量对齐
  useEffect(() => events.onReconnect(() => void invalidate()), [events, invalidate])

  const groups = ordersQuery.data?.groups
  const paidCount = groups?.paid.length ?? 0
  const active = TABS.find((t) => t.key === tab)!
  const list = groups?.[tab] ?? []

  return (
    <div className="px-4 pb-6 lg:px-8">
      <header className="flex items-end justify-between pt-6">
        <div>
          <h1 className="text-title-lg">商城订单</h1>
          <p className="mt-0.5 text-caption text-ink-secondary">待发货 / 已发货 / 售后队列</p>
        </div>
        <span className="flex items-center gap-1.5 text-caption text-ink-secondary">
          <span
            className={`h-2 w-2 rounded-full ${events.connected ? 'bg-success' : 'bg-line-strong'}`}
          />
          {events.connected ? '实时已连接' : '实时连接中…'}
        </span>
      </header>

      {/* 队列 Tab */}
      <div className="mt-4 flex gap-1.5">
        {TABS.map((t) => {
          const count = groups?.[t.key].length ?? 0
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption transition-colors duration-150 ${
                isActive ? 'bg-brand-primary text-white' : 'bg-card text-ink-secondary shadow-card hover:text-ink'
              }`}
            >
              {t.label}
              {t.key === 'paid' && paidCount > 0 ? (
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-number text-[10px] font-semibold leading-none tabular-nums ${
                    isActive ? 'bg-white text-brand-primary-pressed' : 'bg-danger text-white'
                  }`}
                >
                  {paidCount > 99 ? '99+' : paidCount}
                </span>
              ) : count > 0 ? (
                <span className={isActive ? 'text-white/80' : 'text-ink-placeholder'}>{count}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* 队列内容 */}
      <div className="mt-3">
        {ordersQuery.isPending ? (
          <Loading />
        ) : ordersQuery.isError ? (
          <Empty title="加载失败" hint={errMsg(ordersQuery.error)} />
        ) : list.length === 0 ? (
          <Empty title={active.empty} hint={active.hint} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((o) => (
              <OrderCard key={o.id} order={o} onShip={tab === 'paid' ? setShipTarget : undefined} />
            ))}
          </div>
        )}
      </div>

      <ShipOrderDialog open={shipTarget !== null} order={shipTarget} onClose={() => setShipTarget(null)} />
    </div>
  )
}
