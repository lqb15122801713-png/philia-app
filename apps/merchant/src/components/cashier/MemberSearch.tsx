/**
 * P1 会员检索条（批次 M1 · 试样 .member-search/.member-hit 工艺；R11a 会员域落点）
 *
 * - 手机号输入 + 检索钮（圆胶囊 ring 纸面）；空 = 散客，不阻塞结账；
 * - 命中 = 浅木底会员条：字圈 + 姓名 + 次卡余额签（薄荷，余 0 不出签）+
 *   脱敏手机 · 在店预约数 + 移除钮；
 * - R11a 补丁：会员识别条走正式通道 membership.forUser（merchantProcedure，clerk
 *   放行）——识别命中后带出档位签/回馈金余额（已到账+本期预计）/宠物数/有效期；
 *   冻结灰签/临期（≤30 天）续费钮逻辑不变；forUser 加载期/失败回落会话缓存
 *   （售卡/续费成交回写），非会员（membership=null）回落无档位签的原引导；
 * - 会员区常驻「售卡/开卡」入口（售卡面板：新客手机号建档旁路亦可）；
 * - 未命中 = 安静灰字「未找到会员，按散客结账」+ 建档开卡入口（R11a §四.6）；
 *   检索失败原文 toast。
 */

import { usePhiliaClient } from '@philia/shared'
import { useQuery } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { CreditCard, Search, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  isRenewDue,
  MEMBER_FOR_USER_KEY,
  planShortLabel,
  serviceDiscountLabel,
  type MembershipRow,
} from './membership'
import type { CashierMember } from './model'

export default function MemberSearch({
  member,
  membership,
  svcDiscountBp,
  onSelect,
  onRemove,
  onOpenSell,
}: {
  member: CashierMember | null
  /** R11a：本端会话缓存的会员实例（售卡/续费成交回写；无 server 读路径，骨架批报备） */
  membership: MembershipRow | null
  /** 会员服务折扣 bp（缓存档位 → plans 目录查出；null/≥10000=无折扣或档位未知） */
  svcDiscountBp: number | null
  onSelect: (m: CashierMember) => void
  onRemove: () => void
  /** 打开售卡/续费面板（新客建档旁路带 phone；续费带 mode='renew'） */
  onOpenSell: (opts?: { phone?: string; planKey?: string; mode?: 'sell' | 'renew' }) => void
}) {
  const { trpc } = usePhiliaClient()
  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [missed, setMissed] = useState(false)

  /**
   * R11a 补丁：识别命中后调 membership.forUser 正式通道带出会员真值
   * （档位/status/expiresAt/petCount + plan 配置 + rebate 余额视图）。
   * 加载期/失败回落会话缓存 props（售卡/续费成交回写）；非会员 membership=null。
   */
  const forUserQ = useQuery({
    queryKey: MEMBER_FOR_USER_KEY(member?.id ?? ''),
    queryFn: () => trpc.membership.forUser.query({ userId: member!.id }),
    enabled: member !== null,
  })
  const fu = forUserQ.data ?? null
  /** 展示口径：forUser 已返回（成功/失败定型）→ 以真值为准；否则会话缓存兜底 */
  const effMembership: MembershipRow | null = fu ? fu.membership : membership
  const effSvcBp: number | null = fu
    ? (fu.plan && fu.plan.serviceDiscountBp < 10000 ? fu.plan.serviceDiscountBp : null)
    : svcDiscountBp
  /** 回馈金余额视图（仅 forUser 真值；缓存无余额域） */
  const rebate = fu?.rebate ?? null

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
              {/* R11a：档位签（forUser 真值优先，会话缓存兜底；frozen 灰签） */}
              {effMembership ? (
                <span
                  className={`ml-1.5 inline-flex items-center rounded-full px-2.5 py-[3px] text-caption-xs ${
                    effMembership.status === 'active' ? 'bg-brand-primary text-ink' : 'bg-[rgba(74,59,46,.12)] text-[rgba(74,59,46,.62)]'
                  }`}
                  data-testid="cashier-member-plan"
                >
                  {planShortLabel(effMembership.planKey)}会员
                  {effMembership.status === 'frozen' ? ' · 已冻结' : ''}
                  {effSvcBp !== null && serviceDiscountLabel(effSvcBp)
                    ? ` · ${serviceDiscountLabel(effSvcBp)}`
                    : ''}
                </span>
              ) : null}
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
              {/* R11a 补丁：回馈金余额签（forUser 真值；已到账可用，本期预计=次月到账口径小字；全 0 不出签） */}
              {effMembership && rebate && (rebate.balanceFen > 0 || rebate.pendingFen > 0) ? (
                <span
                  className="ml-1.5 inline-flex items-center rounded-full bg-[#FFFDF6] px-2.5 py-[3px] font-number tabular-nums text-caption-xs text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)]"
                  data-testid="cashier-member-rebate"
                  title={rebate.pendingFen > 0 ? `本期预计 ¥${(rebate.pendingFen / 100).toFixed(2)} 次月到账` : undefined}
                >
                  回馈金 · 余 ¥{(rebate.balanceFen / 100).toFixed(2)}
                  {rebate.pendingFen > 0 ? `（+在途 ¥${(rebate.pendingFen / 100).toFixed(2)}）` : ''}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
              {member.phoneMasked ?? '未留手机'}
              {member.appointmentCount > 0 ? ` · 在店预约 ${member.appointmentCount} 单` : ''}
              {effMembership
                ? ` · 含宠物 ${effMembership.petCount} 只 · 有效期至 ${effMembership.expiresAt.getMonth() + 1}月${effMembership.expiresAt.getDate()}日`
                : ''}
            </div>
          </div>
          {/* R11a：frozen/临期（≤30 天）续费入口（forUser 真值判定；未定型时售卡面板内可手动切续费） */}
          {effMembership && isRenewDue(effMembership) ? (
            <button
              type="button"
              data-testid="cashier-member-renew"
              onClick={() => onOpenSell({ mode: 'renew' })}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full bg-brand-primary px-3 py-1.5 text-caption-xs font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
            >
              续费
            </button>
          ) : null}
          <button
            type="button"
            data-testid="cashier-member-remove"
            onClick={onRemove}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-[#FFFDF6] px-3 py-1.5 text-caption-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            <X size={12} strokeWidth={1.8} aria-hidden />
            移除
          </button>
        </div>
      ) : missed ? (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-caption-xs text-[rgba(74,59,46,.42)]" data-testid="cashier-member-miss">
          未找到会员，按散客结账
          {/* R11a §四.6：新客快速开卡旁路（手机号建档+售卡一气呵成） */}
          <button
            type="button"
            data-testid="cashier-member-open-card"
            onClick={() => onOpenSell({ phone: phone.trim() })}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-brand-primary px-3 py-1.5 font-semibold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            <CreditCard size={12} strokeWidth={1.8} aria-hidden />
            建档并售卡 ›
          </button>
        </p>
      ) : null}

      {/* R11a：会员区常驻售卡入口（命中/散客态均在；面板内可切续费/新客建档） */}
      {!member && !missed ? (
        <button
          type="button"
          data-testid="cashier-sell-entry"
          onClick={() => onOpenSell()}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#FFFDF6] px-3.5 py-2 text-caption-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          <CreditCard size={13} strokeWidth={1.8} aria-hidden />
          会员卡 · 售卡 / 续费
        </button>
      ) : null}
      {member ? (
        <button
          type="button"
          data-testid="cashier-sell-entry-member"
          onClick={() => onOpenSell()}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#FFFDF6] px-3.5 py-2 text-caption-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
        >
          <CreditCard size={13} strokeWidth={1.8} aria-hidden />
          售卡 / 续费
        </button>
      ) : null}
    </div>
  )
}
