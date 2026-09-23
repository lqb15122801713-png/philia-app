/**
 * MemberOpenPage · /member/open 开通会员（批次 R11a 骨架批 · 27 号任务书冻结版 V1.0 §五
 * + docs/r11/R11a-DESIGN.md §五；申报锚点=页面标题「开通会员」）
 *
 * 骨架版口径：功能全通、tokens 工艺、美观不评审（R11b 随设计规范 v2.0 换皮）。
 *
 * 开通流程 ≤3 步（内测期口径，任务书 §〇④：线上支付通道未接入，售卡=到店付）：
 * 1. 选档：四档对照卡（价格/回馈金比例/服务折扣/多宠规则明面，membership.plans 实时读表）；
 *    微光档页内一键开（membership.openFree，免费即时开通，幂等）；
 * 2. 指引：付费档到店付指引（选档摘要 + 到店收银台付款口径 + 多宠附加费明面）；
 * 3. 完成页：微光=开通成功（档位/有效期至，回会员中心）；付费档=到店办理确认页。
 *
 * 已是会员（membership.my 命中）→ 顶部提示条 + 回会员中心（防重复开档；server 侧
 * sell/openFree 均有幂等/拒售兜底）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { friendlyError, useToast } from '@/components/booking/Toast'
import { ErrorState, LoadingBlock, formatDateCn } from '../components/home/common'
import {
  planDiscountText,
  planPetRuleText,
  planPriceText,
  planRebateText,
  planShortName,
  type MemberPlanPublic,
} from '../components/member/plans'

type Step = 'select' | 'guide' | 'done'

/** 步骤标（≤3 步骨架指示，不堆视觉） */
function StepMark({ step }: { step: number }) {
  return (
    <p className="mt-3 text-caption-xs tracking-[0.14em] text-ink-placeholder">
      第 {step} 步 / 共 3 步
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* 第 1 步：选档（四档对照卡；微光页内一键开）                             */
/* ------------------------------------------------------------------ */

function PlanSelectList({
  plans,
  openPending,
  onOpenFree,
  onPick,
}: {
  plans: MemberPlanPublic[]
  openPending: boolean
  onOpenFree: () => void
  onPick: (p: MemberPlanPublic) => void
}) {
  return (
    <ul data-testid="open-plan-list" className="mt-3 flex flex-col gap-3">
      {plans.map((p) => (
        <li key={p.planKey} className="u1-card p-4" data-plan-key={p.planKey}>
          <div className="flex items-baseline gap-2">
            <p className="u1-serif text-body-sm font-semibold">{planShortName(p)}</p>
            <span className="u1-num text-caption text-ink">{planPriceText(p)}</span>
            {p.free ? (
              <span className="ml-auto rounded-chip bg-success-light px-2 py-0.5 text-caption-xs text-success-deep">
                免费
              </span>
            ) : null}
          </div>
          {/* 权益表述明面：档位 label 即配置端口权益文案（红线 5/规则明面） */}
          <p className="mt-1.5 text-caption leading-[1.7] text-ink-secondary">
            回馈金：{planRebateText(p)} · {planDiscountText(p)}
            <br />
            多宠：{planPetRuleText(p)}
          </p>
          <p className="mt-1 text-caption-xs leading-[1.6] text-ink-placeholder">{p.label}</p>
          {p.free ? (
            /* 微光档页内一键开（免费即时开通） */
            <button
              type="button"
              data-testid="open-free-btn"
              onClick={onOpenFree}
              disabled={openPending}
              className="mt-3 w-full rounded-control bg-brand-primary py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.99] disabled:opacity-60"
            >
              {openPending ? '开通中…' : '一键免费开通'}
            </button>
          ) : (
            <button
              type="button"
              data-testid={`open-pick-${p.planKey}`}
              onClick={() => onPick(p)}
              className="mt-3 w-full rounded-control border border-line-strong bg-card py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
            >
              选此档 · 到店开通
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* 第 2 步：付费档到店付指引                                               */
/* ------------------------------------------------------------------ */

function StorePayGuide({
  plan,
  onBack,
  onNext,
}: {
  plan: MemberPlanPublic
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div data-testid="open-store-guide" className="mt-3 flex flex-col gap-4">
      <section className="u1-card p-5">
        <p className="text-caption-xs font-semibold tracking-[0.22em] text-ink-placeholder">
          已选档位
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <h2 className="u1-serif text-title">{planShortName(plan)}会员</h2>
          <span className="u1-num text-caption text-ink">{planPriceText(plan)}</span>
        </div>
        <p className="mt-1.5 text-caption leading-[1.7] text-ink-secondary">
          回馈金：{planRebateText(plan)} · {planDiscountText(plan)}
          <br />
          多宠：{planPetRuleText(plan)}
        </p>
      </section>
      <section className="u1-card p-5">
        <h2 className="text-title">到店付款开通</h2>
        <ul className="mt-2 flex flex-col gap-2 text-caption leading-[1.7] text-ink-secondary">
          <li>1. 到店后告知收银员开通「{planShortName(plan)}会员」，出示会员码或报手机号。</li>
          <li>2. 收银台付款（支持现金/微信/支付宝），多宠家庭第 4 只起按 +¥59/年/只 计入。</li>
          <li>3. 付款成交即开通，有效期 365 天；会员中心与会员码页即时显示你的档位。</li>
        </ul>
        <p className="mt-3 text-caption-xs leading-[1.6] text-ink-placeholder">
          内测期仅支持到店收银台开通；线上支付通道开通后将在本页直接开放。
        </p>
      </section>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-control border border-line-strong bg-card py-[13px] text-body-sm font-semibold text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
        >
          重新选档
        </button>
        <button
          type="button"
          data-testid="open-guide-next"
          onClick={onNext}
          className="flex-1 rounded-control bg-brand-primary py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
        >
          我知道了
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 第 3 步：完成页（微光=已开通；付费档=到店办理确认）                      */
/* ------------------------------------------------------------------ */

function DonePanel({
  opened,
  openedExpiresAt,
  picked,
}: {
  /** 微光一键开结果（null=付费档指引完成） */
  opened: boolean
  openedExpiresAt: Date | null
  picked: MemberPlanPublic | null
}) {
  const navigate = useNavigate()
  return (
    <div data-testid="open-done" className="mt-3 flex flex-col gap-4">
      <section className="u1-card p-5 text-center">
        {opened ? (
          <>
            <p className="u1-serif text-title-lg">微光会员已开通</p>
            <p className="mt-2 text-caption leading-[1.7] text-ink-secondary">
              免费档即时生效
              {openedExpiresAt ? `，有效期至 ${formatDateCn(openedExpiresAt)}` : ''}。
              <br />
              升级萤火/烛光/暖阳可享商品回馈金与服务折扣，到店收银台即可办理。
            </p>
          </>
        ) : (
          <>
            <p className="u1-serif text-title-lg">请到店完成开通</p>
            <p className="mt-2 text-caption leading-[1.7] text-ink-secondary">
              你已选定「{picked ? planShortName(picked) : ''}会员
              {picked ? `（${planPriceText(picked)}）` : ''}」。
              <br />
              内测期请到店收银台付款开通（现金/微信/支付宝），成交即开通、有效期 365 天。
            </p>
          </>
        )}
      </section>
      <button
        type="button"
        data-testid="open-done-back"
        onClick={() => navigate('/member')}
        className="w-full rounded-control bg-brand-primary py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
      >
        回会员中心
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 页面                                                                 */
/* ------------------------------------------------------------------ */

export default function MemberOpenPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast()
  const [step, setStep] = useState<Step>('select')
  const [picked, setPicked] = useState<MemberPlanPublic | null>(null)
  const [openedExpiresAt, setOpenedExpiresAt] = useState<Date | null>(null)
  const [opened, setOpened] = useState(false)

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })

  /* 微光一键开（openFree 幂等；成功直进完成页并作废 membership 缓存） */
  const openFreeM = useMutation({
    mutationFn: () => trpc.membership.openFree.mutate(),
    onSuccess: (r) => {
      setOpened(true)
      setOpenedExpiresAt(r.membership.expiresAt)
      setStep('done')
      showToast(r.idempotent ? '你已是会员' : '微光会员已开通，欢迎加入', 'info')
      void queryClient.invalidateQueries({ queryKey: ['membership'] })
    },
    onError: (err) => showToast(friendlyError(err, '开通失败，请稍后再试')),
  })

  const alreadyMember = !!myQ.data?.membership

  return (
    <div data-testid="member-open-page" className="px-[22px] pb-10 pt-4">
      {toastEl}
      {/* 导航闭环：统一返回条固定回 /member */}
      <PageHeader title="开通会员" to="/member" />

      {/* 已是会员：提示条（档位/有效期真值），不挡流程查看 */}
      {alreadyMember && myQ.data?.membership ? (
        <p className="mt-4 rounded-card bg-success-light px-4 py-3 text-caption leading-[1.7] text-success-deep">
          你已是会员（有效期至 {formatDateCn(myQ.data.membership.expiresAt)}）。
          续费或升级请到店收银台办理。<Link to="/member" className="underline">回会员中心 ›</Link>
        </p>
      ) : null}

      {step === 'select' ? (
        <>
          <StepMark step={1} />
          {plansQ.isPending ? (
            <div className="mt-3">
              <LoadingBlock lines={4} />
            </div>
          ) : plansQ.isError ? (
            <div className="mt-3">
              <ErrorState message="档位信息加载失败" onRetry={() => void plansQ.refetch()} />
            </div>
          ) : (
            <PlanSelectList
              plans={plansQ.data.plans}
              openPending={openFreeM.isPending}
              onOpenFree={() => openFreeM.mutate()}
              onPick={(p) => {
                setPicked(p)
                setStep('guide')
              }}
            />
          )}
        </>
      ) : step === 'guide' && picked ? (
        <>
          <StepMark step={2} />
          <StorePayGuide plan={picked} onBack={() => setStep('select')} onNext={() => setStep('done')} />
        </>
      ) : (
        <>
          <StepMark step={3} />
          <DonePanel opened={opened} openedExpiresAt={openedExpiresAt} picked={picked} />
        </>
      )}
    </div>
  )
}
