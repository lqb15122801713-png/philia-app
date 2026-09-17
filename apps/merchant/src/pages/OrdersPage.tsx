/**
 * 商城订单页（/orders · U3 任务 H · 规格书 §7）
 *
 * 结构：MainScaffold（副行=三队列真值计数；动作区=SearchInput 前端过滤，
 * 无接口增发）→ u3-chipf 队列 chips → u3-panel + u3-tbl 订单表（行末
 * 「发货 ›」主行动 → ShipOrderDialog → mall.shipOrder 现成链路）。
 *
 * 取舍（试样四档 → 接口三队列，文件头备查）：试样 chips 含「已完成」，
 * 但 mall.listStoreOrders 仅返回 {paid, shipped, refunding} 三队列，没有
 * 已完成队列接口（零新接口红线）——「已完成」chip 不渲染，不造归档假数据。
 * 售后退款队列只读展示：退款操作=冻结项不做（行末无动作）。
 * 搜索=纯前端按 orderNo / customerNickname 过滤当前队列。
 *
 * 数据与 SSE 口径不变（T5.2 原样保留）：
 * - STORE_ORDERS_KEY 与 TabBar 红点共用查询键，invalidate 互通；60s 轮询兜底；
 * - SSE（MerchantEventsProvider 单连接 → store:{storeId} 频道）：
 *   order.created → toast「新订单：{orderNo}」+ invalidate；
 *   order.received → toast「客户已确认收货」+ invalidate。
 *   注：order.paid 事件服务端仅投递 customer 频道（payCallback.ts），商家端
 *   收不到，支付到「待发货」出现的最坏延迟 = 60s 轮询兜底。
 */

import { EventType, usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import MainScaffold, { QuietButton, SearchInput } from '@/components/MainScaffold'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import OrderRow from '@/components/mall-admin/OrderCard'
import ShipOrderDialog from '@/components/mall-admin/ShipOrderDialog'
import { errMsg, STORE_ORDERS_KEY, type StoreOrder } from '@/components/mall-admin/format'

type QueueKey = 'paid' | 'shipped' | 'refunding'

const TABS: Array<{ key: QueueKey; label: string; empty: string }> = [
  { key: 'paid', label: '待发货', empty: '没有待发货订单' },
  { key: 'shipped', label: '已发货', empty: '没有已发货订单' },
  { key: 'refunding', label: '售后·退款', empty: '没有售后订单' },
]

/** 轮询兜底间隔（SSE 在线时也保留：order.paid 不到商家频道，见头注） */
const POLL_MS = 60_000

/** 订单表骨架（禁转圈：opacity 脉冲骨架条） */
function TableSkeleton() {
  return (
    <div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-6 border-t border-[rgba(74,59,46,.06)] px-[17px] py-3.5"
        >
          <div className="h-3.5 w-32 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
          <div className="h-3.5 w-20 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
          <div className="h-3.5 w-28 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
          <div className="h-3.5 w-14 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
          <div className="ml-auto h-3.5 w-16 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
        </div>
      ))}
    </div>
  )
}

export default function OrdersPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()

  const [tab, setTab] = useState<QueueKey>('paid')
  const [keyword, setKeyword] = useState('')
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

  // SSE：新订单 toast + 队列联动；确认收货后移出已发货队列
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
  const countOf = (key: QueueKey) => groups?.[key].length ?? 0
  const allEmpty =
    !!groups && groups.paid.length === 0 && groups.shipped.length === 0 && groups.refunding.length === 0

  // 搜索=纯前端过滤当前队列（单号 / 客户昵称，无接口增发）
  const filtered = useMemo(() => {
    const list = groups?.[tab] ?? []
    const kw = keyword.trim().toLowerCase()
    if (!kw) return list
    return list.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(kw) ||
        (o.customerNickname ?? '').toLowerCase().includes(kw),
    )
  }, [groups, tab, keyword])

  const searching = keyword.trim().length > 0
  const emptyText = searching
    ? '没有找到匹配的订单'
    : allEmpty
      ? '还没有订单'
      : (TABS.find((t) => t.key === tab)?.empty ?? '还没有订单')

  return (
    <MainScaffold
      title="商城订单"
      sub={`待发货 ${countOf('paid')} · 已发货 ${countOf('shipped')} · 售后 ${countOf('refunding')}`}
      actions={
        <SearchInput
          placeholder="搜索单号 / 客户…"
          value={keyword}
          onChange={setKeyword}
          testid="orders-search"
        />
      }
      testid="orders-page"
    >
      {/* 队列 chips（当前=墨底；接口仅三队列，「已完成」chip 不渲染——见文件头取舍） */}
      <div className="mb-3.5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = countOf(t.key)
          return (
            <button
              key={t.key}
              type="button"
              className={`u3-chipf ${tab === t.key ? 'on' : ''}`}
              onClick={() => setTab(t.key)}
              data-testid={`orders-tab-${t.key}`}
            >
              {t.label}
              {count > 0 ? ` ${count}` : ''}
            </button>
          )
        })}
      </div>

      {/* 订单表 */}
      <div className="u3-panel">
        {ordersQuery.isPending ? (
          <TableSkeleton />
        ) : ordersQuery.isError ? (
          <div className="px-[17px] py-10 text-center">
            <div className="text-caption text-[rgba(74,59,46,.62)]">
              订单加载失败：{errMsg(ordersQuery.error)}
            </div>
            <div className="mt-3 flex justify-center">
              <QuietButton onClick={() => void ordersQuery.refetch()}>重试</QuietButton>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-[17px] py-14 text-center">
            <div className="text-body-sm font-semibold text-[rgba(74,59,46,.62)]">{emptyText}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="u3-tbl min-w-[820px]">
              <thead>
                <tr>
                  <th>单号</th>
                  <th>客户</th>
                  <th>商品</th>
                  <th>金额</th>
                  <th>支付</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    onShip={tab === 'paid' ? setShipTarget : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* key=order.id：每次打开重挂载，表单态天然重置（配合 ShipOrderDialog 头注） */}
      <ShipOrderDialog
        key={shipTarget?.id ?? 'closed'}
        open={shipTarget !== null}
        order={shipTarget}
        onClose={() => setShipTarget(null)}
      />
    </MainScaffold>
  )
}
