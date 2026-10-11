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
 * + 多宠附加差价行（恒 0 也透出）+ 合计补差，逐项 mono；newPurchase（注册用户档新购口径）
 * =标「新购口径」+ 全价句，不走折算公式。
 *
 * 成交口径（会员链路片 2 · 线上升级 mock 域已通）：每目标档卡「去支付 ¥{差价}」钮
 * → /member/checkout 确认订单（协议三勾选+Mock 水印双位照 R10，server 重算差价落单）；
 * pay_channel_enabled=false → 回落维护态=到店办理指引卡（照 MemberCheckoutPage 工艺）；
 * 注册用户档=新购口径全价句明面（不退卡不折算）。
 * 无升级路径（已是最高档 targetPlans 空）/ 非会员 = 说明卡不报错。
 *
 * 画布化（产品-1010 画布全屏批 片 3 · 会员域扫尾）：五块入册（mu.current/mu.targets/
 * mu.storeGuide/mu.notes/mu.empty），块序/显隐=useCanvasLayout('memberUpgrade')
 * （published→注册表默认序尾补，空=MU_DEFAULT_ORDER 兜底）；文案键挂 CK(data-copy-key)
 * 点选反查锚（CardFace 的 priceText/noText 为 string props 挂不上锚，键如实入册）；
 * ?canvasPreview=1 探针=水印注记行（mc.canvasExampleNote）；店锚=?canvasStore= 预览店锚 >
 * 记忆门店 > 就近首店（MePage 同口径）。PushBar/AppHead 页头与 Mock 水印条不入块册置块流外；
 * 块内逻辑/查询/状态机零改动，data-testid 原值全保留。
 */

import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared'
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
import { pc } from '../copy/pay'
import { readLastBooking } from '@/lib/bookingPrefill'

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

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const MU_DEFAULT_ORDER = ['mu.current', 'mu.targets', 'mu.storeGuide', 'mu.notes', 'mu.empty'] as const

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
  const targets = (quoteQ.data?.targetPlans ?? []) as QuoteTarget[]
  /* 通道开关读 pay.quote 透出（升级域试算兼带 channelEnabled；仅取开关判定维护态回落，
     金额展示仍全读 membership.upgradeQuote 试算值） */
  const chanQ = useQuery({
    queryKey: ['pay', 'quote', 'membership_upgrade', targets[0]?.planKey ?? ''],
    queryFn: () =>
      trpc.pay.quote.query({ bizDomain: 'membership_upgrade', planKey: targets[0]!.planKey, petCount: 0 }),
    enabled: targets.length > 0,
  })
  const channelEnabled = chanQ.data?.channelEnabled ?? true

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（MePage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const upStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'memberUpgrade')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : MU_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('memberUpgrade', upStoreId, registryBlocks)

  const membership = myQ.data?.membership ?? null
  const currentPlan = quoteQ.data?.currentPlan ?? null
  const currentFree = !!currentPlan?.free
  const windowDays = quoteQ.data?.windowDays ?? 30
  const expireDate = membership ? new Date(membership.expiresAt).toLocaleDateString('zh-CN') : ''

  /* ---- 五块渲染器（块内逻辑/条件与改造前逐字一致；文案键挂 CK 点选反查锚） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. mu.current：当前档卡（档名/已付 ¥/到期日 mono=cf-no 槽位）+ 免费档新购口径引导条 */
    'mu.current': () => {
      if (!membership || !currentPlan) return null
      return (
        <>
          <SecH title={<CK k="up.currentTitle">{mc('up.currentTitle')}</CK>} />
          <CardFace
            planKey={membership.planKey}
            priceText={currentFree ? mc('chg.priceFree') : mc('up.paidLine', { price: yuanOf(membership.paidFen) })}
            claimText={tierClaimOf(membership.planKey)}
            noText={mc('up.expireLine', { date: expireDate })}
            height={212}
            testId="upgrade-current-card"
          />
          {currentFree ? (
            <TipCard><CK k="up.freeTierGuide">{mc('up.freeTierGuide')}</CK></TipCard>
          ) : null}
        </>
      )
    },

    /* 2. mu.targets：目标档卡列（算式明面 R15，逐项 mono；金额全读 server 试算值） */
    'mu.targets': () => {
      if (!membership || !currentPlan || targets.length === 0) return null
      return (
        <>
          <SecH title={<CK k="up.targetTitle">{mc('up.targetTitle')}</CK>} />
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
                    <CK k="up.newPurchaseTag">{mc('up.newPurchaseTag')}</CK>
                  </span>
                ) : null}
              </div>
              {t.formula.newPurchase ? (
                <>
                  <p className="m2-note" style={{ marginTop: 8 }}><CK k="up.newPurchaseLine">{mc('up.newPurchaseLine')}</CK></p>
                  <div className="m2-mono" style={{ marginTop: 8, fontSize: 12, fontWeight: 700 }}>
                    <CK k="up.formulaTotal">{mc('up.formulaTotal', { total: yuanOf(t.totalDiffFen) })}</CK>
                  </div>
                </>
              ) : (
                <div className="m2-mono" style={{ marginTop: 10, fontSize: 10.5, lineHeight: 2, color: 'var(--v2ink)' }}>
                  <div>
                    <CK k="up.formulaLine">
                      {mc('up.formulaLine', {
                        m: t.formula.m,
                        newMonthly: yuanOf(t.formula.newMonthlyFen),
                        oldMonthly: yuanOf(t.formula.oldMonthlyFen),
                        diff: yuanOf(t.baseDiffFen),
                      })}
                    </CK>
                  </div>
                  {/* 多宠附加行恒 0 也透出（算式明面逐项） */}
                  <div><CK k="up.formulaPet">{mc('up.formulaPet', { pet: yuanOf(t.petDiffFen) })}</CK></div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    <CK k="up.formulaTotal">{mc('up.formulaTotal', { total: yuanOf(t.totalDiffFen) })}</CK>
                  </div>
                </div>
              )}
              {/* 去支付 ¥{差价}（会员链路片 2：→确认订单页收单，金额=server 试算值透出零自算；
                  通道关=维护态回落到店指引卡，本钮不画） */}
              {channelEnabled ? (
                <button
                  type="button"
                  className="m2-btn-primary m2-press"
                  data-testid={`upgrade-pay-${t.planKey}`}
                  onClick={() => navigate(`/member/checkout?plan=${t.planKey}`)}
                  style={{ width: '100%', marginTop: 12, padding: '13px 0', fontSize: 14.5 }}
                >
                  <span><CK k="up.payCta">{mc('up.payCta', { amount: yuanOf(t.totalDiffFen) })}</CK></span>
                </button>
              ) : null}
            </div>
          ))}
        </>
      )
    },

    /* 3. mu.storeGuide：维护态回落（channelEnabled=false 照 MemberCheckoutPage 工艺=到店办理
          指引卡；通道开时本卡不画，成交入口=各目标档卡「去支付」钮） */
    'mu.storeGuide': () => {
      if (!membership || !currentPlan || targets.length === 0 || channelEnabled) return null
      return (
        <div className="m2-card" data-testid="upgrade-store-guide" style={{ marginTop: 4, padding: '16px 18px' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}><CK k="up.storeGuideTitle">{mc('up.storeGuideTitle')}</CK></div>
          <p className="m2-note" style={{ marginTop: 8 }}><CK k="up.storeGuideBody">{mc('up.storeGuideBody')}</CK></p>
        </div>
      )
    },

    /* 4. mu.notes：办理说明（即时生效/在途不重算/旧档余额零动作/期内不降级） */
    'mu.notes': () => {
      if (!membership || !currentPlan) return null
      const lines: Array<[string, string]> = currentFree
        ? [['up.freeTierGuide', mc('up.freeTierGuide')]]
        : [
            ['up.noteEffective', mc('up.noteEffective')],
            ['up.noteInflight', mc('up.noteInflight')],
            ['up.noteBalance', mc('up.noteBalance')],
            ['up.noteNoDowngrade', mc('up.noteNoDowngrade', { days: windowDays })],
          ]
      return (
        <div className="m2-rules" style={{ marginTop: 14 }}>
          <div className="h"><CK k="up.notesTitle">{mc('up.notesTitle')}</CK></div>
          <ul>
            {lines.map(([k, l]) => (
              <li key={l}><CK k={k}>{l}</CK></li>
            ))}
          </ul>
        </div>
      )
    },

    /* 5. mu.empty：非会员说明卡（直访不报错，给真实出口）/ 已是最高档空态卡 */
    'mu.empty': () => {
      if (!membership || !currentPlan) {
        /* 非会员直访：说明卡不报错（不跳走防弹球，给真实出口） */
        return (
          <div className="m2-card" data-testid="upgrade-nonmember" style={{ padding: '20px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}><CK k="up.nonMemberTitle">{mc('up.nonMemberTitle')}</CK></div>
            <p className="m2-note" style={{ marginTop: 8 }}><CK k="up.nonMemberBody">{mc('up.nonMemberBody')}</CK></p>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button type="button" className="m2-link" onClick={() => navigate('/member/open')}>
                <CK k="up.nonMemberCta">{mc('up.nonMemberCta')}</CK>
              </button>
            </div>
          </div>
        )
      }
      if (targets.length === 0) {
        return (
          <div className="m2-card" data-testid="upgrade-empty" style={{ marginTop: 16, padding: '20px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}><CK k="up.emptyTitle">{mc('up.emptyTitle')}</CK></div>
            <p className="m2-note" style={{ marginTop: 8 }}><CK k="up.emptyTopTier">{mc('up.emptyTopTier')}</CK></p>
          </div>
        )
      }
      return null
    },
  }

  return (
    <CanvasLayoutLoader pageKey="memberUpgrade" storeId={upStoreId}>
      <div className="m2" data-testid="member-upgrade-page" style={{ minHeight: '100vh' }}>
        {/* 返回=时间序回退 navigate(-1)，直访兜底=/member（PushBar 既有纪律）；页头不入块册 */}
        <PushBar label={mc('up.pushLabel')} fallback="/member" />
        <AppHead title={mc('up.headTitle')} no={mc('up.headNo')} />

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="upgrade-canvas-preview-note">
              {mc('mc.canvasExampleNote')}
            </p>
          </div>
        ) : null}

        {/* Mock 水印条（R10：内测通道全程明示；收单双位水印在确认订单页）；不入块册置块流外 */}
        <div className="m2-pad" style={{ marginTop: 12 }}>
          <TipCard testId="mock-watermark-top">{pc('mock.watermark')}</TipCard>
        </div>

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
        ) : (
          /* 块流：五块按有效布局渲染（published 覆盖∪默认序尾补）；默认序下 DOM 结构零差异 */
          <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
            {layout.map((b) =>
              b.visible ? (
                <section data-block-key={b.blockKey} key={b.blockKey}>
                  {renderers[b.blockKey]?.() ?? null}
                </section>
              ) : null,
            )}
          </div>
        )}
      </div>
    </CanvasLayoutLoader>
  )
}
