/**
 * 寄养预约（T2.2 · 4 屏）：
 *   屏1 选入住/退房日期（今日起 14 天；退房 > 入住；门店休息日禁选）
 *   屏2 选房型（boarding 服务项卡，含 boarding_room_type；顶部可切换门店，联动刷新）
 *   屏3 选宠物（疫苗硬校验：vaccine_valid_until 为空或早于退房日 → 红色阻断卡 + 跳档案页补录）
 *   屏4 确认提交（scheduled_start=入住日开店时刻、scheduled_end=退房日同时刻）
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import PetPicker from '@/components/booking/PetPicker';
import StepIndicator from '@/components/booking/StepIndicator';
import SummaryChips from '@/components/booking/SummaryChips';
import { friendlyError, useToast } from '@/components/booking/Toast';
import {
  dayLabel,
  fenToYuan,
  fmtMD,
  nightsBetween,
  PAYMENT_MODE_META,
  toISODate,
  weekCN,
} from '@/components/booking/format';
import type { StoreItem } from '@/components/booking/types';

const STEPS = ['选日期', '选房型', '选宠物', '确认'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** 门店某日是否休息 */
const isClosed = (store: StoreItem | null, d: Date) =>
  !store?.openHours?.[DAY_KEYS[d.getDay()]!];

/** 入住时刻：当日开店时间，向上对齐 30min 粒度（服务端强校验） */
function checkinAt(store: StoreItem, d: Date): Date {
  const hours = store.openHours?.[DAY_KEYS[d.getDay()]!];
  const [oh = 10, om = 0] = (hours?.open ?? '10:00').split(':').map(Number);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), oh, om, 0, 0);
  const rem = t.getMinutes() % 30;
  if (rem !== 0) t.setMinutes(t.getMinutes() + (30 - rem));
  return t;
}

export default function BookingBoardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast();

  const [step, setStep] = useState(1);
  const [storeId, setStoreId] = useState<string | null>(searchParams.get('storeId'));
  const [checkin, setCheckin] = useState<Date | null>(null);
  const [checkout, setCheckout] = useState<Date | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'pay_at_store' | 'pass_deduct'>('pay_at_store');
  const [note, setNote] = useState('');

  /* ---- 数据 ---- */
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  });
  const effStoreId = storeId ?? nearbyQ.data?.stores[0]?.id ?? null;
  const store = nearbyQ.data?.stores.find((s) => s.id === effStoreId) ?? null;

  const servicesQ = useQuery({
    queryKey: ['store', 'getWithServices', effStoreId, 'boarding'],
    queryFn: () => trpc.store.getWithServices.query({ storeId: effStoreId! }),
    enabled: effStoreId !== null && step >= 2,
  });
  const boardingServices = useMemo(
    () => (servicesQ.data?.services ?? []).filter((s) => s.type === 'boarding'),
    [servicesQ.data],
  );
  const service = boardingServices.find((s) => s.id === serviceId) ?? null;

  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    enabled: step >= 3,
  });

  /* ---- 日期栅格 ---- */
  const today = new Date();
  const checkinDays = useMemo(
    () => Array.from({ length: 14 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const checkoutDays = useMemo(() => {
    if (!checkin) return [];
    return Array.from(
      { length: 14 },
      (_, i) => new Date(checkin.getFullYear(), checkin.getMonth(), checkin.getDate() + i + 1),
    );
  }, [checkin]);

  const pickCheckin = (d: Date) => {
    setCheckin(d);
    if (checkout && checkout <= d) setCheckout(null);
  };

  const pickStore = (id: string) => {
    if (id === effStoreId) return;
    setStoreId(id);
    setServiceId(null);
    // 新门店若在所选日期休息，清掉该日期
    const next = nearbyQ.data?.stores.find((s) => s.id === id) ?? null;
    if (checkin && isClosed(next, checkin)) setCheckin(null);
    if (checkout && isClosed(next, checkout)) setCheckout(null);
  };

  /* ---- 提交 ---- */
  const createM = useMutation({
    mutationFn: () => {
      if (!store || !checkin || !checkout) throw new Error('信息不完整');
      const start = checkinAt(store, checkin);
      const end = checkinAt(store, checkout);
      return trpc.appointment.create.mutate({
        storeId: store.id,
        petId: petId!,
        serviceId: serviceId!,
        type: 'boarding',
        scheduledStart: start,
        scheduledEnd: end,
        paymentMode,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    },
    onSuccess: (appt) => {
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      navigate(`/booking/success?aid=${encodeURIComponent(appt.id)}`, { replace: true });
    },
    onError: (err) => showToast(friendlyError(err, '预约失败，请稍后再试')),
  });

  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0;
  const canNext =
    (step === 1 && checkin !== null && checkout !== null) ||
    (step === 2 && serviceId !== null) ||
    (step === 3 && petId !== null);

  const dayBtn = (
    d: Date,
    active: boolean,
    disabled: boolean,
    onClick: () => void,
  ) => (
    <button
      key={d.getTime()}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-input px-1 py-2 text-center transition ${
        active
          ? 'bg-brand-primary font-semibold text-white shadow-card'
          : disabled
            ? 'cursor-not-allowed bg-sunken text-ink-placeholder'
            : 'bg-card text-ink shadow-card active:scale-95'
      }`}
    >
      <span className="block text-caption">{d.getTime() === checkinDays[0]?.getTime() ? '今天' : weekCN(d)}</span>
      <span className="block font-number text-body">{fmtMD(d)}</span>
    </button>
  );

  return (
    <div className="px-4 py-6">
      {toastEl}

      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          aria-label="返回"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-card active:scale-92"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A7A6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-title-lg">预约寄养</h1>
      </header>

      <div className="mt-4">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      <div className="mt-4">
        <SummaryChips
          chips={[
            ...(checkin && checkout && step > 1
              ? [
                  {
                    label: '日期',
                    value: `${fmtMD(checkin)}→${fmtMD(checkout)}·${nights}晚`,
                    onClick: () => setStep(1),
                  },
                ]
              : []),
            ...(service && step > 2
              ? [{ label: '房型', value: service.boardingRoomType ?? service.name, onClick: () => setStep(2) }]
              : []),
          ]}
        />
      </div>

      {/* 屏1：入住 / 退房日期 */}
      {step === 1 ? (
        <section className="mt-4">
          {store ? (
            <p className="mb-3 text-caption text-ink-secondary">
              寄养门店：<span className="font-medium text-ink">{store.name}</span>
              （可在下一步更换）
            </p>
          ) : null}

          <h2 className="text-title">入住日期</h2>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {checkinDays.map((d) =>
              dayBtn(d, checkin?.getTime() === d.getTime(), isClosed(store, d), () => pickCheckin(d)),
            )}
          </div>

          {checkin ? (
            <>
              <h2 className="mt-5 text-title">退房日期</h2>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {checkoutDays.map((d) =>
                  dayBtn(d, checkout?.getTime() === d.getTime(), isClosed(store, d), () => setCheckout(d)),
                )}
              </div>
            </>
          ) : null}

          {checkin && checkout ? (
            <p className="mt-3 rounded-card bg-brand-primary-light px-4 py-2.5 text-body text-brand-primary-pressed">
              {dayLabel(checkin)}入住 · {fmtMD(checkout)} {weekCN(checkout)}退房 · 共{' '}
              <span className="font-number font-semibold">{nights}</span> 晚
            </p>
          ) : (
            <p className="mt-3 text-caption text-ink-placeholder">先选入住日，再选退房日（须晚于入住日）</p>
          )}
        </section>
      ) : null}

      {/* 屏2：选房型（可切门店） */}
      {step === 2 ? (
        <section className="mt-4">
          <h2 className="text-title">寄养门店</h2>
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {(nearbyQ.data?.stores ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickStore(s.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-body transition ${
                  s.id === effStoreId
                    ? 'bg-brand-primary font-semibold text-white'
                    : 'bg-card text-ink shadow-card'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <h2 className="mt-5 text-title">选择房型</h2>
          <div className="mt-2 space-y-2">
            {servicesQ.isPending ? (
              [1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-card bg-sunken" />)
            ) : servicesQ.isError ? (
              <div className="rounded-card bg-sunken px-4 py-8 text-center">
                <p className="text-caption text-ink-secondary">房型加载失败，请检查网络</p>
                <button
                  type="button"
                  onClick={() => void servicesQ.refetch()}
                  className="mt-2 text-caption font-semibold text-brand-primary"
                >
                  重新加载
                </button>
              </div>
            ) : boardingServices.length === 0 ? (
              <p className="rounded-card bg-sunken px-4 py-8 text-center text-caption text-ink-secondary">
                该门店暂无寄养房型，换一家看看
              </p>
            ) : (
              boardingServices.map((s) => {
                const active = s.id === serviceId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className={`flex w-full items-center justify-between rounded-card bg-card p-4 text-left shadow-card transition active:scale-[0.99] ${active ? 'ring-2 ring-brand-primary' : ''}`}
                  >
                    <span>
                      <span className="block text-body font-semibold">
                        {s.boardingRoomType ?? s.name}
                      </span>
                      {s.boardingRoomType ? (
                        <span className="mt-0.5 block text-caption text-ink-secondary">{s.name}</span>
                      ) : null}
                    </span>
                    <span className="text-right">
                      <span className="block font-number text-price text-brand-primary">
                        {fenToYuan(s.priceFen)}
                      </span>
                      <span className="text-caption text-ink-placeholder">/ 次</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      ) : null}

      {/* 屏3：选宠物（疫苗硬校验，须覆盖到退房日） */}
      {step === 3 ? (
        <section className="mt-4">
          <h2 className="text-title">选择宠物</h2>
          <p className="mt-1 text-caption text-ink-secondary">
            寄养要求疫苗有效期覆盖至退房日（{checkout ? toISODate(checkout) : '—'}）
          </p>
          <div className="mt-2">
            <PetPicker
              pets={petsQ.data ?? []}
              selectedId={petId}
              onSelect={setPetId}
              requireVaccineUntil={checkout}
              loading={petsQ.isPending}
            />
          </div>
        </section>
      ) : null}

      {/* 屏4：确认 */}
      {step === 4 ? (
        <section className="mt-4">
          <div className="rounded-card bg-card p-4 shadow-card">
            <h2 className="text-title">预约信息</h2>
            <dl className="mt-2 space-y-1.5 text-body">
              <div className="flex justify-between">
                <dt className="text-ink-secondary">门店</dt>
                <dd>{store?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">入住</dt>
                <dd>{checkin ? `${fmtMD(checkin)} ${weekCN(checkin)}` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">退房</dt>
                <dd>{checkout ? `${fmtMD(checkout)} ${weekCN(checkout)}（${nights} 晚）` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">房型</dt>
                <dd>{service ? (service.boardingRoomType ?? service.name) : '—'}</dd>
              </div>
            </dl>
          </div>

          <h2 className="mt-5 text-title">收款方式</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['pay_at_store', 'pass_deduct'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMode(m)}
                className={`rounded-card bg-card p-3.5 text-left shadow-card transition active:scale-[0.99] ${paymentMode === m ? 'ring-2 ring-brand-primary' : ''}`}
              >
                <span className="block text-body font-semibold">{PAYMENT_MODE_META[m].label}</span>
                <span className="mt-0.5 block text-caption text-ink-secondary">
                  {PAYMENT_MODE_META[m].hint}
                </span>
              </button>
            ))}
          </div>

          <h2 className="mt-5 text-title">备注</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="饮食习惯、每日喂药、性格注意事项…"
            className="mt-2 w-full rounded-input border border-line bg-card px-3.5 py-3 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
          />

          {service ? (
            <div className="mt-4 flex items-center justify-between rounded-card bg-card px-4 py-3 shadow-card">
              <span className="text-body text-ink-secondary">合计</span>
              <span className="font-number text-price text-brand-primary">{fenToYuan(service.priceFen)}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-6">
        {step < 4 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-white shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:bg-line disabled:text-ink-placeholder"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            disabled={createM.isPending}
            onClick={() => createM.mutate()}
            className="h-12 w-full rounded-full bg-philia-gradient text-body font-semibold text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
          >
            {createM.isPending ? '提交中…' : '确认预约'}
          </button>
        )}
      </div>
    </div>
  );
}
