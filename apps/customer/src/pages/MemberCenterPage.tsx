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
 *
 * 端口批收尾片 3（画布端口 B 股）：A3Body 八区块数组化（cardFace/tips/ledger/
 * unusedPerks/perksWall/famCard/rules/cta）——块内逻辑零改动，块序/显隐=useCanvasLayout
 * 有效布局（published 覆盖∪注册表默认序尾补）；data-block-key 锚 + CK(data-copy-key)
 * 挂注册表 copyKeys 键位（Ledger cells/SecH title  widening=ReactNode 后向兼容）。
 *
 * 微光正名批片 2（A 股 · CJ-1009-02 裁①）：画布预览探针模式（?canvasPreview=1）下
 * 会员态 401/403=示例客户视图（骨架+示例数据[示例档=萤火读 member_plans 端口]+
 * 「预览示例」水印角标，零真会话零写库）；真用户页零改动（非探针模式照旧 ErrorState）。
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, resolvePerkWallCells, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { mc } from '../components/member/copy'
import { fmtDateTime } from '../components/account/common'
import { readLastBooking } from '@/lib/bookingPrefill'
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

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const MC_DEFAULT_ORDER = [
  'mc.cardFace',
  'mc.tips',
  'mc.ledger',
  'mc.unusedPerks',
  'mc.perksWall',
  'mc.famCard',
  'mc.rules',
  'mc.cta',
] as const

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']
/* 片 3：perk.myUnused 透出类型（server 契约：{passTimes, passNote, grants[]}） */
type MyUnused = Awaited<ReturnType<Trpc['perk']['myUnused']['query']>>
type PerkGrant = MyUnused['grants'][number]

export default function MemberCenterPage() {
  const { trpc } = usePhiliaClient()
  const navigate = useNavigate()
  const { user } = useMe()
  const [sheet, setSheet] = useState<'quit' | 'saved' | null>(null)

  /* 微光正名批片 2 A 股（CJ-1009-02 裁①）：画布预览探针参（?canvasPreview=1）识别 */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )

  /* 画布布局店锚（同 HomePage 口径：?canvasStore= 预览店锚 > B4-3 记忆门店 > listNearby 首店） */
  const previewStoreId = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasStore'),
    [],
  )
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: !!user && previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const mcStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

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
        /* 片 2 A 股：画布预览探针模式下会员态 401/403=示例客户视图（骨架+示例数据，
           零真会话零写库；真用户页零改动——非探针模式照旧 ErrorState） */
        myQ.isError && isCanvasPreview && !plansQ.isPending && !plansQ.isError ? (
          <CanvasLayoutLoader pageKey="memberCenter" storeId={mcStoreId}>
            <A3Body
              storeId={mcStoreId}
              my={exampleMyOf(plansQ.data.plans as V2Plan[])}
              plans={plansQ.data.plans as V2Plan[]}
              settlementDay={plansQ.data.rebateSettlementDay}
              validityDays={plansQ.data.membershipValidityDays}
              savings={null}
              unusedQ={null}
              renewLine={null}
              exampleMode
              onSheet={setSheet}
              onGotoRebate={() => navigate('/member/rebate')}
              onGotoOpen={() => navigate('/member/open')}
              onGotoUpgrade={() => navigate('/member/upgrade')}
              onGotoChange={() => navigate('/member/change')}
              onGotoRenew={() => navigate('/member/renew')}
            />
          </CanvasLayoutLoader>
        ) : (
          <div className="m2-pad" style={{ marginTop: 24 }}>
            <ErrorState
              message={mc('common.memberLoadFail')}
              onRetry={() => {
                void myQ.refetch()
                void plansQ.refetch()
              }}
            />
          </div>
        )
      ) : (
        <CanvasLayoutLoader pageKey="memberCenter" storeId={mcStoreId}>
          <A3Body
            storeId={mcStoreId}
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
            onGotoRenew={() => navigate('/member/renew')}
          />
        </CanvasLayoutLoader>
      )}

      {/* 退会说明弹层（§4.5 三件套；续费弹层已随线上续费确认页退役——产品-1010 片 2） */}
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

/** 片 2 A 股：示例客户视图数据（裁②示例档=萤火读 member_plans 端口取档名/权益；
    回馈金挂零同既有口径；零真会话零写库——纯前端合成件） */
function exampleMyOf(plans: V2Plan[]): MyData {
  const examplePlan = plans.find((p) => p.planKey === 'plan_yinghuo') ?? plans.find((p) => !p.free) ?? null
  return {
    membership: {
      planKey: examplePlan?.planKey ?? 'plan_yinghuo',
      status: 'active',
      expiresAt: new Date(Date.now() + 365 * DAY_MS),
      petCount: 0,
      paidFen: examplePlan?.priceFen ?? 0,
    },
    plan: examplePlan as MyData['plan'],
    rebate: { balanceFen: 0, pendingFen: 0, status: 'active' },
    nextPlanKey: null,
    nextPlanSetAt: null,
    upgradeAvailable: true, // 示例档=萤火：存在更高档=升级入口透出（示例真布局）
    changeWindowDays: 30,
  }
}

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
  storeId,
  my,
  plans,
  settlementDay,
  validityDays,
  savings,
  unusedQ,
  renewLine,
  exampleMode = false,
  onSheet,
  onGotoRebate,
  onGotoOpen,
  onGotoUpgrade,
  onGotoChange,
  onGotoRenew,
}: {
  storeId: string | null
  my: MyData
  plans: V2Plan[]
  settlementDay: number
  validityDays: number
  savings: SavingsData | null
  /** 片 2 A 股：null=示例客户视图（画布预览探针模式，不发起真台账查询） */
  unusedQ: UseQueryResult<MyUnused> | null
  renewLine: string | null
  exampleMode?: boolean
  onSheet: (s: 'quit' | 'saved') => void
  onGotoRebate: () => void
  onGotoOpen: () => void
  onGotoUpgrade: () => void
  onGotoChange: () => void
  onGotoRenew: () => void
}) {
  const { trpc } = usePhiliaClient()
  /* ---- 画布端口（端口批收尾片 3）：注册表块序 + 有效布局（hooks 须在分流早退前） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'memberCenter')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : MC_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('memberCenter', storeId, registryBlocks)
  /* 产品-1010 片 1：权益墙格序/图标=布局数据（mc.perksWall 块 perks 位；缺省=写死件默认序） */
  const perkWallCells = resolvePerkWallCells(layout.find((b) => b.blockKey === 'mc.perksWall')?.perks ?? null)

  const m = my.membership
  /* 分流（36 号档 §〇）：无档/已退会 → J-01 办理页 */
  if (!m) return <Navigate to="/member/open" replace />

  const plan = (plans.find((p) => p.planKey === m.planKey) ?? my.plan ?? null) as V2Plan | null
  const tier = tierNameOf(m.planKey)
  const frozen = m.status === 'frozen'
  /* PR-4 PD-05 件 1：免费档永久豁免——到期提醒条（30/7 天）对注册用户不渲染 */
  const isFreePlan = !!plan?.free
  const expiresAt = new Date(m.expiresAt)
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS)
  const showRemind = !frozen && !isFreePlan && daysLeft <= 30
  const allPcts = plans
    .filter((p) => p.rebateBp > 0)
    .map((p) => String(p.rebateBp / 100))
    .join('/')

  /* ---- 八块渲染器（块内逻辑与改造前逐字一致） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. 身份大卡 cardface 持有态（全幅高 212 · §4.8/§1.3） */
    'mc.cardFace': () => (
      <CardFace
        planKey={m.planKey}
        priceText={plan?.free ? mc('card.freePrice') : `¥${(m.paidFen / 100).toFixed(0)} / 年`}
        claimText={tierClaimOf(m.planKey)}
        height={212}
        stamp={frozen ? mc('a3.stampFrozen') : undefined}
        testId="member-identity"
      />
    ),

    /* 2. 到期提醒条（补位件 §二-8：卡面与 ledger 之间；30/7 天逻辑沿用骨架版）+ 下期档位入口条；
       片 2 A 股：示例模式=「预览示例」水印角标置顶（军规一②防误导店主以为真数据） */
    'mc.tips': () => (
      <>
        {exampleMode ? (
          <TipCard testId="canvas-example-watermark">
            <CK k="mc.canvasExampleNote">{mc('mc.canvasExampleNote')}</CK>
          </TipCard>
        ) : null}
        {frozen ? (
          <TipCard testId="member-renew-reminder">
            {mc('a3.stampFrozen')}：{mc('a3.frozenTip')}
          </TipCard>
        ) : showRemind ? (
          <TipCard testId="member-renew-reminder">
            <CK k="a3.remindExpire">{mc('a3.remindExpire', { days: Math.max(daysLeft, 0) })}</CK>
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
      </>
    ),

    /* 3. 三格账 ledger（兜底口径：余额/本期预计/到账日；点首格进 W-01）+ 已省行 */
    'mc.ledger': () => (
      <>
        <Ledger
          cells={[
            { v: `¥${yuanOf(my.rebate?.balanceFen ?? 0)}`, k: <CK k="a3.ledgerBalance">{mc('a3.ledgerBalance')}</CK>, key: 'balance' },
            { v: `+¥${yuanOf(my.rebate?.pendingFen ?? 0)}`, k: <CK k="a3.ledgerPending">{mc('a3.ledgerPending')}</CK>, key: 'pending' },
            { v: mc('a3.ledgerSettleDayValue', { day: settlementDay }), k: mc('a3.ledgerSettleDay'), key: 'settle' },
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
      </>
    ),

    /* 4. 未用权益区（权益墙上方；perk.myUnused 台账——次卡剩余并显行 + grants 资格行 + 台账注记；
       片 2 A 股：示例模式=不发起真台账查询，落既有空态行） */
    'mc.unusedPerks': () => (
      <>
        <SecH title={<CK k="perk.unusedTitle">{mc('perk.unusedTitle')}</CK>} />
        {unusedQ === null ? (
          <UnusedPerks data={undefined} />
        ) : unusedQ.isPending ? (
          <LoadingBlock lines={1} />
        ) : unusedQ.isError ? (
          <ErrorState message={mc('common.memberLoadFail')} onRetry={() => void unusedQ.refetch()} />
        ) : (
          <UnusedPerks data={unusedQ.data} />
        )}
        <p className="m2-note" style={{ marginTop: 8, padding: '0 4px' }} data-testid="perk-ledger-note">
          {mc('perk.ledgerNote')}
        </p>
      </>
    ),

    /* 5. 权益墙（档跟随；片 1：格序/图标=画布布局数据） */
    'mc.perksWall': () => (
      <>
        <SecH title={<CK k="a3.perksTitle">{mc('a3.perksTitle', { tier })}</CK>} more={mc('a3.perksAllOn')} />
        {plan ? <PerksWall plan={plan} cells={perkWallCells} /> : null}
      </>
    ),

    /* 6. 多宠氛围卡（仅暖阳档；真件=素材通道，本批素色占位） */
    'mc.famCard': () => (m.planKey === 'plan_nuanyang' ? <FamCard text={mc('card.claimNuanyang')} /> : null),

    /* 7. 规则明面（红线 5：全量八条） */
    'mc.rules': () => <RulesBlock plan={plan} settlementDay={settlementDay} validityDays={validityDays} allPcts={allPcts} />,

    /* 8. CTA 区（续费=线上续费确认页 /member/renew（产品-1010 片 2 线上收单）；升级会员 →/member/upgrade（upgradeAvailable 才显）；看看别的档 → J-01） */
    'mc.cta': () => (
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
          onClick={() => (isFreePlan ? onGotoUpgrade() : onGotoRenew())}
        >
          <CK k="a3.ctaRenew">
            {isFreePlan
              ? mc('a3.ctaRenewFree')
              : mc('a3.ctaRenew', { tier, daily: plan ? dailyOf(plan.priceFen) : '—' })}
          </CK>
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
            <CK k="a3.ctaOtherTier">{mc('a3.ctaOtherTier')}</CK>
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button type="button" className="m2-link" onClick={() => onSheet('quit')}>
            {mc('a3.quitLink')}
          </button>
        </div>
      </div>
    ),
  }

  return (
    <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 100 }}>
      {layout.map((b) => (
        <section data-block-key={b.blockKey} key={b.blockKey}>
          {b.visible ? (renderers[b.blockKey]?.() ?? null) : null}
        </section>
      ))}
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
        <CK k="perk.unusedEmpty">{mc('perk.unusedEmpty')}</CK>
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
