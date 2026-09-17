/**
 * MemberCardPage · /me/card 会员卡页（批次 U1 任务 H · 信息展示 v0）
 *
 * 会员体系细则老板未定——本页=信息展示 v0，禁止虚构权益与价格：
 * 1. 三档卡面展示：档名/折扣一律占位文案「细则以门店公布为准」。
 *    档名取舍（写明出处）：一档取任务书既有词汇「星芽会员」（U1-C 降级文案用名），
 *    其余两档不虚构名称，标「进阶档/高阶档 · 名称以门店公布为准」；
 * 2. 守护值流水：无流水接口、无守护值字段（schema 无积分表）——不编造记录；
 *    改显真实次卡余额（pass.mine 既有接口，按门店列「剩余 N 次 / 共 M 次」，
 *    无次卡显示 0 与说明）；
 * 3. 有效期等字段缺口记 PR 描述（不动 server）。
 */

import { useQuery } from '@tanstack/react-query'
import { Ticket } from 'lucide-react'
import { useMe, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { ErrorState, LoadingBlock } from '../components/home/common'

/** 三档卡面（档名/折扣=占位文案「细则以门店公布为准」） */
const TIERS = [
  { key: 'sprout', name: '星芽会员', note: '首档 · 细则以门店公布为准' },
  { key: 'tier2', name: '进阶档', note: '名称与细则以门店公布为准' },
  { key: 'tier3', name: '高阶档', note: '名称与细则以门店公布为准' },
] as const

/** 真实次卡余额（pass.mine；守护值流水的诚实替代——无流水接口不编造记录） */
function PassBalance() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const passQ = useQuery({
    queryKey: ['pass', 'mine'],
    queryFn: () => trpc.pass.mine.query(),
    enabled: !!user,
  })

  if (passQ.isPending) return <LoadingBlock lines={2} />
  if (passQ.isError) {
    return <ErrorState message="次卡余额加载失败" onRetry={() => void passQ.refetch()} />
  }

  const passes = passQ.data ?? []
  const totalRemain = passes.reduce((s, p) => s + p.remainTimes, 0)

  return (
    <section data-testid="member-pass-balance" aria-label="次卡余额" className="u1-card p-4">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-ink" strokeWidth={1.5} />
        <h2 className="text-title">次卡余额</h2>
        <span className="u1-num ml-auto text-title" data-testid="member-pass-total">
          {totalRemain} <span className="text-caption font-normal text-ink-secondary">次</span>
        </span>
      </div>
      {passes.length > 0 ? (
        <ul className="mt-3 divide-y divide-line-divider">
          {passes.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5 text-body-sm">
              <span className="text-ink">{p.storeName ?? '菲丽亚门店'}</span>
              <span className="u1-num text-ink-secondary">
                剩余 {p.remainTimes} 次 / 共 {p.totalTimes} 次
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-caption text-ink-secondary">
          暂无次卡。守护值与会员权益细则以门店公布为准，本页不展示推测内容。
        </p>
      )}
    </section>
  )
}

export default function MemberCardPage() {
  return (
    <div className="px-4 pb-10 pt-6">
      <PageHeader title="会员卡" />

      {/* 三档卡面（占位文案，禁止虚构权益与价格） */}
      <div className="mt-4 flex flex-col gap-3" data-testid="member-tiers">
        {TIERS.map((t) => (
          <section key={t.key} className="u1-card p-4" aria-label={t.name}>
            <p className="text-caption-xs tracking-[0.18em] text-ink-secondary">GUARDIAN CARD</p>
            <div className="mt-2 flex items-baseline justify-between">
              <h2 className="text-title">{t.name}</h2>
              <span className="rounded-chip bg-sunken px-2 py-0.5 text-caption-xs text-ink-placeholder">
                折扣细则以门店公布为准
              </span>
            </div>
            <p className="mt-1.5 text-caption text-ink-secondary">{t.note}</p>
          </section>
        ))}
      </div>

      {/* 守护值流水 → 诚实替代：真实次卡余额 + 说明 */}
      <div className="mt-4">
        <PassBalance />
      </div>

      <p className="mt-4 text-center text-caption-xs text-ink-placeholder">
        会员体系细则以门店公布为准 · 本页为信息展示 v0
      </p>
    </div>
  )
}
