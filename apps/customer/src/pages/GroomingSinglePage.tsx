/**
 * B4-1 洗护预约 · 单屏页（设计方案第二节为唯一交互基准）：
 * 自上而下 —— 顶部栏「← 预约洗护」→ 宠物卡（点按弹底部半屏宠物列表；无宠物→先建档岔路卡）
 * → 服务 chips（横排 ≤4 +「更多服务 ▸」渐进披露）→ 门店单行（「更换 ▸」底部半屏，不跳页）
 * → 日期横条（未来 7 天，约满日置灰，「展开整月日历 ▸」二级）→ 时段栅格（上午/下午/晚上
 * 分组，满槽/已过/+1h 内灰显，批次 3 口径）→ 折叠区（收款方式单行选择器 + 添加备注 ▸ +
 * 指定洗护师 ▸，默认收起）→ 吸底大按钮「确认预约 · ¥X · 约 N 分钟」。
 *
 * B4-3 预填：URL ?storeId/?serviceId/?petId（最高优先，批次 2 现状逻辑同源）
 * > localStorage 上次成功下单记忆 > 默认（最近门店 / 该店首个在架洗护项 / 唯一宠物直选，
 * 多宠物不替选显示「请选择」）。提交成功写入 localStorage 记忆。
 *
 * 提交即现有 appointment.create（入参不动）；指定洗护师仍以备注前缀传达；
 * 成功进现有成功页 /booking/success?aid=。旧 4 屏向导保留于 /booking/grooming/wizard。
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import { friendlyError, useToast } from '@/components/booking/Toast';
import PetCardBlock from '@/components/booking/single/PetCardBlock';
import ServiceChipsBlock from '@/components/booking/single/ServiceChipsBlock';
import StoreLineBlock from '@/components/booking/single/StoreLineBlock';
import DateStripBlock from '@/components/booking/single/DateStripBlock';
import TimeGridBlock from '@/components/booking/single/TimeGridBlock';
import ExtrasBlock from '@/components/booking/single/ExtrasBlock';
import ConfirmBar from '@/components/booking/single/ConfirmBar';
import { buildWeekGrid, isSameDay } from '@/components/booking/single/slotGrid';
import { readLastBooking, resolvePetId, resolveServiceId, resolveStoreId, writeLastBooking } from '@/lib/bookingPrefill';

export default function GroomingSinglePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast();

  /* ---- 选择状态（URL 预填参数初始化，优先级最高） ---- */
  const [storeId, setStoreId] = useState<string | null>(searchParams.get('storeId'));
  const [serviceId, setServiceId] = useState<string | null>(searchParams.get('serviceId'));
  const [petId, setPetId] = useState<string | null>(searchParams.get('petId'));
  const [staffId, setStaffId] = useState<string | null>(null); // null = 随缘
  const [day, setDay] = useState<Date | null>(null);
  // 用户显式选过日后不再自动改选（自动预选在数据到位前可能落在无槽的今天）
  const [dayTouched, setDayTouched] = useState(false);
  const [slot, setSlot] = useState<Date | null>(null);
  const [paymentMode, setPaymentMode] = useState<'pay_at_store' | 'pass_deduct'>('pay_at_store');
  const [note, setNote] = useState('');

  /* ---- 数据 ---- */
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  });
  const effStoreId = storeId;

  const servicesQ = useQuery({
    queryKey: ['store', 'getWithServices', effStoreId, serviceId],
    queryFn: () =>
      trpc.store.getWithServices.query({
        storeId: effStoreId!,
        serviceId: serviceId ?? undefined,
      }),
    enabled: effStoreId !== null,
  });

  const staffQ = useQuery({
    queryKey: ['store', 'listStaffPublic', effStoreId],
    queryFn: () => trpc.store.listStaffPublic.query({ storeId: effStoreId! }),
    enabled: effStoreId !== null,
  });

  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
  });

  // B2-7：本人该店次卡（收款方式「次卡扣次」余量/置灰的数据源；一店一卡，取首张可用）
  const passQ = useQuery({
    queryKey: ['pass', 'mine', effStoreId],
    queryFn: () => trpc.pass.mine.query({ storeId: effStoreId! }),
    enabled: effStoreId !== null,
  });
  const usablePass = (passQ.data ?? []).find((p) => p.usable) ?? null;

  // 宠物卡「上次洗护」摘要行（复用 appointment.listMine，不新增接口）
  const mineQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
  });

  /* ---- B4-3 预填解析：URL > localStorage 上次下单 > 默认 ---- */
  // URL 参数变化（一键预约/再次预约带参深链，页面已挂载时）重新应用，优先级最高
  useEffect(() => {
    const s = searchParams.get('storeId');
    const v = searchParams.get('serviceId');
    const p = searchParams.get('petId');
    if (s) setStoreId(s);
    if (v) setServiceId(v);
    if (p) setPetId(p);
    if (s || v) setSlot(null);
  }, [searchParams]);

  // 门店：URL/用户选择有效则保留，否则上次记忆，否则最近门店（listNearby 第一家）
  useEffect(() => {
    if (!nearbyQ.isSuccess) return;
    const resolved = resolveStoreId(storeId, nearbyQ.data.stores, readLastBooking());
    if (resolved !== storeId) setStoreId(resolved);
  }, [nearbyQ.isSuccess, nearbyQ.data, storeId]);

  const groomingServices = useMemo(
    () => (servicesQ.data?.services ?? []).filter((s) => s.type === 'grooming'),
    [servicesQ.data],
  );

  // 服务：URL 有效则保留，否则上次记忆，否则该店首个在架洗护项（推荐位）
  useEffect(() => {
    if (!servicesQ.isSuccess) return;
    const resolved = resolveServiceId(serviceId, groomingServices, readLastBooking());
    if (resolved !== serviceId) {
      setServiceId(resolved);
      setSlot(null);
    }
  }, [servicesQ.isSuccess, groomingServices, serviceId]);

  // 宠物：URL 有效则保留，否则上次记忆，否则唯一宠物直选；多宠物不替选（「请选择」）
  useEffect(() => {
    if (!petsQ.isSuccess) return;
    const pets = petsQ.data ?? [];
    const resolved = resolvePetId(petId, pets, readLastBooking());
    if (resolved !== petId) setPetId(resolved);
  }, [petsQ.isSuccess, petsQ.data, petId]);

  // 用户手动改过收款方式后不再自动覆盖（换店时重置允许重新默认）
  const [passTouched, setPassTouched] = useState(false);
  // 有可用次卡默认次卡（设计方案）；次卡不可用而仍选中 → 强制回退到店付（B2-7 联动保留）
  useEffect(() => {
    if (!passQ.isSuccess) return;
    if (usablePass && paymentMode === 'pay_at_store' && !passTouched) {
      setPaymentMode('pass_deduct');
    } else if (!usablePass && paymentMode === 'pass_deduct') {
      setPaymentMode('pay_at_store');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passQ.isSuccess, usablePass, effStoreId]);

  /* ---- 日期/时段栅格（getWithServices 合成，批次 3 口径） ---- */
  const store = servicesQ.data?.store ?? nearbyQ.data?.stores.find((s) => s.id === effStoreId) ?? null;
  const slots = useMemo(() => servicesQ.data?.slots ?? [], [servicesQ.data]);
  const days = useMemo(() => (store ? buildWeekGrid(store, slots) : []), [store, slots]);

  // 默认选中日：首个有可约槽的日子；用户未显式选过且当前日无可约槽时，数据到位后自动改选
  useEffect(() => {
    if (days.length === 0 || dayTouched) return;
    const cur = day ? (days.find((d) => isSameDay(d.date, day)) ?? null) : null;
    if (cur?.hasAvailable) return;
    const first = days.find((d) => d.hasAvailable) ?? days[0]!;
    if (!cur || first.date.getTime() !== cur.date.getTime()) setDay(first.date);
  }, [days, day, dayTouched]);

  const selectedDayGrid = day ? (days.find((d) => isSameDay(d.date, day)) ?? null) : null;

  /* ---- 联动：换门店清服务/员工/时间；换服务/换日清时间 ---- */
  const pickStore = (id: string) => {
    if (id === effStoreId) return;
    setStoreId(id);
    setServiceId(null); // 触发服务预填重解析（新店首个在架项）
    setStaffId(null);
    setDay(null);
    setDayTouched(false);
    setSlot(null);
    setPassTouched(false);
  };
  const pickService = (id: string) => {
    if (id !== serviceId) setSlot(null);
    setServiceId(id);
  };
  const pickDay = (d: Date) => {
    if (!day || !isSameDay(d, day)) setSlot(null);
    setDayTouched(true);
    setDay(d);
  };

  /* ---- 宠物卡「上次洗护」摘要（最近一单已完成洗护；无则取最近一次过去的洗护） ---- */
  const lastGroomingLabel = useMemo(() => {
    if (!petId || !mineQ.data) return null;
    const all = Object.values(mineQ.data.groups).flat();
    const mine = all.filter(
      (a) => a.type === 'grooming' && a.petId === petId && a.status !== 'cancelled' && a.status !== 'cancel_requested',
    );
    const now = Date.now();
    const last =
      mine.find((a) => a.status === 'completed') ??
      mine.find((a) => new Date(a.scheduledStart).getTime() < now) ??
      null;
    if (!last) return null;
    const d = new Date(last.scheduledStart);
    return `上次洗护 ${d.getMonth() + 1}.${d.getDate()} · ${last.serviceName ?? '洗护'}`;
  }, [mineQ.data, petId]);

  /* ---- 提交（现有 appointment.create，入参不动） ---- */
  const service = groomingServices.find((s) => s.id === serviceId) ?? null;
  const staffName = staffQ.data?.staff.find((s) => s.id === staffId)?.name ?? null;

  const createM = useMutation({
    mutationFn: () => {
      const noteParts = [staffName ? `【希望洗护师：${staffName}】` : '', note.trim()].filter(Boolean);
      return trpc.appointment.create.mutate({
        storeId: effStoreId!,
        petId: petId!,
        serviceId: serviceId!,
        type: 'grooming',
        scheduledStart: slot!,
        paymentMode,
        ...(noteParts.length > 0 ? { note: noteParts.join(' ') } : {}),
      });
    },
    onSuccess: (appt) => {
      // B4-3：记忆上次成功下单，下次进单屏即预填
      writeLastBooking({ storeId: effStoreId!, serviceId: serviceId!, petId: petId! });
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      void queryClient.invalidateQueries({ queryKey: ['pass'] }); // B2-7：扣次后刷新次卡余额
      navigate(`/booking/success?aid=${encodeURIComponent(appt.id)}`, { replace: true });
    },
    onError: (err) => {
      showToast(friendlyError(err, '预约失败，请稍后再试'));
      // 满槽/冲突：刷新槽位数据让用户重选（现状逻辑保留）
      void servicesQ.refetch();
    },
  });

  /* ---- 确认按钮三态：缺项点名（顺序同屏面区块） ---- */
  const noPets = petsQ.isSuccess && (petsQ.data?.length ?? 0) === 0;
  const missingLabel = noPets
    ? '请先建立宠物档案'
    : petId === null
      ? '请选择宠物'
      : effStoreId === null
        ? '请选择门店'
        : serviceId === null
          ? '请选择服务'
          : slot === null
            ? '请选择时间'
            : null;

  /* ---- 渲染：单屏区块化（v4.1：留白 + hairline 分节，时段栅格紧贴日期横条） ---- */
  // 节间 hairline：既有 token 深棕墨 4A3B2E 的 9% 透明度用法（设计规格 v3 §1）
  const SECTION = 'mt-6 border-t border-[rgba(74,59,46,.09)] pt-5';
  return (
    <div className="px-4 pb-36 pt-6" data-testid="grooming-single">
      {toastEl}

      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="返回"
          className="flex h-9 w-9 items-center justify-center rounded-full active:scale-92"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink-secondary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-title-lg">预约洗护</h1>
      </header>

      {/* 宠物卡 */}
      <section className="mt-4">
        <PetCardBlock
          pets={petsQ.data ?? []}
          selectedId={petId}
          onSelect={setPetId}
          lastGroomingLabel={lastGroomingLabel}
          loading={petsQ.isPending}
        />
      </section>

      {/* 服务 chips */}
      <section className={SECTION}>
        <h2 className="text-title">选择服务</h2>
        <div className="mt-2">
          <ServiceChipsBlock
            services={groomingServices}
            selectedId={serviceId}
            onSelect={pickService}
            loading={servicesQ.isPending}
          />
        </div>
      </section>

      {/* 门店单行 */}
      <section className={SECTION}>
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

      {/* 日期横条 + 时段栅格（v4.1：栅格上移紧贴日期区，同一节内） */}
      <section className={SECTION}>
        <h2 className="text-title">选择日期</h2>
        <div className="mt-2">
          <DateStripBlock days={days} selectedDay={day} onPickDay={pickDay} />
        </div>
        <div className="mt-4">
          <TimeGridBlock
            day={selectedDayGrid}
            slots={slots}
            selected={slot}
            onSelect={setSlot}
            loading={servicesQ.isPending || servicesQ.isFetching}
          />
        </div>
      </section>

      {/* 折叠区：收款方式 + 备注 + 指定洗护师 */}
      <section className={SECTION}>
        <ExtrasBlock
          paymentMode={paymentMode}
          onPaymentModeChange={(m) => {
            setPaymentMode(m);
            setPassTouched(true);
          }}
          usablePass={usablePass}
          passLoading={passQ.isPending}
          note={note}
          onNoteChange={setNote}
          staff={staffQ.data?.staff ?? []}
          staffId={staffId}
          onStaffChange={setStaffId}
          staffLoading={staffQ.isPending}
        />
      </section>

      {/* 吸底确认条（fixed 于 TabBar 上方） */}
      <ConfirmBar
        priceFen={service?.priceFen ?? null}
        durationMin={service?.durationMin ?? null}
        missingLabel={missingLabel}
        submitting={createM.isPending}
        onConfirm={() => createM.mutate()}
      />
    </div>
  );
}
