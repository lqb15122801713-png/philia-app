/**
 * 年费分摊双口径参考件（急修三件 PD-03 件 2 · QA40-D1 · 35 号档落点）
 *
 * 数据源=membership.amortizationStats（本月）：cashFen=售卡实收（本店 settled 未冲正
 * membership 单合计）/ amortizedFen=分摊确认（Y7 本店口径=按办卡店 sold_store_id 过滤，
 * 微光线上开档无办卡店暂不计入）。
 * 纪律：参考口径行——不计入任何「已收/营业额」合计（年费售卡实收已在现金/微信/支付宝
 * 分列里，重复计入=双计，三本账红线）。
 */

import { useQuery } from '@tanstack/react-query'
import { usePhiliaClient } from '@philia/shared'
import { fenToYuan } from '../mall-admin/format'

export function useAmortizationStats() {
  const { trpc } = usePhiliaClient()
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return useQuery({
    queryKey: ['membership', 'amortizationStats', month],
    queryFn: () => trpc.membership.amortizationStats.query({ month }),
    staleTime: 60_000,
  })
}

/** 日结页分列区下参考行（35 号档修复点 1） */
export function AmortizationDayLine() {
  const q = useAmortizationStats()
  return (
    <p
      className="mt-1.5 text-caption-xs leading-relaxed text-[rgba(74,59,46,.42)]"
      data-testid="dayclose-amortization"
    >
      其中：会员费分摊确认（本月累计）{' '}
      <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">
        ¥{q.data ? fenToYuan(q.data.amortizedFen) : '…'}
      </b>
      {' · 售卡实收（本月）'}
      <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">
        ¥{q.data ? fenToYuan(q.data.cashFen) : '…'}
      </b>
      {' —— 参考口径，不计入今日已收'}
    </p>
  )
}

/** dashboard 营业额卡口径注（35 号档修复点 2） */
export function AmortizationDashNote() {
  const q = useAmortizationStats()
  if (!q.data) return null
  return (
    <div className="mt-1 text-[11px] leading-snug text-[rgba(74,59,46,.42)]" data-testid="dashboard-amortization-note">
      含售卡实收 ¥{fenToYuan(q.data.cashFen)} · 分摊确认口径 ¥{fenToYuan(q.data.amortizedFen)}（本月）
    </div>
  )
}
