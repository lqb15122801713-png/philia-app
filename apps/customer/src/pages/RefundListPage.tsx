/**
 * 退款/售后列表 /refunds（补缺批片 1）：
 * - listMine 本人申请倒序；卡=类型签 + 原单 billNo + 店名 + 状态 pill（四档色纪律不设绿）
 *   + 金额 mono + 时间；点卡 → /refunds/:id；
 * - 空态三句话（题/说明/出口→/mall/orders，深棕墨底出口钮）；
 * - 骨架 ListSkeleton / 异常 ErrorState+重试（R8）。
 *
 * 画布化（产品-1010 画布全屏批 片 3 末片 · 商城域，工艺照 MePage/MallPage）：
 * 三块入册（refunds.head/list/empty），块序/显隐=useCanvasLayout('refunds')
 * （published→注册表默认序尾补，空=REFUNDS_DEFAULT_ORDER 兜底）；店锚=?canvasStore=
 * 预览店锚 > 记忆门店 > listNearby 首店（MemberCenterPage 口径，同 queryKey 缓存共享零增发）；
 * ?canvasPreview=1=页首水印注记（refunds-canvas-preview-note）；类型签/状态 pill 文案渲染于
 * 共享件 components/refund/common（组件内无 CK 锚，键如实列入 copyKeys）；骨架/异常页级
 * 状态不入块流；块内逻辑零改动，data-testid 原值全保留。
 */

import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CanvasLayoutLoader, CK, ListSkeleton, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState } from '@/components/home/common';
import { fenToYuan, fmtOrderTime } from '@/components/mall/format';
import { RefundStatusPill, refundTypeLabel } from '@/components/refund/common';
import { REFUND_COPY, rc } from '@/copy/refund';
import { mlc } from '@/copy/mall';
import { mc } from '@/components/member/copy';
import { readLastBooking } from '@/lib/bookingPrefill';

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const REFUNDS_DEFAULT_ORDER = ['refunds.head', 'refunds.list', 'refunds.empty'] as const;

export default function RefundListPage() {
  const { trpc } = usePhiliaClient();
  const navigate = useNavigate();

  const listQ = useQuery({
    queryKey: ['refundRequest', 'listMine'],
    queryFn: () => trpc.refundRequest.listMine.query(),
  });
  const rows = listQ.data ?? [];

  /* ---- 画布全屏批 片 3 画布化入册：探针参 + 店锚 + 注册表块序/有效布局（同 MePage 工艺） ---- */
  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  );
  /* 画布布局店锚（MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，照解析供 useCanvasLayout/Loader；listNearby 同 queryKey 缓存共享零增发） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), []);
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, []);
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  });
  const refundsStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null;

  /* 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  });
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'refunds')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return items.length > 0 ? items : REFUNDS_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));
  }, [blocksQ.data]);
  const layout = useCanvasLayout('refunds', refundsStoreId, registryBlocks);

  const listReady = !listQ.isPending && !listQ.isError;

  /* 块渲染器（块内逻辑零改动——三块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. refunds.head：页头（R1：返回=时间序 navigate(-1)，直访 fallback 默认 /home） */
    'refunds.head': () => (
      <PageHeader title={<CK k="refund.listTitle">{rc('refund.listTitle')}</CK>} />
    ),

    /* 2. refunds.list：申请卡流（卡=类型签 + 原单 billNo + 店名 + 状态 pill + 金额 mono +
          时间；点卡 → /refunds/:id；类型签/状态 pill 渲染于共享件 refund/common，
          组件内无 CK 锚） */
    'refunds.list': () =>
      listReady && rows.length > 0 ? (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              data-testid={`refund-item-${r.id}`}
              onClick={() => navigate(`/refunds/${r.id}`)}
              className="block w-full rounded-card bg-card p-4 text-left shadow-card transition-transform duration-120 ease-philia-spring active:scale-[.99]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-body-sm font-semibold">
                  <span className="shrink-0 rounded-chip bg-sunken px-[7px] py-0.5 text-caption-xs font-semibold text-ink-secondary">
                    {refundTypeLabel(r.type)}
                  </span>
                  <span className="truncate">{r.storeName ?? mlc('mall.storeFallback')}</span>
                </p>
                <RefundStatusPill status={r.status} />
              </div>
              <p className="mt-1 font-number text-caption-xs text-ink-placeholder">
                {r.billNo} · {fmtOrderTime(r.createdAt)}
              </p>
              <p className="mt-2 text-right font-number text-body-sm font-bold text-ink">
                {fenToYuan(r.amountFen)}
              </p>
            </button>
          ))}
        </div>
      ) : null,

    /* 3. refunds.empty：空态三句话（R6：题/说明/出口 → /mall/orders，深棕墨底出口钮；
          EmptyState title 为 string 位挂不上 CK，desc/action 挂 CK） */
    'refunds.empty': () =>
      listReady && rows.length === 0 ? (
        <div className="flex min-h-[56vh] flex-col justify-center">
          <EmptyState
            title={REFUND_COPY['refund.emptyTitle']}
            desc={<CK k="refund.emptyBody">{REFUND_COPY['refund.emptyBody']}</CK>}
            action={
              <Link
                to="/mall/orders"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="refund.emptyCta">{REFUND_COPY['refund.emptyCta']}</CK>
              </Link>
            }
          />
        </div>
      ) : null,
  };

  return (
    <CanvasLayoutLoader pageKey="refunds" storeId={refundsStoreId}>
      <div className="px-4 py-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="refunds-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：三块按有效布局渲染（隐藏块整段不渲染）；list/empty 块内互斥门控照改造前
            （骨架/异常页级状态不入块流，挂载于块流后=改造前头下位置，此时余块自空不抢位）
            ——默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}

        {/* 骨架/异常页级状态（不入块流；此时 list/empty 块自空） */}
        {listQ.isPending ? (
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-card bg-card p-4 shadow-card">
                <ListSkeleton rows={3} />
              </div>
            ))}
          </div>
        ) : listQ.isError ? (
          /* R8：异常态=具体子问题+重试 */
          <div className="mt-4">
            <ErrorState message={rc('refund.loadFail')} onRetry={() => void listQ.refetch()} />
          </div>
        ) : null}
      </div>
    </CanvasLayoutLoader>
  );
}
