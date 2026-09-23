/**
 * MemberCardPage · /me/card 会员卡页（批次 U1 任务 H 信息展示 v0 → R11a 骨架批档位联动）
 *
 * R11a 档位联动（docs/r11/R11a-DESIGN.md §五「会员码页档位联动」）：
 * 1. 顶部档位签=真实数据（membership.my）：档位名/状态（生效·冻结·退会）/有效期至
 *    + 会员中心入口（/member）；非会员显引导（开通会员 → /member，微光档免费一键开）；
 * 2. 旧三档占位卡面（星芽会员/进阶档/高阶档）退役——R11a 四档（微光/萤火/烛光/暖阳）
 *    已落槌上线，占位档名与真实档位冲突，按本页「禁止虚构」口径换为 membership.plans
 *    实时四档对照（会员态标「当前档」）；
 * 3. 守护值流水维持诚实替代：真实次卡余额（pass.mine 既有接口，按门店列
 *    「剩余 N 次 / 共 M 次」，无次卡显示 0 与说明）。
 */

import { useQuery } from '@tanstack/react-query'
import { Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { ErrorState, LoadingBlock, formatDateCn } from '../components/home/common'
import { PlanCompareTable, planShortName } from '../components/member/plans'

const STATUS_META: Record<string, { text: string; cls: string }> = {
  active: { text: '生效中', cls: 'bg-success-light text-success-deep' },
  frozen: { text: '已冻结', cls: 'bg-danger-light text-danger-deep' },
  cancelled: { text: '已退会', cls: 'bg-sunken text-ink-secondary' },
}

/** R11a 档位签：membership.my 真实档位；非会员显引导 */
function TierBadge() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    enabled: !!user,
  })

  if (myQ.isPending) return <LoadingBlock lines={2} />
  if (myQ.isError) {
    return <ErrorState message="会员信息加载失败" onRetry={() => void myQ.refetch()} />
  }

  const m = myQ.data.membership
  if (!m) {
    /* 非会员引导（微光档免费，开通页一键开） */
    return (
      <section data-testid="membercard-guide" className="u1-card p-4">
        <p className="text-caption-xs font-semibold tracking-[0.22em] text-ink-placeholder">
          PHILIA MEMBERSHIP
        </p>
        <p className="mt-2 text-body-sm font-semibold">还不是会员</p>
        <p className="mt-1 text-caption leading-[1.7] text-ink-secondary">
          开通会员享商品回馈金与服务折扣；微光档免费，一键开通即会员。
        </p>
        <Link
          to="/member"
          data-testid="membercard-guide-link"
          className="mt-3 inline-flex items-center rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          开通会员 ›
        </Link>
      </section>
    )
  }

  const meta = STATUS_META[m.status] ?? { text: m.status, cls: 'bg-sunken text-ink-secondary' }
  const name = myQ.data.plan
    ? planShortName({ planKey: m.planKey, label: myQ.data.plan.label })
    : m.planKey
  return (
    <section data-testid="membercard-tier" className="u1-card p-4" aria-label="我的会员档位">
      <div className="flex items-center gap-2">
        <p className="text-caption-xs font-semibold tracking-[0.22em] text-ink-placeholder">
          PHILIA MEMBERSHIP
        </p>
        <span className={`ml-auto rounded-chip px-2 py-0.5 text-caption-xs ${meta.cls}`}>
          {meta.text}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <h2 className="u1-serif text-title">{name}会员</h2>
        <span className="u1-num text-caption text-ink-secondary">
          有效期至 {formatDateCn(m.expiresAt)}
        </span>
      </div>
      <Link to="/member" className="mt-2 block text-right text-caption text-ink-secondary">
        会员中心 ›
      </Link>
    </section>
  )
}

/** R11a 真实四档对照（membership.plans 实时读表；会员态标当前档） */
function RealPlans({ currentPlanKey }: { currentPlanKey: string | null }) {
  const { trpc } = usePhiliaClient()
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })

  if (plansQ.isPending) return <LoadingBlock lines={3} />
  if (plansQ.isError) {
    return <ErrorState message="档位信息加载失败" onRetry={() => void plansQ.refetch()} />
  }
  return (
    <section aria-label="权益对照">
      <h2 className="mb-3 text-title">权益对照</h2>
      <PlanCompareTable plans={plansQ.data.plans} currentPlanKey={currentPlanKey} />
    </section>
  )
}

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
          暂无次卡。守护值流水暂无数据接口，本页不展示推测内容。
        </p>
      )}
    </section>
  )
}

export default function MemberCardPage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  /* 档位签读一次供「当前档」标记复用（与 TierBadge 同 queryKey，命中缓存零额外请求） */
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    enabled: !!user,
  })
  const currentPlanKey = myQ.data?.membership?.planKey ?? null

  return (
    <div className="px-4 pb-10 pt-6">
      <PageHeader title="会员卡" />

      {/* R11a 档位签（真实档位；非会员显引导） */}
      <div className="mt-4">
        <TierBadge />
      </div>

      {/* R11a 真实四档对照（占位三档卡面退役） */}
      <div className="mt-4">
        <RealPlans currentPlanKey={currentPlanKey} />
      </div>

      {/* 守护值流水 → 诚实替代：真实次卡余额 + 说明 */}
      <div className="mt-4">
        <PassBalance />
      </div>

      <p className="mt-4 text-center text-caption-xs text-ink-placeholder">
        档位与权益细则见会员中心规则明面 · 次卡余额为实时数据
      </p>
    </div>
  )
}
