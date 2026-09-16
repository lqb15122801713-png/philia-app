/**
 * B9a 任务 B · 首页主区双态面板容器（HomePage 主区，全屏唯一重点）。
 *
 * 双态（任务书口径）：
 * - 常态面板（RebookPanel）：B4-3 下单记忆驱动的「一键再约」，CTA 单次点击直接
 *   appointment.create（现入参不动）→ /booking/success；
 * - 服务中面板（InServicePanel）：存在 in_service 洗护预约时替换常态面板——
 *   当前步骤名 + 第 N 步/共 6 步 + 细线进度条 + 最新员工照片缩略 + 实时直播入口。
 *
 * 降级规则（不替用户猜，面板退化为「预约洗护 ›」入口卡，进单屏走 B4-3 预填）：
 * - 无下单记忆（localStorage 无 storeId）；
 * - 记忆中的门店失效（getWithServices NOT_FOUND/查询失败）；
 * - 多宠物未直选（resolvePetId 无法确定唯一宠物）；
 * - 记忆门店无可约洗护服务；
 * - 无可约槽（时长连续过滤后 7 天栅格为空）。
 *
 * 最早可约槽口径：与单屏完全同源——store.getWithServices(storeId, serviceId)
 * （服务端 +8 规范时区合成栅格、+1h 缓冲、容量、时长连续过滤），前端取
 * min(slotStart)，零新接口。两段式查询：先 (storeId) 取服务目录解析 B4-3
 * 服务预填，再 (storeId, serviceId) 取时长连续过滤槽（queryKey 与单屏一致，缓存共享）。
 *
 * paymentMode 口径（与单屏默认一致）：本人该店有可用次卡 → pass_deduct，
 * 否则 pay_at_store；面板脚注明示收款方式。CTA 在次卡查询未沉降前保持加载态
 * （避免「有卡却按到店付建单」的涉钱误提交）。
 *
 * SSE（任务书：事件到达 invalidate 对应 query）：服务中态下 push.subscribe 登记后
 * 连 /api/events?watch=<aid>，step_updated/step_flagged/completed/reopened 等事件
 * → invalidate ['serviceStep','list',aid] + ['appointment']（listMine 随之重取，
 * 完成/重开后面板自动在双态间切换）。clientId 与直播页同一 localStorage 键。
 *
 * GroomingReminder 共存（历史）：B9a 曾按 onModeChange 上报的 mode 控制提醒卡显隐；
 * B9.3 首页完整改版已下掉 GroomingReminder（下掉清单），onModeChange 暂保留不再被消费。
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EventType,
  getApiBase,
  getStepDef,
  safeUuid,
  useEventSource,
  useMe,
  usePhiliaClient,
  type EventEnvelope,
} from '@philia/shared';
import type { AppointmentListItem } from '@/components/booking/types';
import { readLastBooking, resolvePetId, resolveServiceId } from '@/lib/bookingPrefill';
import RebookPanel from './RebookPanel';
import InServicePanel from './InServicePanel';

/** 面板模态：loading 数据沉降中 / rebook 一键再约 / in-service 服务中 / entry 降级入口卡 */
export type HomePanelMode = 'loading' | 'rebook' | 'in-service' | 'entry';

/** 降级原因（实证断言锚点，data-reason 外露） */
export type EntryReason =
  | 'no-memory'
  | 'store-unavailable'
  | 'pet-undecided'
  | 'no-service'
  | 'no-slot';

const CLIENT_ID_KEY = 'philia.sseClientId';

/** SSE clientId：与直播页同一 localStorage 键（契约 · push.subscribe 与 /api/events 共用）。
 * b9.1：一律走 safeUuid()——crypto.randomUUID 仅安全上下文存在，普通 HTTP 内测
 * 环境下 try/catch 两路同崩（VPS 实战捕获）；任何路径不得二次抛出。 */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = safeUuid();
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return safeUuid();
  }
}

/** 最新员工照片：跨步按 takenAt 新→旧取前 N 张（serviceStep.list 未失效照片，不新增接口） */
function latestPhotos(
  steps:
    | {
        photos: { id: string; url: string; thumbUrl: string | null; takenAt: Date | null }[];
      }[]
    | undefined,
  n: number,
): { id: string; thumbUrl: string }[] {
  const all = (steps ?? []).flatMap((s) => s.photos);
  all.sort((a, b) => (b.takenAt?.getTime() ?? 0) - (a.takenAt?.getTime() ?? 0));
  return all.slice(0, n).map((p) => ({ id: p.id, thumbUrl: p.thumbUrl ?? p.url }));
}

export default function HomeBookingPanel({
  onModeChange,
}: {
  /** 模态上报（HomePage 据此控制 GroomingReminder 共存关系） */
  onModeChange?: (mode: HomePanelMode) => void;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const { user } = useMe();

  /* ---- 数据源（全部复用既有 queryKey，命中缓存不增发） ---- */
  const mineQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user,
    staleTime: 60_000,
  });

  // 服务中预约：in_service 洗护单（六步流；寄养无六步，不触发本面板，维持常态）
  const inServiceAppt: AppointmentListItem | null = useMemo(() => {
    const rows = mineQ.data?.groups.in_service ?? [];
    return rows.find((a) => a.type === 'grooming') ?? null;
  }, [mineQ.data]);

  // B4-3 下单记忆（本次挂载读取一次；下单成功后页面已跳走，无需订阅变更）
  const memory = useMemo(() => readLastBooking(), []);
  const memoryStoreId = memory?.storeId ?? null;

  // 第一段：门店 + 服务目录（解析 B4-3 服务预填；记忆门店失效 → NOT_FOUND → 降级）
  const storeQ = useQuery({
    queryKey: ['store', 'getWithServices', memoryStoreId],
    queryFn: () => trpc.store.getWithServices.query({ storeId: memoryStoreId! }),
    enabled: !!user && memoryStoreId !== null,
  });

  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    enabled: !!user,
  });

  const groomingServices = useMemo(
    () => (storeQ.data?.services ?? []).filter((s) => s.type === 'grooming'),
    [storeQ.data],
  );
  const resolvedServiceId = useMemo(
    () => (storeQ.isSuccess ? resolveServiceId(null, groomingServices, memory) : null),
    [storeQ.isSuccess, groomingServices, memory],
  );

  // 宠物预解析（B9a 任务 C：时长引擎以 petId 推导服务时长；提前解析供第二段查询入参，
  // 与单屏 resolvePetId 同一函数同一口径）
  const resolvedPetId = useMemo(
    () => (petsQ.isSuccess ? resolvePetId(null, petsQ.data ?? [], memory) : null),
    [petsQ.isSuccess, petsQ.data, memory],
  );

  // 第二段：时长连续过滤槽（与单屏同一入参同一 queryKey；B9a 任务 C：带 petId
  // 走时长引擎——serviceDurations 联动「约 N 分钟」，可约槽按引擎时长过滤）
  const slotsQ = useQuery({
    queryKey: ['store', 'getWithServices', memoryStoreId, resolvedServiceId, resolvedPetId],
    queryFn: () =>
      trpc.store.getWithServices.query({
        storeId: memoryStoreId!,
        serviceId: resolvedServiceId ?? undefined,
        petId: resolvedPetId ?? undefined,
      }),
    enabled: !!user && memoryStoreId !== null && resolvedServiceId !== null && petsQ.isSuccess,
  });

  // 本人该店次卡（paymentMode 默认口径与单屏一致：有可用次卡 → pass_deduct）
  const passQ = useQuery({
    queryKey: ['pass', 'mine', memoryStoreId],
    queryFn: () => trpc.pass.mine.query({ storeId: memoryStoreId! }),
    enabled: !!user && memoryStoreId !== null,
  });
  const usablePass = (passQ.data ?? []).find((p) => p.usable) ?? null;

  // 服务中面板数据：六步 + 未失效照片（与直播页同一 queryKey）
  const stepsQ = useQuery({
    queryKey: ['serviceStep', 'list', inServiceAppt?.id],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: inServiceAppt!.id }),
    enabled: !!user && inServiceAppt !== null,
  });

  /* ---- SSE：服务中态事件到达 invalidate 对应 query（先 subscribe 再连 /api/events） ---- */
  const [clientId] = useState(getClientId);
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (!user || !inServiceAppt) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = () => {
      trpc.push.subscribe
        .mutate({ clientId, appType: 'customer' })
        .then(() => {
          if (!cancelled) setSubscribed(true);
        })
        .catch(() => {
          if (!cancelled) timer = window.setTimeout(attempt, 5000);
        });
    };
    attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trpc, clientId, user, inServiceAppt]);

  const sseUrl =
    subscribed && inServiceAppt
      ? `${getApiBase()}/api/events?client_id=${encodeURIComponent(clientId)}&watch=${encodeURIComponent(inServiceAppt.id)}`
      : null;

  const alignInService = () => {
    if (!inServiceAppt) return;
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', inServiceAppt.id] });
    void queryClient.invalidateQueries({ queryKey: ['appointment'] });
  };
  const alignRef = useRef(alignInService);
  alignRef.current = alignInService;

  useEventSource({
    url: sseUrl,
    onEvent: (envelope: EventEnvelope) => {
      switch (envelope.type) {
        case EventType.StepUpdated:
        case EventType.StepFlagged:
        case EventType.AppointmentCompleted:
        case EventType.AppointmentReopened:
        case EventType.AppointmentCancelled:
        case EventType.AppointmentCheckedIn:
          alignRef.current();
          break;
        default:
          break;
      }
    },
    onReconnect: () => alignRef.current(),
  });

  /* ---- 模态决策（不替用户猜） ---- */
  type Derived =
    | { mode: 'loading' }
    | { mode: 'in-service' }
    | { mode: 'entry'; reason: EntryReason }
    | {
        mode: 'rebook';
        earliest: Date;
        service: { id: string; name: string; priceFen: number; durationMin: number | null };
        pet: { id: string; name: string };
        storeName: string;
        paymentMode: 'pay_at_store' | 'pass_deduct';
        passRemainTimes: number | null;
      };

  const derived = useMemo<Derived>(() => {
    if (mineQ.isPending) return { mode: 'loading' };
    if (inServiceAppt) return { mode: 'in-service' };
    if (memoryStoreId === null) return { mode: 'entry', reason: 'no-memory' };
    if (storeQ.isError || slotsQ.isError) return { mode: 'entry', reason: 'store-unavailable' };
    if (storeQ.isPending || petsQ.isPending || passQ.isPending) return { mode: 'loading' };
    if (!resolvedServiceId) return { mode: 'entry', reason: 'no-service' };
    if (slotsQ.isPending) return { mode: 'loading' };
    const pets = petsQ.data ?? [];
    if (!resolvedPetId) return { mode: 'entry', reason: 'pet-undecided' };
    const slots = slotsQ.data?.slots ?? [];
    const earliest = slots.reduce<Date | null>(
      (m, s) => (m === null || s.slotStart < m ? s.slotStart : m),
      null,
    );
    if (!earliest) return { mode: 'entry', reason: 'no-slot' };
    const serviceRow = groomingServices.find((s) => s.id === resolvedServiceId) ?? null;
    const pet = pets.find((p) => p.id === resolvedPetId) ?? null;
    if (!serviceRow || !pet) return { mode: 'entry', reason: 'store-unavailable' };
    // B9a 任务 C：「约 N 分钟」以时长引擎输出为准（serviceDurations），未输出回退默认
    const engineDurationMin = slotsQ.data?.serviceDurations?.[serviceRow.id]?.durationMin ?? null;
    return {
      mode: 'rebook',
      earliest,
      service: { ...serviceRow, durationMin: engineDurationMin ?? serviceRow.durationMin },
      pet,
      storeName: storeQ.data?.store.name ?? '',
      paymentMode: usablePass ? 'pass_deduct' : 'pay_at_store',
      passRemainTimes: usablePass ? usablePass.remainTimes : null,
    };
  }, [
    mineQ.isPending,
    inServiceAppt,
    memoryStoreId,
    storeQ.isError,
    storeQ.isPending,
    storeQ.data,
    slotsQ.isError,
    slotsQ.isPending,
    slotsQ.data,
    petsQ.isPending,
    petsQ.data,
    passQ.isPending,
    resolvedServiceId,
    resolvedPetId,
    groomingServices,
    memory,
    usablePass,
  ]);

  const mode: HomePanelMode = derived.mode;
  const reason: EntryReason | null = derived.mode === 'entry' ? derived.reason : null;

  // 模态上报（GroomingReminder 共存控制；仅变化时触发，避免重复渲染）
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  /* ---- 渲染 ---- */
  if (mode === 'loading') {
    return (
      <div
        data-testid="home-booking-loading"
        aria-label="加载中"
        className="animate-pulse rounded-card bg-card p-4 shadow-card"
      >
        <div className="h-5 w-24 rounded-tag bg-sunken" />
        <div className="mt-3 space-y-2.5">
          <div className="h-4 rounded-tag bg-sunken" />
          <div className="h-4 rounded-tag bg-sunken" />
          <div className="h-4 w-3/4 rounded-tag bg-sunken" />
        </div>
        <div className="mt-4 h-12 rounded-card bg-sunken" />
      </div>
    );
  }

  if (mode === 'in-service' && inServiceAppt) {
    const steps = stepsQ.data ?? [];
    const active = steps.find((s) => s.status === 'active') ?? null;
    return (
      <InServicePanel
        appointmentId={inServiceAppt.id}
        petName={inServiceAppt.petName ?? '爱宠'}
        stepName={active ? (getStepDef(active.stepKey)?.name ?? null) : null}
        stepOrder={active?.stepOrder ?? null}
        totalSteps={6}
        doneCount={steps.filter((s) => s.status === 'done').length}
        photos={latestPhotos(steps, 3)}
      />
    );
  }

  if (derived.mode === 'rebook') {
    return (
      <RebookPanel
        storeId={memoryStoreId!}
        storeName={derived.storeName || '菲丽亚宠物'}
        serviceId={derived.service.id}
        serviceName={derived.service.name}
        priceFen={derived.service.priceFen}
        durationMin={derived.service.durationMin}
        petId={derived.pet.id}
        petName={derived.pet.name}
        slot={derived.earliest}
        paymentMode={derived.paymentMode}
        passRemainTimes={derived.passRemainTimes}
      />
    );
  }

  // 降级入口卡：进单屏（B4-3 预填链在单屏内继续生效），不替用户猜
  return (
    <Link
      to="/booking/grooming"
      data-testid="home-booking-entry"
      data-reason={reason ?? 'no-memory'}
      className="flex items-center gap-3 rounded-card bg-card p-4 shadow-card transition-transform duration-120 ease-philia-spring active:scale-[0.97]"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="shrink-0 text-brand-primary"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 21h10" />
        <path d="M12 21v-3" />
        <path d="M4 13c0-4.4 3.6-8 8-8s8 3.6 8 8c0 1.5-.4 2.9-1.1 4.1-.3.5-.9.9-1.6.9H6.7c-.7 0-1.3-.4-1.6-.9C4.4 15.9 4 14.5 4 13Z" />
        <path d="M9 9.5c.8-.8 1.9-1.3 3-1.3" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">预约洗护</span>
        <span className="block text-caption text-ink-secondary">选择门店、服务和时间</span>
      </span>
      <span className="shrink-0 text-body text-ink-secondary" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
