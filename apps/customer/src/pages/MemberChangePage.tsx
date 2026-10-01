/**
 * MemberChangePage · /member/change 到期换档预约页（补缺批片 3 会员域 · 2026-10-01；
 * 申报锚点=「预约下期档位」；路由已申报 check-nav-closure / smoke-routes）
 *
 * 数据源=membership.my（membership/nextPlanKey/nextPlanSetAt/changeWindowDays 入口判定字段）
 * + membership.plans（四档配置）。窗口判定=到期前 changeWindowDays 天（读 my.changeWindowDays
 * 端口透出 + membership.expiresAt）。
 *
 * 三态：窗口外=说明卡（开放口径+到期日 mono）不报错；窗口内未预约=档卡选择
 * （含低档=到期降级通道，期内不降级不变）+ scheduleChange 提交；已预约=预约单卡
 * （目标档+预约时刻 mono+「到期按新档续费（到店办理）」+ 取消预约 cancelScheduleChange）。
 * 非会员/免费档 = 说明卡给真实出口（非会员→/member/open；免费档→/member/upgrade 升档通道）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { friendlyError, usePhiliaClient, useToast } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { mc } from '../components/member/copy'
import {
  AppHead,
  PushBar,
  SecH,
  TipCard,
  tierNameOf,
  yuanOf,
  type V2Plan,
} from '../components/member/v2'

const DAY_MS = 24 * 60 * 60 * 1000

export default function MemberChangePage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 3200 })
  const navigate = useNavigate()

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['membership'] })
  }
  const scheduleM = useMutation({
    mutationFn: (targetPlanKey: string) => trpc.membership.scheduleChange.mutate({ targetPlanKey }),
    onSuccess: () => {
      showToast(mc('chg.toastOk'), 'info')
      invalidate()
    },
    onError: (err) => showToast(friendlyError(err, mc('chg.actionFail')), 'error'),
  })
  const cancelM = useMutation({
    mutationFn: () => trpc.membership.cancelScheduleChange.mutate(),
    onSuccess: () => {
      showToast(mc('chg.toastCancel'), 'info')
      invalidate()
    },
    onError: (err) => showToast(friendlyError(err, mc('chg.actionFail')), 'error'),
  })

  const m = myQ.data?.membership ?? null
  const plan = myQ.data?.plan ?? null
  const plans = (plansQ.data?.plans ?? []) as V2Plan[]
  const windowDays = myQ.data?.changeWindowDays ?? 30
  const nextPlanKey = myQ.data?.nextPlanKey ?? null
  const nextPlanSetAt = myQ.data?.nextPlanSetAt ?? null

  return (
    <div className="m2" data-testid="member-change-page" style={{ minHeight: '100vh' }}>
      {toastEl}
      {/* 返回=时间序回退 navigate(-1)，直访兜底=/member（PushBar 既有纪律） */}
      <PushBar label={mc('chg.pushLabel')} fallback="/member" />
      <AppHead title={mc('chg.headTitle')} no={mc('chg.headNo')} />

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
      ) : !m ? (
        /* 非会员直访：说明卡不报错（不跳走防弹球，给真实出口） */
        <div className="m2-pad" style={{ marginTop: 14 }}>
          <div className="m2-card" data-testid="change-nonmember" style={{ padding: '20px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{mc('chg.nonMemberTitle')}</div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button type="button" className="m2-link" onClick={() => navigate('/member/open')}>
                {mc('chg.nonMemberCta')}
              </button>
            </div>
          </div>
        </div>
      ) : plan?.free ? (
        /* 免费档：无到期换档语义（server 同口径拒单），指引走升档通道 */
        <div className="m2-pad" style={{ marginTop: 14 }}>
          <div className="m2-card" data-testid="change-free" style={{ padding: '20px 18px' }}>
            <p className="m2-note" style={{ marginTop: 0 }}>{mc('chg.freeNote')}</p>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button type="button" className="m2-link" onClick={() => navigate('/member/upgrade')}>
                {mc('chg.freeCta')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ChangeBody
          planKey={m.planKey}
          expiresAt={new Date(m.expiresAt)}
          plans={plans}
          windowDays={windowDays}
          nextPlanKey={nextPlanKey}
          nextPlanSetAt={nextPlanSetAt ? new Date(nextPlanSetAt) : null}
          schedulePending={scheduleM.isPending}
          cancelPending={cancelM.isPending}
          onSchedule={(k) => scheduleM.mutate(k)}
          onCancel={() => cancelM.mutate()}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ChangeBody({
  planKey,
  expiresAt,
  plans,
  windowDays,
  nextPlanKey,
  nextPlanSetAt,
  schedulePending,
  cancelPending,
  onSchedule,
  onCancel,
}: {
  planKey: string
  expiresAt: Date
  plans: V2Plan[]
  windowDays: number
  nextPlanKey: string | null
  nextPlanSetAt: Date | null
  schedulePending: boolean
  cancelPending: boolean
  onSchedule: (planKey: string) => void
  onCancel: () => void
}) {
  /* 窗口判定快照=挂载时点（server scheduleChange 真窗口硬校验兜底；渲染纯度 lint 口径） */
  const [nowMs] = useState(() => Date.now())
  const daysLeft = Math.ceil((expiresAt.getTime() - nowMs) / DAY_MS)
  const windowOpen = daysLeft <= windowDays
  const expireDate = expiresAt.toLocaleDateString('zh-CN')
  /* 目标档=除当前档外全档（含低档=到期降级通道；同档 server 拒「无需预约」故不透出） */
  const targets = plans.filter((p) => p.planKey !== planKey)

  return (
    <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
      {nextPlanKey ? (
        /* 已预约态：预约单卡（目标档+预约时刻 mono+执行说明+取消预约钮） */
        <div className="m2-card" data-testid="change-scheduled-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{mc('chg.scheduledTitle')}</div>
          <div style={{ fontFamily: 'var(--v2serif)', fontSize: 21, fontWeight: 900, marginTop: 8 }}>
            {tierNameOf(nextPlanKey)}会员
          </div>
          <div className="m2-mono" style={{ marginTop: 6, fontSize: 10, color: 'var(--v2muted)' }}>
            {mc('chg.scheduledAtLabel')} {nextPlanSetAt?.toLocaleString('zh-CN', { hour12: false }) ?? '—'}
          </div>
          <div className="m2-mono" style={{ marginTop: 4, fontSize: 10, color: 'var(--v2muted)' }}>
            {mc('chg.expireLabel')} {expireDate}
          </div>
          <p className="m2-note" style={{ marginTop: 10 }}>
            {mc('chg.scheduledLine', { plan: tierNameOf(nextPlanKey) })}
          </p>
          <p className="m2-note" style={{ marginTop: 6 }}>{mc('chg.execNote')}</p>
          <button
            type="button"
            data-testid="change-cancel"
            className="m2-press"
            disabled={cancelPending}
            style={{ marginTop: 14, width: '100%', padding: '13px 22px', borderRadius: 18, border: '1px solid var(--v2line)', background: 'var(--v2card)', color: 'var(--v2ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            onClick={onCancel}
          >
            {cancelPending ? mc('chg.cancelling') : mc('chg.cancelCta')}
          </button>
        </div>
      ) : !windowOpen ? (
        /* 窗口外：说明卡（开放口径+到期日 mono）不报错 */
        <div data-testid="change-window-closed">
          <TipCard>{mc('chg.windowClosed', { days: windowDays })}</TipCard>
          <div className="m2-card" style={{ marginTop: 14, padding: '16px 18px' }}>
            <div className="m2-mono" style={{ fontSize: 11, color: 'var(--v2muted)' }}>
              {mc('chg.expireLabel')} {expireDate}
            </div>
          </div>
        </div>
      ) : (
        /* 窗口内未预约：档卡选择（含低档）+ 预约提交 */
        <>
          <TipCard>{mc('chg.windowOpen', { days: windowDays })}</TipCard>
          <div className="m2-mono" style={{ marginTop: 10, fontSize: 10, color: 'var(--v2muted)', padding: '0 2px' }}>
            {mc('chg.expireLabel')} {expireDate}
          </div>
          <SecH title={mc('chg.targetTitle')} />
          {targets.map((p) => (
            <div
              className="m2-card"
              data-testid={`change-plan-${p.planKey}`}
              key={p.planKey}
              style={{ marginBottom: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{tierNameOf(p.planKey)}会员</div>
                <div className="m2-mono" style={{ marginTop: 3, fontSize: 10, color: 'var(--v2muted)' }}>
                  {p.free ? mc('chg.priceFree') : mc('chg.priceYear', { price: yuanOf(p.priceFen) })}
                </div>
              </div>
              <button
                type="button"
                data-testid={`change-submit-${p.planKey}`}
                className="m2-press"
                disabled={schedulePending}
                style={{ borderRadius: 99, border: '1px solid var(--v2line)', background: 'var(--v2card)', padding: '9px 16px', fontSize: 13, fontWeight: 700, color: 'var(--v2ink)', cursor: 'pointer', flex: 'none' }}
                onClick={() => onSchedule(p.planKey)}
              >
                {schedulePending ? mc('chg.submitting') : mc('chg.submitCta', { tier: tierNameOf(p.planKey) })}
              </button>
            </div>
          ))}
          <p className="m2-note" style={{ marginTop: 4 }}>{mc('chg.execNote')}</p>
        </>
      )}
    </div>
  )
}
