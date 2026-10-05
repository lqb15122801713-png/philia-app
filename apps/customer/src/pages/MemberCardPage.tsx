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
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { mc } from '../components/member/copy'
import { CardFace, PushBar, TipCard, tierClaimOf, type V2Plan } from '../components/member/v2'

/** 码文本分组成 4 字簇（mono 大字可核对；token 原文不动） */
function chunkToken(token: string): string {
  return token.replace(/(.{4})/g, '$1 ').trim()
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
  /* 到期即换新码（双保险：5min 定时 + 到期触发） */
  useEffect(() => {
    if (countdown.expired) issue()
  }, [countdown.expired, issue])

  return (
    <div className="m2" data-testid="member-card-page" style={{ minHeight: '100vh' }}>
      <PushBar label={mc('q1.pushLabel')} fallback="/member" />

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
        <div className="m2-pad" style={{ marginTop: 8, paddingBottom: 60 }}>
          {/* 卡面横卡（92 高码屏规格；非会员→微光卡面引导态） */}
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

          {/* 码区（片 3 点亮：真 token 渲码——文本码 mono 大字，零新依赖；
              5min 时效自动刷新+倒计时；核验走收银台 verifyCardToken） */}
          <div className="m2-qrwrap" style={{ marginTop: 14 }} data-testid="membercard-qr">
            {m ? (
              tokenM.isPending && !tokenM.data ? (
                <LoadingBlock lines={2} />
              ) : tokenM.isError && !tokenM.data ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700 }}>{mc('q1.tokenFail')}</p>
                  <button
                    type="button"
                    className="m2-link"
                    data-testid="membercard-token-retry"
                    style={{ marginTop: 6 }}
                    onClick={issue}
                  >
                    {mc('q1.tokenRetry')}
                  </button>
                </div>
              ) : tokenM.data ? (
                <>
                  <p style={{ fontSize: 12.5, fontWeight: 700 }}>{mc('q1.tokenTitle')}</p>
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
                    {mc('q1.refreshNote', { mm: countdown.mm, ss: countdown.ss })}
                  </p>
                  <p className="m2-mono" style={{ marginTop: 6, fontSize: 9, color: 'var(--v2muted)' }}>
                    {mc('q1.verifyNote')}
                  </p>
                </>
              ) : null
            ) : (
              <p className="m2-note">{mc('q1.nonMemberGuide')}</p>
            )}
          </div>

          {/* 非会员引导（微光免费一键开 → /member/open） */}
          {!m ? (
            <TipCard>
              {mc('q1.nonMemberGuide')}
            </TipCard>
          ) : null}

          {/* 次卡余额（真实 pass.mine，入口保留件） */}
          <div className="m2-card" style={{ marginTop: 14, padding: '16px 18px' }} data-testid="member-pass-balance">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{mc('q1.passTitle')}</span>
              <span className="m2-mono" style={{ fontSize: 17, fontWeight: 700 }} data-testid="member-pass-total">
                {totalRemain} <small style={{ fontSize: 10, color: 'var(--v2muted)', fontWeight: 400 }}>{mc('q1.passUnit')}</small>
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
                      {mc('q1.passRemain', { remain: p.remainTimes, total: p.totalTimes })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="m2-note" style={{ marginTop: 6 }}>
                {mc('q1.passEmpty')}
              </p>
            )}
          </div>

          {/* 非会员：开通入口 */}
          {!m ? (
            <button
              type="button"
              className="m2-btn-primary m2-press"
              style={{ marginTop: 16 }}
              data-testid="membercard-guide-link"
              onClick={() => navigate('/member/open')}
            >
              {mc('q1.nonMemberCta')}
            </button>
          ) : null}

          {/* PR-5 UX P3-2：mono 注脚配重（下半屏过空——内容组上移+品牌注脚） */}
          <div
            className="m2-mono"
            style={{ marginTop: 26, textAlign: 'center', fontSize: 9, letterSpacing: '.3em', color: 'var(--v2muted)' }}
          >
            {mc('card.logo')}
          </div>
        </div>
      )}
    </div>
  )
}
