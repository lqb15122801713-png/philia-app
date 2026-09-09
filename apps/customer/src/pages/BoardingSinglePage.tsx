/**
 * B4-2 寄养预约 · 单屏页（设计方案第三节为唯一交互基准）：
 * 自上而下 —— 顶部栏「← 预约寄养」→ 宠物卡（点按弹底部半屏宠物列表，带疫苗硬校验；
 * 无宠物→先建档岔路卡）→ 入住/退房两个大日期格（点按弹底部半屏单列月历 range picker，
 * 点入住→点退房自动应用并关闭；实时「共 N 晚 · 单晚 ¥X」）→ 房型区（B4-4：单房型只读
 * 信息卡；多房型选择器，「余 N 间」透出保留）→ 门店单行（「更换 ▸」底部半屏，不跳页）
 * → 折叠区（添加备注 ▸，寄养固定到店付不渲染收款选择器）→ 吸底按钮
 * 「确认预约 · 共 N 晚 ¥X」（三态同洗护：可点 / 置灰点名缺项 / 提交中）。
 *
 * 硬规则保留（与旧向导同口径）：入住时刻 ≥ 当前+1h、门店休息日禁选、退房 > 入住、
 * 疫苗有效期须覆盖至退房日（不满足 → 按钮置灰 + 红条「疫苗将于 X 到期，请先补录 ▸」）。
 * 满晚 CONFLICT：toast 原文 + 刷新余量（现状逻辑保留）。
 *
 * B4-3 预填：URL ?storeId/?serviceId/?petId（最高优先）> localStorage 上次成功下单记忆
 * > 默认（最近门店 / 该店首个寄养房型 / 唯一宠物直选）。提交成功写入 localStorage 记忆。
 *
 * 提交即现有 appointment.create（scheduledStart=入住日开店时刻、scheduledEnd=退房日同时刻，
 * 入参不动）；成功进现有成功页 /booking/success?aid=。
 * 旧 4 屏向导保留于隐藏路由 /booking/boarding/wizard（回滚保障）。
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import { checkinAt } from '@/components/booking/BoardingDateRangePicker';
import { friendlyError, useToast } from '@/components/booking/Toast';
import { isoToDate, nightsBetween, toISODate } from '@/components/booking/format';
import PetCardBlock from '@/components/booking/single/PetCardBlock';
import BoardingDatesBlock from '@/components/booking/single/BoardingDatesBlock';
import BoardingRangeSheet from '@/components/booking/single/BoardingRangeSheet';
import RoomTypeBlock from '@/components/booking/single/RoomTypeBlock';
import StoreLineBlock from '@/components/booking/single/StoreLineBlock';
import NoteFoldBlock from '@/components/booking/single/NoteFoldBlock';
import BoardingConfirmBar, { type VaccineBlock } from '@/components/booking/single/BoardingConfirmBar';
import { readLastBooking, resolvePetId, resolveServiceId, resolveStoreId, writeLastBooking } from '@/lib/bookingPrefill';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** 门店某日是否休息 */
const isClosed = (store: { openHours?: Record<string, unknown> | null } | null, d: Date) =>
  !store?.openHours?.[DAY_KEYS[d.getDay()]!];

export default function BoardingSinglePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast();

  /* ---- 选择状态（URL 预填参数初始化，优先级最高） ---- */
  const [storeId, setStoreId] = useState<string | null>(searchParams.get('storeId'));
  const [serviceId, setServiceId] = useState<string | null>(searchParams.get('serviceId'));
  const [petId, setPetId] = useState<string | null>(searchParams.get('petId'));
  const [checkin, setCheckin] = useState<Date | null>(null);
  const [checkout, setCheckout] = useState<Date | null>(null);
  // B2-7R（产品裁定A）：次卡仅洗护可用，寄养固定到店付（不渲染收款选择器）
  const paymentMode = 'pay_at_store' as const;
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<{ open: boolean; phase: 'checkin' | 'checkout' }>({
    open: false,
    phase: 'checkin',
  });

  /* ---- 数据 ---- */
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  });
  const effStoreId = storeId;

  const servicesQ = useQuery({
    queryKey: ['store', 'getWithServices', effStoreId, 'boarding-single'],
    queryFn: () => trpc.store.getWithServices.query({ storeId: effStoreId! }),
    enabled: effStoreId !== null,
  });
  const boardingServices = useMemo(
    () => (servicesQ.data?.services ?? []).filter((s) => s.type === 'boarding'),
    [servicesQ.data],
  );
  const service = boardingServices.find((s) => s.id === serviceId) ?? null;

  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
  });

  /* ---- B4-3 预填解析：URL > localStorage 上次下单 > 默认 ---- */
  useEffect(() => {
    const s = searchParams.get('storeId');
    const v = searchParams.get('serviceId');
    const p = searchParams.get('petId');
    if (s) setStoreId(s);
    if (v) setServiceId(v);
    if (p) setPetId(p);
  }, [searchParams]);

  // 门店：URL/用户选择有效则保留，否则上次记忆，否则最近门店（listNearby 第一家）
  useEffect(() => {
    if (!nearbyQ.isSuccess) return;
    const resolved = resolveStoreId(storeId, nearbyQ.data.stores, readLastBooking());
    if (resolved !== storeId) setStoreId(resolved);
  }, [nearbyQ.isSuccess, nearbyQ.data, storeId]);

  // 房型：URL 有效则保留，否则上次记忆，否则该店首个寄养房型（单房型即自动选中）
  useEffect(() => {
    if (!servicesQ.isSuccess) return;
    const resolved = resolveServiceId(serviceId, boardingServices, readLastBooking());
    if (resolved !== serviceId) setServiceId(resolved);
  }, [servicesQ.isSuccess, boardingServices, serviceId]);

  // 宠物：URL 有效则保留，否则上次记忆，否则唯一宠物直选；多宠物不替选（「请选择」）
  useEffect(() => {
    if (!petsQ.isSuccess) return;
    const resolved = resolvePetId(petId, petsQ.data ?? [], readLastBooking());
    if (resolved !== petId) setPetId(resolved);
  }, [petsQ.isSuccess, petsQ.data, petId]);

  const store = nearbyQ.data?.stores.find((s) => s.id === effStoreId) ?? null;

  /* ---- 房型逐晚余量（B3-2 数据源不动）：已选区间查区间，未选日期查「今晚」 ---- */
  const availRange = useMemo(() => {
    if (checkin && checkout) return { from: checkin, to: checkout, tonight: false };
    const t0 = new Date();
    const d0 = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
    return { from: d0, to: new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1), tonight: true };
  }, [checkin, checkout]);
  const availQ = useQuery({
    queryKey: ['store', 'boardingAvailability', effStoreId, availRange.from.getTime(), availRange.to.getTime()],
    queryFn: () =>
      trpc.store.boardingAvailability.query({
        storeId: effStoreId!,
        from: availRange.from,
        to: availRange.to,
      }),
    enabled: effStoreId !== null,
  });
  const remainingOf = (sid: string): number | null => {
    const row = availQ.data?.services.find((a) => a.serviceId === sid);
    if (!row || row.remaining.length === 0) return null;
    return Math.min(...row.remaining);
  };

  /* ---- 联动：换门店清房型（触发重解析），落在休息日的日期清掉（旧向导逻辑保留） ---- */
  const pickStore = (id: string) => {
    if (id === effStoreId) return;
    setStoreId(id);
    setServiceId(null);
    const next = nearbyQ.data?.stores.find((s) => s.id === id) ?? null;
    if (checkin && isClosed(next, checkin)) setCheckin(null);
    if (checkout && isClosed(next, checkout)) setCheckout(null);
  };

  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0;

  /* ---- 疫苗硬校验：有效期须覆盖至退房日（含），同 PetPicker 口径 ---- */
  const pet = (petsQ.data ?? []).find((p) => p.id === petId) ?? null;
  const vaccineBlock: VaccineBlock | null = useMemo(() => {
    if (!pet || !checkout) return null;
    const ok = pet.vaccineValidUntil
      ? toISODate(isoToDate(pet.vaccineValidUntil)) >= toISODate(checkout)
      : false;
    return ok ? null : { petName: pet.name, until: pet.vaccineValidUntil ?? null };
  }, [pet, checkout]);

  /* ---- 提交（现有 appointment.create，入参不动） ---- */
  const createM = useMutation({
    mutationFn: () => {
      if (!store || !checkin || !checkout) throw new Error('信息不完整');
      return trpc.appointment.create.mutate({
        storeId: store.id,
        petId: petId!,
        serviceId: serviceId!,
        type: 'boarding',
        scheduledStart: checkinAt(store, checkin),
        scheduledEnd: checkinAt(store, checkout),
        paymentMode,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    },
    onSuccess: (appt) => {
      // B4-3：记忆上次成功下单，下次进单屏即预填
      writeLastBooking({ storeId: effStoreId!, serviceId: serviceId!, petId: petId! });
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      // B3-2：下单占晚后余量变化，使余量缓存失效
      void queryClient.invalidateQueries({ queryKey: ['store', 'boardingAvailability'] });
      navigate(`/booking/success?aid=${encodeURIComponent(appt.id)}`, { replace: true });
    },
    onError: (err) => {
      // 满晚 CONFLICT：toast 原文 + 刷新余量（现状逻辑保留）
      showToast(friendlyError(err, '预约失败，请稍后再试'));
      void availQ.refetch();
    },
  });

  /* ---- 确认按钮三态：缺项点名（顺序同屏面区块） ---- */
  const noPets = petsQ.isSuccess && (petsQ.data?.length ?? 0) === 0;
  const missingLabel = noPets
    ? '请先建立宠物档案'
    : petId === null
      ? '请选择宠物'
      : checkin === null
        ? '请选择入住日期'
        : checkout === null
          ? '请选择退房日期'
          : servicesQ.isSuccess && boardingServices.length === 0
            ? '该门店暂无寄养房型'
            : serviceId === null
              ? '请选择房型'
              : effStoreId === null
                ? '请选择门店'
                : null;

  /* ---- 渲染：单屏区块化（区块顺序即设计方案第三节） ---- */
  return (
    <div className="px-4 pb-36 pt-6" data-testid="boarding-single">
      {toastEl}

      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="返回"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-card active:scale-92"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink-secondary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-title-lg">预约寄养</h1>
      </header>

      {/* 宠物卡（选宠半屏带疫苗硬校验） */}
      <section className="mt-4">
        <PetCardBlock
          pets={petsQ.data ?? []}
          selectedId={petId}
          onSelect={setPetId}
          requireVaccineUntil={checkout}
          pickerHint="点按选择要寄养的毛孩子"
          loading={petsQ.isPending}
        />
      </section>

      {/* 入住/退房日期（底部月历 range picker） */}
      <section className="mt-5">
        <h2 className="text-title">入住 / 退房日期</h2>
        <div className="mt-2">
          <BoardingDatesBlock
            checkin={checkin}
            checkout={checkout}
            nights={nights}
            perNightFen={service?.priceFen ?? null}
            onOpen={(phase) => setSheet({ open: true, phase })}
          />
        </div>
      </section>

      {/* 房型区（单房型只读信息卡 / 多房型选择器，数据驱动） */}
      <section className="mt-5">
        <h2 className="text-title">寄养房型</h2>
        <div className="mt-2">
          <RoomTypeBlock
            services={boardingServices}
            selectedId={serviceId}
            onSelect={setServiceId}
            remainingOf={remainingOf}
            tonight={availRange.tonight}
            loading={servicesQ.isPending}
            error={servicesQ.isError}
            onRetry={() => void servicesQ.refetch()}
          />
        </div>
      </section>

      {/* 门店单行 */}
      <section className="mt-5">
        <h2 className="text-title">门店</h2>
        <div className="mt-2">
          <StoreLineBlock
            stores={nearbyQ.data?.stores ?? []}
            currentStoreId={effStoreId}
            currentStoreName={store?.name ?? null}
            onPick={pickStore}
            loading={nearbyQ.isPending}
          />
        </div>
      </section>

      {/* 折叠区：备注（寄养固定到店付，无收款选择器） */}
      <section className="mt-5">
        <NoteFoldBlock note={note} onNoteChange={setNote} />
      </section>

      {/* 底部半屏单列月历 range picker（点入住 → 点退房自动应用并关闭） */}
      {sheet.open ? (
        <BoardingRangeSheet
          store={store}
          checkin={checkin}
          checkout={checkout}
          initialPhase={sheet.phase}
          onApply={(ni, no) => {
            setCheckin(ni);
            setCheckout(no);
            setSheet((s) => ({ ...s, open: false }));
          }}
          onClose={() => setSheet((s) => ({ ...s, open: false }))}
        />
      ) : null}

      {/* 吸底确认条（fixed 于 TabBar 上方；疫苗阻断红条内置） */}
      <BoardingConfirmBar
        nights={nights}
        totalFen={service ? service.priceFen * Math.max(nights, 0) : 0}
        missingLabel={missingLabel}
        vaccineBlock={vaccineBlock}
        submitting={createM.isPending}
        onConfirm={() => createM.mutate()}
      />
    </div>
  );
}
