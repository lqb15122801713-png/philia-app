/**
 * MemberRebatePage · /member/rebate 回馈金账本（W-01 · 批次 R11b 视觉批 · 38 号施工令 +
 * 36 号施工示意图 §四 + 34 号设计规范 v2.0；新路由已申报 check-nav-closure/smoke-routes）
 *
 * 骨架版账本在 /member 页内——定稿 W-01=独立推送页，本批拆分（/member 保留三格账
 * 入口行，点「回馈金余额」格进本页）。
 * 数据源=membership.ledger（R11b 新增端点：余额/期次/到账日读表/全量五类流水/溯源联表
 * 商品名·门店名——38 号档 CJ-0923-16④「联表带商品名=要」；联不到降级=类型文案+单号）；
 * 本年累计=当年 grant 合计（兜底口径 CJ-0923-16②，零新钱口径）。
 * 结算环环值=本周期时间进度折算（dasharray 188.5 · §4.2 mc-ring 同件）。
 */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { mc, type MemberCopyKey } from '../components/member/copy'
import { EmptyC, PushBar, RulesBlock, SecH, yuanOf, type V2Plan } from '../components/member/v2'

const TYPE_LABEL_KEY: Record<string, MemberCopyKey> = {
  grant: 'w1.typeGrant',
  deduct: 'w1.typeDeduct',
  clawback: 'w1.typeClawback',
  freeze: 'w1.typeFreeze',
  clear: 'w1.typeClear',
}

interface LedgerLog {
  id: string
  type: string
  deltaFen: number
  beforeFen: number
  afterFen: number
  sourceId: string
  period: string | null
  settlementId: string | null
  note: string | null
  createdAt: string | Date
  title: string | null
  storeName: string | null
}

/** 期次 'YYYY-MM' → 周期边界（上月 26 日 – 本月 25 日）与到账月 */
function periodBounds(period: string) {
  const [y, m] = period.split('-').map(Number)
  const start = new Date(y, m - 2, 26)
  const end = new Date(y, m - 1, 25)
  const arriveMonth = m === 12 ? 1 : m + 1
  return { start, end, arriveMonth }
}

export default function MemberRebatePage() {
  const { trpc } = usePhiliaClient()
  const navigate = useNavigate()

  const ledgerQ = useQuery({
    queryKey: ['membership', 'ledger'],
    queryFn: () => trpc.membership.ledger.query(),
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })

  return (
    <div className="m2" data-testid="member-rebate-page" style={{ minHeight: '100vh' }}>
      <PushBar label={mc('w1.pushLabel')} to="/member" />

      {ledgerQ.isPending || plansQ.isPending ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <LoadingBlock lines={4} />
        </div>
      ) : ledgerQ.isError || plansQ.isError ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <ErrorState
            message={mc('common.rebateLoadFail')}
            onRetry={() => {
              void ledgerQ.refetch()
              void plansQ.refetch()
            }}
          />
        </div>
      ) : (
        <W1Body
          data={ledgerQ.data}
          plan={
            (plansQ.data.plans as V2Plan[]).find(
              (p) => p.planKey === myQ.data?.membership?.planKey,
            ) ?? null
          }
          plans={(plansQ.data.plans ?? []) as V2Plan[]}
          settlementDay={plansQ.data.rebateSettlementDay}
          validityDays={plansQ.data.rebateValidityDays}
          onGotoMall={() => navigate('/mall')}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function W1Body({
  data,
  plan,
  plans,
  settlementDay,
  validityDays,
  onGotoMall,
}: {
  data: {
    rebate: { balanceFen: number; pendingFen: number; status: string } | null
    period: string
    settlementDay: number
    yearGrantFen: number
    logs: LedgerLog[]
  }
  plan: V2Plan | null
  plans: V2Plan[]
  settlementDay: number
  validityDays: number
  onGotoMall: () => void
}) {
  const { start, end, arriveMonth } = periodBounds(data.period)
  /* 环值=本周期时间进度（offset=188.5×(1−progress)，§4.2 同件口径） */
  const span = end.getTime() + 24 * 3600 * 1000 - start.getTime()
  const progress = Math.min(1, Math.max(0, (Date.now() - start.getTime()) / span))
  const pct = Math.round(progress * 100)
  const offset = (188.5 * (1 - progress)).toFixed(1)
  const frozen = data.rebate?.status === 'frozen'
  const fmtMD = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`
  const allPcts = plans
    .filter((p) => p.rebateBp > 0)
    .map((p) => String(p.rebateBp / 100))
    .join('/')

  return (
    <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
      {/* 结算环卡（§四-2） */}
      <div className="m2-card" style={{ padding: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
        <svg width="76" height="76" viewBox="0 0 76 76" style={{ flex: 'none' }} aria-hidden="true">
          <circle cx="38" cy="38" r="30" fill="none" stroke="#EDE4CE" strokeWidth="8" />
          <circle
            cx="38" cy="38" r="30" fill="none" stroke="var(--gold)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray="188.5" strokeDashoffset={offset}
            transform="rotate(-90 38 38)"
          />
          <text x="38" y="36" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="15" fontWeight="700" fill="#3B2E24">
            {pct}%
          </text>
          <text x="38" y="49" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="7.5" fill="#8A7D6B">
            {mc('w1.ringCenter')}
          </text>
        </svg>
        <div>
          <div className="m2-mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em' }}>
            ¥{yuanOf(data.rebate?.balanceFen ?? 0)}
          </div>
          <div className="m2-note" style={{ marginTop: 4 }}>
            {frozen ? mc('w1.balanceFrozen') : mc('w1.balanceLabel')} ·{' '}
            {mc('w1.periodLine', {
              start: fmtMD(start),
              end: fmtMD(end),
              month: arriveMonth,
              day: settlementDay,
            })}
          </div>
        </div>
      </div>

      {/* 明细（五类流水；本年累计=grant 年聚合） */}
      <SecH title={mc('w1.logsTitle')} more={mc('w1.yearTotal', { amount: yuanOf(data.yearGrantFen) })} />
      {data.logs.length === 0 ? (
        <EmptyC
          title={mc('w1.emptyTitle')}
          desc={mc('w1.emptyDesc')}
          ctaText={mc('w1.emptyCta')}
          onCta={onGotoMall}
        />
      ) : (
        <div className="m2-card" style={{ padding: '4px 16px' }}>
          {data.logs.map((l) => {
            const positive = l.deltaFen > 0
            const zero = l.deltaFen === 0
            const d = new Date(l.createdAt)
            const typeText = mc(TYPE_LABEL_KEY[l.type] ?? 'w1.typeGrant')
            const title = l.title ?? mc('w1.fallbackTitle', { type: typeText, no: l.sourceId })
            return (
              <div className="m2-rowx" key={l.id} data-testid="rebate-log-row">
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{title}</div>
                  <div className="m2-mono" style={{ fontSize: 9, color: 'var(--v2muted)', marginTop: 2 }}>
                    {fmtMD(d)} · {l.storeName ?? l.sourceId} · ¥{yuanOf(l.beforeFen)}→¥{yuanOf(l.afterFen)}
                  </div>
                </div>
                <span
                  className="m2-mono"
                  style={{
                    marginLeft: 'auto',
                    fontWeight: 700,
                    fontSize: 13,
                    color: zero ? 'var(--v2muted)' : positive ? 'var(--v2ink)' : '#B4502E',
                  }}
                >
                  {zero ? '—' : `${positive ? '+' : '−'}¥${yuanOf(Math.abs(l.deltaFen))}`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 规则明面（红线 5 全量八条） */}
      <RulesBlock plan={plan} settlementDay={settlementDay} validityDays={validityDays} allPcts={allPcts} />
    </div>
  )
}
