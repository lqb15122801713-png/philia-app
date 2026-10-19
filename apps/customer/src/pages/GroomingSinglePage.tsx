import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared';
import { friendlyError, useToast } from '@philia/shared';
import DateStripBlock from '@/components/booking/single/DateStripBlock';
import TimeGridBlock from '@/components/booking/single/TimeGridBlock';
import ConfirmBar from '@/components/booking/single/ConfirmBar';
import BottomSheet from '@/components/booking/single/BottomSheet';
import StaffHalfSheet from '@/components/booking/single/StaffHalfSheet';
import { availableSetOf, buildWeekGrid, isSameDay } from '@/components/booking/single/slotGrid';
import { fenToYuan, fmtHM } from '@/components/booking/format';
import { readLastBooking, resolvePetId, resolveServiceId, resolveStoreId, writeLastBooking } from '@/lib/bookingPrefill';
import { createAppointmentExp2 } from '@/lib/exp2Api';
import { mc } from '@/components/member/copy';
import { bkc } from '@/copy/booking';

const GROOMING_DEFAULT_ORDER = [
  'bookingGrooming.header',
  'bookingGrooming.selectionChips',
  'bookingGrooming.dateTime',
  'bookingGrooming.confirmBar',
] as const;
const GROOMING_REGISTRY = GROOMING_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));

type SelectionSheet = 'store' | 'pet' | 'service' | 'staff' | null;

export default function GroomingSinglePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  );
  const previewStoreId = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasStore'),
    [],
  );
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, []);

  const [storeOverride, setStoreOverride] = useState<string | null>(searchParams.get('storeId'));
  const [serviceOverride, setServiceOverride] = useState<string | null>(searchParams.get('serviceId'));
  const [petOverride, setPetOverride] = useState<string | null>(searchParams.get('petId'));
  const [staffId, setStaffId] = useState<string | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [activeSheet, setActiveSheet] = useState<SelectionSheet>(null);

  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  });
  const nearbyStores = nearbyQ.data?.stores ?? [];
  const effStoreId = nearbyQ.isSuccess
    ? resolveStoreId(storeOverride, nearbyStores, readLastBooking())
    : storeOverride;
  const canvasStoreId = previewStoreId ?? memoryStoreId ?? nearbyStores[0]?.id ?? null;
  const canvasLayout = useCanvasLayout('bookingGrooming', canvasStoreId, GROOMING_REGISTRY);
  const layout = GROOMING_DEFAULT_ORDER.map((blockKey) => ({
    blockKey,
    visible: canvasLayout.find((block) => block.blockKey === blockKey)?.visible !== false,
  }));

  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
  });
  const pets = petsQ.data ?? [];
  const petId = petsQ.isSuccess
    ? (resolvePetId(petOverride, pets, readLastBooking()) ?? pets[0]?.id ?? null)
    : petOverride;

  const servicesQ = useQuery({
    queryKey: ['store', 'getWithServices', effStoreId, serviceOverride, petId],
    queryFn: () =>
      trpc.store.getWithServices.query({
        storeId: effStoreId!,
        serviceId: serviceOverride ?? undefined,
        petId: petId ?? undefined,
      }),
    enabled: effStoreId !== null,
  });

  const groomingServices = useMemo(
    () => (servicesQ.data?.services ?? []).filter((service) => service.type === 'grooming'),
    [servicesQ.data],
  );
  const serviceId = servicesQ.isSuccess
    ? resolveServiceId(serviceOverride, groomingServices, readLastBooking())
    : serviceOverride;

  const staffQ = useQuery({
    queryKey: ['store', 'listStaffPublic', effStoreId],
    queryFn: () => trpc.store.listStaffPublic.query({ storeId: effStoreId! }),
    enabled: effStoreId !== null,
  });

  const store = servicesQ.data?.store ?? nearbyStores.find((item) => item.id === effStoreId) ?? null;
  const slots = useMemo(() => servicesQ.data?.slots ?? [], [servicesQ.data]);
  const days = useMemo(
    () => (store ? buildWeekGrid(store, slots, servicesQ.data?.advanceDays ?? 7) : []),
    [store, slots, servicesQ.data?.advanceDays],
  );
  const autoDay = days.find((item) => item.hasAvailable)?.date ?? days[0]?.date ?? null;
  const selectedDay = day ?? autoDay;
  const selectedDayGrid = selectedDay ? (days.find((item) => isSameDay(item.date, selectedDay)) ?? null) : null;
  const availableTimes = useMemo(() => availableSetOf(slots), [slots]);
  const nextAvailableSlot = useMemo(() => {
    let next: Date | null = null;
    for (const time of selectedDayGrid?.grid ?? []) {
      if (availableTimes.has(time.getTime()) && (!next || time.getTime() < next.getTime())) next = time;
    }
    return next;
  }, [selectedDayGrid, availableTimes]);

  const pickStore = (id: string) => {
    if (id === effStoreId) return;
    setStoreOverride(id);
    setServiceOverride(null);
    setStaffId(null);
    setDay(null);
    setSlot(null);
  };
  const pickService = (id: string) => {
    if (id !== serviceId) setSlot(null);
    setServiceOverride(id);
  };
  const pickDay = (nextDay: Date) => {
    if (!selectedDay || !isSameDay(nextDay, selectedDay)) setSlot(null);
    setDay(nextDay);
  };

  const service = groomingServices.find((item) => item.id === serviceId) ?? null;
  const staffName = staffQ.data?.staff.find((member) => member.id === staffId)?.name ?? null;
  const pet = pets.find((item) => item.id === petId) ?? null;

  const serviceDurations = servicesQ.data?.serviceDurations ?? null;
  const durationById = useMemo(
    () =>
      serviceDurations
        ? Object.fromEntries(Object.entries(serviceDurations).map(([id, value]) => [id, value.durationMin]))
        : null,
    [serviceDurations],
  );
  const engineDurationMin = serviceId ? (durationById?.[serviceId] ?? null) : null;

  const createM = useMutation({
    mutationFn: () => {
      const note = staffName ? `【希望洗护师：${staffName}】` : '';
      return createAppointmentExp2(trpc, {
        storeId: effStoreId!,
        petId: petId!,
        serviceId: serviceId!,
        type: 'grooming',
        scheduledStart: slot!,
        paymentMode: 'pay_at_store',
        ...(note ? { note } : {}),
      });
    },
    onSuccess: (appointment) => {
      writeLastBooking({ storeId: effStoreId!, serviceId: serviceId!, petId: petId! });
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      navigate(`/booking/success?aid=${encodeURIComponent(appointment.id)}`, { replace: true });
    },
    onError: (error) => {
      showToast(friendlyError(error, '预约失败，请稍后再试'), 'error');
      void servicesQ.refetch();
    },
  });

  const noPets = petsQ.isSuccess && pets.length === 0;
  const missingLabel = noPets
    ? bkc('booking.needPet')
    : petId === null
      ? bkc('booking.choosePet')
      : effStoreId === null
        ? bkc('booking.chooseStore')
        : serviceId === null
          ? bkc('booking.chooseService')
          : slot === null
            ? '请先选择时段'
            : null;

  const chipClass = 'flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-line bg-card px-3.5 text-caption text-ink transition active:scale-95';
  const renderers: Record<string, () => ReactNode> = {
    'bookingGrooming.header': () => (
      <header>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-v2-screen"><CK k="booking.groomingTitle">预约</CK></h1>
          <Link to="/appointments" className="shrink-0 text-caption text-ink">我的预约</Link>
        </div>
        <p className="mt-1 text-caption text-ink-secondary">默认已填门店 / 毛孩子 / 服务 / 美容师</p>
      </header>
    ),

    'bookingGrooming.selectionChips': () => (
      <section className="mt-5" aria-label="预约预填选择">
        <div data-testid="u2-booking-chips" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" data-testid="u2-chip-store" onClick={() => setActiveSheet('store')} className={chipClass} title={store?.name ?? '选择门店'}>
            <span className="max-w-36 truncate">{store?.name ?? '选择门店'}</span><span aria-hidden="true">▾</span>
          </button>
          <button type="button" data-testid="u2-chip-pet" onClick={() => setActiveSheet('pet')} className={chipClass} title={pet?.name ?? '选择宠物'}>
            <span className="max-w-24 truncate">{pet?.name ?? '选择宠物'}</span><span aria-hidden="true">▾</span>
          </button>
          <button type="button" data-testid="u2-chip-service" onClick={() => setActiveSheet('service')} className={chipClass} title={service?.name ?? '选择服务'}>
            <span className="max-w-36 truncate">{service?.name ?? '选择服务'}</span><span aria-hidden="true">▾</span>
          </button>
          <button type="button" data-testid="u2-chip-staff" onClick={() => setActiveSheet('staff')} className={chipClass}>
            <span className="max-w-24 truncate">{staffName ?? '系统分配'}</span><span aria-hidden="true">▾</span>
          </button>
        </div>
      </section>
    ),

    'bookingGrooming.dateTime': () => (
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-body-lg font-semibold"><CK k="booking.groomingDateTitle">{bkc('booking.groomingDateTitle')}</CK></h2>
          <span className="text-caption text-ink-secondary">{selectedDay ? selectedDay.getMonth() + 1 : new Date().getMonth() + 1}月</span>
        </div>
        <div className="mt-3">
          <DateStripBlock days={days} selectedDay={selectedDay} onPickDay={pickDay} />
        </div>
        <h2 className="mt-6 text-body-lg font-semibold">选择时段</h2>
        <div className="mt-3">
          <TimeGridBlock
            day={selectedDayGrid}
            slots={slots}
            selected={slot}
            onSelect={setSlot}
            loading={servicesQ.isPending || servicesQ.isFetching}
          />
        </div>
      </section>
    ),

    'bookingGrooming.confirmBar': () => (
      <ConfirmBar
        priceFen={service?.priceFen ?? null}
        durationMin={engineDurationMin ?? service?.durationMin ?? null}
        missingLabel={missingLabel}
        submitting={createM.isPending}
        onConfirm={() => createM.mutate()}
        slot={slot}
        nextSlotLabel={nextAvailableSlot ? fmtHM(nextAvailableSlot) : null}
      />
    ),
  };

  return (
    <CanvasLayoutLoader pageKey="bookingGrooming" storeId={canvasStoreId}>
      <div className="px-4 pb-44 pt-7" data-testid="grooming-single">
        {toastEl}
        {isCanvasPreview ? (
          <p className="text-center text-caption text-ink-secondary" data-testid="gs-canvas-preview-note">
            {mc('mc.canvasExampleNote')}
          </p>
        ) : null}
        {layout.map((block) => (
          <section data-block-key={block.blockKey} key={block.blockKey}>
            {block.visible ? (renderers[block.blockKey]?.() ?? null) : null}
          </section>
        ))}

        {activeSheet === 'store' ? (
          <BottomSheet title="选择门店" onClose={() => setActiveSheet(null)} testId="u2-store-sheet">
            <div className="space-y-2">
              {nearbyStores.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    pickStore(item.id);
                    setActiveSheet(null);
                  }}
                  className={`min-h-14 w-full rounded-[16px] border p-4 text-left ${item.id === effStoreId ? 'border-brand-cta' : 'border-line'}`}
                >
                  <span className="block text-body font-semibold">{item.name}</span>
                  {item.address ? <span className="mt-1 block text-caption text-ink-secondary">{item.address}</span> : null}
                </button>
              ))}
            </div>
          </BottomSheet>
        ) : null}

        {activeSheet === 'pet' ? (
          <BottomSheet title="选择宠物" onClose={() => setActiveSheet(null)} testId="u2-pet-sheet">
            {pets.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-body font-semibold">{bkc('booking.noPetTitle')}</p>
                <p className="mt-2 text-caption text-ink-secondary">{bkc('booking.noPetBodyWizard')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSheet(null);
                    navigate('/philia/pets');
                  }}
                  className="mt-4 min-h-11 rounded-full bg-brand-cta px-6 text-body text-brand-cta-on"
                >
                  {bkc('booking.noPetCta')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {pets.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id !== petId) setSlot(null);
                      setPetOverride(item.id);
                      setActiveSheet(null);
                    }}
                    className={`min-h-14 w-full rounded-[16px] border p-4 text-left ${item.id === petId ? 'border-brand-cta' : 'border-line'}`}
                  >
                    <span className="block text-body font-semibold">{item.name}</span>
                    <span className="mt-1 block text-caption text-ink-secondary">{[item.species, item.breed, item.weightKg ? `${item.weightKg}kg` : null].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
          </BottomSheet>
        ) : null}

        {activeSheet === 'service' ? (
          <BottomSheet title="选择服务" onClose={() => setActiveSheet(null)} testId="u2-service-sheet">
            <div className="space-y-2">
              {groomingServices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    pickService(item.id);
                    setActiveSheet(null);
                  }}
                  className={`min-h-14 w-full rounded-[16px] border p-4 text-left ${item.id === serviceId ? 'border-brand-cta' : 'border-line'}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-body font-semibold">{item.name}</span>
                    <span className="shrink-0 font-number text-body">{fenToYuan(item.priceFen)}</span>
                  </span>
                  <span className="mt-1 block text-caption text-ink-secondary">约 {durationById?.[item.id] ?? item.durationMin ?? 60} 分钟</span>
                </button>
              ))}
            </div>
          </BottomSheet>
        ) : null}

        {activeSheet === 'staff' ? (
          <StaffHalfSheet
            key={effStoreId ?? 'no-store'}
            staff={staffQ.data?.staff ?? []}
            selectedId={staffId}
            storeName={store?.name ?? null}
            loading={staffQ.isPending}
            onSelect={setStaffId}
            onClose={() => setActiveSheet(null)}
          />
        ) : null}
      </div>
    </CanvasLayoutLoader>
  );
}
