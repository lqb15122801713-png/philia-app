/**
 * DeactivatePage · /me/settings/deactivate 注销账号（补缺大批片 2 · 账户安全域）
 *
 * 流：deactivationPrecheck 前置校验 →
 * - 阻断态（deactivatable=false）：逐行列明阻断项（label+count mono）+「去完成 ›」
 *   引导回 /appointments 或 /mall/orders + PushBar 返回出口（R8 具体子问题）；
 * - 可注销：影响明示卡三项逐项勾选（回馈金清零/会员档终止/宠物档案删除，每项一句
 *   后果说明）+「订单与留痕依法保留，注销≠删数据」+「门店复核生效」+ R13「为什么
 *   门店复核」→ 二次确认弹层（复述三影响+不可撤销）→ requestDeactivation →
 *   成功态（申请已提交 + deactivationStatus.inflight 轮询区）；
 * - 在途/已决：inflight 卡（审核中+撤回 cancelDeactivation）/ rejected 卡
 *   （decideNote 可见）/ approved=实际 401 跳登录（防御渲染）。
 * 回退链：设置→注销→返回=来处（PushBar 时间序回退，直访兜底 /me/settings）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { ConfirmDialog, fmtDateTime, useAccountToast } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { acc } from '../copy/account'

type ImpactKey = 'rebate' | 'member' | 'pets'

const IMPACTS: Array<{ key: ImpactKey; title: string; desc: string }> = [
  { key: 'rebate', title: acc('deact.impactRebate'), desc: acc('deact.impactRebateDesc') },
  { key: 'member', title: acc('deact.impactMember'), desc: acc('deact.impactMemberDesc') },
  { key: 'pets', title: acc('deact.impactPets'), desc: acc('deact.impactPetsDesc') },
]

/** 阻断项引导落点：预约→/appointments；订单/在途退款→/mall/orders */
const BLOCKER_TARGET: Record<string, string> = {
  appointment: '/appointments',
  order: '/mall/orders',
  refund: '/mall/orders',
}

/** 影响勾选项（role=checkbox 卡行） */
function ImpactRow({
  checked,
  onToggle,
  title,
  desc,
  testId,
}: {
  checked: boolean
  onToggle: () => void
  title: string
  desc: string
  testId?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-testid={testId}
      onClick={onToggle}
      className="flex w-full items-start gap-3 border-t border-line-divider px-4 py-3.5 text-left first:border-t-0"
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-[20px] w-[20px] flex-none items-center justify-center rounded-[6px] border text-[12px] font-bold ${
          checked ? 'border-ink bg-ink text-canvas' : 'border-line-strong bg-card text-transparent'
        }`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-caption leading-[1.7] text-ink-secondary">{desc}</span>
      </span>
    </button>
  )
}

export default function DeactivatePage() {
  const navigate = useNavigate()
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useAccountToast()
  const [checked, setChecked] = useState<Record<ImpactKey, boolean>>({ rebate: false, member: false, pets: false })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const precheckQ = useQuery({
    queryKey: ['authSecurity', 'deactivationPrecheck'],
    queryFn: () => trpc.authSecurity.deactivationPrecheck.query(),
  })
  const statusQ = useQuery({
    queryKey: ['authSecurity', 'deactivationStatus'],
    queryFn: () => trpc.authSecurity.deactivationStatus.query(),
    /* 在途期间 30s 轮询（审批通过后接口 401 → RequireAuth 接管跳登录） */
    refetchInterval: (q) => (q.state.data?.inflight ? 30_000 : false),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['authSecurity', 'deactivationPrecheck'] })
    void queryClient.invalidateQueries({ queryKey: ['authSecurity', 'deactivationStatus'] })
  }

  const submitM = useMutation({
    mutationFn: () =>
      trpc.authSecurity.requestDeactivation.mutate({ impacts: ['rebate', 'member', 'pets'] }),
    onSuccess: () => {
      setConfirmOpen(false)
      setJustSubmitted(true)
      setErrMsg(null)
      invalidate()
    },
    onError: (err) => {
      setConfirmOpen(false)
      setErrMsg(err.message || acc('deact.submitFail'))
    },
  })

  const cancelM = useMutation({
    mutationFn: () => trpc.authSecurity.cancelDeactivation.mutate(),
    onSuccess: () => {
      setJustSubmitted(false)
      showToast(acc('deact.cancelOk'))
      invalidate()
    },
    onError: (err) => showToast(err.message || acc('deact.cancelFail')),
  })

  const allChecked = IMPACTS.every((i) => checked[i.key])
  const inflight = statusQ.data?.inflight ?? null
  const latest = statusQ.data?.latest ?? null

  const pending = precheckQ.isPending || statusQ.isPending
  const loadErr = precheckQ.isError || statusQ.isError
  const errDetail =
    (precheckQ.error instanceof Error ? precheckQ.error.message : null) ??
    (statusQ.error instanceof Error ? statusQ.error.message : null)

  return (
    <div className="m2" data-testid="deactivate-page" style={{ minHeight: '100vh' }}>
      <PushBar label={acc('deact.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{acc('deact.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        {pending ? (
          <LoadingBlock lines={4} />
        ) : loadErr ? (
          /* R8 异常态：具体子问题（接口报错信息）+ 重试 */
          <ErrorState
            message={`${acc('deact.loadFail')}${errDetail ? `（${errDetail}）` : ''}`}
            onRetry={() => {
              void precheckQ.refetch()
              void statusQ.refetch()
            }}
          />
        ) : (
          <div className="flex flex-col">
            {/* 提交成功横幅（R9 操作反馈） */}
            {justSubmitted ? (
              <div className="m2-card mb-4 border-ink p-4" data-testid="deact-success">
                <div className="text-body font-bold text-ink">{acc('deact.successTitle')}</div>
                <div className="mt-1 text-caption leading-[1.8] text-ink-secondary">{acc('deact.successBody')}</div>
              </div>
            ) : null}

            {/* 在途卡（轮询区）：审核中 + 撤回 */}
            {inflight ? (
              <div className="m2-card p-4" data-testid="deact-inflight">
                <div className="flex items-center justify-between">
                  <div className="text-body font-bold text-ink">{acc('deact.inflightTitle')}</div>
                  <span className="rounded-chip bg-brand-primary px-[7px] py-0.5 text-caption-xs font-semibold text-ink">
                    {acc('appeal.statusSubmitted')}
                  </span>
                </div>
                <div className="m2-mono mt-1.5 text-[10px] text-ink-secondary">
                  {acc('deact.submittedAt', { time: fmtDateTime(inflight.createdAt) })}
                </div>
                <p className="mt-2 text-caption leading-[1.8] text-ink-secondary">{acc('deact.inflightBody')}</p>
                <button
                  type="button"
                  data-testid="deact-cancel"
                  disabled={cancelM.isPending}
                  onClick={() => cancelM.mutate()}
                  className="mt-3 w-full rounded-full border border-line py-2.5 text-body-sm text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
                >
                  {cancelM.isPending ? acc('deact.cancelPending') : acc('deact.cancel')}
                </button>
              </div>
            ) : latest?.status === 'approved' ? (
              /* 防御渲染：approved 后全接口 401，RequireAuth 会接管跳登录 */
              <div className="m2-card p-4" data-testid="deact-approved">
                <p className="text-body text-ink-secondary">{acc('deact.approvedNote')}</p>
              </div>
            ) : (
              <>
                {/* 已决驳回卡（decideNote 客户端可见） */}
                {latest?.status === 'rejected' ? (
                  <div className="m2-card mb-4 p-4" data-testid="deact-rejected">
                    <div className="flex items-center justify-between">
                      <div className="text-body font-bold text-ink">{acc('deact.rejectedTitle')}</div>
                      <span className="rounded-chip bg-danger-light px-[7px] py-0.5 text-caption-xs font-semibold text-danger-deep">
                        {acc('appeal.statusRejected')}
                      </span>
                    </div>
                    {latest.decideNote ? (
                      <p className="mt-2 text-caption leading-[1.8] text-ink-secondary">
                        {acc('deact.rejectedPrefix')}：{latest.decideNote}
                      </p>
                    ) : null}
                    <div className="m2-mono mt-1.5 text-[10px] text-ink-secondary">
                      {fmtDateTime(latest.decidedAt)}
                    </div>
                  </div>
                ) : null}

                {!precheckQ.data?.deactivatable ? (
                  /* 阻断态：逐行列明阻断项 + 引导出口（R8 具体子问题） */
                  <div data-testid="deact-blocked">
                    <SecH title={acc('deact.blockTitle')} />
                    <div className="m2-card overflow-hidden">
                      <p className="px-4 pt-3.5 text-caption leading-[1.8] text-ink-secondary">
                        {acc('deact.blockBody')}
                      </p>
                      {(precheckQ.data?.blockers ?? []).map((b) => (
                        <div
                          key={b.kind}
                          className="flex items-center gap-3 border-t border-line-divider px-4 py-3.5"
                          data-testid={`deact-blocker-${b.kind}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-body font-semibold text-ink">{b.label}</div>
                            <div className="m2-mono mt-0.5 text-[10px] text-ink-secondary">× {b.count}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(BLOCKER_TARGET[b.kind] ?? '/appointments')}
                            className="flex-none rounded-full bg-ink px-4 py-2 text-caption text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
                          >
                            {acc('deact.blockGo')}
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="m2-note mt-3">{acc('deact.blockNote')}</p>
                  </div>
                ) : (
                  /* 可注销：影响明示卡三勾选 + 明示注记 + R13 + 二次确认 */
                  <div data-testid="deact-form">
                    <SecH title={acc('deact.impactTitle')} />
                    <div className="m2-card overflow-hidden">
                      {IMPACTS.map((i) => (
                        <ImpactRow
                          key={i.key}
                          title={i.title}
                          desc={i.desc}
                          checked={checked[i.key]}
                          onToggle={() => setChecked((c) => ({ ...c, [i.key]: !c[i.key] }))}
                          testId={`deact-impact-${i.key}`}
                        />
                      ))}
                    </div>

                    <div className="m2-rules mt-3">
                      <ul>
                        <li>{acc('deact.keepNote')}</li>
                        <li>{acc('deact.reviewNote')}</li>
                        <li>{acc('deact.whyReview')}</li>
                      </ul>
                    </div>

                    {errMsg ? (
                      <p role="alert" className="mt-3 text-caption text-danger-deep" data-testid="deact-error">
                        {errMsg}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      data-testid="deact-submit"
                      disabled={!allChecked || submitM.isPending}
                      onClick={() => setConfirmOpen(true)}
                      className="mt-4 w-full rounded-full bg-danger py-3 text-body font-semibold text-destructive-foreground transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
                    >
                      {acc('deact.ctaSubmit')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {confirmOpen ? (
        <ConfirmDialog
          title={acc('deact.confirmTitle')}
          body={acc('deact.confirmBody')}
          okText={submitM.isPending ? acc('deact.submitting') : acc('deact.confirmOk')}
          cancelText={acc('deact.confirmCancel')}
          pending={submitM.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => submitM.mutate()}
          okTestId="deact-confirm-ok"
        />
      ) : null}
      {toastEl}
    </div>
  )
}
