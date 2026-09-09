/**
 * MemberPage · /philia/member 会员卡页（T2.1）
 *
 * 顶部只展示可由现有接口聚合的真实数据（昵称 / 加入天数 / 累计完成服务次数 /
 * 累计消费，来自 auth.me + listMine 的 completed 组 priceFen 聚合，前端计算）。
 * 次卡（v1.1-b2 B2-7）：member_pass 已落地——次卡区展示 pass.mine 真实余额
 * （按门店列出 剩余/总次数 + 有效期），空态显示「暂无次卡」。
 * 等级 / 积分 / 优惠券三区仍为「即将上线（v2）」占位卡，禁止编造数据。
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
    <div className="rounded-card bg-philia-gradient p-5 text-ink shadow-philia">
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
        <div className="rounded-input bg-card/20 px-3 py-2.5">
          <p className="text-caption opacity-90">累计完成服务</p>
          <p className="mt-0.5 font-number text-price" style={tabularNums}>
            {completedCount} <span className="text-caption">次</span>
          </p>
        </div>
        <div className="rounded-input bg-card/20 px-3 py-2.5">
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

/** 次卡余额有效期展示：YYYY/M/D */
const fmtPassDate = (d: Date | string) => {
  const t = new Date(d)
  return `${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()}`
}

/** 次卡余额卡（v1.1-b2 B2-7）：pass.mine 真实数据，按门店列「剩余 N 次 / 共 M 次」 */
function PassCard() {
  const { trpc } = usePhiliaClient()
  const passQuery = useQuery({
    queryKey: ['pass', 'mine'],
    queryFn: () => trpc.pass.mine.query(),
  })

  if (passQuery.isPending) return <LoadingBlock lines={2} />
  if (passQuery.isError) {
    return <ErrorState message="次卡余额加载失败" onRetry={() => void passQuery.refetch()} />
  }

  const passes = passQuery.data ?? []
  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
        <p className="text-body font-semibold">次卡</p>
        {passes.length > 0 ? (
          <span className="ml-auto font-number text-caption text-ink-secondary" style={tabularNums}>
            剩余 {passes.reduce((s, p) => s + p.remainTimes, 0)} 次
          </span>
        ) : null}
      </div>
      {passes.length === 0 ? (
        <p className="mt-2 text-caption text-ink-placeholder">
          暂无次卡，可联系门店充次；充次后预约洗护/寄养可选「次卡扣次」。
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {passes.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-input bg-sunken px-3 py-2.5">
              <div>
                <p className="text-body font-medium">{p.storeName}</p>
                <p className="mt-0.5 text-caption text-ink-secondary">
                  {p.status !== 'active'
                    ? '已停用'
                    : p.expiresAt
                      ? `有效期至 ${fmtPassDate(p.expiresAt)}`
                      : '长期有效'}
                </p>
              </div>
              <p className="font-number text-price text-brand-primary" style={tabularNums}>
                {p.remainTimes}
                <span className="text-caption font-normal text-ink-secondary"> / 共 {p.totalTimes} 次</span>
              </p>
            </div>
          ))}
        </div>
      )}
      {/* B2-7R（产品裁定A）：适用范围明示，防「寄养不能用」客诉 */}
      <p className="mt-3 text-caption text-ink-placeholder">次卡仅适用于洗护服务</p>
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
        <PassCard />
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
