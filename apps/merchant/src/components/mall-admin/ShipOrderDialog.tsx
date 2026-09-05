/**
 * 发货弹层（T5.2 · OrdersPage 待发货队列）
 *
 * 输入物流单号（必填）→ mall.shipOrder（服务端校验本店 + 仅 paid 可发货）
 * → toast + invalidate 订单队列；错误原文 toast。
 */

import { usePhiliaClient } from '@philia/shared'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { errMsg, STORE_ORDERS_KEY, type StoreOrder } from './format'
import { Btn, Field, inputCls, Modal } from './ui'

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
  const [pending, setPending] = useState(false)

  // 每次打开重置
  useEffect(() => {
    if (open) {
      setTrackingNo('')
      setPending(false)
    }
  }, [open])

  const submit = async () => {
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`发货 · ${order?.orderNo ?? ''}`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="primary" onClick={() => void submit()} disabled={pending || !order}>
            {pending ? '提交中…' : '确认发货'}
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
            onChange={(e) => setTrackingNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
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
  )
}
