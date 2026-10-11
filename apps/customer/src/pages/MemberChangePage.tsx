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
 *
 * 画布化（产品-1010 画布全屏批 片 3 · 会员域扫尾）：四块入册（mch.windowTip/mch.targets/
 * mch.scheduled/mch.empty），块序/显隐=useCanvasLayout('memberChange')（published→注册表
 * 默认序尾补，空=MCH_DEFAULT_ORDER 兜底）；文案键挂 CK(data-copy-key) 点选反查锚；
 * ?canvasPreview=1 探针=水印注记行（mc.canvasExampleNote）；店锚=?canvasStore= 预览店锚 >
 * 记忆门店 > 就近首店（MePage 同口径）。PushBar/AppHead 页头不入块册置块流外；
 * 三态互斥块各自带原判定（ scheduled / 窗口外 / 窗口内 / 非会员·免费档 ），
 * 块内逻辑/查询/提交链路零改动，data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, friendlyError, useCanvasLayout, usePhiliaClient, useToast } from '@philia/shared'
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
import { readLastBooking } from '@/lib/bookingPrefill'

const DAY_MS = 24 * 60 * 60 * 1000

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const MCH_DEFAULT_ORDER = ['mch.windowTip', 'mch.targets', 'mch.scheduled', 'mch.empty'] as const

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

  /* 窗口判定快照=挂载时点（server scheduleChange 真窗口硬校验兜底；渲染纯度 lint 口径） */
  const [nowMs] = useState(() => Date.now())
  const expiresAt = m ? new Date(m.expiresAt) : null
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - nowMs) / DAY_MS) : 0
  const windowOpen = daysLeft <= windowDays
  const expireDate = expiresAt ? expiresAt.toLocaleDateString('zh-CN') : ''
  /* 目标档=除当前档外全档（含低档=到期降级通道；同档 server 拒「无需预约」故不透出） */
  const targets = m ? plans.filter((p) => p.planKey !== m.planKey) : []
  /* 付费档在册态（三态块流的入口闸；非会员/免费档=empty 块说明卡） */
  const paidActive = !!m && !plan?.free

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
  const chgStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'memberChange')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : MCH_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('memberChange', chgStoreId, registryBlocks)

  /* ---- 四块渲染器（块内逻辑/条件与改造前逐字一致；文案键挂 CK 点选反查锚） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. mch.windowTip：窗口提示条（窗口内=开放口径+到期日 mono 行；窗口外=说明卡
          +到期日卡，不报错）；已预约/非会员/免费档不渲染 */
    'mch.windowTip': () => {
      if (!paidActive || nextPlanKey) return null
      if (!windowOpen) {
        /* 窗口外：说明卡（开放口径+到期日 mono）不报错 */
        return (
          <div data-testid="change-window-closed">
            <TipCard><CK k="chg.windowClosed">{mc('chg.windowClosed', { days: windowDays })}</CK></TipCard>
            <div className="m2-card" style={{ marginTop: 14, padding: '16px 18px' }}>
              <div className="m2-mono" style={{ fontSize: 11, color: 'var(--v2muted)' }}>
                <CK k="chg.expireLabel">{mc('chg.expireLabel')}</CK> {expireDate}
              </div>
            </div>
          </div>
        )
      }
      return (
        <>
          <TipCard><CK k="chg.windowOpen">{mc('chg.windowOpen', { days: windowDays })}</CK></TipCard>
          <div className="m2-mono" style={{ marginTop: 10, fontSize: 10, color: 'var(--v2muted)', padding: '0 2px' }}>
            <CK k="chg.expireLabel">{mc('chg.expireLabel')}</CK> {expireDate}
          </div>
        </>
      )
    },

    /* 2. mch.targets：窗口内未预约=下期档卡选择列（含低档）+ 预约提交 + 执行说明 */
    'mch.targets': () => {
      if (!paidActive || nextPlanKey || !windowOpen) return null
      return (
        <>
          <SecH title={<CK k="chg.targetTitle">{mc('chg.targetTitle')}</CK>} />
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
                  {p.free ? (
                    <CK k="chg.priceFree">{mc('chg.priceFree')}</CK>
                  ) : (
                    <CK k="chg.priceYear">{mc('chg.priceYear', { price: yuanOf(p.priceFen) })}</CK>
                  )}
                </div>
              </div>
              <button
                type="button"
                data-testid={`change-submit-${p.planKey}`}
                className="m2-press"
                disabled={scheduleM.isPending}
                style={{ borderRadius: 99, border: '1px solid var(--v2line)', background: 'var(--v2card)', padding: '9px 16px', fontSize: 13, fontWeight: 700, color: 'var(--v2ink)', cursor: 'pointer', flex: 'none' }}
                onClick={() => scheduleM.mutate(p.planKey)}
              >
                {scheduleM.isPending ? (
                  <CK k="chg.submitting">{mc('chg.submitting')}</CK>
                ) : (
                  <CK k="chg.submitCta">{mc('chg.submitCta', { tier: tierNameOf(p.planKey) })}</CK>
                )}
              </button>
            </div>
          ))}
          <p className="m2-note" style={{ marginTop: 4 }}><CK k="chg.execNote">{mc('chg.execNote')}</CK></p>
        </>
      )
    },

    /* 3. mch.scheduled：已预约态=预约单卡（目标档+预约时刻 mono+执行说明+取消预约钮） */
    'mch.scheduled': () => {
      if (!paidActive || !nextPlanKey) return null
      return (
        <div className="m2-card" data-testid="change-scheduled-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}><CK k="chg.scheduledTitle">{mc('chg.scheduledTitle')}</CK></div>
          <div style={{ fontFamily: 'var(--v2serif)', fontSize: 21, fontWeight: 900, marginTop: 8 }}>
            {tierNameOf(nextPlanKey)}会员
          </div>
          <div className="m2-mono" style={{ marginTop: 6, fontSize: 10, color: 'var(--v2muted)' }}>
            <CK k="chg.scheduledAtLabel">{mc('chg.scheduledAtLabel')}</CK>{' '}
            {nextPlanSetAt ? new Date(nextPlanSetAt).toLocaleString('zh-CN', { hour12: false }) : '—'}
          </div>
          <div className="m2-mono" style={{ marginTop: 4, fontSize: 10, color: 'var(--v2muted)' }}>
            <CK k="chg.expireLabel">{mc('chg.expireLabel')}</CK> {expireDate}
          </div>
          <p className="m2-note" style={{ marginTop: 10 }}>
            <CK k="chg.scheduledLine">{mc('chg.scheduledLine', { plan: tierNameOf(nextPlanKey) })}</CK>
          </p>
          <p className="m2-note" style={{ marginTop: 6 }}><CK k="chg.execNote">{mc('chg.execNote')}</CK></p>
          <button
            type="button"
            data-testid="change-cancel"
            className="m2-press"
            disabled={cancelM.isPending}
            style={{ marginTop: 14, width: '100%', padding: '13px 22px', borderRadius: 18, border: '1px solid var(--v2line)', background: 'var(--v2card)', color: 'var(--v2ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            onClick={() => cancelM.mutate()}
          >
            {cancelM.isPending ? (
              <CK k="chg.cancelling">{mc('chg.cancelling')}</CK>
            ) : (
              <CK k="chg.cancelCta">{mc('chg.cancelCta')}</CK>
            )}
          </button>
        </div>
      )
    },

    /* 4. mch.empty：非会员/免费档说明卡（给真实出口：非会员→/member/open；
          免费档无到期换档语义→/member/upgrade 升档通道） */
    'mch.empty': () => {
      if (!m) {
        /* 非会员直访：说明卡不报错（不跳走防弹球，给真实出口） */
        return (
          <div className="m2-card" data-testid="change-nonmember" style={{ padding: '20px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}><CK k="chg.nonMemberTitle">{mc('chg.nonMemberTitle')}</CK></div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button type="button" className="m2-link" onClick={() => navigate('/member/open')}>
                <CK k="chg.nonMemberCta">{mc('chg.nonMemberCta')}</CK>
              </button>
            </div>
          </div>
        )
      }
      if (plan?.free) {
        /* 免费档：无到期换档语义（server 同口径拒单），指引走升档通道 */
        return (
          <div className="m2-card" data-testid="change-free" style={{ padding: '20px 18px' }}>
            <p className="m2-note" style={{ marginTop: 0 }}><CK k="chg.freeNote">{mc('chg.freeNote')}</CK></p>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button type="button" className="m2-link" onClick={() => navigate('/member/upgrade')}>
                <CK k="chg.freeCta">{mc('chg.freeCta')}</CK>
              </button>
            </div>
          </div>
        )
      }
      return null
    },
  }

  return (
    <CanvasLayoutLoader pageKey="memberChange" storeId={chgStoreId}>
      <div className="m2" data-testid="member-change-page" style={{ minHeight: '100vh' }}>
        {toastEl}
        {/* 返回=时间序回退 navigate(-1)，直访兜底=/member（PushBar 既有纪律）；页头不入块册 */}
        <PushBar label={mc('chg.pushLabel')} fallback="/member" />
        <AppHead title={mc('chg.headTitle')} no={mc('chg.headNo')} />

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="change-canvas-preview-note">
              {mc('mc.canvasExampleNote')}
            </p>
          </div>
        ) : null}

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
        ) : (
          /* 块流：四块按有效布局渲染（三态互斥块各自带原判定；默认序下 DOM 结构零差异） */
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
