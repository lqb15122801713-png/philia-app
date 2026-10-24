/**
 * 发货弹层（T5.2 · OrdersPage 待发货队列）
 *
 * 输入物流单号（必填）→ 独立确认层复核 → 仅最终确认调用 mall.shipOrder
 * （服务端校验本店 + 仅 paid 可发货）→ toast + invalidate 订单队列；错误原文 toast。
 * 确认层 cancel／Esc／overlay 返回表单，最终确认前不发履约写请求。
 *
 * U3：表单与确认态重置由父组件 key 重挂载承担（OrdersPage 以 order.id 作 key，
 * 每次打开即全新实例），不再用 effect 同步 setState（react-hooks 闸）。
 */

import { usePhiliaClient } from '@philia/shared'
import { useState } from 'react'
import { toast } from 'sonner'
import { errMsg, STORE_ORDERS_KEY, type StoreOrder } from './format'
import { Btn, Field, inputCls, Modal, numStyle } from './ui'

export default function ShipOrderDialog({
  open,
  order,
  onClose,
}: {
  open: boolean
  /** null 时弹层不渲染内容（父组件控制） */
  order: StoreOrder | null
  onClose: () => void
}) {
  const { trpc, queryClient } = usePhiliaClient()
  const [trackingNo, setTrackingNo] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const requestShip = () => {
    if (!order) return
    if (!trackingNo.trim()) {
      toast.error('请输入物流单号')
      return
    }
    setConfirmOpen(true)
  }

  const confirmShip = async () => {
    if (!order) return
    const no = trackingNo.trim()
    if (!no) {
      toast.error('请输入物流单号')
      return
    }
    setPending(true)
    try {
      await trpc.mall.shipOrder.mutate({ orderId: order.id, trackingNo: no })
      toast.success(`订单 ${order.orderNo} 已发货`)
      await queryClient.invalidateQueries({ queryKey: STORE_ORDERS_KEY })
      onClose()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setPending(false)
    }
  }

  const closeConfirm = () => {
    if (!pending) setConfirmOpen(false)
  }

  return (
    <>
      <Modal
        open={open && !confirmOpen}
        onClose={onClose}
        title={`发货 · ${order?.orderNo ?? ''}`}
        footer={
          <>
            <Btn variant="ghost" onClick={onClose}>
              取消
            </Btn>
            <Btn variant="primary" onClick={requestShip} disabled={!order}>
              确认发货
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="物流单号" required hint="客户将在客户端看到该单号">
            <input
              className={inputCls}
              value={trackingNo}
              maxLength={64}
              placeholder="如 SF1234567890"
              autoFocus
              style={numStyle}
              onChange={(e) => setTrackingNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') requestShip()
              }}
            />
          </Field>
          {order ? (
            <div className="rounded-input bg-sunken px-3 py-2 text-caption text-ink-secondary">
              收货：{order.address?.receiver} {order.address?.phone} · {order.address?.detail}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={open && confirmOpen}
        onClose={closeConfirm}
        closeDisabled={pending}
        title={`确认发货 · ${order?.orderNo ?? ''}`}
        footer={
          <>
            <Btn variant="ghost" onClick={closeConfirm} disabled={pending}>
              取消
            </Btn>
            <Btn variant="primary" onClick={() => void confirmShip()} disabled={pending || !order}>
              {pending ? '提交中…' : '确认发货'}
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-body-sm text-ink">确认后将订单标记为已发货。</p>
          <dl className="space-y-2 rounded-input bg-sunken px-3 py-3 text-caption text-ink-secondary">
            <div className="flex justify-between gap-4">
              <dt>订单</dt>
              <dd className="font-number text-ink">{order?.orderNo}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>物流单号</dt>
              <dd className="break-all font-number text-ink" style={numStyle}>{trackingNo.trim()}</dd>
            </div>
          </dl>
        </div>
      </Modal>
    </>
  )
}
