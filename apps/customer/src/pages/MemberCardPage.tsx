/**
 * MemberCardPage · /me/card 会员码屏（Q-01 手持态 · 批次 R11b 视觉批 · 38 号施工令 +
 * 36 号施工示意图 §四 + 34 号设计规范 v2.0）
 *
 * 本批动作：卡面横卡（92 高 §4.8 码屏规格，档色谱 §1.3，档位联动沿用 R11a 真实数据）+
 * 页面骨架按图重构。
 *
 * ⚠️ 码区=诚实占位（开工回执疑点 1，待裁定）：server 无会员码签发端点（R11a 未落
 * 「扫会员码」，收银台识别=手机号降级在跑）——按「防假功能/禁止第三态」红线不画假码，
 * 码区明文提示现状口径（报手机号即享权益）。裁定到后换装真码（接口预留位=本页 qrwrap）。
 *
 * 保留件（四铁律③不丢功能入口）：次卡余额（真实 pass.mine）入 m2 卡；
 * 权益对照不再重复（入口=/member 权益墙+规则明面、/member/open 对比弹层，三处同源）。
 */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { mc } from '../components/member/copy'
import { CardFace, PushBar, TipCard, tierClaimOf, type V2Plan } from '../components/member/v2'

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

  return (
    <div className="m2" data-testid="member-card-page" style={{ minHeight: '100vh' }}>
      <PushBar label={mc('q1.pushLabel')} to="/member" />

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
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
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

          {/* 码区（诚实占位，待疑点 1 裁定；防假功能红线=不画假码） */}
          <div className="m2-qrwrap" style={{ marginTop: 14 }} data-testid="membercard-qr-pending">
            <p style={{ fontSize: 12.5, fontWeight: 700 }}>{mc('q1.pendingTitle')}</p>
            <p className="m2-note" style={{ marginTop: 6 }}>
              {mc('q1.pendingBody')}
            </p>
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
        </div>
      )}
    </div>
  )
}
