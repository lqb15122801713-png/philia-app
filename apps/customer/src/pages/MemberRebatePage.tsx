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
 *
 * 画布化（产品-1010 画布全屏批 片 3 · 会员域扫尾）：三块入册（w1.ring/w1.logs/w1.rules），
 * 块序/显隐=useCanvasLayout('rebate')（published→注册表默认序尾补，空=W1_DEFAULT_ORDER
 * 兜底）；文案键挂 CK(data-copy-key) 点选反查锚（环心 w1.ringCenter 在 SVG text 内挂不上锚、
 * 流水行标题/类型为数据驱动动态行、EmptyC 空态三句为 string props——如实入册注记）；
 * ?canvasPreview=1 探针=水印注记行（mc.canvasExampleNote）；店锚=?canvasStore= 预览店锚 >
 * 记忆门店 > 就近首店（MePage 同口径）。PushBar 页头不入块册置块流外；
 * 块内逻辑/查询零改动，data-testid 原值全保留。
 */

import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { mc, type MemberCopyKey } from '../components/member/copy'
import { EmptyC, PushBar, RulesBlock, SecH, yuanOf, type V2Plan } from '../components/member/v2'
import { readLastBooking } from '@/lib/bookingPrefill'

const TYPE_LABEL_KEY: Record<string, MemberCopyKey> = {
  grant: 'w1.typeGrant',
  deduct: 'w1.typeDeduct',
  clawback: 'w1.typeClawback',
  freeze: 'w1.typeFreeze',
  clear: 'w1.typeClear',
}

/** 期次 'YYYY-MM' → 周期边界（上月 26 日 – 本月 25 日）与到账月 */
function periodBounds(period: string) {
  const [y, m] = period.split('-').map(Number)
  const start = new Date(y, m - 2, 26)
  const end = new Date(y, m - 1, 25)
  const arriveMonth = m === 12 ? 1 : m + 1
  return { start, end, arriveMonth }
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const W1_DEFAULT_ORDER = ['w1.ring', 'w1.logs', 'w1.rules'] as const

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
  const w1StoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'rebate')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : W1_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('rebate', w1StoreId, registryBlocks)

  const data = ledgerQ.data ?? null
  const plan =
    ((plansQ.data?.plans as V2Plan[] | undefined) ?? []).find(
      (p) => p.planKey === myQ.data?.membership?.planKey,
    ) ?? null
  const plans = (plansQ.data?.plans ?? []) as V2Plan[]
  const settlementDay = plansQ.data?.rebateSettlementDay ?? 5
  const validityDays = plansQ.data?.rebateValidityDays ?? 365

  const { start, end, arriveMonth } = periodBounds(data?.period ?? '1970-01')
  /* 环值=本周期时间进度（offset=188.5×(1−progress)，§4.2 同件口径） */
  const span = end.getTime() + 24 * 3600 * 1000 - start.getTime()
  const progress = Math.min(1, Math.max(0, (Date.now() - start.getTime()) / span))
  const pct = Math.round(progress * 100)
  const offset = (188.5 * (1 - progress)).toFixed(1)
  const calendarOnly = plan?.free === true || (data?.rebate?.balanceFen ?? 0) === 0
  const frozen = data?.rebate?.status === 'frozen'
  const fmtMD = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`
  const allPcts = plans
    .filter((p) => p.rebateBp > 0)
    .map((p) => String(p.rebateBp / 100))
    .join('/')

  /* ---- 三块渲染器（块内逻辑与改造前逐字一致；文案键挂 CK 点选反查锚） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. w1.ring：结算环卡（§四-2；环心 w1.ringCenter 在 SVG text 内，挂不上 CK 锚如实注记） */
    'w1.ring': () => {
      if (!data) return null
      return (
        <div className="m2-card" style={{ padding: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
          <svg width="76" height="76" viewBox="0 0 76 76" style={{ flex: 'none' }} aria-hidden="true">
            <circle cx="38" cy="38" r="30" fill="none" stroke="#EDE4CE" strokeWidth="8" />
            <circle
              cx="38" cy="38" r="30" fill="none" stroke="var(--gold)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray="188.5" strokeDashoffset={offset}
              transform="rotate(-90 38 38)"
            />
            <text x="38" y="36" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="15" fontWeight="700" fill="#2C2822">
              {calendarOnly ? mc(progress >= 0.5 ? 'w1.calendarPastHalf' : 'w1.calendarFirstHalf') : `${pct}%`}
            </text>
            <text x="38" y="49" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="7.5" fill="#8A7D6B">
              {calendarOnly ? mc('w1.calendarLabel') : mc('w1.ringCenter')}
            </text>
          </svg>
          <div>
            <div className="m2-mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em' }}>
              ¥{yuanOf(data.rebate?.balanceFen ?? 0)}
            </div>
            <div className="m2-note" style={{ marginTop: 4 }}>
              {frozen ? (
                <CK k="w1.balanceFrozen">{mc('w1.balanceFrozen')}</CK>
              ) : (
                <CK k="w1.balanceLabel">{mc('w1.balanceLabel')}</CK>
              )}
            </div>
            {/* PR-4 UX P2-1：周期行独立整行（「·」前强制断行，45 号档修法②——消灭折行孤字） */}
            <div className="m2-note" style={{ marginTop: 2 }}>
              <CK k="w1.periodLine">
                {mc('w1.periodLine', {
                  start: fmtMD(start),
                  end: fmtMD(end),
                  month: arriveMonth,
                  day: settlementDay,
                })}
              </CK>
            </div>
          </div>
        </div>
      )
    },

    /* 2. w1.logs：明细（五类流水；本年累计=grant 年聚合）+ 空态三句话 */
    'w1.logs': () => {
      if (!data) return null
      return (
        <>
          <SecH
            title={<CK k="w1.logsTitle">{mc('w1.logsTitle')}</CK>}
            more={<CK k="w1.yearTotal">{mc('w1.yearTotal', { amount: yuanOf(data.yearGrantFen) })}</CK>}
          />
          {data.logs.length === 0 ? (
            <EmptyC
              title={mc('w1.emptyTitle')}
              desc={mc('w1.emptyDesc')}
              ctaText={mc('w1.emptyCta')}
              onCta={() => navigate('/mall')}
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
        </>
      )
    },

    /* 3. w1.rules：规则明面（红线 5 全量八条；rules. 前缀共享键组件内渲染挂不上 CK 锚，
          照 MemberOpenPage mo.rules 先例如实入册） */
    'w1.rules': () => {
      if (!data) return null
      return (
        <RulesBlock plan={plan} settlementDay={settlementDay} validityDays={validityDays} allPcts={allPcts} />
      )
    },
  }

  return (
    <CanvasLayoutLoader pageKey="rebate" storeId={w1StoreId}>
      <div className="m2" data-testid="member-rebate-page" style={{ minHeight: '100vh' }}>
        {/* 返回=时间序回退，直访兜底=/member（PushBar 既有纪律）；页头不入块册 */}
        <PushBar label={mc('w1.pushLabel')} fallback="/member" />

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="rebate-canvas-preview-note">
              {mc('mc.canvasExampleNote')}
            </p>
          </div>
        ) : null}

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
          /* 块流：三块按有效布局渲染（published 覆盖∪默认序尾补）；默认序下 DOM 结构零差异 */
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
