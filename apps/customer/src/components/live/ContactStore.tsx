/**
 * 完成前底部（开发方案 §8.4）：「有问题？联系门店」拨号入口。
 * 门店电话缺失时按契约隐藏（当前 stores 表无 phone 字段，恒隐藏——
 * 待 schema 补充门店电话后自动生效）。
 */

import { Phone } from 'lucide-react'

export default function ContactStore({ phone }: { phone?: string | null }) {
  if (!phone) return null
  return (
    <a
      href={`tel:${phone}`}
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card text-body font-semibold text-ink shadow-card transition active:scale-[0.99]"
    >
      <Phone className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
      有问题？联系门店
    </a>
  )
}
