/**
 * MemberCenterPage · /member 会员页（持有态 A-3 · 批次 R11b 视觉批 · 38 号施工令 +
 * 36 号施工示意图 §二 + 34 号设计规范 v2.0；申报锚点=屏题「会员」）
 *
 * 本批=纯视觉重构（四铁律：功能逻辑/接口/步数/入口零改动，数据口径全部沿用 R11a）：
 * - 分流（36 号档 §〇）：无档（含已退会）→ J-01 /member/open；有档 → 本屏 A-3；
 * - 身份大卡 cardface 持有态（档色谱 §1.3；冻结态=卡面保持+右上状态章 CJ-0923-16⑤）；
 * - 三格账=兜底口径（CJ-0923-16②：回馈金余额/本期预计/到账日，全既有数据零新口径），
 *   点「回馈金余额」格进 W-01 账本独立页（/member/rebate）；
 * - 权益墙 8 枚档跟随（数值读 member_plans 端口）+ 多宠氛围卡（仅暖阳档）+
 *   规则明面全量八条（红线 5）+ 到期提醒条（30/7 天，骨架版逻辑零改动）+
 *   CTA 续费（到店付口径弹层）/「看看别的档」/退会说明；
 * - 文案全走文案键（copy.ts），禁用色 grep=0。
 *
 * 待裁定挂账（开工回执疑点 1/2）：卡面 NO. 号源未拍——本期 cf-no 只落昵称，不留假号。
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import { mc } from '../components/member/copy'
import {
  AppHead,
  CardFace,
  FamCard,
  Ledger,
  PerksWall,
  PushBar,
  RulesBlock,
  SecH,
  Sheet,
  TipCard,
  dailyOf,
  tierClaimOf,
  tierNameOf,
  yuanOf,
  type V2Plan,
} from '../components/member/v2'
import { ErrorState, LoadingBlock } from '../components/home/common'

const DAY_MS = 24 * 60 * 60 * 1000

export default function MemberCenterPage() {
  const { trpc } = usePhiliaClient()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<'renew' | 'quit' | null>(null)

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })

  return (
    <div className="m2" data-testid="member-center-page" style={{ minHeight: '100vh' }}>
      {/* 导航闭环：详情级页固定回 /me（dock 归换皮批全域件，本批不动） */}
      <PushBar label={mc('a3.pushLabel')} to="/me" />
      <AppHead title={mc('a3.headTitle')} no={mc('a3.headNo')} />

      {myQ.isPending || plansQ.isPending ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <LoadingBlock lines={4} />
        </div>
      ) : myQ.isError || plansQ.isError ? (
        <div className="m2-pad" style={{ marginTop: 24 }}>
          <ErrorState
            message={mc('common.memberLoadFail')}
            onRetry={() => {
              void myQ.refetch()
              void plansQ.refetch()
            }}
          />
        </div>
      ) : (
        <A3Body
          my={myQ.data}
          plans={plansQ.data.plans as V2Plan[]}
          settlementDay={plansQ.data.rebateSettlementDay}
          validityDays={plansQ.data.membershipValidityDays}
          onSheet={setSheet}
          onGotoRebate={() => navigate('/member/rebate')}
          onGotoOpen={() => navigate('/member/open')}
        />
      )}

      {/* 续费/退会说明弹层（§4.5 三件套；内测期到店付口径，骨架版文案平移） */}
      <Sheet
        open={sheet === 'renew'}
        onClose={() => setSheet(null)}
        title={mc('a3.renewSheetTitle')}
      >
        <p className="m2-note">
          {mc('a3.renewSheetBody', { days: plansQ.data?.membershipValidityDays ?? 365 })}
        </p>
      </Sheet>
      <Sheet open={sheet === 'quit'} onClose={() => setSheet(null)} title={mc('a3.quitSheetTitle')}>
        <p className="m2-note">{mc('a3.quitSheetBody')}</p>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface MyData {
  membership: {
    planKey: string
    status: string
    expiresAt: Date | string
    petCount: number
    paidFen: number
  } | null
  plan: (V2Plan & { label: string }) | null
  rebate: { balanceFen: number; pendingFen: number; status: string } | null
}

function A3Body({
  my,
  plans,
  settlementDay,
  validityDays,
  onSheet,
  onGotoRebate,
  onGotoOpen,
}: {
  my: MyData
  plans: V2Plan[]
  settlementDay: number
  validityDays: number
  onSheet: (s: 'renew' | 'quit') => void
  onGotoRebate: () => void
  onGotoOpen: () => void
}) {
  const m = my.membership
  /* 分流（36 号档 §〇）：无档/已退会 → J-01 办理页 */
  if (!m) return <Navigate to="/member/open" replace />

  const plan = (plans.find((p) => p.planKey === m.planKey) ?? my.plan ?? null) as V2Plan | null
  const tier = tierNameOf(m.planKey)
  const frozen = m.status === 'frozen'
  const expiresAt = new Date(m.expiresAt)
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS)
  const showRemind = !frozen && daysLeft <= 30
  const allPcts = plans
    .filter((p) => p.rebateBp > 0)
    .map((p) => String(p.rebateBp / 100))
    .join('/')

  return (
    <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 100 }}>
      {/* 1. 身份大卡 cardface 持有态（全幅高 212 · §4.8/§1.3） */}
      <CardFace
        planKey={m.planKey}
        priceText={plan?.free ? mc('card.freePrice') : `¥${(m.paidFen / 100).toFixed(0)} / 年`}
        claimText={tierClaimOf(m.planKey)}
        height={212}
        stamp={frozen ? mc('a3.stampFrozen') : undefined}
        testId="member-identity"
      />

      {/* 2. 到期提醒条（补位件 §二-8：卡面与 ledger 之间；30/7 天逻辑沿用骨架版） */}
      {frozen ? (
        <TipCard testId="member-renew-reminder">
          {mc('a3.stampFrozen')}：{mc('a3.frozenTip')}
        </TipCard>
      ) : showRemind ? (
        <TipCard testId="member-renew-reminder">
          {mc('a3.remindExpire', { days: Math.max(daysLeft, 0) })}
        </TipCard>
      ) : null}

      {/* 3. 三格账 ledger（兜底口径：余额/本期预计/到账日；点首格进 W-01） */}
      <Ledger
        cells={[
          { v: `¥${yuanOf(my.rebate?.balanceFen ?? 0)}`, k: mc('a3.ledgerBalance') },
          { v: `+¥${yuanOf(my.rebate?.pendingFen ?? 0)}`, k: mc('a3.ledgerPending') },
          { v: mc('a3.ledgerSettleDayValue', { day: settlementDay }), k: mc('a3.ledgerSettleDay') },
        ]}
        onCellClick={(i) => {
          if (i === 0) onGotoRebate()
        }}
      />

      {/* 4. 权益墙（档跟随） */}
      <SecH title={mc('a3.perksTitle', { tier })} more={mc('a3.perksAllOn')} />
      {plan ? <PerksWall plan={plan} /> : null}

      {/* 5. 多宠氛围卡（仅暖阳档；真件=素材通道，本批素色占位） */}
      {m.planKey === 'plan_nuanyang' ? <FamCard text={mc('card.claimNuanyang')} /> : null}

      {/* 6. 规则明面（红线 5：全量八条） */}
      <RulesBlock plan={plan} settlementDay={settlementDay} validityDays={validityDays} allPcts={allPcts} />

      {/* 7. CTA 区（续费=到店付弹层；看看别的档 → J-01） */}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="m2-btn-primary m2-press"
          onClick={() => onSheet('renew')}
        >
          {mc('a3.ctaRenew', { tier, daily: plan ? dailyOf(plan.priceFen) : '—' })}
        </button>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button type="button" className="m2-link" onClick={onGotoOpen}>
            {mc('a3.ctaOtherTier')}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button type="button" className="m2-link" onClick={() => onSheet('quit')}>
            {mc('a3.quitLink')}
          </button>
        </div>
      </div>
    </div>
  )
}
