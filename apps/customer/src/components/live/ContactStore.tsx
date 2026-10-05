/**
 * 完成前底部（开发方案 §8.4）：「有问题？联系门店」拨号入口。
 * stores.phone 已在仓（0042 迁移，listNearby/getWithServices/appointment.get
 * 返回行均带 phone）：有值渲染 tel: 直拨行，无值隐藏。
 */

import { Phone } from 'lucide-react'

export default function ContactStore({ phone }: { phone?: string | null }) {
  if (!phone) return null
  return (
    <a
      href={`tel:${phone}`}
      data-testid="contact-store"
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card text-body font-semibold text-ink shadow-card transition active:scale-[0.99]"
    >
      <Phone className="h-5 w-5 text-ink" strokeWidth={1.5} />
      有问题？联系门店
    </a>
  )
}
