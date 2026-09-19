/**
 * P1 会员检索条（批次 M1 · 试样 .member-search/.member-hit 工艺）
 *
 * - 手机号输入 + 检索钮（圆胶囊 ring 纸面）；空 = 散客，不阻塞结账；
 * - 命中 = 浅木底会员条：字圈 + 姓名 + 次卡余额签（薄荷，余 0 不出签）+
 *   脱敏手机 · 在店预约数 + 移除钮；
 * - 未命中 = 安静灰字「未找到会员，按散客结账」；检索失败原文 toast；
 * - 不做现场注册会员（任务书 §1.3 红线）。
 */

import { usePhiliaClient } from '@philia/shared'
import { TRPCClientError } from '@trpc/client'
import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { CashierMember } from './model'

export default function MemberSearch({
  member,
  onSelect,
  onRemove,
}: {
  member: CashierMember | null
  onSelect: (m: CashierMember) => void
  onRemove: () => void
}) {
  const { trpc } = usePhiliaClient()
  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [missed, setMissed] = useState(false)

  const doSearch = async () => {
    const p = phone.trim()
    if (p.length < 3 || searching) return
    setSearching(true)
    setMissed(false)
    try {
      const r = await trpc.cashier.searchMember.query({ phone: p })
      if (r.found) {
        onSelect({
          id: r.id,
          nickname: r.nickname,
          phoneMasked: r.phoneMasked,
          passRemainTimes: r.passRemainTimes,
          // M1-补2 R5：储值余额真值（本金+赠送；收银识别可见余额，矩阵⑥）
          storedValueBalanceFen: r.storedValueBalanceFen,
          appointmentCount: r.appointmentCount,
        })
      } else {
        // 未命中：安静灰字，不阻塞散客结账
        setMissed(true)
      }
    } catch (e) {
      toast.error(e instanceof TRPCClientError ? e.message : '会员检索失败，请重试')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div data-testid="cashier-member-search">
      <div className="flex gap-2">
        <input
          type="search"
          inputMode="tel"
          data-testid="cashier-member-phone"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setMissed(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void doSearch()
          }}
          placeholder="输入手机号找会员，留空=散客"
          className="flex-1 rounded-full bg-[#FFFDF6] px-4 py-2.5 text-body-sm text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] placeholder:text-[rgba(74,59,46,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(74,59,46,.25)]"
        />
        <button
          type="button"
          data-testid="cashier-member-search-btn"
          disabled={phone.trim().length < 3 || searching}
          onClick={() => void doSearch()}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FFFDF6] px-4 py-2.5 text-caption font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
        >
          <Search size={15} strokeWidth={1.8} aria-hidden />
          {searching ? '检索中…' : '检索'}
        </button>
      </div>

      {member ? (
        /* 命中态：浅木底会员条 */
        <div
          className="mt-2.5 flex items-center gap-2.5 rounded-[14px] bg-[#F1E8D4] px-3.5 py-2.5"
          data-testid="cashier-member-hit"
        >
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#FFFDF6] text-body-sm font-bold shadow-[0_0_0_1px_rgba(74,59,46,.09)]">
            {(member.nickname ?? '客').slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-caption font-semibold">
              {member.nickname ?? '会员'}
              {member.passRemainTimes > 0 ? (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-[#7FD8BE] px-2.5 py-[3px] text-caption-xs text-[#1E4D3D]">
                  次卡 · 余 {member.passRemainTimes} 次
                </span>
              ) : null}
              {/* M1-补2 R5：储值余额签（柠檬底；>0 才出。收银识别可见余额——矩阵⑥） */}
              {member.storedValueBalanceFen > 0 ? (
                <span
                  className="ml-1.5 inline-flex items-center rounded-full bg-brand-primary px-2.5 py-[3px] font-number tabular-nums text-caption-xs text-ink"
                  data-testid="cashier-member-sv"
                >
                  储值 · 余 ¥{(member.storedValueBalanceFen / 100).toFixed(2)}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
              {member.phoneMasked ?? '未留手机'}
              {member.appointmentCount > 0 ? ` · 在店预约 ${member.appointmentCount} 单` : ''}
            </div>
          </div>
          <button
            type="button"
            data-testid="cashier-member-remove"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-full bg-[#FFFDF6] px-3 py-1.5 text-caption-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            <X size={12} strokeWidth={1.8} aria-hidden />
            移除
          </button>
        </div>
      ) : missed ? (
        <p className="mt-2 px-1 text-caption-xs text-[rgba(74,59,46,.42)]" data-testid="cashier-member-miss">
          未找到会员，按散客结账
        </p>
      ) : null}
    </div>
  )
}
