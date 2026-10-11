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
 *
 * 画布化（产品-1010 片 3 末片 · 账户域重屏批）：四块入册
 * （deact.head/status/blocked/form——五态互斥机页只给整块显隐+文案，不给块内拖排），
 * 块序/显隐=useCanvasLayout('deactivate')（published→注册表默认序尾补，空=默认序兜底常量；
 * 序=改造前 JSX 序：状态卡在阻断/表单之前）。文案键行内可改=CK 点选反查锚；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。二次确认弹层不入块流（页尾挂载）。
 * 块内逻辑（precheck/status 轮询/requestDeactivation/cancelDeactivation）零改动，
 * data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { ConfirmDialog, fmtDateTime, useAccountToast } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { acc } from '../copy/account'
import { readLastBooking } from '@/lib/bookingPrefill'

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const DEACT_DEFAULT_ORDER = ['deact.head', 'deact.status', 'deact.blocked', 'deact.form'] as const

type ImpactKey = 'rebate' | 'member' | 'pets'

/* 影响明示三项（文案键渲染期取值——画布文案 patch 实时生效，不做模块级冻结） */
const IMPACTS: Array<{ key: ImpactKey; titleKey: 'deact.impactRebate' | 'deact.impactMember' | 'deact.impactPets'; descKey: 'deact.impactRebateDesc' | 'deact.impactMemberDesc' | 'deact.impactPetsDesc' }> = [
  { key: 'rebate', titleKey: 'deact.impactRebate', descKey: 'deact.impactRebateDesc' },
  { key: 'member', titleKey: 'deact.impactMember', descKey: 'deact.impactMemberDesc' },
  { key: 'pets', titleKey: 'deact.impactPets', descKey: 'deact.impactPetsDesc' },
]

/** 阻断项引导落点：预约→/appointments；订单/在途退款→/mall/orders */
const BLOCKER_TARGET: Record<string, string> = {
  appointment: '/appointments',
  order: '/mall/orders',
  refund: '/mall/orders',
}

/** 影响勾选项（role=checkbox 卡行）。画布批片 3：title/desc 放宽 ReactNode 供 CK 锚 */
function ImpactRow({
  checked,
  onToggle,
  title,
  desc,
  testId,
}: {
  checked: boolean
  onToggle: () => void
  title: ReactNode
  desc: ReactNode
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

  /* 画布批片 3：预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（MePage/MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，nearbyQ 带 enabled 闸仅作布局锚解析，零增发常态查询） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const canvasStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'deactivate')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : DEACT_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('deactivate', canvasStoreId, registryBlocks)

  /* 五态互斥机页口径：pending/loadErr 时内容块整段不渲染（读态行在 m2-pad 顶部页级挂载） */
  const contentReady = !pending && !loadErr
  /* 在途/已决（approved）时阻断与表单不渲染（照改造前三分支互斥语义） */
  const flowVisible = contentReady && !inflight && latest?.status !== 'approved'

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. deact.head：PushBar 返回条 + m2 大题页头（PushBar label 为 string prop 无 CK 锚） */
    'deact.head': () => (
      <>
        <PushBar label={acc('deact.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="deact.title">{acc('deact.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. deact.status：在途/已决/成功状态卡（提交成功横幅 R9 + inflight 轮询卡 +
          approved 防御渲染 + rejected 驳回卡；互斥语义照改造前三分支逐字搬） */
    'deact.status': () =>
      contentReady ? (
        <>
          {/* 提交成功横幅（R9 操作反馈） */}
          {justSubmitted ? (
            <div className="m2-card mb-4 border-ink p-4" data-testid="deact-success">
              <div className="text-body font-bold text-ink"><CK k="deact.successTitle">{acc('deact.successTitle')}</CK></div>
              <div className="mt-1 text-caption leading-[1.8] text-ink-secondary"><CK k="deact.successBody">{acc('deact.successBody')}</CK></div>
            </div>
          ) : null}

          {/* 在途卡（轮询区）：审核中 + 撤回 */}
          {inflight ? (
            <div className="m2-card p-4" data-testid="deact-inflight">
              <div className="flex items-center justify-between">
                <div className="text-body font-bold text-ink"><CK k="deact.inflightTitle">{acc('deact.inflightTitle')}</CK></div>
                <span className="rounded-chip bg-brand-primary px-[7px] py-0.5 text-caption-xs font-semibold text-ink">
                  <CK k="appeal.statusSubmitted">{acc('appeal.statusSubmitted')}</CK>
                </span>
              </div>
              <div className="m2-mono mt-1.5 text-[10px] text-ink-secondary">
                {acc('deact.submittedAt', { time: fmtDateTime(inflight.createdAt) })}
              </div>
              <p className="mt-2 text-caption leading-[1.8] text-ink-secondary"><CK k="deact.inflightBody">{acc('deact.inflightBody')}</CK></p>
              <button
                type="button"
                data-testid="deact-cancel"
                disabled={cancelM.isPending}
                onClick={() => cancelM.mutate()}
                className="mt-3 w-full rounded-full border border-line py-2.5 text-body-sm text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
              >
                {cancelM.isPending ? (
                  <CK k="deact.cancelPending">{acc('deact.cancelPending')}</CK>
                ) : (
                  <CK k="deact.cancel">{acc('deact.cancel')}</CK>
                )}
              </button>
            </div>
          ) : latest?.status === 'approved' ? (
            /* 防御渲染：approved 后全接口 401，RequireAuth 会接管跳登录 */
            <div className="m2-card p-4" data-testid="deact-approved">
              <p className="text-body text-ink-secondary"><CK k="deact.approvedNote">{acc('deact.approvedNote')}</CK></p>
            </div>
          ) : latest?.status === 'rejected' ? (
            /* 已决驳回卡（decideNote 客户端可见） */
            <div className="m2-card mb-4 p-4" data-testid="deact-rejected">
              <div className="flex items-center justify-between">
                <div className="text-body font-bold text-ink"><CK k="deact.rejectedTitle">{acc('deact.rejectedTitle')}</CK></div>
                <span className="rounded-chip bg-danger-light px-[7px] py-0.5 text-caption-xs font-semibold text-danger-deep">
                  <CK k="appeal.statusRejected">{acc('appeal.statusRejected')}</CK>
                </span>
              </div>
              {latest.decideNote ? (
                <p className="mt-2 text-caption leading-[1.8] text-ink-secondary">
                  <CK k="deact.rejectedPrefix">{acc('deact.rejectedPrefix')}</CK>：{latest.decideNote}
                </p>
              ) : null}
              <div className="m2-mono mt-1.5 text-[10px] text-ink-secondary">
                {fmtDateTime(latest.decidedAt)}
              </div>
            </div>
          ) : null}
        </>
      ) : null,

    /* 3. deact.blocked：阻断清单卡（逐行列明阻断项 + 「去完成 ›」引导出口，R8 具体子问题） */
    'deact.blocked': () =>
      flowVisible && !precheckQ.data?.deactivatable ? (
        <div data-testid="deact-blocked">
          <SecH title={<CK k="deact.blockTitle">{acc('deact.blockTitle')}</CK>} />
          <div className="m2-card overflow-hidden">
            <p className="px-4 pt-3.5 text-caption leading-[1.8] text-ink-secondary">
              <CK k="deact.blockBody">{acc('deact.blockBody')}</CK>
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
                  <CK k="deact.blockGo">{acc('deact.blockGo')}</CK>
                </button>
              </div>
            ))}
          </div>
          <p className="m2-note mt-3"><CK k="deact.blockNote">{acc('deact.blockNote')}</CK></p>
        </div>
      ) : null,

    /* 4. deact.form：影响明示卡三勾选 + 明示注记 + R13 + 提交钮（二次确认弹层不入块流） */
    'deact.form': () =>
      flowVisible && precheckQ.data?.deactivatable ? (
        <div data-testid="deact-form">
          <SecH title={<CK k="deact.impactTitle">{acc('deact.impactTitle')}</CK>} />
          <div className="m2-card overflow-hidden">
            {IMPACTS.map((i) => (
              <ImpactRow
                key={i.key}
                title={<CK k={i.titleKey}>{acc(i.titleKey)}</CK>}
                desc={<CK k={i.descKey}>{acc(i.descKey)}</CK>}
                checked={checked[i.key]}
                onToggle={() => setChecked((c) => ({ ...c, [i.key]: !c[i.key] }))}
                testId={`deact-impact-${i.key}`}
              />
            ))}
          </div>

          <div className="m2-rules mt-3">
            <ul>
              <li><CK k="deact.keepNote">{acc('deact.keepNote')}</CK></li>
              <li><CK k="deact.reviewNote">{acc('deact.reviewNote')}</CK></li>
              <li><CK k="deact.whyReview">{acc('deact.whyReview')}</CK></li>
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
            <CK k="deact.ctaSubmit">{acc('deact.ctaSubmit')}</CK>
          </button>
        </div>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="deactivate" storeId={canvasStoreId}>
      <div className="m2" data-testid="deactivate-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="deact-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：deact.head=页头裸段置顶（PushBar+大题原在 m2-pad 外，照 MePage 惯例）；
            余块共享 m2-pad 容器内 flex flex-col——默认序下视觉零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'deact.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
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
          ) : null}
          <div className="flex flex-col">
            {layout.map((b) =>
              b.visible && b.blockKey !== 'deact.head' ? (
                <section data-block-key={b.blockKey} key={b.blockKey}>
                  {renderers[b.blockKey]?.() ?? null}
                </section>
              ) : null,
            )}
          </div>
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
    </CanvasLayoutLoader>
  )
}
