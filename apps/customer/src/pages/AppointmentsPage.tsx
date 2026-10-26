/**
 * 我的预约（T2.2）：listMine 全部 + 状态分组 Tab：
 *   全部(all=全状态) / 待确认(pending) / 已确认(confirmed + cancel_requested)
 *   / 服务中(in_service + in_boarding) / 已完成(completed) / 已取消(cancelled)。
 *   状态分组过滤互斥，全部不重复计数；D-60「全部订单」落 all 真筛选。
 * 卡片：门店 / 服务 / 宠物 / 时间 / 状态胶囊 / 价格；服务中卡片带呼吸光环角标；点进详情。
 *
 * 画布化（产品-1010 画布全屏批片 3 · 预约域三重屏之一）：五块入册
 * （appointments.header/tabs/list/empty/error），块序/显隐=useCanvasLayout('appointments')
 * （published→注册表默认序尾补，空=APPOINTMENTS_DEFAULT_ORDER 兜底）；文案键挂 CK 点选反查锚；
 * ?canvasPreview=1 探针=页首水印注记（mc.canvasExampleNote，testid appointments-canvas-preview-note）
 * + 候裁清零批件 6 预览兜底：预约列空/拉取失败时喂一条屏内合成示例单（假名「示例单·
 * 画布预览」系，零真数据零写库，真用户页零改动）。
 * 店锚=MePage 口径（?canvasStore= 预览店锚 > readLastBooking 记忆门店 > listNearby 首店）。
 * 查询/滚动记忆及未触块逻辑不变，D-60 新增 all 真筛选，data-testid 原值全保留；
 * 加载骨架/失败/空态与原三分支互斥口径逐字保留（各块自带渲染闸，默认序下 DOM 零差异）。
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CanvasLayoutLoader, CK, Skeleton, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState } from '@/components/home/common';
import { mc } from '@/components/member/copy';
import { apc, type AppointmentsCopyKey } from '@/copy/appointments';
import { readLastBooking } from '@/lib/bookingPrefill';
import { customerPetName } from '@/lib/customerPresentation';
import {
  APPT_STATUS_META,
  APPT_TYPE_LABEL,
  fenToYuan,
  fmtDateTime,
  fmtRange,
  statusLabel,
} from '@/components/booking/format';
import type { AppointmentGroups, AppointmentListItem, AppointmentStatus } from '@/components/booking/types';

interface TabDef {
  key: string;
  /** 画布全屏批片 3：Tab 名抽键（原写死中文 label 逐字落 copy 默认值） */
  copyKey: AppointmentsCopyKey;
  statuses: AppointmentStatus[];
}

const ALL_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending', 'confirmed', 'cancel_requested', 'in_service', 'in_boarding', 'completed', 'cancelled',
];

const TABS: TabDef[] = [
  { key: 'pending', copyKey: 'appointments.tabPending', statuses: ['pending'] },
  { key: 'confirmed', copyKey: 'appointments.tabConfirmed', statuses: ['confirmed', 'cancel_requested'] },
  { key: 'serving', copyKey: 'appointments.tabServing', statuses: ['in_service', 'in_boarding'] },
  { key: 'history', copyKey: 'appointments.tabHistory', statuses: ['completed'] },
  { key: 'cancelled', copyKey: 'appointments.tabCancelled', statuses: ['cancelled'] },
  { key: 'all', copyKey: 'appointments.tabAll', statuses: ALL_APPOINTMENT_STATUSES },
];

const SERVING = new Set(['in_service', 'in_boarding']);

const TAB_KEYS = new Set(TABS.map((t) => t.key));
/** W1 R-Nav-2：滚动位置会话级记忆 key（sessionStorage，会话结束自清） */
const SCROLL_KEY = 'w1.scroll.appointments';

/** 画布注册表默认序兜底（=改造前 JSX 块序；canvas.blocks 失败/空时用） */
const APPOINTMENTS_DEFAULT_ORDER = [
  'appointments.header',
  'appointments.tabs',
  'appointments.list',
  'appointments.empty',
  'appointments.error',
] as const;

/* 候裁清零批 件 6（预览兜底示例·客户端合成件）：canvasPreview=1 且预约列表为空时
   喂一条合成示例单——假名「示例单·画布预览」系（门店/服务/宠物全假名），时刻/金额=
   固定示例值，零真数据零写库（水印注记页首已有；卡链向合成 id 详情页，服务端查无
   落该页原「不存在」空态，不落库）。真用户页零改动（非探针模式永不触发） */
const EXAMPLE_APPT_GROUPS = {
  confirmed: [
    {
      id: 'canvas-example-appt',
      type: 'grooming',
      status: 'confirmed',
      serviceName: '示例洗护·画布预览',
      storeName: '示例门店·画布预览',
      petName: '示例宠物·画布预览',
      scheduledStart: new Date('2026-10-20T14:00:00'),
      scheduledEnd: new Date('2026-10-20T15:00:00'),
      priceFen: 12800,
    } as AppointmentListItem,
  ],
} as AppointmentGroups;

function AppointmentCard({ item }: { item: AppointmentListItem }) {
  const meta = APPT_STATUS_META[item.status] ?? { label: item.status, pill: 'bg-sunken text-ink-secondary' };
  const serving = SERVING.has(item.status);
  return (
    <Link
      to={`/appointments/${item.id}`}
      className="relative block rounded-card bg-card p-4 shadow-card transition active:scale-[0.99]"
    >
      {/* 服务中呼吸光环角标 */}
      {serving ? (
        <span className="absolute -right-1.5 -top-1.5 flex items-center gap-1 rounded-full bg-brand-primary px-2.5 py-1 text-caption font-medium text-ink animate-halo">
          <CK k="appointments.cardServingBadge">{apc('appointments.cardServingBadge')}</CK>
        </span>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-body font-semibold">{item.serviceName ?? APPT_TYPE_LABEL[item.type]}</p>
        <span className={`rounded-full px-2.5 py-1 text-caption ${meta.pill}`}>{meta.label}</span>
      </div>
      {/* 门店/宠物名数据行（缺省兜底走 copy 键；数据行不挂 CK 锚，照 MePage 数据行惯例） */}
      <p className="mt-1 text-caption text-ink-secondary">
        {item.storeName ?? apc('appointments.cardStoreFallback')} · {customerPetName(item.petName, apc('appointments.cardPetFallback'))}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <p className="font-number text-caption text-ink">
          {item.type === 'boarding'
            ? fmtRange(item.scheduledStart, item.scheduledEnd)
            : fmtDateTime(item.scheduledStart)}
        </p>
        <p className="font-number text-body font-semibold text-ink">{fenToYuan(item.priceFen)}</p>
      </div>
    </Link>
  );
}

export default function AppointmentsPage() {
  const { trpc } = usePhiliaClient();
  // 批次 S4：免确认后新单落库即 confirmed，默认 Tab 由「待确认」改「已确认」
  //（待确认 Tab 保留：历史 pending 单与客户改期回退单仍在此分组）
  /* W1 R-Nav-2 返回保状态（淘宝订单列表同规范）：
     - 筛选 tab 入 URL（?tab=，replace 写入不污染历史栈——后退不会逐 tab 回放）；
     - 滚动位置会话级记忆（sessionStorage + rAF 节流），数据就绪后恢复一次；
     详情页返回列表后 tab 与滚动位置一并保住；与浏览器/系统后退手势不冲突
     （只读 URL/会话存储，不拦截 popstate）。 */
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  /* D-38（走查P2修复批）：显式 ?tab= 照用；无参=默认签在数据就绪后落到「第一个有内容的签」
     （S4 口径「已确认」降为兜底，不再死停空态误导——改约回退单在 pending 签的场景）。
     具体取值在 effGroups 就绪后计算（见下 tab 常量） */
  const setTab = (key: string) => setSearchParams({ tab: key }, { replace: true });

  const listQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
  });

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  );
  /* 画布布局店锚（同 MePage/MemberCenterPage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), []);
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, []);
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  });
  const apptsStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null;

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  });
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'appointments')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return items.length > 0 ? items : APPOINTMENTS_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));
  }, [blocksQ.data]);
  const layout = useCanvasLayout('appointments', apptsStoreId, registryBlocks);

  // 滚动位置：持续记忆（rAF 节流）
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        } catch {
          /* 隐私模式忽略 */
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // 数据就绪后恢复一次滚动位置（列表有内容才恢复，避免空页乱跳）
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || listQ.isPending || listQ.isError) return;
    restoredRef.current = true;
    let y = 0;
    try {
      y = Number(window.sessionStorage.getItem(SCROLL_KEY) ?? 0) || 0;
    } catch {
      /* 隐私模式忽略 */
    }
    if (y > 0) window.scrollTo(0, y);
  }, [listQ.isPending, listQ.isError]);
  const groups: AppointmentGroups | undefined = listQ.data?.groups;
  /* 件 6：预览态预约列空（或预览拉取失败=店主无客户端会话）→ 合成示例单一条顶替
     空态/失败态（落默认「已确认」签；空态/失败块让位；真用户页零改动） */
  const exampleActive =
    isCanvasPreview &&
    !listQ.isPending &&
    (listQ.isError || (groups ? Object.values(groups).every((g) => g.length === 0) : false));
  const effGroups: AppointmentGroups | undefined = exampleActive ? EXAMPLE_APPT_GROUPS : groups;

  /* D-38：tab 解析——显式 ?tab= 优先；无参时数据就绪后落第一个有内容的签（TABS 序），全空/加载中/失败=「已确认」兜底 */
  const firstNonEmptyTab =
    effGroups && TABS.find((t) => t.statuses.some((s) => (effGroups[s]?.length ?? 0) > 0))?.key;
  const tab = rawTab && TAB_KEYS.has(rawTab) ? rawTab : (firstNonEmptyTab ?? 'confirmed');

  const active = TABS.find((t) => t.key === tab)!;
  const items = active.statuses.flatMap((s) => effGroups?.[s] ?? []);
  const totalCount = effGroups ? Object.values(effGroups).reduce((n, g) => n + g.length, 0) : 0;
  const countOf = (t: TabDef) => t.statuses.reduce((n, s) => n + (effGroups?.[s].length ?? 0), 0);
  /* 原三分支互斥口径：正常态=非加载非失败且总数>0（tabs/list 块渲染闸）；
     件 6：exampleActive 合成示例态视同正常态（预览专属） */
  const showMain = ((!listQ.isPending && !listQ.isError) || exampleActive) && totalCount > 0;

  /* 渲染器结构沿用；D-60 新增 all 筛选，文案走 copy 键 + CK 反查锚 */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. appointments.header：统一返回条（U1-A：详情级页面不渲染 dock，←圆钮+标题） */
    'appointments.header': () => (
      <PageHeader title={<CK k="appointments.title">{apc('appointments.title')}</CK>} />
    ),

    /* 2. appointments.tabs：全部 + 五状态签（D-60）+ 退款售后槽位随后 */
    'appointments.tabs': () =>
      showMain ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const n = countOf(t);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-body transition ${
                  tab === t.key
                    ? 'bg-brand-primary font-semibold text-ink'
                    : 'bg-card text-ink-secondary shadow-card'
                }`}
              >
                <CK k={t.copyKey}>{apc(t.copyKey)}</CK>
                {n > 0 ? <span className="ml-1 font-number text-caption">{n}</span> : null}
              </button>
            );
          })}
          {/* 退款售后槽位（PD-15 置灰口径保留；D-60 不扩该槽状态机） */}
          <span
            data-testid="slot-refund-tab"
            aria-disabled="true"
            className="shrink-0 cursor-not-allowed rounded-full bg-card px-4 py-2 text-body text-ink-placeholder opacity-60 shadow-card"
          >
            <CK k="o1.refundTab">{mc('o1.refundTab')}</CK>
            <span className="ml-1 text-caption-xs"><CK k="slot.soon">{mc('slot.soon')}</CK></span>
          </span>
        </div>
      ) : null,

    /* 3. appointments.list：加载骨架 / 分组卡片 / 分组空行（原 pending 与正常分支逐字搬） */
    'appointments.list': () =>
      listQ.isPending ? (
        <div className="mt-5 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      ) : showMain ? (
        <div className="mt-3 space-y-2.5">
          {items.length === 0 ? (
            <p className="rounded-card bg-sunken px-4 py-10 text-center text-caption text-ink-secondary">
              <CK k="appointments.tabEmpty">{apc('appointments.tabEmpty', { status: statusLabel(active.statuses[0] ?? '') })}</CK>
            </p>
          ) : (
            items.map((it) => <AppointmentCard key={it.id} item={it} />)
          )}
        </div>
      ) : null,

    /* 4. appointments.empty：全域统一空态（U1-I；E-01 三句话结构；行动钮=深棕墨族 §4.11）
          EmptyState title/desc=string props 组件内渲——键入 copyKeys，组件内无 CK 锚 */
    'appointments.empty': () =>
      !listQ.isPending && !listQ.isError && totalCount === 0 ? (
        <EmptyState
          title={apc('appointments.emptyTitle')}
          desc={apc('appointments.emptyBody')}
          action={
            /* E 系空态深棕钮（.emptyc .go：深棕墨底 #2E2318 + #F6EFDD，§4.11） */
            <Link
              to="/booking"
              className="inline-flex items-center rounded-control bg-[#2E2318] px-[22px] py-3 text-[13px] font-bold text-[#F6EFDD] transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <CK k="appointments.emptyCta">{apc('appointments.emptyCta')}</CK>
            </Link>
          }
        />
      ) : null,

    /* 5. appointments.error：加载失败态（W1 退回修：裸错误文本升 ErrorState，重试=点睛主钮；
          ErrorState message=string prop 组件内渲，重试钮文案组件内写死——组件内无 CK 锚）；
          件 6：exampleActive 合成示例态让位（失败块不压示例卡流） */
    'appointments.error': () =>
      listQ.isError && !exampleActive ? (
        <div className="mt-5">
          <ErrorState message={apc('appointments.loadFail')} onRetry={() => void listQ.refetch()} />
        </div>
      ) : null,
  };

  return (
    <CanvasLayoutLoader pageKey="appointments" storeId={apptsStoreId}>
      <div className="px-4 py-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="mb-3 text-center text-caption-xs text-ink-secondary" data-testid="appointments-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
        ) : null}
        {/* 块流：五块按有效布局渲染（published 覆盖∪默认序尾补）；各块自带渲染闸
            （加载/失败/空态互斥），默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
      </div>
    </CanvasLayoutLoader>
  );
}
