/**
 * RecordsPage · /records 消费记录（客户端体验大批 片 1 · 支付售后面统一入口）
 *
 * - 押金进度区置顶：deposit.listMine——三态徽（held 在押 / refunding 退还在途 /
 *   refunded 已退还）+ 三时点（收取/申请退还/退还完成，有才显）+ 金额（mono）+
 *   门店名 + 留痕口径注记「押金收退=门店登记留痕，进度以此为准」；
 * - 消费记录列表：pay.recordsMine 三源聚合（kind 徽 pay/order/invoice + 标题 +
 *   金额 + 状态 + mono 时刻，点跳 server 透出 link）；空态三句话照既有工艺。
 * 返回=PushBar 时间序回退，直访兜底 /me。文案全走 copy/records.ts（rcc）。
 *
 * 画布化（产品-1010 画布全屏批 片 3 · 会员域扫尾）：两块入册（rec.deposit/rec.list），
 * 块序/显隐=useCanvasLayout('records')（published→注册表默认序尾补，空=
 * REC_DEFAULT_ORDER 兜底）；文案键挂 CK(data-copy-key) 点选反查锚（EmptyState/
 * ErrorState 的 string props 挂不上锚，如实入册注记）；?canvasPreview=1 探针=水印
 * 注记行（mc.canvasExampleNote）；店锚=?canvasStore= 预览店锚 > 记忆门店 > 就近首店
 * （MePage 同口径）。PushBar/m2-apphead 页头不入块册置块流外（页题 rec.title 与
 * rec.list 区块题同键，锚挂在区块题上）；块内逻辑/查询零改动，data-testid 原值全保留。
 */

import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { fenToYuan } from '@/components/booking/format'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { fmtDateTime } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { rcc, type RecordsCopyKey } from '../copy/records'
import { readLastBooking } from '@/lib/bookingPrefill'

type Trpc = ReturnType<typeof usePhiliaClient>['trpc']
type DepositItem = Awaited<ReturnType<Trpc['deposit']['listMine']['query']>>['items'][number]
type RecordItem = Awaited<ReturnType<Trpc['pay']['recordsMine']['query']>>['items'][number]

/* 三态徽配色：在押=淡金底 / 退还在途=薄荷洗 / 已退还=墨沉底（照 MallOrdersPage opill 口径） */
const DEP_STATUS_PILL: Record<string, string> = {
  held: 'bg-brand-primary text-ink',
  refunding: 'bg-brand-secondary-light text-ink',
  refunded: 'bg-[rgba(59,46,36,.06)] text-ink-secondary',
}

/** 押金三态键位（held/refunding/refunded → rec.dep 前缀三键） */
function depStatusKey(status: string): RecordsCopyKey {
  return status === 'held' ? 'rec.depHeld' : status === 'refunding' ? 'rec.depRefunding' : 'rec.depRefunded'
}

function DepositCard({ d }: { d: DepositItem }) {
  const pill = DEP_STATUS_PILL[d.status] ?? DEP_STATUS_PILL.refunded
  const statusKey = depStatusKey(d.status)
  const statusLabel = rcc(statusKey)
  return (
    <div className="u1-card px-4 py-3.5" data-testid={`deposit-row-${d.id}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink">{d.storeName ?? '—'}</p>
        <span className={`rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${pill}`}>
          <CK k={statusKey}>{statusLabel}</CK>
        </span>
      </div>
      <p className="u1-num mt-1 text-body-sm font-bold text-ink">{fenToYuan(d.amountFen)}</p>
      <div className="m2-mono mt-1 space-y-0.5 text-[9px] text-ink-secondary">
        {d.heldAt ? <p><CK k="rec.depHeldAt">{rcc('rec.depHeldAt', { time: fmtDateTime(d.heldAt) })}</CK></p> : null}
        {d.refundRequestedAt ? <p><CK k="rec.depRefundReqAt">{rcc('rec.depRefundReqAt', { time: fmtDateTime(d.refundRequestedAt) })}</CK></p> : null}
        {d.refundedAt ? <p><CK k="rec.depRefundedAt">{rcc('rec.depRefundedAt', { time: fmtDateTime(d.refundedAt) })}</CK></p> : null}
      </div>
    </div>
  )
}

function RecordRow({ r }: { r: RecordItem }) {
  const kindKey: RecordsCopyKey =
    r.kind === 'pay' ? 'rec.kindPay' : r.kind === 'order' ? 'rec.kindOrder' : 'rec.kindInvoice'
  const kindLabel = rcc(kindKey)
  /* 片 3 透出：pay 行带支付单号 mono+mock 演示徽；order 行挂线上支付信息（有才显） */
  const payNo = r.kind === 'pay' && 'payNo' in r ? r.payNo : null
  const isMockPay = r.kind === 'pay' && 'mock' in r && r.mock === true
  const onlinePaid = r.kind === 'order' && 'onlinePaid' in r ? r.onlinePaid : null
  return (
    <Link
      to={r.link}
      data-testid={`record-row-${r.kind}-${r.id}`}
      className="u1-card flex items-center gap-3 px-4 py-3.5 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
    >
      <span className="flex-none rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary">
        <CK k={kindKey}>{kindLabel}</CK>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-semibold text-ink">{r.title}</p>
        {payNo ? (
          <p className="m2-mono mt-0.5 text-[9px] text-ink-secondary">
            <CK k="rec.payNoLine">{rcc('rec.payNoLine', { payNo })}</CK>
            {isMockPay ? (
              <span className="ml-1 rounded-chip bg-brand-secondary-light px-1 py-px text-[8px] font-semibold text-ink">
                <CK k="rec.payChannelMock">{rcc('rec.payChannelMock')}</CK>
              </span>
            ) : null}
          </p>
        ) : null}
        {onlinePaid ? (
          <p className="m2-mono mt-0.5 text-[9px] text-ink-secondary">
            <CK k="rec.onlinePaidLine">
              {rcc('rec.onlinePaidLine', {
                payNo: onlinePaid.payNo,
                demo: onlinePaid.mock ? `${rcc('rec.payChannelMock')} · ` : '',
                status: onlinePaid.status,
              })}
            </CK>
          </p>
        ) : null}
        <p className="m2-mono mt-0.5 text-[9px] text-ink-secondary">{fmtDateTime(r.createdAt)}</p>
      </div>
      <div className="flex flex-none flex-col items-end gap-0.5">
        {r.amountFen != null ? <span className="u1-num text-body-sm font-bold text-ink">{fenToYuan(r.amountFen)}</span> : null}
        <span className="text-caption-xs text-ink-placeholder">{r.status}</span>
      </div>
      <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
    </Link>
  )
}

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const REC_DEFAULT_ORDER = ['rec.deposit', 'rec.list'] as const

export default function RecordsPage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()

  const depositsQ = useQuery({
    queryKey: ['deposit', 'listMine'],
    queryFn: () => trpc.deposit.listMine.query(),
    enabled: !!user,
  })
  const recordsQ = useQuery({
    queryKey: ['pay', 'recordsMine'],
    queryFn: () => trpc.pay.recordsMine.query(),
    enabled: !!user,
  })

  const deposits = depositsQ.data?.items ?? []
  const records = recordsQ.data?.items ?? []

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
  const recStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'records')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : REC_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('records', recStoreId, registryBlocks)

  /* ---- 两块渲染器（块内逻辑与改造前逐字一致；文案键挂 CK 点选反查锚） ---- */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. rec.deposit：押金进度区（三态徽+三时点+金额+门店；留痕口径注记明面） */
    'rec.deposit': () => (
      <>
        <SecH title={<CK k="rec.depositTitle">{rcc('rec.depositTitle')}</CK>} />
        {depositsQ.isPending ? (
          <LoadingBlock lines={2} />
        ) : depositsQ.isError ? (
          <ErrorState message={rcc('rec.loadFail')} onRetry={() => void depositsQ.refetch()} />
        ) : deposits.length === 0 ? (
          <p className="m2-note px-1" data-testid="deposit-empty"><CK k="rec.depositEmpty">{rcc('rec.depositEmpty')}</CK></p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {deposits.map((d) => (
              <DepositCard key={d.id} d={d} />
            ))}
          </div>
        )}
        <p className="m2-note mt-2 px-1" data-testid="deposit-note"><CK k="rec.depositNote">{rcc('rec.depositNote')}</CK></p>
      </>
    ),

    /* 2. rec.list：消费记录三源聚合列表（kind 徽+标题+金额+状态+时刻，点跳 link）+ 空态三句话 */
    'rec.list': () => (
      <>
        <div style={{ marginTop: 18 }}>
          <SecH title={<CK k="rec.title">{rcc('rec.title')}</CK>} />
        </div>
        {recordsQ.isPending ? (
          <LoadingBlock lines={3} />
        ) : recordsQ.isError ? (
          <ErrorState message={rcc('rec.loadFail')} onRetry={() => void recordsQ.refetch()} />
        ) : records.length === 0 ? (
          /* 空态三句话（是什么 / 为什么 / 去哪），出口=商城 */
          <EmptyState
            title={rcc('rec.emptyTitle')}
            desc={rcc('rec.emptyBody')}
            action={
              <Link
                to="/mall"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {rcc('rec.emptyCta')}
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {records.map((r) => (
              <RecordRow key={`${r.kind}-${r.id}`} r={r} />
            ))}
          </div>
        )}
      </>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="records" storeId={recStoreId}>
      <div className="m2" data-testid="records-page" style={{ minHeight: '100vh' }}>
        {/* 返回=时间序回退，直访兜底 /me；页头（PushBar+apphead）不入块册置块流外 */}
        <PushBar label={rcc('rec.pushLabel')} fallback="/me" />
        <div className="m2-apphead">
          <span className="tt">{rcc('rec.title')}</span>
        </div>

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="m2-pad" style={{ marginTop: 10 }}>
            <p className="m2-note" style={{ margin: 0, textAlign: 'center' }} data-testid="records-canvas-preview-note">
              {mc('mc.canvasExampleNote')}
            </p>
          </div>
        ) : null}

        {/* 块流：两块按有效布局渲染（published 覆盖∪默认序尾补）；默认序下 DOM 结构零差异 */}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {layout.map((b) =>
            b.visible ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
      </div>
    </CanvasLayoutLoader>
  )
}
