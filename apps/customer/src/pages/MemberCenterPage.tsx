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
 *
 * 客户端体验大批 片 3：权益墙上方加「未用权益」区（perk.myUnused 台账：次卡剩余
 * 并显行 + grants 资格行（生日礼双行/新人礼包 + 发放时刻）+「资格留痕，发放候
 * 资质批」注记）；CTA 区续费优惠透出（pay.quote renewal 分支折后价行，无优惠不显）。
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import { mc } from '../components/member/copy'
import { fmtDateTime } from '../components/account/common'
import {
  AppHead,
  CardFace,
  FamCard,
  Ledger,
  PerksWall,
  PushBar,
  RulesBlock,
  SavingsSheet,
  SecH,
  Sheet,
  TipCard,
  dailyOf,
  tierClaimOf,
  tierNameOf,
  yuanOf,
  zheOf,
  type SavingsData,
  type V2Plan,
} from '../components/member/v2'
import { ErrorState, LoadingBlock } from '../components/home/common'

const DAY_MS = 24 * 60 * 60 * 1000

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']
/* 片 3：perk.myUnused 透出类型（server 契约：{passTimes, passNote, grants[]}） */
type MyUnused = Awaited<ReturnType<Trpc['perk']['myUnused']['query']>>
type PerkGrant = MyUnused['grants'][number]

export default function MemberCenterPage() {
  const { trpc } = usePhiliaClient()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<'renew' | 'quit' | 'saved' | null>(null)

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })
  /* 补缺批片 3：今年已省双源聚合（仅会员态点亮；非会员分流 J-01 不查） */
  const savingsQ = useQuery({
    queryKey: ['membership', 'mySavings'],
    queryFn: () => trpc.membership.mySavings.query(),
    enabled: !!myQ.data?.membership,
  })
  /* 客户端体验大批 片 3：未用权益台账（perk.myUnused，仅会员态点亮） */
  const unusedQ = useQuery({
    queryKey: ['perk', 'myUnused'],
    queryFn: () => trpc.perk.myUnused.query(),
    enabled: !!myQ.data?.membership,
  })
  /* 客户端体验大批 片 3：续费优惠透出（pay.quote renewal=true 分支；免费档不谈续费不查） */
  const isFree = !!myQ.data?.plan?.free
  const renewQuoteQ = useQuery({
    queryKey: ['pay', 'quote', 'renewal', myQ.data?.membership?.planKey, myQ.data?.membership?.petCount],
    queryFn: () =>
      trpc.pay.quote.query({
        bizDomain: 'membership_open',
        planKey: myQ.data!.membership!.planKey,
        petCount: myQ.data!.membership!.petCount,
        renewal: true,
      }),
    enabled: !!myQ.data?.membership && !isFree,
    staleTime: 60_000,
    retry: false,
  })
  /* 折后价行：renewal.discountBp<10000=有优惠才显，无优惠不显（不上假行） */
  const renewal = renewQuoteQ.data?.renewal ?? null
  const renewLine =
    renewal && renewal.discountBp < 10000
      ? mc('perk.renewOff', { zhe: zheOf(renewal.discountBp) ?? '', amount: yuanOf(renewal.amountFen) })
      : null

  return (
    <div className="m2" data-testid="member-center-page" style={{ minHeight: '100vh' }}>
      {/* 导航闭环：详情级页固定回 /me（dock 归换皮批全域件，本批不动） */}
      <PushBar label={mc('a3.pushLabel')} fallback="/me" />
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
          savings={(savingsQ.data ?? null) as SavingsData | null}
          unusedQ={unusedQ}
          renewLine={renewLine}
          onSheet={setSheet}
          onGotoRebate={() => navigate('/member/rebate')}
          onGotoOpen={() => navigate('/member/open')}
          onGotoUpgrade={() => navigate('/member/upgrade')}
          onGotoChange={() => navigate('/member/change')}
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
        {/* PR-5 UX P3-3：纯信息弹层「知道了」次级钮（定稿同类弹层惯例） */}
        <button
          type="button"
          data-testid="renew-sheet-got-it"
          className="m2-press"
          style={{ marginTop: 14, width: '100%', padding: '13px 22px', borderRadius: 18, border: '1px solid var(--v2line)', background: 'var(--v2card)', color: 'var(--v2ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => setSheet(null)}
        >
          {mc('a3.sheetGotIt')}
        </button>
      </Sheet>
      <Sheet open={sheet === 'quit'} onClose={() => setSheet(null)} title={mc('a3.quitSheetTitle')}>
        <p className="m2-note">{mc('a3.quitSheetBody')}</p>
      </Sheet>

      {/* 补缺批片 3：今年已省构成明面弹层（两源逐项 mono + 防夸大注，金额读 mySavings） */}
      <SavingsSheet
        open={sheet === 'saved'}
        onClose={() => setSheet(null)}
        savings={(savingsQ.data ?? null) as SavingsData | null}
      />
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
  /* 补缺批片 3 新增透出（入口判定字段） */
  nextPlanKey: string | null
  nextPlanSetAt: Date | string | null
  upgradeAvailable: boolean
  changeWindowDays: number
}

function A3Body({
  my,
  plans,
  settlementDay,
  validityDays,
  savings,
  unusedQ,
  renewLine,
  onSheet,
  onGotoRebate,
  onGotoOpen,
  onGotoUpgrade,
  onGotoChange,
}: {
  my: MyData
  plans: V2Plan[]
  settlementDay: number
  validityDays: number
  savings: SavingsData | null
  unusedQ: UseQueryResult<MyUnused>
  renewLine: string | null
  onSheet: (s: 'renew' | 'quit' | 'saved') => void
  onGotoRebate: () => void
  onGotoOpen: () => void
  onGotoUpgrade: () => void
  onGotoChange: () => void
}) {
  const m = my.membership
  /* 分流（36 号档 §〇）：无档/已退会 → J-01 办理页 */
  if (!m) return <Navigate to="/member/open" replace />

  const plan = (plans.find((p) => p.planKey === m.planKey) ?? my.plan ?? null) as V2Plan | null
  const tier = tierNameOf(m.planKey)
  const frozen = m.status === 'frozen'
  /* PR-4 PD-05 件 1：免费档永久豁免——到期提醒条（30/7 天）对微光不渲染 */
  const isFreePlan = !!plan?.free
  const expiresAt = new Date(m.expiresAt)
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS)
  const showRemind = !frozen && !isFreePlan && daysLeft <= 30
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

      {/* 补缺批片 3：已预约下期档位入口条（nextPlanKey 非空才显，→/member/change） */}
      {my.nextPlanKey ? (
        <TipCard testId="member-change-entry">
          <button type="button" className="m2-link" style={{ padding: 0 }} onClick={onGotoChange}>
            {mc('chg.scheduledEntry', { plan: tierNameOf(my.nextPlanKey) })}
          </button>
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

      {/* 补缺批片 3：账区加一行「今年已省 ¥{total} ›」（mySavings 真值），点开构成明面弹层 */}
      {savings ? (
        <button
          type="button"
          data-testid="member-saved-row"
          className="m2-card m2-press"
          style={{ width: '100%', marginTop: 10, padding: '13px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'var(--v2ink)', cursor: 'pointer' }}
          onClick={() => onSheet('saved')}
        >
          {mc('saved.rowLine', { total: yuanOf(savings.totalFen) })}
        </button>
      ) : null}

      {/* 客户端体验大批 片 3：未用权益区（权益墙上方；perk.myUnused 台账——
          次卡剩余并显行 + grants 资格行（生日礼双行/新人礼包等 + 发放时刻）+
          台账口径注记「资格留痕，发放候资质批」） */}
      <SecH title={mc('perk.unusedTitle')} />
      {unusedQ.isPending ? (
        <LoadingBlock lines={1} />
      ) : unusedQ.isError ? (
        <ErrorState message={mc('common.memberLoadFail')} onRetry={() => void unusedQ.refetch()} />
      ) : (
        <UnusedPerks data={unusedQ.data} />
      )}
      <p className="m2-note" style={{ marginTop: 8, padding: '0 4px' }} data-testid="perk-ledger-note">
        {mc('perk.ledgerNote')}
      </p>

      {/* 4. 权益墙（档跟随） */}
      <SecH title={mc('a3.perksTitle', { tier })} more={mc('a3.perksAllOn')} />
      {plan ? <PerksWall plan={plan} /> : null}

      {/* 5. 多宠氛围卡（仅暖阳档；真件=素材通道，本批素色占位） */}
      {m.planKey === 'plan_nuanyang' ? <FamCard text={mc('card.claimNuanyang')} /> : null}

      {/* 6. 规则明面（红线 5：全量八条） */}
      <RulesBlock plan={plan} settlementDay={settlementDay} validityDays={validityDays} allPcts={allPcts} />

      {/* 7. CTA 区（续费=到店付弹层；升级会员 →/member/upgrade（upgradeAvailable 才显）；看看别的档 → J-01；
          补缺修复小批 UX 销项：免费档主 CTA=「免费在册 · 随时升级」→升级页，不谈续费） */}
      <div style={{ marginTop: 16 }}>
        {/* 客户端体验大批 片 3：续费优惠透出（quote renewal 折后价行，无优惠不显） */}
        {renewLine ? (
          <p
            className="m2-mono"
            data-testid="member-renew-discount"
            style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 11, color: 'var(--v2ink)' }}
          >
            {renewLine}
          </p>
        ) : null}
        <button
          type="button"
          className="m2-btn-primary m2-press"
          data-testid="member-renew-cta"
          onClick={() => (isFreePlan ? onGotoUpgrade() : onSheet('renew'))}
        >
          {isFreePlan
            ? mc('a3.ctaRenewFree')
            : mc('a3.ctaRenew', { tier, daily: plan ? dailyOf(plan.priceFen) : '—' })}
        </button>
        {my.upgradeAvailable ? (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button type="button" className="m2-link" data-testid="member-upgrade-entry" onClick={onGotoUpgrade}>
              {mc('up.entryCta')}
            </button>
          </div>
        ) : null}
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

/* ------------------------------------------------------------------ */
/* 客户端体验大批 片 3：未用权益台账区                                       */
/* ------------------------------------------------------------------ */

/** grants kind → 资格行文案（枚举值对齐 server PERK_KINDS；未知 kind 兜「权益」不裸枚举） */
function perkKindLabel(kind: string): string {
  switch (kind) {
    case 'service_discount_count':
      return mc('perk.kindServiceDiscount')
    case 'care_package':
      return mc('perk.kindCarePack')
    case 'birthday_owner':
      return mc('perk.kindBirthdayOwner')
    case 'birthday_pet':
      return mc('perk.kindBirthdayPet')
    case 'welcome_pack':
      return mc('perk.kindNewbie')
    case 'upgrade_gift':
      return mc('perk.kindUpgrade')
    default:
      return mc('perk.kindFallback')
  }
}

function UnusedPerks({ data }: { data: MyUnused | undefined }) {
  const passTimes = data?.passTimes ?? 0
  const grants = data?.grants ?? []
  if (passTimes <= 0 && grants.length === 0) {
    return (
      <p className="m2-note" style={{ padding: '0 4px' }} data-testid="perk-unused-empty">
        {mc('perk.unusedEmpty')}
      </p>
    )
  }
  return (
    <div className="m2-card" style={{ padding: '4px 16px' }} data-testid="perk-unused-list">
      {/* 次卡剩余次数并显行（与台账 grants 同区，真实值） */}
      {passTimes > 0 ? (
        <div className="m2-rowx" data-testid="perk-pass-times">
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{mc('perk.passTimesLine', { n: passTimes })}</span>
        </div>
      ) : null}
      {grants.map((g: PerkGrant) => {
        const usedUp = g.totalCount != null && g.remainCount != null && g.remainCount <= 0
        return (
          <div className="m2-rowx" key={g.id} data-testid={`perk-grant-${g.id}`}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>
              {perkKindLabel(g.kind)}
              {/* 资格徽（发放=资格留痕，候资质批） */}
              <span
                className="m2-mono"
                style={{
                  marginLeft: 8,
                  padding: '2px 7px',
                  borderRadius: 999,
                  border: '1px solid var(--v2line)',
                  fontSize: 9,
                  color: usedUp ? 'var(--v2muted)' : 'var(--v2ink)',
                }}
              >
                {usedUp ? mc('perk.usedUp') : g.status}
              </span>
            </span>
            <span className="m2-mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--v2muted)' }}>
              {g.totalCount != null && g.remainCount != null
                ? mc('perk.remainLine', { remain: g.remainCount, total: g.totalCount })
                : null}
              {g.totalCount != null && g.remainCount != null ? ' · ' : ''}
              {mc('perk.grantedAt', { time: fmtDateTime(g.createdAt) })}
            </span>
          </div>
        )
      })}
    </div>
  )
}
