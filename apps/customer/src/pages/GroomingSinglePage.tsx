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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import { friendlyError, useToast } from '@philia/shared';
import PageHeader from '@/components/PageHeader';
import PetCardBlock from '@/components/booking/single/PetCardBlock';
import ServiceChipsBlock from '@/components/booking/single/ServiceChipsBlock';
import StoreLineBlock from '@/components/booking/single/StoreLineBlock';
import DateStripBlock from '@/components/booking/single/DateStripBlock';
import TimeGridBlock from '@/components/booking/single/TimeGridBlock';
import ExtrasBlock from '@/components/booking/single/ExtrasBlock';
import ConfirmBar from '@/components/booking/single/ConfirmBar';
import StaffPickerFlat from '@/components/booking/single/StaffPickerFlat';
import { buildWeekGrid, isSameDay } from '@/components/booking/single/slotGrid';
import { dayLabel, fmtHM } from '@/components/booking/format';
import { readLastBooking, resolvePetId, resolveServiceId, resolveStoreId, writeLastBooking } from '@/lib/bookingPrefill';
import { createAppointmentExp2, queryFullAlternatives } from '@/lib/exp2Api';
import { bkc } from '@/copy/booking';

export default function GroomingSinglePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

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
  // 体验大批片 2：附加项多选（本店 type='addon' 服务 id 集）
  const [addonIds, setAddonIds] = useState<string[]>([]);

  /* ---- 数据 ---- */
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  });
  const effStoreId = storeId;

  const servicesQ = useQuery({
    // B9a 任务 C：petId 入参驱动时长引擎（serviceDurations + 时长连续过滤按引擎时长）；
    // 换宠物即换时长口径，queryKey 带 petId 触发重取
    queryKey: ['store', 'getWithServices', effStoreId, serviceId, petId],
    queryFn: () =>
      trpc.store.getWithServices.query({
        storeId: effStoreId!,
        serviceId: serviceId ?? undefined,
        petId: petId ?? undefined,
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

  // 体验大批片 2：附加项=本店 type='addon' 服务（同一 getWithServices 读口筛出，不新增接口）
  const addonServices = useMemo(
    () =>
      (servicesQ.data?.services ?? [])
        .filter((s) => s.type === 'addon')
        .map((s) => ({ id: s.id, name: s.name, priceFen: s.priceFen })),
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

  // 体验大批片 2：满档留口——选中日栅格全满时查 fullAlternatives（形状定死
  // enabled=false，不画假推荐；仅渲染 note 置灰注记，note 缺省回退 copy 键）
  const dayFull =
    !!selectedDayGrid && !selectedDayGrid.closed && selectedDayGrid.grid.length > 0 && !selectedDayGrid.hasAvailable;
  const fullAltQ = useQuery({
    queryKey: ['store', 'fullAlternatives', effStoreId, day?.getTime()],
    queryFn: () => queryFullAlternatives(trpc, effStoreId!, day!),
    enabled: dayFull && effStoreId !== null && day !== null,
    retry: 0,
  });

  // U1-D：日期余量透出——逐日可约槽计数（slots 为服务端过滤后可约集，key=yyyy-m-d）
  const remainByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of slots) {
      const t = s.slotStart;
      const key = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [slots]);

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
    setAddonIds([]); // 附加项为本店服务，换店即清
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
  const petName = petsQ.data?.find((p) => p.id === petId)?.name ?? null;
  // U4-D1：随缘派单卡「最早可约 HH:MM」真值——可约槽集合（服务端过滤后）的最早时刻
  const earliestSlotLabel = useMemo(() => {
    if (slots.length === 0) return null;
    const t = Math.min(...slots.map((s) => s.slotStart.getTime()));
    return fmtHM(new Date(t));
  }, [slots]);
  // B9a 任务 C：确认条/服务 chips 的「约 N 分钟」按时长引擎联动（serviceDurations），
  // 引擎未输出（未选宠物/查询中）回退服务默认 durationMin
  const serviceDurations = servicesQ.data?.serviceDurations ?? null;
  const durationById = useMemo(
    () =>
      serviceDurations
        ? Object.fromEntries(Object.entries(serviceDurations).map(([id, d]) => [id, d.durationMin]))
        : null,
    [serviceDurations],
  );
  const engineDurationMin = serviceId ? (durationById?.[serviceId] ?? null) : null;

  // 体验大批片 2：确认条价格=主价+Σ附加（前端估，与 server 算同口径，最终以 server 结算为准）
  const addonTotalFen = addonServices
    .filter((a) => addonIds.includes(a.id))
    .reduce((sum, a) => sum + a.priceFen, 0);
  const totalFen = service ? service.priceFen + addonTotalFen : null;

  const toggleAddon = (id: string) =>
    setAddonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const createM = useMutation({
    mutationFn: () => {
      const noteParts = [staffName ? `【希望洗护师：${staffName}】` : '', note.trim()].filter(Boolean);
      return createAppointmentExp2(trpc, {
        storeId: effStoreId!,
        petId: petId!,
        serviceId: serviceId!,
        type: 'grooming',
        scheduledStart: slot!,
        paymentMode,
        ...(noteParts.length > 0 ? { note: noteParts.join(' ') } : {}),
        ...(addonIds.length > 0 ? { addonServiceIds: addonIds } : {}),
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
      showToast(friendlyError(err, '预约失败，请稍后再试'), 'error');
      // 满槽/冲突：刷新槽位数据让用户重选（现状逻辑保留）
      void servicesQ.refetch();
    },
  });

  /* ---- 确认按钮三态：缺项点名（顺序同屏面区块） ---- */
  const noPets = petsQ.isSuccess && (petsQ.data?.length ?? 0) === 0;
  const missingLabel = noPets
    ? bkc('booking.needPet')
    : petId === null
      ? bkc('booking.choosePet')
      : effStoreId === null
        ? bkc('booking.chooseStore')
        : serviceId === null
          ? bkc('booking.chooseService')
          : slot === null
            ? bkc('booking.chooseTime')
            : null;

  /* ---- 渲染：单屏区块化（v4.1：留白 + hairline 分节，时段栅格紧贴日期横条） ---- */
  // 节间 hairline：token 深棕墨 #3B2E24 的 9% 透明度（line.ring；换皮批片 2 换代旧暖墨谱系）
  // 截面题=sec-h 工艺（§4.1：16/800）
  const SECTION = 'mt-6 border-t border-line-ring pt-5';
  const SEC_H = 'text-v2-section';
  return (
    <div className="px-4 pb-36 pt-6" data-testid="grooming-single">
      {toastEl}

      {/* U1-A：统一返回条（←圆钮+标题）；B9.3 任务 B：hub 退役后寄养入口安置——右侧安静文字链 */}
      <PageHeader
        title={bkc('booking.groomingTitle')}
        right={
          <Link to="/booking/boarding" data-testid="grooming-to-boarding" className="text-caption text-ink">
            {bkc('booking.toBoarding')}
          </Link>
        }
      />

      {/* 宠物卡（B9a 任务 C：换宠物 → 时长引擎口径变化，已选时段清空重选） */}
      <section className="mt-4">
        <PetCardBlock
          pets={petsQ.data ?? []}
          selectedId={petId}
          onSelect={(id) => {
            if (id !== petId) setSlot(null);
            setPetId(id);
          }}
          lastGroomingLabel={lastGroomingLabel}
          loading={petsQ.isPending}
        />
      </section>

      {/* 服务 chips */}
      <section className={SECTION}>
        <h2 className={SEC_H}>选择服务</h2>
        <div className="mt-2">
          <ServiceChipsBlock
            services={groomingServices}
            selectedId={serviceId}
            onSelect={pickService}
            loading={servicesQ.isPending}
            durationById={durationById}
          />
        </div>
      </section>

      {/* 门店单行 */}
      <section className={SECTION}>
        <h2 className={SEC_H}>门店</h2>
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

      {/* U1-D：洗护师横卡（v9.1 美容师横卡——置顶「随缘派单」默认卡 + 横滑员工卡；
          由 ExtrasBlock 折叠区迁出为独立节，选择逻辑/备注前缀传达口径不变） */}
      <section className={SECTION}>
        <h2 className={SEC_H}>洗护师</h2>
        <div className="mt-2">
          <StaffPickerFlat
            staff={staffQ.data?.staff ?? []}
            selectedId={staffId}
            onSelect={setStaffId}
            loading={staffQ.isPending}
            earliestLabel={earliestSlotLabel}
          />
          <p className="mt-1 text-caption-xs text-ink-placeholder">{bkc('booking.staffNote')}</p>
        </div>
      </section>

      {/* 日期横条 + 时段栅格（v4.1：栅格上移紧贴日期区，同一节内） */}
      <section className={SECTION}>
        <h2 className={SEC_H}>选择日期</h2>
        <div className="mt-2">
          <DateStripBlock days={days} selectedDay={day} onPickDay={pickDay} remainByDay={remainByDay} />
        </div>
        <div className="mt-4">
          <TimeGridBlock
            day={selectedDayGrid}
            slots={slots}
            selected={slot}
            onSelect={setSlot}
            loading={servicesQ.isPending || servicesQ.isFetching}
          />
          {/* 体验大批片 2：满档注记行（fullAlternatives 定死 enabled=false → 只渲染
              note 置灰注记，不画假推荐；查询失败静默，不阻断改选日期/门店主路径） */}
          {dayFull && fullAltQ.isSuccess ? (
            <p
              data-testid="gs-full-note"
              className="mt-3 rounded-tag bg-sunken px-3 py-2 text-caption text-ink-placeholder"
            >
              {fullAltQ.data.note ?? bkc('booking.fullSlotFallback')}
            </p>
          ) : null}
        </div>
        {/* U1-D：时间摘要行（选中时段后透出，真实数据；未选不渲染）
            换皮批片 2：tfield 时间卡工艺（§4.4）——白卡 18，主行 14.5/800 + mono 9.5 副行；
            右「更改 ›」略——时段栅格同屏展开，无可开的弹层，不放假链 */}
        {slot ? (
          <div
            data-testid="gs-slot-summary"
            className="mt-4 rounded-[18px] border border-line bg-card px-4 py-3.5"
          >
            <p className="text-[14.5px] font-extrabold leading-5">
              已选时间 <span className="u1-num">{dayLabel(slot)} {fmtHM(slot)}</span>
            </p>
            <p className="mt-[3px] font-number text-v2-trace text-ink-secondary">
              约 {engineDurationMin ?? service?.durationMin ?? 60} 分钟
            </p>
          </div>
        ) : null}
      </section>

      {/* 折叠区：收款方式 + 附加项 + 备注（U1-D：洗护师迁出为独立横卡区） */}
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
          addons={addonServices}
          selectedAddonIds={addonIds}
          onToggleAddon={toggleAddon}
        />
        {/* 附加项计价口径明面（前端估=server 算同口径，以 server 结算为准） */}
        {addonIds.length > 0 ? (
          <p className="mt-1 text-caption-xs text-ink-placeholder">{bkc('booking.addonPriceNote')}</p>
        ) : null}
      </section>

      {/* 吸底确认条（fixed 于 TabBar 上方；B9a 任务 C：约 N 分钟 = 时长引擎输出，
          引擎未输出时回退服务默认 durationMin；体验大批片 2：价=主价+Σ附加） */}
      <ConfirmBar
        priceFen={totalFen}
        durationMin={engineDurationMin ?? service?.durationMin ?? null}
        missingLabel={missingLabel}
        submitting={createM.isPending}
        onConfirm={() => createM.mutate()}
        petName={petName}
        serviceName={service?.name ?? null}
        staffName={staffName}
        slot={slot}
        paymentMode={paymentMode}
      />
    </div>
  );
}
