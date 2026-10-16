/**
 * MemberCardPage · /me/card 会员码屏（Q-01 手持态 · 批次 R11b 视觉批 · 38 号施工令 +
 * 36 号施工示意图 §四 + 34 号设计规范 v2.0）
 *
 * 本批动作：卡面横卡（92 高 §4.8 码屏规格，档色谱 §1.3，档位联动沿用 R11a 真实数据）+
 * 页面骨架按图重构。
 *
 * 客户端体验大批 片 3：码区点亮——membership.myCardToken 真 token 渲码
 * （零新依赖纪律：禁加 qrcode 库，码=文本码 mono 大字，可被 verifyCardToken
 * 核验；5min 时效自动刷新+倒计时；「核验走收银台」注记；占位注记撤）。
 * 非会员态不查不渲（防假功能红线=不画假码）。
 *
 * 保留件（四铁律③不丢功能入口）：次卡余额（真实 pass.mine）入 m2 卡；
 * 权益对照不再重复（入口=/member 权益墙+规则明面、/member/open 对比弹层，三处同源）。
 *
 * 画布化（产品-1010 画布全屏批 片 3 · 会员域扫尾）：五块入册（q1.cardFace/q1.code/
 * q1.guide/q1.pass/q1.footer），块序/显隐=useCanvasLayout('memberCard')（published→
 * 注册表默认序尾补，空=Q1_DEFAULT_ORDER 兜底）；文案键挂 CK(data-copy-key) 点选反查锚
 * （CardFace 的 priceText/claimText 与内部 logo 为 string props 挂不上锚，如实入册注记；
 * 码=实时 token 数据不画布化，码区只做文案键）；?canvasPreview=1 探针=水印注记行
 * （mc.canvasExampleNote）；店锚=?canvasStore= 预览店锚 > 记忆门店 > 就近首店（MePage
 * 同口径）。PushBar 页头不入块册置块流外；块内逻辑/签发链路零改动，data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { mc } from '../components/member/copy'
import { CardFace, PushBar, TipCard, tierClaimOf, type V2Plan } from '../components/member/v2'
import { readLastBooking } from '@/lib/bookingPrefill'

/** 码文本分组成 4 字簇（mono 大字可核对；token 原文不动） */
function chunkToken(token: string): string {
  return token.replace(/(.{4})/g, '$1 ').trim()
}

/** Clipboard API 被拒时用真实选区复制兜底；只有两条路径都失败才允许报错。 */
async function writeTokenToClipboard(token: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(token)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = token
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      return document.execCommand('copy')
    } finally {
      textarea.remove()
    }
  }
}

/** 到期倒计时（mm/ss；到期自动刷新取新 token） */
function useCountdown(expiresAt: Date | string | undefined): { mm: string; ss: string; expired: boolean } {
  const [now, setNow] = useState(() => Date.now())
  const expMs = expiresAt ? new Date(expiresAt).getTime() : 0
  useEffect(() => {
    if (!expMs) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [expMs])
  const left = Math.max(0, Math.floor((expMs - now) / 1000))
  return {
    mm: String(Math.floor(left / 60)).padStart(2, '0'),
    ss: String(left % 60).padStart(2, '0'),
    expired: !!expMs && left <= 0,
  }
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const Q1_DEFAULT_ORDER = ['q1.cardFace', 'q1.code', 'q1.guide', 'q1.pass', 'q1.footer'] as const

export default function MemberCardPage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const navigate = useNavigate()

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    enabled: !!user,
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })
  const passQ = useQuery({
    queryKey: ['pass', 'mine'],
    queryFn: () => trpc.pass.mine.query(),
    enabled: !!user,
  })

  const m = myQ.data?.membership ?? null
  const plan = (plansQ.data?.plans as V2Plan[] | undefined)?.find((p) => p.planKey === m?.planKey) ?? null
  const passes = passQ.data ?? []
  const totalRemain = passes.reduce((s, p) => s + p.remainTimes, 0)

  /* 片 3：会员码真 token（server 契约=myCardToken **mutation** 签发，时效 5min；
     进屏即签发 + 到期/每 5min 自动重签；非会员不签不渲，防假功能红线=不画假码） */
  const tokenM = useMutation({
    mutationFn: () => trpc.membership.myCardToken.mutate(),
  })
  const { mutate: issueToken } = tokenM
  const issue = useCallback(() => issueToken(), [issueToken])
  const isMember = !!user && !!m
  useEffect(() => {
    if (!isMember) return
    issue()
    const t = window.setInterval(issue, 5 * 60_000)
    return () => window.clearInterval(t)
  }, [isMember, issue])
  const countdown = useCountdown(tokenM.data?.expiresAt)
  const [copyResult, setCopyResult] = useState<{ status: 'idle' | 'copied' | 'error'; token: string | null }>({ status: 'idle', token: null })
  const copyToken = async () => {
    const token = tokenM.data?.token
    if (!token) return
    try {
      const ok = await writeTokenToClipboard(token)
      setCopyResult({ status: ok ? 'copied' : 'error', token })
    } catch {
      setCopyResult({ status: 'error', token })
    }
  }
  const copyStatus = copyResult.token === tokenM.data?.token && !countdown.expired ? copyResult.status : 'idle'
  /* 到期即换新码（双保险：5min 定时 + 到期触发） */
  useEffect(() => {
    if (countdown.expired) issue()
  }, [countdown.expired, issue])

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
  const q1StoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'memberCard')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : Q1_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('memberCard', q1StoreId, registryBlocks)

  /* ---- 五块渲染器（块内逻辑与改造前逐字一致；文案键挂 CK 点选反查锚） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. q1.cardFace：卡面横卡（92 高码屏规格；非会员→注册用户卡面引导态） */
    'q1.cardFace': () => (
      <CardFace
        planKey={m?.planKey ?? 'plan_weiguang'}
        priceText={
          m
            ? plan?.free
              ? mc('card.freePrice')
              : mc('card.priceYear', { price: ((plan?.priceFen ?? 0) / 100).toFixed(0) })
            : mc('q1.nonMemberPrice')
        }
        claimText={m ? tierClaimOf(m.planKey) : mc('q1.nonMemberClaim')}
        height={92}
        nameSize={19}
        testId="membercard-tier"
      />
    ),

    /* 2. q1.code：码区（片 3 点亮：真 token 渲码——文本码 mono 大字，零新依赖；
          5min 时效自动刷新+倒计时；核验走收银台 verifyCardToken；码值=实时数据不抽键） */
    'q1.code': () => (
      <div className="m2-qrwrap" style={{ marginTop: 14 }} data-testid="membercard-qr">
        {m ? (
          tokenM.isPending && !tokenM.data ? (
            <LoadingBlock lines={2} />
          ) : tokenM.isError && !tokenM.data ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12.5, fontWeight: 700 }}><CK k="q1.tokenFail">{mc('q1.tokenFail')}</CK></p>
              <button
                type="button"
                className="m2-link"
                data-testid="membercard-token-retry"
                style={{ marginTop: 6 }}
                onClick={issue}
              >
                <CK k="q1.tokenRetry">{mc('q1.tokenRetry')}</CK>
              </button>
            </div>
          ) : tokenM.data ? (
            <>
              <p style={{ fontSize: 12.5, fontWeight: 700 }}><CK k="q1.tokenTitle">{mc('q1.tokenTitle')}</CK></p>
              {/* 文本码（mono 大字分簇，可被收银台 verifyCardToken 核验；到期即换新码） */}
              <p
                className="m2-mono"
                data-testid="membercard-token"
                style={{
                  marginTop: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  wordBreak: 'break-all',
                  lineHeight: 1.9,
                }}
              >
                {chunkToken(tokenM.data.token)}
              </p>
              <p className="m2-note" style={{ marginTop: 8 }}>
                <CK k="q1.refreshNote">{mc('q1.refreshNote', { mm: countdown.mm, ss: countdown.ss })}</CK>
              </p>
              <p className="m2-mono" style={{ marginTop: 6, fontSize: 9, color: 'var(--v2muted)' }}>
                <CK k="q1.verifyNote">{mc('q1.verifyNote')}</CK>
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <button type="button" className="m2-link" data-testid="membercard-copy" onClick={copyToken}>
                  <CK k="q1.copyToken">{mc('q1.copyToken')}</CK>
                </button>
                {copyStatus !== 'idle' ? (
                  <span className="m2-note" data-testid="membercard-copy-status" role="status" aria-live="polite">
                    {copyStatus === 'copied' ? <CK k="q1.copied">{mc('q1.copied')}</CK> : <CK k="q1.copyFailed">{mc('q1.copyFailed')}</CK>}
                  </span>
                ) : null}
              </div>
            </>
          ) : null
        ) : (
          <p className="m2-note"><CK k="q1.nonMemberGuide">{mc('q1.nonMemberGuide')}</CK></p>
        )}
      </div>
    ),

    /* 3. q1.guide：非会员引导条+开通入口（注册用户免费一键开 → /member/open） */
    'q1.guide': () => {
      if (m) return null
      return (
        <>
          <TipCard>
            <CK k="q1.nonMemberGuide">{mc('q1.nonMemberGuide')}</CK>
          </TipCard>
          <button
            type="button"
            className="m2-btn-primary m2-press"
            style={{ marginTop: 16 }}
            data-testid="membercard-guide-link"
            onClick={() => navigate('/member/open')}
          >
            <CK k="q1.nonMemberCta">{mc('q1.nonMemberCta')}</CK>
          </button>
        </>
      )
    },

    /* 4. q1.pass：次卡余额（真实 pass.mine，入口保留件） */
    'q1.pass': () => (
      <div className="m2-card" style={{ marginTop: 14, padding: '16px 18px' }} data-testid="member-pass-balance">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}><CK k="q1.passTitle">{mc('q1.passTitle')}</CK></span>
          <span className="m2-mono" style={{ fontSize: 17, fontWeight: 700 }} data-testid="member-pass-total">
            {totalRemain} <small style={{ fontSize: 10, color: 'var(--v2muted)', fontWeight: 400 }}><CK k="q1.passUnit">{mc('q1.passUnit')}</CK></small>
          </span>
        </div>
        {passQ.isPending ? (
          <LoadingBlock lines={1} />
        ) : passes.length > 0 ? (
          <div style={{ marginTop: 6 }}>
            {passes.map((p) => (
              <div className="m2-rowx" key={p.id}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.storeName ?? mc('q1.passStoreFallback')}</span>
                <span className="m2-mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--v2muted)' }}>
                  <CK k="q1.passRemain">{mc('q1.passRemain', { remain: p.remainTimes, total: p.totalTimes })}</CK>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="m2-note" style={{ marginTop: 6 }}>
            <CK k="q1.passEmpty">{mc('q1.passEmpty')}</CK>
          </p>
        )}
      </div>
    ),

    /* 5. q1.footer：mono 品牌注脚配重（PR-5 UX P3-2：下半屏过空——内容组上移+品牌注脚） */
    'q1.footer': () => (
      <div
        className="m2-mono"
        style={{ marginTop: 26, textAlign: 'center', fontSize: 9, letterSpacing: '.3em', color: 'var(--v2muted)' }}
      >
        <CK k="card.logo">{mc('card.logo')}</CK>
      </div>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="memberCard" storeId={q1StoreId}>
      <div className="m2 m2--vi" data-testid="member-card-page" style={{ minHeight: '100vh' }}>
        {/* 返回=时间序回退，直访兜底=/member（PushBar 既有纪律）；页头不入块册 */}
        <PushBar label={mc('q1.pushLabel')} fallback="/member" />

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="membercard-canvas-preview-note">
              {mc('mc.canvasExampleNote')}
            </p>
          </div>
        ) : null}

        {myQ.isPending || plansQ.isPending ? (
          <div className="m2-pad" style={{ marginTop: 24 }}>
            <LoadingBlock lines={3} />
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
          /* 块流：五块按有效布局渲染（published 覆盖∪默认序尾补）；默认序下 DOM 结构零差异 */
          <div className="m2-pad" style={{ marginTop: 8, paddingBottom: 60 }}>
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
