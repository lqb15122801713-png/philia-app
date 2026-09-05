/**
 * MemberPage · /philia/member 会员卡页（T2.1）
 *
 * ⚠️ 后端缺口（已记录）：方案 §2.1 有会员卡页，但第 5 章数据模型无
 * 积分 / 次卡 / 优惠券表——本页顶部只展示可由现有接口聚合的真实数据
 * （昵称 / 加入天数 / 累计完成服务次数 / 累计消费，来自 auth.me + listMine
 * 的 completed 组 priceFen 聚合，前端计算）；
 * 等级 / 积分 / 次卡 / 优惠券四区一律「即将上线（v2）」占位卡，禁止编造数据。
 */

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Coins, Crown, Sparkles, Ticket, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock, formatFen, tabularNums } from '../components/home/common'

const DAY_MS = 86_400_000

/** 真实数据卡：昵称 / 加入天数 / 累计完成服务 / 累计消费 */
function RealStatsCard() {
  const { trpc } = usePhiliaClient()

  // auth.me 原始响应（含 user.createdAt；useMe 的映射结构不含该字段，故另起 key 直查）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 60_000,
  })
  const mineQuery = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
  })

  if (meQuery.isPending || mineQuery.isPending) return <LoadingBlock lines={3} />
  if (meQuery.isError || mineQuery.isError) {
    return (
      <ErrorState
        message="会员信息加载失败"
        onRetry={() => {
          void meQuery.refetch()
          void mineQuery.refetch()
        }}
      />
    )
  }

  const nickname = meQuery.data.user.nickname ?? '铲屎官'
  const createdAt = meQuery.data.user.createdAt
  const joinDays = createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS) + 1)
    : null
  const completed = mineQuery.data.groups.completed
  const completedCount = completed.length
  const totalFen = completed.reduce((sum, a) => sum + a.priceFen, 0)

  return (
    <div className="rounded-card bg-philia-gradient p-5 text-white shadow-philia">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption opacity-90">PHILIA MEMBER</p>
          <p className="mt-1 text-title-lg">{nickname}</p>
          {joinDays !== null ? (
            <p className="mt-1 font-number text-caption opacity-90" style={tabularNums}>
              加入菲丽亚第 {joinDays} 天
            </p>
          ) : null}
        </div>
        <img src="/brand/logo-512.png" alt="" className="h-12 w-12 rounded-card opacity-95" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-input bg-white/20 px-3 py-2.5">
          <p className="text-caption opacity-90">累计完成服务</p>
          <p className="mt-0.5 font-number text-price" style={tabularNums}>
            {completedCount} <span className="text-caption">次</span>
          </p>
        </div>
        <div className="rounded-input bg-white/20 px-3 py-2.5">
          <p className="text-caption opacity-90">累计消费</p>
          <p className="mt-0.5 font-number text-price" style={tabularNums}>
            ¥{formatFen(totalFen)}
          </p>
        </div>
      </div>
    </div>
  )
}

/** 「即将上线」占位卡（v2 功能，无后端表，禁止编造数据） */
function ComingSoonCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Crown
  title: string
  desc: string
}) {
  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-ink-placeholder" strokeWidth={1.5} />
        <p className="text-body font-semibold text-ink-secondary">{title}</p>
        <span className="ml-auto rounded-full bg-sunken px-2 py-0.5 text-caption text-ink-placeholder">
          即将上线 · v2
        </span>
      </div>
      <p className="mt-2 text-caption text-ink-placeholder">{desc}</p>
    </div>
  )
}

export default function MemberPage() {
  return (
    <div className="px-4 pb-6">
      <header className="flex items-center gap-2 pt-6">
        <Link
          to="/philia"
          aria-label="返回"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-card"
        >
          <ArrowLeft className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
        </Link>
        <h1 className="text-title-lg">会员卡</h1>
      </header>

      <div className="mt-4 flex flex-col gap-3">
        <RealStatsCard />

        <ComingSoonCard
          icon={Crown}
          title="会员等级"
          desc="等级体系正在设计中，上线后按消费与服务次数自动升级，敬请期待 v2。"
        />
        <ComingSoonCard
          icon={Coins}
          title="积分"
          desc="消费得积分、积分兑好礼，积分账户随 v2 版本开放。"
        />
        <ComingSoonCard
          icon={Ticket}
          title="次卡"
          desc="洗护次卡套餐（买 N 赠 1）正在筹备，届时支持次卡抵扣预约。"
        />
        <ComingSoonCard
          icon={Sparkles}
          title="优惠券"
          desc="新客礼、生日券、节日券……优惠券中心将于 v2 上线。"
        />

        <p className="mt-1 flex items-center gap-1.5 text-caption text-ink-placeholder">
          <Wallet className="h-3.5 w-3.5" strokeWidth={1.5} />
          以上权益数据以菲丽亚正式上线版本为准
        </p>
      </div>
    </div>
  )
}
