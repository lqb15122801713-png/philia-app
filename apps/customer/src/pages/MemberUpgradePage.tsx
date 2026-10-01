/**
 * MemberUpgradePage · /member/upgrade 升档试算页（补缺批片 3 会员域 · 2026-10-01；
 * 申报锚点=屏题「升级会员」；路由已申报 check-nav-closure / smoke-routes）
 *
 * 数据源=membership.my（当前档/已付/到期日）+ membership.upgradeQuote（server 试算透出：
 * currentPlan / targetPlans[{planKey,label,remainingMonths,baseDiffFen,petDiffFen,totalDiffFen,
 * formula{m,newMonthlyFen,oldMonthlyFen,perMonthDiffFen,newPurchase}}] / windowDays）。
 * 钱域红线：金额展示一律读 server 试算值，前端零重算。
 *
 * 算式明面（R15）：每目标档卡透出「剩余 {m} 整月 ×（新档月均价 − 旧档月均价）= 档位差价」
 * + 多宠附加差价行（恒 0 也透出）+ 合计补差，逐项 mono；newPurchase（微光档新购口径）
 * =标「新购口径」+ 全价句，不走折算公式。
 *
 * 成交口径（内测期 R10）：客户端无线上收款通道，本页只有到店办理指引卡
 * （「到店出示会员码，收银台代办即时生效」），不画假支付钮。
 * 无升级路径（已是最高档 targetPlans 空）/ 非会员 = 说明卡不报错。
 */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { mc } from '../components/member/copy'
import {
  AppHead,
  CardFace,
  PushBar,
  SecH,
  TipCard,
  tierClaimOf,
  tierNameOf,
  yuanOf,
} from '../components/member/v2'

interface QuoteTarget {
  planKey: string
  label: string
  remainingMonths: number
  baseDiffFen: number
  petDiffFen: number
  totalDiffFen: number
  formula: {
    m: number
    newMonthlyFen: number
    oldMonthlyFen: number
    perMonthDiffFen: number
    newPurchase: boolean
  }
}

export default function MemberUpgradePage() {
  const { trpc } = usePhiliaClient()
  const navigate = useNavigate()

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })
  const quoteQ = useQuery({
    queryKey: ['membership', 'upgradeQuote'],
    queryFn: () => trpc.membership.upgradeQuote.query(),
    enabled: !!myQ.data?.membership,
  })

  return (
    <div className="m2" data-testid="member-upgrade-page" style={{ minHeight: '100vh' }}>
      {/* 返回=时间序回退 navigate(-1)，直访兜底=/member（PushBar 既有纪律） */}
      <PushBar label={mc('up.pushLabel')} fallback="/member" />
      <AppHead title={mc('up.headTitle')} no={mc('up.headNo')} />

      {myQ.isPending || (myQ.data?.membership && quoteQ.isPending) ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <LoadingBlock lines={4} />
        </div>
      ) : myQ.isError || quoteQ.isError ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <ErrorState
            message={mc('up.loadFail')}
            onRetry={() => {
              void myQ.refetch()
              void quoteQ.refetch()
            }}
          />
        </div>
      ) : !myQ.data.membership || !quoteQ.data?.currentPlan ? (
        /* 非会员直访：说明卡不报错（不跳走防弹球，给真实出口） */
        <div className="m2-pad" style={{ marginTop: 14 }}>
          <div className="m2-card" data-testid="upgrade-nonmember" style={{ padding: '20px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{mc('up.nonMemberTitle')}</div>
            <p className="m2-note" style={{ marginTop: 8 }}>{mc('up.nonMemberBody')}</p>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button type="button" className="m2-link" onClick={() => navigate('/member/open')}>
                {mc('up.nonMemberCta')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <UpgradeBody
          my={myQ.data}
          targets={quoteQ.data.targetPlans as QuoteTarget[]}
          windowDays={quoteQ.data.windowDays}
          currentFree={!!quoteQ.data.currentPlan.free}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function UpgradeBody({
  my,
  targets,
  windowDays,
  currentFree,
}: {
  my: {
    membership: { planKey: string; expiresAt: Date | string; paidFen: number } | null
  }
  targets: QuoteTarget[]
  windowDays: number
  currentFree: boolean
}) {
  const m = my.membership!
  const expireDate = new Date(m.expiresAt).toLocaleDateString('zh-CN')

  return (
    <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
      {/* 1. 当前档卡（档名/已付 ¥/到期日 mono=cf-no 槽位） */}
      <SecH title={mc('up.currentTitle')} />
      <CardFace
        planKey={m.planKey}
        priceText={currentFree ? mc('chg.priceFree') : mc('up.paidLine', { price: yuanOf(m.paidFen) })}
        claimText={tierClaimOf(m.planKey)}
        noText={mc('up.expireLine', { date: expireDate })}
        height={212}
        testId="upgrade-current-card"
      />
      {currentFree ? (
        <TipCard>{mc('up.freeTierGuide')}</TipCard>
      ) : null}

      {/* 2. 目标档卡列（算式明面 R15，逐项 mono；金额全读 server 试算值） */}
      {targets.length === 0 ? (
        <div className="m2-card" data-testid="upgrade-empty" style={{ marginTop: 16, padding: '20px 18px' }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{mc('up.emptyTitle')}</div>
          <p className="m2-note" style={{ marginTop: 8 }}>{mc('up.emptyTopTier')}</p>
        </div>
      ) : (
        <>
          <SecH title={mc('up.targetTitle')} />
          {targets.map((t) => (
            <div
              className="m2-card"
              data-testid={`upgrade-target-${t.planKey}`}
              key={t.planKey}
              style={{ marginBottom: 12, padding: '16px 18px' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--v2serif)', fontSize: 18, fontWeight: 900 }}>
                  {tierNameOf(t.planKey)}会员
                </span>
                {t.formula.newPurchase ? (
                  <span
                    className="m2-mono"
                    style={{ fontSize: 9, color: 'var(--v2muted)', border: '1px solid var(--v2line)', borderRadius: 99, padding: '2px 8px' }}
                  >
                    {mc('up.newPurchaseTag')}
                  </span>
                ) : null}
              </div>
              {t.formula.newPurchase ? (
                <>
                  <p className="m2-note" style={{ marginTop: 8 }}>{mc('up.newPurchaseLine')}</p>
                  <div className="m2-mono" style={{ marginTop: 8, fontSize: 12, fontWeight: 700 }}>
                    {mc('up.formulaTotal', { total: yuanOf(t.totalDiffFen) })}
                  </div>
                </>
              ) : (
                <div className="m2-mono" style={{ marginTop: 10, fontSize: 10.5, lineHeight: 2, color: 'var(--v2ink)' }}>
                  <div>
                    {mc('up.formulaLine', {
                      m: t.formula.m,
                      newMonthly: yuanOf(t.formula.newMonthlyFen),
                      oldMonthly: yuanOf(t.formula.oldMonthlyFen),
                      diff: yuanOf(t.baseDiffFen),
                    })}
                  </div>
                  {/* 多宠附加行恒 0 也透出（算式明面逐项） */}
                  <div>{mc('up.formulaPet', { pet: yuanOf(t.petDiffFen) })}</div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    {mc('up.formulaTotal', { total: yuanOf(t.totalDiffFen) })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* 3. 到店办理指引卡（内测期无线上收款，不画假支付钮 R10） */}
      {targets.length > 0 ? (
        <div className="m2-card" data-testid="upgrade-store-guide" style={{ marginTop: 4, padding: '16px 18px' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{mc('up.storeGuideTitle')}</div>
          <p className="m2-note" style={{ marginTop: 8 }}>{mc('up.storeGuideBody')}</p>
        </div>
      ) : null}

      {/* 4. 办理说明（即时生效/在途不重算/旧档余额零动作/期内不降级） */}
      <div className="m2-rules" style={{ marginTop: 14 }}>
        <div className="h">{mc('up.notesTitle')}</div>
        <ul>
          {(currentFree
            ? [mc('up.freeTierGuide')]
            : [
                mc('up.noteEffective'),
                mc('up.noteInflight'),
                mc('up.noteBalance'),
                mc('up.noteNoDowngrade', { days: windowDays }),
              ]
          ).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
